"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAdminRole } from "@/lib/admin-auth";

/**
 * Idle-session guard for the operator portal (Feature #51).
 *
 * Watches for operator activity (mousemove / keydown / click / scroll) and,
 * after a role-based idle window, signs the operator out: it clears the server
 * session via `/api/admin/logout`, then redirects to the login screen with
 * `?reason=timeout` so the login page can explain why.
 *
 * Idle windows by role (read from the non-secret `ng_admin_role` cookie):
 *   - superadmin → 10 minutes
 *   - admin      → 8 minutes
 *
 * It runs ONLY on real `/admin/*` pages, and is a no-op on the auth screens
 * (`/admin/login`, `/admin/forgot`) where there is no session to protect.
 */

/** Idle window (ms) before auto sign-out, by role. */
const TIMEOUT_MS: Record<"superadmin" | "admin", number> = {
  superadmin: 10 * 60 * 1000,
  admin: 8 * 60 * 1000,
};

/** Activity events that count as the operator being present. */
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;

/** Pages that are pre-login (no session to time out). */
function isAuthScreen(pathname: string): boolean {
  return pathname === "/admin/login" || pathname === "/admin/forgot";
}

export function IdleTimeout() {
  const pathname = usePathname();
  const router = useRouter();
  // Guard so the sign-out only fires once even if the timer and an event race.
  const signedOut = useRef(false);

  useEffect(() => {
    // The proxy also serves the portal on the `admin.` subdomain where clean
    // paths (e.g. `/orders`, `/`) map to `/admin/*`. Treat the bare login path
    // on either host as an auth screen; everything else inside the portal is
    // a protected page that should idle-time-out.
    if (isAuthScreen(pathname) || pathname === "/login") return;

    const role = getAdminRole();
    if (!role) return; // No readable session → nothing to protect.
    const timeoutMs = TIMEOUT_MS[role];

    let timer: ReturnType<typeof setTimeout> | undefined;

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

    function reset() {
      if (signedOut.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void signOut();
      }, timeoutMs);
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, reset);
      }
    };
  }, [pathname, router]);

  return null;
}
