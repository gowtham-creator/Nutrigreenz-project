"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { STATUS_FLOW, type OrderStatus } from "@/components/ng/admin/orders-data";

/**
 * Horizontal operator pipeline (Awaiting payment → Paid → Packed → Out for
 * delivery → Delivered). Off-pipeline states (Payment failed / Refund req. /
 * Shipped) are handled by the detail page; here we map them to the nearest
 * pipeline node so the stepper still renders sensibly.
 */

/** Map any status onto its index in STATUS_FLOW for stepper rendering. */
function pipelineIndex(status: OrderStatus): number {
  const direct = STATUS_FLOW.indexOf(status);
  if (direct !== -1) return direct;
  // Off-pipeline mapping.
  if (status === "Shipped") return STATUS_FLOW.indexOf("Out for delivery");
  if (status === "Refund req.") return STATUS_FLOW.indexOf("Delivered");
  if (status === "Payment failed") return STATUS_FLOW.indexOf("Awaiting payment");
  return 0;
}

export function StatusPipeline({ status }: { status: OrderStatus }) {
  const currentIdx = pipelineIndex(status);
  const offPipeline = !STATUS_FLOW.includes(status);

  return (
    <ol className="flex items-center gap-0">
      {STATUS_FLOW.map((step, i) => {
        const isDone = i < currentIdx || (i === currentIdx && !offPipeline && status === "Delivered");
        const completed = i < currentIdx;
        const isCurrent = i === currentIdx && !offPipeline;
        const last = i === STATUS_FLOW.length - 1;

        return (
          <li key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <span
                className={cn(
                  "size-9 rounded-full flex items-center justify-center text-[13px] font-bold border transition-colors",
                  completed
                    ? "bg-ng-forest text-ng-cream border-ng-forest"
                    : isCurrent
                      ? "bg-ng-leaf/20 text-ng-forest-deep border-ng-leaf ring-4 ring-ng-leaf/15"
                      : "bg-ng-cream text-ng-ink-soft border-ng-line-soft",
                )}
              >
                {completed ? <Icon name="check-circle-bold" size={18} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] text-center leading-tight max-w-[78px]",
                  isCurrent ? "text-ng-forest-deep font-semibold" : completed ? "text-ng-ink" : "text-ng-ink-soft",
                )}
              >
                {step}
              </span>
            </div>
            {!last && (
              <span
                className={cn(
                  "h-0.5 flex-1 mx-2 -mt-6 rounded-full transition-colors",
                  i < currentIdx ? "bg-ng-forest" : "bg-ng-line-soft",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
