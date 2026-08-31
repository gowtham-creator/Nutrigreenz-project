import { requireSuperAdmin } from "../../../guard";
import { TEXT_LIMITS, plainText } from "@/lib/sanitize-text";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { upsertArea, deleteArea, type AreaInput } from "@/lib/commerce-rules";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — edit a serviceable area (pincode / area / community / active). Super-admin only. */
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

  // Pincode is required by the underlying upsert; default to the existing value
  // is not needed because callers always send the full row from the editor.
  const pincode = String(body.pincode ?? "").trim();
  if (!pincode) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  const input: AreaInput = { id, pincode };
  if (body.area !== undefined) input.area = plainText(body.area, TEXT_LIMITS.area);
  if (body.community !== undefined) input.community = String(body.community);
  if (typeof body.active === "boolean") input.active = body.active;

  try {
    const area = await upsertArea(input);
    return Response.json({ ok: true, area });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE — remove a serviceable area. Super-admin only. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;
  await deleteArea(id);
  return Response.json({ ok: true });
}
