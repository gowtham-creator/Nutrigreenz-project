import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { listActivity } from "@/lib/activity-log";

/** Only a signed-in super-admin may read the system activity trail. */
async function isSuperAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return Boolean(session && session.role === "superadmin");
}

/**
 * GET /api/admin/activity
 *
 * Recent system-activity events (sign-ins + admin-user mutations) for the
 * Super Admin's Roles & activity view. Lives under `/api/...` so the
 * `/admin/:path*` proxy matcher does not block it; gated to super-admins via
 * the signed session token (same check the admins routes use).
 */
export async function GET(): Promise<Response> {
  if (!(await isSuperAdmin())) return Response.json({ ok: false }, { status: 401 });
  const activity = await listActivity(50);
  return Response.json({ ok: true, activity });
}
