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

/* The house mark, not the generic leaf — see `BrandMarkIcon`. Every other tab
   shows what it filters to; the one that means "everything" shows whose
   everything it is. */
/*
 * "All" gets a drawing, not the logotype.
 *
 * `brandMark` is the Nutri Greenz N — a wordmark sitting in a row of pictures
 * of food. It reads as branding that has wandered into the control rather than
 * as a category, and it is the one tab whose icon told you nothing about what
 * pressing it does. A gift basket is the whole harvest in one mark.
 */
const ALL_TAB: TabDef = { key: "all", label: "All", icon: "gift", href: "/shop" };

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

/*
 * A per-category tint table used to live here — clay for oils, terracotta for
 * spices, soil for pulses — to keep the row "colourful and varied". It is gone
 * with the discs it coloured. Twelve accents across one row of tabs meant the
 * strongest signal in the control was hue, and hue was the one thing not
 * carrying meaning: nothing about a category is amber rather than terracotta,
 * and the genuinely meaningful state, which tab is selected, had to compete
 * with all of it. Selection is now the only thing the row colours.
 */

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
      /*
       * Centred, because the tabs beneath are centred.
       *
       * The heading sat left while the row sat centre, which left a wide
       * diagonal of empty space between the two and made the tabs read as
       * floating rather than as the thing the heading is introducing. They are
       * one unit: a title and the control it labels.
       */
      align="center"
      eyebrow="Shop the harvest"
      heading={
        <>
          One step closer to your kitchen. <em className="italic text-ng-leaf">pick a category.</em>
        </>
      }
      description="Browse every harvest by category. Tap a tab to see its freshest picks, then add to your bag right here."
    >
      {/* ── Category tab selector ─────────────────────────────────────────
          Pulled up against the heading. `Section` puts 64px under its header,
          which is right when the children are content but too much here: these
          tabs ARE part of the header, and at that distance they read as a
          separate row that happens to sit below rather than as the control the
          sentence above just asked the shopper to use. Local, so no other
          section's rhythm changes. */}
      <div className="relative -mx-5 -mt-5 px-5 md:mx-0 md:-mt-9 md:px-0">
        <div
          role="tablist"
          aria-label="Shop by category"
          className="flex gap-2.5 overflow-x-auto scrollbar-none pb-2 md:flex-wrap md:justify-center md:overflow-visible"
        >
          {tabs.map((tab) => {
            const Icon = PRODUCE_ICONS[tab.icon] ?? PRODUCE_ICONS.leaf;
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.key)}
                className={cn(
                  "group inline-flex shrink-0 flex-col items-center gap-2 rounded-xl px-4 pb-2 pt-2.5 text-[14px] font-medium",
                  "transition-[background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-leaf/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
                  // Hover paints the whole target, mark and label together, so
                  // the tab reads as one thing you can press rather than a
                  // label that happens to sit under a picture.
                  "hover:bg-ng-ink/[0.05]",
                  isActive
                    ? "font-semibold text-ng-forest-deep"
                    : "text-ng-ink hover:text-ng-forest-deep",
                )}
              >
                {/*
                  Same treatment as the product-in-focus tabs: the mark drawn
                  bare at 40px in ink, with a rule under the active label. The
                  pill-and-tinted-disc version put a 18px glyph inside a coloured
                  circle inside a bordered capsule — three nested shapes around a
                  drawing too small to be recognised, and each category tinted a
                  different colour on top. One row, one weight, one colour.
                */}
                {/*
                  Every mark the same near-black, active or not. `ink-muted` is
                  #5C6A60 — a grey with a green cast — so dimming the inactive
                  ones tinted them sage against cream, which is the "green"
                  being complained about. Selection is carried by the rule and
                  the label weight, which is enough; a row that also restates it
                  by fading six of seven drawings just makes six drawings harder
                  to see.
                */}
                <Icon size={40} className="text-ng-forest-deep" />
                <span className="whitespace-nowrap">{tab.label}</span>
                {/* Always rendered, so selecting a tab never shifts the row. */}
                <span
                  aria-hidden
                  className={cn(
                    "h-[3px] w-full rounded-full transition-colors duration-300",
                    // A faint rule previews the active state on hover, so the
                    // pointer shows what selecting would do.
                    isActive ? "bg-ng-forest-deep" : "bg-transparent group-hover:bg-ng-forest-deep/20",
                  )}
                />
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
