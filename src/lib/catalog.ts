/**
 * DB-backed catalog & inventory (Supabase `public.categories`, `public.products`,
 * `public.inventory`). Powers the admin Inventory Portal. Service-role only —
 * import from Node route handlers, never client/Edge.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toCsv } from "@/lib/csv";

export type ProductStatus = "active" | "draft" | "archived";

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  sort: number;
  /** Admin-picked Solar icon name for the category pill (fallback when no image). */
  icon: string | null;
  /** Admin-uploaded category image URL (preferred over the icon on the storefront). */
  imageUrl: string | null;
  createdAt: string;
}

export interface ProductRecord {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  slug: string;
  description: string | null;
  pricePaise: number;
  imageUrl: string | null;
  /**
   * Additional photos, in the operator's order. `imageUrl` stays the single
   * lead shot used by the grid, cart, emails and invoices; these are the extra
   * frames the PDP shows after it. Empty when none have been uploaded.
   */
  gallery: string[];
  sku: string | null;
  status: ProductStatus;
  stock: number;
  reserved: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sort: number;
  icon: string | null;
  image_url: string | null;
  created_at: string;
}

interface InventoryRow {
  stock: number;
  reserved: number;
}

interface ProductRow {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price_paise: number;
  image_url: string | null;
  gallery: string[] | null;
  sku: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  // Supabase types embedded one-to-* relations as arrays; tolerate both shapes.
  categories: { name: string } | { name: string }[] | null;
  inventory: InventoryRow | InventoryRow[] | null;
}

/** Unwrap a Supabase embedded relation that may be returned as an array. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const PRODUCT_COLS =
  "id, category_id, name, slug, description, price_paise, image_url, gallery, sku, status, created_at, updated_at, categories(name), inventory(stock, reserved)";

const VALID_STATUS: readonly ProductStatus[] = ["active", "draft", "archived"];

/** Turn an arbitrary string into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseStatus(raw: string | null | undefined): ProductStatus {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "draft") return "draft";
  if (v === "archived" || v === "inactive") return "archived";
  if (v === "out of stock" || v === "published" || v === "live" || v === "active" || v === "")
    return "active";
  return "active";
}

function toCategory(r: CategoryRow): CategoryRecord {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    sort: r.sort,
    icon: r.icon ?? null,
    imageUrl: r.image_url ?? null,
    createdAt: r.created_at,
  };
}

/** Column list for category reads (kept in one place so every query matches). */
const CATEGORY_COLS = "id, name, slug, sort, icon, image_url, created_at";

function toProduct(r: ProductRow): ProductRecord {
  const category = firstOf(r.categories);
  const inventory = firstOf(r.inventory);
  return {
    id: r.id,
    categoryId: r.category_id,
    categoryName: category?.name ?? null,
    name: r.name,
    slug: r.slug,
    description: r.description,
    pricePaise: r.price_paise,
    imageUrl: r.image_url,
    gallery: (r.gallery ?? []).filter((u): u is string => typeof u === "string" && u.trim().length > 0),
    sku: r.sku,
    status: VALID_STATUS.includes(r.status) ? r.status : "active",
    stock: inventory?.stock ?? 0,
    reserved: inventory?.reserved ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* ── categories ───────────────────────────────────────────────────────── */

/** All categories, ordered by sort then name. */
export async function listCategories(): Promise<CategoryRecord[]> {
  const { data } = await supabaseAdmin()
    .from("categories")
    .select(CATEGORY_COLS)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  return ((data as CategoryRow[] | null) ?? []).map(toCategory);
}

export interface CategoryInput {
  id?: string;
  name: string;
  slug?: string;
  sort?: number;
  icon?: string | null;
  imageUrl?: string | null;
}

/**
 * Insert or update a category. When `id` is present the row is updated;
 * otherwise it's inserted (with a generated slug when none is supplied).
 */
export async function upsertCategory(input: CategoryInput): Promise<CategoryRecord> {
  const db = supabaseAdmin();
  const name = input.name.trim();
  const slug = (input.slug?.trim() || slugify(name)) || slugify(name);

  if (input.id) {
    const patch: Record<string, string | number | null> = { name, slug };
    if (input.sort !== undefined) patch.sort = input.sort;
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
    const { data, error } = await db
      .from("categories")
      .update(patch)
      .eq("id", input.id)
      .select(CATEGORY_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to update category.");
    return toCategory(data as CategoryRow);
  }

  const { data, error } = await db
    .from("categories")
    .insert({
      name,
      slug,
      sort: input.sort ?? 0,
      icon: input.icon ?? null,
      image_url: input.imageUrl ?? null,
    })
    .select(CATEGORY_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create category.");
  return toCategory(data as CategoryRow);
}

export async function deleteCategory(id: string): Promise<void> {
  await supabaseAdmin().from("categories").delete().eq("id", id);
}

/* ── products ─────────────────────────────────────────────────────────── */

export interface ProductFilter {
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  page?: number;
  pageSize?: number;
}

export interface ProductList {
  products: ProductRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 50;

/** Paginated, filterable product list with joined category + inventory. */
export async function listProducts(filter: ProductFilter = {}): Promise<ProductList> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin()
    .from("products")
    .select(PRODUCT_COLS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.search) {
    const term = filter.search.trim().replace(/[%,]/g, "");
    if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, count } = await query;
  return {
    products: ((data as ProductRow[] | null) ?? []).map(toProduct),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** A single product by id (with category + inventory), or null. */
export async function getProduct(id: string): Promise<ProductRecord | null> {
  const { data } = await supabaseAdmin()
    .from("products")
    .select(PRODUCT_COLS)
    .eq("id", id)
    .maybeSingle();
  return data ? toProduct(data as ProductRow) : null;
}

/** A single product by its URL slug (with category + inventory), or null. */
export async function getProductBySlug(slug: string): Promise<ProductRecord | null> {
  const { data } = await supabaseAdmin()
    .from("products")
    .select(PRODUCT_COLS)
    .eq("slug", slug)
    .maybeSingle();
  return data ? toProduct(data as ProductRow) : null;
}

export interface NewProductInput {
  name: string;
  slug?: string;
  categoryId?: string | null;
  description?: string | null;
  pricePaise: number;
  imageUrl?: string | null;
  /** Extra photos beyond the lead shot, in display order. */
  gallery?: readonly string[];
  sku?: string | null;
  status?: ProductStatus;
  stock?: number;
  reserved?: number;
}

/**
 * Normalise a gallery before it is written: trim, drop blanks, and de-duplicate
 * while keeping the operator's order. The same URL twice would render as two
 * identical thumbnails that look like a bug.
 */
function cleanGallery(urls: readonly string[] | undefined): string[] {
  if (!urls) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Create a product and its inventory row, returning the joined record. */
export async function createProduct(input: NewProductInput): Promise<ProductRecord> {
  const db = supabaseAdmin();
  const name = input.name.trim();
  const slug = (input.slug?.trim() || slugify(name)) || slugify(name);
  const { data, error } = await db
    .from("products")
    .insert({
      name,
      slug,
      category_id: input.categoryId ?? null,
      description: input.description?.trim() || null,
      price_paise: Math.max(0, Math.round(input.pricePaise)),
      image_url: input.imageUrl?.trim() || null,
      gallery: cleanGallery(input.gallery),
      sku: input.sku?.trim() || null,
      status: input.status ?? "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create product.");
  const id = (data as { id: string }).id;

  await db.from("inventory").insert({
    product_id: id,
    stock: Math.max(0, Math.round(input.stock ?? 0)),
    reserved: Math.max(0, Math.round(input.reserved ?? 0)),
  });

  const created = await getProduct(id);
  if (!created) throw new Error("Failed to load created product.");
  return created;
}

export interface ProductUpdateInput {
  name?: string;
  slug?: string;
  categoryId?: string | null;
  description?: string | null;
  pricePaise?: number;
  imageUrl?: string | null;
  /** Extra photos beyond the lead shot, in display order. */
  gallery?: readonly string[];
  sku?: string | null;
  status?: ProductStatus;
}

/** Apply an editable subset of fields to a product and return the fresh record. */
export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<ProductRecord | null> {
  const patch: Record<string, string | number | string[] | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim() || slugify(input.name ?? "");
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.pricePaise !== undefined) patch.price_paise = Math.max(0, Math.round(input.pricePaise));
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl?.trim() || null;
  if (input.gallery !== undefined) patch.gallery = cleanGallery(input.gallery);
  if (input.sku !== undefined) patch.sku = input.sku?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return getProduct(id);

  const { error } = await supabaseAdmin().from("products").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return getProduct(id);
}

/** Delete a product; its inventory row cascades away. */
export async function deleteProduct(id: string): Promise<void> {
  await supabaseAdmin().from("products").delete().eq("id", id);
}

/* ── inventory ────────────────────────────────────────────────────────── */

/** Set absolute stock (and optionally reserved) for a product. Upserts the row. */
export async function setStock(
  productId: string,
  stock: number,
  reserved?: number,
): Promise<ProductRecord | null> {
  const row: { product_id: string; stock: number; reserved?: number } = {
    product_id: productId,
    stock: Math.max(0, Math.round(stock)),
  };
  if (reserved !== undefined) row.reserved = Math.max(0, Math.round(reserved));
  const { error } = await supabaseAdmin()
    .from("inventory")
    .upsert(row, { onConflict: "product_id" });
  if (error) throw new Error(error.message);
  return getProduct(productId);
}

/** Adjust stock by a signed delta (clamped at zero). Upserts when missing. */
export async function adjustStock(productId: string, delta: number): Promise<ProductRecord | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("inventory")
    .select("stock")
    .eq("product_id", productId)
    .maybeSingle();
  const current = (data as { stock: number } | null)?.stock ?? 0;
  const next = Math.max(0, Math.round(current + delta));
  const { error } = await db
    .from("inventory")
    .upsert({ product_id: productId, stock: next }, { onConflict: "product_id" });
  if (error) throw new Error(error.message);
  return getProduct(productId);
}

/* ── variants (size × pack) ───────────────────────────────────────────── */

export interface ProductVariantRecord {
  id: string;
  productId: string;
  label: string;
  pack: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  pricePaise: number;
  sku: string | null;
  stock: number;
  reserved: number;
  isActive: boolean;
  sort: number;
  /** Optional per-variant image URL; NULL falls back to the product image. */
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VariantRow {
  id: string;
  product_id: string;
  label: string;
  pack: string | null;
  size_value: number | string | null;
  size_unit: string | null;
  price_paise: number;
  sku: string | null;
  stock: number;
  reserved: number;
  is_active: boolean;
  sort: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

const VARIANT_COLS =
  "id, product_id, label, pack, size_value, size_unit, price_paise, sku, stock, reserved, is_active, sort, image_url, created_at, updated_at";

function toVariant(r: VariantRow): ProductVariantRecord {
  return {
    id: r.id,
    productId: r.product_id,
    label: r.label,
    pack: r.pack,
    sizeValue: r.size_value === null ? null : Number(r.size_value),
    sizeUnit: r.size_unit,
    pricePaise: r.price_paise,
    sku: r.sku,
    stock: r.stock,
    reserved: r.reserved,
    isActive: r.is_active,
    sort: r.sort,
    imageUrl: r.image_url ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** All variants for a single product, ordered by sort then label. */
export async function listVariants(productId: string): Promise<ProductVariantRecord[]> {
  const { data } = await supabaseAdmin()
    .from("product_variants")
    .select(VARIANT_COLS)
    .eq("product_id", productId)
    .order("sort", { ascending: true })
    .order("label", { ascending: true });
  return ((data as VariantRow[] | null) ?? []).map(toVariant);
}

/** Variants for many products at once, grouped by product id (batch listing read). */
export async function listVariantsForProducts(
  productIds: readonly string[],
): Promise<Map<string, ProductVariantRecord[]>> {
  const grouped = new Map<string, ProductVariantRecord[]>();
  if (productIds.length === 0) return grouped;
  const { data } = await supabaseAdmin()
    .from("product_variants")
    .select(VARIANT_COLS)
    .in("product_id", productIds as string[])
    .order("sort", { ascending: true })
    .order("label", { ascending: true });
  for (const row of (data as VariantRow[] | null) ?? []) {
    const v = toVariant(row);
    const list = grouped.get(v.productId);
    if (list) list.push(v);
    else grouped.set(v.productId, [v]);
  }
  return grouped;
}

export interface VariantStats {
  /** Minimum price (paise) across ACTIVE variants, or null when there are none. */
  minActivePricePaise: number | null;
  /** True when any active variant has a sellable unit (stock − reserved > 0). */
  inStock: boolean;
  /** Number of active variants. */
  activeCount: number;
}

/** Derive listing-level price/stock signals from a product's variants. */
export function variantStats(variants: readonly ProductVariantRecord[]): VariantStats {
  let min: number | null = null;
  let inStock = false;
  let activeCount = 0;
  for (const v of variants) {
    if (!v.isActive) continue;
    activeCount += 1;
    if (min === null || v.pricePaise < min) min = v.pricePaise;
    if (v.stock - v.reserved > 0) inStock = true;
  }
  return { minActivePricePaise: min, inStock, activeCount };
}

export interface NewVariantInput {
  productId: string;
  label: string;
  pack?: string | null;
  sizeValue?: number | null;
  sizeUnit?: string | null;
  pricePaise?: number;
  sku?: string | null;
  stock?: number;
  reserved?: number;
  isActive?: boolean;
  sort?: number;
  imageUrl?: string | null;
}

/** Create a variant for a product and return the fresh record. */
export async function createVariant(input: NewVariantInput): Promise<ProductVariantRecord> {
  const { data, error } = await supabaseAdmin()
    .from("product_variants")
    .insert({
      product_id: input.productId,
      label: input.label.trim(),
      pack: input.pack?.trim() || null,
      size_value: input.sizeValue ?? null,
      size_unit: input.sizeUnit?.trim() || null,
      price_paise: Math.max(0, Math.round(input.pricePaise ?? 0)),
      sku: input.sku?.trim() || null,
      stock: Math.max(0, Math.round(input.stock ?? 0)),
      reserved: Math.max(0, Math.round(input.reserved ?? 0)),
      is_active: input.isActive ?? true,
      sort: Math.round(input.sort ?? 0),
      image_url: input.imageUrl?.trim() || null,
    })
    .select(VARIANT_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create variant.");
  return toVariant(data as VariantRow);
}

export interface VariantUpdateInput {
  label?: string;
  pack?: string | null;
  sizeValue?: number | null;
  sizeUnit?: string | null;
  pricePaise?: number;
  sku?: string | null;
  isActive?: boolean;
  sort?: number;
  imageUrl?: string | null;
}

/** Apply an editable subset of fields to a variant and return the fresh record. */
export async function updateVariant(
  id: string,
  input: VariantUpdateInput,
): Promise<ProductVariantRecord | null> {
  const db = supabaseAdmin();
  const patch: Record<string, string | number | boolean | null> = {};
  if (input.label !== undefined) patch.label = input.label.trim();
  if (input.pack !== undefined) patch.pack = input.pack?.trim() || null;
  if (input.sizeValue !== undefined) patch.size_value = input.sizeValue;
  if (input.sizeUnit !== undefined) patch.size_unit = input.sizeUnit?.trim() || null;
  if (input.pricePaise !== undefined) patch.price_paise = Math.max(0, Math.round(input.pricePaise));
  if (input.sku !== undefined) patch.sku = input.sku?.trim() || null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.sort !== undefined) patch.sort = Math.round(input.sort);
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl?.trim() || null;
  if (Object.keys(patch).length === 0) {
    const { data } = await db.from("product_variants").select(VARIANT_COLS).eq("id", id).maybeSingle();
    return data ? toVariant(data as VariantRow) : null;
  }
  const { data, error } = await db
    .from("product_variants")
    .update(patch)
    .eq("id", id)
    .select(VARIANT_COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toVariant(data as VariantRow) : null;
}

/** Set absolute stock (and optionally reserved) for a variant. */
export async function setVariantStock(
  id: string,
  stock: number,
  reserved?: number,
): Promise<ProductVariantRecord | null> {
  const patch: Record<string, number> = { stock: Math.max(0, Math.round(stock)) };
  if (reserved !== undefined) patch.reserved = Math.max(0, Math.round(reserved));
  const { data, error } = await supabaseAdmin()
    .from("product_variants")
    .update(patch)
    .eq("id", id)
    .select(VARIANT_COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toVariant(data as VariantRow) : null;
}

/** Delete a variant. */
export async function deleteVariant(id: string): Promise<void> {
  await supabaseAdmin().from("product_variants").delete().eq("id", id);
}

/* ── CSV import / export ──────────────────────────────────────────────── */

export interface ProductCsvRow {
  name: string;
  sku?: string;
  category?: string;
  pricePaise?: number;
  stock?: number;
  status?: string;
  description?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/** Map a category name to an existing id, creating the category when needed. */
async function resolveCategoryId(
  name: string | undefined,
  cache: Map<string, string>,
): Promise<string | null> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const category = await upsertCategory({ name: trimmed });
  cache.set(key, category.id);
  return category.id;
}

/**
 * Import product rows. Existing products (matched by SKU, then slug) are
 * updated; new ones are created. Per-row failures are collected, not thrown.
 */
export async function importProductsCsv(rows: readonly ProductCsvRow[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const db = supabaseAdmin();
  const categoryCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 1;
    const name = row.name?.trim();
    if (!name) {
      result.skipped++;
      result.errors.push(`Row ${lineNo}: missing product name, skipped.`);
      continue;
    }

    try {
      const categoryId = await resolveCategoryId(row.category, categoryCache);
      const status = normaliseStatus(row.status);
      const pricePaise = Math.max(0, Math.round(row.pricePaise ?? 0));
      const stock = Math.max(0, Math.round(row.stock ?? 0));
      const sku = row.sku?.trim() || null;
      const slug = slugify(name);

      let existing: { id: string } | null = null;
      if (sku) {
        const { data } = await db.from("products").select("id").eq("sku", sku).maybeSingle();
        existing = (data as { id: string } | null) ?? null;
      }
      if (!existing) {
        const { data } = await db.from("products").select("id").eq("slug", slug).maybeSingle();
        existing = (data as { id: string } | null) ?? null;
      }

      if (existing) {
        await updateProduct(existing.id, {
          name,
          categoryId,
          description: row.description ?? undefined,
          pricePaise,
          sku: sku ?? undefined,
          status,
        });
        await setStock(existing.id, stock);
        result.updated++;
      } else {
        await createProduct({
          name,
          slug,
          categoryId,
          description: row.description ?? null,
          pricePaise,
          sku,
          status,
          stock,
        });
        result.created++;
      }
    } catch (err) {
      result.skipped++;
      const message = err instanceof Error ? err.message : "unknown error";
      result.errors.push(`Row ${lineNo}: ${message}, skipped.`);
    }
  }

  return result;
}

/** Export all products as a CSV string (rupees, two decimals). */
export async function exportProductsCsv(): Promise<string> {
  const { products } = await listProducts({ pageSize: 200, page: 1 });
  return toCsv(
    ["name", "sku", "category", "price", "stock", "status", "slug"],
    products.map((p) => [
      p.name,
      p.sku ?? "",
      p.categoryName ?? "",
      (p.pricePaise / 100).toFixed(2),
      p.stock,
      p.status,
      p.slug,
    ]),
  );
}

/* ── variant CSV import / export ──────────────────────────────────────── */

export interface VariantCsvRow {
  sku: string;
  /** Product slug or name — only needed when creating a brand-new variant. */
  product?: string;
  label?: string;
  pack?: string;
  pricePaise?: number;
  stock?: number;
}

/**
 * Import variant rows. Existing variants (matched by SKU) get their price/stock
 * (and label/pack when supplied) updated; unknown SKUs are created against the
 * product named in the `product` column (matched by slug, then name). Per-row
 * failures are collected, not thrown.
 */
export async function importVariantsCsv(rows: readonly VariantCsvRow[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const db = supabaseAdmin();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 1;
    const sku = row.sku?.trim();
    if (!sku) {
      result.skipped++;
      result.errors.push(`Row ${lineNo}: missing SKU, skipped.`);
      continue;
    }

    try {
      const pricePaise = Math.max(0, Math.round(row.pricePaise ?? 0));
      const stock = Math.max(0, Math.round(row.stock ?? 0));

      const { data: existingRow } = await db
        .from("product_variants")
        .select("id")
        .eq("sku", sku)
        .maybeSingle();
      const existing = (existingRow as { id: string } | null) ?? null;

      if (existing) {
        const patch: Record<string, string | number | null> = { price_paise: pricePaise, stock };
        if (row.label?.trim()) patch.label = row.label.trim();
        if (row.pack !== undefined) patch.pack = row.pack.trim() || null;
        const { error } = await db.from("product_variants").update(patch).eq("id", existing.id);
        if (error) throw new Error(error.message);
        result.updated++;
      } else {
        const productKey = (row.product ?? "").trim();
        if (!productKey) {
          result.skipped++;
          result.errors.push(`Row ${lineNo}: ${sku} not found and no product given, skipped.`);
          continue;
        }
        let product: { id: string } | null = null;
        {
          const { data } = await db
            .from("products")
            .select("id")
            .eq("slug", slugify(productKey))
            .maybeSingle();
          product = (data as { id: string } | null) ?? null;
        }
        if (!product) {
          const { data } = await db
            .from("products")
            .select("id")
            .ilike("name", productKey)
            .maybeSingle();
          product = (data as { id: string } | null) ?? null;
        }
        if (!product) {
          result.skipped++;
          result.errors.push(`Row ${lineNo}: product "${productKey}" not found, skipped.`);
          continue;
        }
        await createVariant({
          productId: product.id,
          label: row.label?.trim() || sku,
          pack: row.pack?.trim() || null,
          pricePaise,
          sku,
          stock,
        });
        result.created++;
      }
    } catch (err) {
      result.skipped++;
      const message = err instanceof Error ? err.message : "unknown error";
      result.errors.push(`Row ${lineNo}: ${message}, skipped.`);
    }
  }

  return result;
}

/** Export all variants as a CSV string (SKU, product slug, label, pack, price, stock). */
export async function exportVariantsCsv(): Promise<string> {
  const { data } = await supabaseAdmin()
    .from("product_variants")
    .select(`${VARIANT_COLS}, products(name, slug)`)
    .order("sku", { ascending: true });
  type Row = VariantRow & {
    products: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };
  const rows = (data as Row[] | null) ?? [];
  return toCsv(
    ["sku", "product", "label", "pack", "price", "stock"],
    rows.map((r) => {
      const product = firstOf(r.products);
      return [
        r.sku ?? "",
        product?.slug ?? "",
        r.label,
        r.pack ?? "",
        (r.price_paise / 100).toFixed(2),
        r.stock,
      ];
    }),
  );
}
