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

/**
 * Visitor counts by place, for the report's audience map.
 *
 * Read from `visit_geo_daily`, which holds only day + country/region/city +
 * a tally. There is no per-visitor row to join against, by design — the
 * question this answers is "which places do people come from", not "where is
 * this customer".
 */
export interface VisitorPlaceEntry {
  country: string;
  region: string;
  city: string;
  visits: number;
}

/** One day of the revenue trend. `day` is the IST calendar date (YYYY-MM-DD). */
export interface DailyRevenueEntry {
  day: string;
  revenuePaise: number;
  orders: number;
}

/**
 * The same headline figures for the period immediately before the report's,
 * of equal length. Present only when the report has BOTH bounds: "all time"
 * has no before, and inventing one would put a delta on the page that means
 * nothing.
 */
export interface PreviousPeriod {
  range: ReportRange;
  revenuePaise: number;
  orderCount: number;
  aovPaise: number;
  unitsSold: number;
  paidRevenuePaise: number;
  newCustomers: number;
  /** Aligned with the report's `dailyRevenue` by index, day 1 against day 1. */
  dailyRevenue: DailyRevenueEntry[];
}

export interface AdminReport {
  range: ReportRange;
  revenuePaise: number;
  orderCount: number;
  aovPaise: number;
  unitsSold: number;
  /** Revenue restricted to orders whose payment has settled (`paid`). */
  paidRevenuePaise: number;
  /** Orders whose payment has SETTLED. */
  paidOrderCount: number;
  /**
   * Money still to be collected: orders with `payment_status = 'pending'`.
   *
   * Deliberately NOT `revenue - paid`. That subtraction sweeps FAILED payments
   * in as well, and a failed payment is not money owed — it is an attempt that
   * did not complete. Reporting the two together would overstate what is
   * actually collectable, which is the one number this figure exists to answer.
   */
  pendingRevenuePaise: number;
  pendingOrderCount: number;
  /** Attempts that failed outright. Shown separately so they never inflate
   *  the pending figure above. */
  failedRevenuePaise: number;
  failedOrderCount: number;
  statusBreakdown: StatusBreakdownEntry[];
  paymentBreakdown: PaymentBreakdownEntry[];
  topProducts: TopProductEntry[];
  couponUsage: CouponUsageEntry[];
  newCustomers: number;
  /** Top places by visits in the range; empty when nothing has been recorded. */
  visitorPlaces: VisitorPlaceEntry[];
  /** Every visit counted in the range, including places outside the top list. */
  visitorTotal: number;
  /** Revenue and orders per IST day across the range, zero-filled. */
  dailyRevenue: DailyRevenueEntry[];
  /** The preceding period of equal length, or null when the range is open. */
  previous: PreviousPeriod | null;
}

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "paid", "failed"];

interface OrderAggRow {
  id: string;
  status: string;
  payment_status: string;
  total_paise: number;
  discount_paise: number;
  coupon_code: string | null;
  placed_at: string;
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

/* ── daily series ─────────────────────────────────────────────────────────

   Bucketed by the IST calendar day, not UTC. The business, its customers and
   its operators are all in India: an order at 1am IST is "today" to everyone
   who will read the chart, and a UTC bucket would file it under yesterday. */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;

/** The IST calendar date of an instant, as YYYY-MM-DD. */
function istDay(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Every IST day from `fromDay` to `toDay` inclusive. */
function dayRange(fromDay: string, toDay: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${fromDay}T00:00:00Z`);
  const end = Date.parse(`${toDay}T00:00:00Z`);
  // Bounded so a malformed bound can never spin: ~2 years of days at most.
  while (t <= end && out.length < 800) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY_MS;
  }
  return out;
}

/** Zero-filled revenue and order counts per IST day over the given days. */
function dailySeries(
  orders: { total_paise: number; placed_at: string }[],
  days: string[],
): DailyRevenueEntry[] {
  const byDay = new Map<string, DailyRevenueEntry>(
    days.map((day) => [day, { day, revenuePaise: 0, orders: 0 }]),
  );
  for (const o of orders) {
    const ms = Date.parse(o.placed_at);
    if (!Number.isFinite(ms)) continue;
    const entry = byDay.get(istDay(ms));
    if (!entry) continue;
    entry.revenuePaise += o.total_paise;
    entry.orders += 1;
  }
  return days.map((d) => byDay.get(d)!);
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
    .select("id, status, payment_status, total_paise, discount_paise, coupon_code, placed_at")
    .neq("status", "cancelled");
  if (from) orderQuery = orderQuery.gte("placed_at", from);
  if (to) orderQuery = orderQuery.lte("placed_at", to);
  const { data: orderData } = await orderQuery;
  const orders = (orderData as OrderAggRow[] | null) ?? [];

  let revenuePaise = 0;
  let paidRevenuePaise = 0;
  let paidOrderCount = 0;
  let pendingRevenuePaise = 0;
  let pendingOrderCount = 0;
  let failedRevenuePaise = 0;
  let failedOrderCount = 0;
  const statusMap = new Map<OrderStatus, { orders: number; revenuePaise: number }>();
  const paymentMap = new Map<PaymentStatus, { orders: number; revenuePaise: number }>();
  const couponMap = new Map<string, { orders: number; discountPaise: number }>();

  for (const o of orders) {
    revenuePaise += o.total_paise;
    /* Split by settlement state rather than deriving one from the others, so
       "pending" means exactly what an operator will chase and nothing else.
       Cancelled orders are already excluded by the query above. */
    if (o.payment_status === "paid") {
      paidRevenuePaise += o.total_paise;
      paidOrderCount += 1;
    } else if (o.payment_status === "failed") {
      failedRevenuePaise += o.total_paise;
      failedOrderCount += 1;
    } else {
      pendingRevenuePaise += o.total_paise;
      pendingOrderCount += 1;
    }

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

  /*
   * 3b. Where visitors came from.
   *
   * Queried on `day`, not a timestamp, because the table stores nothing finer —
   * that coarseness is what keeps a row from ever describing one person. The
   * range's from/to are ISO instants, so only their date part applies here; a
   * half-day at either end counts whole.
   */
  let geoQuery = db
    .from("visit_geo_daily")
    .select("country, region, city, visits");
  if (from) geoQuery = geoQuery.gte("day", from.slice(0, 10));
  if (to) geoQuery = geoQuery.lte("day", to.slice(0, 10));
  const { data: geoRows } = await geoQuery;

  const placeMap = new Map<string, VisitorPlaceEntry>();
  let visitorTotal = 0;
  for (const r of (geoRows as VisitorPlaceEntry[] | null) ?? []) {
    const key = `${r.country}|${r.region}|${r.city}`;
    const prev = placeMap.get(key);
    const visits = Number(r.visits) || 0;
    visitorTotal += visits;
    if (prev) prev.visits += visits;
    else placeMap.set(key, { country: r.country, region: r.region, city: r.city, visits });
  }
  const visitorPlaces = Array.from(placeMap.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 25);

  // 3c. The trend. With an open lower bound ("all time") the series starts at
  //     the first order rather than at some arbitrary date before the shop
  //     existed, which would be a long flat line of nothing.
  const nowMs = Date.now();
  const firstOrderMs = orders.reduce(
    (min, o) => Math.min(min, Date.parse(o.placed_at) || min),
    Number.POSITIVE_INFINITY,
  );
  const seriesFromMs = from ? Date.parse(from) : Number.isFinite(firstOrderMs) ? firstOrderMs : nowMs;
  const seriesToMs = to ? Math.min(Date.parse(to), nowMs) : nowMs;
  const days = dayRange(istDay(seriesFromMs), istDay(Math.max(seriesFromMs, seriesToMs)));
  const dailyRevenue = dailySeries(orders, days);

  // 3d. The period before, when there is one to compare against.
  const previous =
    from && to ? await buildPreviousPeriod(db, Date.parse(from), Date.parse(to), days.length) : null;

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
    paidOrderCount,
    pendingRevenuePaise,
    pendingOrderCount,
    failedRevenuePaise,
    failedOrderCount,
    statusBreakdown,
    paymentBreakdown,
    topProducts,
    couponUsage,
    newCustomers: newCustomers ?? 0,
    visitorPlaces,
    visitorTotal,
    dailyRevenue,
    previous,
  };
}

/**
 * Headline figures for the equal-length period ending just before `fromMs`.
 *
 * A second, narrower pass rather than a wider first query: the main report's
 * breakdowns must describe only its own range, and filtering a combined result
 * set back apart in JS is where off-by-one-day bugs live.
 */
async function buildPreviousPeriod(
  db: ReturnType<typeof supabaseAdmin>,
  fromMs: number,
  toMs: number,
  dayCount: number,
): Promise<PreviousPeriod | null> {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return null;
  const spanMs = toMs - fromMs;
  const prevTo = new Date(fromMs - 1).toISOString();
  const prevFrom = new Date(fromMs - 1 - spanMs).toISOString();

  const [{ data: orderData }, { count: newCustomers }] = await Promise.all([
    db
      .from("orders")
      .select("id, payment_status, total_paise, placed_at")
      .neq("status", "cancelled")
      .gte("placed_at", prevFrom)
      .lte("placed_at", prevTo),
    db
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevFrom)
      .lte("created_at", prevTo),
  ]);
  const orders =
    (orderData as { id: string; payment_status: string; total_paise: number; placed_at: string }[] | null) ?? [];

  let revenuePaise = 0;
  let paidRevenuePaise = 0;
  for (const o of orders) {
    revenuePaise += o.total_paise;
    if (o.payment_status === "paid") paidRevenuePaise += o.total_paise;
  }

  let unitsSold = 0;
  const itemChunks = await Promise.all(
    chunk(orders.map((o) => o.id), 300).map((ids) =>
      db.from("order_items").select("qty").in("order_id", ids),
    ),
  );
  for (const { data } of itemChunks) {
    for (const it of (data as { qty: number }[] | null) ?? []) unitsSold += it.qty;
  }

  // Same number of days as the current series, so the two lines overlay day
  // for day. The last day ends at prevTo; count back from there.
  const lastDay = istDay(Date.parse(prevTo));
  const firstDay = istDay(Date.parse(`${lastDay}T00:00:00Z`) - (dayCount - 1) * DAY_MS);
  const dailyRevenue = dailySeries(orders, dayRange(firstDay, lastDay));

  return {
    range: { from: prevFrom, to: prevTo },
    revenuePaise,
    orderCount: orders.length,
    aovPaise: orders.length > 0 ? Math.round(revenuePaise / orders.length) : 0,
    unitsSold,
    paidRevenuePaise,
    newCustomers: newCustomers ?? 0,
    dailyRevenue,
  };
}
