"use client";

/**
 * Product & Customer Analytics.
 *
 * Every figure is real: it is driven entirely by `GET /api/admin/analytics`,
 * which aggregates `public.orders` / `public.order_items` / `public.products` /
 * `public.wishlists` / `public.product_views` / `public.customer_identities`.
 * There is no mock data source. Money is integer paise throughout; the range +
 * bucket selectors re-query the API live. Charts are the hand-authored CSS/SVG
 * viz primitives — no chart libraries.
 *
 * It answers two operator questions: "which products need a campaign?" (the
 * sortable per-product table of units, revenue, wishlist saves and views) and
 * "how are customers signing in?" (the provider breakdown card). A day/month/
 * quarter toggle and a weekday-vs-weekend split slice the trend.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { AreaChart, DonutChart, HBars, type VizTone } from "@/components/ng/admin/viz";

/* ------------------------------------------------------------------ */
/* payload shapes (mirror @/lib/analytics — kept local for the client) */
/* ------------------------------------------------------------------ */

type Bucket = "day" | "month" | "quarter";

interface ProductRow {
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
interface TimePoint {
  key: string;
  label: string;
  unitsSold: number;
  revenuePaise: number;
  views: number;
}
interface WeekendPart {
  unitsSold: number;
  revenuePaise: number;
  views: number;
}
interface SignInPoint {
  key: string;
  label: string;
  google: number;
  phone: number;
  other: number;
}
interface Analytics {
  range: { from: string | null; to: string | null };
  bucket: Bucket;
  generatedAt: string;
  totals: { unitsSold: number; revenuePaise: number; views: number; wishlistCount: number; productsTracked: number };
  products: ProductRow[];
  series: TimePoint[];
  weekend: { weekday: WeekendPart; weekend: WeekendPart };
  signins: { total: number; providers: { provider: string; count: number }[]; series: SignInPoint[] };
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/** Integer paise → a whole-rupee "₹1,23,456" string. */
const INR = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
/** Whole-number formatter with Indian grouping. */
const NUM = (n: number) => n.toLocaleString("en-IN");

const DATE_RANGES = [
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "365", label: "Last year", days: 365 },
  { id: "all", label: "All time", days: null },
] as const;
type RangeId = (typeof DATE_RANGES)[number]["id"];

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
];

/** A date-only (YYYY-MM-DD) `from`/`to` window for the selected range. */
function rangeWindow(days: number | null): { from: string | null; to: string | null } {
  if (days == null) return { from: null, to: null };
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const PROVIDER_LABEL: Record<string, string> = { google: "Google", phone: "Phone", other: "Other" };
const PROVIDER_TONE: Record<string, VizTone> = { google: "forest", phone: "clay", other: "blue" };

/* sortable per-product table --------------------------------------- */

type SortKey = "name" | "categoryName" | "unitsSold" | "revenuePaise" | "wishlistCount" | "views";
const NUMERIC_KEYS: SortKey[] = ["unitsSold", "revenuePaise", "wishlistCount", "views"];

/* ================================================================== */
/* PAGE                                                                */
/* ================================================================== */

export default function AdminAnalytics() {
  const [rangeId, setRangeId] = useState<RangeId>("30");
  const [bucket, setBucket] = useState<Bucket>("day");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "revenuePaise", dir: "desc" });

  const range = useMemo(() => DATE_RANGES.find((r) => r.id === rangeId) ?? DATE_RANGES[0], [rangeId]);

  const load = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      // See the note in `useLiveRefresh`: a background refresh keeps the
      // current figures on screen while it runs, rather than collapsing the
      // page to skeletons for a query nobody asked for.
      if (!quiet) setLoading(true);
      try {
        const { from, to } = rangeWindow(range.days);
        const params = new URLSearchParams({ bucket });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(`/api/admin/analytics?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; analytics?: Analytics };
        setAnalytics(json.ok && json.analytics ? json.analytics : null);
      } catch {
        // A failed background poll must not wipe a good screen — only a
        // foreground load is allowed to resolve to the empty state.
        if (!quiet) setAnalytics(null);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [range.days, bucket],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Order status and payment changes move these numbers; follow them.
  useLiveRefresh(() => void load({ quiet: true }));

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: NUMERIC_KEYS.includes(key) ? "desc" : "asc" },
    );

  const sortedProducts = useMemo(() => {
    const rows = analytics?.products ?? [];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [analytics, sort]);

  const labels = useMemo(() => (analytics?.series ?? []).map((p) => p.label), [analytics]);
  const totals = analytics?.totals;
  const weekend = analytics?.weekend;
  const signins = analytics?.signins;

  return (
    <AdminShell
      active="/admin/analytics"
      title={
        <span>
          Product <em className="italic text-ng-clay font-display">&amp; customer</em> analytics
        </span>
      }
      subtitle="Demand signals per product & how customers sign in. Computed live from real data"
      actions={
        <>
          <div className="hidden md:flex gap-1 bg-ng-paper border border-ng-line-soft rounded-full p-1">
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBucket(b.id)}
                aria-pressed={bucket === b.id}
                className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors cursor-pointer ${
                  bucket === b.id ? "bg-ng-forest-deep text-ng-cream font-semibold" : "text-ng-ink-muted hover:text-ng-forest"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-ng-paper border border-ng-line-soft rounded-full p-1">
            {DATE_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeId(r.id)}
                aria-pressed={rangeId === r.id}
                className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors cursor-pointer ${
                  rangeId === r.id ? "bg-ng-forest-deep text-ng-cream font-semibold" : "text-ng-ink-muted hover:text-ng-forest"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      }
    >
      {!analytics ? (
        <div className="rounded-2xl bg-ng-paper border border-ng-line-soft p-10 text-center text-[14px] font-medium text-ng-ink-muted">
          {loading ? "Loading analytics…" : "No analytics available."}
        </div>
      ) : (
        <>
          {/* Headline KPIs ------------------------------------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatTile label="Units sold" value={NUM(totals?.unitsSold ?? 0)} delta={INR(totals?.revenuePaise ?? 0)} trend="up" />
            <StatTile label="Product views" value={NUM(totals?.views ?? 0)} delta="PDP pings in range" trend="up" />
            <StatTile label="Wishlist saves" value={NUM(totals?.wishlistCount ?? 0)} delta="latent demand" trend="up" />
            <StatTile label="Sign-ins" value={NUM(signins?.total ?? 0)} delta="identities in range" trend="up" />
          </div>

          {/* 1 · TREND ----------------------------------------------- */}
          <Card
            title={
              <span className="flex items-center gap-2">
                Trend <Pill tone="info">{BUCKETS.find((b) => b.id === bucket)?.label}</Pill>
              </span>
            }
            className="mb-6"
          >
            {analytics.series.length === 0 ? (
              <div className="py-8 text-center text-[14px] font-medium text-ng-ink-muted">No activity in this range yet.</div>
            ) : (
              /*
                A divider between the two charts, and real space around each.

                Side by side with only an 8-unit gap, the two x-axes ran into
                one another and read as a single strip of dates that repeated
                halfway along — "…8 Aug, 15 Aug, 15 Jul, 19 Jul…" — which looks
                like a data bug rather than two charts covering the same range.
                A rule and a wider gutter say plainly that the axis starts again.
              */
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-ng-line-soft">
                <div className="lg:pr-8">
                  <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Units &amp; views</div>
                  <AreaChart
                    labels={labels}
                    series={[
                      { name: "Units", data: analytics.series.map((p) => p.unitsSold), tone: "leaf" },
                      { name: "Views", data: analytics.series.map((p) => p.views), tone: "blue" },
                    ]}
                  />
                </div>
                <div className="lg:pl-8">
                  <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Revenue (₹)</div>
                  <AreaChart
                    labels={labels}
                    formatY={(v) => `₹${NUM(v)}`}
                    series={[{ name: "Revenue", data: analytics.series.map((p) => Math.round(p.revenuePaise / 100)), tone: "forest" }]}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* 2 · WEEKDAY vs WEEKEND ---------------------------------- */}
          <Card title="Weekday vs weekend" className="mb-6">
            <div className="grid sm:grid-cols-3 gap-8">
              <div>
                <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Units sold</div>
                <HBars
                  formatValue={(v) => NUM(v)}
                  rows={[
                    { label: "Weekday", value: weekend?.weekday.unitsSold ?? 0, tone: "forest" },
                    { label: "Weekend", value: weekend?.weekend.unitsSold ?? 0, tone: "clay" },
                  ]}
                />
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Revenue</div>
                <HBars
                  formatValue={(v) => INR(v)}
                  rows={[
                    { label: "Weekday", value: weekend?.weekday.revenuePaise ?? 0, tone: "forest" },
                    { label: "Weekend", value: weekend?.weekend.revenuePaise ?? 0, tone: "clay" },
                  ]}
                />
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Product views</div>
                <HBars
                  formatValue={(v) => NUM(v)}
                  rows={[
                    { label: "Weekday", value: weekend?.weekday.views ?? 0, tone: "forest" },
                    { label: "Weekend", value: weekend?.weekend.views ?? 0, tone: "clay" },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* 3 · PER-PRODUCT TABLE (sortable) ------------------------ */}
          <Card
            title="Products · demand"
            action={<span className="text-[12.5px] font-medium text-ng-ink-soft">{NUM(sortedProducts.length)} products</span>}
            className="mb-6 !p-0"
          >
            {sortedProducts.length === 0 ? (
              <div className="py-10 text-center text-[14px] font-medium text-ng-ink-muted">No products to show yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[1.7fr_1fr_0.7fr_1fr_0.8fr_0.8fr] gap-3 px-6 py-2.5 bg-ng-cream border-b border-ng-line-soft text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold">
                    <SortHead label="Product" k="name" sort={sort} onSort={toggleSort} />
                    <SortHead label="Category" k="categoryName" sort={sort} onSort={toggleSort} />
                    <SortHead label="Units" k="unitsSold" sort={sort} onSort={toggleSort} align="right" />
                    <SortHead label="Revenue" k="revenuePaise" sort={sort} onSort={toggleSort} align="right" />
                    <SortHead label="Wishlist" k="wishlistCount" sort={sort} onSort={toggleSort} align="right" />
                    <SortHead label="Views" k="views" sort={sort} onSort={toggleSort} align="right" />
                  </div>
                  <ul>
                    {sortedProducts.map((p) => (
                      <li
                        key={p.productId}
                        className="grid grid-cols-[1.7fr_1fr_0.7fr_1fr_0.8fr_0.8fr] gap-3 px-6 py-3 items-center text-[13.5px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                      >
                        <span className="font-semibold text-ng-ink truncate">{p.name}</span>
                        <span className="text-ng-ink-muted truncate">{p.categoryName ?? "—"}</span>
                        <span className="font-mono text-[13px] tabular-nums text-ng-ink text-right">{NUM(p.unitsSold)}</span>
                        <span className="font-mono text-[13px] tabular-nums text-ng-forest-deep font-semibold text-right">{INR(p.revenuePaise)}</span>
                        <span className="font-mono text-[13px] tabular-nums text-ng-clay-deep text-right">{NUM(p.wishlistCount)}</span>
                        <span className="font-mono text-[13px] tabular-nums text-ng-blue text-right">{NUM(p.views)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* 4 · SIGN-IN BREAKDOWN ----------------------------------- */}
          <Card title="Customer sign-ins" className="mb-6">
            {signins && signins.total > 0 ? (
              <div className="grid lg:grid-cols-2 gap-8">
                <div>
                  <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">By provider</div>
                  <DonutChart
                    size={150}
                    thickness={20}
                    centerValue={NUM(signins.total)}
                    centerLabel="sign-ins"
                    segments={signins.providers.map((s) => ({
                      label: PROVIDER_LABEL[s.provider] ?? s.provider,
                      value: s.count,
                      tone: PROVIDER_TONE[s.provider] ?? "ink",
                    }))}
                  />
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <StatTile label="Google" value={NUM(providerCount(signins.providers, "google"))} delta="Google sign-in" trend="flat" />
                    <StatTile label="Phone" value={NUM(providerCount(signins.providers, "phone"))} delta="Phone OTP" trend="flat" />
                  </div>
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Sign-ins over time</div>
                  {signins.series.length === 0 ? (
                    <div className="py-8 text-center text-[14px] font-medium text-ng-ink-muted">No sign-ins in this range.</div>
                  ) : (
                    <AreaChart
                      labels={signins.series.map((p) => p.label)}
                      series={[
                        { name: "Google", data: signins.series.map((p) => p.google), tone: "forest" },
                        { name: "Phone", data: signins.series.map((p) => p.phone), tone: "clay" },
                      ]}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-[14px] font-medium text-ng-ink-muted">No customer sign-ins in this range yet.</div>
            )}
          </Card>

          <p className="text-[12.5px] font-medium text-ng-ink-soft text-center mt-2 mb-2">
            Figures computed live ({range.label}, by {BUCKETS.find((b) => b.id === bucket)?.label.toLowerCase()}). Views are best-effort PDP
            pings; weekend = Sat/Sun (IST). Charts are hand-authored CSS/SVG — no chart libraries.
          </p>
        </>
      )}
    </AdminShell>
  );
}

/** Look up one provider's count from the breakdown list. */
function providerCount(providers: { provider: string; count: number }[], provider: string): number {
  return providers.find((p) => p.provider === provider)?.count ?? 0;
}

/** A clickable column header that shows the active sort direction. */
function SortHead({
  label,
  k,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider font-semibold transition-colors cursor-pointer hover:text-ng-forest ${
        active ? "text-ng-forest" : ""
      } ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      {label}
      <Icon name={active ? (sort.dir === "asc" ? "alt-arrow-up-bold" : "alt-arrow-down-bold") : "sort-vertical-bold"} size={12} />
    </button>
  );
}
