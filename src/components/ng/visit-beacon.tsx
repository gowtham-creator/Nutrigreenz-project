"use client";

import { useEffect } from "react";

/**
 * VisitBeacon — counts this browser once per session, then stays quiet.
 *
 * Fires a single POST that increments a city counter server-side. It sends no
 * body: everything recorded is derived from Vercel's edge headers on the
 * request itself, so this component knows nothing about the visitor and could
 * not leak anything if it tried.
 *
 * ── Why once per session ──────────────────────────────────────────────────
 *
 * Counting on every page view would measure how much someone browses, not how
 * many people came — a single shopper working through the catalogue would
 * outweigh a dozen real visitors from another city, and the dashboard would
 * quietly answer the wrong question. The sessionStorage key is per tab-session
 * and is cleared when the browser closes.
 *
 * The whole thing is best-effort. A blocked storage API, a failed request or a
 * visitor who leaves before it lands all simply mean one uncounted visit; none
 * of them may interrupt the page.
 */
const KEY = "ng_visit_counted";

export function VisitBeacon() {
  useEffect(() => {
    let counted = false;
    try {
      counted = sessionStorage.getItem(KEY) === "1";
    } catch {
      // Storage denied (private mode, embedded webview) — count anyway rather
      // than not at all; the cost of a duplicate is one inflated number.
    }
    if (counted) return;

    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* see above */
    }

    /*
     * keepalive so the request still completes if the visitor navigates away
     * immediately — bounces are exactly the visits most likely to be missed,
     * and dropping them would bias the map toward engaged shoppers.
     */
    void fetch("/api/geo/visit", { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  return null;
}
