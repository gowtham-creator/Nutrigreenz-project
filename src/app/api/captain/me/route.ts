import { requireCaptain } from "@/lib/captain-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCaptainById, toCaptainMe } from "@/lib/captains";

/**
 * GET /api/captain/me — the signed-in captain's identity for the field tool
 * (id, name, derived initials, area, stall, assigned communities, commission %).
 * 401 when there is no valid `ng_captain` session. If the captain row vanished
 * or was deactivated since sign-in, the session is treated as invalid (401).
 */
export async function GET(): Promise<Response> {
  const gate = await requireCaptain();
  if (gate instanceof Response) return gate;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const captain = await getCaptainById(gate.captainId);
  if (!captain || !captain.active) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  return Response.json({ ok: true, captain: toCaptainMe(captain) });
}
