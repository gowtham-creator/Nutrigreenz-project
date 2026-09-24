"use client";

/**
 * Operator overview: what needs doing now.
 *
 * This is the staff screen, left open all day, and it answers one question
 * before any other. So it leads with the open-order queue and the payments to
 * chase, then how today is going against the same time yesterday, then the
 * latest orders. How the business is doing over weeks is the owner's question
 * and lives in Reports.
 *
 * Everything comes from the admin APIs: `/api/admin/reports` twice (all orders,
 * for the queue as it stands; and today in IST, for the pulse) and
 * `/api/admin/orders` for the feed. Degrades to empty states when Supabase is
 * unconfigured or the roster is fresh.
 */

import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import Link from "next/link";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { AdminStagger, AdminStaggerItem } from "@/components/ng/admin/admin-motion";
import { BellIcon } from "@/components/ui/bell-icon";
import { DonutChart, HBars, PAYMENT_TONE, Pipeline, STAGE_TONE, compareFigures } from "@/components/ng/admin/viz";
import { UiIcon } from "@/components/ui/ui-icon";

/* ── API shapes (JSON only — no server modules imported client-side) ─────── */
type OrderStatus = "placed" | "confirmed" | "packed" | "shipped" | "delivered";
type PaymentStatus = "pending" | "paid" | "failed";
type PillTone = "neutral" | "success" | "warn" | "danger" | "info";

interface StatusBreakdownEntry {
  status: OrderStatus;
  orders: number;
  revenuePaise: number;
}
interface PaymentBreakdownEntry {
  paymentStatus: PaymentStatus;
  orders: number;
  revenuePaise: number;
}
interface TopProductEntry {
  key: string;
  title: string;
  qty: number;
  revenuePaise: number;
}
interface AdminReport {
  revenuePaise: number;
  orderCount: number;
  aovPaise: number;
  unitsSold: number;
  paidRevenuePaise: number;
  pendingRevenuePaise: number;
  pendingOrderCount: number;
  failedRevenuePaise: number;
  failedOrderCount: number;
  statusBreakdown: StatusBreakdownEntry[];
  paymentBreakdown: PaymentBreakdownEntry[];
  topProducts: TopProductEntry[];
  newCustomers: number;
  previous: { revenuePaise: number; orderCount: number; aovPaise: number; newCustomers: number } | null;
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Today in IST as an instant range: midnight to now. The report measures the
 *  equal span before it, which is yesterday up to this same clock time. */
function todayWindow(): { from: string; to: string } {
  const now = Date.now();
  const istToday = new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
  const start = Date.parse(`${istToday}T00:00:00Z`) - IST_OFFSET_MS;
  return { from: new Date(start).toISOString(), to: new Date(now).toISOString() };
}

interface OrderItem {
  qty: number;
}
interface AdminOrderRow {
  id: string;
  orderNumber: string;
  userEmail: string | null;
  userPhone: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaise: number;
  addressSnapshot: Record<string, unknown> | null;
  items: OrderItem[];
  placedAt: string;
}

/* ── small display helpers ───────────────────────────────────────────────── */
const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

function customerName(o: AdminOrderRow): string {
  const snap = o.addressSnapshot;
  const raw =
    snap && typeof snap["name"] === "string"
      ? (snap["name"] as string)
      : snap && typeof snap["fullName"] === "string"
        ? (snap["fullName"] as string)
        : null;
  return raw?.trim() || o.userEmail || o.userPhone || "Guest";
}

function itemCount(o: AdminOrderRow): number {
  return o.items.reduce((n, it) => n + (it.qty ?? 0), 0);
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};
const STATUS_PILL: Record<OrderStatus, PillTone> = {
  placed: "warn",
  confirmed: "info",
  packed: "info",
  shipped: "success",
  delivered: "success",
};
/* The queue, as the next action each stage waits on. "Delivered" is not in it:
   it is the one stage with nothing left to do, so it is a footnote. */
const OPEN_STAGES: { status: Exclude<OrderStatus, "delivered">; label: string }[] = [
  { status: "placed", label: "To confirm" },
  { status: "confirmed", label: "To pack" },
  { status: "packed", label: "To ship" },
  { status: "shipped", label: "In transit" },
];

export default function AdminOverview() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [today, setToday] = useState<AdminReport | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    try {
      const t = todayWindow();
      const [rRes, tRes, oRes] = await Promise.all([
        fetch("/api/admin/reports", { cache: "no-store" }),
        fetch(`/api/admin/reports?${new URLSearchParams({ from: t.from, to: t.to, topLimit: "1" })}`, { cache: "no-store" }),
        fetch("/api/admin/orders?limit=8", { cache: "no-store" }),
      ]);
      if (rRes.ok) {
        const j = (await rRes.json()) as { report?: AdminReport };
        if (j.report) setReport(j.report);
      }
      if (tRes.ok) {
        const j = (await tRes.json()) as { report?: AdminReport };
        if (j.report) setToday(j.report);
      }
      if (oRes.ok) {
        const j = (await oRes.json()) as { orders?: AdminOrderRow[] };
        if (Array.isArray(j.orders)) setOrders(j.orders);
      }
    } catch {
      /* graceful — the page falls back to its empty state */
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * This screen is the one most likely to be left open on a second monitor all
   * day, which is precisely the case where a single mount fetch goes stale
   * without ever looking stale. The recent-orders list and the status rings
   * both come from endpoints that change every time somebody touches an order.
   */
  useLiveRefresh(() => void load({ quiet: true }), { intervalMs: 45_000 });

  const statusMap = new Map<OrderStatus, number>();
  for (const st of report?.statusBreakdown ?? []) statusMap.set(st.status, st.orders);

  const queue = OPEN_STAGES.map((st) => ({
    label: st.label,
    value: statusMap.get(st.status) ?? 0,
    tone: STAGE_TONE[st.status],
    href: "/admin/orders",
  }));
  const openOrders = queue.reduce((n, q) => n + q.value, 0);
  const delivered = statusMap.get("delivered") ?? 0;
  const pendingCount = report?.pendingOrderCount ?? 0;
  const failedCount = report?.failedOrderCount ?? 0;

  const topProducts = (report?.topProducts ?? []).slice(0, 5).map((p) => ({
    label: p.title,
    value: p.revenuePaise,
    hint: `${p.qty}u`,
  }));

  /** StatTile props for today against the same time yesterday. */
  const vsYesterday = (current: number, previous: number | undefined, fmt: (v: number) => string) => {
    if (previous === undefined) return {};
    const change = compareFigures(current, previous);
    if (!change) return { note: previous === 0 ? "none by this time yesterday" : undefined };
    return {
      delta: change.text,
      trend: change.direction,
      sentiment: change.sentiment,
      note: `vs ${fmt(previous)} by this time yesterday`,
    };
  };
  const num = (n: number) => n.toLocaleString("en-IN");

  const paidCount = report?.paymentBreakdown.find((p) => p.paymentStatus === "paid")?.orders ?? 0;
  const paymentSegments = (["paid", "pending", "failed"] as const).map((st) => ({
    label: st === "paid" ? "Paid" : st === "pending" ? "Pending" : "Failed",
    value: report?.paymentBreakdown.find((p) => p.paymentStatus === st)?.orders ?? 0,
    tone: PAYMENT_TONE[st],
  }));
  const recent = orders.slice(0, 6);

  return (
    <AdminShell
      active="/admin"
      title={
        <span>
          Operator <em className="italic text-ng-clay font-display">overview</em>
        </span>
      }
      subtitle="What needs doing now, and how today is going"
      actions={
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
        >
          <UiIcon name="reports" size={15} />
          Open reports
        </Link>
      }
    >
      {/* ── what needs doing ─────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card
          title="Open orders"
          action={
            <Link href="/admin/orders" className="text-[12px] font-semibold text-ng-forest hover:underline">
              Queue →
            </Link>
          }
        >
          {!report ? (
            <p className="py-8 text-center text-[13px] font-medium text-ng-ink-soft">{loading ? "Loading…" : "No orders yet."}</p>
          ) : (
            <>
              <Pipeline stages={queue} />
              <p className="mt-3 text-[12.5px] font-medium text-ng-ink-muted">
                {openOrders === 0
                  ? "Nothing waiting. "
                  : `${num(openOrders)} order${openOrders === 1 ? "" : "s"} in progress. `}
                {num(delivered)} delivered in all.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-ng-line-soft pt-4 text-center">
                <div>
                  <div className="font-display text-[20px] tabular-nums text-ng-forest-deep">{num(report.orderCount)}</div>
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">Orders</div>
                </div>
                <div>
                  <div className="font-display text-[20px] tabular-nums text-ng-success">{num(paidCount)}</div>
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">Paid</div>
                </div>
                <div>
                  <div className="font-display text-[20px] tabular-nums text-ng-clay">{num(pendingCount + failedCount)}</div>
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">Unpaid</div>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Money to chase. Pending and failed stay separate: a failed payment
            is not owed, it is an attempt that did not complete, and chasing it
            as a debt is the wrong conversation with a customer. */}
        <Card
          title="Payments"
          action={<span className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">by order</span>}
        >
          {report ? (
            <DonutChart
              size={150}
              thickness={20}
              segments={paymentSegments}
              centerValue={num(report.orderCount)}
              centerLabel="orders"
              className="mb-5"
            />
          ) : null}
          {!report ? (
            <p className="py-8 text-center text-[13px] font-medium text-ng-ink-soft">{loading ? "Loading…" : "No payments yet."}</p>
          ) : pendingCount + failedCount === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ng-success/12 text-ng-success">
                <UiIcon name="verified" size={17} />
              </span>
              <p className="text-[13px] font-medium text-ng-ink-muted">Every order is paid. Nothing to chase.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ng-line-soft">
              <li className="flex items-center gap-3 py-3 first:pt-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ng-cream">
                  <BellIcon size={17} animated={pendingCount > 0} className="shrink-0" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ng-ink">Awaiting payment</div>
                  <div className="text-[12.5px] font-medium text-ng-ink-muted">
                    {pendingCount > 0 ? `${rupees(report.pendingRevenuePaise)} owed` : "none"}
                  </div>
                </div>
                <span className="ml-auto font-display text-[22px] tabular-nums text-ng-forest-deep">{num(pendingCount)}</span>
              </li>
              <li className="flex items-center gap-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ng-terracotta/10 text-ng-terracotta">
                  <UiIcon name="caution" size={17} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ng-ink">Failed payments</div>
                  <div className="text-[12.5px] font-medium text-ng-ink-muted">
                    {failedCount > 0 ? `${rupees(report.failedRevenuePaise)} did not go through` : "none"}
                  </div>
                </div>
                <span className="ml-auto font-display text-[22px] tabular-nums text-ng-forest-deep">{num(failedCount)}</span>
              </li>
              <li className="pt-3">
                <Link href="/admin/orders" className="text-[12.5px] font-semibold text-ng-forest hover:text-ng-forest-deep hover:underline">
                  Open the triage queue →
                </Link>
              </li>
            </ul>
          )}
        </Card>
      </div>

      {/* ── today, against the same time yesterday ─────────────────────────
          Same clock time, not all of yesterday: at 11am, "today vs yesterday"
          would compare a morning with a whole day and always read as a fall.
          Staggered in reading order; entry only, see AdminStagger. */}
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted">Today so far</div>
      <AdminStagger className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStaggerItem>
          <StatTile
            label="Revenue"
            value={today ? rupees(today.revenuePaise) : "—"}
            {...(today ? vsYesterday(today.revenuePaise, today.previous?.revenuePaise, rupees) : {})}
          />
        </AdminStaggerItem>
        <AdminStaggerItem>
          <StatTile
            label="Orders"
            value={today ? num(today.orderCount) : "—"}
            {...(today ? vsYesterday(today.orderCount, today.previous?.orderCount, num) : {})}
          />
        </AdminStaggerItem>
        <AdminStaggerItem>
          <StatTile
            label="Average order"
            value={today && today.orderCount > 0 ? rupees(today.aovPaise) : "—"}
            {...(today && today.orderCount > 0 ? vsYesterday(today.aovPaise, today.previous?.aovPaise, rupees) : {})}
          />
        </AdminStaggerItem>
        <AdminStaggerItem>
          <StatTile
            label="New customers"
            value={today ? num(today.newCustomers) : "—"}
            {...(today ? vsYesterday(today.newCustomers, today.previous?.newCustomers, num) : {})}
          />
        </AdminStaggerItem>
      </AdminStagger>

      {/* ── all time ───────────────────────────────────────────────────────── */}
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted">All time</div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Revenue"
          value={report ? rupees(report.revenuePaise) : "—"}
          delta={report ? `${rupees(report.paidRevenuePaise)} settled` : undefined}
        />
        <StatTile
          label="Orders"
          value={report ? num(report.orderCount) : "—"}
          delta={report ? `${num(paidCount)} paid` : undefined}
        />
        <StatTile
          label="Avg order value"
          value={report ? rupees(report.aovPaise) : "—"}
          delta={report ? `${num(report.unitsSold)} units sold` : undefined}
        />
        <StatTile
          label="New customers"
          value={report ? num(report.newCustomers) : "—"}
          delta="since launch"
        />
      </div>

      {/* ── recent orders + top products ─────────────────────────────────── */}
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6">
        <Card
          title="Recent orders"
          action={<Link href="/admin/orders" className="text-[12px] font-semibold text-ng-forest hover:underline">Open queue →</Link>}
          className="!p-0"
        >
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.5fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-3 px-6 py-3 bg-ng-cream text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold border-b border-ng-line-soft">
            <span>Order</span>
            <span>Customer</span>
            <span className="text-right">Items</span>
            <span className="text-right">Total</span>
            <span>Status</span>
            <span className="text-right">When</span>
          </div>
          {loading ? (
            <p className="px-6 py-8 text-center text-[13px] font-medium text-ng-ink-soft">Loading orders…</p>
          ) : recent.length === 0 ? (
            <p className="px-6 py-8 text-center text-[13px] font-medium text-ng-ink-soft">No orders yet.</p>
          ) : (
            <ul>
              {recent.map((o) => (
                <li
                  key={o.id}
                  className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.5fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-3 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                >
                  <span className="font-mono text-[12px] font-semibold text-ng-forest-deep truncate">{o.orderNumber}</span>
                  <span className="truncate font-semibold text-ng-ink">{customerName(o)}</span>
                  <span className="font-mono text-[12px] font-medium tabular-nums text-ng-ink-muted text-right">{itemCount(o)}</span>
                  <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-ink text-right">{rupees(o.totalPaise)}</span>
                  <span><Pill tone={STATUS_PILL[o.status]}>{STATUS_LABEL[o.status]}</Pill></span>
                  <span className="text-[11.5px] font-medium text-ng-ink-soft text-right">{relativeTime(o.placedAt)}</span>
                </li>
              ))}
            </ul>
          )}
            </div>
          </div>
        </Card>

        <Card title="Top products" action={<span className="text-[11px] font-semibold text-ng-ink-muted uppercase tracking-wider">by revenue</span>}>
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-[13px] font-medium text-ng-ink-soft">
              {loading ? "Loading…" : "No product sales yet."}
            </p>
          ) : (
            <HBars rows={topProducts} tone="forest" formatValue={(v) => rupees(v)} />
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
