"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "./badge";
import { Stars } from "./stars";
import { Button } from "./button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import type { ProductCard as ProductCardType } from "@/types/nutrigreenz";

interface Props {
  product: ProductCardType;
  variant?: "default" | "compact" | "hero";
  className?: string;
}

export function ProductCard({ product, variant = "default", className }: Props) {
  const { addItem, updateQty, items } = useCart();
  const { has, toggle } = useWishlist();

  // Variant-aware quick-add: a product with MULTIPLE size×pack variants must be
  // configured on the PDP (so the shopper picks a size/pack); a product with a
  // single variant adds it directly; a legacy/demo product (no variants) adds
  // the base SKU. The qty stepper tracks the exact line we'd add to.
  const variants = product.variants ?? [];
  const hasChoices = variants.length > 1;
  const singleVariant = variants.length === 1 ? variants[0] : undefined;
  const lineId = singleVariant ? `${product.id}::${singleVariant.id}` : product.id;
  const qty = items.find((item) => (item.lineId ?? item.productId) === lineId)?.qty ?? 0;

  const saved = has(product.id);
  const href = product.href ?? `/products/${product.slug}`;
  const discount = product.mrp && product.mrp > product.price
    ? Math.round((1 - product.price / product.mrp) * 100)
    : 0;
  const savings = product.mrp && product.mrp > product.price ? product.mrp - product.price : 0;

  const handleAddToBag = () => {
    if (singleVariant) {
      const label = singleVariant.pack
        ? `${singleVariant.label} · ${singleVariant.pack}`
        : singleVariant.label;
      addItem(product, 1, {
        id: singleVariant.id,
        sku: singleVariant.sku,
        label,
        price: singleVariant.price,
      });
    } else {
      addItem(product);
    }
    toast.success("Added to bag", { description: product.title });
  };

  const decQty = () => updateQty(lineId, qty - 1);
  const incQty = () => updateQty(lineId, qty + 1);

  const handleToggleWishlist = () => {
    toggle(product);
    if (saved) {
      toast("Removed from wishlist", { description: product.title });
    } else {
      toast.success("Saved to wishlist", { description: product.title });
    }
  };

  if (variant === "compact") {
    return (
      <Link
        href={href}
        className={cn(
          "group flex gap-3 items-center p-3 rounded-xl bg-ng-paper border border-ng-line-soft hover:border-ng-leaf-soft transition-colors",
          className,
        )}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ng-cream-deep">
          {product.image ? (
            <Image src={product.image} alt={product.title} fill className="object-cover" sizes="64px" />
          ) : (
            <div className="ng-img-fallback h-full w-full text-xs">img</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ng-ink line-clamp-2">{product.title}</p>
          <p className="text-[13px] font-semibold text-ng-forest mt-0.5">
            {product.priceFrom ? <span className="font-normal text-ng-ink-soft">from </span> : null}
            ₹{product.price.toLocaleString("en-IN")}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-3xl bg-ng-paper border border-ng-line-soft overflow-hidden ng-float transition-colors duration-300 hover:border-ng-leaf-soft",
        className,
      )}
    >
      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-ng-cream to-ng-cream-deep">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 20vw"
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
            />
          ) : (
            <div className="ng-img-fallback h-full w-full text-2xl">
              {product.title.slice(0, 2)}
            </div>
          )}
          {/* Soft top sheen + bottom vignette for depth */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ng-forest-deep/10 via-transparent to-ng-paper/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Badges — stacked top-left */}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.badge ? (
              <Badge tone={product.badgeTone ?? "leaf"}>{product.badge}</Badge>
            ) : null}
            {discount > 0 && !product.badge ? (
              <Badge tone="terracotta">{discount}% OFF</Badge>
            ) : null}
          </div>

          {/* Quick-view affordance on hover */}
          <span className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 translate-y-3 whitespace-nowrap rounded-full bg-ng-forest-deep/85 px-3.5 py-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-ng-cream opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            View details
          </span>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleToggleWishlist}
        aria-pressed={saved}
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        className={cn(
          "absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full backdrop-blur-sm transition-all duration-200 active:scale-90",
          saved
            ? "bg-ng-paper/95 text-ng-danger shadow-[0_2px_12px_rgba(0,0,0,0.14)]"
            : "bg-ng-paper/75 text-ng-ink-soft hover:bg-ng-paper hover:text-ng-danger hover:scale-105",
        )}
      >
        <Icon name={saved ? "heart-bold" : "heart-linear"} size={18} />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Stars rating={product.rating} reviewCount={product.reviewCount} size="sm" />
        <Link href={href}>
          <h3 className="font-display text-[17px] leading-tight text-ng-ink line-clamp-2 group-hover:text-ng-forest transition-colors">
            {product.title}
          </h3>
        </Link>
        {product.unit ? (
          <p className="-mt-1 inline-flex items-center gap-1 font-mono text-[11px] tracking-tight text-ng-ink-soft">
            <Icon name="leaf-bold" size={11} className="text-ng-leaf" />
            {product.unit}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1.5 pt-1">
          {product.priceFrom ? (
            <span className="text-[12px] font-medium text-ng-ink-soft">from</span>
          ) : null}
          <span className="font-display text-[19px] sm:text-[21px] font-semibold text-ng-forest-deep tabular-nums">
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          {product.mrp && product.mrp > product.price ? (
            <span className="text-[13px] text-ng-ink-soft line-through tabular-nums">
              ₹{product.mrp.toLocaleString("en-IN")}
            </span>
          ) : null}
          {savings > 0 ? (
            <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-ng-leaf/15 px-2 py-0.5 text-[11px] font-semibold text-ng-forest tabular-nums">
              Save ₹{savings.toLocaleString("en-IN")}
            </span>
          ) : null}
        </div>

        {hasChoices ? (
          <Button asChild variant="secondary" size="sm" fullWidth className="mt-2.5">
            <Link href={href}>
              <Icon name="bag-4-linear" size={16} />
              Select options
            </Link>
          </Button>
        ) : qty === 0 ? (
          <Button variant="secondary" size="sm" fullWidth className="mt-2.5" onClick={handleAddToBag}>
            <Icon name="bag-4-linear" size={16} />
            Add to bag
          </Button>
        ) : (
          <div className="mt-2.5 flex h-9 w-full items-center justify-between rounded-full bg-ng-forest px-1.5 text-ng-cream shadow-[0_4px_14px_rgba(31,77,46,0.25)]">
            <button
              type="button"
              onClick={decQty}
              aria-label={`Decrease quantity of ${product.title}`}
              className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-ng-cream/15 active:scale-90"
            >
              <Icon name="minus-circle-linear" size={19} />
            </button>
            <span className="text-[13px] font-semibold tabular-nums">{qty} in bag</span>
            <button
              type="button"
              onClick={incQty}
              aria-label={`Increase quantity of ${product.title}`}
              className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-ng-cream/15 active:scale-90"
            >
              <Icon name="add-circle-linear" size={19} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
