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
  /**
   * Discount percent applying to THIS size, when it is on offer.
   *
   * Set for every discounted variant, whether the markdown was inherited from
   * a product/category sale or aimed at this SKU alone.
   */
  promoPercent?: number;
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

/**
 * One variant, as a two-part card: a label band above, the money below.
 *
 * The split is what makes a grid of these scannable. With the name, the price,
 * the struck MRP, the saving and the per-litre rate all in one flat box, every
 * tile reads as six similar-sized things and the eye has to parse each one.
 * Banding the label puts the answer to "which pack is this?" on a different
 * plane from "what does it cost?", so a customer comparing six variants is
 * comparing two short columns rather than thirty-six loose values.
 */
function VariantTile({
  variant,
  active,
  label,
  onSelect,
}: {
  variant: PdpVariant;
  active: boolean;
  /** What the card is called — size, or "size · pack" when both apply. */
  label: string;
  onSelect: () => void;
}) {
  const soldOut = variant.inStock === false;
  /*
   * The campaign's own percent wins when it is known; the price gap is the
   * fallback. Deriving it is only ever an inference — rounding a ratio of two
   * rupee figures can land a whole point away from the percent the operator
   * actually entered, and "39% off" against a campaign sold as 40% is the kind
   * of mismatch a customer notices and a support inbox pays for.
   */
  const discount =
    variant.promoPercent ??
    (variant.mrp && variant.mrp > variant.price
      ? Math.round((1 - variant.price / variant.mrp) * 100)
      : 0);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={soldOut}
      aria-pressed={active}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left",
        "transition-[border-color,box-shadow,transform] duration-200 ease-out",
        /*
           Depth comes from the border, the band fill and a shallow shadow —
           never from a wash behind the numbers. A full-tile gradient was tried
           before and had to be capped at 10% to keep the per-unit line above
           4.5:1, which is too faint to register as depth anyway. Colour goes
           where no text has to survive it.

           The shadows are deliberately shallow. These tiles sit in a grid the
           customer is scanning to COMPARE, and eight strongly-lifted cards
           compete with each other instead of with the decision; the selected
           one only has to be obviously selected.
        */
        active
          ? "border-ng-forest shadow-[0_2px_8px_rgba(20,51,31,0.16)]"
          : "border-ng-line hover:border-ng-leaf hover:shadow-[0_2px_8px_rgba(20,51,31,0.10)]",
        soldOut && "cursor-not-allowed opacity-45 shadow-none hover:border-ng-line hover:shadow-none",
      )}
    >
      {/*
        Label band — the pack name, and nothing else.

        The offer briefly lived up here as a pill. It reads as a badge on a
        nameplate rather than as part of the price, and it separates the
        percentage from the two numbers that give it meaning: a bare "50% OFF"
        beside "1L · Glass" is a decoration, while "₹250 ₹500 50% off" is a
        sentence. It belongs with the money, below.

        The band keeps its own fill and a hairline foot, so it reads as a
        header for the panel under it rather than a stripe across the tile.
      */}
      <span
        className={cn(
          "w-full truncate border-b px-3.5 py-2.5 text-[13.5px] font-semibold leading-tight transition-colors duration-200",
          active
            ? "border-ng-forest-deep/40 bg-ng-forest text-ng-cream"
            : "border-ng-line/70 bg-ng-cream/60 text-ng-forest-deep group-hover:bg-ng-sage/35",
        )}
      >
        {label}
      </span>

      {/* Money — kept on plain ground. Every shaded surface on this tile is one
          no text has to survive; the figures are the thing being compared. */}
      <span className="flex w-full flex-col gap-1 px-3.5 py-2.5">
        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[16px] font-bold tabular-nums leading-none text-ng-forest-deep">
            ₹{variant.price.toLocaleString("en-IN")}
          </span>
          {variant.mrp && variant.mrp > variant.price ? (
            <span className="text-[12.5px] tabular-nums leading-none text-ng-ink-muted line-through">
              ₹{variant.mrp.toLocaleString("en-IN")}
            </span>
          ) : null}
          {discount > 0 && !soldOut ? (
            /* Third in the line, after the price and the struck MRP, because it
               is the conclusion those two are building to. Set in terracotta —
               the only warm colour on an otherwise green tile, so the eye finds
               the discounted sizes without anything needing a badge. */
            <span className="text-[12.5px] font-semibold leading-none text-[#B84329] tabular-nums">
              {discount}% off
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "text-[11.5px] tabular-nums leading-tight",
            soldOut ? "text-ng-ink-muted" : "text-ng-leaf",
          )}
        >
          {soldOut ? "Sold out" : variant.perUnit}
        </span>
      </span>
    </button>
  );
}

/**
 * VariantSelector — every buyable variant as one flat grid.
 *
 * This replaced a two-level size-then-pack picker. That version hid half the
 * catalogue behind a chip: choosing 1L showed only 1L packs, so a customer
 * could not see that the 5L tin works out cheaper per litre than the 1L bottle
 * without clicking through every size to find out. On a product whose whole
 * argument is value per litre, the comparison IS the decision, and a UI that
 * hides it is working against the sale.
 *
 * Flat, every price and per-unit rate is visible at once and the grid does the
 * comparing. The label carries both facts — "1L · Glass" — so nothing is lost
 * by dropping the second level.
 */
export function VariantSelector({ variants, activeIndex, onSelect }: VariantSelectorProps) {
  /* Include the pack in the label only when it distinguishes anything. On a
     product with one pack per size, "1L · Glass" repeats a constant on every
     tile and adds nothing but width. */
  const packs = new Set(variants.map((v) => v.pack ?? ""));
  const showPack = packs.size > 1;

  return (
    <div className="flex flex-col gap-2.5">
      <span className={LABEL}>Select variant</span>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {variants.map((v, i) => (
          <VariantTile
            key={v.sku ?? `${v.size}-${v.pack ?? ""}-${i}`}
            variant={v}
            active={i === activeIndex}
            label={showPack && v.pack ? `${v.size} · ${titleCase(v.pack)}` : v.size}
            onSelect={() => onSelect(i)}
          />
        ))}
      </div>
    </div>
  );
}
