import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { FSSAI_LICENCE, FssaiMark } from "../fssai-mark";
import { Reveal } from "../motion";

/**
 * AssuranceStrip — the four at-a-glance reasons to buy, under the hero.
 *
 * ── Why the discs went, and the tints with them ───────────────────────────
 *
 * Each mark sat in a 48px circle with its own tinted fill and matching ring:
 * leaf-green behind freshness, forest behind the lab, clay behind shipping,
 * bright green behind FSSAI. Four different coloured circles in one band meant
 * the first thing the eye did was compare the circles, and hue carried no
 * information — nothing about free shipping is gold rather than green. The
 * marks are bare now, larger, and all one ink, so what varies between cells is
 * only the drawing and the words.
 *
 * The band is also given room: 36px marks instead of 24, more vertical
 * padding, and the type stepped up with it. It was reading as a strip of fine
 * print between two much larger sections.
 *
 * ── Why these particular drawings ─────────────────────────────────────────
 *
 * Lucide stand-ins were doing the job before: a sprout for freshness, a
 * conical flask, a van, a tick-badge. Three of those were generic shapes
 * gesturing at the idea. A pressed-oil bottle IS the product being called
 * fresh, and a certificate is what "licensed" means — the same Icons8 marks
 * the trust band and shop hero use, so a shopper meets one icon language
 * across the whole storefront rather than three.
 */

const POINTS: { icon: UiIconName | "fssai"; title: string; sub: string }[] = [
  {
    icon: "press",
    title: "Cold-pressed fresh",
    sub: "Pressed within 7 days of dispatch",
  },
  {
    icon: "flask",
    title: "Lab-tested purity",
    sub: "Every lot — zero adulterants",
  },
  {
    icon: "delivery",
    title: "Free shipping",
    sub: "On all orders over ₹599",
  },
  {
    /*
     * A certificate, not a tick-badge. The FSSAI mark supplied was a
     * Shutterstock preview and cannot be published; the real mark may only be
     * shown beside the 14-digit licence number, which is still a placeholder in
     * the pack artwork. A generic certificate claims nothing that is not true.
     */
    icon: "fssai",
    title: "FSSAI licensed",
    /*
     * Shows the actual licence number when NEXT_PUBLIC_FSSAI_LIC is set.
     *
     * The sub-line once read "ISO 22000 quality assured" under an FSSAI
     * heading, which conflates two unrelated things — FSSAI is a statutory
     * licence from the food authority, ISO 22000 a voluntary management
     * standard from a private auditor. Claiming one under the other's name is
     * what FSSAI's own labelling rules treat as misleading.
     *
     * The licence NUMBER is also what actually evidences the claim, far more
     * than a logo anyone can paste. Until it is configured this says only that
     * the business is licensed, and claims nothing further.
     */
    sub: FSSAI_LICENCE ? `Lic. ${FSSAI_LICENCE}` : "Licensed food business",
  },
];

export function AssuranceStrip() {
  return (
    <section aria-label="Why shop with Nutri Greenz" className="relative px-4 sm:px-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[26px] border border-ng-line bg-ng-line/70 shadow-[var(--shadow-ng-card)] sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map((p) => (
              <li
                key={p.title}
                className="flex items-center gap-4 bg-ng-paper px-6 py-7 transition-colors hover:bg-ng-cream/60 md:px-7 md:py-8"
              >
                {p.icon === "fssai" ? (
                  <FssaiMark height={34} showNumber={false} className="shrink-0" />
                ) : (
                  <UiIcon name={p.icon} size={36} className="shrink-0 text-ng-forest-deep" />
                )}
                <div className="min-w-0">
                  <div className="font-display text-[16px] font-semibold leading-tight text-ng-forest-deep md:text-[17px]">
                    {p.title}
                  </div>
                  <div className="mt-1 text-[13.5px] leading-snug text-ng-ink-muted md:text-[14px]">
                    {p.sub}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
