"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  customerContact,
  customerLabel,
  formatPaise,
  itemCount,
  ORDER_STATUS_FLOW,
  PAYMENT_LABEL,
  PAYMENT_TONE,
  relativeTime,
  STATUS_LABEL,
  STATUS_TONE,
  type Order,
  type OrderStatus,
} from "@/app/admin/orders/portal-data";

/** The first page of orders, fetched server-side and streamed in as HTML. */
export interface OrdersInitialData {
  orders: Order[];
  total: number;
}

/** Status filter chips: "all" plus each fulfilment stage. */
type StatusFilter = "all" | OrderStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All orders" },
  ...ORDER_STATUS_FLOW.map((s) => ({ key: s, label: STATUS_LABEL[s] })),
];

const COLS = "grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-4";

export function OrdersClient({ initialData }: { initialData: OrdersInitialData | null }) {
  const [orders, setOrders] = useState<Order[]>(initialData?.orders ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [loading, setLoading] = useState(initialData == null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // Skip the mount fetch when the server already streamed the first page in.
  // Any later filter/search change still triggers a normal debounced reload.
  const skipInitialLoad = useRef(initialData != null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "100");
    const res = await fetch(`/api/admin/orders?${params.toString()}`);
    const data = (await res.json()) as {
      ok: boolean;
      orders?: Order[];
      total?: number;
    };
    if (data.ok) {
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    let active = true;
    // Debounce filter/search changes; the loading flag is set inside the timer
    // (not synchronously in the effect body) to avoid cascading renders.
    const t = setTimeout(() => {
      if (!active) return;
      if (skipInitialLoad.current) {
        skipInitialLoad.current = false;
        return;
      }
      setLoading(true);
      void load().finally(() => {
        if (active) setLoading(false);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [load]);

  // Stat tiles from the current page (server is the source of truth for `total`).
  const stats = useMemo(() => {
    const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
    const pendingPay = orders.filter((o) => o.paymentStatus === "pending").length;
    return {
      placed: count("placed"),
      toPack: count("confirmed") + count("packed"),
      shipped: count("shipped"),
      pendingPay,
    };
  }, [orders]);

  return (
    <AdminShell
      active="/admin/orders"
      title="Orders"
      subtitle={`${total} order${total === 1 ? "" : "s"} · forward-only fulfilment pipeline`}
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors"
        >
          <Icon name="refresh-bold" size={15} className="text-ng-forest" />
          Refresh
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="New (placed)" value={String(stats.placed)} />
        <StatTile label="To pack" value={String(stats.toPack)} />
        <StatTile label="Shipped" value={String(stats.shipped)} />
        <StatTile label="Payment pending" value={String(stats.pendingPay)} />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-[12px] font-medium text-ng-ink-soft mr-2">Filter:</span>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[12px] transition-colors",
              statusFilter === f.key
                ? "bg-ng-forest-deep text-ng-cream font-semibold"
                : "bg-ng-paper border border-ng-line-soft text-ng-ink-muted font-medium hover:bg-ng-cream",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, email, phone…"
            className="rounded-full bg-ng-paper border border-ng-line-soft px-4 py-1.5 text-[12.5px] w-72 outline-none focus:border-ng-forest"
          />
        </div>
      </div>

      {/* Orders table */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
        <div
          className={cn(
            COLS,
            "px-5 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold",
          )}
        >
          <span>Order</span>
          <span>Customer</span>
          <span>Items</span>
          <span>Total</span>
          <span>Status</span>
          <span>Payment</span>
          <span />
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center text-[13px] font-medium text-ng-ink-muted">
            Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="px-5 py-14 text-center text-[13px] font-medium text-ng-ink-muted">
            No orders match this filter or search.
          </div>
        ) : (
          <ul>
            {orders.map((o) => (
              <li
                key={o.id}
                className={cn(
                  COLS,
                  "px-5 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors",
                )}
              >
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-[12.5px] text-ng-forest-deep truncate">
                    {o.orderNumber}
                  </div>
                  <div className="text-[11.5px] font-medium text-ng-ink-soft mt-0.5">
                    {relativeTime(o.placedAt)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ng-ink">{customerLabel(o)}</div>
                  <div className="text-[11.5px] font-medium text-ng-ink-muted truncate">
                    {customerContact(o) || "—"}
                  </div>
                </div>
                <span className="tabular-nums font-semibold text-ng-ink">{itemCount(o)}</span>
                <span className="font-semibold text-ng-ink tabular-nums">
                  {formatPaise(o.totalPaise)}
                </span>
                <span>
                  <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                </span>
                <span>
                  <Pill tone={PAYMENT_TONE[o.paymentStatus]}>
                    {PAYMENT_LABEL[o.paymentStatus]}
                  </Pill>
                </span>
                <Link
                  href={`/admin/orders/${o.orderNumber}`}
                  className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}
