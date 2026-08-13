import Image from "next/image";
import { Section } from "../section";
import { Stagger, StaggerItem } from "../motion";
import { BotanicalField } from "./botanical-field";

/**
 * NativeIngredients — four photographs of where the food actually comes from.
 *
 * ── What this replaced, and the one thing that had to survive ─────────────
 *
 * This slot held the traceability lot-lookup: a dark band with a code field and
 * a demo receipt. That control still exists in full at /traceability, and the
 * "See the proof" card in {@link OnlyPerfect} now carries the link to it — the
 * feature moved, it was not dropped. Worth stating plainly, because a homepage
 * section quietly disappearing is how a working feature stops being used.
 *
 * ── Why photographs and not another claim ─────────────────────────────────
 *
 * Everything above this point on the page is us talking. A red-soil field, a
 * hand holding a groundnut plant still on its roots, and a herd of Gir cows are
 * checkable in a way that "single-origin" is not — they show the reader the
 * thing rather than the adjective. All four are our own photography from our
 * own partner farms, which is also the only reason this section is allowed to
 * make the claim it makes.
 *
 * The text sits at the top of each card rather than the bottom, so it lands on
 * sky, soil or shallow background instead of on the subject.
 */

interface Panel {
  src: string;
  alt: string;
  title: string;
  body: string;
  /** Cards whose top third is light need dark type; the rest carry cream. */
  tone: "light" | "dark";
}

const PANELS: Panel[] = [
  {
    src: "/images/farm/dryland-farm.webp",
    alt: "Two farmers inspecting a groundnut crop in red dryland soil at Anantapur",
    title: "From native soils, in the right season",
    body: "We choose the region and the month before we choose the crop.",
    tone: "light",
  },
  {
    /* Not `gallery/groundnut-oil-sourcing.webp`, which looks like a photograph
       in a directory listing but is a composed PDP panel with its own headline
       and body copy baked into the pixels — two sets of type, one on top of the
       other. Only un-lettered photography belongs behind an overlay. */
    src: "/images/about/about-hero.webp",
    alt: "A farmer checking pods and leaf health by hand in a groundnut field before harvest",
    title: "What do we look for?",
    body: "Not the highest yield. Not the lowest price. Seed integrity, aroma and nutrition.",
    tone: "dark",
  },
  {
    src: "/images/products/oils/gallery/groundnut-oil-lifestyle.webp",
    alt: "A bottle of cold-pressed groundnut oil beside raw groundnuts and whole spices",
    title: "Impurities out. Goodness in.",
    body: "Wood-pressed in small batches, filtered by settling — never chemically stripped.",
    tone: "dark",
  },
  {
    src: "/images/farm/gir-farm.webp",
    alt: "A herd of Gir cows grazing at first light on a partner farm",
    title: "A2 milk from Gir cows, groundnut from Anantapur, and more",
    body: "Named breeds, named villages, named farmers — on request, for every lot.",
    tone: "dark",
  },
];

export function NativeIngredients() {
  return (
    <Section
      align="center"
      className="relative overflow-hidden bg-[#F6EFD8]"
      heading={
        <span className="text-ng-clay-deep">
          Native ingredients. <em className="italic">No substitutes.</em>
        </span>
      }
    >
      {/* Foliage runs behind the cards and is masked away from the middle, so it
          decorates the margins without sitting under the photographs. */}
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
        <BotanicalField color="#C8A668" opacity={0.42} className="absolute inset-0" />
      </div>

      <Stagger className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {PANELS.map((p) => (
          <StaggerItem key={p.title} className="h-full">
            <article className="group relative h-full overflow-hidden rounded-2xl bg-ng-forest-deep shadow-[0_18px_44px_-24px_rgba(60,44,18,0.55)]">
              <div className="relative aspect-[3/4.1] w-full">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
                {/* Legibility scrim over the top third only — the text block's
                    ground, not a wash over the whole photograph. */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[52%]"
                  style={{
                    background:
                      p.tone === "light"
                        ? "linear-gradient(180deg, rgba(247,245,236,0.94) 0%, rgba(247,245,236,0.80) 55%, rgba(247,245,236,0) 100%)"
                        : "linear-gradient(180deg, rgba(12,26,16,0.78) 0%, rgba(12,26,16,0.55) 55%, rgba(12,26,16,0) 100%)",
                  }}
                />
                <div className="absolute inset-x-0 top-0 p-5 text-center md:p-6">
                  <h3
                    className={`font-display text-[clamp(17px,1.5vw,20px)] leading-[1.2] text-balance ${
                      p.tone === "light" ? "text-ng-forest-deep" : "text-ng-cream"
                    }`}
                  >
                    {p.title}
                  </h3>
                  <p
                    className={`mx-auto mt-2 max-w-[28ch] text-[13px] leading-snug text-pretty ${
                      p.tone === "light" ? "text-ng-ink" : "text-ng-cream/85"
                    }`}
                  >
                    {p.body}
                  </p>
                </div>
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
