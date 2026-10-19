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
    { icon: "shipping", label: "Free shipping", sub: freeDeliveryThreshold > 0 ? `On orders over ${freeOver}` : "On every order" },
    { icon: "headphones-round-sound-linear", label: "Customer support", sub: "Real people, here to help" },
    { app: "lab", label: `${checks}+ quality checks`, sub: "On every single lot" },
    { app: "verified", label: "100% authentic", sub: "Farm-fresh, never adulterated" },
  ];

  /*
   * Four across, matching the reference.
   *
   * This sits in the buy column now (~550px), so the columns break at `sm`
   * rather than `lg`. Waiting for a large VIEWPORT would have kept it 2-up
   * inside a container that was already wide enough for four — the breakpoint
   * was describing the page, not the box the list actually lives in. Gaps and
   * top padding tighten to suit the narrower measure.
   */
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 border-t border-ng-line-soft pt-6 sm:grid-cols-4">
      {items.map((t) => (
        <li key={t.label} className="flex flex-col items-center gap-2 text-center">
          {/* 56px disc, 28px glyph — up from 44/22. At the old size these read
              as decoration beside the copy; a claim the customer is meant to
              weigh should carry its own weight on the page. The disc grows
              faster than the glyph so the ring stays a ring rather than
              tightening into an outline around the mark. */}
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ng-sage/25 text-ng-forest">
            {"app" in t ? <BrandIcon name={t.app} size={28} weight="line" /> : <Icon name={t.icon} size={28} />}
          </span>
          {/* The label moves to the display serif.
              Everything in this column is set in the sans, so a fourth block of
              it read as more body copy. Fraunces is what the brand already uses
              for things it wants believed — the product title, the section
              headings — and borrowing that voice here is the point: these are
              promises, not captions. Tracking is tightened because the serif
              sets wider than the sans at the same size. */}
          <span className="font-display text-[16px] leading-tight tracking-[-0.01em] text-ng-forest-deep">
            {t.label}
          </span>
          {/* The sub-line stays in the sans and stays small — it explains the
              claim above it, and matching the label's weight would leave the
              eye with nothing to land on first. */}
          <span className="text-[12px] leading-snug text-ng-ink-muted">{t.sub}</span>
        </li>
      ))}
    </ul>
  );
}
