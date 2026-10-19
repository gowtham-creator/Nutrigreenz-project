import Image from "next/image";
import Link from "next/link";
import { Section } from "../section";
import { Stagger, StaggerItem } from "../motion";
import { BotanicalField } from "./botanical-field";

/**
 * OnlyPerfect — how a batch is checked, in four cards.
 *
 * ── Where the traceability lookup went ────────────────────────────────────
 *
 * The fourth card is the one that matters structurally: it carries the link to
 * /traceability, which used to have its own band on this page. Losing a working
 * lot-lookup because a layout changed would be the worst outcome of this
 * redesign, so it is deliberately the card with the call to action rather than
 * a fourth flat statement.
 *
 * ── On the numbers ────────────────────────────────────────────────────────
 *
 * Every figure here is one we can produce a document for. There is no "40+
 * tests" or "5000+ families" — those belong to whoever can evidence them, and
 * an unevidenced count on a food page is a misleading advertisement under the
 * Consumer Protection Act 2019, not a design detail. Where the honest answer
 * was a stage rather than a number, this says the stage.
 *
 * Photographs are our own: the Hyderabad bench, our microscope, our fields.
 */

interface Check {
  src: string;
  alt: string;
  title: string;
  body: string;
  /**
   * Set for product shots photographed on a white sweep rather than on
   * location. Those arrive with a hard white field that meets the card's cream
   * at a visible seam — see the note at the render site.
   */
  onWhite?: boolean;
}

const CHECKS: Check[] = [
  {
    src: "/images/journal/what-lab-tests-mean.webp",
    alt: "A technician pipetting an oil sample into a vial at the Nutri Greenz Hyderabad bench",
    title: "We run our own lab",
    body: "We don't hand safety to someone else and hope for the best.",
  },
  {
    src: "/images/products/ghee/ghee-lab.webp",
    alt: "An analyst examining a ghee sample under a microscope beside sealed jars",
    title: "We test every batch",
    body: "Adulterants, aflatoxin, heavy metals, moisture. A lot that fails does not ship.",
  },
  {
    src: "/images/farms/farms-hero.webp",
    alt: "A partner farmer checking soil and root health in a groundnut field before harvest",
    title: "Checked at three stages.",
    body: "At sourcing, after pressing and before sealing, because problems start upstream.",
  },
  {
    src: "/images/products/oils/gallery/oils-tile-range.webp",
    alt: "The Nutri Greenz cold-pressed oil range, each bottle carrying its own lot code",
    title: "Check the proof yourself",
    body: "Every bottle carries a six-character lot code. Type it in and read the same report we do.",
    onWhite: true,
  },
];

export function OnlyPerfect() {
  return (
    /*
      ── On the band colour ────────────────────────────────────────────────
      This was a pale blue with a slate-blue heading, carried over from the
      layout that inspired it. Nutri Greenz has no blue: the palette is forest,
      cream, clay and gold, and the one blue token in the system is `--ng-blue`,
      reserved for informational states in the admin console. A cold band
      halfway down a warm page read as a screenshot from a different product.

      Pale sage keeps the separation the blue was there for — this section has
      to feel distinct from the cream band above it — while staying inside the
      brand. The cards keep their warm cream, which now sits on sage the way
      paper sits on a leaf rather than fighting a cold ground.
    */
    <Section
      align="center"
      className="relative overflow-hidden bg-[#E9F0E4]"
      heading={<span className="text-ng-forest-soft">Only perfect makes the cut</span>}
    >
      <BotanicalField color="#6F8F67" opacity={0.28} flip />

      <Stagger className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {CHECKS.map((c, i) => {
          const isLast = i === CHECKS.length - 1;
          const card = (
            <article
              className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-[#FAF3E2] shadow-[0_18px_44px_-26px_rgba(28,52,32,0.42)] ${
                isLast ? "transition-shadow hover:shadow-[0_22px_50px_-22px_rgba(28,52,32,0.5)]" : ""
              }`}
            >
              <div className="px-5 pb-5 pt-7 text-center md:px-6">
                {/* Hanken Grotesk, not the Roboto Slab display face. The slab's
                    heavy rectangular serifs clot at 17–20px, and four of these
                    headings stacked in a row across a band made the section read
                    as older and denser than everything around it. Hierarchy
                    comes from weight and size, in one typeface. */}
                <h3 className="font-sans text-[clamp(18px,1.6vw,21px)] font-bold leading-[1.16] tracking-[-0.012em] text-ng-forest-deep text-balance">
                  {c.title}
                </h3>
                <p className="mx-auto mt-2.5 max-w-[26ch] text-[13.5px] font-normal leading-[1.5] text-ng-ink-muted text-pretty">
                  {c.body}
                </p>
                {isLast ? (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ng-forest group-hover:text-ng-leaf">
                    Trace a lot
                    <span aria-hidden>→</span>
                  </span>
                ) : null}
              </div>
              {/* Photo anchors the card. mt-auto keeps the images on one baseline
                  when the headings above them wrap to different depths. */}
              <div
                className="relative mt-auto aspect-[4/3.4] w-full"
                style={c.onWhite ? { background: "#FAF3E2" } : undefined}
              >
                <Image
                  src={c.src}
                  alt={c.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  /*
                   * The range shot is photographed on a white sweep, so it met
                   * the card's cream at a hard horizontal seam halfway down —
                   * the only card of four that looked like two pieces. Multiply
                   * over a cream ground drops the white out and leaves the
                   * bottles, which is what the pack shot is for. `contain` too:
                   * `cover` was cropping the outer bottles of a six-bottle
                   * lineup, and a range shot missing part of the range is not
                   * showing the range.
                   */
                  className={
                    c.onWhite
                      ? "object-contain p-3 mix-blend-multiply transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                      : "object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  }
                />
              </div>
            </article>
          );

          return (
            <StaggerItem key={c.title} className="h-full">
              {isLast ? (
                <Link
                  href="/traceability"
                  className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest focus-visible:ring-offset-2 focus-visible:ring-offset-[#E9F0E4]"
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}
