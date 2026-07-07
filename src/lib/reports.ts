/**
 * Admin reporting aggregation (Supabase `public.orders`, `public.order_items`,
 * `public.customers`, `public.coupons`). Powers `GET /api/admin/reports` with
 * real figures — revenue, order count, AOV, status breakdown, top products,
 * coupon usage and new-customer counts over an optional date range.
 *
 * Service-role only — import from Node route handlers, never client/Edge. Money
 * is integer paise (₹1 = 100 paise) throughout. Revenue counts every
 * non-cancelled order (the order lifecycle has no cancelled state today, so this
 * is every order); a separate `paidRevenuePaise` reports only settled orders.
 *
 * The date range filters on `placed_at` (and `created_at` for new customers). A
 * date-only bound (YYYY-MM-DD) is widened to cover the whole day so an inclusive
 * "from"/"to" behaves as an operator expects.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ORDER_STATUS_FLOW,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";

/* ── report shapes ────────────────────────────────────────────────────── */

export interface ReportRange {
  from: string | null;
  to: string | null;
}

export interface StatusBreakdownEntry {
  status: OrderStatus;
  orders: number;
  revenuePaise: number;
}

export interface PaymentBreakdownEntry {
  paymentStatus: PaymentStatus;
  orders: number;
  revenuePaise: number;
}

export interface TopProductEntry {
  /** Stable grouping key (product id, else SKU, else title). */
  key: string;
  title: string;
  productId: string | null;
  variantSku: string | null;
  qty: number;
  revenuePaise: number;
}

export interface CouponUsageEntry {
  code: string;
  orders: number;
  discountPaise: number;
}

export interface AdminReport {
  range: ReportRange;
  revenuePaise: number;
  orderCount: number;
  aovPaise: number;
  unitsSold: number;
  /** Revenue restricted to orders whose payment has settled (`paid`). */
  paidRevenuePaise: number;
  statusBreakdown: StatusBreakdownEntry[];
  paymentBreakdown: PaymentBreakdownEntry[];
  topProducts: TopProductEntry[];
  couponUsage: CouponUsageEntry[];
  newCustomers: number;
}

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "paid", "failed"];

interface OrderAggRow {
  id: string;
  status: string;
  payment_status: string;
  total_paise: number;
  discount_paise: number;
  coupon_code: string | null;
}

interface ItemAggRow {
  order_id: string;
  product_id: string | null;
  variant_sku: string | null;
  title: string;
  qty: number;
  line_total_paise: number;
}

/* ── date-range helpers ───────────────────────────────────────────────── */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Lower bound → start-of-day for a date-only value; pass ISO through as-is. */
function startBound(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  return DATE_ONLY.test(v) ? `${v}T00:00:00.000Z` : v;
}

/** Upper bound → end-of-day for a date-only value; pass ISO through as-is. */
function endBound(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  return DATE_ONLY.test(v) ? `${v}T23:59:59.999Z` : v;
}

/** Split an id array into fixed-size chunks (keeps `.in()` URLs bounded). */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* ── aggregation ──────────────────────────────────────────────────────── */

export interface BuildReportInput {
  from?: string | null;
  to?: string | null;
  /** Top-N products to return (1–50, default 10). */
  topLimit?: number;
}

/**
 * Build the full admin report over the given date range (both bounds optional →
 * all time). Every figure is computed from real rows; there is no mock fallback.
 */
export async function buildAdminReport(input: BuildReportInput = {}): Promise<AdminReport> {
  const db = supabaseAdmin();
  const from = startBound(input.from ?? null);
  const to = endBound(input.to ?? null);
  const topLimit = Math.min(50, Math.max(1, Math.round(input.topLimit ?? 10)));

  // 1. Orders in range (non-cancelled — the lifecycle has no cancelled state,
  //    so this keeps every order while honouring the "non-cancelled" contract).
  let orderQuery = db
    .from("orders")
    .select("id, status, payment_status, total_paise, discount_paise, coupon_code")
    .neq("status", "cancelled");
  if (from) orderQuery = orderQuery.gte("placed_at", from);
  if (to) orderQuery = orderQuery.lte("placed_at", to);
  const { data: orderData } = await orderQuery;
  const orders = (orderData as OrderAggRow[] | null) ?? [];

  let revenuePaise = 0;
  let paidRevenuePaise = 0;
  const statusMap = new Map<OrderStatus, { orders: number; revenuePaise: number }>();
  const paymentMap = new Map<PaymentStatus, { orders: number; revenuePaise: number }>();
  const couponMap = new Map<string, { orders: number; discountPaise: number }>();

  for (const o of orders) {
    revenuePaise += o.total_paise;
    if (o.payment_status === "paid") paidRevenuePaise += o.total_paise;

    const status = (ORDER_STATUS_FLOW.includes(o.status as OrderStatus)
      ? o.status
      : "placed") as OrderStatus;
    const s = statusMap.get(status) ?? { orders: 0, revenuePaise: 0 };
    s.orders += 1;
    s.revenuePaise += o.total_paise;
    statusMap.set(status, s);

    const pay = (PAYMENT_STATUSES.includes(o.payment_status as PaymentStatus)
      ? o.payment_status
      : "pending") as PaymentStatus;
    const p = paymentMap.get(pay) ?? { orders: 0, revenuePaise: 0 };
    p.orders += 1;
    p.revenuePaise += o.total_paise;
    paymentMap.set(pay, p);

    const code = o.coupon_code?.trim().toUpperCase();
    if (code) {
      const c = couponMap.get(code) ?? { orders: 0, discountPaise: 0 };
      c.orders += 1;
      c.discountPaise += o.discount_paise;
      couponMap.set(code, c);
    }
  }

  const orderCount = orders.length;
  const aovPaise = orderCount > 0 ? Math.round(revenuePaise / orderCount) : 0;

  // 2. Line items for those orders → top products by revenue (then qty). Fetch
  //    the id chunks in parallel so a large range never serialises round-trips.
  const orderIds = orders.map((o) => o.id);
  const productMap = new Map<string, TopProductEntry>();
  let unitsSold = 0;
  const itemChunks = await Promise.all(
    chunk(orderIds, 300).map((ids) =>
      db
        .from("order_items")
        .select("order_id, product_id, variant_sku, title, qty, line_total_paise")
        .in("order_id", ids),
    ),
  );
  for (const { data: itemData } of itemChunks) {
    for (const it of (itemData as ItemAggRow[] | null) ?? []) {
      unitsSold += it.qty;
      const key = it.product_id ?? it.variant_sku ?? it.title;
      const entry =
        productMap.get(key) ??
        {
          key,
          title: it.title,
          productId: it.product_id,
          variantSku: it.variant_sku,
          qty: 0,
          revenuePaise: 0,
        };
      entry.qty += it.qty;
      entry.revenuePaise += it.line_total_paise;
      productMap.set(key, entry);
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenuePaise - a.revenuePaise || b.qty - a.qty)
    .slice(0, topLimit);

  // 3. New customers created in the same range.
  let customerQuery = db
    .from("customers")
    .select("id", { count: "exact", head: true });
  if (from) customerQuery = customerQuery.gte("created_at", from);
  if (to) customerQuery = customerQuery.lte("created_at", to);
  const { count: newCustomers } = await customerQuery;

  // 4. Assemble the typed report (stable status ordering for the UI).
  const statusBreakdown: StatusBreakdownEntry[] = ORDER_STATUS_FLOW.map((status) => {
    const s = statusMap.get(status) ?? { orders: 0, revenuePaise: 0 };
    return { status, orders: s.orders, revenuePaise: s.revenuePaise };
  });

  const paymentBreakdown: PaymentBreakdownEntry[] = PAYMENT_STATUSES.map((paymentStatus) => {
    const p = paymentMap.get(paymentStatus) ?? { orders: 0, revenuePaise: 0 };
    return { paymentStatus, orders: p.orders, revenuePaise: p.revenuePaise };
  });

  const couponUsage: CouponUsageEntry[] = Array.from(couponMap.entries())
    .map(([code, c]) => ({ code, orders: c.orders, discountPaise: c.discountPaise }))
    .sort((a, b) => b.orders - a.orders || b.discountPaise - a.discountPaise);

  return {
    range: { from, to },
    revenuePaise,
    orderCount,
    aovPaise,
    unitsSold,
    paidRevenuePaise,
    statusBreakdown,
    paymentBreakdown,
    topProducts,
    couponUsage,
    newCustomers: newCustomers ?? 0,
  };
}
