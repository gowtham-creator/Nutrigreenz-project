"use client";

import { useEffect, useRef } from "react";

/**
 * useLiveRefresh — keep an admin dashboard in step with the orders table.
 *
 * ── The problem ───────────────────────────────────────────────────────────
 *
 * Reports, Analytics and the Overview each queried their API once on mount and
 * then never again. Marking an order delivered, or a payment paid, changed the
 * numbers those screens are built from — but the screens themselves only found
 * out if the operator changed the date range or hard-reloaded. So a dashboard
 * left open on a second monitor, which is exactly how these screens get used,
 * quietly showed yesterday's figures all day, with nothing on it to say so.
 *
 * ── Why polling and focus, and not websockets ─────────────────────────────
 *
 * Supabase Realtime would push order changes to the browser directly. It would
 * also mean shipping the anon key to the client and opening row-level policies
 * on `orders` so that key could read them. Nothing in this app uses the anon
 * key today — every read is service-role, server-side, behind an admin session
 * — and widening that surface to save a few seconds of latency on an internal
 * dashboard is a bad trade in general and a worse one with a CERT-In audit
 * pending.
 *
 * What operators actually need is that the screen is current when they are
 * looking at it. So:
 *
 *   · refetch when the tab becomes visible again — this covers the real
 *     workflow, which is changing a status in one tab and switching back;
 *   · refetch on window focus, for a second monitor where the tab was never
 *     hidden;
 *   · and a slow poll while visible, so a screen nobody touches still moves.
 *
 * ── Why it never polls in the background ──────────────────────────────────
 *
 * The interval is torn down whenever the document is hidden. A dashboard left
 * open overnight otherwise bills a query a minute against Supabase for a screen
 * nobody is reading, and browsers throttle background timers unpredictably
 * anyway, so those queries arrive in bursts rather than on the schedule.
 *
 * `onRefresh` is held in a ref, so a caller passing an inline closure does not
 * tear down and rebuild the listeners on every render.
 */
export function useLiveRefresh(
  onRefresh: () => void,
  {
    /** Poll interval in ms while the tab is visible. 0 disables polling. */
    intervalMs = 60_000,
    enabled = true,
  }: { intervalMs?: number; enabled?: boolean } = {},
) {
  const handler = useRef(onRefresh);
  // Synced in an effect rather than assigned during render: writing a ref while
  // rendering is not safe under the React Compiler, which may discard or replay
  // a render. Deliberately dependency-less, so it re-points after every render
  // and the listeners below always call the newest closure.
  useEffect(() => {
    handler.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      if (intervalMs > 0) {
        timer = setInterval(() => handler.current(), intervalMs);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        handler.current();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const onFocus = () => handler.current();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    if (document.visibilityState === "visible") startPolling();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      stopPolling();
    };
  }, [enabled, intervalMs]);
}
