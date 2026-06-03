"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, type SortKey } from "./types";

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
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-ng-line-soft bg-ng-paper py-1.5 shadow-[0_12px_40px_rgba(31,77,46,0.16)]"
        >
          {SORT_OPTIONS.map((o) => (
            <li key={o.key}>
              <button
                type="button"
                role="option"
                aria-selected={o.key === value}
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-ng-sage",
                  o.key === value ? "font-semibold text-ng-forest" : "text-ng-ink-muted",
                )}
              >
                {o.label}
                {o.key === value ? <Icon name="check-circle-bold" size={16} className="text-ng-leaf" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
