"use client";

import Link from "next/link";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { CartIcon } from "@/components/ng/cart-icon";
import { FloatIn, Reveal } from "@/components/ng/motion";

/*
 * The supplied product marks, not Solar stand-ins.
 *
 * These were `bottle`, `jar-of-pills` and `bag-smile` — a generic bottle, a
 * PILL jar, and a shopping bag, for oil, ghee and honey. The pill jar in
 * particular read as medicine on a food shop.
 *
 * `oil` and `honey` are the marks drawn for exactly these products (see
 * app-icon.tsx: no general library carries a cold-pressed oil bottle or a
 * honey jar, which is why they live there). Ghee has no supplied mark yet, so
 * it borrows the honey jar's vessel rather than a pill bottle — closest true
 * shape until a ghee mark exists.
 */
type Pick =
  | { kind: "app"; icon: AppIconName; label: string }
  | { kind: "ui"; icon: UiIconName; label: string };

const PICKS: Pick[] = [
  { kind: "ui", icon: "groundnut", label: "Cold-pressed oils" },
  { kind: "app", icon: "honey", label: "A2 ghee" },
  /* Honey takes the BEE, not a second jar. The jar is the right vessel for
     ghee, but running two identical jars side by side made the row read as a
     rendering fault. The bee is also what the homepage honey rail already
     uses, so the two surfaces now agree. */
  { kind: "ui", icon: "bee", label: "Raw honey" },
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
                {/* Footer green (--ng-forest-deep), not the light leaf: the pale
                    green read as decoration rather than as a mark. 16px because
                    the produce marks are drawn illustrations — at 14 their thin
                    strokes thin out and the mark looks washed beside the text. */}
                {p.kind === "app" ? (
                  <AppIcon name={p.icon} size={16} className="text-ng-forest-deep" />
                ) : (
                  <UiIcon name={p.icon} size={16} className="text-ng-forest-deep" />
                )}
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
