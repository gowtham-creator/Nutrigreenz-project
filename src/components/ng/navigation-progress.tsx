"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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
 * ── Why a click listener rather than a router event ───────────────────────
 *
 * The App Router deliberately exposes no `routeChangeStart`. `useLinkStatus`
 * gives pending state, but only for one `<Link>`, which would mean touching
 * every link in the app and would still miss `router.push()` calls.
 *
 * A single capture-phase listener on the document catches every internal
 * anchor no matter who rendered it, and `usePathname()` changing is the
 * unambiguous signal that the new route has committed. One component, mounted
 * once, covers the whole storefront.
 *
 * ── What it shows ─────────────────────────────────────────────────────────
 *
 * Two things, because they do different jobs. `cursor: progress` on the root
 * element is the native OS busy cursor, which customers already understand and
 * which appears instantly with no paint of ours. The spinner then follows the
 * pointer, so the feedback is where the eye already is rather than in a corner
 * they are not looking at.
 */

/** Below this, a navigation is imperceptible and a flash of spinner is worse
 *  than none. Above it, the customer is waiting and should be told. */
const SHOW_AFTER_MS = 120;

/** Give up after this. A navigation that never commits (download, blocked
 *  route, external redirect) must not leave a spinner stuck to the cursor. */
const GIVE_UP_MS = 10_000;

/** True when this click should be treated as an in-app navigation. */
function isInternalNavigation(event: MouseEvent): boolean {
  // Modified clicks open a new tab; this page is not going anywhere.
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor) return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;

  // New tab, downloads, and non-navigating schemes.
  if (anchor.hasAttribute("download")) return false;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;
  if (/^(mailto:|tel:|sms:|javascript:|#)/i.test(href)) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;

  // Same page (a pure hash change) does not re-render anything.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return false;
  }
  return true;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  const showTimer = useRef<number | null>(null);
  const giveUpTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    if (giveUpTimer.current !== null) window.clearTimeout(giveUpTimer.current);
    showTimer.current = null;
    giveUpTimer.current = null;
  };

  // Start on any internal link click.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigation(event)) return;
      setPoint({ x: event.clientX, y: event.clientY });
      clearTimers();
      showTimer.current = window.setTimeout(() => setPending(true), SHOW_AFTER_MS);
      giveUpTimer.current = window.setTimeout(() => {
        clearTimers();
        setPending(false);
      }, GIVE_UP_MS);
    };
    // Capture phase: we want this before any handler that calls
    // stopPropagation, and before the router begins its own work.
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      clearTimers();
    };
  }, []);

  /*
   * The new route has committed. Stop.
   *
   * Adjusted DURING RENDER rather than in an effect. React documents this as
   * the way to reset state when a value changes ("You Might Not Need an
   * Effect"), and it matters here beyond satisfying the linter: an effect would
   * paint one frame of the new page with the spinner still attached, so the
   * customer would see it flicker on arrival. Comparing during render means the
   * first frame of the new route is already clean.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setPending(false);
  }

  /*
   * Timers are owned here rather than in the render adjustment above, because
   * refs may not be touched during render. Anything outstanding is irrelevant
   * the moment we are no longer pending, and clearing on that transition is
   * safe: effects run before the event loop can fire a pending timeout, so the
   * show-timer cannot slip through and re-raise the spinner after arrival.
   */
  useEffect(() => {
    if (!pending) clearTimers();
  }, [pending]);

  // Keep the spinner under the pointer while we wait.
  useEffect(() => {
    if (!pending) return;
    const onMove = (e: MouseEvent) => setPoint({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [pending]);

  // The native busy cursor, applied to the root so it wins everywhere.
  useEffect(() => {
    const root = document.documentElement;
    if (pending) root.setAttribute("data-navigating", "");
    else root.removeAttribute("data-navigating");
    return () => root.removeAttribute("data-navigating");
  }, [pending]);

  if (!pending || !point) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[200]"
      style={{
        // Offset clear of the cursor hotspot so it never sits under the arrow.
        left: point.x + 16,
        top: point.y + 16,
      }}
    >
      {/* Deliberately a bare <img>. next/image cannot optimise an ANIMATED
          image (it passes them through unchanged), so the component would add
          a wrapper and a loader for no benefit — and this element is created
          mid-navigation, where the extra work is exactly what we are trying to
          avoid. The asset is 13KB and served from /public. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ui/spinner-dots.webp"
        alt=""
        width={26}
        height={26}
        className="ng-nav-spinner block h-[26px] w-[26px] select-none"
        draggable={false}
      />
    </div>
  );
}

/**
 * Screen-reader announcement for the same state.
 *
 * The spinner is `aria-hidden` because a moving image pinned to the pointer
 * means nothing to a screen reader. This is the accessible equivalent, kept
 * separate so the visual and the announcement can differ in timing.
 */
export function NavigationProgressAnnouncer({ busy }: { busy: boolean }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {busy ? "Loading page" : ""}
    </span>
  );
}
