import { recordAdminAction } from "@/lib/admin-action-log";
import { isSignedInAdmin } from "../guard";
import { TEXT_LIMITS, strictText } from "@/lib/sanitize-text";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listCategories, upsertCategory } from "@/lib/catalog";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { revalidateStorefront } from "@/lib/revalidate-storefront";
import { withLengthValidation } from "@/lib/input-validation-guard";

/** GET — list all categories. */
export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: true, categories: [] });
  const categories = await listCategories();
  revalidateStorefront();
  return Response.json({ ok: true, categories });
}

/**
 * POST — add a category. Any admin with catalog access: adding a category is
 * additive and touches no price or stock, and admins adding products need it.
 * Renaming and deleting stay super-admin only (see [id]/route.ts).
 */
async function POSTHandler(request: Request): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

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
    const category = await upsertCategory({ name, sort, icon, imageUrl });
    revalidateStorefront();
    await recordAdminAction("catalog.category_created", null);
    return Response.json({ ok: true, category });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}


export const POST = withLengthValidation(POSTHandler);
