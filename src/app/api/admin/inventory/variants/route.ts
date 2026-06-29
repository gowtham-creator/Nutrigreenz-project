import { isSignedInAdmin, isSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listVariants, createVariant } from "@/lib/catalog";

/** GET — list a product's variants (`?productId=`). */
export async function GET(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: true, variants: [] });

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim();
  if (!productId) return Response.json({ ok: false, error: "missing-product" }, { status: 400 });

  const variants = await listVariants(productId);
  return Response.json({ ok: true, variants });
}

/** POST — create a variant for a product. */
export async function POST(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const productId = String(body.productId ?? "").trim();
  const label = String(body.label ?? "").trim();
  if (!productId || !label) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  // Price is a super-admin-only field. A plain admin may create a variant, but
  // any price they supply is ignored and defaults to 0 (set later by a super-admin).
  const pricePaise = (await isSuperAdmin())
    ? Math.max(0, Math.round(Number(body.pricePaise) || 0))
    : 0;

  try {
    const variant = await createVariant({
      productId,
      label,
      pack: body.pack != null && String(body.pack).trim() ? String(body.pack).trim() : null,
      sizeValue:
        body.sizeValue != null && Number.isFinite(Number(body.sizeValue))
          ? Number(body.sizeValue)
          : null,
      sizeUnit: body.sizeUnit != null && String(body.sizeUnit).trim() ? String(body.sizeUnit) : null,
      pricePaise,
      sku: body.sku != null ? String(body.sku) : null,
      stock: Math.max(0, Math.round(Number(body.stock) || 0)),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      sort: Math.round(Number(body.sort) || 0),
    });
    return Response.json({ ok: true, variant });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
