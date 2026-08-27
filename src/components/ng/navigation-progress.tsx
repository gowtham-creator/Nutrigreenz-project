"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tells the customer a page is opening, from the moment they click.
 *
 * ── The problem ───────────────────────────────────────────────────────────
 *
 * App Router navigations are server-rendered. Between the click and the new
 * page painting there is a gap that varies with the route and the connection,
 * and during it NOTHING changes on screen: the old page just sits there. The
 * customer cannot tell whether the tap registered, so they tap again, and a
 * second navigation queues behind the first.
 *
 * ── Why the completion signal is the full URL, not usePathname() ──────────
 *
 * The first version cleared on `usePathname()` changing, and hung on the shop
 * page. The category filters navigate to `/shop?category=oils` — a real
 * navigation, but the PATHNAME never changes, only the query. `usePathname()`
 * therefore never fired and the spinner sat there until the give-up timeout,
 * which is the "infinitely loading" report.
 *
 * `useSearchParams()` would see it, but calling it here would be a bad trade:
 * in the root layout it opts every page out of static generation unless each
 * is wrapped in Suspense. So while a navigation is outstanding this samples
 * `location.pathname + location.search` directly. Polling is normally a smell;
 * here it is the cheapest correct option, it runs ONLY while a navigation is
 * in flight, and it catches every kind — push, replace, back, forward, and
 * query-only — without hooking the history API.
 *
 * ── Why a click listener rather than a router event ───────────────────────
 *
 * The App Router deliberately exposes no `routeChangeStart`, and
 * `useLinkStatus` covers one `<Link>` at a time. A single capture-phase
 * listener on the document catches every internal anchor no matter who
 * rendered it, from one component mounted once.
 */

/** Below this, a navigation is imperceptible and a flash of spinner is worse
 *  than none. Above it, the customer is waiting and should be told. */
const SHOW_AFTER_MS = 120;

/** How often to check whether the URL has changed, while waiting. */
const POLL_MS = 80;

/** Hard stop. A navigation that never commits (blocked route, download, an
 *  external redirect) must not leave a spinner stuck to the cursor forever. */
const GIVE_UP_MS = 6_000;

/** True when this click should be treated as an in-app navigation. */
function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor) return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;

  if (anchor.hasAttribute("download")) return false;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;

  // Identical URL, or a pure hash jump on this page: nothing loads.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return false;
  }
  return true;
}

const currentUrl = () => window.location.pathname + window.location.search;

export function NavigationProgress() {
  const [pending, setPending] = useState(false);

  /*
   * Where the spinner first appears: set ONCE per navigation, from the click.
   *
   * Subsequent pointer movement is written straight to the node's transform in
   * the effect below and never through state. A mousemove-driven setState
   * would re-render on every pointer sample while the browser is already busy
   * fetching a route, which is the one moment to spend nothing.
   */
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const chipRef = useRef<HTMLDivElement>(null);

  const showTimer = useRef<number | null>(null);
  const giveUpTimer = useRef<number | null>(null);
  const poller = useRef<number | null>(null);

  /*
   * Keep the spinner under the pointer, by mutating the node directly.
   *
   * Only mounted while pending, and it writes no state, so a customer moving
   * the mouse during a route fetch costs one style write per sample rather
   * than a React render.
   */
  useEffect(() => {
    if (!pending) return;
    const onMove = (e: MouseEvent) => {
      const el = chipRef.current;
      if (el) el.style.transform = `translate3d(${e.clientX + 16}px, ${e.clientY + 16}px, 0)`;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [pending]);

  useEffect(() => {
    const clearAll = () => {
      for (const t of [showTimer, giveUpTimer]) {
        if (t.current !== null) window.clearTimeout(t.current);
        t.current = null;
      }
      if (poller.current !== null) window.clearInterval(poller.current);
      poller.current = null;
    };

    const stop = () => {
      clearAll();
      setPending(false);
    };

    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigation(event)) return;

      /*
       * A keyboard-activated link still emits a click, but with clientX/clientY
       * of 0, which would pin the spinner to the top-left corner. Fall back to
       * the anchor's own box so the feedback lands where the customer is
       * looking.
       */
      if (event.clientX !== 0 || event.clientY !== 0) {
        setOrigin({ x: event.clientX, y: event.clientY });
      } else {
        const rect = (event.target as Element | null)?.closest?.("a")?.getBoundingClientRect();
        setOrigin(
          rect
            ? { x: rect.left + rect.width / 2, y: rect.bottom }
            : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        );
      }

      const startedAt = currentUrl();
      clearAll();

      showTimer.current = window.setTimeout(() => setPending(true), SHOW_AFTER_MS);
      giveUpTimer.current = window.setTimeout(stop, GIVE_UP_MS);
      // The URL is what says the navigation actually landed.
      poller.current = window.setInterval(() => {
        if (currentUrl() !== startedAt) stop();
      }, POLL_MS);
    };

    // Capture phase: ahead of any handler that calls stopPropagation.
    document.addEventListener("click", onClick, { capture: true });
    // A full page load or a tab switch means whatever we were tracking is over.
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("pagehide", stop);
      clearAll();
    };
  }, []);

  // The native busy cursor, on the root so it wins over every element's own.
  useEffect(() => {
    const root = document.documentElement;
    if (pending) root.setAttribute("data-navigating", "");
    else root.removeAttribute("data-navigating");
    return () => root.removeAttribute("data-navigating");
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      ref={chipRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[200]"
      // Positioned on the first paint from the last known pointer, then moved
      // by the listener above without involving React again.
      style={{ transform: `translate3d(${origin.x + 16}px, ${origin.y + 16}px, 0)` }}
    >
      {/*
        The dot ring, drawn rather than loaded.

        This was an animated WebP converted from the supplied GIF, and it
        smeared: the encoder optimised frames 2+ into sub-rectangles but wrote
        `dispose: none`, so dots from the first frame lying outside a later
        frame's box were never cleared and burned in. Drawn in CSS there are no
        frames to dispose, and it is crisp at any DPI and themed by token.

        The chip is what makes it legible: the spinner appears over whatever the
        customer was looking at, which on this site is usually photography.
      */}
      <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-paper/95 shadow-[0_2px_10px_rgba(20,51,31,0.28)] ring-1 ring-ng-line/60">
        <span className="ng-dot-ring">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ ["--i" as string]: i }} />
          ))}
        </span>
      </span>
    </div>
  );
}
