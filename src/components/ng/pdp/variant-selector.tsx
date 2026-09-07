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
        "transition-[border-color,box-shadow] duration-200 ease-out",
        active
          ? /* The selected card is carried by its BAND, not by a wash across
               the whole tile. A filled band plus a plain body keeps the
               numbers on white where they stay legible, which the earlier
               full-tile gradient could not do — its floor had to be capped at
               10% to keep the per-unit line above 4.5:1. Colour moved to where
               no text has to survive it. */
            "border-ng-forest shadow-[0_1px_3px_rgba(20,51,31,0.14)]"
          : "border-ng-line hover:border-ng-leaf",
        soldOut && "cursor-not-allowed opacity-45 hover:border-ng-line",
      )}
    >
      {/* Label band — the pack name, and the offer when this size has one. */}
      <span
        className={cn(
          "flex w-full items-center justify-between gap-1.5 px-3 py-2 text-[13.5px] font-semibold leading-tight transition-colors duration-200",
          active
            ? "bg-ng-forest text-ng-cream"
            : "bg-ng-cream/70 text-ng-forest-deep group-hover:bg-ng-sage/40",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        {discount > 0 && !soldOut ? (
          /*
           * The offer rides the BAND, next to the name of the size it belongs
           * to — because with per-variant pricing the discount is now a fact
           * about this pack, not about the product. A shopper scanning six
           * tiles for "which size is on offer?" reads the band; making them
           * infer it from a struck price two lines down is work.
           *
           * The inline "% off" beside the price stays. It is doing a different
           * job: this badge finds the offer, that one explains the arithmetic.
           */
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold uppercase leading-none tracking-wide tabular-nums",
              active ? "bg-ng-cream text-ng-forest-deep" : "bg-[#B84329] text-ng-paper",
            )}
          >
            {discount}% off
          </span>
        ) : null}
      </span>

      {/* Money */}
      <span className="flex w-full flex-col gap-0.5 px-3 py-2.5">
        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[16px] font-bold tabular-nums leading-none text-ng-forest-deep">
            ₹{variant.price.toLocaleString("en-IN")}
          </span>
          {variant.mrp && variant.mrp > variant.price ? (
            <span className="text-[12px] tabular-nums leading-none text-ng-ink-muted line-through">
              ₹{variant.mrp.toLocaleString("en-IN")}
            </span>
          ) : null}
          {discount > 0 && !soldOut ? (
            /* Inline beside the price it discounts, not floated in the corner.
               A corner badge made the saving a decoration on the card; here it
               is part of the sentence the prices are already making. */
            <span className="text-[12px] font-semibold leading-none text-ng-terracotta">
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
