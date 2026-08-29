"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { DeliverySlot } from "@/types/nutrigreenz";

export function SlotPicker({
  slots,
  selectedId,
  onSelect,
}: {
  slots: DeliverySlot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-ng-float)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-cream text-ng-forest-deep">
          <Icon name="clock-circle-bold" size={20} />
        </span>
        <div className="flex flex-col">
          <span className="ng-eyebrow text-ng-forest/70">Step 2</span>
          <h2 className="font-display text-[24px] leading-tight text-ng-forest-deep">
            Delivery slot
          </h2>
        </div>
      </div>

      <div className="grid items-stretch gap-3 sm:grid-cols-3">
        {slots.map((slot) => {
          const selected = slot.id === selectedId;
          // Live-config slots carry a separate `windowText`; legacy slots fold the
          // window into the label as "Name · Window".
          const [labelName, labelTime] = slot.label.split(" · ");
          const name = slot.windowText ? slot.label : labelName;
          const time = slot.windowText ?? labelTime;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSelect(slot.id)}
              aria-pressed={selected}
              className={cn(
                "relative h-full rounded-2xl border p-4 text-left transition-all duration-200",
                selected
                  ? "border-ng-forest bg-ng-sage/30 shadow-[0_4px_18px_rgba(102,191,115,0.16)]"
                  : "border-ng-line-soft bg-ng-paper hover:-translate-y-0.5 hover:border-ng-leaf hover:shadow-[var(--shadow-ng-card)]",
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-ng-forest text-ng-cream">
                  <Icon name="verified" size={12} />
                </span>
              ) : null}
              <div className="font-display text-[18px] text-ng-forest-deep">
                {name}
              </div>
              {time ? (
                <div className="mt-0.5 text-[13px] text-ng-ink-muted">
                  {time}
                </div>
              ) : null}
              {slot.cutoff ? (
                <div className="mt-2 text-[11px] uppercase tracking-wider text-ng-ink-soft">
                  Order by{" "}
                  <span className="font-mono tabular-nums normal-case">{slot.cutoff}</span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
