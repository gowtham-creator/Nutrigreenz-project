"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
export function Gallery({ images, badge, badgeTone, discount, produceIcon = "leaf", theme, nutritionBySize }: GalleryProps) {
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
    return [{ src: variantSrc, alt: `${baseAlt} — ${selected?.size ?? "selected size"}`, label: selected?.size }, ...list];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, variantSrc, selected?.size, nutritionBySize]);

  const count = displayImages.length;
  const [active, setActive] = useState(0);
  const clampedActive = Math.min(active, count - 1);

  // Snap back to the lead image whenever the shopper changes size/SKU, so the
  // (possibly variant-specific) hero shot is what they see for the new pick.
  useEffect(() => {
    setActive(0);
  }, [selectedId, variantSrc]);

  const go = (i: number) => setActive(Math.min(Math.max(0, i), count - 1));

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

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {/* Thumbnails */}
      <div className="flex flex-row gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-col md:overflow-visible md:pb-0">
        {displayImages.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={() => go(i)}
            aria-label={`View image ${i + 1}`}
            aria-pressed={i === clampedActive}
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-ng-cream-deep transition-colors md:h-20 md:w-20",
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
          aria-label="Product images — swipe or use arrow keys"
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
                      // Fit fully INSIDE the frame — never scale past 100% at rest
                      // (that overflowed the stage and looked oversized/cropped).
                      "object-contain p-4",
                      reduce
                        ? ""
                        : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]",
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Badges (static overlay, above the track) */}
          <div className="pointer-events-none absolute left-5 top-5 z-10 flex flex-col gap-2">
            {badge ? <Badge tone={badgeTone ?? "leaf"}>{badge}</Badge> : null}
            {discount && discount > 0 && !badge ? <Badge tone="terracotta">{discount}% OFF</Badge> : null}
          </div>

          {/* Corner provenance tag */}
          <div className="pointer-events-none absolute bottom-5 right-5 z-10 inline-flex items-center gap-1.5 rounded-full bg-ng-paper/80 px-3 py-1.5 text-[11px] font-medium text-ng-forest backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-ng-leaf" />
            Single-origin
          </div>

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
