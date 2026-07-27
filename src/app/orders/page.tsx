"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { listReceipts, type OrderReceipt } from "@/components/ng/checkout/order-receipt";
import { Reveal } from "@/components/ng/motion";
import { cn } from "@/lib/utils";

// One unified pill system — each status is a soft tint + matching dot.
const STATUS: Record<string, { dot: string; pill: string }> = {
  "out for delivery": { dot: "bg-ng-amber", pill: "bg-ng-amber/15 text-ng-clay-deep" },
  delivered: { dot: "bg-ng-green-bright", pill: "bg-ng-leaf/15 text-ng-forest" },
  processing: { dot: "bg-ng-blue", pill: "bg-ng-blue/12 text-ng-blue" },
};

type OrderStatus = "out for delivery" | "delivered" | "processing";

interface OrderRow {
  id: string;
  date: string;
  total: number;
  items: number;
  status: OrderStatus;
  products: string[];
}

/** Map a real placed-order receipt to a display row. */
function receiptToRow(r: OrderReceipt): OrderRow {
  return {
    id: r.id,
    date: r.placedAt,
    total: r.total,
    items: r.items.reduce((sum, i) => sum + i.qty, 0),
    status: "processing",
    products: r.items.map((i) => i.title),
  };
}

type Filter = "all" | "delivered" | "transit" | "processing";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "transit", label: "In transit" },
  { key: "processing", label: "Processing" },
];

function matchesFilter(status: OrderStatus, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "delivered") return status === "delivered";
  if (filter === "transit") return status === "out for delivery";
  return status === "processing";
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  // Real placed orders only (this session's receipts) — empty for a new account.
  useEffect(() => {
    setOrders(listReceipts().map(receiptToRow));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesFilter(o.status, filter)) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.products.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [orders, filter, query]);

  const hasOrders = orders.length > 0;

  return (
    <AccountShell active="orders">
      <div className="space-y-8">
        {/* Heading */}
        <Reveal>
          <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-clay">
            <Icon name="box-bold" size={14} />
            Your orders
          </span>
          <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
            Order <em className="italic text-ng-leaf">history</em>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
            Every harvest you&apos;ve ordered, freshest first. Open any order for live tracking,
            lot traces and a GST invoice.
          </p>
          {hasOrders ? (
            <div className="mt-6 grid grid-cols-3 items-stretch gap-3 sm:max-w-md">
              {[
                { icon: "box-bold", n: orders.length, l: "Orders" },
                { icon: "delivery-bold", n: orders.filter((o) => o.status === "delivered").length, l: "Delivered" },
                { icon: "scooter-bold", n: orders.filter((o) => o.status !== "delivered").length, l: "In progress" },
              ].map((s) => (
                <div key={s.l} className="flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-4 shadow-[var(--shadow-ng-card)]">
                  <Icon name={s.icon} size={18} className="text-ng-forest" />
                  <div className="mt-2 font-display text-[24px] leading-none tabular-nums text-ng-forest-deep">{s.n}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-ng-ink-soft">{s.l}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Reveal>

        {hasOrders ? (
          <>
            {/* Filters + search */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
                {FILTERS.map((f) => {
                  const isActive = f.key === filter;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      aria-pressed={isActive}
                      className={cn(
                        "whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-ng-forest text-ng-cream"
                          : "border border-ng-line-soft bg-ng-paper text-ng-ink-muted hover:border-ng-leaf/50 hover:text-ng-ink",
                      )}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <label className="relative md:w-72">
                <Icon
                  name="magnifer-linear"
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ng-ink-soft"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search order id or product"
                  className="w-full rounded-full border border-ng-line-soft bg-ng-paper py-2.5 pl-10 pr-4 text-[14px] text-ng-ink placeholder:text-ng-ink-soft focus:border-ng-leaf focus:outline-none focus:ring-2 focus:ring-ng-leaf/30"
                />
              </label>
            </div>

            {/* Order list */}
            <section>
              {filtered.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-12 text-center">
                  <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-clay shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
                    <Icon name="box-linear" size={30} />
                  </span>
                  <p className="font-display text-[20px] text-ng-forest-deep">No orders match</p>
                  <p className="mt-1.5 text-[14px] text-ng-ink-muted">
                    Try a different filter or clear your search.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map((o) => (
                    <OrderListRow key={o.id} order={o} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          /* Empty — a brand-new account with no orders yet. */
          <section className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-12 text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-clay shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
              <Icon name="box-linear" size={30} />
            </span>
            <p className="font-display text-[22px] text-ng-forest-deep">No orders yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-ng-ink-muted">
              When you place your first order it&apos;ll appear here with live tracking, lot traces and a GST invoice.
            </p>
            <Button variant="primary" className="mt-6" asChild>
              <Link href="/shop">Start shopping</Link>
            </Button>
          </section>
        )}

        {/* No-cancellation aware support affordance (no cancel action anywhere) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5 text-ng-ink-muted">
            <Icon name="headphones-round-bold" size={18} className="text-ng-forest" />
            Issue with an order? Our care team replies within 2 hours.
          </span>
          <Link
            href="mailto:care@nutrigreenz.farm"
            className="font-medium text-ng-forest hover:underline"
          >
            Contact support →
          </Link>
        </div>
      </div>
    </AccountShell>
  );
}

function OrderListRow({ order: o }: { order: OrderRow }) {
  const tone = STATUS[o.status] ?? STATUS.processing;
  const extra = o.items - o.products.length;
  return (
    <article className="ng-float flex flex-col gap-4 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-all hover:border-ng-leaf/50 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-display text-[17px] leading-none text-ng-forest-deep">{o.id}</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${tone.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {o.status}
          </span>
        </div>
        <div className="mt-1.5 text-[12px] text-ng-ink-soft">
          {new Date(o.date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}{" "}
          · {o.items} item{o.items > 1 ? "s" : ""}
        </div>
        <p className="mt-2 line-clamp-1 text-[13px] text-ng-ink-muted">
          {o.products.join(", ")}
          {extra > 0 ? ` +${extra} more` : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <span className="font-display text-[19px] tabular-nums text-ng-forest-deep">
          ₹{o.total.toLocaleString("en-IN")}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${o.id}`}>Details →</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/orders/${o.id}/invoice`}>Invoice</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
