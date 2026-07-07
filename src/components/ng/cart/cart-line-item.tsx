"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/lib/cart";
import type { CartItem } from "@/types/nutrigreenz";

const PLACEHOLDER = "/images/placeholder.svg";

/** A single editable cart line: image, title/unit, qty stepper, remove, line total. */
export function CartLineItem({ item }: { item: CartItem }) {
  const { updateQty, removeItem } = useCart();
  const lineTotal = item.price * item.qty;
  // Operate on the stable line id so two variants of one product stay distinct.
  const lineId = item.lineId ?? item.productId;

  return (
    <article className="group relative flex gap-4 overflow-hidden rounded-2xl border border-ng-line-soft bg-ng-paper p-4 shadow-[var(--shadow-ng-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-ng-leaf/60 hover:shadow-[var(--shadow-ng-float)] sm:gap-5 sm:p-5">
      {/* gold hairline accent revealed on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-gradient-to-b from-ng-leaf to-ng-clay transition-transform duration-300 group-hover:scale-y-100"
      />

      <Link
        href={`/products/${item.productId}`}
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ng-cream-deep ring-1 ring-ng-line-soft transition-transform duration-300 group-hover:scale-[1.03] sm:h-28 sm:w-28"
      >
        <Image
          src={item.image || PLACEHOLDER}
          alt={item.title}
          fill
          className="object-cover"
          sizes="112px"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${item.productId}`}
              className="font-display text-[16px] leading-tight text-ng-forest-deep transition-colors hover:text-ng-forest sm:text-[17px]"
            >
              {item.title}
            </Link>
            {item.unit ? (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ng-sage/40 px-2 py-0.5 text-[11px] font-medium text-ng-forest">
                <Icon name="leaf-bold" size={11} className="text-ng-leaf" />
                {item.unit}
              </p>
            ) : null}
            <p className="mt-1.5 text-[13px] text-ng-ink-muted">
              <span className="font-mono tabular-nums text-ng-ink">
                ₹{item.price.toLocaleString("en-IN")}
              </span>{" "}
              each
            </p>
          </div>
          <button
            type="button"
            aria-label={`Remove ${item.title}`}
            onClick={() => removeItem(lineId)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ng-ink-muted transition-colors hover:bg-ng-danger/10 hover:text-ng-danger lg:h-9 lg:w-9"
          >
            <Icon name="trash-bin-trash-linear" size={18} />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="inline-flex items-center rounded-full border border-ng-line bg-ng-cream/40">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => updateQty(lineId, item.qty - 1)}
              className="grid h-11 w-11 place-items-center rounded-full text-ng-forest transition-colors hover:bg-ng-sage active:scale-95 lg:h-9 lg:w-9"
            >
              <Icon name="minus-circle-linear" size={18} />
            </button>
            <span
              className="w-9 text-center font-mono text-[14px] font-semibold tabular-nums text-ng-forest-deep"
              aria-live="polite"
            >
              {item.qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => updateQty(lineId, item.qty + 1)}
              className="grid h-11 w-11 place-items-center rounded-full text-ng-forest transition-colors hover:bg-ng-sage active:scale-95 lg:h-9 lg:w-9"
            >
              <Icon name="add-circle-linear" size={18} />
            </button>
          </div>

          <div className="font-display text-[18px] tabular-nums text-ng-forest-deep sm:text-[20px]">
            ₹{lineTotal.toLocaleString("en-IN")}
          </div>
        </div>
      </div>
    </article>
  );
}
