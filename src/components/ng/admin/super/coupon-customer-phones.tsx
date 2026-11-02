"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { phoneRowProblems } from "@/lib/phone-e164";

/**
 * The mobile numbers a coupon is limited to: one box per number, with a plus
 * beside the last box for the next one.
 *
 * `value` holds what is in each box, so a half-typed number survives a re-render
 * and a blank row is the empty box the plus just added. The form turns these into
 * E.164 when it saves.
 */
export function CouponCustomerPhones({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const rows = value.length > 0 ? value : [""];
  const problems = phoneRowProblems(rows);
  // The box being typed in shows no error: "98765" isn't wrong, just unfinished.
  const [typing, setTyping] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusNewRow = useRef(false);

  useEffect(() => {
    if (!focusNewRow.current) return;
    focusNewRow.current = false;
    const inputs = listRef.current?.querySelectorAll("input");
    inputs?.[inputs.length - 1]?.focus();
  }, [rows.length]);

  function addRow() {
    focusNewRow.current = true;
    onChange([...rows, ""]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ng-ink-muted">Customer mobile numbers</span>
      <ul ref={listRef} className="flex flex-col gap-2">
        {rows.map((row, i) => {
          const problem = i === typing ? null : problems[i];
          const label = `Customer mobile number ${i + 1}`;
          return (
            <li key={i}>
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  aria-label={label}
                  aria-invalid={problem ? true : undefined}
                  value={row}
                  placeholder="+91 98xxxxxx01"
                  onFocus={() => setTyping(i)}
                  onBlur={() => setTyping(null)}
                  onChange={(e) => onChange(rows.map((r, n) => (n === i ? e.target.value : r)))}
                  onKeyDown={(e) => {
                    // Enter is the plus button, not a form submit.
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (i === rows.length - 1) addRow();
                  }}
                  className={cn(
                    "h-11 min-w-0 flex-1 px-3.5 rounded-xl bg-ng-paper border outline-none text-[14px] font-medium text-ng-ink tabular-nums placeholder:text-ng-ink-soft transition-all duration-200",
                    problem
                      ? "border-ng-danger focus:border-ng-danger"
                      : "border-ng-line focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)]",
                  )}
                />
                <button
                  type="button"
                  aria-label={`Remove ${label.toLowerCase()}`}
                  onClick={() => onChange(rows.length > 1 ? rows.filter((_, n) => n !== i) : [""])}
                  className="grid size-11 shrink-0 place-items-center rounded-xl border border-ng-line text-ng-ink-muted transition-colors hover:border-ng-danger/50 hover:text-ng-danger cursor-pointer"
                >
                  <Icon name="trash-bin-trash-bold" size={16} />
                </button>
                {i === rows.length - 1 ? (
                  <button
                    type="button"
                    aria-label="Add another mobile number"
                    onClick={addRow}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-ng-forest/40 text-ng-forest transition-colors hover:bg-ng-sage/30 cursor-pointer"
                  >
                    <Icon name="add-circle-bold" size={18} />
                  </button>
                ) : (
                  // Holds the column, so every box stays the same width.
                  <span aria-hidden className="size-11 shrink-0" />
                )}
              </div>
              {problem ? (
                <p role="alert" className="mt-1 text-[11.5px] font-medium text-ng-danger">
                  {problem}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-[11.5px] font-medium text-ng-ink-soft">
        One number per box. Each customer proves theirs with an OTP before the code applies.
      </p>
    </div>
  );
}
