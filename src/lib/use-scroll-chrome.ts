"use client";

import { useEffect, useState } from "react";

/**
 * Scroll state for the phone and tablet chrome, like a shopping app:
 *
 *   atTop  — the page is at (or within a few pixels of) the very top. The
 *            delivery-location row shows only then.
 *   hidden — the person is scrolling down, so the bottom tab bar slides away
 *            to give the page room; any scroll up brings it straight back.
 *
 * Small movements are ignored so a jittery thumb doesn't flicker the bar.
 */
export function useScrollChrome(): { atTop: boolean; hidden: boolean } {
  const [state, setState] = useState({ atTop: true, hidden: false });

  useEffect(() => {
    let anchor = Math.max(0, window.scrollY);
    let frame = 0;
    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = Math.max(0, doc.scrollHeight - window.innerHeight);
      // iOS rubber-banding reports positions past either end; ignore them.
      const y = Math.min(max, Math.max(0, window.scrollY));
      // A page with little to scroll never collapses the location row: on a
      // short page (like Profile) collapsing it shortened the page, pulled
      // the scroll back to the top, re-opened the row, and flickered.
      const roomy = max > 220;
      setState((s) => {
        // Hysteresis: leave "top" only well past the row, return at the top.
        const atTop = !roomy || (s.atTop ? y < 72 : y < 4);
        const atBottom = y >= max - 4;
        // Direction is judged over a run of movement, not single frames, so
        // a jittery thumb doesn't flick the bar in and out.
        const run = y - anchor;
        let hidden = s.hidden;
        if (atTop || atBottom) {
          hidden = false;
          anchor = y;
        } else if (run > 28 && y > 96) {
          hidden = true;
          anchor = y;
        } else if (run < -20) {
          hidden = false;
          anchor = y;
        } else if ((hidden && run > 0) || (!hidden && run < 0)) {
          // Still moving the same way: keep the anchor at the turning point.
          anchor = y;
        }
        return hidden === s.hidden && atTop === s.atTop ? s : { atTop, hidden };
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    read();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}
