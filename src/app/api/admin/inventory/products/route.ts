import { isSignedInAdmin, isSuperAdmin } from "../guard";
import { TEXT_LIMITS, strictMultiline, strictText } from "@/lib/sanitize-text";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  listProducts,
  createProduct,
  listVariantsForProducts,
  type ProductStatus,
  type ProductFilter,
} from "@/lib/catalog";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { revalidateStorefront } from "@/lib/revalidate-storefront";
import { withLengthValidation } from "@/lib/input-validation-guard";

const STATUSES: readonly ProductStatus[] = ["active", "draft", "archived"];

function asStatus(raw: unknown): ProductStatus | undefined {
  const v = String(raw ?? "").trim().toLowerCase();
  return (STATUSES as readonly string[]).includes(v) ? (v as ProductStatus) : undefined;
}

/** GET — list products with search / category / status filters and pagination. */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    revalidateStorefront();
    return Response.json({ ok: true, products: [], total: 0, page: 1, pageSize: 50 });
  }

  const url = new URL(request.url);
  const filter: ProductFilter = {
    search: url.searchParams.get("search")?.trim() || undefined,
    categoryId: url.searchParams.get("categoryId")?.trim() || undefined,
    status: asStatus(url.searchParams.get("status")),
    page: Number(url.searchParams.get("page")) || 1,
    pageSize: Number(url.searchParams.get("pageSize")) || 50,
  };

  const result = await listProducts(filter);

  // Price + stock live on the VARIANTS for variant-backed products, so the base
  // product row reads ₹0 / 0 units. Roll the variants up here so the admin table
  // shows real figures (from-price + total stock) instead of an empty row.
  const variantsByProduct = await listVariantsForProducts(result.products.map((p) => p.id));
  const products = result.products.map((p) => {
    const variants = variantsByProduct.get(p.id) ?? [];
    const active = variants.filter((v) => v.isActive);
    const used = active.length ? active : variants;
    if (used.length === 0) return p;
    let min = used[0].pricePaise;
    let max = used[0].pricePaise;
    let stock = 0;
    for (const v of used) {
      if (v.pricePaise < min) min = v.pricePaise;
      if (v.pricePaise > max) max = v.pricePaise;
      stock += v.stock;
    }
    return {
      ...p,
      variantCount: used.length,
      variantMinPricePaise: min,
      variantMaxPricePaise: max,
      variantStock: stock,
    };
  });

  revalidateStorefront();

  return Response.json({ ok: true, ...result, products });
}

/** POST — create a product (with its inventory row). */
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

  // Price is a super-admin-only field. A plain admin may create a product, but
  // any price they supply is ignored and defaults to 0 (set later by a super-admin).
  const pricePaise = (await isSuperAdmin())
    ? Math.max(0, Math.round(Number(body.pricePaise) || 0))
    : 0;
  const stock = Math.max(0, Math.round(Number(body.stock) || 0));

  try {
    const product = await createProduct({
      name,
      slug: strictText(body.slug, TEXT_LIMITS.slug, "Slug") || undefined,
      categoryId: body.categoryId ? String(body.categoryId) : null,
      description: body.description != null ? strictMultiline(body.description, TEXT_LIMITS.description, "Description") : null,
      pricePaise,
      imageUrl: body.imageUrl != null ? String(body.imageUrl) : null,
      gallery: Array.isArray(body.gallery) ? body.gallery.map(String) : undefined,
      sku: body.sku != null ? strictText(body.sku, TEXT_LIMITS.sku, "Sku") : null,
      status: asStatus(body.status) ?? "active",
      stock,
    });
    revalidateStorefront();
    return Response.json({ ok: true, product });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}


export const POST = withLengthValidation(POSTHandler);
