"use client";

import Link from "next/link";
import { Section } from "../section";
import { PRODUCE_ICONS } from "../produce-icons";
import { Stagger, StaggerItem, Parallax } from "../motion";
import { CATEGORIES } from "../data";
import { cn } from "@/lib/utils";

/**
 * Per-category colour theme. Keyed by category id with a sensible fallback.
 * Each theme drives: tinted card background, a vivid icon chip, the icon's
 * accent colour (rendered via currentColor on the chip), the card border and
 * a matching hover border/glow. Full class strings (no interpolation) so
 * Tailwind v4 keeps them.
 */
type CatTheme = {
  card: string; // tinted card bg + resting border
  hover: string; // hover border + glow
  chip: string; // vivid icon chip bg
  icon: string; // icon stroke colour (currentColor)
};

const CATEGORY_THEMES: Record<string, CatTheme> = {
  oils: {
    card: "bg-ng-leaf/10 border-ng-leaf/25",
    hover: "hover:border-ng-leaf hover:shadow-[0_18px_40px_-18px_rgba(102,191,115,0.55)]",
    chip: "bg-ng-leaf/20",
    icon: "text-ng-leaf",
  },
  ghee: {
    card: "bg-ng-clay/12 border-ng-clay/25",
    hover: "hover:border-ng-clay hover:shadow-[0_18px_40px_-18px_rgba(181,134,47,0.55)]",
    chip: "bg-ng-clay/20",
    icon: "text-ng-clay",
  },
  honey: {
    card: "bg-ng-amber/12 border-ng-amber/30",
    hover: "hover:border-ng-amber hover:shadow-[0_18px_40px_-18px_rgba(242,158,18,0.6)]",
    chip: "bg-ng-amber/20",
    icon: "text-ng-amber",
  },
  millets: {
    card: "bg-ng-clay-deep/12 border-ng-clay-deep/28",
    hover: "hover:border-ng-clay-deep hover:shadow-[0_18px_40px_-18px_rgba(138,100,32,0.55)]",
    chip: "bg-ng-clay-deep/20",
    icon: "text-ng-clay-deep",
  },
  spices: {
    card: "bg-ng-terracotta/12 border-ng-terracotta/25",
    hover: "hover:border-ng-terracotta hover:shadow-[0_18px_40px_-18px_rgba(199,77,51,0.55)]",
    chip: "bg-ng-terracotta/20",
    icon: "text-ng-terracotta",
  },
  superfoods: {
    card: "bg-ng-green-bright/12 border-ng-green-bright/30",
    hover: "hover:border-ng-green-bright hover:shadow-[0_18px_40px_-18px_rgba(76,175,80,0.55)]",
    chip: "bg-ng-green-bright/20",
    icon: "text-ng-green-bright",
  },
  pulses: {
    card: "bg-ng-soil/12 border-ng-soil/28",
    hover: "hover:border-ng-soil hover:shadow-[0_18px_40px_-18px_rgba(60,47,31,0.5)]",
    chip: "bg-ng-soil/22",
    icon: "text-ng-soil",
  },
  flours: {
    card: "bg-[#6E7F8D]/12 border-[#6E7F8D]/30",
    hover: "hover:border-[#6E7F8D] hover:shadow-[0_18px_40px_-18px_rgba(110,127,141,0.55)]",
    chip: "bg-[#6E7F8D]/20",
    icon: "text-[#6E7F8D]",
  },
  fruits: {
    card: "bg-[#C75B7A]/12 border-[#C75B7A]/30",
    hover: "hover:border-[#C75B7A] hover:shadow-[0_18px_40px_-18px_rgba(199,91,122,0.55)]",
    chip: "bg-[#C75B7A]/20",
    icon: "text-[#C75B7A]",
  },
  gifting: {
    card: "bg-ng-blue/12 border-ng-blue/28",
    hover: "hover:border-ng-blue hover:shadow-[0_18px_40px_-18px_rgba(41,98,163,0.55)]",
    chip: "bg-ng-blue/20",
    icon: "text-ng-blue",
  },
};

const FALLBACK_THEME: CatTheme = {
  card: "bg-ng-leaf/10 border-ng-leaf/25",
  hover: "hover:border-ng-leaf hover:shadow-[0_18px_40px_-18px_rgba(102,191,115,0.55)]",
  chip: "bg-ng-leaf/20",
  icon: "text-ng-leaf",
};

export function Categories() {
  return (
    <Section
      className="overflow-hidden"
      eyebrow="Shop by harvest"
      heading={<>Ten categories. One pantry. <em className="italic text-ng-leaf">All single-origin.</em></>}
      description="Every category is sourced from a named farm or co-op. Tap any tile to see who grew it and how."
    >
      {/* Parallaxed soft depth blob behind the grid — drifts slower than tiles */}
      <Parallax speed={0.3} className="pointer-events-none absolute inset-0 -z-10">
        <div
          aria-hidden
          className="absolute right-[-6rem] top-1/4 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--ng-sage), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute left-[-5rem] bottom-0 h-[360px] w-[360px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--ng-clay), transparent 72%)" }}
        />
      </Parallax>

      <Stagger className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
        {CATEGORIES.map((cat) => {
          const Icon = PRODUCE_ICONS[cat.icon as keyof typeof PRODUCE_ICONS] ?? PRODUCE_ICONS.leaf;
          const theme = CATEGORY_THEMES[cat.id] ?? FALLBACK_THEME;
          return (
            <StaggerItem key={cat.id} className="persp-1000">
              <Link
                href={`/shop/${cat.slug}`}
                className={cn(
                  "group ng-float relative flex flex-col items-center gap-3 rounded-2xl p-5 md:p-6",
                  "border transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "[transform-style:preserve-3d] hover:[transform:translateY(-6px)_rotateX(4deg)_rotateY(-3deg)]",
                  theme.card,
                  theme.hover,
                )}
              >
                <div
                  className={cn(
                    "h-16 w-16 rounded-2xl grid place-items-center transition-transform duration-500 group-hover:scale-110",
                    theme.chip,
                    theme.icon,
                  )}
                >
                  <Icon size={32} />
                </div>
                <div className="text-center">
                  <h3 className="font-display text-[15px] leading-tight text-ng-forest-deep group-hover:text-ng-forest transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-[11px] text-ng-ink-muted mt-0.5">{cat.productCount} items</p>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}
