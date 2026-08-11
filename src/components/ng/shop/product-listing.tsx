"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ng/product-card";
import { Button } from "@/components/ng/button";
import { Chip } from "@/components/ng/chip";
import { Icon } from "@/components/ui/icon";
import { PRODUCTS } from "@/components/ng/data";
import { cn } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types/nutrigreenz";
import { SearchBar } from "./search-bar";
import { SortMenu } from "./sort-menu";
import { FilterPanel } from "./filter-panel";
import {
  CATEGORY_TAGS,
  SLUG_TO_TAGS,
  type ShopFilters,
  type SortKey,
} from "./types";

const PAGE_SIZE = 8;

interface ProductListingProps {
  /** When set, the listing is locked to this category slug (category page). */
  categorySlug?: string;
  /**
   * The products to display. Defaults to the bundled sample data so existing
   * callers keep working; the live shop passes the mapped real catalog here.
   */
  products?: ProductCardType[];
  /**
   * Category facets for the chip-strip + filter panel. Defaults to the bundled
   * `CATEGORY_TAGS`; the live shop passes facets built from the real categories.
   */
  categoryTags?: { tag: string; label: string; image?: string | null; iconName?: string | null }[];
  /**
   * Maps a category slug → the product tags it contains. Defaults to the bundled
   * `SLUG_TO_TAGS`. For the live catalog each product is tagged with its own
   * category slug, so the identity mapping (slug → [slug]) applies.
   */
  slugToTags?: Record<string, string[]>;
}

function isInStock(p: ProductCardType): boolean {
  // Placeholder stock model: treat "Sold out" badge as out of stock; everything else in stock.
  return (p.badge ?? "").toLowerCase() !== "sold out";
}

export function ProductListing({
  categorySlug,
  products = PRODUCTS,
  categoryTags = CATEGORY_TAGS,
  slugToTags = SLUG_TO_TAGS,
}: ProductListingProps) {
  // The pool of products the page operates over (pre-filtered for category routes).
  const pool = useMemo<ProductCardType[]>(() => {
    if (!categorySlug) return products;
    /*
     * Match the slug ITSELF as well as its mapped tags.
     *
     * SLUG_TO_TAGS was written for the bundled demo data, which tags products
     * in the singular — `oils` → `["oil"]`. The live catalog stamps each product
     * with its own category SLUG instead, so a real oil carries `"oils"`, the
     * lookup returned only `["oil"]`, and /shop/oils filtered every product out:
     * the page rendered "0 products in this view" over a catalogue of six.
     *
     * It only showed on the plural categories. Honey, ghee and gifting spell
     * the same either way, so they worked and hid the fault.
     */
    const lockedTags = [categorySlug, ...(slugToTags[categorySlug] ?? [])];
    return products.filter((p) => p.tags?.some((t) => lockedTags.includes(t)));
  }, [categorySlug, products, slugToTags]);

  const bounds = useMemo(() => {
    if (pool.length === 0) return { min: 0, max: 5000 };
    const prices = pool.map((p) => p.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [pool]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of pool) for (const t of p.tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
    return counts;
  }, [pool]);

  const initialFilters: ShopFilters = {
    tags: [],
    priceMin: bounds.min,
    priceMax: bounds.max,
    minRating: 0,
    inStockOnly: false,
  };

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");
  const [filters, setFilters] = useState<ShopFilters>(initialFilters);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const resetFilters = () => {
    setFilters({ ...initialFilters, priceMin: bounds.min, priceMax: bounds.max });
    setSearch("");
    setVisible(PAGE_SIZE);
  };

  // Active chip = the single selected category tag (only meaningful on /shop).
  const activeChip = filters.tags.length === 1 ? filters.tags[0] : null;
  const selectChip = (tag: string | null) => {
    setFilters((f) => ({ ...f, tags: tag ? [tag] : [] }));
    setVisible(PAGE_SIZE);
  };

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = pool.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (filters.tags.length && !p.tags?.some((t) => filters.tags.includes(t))) return false;
      if (p.price < filters.priceMin || p.price > filters.priceMax) return false;
      if (filters.minRating && p.rating < filters.minRating) return false;
      if (filters.inStockOnly && !isInStock(p)) return false;
      return true;
    });

    list = [...list];
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
        break;
      case "newest":
        // Newest = reverse catalog order (no date field in the sample data).
        list.reverse();
        break;
      default:
        break; // featured = catalog order
    }
    return list;
  }, [pool, search, filters, sort]);

  const shown = results.slice(0, visible);
  const hasMore = visible < results.length;

  const filterPanel = (
    <FilterPanel
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        setVisible(PAGE_SIZE);
      }}
      bounds={bounds}
      tagCounts={tagCounts}
      categoryTags={categoryTags}
      totalCount={pool.length}
      hideCategories={Boolean(categorySlug)}
      onReset={resetFilters}
    />
  );

  const hasActiveFilters =
    filters.tags.length > 0 ||
    filters.minRating > 0 ||
    filters.inStockOnly ||
    Boolean(search) ||
    filters.priceMin > bounds.min ||
    filters.priceMax < bounds.max;

  const progressPct = results.length > 0 ? Math.min(100, Math.round((shown.length / results.length) * 100)) : 0;

  return (
    <div className="relative">
      {/* Soft static background blobs behind the listing (depth without scroll-jank) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full bg-ng-leaf/10 blur-3xl" />
        <div className="absolute -left-40 top-[60rem] h-[24rem] w-[24rem] rounded-full bg-ng-clay/[0.07] blur-3xl" />
      </div>

      {/* Sticky category chip strip — only on the all-products view */}
      {!categorySlug ? (
        <div className="z-30 -mt-px glass-strong border-y border-ng-line-soft md:sticky md:top-[68px]">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-5 py-3 md:px-8 scrollbar-hide">
            <span className="hidden shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted md:inline">
              Browse
            </span>
            <Chip active={activeChip === null} onClick={() => selectChip(null)}>
              All
            </Chip>
            {categoryTags.map(({ tag, label, image, iconName }) =>
              (tagCounts[tag] ?? 0) > 0 ? (
                <Chip
                  key={tag}
                  active={activeChip === tag}
                  onClick={() => selectChip(tag)}
                  icon={
                    image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="size-4 rounded-full object-cover" />
                    ) : iconName ? (
                      <Icon name={iconName} size={15} />
                    ) : undefined
                  }
                >
                  {label}
                </Chip>
              ) : null,
            )}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[286px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[120px] rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)]">
              {filterPanel}
            </div>
          </aside>

          {/* Main column */}
          <div>
            {/* Sticky toolbar: search + result count + sort + filter trigger */}
            <div
              className={cn(
                "sticky z-20 mb-6 rounded-2xl border border-ng-line-soft bg-ng-paper/85 p-3 shadow-[var(--shadow-ng-card)] backdrop-blur-md",
                // Below lg the chip strip is only present on the all-products view;
                // clear it (68px header + ~56px strip) so the toolbar never slides
                // under it. On a category page there is no strip, so pin to header.
                categorySlug ? "top-[68px]" : "top-[124px]",
                "lg:top-[120px]",
              )}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <SearchBar value={search} onChange={(v) => { setSearch(v); setVisible(PAGE_SIZE); }} className="md:flex-1" />
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    className="lg:hidden"
                    onClick={() => setDrawerOpen(true)}
                  >
                    <Icon name="filter-linear" size={16} />
                    Filters
                  </Button>
                  <SortMenu value={sort} onChange={(v) => { setSort(v); setVisible(PAGE_SIZE); }} />
                </div>
              </div>
            </div>

            {/* Active filter summary + live results count */}
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-[13px] text-ng-ink-muted">
                <span className="font-mono font-semibold tabular-nums text-ng-forest-deep">{results.length}</span>{" "}
                {results.length === 1 ? "product" : "products"}
                {hasActiveFilters ? " match your filters" : " in this view"}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-full bg-ng-leaf/10 px-2.5 py-1 text-[12px] font-medium text-ng-forest transition-colors hover:bg-ng-leaf/20"
                >
                  <Icon name="restart-linear" size={13} />
                  Clear all
                </button>
              ) : null}
            </div>

            {/* Grid */}
            {shown.length > 0 ? (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
                {shown.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl border border-dashed border-ng-line bg-ng-cream/50 px-6 py-20 text-center">
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 bg-ng-cream-mesh" />
                <div className="relative">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-ng-paper text-ng-forest shadow-[var(--shadow-ng-card)]">
                    <Icon name="magnifer-bug-linear" size={30} className="text-ng-clay" />
                  </span>
                  <p className="mt-5 font-display text-[22px] text-ng-forest-deep">Nothing on this shelf yet</p>
                  <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ng-ink-muted">
                    No products match your current filters. Try widening the price range, easing the rating filter, or clearing the search.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Button variant="secondary" size="md" onClick={resetFilters}>
                      <Icon name="restart-linear" size={15} />
                      Clear filters
                    </Button>
                    {!categorySlug ? null : (
                      <a
                        href="/shop"
                        className="inline-flex items-center gap-1.5 rounded-full border border-ng-line px-4 py-2.5 text-[13px] font-medium text-ng-forest transition-colors hover:border-ng-leaf"
                      >
                        Browse the full pantry
                        <Icon name="alt-arrow-right-linear" size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Load more — with progress feel */}
            {shown.length > 0 ? (
              <div className="mt-12 flex flex-col items-center gap-4">
                <div className="h-1 w-44 overflow-hidden rounded-full bg-ng-line-soft">
                  <div
                    className="h-full rounded-full bg-ng-leaf transition-[width] duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="font-mono text-[12px] tabular-nums text-ng-ink-muted">
                  Showing {shown.length} of {results.length}
                </p>
                {hasMore ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  >
                    Load more
                    <Icon name="alt-arrow-down-linear" size={16} />
                  </Button>
                ) : (
                  <p className="flex items-center gap-1.5 text-[13px] text-ng-ink-muted">
                    <Icon name="check-circle-bold" size={15} className="text-ng-leaf" />
                    You&apos;ve reached the end of the harvest
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div
            className="absolute inset-0 bg-ng-forest-deep/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-ng-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-ng-line-soft px-5 py-4">
              <span className="font-display text-[18px] text-ng-forest-deep">Filters</span>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setDrawerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-ng-sage text-ng-forest"
              >
                <Icon name="close-circle-linear" size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">{filterPanel}</div>
            <div className="border-t border-ng-line-soft p-4">
              <Button fullWidth onClick={() => setDrawerOpen(false)}>
                Show {results.length} products
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
