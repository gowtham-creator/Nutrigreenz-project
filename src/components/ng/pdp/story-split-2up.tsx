import Image from "next/image";
import { Reveal } from "@/components/ng/motion";
import type { ProduceIconName } from "@/components/ng/produce-icons";
import { PhotoPlaceholder, isPlaceholderSrc } from "./photo-placeholder";
import type { Split2UpSection } from "./pdp-story";

interface StorySplit2UpProps {
  data: Split2UpSection;
  /** Category glyph for the branded placeholder when no real photo exists. */
  produceIcon: ProduceIconName;
}

/**
 * StorySplit2Up — two side-by-side cards, each with an image, a heading and a
 * short supporting line. Stacks to a single column on mobile.
 */
export function StorySplit2Up({ data, produceIcon }: StorySplit2UpProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-6">
      {data.cards.map((card, i) => (
        <Reveal key={card.heading} delay={i * 0.08} className="h-full">
          <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-ng-line-soft bg-ng-paper">
            <div className="relative aspect-square overflow-hidden bg-ng-cream-deep">
              {isPlaceholderSrc(card.image.src) ? (
                <PhotoPlaceholder icon={produceIcon} variant="main" label={card.image.label ?? card.image.alt} />
              ) : (
                <Image
                  src={card.image.src}
                  alt={card.image.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex flex-col gap-2 p-6 md:p-7">
              <h3 className="font-display text-xl text-ng-forest-deep md:text-2xl">{card.heading}</h3>
              <p className="text-[14px] leading-relaxed text-ng-ink-muted">{card.sub}</p>
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  );
}
