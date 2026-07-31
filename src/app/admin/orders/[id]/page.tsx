"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { StatusStepper } from "../status-stepper";
import {
  customerLabel,
  formatDateTime,
  formatPaise,
  itemCount,
  PAYMENT_LABEL,
  PAYMENT_TONE,
  snapshotRows,
  STATUS_LABEL,
  STATUS_TONE,
  type Order,
} from "../portal-data";

const backAction = (
  <Link
    href="/admin/orders"
    className="inline-flex items-center gap-2 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors"
  >
    <Icon name="arrow-left-linear" size={15} />
    Back to orders
  </Link>
);

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; order: Order };

export default function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`);
    if (!res.ok) {
      setState({ phase: "missing" });
      return;
    }
    const data = (await res.json()) as { ok: boolean; order?: Order };
    if (data.ok && data.order) setState({ phase: "ready", order: data.order });
    else setState({ phase: "missing" });
  }, [id]);

  /* Cash on delivery is collected by a human, so a human records it. Nothing
     flips this automatically — "delivered" does not prove the cash actually
     changed hands, and an order marked paid without the money is worse than one
     that stays pending a little longer. */
  const [markingPaid, setMarkingPaid] = useState(false);
  const markCodCollected = useCallback(async () => {
    if (state.phase !== "ready") return;
    setMarkingPaid(true);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(state.order.orderNumber)}/payment`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        toast.error("Not recorded", {
          description: data.message ?? "Couldn't record the payment — try again.",
        });
        return;
      }
      toast.success("Payment recorded", { description: "This order now counts as paid." });
      await load();
    } catch {
      toast.error("Not recorded", { description: "Couldn't reach the server — try again." });
    } finally {
      setMarkingPaid(false);
    }
  }, [state, load]);

  useEffect(() => {
    let active = true;
    // Defer the fetch (which sets state) off the synchronous effect body to
    // avoid cascading renders; ignore the result if the effect has cleaned up.
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  if (state.phase === "loading") {
    return (
      <AdminShell active="/admin/orders" title="Order" subtitle={id} actions={backAction}>
        <Card className="text-center py-16">
          <p className="text-[13px] font-medium text-ng-ink-muted">Loading order…</p>
        </Card>
      </AdminShell>
    );
  }

  if (state.phase === "missing") {
    return (
      <AdminShell
        active="/admin/orders"
        title="Order not found"
        subtitle={id}
        actions={backAction}
      >
        <Card className="text-center py-16">
          <div className="mx-auto size-12 rounded-full bg-ng-cream flex items-center justify-center text-ng-ink-soft mb-4">
            <Icon name="box-minimalistic-broken" size={24} />
          </div>
          <h2 className="font-display text-[20px] text-ng-forest-deep">
            We couldn&rsquo;t find that order
          </h2>
          <p className="text-[13px] font-medium text-ng-ink-muted mt-2">
            No order matches <span className="font-mono font-semibold text-ng-ink">{id}</span>.
          </p>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] mt-6 hover:bg-ng-forest transition-colors"
          >
            <Icon name="arrow-left-linear" size={15} /> Back to orders
          </Link>
        </Card>
      </AdminShell>
    );
  }

  const { order } = state;
  const addressRows = snapshotRows(order.addressSnapshot);
  const slotRows = snapshotRows(order.slotSnapshot);
  const onAdvanced = (updated: Order) => setState({ phase: "ready", order: updated });


  return (
    <AdminShell
      active="/admin/orders"
      title={order.orderNumber}
      subtitle={`${customerLabel(order)} · placed ${formatDateTime(order.placedAt)}`}
      actions={backAction}
    >
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Main column */}
        <div className="space-y-6 min-w-0">
          {/* Status pipeline + forward-only action */}
          <Card
            title="Fulfilment status"
            action={<Pill tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Pill>}
          >
            <div className="pt-3 pb-1">
              <StatusStepper order={order} onAdvanced={onAdvanced} />
            </div>
          </Card>

          {/* Line items */}
          <Card className="!p-0 overflow-hidden">
            <header className="px-6 pt-6 pb-4">
              <h2 className="font-display text-[18px] text-ng-forest-deep">
                Line items ({itemCount(order)})
              </h2>
            </header>
            {order.items.length === 0 ? (
              <div className="px-6 pb-6 text-[13px] font-medium text-ng-ink-muted">
                This order has no line items.
              </div>
            ) : (
              <ul>
                {order.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-4 px-6 py-3.5 border-t border-ng-line-soft text-[13px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ng-ink truncate">{it.title}</div>
                      <div className="text-[11.5px] font-medium text-ng-ink-muted mt-0.5 font-mono truncate">
                        {it.variantSku ?? "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="tabular-nums text-ng-ink-muted">
                        {it.qty} × {formatPaise(it.unitPricePaise)}
                      </div>
                      <div className="tabular-nums font-semibold text-ng-ink mt-0.5">
                        {formatPaise(it.lineTotalPaise)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Customer + delivery snapshot */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card title="Customer">
              <dl className="space-y-2.5 text-[13px]">
                <Row label="Name" value={customerLabel(order)} />
                <Row label="Email" value={order.userEmail ?? "—"} mono />
                <Row label="Phone" value={order.userPhone ?? "—"} mono />
                <Row
                  label="Account"
                  value={order.customerId ? "Registered" : "Guest"}
                />
              </dl>
            </Card>

            <Card title="Delivery address">
              {addressRows.length === 0 ? (
                <p className="text-[13px] font-medium text-ng-ink-muted">
                  No address snapshot on this order.
                </p>
              ) : (
                <dl className="space-y-2.5 text-[13px]">
                  {addressRows.map((r) => (
                    <Row key={r.label} label={r.label} value={r.value} />
                  ))}
                </dl>
              )}
            </Card>
          </div>

          {/* Delivery slot snapshot */}
          {slotRows.length > 0 ? (
            <Card title="Delivery slot">
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5 text-[13px]">
                {slotRows.map((r) => (
                  <Row key={r.label} label={r.label} value={r.value} />
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Totals breakdown */}
          <Card title="Summary">
            <dl className="space-y-2.5 text-[13px]">
              <Row label={`Subtotal (${itemCount(order)} items)`} value={formatPaise(order.subtotalPaise)} valueClass="font-semibold text-ng-ink" />
              {order.discountPaise > 0 ? (
                <Row
                  label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
                  value={`− ${formatPaise(order.discountPaise)}`}
                  valueClass="font-semibold text-ng-success"
                />
              ) : null}
              {order.loyaltyRedeemedPaise > 0 ? (
                <Row
                  label="Loyalty redeemed"
                  value={`− ${formatPaise(order.loyaltyRedeemedPaise)}`}
                  valueClass="font-semibold text-ng-success"
                />
              ) : null}
              <Row
                label="Delivery"
                value={order.shippingPaise > 0 ? formatPaise(order.shippingPaise) : "Free"}
                valueClass={order.shippingPaise > 0 ? "font-semibold text-ng-ink" : "font-semibold text-ng-success"}
              />
              {order.taxPaise > 0 ? (
                <Row label="Tax" value={formatPaise(order.taxPaise)} valueClass="font-semibold text-ng-ink" />
              ) : null}
              <div className="flex justify-between pt-2.5 border-t border-ng-line-soft text-[15px]">
                <dt className="font-display text-ng-forest-deep">Total</dt>
                <dd className="font-display text-ng-forest-deep tabular-nums">
                  {formatPaise(order.totalPaise)}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Payment */}
          <Card title="Payment">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-medium text-ng-ink-muted">Status</span>
              <Pill tone={PAYMENT_TONE[order.paymentStatus]}>
                {PAYMENT_LABEL[order.paymentStatus]}
              </Pill>
            </div>
            <dl className="space-y-2.5 text-[13px]">
              <Row
                label="Method"
                value={order.paymentMethod === "upi" ? "UPI (online)" : "Cash on Delivery"}
              />
              <Row
                label="Amount paid"
                value={order.paymentStatus === "paid" ? formatPaise(order.totalPaise) : "Not yet collected"}
              />
              <Row
                label="Paid on"
                value={order.paidAt ? new Date(order.paidAt).toLocaleString("en-IN") : "—"}
              />
              <Row label="Provider" value={order.paymentProvider} />
              <Row label="Reference" value={order.paymentRef ?? "—"} mono />
              <Row label="Currency" value={order.currency} />
            </dl>

            {/* Cash on delivery is collected by hand, so it needs a human to say
                so. Marking it here is the only thing that turns a COD order into
                revenue — nothing flips it automatically, because "delivered"
                does not prove the cash actually changed hands. */}
            {order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? (
              <button
                type="button"
                disabled={markingPaid}
                onClick={() => void markCodCollected()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ng-forest-deep px-4 py-2.5 text-[12.5px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="wallet-money-bold" size={15} />
                {markingPaid ? "Recording…" : `Mark ${formatPaise(order.totalPaise)} collected`}
              </button>
            ) : null}
          </Card>

          {/* Status timeline */}
          <Card title="Status timeline">
            {order.events.length === 0 ? (
              <p className="text-[13px] font-medium text-ng-ink-muted">No status events yet.</p>
            ) : (
              <ol className="space-y-4">
                {order.events.map((ev, idx) => {
                  const isLast = idx === order.events.length - 1;
                  return (
                    <li key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={
                            isLast
                              ? "size-3 rounded-full bg-ng-forest-deep mt-1"
                              : "size-3 rounded-full bg-ng-forest/40 mt-1"
                          }
                        />
                        {!isLast ? <span className="w-px flex-1 bg-ng-line-soft mt-1" /> : null}
                      </div>
                      <div className="pb-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ng-forest-deep">
                          {STATUS_LABEL[ev.status]}
                        </div>
                        <div className="text-[11.5px] font-medium text-ng-ink-muted mt-0.5">
                          {formatDateTime(ev.at)} · {ev.by}
                        </div>
                        {ev.note ? (
                          <div className="text-[12px] font-medium text-ng-ink-soft mt-1">
                            {ev.note}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

/** A label/value row inside a definition list. */
function Row({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-medium text-ng-ink-muted shrink-0">{label}</dt>
      <dd
        className={[
          "text-right min-w-0 truncate",
          mono ? "font-mono text-[12px] text-ng-ink" : "text-ng-ink",
          valueClass ?? "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
