/**
 * Subscriptions data access and lifecycle (Supabase `public.subscriptions`,
 * `public.subscription_items`, `public.subscription_deliveries`).
 *
 * Service-role only. Every customer-facing function takes the signed-in
 * customer's id and refuses rows that belong to anyone else.
 *
 * How a subscription turns into orders
 * ------------------------------------
 * The daily cron ({@link runSubscriptionCycle}) looks for active subscriptions
 * whose next delivery is within {@link DUE_LEAD_DAYS} days. For each it writes a
 * `due` delivery row and moves `next_delivery_on` forward one cycle.
 *
 *   - Cash on delivery: the order is created right away, through the same
 *     `createOrder` checkout uses (server prices, stock reservation, minimum
 *     order, serviceability), with the subscriber discount applied.
 *   - Pay online: the customer gets a reminder. The order is created when they
 *     press Pay ({@link payForDelivery}), then handed to SBIePay exactly like
 *     checkout. No autopay: the terms say each delivery is paid separately.
 *
 * A due pay-online delivery that is still unpaid when its date arrives becomes
 * `missed`. Nothing is charged and no stock is held for it.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  findBookableSlot,
  getCommerceRules,
  isServiceable,
  listDeliverySlots,
  type DeliverySlotRecord,
} from "@/lib/commerce-rules";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getCustomerById } from "@/lib/customer-identity";
import {
  createOrder,
  failUnpaidOnlineOrder,
  recordGatewayHandoff,
  type OrderLineInput,
  type OrderWithDetail,
} from "@/lib/orders";
import { beginPayment, isOnlinePaymentAvailable, type GatewayHandoff } from "@/lib/payments";
import { sendOrderPlacedEmail } from "@/lib/order-emails";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  DUE_LEAD_DAYS,
  MAX_ITEM_QTY,
  MAX_SUBSCRIPTION_ITEMS,
  SUBSCRIBER_DISCOUNT_BPS,
  addDays,
  applySubscriberDiscountPaise,
  formatDeliveryDate,
  frequencyLabel,
  indiaToday,
  isFrequency,
  isIsoDate,
  rollForward,
  startWindow,
  type DeliveryStatus,
  type SubscriptionPaymentMethod,
  type SubscriptionStatus,
} from "@/lib/subscriptions-core";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";

/* ── errors ───────────────────────────────────────────────────────────── */

export type SubscriptionErrorCode =
  | "bad-frequency"
  | "bad-start-date"
  | "no-items"
  | "too-many-items"
  | "item-unavailable"
  | "below-minimum"
  | "bad-address"
  | "not-serviceable"
  | "slot-unavailable"
  | "payment-unavailable"
  | "not-found"
  | "bad-state"
  | "busy";

/** A request the customer can correct. Routes answer it with a 4xx and the code. */
export class SubscriptionError extends Error {
  readonly code: SubscriptionErrorCode;
  readonly detail?: Record<string, unknown>;
  constructor(code: SubscriptionErrorCode, detail?: Record<string, unknown>) {
    super(code);
    this.name = "SubscriptionError";
    this.code = code;
    this.detail = detail;
  }
}

/* ── records ──────────────────────────────────────────────────────────── */

export interface SubscriptionItemRecord {
  id: string;
  productId: string | null;
  variantId: string | null;
  variantSku: string | null;
  title: string;
  qty: number;
  snapshot: Record<string, unknown> | null;
}

export interface SubscriptionDeliveryRecord {
  id: string;
  subscriptionId: string;
  scheduledOn: string;
  status: DeliveryStatus;
  orderId: string | null;
  note: string | null;
  /** The order this delivery produced, when there is one. */
  order: {
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totalPaise: number;
  } | null;
}

export interface SubscriptionRecord {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  frequencyDays: number;
  nextDeliveryOn: string;
  pausedUntil: string | null;
  paymentMethod: SubscriptionPaymentMethod;
  addressSnapshot: Record<string, unknown>;
  slotId: string | null;
  slotSnapshot: Record<string, unknown> | null;
  discountBps: number;
  cancelledAt: string | null;
  createdAt: string;
  items: SubscriptionItemRecord[];
  deliveries: SubscriptionDeliveryRecord[];
}

interface SubscriptionRow {
  id: string;
  customer_id: string;
  status: string;
  frequency_days: number;
  next_delivery_on: string;
  paused_until: string | null;
  payment_method: string;
  address_snapshot: Record<string, unknown>;
  slot_id: string | null;
  slot_snapshot: Record<string, unknown> | null;
  discount_bps: number;
  cancelled_at: string | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  subscription_id: string;
  product_id: string | null;
  variant_id: string | null;
  variant_sku: string | null;
  title: string;
  qty: number;
  snapshot: Record<string, unknown> | null;
}

interface DeliveryRow {
  id: string;
  subscription_id: string;
  scheduled_on: string;
  status: string;
  order_id: string | null;
  note: string | null;
  orders?: {
    order_number: string;
    status: string;
    payment_status: string;
    total_paise: number;
  } | null;
}

const SUB_COLS =
  "id, customer_id, status, frequency_days, next_delivery_on, paused_until, payment_method, address_snapshot, slot_id, slot_snapshot, discount_bps, cancelled_at, created_at";
const ITEM_COLS = "id, subscription_id, product_id, variant_id, variant_sku, title, qty, snapshot";
const DELIVERY_COLS =
  "id, subscription_id, scheduled_on, status, order_id, note, orders(order_number, status, payment_status, total_paise)";

const SUB_STATUSES: readonly SubscriptionStatus[] = ["active", "paused", "cancelled"];
const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  "due",
  "processing",
  "ordered",
  "skipped",
  "missed",
  "failed",
];

function toItem(r: ItemRow): SubscriptionItemRecord {
  return {
    id: r.id,
    productId: r.product_id,
    variantId: r.variant_id,
    variantSku: r.variant_sku,
    title: r.title,
    qty: r.qty,
    snapshot: r.snapshot,
  };
}

function toDelivery(r: DeliveryRow): SubscriptionDeliveryRecord {
  const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
  return {
    id: r.id,
    subscriptionId: r.subscription_id,
    scheduledOn: r.scheduled_on,
    status: DELIVERY_STATUSES.includes(r.status as DeliveryStatus) ? (r.status as DeliveryStatus) : "due",
    orderId: r.order_id,
    note: r.note,
    order: o
      ? {
          orderNumber: o.order_number,
          status: o.status,
          paymentStatus: o.payment_status,
          totalPaise: o.total_paise,
        }
      : null,
  };
}

function toSubscription(
  r: SubscriptionRow,
  items: SubscriptionItemRecord[],
  deliveries: SubscriptionDeliveryRecord[],
): SubscriptionRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    status: SUB_STATUSES.includes(r.status as SubscriptionStatus) ? (r.status as SubscriptionStatus) : "active",
    frequencyDays: r.frequency_days,
    nextDeliveryOn: r.next_delivery_on,
    pausedUntil: r.paused_until,
    paymentMethod: r.payment_method === "cod" ? "cod" : "upi",
    addressSnapshot: r.address_snapshot,
    slotId: r.slot_id,
    slotSnapshot: r.slot_snapshot,
    discountBps: r.discount_bps,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
    items,
    deliveries,
  };
}

/* ── reads ────────────────────────────────────────────────────────────── */

async function loadChildren(ids: string[]): Promise<{
  items: Map<string, SubscriptionItemRecord[]>;
  deliveries: Map<string, SubscriptionDeliveryRecord[]>;
}> {
  const items = new Map<string, SubscriptionItemRecord[]>();
  const deliveries = new Map<string, SubscriptionDeliveryRecord[]>();
  if (ids.length === 0) return { items, deliveries };
  const db = supabaseAdmin();
  const [{ data: itemData }, { data: deliveryData }] = await Promise.all([
    db.from("subscription_items").select(ITEM_COLS).in("subscription_id", ids).order("created_at"),
    db
      .from("subscription_deliveries")
      .select(DELIVERY_COLS)
      .in("subscription_id", ids)
      .order("scheduled_on", { ascending: false })
      .limit(ids.length * 12),
  ]);
  for (const row of (itemData as ItemRow[] | null) ?? []) {
    const list = items.get(row.subscription_id) ?? [];
    list.push(toItem(row));
    items.set(row.subscription_id, list);
  }
  for (const row of (deliveryData as unknown as DeliveryRow[] | null) ?? []) {
    const list = deliveries.get(row.subscription_id) ?? [];
    if (list.length < 8) list.push(toDelivery(row));
    deliveries.set(row.subscription_id, list);
  }
  return { items, deliveries };
}

/** A customer's subscriptions, live ones first, each with items and recent deliveries. */
export async function listSubscriptionsForCustomer(customerId: string): Promise<SubscriptionRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("subscriptions")
    .select(SUB_COLS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list subscriptions: ${error.message}`);
  const rows = (data as SubscriptionRow[] | null) ?? [];
  const { items, deliveries } = await loadChildren(rows.map((r) => r.id));
  const rank = (s: string) => (s === "active" ? 0 : s === "paused" ? 1 : 2);
  return rows
    .map((r) => toSubscription(r, items.get(r.id) ?? [], deliveries.get(r.id) ?? []))
    .sort((a, b) => rank(a.status) - rank(b.status));
}

async function getSubscriptionRow(id: string): Promise<SubscriptionRow | null> {
  if (!UUID.test(id)) return null;
  const { data } = await supabaseAdmin().from("subscriptions").select(SUB_COLS).eq("id", id).maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

/** One subscription, only if it belongs to this customer. */
export async function getSubscriptionForCustomer(
  customerId: string,
  id: string,
): Promise<SubscriptionRecord | null> {
  const row = await getSubscriptionRow(id);
  if (!row || row.customer_id !== customerId) return null;
  const { items, deliveries } = await loadChildren([row.id]);
  return toSubscription(row, items.get(row.id) ?? [], deliveries.get(row.id) ?? []);
}

async function requireOwned(customerId: string, id: string): Promise<SubscriptionRow> {
  const row = await getSubscriptionRow(id);
  if (!row || row.customer_id !== customerId) throw new SubscriptionError("not-found");
  return row;
}

/* ── validation shared by create + update ─────────────────────────────── */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SubscriptionItemInput {
  variantId: string;
  qty: number;
}

interface ResolvedItem {
  productId: string | null;
  variantId: string;
  variantSku: string | null;
  title: string;
  qty: number;
  unitPricePaise: number;
  snapshot: Record<string, unknown>;
}

/** Look every line up in the live catalogue. Unknown or inactive variants are refused. */
async function resolveItems(input: SubscriptionItemInput[]): Promise<ResolvedItem[]> {
  const merged = new Map<string, number>();
  for (const line of input) {
    if (!line || typeof line.variantId !== "string" || !UUID.test(line.variantId)) {
      throw new SubscriptionError("item-unavailable");
    }
    const qty = Math.round(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;
    merged.set(line.variantId, Math.min(MAX_ITEM_QTY, (merged.get(line.variantId) ?? 0) + qty));
  }
  if (merged.size === 0) throw new SubscriptionError("no-items");
  if (merged.size > MAX_SUBSCRIPTION_ITEMS) throw new SubscriptionError("too-many-items");

  const db = supabaseAdmin();
  const ids = [...merged.keys()];
  const { data, error } = await db
    .from("product_variants")
    .select("id, product_id, label, pack, sku, price_paise, is_active, image_url")
    .in("id", ids);
  if (error) throw new Error(`Failed to load variants: ${error.message}`);
  const variants = (data as {
    id: string;
    product_id: string;
    label: string;
    pack: string | null;
    sku: string | null;
    price_paise: number;
    is_active: boolean;
    image_url: string | null;
  }[] | null) ?? [];

  const productIds = [...new Set(variants.map((v) => v.product_id))];
  const { data: productData } = productIds.length
    ? await db.from("products").select("id, name, slug, image_url").in("id", productIds)
    : { data: [] };
  const products = new Map(
    ((productData as { id: string; name: string; slug: string; image_url: string | null }[] | null) ?? []).map(
      (p) => [p.id, p],
    ),
  );

  const unavailable: string[] = [];
  const resolved: ResolvedItem[] = [];
  for (const id of ids) {
    const v = variants.find((row) => row.id === id);
    const p = v ? products.get(v.product_id) : undefined;
    if (!v || !v.is_active || !p || v.price_paise <= 0) {
      unavailable.push(id);
      continue;
    }
    const label = v.pack ? `${v.label} · ${v.pack}` : v.label;
    resolved.push({
      productId: v.product_id,
      variantId: v.id,
      variantSku: v.sku,
      title: `${p.name} · ${label}`,
      qty: merged.get(id) ?? 1,
      unitPricePaise: v.price_paise,
      snapshot: {
        productTitle: p.name,
        variantLabel: label,
        slug: p.slug,
        image: v.image_url ?? p.image_url ?? null,
      },
    });
  }
  if (unavailable.length > 0) throw new SubscriptionError("item-unavailable", { variantIds: unavailable });
  return resolved;
}

function pincodeOf(address: Record<string, unknown> | null | undefined): string {
  const raw = address?.pincode;
  return typeof raw === "string" ? raw.trim() : "";
}

/** The address must name a person, a line and a 6-digit pincode we deliver to. */
async function checkAddress(address: unknown): Promise<Record<string, unknown>> {
  if (typeof address !== "object" || address === null) throw new SubscriptionError("bad-address");
  const a = address as Record<string, unknown>;
  const text = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  const pincode = pincodeOf(a);
  if (!text("fullName") || !text("line1") || !/^\d{6}$/.test(pincode)) {
    throw new SubscriptionError("bad-address");
  }
  if (!(await isServiceable(pincode))) throw new SubscriptionError("not-serviceable", { pincode });
  // Keep only the fields an order address uses; nothing else rides along.
  const keep = ["id", "fullName", "phone", "line1", "line2", "landmark", "city", "state", "pincode", "type", "label"];
  return Object.fromEntries(keep.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));
}

async function checkSlot(slotId: unknown): Promise<DeliverySlotRecord> {
  const slot = typeof slotId === "string" ? await findBookableSlot(slotId) : null;
  if (!slot) throw new SubscriptionError("slot-unavailable");
  return slot;
}

async function checkPaymentMethod(method: unknown): Promise<SubscriptionPaymentMethod> {
  if (method === "upi") {
    if (!isOnlinePaymentAvailable()) throw new SubscriptionError("payment-unavailable", { method });
    return "upi";
  }
  if (method === "cod") {
    if (!(await isFeatureEnabled("cod"))) throw new SubscriptionError("payment-unavailable", { method });
    return "cod";
  }
  throw new SubscriptionError("payment-unavailable", { method });
}

/** Refuse a basket that would fall under the shop's minimum order at subscriber prices. */
async function checkMinimum(items: ResolvedItem[], discountBps: number): Promise<void> {
  const rules = await getCommerceRules();
  const subtotal = items.reduce(
    (sum, i) => sum + applySubscriberDiscountPaise(i.unitPricePaise, discountBps) * i.qty,
    0,
  );
  if (subtotal < rules.minOrderPaise) {
    throw new SubscriptionError("below-minimum", { minOrderPaise: rules.minOrderPaise });
  }
}

function slotSnapshotOf(slot: DeliverySlotRecord): Record<string, unknown> {
  return { id: slot.id, label: slot.label, windowText: slot.windowText };
}

/* ── create ───────────────────────────────────────────────────────────── */

export interface CreateSubscriptionInput {
  items: SubscriptionItemInput[];
  frequencyDays: unknown;
  startOn: unknown;
  addressSnapshot: unknown;
  slotId: unknown;
  paymentMethod: unknown;
}

export interface CreateSubscriptionResult {
  subscription: SubscriptionRecord;
  /** The first delivery when it is already due (start date within the lead). */
  firstDelivery: SubscriptionDeliveryRecord | null;
}

export async function createSubscription(
  customerId: string,
  input: CreateSubscriptionInput,
  today: string = indiaToday(),
): Promise<CreateSubscriptionResult> {
  if (!isFrequency(input.frequencyDays)) throw new SubscriptionError("bad-frequency");
  const { earliest, latest } = startWindow(today);
  if (!isIsoDate(input.startOn) || input.startOn < earliest || input.startOn > latest) {
    throw new SubscriptionError("bad-start-date", { earliest, latest });
  }
  const items = await resolveItems(Array.isArray(input.items) ? input.items : []);
  const address = await checkAddress(input.addressSnapshot);
  const slot = await checkSlot(input.slotId);
  const paymentMethod = await checkPaymentMethod(input.paymentMethod);
  await checkMinimum(items, SUBSCRIBER_DISCOUNT_BPS);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("subscriptions")
    .insert({
      customer_id: customerId,
      status: "active",
      frequency_days: input.frequencyDays,
      next_delivery_on: input.startOn,
      payment_method: paymentMethod,
      address_snapshot: address,
      slot_id: slot.id,
      slot_snapshot: slotSnapshotOf(slot),
      discount_bps: SUBSCRIBER_DISCOUNT_BPS,
    })
    .select(SUB_COLS)
    .single();
  if (error || !data) throw new Error(`Failed to create subscription: ${error?.message ?? "unknown"}`);
  const row = data as SubscriptionRow;

  const { error: itemErr } = await db.from("subscription_items").insert(
    items.map((i) => ({
      subscription_id: row.id,
      product_id: i.productId,
      variant_id: i.variantId,
      variant_sku: i.variantSku,
      title: i.title,
      qty: i.qty,
      snapshot: i.snapshot,
    })),
  );
  if (itemErr) {
    // A subscription with nothing on it is worse than none at all.
    await db.from("subscriptions").delete().eq("id", row.id);
    throw new Error(`Failed to save subscription items: ${itemErr.message}`);
  }

  // A start date inside the lead window is due now: write the first delivery
  // immediately so a pay-online customer can pay straight away, and a cash on
  // delivery order goes into today's dispatch.
  // No "ready to pay" email here: the customer is on the page and is sent
  // straight to payment.
  const firstDelivery = await scheduleNextDelivery(row, today, { notify: false });
  const subscription = await getSubscriptionForCustomer(customerId, row.id);
  if (!subscription) throw new Error("Subscription vanished after create");
  return {
    subscription,
    firstDelivery: firstDelivery
      ? subscription.deliveries.find((d) => d.id === firstDelivery.id) ?? null
      : null,
  };
}

/* ── customer actions ─────────────────────────────────────────────────── */

/** Unpaid `due` deliveries are dropped when the customer pauses or cancels. */
async function skipOpenDeliveries(subscriptionId: string, note: string): Promise<void> {
  await supabaseAdmin()
    .from("subscription_deliveries")
    .update({ status: "skipped", note })
    .eq("subscription_id", subscriptionId)
    .eq("status", "due");
}

export async function pauseSubscription(
  customerId: string,
  id: string,
  until: unknown,
  today: string = indiaToday(),
): Promise<SubscriptionRecord> {
  const row = await requireOwned(customerId, id);
  if (row.status !== "active") throw new SubscriptionError("bad-state");
  let pausedUntil: string | null = null;
  if (until !== null && until !== undefined && until !== "") {
    if (!isIsoDate(until) || until <= today || until > addDays(today, 180)) {
      throw new SubscriptionError("bad-start-date");
    }
    pausedUntil = until;
  }
  await supabaseAdmin()
    .from("subscriptions")
    .update({ status: "paused", paused_until: pausedUntil })
    .eq("id", row.id)
    .eq("status", "active");
  await skipOpenDeliveries(row.id, "paused");
  return (await getSubscriptionForCustomer(customerId, row.id)) as SubscriptionRecord;
}

/** Back to active. The next date moves forward past anything already gone. */
async function reactivate(row: SubscriptionRow, today: string): Promise<void> {
  const next = rollForward(row.next_delivery_on, row.frequency_days, addDays(today, DUE_LEAD_DAYS));
  await supabaseAdmin()
    .from("subscriptions")
    .update({ status: "active", paused_until: null, next_delivery_on: next })
    .eq("id", row.id)
    .eq("status", "paused");
}

export async function resumeSubscription(
  customerId: string,
  id: string,
  today: string = indiaToday(),
): Promise<SubscriptionRecord> {
  const row = await requireOwned(customerId, id);
  if (row.status !== "paused") throw new SubscriptionError("bad-state");
  await reactivate(row, today);
  const fresh = await getSubscriptionRow(row.id);
  if (fresh) await scheduleNextDelivery(fresh, today);
  return (await getSubscriptionForCustomer(customerId, row.id)) as SubscriptionRecord;
}

/**
 * Skip the next delivery. An unpaid due delivery is skipped in place; otherwise
 * the upcoming date is recorded as skipped and the schedule moves on a cycle.
 * A delivery that already has an order is not skippable here: that order is
 * real (paid, or on its way for cash on delivery).
 */
export async function skipNextDelivery(customerId: string, id: string): Promise<SubscriptionRecord> {
  const row = await requireOwned(customerId, id);
  if (row.status !== "active") throw new SubscriptionError("bad-state");
  const db = supabaseAdmin();

  const { data: due } = await db
    .from("subscription_deliveries")
    .update({ status: "skipped", note: "skipped by customer" })
    .eq("subscription_id", row.id)
    .eq("status", "due")
    .select("id");
  if ((due as { id: string }[] | null)?.length) {
    return (await getSubscriptionForCustomer(customerId, row.id)) as SubscriptionRecord;
  }

  const { data: moved } = await db
    .from("subscriptions")
    .update({ next_delivery_on: addDays(row.next_delivery_on, row.frequency_days) })
    .eq("id", row.id)
    .eq("next_delivery_on", row.next_delivery_on)
    .select("id");
  if (!(moved as { id: string }[] | null)?.length) throw new SubscriptionError("busy");
  await db
    .from("subscription_deliveries")
    .upsert(
      { subscription_id: row.id, scheduled_on: row.next_delivery_on, status: "skipped", note: "skipped by customer" },
      { onConflict: "subscription_id,scheduled_on", ignoreDuplicates: true },
    );
  return (await getSubscriptionForCustomer(customerId, row.id)) as SubscriptionRecord;
}

export async function cancelSubscription(
  customerId: string,
  id: string,
  reason: unknown,
): Promise<SubscriptionRecord> {
  const row = await requireOwned(customerId, id);
  if (row.status === "cancelled") throw new SubscriptionError("bad-state");
  const note = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
  await supabaseAdmin()
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: note || null })
    .eq("id", row.id);
  await skipOpenDeliveries(row.id, "cancelled");
  return (await getSubscriptionForCustomer(customerId, row.id)) as SubscriptionRecord;
}

export interface UpdateSubscriptionInput {
  frequencyDays?: unknown;
  paymentMethod?: unknown;
  slotId?: unknown;
  addressSnapshot?: unknown;
  /** Full replacement of the item quantities. A qty of 0 removes a line. */
  items?: SubscriptionItemInput[];
}

/** Change cadence, address, slot, payment method or quantities. Takes effect from the next due delivery. */
export async function updateSubscription(
  customerId: string,
  id: string,
  input: UpdateSubscriptionInput,
): Promise<SubscriptionRecord> {
  const row = await requireOwned(customerId, id);
  if (row.status === "cancelled") throw new SubscriptionError("bad-state");
  const patch: Record<string, unknown> = {};

  if (input.frequencyDays !== undefined) {
    if (!isFrequency(input.frequencyDays)) throw new SubscriptionError("bad-frequency");
    patch.frequency_days = input.frequencyDays;
  }
  if (input.paymentMethod !== undefined) patch.payment_method = await checkPaymentMethod(input.paymentMethod);
  if (input.slotId !== undefined) {
    const slot = await checkSlot(input.slotId);
    patch.slot_id = slot.id;
    patch.slot_snapshot = slotSnapshotOf(slot);
  }
  if (input.addressSnapshot !== undefined) patch.address_snapshot = await checkAddress(input.addressSnapshot);

  const db = supabaseAdmin();
  if (input.items !== undefined) {
    const items = await resolveItems(input.items);
    await checkMinimum(items, row.discount_bps);
    const { error: delErr } = await db.from("subscription_items").delete().eq("subscription_id", row.id);
    if (delErr) throw new Error(`Failed to update items: ${delErr.message}`);
    const { error: insErr } = await db.from("subscription_items").insert(
      items.map((i) => ({
        subscription_id: row.id,
        product_id: i.productId,
        variant_id: i.variantId,
        variant_sku: i.variantSku,
        title: i.title,
        qty: i.qty,
        snapshot: i.snapshot,
      })),
    );
    if (insErr) throw new Error(`Failed to update items: ${insErr.message}`);
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("subscriptions").update(patch).eq("id", row.id);
    if (error) throw new Error(`Failed to update subscription: ${error.message}`);
  }
  return (await getSubscriptionForCustomer(customerId, row.id)) as SubscriptionRecord;
}

/* ── turning a delivery into an order ─────────────────────────────────── */

/** A claim older than this was abandoned by a crashed request and may be retaken. */
const STUCK_PROCESSING_MS = 10 * 60_000;

interface DeliveryWithSub {
  delivery: {
    id: string;
    subscription_id: string;
    scheduled_on: string;
    status: string;
    order_id: string | null;
    updated_at: string;
  };
  sub: SubscriptionRow;
  items: ItemRow[];
}

async function loadDelivery(deliveryId: string): Promise<DeliveryWithSub | null> {
  if (!UUID.test(deliveryId)) return null;
  const db = supabaseAdmin();
  const { data: d } = await db
    .from("subscription_deliveries")
    .select("id, subscription_id, scheduled_on, status, order_id, updated_at")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!d) return null;
  const delivery = d as DeliveryWithSub["delivery"];
  const sub = await getSubscriptionRow(delivery.subscription_id);
  if (!sub) return null;
  const { data: itemData } = await db.from("subscription_items").select(ITEM_COLS).eq("subscription_id", sub.id);
  return { delivery, sub, items: (itemData as ItemRow[] | null) ?? [] };
}

/** The subscription's slot, or the first open one when the shop switched it off. */
async function deliverySlot(sub: SubscriptionRow): Promise<DeliverySlotRecord | null> {
  if (sub.slot_id) {
    const slot = await findBookableSlot(sub.slot_id);
    if (slot) return slot;
  }
  const slots = (await listDeliverySlots()).filter((s) => s.active);
  return slots[0] ?? null;
}

/**
 * Atomically claim a delivery for ordering (`due` → `processing`), so a double
 * click or the cron racing the customer cannot create two orders for one date.
 * A delivery whose earlier order failed or was cancelled is reopened first.
 */
async function claimDelivery(ctx: DeliveryWithSub): Promise<boolean> {
  const db = supabaseAdmin();
  if (ctx.delivery.status === "ordered" && ctx.delivery.order_id) {
    const { data: o } = await db
      .from("orders")
      .select("status, payment_status")
      .eq("id", ctx.delivery.order_id)
      .maybeSingle();
    const order = o as { status: string; payment_status: string } | null;
    const dead = !order || order.status === "cancelled" || order.payment_status === "failed";
    if (!dead) return false;
    await db
      .from("subscription_deliveries")
      .update({ status: "due", order_id: null })
      .eq("id", ctx.delivery.id)
      .eq("status", "ordered");
  }
  if (
    ctx.delivery.status === "processing" &&
    Date.now() - Date.parse(ctx.delivery.updated_at) > STUCK_PROCESSING_MS
  ) {
    // Only the exact stale claim is released; a fresh claim has a newer updated_at.
    await db
      .from("subscription_deliveries")
      .update({ status: "due" })
      .eq("id", ctx.delivery.id)
      .eq("status", "processing")
      .eq("updated_at", ctx.delivery.updated_at);
  }
  const { data } = await db
    .from("subscription_deliveries")
    .update({ status: "processing" })
    .eq("id", ctx.delivery.id)
    .eq("status", "due")
    .select("id");
  return Boolean((data as { id: string }[] | null)?.length);
}

async function setDeliveryState(
  deliveryId: string,
  status: DeliveryStatus,
  extra: { order_id?: string | null; note?: string | null } = {},
): Promise<void> {
  await supabaseAdmin()
    .from("subscription_deliveries")
    .update({ status, ...extra })
    .eq("id", deliveryId);
}

async function createDeliveryOrder(ctx: DeliveryWithSub): Promise<OrderWithDetail> {
  const { sub, delivery } = ctx;
  const slot = await deliverySlot(sub);
  if (!slot) throw new SubscriptionError("slot-unavailable");
  const customer = await getCustomerById(sub.customer_id);
  const items: OrderLineInput[] = ctx.items.map((i) => ({
    productId: i.product_id,
    variantId: i.variant_id,
    variantSku: i.variant_sku,
    title: i.title,
    qty: i.qty,
    snapshot: { ...(i.snapshot ?? {}), subscriptionId: sub.id },
  }));
  return createOrder({
    customerId: sub.customer_id,
    userEmail: customer?.primaryEmail ?? null,
    userPhone: customer?.primaryPhone ?? null,
    items,
    paymentMethod: sub.payment_method === "cod" ? "cod" : "upi",
    addressSnapshot: sub.address_snapshot,
    slotSnapshot: {
      id: slot.id,
      label: slot.label,
      windowText: slot.windowText,
      deliveryDate: delivery.scheduled_on,
      subscription: true,
    },
    subscriptionId: sub.id,
    subscriberDiscountBps: sub.discount_bps,
  });
}

export interface PayForDeliveryResult {
  orderNumber: string;
  payment: GatewayHandoff | null;
}

/**
 * The customer pressed Pay on a due delivery: create its order (server prices,
 * stock held, subscriber discount) and open SBIePay. Mirrors POST /api/orders.
 * A cash on delivery subscription gets its order without a gateway.
 */
export async function payForDelivery(customerId: string, deliveryId: string): Promise<PayForDeliveryResult> {
  const ctx = await loadDelivery(deliveryId);
  if (!ctx || ctx.sub.customer_id !== customerId) throw new SubscriptionError("not-found");
  if (ctx.sub.status !== "active") throw new SubscriptionError("bad-state");
  if (ctx.delivery.scheduled_on < indiaToday()) throw new SubscriptionError("bad-state");
  if (ctx.sub.payment_method === "upi" && !isOnlinePaymentAvailable()) {
    throw new SubscriptionError("payment-unavailable", { method: "upi" });
  }
  if (!(await claimDelivery(ctx))) throw new SubscriptionError("busy");

  let order: OrderWithDetail;
  try {
    order = await createDeliveryOrder(ctx);
  } catch (err) {
    await setDeliveryState(ctx.delivery.id, "due");
    throw err;
  }
  await setDeliveryState(ctx.delivery.id, "ordered", { order_id: order.id, note: null });

  if (order.paymentMethod !== "upi") {
    await sendOrderPlacedEmail(order.id).catch(() => undefined);
    return { orderNumber: order.orderNumber, payment: null };
  }

  let payment: GatewayHandoff | null = null;
  try {
    payment = await beginPayment({
      id: order.id,
      orderNumber: order.orderNumber,
      totalPaise: order.totalPaise,
      currency: order.currency,
      customerEmail: order.userEmail,
      customerPhone: order.userPhone,
    });
    if (!payment) throw new Error("payment-handoff-unavailable");
  } catch (err) {
    // Same rule as checkout: an order that can never be paid gives back its stock.
    await failUnpaidOnlineOrder(order.id);
    await setDeliveryState(ctx.delivery.id, "due", { order_id: null });
    throw err;
  }
  if (payment.reference) await recordGatewayHandoff(order.id, payment.reference);
  return { orderNumber: order.orderNumber, payment };
}

/* ── scheduling (cron) ────────────────────────────────────────────────── */

/**
 * If this subscription's next date is inside the lead window, write that
 * delivery and move the schedule on one cycle. The move is a compare-and-set on
 * the old date, so two runs at once produce one delivery, not two.
 */
async function scheduleNextDelivery(
  row: SubscriptionRow,
  today: string,
  opts: { notify?: boolean } = {},
): Promise<{ id: string; status: DeliveryStatus } | null> {
  if (row.status !== "active") return null;
  const db = supabaseAdmin();
  const date = rollForward(row.next_delivery_on, row.frequency_days, today);
  if (date > addDays(today, DUE_LEAD_DAYS)) {
    if (date !== row.next_delivery_on) {
      await db.from("subscriptions").update({ next_delivery_on: date }).eq("id", row.id).eq("next_delivery_on", row.next_delivery_on);
    }
    return null;
  }

  const { data: moved } = await db
    .from("subscriptions")
    .update({ next_delivery_on: addDays(date, row.frequency_days) })
    .eq("id", row.id)
    .eq("next_delivery_on", row.next_delivery_on)
    .eq("status", "active")
    .select("id");
  if (!(moved as { id: string }[] | null)?.length) return null;

  const { data: inserted } = await db
    .from("subscription_deliveries")
    .upsert(
      { subscription_id: row.id, scheduled_on: date, status: "due" },
      { onConflict: "subscription_id,scheduled_on", ignoreDuplicates: true },
    )
    .select("id, status");
  const delivery = (inserted as { id: string; status: DeliveryStatus }[] | null)?.[0];
  if (!delivery) return null;

  if (row.payment_method === "cod") {
    await placeCodDelivery(delivery.id);
  } else if (opts.notify !== false) {
    await remindToPay(row, delivery.id, date);
  }
  return delivery;
}

/** Cash on delivery: the order is created by us. Failures are recorded, not thrown. */
async function placeCodDelivery(deliveryId: string): Promise<"ordered" | "failed" | "skipped"> {
  const ctx = await loadDelivery(deliveryId);
  if (!ctx) return "skipped";
  if (!(await claimDelivery(ctx))) return "skipped";
  try {
    const order = await createDeliveryOrder(ctx);
    await setDeliveryState(deliveryId, "ordered", { order_id: order.id, note: null });
    await sendOrderPlacedEmail(order.id).catch(() => undefined);
    return "ordered";
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await setDeliveryState(deliveryId, "failed", { note: reason.slice(0, 300) });
    console.error(`subscription-cod-order-failed delivery=${deliveryId}: ${reason}`);
    return "failed";
  }
}

async function remindToPay(row: SubscriptionRow, deliveryId: string, date: string): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    const customer = await getCustomerById(row.customer_id);
    const to = customer?.primaryEmail;
    if (!to) return;
    const when = formatDeliveryDate(date);
    const link = `${SITE}/account/subscriptions`;
    const name = customer?.displayName?.split(" ")[0] ?? "there";
    await sendEmail({
      to,
      subject: `Your Nutri Greenz delivery for ${when} is ready to pay`,
      text: `Hi ${name}, your ${frequencyLabel(row.frequency_days).toLowerCase()} delivery is scheduled for ${when}. Pay before then to confirm it: ${link}`,
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Your ${escapeHtml(frequencyLabel(row.frequency_days).toLowerCase())} Nutri Greenz delivery is scheduled for <strong>${escapeHtml(when)}</strong>.</p>
<p>Pay before then to confirm it. You can also skip this one or pause your subscription.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#1f4d2e;color:#fff;text-decoration:none;font-weight:600">Pay for this delivery</a></p>
<p style="color:#666;font-size:13px">If it isn't paid by ${escapeHtml(when)}, we simply skip it. Nothing is charged automatically.</p>`,
    });
    await supabaseAdmin()
      .from("subscription_deliveries")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", deliveryId);
  } catch (err) {
    console.error(`subscription-reminder-failed delivery=${deliveryId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export interface CycleSummary {
  today: string;
  resumed: number;
  missed: number;
  scheduled: number;
  errors: number;
}

/**
 * The daily run. Safe to call repeatedly: every step is a conditional update or
 * an insert that ignores duplicates.
 *   1. Paused subscriptions whose pause has ended become active.
 *   2. Due deliveries whose date has passed unpaid become missed.
 *   3. Active subscriptions with a date inside the lead window get their delivery.
 */
export async function runSubscriptionCycle(today: string = indiaToday()): Promise<CycleSummary> {
  const db = supabaseAdmin();
  const summary: CycleSummary = { today, resumed: 0, missed: 0, scheduled: 0, errors: 0 };

  const { data: ending } = await db
    .from("subscriptions")
    .select(SUB_COLS)
    .eq("status", "paused")
    .not("paused_until", "is", null)
    .lte("paused_until", today);
  for (const row of (ending as SubscriptionRow[] | null) ?? []) {
    await reactivate(row, today);
    summary.resumed += 1;
  }

  const { data: missed } = await db
    .from("subscription_deliveries")
    .update({ status: "missed", note: "not paid before the delivery date" })
    .eq("status", "due")
    .lt("scheduled_on", today)
    .select("id");
  summary.missed += ((missed as { id: string }[] | null) ?? []).length;

  // An online order that failed or was abandoned leaves its delivery 'ordered'
  // so the customer can retry; once the date has gone, it is missed too.
  const { data: stale } = await db
    .from("subscription_deliveries")
    .select("id, orders(payment_status, status)")
    .eq("status", "ordered")
    .lt("scheduled_on", today)
    .gte("scheduled_on", addDays(today, -14));
  for (const d of (stale as unknown as { id: string; orders: { payment_status: string; status: string } | null }[] | null) ?? []) {
    const o = Array.isArray(d.orders) ? d.orders[0] : d.orders;
    if (o && (o.payment_status === "failed" || o.status === "cancelled")) {
      await setDeliveryState(d.id, "missed", { note: "payment not completed" });
      summary.missed += 1;
    }
  }

  const { data: due } = await db
    .from("subscriptions")
    .select(SUB_COLS)
    .eq("status", "active")
    .lte("next_delivery_on", addDays(today, DUE_LEAD_DAYS))
    .limit(500);
  for (const row of (due as SubscriptionRow[] | null) ?? []) {
    try {
      if (await scheduleNextDelivery(row, today)) summary.scheduled += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`subscription-schedule-failed sub=${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return summary;
}
