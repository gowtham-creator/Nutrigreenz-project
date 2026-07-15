import { requireCaptain } from "@/lib/captain-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { upsertSettlement } from "@/lib/captains";

/**
 * POST /api/captain/settlements  { cashCounted }
 *
 * The signed-in captain's end-of-day cash-up. `cashCounted` is the RUPEE amount
 * of physical cash the captain counted; it is converted to paise here. The
 * server recomputes expected GMV / cash / UPI from TODAY's captures, so the
 * variance and commission cannot be gamed from the client. One row per captain
 * per day — a re-submit overwrites. The response is all integer paise.
 */
export async function POST(request: Request): Promise<Response> {
  const gate = await requireCaptain();
  if (gate instanceof Response) return gate;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const cashCounted = Number(body.cashCounted);
  if (!Number.isFinite(cashCounted) || cashCounted < 0) {
    return Response.json({ ok: false, error: "invalid_cash_counted" }, { status: 400 });
  }

  const settlement = await upsertSettlement(gate.captainId, Math.round(cashCounted * 100));
  return Response.json({ ok: true, settlement });
}
