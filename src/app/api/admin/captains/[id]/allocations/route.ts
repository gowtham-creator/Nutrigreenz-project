import { requireApiPermission } from "@/lib/admin-api-guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  allocationsForCaptain,
  allocatedVariantIds,
  listPickableVariants,
  setAllocations,
  type AllocationInput,
} from "@/lib/captain-allocations";

export const runtime = "nodejs";

/**
 * GET  /api/admin/captains/[id]/allocations — what this captain may sell.
 * PUT  /api/admin/captains/[id]/allocations — replace that set.
 *
 * The PUT is a full replace, not a merge: the admin UI shows the captain's
 * whole tray, so what it sends is the intended end state. Merging would leave a
 * de-selected product quietly sellable, which is the same class of bug as the
 * hardcoded catalogue this replaces.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await params;
  // The picker needs the full sellable catalogue plus this captain's current
  // selection, so both come back in one round trip.
  const [items, variantIds, variants] = await Promise.all([
    allocationsForCaptain(id),
    allocatedVariantIds(id),
    listPickableVariants(),
  ]);
  return Response.json({ ok: true, items, variantIds, variants });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const raw = (body as { items?: unknown })?.items;
  if (!Array.isArray(raw)) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  /*
   * A price override is accepted only as a positive integer of paise. Anything
   * else becomes null, which falls back to the catalogue price — a malformed
   * override must never become a zero-rupee stall price. A line that does not
   * mention a price at all keeps the override it already has (the picker only
   * toggles products; it used to wipe every override on save).
   */
  const items: AllocationInput[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as { variantId?: unknown; pricePaise?: unknown };
    if (typeof e.variantId !== "string" || !e.variantId) continue;
    const paise = !("pricePaise" in e)
      ? undefined
      : typeof e.pricePaise === "number" && Number.isFinite(e.pricePaise) && e.pricePaise > 0
        ? Math.round(e.pricePaise)
        : null;
    items.push({ variantId: e.variantId, pricePaise: paise });
  }

  const { id } = await params;
  try {
    await setAllocations(id, items);
  } catch {
    return Response.json({ ok: false, error: "save-failed" }, { status: 500 });
  }

  return Response.json({ ok: true, items: await allocationsForCaptain(id) });
}
