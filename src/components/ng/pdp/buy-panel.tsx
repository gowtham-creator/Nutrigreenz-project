"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Stars } from "@/components/ng/stars";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { BrandIcon } from "@/components/ui/brand-icon";
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
    toast.success("Added. Taking you to checkout", { description: `${qty} × ${product.title} · ${variantLabel}` });
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
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-ng-line text-ng-forest transition-colors hover:border-ng-leaf hover:bg-ng-sage"
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
              {/* The supplied Icons8 badge, traced. At 14px rather than 13: this
                  mark carries a tick cut out of a scalloped disc, and one more
                  pixel is the difference between the counter reading as a tick
                  and closing up into a blob. */}
              <UiIcon name="verified" size={14} className="text-ng-leaf" />
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
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ng-cream text-ng-clay-deep">
          <Icon name="star" size={18} />
        </span>
        <p className="text-[13px] text-ng-soil">
          Buy now &amp; earn <span className="font-semibold text-ng-forest-deep">{coins} Harvest Coins</span> — redeem on your next order.
        </p>
      </div>

      {/* Best price with coupon strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ng-leaf bg-ng-leaf/[0.07] px-3.5 py-2.5">
        <UiIcon name="tag" size={18} className="text-ng-leaf" />
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
            Currently sold out. We&apos;re restocking from the farm soon.
          </div>
          <Button disabled size="lg" fullWidth>
            <BrandIcon name="cart" size={18} weight="solid" />
            Out of stock
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {/*
            Quantity and the running subtotal share a row, and the two actions
            sit together on the next one.

            The subtotal moved OUT of the Add to cart label. It read
            "Add to cart · ₹720" when that button was full width, which does not
            survive being halved — the price is the first thing to truncate, and
            truncating a price is worse than not showing one. On its own line it
            is larger, always legible, and updates as the stepper moves, so the
            customer sees what they are about to pay before choosing HOW to pay.
          */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-ng-line bg-ng-cream/50 p-1">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                disabled={qty <= 1}
                className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-ng-paper text-ng-forest-deep shadow-[0_1px_3px_rgba(20,51,31,0.12)] ring-1 ring-ng-line/60 transition-colors hover:bg-ng-sage disabled:opacity-40 disabled:shadow-none"
              >
                <span className="text-[22px] font-semibold leading-none">−</span>
              </button>
              <span className="w-9 text-center text-[16px] font-bold text-ng-forest-deep tabular-nums" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                aria-label="Increase quantity"
                className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-ng-forest text-ng-cream shadow-[0_2px_6px_rgba(20,51,31,0.28)] transition-colors hover:bg-ng-forest-deep"
              >
                <span className="text-[22px] font-semibold leading-none">+</span>
              </button>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-soft">
                Subtotal
              </div>
              <div className="font-display text-[22px] leading-tight tabular-nums text-ng-forest-deep">
                ₹{lineTotal.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/*
            Side by side, equal width, and deliberately NOT equal weight.

            Both are solid so neither reads as disabled, but forest green is the
            brand's primary and gold is the warmer, more urgent mark — which
            matches what the two actions are for. Add to cart is the workhorse
            on a catalogue people buy in baskets (ghee AND honey AND an oil);
            Buy Now is the single-item shortcut. Giving them identical
            treatment would make the customer stop and read, which is exactly
            the pause a buy row should not create.
          */}
          <div className="flex items-stretch gap-3">
            <Button
              onClick={add}
              size="lg"
              className="min-w-0 flex-1 cursor-pointer px-3 sm:px-5"
            >
              <BrandIcon name="cart" size={18} weight="solid" />
              <span className="min-w-0 truncate">Add to cart</span>
            </Button>
            <Button
              onClick={buyNow}
              variant="gold"
              size="lg"
              className="min-w-0 flex-1 cursor-pointer px-3 sm:px-5"
            >
              {/* A bolt, not `cart-add`. The old icon put an ADD-TO-CART mark on
                  the one button that does not add to the cart — it goes straight
                  to checkout. */}
              <Icon name="bolt-bold" size={17} />
              <span className="min-w-0 truncate font-display tracking-wide">Buy Now</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
