"use client";

import { Card, StatTile } from "@/components/ng/admin/admin-shell";
import { HBars, Pipeline, STAGE_TONE, compareFigures } from "@/components/ng/admin/viz";
import { cn } from "@/lib/utils";
import { PERIOD_COMPARISON, PERIOD_LABEL } from "@/lib/order-periods";
import type { PeriodSummary } from "@/lib/order-summary";
import { formatPaise, ORDER_STATUS_FLOW, STATUS_LABEL } from "@/app/admin/orders/portal-data";

/**
 * Rupees for a headline tile: whole rupees, then lakh / crore, so the figure
 * fits half a phone screen. Exact amounts stay in the line under the status.
 */
function inrShort(paise: number): string {
  const rupees = Math.round(paise / 100);
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * One period of the Orders portal (today, this week or this month): the
 * headline figures against the previous period up to the same point, where the
 * orders stand, and which delivery slots they chose. Week and month add the
 * orders per day.
 */
export function OrderSummaryPanel({ summary }: { summary: PeriodSummary }) {
  const against = PERIOD_COMPARISON[summary.key];
  const num = (n: number) => n.toLocaleString("en-IN");

  /** StatTile props comparing a figure with the previous period to date. */
  const vs = (
    current: number,
    previous: number,
    fmt: (v: number) => string,
    goodWhen: "up" | "down" = "up",
  ) => {
    const change = compareFigures(current, previous, goodWhen);
    if (!change) return { note: previous === 0 ? `none ${against}` : undefined };
    return { delta: change.text, trend: change.direction, sentiment: change.sentiment, note: `vs ${fmt(previous)} ${against}` };
  };

  const stages = [
    ...ORDER_STATUS_FLOW.map((s) => ({ label: STATUS_LABEL[s], value: summary.byStatus[s] ?? 0, tone: STAGE_TONE[s as keyof typeof STAGE_TONE] })),
    { label: STATUS_LABEL.cancelled, value: summary.byStatus.cancelled ?? 0, tone: "terracotta" as const },
  ];
  const kept = summary.orders - summary.cancelled;
  const toCollect = summary.bookedPaise - summary.collectedPaise;
  const empty = summary.orders === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Orders" value={num(summary.orders)} {...vs(summary.orders, summary.previous.orders, num)} />
        <StatTile
          label="Order value"
          value={inrShort(summary.bookedPaise)}
          {...vs(summary.bookedPaise, summary.previous.bookedPaise, inrShort)}
        />
        <StatTile
          label="Delivered"
          value={num(summary.delivered)}
          delta={kept > 0 ? `of ${num(kept)} not cancelled` : undefined}
        />
        <StatTile
          label="Cancelled"
          value={num(summary.cancelled)}
          {...vs(summary.cancelled, summary.previous.cancelled, num, "down")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Order status · ${PERIOD_LABEL[summary.key].toLowerCase()}`}>
          {empty ? (
            <p className="py-6 text-center text-[13px] font-medium text-ng-ink-soft">No orders placed yet.</p>
          ) : (
            <>
              <Pipeline stages={stages} />
              <p className="mt-4 border-t border-ng-line-soft pt-3 text-[12.5px] font-medium text-ng-ink-muted">
                {formatPaise(summary.collectedPaise)} collected
                {toCollect > 0
                  ? ` · ${formatPaise(toCollect)} still to collect on ${num(summary.paymentPending)} order${summary.paymentPending === 1 ? "" : "s"}`
                  : ""}
                {kept > 0 ? ` · average order ${formatPaise(summary.avgOrderPaise)}` : ""}
              </p>
            </>
          )}
        </Card>

        <Card title={summary.key === "today" ? "By delivery slot · today" : "Orders per day"}>
          {summary.key === "today" ? (
            <SlotBreakdown summary={summary} />
          ) : (
            <>
              <DayBars days={summary.daily} />
              {summary.slots.length > 0 ? (
                <div className="mt-5 border-t border-ng-line-soft pt-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
                    By delivery slot
                  </div>
                  <SlotBreakdown summary={summary} />
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function SlotBreakdown({ summary }: { summary: PeriodSummary }) {
  if (summary.slots.length === 0) {
    return <p className="py-6 text-center text-[13px] font-medium text-ng-ink-soft">No orders placed yet.</p>;
  }
  return (
    <HBars
      tone="stage3"
      rows={summary.slots.map((s) => ({
        label: s.label,
        value: s.orders,
        hint: s.orders === 1 ? "order" : "orders",
      }))}
    />
  );
}

/** Orders per IST day: a bar each, today's in full colour, count above. */
function DayBars({ days }: { days: PeriodSummary["daily"] }) {
  const max = Math.max(1, ...days.map((d) => d.orders));
  const many = days.length > 10;
  const label = (day: string) => {
    const d = new Date(`${day}T00:00:00Z`);
    return many
      ? String(d.getUTCDate())
      : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
  };
  if (days.every((d) => d.orders === 0)) {
    return <p className="py-6 text-center text-[13px] font-medium text-ng-ink-soft">No orders placed yet.</p>;
  }
  return (
    <div
      role="img"
      aria-label={days.map((d) => `${d.day}: ${d.orders} order${d.orders === 1 ? "" : "s"}`).join(", ")}
      className="flex h-44 items-stretch gap-[3px]"
    >
      {days.map((d, i) => {
        const isToday = i === days.length - 1;
        // Scaled to 85% so the count above the tallest bar still fits.
        const pct = d.orders > 0 ? Math.max(3, (d.orders / max) * 85) : 0;
        const showCount = d.orders > 0 && (!many || isToday || d.orders === max);
        return (
          <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="relative w-full flex-1">
              <div
                title={`${d.orders} order${d.orders === 1 ? "" : "s"} · ${formatPaise(d.bookedPaise)}`}
                className={cn("absolute inset-x-0 bottom-0 rounded-t-[3px]", d.orders === 0 && "bg-ng-line-soft")}
                style={{
                  height: d.orders > 0 ? `${pct}%` : "2px",
                  background: d.orders > 0 ? (isToday ? "var(--ng-viz-stage-4)" : "var(--ng-viz-stage-2)") : undefined,
                }}
              />
              {showCount ? (
                <span
                  className="absolute inset-x-0 text-center font-mono text-[10.5px] font-semibold tabular-nums text-ng-forest-deep"
                  style={{ bottom: `calc(${pct}% + 2px)` }}
                >
                  {d.orders}
                </span>
              ) : null}
            </div>
            <span className={cn("text-[10.5px] font-medium", isToday ? "font-semibold text-ng-ink" : "text-ng-ink-soft")}>
              {label(d.day)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
