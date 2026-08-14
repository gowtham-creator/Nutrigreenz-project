"use client";

import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";

export const NO_CANCELLATION_TEXT =
  "Because every order is freshly packed against farm lots the moment you confirm, Nutri Greenz orders cannot be cancelled or modified once placed. Returns are accepted only for damaged or incorrect items.";

/** Read-only restatement of the no-cancellation policy (used on confirmation). */
export function NoCancellationNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border border-ng-amber/40 bg-ng-amber/10 p-4",
        className,
      )}
    >
      <UiIcon
        name="caution"
        size={20}
        className="mt-0.5 shrink-0 text-ng-clay-deep"
      />
      <div>
        <p className="font-display text-[15px] text-ng-forest-deep">
          No-cancellation policy
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ng-ink-muted">
          {NO_CANCELLATION_TEXT}
        </p>
      </div>
    </div>
  );
}

/** Required acknowledgement checkbox shown before paying (§3.9). */
export function NoCancellationAck({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-6 shadow-[var(--shadow-ng-card)] transition-all duration-300",
        checked
          ? "border-ng-leaf/50 bg-ng-sage/25"
          : "border-ng-amber/40 bg-ng-amber/10",
      )}
    >
      <span className="ng-eyebrow text-ng-forest/70">Step 5 · Review &amp; confirm</span>
      <label className="mt-3 flex cursor-pointer gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-ng-forest"
        />
        <span className="flex-1">
          <span className="flex items-center gap-2 font-display text-[16px] text-ng-forest-deep">
            <Icon
              name={checked ? "check-circle-bold" : "shield-warning-bold"}
              size={18}
              className={checked ? "text-ng-leaf" : "text-ng-amber"}
            />
            I understand this order cannot be cancelled
          </span>
          <span className="mt-1.5 block text-[13px] leading-relaxed text-ng-ink-muted">
            {NO_CANCELLATION_TEXT}
          </span>
        </span>
      </label>
    </div>
  );
}
