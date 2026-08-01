"use client";

import { cn } from "@/lib/utils";

export interface PdpVariant {
  /** Real catalog variant id — present for DB-backed variants, absent for derived. */
  id?: string;
  /** Catalog SKU, when known. */
  sku?: string;
  /** size label, e.g. "500ml", "1L", "250g" */
  size: string;
  /** packaging: "glass" | "plastic" | "tin" | "bag" | null */
  pack?: string | null;
  /** absolute price for this variant (₹) */
  price: number;
  /** optional struck MRP */
  mrp?: number;
  /** per-unit string, e.g. "₹2.96 / ml" */
  perUnit: string;
  /** false when this exact variant is sold out (defaults to in-stock) */
  inStock?: boolean;
  /** Optional per-variant image URL; when set the gallery leads with it. */
  imageUrl?: string | null;
}

interface VariantSelectorProps {
  variants: PdpVariant[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const LABEL = "text-[13px] font-semibold uppercase tracking-wider text-ng-ink-muted";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** A single price tile — used for the flat size grid and the per-size pack grid. */
function VariantTile({
  variant,
  active,
  label,
  onSelect,
}: {
  variant: PdpVariant;
  active: boolean;
  /** What the tile leads with (the size, or the pack name in grouped mode). */
  label: string;
  onSelect: () => void;
}) {
  const soldOut = variant.inStock === false;
  const discount =
    variant.mrp && variant.mrp > variant.price
      ? Math.round((1 - variant.price / variant.mrp) * 100)
      : 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={soldOut}
      aria-pressed={active}
      className={cn(
        "relative flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200",
        active
          ? "border-ng-forest bg-ng-forest/[0.06]"
          : "border-ng-line hover:border-ng-leaf hover:bg-ng-sage/10",
        soldOut && "cursor-not-allowed opacity-45 hover:border-ng-line hover:bg-transparent",
      )}
    >
      {discount > 0 && !soldOut ? (
        <span className="absolute right-2 top-2 rounded-full bg-ng-terracotta/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ng-terracotta">
          {discount}%
        </span>
      ) : null}
      <span className="text-[14px] font-semibold text-ng-forest-deep">{label}</span>
      <span className="text-[15px] font-bold tabular-nums text-ng-forest-deep">
        ₹{variant.price.toLocaleString()}
      </span>
      <span className="text-[11px] tabular-nums text-ng-ink-muted">
        {soldOut ? "Sold out" : variant.perUnit}
      </span>
    </button>
  );
}

/**
 * VariantSelector — size × pack picker in a two-level size-then-pack style.
 *
 * When a size offers more than one pack (e.g. an oil's 1L glass vs 1L plastic),
 * it renders a two-level UI: a row of SIZE chips, then a grid of PACK tiles for
 * the chosen size. Otherwise (single pack per size, or derived demo variants) it
 * falls back to a flat grid of size tiles.
 */
export function VariantSelector({ variants, activeIndex, onSelect }: VariantSelectorProps) {
  const sizes = [...new Set(variants.map((v) => v.size))];
  const grouped = sizes.some((s) => variants.filter((v) => v.size === s).length > 1);

  if (!grouped) {
    return (
      <div className="flex flex-col gap-2.5">
        <span className={LABEL}>Select variant</span>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {variants.map((v, i) => (
            <VariantTile
              key={v.sku ?? `${v.size}-${v.pack ?? ""}`}
              variant={v}
              active={i === activeIndex}
              label={v.size}
              onSelect={() => onSelect(i)}
            />
          ))}
        </div>
      </div>
    );
  }

  const active = variants[activeIndex] ?? variants[0];
  const selectedSize = active?.size;
  const packsForSize = variants
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.size === selectedSize);

  /** First (preferably in-stock) variant index for a given size. */
  const firstIndexForSize = (size: string): number => {
    const inStock = variants.findIndex((v) => v.size === size && v.inStock !== false);
    return inStock >= 0 ? inStock : variants.findIndex((v) => v.size === size);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <span className={LABEL}>Size</span>
        <div className="flex flex-wrap gap-2.5">
          {sizes.map((s) => {
            const isActive = s === selectedSize;
            const sizeSoldOut = variants
              .filter((v) => v.size === s)
              .every((v) => v.inStock === false);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSelect(firstIndexForSize(s))}
                aria-pressed={isActive}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
                  isActive
                    ? "border-ng-forest bg-ng-forest text-ng-cream"
                    : "border-ng-line text-ng-forest hover:border-ng-leaf hover:bg-ng-sage",
                  sizeSoldOut && !isActive && "opacity-50",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={LABEL}>Pack</span>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {packsForSize.map(({ v, i }) => (
            <VariantTile
              key={v.sku ?? `${v.size}-${v.pack ?? ""}`}
              variant={v}
              active={i === activeIndex}
              label={v.pack ? titleCase(v.pack) : v.size}
              onSelect={() => onSelect(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
