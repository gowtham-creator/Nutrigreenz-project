"use client";

import { Icon } from "@/components/ui/icon";
import { BrandIcon, type BrandIconName } from "@/components/ui/brand-icon";
import { useCommerceRules } from "@/lib/commerce";

interface TrustBarProps {
  /** Quality-check count for this category (defaults to 70). */
  checks?: number;
}

/**
 * TrustBar — a row of four reassurance items shown below the buy panel.
 *
 * The free-shipping threshold is read LIVE from the storefront commerce rules
 * (Super-Admin owned, served via /api/commerce-rules), so it always reflects
 * the current policy instead of a hardcoded amount.
 *
 * Wording respects the No-Cancellation policy (§3.9): there is deliberately NO
 * return / refund item. Thin forest-green line icons keep the row calm and
 * on-brand for the farm theme.
 */
export function TrustBar({ checks = 70 }: TrustBarProps) {
  const { freeDeliveryThreshold } = useCommerceRules();
  const freeOver = `₹${freeDeliveryThreshold.toLocaleString("en-IN")}`;

  /*
   * Only the lab flask comes from Lucide here, and at the lighter stroke.
   *
   * This row is deliberately thin-stroke; the delivery van stays a Solar linear
   * glyph because swapping it would gain nothing and Solar already draws it in
   * the same weight as its neighbours.
   */
  const items: ({ label: string; sub: string } & ({ app: BrandIconName } | { icon: string }))[] = [
    { icon: "delivery-linear", label: "Free shipping", sub: `On orders over ${freeOver}` },
    { icon: "headphones-round-sound-linear", label: "360° customer support", sub: "Real people, here to help" },
    { app: "lab", label: `${checks}+ quality checks`, sub: "On every single lot" },
    { app: "verified", label: "100% authentic", sub: "Farm-fresh, never adulterated" },
  ];

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-7 border-t border-ng-line-soft pt-8 lg:grid-cols-4">
      {items.map((t) => (
        <li key={t.label} className="flex flex-col items-center gap-2 px-1 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-ng-sage/25 text-ng-forest">
            {"app" in t ? <BrandIcon name={t.app} size={22} weight="line" /> : <Icon name={t.icon} size={22} />}
          </span>
          <span className="text-[13px] font-semibold text-ng-forest-deep">{t.label}</span>
          <span className="text-[11px] leading-snug text-ng-ink-muted">{t.sub}</span>
        </li>
      ))}
    </ul>
  );
}
