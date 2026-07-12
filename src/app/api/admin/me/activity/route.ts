/**
 * GET /api/admin/me/activity — the signed-in operator's own recent activity.
 *
 * Returns their last ~8 `admin_activity` rows (matched on `actor_email` = the
 * signed session email), newest first, trimmed to what the profile feed needs.
 * Identity comes from the signed session (see `../guard`), so a caller only
 * ever sees their own trail. Node runtime: it reads via the service-role client.
 */
import { currentAdminSession } from "../guard";
import { listActivityForActor } from "@/lib/activity-log";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  const rows = await listActivityForActor(session.email, 8); // never throws
  const activity = rows.map((e) => ({
    action: e.action,
    target: e.target,
    meta: e.meta,
    createdAt: e.createdAt,
  }));
  return Response.json({ ok: true, activity });
}
