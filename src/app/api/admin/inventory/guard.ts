/**
 * Shared admin gate for the inventory API. Mirrors the cookie + verifyToken
 * pattern used by `/api/admin/admins`. Any signed-in admin OR superadmin may
 * use these endpoints — the inventory portal is not super-admin-only.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";

/** True when a valid signed-in admin/superadmin session is present. */
export async function isSignedInAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return Boolean(session);
}

/**
 * True ONLY when a valid signed-in **super-admin** session is present. Mirrors
 * the `verifyToken(cookie) → role === "superadmin"` check used by
 * `/api/admin/admins`. Used to gate price changes, deletes, category edits and
 * CSV imports, which are reserved for super-admins.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session?.role === "superadmin";
}

/**
 * True when a request body carries a price field — either camelCase
 * `pricePaise` or snake_case `price_paise`. Setting/changing a price is a
 * super-admin-only action, so callers use this to decide whether to gate.
 */
export function bodyHasPrice(body: Record<string, unknown>): boolean {
  return body.pricePaise !== undefined || body.price_paise !== undefined;
}
