"use client";

import { useEffect, useRef, useState } from "react";

/**
 * CountUp — tweens a formatted figure when its value changes.
 *
 * ── Why this is a feature and not decoration ──────────────────────────────
 *
 * The dashboards poll (see `useLiveRefresh`) and update in place, deliberately
 * without a loading state so the page does not collapse to skeletons under
 * someone reading it. The cost of that decision is that a figure can change
 * silently: revenue goes from ₹1,24,800 to ₹1,26,100 between glances and
 * nothing on screen says so. Motion is the only channel left to say "this
 * moved", and it is the reason this exists — not because a number sliding is
 * pleasant.
 *
 * ── Why it re-formats rather than animating text ──────────────────────────
 *
 * `StatTile` is handed an already-formatted string — "₹1,24,800", "1,902",
 * "248" — because the caller owns how money and counts are written. Rather
 * than change that API (and every call site with it), this splits the string
 * into prefix, digits and suffix, tweens the digits, and re-groups them with
 * the same Indian locale separators on every frame. The caller keeps its
 * contract; only the presentation moves.
 *
 * A string with no digits, or the very first render, is passed through
 * untouched — counting up from zero on load would animate every tile on every
 * navigation, which is noise rather than signal.
 */

/** Matches a run of digits, commas and one optional decimal part. */
const NUMERIC = /(\d[\d,]*(?:\.\d+)?)/;

/** ~0.9s, ease-out: fast enough to be over before it is annoying. */
const DURATION_MS = 900;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  // The last numeric value shown, so a change tweens FROM where the eye was.
  const fromRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const match = value.match(NUMERIC);
    if (!match) {
      setDisplay(value);
      return;
    }

    const target = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(target)) {
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    fromRef.current = target;

    // First paint, or an unchanged figure: show it, do not animate.
    if (from === null || from === target) {
      setDisplay(value);
      return;
    }

    const decimals = match[1].includes(".") ? (match[1].split(".")[1]?.length ?? 0) : 0;
    const prefix = value.slice(0, match.index ?? 0);
    const suffix = value.slice((match.index ?? 0) + match[1].length);
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const current = from + (target - from) * easeOut(t);
      setDisplay(
        prefix +
          current.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }) +
          suffix,
      );
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <>{display}</>;
}
