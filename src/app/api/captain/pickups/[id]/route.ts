import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { advancePickup, requireActiveCaptain } from "@/lib/captains";
import type { CaptainPickupStatus } from "@/types/nutrigreenz";

/**
 * PATCH /api/captain/pickups/[id]  { status }
 *
 * Advance one of the signed-in captain's pickups (due → collected → handed_over).
 * The update is scoped to the caller's own captain id, so a captain can never
 * touch another captain's pickups; an unknown / not-owned id resolves to 404.
 * Only the next step is accepted; a skip or a step back is 409
 * `invalid_transition` (with the current pickup), and re-sending the current
 * status is a harmless 200.
 */
const STATUSES: readonly CaptainPickupStatus[] = ["due", "collected", "handed_over"];

function isStatus(value: unknown): value is CaptainPickupStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/captain/pickups/[id]">,
): Promise<Response> {
  const gate = await requireActiveCaptain();
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
  if (!isStatus(body.status)) {
    return Response.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const result = await advancePickup(id, gate.captainId, body.status);
  if (!result.ok && result.reason === "not-found") {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  if (!result.ok) {
    return Response.json(
      { ok: false, error: "invalid_transition", pickup: result.pickup },
      { status: 409 },
    );
  }
  return Response.json({ ok: true, pickup: result.pickup });
}
