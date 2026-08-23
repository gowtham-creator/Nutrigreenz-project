"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounts its children the first time they come near the viewport.
 *
 * The Super Admin config page renders eight panels at once, and each fetches
 * from its own effect on mount — 37 requests on a page where most of those
 * panels are below the fold and may never be looked at. Deferring the mount
 * defers the fetch with it, so opening the page costs only what is on screen.
 *
 * ── The anchor problem ────────────────────────────────────────────────────
 *
 * Two of the deferred panels own a sub-nav target: the campaign builder holds
 * `id="coupons"` and roles-and-logs holds `id="access"`. Unmounting them would
 * remove the very element the sub-nav scrolls to, so "Coupons" would silently
 * do nothing — a worse bug than the one being fixed.
 *
 * So the placeholder carries the anchor while the child is absent, and DROPS it
 * the moment the child mounts, because the child brings its own copy and two
 * elements sharing an id is invalid. Clicking the sub-nav scrolls to the
 * placeholder, which is what brings the panel into view and mounts it.
 *
 * ── Why it does not pop ───────────────────────────────────────────────────
 *
 * `rootMargin` starts the mount well before the panel is actually visible, and
 * the placeholder reserves a minimum height so the scrollbar does not jump when
 * real content replaces it.
 */
export function WhenVisible({
  anchorId,
  minHeight = 280,
  children,
}: {
  /** Sub-nav target held by the placeholder until the child supplies its own. */
  anchorId?: string;
  /** Reserved height, so mounting does not shift the page under the reader. */
  minHeight?: number;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (very old browser, or a test environment): mount
    // immediately rather than leaving the operator with an empty page.
    if (typeof IntersectionObserver === "undefined") {
      // Deferred to a task rather than set inline: a synchronous setState inside
      // an effect is the cascading-render pattern `react-hooks` flags, and the
      // one-tick delay is invisible next to mounting a panel.
      const t = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(t);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      id={shown ? undefined : anchorId}
      style={shown ? undefined : { minHeight }}
      className={shown ? undefined : "scroll-mt-32"}
    >
      {shown ? children : null}
    </div>
  );
}
