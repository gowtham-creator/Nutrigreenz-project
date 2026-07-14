import Image from "next/image";
import { FooterScene } from "@/components/ng/footer-scene";
import { PRODUCE_ICONS, type ProduceIconName } from "@/components/ng/produce-icons";
import { Reveal } from "@/components/ng/motion";
import type { PdpCategoryContent } from "./pdp-content";

interface StorySectionProps {
  story: PdpCategoryContent["story"];
  produceIcon: ProduceIconName;
}

/**
 * StorySection — category-specific brand narrative with a fully illustrated
 * visual (FooterScene landscape + produce glyph), no photography.
 */
export function StorySection({ story, produceIcon }: StorySectionProps) {
  const Glyph = PRODUCE_ICONS[produceIcon] ?? PRODUCE_ICONS.leaf;
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className="flex flex-col gap-5">
        <span className="ng-eyebrow text-ng-forest">{story.eyebrow}</span>
        <h2 className="font-display text-[clamp(26px,3.6vw,40px)] leading-tight text-ng-forest-deep">{story.title}</h2>
        {story.body.map((p) => (
          <p key={p} className="text-[15px] leading-relaxed text-ng-ink">
            {p}
          </p>
        ))}
      </Reveal>

      <Reveal delay={0.08}>
        {/* Real story photo when the category has one; illustrated stage otherwise. */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-ng-line-soft bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-forest-deep text-ng-forest-soft shadow-[var(--shadow-ng-card)]">
          {story.image ? (
            <Image
              src={story.image.src}
              alt={story.image.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ng-clay/15 blur-3xl" />
              </div>
              <FooterScene />
              <div className="absolute left-1/2 top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
                <span className="grid h-24 w-24 place-items-center rounded-3xl border border-ng-cream/15 bg-ng-cream/10 text-ng-cream backdrop-blur-sm sm:h-28 sm:w-28">
                  <Glyph size={56} className="text-ng-leaf" />
                </span>
              </div>
            </>
          )}
        </div>
      </Reveal>
    </div>
  );
}
