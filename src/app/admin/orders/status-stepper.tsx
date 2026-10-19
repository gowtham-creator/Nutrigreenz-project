"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import {
  ADVANCE_LABEL,
  ORDER_STATUS_FLOW,
  STATUS_LABEL,
  nextStatus,
  statusRank,
  type Order,
  type OrderStatus,
} from "./portal-data";

/**
 * Forward-only fulfilment stepper for the order detail view.
 *
 * Renders the pipeline placed → confirmed → packed → shipped → delivered with the
 * completed stages filled in, and a single primary action that advances the order
 * to the NEXT stage by calling `POST /api/admin/orders/[id]/status`. There is no
 * way to go backward and deliberately NO cancel/refund control (§3.9). Once the
 * order is delivered the stepper shows a terminal "fulfilled" state with no action.
 */
export function StatusStepper({
  order,
  onAdvanced,
}: {
  order: Order;
  onAdvanced: (updated: Order) => void;
}) {
  const [busy, setBusy] = useState(false);
  const currentRank = statusRank(order.status);
  const target = nextStatus(order.status);

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
                    done && "bg-ng-forest border-ng-forest text-ng-cream",
                    active && "bg-ng-forest-deep border-ng-forest-deep text-ng-cream",
                    !reached && "bg-ng-paper border-ng-line-soft text-ng-ink-muted",
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
                    reached ? "text-ng-forest-deep" : "text-ng-ink-muted",
                  )}
                >
                  {STATUS_LABEL[stage]}
                </span>
              </div>
              {idx < ORDER_STATUS_FLOW.length - 1 ? (
                <span
                  className={cn(
                    "h-0.5 flex-1 mx-2 mb-6 rounded-full transition-colors",
                    stageRank < currentRank ? "bg-ng-forest" : "bg-ng-line-soft",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Forward-only action — no cancel/refund (§3.9). */}
      <div className="mt-7 pt-5 border-t border-ng-line-soft flex items-center justify-between gap-4 flex-wrap">
        {target ? (
          <>
            <p className="text-[12.5px] font-medium text-ng-ink-muted">
              Next step: move this order to{" "}
              <span className="font-semibold text-ng-forest-deep">
                {STATUS_LABEL[target]}
              </span>
              . This can&rsquo;t be undone.
            </p>
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
    </div>
  );
}

/** Stand-alone forward-only check for a target status (mirrors the server). */
export function isForwardOnly(current: OrderStatus, next: OrderStatus): boolean {
  return statusRank(next) > statusRank(current);
}
