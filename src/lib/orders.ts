/**
 * Persistent orders data-access (Supabase `public.orders`, `public.order_items`,
 * `public.order_status_events`). Replaces the client-only sessionStorage receipt
 * with a real, server-owned order that the customer and the admin Orders Portal
 * both read back.
 *
 * Service-role only — import from Node route handlers, never client/Edge. RLS on
 * these tables has no policies, so only the service-role client (which bypasses
 * RLS) can touch them; customer-facing reads are scoped by `customerId`, admin
 * reads go through admin-gated routes.
 *
 * Money is integer paise (₹1 = 100 paise) end to end. Totals are ALWAYS
 * recomputed here from the persisted variant/product prices + the live commerce
 * rules — the client-supplied totals are never trusted.
 *
 * Status is forward-only (placed → confirmed → packed → shipped → delivered).
 * There is no cancel/refund transition (§3.9 no-cancellation); any backward or
 * lateral move is rejected.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCommerceRules, type CommerceRulesRecord } from "@/lib/commerce-rules";
import {
  validateCouponServer,
  quoteLoyaltyRedemption,
  recordCouponUse,
  redeemPoints,
  earnPointsForOrder,
  CouponInvalidError,
} from "@/lib/rewards";
import {
  getActivePromotions,
  promoPercentForProduct,
  applyPromoPaise,
} from "@/lib/promotions";
import { rewardReferralIfEligible } from "@/lib/referrals";

/**
 * Thrown by {@link createOrder} when one or more ordered lines cannot be
 * reserved because their available `stock - reserved` is short (or the variant
 * is inactive/removed). The order is NOT persisted when this is thrown — the
 * atomic reservation runs before any row is written. The API layer maps it to a
 * 409 with an `out-of-stock` code so checkout can explain the failure; the
 * `variantIds` carry the first line that could not be fulfilled.
 */
export class OutOfStockError extends Error {
  readonly variantIds: string[];
  constructor(variantIds: string[] = []) {
    super("out-of-stock");
    this.name = "OutOfStockError";
    this.variantIds = variantIds;
  }
}

/* ── status model ─────────────────────────────────────────────────────── */

/** Fulfilment lifecycle — forward-only, no cancelled/refunded (§3.9). */
export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered";

export type PaymentStatus = "pending" | "paid" | "failed";

/** Forward-only status pipeline; index in this array is the rank. */
export const ORDER_STATUS_FLOW: readonly OrderStatus[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

function statusRank(status: string): number {
  return ORDER_STATUS_FLOW.indexOf(status as OrderStatus);
}

/** Whether `next` is a strictly-forward move from `current`. */
export function isForwardTransition(current: string, next: string): boolean {
  const from = statusRank(current);
  const to = statusRank(next);
  return from >= 0 && to >= 0 && to > from;
}

/* ── record shapes (camelCase view of the rows) ───────────────────────── */

export interface OrderItemRecord {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  variantSku: string | null;
  title: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  snapshot: Record<string, unknown> | null;
}

export interface OrderStatusEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  at: string;
  by: string;
}

/** A persisted order, camelCased. Money in integer paise. */
export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string | null;
  userEmail: string | null;
  userPhone: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: string;
  paymentRef: string | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  couponCode: string | null;
  loyaltyRedeemedPaise: number;
  currency: string;
  addressSnapshot: Record<string, unknown> | null;
  slotSnapshot: Record<string, unknown> | null;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** An order with its line items + status history (detail view). */
export interface OrderWithDetail extends OrderRecord {
  items: OrderItemRecord[];
  events: OrderStatusEvent[];
}

/* ── row shapes + mappers ─────────────────────────────────────────────── */

interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  user_email: string | null;
  user_phone: string | null;
  status: string;
  payment_status: string;
  payment_provider: string;
  payment_ref: string | null;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  tax_paise: number;
  total_paise: number;
  coupon_code: string | null;
  loyalty_redeemed_paise: number;
  currency: string;
  address_snapshot: Record<string, unknown> | null;
  slot_snapshot: Record<string, unknown> | null;
  placed_at: string;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  variant_sku: string | null;
  title: string;
  qty: number;
  unit_price_paise: number;
  line_total_paise: number;
  snapshot: Record<string, unknown> | null;
}

interface OrderEventRow {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  at: string;
  by: string;
}

const ORDER_COLS =
  "id, order_number, customer_id, user_email, user_phone, status, payment_status, payment_provider, payment_ref, subtotal_paise, discount_paise, shipping_paise, tax_paise, total_paise, coupon_code, loyalty_redeemed_paise, currency, address_snapshot, slot_snapshot, placed_at, created_at, updated_at";
const ITEM_COLS =
  "id, order_id, product_id, variant_id, variant_sku, title, qty, unit_price_paise, line_total_paise, snapshot";
const EVENT_COLS = "id, order_id, status, note, at, by";

function toStatus(raw: string): OrderStatus {
  return statusRank(raw) >= 0 ? (raw as OrderStatus) : "placed";
}

function toPaymentStatus(raw: string): PaymentStatus {
  return raw === "paid" || raw === "failed" ? raw : "pending";
}

function toOrder(r: OrderRow): OrderRecord {
  return {
    id: r.id,
    orderNumber: r.order_number,
    customerId: r.customer_id,
    userEmail: r.user_email,
    userPhone: r.user_phone,
    status: toStatus(r.status),
    paymentStatus: toPaymentStatus(r.payment_status),
    paymentProvider: r.payment_provider,
    paymentRef: r.payment_ref,
    subtotalPaise: r.subtotal_paise,
    discountPaise: r.discount_paise,
    shippingPaise: r.shipping_paise,
    taxPaise: r.tax_paise,
    totalPaise: r.total_paise,
    couponCode: r.coupon_code,
    loyaltyRedeemedPaise: r.loyalty_redeemed_paise,
    currency: r.currency || "INR",
    addressSnapshot: r.address_snapshot,
    slotSnapshot: r.slot_snapshot,
    placedAt: r.placed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toItem(r: OrderItemRow): OrderItemRecord {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    variantId: r.variant_id,
    variantSku: r.variant_sku,
    title: r.title,
    qty: r.qty,
    unitPricePaise: r.unit_price_paise,
    lineTotalPaise: r.line_total_paise,
    snapshot: r.snapshot,
  };
}

function toEvent(r: OrderEventRow): OrderStatusEvent {
  return {
    id: r.id,
    orderId: r.order_id,
    status: toStatus(r.status),
    note: r.note,
    at: r.at,
    by: r.by,
  };
}

/* ── server-side totals (the client is never trusted) ─────────────────── */

/** Delivery fee in paise for a subtotal, honouring the live commerce rules. */
function shippingPaiseFor(subtotalPaise: number, rules: CommerceRulesRecord): number {
  if (rules.shippingType === "zero") return 0;
  if (subtotalPaise >= rules.freeDeliveryThresholdPaise) return 0;
  if (rules.shippingType === "slab" && rules.shippingSlabs.length > 0) {
    const slabs = [...rules.shippingSlabs].sort((a, b) => a.uptoPaise - b.uptoPaise);
    for (const slab of slabs) {
      if (subtotalPaise <= slab.uptoPaise) return Math.max(0, Math.round(slab.feePaise));
    }
    return Math.max(0, Math.round(rules.shippingFlatPaise));
  }
  return Math.max(0, Math.round(rules.shippingFlatPaise));
}

/** Tax in paise on the discounted base — only when tax mode is "exclusive". */
function taxPaiseFor(taxableBasePaise: number, rules: CommerceRulesRecord): number {
  if (rules.taxMode !== "exclusive") return 0;
  const bps = rules.taxRateBps ?? 0;
  if (bps <= 0) return 0;
  return Math.round((Math.max(0, taxableBasePaise) * bps) / 10000);
}

/* ── order-number generation (NG-YY-XXXX, unique + monotonic-ish) ─────── */

/**
 * Generate the next human order number for the current year, e.g. "NG-26-1042".
 * The sequence continues from the highest existing number for this year (>=1000),
 * so numbers are unique and ascending — replacing the old random `NG-25-XXXX`.
 */
async function nextOrderNumber(): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(-2);
  const prefix = `NG-${yy}-`;
  const { data } = await supabaseAdmin()
    .from("orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let seq = 1000;
  const last = (data as { order_number: string } | null)?.order_number;
  if (last) {
    const parsed = Number.parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(parsed) && parsed >= seq) seq = parsed + 1;
  }
  return `${prefix}${seq}`;
}

/* ── create ───────────────────────────────────────────────────────────── */

/** A single line the caller wants on the order (priced server-side). */
export interface OrderLineInput {
  productId?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  title: string;
  qty: number;
  /** Optional free-form snapshot (unit label, image, lot, subscribe flag…). */
  snapshot?: Record<string, unknown> | null;
}

export interface CreateOrderInput {
  /** Canonical customer id (from the signed-in session); null for guest. */
  customerId: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  items: OrderLineInput[];
  /**
   * The coupon code the customer applied, if any. It is RE-VALIDATED here
   * against the server-owned catalogue + this customer's usage history — the
   * client's claimed discount amount is ignored. An invalid code throws a
   * {@link CouponInvalidError} so the caller can answer 400 with the reason.
   */
  couponCode?: string | null;
  /**
   * The number of loyalty points the customer asked to redeem. The server
   * clamps this to the live ledger balance and the program guardrails (min
   * points, max-percent, coupon headroom) before any paisa comes off — the
   * client can only ever request, never assert, a redemption value.
   */
  loyaltyPoints?: number;
  addressSnapshot?: Record<string, unknown> | null;
  slotSnapshot?: Record<string, unknown> | null;
  paymentProvider?: string;
}

/**
 * Resolve the authoritative unit price (paise) for each line from the persisted
 * catalog: a variant's `price_paise` when `variantId` is given, else the
 * product's `price_paise`. Unknown ids price at 0 (the line is still recorded).
 */
async function priceLines(
  lines: OrderLineInput[],
): Promise<{ line: OrderLineInput; unitPricePaise: number }[]> {
  const db = supabaseAdmin();
  const variantIds = Array.from(
    new Set(lines.map((l) => l.variantId).filter((v): v is string => !!v)),
  );
  const productIds = Array.from(
    new Set(lines.map((l) => l.productId).filter((p): p is string => !!p)),
  );

  const variantPrice = new Map<string, number>();
  if (variantIds.length > 0) {
    const { data } = await db
      .from("product_variants")
      .select("id, price_paise")
      .in("id", variantIds);
    for (const row of (data as { id: string; price_paise: number }[] | null) ?? []) {
      variantPrice.set(row.id, row.price_paise);
    }
  }

  const productPrice = new Map<string, number>();
  if (productIds.length > 0) {
    const { data } = await db
      .from("products")
      .select("id, price_paise")
      .in("id", productIds);
    for (const row of (data as { id: string; price_paise: number }[] | null) ?? []) {
      productPrice.set(row.id, row.price_paise);
    }
  }

  return lines.map((line) => {
    let unitPricePaise = 0;
    if (line.variantId && variantPrice.has(line.variantId)) {
      unitPricePaise = variantPrice.get(line.variantId) ?? 0;
    } else if (line.productId && productPrice.has(line.productId)) {
      unitPricePaise = productPrice.get(line.productId) ?? 0;
    }
    return { line, unitPricePaise: Math.max(0, Math.round(unitPricePaise)) };
  });
}

/**
 * Mark every priced line down by the best applicable LIVE occasion/seasonal
 * promotion, server-side, BEFORE coupon + loyalty run — so the subtotal those
 * compose on already reflects the sale (no double-counting). This is the same
 * {@link promoPercentForProduct} engine the storefront cards use, so the price a
 * shopper sees is the price they're charged.
 *
 * Best-effort: an unconfigured DB, no live promos, or any lookup error leaves the
 * line prices exactly as priced. A `scope: 'all'` promo needs no product metadata
 * (fast path); scoped promos resolve each line's product slug + category slug.
 */
async function applyPromotionsToPricedLines(
  priced: { line: OrderLineInput; unitPricePaise: number }[],
): Promise<{ line: OrderLineInput; unitPricePaise: number }[]> {
  if (priced.length === 0) return priced;
  try {
    const activePromos = await getActivePromotions();
    if (activePromos.length === 0) return priced;

    // Fast path: when every live promo targets the whole catalogue, one percent
    // applies to every line and we can skip the product-metadata lookups.
    if (activePromos.every((p) => p.scope === "all")) {
      const percent = activePromos.reduce((m, p) => Math.max(m, p.discountPercent), 0);
      if (percent <= 0) return priced;
      return priced.map(({ line, unitPricePaise }) => ({
        line,
        unitPricePaise: applyPromoPaise(unitPricePaise, percent),
      }));
    }

    const db = supabaseAdmin();

    // Resolve any variant-only lines to their owning product id.
    const variantIds = Array.from(
      new Set(priced.map((p) => p.line.variantId).filter((v): v is string => !!v)),
    );
    const variantToProduct = new Map<string, string>();
    if (variantIds.length > 0) {
      const { data } = await db
        .from("product_variants")
        .select("id, product_id")
        .in("id", variantIds);
      for (const row of (data as { id: string; product_id: string | null }[] | null) ?? []) {
        if (row.product_id) variantToProduct.set(row.id, row.product_id);
      }
    }
    const productIdFor = (line: OrderLineInput): string | null =>
      line.productId ?? (line.variantId ? variantToProduct.get(line.variantId) ?? null : null);

    // Load each product's slug + category id, then map category ids → slugs.
    const productIds = Array.from(
      new Set(priced.map((p) => productIdFor(p.line)).filter((v): v is string => !!v)),
    );
    const productMeta = new Map<string, { slug: string; categoryId: string | null }>();
    if (productIds.length > 0) {
      const { data } = await db
        .from("products")
        .select("id, slug, category_id")
        .in("id", productIds);
      for (const row of (data as { id: string; slug: string; category_id: string | null }[] | null) ?? []) {
        productMeta.set(row.id, { slug: row.slug, categoryId: row.category_id });
      }
    }
    const categoryIds = Array.from(
      new Set(
        Array.from(productMeta.values())
          .map((m) => m.categoryId)
          .filter((v): v is string => !!v),
      ),
    );
    const categorySlug = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data } = await db.from("categories").select("id, slug").in("id", categoryIds);
      for (const row of (data as { id: string; slug: string }[] | null) ?? []) {
        categorySlug.set(row.id, row.slug);
      }
    }

    return priced.map(({ line, unitPricePaise }) => {
      const pid = productIdFor(line);
      const meta = pid ? productMeta.get(pid) : undefined;
      if (!meta) return { line, unitPricePaise };
      const catSlug = meta.categoryId ? categorySlug.get(meta.categoryId) ?? null : null;
      const percent = promoPercentForProduct(
        { slug: meta.slug, categorySlug: catSlug, tags: catSlug ? [catSlug] : [] },
        activePromos,
      );
      return {
        line,
        unitPricePaise: percent > 0 ? applyPromoPaise(unitPricePaise, percent) : unitPricePaise,
      };
    });
  } catch {
    return priced; // a promo hiccup must never break checkout
  }
}

/**
 * Create an order: price every line from the catalog, RE-VALIDATE the coupon and
 * loyalty redemption server-side (the client's claimed amounts are ignored),
 * recompute the totals from the live commerce rules, insert the order + its
 * items, write the initial `placed` status event, then commit the reward
 * side-effects (coupon use, points burn, points earn) now that the order id
 * exists. Returns the full order with detail.
 *
 * Throws {@link CouponInvalidError} when a claimed coupon fails re-validation so
 * the caller can answer 400 with the concrete reason. Payment stays `pending` —
 * the payment seam flips it only on a verified charge.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderWithDetail> {
  const db = supabaseAdmin();

  // 1. Authoritative per-line prices (server-side), then mark them down by any
  //    LIVE occasion/seasonal promotion BEFORE coupon + loyalty run, so the
  //    subtotal those compose on already reflects the sale (no double-counting).
  const priced = await priceLines(input.items.filter((l) => l.qty > 0));
  const promoPriced = await applyPromotionsToPricedLines(priced);
  const lineTotals = promoPriced.map(({ line, unitPricePaise }) => ({
    line,
    unitPricePaise,
    qty: Math.max(1, Math.round(line.qty)),
    lineTotalPaise: unitPricePaise * Math.max(1, Math.round(line.qty)),
  }));
  const subtotalPaise = lineTotals.reduce((sum, l) => sum + l.lineTotalPaise, 0);

  // 2. Recompute discounts + shipping + tax from the live rules — never trusting
  //    the client's claimed amounts.
  const rules = await getCommerceRules();

  // 2a. Coupon: re-validate against the server catalogue + this customer's usage
  //     history. An invalid code aborts the order (the caller maps it to a 400).
  let couponDiscount = 0;
  let validatedCouponCode: string | null = null;
  const requestedCode = input.couponCode?.trim().toUpperCase() || null;
  if (requestedCode) {
    // Area-targeted coupons are matched against the pincode actually being
    // delivered to, taken from the order's own address snapshot — not from
    // anything the client asserted alongside the code.
    const rawPincode = input.addressSnapshot?.pincode;
    const deliveryPincode = typeof rawPincode === "string" ? rawPincode.trim() : null;
    const check = await validateCouponServer(requestedCode, subtotalPaise, input.customerId, {
      pincode: deliveryPincode,
    });
    if (!check.valid) throw new CouponInvalidError(check.reason ?? "not-found");
    couponDiscount = check.discountPaise;
    validatedCouponCode = check.coupon?.code ?? requestedCode;
  }

  // 2b. Loyalty: QUOTE the redemption (no ledger write yet) so the totals and the
  //     stored order row agree; the actual burn is committed once the order id
  //     exists. The quote clamps to the live balance + program guardrails and
  //     leaves the coupon its headroom (coupon + loyalty can't exceed subtotal).
  const loyaltyQuote = input.customerId
    ? await quoteLoyaltyRedemption(
        input.customerId,
        Math.max(0, Math.round(input.loyaltyPoints ?? 0)),
        subtotalPaise,
        couponDiscount,
      )
    : { points: 0, discountPaise: 0 };
  const loyaltyRedeemed = loyaltyQuote.discountPaise;

  const discountPaise = Math.min(couponDiscount + loyaltyRedeemed, subtotalPaise);
  const discountedBase = Math.max(0, subtotalPaise - discountPaise);
  const shippingPaise = shippingPaiseFor(subtotalPaise, rules);
  const taxPaise = taxPaiseFor(discountedBase, rules);
  const totalPaise = discountedBase + shippingPaise + taxPaise;

  // 2c. Reserve inventory ATOMICALLY, before persisting anything. Availability is
  //     `stock - reserved` everywhere in the app, so a hold is taken by bumping
  //     `reserved` under a `stock - reserved >= qty` guard (the reserve_variant_stock
  //     RPC). The RPC reserves every variant line in ONE transaction and RAISEs on
  //     the first short line, rolling the whole call back — so two concurrent orders
  //     for the last unit can't both succeed, and nothing is persisted when a line
  //     can't be fulfilled. Product-only lines (no variantId) carry no variant to
  //     lock and are skipped. Coupon re-validation already ran above, so we only
  //     hold stock once the order is otherwise valid.
  const reservation = lineTotals
    .filter((l) => Boolean(l.line.variantId))
    .map((l) => ({ variant_id: l.line.variantId as string, qty: l.qty }));
  if (reservation.length > 0) {
    const { error: reserveErr } = await db.rpc("reserve_variant_stock", {
      p_items: reservation,
    });
    if (reserveErr) {
      if (
        reserveErr.code === "P0001" ||
        /out_of_stock/i.test(reserveErr.message ?? "")
      ) {
        const m = /out_of_stock:([0-9a-fA-F-]+)/.exec(reserveErr.message ?? "");
        throw new OutOfStockError(m ? [m[1]] : []);
      }
      throw new Error(`Failed to reserve stock: ${reserveErr.message ?? "unknown"}`);
    }
  }

  // 3. Insert the order header.
  const orderNumber = await nextOrderNumber();
  const { data: orderData, error: orderErr } = await db
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: input.customerId,
      user_email: input.userEmail?.trim() || null,
      user_phone: input.userPhone?.trim() || null,
      status: "placed",
      payment_status: "pending",
      payment_provider: input.paymentProvider?.trim() || "razorpay",
      subtotal_paise: subtotalPaise,
      discount_paise: discountPaise,
      shipping_paise: shippingPaise,
      tax_paise: taxPaise,
      total_paise: totalPaise,
      coupon_code: validatedCouponCode,
      loyalty_redeemed_paise: loyaltyRedeemed,
      currency: rules.currency || "INR",
      address_snapshot: input.addressSnapshot ?? null,
      slot_snapshot: input.slotSnapshot ?? null,
    })
    .select(ORDER_COLS)
    .single();
  if (orderErr || !orderData) {
    // The header failed to persist, so no order will ever own the hold we just
    // took — give the reservation back (best-effort) rather than leak it.
    if (reservation.length > 0) {
      try {
        await db.rpc("release_variant_stock", { p_items: reservation });
      } catch {
        /* best-effort compensation — a stuck hold is admin-adjustable */
      }
    }
    throw new Error(`Failed to create order: ${orderErr?.message ?? "unknown"}`);
  }
  const order = toOrder(orderData as OrderRow);

  // 4. Insert the line items (best-effort: an empty cart still yields an order).
  let items: OrderItemRecord[] = [];
  if (lineTotals.length > 0) {
    const { data: itemData } = await db
      .from("order_items")
      .insert(
        lineTotals.map(({ line, unitPricePaise, qty, lineTotalPaise }) => ({
          order_id: order.id,
          product_id: line.productId ?? null,
          variant_id: line.variantId ?? null,
          variant_sku: line.variantSku?.trim() || null,
          title: line.title.trim() || "Item",
          qty,
          unit_price_paise: unitPricePaise,
          line_total_paise: lineTotalPaise,
          snapshot: line.snapshot ?? null,
        })),
      )
      .select(ITEM_COLS);
    items = ((itemData as OrderItemRow[] | null) ?? []).map(toItem);
  }

  // 5. Write the initial status event.
  const { data: eventData } = await db
    .from("order_status_events")
    .insert({ order_id: order.id, status: "placed", by: "system", note: "Order placed" })
    .select(EVENT_COLS);
  const events = ((eventData as OrderEventRow[] | null) ?? []).map(toEvent);

  // 6. Commit the reward side-effects now the order id exists. All best-effort:
  //    a bookkeeping hiccup must never void an order that is already placed.
  if (input.customerId) {
    // Record the coupon redemption (backs per-customer limits + used_count).
    if (validatedCouponCode && couponDiscount > 0) {
      try {
        await recordCouponUse(validatedCouponCode, input.customerId, order.id);
      } catch {
        /* best-effort — the order is already placed */
      }
    }
    // Burn the redeemed points against the ledger (re-clamps to live balance).
    if (loyaltyQuote.points > 0) {
      try {
        await redeemPoints(input.customerId, order.id, loyaltyQuote.points, subtotalPaise, couponDiscount);
      } catch {
        /* best-effort — the order is already placed */
      }
    }
    // Accrue earn points on the PAYABLE total (post-discount, incl shipping/tax).
    try {
      await earnPointsForOrder(input.customerId, order.id, totalPaise);
    } catch {
      /* best-effort — the order is already placed */
    }
  }

  return { ...order, items, events };
}

/* ── reads ────────────────────────────────────────────────────────────── */

/** Load an order's items + status history, oldest event first. */
async function loadDetail(orderId: string): Promise<{
  items: OrderItemRecord[];
  events: OrderStatusEvent[];
}> {
  const db = supabaseAdmin();
  const [{ data: itemData }, { data: eventData }] = await Promise.all([
    db.from("order_items").select(ITEM_COLS).eq("order_id", orderId).order("created_at", { ascending: true }),
    db.from("order_status_events").select(EVENT_COLS).eq("order_id", orderId).order("at", { ascending: true }),
  ]);
  return {
    items: ((itemData as OrderItemRow[] | null) ?? []).map(toItem),
    events: ((eventData as OrderEventRow[] | null) ?? []).map(toEvent),
  };
}

/** Fetch one order (with detail) by internal id OR human order number. */
export async function getOrder(idOrNumber: string): Promise<OrderWithDetail | null> {
  const key = idOrNumber.trim();
  if (!key) return null;
  // A "NG-…" value is an order number; otherwise treat it as a uuid id.
  const column = /^NG-/i.test(key) ? "order_number" : "id";
  const { data } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_COLS)
    .eq(column, key)
    .maybeSingle();
  if (!data) return null;
  const order = toOrder(data as OrderRow);
  const detail = await loadDetail(order.id);
  return { ...order, ...detail };
}

/**
 * A customer's own orders, newest first. Each carries its line items so the
 * order-history list can render thumbnails/counts without a second round-trip.
 */
export async function listOrdersForCustomer(
  customerId: string,
): Promise<OrderWithDetail[]> {
  const { data } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_COLS)
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false });
  const orders = ((data as OrderRow[] | null) ?? []).map(toOrder);
  return Promise.all(
    orders.map(async (o) => ({ ...o, ...(await loadDetail(o.id)) })),
  );
}

export interface AdminOrderFilter {
  search?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
  offset?: number;
}

export interface AdminOrderPage {
  orders: OrderWithDetail[];
  total: number;
}

/**
 * Admin orders list: filterable by fulfilment status, payment status, and a free
 * text search over order number / customer email / phone. Newest first, paged.
 */
export async function listOrdersAdmin(
  filter: AdminOrderFilter = {},
): Promise<AdminOrderPage> {
  const limit = Math.min(200, Math.max(1, filter.limit ?? 50));
  const offset = Math.max(0, filter.offset ?? 0);

  let query = supabaseAdmin()
    .from("orders")
    .select(ORDER_COLS, { count: "exact" })
    .order("placed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter.status) query = query.eq("status", filter.status);
  if (filter.paymentStatus) query = query.eq("payment_status", filter.paymentStatus);
  if (filter.search) {
    const term = filter.search.trim().replace(/[%,]/g, "");
    if (term) {
      query = query.or(
        `order_number.ilike.%${term}%,user_email.ilike.%${term}%,user_phone.ilike.%${term}%`,
      );
    }
  }

  const { data, count } = await query;
  const orders = ((data as OrderRow[] | null) ?? []).map(toOrder);
  const withDetail = await Promise.all(
    orders.map(async (o) => ({ ...o, ...(await loadDetail(o.id)) })),
  );
  return { orders: withDetail, total: count ?? 0 };
}

/* ── status transitions (forward-only) ────────────────────────────────── */

export interface AdvanceStatusResult {
  ok: boolean;
  order?: OrderWithDetail;
  error?: "not-found" | "invalid-status" | "not-forward";
}

/**
 * Advance an order's fulfilment status. Forward-only: the target must be a later
 * stage in {@link ORDER_STATUS_FLOW} than the current one. Any cancel/refund or
 * backward/lateral move is rejected — there is no un-place / un-deliver path
 * (§3.9 no-cancellation). Appends a status event crediting `byEmail`.
 */
export async function advanceOrderStatus(
  idOrNumber: string,
  nextStatus: string,
  byEmail: string,
  note?: string | null,
): Promise<AdvanceStatusResult> {
  if (statusRank(nextStatus) < 0) return { ok: false, error: "invalid-status" };

  const current = await getOrder(idOrNumber);
  if (!current) return { ok: false, error: "not-found" };

  if (!isForwardTransition(current.status, nextStatus)) {
    return { ok: false, error: "not-forward" };
  }

  const db = supabaseAdmin();
  const { error: updErr } = await db
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", current.id);
  if (updErr) return { ok: false, error: "not-found" };

  await db.from("order_status_events").insert({
    order_id: current.id,
    status: nextStatus,
    by: byEmail.trim() || "system",
    note: note?.trim() || null,
  });

  // Referral payout: when a sale is CONFIRMED, reward the referee's referral if
  // the order qualifies. Idempotent + best-effort — never disrupts the update.
  if (nextStatus === "confirmed") {
    try {
      await rewardReferralIfEligible(current.id);
    } catch {
      /* best-effort */
    }
  }

  const order = await getOrder(current.id);
  return order ? { ok: true, order } : { ok: false, error: "not-found" };
}

/* ── payment status (set by the payment seam, never the client) ───────── */

/**
 * Set an order's payment status + reference. Used by the (currently stubbed)
 * payment seam after a verified gateway result — never from a client-trusted
 * value. Returns the fresh order, or null when the order is unknown.
 */
export async function setOrderPayment(
  idOrNumber: string,
  paymentStatus: PaymentStatus,
  paymentRef?: string | null,
): Promise<OrderWithDetail | null> {
  const order = await getOrder(idOrNumber);
  if (!order) return null;
  const patch: Record<string, string | null> = { payment_status: paymentStatus };
  if (paymentRef !== undefined) patch.payment_ref = paymentRef;
  const { error } = await supabaseAdmin().from("orders").update(patch).eq("id", order.id);
  if (error) return null;
  return getOrder(order.id);
}

/** Whether the orders backend is usable (Supabase configured). */
export function isOrdersBackendReady(): boolean {
  return isSupabaseConfigured;
}
