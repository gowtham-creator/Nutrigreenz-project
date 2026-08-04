"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Fade + lift on every route change.
 *
 * Keyed on the pathname: React tears the subtree down and rebuilds it when the
 * key changes, so the CSS animation replays on each navigation rather than only
 * on first mount.
 *
 * ── Enter only, deliberately ──────────────────────────────────────────────
 *
 * There is no exit animation. In the App Router the outgoing route unmounts as
 * soon as the new one is ready, so an exit would have to hold the old page on
 * screen — which means every navigation gets *slower* to look smoother. That is
 * the wrong trade in an admin portal where the complaint was that navigation
 * felt sluggish.
 *
 * ── Why CSS rather than a motion library ──────────────────────────────────
 *
 * A JS animation cannot start until hydration; a CSS animation starts on the
 * first paint. Using CSS means the transition never delays content — it plays
 * *as* the page appears, not after it.
 *
 * The movement is small on purpose: 6px and 260ms. Anything longer reads as lag
 * on a page you navigate to dozens of times an hour, and the point is to make a
 * navigation feel acknowledged, not to perform.
 *
 * Honours `prefers-reduced-motion` via the CSS rule in globals.css, which
 * disables the movement and leaves a plain fade.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={`ng-page-in ${className ?? ""}`}>
      {children}
    </div>
  );
}
