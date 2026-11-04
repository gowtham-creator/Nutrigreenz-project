/**
 * DELETE /api/admin/orders/bundles/pickups/[id] — remove a run the captain has
 * not started, returning its orders to the bundle. 409 once they have collected.
 */
import { recordAdminAction } from "@/lib/admin-action-log";
import { isSignedInAdmin } from "../../../guard";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { removeCommunityDelivery } from "@/lib/community-delivery";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const { id } = await params;
  try {
    const removed = await removeCommunityDelivery(id);
    if (removed) {
      await recordAdminAction("order.pickup_removed", id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: "already-started" }, { status: 409 });
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
