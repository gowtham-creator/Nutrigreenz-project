/**
 * Admin portal session — cookie names and client-side helpers.
 *
 * This is the ADMIN portal session and is intentionally separate from the
 * storefront/customer auth in `@/lib/auth`. The session is now validated
 * server-side: `/api/admin/login` mints a signed, httpOnly cookie (`ng_admin`)
 * that the Edge proxy (`proxy.ts`) verifies on every `/admin/*` request. Client
 * JS can no longer read or forge that cookie.
 *
 * For UI display only, login also sets a readable (non-httpOnly) cookie
 * (`ng_admin_email`) holding just the email string — it carries no auth power.
 */

/** httpOnly signed session token — the real gate. Read server-side only. */
export const ADMIN_COOKIE = "ng_admin";

/** Readable email cookie for UI display only (NOT httpOnly, no auth power). */
export const ADMIN_EMAIL_COOKIE = "ng_admin_email";

/**
 * Sign out the current admin: clears both cookies server-side (the httpOnly
 * gate can only be cleared by the server), then redirects to the login screen.
 * Kept as `signOutAdmin` so existing callers (e.g. the admin shell) keep working.
 */
export async function signOutAdmin(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/admin/logout", { method: "POST" });
  } catch {
    // Ignore network errors — we still redirect to the login screen.
  }
  window.location.href = "/admin/login";
}

/**
 * Read the signed-in admin's email from the readable `ng_admin_email` cookie
 * (client-side), or null. This is display-only and confers no authorisation.
 */
export function getAdminEmail(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ADMIN_EMAIL_COOKIE}=`));
  if (!match) return null;
  const raw = match.slice(ADMIN_EMAIL_COOKIE.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
