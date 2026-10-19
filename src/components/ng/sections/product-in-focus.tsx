"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Section } from "../section";
import { ProductCard } from "../product-card";
import { PRODUCE_ICONS, type ProduceIconName } from "../produce-icons";
import { Stagger, StaggerItem, Reveal } from "../motion";
import { cn } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types/nutrigreenz";

/** A single pack/variety thumbnail surfaced in the header "range" cluster. */
interface RangeMedia {
  src: string;
  alt: string;
  /** Short, factual pack-size / variety label (e.g. "1L · 500ml · 250ml"). */
  tag: string;
}

/**
 * Per-family "range" imagery for the header fill — reuses existing product art
 * so the large empty space to the right of the heading surfaces more of the
 * product (pack sizes + variety) instead of sitting as dead space. Index 1 is
 * the front/centre hero of the fanned trio.
 */
const ACCENT_RANGE: Record<NonNullable<Props["accent"]>, RangeMedia[]> = {
  amber: [
    { src: "/images/products/oils/groundnut.webp", alt: "Cold-pressed groundnut oil", tag: "Single-origin" },
    { src: "/images/products/oils/oils-tile-sizes.webp", alt: "Glass bottle sizes for our oils", tag: "1L · 500ml · 250ml" },
    { src: "/images/products/oils/oils-tile-range.webp", alt: "The full cold-pressed oil range", tag: "The range" },
  ],
  gold: [
    { src: "/images/products/ghee/ghee-curd.webp", alt: "Cultured curd for bilona ghee", tag: "Hand-churned" },
    { src: "/images/products/ghee/ghee-jar-bowl.webp", alt: "A2 ghee jar with a filled bowl", tag: "250ml · 500ml · 1L" },
    { src: "/images/products/ghee/tile-farm.webp", alt: "Ghee from named desi cows", tag: "Bilona method" },
  ],
  honey: [
    { src: "/images/products/honey/tile-raw.webp", alt: "Raw, unheated honey", tag: "Raw · unheated" },
    { src: "/images/products/honey/honey-jar-dipper.webp", alt: "Raw honey jar with a dipper", tag: "350g · 500g" },
    { src: "/images/products/honey/tile-forests.webp", alt: "Forest-sourced honey", tag: "Forest-sourced" },
  ],
  forest: [
    { src: "/images/products/oils/oils-tile-range.webp", alt: "Cold-pressed oil range", tag: "Oils" },
    { src: "/images/products/ghee/ghee-jar-bowl.webp", alt: "A2 ghee jar with a filled bowl", tag: "Ghee" },
    { src: "/images/products/honey/honey-jar-dipper.webp", alt: "Raw honey jar with a dipper", tag: "Honey" },
  ],
};

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
  /** Per-family colour wash behind the rail: oils→amber, ghee→gold, honey→honey, gifting→forest. */
  accent?: "amber" | "gold" | "honey" | "forest";
}

/**
 * ProductInFocus — "Product in Focus" block:
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
  ctaLabel = "See all",
  sectionId,
  accent,
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

  /* The per-family disc tint that used to sit behind each sub-category icon is
     gone with the discs themselves — the marks are drawn bare at 40px now. */

  const ACCENT_WASH: Record<NonNullable<Props["accent"]>, string> = {
    amber:
      "radial-gradient(ellipse 42% 55% at 90% 18%, rgba(242,158,18,0.10), transparent 60%), radial-gradient(ellipse 46% 52% at 6% 88%, rgba(181,134,47,0.08), transparent 62%)",
    gold:
      "radial-gradient(ellipse 42% 55% at 90% 18%, rgba(181,134,47,0.12), transparent 60%), radial-gradient(ellipse 46% 52% at 6% 88%, rgba(138,100,32,0.07), transparent 62%)",
    honey:
      "radial-gradient(ellipse 42% 55% at 90% 18%, rgba(242,158,18,0.10), transparent 60%), radial-gradient(ellipse 46% 52% at 6% 88%, rgba(102,191,115,0.10), transparent 62%)",
    forest:
      "radial-gradient(ellipse 42% 55% at 90% 18%, rgba(102,191,115,0.11), transparent 60%), radial-gradient(ellipse 46% 52% at 6% 88%, rgba(31,77,46,0.06), transparent 62%)",
  };

  // Per-family "range" thumbnails that fill the header's empty right side on
  // desktop (reuses existing product art — no dead space).
  const rangeMedia = accent ? ACCENT_RANGE[accent] : null;

  return (
    <Section id={sectionId} className="relative overflow-hidden">
      {/* Soft botanical wash behind the rail (per-family hue when `accent` is set) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 opacity-60"
        style={{
          background: accent
            ? ACCENT_WASH[accent]
            : "radial-gradient(ellipse 42% 55% at 90% 18%, rgba(184,212,154,0.20), transparent 60%), radial-gradient(ellipse 46% 52% at 6% 88%, rgba(200,166,104,0.12), transparent 60%)",
        }}
      />

      <div className="relative z-10">
        {/* ── Header: eyebrow + heading + description, with a per-family
            "range" media cluster filling the space to the right on desktop so
            the block never reads as empty. ─────────────────────────────── */}
        <div className="mb-10 grid gap-8 md:mb-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
          <Reveal as="header" className="flex max-w-2xl flex-col gap-4">
            {eyebrow ? <span className="ng-eyebrow">{eyebrow}</span> : null}
            <h2 className="font-display text-[clamp(28px,4.6vw,52px)] leading-[1.05] tracking-tight text-ng-forest-deep">
              {heading}
            </h2>
            {description ? (
              <p className="text-[17px] leading-relaxed text-pretty text-ng-ink-muted">
                {description}
              </p>
            ) : null}
          </Reveal>

          {rangeMedia ? (
            /* Pulled in from the right edge (lg:mr-*) so the fanned trio sits
               nearer the copy instead of hugging the section boundary. */
            <Reveal delay={0.1} className="relative hidden shrink-0 lg:block lg:mr-6 xl:mr-20 2xl:mr-40">
              {/* Accent-tinted halo behind the fanned trio */}
              <div
                className="pointer-events-none absolute -inset-x-6 -inset-y-4 rounded-[2rem]"
                style={{ background: accent ? ACCENT_WASH[accent] : undefined }}
              />
              <div className="relative flex items-end justify-center">
                {rangeMedia.map((m, i) => (
                  <figure
                    key={m.src}
                    className={cn(
                      "relative overflow-hidden rounded-2xl bg-ng-cream ring-1 ring-black/[0.06] shadow-[0_18px_40px_-20px_rgba(20,51,31,0.5)]",
                      i === 1
                        ? "z-20 h-48 w-36"
                        : "z-10 h-40 w-28",
                      i === 0 && "-mr-5 origin-bottom-right rotate-[-5deg]",
                      i === 2 && "-ml-5 origin-bottom-left rotate-[5deg]",
                    )}
                  >
                    <Image
                      src={m.src}
                      alt={m.alt}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                    <figcaption className="absolute inset-x-1.5 bottom-1.5">
                      <span className="block truncate rounded-full bg-ng-forest-deep/82 px-2 py-1 text-center text-[9px] font-semibold tracking-tight text-ng-cream backdrop-blur-sm">
                        {m.tag}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Reveal>
          ) : null}
        </div>

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
                      "group inline-flex shrink-0 flex-col items-center gap-2 rounded-xl px-3.5 pb-2 pt-2.5 text-[14px] font-medium",
                      "transition-[background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-leaf/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
                      // See the note in shop-by-category: hover paints the whole
                      // target so mark and label read as one pressable thing.
                      "hover:bg-ng-ink/[0.05]",
                      isActive
                        ? "font-semibold text-ng-forest-deep"
                        : "text-ng-ink hover:text-ng-forest-deep",
                    )}
                  >
                    {Icon ? (
                      /*
                       * Drawn at 40px and bare — no disc, no chip, no fill. The
                       * produce marks are the one genuinely distinctive thing in
                       * this row: a honey jar with comb, a pressed-oil bottle, a
                       * groundnut still in its shell. At 18px inside a tinted
                       * circle none of that survived, and seven categories read
                       * as seven identical pills with seven smudges on them.
                       *
                       * Inactive tabs are dimmed rather than greyed, so the set
                       * still scans as one family and the active one is picked
                       * out by the rule beneath it.
                       */
                      /*
                       * Every mark the same near-black, active or not. Drawn in
                       * `forest-soft` at 55% these washed out to a pale sage
                       * over cream, and the muted ink token that replaced it
                       * (#5C6A60) still carries a green cast — so the row read
                       * as seven faded green stickers either way. Selection is
                       * carried by the rule and the label weight; restating it
                       * by fading six of seven drawings only makes six drawings
                       * harder to see.
                       */
                      <Icon size={40} className="text-ng-forest-deep" />
                    ) : null}
                    <span className="whitespace-nowrap">{tab.label}</span>
                    {/* The active rule. Always present so selecting a tab does not
                        shift the row's height by a pixel. */}
                    <span
                      aria-hidden
                      className={cn(
                        "h-[3px] w-full rounded-full transition-colors duration-300",
                        isActive ? "bg-ng-forest" : "bg-transparent group-hover:bg-ng-forest/20",
                      )}
                    />
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
                className="grid h-11 w-11 lg:h-10 lg:w-10 place-items-center rounded-full border border-ng-line text-ng-ink transition-colors hover:bg-ng-sage/40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollBy(1)}
                className="grid h-11 w-11 lg:h-10 lg:w-10 place-items-center rounded-full border border-ng-line text-ng-ink transition-colors hover:bg-ng-sage/40"
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
        <div className="mt-7 flex justify-center md:justify-end">
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
