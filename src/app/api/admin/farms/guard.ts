/**
 * Admin gate for the Farms API. Mirrors the cookie + verifyToken pattern used by
 * `/api/admin/inventory`. Any signed-in admin may read; writes are gated to
 * super-admins by the routes (same policy as category management).
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

/** True ONLY when a valid signed-in super-admin session is present. */
export async function isSuperAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session?.role === "superadmin";
}
