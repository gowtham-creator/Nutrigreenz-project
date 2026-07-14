/**
 * Admin gate for the media-list API — any signed-in admin/superadmin may browse
 * previously-uploaded images to reuse in the Journal / Farms image pickers.
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
