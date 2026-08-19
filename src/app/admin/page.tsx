"use client";

/**
 * Operator overview.
 *
 * Real dashboard: KPI tiles, the order pipeline, payment mix, top products and
 * the recent-orders feed all come from the admin APIs — `/api/admin/reports`
 * (aggregates over orders/order_items/customers) and `/api/admin/orders` (the
 * latest orders). The shared `StatTile` primitive is used for the KPI tiles so
 * sizing matches the rest of the console. Everything degrades gracefully to an
 * empty state when Supabase is unconfigured or the roster is fresh.
 */

import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import Link from "next/link";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { AdminStagger, AdminStaggerItem } from "@/components/ng/admin/admin-motion";
import { Icon } from "@/components/ui/icon";
import { BellIcon } from "@/components/ui/bell-icon";
import { DonutChart, HBars, Pipeline, type VizTone } from "@/components/ng/admin/viz";

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
  statusBreakdown: StatusBreakdownEntry[];
  paymentBreakdown: PaymentBreakdownEntry[];
  topProducts: TopProductEntry[];
  newCustomers: number;
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

const STATUS_FLOW: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered"];
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
const STATUS_TONE: Record<OrderStatus, VizTone> = {
  placed: "amber",
  confirmed: "leaf",
  packed: "blue",
  shipped: "clay",
  delivered: "forest",
};
const PAYMENT_ORDER: PaymentStatus[] = ["paid", "pending", "failed"];
const PAYMENT_LABEL: Record<PaymentStatus, string> = { paid: "Paid", pending: "Pending", failed: "Failed" };
/* `leaf` for paid, not `forest` — see the note in reports-client: forest is
   near-black at legend size and reads as an unlabelled dark marker. */
const PAYMENT_TONE: Record<PaymentStatus, VizTone> = { paid: "leaf", pending: "amber", failed: "terracotta" };

export default function AdminOverview() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    try {
      const [rRes, oRes] = await Promise.all([
        fetch("/api/admin/reports", { cache: "no-store" }),
        fetch("/api/admin/orders?limit=8", { cache: "no-store" }),
      ]);
      if (rRes.ok) {
        const j = (await rRes.json()) as { report?: AdminReport };
        if (j.report) setReport(j.report);
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
  for (const s of report?.statusBreakdown ?? []) statusMap.set(s.status, s.orders);
  const paymentMap = new Map<PaymentStatus, number>();
  for (const p of report?.paymentBreakdown ?? []) paymentMap.set(p.paymentStatus, p.orders);

  const orderCount = report?.orderCount ?? 0;
  const paidOrders = paymentMap.get("paid") ?? 0;
  const needAttention = (paymentMap.get("pending") ?? 0) + (paymentMap.get("failed") ?? 0);

  const pipeline = STATUS_FLOW.map((s) => ({
    label: STATUS_LABEL[s],
    value: statusMap.get(s) ?? 0,
    tone: STATUS_TONE[s],
  }));
  const paymentSegments = PAYMENT_ORDER.map((p) => ({
    label: PAYMENT_LABEL[p],
    value: paymentMap.get(p) ?? 0,
    tone: PAYMENT_TONE[p],
  }));
  const topProducts = (report?.topProducts ?? []).slice(0, 5).map((p) => ({
    label: p.title,
    value: p.revenuePaise,
    hint: `${p.qty}u`,
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
      subtitle="Live metrics from production: orders, revenue and fulfilment"
      actions={
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
        >
          <Icon name="chart-2-bold" size={15} />
          Open reports
        </Link>
      }
    >
      {/* ── attention banner (only when there is something to triage) ─────── */}
      {needAttention > 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-ng-forest/[0.05] border border-ng-forest/15 px-5 py-3.5">
          {/* Neutral forest surface; the gold bell is the single gold accent. */}
          <span className="size-8 rounded-full bg-ng-cream flex items-center justify-center shrink-0">
            <BellIcon size={17} animated className="shrink-0" />
          </span>
          <p className="text-[13px] font-medium text-ng-ink">
            <span className="font-semibold text-ng-forest-deep tabular-nums">{needAttention} order{needAttention === 1 ? "" : "s"}</span>{" "}
            {needAttention === 1 ? "is" : "are"} awaiting or failed payment and need review.
          </p>
          <Link href="/admin/orders" className="ml-auto shrink-0 text-[12.5px] font-semibold text-ng-forest hover:text-ng-forest-deep hover:underline">
            Triage queue →
          </Link>
        </div>
      ) : null}

      {/* ── KPI tiles (shared StatTile primitive) ────────────────────────── */}
      {/* Staggered so the eye is led across the row in reading order rather
          than four tiles landing at once. Entry only — see AdminStagger. */}
      <AdminStagger className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <AdminStaggerItem>
          <StatTile
            label="Revenue"
            value={report ? rupees(report.revenuePaise) : "—"}
            delta={report ? `${rupees(report.paidRevenuePaise)} settled` : undefined}
          />
        </AdminStaggerItem>
        <AdminStaggerItem>
          <StatTile
            label="Orders"
            value={report ? orderCount.toLocaleString("en-IN") : "—"}
            delta={report ? `${paidOrders.toLocaleString("en-IN")} paid` : undefined}
          />
        </AdminStaggerItem>
        <AdminStaggerItem>
          <StatTile
            label="Avg order value"
            value={report ? rupees(report.aovPaise) : "—"}
            delta={report ? `${report.unitsSold.toLocaleString("en-IN")} units sold` : undefined}
          />
        </AdminStaggerItem>
        <AdminStaggerItem>
          <StatTile
            label="New customers"
            value={report ? report.newCustomers.toLocaleString("en-IN") : "—"}
            delta="in this period"
          />
        </AdminStaggerItem>
      </AdminStagger>

      {/* ── pipeline + payment mix ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 mb-6">
        <Card title="Order pipeline" action={<Link href="/admin/orders" className="text-[12px] font-semibold text-ng-forest hover:underline">Queue →</Link>}>
          <Pipeline stages={pipeline} />
          <div className="mt-5 pt-4 border-t border-ng-line-soft grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="font-display text-[20px] text-ng-forest-deep tabular-nums">{orderCount.toLocaleString("en-IN")}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mt-0.5">Orders</div>
            </div>
            <div>
              <div className="font-display text-[20px] text-ng-success tabular-nums">{paidOrders.toLocaleString("en-IN")}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mt-0.5">Paid</div>
            </div>
            <div>
              <div className="font-display text-[20px] text-ng-clay tabular-nums">{needAttention.toLocaleString("en-IN")}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mt-0.5">Unpaid</div>
            </div>
          </div>
        </Card>

        <Card title="Payments" action={<span className="text-[11px] font-semibold text-ng-ink-muted uppercase tracking-wider">by order</span>}>
          <DonutChart
            segments={paymentSegments}
            centerValue={orderCount.toLocaleString("en-IN")}
            centerLabel="orders"
          />
        </Card>
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
