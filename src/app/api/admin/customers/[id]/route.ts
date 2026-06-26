import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomer } from "@/lib/admin-customers";

/**
 * GET /api/admin/customers/[id] — detail for one canonical customer.
 *
 * Admin/superadmin-gated (same cookie + `verifyToken` pattern as the list
 * route). Returns the canonical customer plus its provider identities, saved
 * addresses and linked live `users` rows. A tombstone (merged duplicate) or an
 * unknown id resolves to 404.
 */

/** True when a valid signed-in admin/superadmin session is present. */
async function isSignedInAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return Boolean(session);
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/customers/[id]">,
): Promise<Response> {
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const detail = await getCustomer(id);
  if (!detail) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  return Response.json({ ok: true, ...detail });
}
