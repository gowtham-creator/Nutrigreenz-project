/**
 * The "this browser has chosen a delivery location" flag.
 *
 * ── Why this is its own module ────────────────────────────────────────────
 *
 * The flag used to be a private constant inside `location-onboarding.tsx`, and
 * only that component wrote it. But the change-location SHEET can also set a
 * zone — it calls `setZone()` and closes, without ever marking the browser as
 * onboarded. So a customer who set their location using the header pill was
 * still un-onboarded, and the first-visit modal auto-opened again on their next
 * page load. That is the "prompting me twice" report.
 *
 * Hoisting it here gives every path that can establish a location one shared
 * place to record the fact.
 */

const ONBOARDED_KEY = "ng-loc-onboarded";

/** True when this browser has already chosen (or explicitly skipped) a location. */
export function hasOnboardedLocation(): boolean {
  if (typeof window === "undefined") return true; // never prompt during SSR
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true; // storage blocked (private mode) → don't nag on every load
  }
}

/** Record that this browser has chosen or skipped a location. Never throws. */
export function markLocationOnboarded(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    /* quota / private mode — the worst case is one more prompt */
  }
}
