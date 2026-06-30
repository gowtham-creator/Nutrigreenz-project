import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ng/motion";
import type { ProduceIconName } from "@/components/ng/produce-icons";
import { PhotoPlaceholder, isPlaceholderSrc } from "./photo-placeholder";
import type { BenefitHeroSection } from "./pdp-story";

interface StoryBenefitHeroProps {
  data: BenefitHeroSection;
  /** Category glyph for the branded placeholder when no real photo exists. */
  produceIcon: ProduceIconName;
}

/**
 * StoryBenefitHero — a rounded cream card with the product image on the left and
 * a big heading, a short supporting line and up to three line-icon bullets on
 * the right. Mirrors the "The Nutri Greenz Way" benefit block.
 */
export function StoryBenefitHero({ data, produceIcon }: StoryBenefitHeroProps) {
  return (
    <div className="grid items-center gap-8 rounded-[28px] border border-ng-line-soft bg-ng-cream p-5 md:grid-cols-2 md:gap-12 md:p-10">
      <Reveal>
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-cream-deep">
          {isPlaceholderSrc(data.image.src) ? (
            <PhotoPlaceholder icon={produceIcon} variant="main" label={data.image.label ?? data.image.alt} />
          ) : (
            <Image
              src={data.image.src}
              alt={data.image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          )}
        </div>
      </Reveal>

      <Reveal delay={0.08} className="flex flex-col gap-5">
        <h3 className="font-display text-[clamp(24px,3.4vw,38px)] leading-tight text-ng-forest-deep">
          {data.heading}
        </h3>
        <p className="text-[15px] leading-relaxed text-ng-ink-muted">{data.sub}</p>
        <ul className="flex flex-col gap-3">
          {data.bullets.map((b) => (
            <li key={b.label} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ng-forest/20 bg-ng-paper text-ng-forest">
                <Icon name={b.icon} size={20} className="text-ng-forest" />
              </span>
              <span className="text-[15px] font-medium text-ng-forest-deep">{b.label}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
