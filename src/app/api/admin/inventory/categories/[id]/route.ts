import { isSignedInAdmin, isSuperAdmin } from "../../guard";
import { TEXT_LIMITS, strictText } from "@/lib/sanitize-text";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { upsertCategory, deleteCategory } from "@/lib/catalog";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { revalidateStorefront } from "@/lib/revalidate-storefront";
import { withLengthValidation } from "@/lib/input-validation-guard";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — rename a category or change its sort order. Super-admin only. */
async function PATCHHandler(request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
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

  const name = strictText(body.name, TEXT_LIMITS.name, "Name");
  if (!name) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const sort = Number.isFinite(Number(body.sort)) ? Number(body.sort) : undefined;
  const icon = typeof body.icon === "string" ? body.icon.trim() || null : undefined;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : undefined;

  try {
    const category = await upsertCategory({ id, name, sort, icon, imageUrl });
    revalidateStorefront();
    return Response.json({ ok: true, category });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE — remove a category (products keep their rows, category goes null). Super-admin only. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;
  await deleteCategory(id);
  revalidateStorefront();
  return Response.json({ ok: true });
}


export const PATCH = withLengthValidation(PATCHHandler);
