import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/**
 * What a captain may sell at their stall.
 *
 * This replaces `STALL_CATALOG`, a hardcoded six-item list in the captain app
 * whose SKUs matched nothing in the catalogue — two of the products
 * ("Foxtail millet", "Mixed superfood seeds") did not exist at all, and every
 * price was invented. A captain taking cash against those lines recorded
 * revenue the business could not tie to a real SKU, and the sale could never
 * reconcile against stock.
 *
 * Allocation is per VARIANT, because the variant carries the price and the
 * stock. An empty allocation means the captain sells nothing: fail-closed, so a
 * newly created captain cannot start selling until an operator has decided what
 * they may carry.
 */

export interface AllocatedItem {
  variantId: string;
  productId: string;
  /** Real catalogue SKU — what a capture is recorded against. */
  sku: string;
  title: string;
  /** Size/pack label, e.g. "1L", "500g". */
  unit: string;
  /** Pack material, when the variant distinguishes one, e.g. "glass". */
  pack: string | null;
  /** Stall price in RUPEES: the override when set, else the catalogue price. */
  price: number;
  /** True when the stall price differs from the catalogue price. */
  overridden: boolean;
  /** Sellable stock, so a captain is not offered what the warehouse cannot supply. */
  available: number;
}

interface AllocationRow {
  variant_id: string;
  price_paise: number | null;
  product_variants: {
    id: string;
    product_id: string;
    sku: string | null;
    label: string;
    pack: string | null;
    price_paise: number;
    stock: number;
    reserved: number;
    is_active: boolean;
    products: { name: string } | { name: string }[] | null;
  } | null;
}

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const SELECT =
  "variant_id, price_paise, product_variants(id, product_id, sku, label, pack, price_paise, stock, reserved, is_active, products(name))";

/**
 * The catalogue this captain is allowed to sell, priced and in stock.
 *
 * Returns an empty list when nothing is allocated, when the captain is unknown,
 * or when the database is unreachable — never a fallback list. Showing a
 * captain products they are not cleared to sell is exactly the failure this
 * replaces.
 */
export async function allocationsForCaptain(captainId: string): Promise<AllocatedItem[]> {
  if (!isSupabaseConfigured || !captainId) return [];

  const { data, error } = await supabaseAdmin()
    .from("captain_allocations")
    .select(SELECT)
    .eq("captain_id", captainId)
    .eq("active", true);

  if (error || !data) return [];

  const items: AllocatedItem[] = [];
  for (const row of data as unknown as AllocationRow[]) {
    const v = row.product_variants;
    if (!v || !v.is_active) continue;
    const product = firstOf(v.products);
    const available = Math.max(0, v.stock - v.reserved);
    const pricePaise = row.price_paise ?? v.price_paise;
    items.push({
      variantId: v.id,
      productId: v.product_id,
      sku: v.sku ?? "",
      title: product?.name ?? "Product",
      unit: v.label,
      pack: v.pack,
      price: Math.round(pricePaise / 100),
      overridden: row.price_paise != null && row.price_paise !== v.price_paise,
      available,
    });
  }

  // Group a captain's tray the way a stall is laid out: by product, then size.
  items.sort((a, b) => a.title.localeCompare(b.title) || a.unit.localeCompare(b.unit));
  return items;
}

export interface AllocationInput {
  variantId: string;
  /** Stall price in paise; null/undefined uses the catalogue price. */
  pricePaise?: number | null;
}

/**
 * Replace a captain's allocation set.
 *
 * Deliberately a full replace rather than a merge: the admin UI shows the whole
 * tray, so what it sends IS the intended state. A merge would leave a
 * de-selected product quietly sellable.
 */
export async function setAllocations(
  captainId: string,
  items: readonly AllocationInput[],
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("db-unavailable");
  const db = supabaseAdmin();

  const wanted = items.filter((i) => i.variantId);
  const keep = wanted.map((i) => i.variantId);

  // Remove anything no longer allocated.
  const del = db.from("captain_allocations").delete().eq("captain_id", captainId);
  await (keep.length > 0 ? del.not("variant_id", "in", `(${keep.join(",")})`) : del);

  if (wanted.length === 0) return;

  const { error } = await db.from("captain_allocations").upsert(
    wanted.map((i) => ({
      captain_id: captainId,
      variant_id: i.variantId,
      price_paise:
        i.pricePaise == null ? null : Math.max(0, Math.round(i.pricePaise)),
      active: true,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "captain_id,variant_id" },
  );
  if (error) throw new Error(error.message);
}

/** Variant ids a captain currently holds — for the admin picker's initial state. */
export async function allocatedVariantIds(captainId: string): Promise<string[]> {
  if (!isSupabaseConfigured || !captainId) return [];
  const { data } = await supabaseAdmin()
    .from("captain_allocations")
    .select("variant_id")
    .eq("captain_id", captainId)
    .eq("active", true);
  return (data ?? []).map((r) => (r as { variant_id: string }).variant_id);
}

/**
 * Every sellable variant, for the admin allocation picker.
 *
 * The shared /api/admin/inventory/variants endpoint requires a productId — it
 * exists to list one product's sizes. Rather than widen a shared route (and
 * risk an unbounded default listing elsewhere), the picker's flat list is
 * served from the allocations route that actually needs it.
 */
export interface PickableVariant {
  id: string;
  productName: string;
  label: string;
  pack: string | null;
  sku: string | null;
  pricePaise: number;
  available: number;
}

export async function listPickableVariants(): Promise<PickableVariant[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin()
    .from("product_variants")
    .select("id, label, pack, sku, price_paise, stock, reserved, sort, products(name)")
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .limit(500);

  type Row = {
    id: string; label: string; pack: string | null; sku: string | null;
    price_paise: number; stock: number; reserved: number;
    products: { name: string } | { name: string }[] | null;
  };

  const rows = ((data as unknown as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    productName: firstOf(r.products)?.name ?? "Product",
    label: r.label,
    pack: r.pack,
    sku: r.sku,
    pricePaise: r.price_paise,
    available: Math.max(0, r.stock - r.reserved),
  }));
  rows.sort((a, b) => a.productName.localeCompare(b.productName) || a.label.localeCompare(b.label));
  return rows;
}

/* ── captain sales analytics ────────────────────────────────────────────── */

export interface CaptainSkuSale {
  variantId: string | null;
  sku: string | null;
  title: string;
  unit: string | null;
  unitsSold: number;
  revenuePaise: number;
}

export interface CaptainSalesSummary {
  unitsSold: number;
  revenuePaise: number;
  captureCount: number;
  bySku: CaptainSkuSale[];
}

/**
 * Captain stall sales, counted per SKU.
 *
 * Reads captain_capture_lines, which is why this is possible at all: the parent
 * capture stores its lines as jsonb, so before those rows existed you could
 * total the cash but never answer "how many 1L groundnut oils went through
 * captains".
 *
 * `captainId` omitted aggregates every captain — the figure a superadmin wants.
 * Captain sales stay a separate channel from storefront orders and are never
 * mixed into them.
 */
export async function captainSalesSummary(opts: {
  captainId?: string;
  sinceIso?: string;
} = {}): Promise<CaptainSalesSummary> {
  const empty: CaptainSalesSummary = { unitsSold: 0, revenuePaise: 0, captureCount: 0, bySku: [] };
  if (!isSupabaseConfigured) return empty;

  let q = supabaseAdmin()
    .from("captain_capture_lines")
    .select("capture_id, variant_id, sku, title, unit, qty, line_total_paise");
  if (opts.captainId) q = q.eq("captain_id", opts.captainId);
  if (opts.sinceIso) q = q.gte("captured_at", opts.sinceIso);

  const { data, error } = await q;
  if (error || !data) return empty;

  type Row = {
    capture_id: string; variant_id: string | null; sku: string | null;
    title: string; unit: string | null; qty: number; line_total_paise: number;
  };

  const captures = new Set<string>();
  const bucket = new Map<string, CaptainSkuSale>();
  let unitsSold = 0;
  let revenuePaise = 0;

  for (const r of data as unknown as Row[]) {
    captures.add(r.capture_id);
    unitsSold += r.qty;
    revenuePaise += r.line_total_paise;
    // Key on the variant where known; historic lines have none, so they group
    // by their captured title rather than collapsing into one anonymous row.
    const key = r.variant_id ?? `legacy:${r.sku ?? r.title}`;
    const existing = bucket.get(key);
    if (existing) {
      existing.unitsSold += r.qty;
      existing.revenuePaise += r.line_total_paise;
    } else {
      bucket.set(key, {
        variantId: r.variant_id,
        sku: r.sku,
        title: r.title,
        unit: r.unit,
        unitsSold: r.qty,
        revenuePaise: r.line_total_paise,
      });
    }
  }

  const bySku = [...bucket.values()].sort((a, b) => b.revenuePaise - a.revenuePaise);
  return { unitsSold, revenuePaise, captureCount: captures.size, bySku };
}
