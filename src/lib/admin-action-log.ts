/**
 * Record an admin's change in the activity log, from inside any admin route.
 *
 * Many admin and super-admin actions (config, catalog, farms, journal,
 * captains, orders) never wrote to `admin_activity`, so they were missing from
 * System activity and the Audit log, and other admins had no way to see what
 * a super admin had changed. Each of those routes now calls this after a
 * successful change. The actor comes from the signed-in admin session.
 *
 * Best-effort: never throws and never blocks the change it records.
 */
import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { logActivity } from "@/lib/activity-log";

export async function recordAdminAction(
  action: string,
  target?: string | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const session = await verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
    if (!session) return;
    await logActivity({
      actorEmail: session.email,
      actorRole: session.role,
      action,
      target: target ?? null,
      meta: meta ?? null,
    });
  } catch {
    /* Logging must never fail the change itself. */
  }
}
