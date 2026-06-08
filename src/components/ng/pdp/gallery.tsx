"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ng/badge";
import type { Tone } from "@/types/nutrigreenz";
import { PhotoPlaceholder, isPlaceholderSrc } from "./photo-placeholder";
import type { ProduceIconName } from "@/components/ng/produce-icons";

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
}

/**
 * Interactive product gallery — main viewer + clickable thumbnail rail.
 * Until real photography exists, each slot renders an attractive, category-aware
 * <PhotoPlaceholder> (front / pack / texture / lifestyle) instead of one flat
 * logo — so the client can see exactly which shot drops in where.
 */
export function Gallery({ images, badge, badgeTone, discount, produceIcon = "leaf" }: GalleryProps) {
  const safeImages = images.length > 0 ? images : [{ src: "/images/placeholder.svg", alt: "Product image" }];
  const [active, setActive] = useState(0);
  const current = safeImages[Math.min(active, safeImages.length - 1)];

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {/* Thumbnails */}
      <div className="flex flex-row gap-3 md:flex-col">
        {safeImages.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`View image ${i + 1}`}
            aria-pressed={i === active}
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-ng-cream-deep transition-colors md:h-20 md:w-20",
              i === active ? "border-ng-forest ring-1 ring-ng-forest" : "border-ng-line hover:border-ng-leaf",
            )}
          >
            {isPlaceholderSrc(img.src) ? (
              <PhotoPlaceholder icon={produceIcon} variant="thumb" />
            ) : (
              <Image src={img.src} alt={img.alt} fill className="object-contain p-2" sizes="80px" />
            )}
          </button>
        ))}
      </div>

      {/* Main image — premium stage with soft 3D framing */}
      <div className="persp-1000 relative flex-1">
        <div className="group relative aspect-square overflow-hidden rounded-[28px] border border-ng-line-soft bg-gradient-to-br from-ng-cream via-ng-cream to-ng-cream-deep shadow-[var(--shadow-ng-card)]">
          {/* Ambient glow + halo behind product */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ng-leaf/10 blur-3xl" />
            <div className="absolute inset-x-8 bottom-6 h-6 rounded-[50%] bg-ng-forest-deep/10 blur-2xl" />
          </div>
          {isPlaceholderSrc(current.src) ? (
            <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]">
              <PhotoPlaceholder icon={produceIcon} variant="main" label={current.label ?? current.alt} />
            </div>
          ) : (
            <Image
              src={current.src}
              alt={current.alt}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="relative object-contain p-10 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] [transform-style:preserve-3d] group-hover:scale-[1.04]"
            />
          )}
          <div className="absolute left-5 top-5 z-10 flex flex-col gap-2">
            {badge ? <Badge tone={badgeTone ?? "leaf"}>{badge}</Badge> : null}
            {discount && discount > 0 && !badge ? <Badge tone="terracotta">{discount}% OFF</Badge> : null}
          </div>
          {/* Corner provenance tag */}
          <div className="absolute bottom-5 right-5 z-10 inline-flex items-center gap-1.5 rounded-full bg-ng-paper/80 px-3 py-1.5 text-[11px] font-medium text-ng-forest backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-ng-leaf" />
            Single-origin
          </div>
        </div>
      </div>
    </div>
  );
}
