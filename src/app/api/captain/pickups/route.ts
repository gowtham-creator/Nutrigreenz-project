import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listPickupsForCaptain, requireActiveCaptain } from "@/lib/captains";

/**
 * GET /api/captain/pickups — the signed-in captain's community pickups (due
 * first). Advancing a pickup is `PATCH /api/captain/pickups/[id]`. Degrades to
 * an empty list when the DB is unconfigured so the UI shows its empty state.
 */
export async function GET(): Promise<Response> {
  const gate = await requireActiveCaptain();
  if (gate instanceof Response) return gate;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, pickups: [] });
  }
  const pickups = await listPickupsForCaptain(gate.captainId);
  return Response.json({ ok: true, pickups });
}
