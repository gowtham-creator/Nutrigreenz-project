"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Section } from "../section";
import { ProductCard } from "../product-card";
import { PRODUCE_ICONS, type ProduceIconName } from "../produce-icons";
import { Stagger, StaggerItem } from "../motion";
import { cn } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types/nutrigreenz";

/**
 * A selectable sub-category tab. The filter rule is expressed as a *serializable*
 * descriptor (not a function) so this prop can cross the Server → Client
 * Component boundary — React forbids passing raw functions into Client
 * Components. Matching is resolved on the client in {@link matchesTab}.
 *
 * - `all`         → every product (the default first tab).
 * - `titleHas`    → product title contains any keyword (case-insensitive).
 * - `tag`         → product has any of these tags.
 * - `bestseller`  → badge "Best seller" or rating ≥ minRating (default 4.7).
 */
export type FocusFilter =
  | { type: "all" }
  | { type: "titleHas"; keywords: string[] }
  | { type: "tag"; tags: string[] }
  | { type: "bestseller"; minRating?: number };

export interface FocusSubTab {
  label: string;
  icon?: ProduceIconName;
  filter: FocusFilter;
}

/** Resolve a serializable sub-tab filter against a product (client-side). */
function matchesTab(p: ProductCardType, filter: FocusFilter): boolean {
  switch (filter.type) {
    case "all":
      return true;
    case "titleHas": {
      const t = p.title.toLowerCase();
      return filter.keywords.some((k) => t.includes(k.toLowerCase()));
    }
    case "tag":
      return p.tags?.some((t) => filter.tags.includes(t)) ?? false;
    case "bestseller":
      return p.badge === "Best seller" || p.rating >= (filter.minRating ?? 4.7);
    default:
      return true;
  }
}

interface Props {
  /** Small overline above the heading, e.g. "Product in focus". */
  eyebrow?: string;
  /** Serif heading (font-display). */
  heading: React.ReactNode;
  description?: string;
  /** The full product pool this section can surface. */
  products: ProductCardType[];
  /** Sub-category icon tabs. First one is active on mount. */
  subTabs: FocusSubTab[];
  ctaHref?: string;
  ctaLabel?: string;
  /** Stable hook for tests / anchors. */
  sectionId?: string;
}

/**
 * ProductInFocus — Anveshan-style "Product in Focus" block:
 * eyebrow + serif heading, a row of sub-category ICON tabs, and a
 * horizontal-scrolling carousel of shared <ProductCard>s with full
 * add-to-bag / qty / wishlist wiring, plus a "See All →" pill.
 */
export function ProductInFocus({
  eyebrow = "Product in focus",
  heading,
  description,
  products,
  subTabs,
  ctaHref = "/shop",
  ctaLabel = "See All",
  sectionId,
}: Props) {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeTab = subTabs[active] ?? subTabs[0];

  const shown = useMemo<ProductCardType[]>(() => {
    if (!activeTab) return products;
    const matched = products.filter((p) => matchesTab(p, activeTab.filter));
    // Never render an empty carousel — fall back to the full pool only when a
    // sub-tab matches nothing at all. A single match is still worth showing.
    return matched.length >= 1 ? matched : products;
  }, [products, activeTab]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <Section id={sectionId} className="relative overflow-hidden" eyebrow={eyebrow} heading={heading} description={description}>
      {/* Soft botanical wash behind the rail */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 42% 55% at 90% 18%, rgba(184,212,154,0.20), transparent 60%), radial-gradient(ellipse 46% 52% at 6% 88%, rgba(200,166,104,0.12), transparent 60%)",
        }}
      />

      <div className="relative z-10">
        {/* ── Sub-category icon tabs + scroll controls ─────────────────── */}
        <div className="-mx-5 px-5 md:mx-0 md:px-0">
          <div className="flex items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Sub-categories"
              className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto scrollbar-none pb-1 md:flex-wrap md:overflow-visible"
            >
              {subTabs.map((tab, i) => {
                const Icon = tab.icon ? PRODUCE_ICONS[tab.icon] ?? PRODUCE_ICONS.leaf : null;
                const isActive = i === active;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(i)}
                    className={cn(
                      "group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                      "transition-[background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-leaf/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
                      isActive
                        ? "border-ng-forest bg-ng-forest text-ng-cream shadow-[0_10px_28px_-12px_rgba(31,77,46,0.7)]"
                        : "border-ng-line bg-ng-paper text-ng-ink-soft hover:border-ng-leaf-soft hover:text-ng-forest",
                    )}
                  >
                    {Icon ? (
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-300",
                          isActive
                            ? "bg-ng-cream/15 text-ng-cream"
                            : "bg-ng-sage/35 text-ng-leaf group-hover:bg-ng-sage/55",
                        )}
                      >
                        <Icon size={18} />
                      </span>
                    ) : null}
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop scroll arrows */}
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollBy(-1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-ng-line text-ng-ink transition-colors hover:bg-ng-sage/40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollBy(1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-ng-line text-ng-ink transition-colors hover:bg-ng-sage/40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Horizontal product carousel ──────────────────────────────── */}
        {/* Keyed on `active` so the Stagger remounts and fades the new set in
            on every sub-tab change → cards are ALWAYS visible (no stuck-hidden). */}
        <div
          ref={scrollRef}
          className="mt-8 -mx-5 overflow-x-auto scroll-px-5 px-5 pb-4 snap-x scrollbar-none md:mt-9 md:-mx-8 md:scroll-px-8 md:px-8"
          style={{ scrollbarWidth: "none" }}
        >
          <Stagger key={active} className="flex items-stretch gap-4 md:gap-5">
            {shown.map((p) => (
              <StaggerItem
                key={p.id}
                className="w-[260px] shrink-0 snap-start sm:w-[270px] md:w-[280px]"
              >
                <ProductCard product={p} className="h-full" />
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* ── See All pill (right-aligned) ─────────────────────────────── */}
        <div className="mt-7 flex justify-end">
          <Link
            href={ctaHref}
            className="group inline-flex items-center gap-2 rounded-full border border-ng-line bg-ng-paper px-5 py-2.5 text-sm font-semibold text-ng-forest transition-colors hover:border-ng-leaf-soft hover:bg-ng-sage/30"
          >
            {ctaLabel}
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </div>
    </Section>
  );
}
