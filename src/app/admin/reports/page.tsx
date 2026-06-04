"use client";

/**
 * Reports & Analytics — Phase 8 (MVP).
 *
 * A dedicated, client-facing analytics surface for Nutri Greenz. Every figure
 * is derived from the read-only mock data sources (ADMIN_ORDERS, PRODUCTS,
 * COUPONS, LOYALTY_LEDGER, FARMS) so the page is self-explanatory and matches
 * what the rest of the admin shows. All charts are the hand-authored CSS/SVG
 * viz primitives — no chart libraries. Each section can export its data as CSV.
 */

import { useMemo, useState } from "react";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import {
  AreaChart,
  DonutChart,
  HBars,
  Sparkline,
  GaugeRing,
  TrendChip,
  type VizTone,
} from "@/components/ng/admin/viz";
import { ADMIN_ORDERS, type OrderChannel } from "@/components/ng/admin/orders-data";
import { PRODUCTS, COUPONS, LOYALTY_LEDGER, FARMS } from "@/components/ng/data";
import { downloadCsv, downloadCsvBundle, type CsvRow } from "@/components/ng/admin/reports/csv";

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const PCT = (n: number) => `${n.toFixed(1)}%`;

/** Channels that are "offline" (community captain led) vs "online" (self-serve). */
const OFFLINE_CHANNELS: OrderChannel[] = ["Community bundle", "Captain bundle"];
const isOffline = (c: OrderChannel) => OFFLINE_CHANNELS.includes(c);

/** Map a product's primary tag to a display category. */
const TAG_CATEGORY: Record<string, string> = {
  oil: "Oils",
  ghee: "Ghee",
  honey: "Honey",
  millet: "Millets",
  grain: "Millets",
  spice: "Spices",
  superfood: "Superfoods",
  pulse: "Pulses",
  flour: "Flours",
  fruit: "Produce",
  gift: "Gifting",
};
function skuCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("oil")) return "Oils";
  if (t.includes("ghee")) return "Ghee";
  if (t.includes("honey")) return "Honey";
  if (t.includes("millet")) return "Millets";
  if (t.includes("turmeric") || t.includes("spice") || t.includes("masala")) return "Spices";
  if (t.includes("moringa") || t.includes("ashwagandha") || t.includes("superfood")) return "Superfoods";
  if (t.includes("dal") || t.includes("pulse")) return "Pulses";
  if (t.includes("atta") || t.includes("flour")) return "Flours";
  return "Other";
}

/** Deterministic pseudo-random in [0,1) from a seed — keeps charts stable per range. */
function seeded(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const DATE_RANGES = [
  { id: "7", label: "Last 7 days", days: 7, points: 7 },
  { id: "30", label: "Last 30 days", days: 30, points: 8 },
  { id: "90", label: "Last 90 days", days: 90, points: 12 },
] as const;
type RangeId = (typeof DATE_RANGES)[number]["id"];

/* ------------------------------------------------------------------ */
/* section header with an inline Export CSV button                     */
/* ------------------------------------------------------------------ */

function ExportButton({ onClick, label = "Export CSV" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-3 py-1.5 text-[11.5px] hover:bg-ng-paper transition-colors cursor-pointer"
    >
      <Icon name="file-download-bold" size={14} className="text-ng-forest" />
      {label}
    </button>
  );
}

/** Tiny legend dot + label, reused under split charts. */
function LegendRow({ tone, label, value }: { tone: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[12.5px]">
      <span className="size-2.5 rounded-full shrink-0" style={{ background: tone }} />
      <span className="text-ng-ink-muted truncate">{label}</span>
      <span className="ml-auto font-mono tabular-nums text-ng-forest-deep font-semibold pl-3">{value}</span>
    </li>
  );
}

/* ================================================================== */
/* PAGE                                                                */
/* ================================================================== */

export default function AdminReports() {
  const [rangeId, setRangeId] = useState<RangeId>("30");
  const range = DATE_RANGES.find((r) => r.id === rangeId)!;

  /* ----- derive everything from the mock sources, sliced by range ---- */
  const data = useMemo(() => {
    // The mock dataset is a single snapshot; we scale aggregate figures by the
    // selected window so the page "re-slices" believably without new fixtures.
    const dayFactor = range.days / 30; // 30d == baseline
    const orders = ADMIN_ORDERS;
    const orderCount = orders.length;
    const gmv = orders.reduce((s, o) => s + o.total, 0);

    /* --- Customers: onboarded-over-time, offline/online, conversion --- */
    const offlineOrders = orders.filter((o) => isOffline(o.channel)).length;
    const onlineOrders = orderCount - offlineOrders;

    // Synthetic onboarding curve over the window (monotonic-ish, seeded stable).
    const onboardSeries = Array.from({ length: range.points }).map((_, i) => {
      const base = 40 + i * (range.days / 4);
      return Math.round(base + seeded(i + range.days) * 30);
    });
    const onboardLabels = Array.from({ length: range.points }).map((_, i) => {
      if (range.id === "7") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i] ?? `D${i}`;
      return `${Math.round((i / (range.points - 1)) * range.days)}d`;
    });
    const newCustomers = onboardSeries.reduce((a, b) => a + b, 0);
    const repeatRate = 0.62; // matches People dashboard
    const repeatCustomers = Math.round(newCustomers * (repeatRate / (1 - repeatRate)));
    const conversionRate = 3.4 + (range.id === "90" ? 0.6 : range.id === "7" ? -0.3 : 0); // % visitors→buyers

    /* --- Segmentation by community / area / pincode -------------------- */
    const communityMap = new Map<
      string,
      { community: string; area: string; pincode: string; orders: number; gmv: number }
    >();
    for (const o of orders) {
      const key = o.address.community;
      const cur =
        communityMap.get(key) ??
        { community: key, area: o.address.area, pincode: o.address.pincode, orders: 0, gmv: 0 };
      cur.orders += 1;
      cur.gmv += o.total;
      communityMap.set(key, cur);
    }
    const segments = Array.from(communityMap.values()).sort((a, b) => b.gmv - a.gmv);

    /* --- Sales / SKU KPIs --------------------------------------------- */
    const skuMap = new Map<string, { sku: string; title: string; units: number; revenue: number; category: string }>();
    for (const o of orders) {
      for (const it of o.items) {
        const cur =
          skuMap.get(it.sku) ??
          { sku: it.sku, title: it.title, units: 0, revenue: 0, category: skuCategory(it.title) };
        cur.units += it.qty;
        cur.revenue += it.qty * it.price;
        skuMap.set(it.sku, cur);
      }
    }
    const skus = Array.from(skuMap.values()).sort((a, b) => b.revenue - a.revenue);
    const topSkus = skus.slice(0, 5);
    const bottomSkus = [...skus].sort((a, b) => a.revenue - b.revenue).slice(0, 5);
    const aov = gmv / orderCount;

    // Category mix from product catalog (count of live SKUs per category).
    const catCount = new Map<string, number>();
    for (const p of PRODUCTS) {
      const tag = p.tags?.[0];
      const cat = (tag && TAG_CATEGORY[tag]) || "Other";
      catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    }
    const categoryMix = Array.from(catCount.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Revenue trend across the window (seeded around the AOV baseline).
    const revSeries = Array.from({ length: range.points }).map((_, i) =>
      Math.round((gmv / range.points) * (0.7 + seeded(i * 3 + range.days) * 0.7) * dayFactor),
    );
    const ordersSeries = Array.from({ length: range.points }).map((_, i) =>
      Math.max(1, Math.round((orderCount / range.points) * (0.7 + seeded(i * 5 + 9) * 0.7) * dayFactor)),
    );

    /* --- Coupons / Referrals / Loyalty -------------------------------- */
    // Synthetic redemption + ROI figures keyed off each coupon, stable per code.
    const couponRows = COUPONS.map((c, i) => {
      const redemptions = c.active ? Math.round(40 + seeded(i + 1) * 180) : Math.round(seeded(i + 9) * 20);
      const discountGiven =
        c.type === "flat" ? c.value * redemptions : Math.round((c.maxDiscount ?? 120) * 0.7) * redemptions;
      const revenue = Math.round(discountGiven * (3 + seeded(i + 4) * 4)); // attributed GMV
      const roi = discountGiven > 0 ? revenue / discountGiven : 0;
      return {
        code: c.code,
        description: c.description,
        type: c.type,
        active: c.active,
        redemptions,
        discountGiven,
        revenue,
        roi,
      };
    });
    const totalRedemptions = couponRows.reduce((s, c) => s + c.redemptions, 0);
    const totalDiscount = couponRows.reduce((s, c) => s + c.discountGiven, 0);
    const totalCouponRevenue = couponRows.reduce((s, c) => s + c.revenue, 0);
    const couponRoi = totalDiscount > 0 ? totalCouponRevenue / totalDiscount : 0;

    // Loyalty ledger summary — real earned vs redeemed from the fixture.
    const earned = LOYALTY_LEDGER.filter((e) => e.type === "earned").reduce((s, e) => s + e.points, 0);
    const redeemed = LOYALTY_LEDGER.filter((e) => e.type === "redeemed").reduce(
      (s, e) => s + Math.abs(e.points),
      0,
    );
    const outstanding = earned - redeemed;
    // Referral signal: ledger entries whose reason mentions a referral.
    const referralEntries = LOYALTY_LEDGER.filter((e) => /referr/i.test(e.reason));
    const referralPoints = referralEntries.reduce((s, e) => s + Math.abs(e.points), 0);

    return {
      orderCount,
      gmv,
      offlineOrders,
      onlineOrders,
      onboardSeries,
      onboardLabels,
      newCustomers,
      repeatCustomers,
      repeatRate,
      conversionRate,
      segments,
      skus,
      topSkus,
      bottomSkus,
      aov,
      categoryMix,
      revSeries,
      ordersSeries,
      couponRows,
      totalRedemptions,
      totalDiscount,
      totalCouponRevenue,
      couponRoi,
      earned,
      redeemed,
      outstanding,
      referralEntries,
      referralPoints,
      farms: FARMS.length,
    };
  }, [range.days, range.id, range.points]);

  const donutTones: VizTone[] = ["forest", "leaf", "clay", "terracotta", "blue", "amber"];

  /* ----- per-section CSV builders ----------------------------------- */
  const customersCsv = (): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Bucket", "Period", "Value"],
    rows: [
      ...data.onboardSeries.map((v, i) => ({
        Bucket: "Onboarded",
        Period: data.onboardLabels[i] ?? `P${i}`,
        Value: v,
      })),
      { Bucket: "Online orders", Period: range.label, Value: data.onlineOrders },
      { Bucket: "Offline orders", Period: range.label, Value: data.offlineOrders },
      { Bucket: "New customers", Period: range.label, Value: data.newCustomers },
      { Bucket: "Repeat customers", Period: range.label, Value: data.repeatCustomers },
      { Bucket: "Conversion rate %", Period: range.label, Value: data.conversionRate.toFixed(1) },
    ],
  });

  const segmentationCsv = (): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Community", "Area", "Pincode", "Orders", "GMV"],
    rows: data.segments.map((s) => ({
      Community: s.community,
      Area: s.area,
      Pincode: s.pincode,
      Orders: s.orders,
      GMV: s.gmv,
    })),
  });

  const salesCsv = (): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["SKU", "Title", "Category", "Units", "Revenue"],
    rows: data.skus.map((s) => ({
      SKU: s.sku,
      Title: s.title,
      Category: s.category,
      Units: s.units,
      Revenue: s.revenue,
    })),
  });

  const couponsCsv = (): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Code", "Description", "Type", "Active", "Redemptions", "Discount given", "Attributed revenue", "ROI"],
    rows: data.couponRows.map((c) => ({
      Code: c.code,
      Description: c.description,
      Type: c.type,
      Active: c.active ? "yes" : "no",
      Redemptions: c.redemptions,
      "Discount given": c.discountGiven,
      "Attributed revenue": c.revenue,
      ROI: `${c.roi.toFixed(1)}x`,
    })),
  });

  const loyaltyCsv = (): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Entry", "Type", "Reason", "Points"],
    rows: [
      ...LOYALTY_LEDGER.map((e) => ({
        Entry: e.id,
        Type: e.type,
        Reason: e.reason,
        Points: e.points,
      })),
      { Entry: "TOTAL", Type: "earned", Reason: "All earned", Points: data.earned },
      { Entry: "TOTAL", Type: "redeemed", Reason: "All redeemed", Points: data.redeemed },
      { Entry: "TOTAL", Type: "outstanding", Reason: "Earned − redeemed", Points: data.outstanding },
    ],
  });

  const exportAll = () => {
    const c = customersCsv();
    const sg = segmentationCsv();
    const sl = salesCsv();
    const cp = couponsCsv();
    const ly = loyaltyCsv();
    downloadCsvBundle(`nutrigreenz-reports-${range.id}d`, [
      { title: `Customers (${range.label})`, rows: c.rows, headers: c.headers },
      { title: "Segmentation by community", rows: sg.rows, headers: sg.headers },
      { title: "Sales / SKU KPIs", rows: sl.rows, headers: sl.headers },
      { title: "Coupons & referrals", rows: cp.rows, headers: cp.headers },
      { title: "Loyalty ledger", rows: ly.rows, headers: ly.headers },
    ]);
  };

  /* ----------------------------------------------------------------- */

  return (
    <AdminShell
      active="/admin/reports"
      title={
        <span>
          Reports <em className="italic text-ng-clay font-display">&amp; analytics</em>
        </span>
      }
      subtitle="Customers, segmentation, sales, coupons & loyalty — exportable, self-explanatory"
      actions={
        <>
          {/* Date-range selector — re-slices the mock figures. */}
          <div className="hidden sm:flex gap-1 bg-ng-paper border border-ng-line-soft rounded-full p-1">
            {DATE_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeId(r.id)}
                aria-pressed={rangeId === r.id}
                className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer ${
                  rangeId === r.id
                    ? "bg-ng-forest-deep text-ng-cream font-semibold"
                    : "text-ng-ink-muted hover:text-ng-forest"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportAll}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="file-download-bold" size={15} />
            Export all
          </button>
        </>
      }
    >
      {/* Headline KPIs ------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="GMV" value={INR(data.gmv)} delta={range.label} trend="up" />
        <StatTile label="Orders" value={String(data.orderCount)} delta={`AOV ${INR(data.aov)}`} trend="up" />
        <StatTile label="New customers" value={data.newCustomers.toLocaleString("en-IN")} delta="onboarded" trend="up" />
        <StatTile label="Conversion" value={PCT(data.conversionRate)} delta="visitors → buyers" trend="up" />
      </div>

      {/* ============================================================ */}
      {/* 1 · CUSTOMERS                                                 */}
      {/* ============================================================ */}
      <Card
        title="Customers"
        action={<ExportButton onClick={() => { const c = customersCsv(); downloadCsv(`customers-${range.id}d`, c.rows, c.headers); }} />}
        className="mb-6"
      >
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft">Onboarded over time</div>
                <div className="font-display text-[26px] text-ng-forest-deep leading-none mt-1.5 tabular-nums">
                  {data.newCustomers.toLocaleString("en-IN")}
                </div>
              </div>
              <TrendChip delta={`+${Math.round(data.newCustomers * 0.08)}`} direction="up" />
            </div>
            <AreaChart
              series={[{ name: "onboarded", data: data.onboardSeries, tone: "leaf" }]}
              labels={data.onboardLabels}
              height={180}
              formatY={(v) => String(Math.round(v))}
            />
          </div>
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mb-3">Offline vs online orders</div>
              <DonutChart
                size={150}
                thickness={20}
                centerValue={PCT((data.onlineOrders / data.orderCount) * 100)}
                centerLabel="online"
                segments={[
                  { label: "Online (Web + App)", value: data.onlineOrders, tone: "forest" },
                  { label: "Offline (community / captain)", value: data.offlineOrders, tone: "clay" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-ng-cream/60 border border-ng-line-soft p-3">
                <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft">Repeat rate</div>
                <div className="font-display text-[20px] text-ng-forest-deep tabular-nums mt-1">{PCT(data.repeatRate * 100)}</div>
              </div>
              <div className="rounded-xl bg-ng-cream/60 border border-ng-line-soft p-3">
                <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft">New vs repeat</div>
                <div className="font-display text-[20px] text-ng-forest-deep tabular-nums mt-1">
                  {data.newCustomers}
                  <span className="text-ng-ink-soft text-[14px]"> / {data.repeatCustomers}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================================ */}
      {/* 2 · SEGMENTATION                                              */}
      {/* ============================================================ */}
      <Card
        title="Segmentation · gated communities & areas"
        action={<ExportButton onClick={() => { const s = segmentationCsv(); downloadCsv(`segmentation-${range.id}d`, s.rows, s.headers); }} />}
        className="!p-0 overflow-hidden mb-6"
      >
        <div className="grid grid-cols-[2fr_1.1fr_0.8fr_0.7fr_1.6fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span>Community</span>
          <span>Area</span>
          <span>Pincode</span>
          <span>Orders</span>
          <span>GMV</span>
        </div>
        <ul>
          {data.segments.map((s) => {
            const maxGmv = Math.max(...data.segments.map((x) => x.gmv), 1);
            return (
              <li
                key={s.community}
                className="grid grid-cols-[2fr_1.1fr_0.8fr_0.7fr_1.6fr] gap-4 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
              >
                <span className="font-medium truncate">{s.community}</span>
                <span className="text-[12px] text-ng-ink-muted truncate">{s.area}</span>
                <span className="font-mono text-[12px] tabular-nums text-ng-ink-muted">{s.pincode}</span>
                <span className="font-mono text-[12px] tabular-nums">{s.orders}</span>
                <span className="flex items-center gap-2.5">
                  <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep w-16">{INR(s.gmv)}</span>
                  <span className="h-2 flex-1 rounded-full bg-ng-line-soft overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-ng-leaf"
                      style={{ width: `${Math.max(6, (s.gmv / maxGmv) * 100)}%` }}
                    />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="px-6 py-3 text-[12px] text-ng-ink-soft border-t border-ng-line-soft bg-ng-cream/40">
          {data.segments.length} communities · derived from delivery addresses on {data.orderCount} orders
        </div>
      </Card>

      {/* ============================================================ */}
      {/* 3 · SALES / SKU KPIs                                          */}
      {/* ============================================================ */}
      <Card
        title="Sales & SKU performance"
        action={<ExportButton onClick={() => { const s = salesCsv(); downloadCsv(`sales-skus-${range.id}d`, s.rows, s.headers); }} />}
        className="mb-6"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl bg-ng-cream/60 border border-ng-line-soft p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft">Avg order value</div>
            <div className="font-display text-[22px] text-ng-forest-deep tabular-nums mt-1">{INR(data.aov)}</div>
          </div>
          <div className="rounded-xl bg-ng-cream/60 border border-ng-line-soft p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft">Total revenue</div>
            <div className="font-display text-[22px] text-ng-forest-deep tabular-nums mt-1">{INR(data.gmv)}</div>
          </div>
          <div className="rounded-xl bg-ng-cream/60 border border-ng-line-soft p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft">Active SKUs</div>
            <div className="font-display text-[22px] text-ng-forest-deep tabular-nums mt-1">{data.skus.length}</div>
          </div>
          <div className="rounded-xl bg-ng-cream/60 border border-ng-line-soft p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft">Partner farms</div>
            <div className="font-display text-[22px] text-ng-forest-deep tabular-nums mt-1">{data.farms}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mb-3">Revenue trend</div>
            <AreaChart
              series={[{ name: "revenue", data: data.revSeries, tone: "forest" }]}
              labels={data.onboardLabels}
              height={180}
              formatY={(v) => `₹${Math.round(v / 1000)}k`}
            />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mb-3">Category mix (catalog)</div>
            <DonutChart
              size={150}
              thickness={20}
              centerValue={String(PRODUCTS.length)}
              centerLabel="products"
              segments={data.categoryMix.map((c, i) => ({
                label: c.label,
                value: c.value,
                tone: donutTones[i % donutTones.length],
              }))}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mb-3">Top SKUs by revenue</div>
            <HBars
              tone="forest"
              formatValue={(v) => INR(v)}
              rows={data.topSkus.map((s) => ({ label: s.title, value: s.revenue, hint: `${s.units}u` }))}
            />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mb-3">Bottom SKUs by revenue</div>
            <HBars
              tone="terracotta"
              formatValue={(v) => INR(v)}
              rows={data.bottomSkus.map((s) => ({ label: s.title, value: s.revenue, hint: `${s.units}u` }))}
            />
          </div>
        </div>
      </Card>

      {/* ============================================================ */}
      {/* 4 · COUPONS / REFERRALS / LOYALTY                             */}
      {/* ============================================================ */}
      <Card
        title="Coupons, referrals & loyalty"
        action={
          <div className="flex items-center gap-2">
            <ExportButton label="Coupons CSV" onClick={() => { const c = couponsCsv(); downloadCsv(`coupons-${range.id}d`, c.rows, c.headers); }} />
            <ExportButton label="Loyalty CSV" onClick={() => { const l = loyaltyCsv(); downloadCsv(`loyalty-${range.id}d`, l.rows, l.headers); }} />
          </div>
        }
        className="mb-6"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatTile label="Redemptions" value={data.totalRedemptions.toLocaleString("en-IN")} delta="all coupons" trend="up" />
          <StatTile label="Coupon ROI" value={`${data.couponRoi.toFixed(1)}×`} delta={`${INR(data.totalDiscount)} given`} trend="up" />
          <StatTile label="Referral points" value={data.referralPoints.toLocaleString("en-IN")} delta={`${data.referralEntries.length} bonus events`} trend="up" />
          <StatTile label="Points outstanding" value={data.outstanding.toLocaleString("en-IN")} delta="earned − redeemed" trend="flat" />
        </div>

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
          {/* coupon table */}
          <div className="rounded-2xl border border-ng-line-soft overflow-hidden">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.7fr] gap-3 px-4 py-2.5 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
              <span>Code</span>
              <span>Redeemed</span>
              <span>Revenue</span>
              <span>ROI</span>
            </div>
            <ul>
              {data.couponRows.map((c) => (
                <li
                  key={c.code}
                  className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.7fr] gap-3 px-4 py-3 items-center text-[12.5px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[12px] font-semibold truncate">{c.code}</span>
                    {!c.active ? <Pill tone="neutral">off</Pill> : null}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums">{c.redemptions}</span>
                  <span className="font-mono text-[12px] tabular-nums text-ng-forest-deep font-semibold">{INR(c.revenue)}</span>
                  <span className="font-mono text-[12px] tabular-nums text-ng-success font-semibold">{c.roi.toFixed(1)}×</span>
                </li>
              ))}
            </ul>
          </div>

          {/* loyalty earned vs redeemed */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mb-3">Loyalty ledger · earned vs redeemed</div>
            <DonutChart
              size={150}
              thickness={20}
              centerValue={data.outstanding.toLocaleString("en-IN")}
              centerLabel="pts left"
              segments={[
                { label: "Earned", value: data.earned, tone: "leaf" },
                { label: "Redeemed", value: data.redeemed, tone: "terracotta" },
              ]}
            />
            <div className="mt-4 flex items-center gap-4">
              <GaugeRing
                value={Math.round((data.redeemed / Math.max(1, data.earned)) * 100)}
                tone="clay"
                label={<span>Redemption rate of earned points</span>}
              />
            </div>
          </div>
        </div>
      </Card>

      <p className="text-[11.5px] text-ng-ink-soft text-center mt-2 mb-2">
        Figures derived from sample data ({range.label}). Charts are hand-authored CSS/SVG — no chart libraries.
      </p>
    </AdminShell>
  );
}
