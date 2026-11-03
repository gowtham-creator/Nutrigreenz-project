import { requireSuperAdmin, superAdminEmail } from "../../guard";
import { logActivity } from "@/lib/activity-log";
import { stopSchedule } from "@/lib/offline-campaigns";

export const runtime = "nodejs";

/** PATCH /api/admin/marketing/offline-campaign/[id] — stop a repeating campaign. */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const stopped = await stopSchedule(id);
    if (!stopped) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "campaign.offline_stop",
      target: id,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
