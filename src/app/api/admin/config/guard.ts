/**
 * Shared admin gate for the Super Admin config API (commerce rules, delivery
 * slots, serviceable areas). The whole config surface is **super-admin only**,
 * mirroring the `verifyToken(cookie) → role === "superadmin"` check used by
 * `/api/admin/admins` and the inventory super-admin gate.
 *
 * The Edge proxy already redirects non-super-admins away from `/admin/config`;
 * these checks are the authoritative server-side enforcement for the API.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";

/** True ONLY when a valid signed-in **super-admin** session is present. */
export async function isSuperAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session?.role === "superadmin";
}

/**
 * Standard guard for every config route: returns a `Response` to short-circuit
 * with when the caller is not a super-admin, or `null` when access is granted.
 */
export async function requireSuperAdmin(): Promise<Response | null> {
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
  return null;
}
