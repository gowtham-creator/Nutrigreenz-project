/**
 * Admin portal session — cookie names and client-side helpers.
 *
 * This is the ADMIN portal session and is intentionally separate from the
 * storefront/customer auth in `@/lib/auth`. The session is now validated
 * server-side: `/api/admin/login` mints a signed, httpOnly cookie (`ng_admin`)
 * that the Edge proxy (`proxy.ts`) verifies on every `/admin/*` request. Client
 * JS can no longer read or forge that cookie.
 *
 * For UI display/gating only, login also sets two readable (non-httpOnly)
 * cookies: `ng_admin_email` (the email string) and `ng_admin_role` (the role
 * string). Neither carries any auth power — the proxy enforces real access via
 * the signed `ng_admin` token, which itself binds both email and role.
 */

/** A role an admin session can hold (mirrors `AdminRole` in admin-session). */
export type AdminRole = "admin" | "superadmin";

/** httpOnly signed session token — the real gate. Read server-side only. */
export const ADMIN_COOKIE = "ng_admin";

/** Readable email cookie for UI display only (NOT httpOnly, no auth power). */
export const ADMIN_EMAIL_COOKIE = "ng_admin_email";

/** Readable role cookie for UI gating only (NOT httpOnly, no auth power). */
export const ADMIN_ROLE_COOKIE = "ng_admin_role";

/**
 * Short-lived, httpOnly signed ticket proving the passcode step passed and the
 * super-admin still owes an authenticator code. It carries NO portal access on
 * its own — it uses a distinct `mfa` payload tag that the session verifier
 * rejects, so it can never be replayed as an `ng_admin` session.
 */
export const ADMIN_MFA_COOKIE = "ng_admin_mfa";

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

/**
 * Read the signed-in admin's role from the readable `ng_admin_role` cookie
 * (client-side), or null. This is display/gating-only and confers no
 * authorisation — the proxy enforces real access via the signed token.
 */
export function getAdminRole(): AdminRole | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ADMIN_ROLE_COOKIE}=`));
  if (!match) return null;
  const raw = match.slice(ADMIN_ROLE_COOKIE.length + 1);
  if (raw === "admin" || raw === "superadmin") return raw;
  return null;
}
