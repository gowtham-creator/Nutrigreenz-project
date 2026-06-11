"use client";

import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/components/ng/admin/orders-data";

/**
 * Action buttons that advance an order along the pipeline (or handle the
 * off-pipeline payment-failed / refund states). State lives in the parent page
 * so the pill + pipeline update in lockstep; each action also fires a toast.
 *
 * Policy: paid orders have NO cancel action (no-cancellation policy). Refunds
 * are the only reversal path — surfaced as a small note.
 */

interface StatusActionsProps {
  status: OrderStatus;
  onChange: (next: OrderStatus) => void;
}

const ADVANCE_LABEL: Partial<Record<OrderStatus, { next: OrderStatus; label: string; icon: string }>> = {
  Paid: { next: "Packed", label: "Mark packed", icon: "box-bold" },
  Packed: { next: "Out for delivery", label: "Mark out for delivery", icon: "scooter-bold" },
  Shipped: { next: "Out for delivery", label: "Mark out for delivery", icon: "scooter-bold" },
  "Out for delivery": { next: "Delivered", label: "Mark delivered", icon: "check-circle-bold" },
};

const primaryBtn =
  "inline-flex items-center gap-2 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors";
const dangerBtn =
  "inline-flex items-center gap-2 rounded-full bg-ng-terracotta text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:opacity-90 transition-opacity";
const ghostBtn =
  "inline-flex items-center gap-2 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-cream transition-colors";

export function StatusActions({ status, onChange }: StatusActionsProps) {
  function advance(next: OrderStatus, label: string) {
    onChange(next);
    toast.success(label, { description: `Order moved to “${next}”.` });
  }

  // Off-pipeline: payment failed.
  if (status === "Payment failed") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={primaryBtn}
          onClick={() => {
            onChange("Paid");
            toast.success("Payment retried", { description: "Charge re-attempted — order moved to “Paid”." });
          }}
        >
          <Icon name="card-recive-bold" size={15} />
          Retry payment
        </button>
        <span className="text-[11.5px] font-medium text-ng-ink-soft">Awaiting a successful charge before this order can be packed.</span>
      </div>
    );
  }

  // Off-pipeline: refund requested.
  if (status === "Refund req.") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={primaryBtn}
          onClick={() => {
            onChange("Delivered");
            toast.success("Refund approved", { description: "Refund issued to the original payment method." });
          }}
        >
          <Icon name="check-circle-bold" size={15} />
          Approve refund
        </button>
        <button
          className={ghostBtn}
          onClick={() => toast("Refund declined", { description: "Customer notified with the reason." })}
        >
          <Icon name="close-circle-bold" size={15} />
          Decline
        </button>
      </div>
    );
  }

  const advanceCfg = ADVANCE_LABEL[status];
  const paidLifecycle = status === "Paid" || status === "Packed" || status === "Out for delivery" || status === "Shipped";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {advanceCfg ? (
        <button className={primaryBtn} onClick={() => advance(advanceCfg.next, advanceCfg.label)}>
          <Icon name={advanceCfg.icon} size={15} />
          {advanceCfg.label}
        </button>
      ) : null}

      {status === "Awaiting payment" ? (
        <span className="text-[11.5px] font-medium text-ng-ink-soft">Waiting on the customer to complete payment.</span>
      ) : null}

      {status === "Delivered" ? (
        <span className="inline-flex items-center gap-2 text-[12.5px] text-ng-success font-semibold">
          <Icon name="check-circle-bold" size={16} /> Fulfilled — nothing left to do.
        </span>
      ) : null}

      {/* No-cancellation policy note for paid orders. */}
      {paidLifecycle ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ng-ink-soft rounded-full bg-ng-cream border border-ng-line-soft px-3 py-1.5",
          )}
        >
          <Icon name="lock-keyhole-minimalistic-bold" size={13} className="text-ng-clay-deep" />
          No cancellation for paid orders — use refund if needed.
        </span>
      ) : null}
    </div>
  );
}
