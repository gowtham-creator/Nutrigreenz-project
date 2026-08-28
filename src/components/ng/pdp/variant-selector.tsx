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
      /*
       * Shading, not a flat fill.
       *
       * Both states were flat washes — 6% forest when selected, 10% sage on
       * hover — and at that strength on a cream card neither registered: the
       * chosen pack looked the same as the two beside it. A soft top-to-bottom
       * gradient reads as a *shaded* surface rather than a tinted rectangle,
       * so the tile picks up a little depth and the eye lands on it without
       * the colour having to shout.
       *
       * Deliberately restrained. This sits directly under the price and the
       * Add to cart button, and a strongly filled tile would compete with the
       * one control on the page that matters more.
       *
       * Transitions name their properties rather than using `all`, so the
       * disabled state and the layout are never animated by accident.
       */
      className={cn(
        "relative flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left",
        "transition-[background-image,background-color,border-color,box-shadow] duration-200 ease-out",
        active
          ? // Selected: forest shading, deepest at the foot, with a hairline
            // inner highlight along the top edge so it reads as lit from above.
            //
            // The floor is capped at 10% forest, and that number is measured
            // rather than chosen by eye: the per-unit line at the BOTTOM of the
            // tile is `ng-ink-muted`, which sits exactly where the gradient is
            // deepest. At 16% it fell to 4.02:1 and failed WCAG AA; 10% holds
            // it at 4.52:1. The heading and price are near-black and clear
            // 12:1 either way, so this cap is set entirely by the small grey
            // line — deepen it and that text goes first.
            "border-ng-forest bg-gradient-to-b from-ng-forest/[0.03] via-ng-forest/[0.06] to-ng-forest/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_2px_rgba(20,51,31,0.10)]"
          : // Unselected: nothing until pointed at, then the same shape of
            // shading in sage so hover previews what selection will look like.
            // Capped at 35% for the same reason (4.50:1 at the floor).
            "border-ng-line hover:border-ng-leaf hover:bg-gradient-to-b hover:from-ng-sage/15 hover:to-ng-sage/35",
        soldOut &&
          "cursor-not-allowed opacity-45 hover:border-ng-line hover:bg-none hover:from-transparent hover:to-transparent",
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
                /* The size chip keeps its solid fill when chosen — size is the
                   primary choice and pack the refinement, so the hierarchy is
                   worth preserving. Only the hover gains the same shading as
                   the tiles below, so the two rows feel like one control. */
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-2 text-[13px] font-semibold",
                  "transition-[background-image,background-color,border-color,box-shadow] duration-200 ease-out",
                  isActive
                    ? "border-ng-forest bg-gradient-to-b from-ng-forest to-ng-forest-deep text-ng-cream shadow-[inset_0_1px_0_rgba(245,242,224,0.18)]"
                    : "border-ng-line text-ng-forest hover:border-ng-leaf hover:bg-gradient-to-b hover:from-ng-sage/35 hover:to-ng-sage/70",
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
