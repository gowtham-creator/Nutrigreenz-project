import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken, type AdminSession } from "@/lib/admin-session";
import { listActivity, listActivityForActor, type ActivityEntry } from "@/lib/activity-log";

export const runtime = "nodejs";

/** The current signed-in admin session `{ email, role }`, or null when absent. */
async function currentSession(): Promise<AdminSession | null> {
  const c = await cookies();
  return verifyToken(c.get(ADMIN_COOKIE)?.value);
}

/** Truthy query flags: `?mine=1`, `?mine=true`, `?mine=yes`. */
function isTruthy(v: string | null): boolean {
  return v !== null && ["1", "true", "yes"].includes(v.toLowerCase());
}

const DEFAULT_LIMIT = 100;

/**
 * GET /api/admin/activity
 *
 * The admin-activity trail, newest first. Powers the Audit Log page (both
 * Admin and Super Admin) and the Super Admin's Roles & activity view. **Any**
 * signed-in admin OR super-admin may read it — operators scan both their own
 * and the team's completed operations. Lives under `/api/...` so the
 * `/admin/:path*` proxy matcher does not block it; identity comes from the
 * signed httpOnly session token (never a client-supplied value).
 *
 * Query params (all optional):
 *   - `limit`  — max rows to return (default 100; the data layer caps it).
 *   - `mine`   — "1"/"true"/"yes" ⇒ only the caller's own actions.
 *   - `action` — exact action code (e.g. "announcement.create") for
 *                deep-linked / programmatic filtering. The Audit page groups
 *                actions client-side for instant filtering and so doesn't send
 *                this, but the param is honoured for API consumers.
 *
 * Returns `{ ok, activity, viewer: { email, role } }`; `viewer` lets the UI
 * phrase the caller's own rows as "You" without a second identity round-trip.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const limitRaw = Number(params.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : DEFAULT_LIMIT;
  const mine = isTruthy(params.get("mine"));
  const action = params.get("action")?.trim() || null;

  let activity: ActivityEntry[] = mine
    ? await listActivityForActor(session.email, limit)
    : await listActivity(limit);
  if (action) activity = activity.filter((entry) => entry.action === action);

  return Response.json({
    ok: true,
    activity,
    viewer: { email: session.email, role: session.role },
  });
}
