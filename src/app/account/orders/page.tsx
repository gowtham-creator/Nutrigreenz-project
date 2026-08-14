"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { Reveal } from "@/components/ng/motion";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  fetchMyOrders,
  formatOrderDate,
  inrFromPaise,
  OrdersAuthError,
  orderItemCount,
  orderProductTitles,
  paymentLabel,
  paymentTone,
  statusLabel,
  statusTone,
  type OrderView,
} from "@/lib/orders-client";

type Filter = "all" | "delivered" | "transit" | "open";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "transit", label: "In transit" },
  { key: "open", label: "Processing" },
];

function matchesFilter(order: OrderView, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "delivered") return order.status === "delivered";
  if (filter === "transit") return order.status === "shipped";
  // "open" — anything not yet shipped/delivered.
  return order.status === "placed" || order.status === "confirmed" || order.status === "packed";
}

type LoadState = "loading" | "ready" | "error" | "unauth";

export default function AccountOrdersPage() {
  const { isAuthed, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<OrderView[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) {
      setState("unauth");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    fetchMyOrders(controller.signal)
      .then((list) => {
        setOrders(list);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState(err instanceof OrdersAuthError ? "unauth" : "error");
      });
    return () => controller.abort();
  }, [authLoading, isAuthed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesFilter(o, filter)) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        orderProductTitles(o).some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [orders, filter, query]);

  const hasOrders = orders.length > 0;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  return (
    <AccountShell active="orders">
      <div className="space-y-8">
        {/* Heading */}
        <Reveal>
          <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-forest">
            <Icon name="box-bold" size={14} />
            Your orders
          </span>
          <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
            Order <em className="italic text-ng-leaf">history</em>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
            Every harvest you&apos;ve ordered, freshest first. Open any order for its
            fulfilment timeline, lot traces and a full receipt.
          </p>
          {state === "ready" && hasOrders ? (
            <div className="mt-6 grid grid-cols-3 items-stretch gap-3 sm:max-w-md">
              {[
                { icon: "box-bold", n: orders.length, l: "Orders" },
                { icon: "delivery-bold", n: deliveredCount, l: "Delivered" },
                { icon: "scooter-bold", n: orders.length - deliveredCount, l: "In progress" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-4 shadow-[var(--shadow-ng-card)]"
                >
                  <Icon name={s.icon} size={18} className="text-ng-forest" />
                  <div className="mt-2 font-display text-[24px] leading-none tabular-nums text-ng-forest-deep">
                    {s.n}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-ng-ink-soft">{s.l}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Reveal>

        {/* Loading skeletons */}
        {state === "loading" ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[104px] animate-pulse rounded-2xl border border-ng-line-soft bg-ng-paper"
              />
            ))}
          </div>
        ) : null}

        {/* Not signed in */}
        {state === "unauth" ? (
          <section className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-12 text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-forest shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
              <Icon name="lock-keyhole-minimalistic-bold" size={28} />
            </span>
            <p className="font-display text-[22px] text-ng-forest-deep">Sign in to see your orders</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-ng-ink-muted">
              Your order history is tied to your account so it&apos;s available on every device.
            </p>
            <Button variant="primary" className="mt-6" asChild>
              <Link href="/auth?next=/account/orders">Sign in</Link>
            </Button>
          </section>
        ) : null}

        {/* Error */}
        {state === "error" ? (
          <section className="rounded-3xl border border-ng-danger/40 bg-ng-danger/5 p-10 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-ng-paper text-ng-danger shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
              <UiIcon name="caution" size={26} />
            </span>
            <p className="font-display text-[20px] text-ng-forest-deep">We couldn&apos;t load your orders</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-ng-ink-muted">
              Something went wrong fetching your history. Please try again in a moment.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => location.reload()}>
              Retry
            </Button>
          </section>
        ) : null}

        {/* Ready */}
        {state === "ready" ? (
          hasOrders ? (
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
                    <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-forest shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
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
            /* Empty — a signed-in account with no orders yet. */
            <section className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-12 text-center">
              <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-forest shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
                <Icon name="box-linear" size={30} />
              </span>
              <p className="font-display text-[22px] text-ng-forest-deep">No orders yet</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-ng-ink-muted">
                When you place your first order it&apos;ll appear here with its fulfilment
                timeline, lot traces and a full receipt.
              </p>
              <Button variant="primary" className="mt-6" asChild>
                <Link href="/shop">Start shopping</Link>
              </Button>
            </section>
          )
        ) : null}

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

function OrderListRow({ order }: { order: OrderView }) {
  const tone = statusTone(order.status);
  const pay = paymentTone(order.paymentStatus);
  const titles = orderProductTitles(order);
  const count = orderItemCount(order);
  const extra = count - titles.length;

  return (
    <article className="ng-float flex flex-col gap-4 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-all hover:border-ng-leaf/50 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-display text-[17px] leading-none text-ng-forest-deep">
            {order.orderNumber}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${tone.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {statusLabel(order.status)}
          </span>
          {order.paymentStatus !== "paid" ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${pay.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${pay.dot}`} />
              {paymentLabel(order.paymentStatus)}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 text-[12px] text-ng-ink-soft">
          {formatOrderDate(order.placedAt)} · {count} item{count > 1 ? "s" : ""}
        </div>
        <p className="mt-2 line-clamp-1 text-[13px] text-ng-ink-muted">
          {titles.join(", ")}
          {extra > 0 ? ` +${extra} more` : ""}
        </p>
      </div>

      {/* Price and actions. The row must not wrap: with three items on a narrow
          screen the total was being compressed and its glyphs collided into an
          unreadable smear. The buttons are grouped so they move as one unit, and
          the amount is fixed at its natural width. */}
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <span className="shrink-0 whitespace-nowrap font-display text-[19px] leading-tight tabular-nums text-ng-forest-deep">
          {inrFromPaise(order.totalPaise)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {/* Straight to the invoice without opening the order — filing the
              paperwork is the usual reason for revisiting an old one. */}
          <Button variant="ghost" size="sm" asChild>
            <a
              href={`/api/orders/${encodeURIComponent(order.orderNumber)}/document?doc=invoice`}
              title={`Download invoice for ${order.orderNumber}`}
              className="min-h-[40px] whitespace-nowrap"
            >
              <UiIcon name="export" size={16} />
              Invoice
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/account/orders/${order.orderNumber}`}
              className="min-h-[40px] whitespace-nowrap"
            >
              Details →
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
