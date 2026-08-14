"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Stars } from "@/components/ng/stars";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import type { ProductCard } from "@/types/nutrigreenz";

export default function WishlistPage() {
  const { items, remove, count } = useWishlist();
  const { addItem } = useCart();

  return (
    <AccountShell active="wishlist">
      <Reveal className="mb-8">
        <span className="ng-eyebrow inline-flex items-center gap-2">
          <UiIcon name="wishlist" size={14} />
          Your account
        </span>
        <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
          Your <em className="italic text-ng-leaf">wishlist</em>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
          {count > 0
            ? `${count} ${count === 1 ? "product" : "products"} you've saved for later. Move them to your bag whenever you're ready.`
            : "Save the produce, oils and superfoods you love so they're ready when you are."}
        </p>
      </Reveal>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <Stagger className="grid items-stretch grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-3">
          {items.map((product) => (
            <StaggerItem key={product.id} className="h-full">
              <WishlistCard
                product={product}
                onAdd={() => {
                  addItem(product);
                  toast.success("Added to bag", { description: product.title });
                }}
                onRemove={() => {
                  remove(product.id);
                  toast("Removed from wishlist", { description: product.title });
                }}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </AccountShell>
  );
}

function WishlistCard({
  product,
  onAdd,
  onRemove,
}: {
  product: ProductCard;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const href = product.href ?? `/products/${product.slug}`;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ng-line-soft bg-ng-paper ng-float transition-all hover:border-ng-leaf/50">
      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden bg-ng-cream-deep">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
          ) : (
            <div className="ng-img-fallback h-full w-full text-2xl">
              {product.title.slice(0, 2)}
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from wishlist"
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-ng-paper/90 text-ng-danger shadow-[0_2px_10px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-all duration-200 hover:bg-ng-paper active:scale-95"
      >
        <Icon name="trash-bin-trash-bold" size={17} />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Stars rating={product.rating} reviewCount={product.reviewCount} size="sm" />
        <Link href={href}>
          <h3 className="line-clamp-2 font-display text-[16px] leading-tight text-ng-ink transition-colors group-hover:text-ng-forest">
            {product.title}
          </h3>
        </Link>
        {product.unit ? (
          <p className="-mt-1 text-[12px] text-ng-ink-soft">{product.unit}</p>
        ) : null}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[19px] font-semibold text-ng-forest-deep">
            ₹{product.price.toLocaleString()}
          </span>
          {product.mrp && product.mrp > product.price ? (
            <span className="text-[13px] text-ng-ink-soft line-through">
              ₹{product.mrp.toLocaleString()}
            </span>
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          className="mt-auto pt-0"
          onClick={onAdd}
        >
          <UiIcon name="bag" size={16} />
          Add to bag
        </Button>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ng-line bg-ng-sage/20 px-6 py-16 text-center">
      <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-ng-paper text-ng-clay-deep shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
        <UiIcon name="wishlist" size={30} />
      </span>
      <h2 className="font-display text-[24px] leading-tight text-ng-forest-deep">
        Your wishlist is empty
      </h2>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ng-ink-muted">
        Tap the heart on any product to save it here for later. Your picks stay
        ready whenever you want to add them to your bag.
      </p>
      <Button asChild variant="primary" size="md" className="mt-6">
        <Link href="/shop">Shop the store</Link>
      </Button>
    </div>
  );
}
