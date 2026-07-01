import Image from "next/image";
import { Reveal } from "@/components/ng/motion";
import type { StoryTileRow } from "./pdp-story";

interface StoryTileRowsProps {
  rows: StoryTileRow[];
}

/**
 * StoryTileRows — stacked editorial story tiles with the headline typeset on
 * the artwork itself (Anveshan-style): full-width 16:9 banners interleaved
 * with 4:5 two-up rows. Pure imagery — no HTML text overlay, so nothing
 * duplicates the copy baked into each tile.
 */
export function StoryTileRows({ rows }: StoryTileRowsProps) {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {rows.map((row, i) =>
        row.layout === "full" ? (
          <Reveal key={row.images[0]?.src ?? i}>
            <div className="relative aspect-video overflow-hidden rounded-[28px] border border-ng-line-soft shadow-[var(--shadow-ng-card)]">
              <Image
                src={row.images[0].src}
                alt={row.images[0].alt}
                fill
                sizes="(max-width: 768px) 100vw, 1152px"
                className="object-cover"
              />
            </div>
          </Reveal>
        ) : (
          <div key={row.images[0]?.src ?? i} className="grid gap-5 md:grid-cols-2 md:gap-6">
            {row.images.map((img, j) => (
              <Reveal key={img.src} delay={j * 0.08}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] border border-ng-line-soft shadow-[var(--shadow-ng-card)]">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 560px"
                    className="object-cover"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
