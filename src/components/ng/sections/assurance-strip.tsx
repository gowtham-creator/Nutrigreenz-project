import { Icon } from "@/components/ui/icon";
import { BrandIcon, type BrandIconName } from "@/components/ui/brand-icon";
import { Reveal } from "../motion";

/**
 * AssuranceStrip — a slim USP / trust band that sits directly under the hero
 * banner (magazine-style). It fills what was an empty stretch of page with four
 * at-a-glance reasons to buy: freshness, purity, shipping and certification.
 *
 * Hairline-divided cells (a 1px line bg showing through `gap-px`) keep it crisp
 * and premium without heavy borders.
 *
 * Three of the four now use imported glyphs, because each says the specific
 * thing the generic Solar shape only gestured at: a sprout for freshness rather
 * than a plain leaf, a flask for lab testing rather than a shield, and a van
 * carrying its own FREE lettering rather than a parcel. The FSSAI cell keeps a
 * Solar tick — see the note on its entry below.
 */

const POINTS = [
  {
    app: "fresh" as BrandIconName,
    tint: "text-ng-forest-soft",
    bg: "bg-ng-leaf/18",
    ring: "ring-ng-leaf/30",
    title: "Cold-pressed fresh",
    sub: "Pressed within 7 days of dispatch",
  },
  {
    app: "lab" as BrandIconName,
    tint: "text-ng-forest",
    bg: "bg-ng-forest/[0.08]",
    ring: "ring-ng-forest/15",
    title: "Lab-tested purity",
    sub: "Every lot — zero adulterants",
  },
  {
    app: "shipping" as BrandIconName,
    tint: "text-ng-clay-deep",
    bg: "bg-ng-clay/16",
    ring: "ring-ng-clay/25",
    title: "Free shipping",
    sub: "On all orders over ₹599",
  },
  {
    /*
     * Stays a Solar tick. The FSSAI mark supplied was a Shutterstock preview,
     * and the real mark may only be shown beside the 14-digit licence number,
     * which is still a placeholder in the pack artwork.
     */
    icon: "verified-check-bold",
    tint: "text-ng-green-bright",
    bg: "bg-ng-green-bright/14",
    ring: "ring-ng-green-bright/28",
    title: "FSSAI licensed",
    /*
     * Shows the actual licence number when NEXT_PUBLIC_FSSAI_LIC is set.
     *
     * The sub-line used to read "ISO 22000 quality assured" under an FSSAI
     * heading, which conflates two unrelated certifications — FSSAI is a
     * statutory licence from the food authority, ISO 22000 is a voluntary
     * management standard from a private auditor. Claiming one under the
     * other's name is the kind of thing FSSAI's own labelling rules treat as
     * misleading, and ISO 22000 already has its own badge two cells along.
     *
     * The licence NUMBER is also what actually evidences the claim — far more
     * than a logo, which anyone can paste. Until it is configured the cell
     * simply says the category is licensed and claims nothing further.
     */
    sub: process.env.NEXT_PUBLIC_FSSAI_LIC
      ? `Lic. ${process.env.NEXT_PUBLIC_FSSAI_LIC}`
      : "Licensed food business",
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
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ring-1 ring-inset ${p.bg} ${p.tint} ${p.ring}`}
                >
                  {"app" in p ? <BrandIcon name={p.app} size={24} weight="solid" /> : <Icon name={p.icon} size={24} />}
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
