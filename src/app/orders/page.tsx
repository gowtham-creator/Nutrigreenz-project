"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import {
  loadReceipt,
  type OrderReceipt,
} from "@/components/ng/checkout/order-receipt";
import { Reveal } from "@/components/ng/motion";
import { cn } from "@/lib/utils";

// One unified pill system — mirrors src/app/account/page.tsx exactly: each
// status is a soft tint + matching dot, so no status reads heavier than another.
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
  lot: string;
  products: string[];
}

// Rich mock order history (newest first). Real receipts from sessionStorage are
// surfaced above this list when present.
const ORDERS: OrderRow[] = [
  {
    id: "NG-25-1042",
    date: "2026-05-12",
    total: 2640,
    items: 3,
    status: "out for delivery",
    lot: "NG-24-051",
    products: [
      "Cold-Pressed Groundnut Oil — 1L",
      "A2 Gir Cow Ghee — 500ml",
      "Multifloral Raw Honey — 500g",
    ],
  },
  {
    id: "NG-25-1019",
    date: "2026-05-04",
    total: 1860,
    items: 4,
    status: "processing",
    lot: "NG-24-047",
    products: ["Lakadong Turmeric Powder — 250g", "Garam Masala — 100g", "Toor Dal — 1kg"],
  },
  {
    id: "NG-25-0981",
    date: "2026-04-28",
    total: 1430,
    items: 2,
    status: "delivered",
    lot: "NG-24-018",
    products: ["A2 Desi Cow Ghee — 1L Jar", "Foxtail Millet — 500g"],
  },
  {
    id: "NG-25-0922",
    date: "2026-04-19",
    total: 980,
    items: 3,
    status: "delivered",
    lot: "NG-24-042",
    products: ["Moringa Leaf Powder — 200g", "Finger Millet Flour — 1kg", "Coriander Powder — 200g"],
  },
  {
    id: "NG-25-0863",
    date: "2026-04-14",
    total: 3960,
    items: 1,
    status: "delivered",
    lot: "NG-24-039",
    products: ["Harvest Hamper — Festive Edition"],
  },
  {
    id: "NG-25-0790",
    date: "2026-03-30",
    total: 1255,
    items: 5,
    status: "delivered",
    lot: "NG-24-026",
    products: ["Wood-Pressed Sunflower Oil — 1L", "Moong Dal — 1kg", "Rajma — 1kg"],
  },
  {
    id: "NG-25-0714",
    date: "2026-03-18",
    total: 2090,
    items: 2,
    status: "delivered",
    lot: "NG-24-011",
    products: ["Cultured Buffalo Ghee — 250ml", "Kashmiri Acacia Honey — 350g"],
  },
];

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

const NOOP = () => () => {};

/** SSR-safe read of the most recent live receipt from sessionStorage. */
function useLiveReceipt(): OrderReceipt | null {
  const getSnapshot = useMemo(() => {
    let latest: OrderReceipt | null = null;
    if (typeof window !== "undefined") {
      try {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (!key || !key.startsWith("ng.order.")) continue;
          const r = loadReceipt(key.slice("ng.order.".length));
          if (r && (!latest || r.placedAt > latest.placedAt)) latest = r;
        }
      } catch {
        latest = null;
      }
    }
    return () => latest;
  }, []);

  return useSyncExternalStore<OrderReceipt | null>(NOOP, getSnapshot, () => null);
}

export default function OrderHistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const liveReceipt = useLiveReceipt();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ORDERS.filter((o) => {
      if (!matchesFilter(o.status, filter)) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.products.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [filter, query]);

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
          <div className="mt-6 grid grid-cols-3 items-stretch gap-3 sm:max-w-md">
            {[
              { icon: "box-bold", n: ORDERS.length, l: "Orders" },
              { icon: "delivery-bold", n: ORDERS.filter((o) => o.status === "delivered").length, l: "Delivered" },
              { icon: "scooter-bold", n: ORDERS.filter((o) => o.status !== "delivered").length, l: "In progress" },
            ].map((s) => (
              <div key={s.l} className="flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-4 shadow-[var(--shadow-ng-card)]">
                <Icon name={s.icon} size={18} className="text-ng-forest" />
                <div className="mt-2 font-display text-[24px] leading-none tabular-nums text-ng-forest-deep">{s.n}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-ng-ink-soft">{s.l}</div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Live receipt (only when a real order exists in this session) */}
        {liveReceipt ? (
          <section>
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-ng-forest">
              <Icon name="check-circle-bold" size={15} className="text-ng-green-bright" />
              Just placed
            </div>
            <LiveReceiptRow receipt={liveReceipt} />
          </section>
        ) : null}

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

        {/* No-cancellation aware support affordance (no cancel action anywhere) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5 text-ng-ink-muted">
            <Icon name="headphone-round-bold" size={18} className="text-ng-forest" />
            Issue with an order? Our care team replies within 2 hours.
          </span>
          <Link
            href="mailto:care@nutrigreenz.in"
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
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ng-ink-soft">
          <span>
            {new Date(o.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · {o.items} item{o.items > 1 ? "s" : ""}
          </span>
          <span aria-hidden className="text-ng-line">
            •
          </span>
          <span className="font-mono">lot {o.lot}</span>
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

function LiveReceiptRow({ receipt }: { receipt: OrderReceipt }) {
  const tone = STATUS.processing;
  const products = receipt.items.map((i) => i.title);
  const itemCount = receipt.items.reduce((s, i) => s + i.qty, 0);
  const extra = itemCount - products.length;
  const date = new Date(receipt.placedAt);
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-ng-leaf/40 bg-ng-leaf-soft/30 p-5 transition-colors hover:border-ng-leaf sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-display text-[17px] leading-none text-ng-forest-deep">
            {receipt.id}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${tone.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            processing
          </span>
        </div>
        <div className="mt-1.5 text-[12px] text-ng-ink-soft">
          {date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} ·{" "}
          {itemCount} item{itemCount > 1 ? "s" : ""}
        </div>
        <p className="mt-2 line-clamp-1 text-[13px] text-ng-ink-muted">
          {products.join(", ")}
          {extra > 0 ? ` +${extra} more` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <span className="font-display text-[19px] text-ng-forest-deep">
          ₹{receipt.total.toLocaleString("en-IN")}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${receipt.id}`}>Details →</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/orders/${receipt.id}/invoice`}>Invoice</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
