import { Icon } from "@/components/ui/icon";
import { Reveal } from "../motion";

/**
 * AssuranceStrip — a slim USP / trust band that sits directly under the hero
 * banner (Anveshan-style). It fills what was an empty stretch of page with four
 * at-a-glance reasons to buy: freshness, purity, shipping and certification.
 *
 * Hairline-divided cells (a 1px line bg showing through `gap-px`) keep it crisp
 * and premium without heavy borders. All icons are confirmed Solar glyphs.
 */

const POINTS = [
  {
    icon: "leaf-bold",
    tint: "text-ng-leaf",
    bg: "bg-ng-sage/45",
    title: "Cold-pressed fresh",
    sub: "Pressed within 7 days of dispatch",
  },
  {
    icon: "shield-check-bold",
    tint: "text-ng-forest",
    bg: "bg-ng-leaf/15",
    title: "Lab-tested purity",
    sub: "Every lot — zero adulterants",
  },
  {
    icon: "routing-2-bold",
    tint: "text-ng-clay-deep",
    bg: "bg-ng-clay/15",
    title: "Free shipping",
    sub: "On all orders over ₹599",
  },
  {
    icon: "medal-ribbons-star-bold",
    tint: "text-ng-amber",
    bg: "bg-ng-amber/15",
    title: "FSSAI certified",
    sub: "ISO 22000 quality assured",
  },
] as const;

export function AssuranceStrip() {
  return (
    <section aria-label="Why shop with Nutri Greenz" className="relative px-4 sm:px-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[26px] border border-ng-line bg-ng-line/70 shadow-[var(--shadow-ng-card)] sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map((p) => (
              <li
                key={p.title}
                className="flex items-center gap-3.5 bg-ng-paper px-5 py-5 transition-colors hover:bg-ng-cream/60 md:px-6 md:py-6"
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${p.bg} ${p.tint}`}>
                  <Icon name={p.icon} size={24} />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-[15px] font-semibold leading-tight text-ng-forest-deep md:text-[16px]">
                    {p.title}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-snug text-ng-ink-muted sm:text-sm">{p.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
