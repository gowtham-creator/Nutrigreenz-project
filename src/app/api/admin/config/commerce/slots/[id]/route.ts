import { requireSuperAdmin } from "../../../guard";
import { TEXT_LIMITS, plainText } from "@/lib/sanitize-text";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { updateSlot, deleteSlot, type SlotUpdateInput } from "@/lib/commerce-rules";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — edit a delivery slot (label / window / sort / active). Super-admin only. */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const input: SlotUpdateInput = {};
  if (body.label !== undefined) {
    const label = plainText(body.label, TEXT_LIMITS.label);
    if (!label) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    input.label = label;
  }
  if (body.windowText !== undefined) input.windowText = String(body.windowText);
  if (body.sort !== undefined && Number.isFinite(Number(body.sort))) input.sort = Number(body.sort);
  if (typeof body.active === "boolean") input.active = body.active;

  try {
    const slot = await updateSlot(id, input);
    if (!slot) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    return Response.json({ ok: true, slot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE — remove a delivery slot. Super-admin only. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;
  await deleteSlot(id);
  return Response.json({ ok: true });
}
