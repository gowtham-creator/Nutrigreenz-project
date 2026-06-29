"use client";

import Image from "next/image";
import type { CartItem } from "@/types/nutrigreenz";
import { INR, type OrderTotals } from "./order-math";

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "muted" | "discount";
}) {
  return (
    <div className="flex items-center justify-between text-[14px]">
      <span className="text-ng-ink-muted">{label}</span>
      <span
        className={
          tone === "discount"
            ? "font-semibold tabular-nums text-ng-green-bright"
            : "font-medium tabular-nums text-ng-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function OrderSummary({
  items,
  totals,
  loyaltyPoints,
  className,
}: {
  items: CartItem[];
  totals: OrderTotals;
  /** Points to be applied (for the loyalty row label). */
  loyaltyPoints?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="font-display text-[22px] text-ng-forest-deep mb-5">
        Order summary
      </h2>

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.lineId ?? item.productId} className="flex gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ng-cream-deep">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover"
                sizes="56px"
              />
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ng-forest text-[10px] font-bold text-ng-cream">
                {item.qty}
              </span>
            </div>
            <div className="flex-1 text-[13px]">
              <div className="font-medium leading-tight text-ng-ink line-clamp-2">
                {item.title}
              </div>
              {item.unit ? (
                <div className="mt-0.5 text-[11px] text-ng-ink-soft">
                  {item.unit}
                </div>
              ) : null}
            </div>
            <div className="text-[14px] font-medium tabular-nums text-ng-forest-deep">
              {INR(item.price * item.qty)}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-2.5 border-t border-ng-line-soft pt-5">
        <SummaryRow label="Subtotal" value={INR(totals.subtotal)} />
        {totals.couponDiscount > 0 ? (
          <SummaryRow
            label="Coupon discount"
            value={`− ${INR(totals.couponDiscount)}`}
            tone="discount"
          />
        ) : null}
        {totals.loyaltyDiscount > 0 ? (
          <SummaryRow
            label={
              loyaltyPoints
                ? `Loyalty (${loyaltyPoints} pts)`
                : "Loyalty points"
            }
            value={`− ${INR(totals.loyaltyDiscount)}`}
            tone="discount"
          />
        ) : null}
        <SummaryRow
          label="Shipping"
          value={totals.shipping === 0 ? "Free" : INR(totals.shipping)}
        />
        {!totals.taxInclusive && totals.tax > 0 ? (
          <SummaryRow
            label={
              totals.taxRateBps > 0
                ? `Tax (${(totals.taxRateBps / 100).toLocaleString("en-IN")}%)`
                : "Tax"
            }
            value={INR(totals.tax)}
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-ng-line-soft pt-4">
        <span className="font-display text-[18px] text-ng-forest-deep">
          Total
        </span>
        <span className="font-display text-[28px] tabular-nums text-ng-forest-deep">
          {INR(totals.total)}
        </span>
      </div>
      {totals.taxInclusive ? (
        <p className="mt-1 text-right text-[11px] text-ng-ink-soft">
          incl. GST
        </p>
      ) : null}
    </div>
  );
}
