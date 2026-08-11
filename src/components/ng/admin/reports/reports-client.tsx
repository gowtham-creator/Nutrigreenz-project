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
import { VisitorPlaces } from "@/components/ng/admin/reports/visitor-places";
import { AdminShell, Card, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { DonutChart, HBars, type VizTone } from "@/components/ng/admin/viz";
import {
  PAYMENT_LABEL,
  STATUS_LABEL,
  type OrderStatus,
  type PaymentStatus,
} from "@/app/admin/orders/portal-data";
import type { AdminReport } from "@/lib/reports";
import { downloadCsv, downloadCsvBundle, type CsvRow } from "@/components/ng/admin/reports/csv";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Integer paise → a whole-rupee "₹1,23,456" string. */
const INR = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
/** Integer paise → whole rupees as a number (for CSV cells). */
const rupees = (paise: number) => Math.round(paise / 100);

const STATUS_TONE: Record<OrderStatus, VizTone> = {
  placed: "amber",
  confirmed: "blue",
  packed: "clay",
  shipped: "leaf",
  delivered: "forest",
};

const PAYMENT_TONE: Record<PaymentStatus, VizTone> = {
  pending: "amber",
  paid: "forest",
  failed: "terracotta",
};

const DATE_RANGES = [
  { id: "all", label: "All time", days: null },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "7", label: "Last 7 days", days: 7 },
] as const;
type RangeId = (typeof DATE_RANGES)[number]["id"];

/** A date-only (YYYY-MM-DD) `from`/`to` window for the selected range. */
function rangeWindow(days: number | null): { from: string | null; to: string | null } {
  if (days == null) return { from: null, to: null };
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/* section header inline Export button ------------------------------- */

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

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeWindow(range.days);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/reports?${params.toString()}`);
    const data = (await res.json()) as { ok: boolean; report?: AdminReport };
    if (data.ok && data.report) setReport(data.report);
    setLoading(false);
  }, [range.days]);

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
      { Metric: "Revenue (INR)", Value: rupees(r.revenuePaise) },
      { Metric: "Paid revenue (INR)", Value: rupees(r.paidRevenuePaise) },
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

  const exportAll = () => {
    if (!report) return;
    const sm = summaryCsv(report);
    const st = statusCsv(report);
    const pm = paymentCsv(report);
    const pr = productsCsv(report);
    const cp = couponsCsv(report);
    downloadCsvBundle(`nutrigreenz-reports-${range.id}`, [
      { title: `Summary (${range.label})`, rows: sm.rows, headers: sm.headers },
      { title: "Orders by status", rows: st.rows, headers: st.headers },
      { title: "Orders by payment", rows: pm.rows, headers: pm.headers },
      { title: "Top products by revenue", rows: pr.rows, headers: pr.headers },
      { title: "Coupon usage", rows: cp.rows, headers: cp.headers },
    ]);
  };

  /* ----------------------------------------------------------------- */

  const hasOrders = (report?.orderCount ?? 0) > 0;

  return (
    <AdminShell
      active="/admin/reports"
      title={
        <span>
          Reports <em className="italic text-ng-clay font-display">&amp; analytics</em>
        </span>
      }
      subtitle="Revenue, fulfilment, products & coupons — computed live from real orders"
      actions={
        <>
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
            disabled={!report}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="file-download-bold" size={15} />
            Export all
          </button>
        </>
      }
    >
      {!report ? (
        <div className="rounded-2xl bg-ng-paper border border-ng-line-soft p-10 text-center text-[13px] font-medium text-ng-ink-muted">
          {loading ? "Loading report…" : "No report available."}
        </div>
      ) : (
        <>
          {/* Headline KPIs ------------------------------------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatTile label="Revenue" value={INR(report.revenuePaise)} delta={`${INR(report.paidRevenuePaise)} paid`} trend="up" />
            <StatTile label="Orders" value={report.orderCount.toLocaleString("en-IN")} delta={`AOV ${INR(report.aovPaise)}`} trend="up" />
            <StatTile label="Units sold" value={report.unitsSold.toLocaleString("en-IN")} delta="items shipped in range" trend="up" />
            <StatTile label="New customers" value={report.newCustomers.toLocaleString("en-IN")} delta="joined in range" trend="up" />
          </div>

          {/* 1 · ORDERS BY STATUS & PAYMENT -------------------------- */}
          <Card
            title="Orders · status & payment"
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
                <div className="text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">By fulfilment status</div>
                <DonutChart
                  size={150}
                  thickness={20}
                  centerValue={report.orderCount.toLocaleString("en-IN")}
                  centerLabel="orders"
                  segments={report.statusBreakdown.map((s) => ({
                    label: STATUS_LABEL[s.status],
                    value: s.orders,
                    tone: STATUS_TONE[s.status],
                  }))}
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">By payment status</div>
                <DonutChart
                  size={150}
                  thickness={20}
                  centerValue={INR(report.paidRevenuePaise)}
                  centerLabel="paid"
                  segments={report.paymentBreakdown.map((p) => ({
                    label: PAYMENT_LABEL[p.paymentStatus],
                    value: p.orders,
                    tone: PAYMENT_TONE[p.paymentStatus],
                  }))}
                />
              </div>
            </div>

            <div className="text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold mb-3">Revenue by status</div>
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
              <div className="py-8 text-center text-[13px] font-medium text-ng-ink-muted">
                No product sales in this range yet.
              </div>
            ) : (
              <HBars
                tone="leaf"
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
              <StatTile label="Redemptions" value={couponTotals.redemptions.toLocaleString("en-IN")} delta="orders with a coupon" trend="up" />
              <StatTile label="Discount given" value={INR(couponTotals.discountPaise)} delta="across all coupons" trend="flat" />
              <StatTile label="Codes used" value={couponTotals.codes.toLocaleString("en-IN")} delta="distinct coupons" trend="flat" />
            </div>

            {report.couponUsage.length === 0 ? (
              <div className="py-8 text-center text-[13px] font-medium text-ng-ink-muted">
                No coupons were redeemed in this range.
              </div>
            ) : (
              <div className="rounded-2xl border border-ng-line-soft overflow-hidden">
                <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-3 px-4 py-2.5 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
                  <span>Code</span>
                  <span className="text-right">Redeemed</span>
                  <span className="text-right">Discount given</span>
                </div>
                <ul>
                  {report.couponUsage.map((c) => (
                    <li
                      key={c.code}
                      className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-3 px-4 py-3 items-center text-[12.5px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                    >
                      <span className="font-mono text-[12px] font-semibold text-ng-ink truncate">{c.code}</span>
                      <span className="font-mono text-[12px] tabular-nums font-medium text-ng-ink-muted text-right">{c.orders}</span>
                      <span className="font-mono text-[12px] tabular-nums text-ng-forest-deep font-semibold text-right">{INR(c.discountPaise)}</span>
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

          <p className="text-[11.5px] font-medium text-ng-ink-soft text-center mt-2 mb-2">
            {hasOrders
              ? `Figures computed live from real orders (${range.label}). Charts are hand-authored CSS/SVG — no chart libraries.`
              : `No orders in this range yet. Charts are hand-authored CSS/SVG — no chart libraries.`}
          </p>
        </>
      )}
    </AdminShell>
  );
}
