import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ng/motion";
import type { ProduceIconName } from "@/components/ng/produce-icons";
import { PhotoPlaceholder, isPlaceholderSrc } from "./photo-placeholder";
import type { WideBannerSection } from "./pdp-story";

interface StoryWideBannerProps {
  data: WideBannerSection;
  /** Category glyph for the branded placeholder when no real photo exists. */
  produceIcon: ProduceIconName;
}

/**
 * StoryWideBanner — a full-width forest-green band with an image on one side and
 * a big cream heading + sub on the other. Image stacks above the copy on mobile.
 */
export function StoryWideBanner({ data, produceIcon }: StoryWideBannerProps) {
  const imageRight = data.imageSide === "right";

  return (
    <div className="overflow-hidden rounded-[32px] border border-ng-forest-deep/40 bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-forest-deep text-ng-cream">
      <div className="grid items-stretch md:grid-cols-2">
        <Reveal className={cn("relative min-h-[260px] md:min-h-[380px]", imageRight ? "md:order-2" : "md:order-1")}>
          {isPlaceholderSrc(data.image.src) ? (
            <div className="absolute inset-0">
              <PhotoPlaceholder icon={produceIcon} variant="main" label={data.image.label ?? data.image.alt} />
            </div>
          ) : (
            <Image
              src={data.image.src}
              alt={data.image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          )}
        </Reveal>

        <Reveal
          delay={0.08}
          className={cn(
            "flex flex-col justify-center gap-4 p-8 md:p-12 lg:p-16",
            imageRight ? "md:order-1" : "md:order-2",
          )}
        >
          <h2 className="font-display text-[clamp(26px,4vw,46px)] leading-[1.05] text-ng-cream">{data.heading}</h2>
          <p className="text-[15px] leading-relaxed text-ng-cream/75 md:text-[17px]">{data.sub}</p>
        </Reveal>
      </div>
    </div>
  );
}
