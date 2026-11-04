"use client";

import { useSyncExternalStore } from "react";

/**
 * True in the admin and captain apps. The admin app is served on
 * admin.nutrigreenz.farm with clean paths (/orders, not /admin/orders), so the
 * host is checked as well as the path.
 */
export function isOperatorLocation(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /^(admin|captain)[.]/.test(window.location.hostname) ||
    /^[/](admin|captain)([/]|$)/.test(window.location.pathname)
  );
}

const noop = () => () => {};

/**
 * The same, as a hook. The server can't know the host, so it says "store";
 * the browser corrects it straight after hydration without a mismatch.
 */
export function useIsOperator(): boolean {
  return useSyncExternalStore(noop, isOperatorLocation, () => false);
}
