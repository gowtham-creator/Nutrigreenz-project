"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { NoCancellationNotice } from "@/components/ng/checkout/no-cancellation";
import { Reveal } from "@/components/ng/motion";
import { useAuth } from "@/lib/auth";
import {
  fetchMyOrder,
  formatOrderDate,
  formatOrderDateTime,
  inrFromPaise,
  OrdersAuthError,
  orderItemCount,
  paymentLabel,
  paymentTone,
  snapshotString,
  statusLabel,
  statusTone,
  type OrderItemView,
  type OrderStatus,
  type OrderView,
} from "@/lib/orders-client";

type LoadState = "loading" | "ready" | "missing" | "error" | "unauth";

// Forward-only fulfilment pipeline + the icon for each step.
const FLOW: { status: OrderStatus; label: string; icon: string }[] = [
  { status: "placed", label: "Order placed", icon: "cart-check-bold" },
  { status: "confirmed", label: "Confirmed", icon: "verified-check-bold" },
  { status: "packed", label: "Packed at warehouse", icon: "box-bold" },
  { status: "shipped", label: "Shipped", icon: "delivery-bold" },
  { status: "delivered", label: "Delivered", icon: "verified-check-bold" },
];

const STATUS_RANK: Record<OrderStatus, number> = {
  placed: 0,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
};

function lineImage(item: OrderItemView): string | null {
  return snapshotString(item.snapshot, "image");
}

function lineUnit(item: OrderItemView): string | null {
  return (
    snapshotString(item.snapshot, "variantLabel") ??
    snapshotString(item.snapshot, "unit")
  );
}

export default function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = use(params);
  const { isAuthed, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderView | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) {
      setState("unauth");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    fetchMyOrder(number, controller.signal)
      .then((o) => {
        if (controller.signal.aborted) return;
        setOrder(o);
        setState(o ? "ready" : "missing");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState(err instanceof OrdersAuthError ? "unauth" : "error");
      });
    return () => controller.abort();
  }, [authLoading, isAuthed, number]);

  /* ── non-ready states ──────────────────────────────────────────────── */
  if (state !== "ready" || !order) {
    return (
      <AccountShell active="orders">
        <div className="space-y-6">
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ng-forest hover:underline"
          >
            <Icon name="arrow-left-linear" size={15} />
            Back to orders
          </Link>

          {state === "loading" ? (
            <div className="space-y-5">
              <div className="h-24 animate-pulse rounded-3xl border border-ng-line-soft bg-ng-paper" />
              <div className="h-64 animate-pulse rounded-3xl border border-ng-line-soft bg-ng-paper" />
            </div>
          ) : (
            <section className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-12 text-center">
              <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-forest shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
                <Icon
                  name={state === "unauth" ? "lock-keyhole-minimalistic-bold" : "box-linear"}
                  size={28}
                />
              </span>
              <p className="font-display text-[22px] text-ng-forest-deep">
                {state === "unauth"
                  ? "Sign in to view this order"
                  : state === "missing"
                    ? "Order not found"
                    : "We couldn't load this order"}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-ng-ink-muted">
                {state === "unauth"
                  ? "Your orders are tied to your account — sign in to see this one."
                  : state === "missing"
                    ? "We couldn't find an order with that number on your account."
                    : "Something went wrong. Please try again in a moment."}
              </p>
              {state === "unauth" ? (
                <Button variant="primary" className="mt-6" asChild>
                  <Link href={`/auth?next=/account/orders/${encodeURIComponent(number)}`}>Sign in</Link>
                </Button>
              ) : (
                <Button variant="primary" className="mt-6" asChild>
                  <Link href="/account/orders">Back to orders</Link>
                </Button>
              )}
            </section>
          )}
        </div>
      </AccountShell>
    );
  }

  /* ── ready ─────────────────────────────────────────────────────────── */
  const tone = statusTone(order.status);
  const pay = paymentTone(order.paymentStatus);
  const count = orderItemCount(order);
  const currentRank = STATUS_RANK[order.status];

  // Map each pipeline step to its completion + the timestamp from its event.
  const eventAt = new Map<OrderStatus, string>();
  for (const ev of order.events) {
    if (!eventAt.has(ev.status)) eventAt.set(ev.status, ev.at);
  }
  const timeline = FLOW.map((step) => ({
    ...step,
    done: STATUS_RANK[step.status] < currentRank,
    active: step.status === order.status,
    at: eventAt.get(step.status) ?? null,
  }));

  const addr = order.addressSnapshot;
  const slotLabel = snapshotString(order.slotSnapshot, "label");

  return (
    <AccountShell active="orders">
      <div className="space-y-7">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ng-forest hover:underline"
        >
          <Icon name="arrow-left-linear" size={15} />
          Back to orders
        </Link>

        <header>
          <div className="flex flex-wrap items-center gap-3">
            <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-forest">
              <Icon name="box-bold" size={14} />
              Order ·{" "}
              <span className="font-mono normal-case tracking-normal text-ng-forest-deep">
                {order.orderNumber}
              </span>
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${tone.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {statusLabel(order.status)}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${pay.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${pay.dot}`} />
              {paymentLabel(order.paymentStatus)}
            </span>
          </div>
          <h1 className="mt-2 font-display text-[clamp(28px,4vw,38px)] leading-tight text-ng-forest-deep">
            {order.status === "delivered" ? "Delivered. Enjoy your harvest." : "Your order is on its way."}
          </h1>
          <span className="mt-1 block text-[13px] text-ng-ink-muted">
            Placed {formatOrderDate(order.placedAt)} · {count} item{count > 1 ? "s" : ""}
          </span>
        </header>

        {order.paymentStatus === "pending" ? (
          <div className="flex items-start gap-3 rounded-2xl border border-ng-amber/40 bg-ng-amber/10 p-4 text-[13px]">
            <Icon name="clock-circle-bold" size={18} className="mt-0.5 shrink-0 text-ng-amber" />
            <div>
              <p className="font-display text-[14.5px] text-ng-forest-deep">Payment pending</p>
              <p className="mt-0.5 leading-relaxed text-ng-ink-muted">
                Your order is placed and being prepared. We&apos;ll confirm payment shortly —
                no action is needed from you right now.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="space-y-7">
            {/* Timeline */}
            <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)]">
              <h2 className="mb-6 flex items-center gap-2.5 font-display text-[20px] text-ng-forest-deep">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-sage/60 text-ng-forest-deep">
                  <Icon name="routing-2-bold" size={16} />
                </span>
                Fulfilment progress
              </h2>
              <ol className="relative">
                {timeline.map((t, i) => {
                  const last = i === timeline.length - 1;
                  return (
                    <li key={t.status} className="relative flex gap-4 pb-7 last:pb-0">
                      {!last ? (
                        <span
                          aria-hidden
                          className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${
                            t.done ? "bg-ng-forest/70" : "bg-ng-line"
                          }`}
                        />
                      ) : null}
                      <span
                        className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-ng-paper ${
                          t.active
                            ? "bg-ng-leaf text-ng-forest-deep shadow-[0_0_0_4px_rgba(102,191,115,0.22)]"
                            : t.done
                              ? "bg-ng-forest text-ng-cream"
                              : "bg-ng-sage/60 text-ng-ink-soft"
                        }`}
                      >
                        {t.active ? (
                          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-ng-leaf/40" />
                        ) : null}
                        <Icon name={t.icon} size={17} className="relative" />
                      </span>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[14.5px] font-medium ${
                              t.done || t.active ? "text-ng-ink" : "text-ng-ink-soft"
                            }`}
                          >
                            {t.label}
                          </span>
                          {t.active ? (
                            <span className="rounded-full bg-ng-leaf/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ng-forest">
                              Now
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[12px] text-ng-ink-soft">
                          {t.at ? formatOrderDateTime(t.at) : t.done || t.active ? "" : "Pending"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Items */}
            <section>
              <h2 className="mb-4 flex items-center gap-2.5 font-display text-[22px] text-ng-forest-deep">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-sage/60 text-ng-forest-deep">
                  <Icon name="bag-4-bold" size={16} />
                </span>
                Items in this order
              </h2>
              <div className="space-y-3">
                {order.items.map((item) => {
                  const img = lineImage(item);
                  const unit = lineUnit(item);
                  return (
                    <article
                      key={item.id}
                      className="ng-float flex items-center gap-5 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-all hover:border-ng-leaf/50"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ng-cream-deep">
                        {img ? (
                          <Image src={img} alt={item.title} fill className="object-cover" sizes="80px" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-ng-ink-soft">
                            <Icon name="bag-4-bold" size={26} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="line-clamp-1 font-display text-[16px] text-ng-forest-deep">
                          {item.title}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ng-ink-soft">
                          <span>Qty {item.qty}</span>
                          {unit ? <span>{unit}</span> : null}
                          <span className="tabular-nums">{inrFromPaise(item.unitPricePaise)} each</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-[18px] tabular-nums text-ng-forest-deep">
                          {inrFromPaise(item.lineTotalPaise)}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Summary + address */}
          <aside className="space-y-5 self-start lg:sticky lg:top-24">
            <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)]">
              <h2 className="mb-4 flex items-center gap-2 font-display text-[18px] text-ng-forest-deep">
                <Icon name="bill-list-bold" size={17} className="text-ng-forest" />
                Summary
              </h2>
              <dl className="space-y-2 text-[13px]">
                <Row label="Subtotal" value={inrFromPaise(order.subtotalPaise)} />
                {order.discountPaise > 0 ? (
                  <Row label="Discount" value={`− ${inrFromPaise(order.discountPaise)}`} />
                ) : null}
                {order.couponCode ? <Row label="Coupon" value={order.couponCode} /> : null}
                {order.loyaltyRedeemedPaise > 0 ? (
                  <Row label="Loyalty credit" value={`− ${inrFromPaise(order.loyaltyRedeemedPaise)}`} />
                ) : null}
                <Row
                  label="Shipping"
                  value={order.shippingPaise > 0 ? inrFromPaise(order.shippingPaise) : "Free"}
                />
                {order.taxPaise > 0 ? <Row label="Tax" value={inrFromPaise(order.taxPaise)} /> : null}
              </dl>
              <div className="mt-3 flex items-baseline justify-between border-t border-ng-line-soft pt-3">
                <span className="font-display text-[16px]">Total</span>
                <span className="font-display text-[22px] tabular-nums text-ng-forest-deep">
                  {inrFromPaise(order.totalPaise)}
                </span>
              </div>
              {slotLabel ? (
                <p className="mt-3 flex items-center gap-2 border-t border-ng-line-soft pt-3 text-[12px] text-ng-ink-muted">
                  <Icon name="clock-circle-bold" size={14} className="text-ng-forest" />
                  Slot · {slotLabel}
                </p>
              ) : null}
            </div>

            {addr ? (
              <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 text-[13px] shadow-[var(--shadow-ng-card)]">
                <h3 className="mb-2 flex items-center gap-2 font-display text-[16px] text-ng-forest-deep">
                  <Icon name="map-point-bold" size={16} className="text-ng-forest" />
                  Shipping to
                </h3>
                <p className="leading-relaxed text-ng-ink-muted">
                  {snapshotString(addr, "fullName") ? (
                    <>
                      <span className="font-medium text-ng-ink">{snapshotString(addr, "fullName")}</span>
                      <br />
                    </>
                  ) : null}
                  {snapshotString(addr, "line1") ? (
                    <>
                      {snapshotString(addr, "line1")}
                      <br />
                    </>
                  ) : null}
                  {snapshotString(addr, "line2") ? (
                    <>
                      {snapshotString(addr, "line2")}
                      <br />
                    </>
                  ) : null}
                  {[snapshotString(addr, "city"), snapshotString(addr, "state"), snapshotString(addr, "pincode")]
                    .filter(Boolean)
                    .join(", ")}
                  {snapshotString(addr, "phone") ? (
                    <>
                      <br />
                      {snapshotString(addr, "phone")}
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}

            <Button variant="ghost" fullWidth asChild>
              <Link href="mailto:care@nutrigreenz.in">Report an issue</Link>
            </Button>

            {/* No cancel action — short no-cancellation note instead (§3.9). */}
            <NoCancellationNotice />
          </aside>
        </div>

        <Reveal
          as="div"
          className="flex flex-col gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 text-[13px] sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2.5 text-ng-ink-muted">
            <Icon name="leaf-bold" size={18} className="text-ng-forest" />
            Lot codes are printed on every label for full traceability.
          </span>
          <Link href="/traceability" className="font-medium text-ng-forest hover:underline">
            Trace your harvest →
          </Link>
        </Reveal>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ng-ink-muted">{label}</dt>
      <dd className="font-medium text-ng-ink">{value}</dd>
    </div>
  );
}
