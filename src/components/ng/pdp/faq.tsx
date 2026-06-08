"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { FaqItem } from "./pdp-content";

interface FaqProps {
  items: FaqItem[];
}

/**
 * Faq — "You ask, we answer" controlled accordion. Single-open behaviour,
 * keyboard-accessible buttons, reduced-motion safe (CSS grid height anim).
 */
export function Faq({ items }: FaqProps) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="mx-auto flex max-w-3xl flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <li
            key={item.q}
            className={cn(
              "overflow-hidden rounded-2xl border bg-ng-paper transition-colors",
              isOpen ? "border-ng-leaf-soft" : "border-ng-line-soft",
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[15px] font-semibold text-ng-forest-deep">{item.q}</span>
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all duration-300",
                  isOpen ? "rotate-180 bg-ng-forest text-ng-cream" : "bg-ng-sage/50 text-ng-forest",
                )}
              >
                <Icon name="alt-arrow-down-bold" size={15} />
              </span>
            </button>
            <div
              className={cn(
                "grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-[14px] leading-relaxed text-ng-ink">{item.a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
