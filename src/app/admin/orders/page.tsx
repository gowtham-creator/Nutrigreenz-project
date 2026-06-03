"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import {
  ADMIN_ORDERS,
  itemCount,
  lotsInBox,
  INR,
  STATUS_TONE,
  type AdminOrder,
  type OrderStatus,
} from "@/components/ng/admin/orders-data";

/** Filter chips → the set of statuses each chip matches. */
type FilterKey = "All" | "Paid" | "Packed" | "Shipped" | "Delivered" | "Refund req." | "Failed";

const FILTERS: { key: FilterKey; match: (s: OrderStatus) => boolean }[] = [
  { key: "All", match: () => true },
  { key: "Paid", match: (s) => s === "Paid" },
  { key: "Packed", match: (s) => s === "Packed" },
  { key: "Shipped", match: (s) => s === "Shipped" || s === "Out for delivery" },
  { key: "Delivered", match: (s) => s === "Delivered" },
  { key: "Refund req.", match: (s) => s === "Refund req." },
  { key: "Failed", match: (s) => s === "Payment failed" },
];

const COLS = "grid grid-cols-[1fr_1.4fr_2.4fr_0.7fr_0.9fr_1.1fr_1.1fr_0.6fr] gap-4";

function matchesSearch(o: AdminOrder, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    o.id.toLowerCase().includes(needle) ||
    o.customer.name.toLowerCase().includes(needle) ||
    o.address.community.toLowerCase().includes(needle) ||
    o.items.some((it) => it.lot.toLowerCase().includes(needle))
  );
}

export default function AdminOrders() {
  const [filter, setFilter] = useState<FilterKey>("All");
  const [query, setQuery] = useState("");

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const rows = useMemo(
    () => ADMIN_ORDERS.filter((o) => activeFilter.match(o.status) && matchesSearch(o, query)),
    [activeFilter, query],
  );

  // Stat tiles computed from data.
  const stats = useMemo(() => {
    const count = (pred: (s: OrderStatus) => boolean) => ADMIN_ORDERS.filter((o) => pred(o.status)).length;
    return {
      awaiting: count((s) => s === "Awaiting payment"),
      toPack: count((s) => s === "Paid" || s === "Packed"),
      outForDelivery: count((s) => s === "Out for delivery" || s === "Shipped"),
      refundQueue: count((s) => s === "Refund req."),
    };
  }, []);

  return (
    <AdminShell
      active="/admin/orders"
      title="Orders"
      subtitle={`Today · ${ADMIN_ORDERS.length} orders · ${stats.awaiting + stats.refundQueue} needing attention`}
      actions={
        <>
          <Link
            href="/admin/orders/bundles"
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors"
          >
            <Icon name="box-bold" size={15} className="text-ng-forest" />
            Community bundles
            <Icon name="arrow-right-linear" size={14} />
          </Link>
          <button className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors">
            Export
          </button>
          <button className="rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors">
            Create manual order
          </button>
        </>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Awaiting payment" value={String(stats.awaiting)} />
        <StatTile label="To pack" value={String(stats.toPack)} />
        <StatTile label="Out for delivery" value={String(stats.outForDelivery)} delta="on time" trend="up" />
        <StatTile label="Refund queue" value={String(stats.refundQueue)} delta="SLA 4h" trend="flat" />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-[12px] text-ng-ink-soft mr-2">Filter:</span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] transition-colors ${
              filter === f.key
                ? "bg-ng-forest-deep text-ng-cream font-semibold"
                : "bg-ng-paper border border-ng-line-soft text-ng-ink-muted hover:bg-ng-cream"
            }`}
          >
            {f.key}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order, customer, lot…"
            className="rounded-full bg-ng-paper border border-ng-line-soft px-4 py-1.5 text-[12.5px] w-72 outline-none focus:border-ng-forest"
          />
          <select className="rounded-full bg-ng-paper border border-ng-line-soft px-3 py-1.5 text-[12.5px] outline-none">
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Orders table */}
      <Card className="!p-0 overflow-hidden">
        <div
          className={`${COLS} px-5 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium`}
        >
          <span>Order</span>
          <span>Customer</span>
          <span>Lots in box</span>
          <span>Items</span>
          <span>Total</span>
          <span>Status</span>
          <span>Channel</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-14 text-center text-[13px] text-ng-ink-soft">
            No orders match this filter or search.
          </div>
        ) : (
          <ul>
            {rows.map((o) => (
              <li
                key={o.id}
                className={`${COLS} px-5 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors`}
              >
                <div>
                  <div className="font-mono text-[12.5px] text-ng-forest-deep">{o.id}</div>
                  <div className="text-[10.5px] text-ng-ink-soft mt-0.5">{o.placedAgo}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate">{o.customer.name}</div>
                  <div className="text-[11px] text-ng-ink-soft truncate">
                    {o.address.community} · {o.address.pincode}
                  </div>
                </div>
                <span className="text-[11.5px] font-mono text-ng-ink-muted truncate">{lotsInBox(o)}</span>
                <span className="tabular-nums">{itemCount(o)}</span>
                <span className="font-medium tabular-nums">{INR(o.total)}</span>
                <span>
                  <Pill tone={STATUS_TONE[o.status]}>{o.status}</Pill>
                </span>
                <span className="text-[11.5px] text-ng-ink-muted truncate">{o.channel}</span>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Bottom cards */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card title="Top failing payments">
          <ul className="space-y-3 text-[13px]">
            <li className="flex justify-between">
              <span>HDFC Credit · 3D-Secure timeout</span>
              <span className="text-ng-terracotta font-semibold">42%</span>
            </li>
            <li className="flex justify-between">
              <span>UPI · UPI ID typo</span>
              <span className="text-ng-terracotta font-semibold">28%</span>
            </li>
            <li className="flex justify-between">
              <span>ICICI Debit · insufficient funds</span>
              <span className="text-ng-terracotta font-semibold">16%</span>
            </li>
            <li className="flex justify-between">
              <span>Card · expired</span>
              <span className="text-ng-ink-muted font-semibold">14%</span>
            </li>
          </ul>
        </Card>
        <Card title="Refund SLA last 30d">
          <div className="font-display text-[44px] text-ng-forest-deep leading-none">3h 12m</div>
          <p className="text-[13px] text-ng-ink-muted mt-3">
            Avg time-to-resolution. Target: under 4h. 96% within SLA.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
