"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Section } from "../section";
import { ProductCard } from "../product-card";
import { PRODUCE_ICONS } from "../produce-icons";
import { Stagger, StaggerItem } from "../motion";
import { SLUG_TO_TAGS } from "../shop/types";
import { cn } from "@/lib/utils";
import type { Category, ProductCard as ProductCardType } from "@/types/nutrigreenz";

/** How many products each tab surfaces. */
const MAX_TILES = 5;

type TabDef = {
  /** "all" or a category slug. */
  key: string;
  label: string;
  /** PRODUCE_ICONS key. */
  icon: keyof typeof PRODUCE_ICONS;
  /** Destination for the "View all" link. */
  href: string;
};

const ALL_TAB: TabDef = { key: "all", label: "All", icon: "leaf", href: "/shop" };

/**
 * A produce glyph per known category slug so the live catalog (whose categories
 * all carry the same generic icon) still reads colourful and varied. Falls back
 * to the category's own icon, then a leaf.
 */
const SLUG_ICONS: Record<string, keyof typeof PRODUCE_ICONS> = {
  oils: "oil",
  ghee: "ghee",
  honey: "honey",
  rice: "grain",
  millets: "grain",
  spices: "spice",
  superfoods: "seedling",
  pulses: "nuts",
  flours: "flour",
  fruits: "fruit",
  gifting: "gift",
};

/**
 * Per-category accent colour so the row reads colourful and varied instead of
 * all-green. `tint` colours the glyph; `ring` is the soft circle behind it. The
 * glyphs stay vector `currentColor`, so on the active (forest) tab they invert
 * to cream cleanly — something a fixed-colour image could never do.
 */
const CAT_COLORS: Record<string, { tint: string; ring: string }> = {
  all: { tint: "text-ng-leaf", ring: "bg-ng-leaf/12" },
  oils: { tint: "text-ng-amber", ring: "bg-ng-amber/15" },
  ghee: { tint: "text-ng-clay-deep", ring: "bg-ng-clay/20" },
  honey: { tint: "text-ng-clay", ring: "bg-ng-clay/15" },
  rice: { tint: "text-ng-clay-deep", ring: "bg-ng-clay-deep/12" },
  millets: { tint: "text-ng-soil", ring: "bg-ng-soil/12" },
  spices: { tint: "text-ng-terracotta", ring: "bg-ng-terracotta/15" },
  superfoods: { tint: "text-ng-green-bright", ring: "bg-ng-green-bright/15" },
  pulses: { tint: "text-ng-soil", ring: "bg-ng-soil/12" },
  flours: { tint: "text-ng-clay", ring: "bg-ng-clay/15" },
  fruits: { tint: "text-ng-terracotta", ring: "bg-ng-terracotta/15" },
  gifting: { tint: "text-ng-forest", ring: "bg-ng-forest/12" },
};

/** Highest-rated products first — the live mapper sets no "Best seller" badge. */
function bestsellers(products: ProductCardType[]): ProductCardType[] {
  return [...products]
    .sort((a, b) => b.rating - a.rating || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, MAX_TILES);
}

/**
 * Products for a category slug, capped to MAX_TILES. The live catalog stamps the
 * category SLUG into each product's `tags`; the bundled sample uses the singular
 * demo tag (via SLUG_TO_TAGS). Match either so the tab is populated in both modes.
 */
function productsForSlug(products: ProductCardType[], slug: string): ProductCardType[] {
  const extra = SLUG_TO_TAGS[slug] ?? [];
  return products
    .filter((p) => p.tags?.some((t) => t === slug || extra.includes(t)))
    .slice(0, MAX_TILES);
}

interface Props {
  /** Real categories that have ≥1 active product (empty ones are pre-filtered). */
  categories: Category[];
  /** The product pool the tabs surface, in storefront ProductCard shape. */
  products: ProductCardType[];
  className?: string;
}

export function ShopByCategory({ categories, products, className }: Props) {
  // Tabs come straight from the catalog's real categories, so the home page,
  // /shop and the PDP breadcrumbs all reference the same set of slugs.
  const tabs = useMemo<TabDef[]>(
    () => [
      ALL_TAB,
      ...categories.map((cat) => ({
        key: cat.slug,
        label: cat.title,
        icon: SLUG_ICONS[cat.slug] ?? (cat.icon as keyof typeof PRODUCE_ICONS) ?? "leaf",
        href: `/shop/${cat.slug}`,
      })),
    ],
    [categories],
  );

  const [active, setActive] = useState<string>("all");

  const shown = useMemo<ProductCardType[]>(
    () => (active === "all" ? bestsellers(products) : productsForSlug(products, active)),
    [active, products],
  );

  const activeTab = tabs.find((t) => t.key === active) ?? ALL_TAB;
  const viewAllLabel = active === "all" ? "View all products" : `View all ${activeTab.label}`;

  return (
    <Section
      className={cn("overflow-hidden", className)}
      eyebrow="Shop the harvest"
      heading={
        <>
          One step closer to your kitchen — <em className="italic text-ng-leaf">pick a category.</em>
        </>
      }
      description="Browse every harvest by category. Tap a tab to see its freshest picks, then add to your bag right here."
    >
      {/* ── Category tab selector ───────────────────────────────────────── */}
      <div className="relative -mx-5 px-5 md:mx-0 md:px-0">
        <div
          role="tablist"
          aria-label="Shop by category"
          className="flex gap-2.5 overflow-x-auto scrollbar-none pb-2 md:flex-wrap md:justify-center md:overflow-visible"
        >
          {tabs.map((tab) => {
            const Icon = PRODUCE_ICONS[tab.icon] ?? PRODUCE_ICONS.leaf;
            const isActive = tab.key === active;
            const color = CAT_COLORS[tab.key] ?? CAT_COLORS.all;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.key)}
                className={cn(
                  "group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium",
                  "transition-[background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-leaf/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
                  isActive
                    ? "border-ng-forest bg-ng-forest text-ng-cream shadow-[0_10px_28px_-12px_rgba(31,77,46,0.7)]"
                    : "border-ng-line bg-ng-paper text-ng-ink-soft hover:border-ng-leaf-soft hover:text-ng-forest",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-300",
                    isActive ? cn("bg-ng-cream", color.tint) : cn(color.ring, color.tint),
                  )}
                >
                  <Icon size={18} />
                </span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Products grid for the active tab ────────────────────────────── */}
      {/* Keyed on `active` so the Stagger remounts and fades the new set in.
          Stagger animates on mount → products are ALWAYS visible (no whileInView
          stuck-hidden state). */}
      <Stagger
        key={active}
        className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-5 [&>*:nth-child(5)]:hidden sm:[&>*:nth-child(5)]:block"
      >
        {shown.map((p) => (
          <StaggerItem key={p.id} className="h-full">
            <ProductCard product={p} className="h-full" />
          </StaggerItem>
        ))}
      </Stagger>

      {/* ── View-all link ───────────────────────────────────────────────── */}
      <div className="mt-9 flex justify-center">
        <Link
          href={activeTab.href}
          className="group inline-flex items-center gap-2 rounded-full border border-ng-line bg-ng-paper px-5 py-2.5 text-sm font-semibold text-ng-forest transition-colors hover:border-ng-leaf-soft hover:bg-ng-sage/30"
        >
          {viewAllLabel}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </Section>
  );
}
