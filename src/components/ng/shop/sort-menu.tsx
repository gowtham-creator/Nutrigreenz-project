"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, type SortKey } from "./types";

/**
 * The glyph for what each sort DOES, so the menu is scannable by shape.
 *
 * Every name here is one already rendering elsewhere in the app (or in the
 * local UI registry) rather than a plausible-looking Solar name — an icon that
 * does not resolve fails silently to an empty box, which is worse than the
 * plain list this replaces.
 */
const SORT_ICONS: Record<SortKey, string> = {
  featured: "medal-ribbon-star-bold",
  // The two price options are the only rows where DIRECTION is the whole
  // meaning, so they take the weightier disc arrows; the rest keep the lighter
  // Solar glyphs, which is what stops the menu turning into a row of discs.
  "price-asc": "arrowUpDisc",
  "price-desc": "arrowDownDisc",
  rating: "star",
  newest: "calendar-minimalistic-bold",
};

interface SortMenuProps {
  value: SortKey;
  onChange: (value: SortKey) => void;
  className?: string;
}

export function SortMenu({ value, onChange, className }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((o) => o.key === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-ng-line bg-ng-paper px-4 py-2.5 text-[13px] font-medium text-ng-forest transition-colors hover:border-ng-leaf"
      >
        <Icon name="sort-vertical-linear" size={16} />
        <span className="text-ng-ink-muted">Sort:</span>
        <span>{current.label}</span>
        <Icon name="alt-arrow-down-linear" size={15} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-ng-line-soft bg-ng-paper p-1.5 shadow-[0_12px_40px_rgba(31,77,46,0.16)]"
        >
          {/* A quiet header, so the list reads as a set of choices rather than
              as five unrelated links. */}
          <li
            className="px-3.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ng-ink-soft"
            aria-hidden
          >
            Sort by
          </li>
          {SORT_OPTIONS.map((o) => {
            const active = o.key === value;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors",
                    active
                      ? "bg-ng-forest text-ng-cream"
                      : "text-ng-ink hover:bg-ng-sage/60",
                  )}
                >
                  {/*
                    Each option carries the glyph for what it DOES, so the list
                    is scannable by shape before it is read. Previously every
                    row was identical text, which is why the menu felt generic
                    and why "low to high" versus "high to low" needed reading
                    rather than glancing.
                  */}
                  <Icon
                    name={SORT_ICONS[o.key]}
                    size={15}
                    className={cn(
                      "shrink-0 transition-colors",
                      active ? "text-ng-cream" : "text-ng-clay",
                    )}
                  />
                  <span className={cn("flex-1", active && "font-semibold")}>{o.label}</span>
                  {active ? (
                    <Icon name="check-circle-bold" size={15} className="shrink-0 text-ng-cream" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
