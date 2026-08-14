"use client";

import Link from "next/link";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { CartIcon } from "@/components/ng/cart-icon";
import { FloatIn, Reveal } from "@/components/ng/motion";

const PICKS: { icon: string; label: string }[] = [
  { icon: "bottle-bold", label: "Cold-pressed oils" },
  { icon: "jar-of-pills-bold", label: "A2 ghee" },
  { icon: "bag-smile-bold", label: "Raw honey" },
];

/** Empty-bag state with a shop CTA. */
export function CartEmpty() {
  return (
    <Reveal className="mx-auto max-w-lg">
      <div className="relative overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper px-6 py-16 text-center shadow-[var(--shadow-ng-card)]">
        {/* soft background bloom */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-ng-leaf/15 blur-3xl"
        />
        <div className="relative z-10 flex flex-col items-center">
          <FloatIn>
            <div className="grid h-24 w-24 place-items-center rounded-full bg-ng-cream text-ng-forest ring-8 ring-ng-sage/20">
              <CartIcon size={42} tone="dark" />
            </div>
          </FloatIn>
          <h2 className="mt-7 font-display text-[28px] text-ng-forest-deep">
            Your bag is empty
          </h2>
          <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-ng-ink-muted">
            Nothing here yet. Explore single-origin oils, ghee, honey and more —
            sourced direct from the farm, with every lot traceable to source.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {PICKS.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-ng-line-soft bg-ng-cream/50 px-3 py-1.5 text-[12px] font-medium text-ng-forest"
              >
                <Icon name={p.icon} size={14} className="text-ng-leaf" />
                {p.label}
              </span>
            ))}
          </div>

          <Button variant="primary" size="lg" className="mt-8" asChild>
            <Link href="/shop">
              Start shopping
              <Icon name="arrow-right-linear" size={18} />
            </Link>
          </Button>
        </div>
      </div>
    </Reveal>
  );
}
