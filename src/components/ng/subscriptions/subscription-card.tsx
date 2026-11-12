"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  FREQUENCIES,
  addDays,
  formatDeliveryDate,
  frequencyLabel,
  indiaToday,
} from "@/lib/subscriptions-core";
import {
  goToGateway,
  inr,
  payDelivery,
  subscriptionAction,
  subscriptionErrorMessage,
  updateSubscription,
  type SubscriptionAction,
  type SubscriptionDeliveryRecord,
  type SubscriptionRecord,
} from "@/lib/subscriptions-client";

const STATUS_STYLE: Record<SubscriptionRecord["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-ng-leaf/15 text-ng-forest" },
  paused: { label: "Paused", cls: "bg-ng-clay/15 text-ng-clay-deep" },
  cancelled: { label: "Cancelled", cls: "bg-ng-ink/10 text-ng-ink-muted" },
};

function deliveryLabel(d: SubscriptionDeliveryRecord): { text: string; tone: "good" | "warn" | "muted" } {
  if (d.status === "ordered" && d.order) {
    if (d.order.paymentStatus === "paid") return { text: `Paid · ${d.order.orderNumber}`, tone: "good" };
    if (d.order.paymentStatus === "failed" || d.order.status === "cancelled") {
      return { text: "Payment didn't go through", tone: "warn" };
    }
    return { text: `Ordered · ${d.order.orderNumber}`, tone: "good" };
  }
  switch (d.status) {
    case "due":
      return { text: "Waiting for payment", tone: "warn" };
    case "processing":
      return { text: "Processing", tone: "muted" };
    case "skipped":
      return { text: "Skipped", tone: "muted" };
    case "missed":
      return { text: "Missed (not paid)", tone: "muted" };
    case "failed":
      return { text: "Couldn't be placed", tone: "warn" };
    default:
      return { text: "Ordered", tone: "good" };
  }
}

/** A delivery the customer can pay for right now. */
function payable(d: SubscriptionDeliveryRecord, today: string): boolean {
  if (d.scheduledOn < today) return false;
  if (d.status === "due") return true;
  return d.status === "ordered" && !!d.order && (d.order.paymentStatus === "failed" || d.order.status === "cancelled");
}

function addressLine(a: Record<string, unknown>): string {
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  return [s("line1"), s("line2"), s("city"), s("pincode")].filter(Boolean).join(", ");
}

export function SubscriptionCard({
  sub,
  onChange,
}: {
  sub: SubscriptionRecord;
  onChange: (next: SubscriptionRecord) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "pause" | "cancel" | "edit">("none");
  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(sub.items.map((i) => [i.variantId ?? i.id, i.qty])),
  );
  const [frequency, setFrequency] = useState(sub.frequencyDays);
  const today = indiaToday();
  const status = STATUS_STYLE[sub.status];
  const due = sub.deliveries.find((d) => payable(d, today));
  const upcoming = [...sub.deliveries].sort((a, b) => b.scheduledOn.localeCompare(a.scheduledOn)).slice(0, 5);

  async function run(label: string, action: SubscriptionAction, success: string) {
    setBusy(label);
    try {
      const { subscription } = await subscriptionAction(sub.id, action);
      onChange(subscription);
      setPanel("none");
      toast.success(success);
    } catch (err) {
      toast.error(subscriptionErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function pay(delivery: SubscriptionDeliveryRecord) {
    setBusy("pay");
    try {
      const { orderNumber, payment } = await payDelivery(delivery.id);
      if (payment) {
        if (goToGateway(orderNumber, payment)) return;
        toast.error("We couldn't open the payment page. Please try again.");
      } else {
        toast.success(`Order ${orderNumber} placed`, { description: "Pay the rider in cash on delivery." });
      }
    } catch (err) {
      toast.error(subscriptionErrorMessage(err));
    }
    setBusy(null);
  }

  async function saveEdit() {
    setBusy("edit");
    try {
      const { subscription } = await updateSubscription(sub.id, {
        frequencyDays: frequency,
        items: sub.items
          .filter((i) => i.variantId)
          .map((i) => ({ variantId: i.variantId as string, qty: qtys[i.variantId as string] ?? i.qty })),
      });
      onChange(subscription);
      setPanel("none");
      toast.success("Subscription updated", { description: "Changes apply from the next delivery." });
    } catch (err) {
      toast.error(subscriptionErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const first = sub.items[0];
  const image = typeof first?.snapshot?.image === "string" ? (first.snapshot.image as string) : null;
  const live = sub.status !== "cancelled";

  return (
    <article className="overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper shadow-[var(--shadow-ng-card)]">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ng-cream">
          {image ? <Image src={image} alt="" fill sizes="64px" className="object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", status.cls)}>
              {status.label}
            </span>
            <span className="text-[13px] text-ng-ink-muted">{frequencyLabel(sub.frequencyDays)}</span>
            <span className="text-[13px] text-ng-ink-muted">·</span>
            <span className="text-[13px] text-ng-ink-muted">{sub.paymentMethod === "cod" ? "Cash on delivery" : "Pay online"}</span>
          </div>
          <ul className="mt-1.5">
            {sub.items.map((i) => (
              <li key={i.id} className="font-display text-[17px] leading-snug text-ng-forest-deep">
                {i.qty} × {i.title}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[13px] text-ng-ink-muted">
            {sub.status === "active" ? (
              <>
                Next delivery <span className="font-semibold text-ng-forest-deep">{formatDeliveryDate(sub.nextDeliveryOn)}</span>
              </>
            ) : sub.status === "paused" ? (
              sub.pausedUntil ? `Paused until ${formatDeliveryDate(sub.pausedUntil)}` : "Paused until you resume"
            ) : (
              "No more deliveries"
            )}
            {" · "}
            {addressLine(sub.addressSnapshot)}
          </p>
        </div>
      </div>

      {/* Due payment */}
      {due && sub.status === "active" ? (
        <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ng-clay/40 bg-ng-clay/[0.08] px-4 py-3.5 sm:mx-6">
          <div className="flex items-center gap-3">
            <Icon name="wallet-money-bold" size={22} className="text-ng-clay-deep" />
            <div>
              <p className="text-[14px] font-semibold text-ng-forest-deep">
                Delivery on {formatDeliveryDate(due.scheduledOn)} is waiting for payment
              </p>
              <p className="text-[12px] text-ng-ink-muted">If it isn&apos;t paid by then, we skip it. Nothing is charged automatically.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => void run("skip", { action: "skip" }, "Delivery skipped")}>
              Skip
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => void pay(due)}>
              {busy === "pay" ? "Opening…" : sub.paymentMethod === "cod" ? "Place order" : "Pay now"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      {live ? (
        <div className="flex flex-wrap gap-2 border-t border-ng-line-soft px-5 py-4 sm:px-6">
          {sub.status === "active" ? (
            <>
              {!due ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() => void run("skip", { action: "skip" }, `Skipped ${formatDeliveryDate(sub.nextDeliveryOn)}`)}
                >
                  <Icon name="calendar-bold" size={15} />
                  Skip next
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => setPanel(panel === "pause" ? "none" : "pause")}>
                <Icon name="clock-circle-bold" size={15} />
                Pause
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={!!busy} onClick={() => void run("resume", { action: "resume" }, "Subscription resumed")}>
              <Icon name="refresh-bold" size={15} />
              {busy === "resume" ? "Resuming…" : "Resume"}
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => setPanel(panel === "edit" ? "none" : "edit")}>
            <Icon name="pen-2-bold" size={15} />
            Edit
          </Button>
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setPanel(panel === "cancel" ? "none" : "cancel")}>
            Cancel subscription
          </Button>
        </div>
      ) : null}

      {/* Pause panel */}
      {panel === "pause" ? (
        <div className="border-t border-ng-line-soft bg-ng-cream/40 px-5 py-4 sm:px-6">
          <p className="text-[14px] font-semibold text-ng-forest-deep">Pause for how long?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "2 weeks", until: addDays(today, 14) },
              { label: "1 month", until: addDays(today, 30) },
              { label: "2 months", until: addDays(today, 60) },
              { label: "Until I resume", until: null },
            ].map((o) => (
              <Button
                key={o.label}
                size="sm"
                variant="secondary"
                disabled={!!busy}
                onClick={() =>
                  void run(
                    "pause",
                    { action: "pause", until: o.until },
                    o.until ? `Paused until ${formatDeliveryDate(o.until)}` : "Paused",
                  )
                }
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Cancel panel */}
      {panel === "cancel" ? (
        <div className="border-t border-ng-line-soft bg-ng-cream/40 px-5 py-4 sm:px-6">
          <p className="text-[14px] font-semibold text-ng-forest-deep">Cancel this subscription?</p>
          <p className="mt-1 text-[13px] text-ng-ink-muted">
            Orders already placed still arrive. You can also pause instead and come back later.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!!busy}
              onClick={() => void run("cancel", { action: "cancel" }, "Subscription cancelled")}
            >
              {busy === "cancel" ? "Cancelling…" : "Yes, cancel"}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => setPanel("none")}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}

      {/* Edit panel */}
      {panel === "edit" ? (
        <div className="border-t border-ng-line-soft bg-ng-cream/40 px-5 py-4 sm:px-6">
          <p className="text-[14px] font-semibold text-ng-forest-deep">How often</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <Button
                key={f.days}
                size="sm"
                variant={frequency === f.days ? "primary" : "secondary"}
                onClick={() => setFrequency(f.days)}
              >
                {f.short}
              </Button>
            ))}
          </div>
          <p className="mt-4 text-[14px] font-semibold text-ng-forest-deep">Quantity</p>
          <ul className="mt-2 flex flex-col gap-2">
            {sub.items
              .filter((i) => i.variantId)
              .map((i) => {
                const key = i.variantId as string;
                const q = qtys[key] ?? i.qty;
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[14px] text-ng-forest-deep">{i.title}</span>
                    <span className="flex items-center gap-1 rounded-full border border-ng-line bg-ng-paper p-1">
                      <button
                        type="button"
                        aria-label={`Fewer ${i.title}`}
                        disabled={q <= 1}
                        onClick={() => setQtys((m) => ({ ...m, [key]: Math.max(1, q - 1) }))}
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[18px] font-semibold text-ng-forest-deep disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-[14px] font-bold tabular-nums">{q}</span>
                      <button
                        type="button"
                        aria-label={`More ${i.title}`}
                        disabled={q >= 20}
                        onClick={() => setQtys((m) => ({ ...m, [key]: Math.min(20, q + 1) }))}
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-ng-forest text-[18px] font-semibold text-ng-cream disabled:opacity-40"
                      >
                        +
                      </button>
                    </span>
                  </li>
                );
              })}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={!!busy} onClick={() => void saveEdit()}>
              {busy === "edit" ? "Saving…" : "Save changes"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPanel("none")}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {/* Delivery history */}
      {upcoming.length > 0 ? (
        <div className="border-t border-ng-line-soft px-5 py-4 sm:px-6">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted">Recent deliveries</p>
          <ul className="mt-2 divide-y divide-ng-line-soft">
            {upcoming.map((d) => {
              const l = deliveryLabel(d);
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                  <span className="text-ng-forest-deep">{formatDeliveryDate(d.scheduledOn)}</span>
                  <span
                    className={cn(
                      "text-right",
                      l.tone === "good" ? "text-ng-forest" : l.tone === "warn" ? "text-ng-clay-deep" : "text-ng-ink-muted",
                    )}
                  >
                    {d.order ? (
                      <Link href={`/account/orders/${d.order.orderNumber}`} className="underline-offset-2 hover:underline">
                        {l.text}
                        {d.order.totalPaise ? ` · ${inr(d.order.totalPaise)}` : ""}
                      </Link>
                    ) : (
                      l.text
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
