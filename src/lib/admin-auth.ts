/**
 * Demo admin session — cookie-based, dependency-free.
 *
 * This is the ADMIN portal session and is intentionally separate from the
 * storefront/customer auth in `@/lib/auth`. There is no backend and Firebase
 * is unconfigured, so this is a lightweight demo gate: a single cookie
 * (`ng_admin`) holds the signed-in admin's email. The `proxy.ts` route guard
 * reads this cookie server-side to protect `/admin/*`.
 *
 * Credential validation lives in the login page (`/admin/login`).
 */

/** Name of the cookie that marks an authenticated admin session. */
export const ADMIN_COOKIE = "ng_admin";

/** Session lifetime: 12 hours (seconds). */
const MAX_AGE = 60 * 60 * 12;

/**
 * Persist an admin session by writing the `ng_admin` cookie (client-side).
 * The email is URI-encoded so it round-trips safely through the cookie value.
 */
export function signInAdmin(email: string): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(email);
  document.cookie = `${ADMIN_COOKIE}=${value}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

/** Clear the admin session by expiring the cookie. */
export function signOutAdmin(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ADMIN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Read the signed-in admin's email from the cookie (client-side), or null. */
export function getAdminEmail(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ADMIN_COOKIE}=`));
  if (!match) return null;
  const raw = match.slice(ADMIN_COOKIE.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
