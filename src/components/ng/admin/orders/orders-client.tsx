"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { PERIOD_LABEL, periodRangeLabel, periodWindows, type SummaryPeriod } from "@/lib/order-periods";
import type { OrderSummary } from "@/lib/order-summary";
import { OrderSummaryPanel } from "@/components/ng/admin/orders/order-summary-panel";
import {
  DeliverySlotsManager,
  type ManagedSlot,
} from "@/components/ng/admin/slots/delivery-slots-manager";
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

/** Which orders the list and the summary cover: one IST period, or all of them. */
type Period = SummaryPeriod | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: PERIOD_LABEL.today },
  { key: "week", label: PERIOD_LABEL.week },
  { key: "month", label: PERIOD_LABEL.month },
  { key: "all", label: "All time" },
];

/**
 * Filter chips: "all", "paid" (every order whose payment has been received,
 * whatever its fulfilment stage), then each fulfilment stage, then cancelled.
 */
type StatusFilter = "all" | "paid" | OrderStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All orders" },
  { key: "paid", label: "Paid" },
  ...ORDER_STATUS_FLOW.map((s) => ({ key: s, label: STATUS_LABEL[s] })),
  { key: "cancelled", label: STATUS_LABEL.cancelled },
];

const COLS = "grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,0.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.6fr)] gap-4";

/** Where an order is going, from its address snapshot: area, then "City · PIN". */
function orderLocation(o: Order): { area: string; place: string } {
  const a = (o.addressSnapshot ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const area = pick("areaLandmark", "area", "locality", "line2", "landmark", "roadStreet");
  const city = pick("city", "region");
  const pin = pick("pincode", "pinCode", "postalCode");
  return { area, place: [city, pin].filter(Boolean).join(" · ") };
}

export function OrdersClient({
  initialData,
  initialSummary,
  canEditSlots,
}: {
  /** The first page for the default period (today). */
  initialData: OrdersInitialData | null;
  initialSummary: OrderSummary | null;
  canEditSlots: boolean;
}) {
  const [orders, setOrders] = useState<Order[]>(initialData?.orders ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [loading, setLoading] = useState(initialData == null);
  const [period, setPeriod] = useState<Period>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<OrderSummary | null>(initialSummary);
  const [slots, setSlots] = useState<ManagedSlot[]>(initialSummary?.slots ?? []);
  // A search looks through every order: an order number typed in is wanted
  // whenever it was placed, not only if it happens to fall in the period.
  const searching = search.trim().length > 0;

  // Skip the mount fetch when the server already streamed the first page in.
  // Any later filter/search change still triggers a normal debounced reload.
  const skipInitialLoad = useRef(initialData != null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    // "Paid" filters on payment, not on the fulfilment stage.
    if (statusFilter === "paid") params.set("paymentStatus", "paid");
    else if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    else if (period !== "all") {
      const w = periodWindows(new Date())[period];
      params.set("from", w.from);
      params.set("to", w.to);
    }
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
  }, [statusFilter, search, period]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/summary", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; summary?: OrderSummary };
      if (data.ok && data.summary) {
        setSummary(data.summary);
        setSlots(data.summary.slots);
      }
    } catch {
      /* keep the last figures; the next refresh tries again */
    }
  }, []);

  // Orders arrive all day; keep the figures current while the page is open.
  // The list itself only reloads on request, so rows never jump under a click.
  useLiveRefresh(() => void loadSummary(), { intervalMs: 60_000 });

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

  // Open work across ALL dates, so an order from yesterday still waiting to be
  // packed is never hidden by looking at today. Falls back to the loaded page
  // only when the summary could not be read.
  const stats = useMemo(() => {
    if (summary) {
      const o = summary.open;
      return { placed: o.placed, toPack: o.confirmed + o.packed, shipped: o.shipped, pendingPay: o.paymentPending };
    }
    const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
    // A cancelled cash-on-delivery order stays "pending" but is owed nothing.
    const pendingPay = orders.filter((o) => o.paymentStatus === "pending" && o.status !== "cancelled").length;
    return {
      placed: count("placed"),
      toPack: count("confirmed") + count("packed"),
      shipped: count("shipped"),
      pendingPay,
    };
  }, [orders, summary]);

  const periodSummary = period !== "all" ? summary?.periods[period] ?? null : null;
  const periodNoun = period === "today" ? "today" : period === "week" ? "this week" : period === "month" ? "this month" : "";

  return (
    <AdminShell
      active="/admin/orders"
      title="Orders"
      subtitle={
        searching
          ? `${total} order${total === 1 ? "" : "s"} found · searching all dates`
          : `${total} order${total === 1 ? "" : "s"}${periodNoun ? ` ${periodNoun}` : ""} · statuses only move forward`
      }
      actions={
        <div className="flex items-center gap-2">
          <a
            href="#delivery-slots"
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors"
          >
            <Icon name="clock-circle-bold" size={15} className="text-ng-forest" />
            Delivery slots
          </a>
          <button
            type="button"
            onClick={() => {
              void load();
              void loadSummary();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors"
          >
            <Icon name="refresh-bold" size={15} className="text-ng-forest" />
            Refresh
          </button>
        </div>
      }
    >
      {/* Open work, whenever it was placed */}
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
        Open now · all dates
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatTile label="New (placed)" value={String(stats.placed)} />
        <StatTile label="To pack" value={String(stats.toPack)} />
        <StatTile label="Shipped" value={String(stats.shipped)} />
        <StatTile label="Payment pending" value={String(stats.pendingPay)} />
      </div>

      {/* Period: today / this week / this month / all time */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Period" className="inline-flex rounded-full border border-ng-line-soft bg-ng-paper p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
                period === p.key
                  ? "bg-ng-forest-deep text-ng-cream font-semibold"
                  : "text-ng-ink-muted font-medium hover:bg-ng-cream",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodSummary ? (
          <span className="text-[12.5px] font-semibold text-ng-ink-muted">{periodRangeLabel(periodSummary)}</span>
        ) : null}
      </div>

      {periodSummary ? (
        <div className="mb-7">
          <OrderSummaryPanel summary={periodSummary} />
        </div>
      ) : period !== "all" && !summary ? (
        <p className="mb-7 rounded-xl bg-ng-line-soft/50 px-5 py-4 text-[13px] font-medium text-ng-ink-muted">
          The {periodNoun} figures could not be loaded. Press Refresh to try again.
        </p>
      ) : null}

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
          <div className="lg:min-w-[960px]">
        <div
          className={cn(
            COLS,
            "hidden lg:grid px-5 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold",
          )}
        >
          <span>Order</span>
          <span>Customer</span>
          <span>Location</span>
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
            {searching || statusFilter !== "all" || period === "all"
              ? "No orders match this filter or search."
              : `No orders ${periodNoun} yet.`}
          </div>
        ) : (
          <ul>
            {orders.map((o) => (
              <Fragment key={o.id}>
              {/* Phone and tablet: one card per order. */}
              <li className="lg:hidden border-b border-ng-line-soft last:border-0">
                <Link href={`/admin/orders/${o.orderNumber}`} className="block px-4 py-3.5 active:bg-ng-cream/50">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono font-semibold text-[13px] text-ng-forest-deep truncate">
                      {o.orderNumber}
                    </span>
                    <span className="font-semibold text-[14px] text-ng-ink tabular-nums">
                      {formatPaise(o.totalPaise)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13.5px] font-semibold text-ng-ink truncate">{customerLabel(o)}</div>
                  <div className="text-[12px] font-medium text-ng-ink-muted truncate">
                    {[customerContact(o), orderLocation(o).place].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                    <Pill tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_LABEL[o.paymentStatus]}</Pill>
                    <span className="ml-auto text-[11.5px] font-medium text-ng-ink-soft">
                      {itemCount(o)} items · {relativeTime(o.placedAt)}
                    </span>
                  </div>
                </Link>
              </li>
              {/* Laptop and up: the table row. */}
              <li
                className={cn(
                  COLS,
                  "hidden lg:grid px-5 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors",
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
                <div className="min-w-0">
                  <div className="truncate font-medium text-ng-ink">
                    {orderLocation(o).place || "—"}
                  </div>
                  <div className="text-[11.5px] font-medium text-ng-ink-muted truncate">
                    {orderLocation(o).area}
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
              </Fragment>
            ))}
          </ul>
        )}
          </div>
        </div>
      </Card>

      <div id="delivery-slots" className="mt-8 scroll-mt-24">
        {/* Slots come with the summary. Without it the list is unknown, and an
            empty one would wrongly say customers cannot order. */}
        {summary ? (
          <DeliverySlotsManager slots={slots} onSlotsChange={setSlots} canEdit={canEditSlots} showTodayCounts />
        ) : (
          <Card title="Delivery slots">
            <p className="text-[13px] font-medium text-ng-ink-muted">
              The delivery slots could not be loaded. Press Refresh to try again.
            </p>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
