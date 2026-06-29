import { isSignedInAdmin } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { updateVariant, deleteVariant } from "@/lib/catalog";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — edit an editable subset of a variant's fields. */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const patch: Parameters<typeof updateVariant>[1] = {};
  if (body.label !== undefined) patch.label = String(body.label);
  if (body.pack !== undefined) patch.pack = body.pack != null && String(body.pack).trim() ? String(body.pack) : null;
  if (body.sizeValue !== undefined)
    patch.sizeValue = body.sizeValue != null && Number.isFinite(Number(body.sizeValue)) ? Number(body.sizeValue) : null;
  if (body.sizeUnit !== undefined) patch.sizeUnit = body.sizeUnit != null ? String(body.sizeUnit) : null;
  if (body.pricePaise !== undefined) patch.pricePaise = Math.max(0, Math.round(Number(body.pricePaise) || 0));
  if (body.sku !== undefined) patch.sku = body.sku != null ? String(body.sku) : null;
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  if (body.sort !== undefined) patch.sort = Math.round(Number(body.sort) || 0);

  try {
    const variant = await updateVariant(id, patch);
    if (!variant) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    return Response.json({ ok: true, variant });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE — remove a variant. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  const { id } = await ctx.params;
  await deleteVariant(id);
  return Response.json({ ok: true });
}
