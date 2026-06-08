"use client";

import { cn } from "@/lib/utils";

export interface PdpVariant {
  /** size label, e.g. "500ml" */
  size: string;
  /** absolute price for this variant (₹) */
  price: number;
  /** optional struck MRP */
  mrp?: number;
  /** per-unit string, e.g. "₹2.96 / ml" */
  perUnit: string;
}

interface VariantSelectorProps {
  variants: PdpVariant[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/**
 * VariantSelector — size tiles (size + price + per-unit) in the Anveshan style.
 * Variants are derived deterministically from the product upstream.
 */
export function VariantSelector({ variants, activeIndex, onSelect }: VariantSelectorProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] font-semibold uppercase tracking-wider text-ng-ink-muted">Select variant</span>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {variants.map((v, i) => {
          const active = i === activeIndex;
          const discount = v.mrp && v.mrp > v.price ? Math.round((1 - v.price / v.mrp) * 100) : 0;
          return (
            <button
              key={v.size}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={active}
              className={cn(
                "relative flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200",
                active
                  ? "border-ng-forest bg-ng-forest/[0.04] ring-1 ring-ng-forest"
                  : "border-ng-line hover:border-ng-leaf hover:-translate-y-0.5",
              )}
            >
              {discount > 0 ? (
                <span className="absolute right-2 top-2 rounded-full bg-ng-terracotta/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ng-terracotta">
                  {discount}%
                </span>
              ) : null}
              <span className="text-[14px] font-semibold text-ng-forest-deep">{v.size}</span>
              <span className="text-[15px] font-bold tabular-nums text-ng-forest-deep">
                ₹{v.price.toLocaleString()}
              </span>
              <span className="text-[11px] tabular-nums text-ng-ink-muted">{v.perUnit}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
