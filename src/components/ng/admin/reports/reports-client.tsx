"use client";

/**
 * Reports & Analytics.
 *
 * Every figure on this page is real: it is driven entirely by
 * `GET /api/admin/reports`, which aggregates `public.orders` /
 * `public.order_items` / `public.customers` / coupon usage. There is no mock
 * data source. Money is integer paise throughout; the range selector re-queries
 * the API with a `from`/`to` window. Charts are the hand-authored CSS/SVG viz
 * primitives — no chart libraries. Each section can export its data as CSV.
 *
 * The default "All time" report is computed SERVER-SIDE by the route segment
 * (`src/app/admin/reports/page.tsx`) and streamed in as `initialReport`, so the
 * dashboard paints with real numbers in the initial HTML. Selecting a different
 * date range still re-queries the admin-gated API exactly as before. When
 * `initialReport` is null (the rare server-side error path) the component falls
 * back to its original mount fetch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { VisitorPlaces } from "@/components/ng/admin/reports/visitor-places";
import { AdminShell, Card, StatTile } from "@/components/ng/admin/admin-shell";
import { UiIcon } from "@/components/ui/ui-icon";
import {
  AreaChart,
  DonutChart,
  HBars,
  PAYMENT_TONE,
  STAGE_TONE,
  ShareBar,
  TrendChip,
  compareFigures,
} from "@/components/ng/admin/viz";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/app/admin/orders/portal-data";
import type { AdminReport } from "@/lib/reports";
import { downloadCsv, downloadCsvBundle, type CsvRow } from "@/components/ng/admin/reports/csv";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Integer paise → a whole-rupee "₹1,23,456" string. */
const INR = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const NUM = (n: number) => n.toLocaleString("en-IN");
/** Integer paise → whole rupees as a number (for CSV cells). */
const rupees = (paise: number) => Math.round(paise / 100);

const DATE_RANGES = [
  { id: "all", label: "All time", days: null },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "7", label: "Last 7 days", days: 7 },
] as const;
type RangeId = (typeof DATE_RANGES)[number]["id"];

const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * The selected range as exact instants: IST midnight `days - 1` days ago, up
 * to now. "Last 7 days" is today and the six before it, as an operator in
 * Hyderabad counts them.
 *
 * These were UTC calendar dates, so an order placed at 1am IST landed in
 * yesterday's bucket. Sending instants also lets the report compare against
 * the period just before, which needs both ends of the range to be real.
 */
function rangeWindow(days: number | null): { from: string | null; to: string | null } {
  if (days == null) return { from: null, to: null };
  const now = Date.now();
  const istToday = new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
  const startMs = Date.parse(`${istToday}T00:00:00Z`) - IST_OFFSET_MS - (days - 1) * 86_400_000;
  return { from: new Date(startMs).toISOString(), to: new Date(now).toISOString() };
}

/** "2026-09-24" → "24 Sep", for axis labels and read-outs. */
function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/* section header inline Export button ------------------------------- */

function ExportButton({ onClick, label = "Export CSV" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-3 py-1.5 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
    >
      <UiIcon name="export" size={14} className="text-ng-forest" />
      {label}
    </button>
  );
}

/* ================================================================== */
/* PAGE                                                                */
/* ================================================================== */

export function ReportsClient({ initialReport }: { initialReport: AdminReport | null }) {
  const [rangeId, setRangeId] = useState<RangeId>("all");
  const [report, setReport] = useState<AdminReport | null>(initialReport);
  const [loading, setLoading] = useState(initialReport == null);

  // Skip the mount fetch when the server already streamed the "All time" report
  // in. Selecting a different range still triggers a normal reload.
  const skipInitialLoad = useRef(initialReport != null);

  const range = DATE_RANGES.find((r) => r.id === rangeId)!;

  const load = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      // A background refresh must not blank the page it is refreshing: the
      // loading flag swaps the report for skeletons, which is right when the
      // operator asked for a different range and wrong when nobody asked for
      // anything.
      if (!quiet) setLoading(true);
      const { from, to } = rangeWindow(range.days);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      // no-store: this is a figure an operator acts on, and a status changed
      // thirty seconds ago must not come back from the browser's cache.
      const res = await fetch(`/api/admin/reports?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { ok: boolean; report?: AdminReport };
      if (data.ok && data.report) setReport(data.report);
      if (!quiet) setLoading(false);
    },
    [range.days],
  );

  useEffect(() => {
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false;
      return;
    }
    // Intentional data-fetch effect: re-query the report when the selected date
    // range changes. `load` flips a loading flag before awaiting the API — that
    // synchronous setState is the purpose of the effect, not a cascading-render
    // bug — so this single rule is scoped off here (behavior is unchanged from
    // the original page's effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Follow the orders table: re-query on tab focus and on a slow poll, so
  // marking an order delivered in the next tab is reflected here without a
  // reload. Quiet, so the figures update in place rather than flashing back to
  // skeletons under the operator.
  useLiveRefresh(() => void load({ quiet: true }));

  /* derived coupon totals (memoised) -------------------------------- */
  const couponTotals = useMemo(() => {
    const rows = report?.couponUsage ?? [];
    return {
      redemptions: rows.reduce((s, c) => s + c.orders, 0),
      discountPaise: rows.reduce((s, c) => s + c.discountPaise, 0),
      codes: rows.length,
    };
  }, [report]);

  /* per-section CSV builders ---------------------------------------- */
  const summaryCsv = (r: AdminReport): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Metric", "Value"],
    rows: [
      { Metric: "Revenue booked (INR)", Value: rupees(r.revenuePaise) },
      { Metric: "Collected (INR)", Value: rupees(r.paidRevenuePaise) },
      { Metric: "Collected orders", Value: r.paidOrderCount },
      /* The export has to carry the same figures as the screen. An operator who
         exports to chase payments and finds no pending column would have to go
         back and read them off the page by hand. */
      { Metric: "Pending collection (INR)", Value: rupees(r.pendingRevenuePaise) },
      { Metric: "Pending orders", Value: r.pendingOrderCount },
      { Metric: "Failed payments (INR)", Value: rupees(r.failedRevenuePaise) },
      { Metric: "Failed payment attempts", Value: r.failedOrderCount },
      { Metric: "Orders", Value: r.orderCount },
      { Metric: "Average order value (INR)", Value: rupees(r.aovPaise) },
      { Metric: "Units sold", Value: r.unitsSold },
      { Metric: "New customers", Value: r.newCustomers },
    ],
  });

  const statusCsv = (r: AdminReport): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Status", "Orders", "Revenue (INR)"],
    rows: r.statusBreakdown.map((s) => ({
      Status: STATUS_LABEL[s.status],
      Orders: s.orders,
      "Revenue (INR)": rupees(s.revenuePaise),
    })),
  });

  const paymentCsv = (r: AdminReport): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Payment status", "Orders", "Revenue (INR)"],
    rows: r.paymentBreakdown.map((p) => ({
      "Payment status": PAYMENT_LABEL[p.paymentStatus],
      Orders: p.orders,
      "Revenue (INR)": rupees(p.revenuePaise),
    })),
  });

  const productsCsv = (r: AdminReport): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Product", "SKU", "Units", "Revenue (INR)"],
    rows: r.topProducts.map((p) => ({
      Product: p.title,
      SKU: p.variantSku ?? "",
      Units: p.qty,
      "Revenue (INR)": rupees(p.revenuePaise),
    })),
  });

  const couponsCsv = (r: AdminReport): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Code", "Orders", "Discount given (INR)"],
    rows: r.couponUsage.map((c) => ({
      Code: c.code,
      Orders: c.orders,
      "Discount given (INR)": rupees(c.discountPaise),
    })),
  });

  const dailyCsv = (r: AdminReport): { rows: CsvRow[]; headers: string[] } => ({
    headers: ["Day (IST)", "Orders", "Revenue (INR)", "Previous period (INR)"],
    rows: r.dailyRevenue.map((d, i) => ({
      "Day (IST)": d.day,
      Orders: d.orders,
      "Revenue (INR)": rupees(d.revenuePaise),
      "Previous period (INR)": r.previous ? rupees(r.previous.dailyRevenue[i]?.revenuePaise ?? 0) : "",
    })),
  });

  const exportAll = () => {
    if (!report) return;
    const sm = summaryCsv(report);
    const st = statusCsv(report);
    const pm = paymentCsv(report);
    const pr = productsCsv(report);
    const cp = couponsCsv(report);
    downloadCsvBundle(`nutrigreenz-reports-${range.id}`, [
      { title: `Summary (${range.label})`, rows: sm.rows, headers: sm.headers },
      { title: "Revenue by day", rows: dailyCsv(report).rows, headers: dailyCsv(report).headers },
      { title: "Orders by status", rows: st.rows, headers: st.headers },
      { title: "Orders by payment", rows: pm.rows, headers: pm.headers },
      { title: "Top products by revenue", rows: pr.rows, headers: pr.headers },
      { title: "Coupon usage", rows: cp.rows, headers: cp.headers },
    ]);
  };

  /* ----------------------------------------------------------------- */

  const hasOrders = (report?.orderCount ?? 0) > 0;
  const prev = report?.previous ?? null;
  const periodDays = report?.dailyRevenue.length ?? 0;
  const firstDay = report?.dailyRevenue[0]?.day ?? null;
  const revenueChange = report ? compareFigures(report.revenuePaise, prev?.revenuePaise) : null;
  const bestDay = (report?.dailyRevenue ?? []).reduce<{ day: string; revenuePaise: number } | null>(
    (best, d) => (d.revenuePaise > (best?.revenuePaise ?? 0) ? d : best),
    null,
  );

  /** StatTile comparison props for one KPI: a real change when there is a
   *  previous period to measure against, plain context when there is not. */
  const kpi = (current: number, previous: number | undefined, fmt: (v: number) => string) => {
    // All time: no comparison, and no caption repeating the range selector.
    if (previous === undefined) return {};
    const change = compareFigures(current, previous);
    if (!change) return { note: `none in the previous ${periodDays} days` };
    return {
      delta: change.text,
      trend: change.direction,
      sentiment: change.sentiment,
      note: `vs ${fmt(previous)} previous ${periodDays} days`,
    };
  };

  return (
    <AdminShell
      active="/admin/reports"
      title={
        <span>
          Reports <em className="italic text-ng-clay font-display">&amp; analytics</em>
        </span>
      }
      subtitle="Revenue, fulfilment, products and coupons, calculated live from orders"
      actions={
        <>
          {/* Visible on phones too. It was `hidden sm:flex`, so on a phone the
              report was stuck on "All time" with no way to change it; now the
              pills scroll sideways when they do not fit. */}
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-ng-line-soft bg-ng-paper p-1 [scrollbar-width:none]">
            {DATE_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeId(r.id)}
                aria-pressed={rangeId === r.id}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors cursor-pointer ${
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
            disabled={!report}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[13.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UiIcon name="export" size={15} />
            Export all
          </button>
        </>
      }
    >
      {!report ? (
        <div className="rounded-2xl bg-ng-paper border border-ng-line-soft p-10 text-center text-[14px] font-medium text-ng-ink-muted">
          {loading ? "Loading report…" : "No report available."}
        </div>
      ) : (
        <>
          {/* REVENUE ------------------------------------------------------
              The owner's question first: how much, which way it is moving,
              and how much of it has actually landed. One card, read top to
              bottom, instead of seven tiles the reader has to add up. */}
          <Card
            title="Revenue"
            className="mb-6"
            action={
              <div className="flex items-center gap-3">
                <ExportButton
                  label="Daily CSV"
                  onClick={() => {
                    const d = dailyCsv(report);
                    downloadCsv(`revenue-by-day-${range.id}`, d.rows, d.headers);
                  }}
                />
              </div>
            }
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-[34px] leading-none tracking-[-0.02em] tabular-nums text-ng-forest-deep">
                    {INR(report.revenuePaise)}
                  </span>
                  {revenueChange ? (
                    <TrendChip
                      delta={revenueChange.text}
                      direction={revenueChange.direction}
                      sentiment={revenueChange.sentiment}
                    />
                  ) : null}
                </div>
                <p className="mt-2 text-[12.5px] font-medium text-ng-ink-soft">
                  {prev
                    ? `Booked, against ${INR(prev.revenuePaise)} in the previous ${periodDays} days`
                    : firstDay
                      ? `Booked since ${dayLabel(firstDay)}, the first order`
                      : "Nothing booked yet"}
                </p>
              </div>
              {/* Three facts the line cannot state exactly on its own. */}
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ng-ink-soft">Best day</dt>
                  <dd className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-ng-forest-deep">
                    {bestDay ? INR(bestDay.revenuePaise) : "—"}
                    {bestDay ? (
                      <span className="ml-1.5 font-sans text-[11.5px] font-medium text-ng-ink-soft">{dayLabel(bestDay.day)}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ng-ink-soft">Daily average</dt>
                  <dd className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-ng-forest-deep">
                    {periodDays > 0 ? INR(report.revenuePaise / periodDays) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ng-ink-soft">Average order</dt>
                  <dd className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-ng-forest-deep">
                    {report.orderCount > 0 ? INR(report.aovPaise) : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            {hasOrders || (prev?.revenuePaise ?? 0) > 0 ? (
              <AreaChart
                label={`Revenue by day, ${range.label.toLowerCase()}`}
                height={240}
                labels={report.dailyRevenue.map((d) => dayLabel(d.day))}
                formatY={(v) => INR(v)}
                annotatePeak
                series={[
                  { name: "This period", data: report.dailyRevenue.map((d) => d.revenuePaise), tone: "forest" },
                  ...(prev
                    ? [
                        {
                          name: `Previous ${periodDays} days`,
                          data: prev.dailyRevenue.map((d) => d.revenuePaise),
                          tone: "compare" as const,
                          variant: "compare" as const,
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <p className="rounded-xl bg-ng-line-soft/50 px-5 py-10 text-center text-[13px] font-medium text-ng-ink-muted">
                No orders in this range, so there is no trend to draw yet. Try a longer range.
              </p>
            )}

            {/* Of the revenue booked: what landed, what is still owed, what
                bounced. Pending and failed stay apart, so nobody chases a
                payment that already failed. */}
            <div className="mt-6 border-t border-ng-line-soft pt-5">
              <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted">Collection</div>
              <ShareBar
                formatValue={(v) => INR(v)}
                parts={[
                  {
                    label: "Collected",
                    value: report.paidRevenuePaise,
                    tone: "paid",
                    note: `${NUM(report.paidOrderCount)} order${report.paidOrderCount === 1 ? "" : "s"} settled`,
                  },
                  {
                    label: "Pending",
                    value: report.pendingRevenuePaise,
                    tone: "pending",
                    note:
                      report.pendingOrderCount > 0
                        ? `${NUM(report.pendingOrderCount)} awaiting payment`
                        : "nothing outstanding",
                  },
                  {
                    label: "Failed",
                    value: report.failedRevenuePaise,
                    tone: "failed",
                    note: `${NUM(report.failedOrderCount)} attempt${report.failedOrderCount === 1 ? "" : "s"} failed`,
                  },
                ]}
              />
            </div>
          </Card>

          {/* The four counts that explain the revenue, each against the
              previous period when there is one. No arrow without a
              comparison behind it. */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Orders" value={NUM(report.orderCount)} {...kpi(report.orderCount, prev?.orderCount, NUM)} />
            <StatTile label="Average order" value={INR(report.aovPaise)} {...kpi(report.aovPaise, prev?.aovPaise, INR)} />
            <StatTile label="Units sold" value={NUM(report.unitsSold)} {...kpi(report.unitsSold, prev?.unitsSold, NUM)} />
            <StatTile label="New customers" value={NUM(report.newCustomers)} {...kpi(report.newCustomers, prev?.newCustomers, NUM)} />
          </div>

          {/* 1 · ORDERS BY STATUS & PAYMENT -------------------------- */}
          <Card
            title="Orders by status and payment"
            action={
              <div className="flex items-center gap-2">
                <ExportButton label="Status CSV" onClick={() => { const s = statusCsv(report); downloadCsv(`orders-status-${range.id}`, s.rows, s.headers); }} />
                <ExportButton label="Payment CSV" onClick={() => { const p = paymentCsv(report); downloadCsv(`orders-payment-${range.id}`, p.rows, p.headers); }} />
              </div>
            }
            className="mb-6"
          >
            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">By fulfilment status</div>
                <DonutChart
                  size={150}
                  thickness={20}
                  centerValue={report.orderCount.toLocaleString("en-IN")}
                  centerLabel="orders"
                  segments={report.statusBreakdown.map((s) => ({
                    label: STATUS_LABEL[s.status],
                    value: s.orders,
                    tone: STAGE_TONE[s.status],
                  }))}
                />
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">By payment status</div>
                <DonutChart
                  size={150}
                  thickness={20}
                  centerValue={NUM(report.orderCount)}
                  centerLabel="orders"
                  segments={report.paymentBreakdown.map((p) => ({
                    label: PAYMENT_LABEL[p.paymentStatus],
                    value: p.orders,
                    tone: PAYMENT_TONE[p.paymentStatus],
                  }))}
                />
              </div>
            </div>

            <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Revenue by status</div>
            <HBars
              tone="forest"
              formatValue={(v) => INR(v)}
              rows={report.statusBreakdown.map((s) => ({
                label: STATUS_LABEL[s.status],
                value: s.revenuePaise,
                hint: `${s.orders} ord`,
              }))}
            />
          </Card>

          {/* 2 · TOP PRODUCTS ---------------------------------------- */}
          <Card
            title="Top products by revenue"
            action={<ExportButton onClick={() => { const p = productsCsv(report); downloadCsv(`top-products-${range.id}`, p.rows, p.headers); }} />}
            className="mb-6"
          >
            {report.topProducts.length === 0 ? (
              <div className="py-8 text-center text-[14px] font-medium text-ng-ink-muted">
                No product sales in this range yet.
              </div>
            ) : (
              <HBars
                /* forest, not leaf: at #66BF73 on a #EFEFE8 track the filled
                   and empty halves of a bar sit close enough in value that the
                   boundary — the only thing the chart encodes — goes soft. */
                tone="forest"
                formatValue={(v) => INR(v)}
                rows={report.topProducts.map((p) => ({
                  label: p.title,
                  value: p.revenuePaise,
                  hint: `${p.qty}u`,
                }))}
              />
            )}
          </Card>

          {/* 3 · COUPONS --------------------------------------------- */}
          <Card
            title="Coupon usage"
            action={<ExportButton onClick={() => { const c = couponsCsv(report); downloadCsv(`coupons-${range.id}`, c.rows, c.headers); }} />}
            className="mb-6"
          >
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <StatTile label="Redemptions" value={NUM(couponTotals.redemptions)} delta="orders with a coupon" />
              <StatTile label="Discount given" value={INR(couponTotals.discountPaise)} delta="across all coupons" />
              <StatTile label="Codes used" value={NUM(couponTotals.codes)} delta="distinct coupons" />
            </div>

            {report.couponUsage.length === 0 ? (
              <div className="py-8 text-center text-[14px] font-medium text-ng-ink-muted">
                No coupons were redeemed in this range.
              </div>
            ) : (
              <div className="rounded-2xl border border-ng-line-soft overflow-hidden">
                {/* px-6, matching the customers table.
                    px-4 put the text at 16px from the edge on a container with
                    a 16px corner radius — so "Code" began at exactly the x
                    where the rounded corner stops curving, and the right-hand
                    figure ended there. Content needs to clear the arc, not
                    start on it. */}
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold">
                  <span>Code</span>
                  <span className="text-right">Redeemed</span>
                  <span className="text-right">Discount given</span>
                </div>
                <ul>
                  {report.couponUsage.map((c) => (
                    <li
                      key={c.code}
                      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-4 px-6 py-3.5 items-center text-[13.5px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                    >
                      <span className="font-mono text-[13px] font-semibold text-ng-ink truncate">{c.code}</span>
                      <span className="font-mono text-[13px] tabular-nums font-medium text-ng-ink-muted text-right">{c.orders}</span>
                      <span className="font-mono text-[13px] tabular-nums text-ng-forest-deep font-semibold text-right">{INR(c.discountPaise)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Visitors by place. Sits outside the orders block on purpose: it is
              recorded for everyone who browses, so it stays useful in a range
              with no orders at all — which is exactly when knowing where the
              interest came from matters most. */}
          <div className="mt-6">
            <VisitorPlaces places={report.visitorPlaces} total={report.visitorTotal} />
          </div>

          <p className="text-[12.5px] font-medium text-ng-ink-soft text-center mt-2 mb-2">
            {hasOrders
              ? `Calculated live from orders · ${range.label} · days in IST`
              : `No orders in this range yet · ${range.label}`}
          </p>
        </>
      )}
    </AdminShell>
  );
}
