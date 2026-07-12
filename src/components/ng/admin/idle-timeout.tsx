"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAdminRole } from "@/lib/admin-auth";

/**
 * Idle-session guard for the operator portal (Feature #51).
 *
 * While the operator is active (mousemove / keydown / click / scroll) it pings
 * `/api/admin/heartbeat` — throttled to once a minute — which SLIDES the server
 * session cookie forward, so an actively-working operator is NEVER signed out
 * (and a plain refresh keeps them in). After a full idle window with no activity
 * it signs out: clears the server session via `/api/admin/logout`, then redirects
 * to the login screen with `?reason=timeout`.
 *
 * Belt-and-braces: the session cookie itself now expires after the same window
 * (see ADMIN_SESSION_TTL_SECONDS), so even if this timer never runs — e.g. the
 * tab was closed and the portal reopened after the window — the proxy finds no
 * valid session and redirects to login. So the timeout holds whether the tab
 * stays open or not.
 *
 * Runs ONLY on real `/admin/*` pages; a no-op on the auth screens where there is
 * no session to protect.
 */

/** Idle window (ms) before auto sign-out — mirrors ADMIN_SESSION_TTL_SECONDS. */
const IDLE_MS = 30 * 60 * 1000;
/** Ping the heartbeat at most once per this interval, however busy the mouse is. */
const HEARTBEAT_THROTTLE_MS = 60 * 1000;

/** Activity events that count as the operator being present. */
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;

/** Pages that are pre-login (no session to time out). */
function isAuthScreen(pathname: string): boolean {
  return pathname === "/admin/login" || pathname === "/admin/forgot" || pathname === "/login";
}

export function IdleTimeout() {
  const pathname = usePathname();
  const router = useRouter();
  // Guard so the sign-out only fires once even if the timer and an event race.
  const signedOut = useRef(false);

  useEffect(() => {
    if (isAuthScreen(pathname)) return;

    const role = getAdminRole();
    if (!role) return; // No readable session → nothing to protect.

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastPing = 0;

    async function signOut() {
      if (signedOut.current) return;
      signedOut.current = true;
      try {
        await fetch("/api/admin/logout", { method: "POST" });
      } catch {
        // Ignore — still bounce to login so the stale UI can't be used.
      }
      router.replace("/admin/login?reason=timeout");
    }

    // Slide the server session while active, but no more than once a minute.
    function heartbeat() {
      const now = Date.now();
      if (now - lastPing < HEARTBEAT_THROTTLE_MS) return;
      lastPing = now;
      void fetch("/api/admin/heartbeat", { method: "POST" }).catch(() => {});
    }

    function reset() {
      if (signedOut.current) return;
      heartbeat();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void signOut();
      }, IDLE_MS);
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }
    reset(); // start the timer + slide once on mount / navigation

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, reset);
      }
    };
  }, [pathname, router]);

  return null;
}
