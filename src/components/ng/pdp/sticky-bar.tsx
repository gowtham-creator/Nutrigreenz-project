"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
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

  // Retract the bar once the footer scrolls into view so it never overlaps the
  // footer's links, socials and legal bar (mobile + desktop).
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const io = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -64px 0px" },
    );
    io.observe(footer);
    return () => io.disconnect();
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

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-ng-line-soft bg-ng-paper/95 backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(31,77,46,0.08)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-8">
        <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-ng-line-soft bg-ng-cream-deep sm:block">
          <Image src={product.image || "/images/placeholder.svg"} alt={product.title} fill className="object-contain p-1.5" sizes="48px" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ng-forest-deep">
            {product.title}
            {variantLabel ? <span className="text-ng-ink-muted"> · {variantLabel}</span> : null}
          </p>
          <p className="text-[13px] font-bold tabular-nums text-ng-forest">₹{displayPrice.toLocaleString()}</p>
        </div>
        {variantOut ? (
          <Button disabled variant="secondary" size="md">
            <Icon name="bag-4-bold" size={16} />
            Out of stock
          </Button>
        ) : (
          <>
            <Button onClick={add} variant="secondary" size="md" className="cursor-pointer hidden sm:inline-flex">
              <Icon name="bag-4-bold" size={16} />
              Add to cart
            </Button>
            <Button onClick={add} variant="secondary" size="icon" aria-label="Add to cart" className="cursor-pointer sm:hidden">
              <Icon name="bag-4-bold" size={18} />
            </Button>
            <Button onClick={buyNow} variant="primary" size="md" className="cursor-pointer">
              <Icon name="bolt-bold" size={16} />
              Buy Now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
