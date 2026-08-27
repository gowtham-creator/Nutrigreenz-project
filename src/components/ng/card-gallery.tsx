"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Product card imagery that cycles the PDP gallery while the pointer is over it.
 *
 * ── Why cycle rather than swap ────────────────────────────────────────────
 *
 * A single hover swap shows the customer one alternate view. Cycling shows
 * them the whole set — the label, the back panel, the pour shot, the lab
 * report — which is most of what they would have opened the product page to
 * see. On a catalogue where several SKUs look near-identical in the thumbnail
 * (six cold-pressed oils in the same bottle), that is the difference between
 * browsing and guessing.
 *
 * ── What this deliberately does NOT do ────────────────────────────────────
 *
 * It does not preload the gallery. Fourteen products at up to seven images
 * each is ninety-odd images, and eagerly fetching them to service a hover that
 * may never happen would cost every customer the bandwidth so that a few get a
 * faster second frame. Gallery frames mount on first hover; the base image is
 * always present underneath, so there is never an empty box.
 *
 * It also does not run on touch. There is no hover on a phone, and cycling on
 * scroll-into-view would animate the whole grid at once while someone is
 * trying to read it.
 */

/** Long enough to actually look at a frame, short enough to see several. */
const FRAME_MS = 850;

export function CardGallery({
  image,
  gallery,
  alt,
  className,
  sizes = "(max-width: 640px) 60vw, (max-width: 1280px) 33vw, 22vw",
}: {
  /** The primary image, always rendered. */
  image?: string;
  /** Additional PDP images, if any. */
  gallery?: string[];
  alt: string;
  className?: string;
  sizes?: string;
}) {
  /*
   * The base image first, then any gallery frame that is not simply a repeat
   * of it — the catalogue mapper sets `image_url` from the gallery for some
   * products, so without this the cycle would open by "changing" to the
   * identical picture and read as a flicker.
   */
  const frames = [image, ...(gallery ?? [])].filter(
    (src, i, all): src is string => Boolean(src) && all.indexOf(src) === i,
  );
  const canCycle = frames.length > 1;

  const [index, setIndex] = useState(0);
  // Which frames have ever been shown; only these get mounted.
  const [warmed, setWarmed] = useState<Set<number>>(() => new Set([0]));
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stop, []);

  const start = () => {
    if (!canCycle) return;
    // Respect the OS setting: cycling imagery is motion, and someone who has
    // asked for less of it should get the static card.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    stop();
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % frames.length;
        setWarmed((w) => (w.has(next) ? w : new Set(w).add(next)));
        return next;
      });
    }, FRAME_MS);
  };

  const reset = () => {
    stop();
    setIndex(0);
  };

  if (frames.length === 0) {
    return (
      <div className={cn("ng-img-fallback h-full w-full text-2xl", className)}>
        {alt.slice(0, 2)}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={start}
      onMouseLeave={reset}
      /* Keyboard users tab to the card's link rather than pointing at it, so
         focus drives the same cycle. Without this the feature is unreachable
         without a mouse. */
      onFocus={start}
      onBlur={reset}
    >
      {frames.map((src, i) =>
        warmed.has(i) ? (
          <Image
            key={src}
            src={src}
            alt={i === 0 ? alt : ""}
            aria-hidden={i === 0 ? undefined : true}
            fill
            quality={90}
            sizes={sizes}
            className={cn(
              "object-cover transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]",
              i === index ? "opacity-100" : "opacity-0",
              className,
            )}
          />
        ) : null,
      )}

      {/*
        Progress pips, shown only while cycling. They tell the customer this is
        a set with a length rather than an image glitching, and they say how
        much is left — without them a card that changes on its own reads as a
        fault.
      */}
      {canCycle ? (
        <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {frames.map((src, i) => (
            <span
              key={src}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === index ? "w-3.5 bg-ng-paper" : "w-1 bg-ng-paper/55",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
