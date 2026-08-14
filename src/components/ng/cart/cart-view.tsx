"use client";

import Link from "next/link";
import { Section } from "@/components/ng/section";
import { Icon } from "@/components/ui/icon";
import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { Stagger, StaggerItem } from "@/components/ng/motion";
import { useCart } from "@/lib/cart";
import { useCommerceRules } from "@/lib/commerce";
import { CartLineItem } from "./cart-line-item";
import { CartEmpty } from "./cart-empty";
import { OrderSummary } from "./order-summary";

/** Cart page body — empty state, or line items + order summary. */
export function CartView() {
  const { items, count } = useCart();
  const { freeDeliveryThreshold } = useCommerceRules();
  const freeDeliveryLabel = `₹${freeDeliveryThreshold.toLocaleString("en-IN")}`;
  const trust: { icon: UiIconName; label: string }[] = [
    { icon: "lock" as const, label: "Secure payment" },
    { icon: "qr" as const, label: "Lot-traceable" },
    { icon: "delivery" as const, label: `Free delivery over ${freeDeliveryLabel}` },
  ];

  if (items.length === 0) {
    return (
      <Section
        eyebrow="Your bag"
        heading={
          <>
            Your <em className="italic text-ng-leaf">bag</em>
          </>
        }
      >
        <CartEmpty />
      </Section>
    );
  }

  return (
    <Section
      eyebrow="Your bag"
      heading={
        <>
          Your bag{" "}
          <em className="italic text-ng-leaf">
            ({count} {count === 1 ? "item" : "items"})
          </em>
        </>
      }
      description={`Review your items, then proceed to checkout. Free delivery above ${freeDeliveryLabel}.`}
    >
      <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_380px] lg:gap-10 lg:pb-0">
        <div className="space-y-5">
          <Stagger className="space-y-4">
            {items.map((item) => (
              <StaggerItem key={item.lineId ?? item.productId}>
                <CartLineItem item={item} />
              </StaggerItem>
            ))}
          </Stagger>

          {/* Trust strip + keep-shopping link */}
          <div className="flex flex-col gap-4 rounded-2xl border border-ng-line-soft bg-ng-cream/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {trust.map((t) => (
                <li
                  key={t.label}
                  className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ng-forest"
                >
                  <UiIcon name={t.icon} size={15} className="text-ng-forest-deep" />
                  {t.label}
                </li>
              ))}
            </ul>
            <Link
              href="/shop"
              className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-ng-forest transition-colors hover:text-ng-forest-deep"
            >
              <Icon name="arrow-left-linear" size={15} />
              Continue shopping
            </Link>
          </div>
        </div>
        <OrderSummary />
      </div>
    </Section>
  );
}
