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
}

const CHECKS: Check[] = [
  {
    src: "/images/journal/what-lab-tests-mean.webp",
    alt: "A technician pipetting an oil sample into a vial at the Nutri Greenz Hyderabad bench",
    title: "Our own lab. Not someone else's.",
    body: "Safety is not a thing we outsource and hope about.",
  },
  {
    src: "/images/products/ghee/ghee-lab.webp",
    alt: "An analyst examining a ghee sample under a microscope beside sealed jars",
    title: "Every batch. Not every other one.",
    body: "Adulterants, aflatoxin, heavy metals, moisture. A lot that fails does not ship.",
  },
  {
    src: "/images/farms/farms-hero.webp",
    alt: "A partner farmer checking soil and root health in a groundnut field before harvest",
    title: "Checked at three stages.",
    body: "At sourcing, after pressing, and before sealing — because problems start upstream.",
  },
  {
    src: "/images/products/oils/gallery/oils-tile-range.webp",
    alt: "The Nutri Greenz cold-pressed oil range, each bottle carrying its own lot code",
    title: "See the proof. Don't just trust us.",
    body: "Every bottle carries a six-character lot code. Type it in and read the same report we do.",
  },
];

export function OnlyPerfect() {
  return (
    <Section
      align="center"
      className="relative overflow-hidden bg-[#DCEAF0]"
      heading={<span className="text-[#3A7B92]">Only perfect makes the cut</span>}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          maskImage:
            "linear-gradient(90deg, black 0%, transparent 26%, transparent 74%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, black 0%, transparent 26%, transparent 74%, black 100%)",
        }}
      >
        <BotanicalField color="#8FB8C8" opacity={0.5} className="absolute inset-0" />
      </div>

      <Stagger className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {CHECKS.map((c, i) => {
          const isLast = i === CHECKS.length - 1;
          const card = (
            <article
              className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-[#FAF3E2] shadow-[0_18px_44px_-26px_rgba(30,60,74,0.5)] ${
                isLast ? "transition-shadow hover:shadow-[0_22px_50px_-22px_rgba(30,60,74,0.6)]" : ""
              }`}
            >
              <div className="px-5 pb-5 pt-7 text-center md:px-6">
                <h3 className="font-display text-[clamp(17px,1.5vw,20px)] leading-[1.2] text-ng-forest-deep text-balance">
                  {c.title}
                </h3>
                <p className="mx-auto mt-2.5 max-w-[30ch] text-[13px] leading-snug text-ng-ink-muted text-pretty">
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
              <div className="relative mt-auto aspect-[4/3.4] w-full">
                <Image
                  src={c.src}
                  alt={c.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
              </div>
            </article>
          );

          return (
            <StaggerItem key={c.title} className="h-full">
              {isLast ? (
                <Link
                  href="/traceability"
                  className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest focus-visible:ring-offset-2 focus-visible:ring-offset-[#DCEAF0]"
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
