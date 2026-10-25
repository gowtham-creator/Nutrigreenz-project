"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import {
  ADVANCE_LABEL,
  CANCELLABLE_STATUSES,
  ORDER_STATUS_FLOW,
  STATUS_LABEL,
  formatDateTime,
  formatPaise,
  nextStatus,
  statusRank,
  type Order,
  type OrderStatus,
} from "./portal-data";

/**
 * Fulfilment stepper for the order detail view.
 *
 * Renders the pipeline placed → confirmed → packed → shipped → delivered with the
 * completed stages filled in, and a single primary action that advances the order
 * to the NEXT stage by calling `POST /api/admin/orders/[id]/status`. There is no
 * way to go backward. Until delivery, a secondary "Cancel order" opens an inline
 * confirmation that calls `POST /api/admin/orders/[id]/cancel`; it is inline, not
 * a dialog, so the order it acts on stays in view while the operator decides.
 * Delivered and cancelled are terminal and show no action.
 */
export function StatusStepper({
  order,
  onAdvanced,
}: {
  order: Order;
  onAdvanced: (updated: Order) => void;
}) {
  const [busy, setBusy] = useState(false);
  const cancelled = order.status === "cancelled";
  // A cancelled order keeps the stages it reached, read from its history.
  const currentRank = cancelled
    ? Math.max(0, ...order.events.map((e) => statusRank(e.status)))
    : statusRank(order.status);
  const target = nextStatus(order.status);
  const cancellable = CANCELLABLE_STATUSES.includes(order.status);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function advance() {
    if (!target || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(order.orderNumber)}/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: target }),
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        order?: Order;
        error?: string;
      };
      if (!res.ok || data.ok === false || !data.order) {
        throw new Error(data.error || "request-failed");
      }
      onAdvanced(data.order);
      toast.success(`Order moved to ${STATUS_LABEL[target]}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update status";
      toast.error(
        message === "not-forward"
          ? "That status change isn't allowed. Orders can only move forward."
          : "Couldn't update the order status. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Pipeline */}
      <ol className="flex items-center">
        {ORDER_STATUS_FLOW.map((stage, idx) => {
          const stageRank = idx;
          const done = stageRank < currentRank;
          const active = stageRank === currentRank;
          const reached = stageRank <= currentRank;
          return (
            <li key={stage} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "size-9 rounded-full flex items-center justify-center border-2 transition-colors",
                    cancelled
                      ? reached
                        ? "bg-ng-line border-ng-line text-ng-ink-muted"
                        : "bg-ng-paper border-ng-line-soft text-ng-ink-muted"
                      : [
                          done && "bg-ng-forest border-ng-forest text-ng-cream",
                          active && "bg-ng-forest-deep border-ng-forest-deep text-ng-cream",
                          !reached && "bg-ng-paper border-ng-line-soft text-ng-ink-muted",
                        ],
                  )}
                >
                  {done ? (
                    <UiIcon name="verified" size={18} />
                  ) : (
                    <span className="text-[13px] font-bold tabular-nums">{idx + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap",
                    reached && !cancelled ? "text-ng-forest-deep" : "text-ng-ink-muted",
                  )}
                >
                  {STATUS_LABEL[stage]}
                </span>
              </div>
              {idx < ORDER_STATUS_FLOW.length - 1 ? (
                <span
                  className={cn(
                    "h-0.5 flex-1 mx-2 mb-6 rounded-full transition-colors",
                    stageRank < currentRank ? (cancelled ? "bg-ng-line" : "bg-ng-forest") : "bg-ng-line-soft",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Forward-only action, with cancel as the quieter second choice. */}
      <div className="mt-7 pt-5 border-t border-ng-line-soft flex items-center justify-between gap-4 flex-wrap">
        {cancelled ? (
          <CancelledNote order={order} />
        ) : target ? (
          <>
            <p className="text-[12.5px] font-medium text-ng-ink-muted">
              Next step: move this order to{" "}
              <span className="font-semibold text-ng-forest-deep">
                {STATUS_LABEL[target]}
              </span>
              . This can&rsquo;t be undone.
            </p>
            <div className="flex items-center gap-2 shrink-0">
            {cancellable && !cancelOpen ? (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
                className="inline-flex items-center rounded-full px-4 py-2.5 text-[13px] font-semibold text-ng-danger transition-colors hover:bg-ng-danger/10 disabled:opacity-50"
              >
                Cancel order
              </button>
            ) : null}
            <button
              type="button"
              onClick={advance}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-5 py-2.5 text-[13px] transition-colors shrink-0",
                busy ? "opacity-60 cursor-not-allowed" : "hover:bg-ng-forest",
              )}
            >
              <Icon name={busy ? "refresh-bold" : "arrow-right-linear"} size={15} />
              {busy ? "Updating…" : (ADVANCE_LABEL[target] satisfies string)}
            </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5 text-ng-success">
            <UiIcon name="verified" size={20} />
            <span className="text-[13px] font-semibold">
              Order delivered. Nothing left to do.
            </span>
          </div>
        )}
      </div>

      {cancellable && cancelOpen ? (
        <CancelPanel
          order={order}
          onClose={() => setCancelOpen(false)}
          onCancelled={(updated) => {
            setCancelOpen(false);
            onAdvanced(updated);
          }}
        />
      ) : null}
    </div>
  );
}

/** Who cancelled, when, and the reason the customer was given. */
function CancelledNote({ order }: { order: Order }) {
  const ev = [...order.events].reverse().find((e) => e.status === "cancelled");
  return (
    <div className="flex items-start gap-2.5 text-ng-ink-muted">
      <Icon name="close-circle-bold" size={20} className="mt-px shrink-0" />
      <div className="text-[13px] leading-relaxed">
        <p className="font-semibold text-ng-forest-deep">
          Order cancelled{ev ? ` by ${ev.by}, ${formatDateTime(ev.at)}` : ""}.
        </p>
        {ev?.note ? <p>Reason given to the customer: {ev.note}</p> : null}
        {order.paymentStatus === "paid" ? (
          <p className="font-semibold text-ng-danger">
            Paid {formatPaise(order.totalPaise)}. Refund it in the payment gateway if you haven&rsquo;t.
          </p>
        ) : null}
      </div>
    </div>
  );
}

const CANCEL_ERRORS: Record<string, string> = {
  "not-cancellable": "This order can't be cancelled any more.",
  "payment-pending": "The online payment is still pending. Cancel once it has gone through or failed.",
  unavailable: "Cancelling isn't switched on yet: the database update hasn't been applied.",
};

/**
 * The inline confirmation under the actions: what cancelling does, an optional
 * reason for the customer, and the two choices side by side.
 */
function CancelPanel({
  order,
  onClose,
  onCancelled,
}: {
  order: Order;
  onClose: () => void;
  onCancelled: (updated: Order) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const paymentPending = order.paymentMethod === "upi" && order.paymentStatus === "pending";
  const paidOnline = order.paymentMethod === "upi" && order.paymentStatus === "paid";

  async function cancel() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.orderNumber)}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; order?: Order; error?: string };
      if (!res.ok || data.ok === false || !data.order) throw new Error(data.error || "request-failed");
      onCancelled(data.order);
      toast.success(`Order ${order.orderNumber} cancelled`, {
        description: order.userEmail ? "The customer and the team have been emailed." : "The team has been emailed.",
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      toast.error(CANCEL_ERRORS[code] ?? "Couldn't cancel the order. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="group"
      aria-label={`Cancel order ${order.orderNumber}`}
      className="mt-4 rounded-2xl border border-ng-danger/30 bg-ng-danger/[0.04] p-4"
    >
      <p className="text-[13.5px] font-semibold text-ng-forest-deep">Cancel {order.orderNumber}?</p>
      {paymentPending ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-ng-ink-muted">
          The online payment is still pending. Cancel once it has gone through or failed, so a late
          payment can&rsquo;t land on a cancelled order.
        </p>
      ) : (
        <>
          <ul className="mt-1.5 space-y-0.5 text-[12.5px] leading-relaxed text-ng-ink-muted">
            <li>Its stock, coupon and loyalty points go back.</li>
            <li>{order.userEmail ? "The customer and the team get an email." : "The team gets an email. This order has no customer email."}</li>
            {paidOnline ? (
              <li className="font-semibold text-ng-danger">
                It was paid online. Refund {formatPaise(order.totalPaise)} in the payment gateway; cancelling doesn&rsquo;t move money.
              </li>
            ) : null}
          </ul>
          <label className="mt-3 block text-[12px] font-semibold text-ng-forest-deep" htmlFor={`cancel-reason-${order.id}`}>
            Reason <span className="font-normal text-ng-ink-muted">(optional, included in the customer&rsquo;s email)</span>
          </label>
          <textarea
            id={`cancel-reason-${order.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="For example: this item is out of stock for your delivery slot."
            className="mt-1.5 w-full resize-y rounded-xl border border-ng-line bg-ng-paper px-3 py-2 text-[13px] text-ng-ink outline-none focus:border-ng-forest"
          />
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-full px-4 py-2 text-[13px] font-semibold text-ng-forest-deep transition-colors hover:bg-ng-line-soft"
        >
          Keep order
        </button>
        {paymentPending ? null : (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className={cn(
              "rounded-full bg-ng-danger px-4 py-2 text-[13px] font-semibold text-ng-paper transition-opacity",
              busy ? "cursor-not-allowed opacity-60" : "hover:opacity-90",
            )}
          >
            {busy ? "Cancelling…" : "Cancel order"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Stand-alone forward-only check for a target status (mirrors the server). */
export function isForwardOnly(current: OrderStatus, next: OrderStatus): boolean {
  return statusRank(next) > statusRank(current);
}
