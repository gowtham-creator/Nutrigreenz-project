import { isSignedInAdmin, isSuperAdmin, bodyHasPrice } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getProduct, updateProduct, deleteProduct, type ProductStatus } from "@/lib/catalog";
import { requireApiPermission } from "@/lib/admin-api-guard";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES: readonly ProductStatus[] = ["active", "draft", "archived"];

function asStatus(raw: unknown): ProductStatus | undefined {
  const v = String(raw ?? "").trim().toLowerCase();
  return (STATUSES as readonly string[]).includes(v) ? (v as ProductStatus) : undefined;
}

/** GET — a single product. */
export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  const { id } = await ctx.params;
  const product = await getProduct(id);
  if (!product) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  return Response.json({ ok: true, product });
}

/** PATCH — edit an editable subset of product fields. */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Changing a price is super-admin-only. A plain admin may still edit every
  // other field, but a PATCH that carries a price is rejected outright.
  if (bodyHasPrice(body) && !(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }

  const patch: Parameters<typeof updateProduct>[1] = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.slug !== undefined) patch.slug = String(body.slug);
  if (body.categoryId !== undefined) patch.categoryId = body.categoryId ? String(body.categoryId) : null;
  if (body.description !== undefined) patch.description = body.description != null ? String(body.description) : null;
  if (body.pricePaise !== undefined) patch.pricePaise = Math.max(0, Math.round(Number(body.pricePaise) || 0));
  if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl != null ? String(body.imageUrl) : null;
  if (body.gallery !== undefined) patch.gallery = Array.isArray(body.gallery) ? body.gallery.map(String) : [];
  if (body.sku !== undefined) patch.sku = body.sku != null ? String(body.sku) : null;
  if (body.status !== undefined) {
    const status = asStatus(body.status);
    if (status) patch.status = status;
  }

  try {
    const product = await updateProduct(id, patch);
    if (!product) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    return Response.json({ ok: true, product });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE — remove a product (its inventory row cascades). Super-admin only. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  const { id } = await ctx.params;
  await deleteProduct(id);
  return Response.json({ ok: true });
}
