/**
 * Gate + identity for the operator's OWN account API (`/api/admin/me/*`).
 *
 * Reuses the exact cookie + `verifyToken` mechanism every other admin route
 * uses (see `inventory/guard.ts` `isSignedInAdmin`), but returns the decoded
 * session so the `me` routes can BOTH gate access AND attribute the change to
 * the caller. Identity is resolved server-side from the signed httpOnly
 * `ng_admin` token — never from a client-supplied id/email — so an operator can
 * only ever read or edit their own profile.
 *
 * Any signed-in admin OR super-admin may use these endpoints: `/admin/profile`
 * is not super-admin-only.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken, type AdminSession } from "@/lib/admin-session";

/** The current signed-in admin session `{ email, role }`, or null when absent. */
export async function currentAdminSession(): Promise<AdminSession | null> {
  const c = await cookies();
  return verifyToken(c.get(ADMIN_COOKIE)?.value);
}
