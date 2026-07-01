"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Stars } from "@/components/ng/stars";
import { Icon } from "@/components/ui/icon";
import { useCart, type CartVariantInput } from "@/lib/cart";
import type { ProductCard } from "@/types/nutrigreenz";
import { VariantSelector, type PdpVariant } from "./variant-selector";
import { usePdpVariant } from "./variant-context";

interface BuyPanelProps {
  product: ProductCard;
  categoryTitle: string;
  credentials: string[];
  variants: PdpVariant[];
  /** index of the variant matching the product's own size (default selected) */
  initialIndex?: number;
  coins: number;
  /** coupon code + final best price after the coupon */
  coupon: { code: string; bestPrice: number; off: number };
  /** when true, the product is sold out — add-to-cart / buy-now are disabled */
  outOfStock?: boolean;
}

/**
 * BuyPanel — the entire right column of the PDP hero.
 * Title + share · credential chips · rating · price · coins banner ·
 * best-price strip · variant tiles · offer banner · qty + Add to cart + Buy Now.
 * Cart wiring uses the real `useCart` hook; Buy Now adds then routes to checkout.
 */
export function BuyPanel({ product, categoryTitle, credentials, variants, initialIndex = 0, coins, coupon, outOfStock = false }: BuyPanelProps) {
  const { addItem } = useCart();
  const router = useRouter();
  // Selection is shared with the sticky bar via context; fall back to local
  // state if the panel is ever rendered outside a <PdpVariantProvider>.
  const shared = usePdpVariant();
  const [localIdx, setLocalIdx] = useState(Math.min(initialIndex, variants.length - 1));
  const vlist = shared ? shared.variants : variants;
  const variantIdx = shared ? shared.index : localIdx;
  const setVariantIdx = shared ? shared.setIndex : setLocalIdx;
  const [qty, setQty] = useState(1);

  const variant = vlist[variantIdx] ?? vlist[0];
  const lineTotal = variant.price * qty;
  const discount = variant.mrp && variant.mrp > variant.price ? Math.round((1 - variant.price / variant.mrp) * 100) : 0;

  // A specific variant can be sold out even when the product as a whole isn't.
  const variantOut = outOfStock || variant.inStock === false;
  // Human label carried into the bag, e.g. "1L · glass".
  const variantLabel = variant.pack ? `${variant.size} · ${variant.pack}` : variant.size;
  // Only DB-backed variants (with an id) attach to the cart line; derived demo
  // variants keep the legacy single-SKU add (base product price).
  const cartVariant: CartVariantInput | undefined = variant.id
    ? { id: variant.id, sku: variant.sku, label: variantLabel, price: variant.price }
    : undefined;

  const add = () => {
    if (variantOut) return;
    addItem(product, qty, cartVariant);
    toast.success("Added to bag", {
      description: `${qty} × ${product.title} · ${variantLabel}`,
    });
  };

  const buyNow = () => {
    if (variantOut) return;
    addItem(product, qty, cartVariant);
    toast.success("Added — taking you to checkout", { description: `${qty} × ${product.title} · ${variantLabel}` });
    router.push("/checkout");
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, url });
        return;
      }
    } catch {
      /* user cancelled — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast("Copy this link", { description: url });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Title + share */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="ng-eyebrow text-ng-forest">{categoryTitle}</span>
          <h1 className="font-display text-[clamp(26px,3.6vw,40px)] leading-tight text-ng-forest-deep">{product.title}</h1>
        </div>
        <button
          type="button"
          onClick={share}
          aria-label="Share this product"
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-ng-line text-ng-forest transition-colors hover:border-ng-leaf hover:bg-ng-sage"
        >
          <Icon name="share-bold" size={18} />
        </button>
      </div>

      {/* Credential strip */}
      <ul className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] font-medium text-ng-forest">
        {credentials.map((c, i) => (
          <li key={c} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden className="text-ng-line">·</span> : null}
            <span className="inline-flex items-center gap-1">
              <Icon name="check-circle-bold" size={13} className="text-ng-leaf" />
              {c}
            </span>
          </li>
        ))}
      </ul>

      {/* Rating */}
      <div className="flex flex-wrap items-center gap-3">
        <Stars rating={product.rating} size="md" showCount={false} />
        <span className="text-[14px] font-semibold text-ng-forest-deep tabular-nums">{product.rating.toFixed(1)}</span>
        <a href="#reviews" className="text-[13px] font-medium text-ng-leaf transition-colors hover:text-ng-forest">
          {product.reviewCount.toLocaleString()} reviews
        </a>
      </div>

      {/* Price */}
      <div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="font-display text-[40px] leading-none text-ng-forest-deep tabular-nums">
            ₹{variant.price.toLocaleString()}
          </span>
          {variant.mrp && variant.mrp > variant.price ? (
            <span className="text-lg text-ng-ink-muted line-through tabular-nums">₹{variant.mrp.toLocaleString()}</span>
          ) : null}
          {discount > 0 ? (
            <span className="rounded-full bg-ng-terracotta/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wider text-ng-terracotta">
              {discount}% off
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] text-ng-ink-muted">MRP (incl. all taxes){variant.size ? ` · ${variant.size}` : ""}</p>
      </div>

      {/* Coins earn banner */}
      <div className="flex items-center gap-3 rounded-xl border border-ng-clay/35 bg-ng-clay/[0.07] px-3.5 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ng-clay/20 text-ng-clay-deep">
          <Icon name="medal-ribbons-star-bold" size={18} />
        </span>
        <p className="text-[13px] text-ng-soil">
          Buy now &amp; earn <span className="font-semibold text-ng-forest-deep">{coins} Harvest Coins</span> — redeem on your next order.
        </p>
      </div>

      {/* Best price with coupon strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ng-leaf bg-ng-leaf/[0.07] px-3.5 py-2.5">
        <Icon name="tag-price-bold" size={18} className="text-ng-leaf" />
        <p className="text-[13px] text-ng-soil">
          Best Price <span className="font-bold tabular-nums text-ng-forest-deep">₹{coupon.bestPrice.toLocaleString()}</span> with coupon
        </p>
        <span className="rounded-md border border-ng-leaf/50 bg-ng-paper px-2 py-0.5 font-mono text-[12px] font-bold tracking-wide text-ng-forest">
          {coupon.code}
        </span>
        <span className="text-[12px] text-ng-ink-muted">— apply at checkout</span>
      </div>

      {/* Variant tiles */}
      <VariantSelector variants={vlist} activeIndex={variantIdx} onSelect={setVariantIdx} />

      {/* Offer callout removed — redundant with the coupon strip above and its ₹ was hardcoded */}

      {/* Qty + Add to cart */}
      {variantOut ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-ng-line bg-ng-cream/60 px-4 py-3.5 text-[14px] font-medium text-ng-ink">
            <Icon name="bag-cross-bold" size={20} className="shrink-0 text-ng-clay" />
            Currently sold out — we&apos;re restocking from the farm soon.
          </div>
          <Button disabled size="lg" fullWidth>
            <Icon name="bag-4-bold" size={18} />
            Out of stock
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-stretch gap-3">
            <div className="flex items-center rounded-full border border-ng-line">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                disabled={qty <= 1}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-ng-forest transition-colors hover:bg-ng-sage disabled:opacity-40"
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
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-ng-forest transition-colors hover:bg-ng-sage"
              >
                <Icon name="add-square-linear" size={18} />
              </button>
            </div>
            <Button onClick={add} size="lg" fullWidth className="flex-1 cursor-pointer">
              <Icon name="bag-4-bold" size={18} />
              Add to cart · ₹{lineTotal.toLocaleString()}
            </Button>
          </div>
          <Button onClick={buyNow} variant="gold" size="lg" className="cursor-pointer">
            <Icon name="bolt-bold" size={18} />
            Buy Now
          </Button>
        </div>
      )}
    </div>
  );
}
