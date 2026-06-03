"use client";

import { Card } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { AdminOrderEvent } from "@/components/ng/admin/orders-data";

/** Vertical activity timeline — done events show a check, pending are muted. */
export function ActivityTimeline({ timeline }: { timeline: AdminOrderEvent[] }) {
  return (
    <Card title="Activity">
      <ol className="relative pl-1">
        {timeline.map((ev, i) => {
          const last = i === timeline.length - 1;
          return (
            <li key={`${ev.label}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && (
                <span
                  className={cn(
                    "absolute left-[11px] top-6 bottom-0 w-px",
                    ev.done ? "bg-ng-forest/40" : "bg-ng-line-soft",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 size-6 rounded-full flex items-center justify-center shrink-0 border",
                  ev.done
                    ? "bg-ng-forest text-ng-cream border-ng-forest"
                    : "bg-ng-cream text-ng-ink-soft border-ng-line-soft",
                )}
              >
                {ev.done ? <Icon name="check-read-linear" size={13} /> : <span className="size-1.5 rounded-full bg-ng-ink-soft/50" />}
              </span>
              <div className="min-w-0 -mt-0.5">
                <div className={cn("text-[13px]", ev.done ? "text-ng-ink font-medium" : "text-ng-ink-soft")}>
                  {ev.label}
                </div>
                <div className="text-[11px] text-ng-ink-soft mt-0.5 font-mono">{ev.at}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
