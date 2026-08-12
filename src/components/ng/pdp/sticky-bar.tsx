"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { AppIcon } from "@/components/ui/app-icon";
import { BrandIcon } from "@/components/ui/brand-icon";
import { useCart, type CartVariantInput } from "@/lib/cart";
import { cn } from "@/lib/utils";
import type { ProductCard } from "@/types/nutrigreenz";
import { usePdpVariant } from "./variant-context";

interface StickyBarProps {
  product: ProductCard;
  price: number;
  /** when true, the product is sold out — add-to-cart / buy-now are disabled */
  outOfStock?: boolean;
}

/**
 * StickyBar — bottom add-to-cart bar that slides in once the user scrolls past
 * the hero. Product thumb + title + price + Add to cart + Buy Now (useCart).
 */
export function StickyBar({ product, price, outOfStock = false }: StickyBarProps) {
  const { addItem } = useCart();
  const router = useRouter();
  // Mirror the BuyPanel's selection so the sticky bar adds exactly what's chosen.
  const shared = usePdpVariant();
  const selected = shared?.selected;
  const displayPrice = selected ? selected.price : price;
  const variantLabel = selected
    ? selected.pack
      ? `${selected.size} · ${selected.pack}`
      : selected.size
    : undefined;
  const cartVariant: CartVariantInput | undefined =
    selected && selected.id && variantLabel
      ? { id: selected.id, sku: selected.sku, label: variantLabel, price: selected.price }
      : undefined;
  const variantOut = outOfStock || selected?.inStock === false;
  const [scrolled, setScrolled] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /*
   * Retract only at the very end of the page, not the whole footer.
   *
   * This watched the <footer> element, which is around 900px tall here — a
   * landscape illustration with a deep bottom band. The bar therefore vanished
   * the moment the tree line appeared and stayed gone for most of the lower
   * page, exactly where a shopper who has read the whole thing decides to buy.
   *
   * Watching a sentinel at the footer's foot instead means the bar survives the
   * scroll and steps aside only for the legal links it would actually cover.
   */
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;bottom:0;left:0;width:1px;height:120px;pointer-events:none";
    const prevPosition = getComputedStyle(footer).position;
    if (prevPosition === "static") footer.style.position = "relative";
    footer.appendChild(sentinel);

    const io = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
    io.observe(sentinel);
    return () => {
      io.disconnect();
      sentinel.remove();
    };
  }, []);

  const visible = scrolled && !footerVisible;

  const add = () => {
    if (variantOut) return;
    addItem(product, 1, cartVariant);
    toast.success("Added to bag", {
      description: variantLabel ? `${product.title} · ${variantLabel}` : product.title,
    });
  };
  const buyNow = () => {
    if (variantOut) return;
    addItem(product, 1, cartVariant);
    router.push("/checkout");
  };

  /*
   * Portaled to <body>.
   *
   * `position: fixed` only resolves against the viewport when no ancestor
   * establishes a containing block, and both `transform` and
   * `will-change: transform` do. This page is built from framer-motion
   * sections — a couple of hundred transforms and a dozen will-change hints —
   * so the bar was being positioned against whichever animated wrapper
   * happened to enclose it, which is why it never appeared where it should.
   *
   * Rendering into <body> puts it outside all of them, so inset-x-0 bottom-0
   * means the screen again.
   */
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-ng-line-soft bg-ng-paper/98 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_36px_rgba(31,77,46,0.16)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 md:gap-4 md:px-8 md:py-4">
        <div className="relative hidden h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-ng-line-soft bg-ng-cream-deep sm:block">
          <Image src={product.image || "/images/placeholder.svg"} alt={product.title} fill className="object-contain p-1.5" sizes="56px" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ng-forest-deep md:text-[15px]">
            {product.title}
          </p>
          {variantLabel ? (
            <p className="truncate text-[12px] text-ng-ink-muted">{variantLabel}</p>
          ) : null}
        </div>
        {/* Price reads as the decision point, so it sits apart from the name at
            a size that survives a glance on a phone. */}
        <p className="shrink-0 text-[17px] font-bold tabular-nums text-ng-forest-deep md:text-[19px]">
          ₹{displayPrice.toLocaleString("en-IN")}
        </p>
        {variantOut ? (
          <Button disabled variant="secondary" size="md">
            <BrandIcon name="cart" size={16} weight="solid" />
            Out of stock
          </Button>
        ) : (
          <>
            <Button onClick={add} variant="secondary" size="md" className="cursor-pointer hidden sm:inline-flex">
              <BrandIcon name="cart" size={16} weight="solid" />
              Add to cart
            </Button>
            <Button onClick={add} variant="secondary" size="icon" aria-label="Add to cart" className="cursor-pointer sm:hidden">
              <BrandIcon name="cart" size={18} weight="solid" />
            </Button>
            <Button onClick={buyNow} variant="primary" size="md" className="cursor-pointer">
              <AppIcon name="cart-add" size={16} />
              <span className="font-display tracking-wide">Buy Now</span>
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
