import { requireCaptain } from "@/lib/captain-session";
import { allocationsForCaptain } from "@/lib/captain-allocations";

// supabase-admin + the signed session need the Node runtime.
export const runtime = "nodejs";
// Stock changes; a captain must never be shown a stale tray.
export const dynamic = "force-dynamic";

/**
 * GET /api/captain/catalogue — what this captain may sell today.
 *
 * Scoped strictly to the captain resolved from their own signed session, so one
 * captain cannot read or sell another's allocation.
 *
 * Returns an empty list rather than any fallback when nothing is allocated.
 * That is the point of the change: the app previously shipped a hardcoded list
 * whose SKUs matched no real product, so captains were taking cash for lines
 * the business could not reconcile. An empty tray is a prompt to an operator;
 * an invented one is bad revenue data.
 */
export async function GET(): Promise<Response> {
  const gate = await requireCaptain();
  if (gate instanceof Response) return gate;

  const items = await allocationsForCaptain(gate.captainId);
  return Response.json(
    { ok: true, items },
    { headers: { "cache-control": "no-store" } },
  );
}
