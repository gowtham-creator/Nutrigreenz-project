"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import type { ProductCard } from "@/types/nutrigreenz";

interface StickyBarProps {
  product: ProductCard;
  price: number;
}

/**
 * StickyBar — bottom add-to-cart bar that slides in once the user scrolls past
 * the hero. Product thumb + title + price + Add to cart + Buy Now (useCart).
 */
export function StickyBar({ product, price }: StickyBarProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const add = () => {
    addItem(product, 1);
    toast.success("Added to bag", { description: product.title });
  };
  const buyNow = () => {
    addItem(product, 1);
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
          <p className="truncate text-[13px] font-semibold text-ng-forest-deep">{product.title}</p>
          <p className="text-[13px] font-bold tabular-nums text-ng-forest">₹{price.toLocaleString()}</p>
        </div>
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
      </div>
    </div>
  );
}
