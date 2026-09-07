"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ng/badge";
import type { Tone } from "@/types/nutrigreenz";
import { PhotoPlaceholder, isPlaceholderSrc } from "./photo-placeholder";
import type { ProduceIconName } from "@/components/ng/produce-icons";
import type { CategoryTheme } from "@/lib/category-theme";
import { usePdpVariant } from "./variant-context";
import { useDragSwipe } from "@/components/ng/use-drag-swipe";
import { NUTRITION_LABEL } from "./product-gallery";

interface GalleryImage {
  src: string;
  alt: string;
  /** Short caption shown on the branded placeholder (e.g. "Front of pack"). */
  label?: string;
}

interface GalleryProps {
  images: GalleryImage[];
  badge?: string;
  badgeTone?: Tone;
  discount?: number;
  /**
   * The label an admin set on a promotion ("Diwali Sale", "Festive 20% OFF"),
   * for the specific SKU or its whole category.
   *
   * The PDP previously ignored this entirely and showed only a percentage it
   * derived from the price gap — so a campaign named in the admin appeared on
   * the shop grid and then vanished on the page where the customer decides.
   */
  promoLabel?: string;
  promoPercent?: number;
  /** Category glyph used by the photo placeholders until real photos exist. */
  produceIcon?: ProduceIconName;
  /** Per-category theme — tints the stage glow + empty placeholders. */
  theme?: CategoryTheme;
  /**
   * Nutrition panels keyed by lower-cased pack size ("1l", "500ml").
   *
   * The size selector changes variant IN PLACE without navigating, so a
   * nutrition panel fixed to the page's slug would keep claiming "65 servings
   * per container" after the shopper switched to the 500 ml. Wrong nutrition
   * information on a food product, so the panel follows the selection instead.
   */
  nutritionBySize?: Record<string, string>;
}

const PLACEHOLDER = "/images/placeholder.svg";

/**
 * A generated infographic panel rather than a product photograph.
 *
 * These are square, full-bleed, and carry dense type — a nutrition table, a
 * comparison chart. They need to fill the frame and to be openable full-screen;
 * a bottle shot needs neither.
 */
const isPanel = (src: string) => src.includes("/gallery/");

/**
 * Interactive product gallery — main viewer + clickable thumbnail rail, with
 * smooth finger-swipe on touch devices (drag to slide, snap on release; dots +
 * arrow-key navigation for a11y; honours `prefers-reduced-motion`).
 *
 * When the shopper picks a size/SKU whose variant carries its own image, that
 * image leads the gallery and the stage snaps to it — so changing the variant
 * updates the visible photo. Variants without an image fall back to the
 * product's own image(s). Until real photography exists, each empty slot renders
 * an attractive, category-aware <PhotoPlaceholder> instead of a flat logo.
 */
export function Gallery({ images, badge, badgeTone, discount, promoLabel, promoPercent, produceIcon = "leaf", theme, nutritionBySize }: GalleryProps) {
  const reduce = useReducedMotion();
  const shared = usePdpVariant();
  const selected = shared?.selected;
  const selectedId = selected?.id;

  const baseImages = images.length > 0 ? images : [{ src: PLACEHOLDER, alt: "Product image" }];

  // A per-variant image (when set + real) leads the gallery, tagged with the
  // variant's size so it's obvious which SKU it belongs to.
  const variantSrc =
    selected?.imageUrl && !isPlaceholderSrc(selected.imageUrl) ? selected.imageUrl : null;
  const baseAlt = baseImages[0]?.alt ?? "Product image";

  const displayImages = useMemo<GalleryImage[]>(() => {
    /*
     * Re-point the nutrition panel at the SELECTED size.
     *
     * Servings-per-container is the one figure that changes with the bottle, so
     * a stale panel would state a wrong number for the size in the cart. When
     * the chosen size has no panel yet, the slide is dropped rather than left
     * showing another size's figures.
     */
    let list = baseImages;
    if (nutritionBySize) {
      const key = (selected?.size ?? "").toLowerCase().replace(/\s+/g, "");
      const forSize = key ? nutritionBySize[key] : undefined;
      list = baseImages.flatMap((img) => {
        if (img.label !== NUTRITION_LABEL) return [img];
        if (!key) return [img];
        return forSize ? [{ ...img, src: forSize }] : [];
      });
    }

    if (!variantSrc) return list;
    return [{ src: variantSrc, alt: `${baseAlt} · ${selected?.size ?? "selected size"}`, label: selected?.size }, ...list];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, variantSrc, selected?.size, nutritionBySize]);

  const count = displayImages.length;
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  /*
   * Paused as soon as the shopper touches the gallery.
   *
   * A carousel that keeps moving under someone who has just chosen a slide is
   * actively hostile — they lose the panel they were reading. Any click, key or
   * swipe stops it for good; it exists to show that more images exist, not to
   * drive the experience.
   */
  const [autoPlay, setAutoPlay] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  // createPortal needs document; guard for the server render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const clampedActive = Math.min(active, count - 1);

  // Advance every 3.5s until the shopper interacts.
  useEffect(() => {
    if (!autoPlay || count <= 1) return;
    const t = setInterval(() => setActive((i) => (i + 1) % count), 3500);
    return () => clearInterval(t);
  }, [autoPlay, count]);

  // Follow the active slide so the rail never shows a selection off-screen.
  useEffect(() => {
    const rail = railRef.current;
    const thumb = rail?.children[clampedActive] as HTMLElement | undefined;
    if (!rail || !thumb) return;
    const left = thumb.offsetLeft - rail.clientWidth / 2 + thumb.clientWidth / 2;
    rail.scrollTo({ left, behavior: "smooth" });
  }, [clampedActive]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
      if (e.key === "ArrowRight") go(clampedActive + 1);
      if (e.key === "ArrowLeft") go(clampedActive - 1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomed, count]);

  // Snap back to the lead image whenever the shopper changes size/SKU, so the
  // (possibly variant-specific) hero shot is what they see for the new pick.
  useEffect(() => {
    setActive(0);
  }, [selectedId, variantSrc]);

  const activeIsPanel = isPanel(displayImages[clampedActive]?.src ?? "");

  /*
   * Every deliberate move — thumbnail click, arrow, swipe — comes through here,
   * so it is the one place autoplay needs to stop. Rotating on under someone
   * who has just opened the nutrition panel would take it away mid-read.
   */
  const go = (i: number) => {
    setAutoPlay(false);
    setActive(Math.min(Math.max(0, i), count - 1));
  };

  const { offset, dragging, handlers } = useDragSwipe({
    enabled: count > 1,
    onSwipeLeft: () => go(clampedActive + 1),
    onSwipeRight: () => go(clampedActive - 1),
  });

  // Rubber-band the live drag at the ends so the track never tears past an edge.
  const atStart = clampedActive === 0;
  const atEnd = clampedActive === count - 1;
  const dragX = (atStart && offset > 0) || (atEnd && offset < 0) ? offset / 3 : offset;

  const stageRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(clampedActive + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(clampedActive - 1);
    }
  };

  const zoomImage = displayImages[clampedActive];

  return (
    <div className="flex flex-col-reverse gap-4">
      {/*
        Full-screen viewer. Rendered at the panel's own scale so the nutrition
        table and the comparison chart are finally readable at the size they
        were designed for.
      */}
      {/*
        Portalled to <body>. Left in place it sat inside the page's stacking
        context and the sticky site header painted straight over it, despite a
        higher z-index — the header wins from an ancestor context, which no
        z-index on this element can beat.
      */}
      {mounted && zoomed && zoomImage && !isPlaceholderSrc(zoomImage.src)
        ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-ng-forest-deep/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={zoomImage.alt}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4">
            <span className="text-[13px] font-medium text-ng-cream/85">
              {zoomImage.label ?? zoomImage.alt} · {clampedActive + 1} of {count}
            </span>
            <button
              type="button"
              onClick={() => setZoomed(false)}
              aria-label="Close"
              className="grid size-10 cursor-pointer place-items-center rounded-full bg-ng-cream/15 text-ng-cream transition-colors hover:bg-ng-cream/25"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable so a tall panel can be read on a phone. */}
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomImage.src}
              alt={zoomImage.alt}
              className="mx-auto h-auto w-full max-w-[1100px] rounded-2xl"
            />
          </div>

          {count > 1 ? (
            <div className="flex shrink-0 items-center justify-center gap-3 px-5 py-4">
              <button
                type="button"
                onClick={() => go(clampedActive - 1)}
                disabled={clampedActive === 0}
                className="cursor-pointer rounded-full bg-ng-cream/15 px-4 py-2 text-[13px] font-semibold text-ng-cream transition-colors hover:bg-ng-cream/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => go(clampedActive + 1)}
                disabled={clampedActive === count - 1}
                className="cursor-pointer rounded-full bg-ng-cream/15 px-4 py-2 text-[13px] font-semibold text-ng-cream transition-colors hover:bg-ng-cream/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>,
            document.body,
          )
        : null}

      {/* Thumbnails */}
      {/*
        Horizontal rail beneath the viewer.

        It used to stack vertically on desktop, so a gallery of nine panels ran
        far past the product image and left a column of dead space beside it.
        Laid along the bottom the strip stays the height of one thumbnail
        however many images there are, shows about four at a time, and scrolls
        for the rest.
      */}
      <div
        ref={railRef}
        className="flex flex-row gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {displayImages.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={() => go(i)}
            aria-label={`View image ${i + 1}`}
            aria-pressed={i === clampedActive}
            className={cn(
              "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-ng-cream-deep transition-colors",
              i === clampedActive ? "border-ng-forest ring-1 ring-ng-forest" : "border-ng-line hover:border-ng-leaf",
            )}
          >
            {isPlaceholderSrc(img.src) ? (
              <PhotoPlaceholder icon={produceIcon} variant="thumb" theme={theme} />
            ) : (
              <Image src={img.src} alt={img.alt} fill className="object-contain p-1.5" sizes="80px" />
            )}
          </button>
        ))}
      </div>

      {/* Main image — premium stage with soft 3D framing + swipeable track */}
      <div className="persp-1000 relative flex-1">
        <div
          ref={stageRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="Product images · swipe or use arrow keys"
          tabIndex={0}
          onKeyDown={onKeyDown}
          {...handlers}
          className="group relative aspect-square touch-pan-y select-none overflow-hidden rounded-[28px] border border-ng-line-soft bg-gradient-to-br from-ng-cream via-ng-cream to-ng-cream-deep shadow-[var(--shadow-ng-card)] outline-none focus-visible:ring-2 focus-visible:ring-ng-forest"
        >
          {/* Ambient glow + halo behind product (static, behind the track) */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className={cn("absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl", !theme && "bg-ng-leaf/10")}
              style={theme ? { background: theme.halo } : undefined}
            />
            <div className="absolute inset-x-8 bottom-6 h-6 rounded-[50%] bg-ng-forest-deep/10 blur-2xl" />
          </div>

          {/* The sliding track: one full-width slide per image. */}
          <div
            className={cn(
              "flex h-full w-full",
              dragging || reduce ? "" : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            )}
            style={{ transform: `translate3d(calc(${-clampedActive * 100}% + ${dragX}px), 0, 0)` }}
          >
            {displayImages.map((img, i) => (
              <div
                key={`${img.src}-${i}`}
                className="relative h-full w-full shrink-0 grow-0 basis-full"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                aria-hidden={i !== clampedActive}
              >
                {isPlaceholderSrc(img.src) ? (
                  <PhotoPlaceholder icon={produceIcon} variant="main" label={img.label ?? img.alt} theme={theme} />
                ) : (
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    priority={i === 0}
                    draggable={false}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className={cn(
                      /*
                       * Generated panels are square, full-bleed artwork that
                       * already carries its own background and margins. Padding
                       * them inside the frame shrank type that is small to begin
                       * with; they fill the stage instead. Product photography
                       * keeps the inset so a bottle never touches the edge.
                       */
                      isPanel(img.src) ? "object-cover" : "object-contain p-4",
                      reduce
                        ? ""
                        : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]",
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/*
            Store chrome is hidden over a generated panel.

            The badge and the provenance tag are positioned for a product photo,
            which has empty corners. A panel does not — "BEST SELLER" landed
            directly on top of the comparison panel's own "Cold-Pressed" pill,
            each making the other unreadable.
          */}
          {!activeIsPanel ? (
            <>
              <div className="pointer-events-none absolute left-5 top-5 z-10 flex flex-col gap-2">
                {badge ? <Badge tone={badgeTone ?? "leaf"}>{badge}</Badge> : null}
                {/* The admin's own promo wording wins over a derived
                    percentage. If someone named the campaign "Harvest Festival"
                    they meant that to be what a customer reads; falling back to
                    "20% OFF" throws away the only part they wrote.
                    `size="md"` because this badge sits over photography at the
                    top of the page and is the one mark a discounted product
                    most needs seen. */}
                {!badge && (promoLabel || (promoPercent ?? 0) > 0) ? (
                  <Badge tone="terracotta" size="md">
                    {promoLabel || `${promoPercent}% OFF`}
                  </Badge>
                ) : null}
                {/* Only when there is no promotion — otherwise the same saving
                    is announced twice in the same corner. */}
                {!badge && !promoLabel && !(promoPercent ?? 0) && discount && discount > 0 ? (
                  <Badge tone="terracotta" size="md">{discount}% OFF</Badge>
                ) : null}
              </div>

              <div className="pointer-events-none absolute bottom-5 right-5 z-10 inline-flex items-center gap-1.5 rounded-full bg-ng-paper/80 px-3 py-1.5 text-[11px] font-medium text-ng-forest backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-ng-leaf" />
                Single-origin
              </div>
            </>
          ) : null}

          {/*
            Open full-screen.

            These panels carry a nutrition table and a comparison chart at a size
            chosen for a 1200px canvas; the PDP stage is ~440px, so at rest the
            body copy lands near 9px. Enlarging is not a nicety here — it is the
            only way to actually read them.
          */}
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="View larger"
            /* Top-RIGHT, not top-left. The badges — "Best seller", "50% OFF" —
               are pinned left-5 top-5 at z-10, and this button sat at left-4
               top-4 at z-20: same corner, higher layer, so it covered the very
               badge a discounted product most needs to show. Opposite corner
               removes the collision rather than juggling z-index, which would
               only have put the badge over a control people are meant to press. */
            className="absolute right-4 top-4 z-20 grid size-10 cursor-pointer place-items-center rounded-full bg-ng-paper/90 text-ng-forest shadow-[0_2px_10px_rgba(20,51,31,0.18)] backdrop-blur transition-transform hover:scale-105"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2M11 8v6M8 11h6" />
            </svg>
          </button>

          {/* Dots — swipe position indicator (mobile; desktop uses the thumb rail) */}
          {count > 1 ? (
            <div
              role="tablist"
              aria-label="Choose product image"
              className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ng-forest-deep/40 px-2.5 py-1.5 backdrop-blur-md md:hidden"
            >
              {displayImages.map((img, i) => (
                <button
                  key={`dot-${img.src}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === clampedActive}
                  aria-label={`Go to image ${i + 1}`}
                  onClick={() => go(i)}
                  className="grid h-5 min-w-[16px] place-items-center"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-all duration-300",
                      i === clampedActive ? "w-4 bg-ng-cream" : "w-1.5 bg-ng-cream/55",
                    )}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
