"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Chip } from "@/components/ng/chip";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import type { ProductCard } from "@/types/nutrigreenz";

interface Variant {
  label: string;
  priceDelta?: number; // added to base price
}

interface BuyBoxProps {
  title: string;
  basePrice: number;
  mrp?: number;
  unit?: string;
  variants: Variant[];
  /** Full product record — when provided, Add to cart wires into the real cart. */
  product?: ProductCard;
}

const SUBSCRIBE_RATE = 0.08;

/**
 * BuyBox — weight/variant chips, quantity stepper, add-to-cart (placeholder toast),
 * wishlist toggle, and a Subscribe & save option. No real cart hook yet.
 */
export function BuyBox({ title, basePrice, mrp, unit, variants, product }: BuyBoxProps) {
  const { addItem } = useCart();
  const [variantIdx, setVariantIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [subscribe, setSubscribe] = useState(false);
  const [wished, setWished] = useState(false);

  const variant = variants[variantIdx] ?? variants[0];
  const unitPrice = basePrice + (variant?.priceDelta ?? 0);
  const effectiveUnit = subscribe ? Math.round(unitPrice * (1 - SUBSCRIBE_RATE)) : unitPrice;
  const lineTotal = effectiveUnit * qty;
  const discount = mrp && mrp > unitPrice ? Math.round((1 - unitPrice / mrp) * 100) : 0;

  const addToCart = () => {
    if (product) addItem(product, qty);
    toast.success("Added to bag", {
      description: `${qty} × ${title}${variant ? ` · ${variant.label}` : ""}${subscribe ? " · Subscription" : ""}`,
    });
  };

  const toggleWishlist = () => {
    setWished((w) => {
      const next = !w;
      toast.success(next ? "Saved to wishlist" : "Removed from wishlist", {
        description: title,
      });
      return next;
    });
  };

  const savings = mrp && mrp > effectiveUnit ? mrp - effectiveUnit : 0;

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-ng-line-soft bg-ng-paper p-5 shadow-[var(--shadow-ng-card)] sm:p-6">
      {/* Price */}
      <div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="font-display text-[40px] leading-none text-ng-forest-deep tabular-nums">
            ₹{effectiveUnit.toLocaleString()}
          </span>
          {mrp && mrp > unitPrice ? (
            <span className="text-lg text-ng-ink-muted line-through tabular-nums">₹{mrp.toLocaleString()}</span>
          ) : null}
          {discount > 0 && !subscribe ? (
            <span className="rounded-full bg-ng-terracotta/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wider text-ng-terracotta">
              {discount}% off
            </span>
          ) : null}
          {subscribe ? (
            <span className="rounded-full bg-ng-leaf/20 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wider text-ng-forest">
              Subscriber price
            </span>
          ) : null}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ng-ink-muted">
          <span>Inclusive of all taxes{unit ? ` · ${unit}` : ""}</span>
          {savings > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ng-leaf/12 px-2 py-0.5 font-semibold text-ng-forest tabular-nums">
              <Icon name="tag-price-bold" size={12} className="text-ng-clay" />
              You save ₹{savings.toLocaleString()}
            </span>
          ) : null}
        </p>
      </div>

      {/* Variant selector */}
      {variants.length > 1 ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold uppercase tracking-wider text-ng-ink-muted">Size</span>
          <div className="flex flex-wrap gap-2.5">
            {variants.map((v, i) => (
              <Chip key={v.label} active={i === variantIdx} onClick={() => setVariantIdx(i)}>
                {v.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Subscribe & save */}
      <button
        type="button"
        onClick={() => setSubscribe((s) => !s)}
        aria-pressed={subscribe}
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors",
          subscribe ? "border-ng-leaf bg-ng-leaf/10" : "border-ng-line hover:border-ng-leaf-soft",
        )}
      >
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md border",
              subscribe ? "border-ng-forest bg-ng-forest text-ng-paper" : "border-ng-line",
            )}
          >
            {subscribe ? <Icon name="check-read-bold" size={13} /> : null}
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-ng-forest-deep">Subscribe &amp; save 8%</span>
            <span className="block text-[12px] text-ng-ink-muted">Delivered monthly · skip or cancel anytime</span>
          </span>
        </span>
        <Icon name="refresh-bold" size={20} className="text-ng-leaf" />
      </button>

      {/* Qty + actions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-stretch gap-3">
          <div className="flex items-center rounded-full border border-ng-line">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ng-forest transition-colors hover:bg-ng-sage disabled:opacity-40"
              disabled={qty <= 1}
            >
              <Icon name="minus-square-linear" size={18} />
            </button>
            <span className="w-8 text-center text-[15px] font-semibold text-ng-forest-deep" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              aria-label="Increase quantity"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ng-forest transition-colors hover:bg-ng-sage"
            >
              <Icon name="add-square-linear" size={18} />
            </button>
          </div>
          <Button onClick={addToCart} size="lg" fullWidth className="flex-1">
            <Icon name="bag-4-bold" size={18} />
            Add to cart · ₹{lineTotal.toLocaleString()}
          </Button>
        </div>
        <Button onClick={toggleWishlist} variant="secondary" size="lg" aria-pressed={wished}>
          <Icon name={wished ? "heart-bold" : "heart-linear"} size={18} className={wished ? "text-ng-terracotta" : undefined} />
          {wished ? "Wishlisted" : "Add to wishlist"}
        </Button>
      </div>
    </div>
  );
}
