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
    body: "Seed integrity, aroma and nutrition come before yield or price.",
    tone: "dark",
  },
  {
    src: "/images/products/oils/gallery/groundnut-oil-lifestyle.webp",
    alt: "A bottle of cold-pressed groundnut oil beside raw groundnuts and whole spices",
    title: "Clean oil, no chemicals",
    body: "Wood-pressed in small batches, filtered by settling, never chemically stripped.",
    tone: "dark",
  },
  {
    src: "/images/farm/gir-farm.webp",
    alt: "A herd of Gir cows grazing at first light on a partner farm",
    title: "A2 milk from Gir cows, groundnut from Anantapur, and more",
    body: "Named breeds, named villages, named farmers: on request, for every lot.",
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
          Native ingredients, <em className="italic">with no substitutes.</em>
        </span>
      }
    >
      {/* The engraving dresses the margins and fades out before the middle, so
          it never sits under the heading or the photographs. */}
      <BotanicalField color="#B8912F" opacity={0.2} />

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
                {/*
                  ── Type over photography ─────────────────────────────────

                  These were set in `font-display`, which is Roboto Slab. A slab
                  serif is the wrong tool here: its serifs are heavy rectangles
                  that fill in at 17px, and the stroke contrast that gives it
                  character on a flat cream band works against it over a
                  photograph, where every thin part of a letter competes with
                  whatever texture happens to sit behind it.

                  Both lines are Hanken Grotesk now — the body sans, so the card
                  speaks in one voice — with hierarchy carried by weight, size
                  and colour rather than by a second typeface. Even grotesque
                  strokes hold their shape against soil, leaves and hide.

                  The measure is tightened from 28ch to 24ch. Centred text needs
                  a shorter line than ranged-left before the ragged edges start
                  reading as untidy, and at this card width 28ch was breaking
                  three-line bodies at awkward places.
                */}
                <div className="absolute inset-x-0 top-0 p-5 text-center md:p-6">
                  <h3
                    className={`font-sans text-[clamp(18px,1.6vw,21px)] font-bold leading-[1.16] tracking-[-0.012em] text-balance ${
                      p.tone === "light" ? "text-ng-forest-deep" : "text-ng-cream"
                    }`}
                    style={
                      /* Only the dark cards need it: a soft drop shadow keeps
                         the type separable where the photo behind it is busy or
                         bright, without reading as a shadow. */
                      p.tone === "dark"
                        ? { textShadow: "0 1px 12px rgba(8,20,12,0.55)" }
                        : undefined
                    }
                  >
                    {p.title}
                  </h3>
                  <p
                    className={`mx-auto mt-2.5 max-w-[24ch] text-[13.5px] font-normal leading-[1.5] text-pretty ${
                      p.tone === "light" ? "text-ng-ink" : "text-ng-cream/90"
                    }`}
                    style={
                      p.tone === "dark"
                        ? { textShadow: "0 1px 10px rgba(8,20,12,0.5)" }
                        : undefined
                    }
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
