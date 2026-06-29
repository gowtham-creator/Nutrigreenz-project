import { isSignedInAdmin, isSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listProducts, createProduct, type ProductStatus, type ProductFilter } from "@/lib/catalog";

const STATUSES: readonly ProductStatus[] = ["active", "draft", "archived"];

function asStatus(raw: unknown): ProductStatus | undefined {
  const v = String(raw ?? "").trim().toLowerCase();
  return (STATUSES as readonly string[]).includes(v) ? (v as ProductStatus) : undefined;
}

/** GET — list products with search / category / status filters and pagination. */
export async function GET(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
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
  return Response.json({ ok: true, ...result });
}

/** POST — create a product (with its inventory row). */
export async function POST(request: Request): Promise<Response> {
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

  const name = String(body.name ?? "").trim();
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
      slug: String(body.slug ?? "").trim() || undefined,
      categoryId: body.categoryId ? String(body.categoryId) : null,
      description: body.description != null ? String(body.description) : null,
      pricePaise,
      imageUrl: body.imageUrl != null ? String(body.imageUrl) : null,
      sku: body.sku != null ? String(body.sku) : null,
      status: asStatus(body.status) ?? "active",
      stock,
    });
    return Response.json({ ok: true, product });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
