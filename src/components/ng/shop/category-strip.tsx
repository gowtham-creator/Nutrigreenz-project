"use client";

import Link from "next/link";
import Image from "next/image";
import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/nutrigreenz";

/**
 * Per-slug icon fallbacks.
 *
 * Categories carry an admin-settable `image` and `icon`, and both win over this
 * map. Today every category has neither, so without a fallback the strip would
 * render a row of identical placeholders and lose the only thing that makes it
 * scannable. These are chosen to be recognisable at 40px rather than literal:
 * a bee reads as honey far faster than a jar does.
 */
const FALLBACK_ICON: Record<string, UiIconName> = {
  oils: "groundnut",
  honey: "bee",
  ghee: "flask",
  pulses: "leaf",
  rice: "soil",
  millets: "leaf",
  spices: "soil",
  superfoods: "leaf",
};

const ALL_ICON: UiIconName = "category";

interface CategoryStripProps {
  categories: Category[];
  /** Slug of the active category; omitted or "all" highlights the All tile. */
  active?: string;
  className?: string;
}

/**
 * CategoryStrip — the icon row that lets a shopper jump between categories.
 *
 * ── Why only categories that have products ────────────────────────────────
 *
 * The catalogue currently carries five categories, two of which (pulses, rice)
 * have no active products. Listing them would offer a shopper a door that opens
 * onto an empty room, which is worse than not offering it. They reappear the
 * moment something is published into them, so nothing needs remembering.
 *
 * ── Why the whole tile is the link ────────────────────────────────────────
 *
 * The icon and the label are one target rather than two. A 40px glyph is a
 * small thing to hit on a phone, and splitting the tap area between the picture
 * and the word underneath it is the classic way to make a row like this feel
 * unresponsive.
 */
export function CategoryStrip({ categories, active, className }: CategoryStripProps) {
  const withProducts = categories.filter((c) => (c.productCount ?? 0) > 0);
  if (withProducts.length === 0) return null;

  const tiles = [
    { slug: "all", title: "All", href: "/shop", image: undefined as string | undefined },
    ...withProducts.map((c) => ({
      slug: c.slug,
      title: c.title,
      href: `/shop/${c.slug}`,
      image: c.image,
    })),
  ];
  const activeSlug = active && active !== "" ? active : "all";

  return (
    <nav
      aria-label="Shop by category"
      className={cn(
        /* Scrolls horizontally on a phone rather than wrapping to two rows.
           A wrapped row changes height between pages and shifts everything
           below it, which is the more jarring failure of the two. */
        "-mx-4 flex snap-x snap-mandatory gap-1 overflow-x-auto px-4 pb-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:mx-0 sm:justify-center sm:gap-2 sm:overflow-visible sm:px-0",
        className,
      )}
    >
      {tiles.map((t) => {
        const on = t.slug === activeSlug;
        return (
          <Link
            key={t.slug}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "group flex shrink-0 snap-start flex-col items-center gap-2 rounded-xl px-3 py-2.5",
              "transition-colors duration-200 sm:px-4",
              on ? "text-ng-forest-deep" : "text-ng-ink-muted hover:text-ng-forest",
            )}
          >
            <span
              className={cn(
                "grid h-12 w-12 place-items-center rounded-full transition-colors duration-200 sm:h-14 sm:w-14",
                on ? "bg-ng-sage/45" : "bg-ng-cream/60 group-hover:bg-ng-sage/25",
              )}
            >
              {t.image ? (
                <Image
                  src={t.image}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
              ) : (
                <UiIcon
                  name={t.slug === "all" ? ALL_ICON : FALLBACK_ICON[t.slug] ?? ALL_ICON}
                  size={28}
                  className={on ? "text-ng-forest" : "text-ng-forest/70"}
                />
              )}
            </span>

            {/* The label carries the state as well as the icon. Colour alone
                would leave the active tile invisible to anyone who cannot
                separate the two greens, so weight changes too. */}
            <span
              className={cn(
                "whitespace-nowrap text-[13px] leading-none transition-[font-weight,color] sm:text-[14px]",
                on ? "font-bold" : "font-medium",
              )}
            >
              {t.title}
            </span>

            {/* The underline is drawn at a constant height and made transparent
                when inactive, so selecting a tile never changes the row's
                height and nudges the grid below it. */}
            <span
              aria-hidden
              className={cn(
                "h-[3px] w-8 rounded-full transition-colors duration-200",
                on ? "bg-ng-forest" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
