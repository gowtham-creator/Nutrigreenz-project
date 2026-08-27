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

/**
 * Dwell per frame.
 *
 * 850ms was the first attempt and read as a flicker: the eye needs roughly a
 * second to actually take in a new image, so anything faster shows motion
 * without conveying content. At 1.5s a seven-frame set takes ten seconds to
 * loop, which is far longer than anyone hovers — and that is fine. The point
 * is that whatever the customer DOES see, they see properly.
 */
const FRAME_MS = 1500;

/**
 * Slide length.
 *
 * Paired with the easing below: fast out of the gate, long settle. That
 * asymmetry is what makes a moving object read as having weight rather than
 * being linearly dragged, and it is most of the difference between "animated"
 * and "natural".
 */
const SLIDE_MS = 720;
const SLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

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
  /** Suppresses the slide for one frame, so the return to frame 0 is instant. */
  const [snap, setSnap] = useState(false);
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
    /*
     * Warm one frame AHEAD of the one being shown.
     *
     * Without this the track slid to a slot whose <Image> had only just
     * mounted, so an empty panel arrived and the photograph popped in after
     * it. Mounting the next frame as soon as we land on the current one gives
     * it a full FRAME_MS to fetch and decode before it is ever on screen.
     */
    setWarmed((w) => (w.has(1) ? w : new Set(w).add(1)));

    timer.current = window.setInterval(() => {
      setIndex((i) => {
        /*
         * Forward only, stopping at the last frame — deliberately NOT a modulo
         * wrap. Wrapping would send a translated track sliding backwards across
         * its entire width in one sweep, which is the ugliest thing a filmstrip
         * can do. Stopping is also honest: the customer has now seen the whole
         * set, and there is nothing further to show them.
         */
        if (i >= frames.length - 1) {
          stop();
          return i;
        }
        const next = i + 1;
        // The one after next, so it is loaded before the track reaches it.
        const ahead = Math.min(next + 1, frames.length - 1);
        setWarmed((w) =>
          w.has(next) && w.has(ahead) ? w : new Set(w).add(next).add(ahead),
        );
        return next;
      });
    }, FRAME_MS);
  };

  const reset = () => {
    stop();
    /*
     * Snap back rather than slide back. Returning from frame seven would drag
     * the track six widths in reverse — long, and pointing the wrong way. The
     * pointer has already left the card, so an instant return is both cheaper
     * and less distracting. The transition is suppressed for exactly one frame,
     * then restored so the next hover animates normally.
     */
    setSnap(true);
    setIndex(0);
    requestAnimationFrame(() => requestAnimationFrame(() => setSnap(false)));
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
      /*
       * The hover zoom lives on this wrapper, not on each frame.
       *
       * Scaling every image individually meant each crossfade restarted its own
       * transform, so the zoom stuttered every time the frame changed. Scaling
       * the container once keeps the push-in continuous underneath, and lets
       * the frames dissolve independently on top — which is what makes the
       * sequence read as one moving image rather than a slideshow.
       */
      className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
      onMouseEnter={start}
      onMouseLeave={reset}
      /* Keyboard users tab to the card's link rather than pointing at it, so
         focus drives the same cycle. Without this the feature is unreachable
         without a mouse. */
      onFocus={start}
      onBlur={reset}
    >
      {/*
        A sliding filmstrip, not a crossfade.

        The first version dissolved one image into the next, and no amount of
        slowing it down fixed how it read: a dissolve has no spatial logic, so
        two unrelated photographs simply melt through each other and the eye
        registers flicker rather than movement. A track that slides has
        direction and continuity — each frame arrives from somewhere and the
        previous one leaves — which is what makes it read as browsing a set
        rather than watching a picture glitch.
      */}
      <div
        className="flex h-full w-full"
        style={{
          transform: `translate3d(-${index * 100}%, 0, 0)`,
          transition: snap ? "none" : `transform ${SLIDE_MS}ms ${SLIDE_EASE}`,
        }}
      >
        {frames.map((src, i) => (
          /*
           * The slot is always rendered even when the image is not, so the
           * track keeps its full width and the translate above lands on the
           * right frame. Only warmed slots mount an <Image>.
           */
          <div key={src} className="relative h-full w-full shrink-0">
            {warmed.has(i) ? (
              <Image
                src={src}
                alt={i === 0 ? alt : ""}
                aria-hidden={i === 0 ? undefined : true}
                fill
                quality={90}
                sizes={sizes}
                /*
                 * `contain`, not `cover`.
                 *
                 * These galleries mix three aspect ratios in a square card: the
                 * lifestyle tiles are 1600x894 (1.79), the hero and comparison
                 * tiles 1400x1400, and every product jar 1200x1490 (0.81).
                 * Under `cover` the square box cropped roughly 44% off each
                 * side of the wide tiles and 19% off the top and bottom of
                 * every jar — lids and labels cut away, which is what made them
                 * unreadable. `contain` letterboxes onto the card's cream
                 * ground, so whatever the photographer framed is what the
                 * customer sees.
                 */
                className={cn("object-contain p-2", className)}
              />
            ) : null}
          </div>
        ))}
      </div>

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
