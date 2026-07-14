import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import type { PdpImage, UseTip } from "./pdp-content";
import { PhotoPlaceholder } from "./photo-placeholder";
import type { ProduceIconName } from "@/components/ng/produce-icons";
import type { CategoryTheme } from "@/lib/category-theme";

interface UsesProps {
  intro: string;
  tips: UseTip[];
  /** Category glyph for the lifestyle "in your kitchen" photo placeholder. */
  icon?: ProduceIconName;
  /** Real lifestyle photo for the "in your kitchen" panel; falls back to the themed placeholder. */
  image?: PdpImage;
  /** Per-category theme so the fallback placeholder reads category-appropriate. */
  theme?: CategoryTheme;
}

/**
 * Uses — category-specific usage tips beside a lifestyle photo slot. The key
 * phrase of each tip is bolded; the photo placeholder shows where an in-use /
 * recipe shot belongs (Anveshan-style) once real photography lands.
 */
export function Uses({ intro, tips, icon = "leaf", image, theme }: UsesProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-12">
      <div className="flex flex-col gap-6">
        <p className="max-w-2xl text-[15px] leading-relaxed text-ng-ink-muted">{intro}</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {tips.map((t) => (
            <li
              key={t.key}
              className="flex items-start gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper p-4"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-forest">
                <Icon name="chef-hat-bold" size={16} className="text-ng-leaf" />
              </span>
              <p className="text-[14px] leading-relaxed text-ng-ink">
                <span className="font-semibold text-ng-forest-deep">{t.key}</span>
                {t.rest}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Lifestyle "in your kitchen" slot — real photo when available, themed placeholder otherwise. */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] border border-ng-line-soft shadow-[var(--shadow-ng-card)] sm:aspect-[16/10] lg:aspect-[4/5]">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover"
          />
        ) : (
          <PhotoPlaceholder icon={icon} variant="main" label="In your kitchen" theme={theme} />
        )}
      </div>
    </div>
  );
}
