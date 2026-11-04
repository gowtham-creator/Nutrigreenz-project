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
    let last = window.scrollY;
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - last;
      const atTop = y < 8;
      // The bottom of the page always shows the bar, so the footer links and
      // the bar are both reachable.
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 4;
      setState((s) => {
        let hidden = s.hidden;
        if (atTop || atBottom) hidden = false;
        else if (delta > 6 && y > 80) hidden = true;
        else if (delta < -6) hidden = false;
        return hidden === s.hidden && atTop === s.atTop ? s : { atTop, hidden };
      });
      if (Math.abs(delta) > 6 || atTop) last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}
