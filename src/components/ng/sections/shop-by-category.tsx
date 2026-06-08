"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Section } from "../section";
import { ProductCard } from "../product-card";
import { PRODUCE_ICONS } from "../produce-icons";
import { Stagger, StaggerItem } from "../motion";
import { CATEGORIES } from "../data";
import { PRODUCTS } from "../data";
import { SLUG_TO_TAGS } from "../shop/types";
import { cn } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types/nutrigreenz";

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

const CATEGORY_TABS: TabDef[] = CATEGORIES.map((cat) => ({
  key: cat.slug,
  label: cat.title,
  icon: (cat.icon as keyof typeof PRODUCE_ICONS) ?? "leaf",
  href: `/shop/${cat.slug}`,
}));

const TABS: TabDef[] = [ALL_TAB, ...CATEGORY_TABS];

/** Bestsellers first (badge "Best seller"), then fill by rating. */
function bestsellers(): ProductCardType[] {
  const flagged = PRODUCTS.filter((p) => p.badge === "Best seller");
  const flaggedIds = new Set(flagged.map((p) => p.id));
  const rest = PRODUCTS.filter((p) => !flaggedIds.has(p.id)).sort(
    (a, b) => b.rating - a.rating || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
  );
  return [...flagged, ...rest].slice(0, MAX_TILES);
}

/** Products for a category slug, mapped via SLUG_TO_TAGS, capped to MAX_TILES. */
function productsForSlug(slug: string): ProductCardType[] {
  const tags = SLUG_TO_TAGS[slug] ?? [];
  return PRODUCTS.filter((p) => p.tags?.some((t) => tags.includes(t))).slice(0, MAX_TILES);
}

export function ShopByCategory() {
  const [active, setActive] = useState<string>("all");

  const products = useMemo<ProductCardType[]>(
    () => (active === "all" ? bestsellers() : productsForSlug(active)),
    [active],
  );

  const activeTab = TABS.find((t) => t.key === active) ?? ALL_TAB;
  const viewAllLabel = active === "all" ? "View all products" : `View all ${activeTab.label}`;

  return (
    <Section
      className="overflow-hidden"
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
          className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 md:flex-wrap md:justify-center md:overflow-visible"
        >
          {TABS.map((tab) => {
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
                    isActive ? "bg-ng-cream/15 text-ng-cream" : "bg-ng-sage/35 text-ng-leaf group-hover:bg-ng-sage/55",
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
        className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-5"
      >
        {products.map((p) => (
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
