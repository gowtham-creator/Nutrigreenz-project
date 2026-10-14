"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Small, tidy form primitives for the Super Admin control center. Kept local to
 * the admin/super area so the config page stays readable. All controls use
 * ng-* tokens, the admin light theme, `cursor-pointer` on interactive bits, and
 * proper label/id wiring for accessibility.
 */

/** A labelled numeric field with an optional ₹ prefix + unit suffix. */
export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  min = 0,
  step = 1,
  id,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  hint?: string;
  min?: number;
  step?: number;
  id?: string;
}) {
  const fieldId = React.useId();
  const inputId = id ?? fieldId;
  /*
   * What the admin is typing, as text, while the field has focus.
   *
   * Bound straight to the number, the field showed "0", and typing 5 left
   * "05" on screen (then "051"): the browser keeps the typed text when it
   * parses to the same number React already holds. Editing a string draft,
   * stripped of leading zeros, and selecting the value on focus so the first
   * keystroke replaces it, makes the field behave like a normal input.
   */
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : "0");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[12.5px] font-semibold text-ng-ink-muted">
        {label}
      </label>
      <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl bg-ng-paper border border-ng-line focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200">
        {prefix ? <span className="text-[14px] font-medium text-ng-ink-muted">{prefix}</span> : null}
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={min}
          step={step}
          value={shown}
          onFocus={(e) => {
            setDraft(Number.isFinite(value) ? String(value) : "0");
            e.currentTarget.select();
          }}
          onChange={(e) => {
            // "05" -> "5", "0.5" stays, "" stays empty while typing.
            const text = e.target.value.replace(/^0+(?=\d)/, "");
            setDraft(text);
            const n = Number(text);
            onChange(text === "" || !Number.isFinite(n) ? 0 : n);
          }}
          onBlur={() => setDraft(null)}
          className="flex-1 w-full bg-transparent outline-none text-[15px] font-semibold text-ng-ink tabular-nums placeholder:text-ng-ink-soft"
        />
        {suffix ? <span className="text-[12.5px] font-medium text-ng-ink-soft shrink-0">{suffix}</span> : null}
      </div>
      {hint ? <p className="text-[11.5px] font-medium text-ng-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** An accessible on/off switch with a label + optional description. */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}) {
  const fieldId = React.useId();
  const inputId = id ?? fieldId;
  return (
    <label
      htmlFor={inputId}
      className="flex items-center justify-between gap-4 py-3 cursor-pointer select-none"
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ng-ink">{label}</span>
        {description ? (
          <span className="block text-[11.5px] font-medium text-ng-ink-soft mt-0.5">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        id={inputId}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
          checked ? "bg-ng-forest" : "bg-ng-ink-soft/35",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-md ring-1 ring-black/10 transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
    </label>
  );
}

/** A two-option segmented control (e.g. tax inclusive / exclusive). */
export function SegToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ng-ink-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex bg-ng-cream border border-ng-line-soft rounded-full p-1 self-start"
      >
        {options.map((o) => {
          const isActive = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(o.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[12.5px] transition-colors cursor-pointer",
                isActive
                  ? "bg-ng-forest-deep text-ng-cream font-semibold"
                  : "font-medium text-ng-ink-muted hover:text-ng-forest",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-[11.5px] font-medium text-ng-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** A compact text field used inside repeating rows (e.g. delivery slots). */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  id,
  className,
  readOnly,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Locks the field. Use where a change would be silently ignored on save. */
  readOnly?: boolean;
  hint?: string;
}) {
  const fieldId = React.useId();
  const inputId = id ?? fieldId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={inputId} className="text-[12.5px] font-semibold text-ng-ink-muted">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        type="text"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 px-3.5 rounded-xl bg-ng-paper border border-ng-line outline-none text-[14px] font-medium text-ng-ink placeholder:text-ng-ink-soft focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200",
          readOnly && "cursor-not-allowed bg-ng-cream/60 text-ng-ink-muted focus:border-ng-line focus:shadow-none",
        )}
      />
      {hint ? <p className="text-[11.5px] text-ng-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** A footer row for a card: a "changes apply live" note + Save / Reset. */
export function SaveBar({
  note,
  onSave,
  onReset,
  dirty,
}: {
  note?: React.ReactNode;
  onSave: () => void;
  onReset: () => void;
  dirty?: boolean;
}) {
  return (
    <div className="mt-5 pt-4 border-t border-ng-line-soft flex items-center justify-between gap-4 flex-wrap">
      <p className="text-[11.5px] font-medium text-ng-ink-soft flex items-center gap-1.5 min-w-0">
        {note ? (
          <>
            <Icon name="info-circle-bold" size={13} className="text-ng-forest shrink-0" />
            <span className="min-w-0">{note}</span>
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-cream transition-colors cursor-pointer"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer",
            dirty && "shadow-[0_4px_14px_rgba(31,77,46,0.25)]",
          )}
        >
          <Icon name="save" size={14} />
          Save{dirty ? " changes" : ""}
        </button>
      </div>
    </div>
  );
}
