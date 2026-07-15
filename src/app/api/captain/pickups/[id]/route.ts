import { requireCaptain } from "@/lib/captain-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { advancePickup } from "@/lib/captains";
import type { CaptainPickupStatus } from "@/types/nutrigreenz";

/**
 * PATCH /api/captain/pickups/[id]  { status }
 *
 * Advance one of the signed-in captain's pickups (due → collected → handed_over).
 * The update is scoped to the caller's own captain id, so a captain can never
 * touch another captain's pickups; an unknown / not-owned id resolves to 404.
 */
const STATUSES: readonly CaptainPickupStatus[] = ["due", "collected", "handed_over"];

function isStatus(value: unknown): value is CaptainPickupStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/captain/pickups/[id]">,
): Promise<Response> {
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
  if (!isStatus(body.status)) {
    return Response.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const pickup = await advancePickup(id, gate.captainId, body.status);
  if (!pickup) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  return Response.json({ ok: true, pickup });
}
