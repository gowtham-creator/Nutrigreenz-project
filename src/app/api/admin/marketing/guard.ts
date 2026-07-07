/**
 * Shared admin gate for the marketing API (coupon catalogue CRUD). Coupon
 * administration is **super-admin only**, mirroring the config surface — so this
 * re-exports the canonical `requireSuperAdmin` / `isSuperAdmin` guard from the
 * config routes rather than duplicating the cookie + verifyToken check, and adds
 * a small helper to name the acting super-admin for the activity trail.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";

export { requireSuperAdmin, isSuperAdmin } from "../config/guard";

/**
 * The signed-in super-admin's email, for `logActivity` attribution. Callers run
 * {@link requireSuperAdmin} first, so a session is present; falls back to
 * "system" defensively if the cookie somehow can't be re-read.
 */
export async function superAdminEmail(): Promise<string> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session?.email ?? "system";
}
