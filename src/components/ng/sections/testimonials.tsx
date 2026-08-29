"use client";

import { Section } from "../section";
import { Stars } from "../stars";
import { Stagger, StaggerItem, Parallax } from "../motion";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";
import { TESTIMONIALS } from "../data";

/** Two-letter monogram from a display name, e.g. "Anjali R." → "AR". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Per-card accent set. Gold (clay) is used on ONE card only so the trio reads
 * warm-but-restrained; leaf + forest carry the rest.
 */
const ACCENTS: { avatar: string; watermark: string; bar: string }[] = [
  { avatar: "bg-ng-leaf/20 text-ng-forest ring-ng-leaf/35", watermark: "text-ng-leaf/25", bar: "from-ng-leaf/70" },
  { avatar: "bg-ng-clay/16 text-ng-clay-deep ring-ng-clay/30", watermark: "text-ng-clay/20", bar: "from-ng-clay/55" },
  { avatar: "bg-ng-forest/12 text-ng-forest ring-ng-forest/25", watermark: "text-ng-forest/18", bar: "from-ng-forest/55" },
];

export function Testimonials() {
  return (
    <Section
      align="center"
      className="overflow-hidden"
      eyebrow="From our pantry families"
      heading={<>What 12,400+ households <em className="italic text-ng-leaf">are saying.</em></>}
      description="Verified reviews, every one. No filters, no edits."
    >
      {/* Depth backdrop — drifts slower than foreground */}
      <Parallax
        speed={0.3}
        className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 z-0"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 36% 44% at 18% 24%, rgba(181,134,47,0.12), transparent 62%), radial-gradient(ellipse 40% 50% at 84% 78%, rgba(102,191,115,0.12), transparent 64%)",
          }}
        />
        {/* Oversized floating quotation mark, far behind content */}
        <div
          aria-hidden
          className="absolute right-[6%] top-[2%] font-display text-[clamp(180px,26vw,360px)] leading-none text-ng-clay/10 select-none"
        >
          &rdquo;
        </div>
      </Parallax>

      <Stagger className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mt-2 persp-1000">
        {TESTIMONIALS.map((t, i) => {
          const accent = ACCENTS[i % ACCENTS.length]!;
          return (
            <StaggerItem key={t.id} className="h-full">
              <figure className="group/card relative flex h-full flex-col overflow-hidden rounded-3xl glass ng-float p-6 md:p-7">
                {/* Accent hairline along the top edge */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r to-transparent",
                    accent.bar,
                  )}
                />
                {/* Soft top sheen for subtle depth */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/45 to-transparent"
                />
                {/* Oversized quote watermark, tinted per accent, behind the copy */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -top-3 right-4 font-display text-[110px] leading-none select-none",
                    accent.watermark,
                  )}
                >
                  &rdquo;
                </div>

                <div className="relative flex flex-1 flex-col">
                  {/* Rating row — stars + numeric score */}
                  <div className="flex items-center gap-2">
                    <Stars rating={t.rating} size="sm" showCount={false} />
                    <span className="text-[12px] font-semibold tabular-nums text-ng-clay-deep">
                      {t.rating.toFixed(1)}
                    </span>
                  </div>

                  <blockquote className="mt-4 font-display text-[17px] md:text-[20px] leading-[1.5] md:leading-[1.42] text-ng-forest-deep">
                    {t.quote}
                  </blockquote>

                  <figcaption className="mt-auto flex items-center gap-3 pt-6 border-t border-ng-line-soft">
                    {/* Monogram avatar */}
                    <span
                      className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-[15px] font-semibold ring-1 ring-inset",
                        accent.avatar,
                      )}
                      aria-hidden
                    >
                      {initials(t.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[15px] leading-tight text-ng-ink truncate">
                        {t.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ng-ink-soft">
                        <UiIcon name="location" size={12} className="text-ng-leaf" />
                        <span className="truncate">{t.location}</span>
                      </div>
                    </div>
                    {/* Verified pill with check glyph */}
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ng-success/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ng-forest-deep">
                      <UiIcon name="verified" size={13} className="text-ng-success" />
                      Verified
                    </span>
                  </figcaption>
                </div>
              </figure>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}
