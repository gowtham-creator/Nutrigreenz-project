/**
 * Product & Customer analytics aggregation (Supabase `public.orders`,
 * `public.order_items`, `public.products`, `public.categories`,
 * `public.wishlists`, `public.product_views`, `public.customer_identities`).
 *
 * Powers `GET /api/admin/analytics` with real figures that answer two operator
 * questions: "which products need a campaign/promotion?" (per-product units,
 * revenue, wishlist saves and PDP views) and "how are customers signing in?"
 * (provider breakdown + trend). Every figure is computed from live rows — there
 * is no mock fallback.
 *
 * Service-role only — import from Node route handlers, never client/Edge. Money
 * is integer paise (₹1 = 100 paise) throughout. Revenue counts every
 * non-cancelled order (the lifecycle has no cancelled state today, so this keeps
 * every order while honouring the "non-cancelled" contract), mirroring
 * `@/lib/reports`.
 *
 * Time is bucketed in IST (the store's operating timezone, UTC+5:30) so the
 * weekday-vs-weekend split and day/month/quarter buckets line up with an Indian
 * operator's calendar rather than UTC.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* ── shapes ───────────────────────────────────────────────────────────── */

/** Time-bucket granularity for the trend series. */
export type AnalyticsBucket = "day" | "month" | "quarter";

/** The date window an analytics payload was computed over (both bounds optional). */
export interface AnalyticsRange {
  from: string | null;
  to: string | null;
}

/** One product's demand signals over the selected range. */
export interface ProductAnalyticsRow {
  productId: string;
  name: string;
  slug: string;
  categoryId: string | null;
  categoryName: string | null;
  unitsSold: number;
  revenuePaise: number;
  wishlistCount: number;
  views: number;
}

/** One point on the units/revenue/views trend series. */
export interface TimeBucketPoint {
  key: string;
  label: string;
  unitsSold: number;
  revenuePaise: number;
  views: number;
}

/** Aggregated units/revenue/views for one side of the weekday/weekend split. */
export interface WeekendSplitPart {
  unitsSold: number;
  revenuePaise: number;
  views: number;
}

/** Weekday vs weekend performance (Sat/Sun in IST count as weekend). */
export interface WeekendSplit {
  weekday: WeekendSplitPart;
  weekend: WeekendSplitPart;
}

/** A sign-in provider and how many identities used it in range. */
export interface SignInProviderStat {
  provider: string;
  count: number;
}

/** One point on the sign-in trend series. */
export interface SignInSeriesPoint {
  key: string;
  label: string;
  google: number;
  phone: number;
  other: number;
}

/** How customers are signing in over the range (`customer_identities`). */
export interface SignInBreakdown {
  total: number;
  providers: SignInProviderStat[];
  series: SignInSeriesPoint[];
}

/** The full analytics payload returned to the admin surface. */
export interface ProductAnalytics {
  range: AnalyticsRange;
  bucket: AnalyticsBucket;
  generatedAt: string;
  totals: {
    unitsSold: number;
    revenuePaise: number;
    views: number;
    wishlistCount: number;
    productsTracked: number;
  };
  products: ProductAnalyticsRow[];
  series: TimeBucketPoint[];
  weekend: WeekendSplit;
  signins: SignInBreakdown;
}

export interface BuildAnalyticsInput {
  from?: string | null;
  to?: string | null;
  /** Trend granularity (default `day`). */
  bucket?: AnalyticsBucket;
  /** Scope everything product-level to a single product (per-product detail). */
  productId?: string | null;
}

/* ── row types (raw Supabase selects) ─────────────────────────────────── */

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
}
interface CategoryRow {
  id: string;
  name: string;
}
interface OrderRow {
  id: string;
  placed_at: string;
}
interface OrderItemRow {
  order_id: string;
  product_id: string | null;
  qty: number;
  line_total_paise: number;
}
interface WishlistRow {
  product_slug: string;
  created_at: string;
}
interface ViewRow {
  product_id: string;
  created_at: string;
}
interface IdentityRow {
  provider: string;
  created_at: string;
}

/* ── date helpers ─────────────────────────────────────────────────────── */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Widen a date-only lower bound to the start of the day; pass ISO through. */
function startBound(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  return DATE_ONLY.test(v) ? `${v}T00:00:00.000Z` : v;
}
/** Widen a date-only upper bound to the end of the day; pass ISO through. */
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

const IST_OFFSET_MS = 330 * 60_000; // +5:30
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Hard cap on emitted buckets so the chart + payload stay bounded. */
const MAX_BUCKETS = 120;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Shift a UTC instant into an IST "wall-clock" Date whose UTC getters (getUTC*)
 * read the IST calendar fields. Used for all bucketing + weekday classification.
 */
function istWall(iso: string): Date {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS);
}

/** IST Sat/Sun → weekend. */
function isWeekendIso(iso: string): boolean {
  const day = istWall(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** Snap an IST wall Date down to the start of its day/month/quarter bucket. */
function bucketStartWall(d: Date, bucket: AnalyticsBucket): Date {
  const w = new Date(d.getTime());
  w.setUTCHours(0, 0, 0, 0);
  if (bucket === "month") w.setUTCDate(1);
  if (bucket === "quarter") {
    w.setUTCDate(1);
    w.setUTCMonth(Math.floor(w.getUTCMonth() / 3) * 3);
  }
  return w;
}

/** Step an IST wall Date forward by one bucket. */
function advanceWall(d: Date, bucket: AnalyticsBucket): Date {
  const w = new Date(d.getTime());
  if (bucket === "day") w.setUTCDate(w.getUTCDate() + 1);
  else if (bucket === "month") w.setUTCMonth(w.getUTCMonth() + 1);
  else w.setUTCMonth(w.getUTCMonth() + 3);
  return w;
}

/** Stable bucket key for an IST wall Date (sortable, e.g. `2026-07`, `2026-Q3`). */
function keyOfWall(d: Date, bucket: AnalyticsBucket): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (bucket === "day") return `${y}-${pad2(m + 1)}-${pad2(d.getUTCDate())}`;
  if (bucket === "month") return `${y}-${pad2(m + 1)}`;
  return `${y}-Q${Math.floor(m / 3) + 1}`;
}

/** Human label for an IST wall Date (e.g. `13 Jul`, `Jul 2026`, `Q3 2026`). */
function labelOfWall(d: Date, bucket: AnalyticsBucket): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (bucket === "day") return `${d.getUTCDate()} ${MONTHS[m]}`;
  if (bucket === "month") return `${MONTHS[m]} ${y}`;
  return `Q${Math.floor(m / 3) + 1} ${y}`;
}

/** Bucket key for a raw ISO timestamp. */
function keyOfIso(iso: string, bucket: AnalyticsBucket): string {
  return keyOfWall(istWall(iso), bucket);
}

/**
 * Enumerate the contiguous bucket axis between two instants (inclusive). Returns
 * the trailing {@link MAX_BUCKETS} when the window is very wide so the chart
 * stays readable and the payload bounded.
 */
function enumerateAxis(startIso: string, endIso: string, bucket: AnalyticsBucket): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const endStart = bucketStartWall(istWall(endIso), bucket);
  let cur = bucketStartWall(istWall(startIso), bucket);
  let guard = 0;
  while (cur.getTime() <= endStart.getTime() && guard < 4000) {
    out.push({ key: keyOfWall(cur, bucket), label: labelOfWall(cur, bucket) });
    cur = advanceWall(cur, bucket);
    guard += 1;
  }
  return out.length > MAX_BUCKETS ? out.slice(out.length - MAX_BUCKETS) : out;
}

/* ── aggregation ──────────────────────────────────────────────────────── */

/**
 * Build the full product + customer analytics payload over the given range
 * (both bounds optional → all time), bucketed at `day`/`month`/`quarter`. Pass
 * `productId` to scope the product-level figures (units, revenue, wishlist,
 * views, trend, weekend split) to a single product; the sign-in breakdown is
 * always store-wide.
 */
export async function buildProductAnalytics(input: BuildAnalyticsInput = {}): Promise<ProductAnalytics> {
  const db = supabaseAdmin();
  const bucket: AnalyticsBucket = input.bucket ?? "day";
  const productId = input.productId ?? null;
  const fromIso = startBound(input.from ?? null);
  const toIso = endBound(input.to ?? null);
  const range: AnalyticsRange = { from: input.from ?? null, to: input.to ?? null };

  // 1. Catalogue — every product is a row (zero-sellers matter: they are the
  //    campaign candidates). Categories hydrate the group label.
  let productQuery = db.from("products").select("id, name, slug, category_id").limit(5000);
  if (productId) productQuery = productQuery.eq("id", productId);
  const [{ data: productData }, { data: categoryData }] = await Promise.all([
    productQuery,
    db.from("categories").select("id, name").limit(1000),
  ]);
  const products = (productData as ProductRow[] | null) ?? [];
  const categories = (categoryData as CategoryRow[] | null) ?? [];

  const categoryName = new Map<string, string>();
  for (const c of categories) categoryName.set(c.id, c.name);

  const slugToId = new Map<string, string>();
  const rowByProduct = new Map<string, ProductAnalyticsRow>();
  for (const p of products) {
    slugToId.set(p.slug, p.id);
    rowByProduct.set(p.id, {
      productId: p.id,
      name: p.name,
      slug: p.slug,
      categoryId: p.category_id,
      categoryName: p.category_id ? categoryName.get(p.category_id) ?? null : null,
      unitsSold: 0,
      revenuePaise: 0,
      wishlistCount: 0,
      views: 0,
    });
  }

  // 2. Non-cancelled orders in range — the id → placed_at map lets each order
  //    item inherit its order's timestamp for bucketing + the weekend split.
  let orderQuery = db.from("orders").select("id, placed_at").neq("status", "cancelled").limit(50000);
  if (fromIso) orderQuery = orderQuery.gte("placed_at", fromIso);
  if (toIso) orderQuery = orderQuery.lte("placed_at", toIso);
  const { data: orderData } = await orderQuery;
  const orders = (orderData as OrderRow[] | null) ?? [];
  const orderPlacedAt = new Map<string, string>();
  for (const o of orders) orderPlacedAt.set(o.id, o.placed_at);
  const orderIds = [...orderPlacedAt.keys()];

  // 3. Order items for those orders (chunked `.in()` to bound the URL).
  const items: OrderItemRow[] = [];
  for (const ids of chunk(orderIds, 200)) {
    let itemQuery = db
      .from("order_items")
      .select("order_id, product_id, qty, line_total_paise")
      .in("order_id", ids)
      .limit(50000);
    if (productId) itemQuery = itemQuery.eq("product_id", productId);
    const { data: itemData } = await itemQuery;
    for (const it of (itemData as OrderItemRow[] | null) ?? []) items.push(it);
  }

  // 4. Wishlist saves (standing demand) — keyed by product_slug, range-filtered
  //    on created_at so the figure tracks the same window as everything else.
  let wishlistQuery = db.from("wishlists").select("product_slug, created_at").limit(50000);
  if (fromIso) wishlistQuery = wishlistQuery.gte("created_at", fromIso);
  if (toIso) wishlistQuery = wishlistQuery.lte("created_at", toIso);
  const { data: wishlistData } = await wishlistQuery;
  const wishlist = (wishlistData as WishlistRow[] | null) ?? [];

  // 5. Product-detail views (best-effort telemetry).
  let viewQuery = db.from("product_views").select("product_id, created_at").limit(50000);
  if (fromIso) viewQuery = viewQuery.gte("created_at", fromIso);
  if (toIso) viewQuery = viewQuery.lte("created_at", toIso);
  if (productId) viewQuery = viewQuery.eq("product_id", productId);
  const { data: viewData } = await viewQuery;
  const views = (viewData as ViewRow[] | null) ?? [];

  // 6. Sign-in identities (store-wide, not product-scoped).
  let identityQuery = db.from("customer_identities").select("provider, created_at").limit(50000);
  if (fromIso) identityQuery = identityQuery.gte("created_at", fromIso);
  if (toIso) identityQuery = identityQuery.lte("created_at", toIso);
  const { data: identityData } = await identityQuery;
  const identities = (identityData as IdentityRow[] | null) ?? [];

  // ── reduce ──────────────────────────────────────────────────────────
  const weekend: WeekendSplit = {
    weekday: { unitsSold: 0, revenuePaise: 0, views: 0 },
    weekend: { unitsSold: 0, revenuePaise: 0, views: 0 },
  };
  const seriesMap = new Map<string, TimeBucketPoint>();
  const observed: string[] = [];

  let totalUnits = 0;
  let totalRevenue = 0;
  let totalViews = 0;
  let totalWishlist = 0;

  const ensureBucket = (iso: string): TimeBucketPoint => {
    const key = keyOfIso(iso, bucket);
    let point = seriesMap.get(key);
    if (!point) {
      point = { key, label: labelOfWall(istWall(iso), bucket), unitsSold: 0, revenuePaise: 0, views: 0 };
      seriesMap.set(key, point);
    }
    return point;
  };

  for (const it of items) {
    const placedAt = orderPlacedAt.get(it.order_id);
    if (!placedAt) continue;
    observed.push(placedAt);
    const qty = it.qty ?? 0;
    const revenue = it.line_total_paise ?? 0;
    totalUnits += qty;
    totalRevenue += revenue;

    const side = isWeekendIso(placedAt) ? weekend.weekend : weekend.weekday;
    side.unitsSold += qty;
    side.revenuePaise += revenue;

    const point = ensureBucket(placedAt);
    point.unitsSold += qty;
    point.revenuePaise += revenue;

    if (it.product_id) {
      const row = rowByProduct.get(it.product_id);
      if (row) {
        row.unitsSold += qty;
        row.revenuePaise += revenue;
      }
    }
  }

  for (const v of views) {
    observed.push(v.created_at);
    totalViews += 1;
    (isWeekendIso(v.created_at) ? weekend.weekend : weekend.weekday).views += 1;
    ensureBucket(v.created_at).views += 1;
    const row = rowByProduct.get(v.product_id);
    if (row) row.views += 1;
  }

  for (const w of wishlist) {
    observed.push(w.created_at);
    const pid = slugToId.get(w.product_slug);
    if (productId && pid !== productId) continue;
    totalWishlist += 1;
    if (pid) {
      const row = rowByProduct.get(pid);
      if (row) row.wishlistCount += 1;
    }
  }

  // Sign-in breakdown — provider totals + a bucketed trend on the shared axis.
  const providerCount = new Map<string, number>();
  const signinBucket = new Map<string, SignInSeriesPoint>();
  const ensureSignin = (iso: string): SignInSeriesPoint => {
    const key = keyOfIso(iso, bucket);
    let point = signinBucket.get(key);
    if (!point) {
      point = { key, label: labelOfWall(istWall(iso), bucket), google: 0, phone: 0, other: 0 };
      signinBucket.set(key, point);
    }
    return point;
  };
  for (const id of identities) {
    observed.push(id.created_at);
    providerCount.set(id.provider, (providerCount.get(id.provider) ?? 0) + 1);
    const point = ensureSignin(id.created_at);
    if (id.provider === "google") point.google += 1;
    else if (id.provider === "phone") point.phone += 1;
    else point.other += 1;
  }

  // Build the contiguous axis: explicit range bounds when given, else the span
  // of observed events. Fill gaps so the trend reads as a continuous timeline.
  let axis: { key: string; label: string }[] = [];
  const times = observed.map((iso) => new Date(iso).getTime()).filter((t) => Number.isFinite(t));
  const startIso = fromIso ?? (times.length ? new Date(Math.min(...times)).toISOString() : null);
  const endIso = toIso ?? (times.length ? new Date(Math.max(...times)).toISOString() : null);
  if (startIso && endIso) axis = enumerateAxis(startIso, endIso, bucket);

  const series: TimeBucketPoint[] = axis.map(
    (a) => seriesMap.get(a.key) ?? { key: a.key, label: a.label, unitsSold: 0, revenuePaise: 0, views: 0 },
  );
  const signinSeries: SignInSeriesPoint[] = axis.map(
    (a) => signinBucket.get(a.key) ?? { key: a.key, label: a.label, google: 0, phone: 0, other: 0 },
  );

  const providers: SignInProviderStat[] = [...providerCount.entries()]
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count);

  const productsOut = [...rowByProduct.values()].sort((a, b) => b.revenuePaise - a.revenuePaise);

  return {
    range,
    bucket,
    generatedAt: new Date().toISOString(),
    totals: {
      unitsSold: totalUnits,
      revenuePaise: totalRevenue,
      views: totalViews,
      wishlistCount: totalWishlist,
      productsTracked: productsOut.length,
    },
    products: productsOut,
    series,
    weekend,
    signins: {
      total: identities.length,
      providers,
      series: signinSeries,
    },
  };
}
