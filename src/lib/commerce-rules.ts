/**
 * DB-backed commerce rules config (Supabase `public.commerce_rules`,
 * `public.delivery_slots`, `public.serviceable_areas`). Powers the Super Admin
 * "Commerce Rules" control center and the public storefront read.
 *
 * Service-role only — import from Node route handlers, never client/Edge. All
 * monetary fields are integer paise (₹1 = 100 paise); the UI converts to rupees
 * at the edges.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/* ── types ────────────────────────────────────────────────────────────── */

export type ShippingType = "flat" | "slab" | "zero";
export type TaxMode = "inclusive" | "exclusive";

/** A progressive shipping slab: subtotal up to `uptoPaise` costs `feePaise`. */
export interface ShippingSlab {
  uptoPaise: number;
  feePaise: number;
}

/** The full singleton commerce config, camelCased for the app. */
export interface CommerceRulesRecord {
  minOrderPaise: number;
  freeDeliveryThresholdPaise: number;
  shippingType: ShippingType;
  shippingFlatPaise: number;
  shippingSlabs: ShippingSlab[];
  taxMode: TaxMode;
  taxRateBps: number;
  currency: string;
  updatedAt: string | null;
}

export interface DeliverySlotRecord {
  id: string;
  label: string;
  windowText: string | null;
  sort: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceableAreaRecord {
  id: string;
  pincode: string;
  area: string | null;
  community: string | null;
  active: boolean;
  createdAt: string;
}

/**
 * The customer-facing subset returned by the public storefront endpoint — only
 * the economics + active delivery windows the shopper needs. No admin metadata.
 */
export interface PublicCommerceRules {
  minOrderPaise: number;
  freeDeliveryThresholdPaise: number;
  shippingType: ShippingType;
  shippingFlatPaise: number;
  shippingSlabs: ShippingSlab[];
  taxMode: TaxMode;
  taxRateBps: number;
  currency: string;
  deliverySlots: { id: string; label: string; windowText: string | null }[];
}

/* ── defaults (mirror the migration's column defaults) ────────────────── */

export const DEFAULT_COMMERCE_RULES: CommerceRulesRecord = {
  minOrderPaise: 30000,
  freeDeliveryThresholdPaise: 59900,
  shippingType: "flat",
  shippingFlatPaise: 4000,
  shippingSlabs: [],
  taxMode: "inclusive",
  taxRateBps: 0,
  currency: "INR",
  updatedAt: null,
};

/* ── row shapes + mappers ─────────────────────────────────────────────── */

interface CommerceRulesRow {
  id: number;
  min_order_paise: number;
  free_delivery_threshold_paise: number;
  shipping_type: string;
  shipping_flat_paise: number;
  shipping_slabs: unknown;
  tax_mode: string;
  tax_rate_bps: number;
  currency: string;
  updated_at: string;
}

interface DeliverySlotRow {
  id: string;
  label: string;
  window_text: string | null;
  sort: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceableAreaRow {
  id: string;
  pincode: string;
  area: string | null;
  community: string | null;
  active: boolean;
  created_at: string;
}

const RULES_COLS =
  "id, min_order_paise, free_delivery_threshold_paise, shipping_type, shipping_flat_paise, shipping_slabs, tax_mode, tax_rate_bps, currency, updated_at";
const SLOT_COLS = "id, label, window_text, sort, active, created_at, updated_at";
const AREA_COLS = "id, pincode, area, community, active, created_at";

function toShippingType(raw: string | null | undefined): ShippingType {
  return raw === "slab" || raw === "zero" ? raw : "flat";
}

function toTaxMode(raw: string | null | undefined): TaxMode {
  return raw === "exclusive" ? "exclusive" : "inclusive";
}

/** Coerce stored JSON into a clean list of numeric slabs. */
function toSlabs(raw: unknown): ShippingSlab[] {
  if (!Array.isArray(raw)) return [];
  const out: ShippingSlab[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const upto = Number(r.uptoPaise ?? r.upto_paise);
      const fee = Number(r.feePaise ?? r.fee_paise);
      if (Number.isFinite(upto) && Number.isFinite(fee)) {
        out.push({ uptoPaise: Math.max(0, Math.round(upto)), feePaise: Math.max(0, Math.round(fee)) });
      }
    }
  }
  return out;
}

function toRules(r: CommerceRulesRow): CommerceRulesRecord {
  return {
    minOrderPaise: r.min_order_paise,
    freeDeliveryThresholdPaise: r.free_delivery_threshold_paise,
    shippingType: toShippingType(r.shipping_type),
    shippingFlatPaise: r.shipping_flat_paise,
    shippingSlabs: toSlabs(r.shipping_slabs),
    taxMode: toTaxMode(r.tax_mode),
    taxRateBps: r.tax_rate_bps,
    currency: r.currency || "INR",
    updatedAt: r.updated_at ?? null,
  };
}

function toSlot(r: DeliverySlotRow): DeliverySlotRecord {
  return {
    id: r.id,
    label: r.label,
    windowText: r.window_text,
    sort: r.sort,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toArea(r: ServiceableAreaRow): ServiceableAreaRecord {
  return {
    id: r.id,
    pincode: r.pincode,
    area: r.area,
    community: r.community,
    active: r.active,
    createdAt: r.created_at,
  };
}

/* ── commerce_rules (singleton) ───────────────────────────────────────── */

/**
 * Read the singleton commerce config. Returns sane built-in defaults when the
 * DB is unconfigured or the row is somehow missing, so callers never crash.
 */
export async function getCommerceRules(): Promise<CommerceRulesRecord> {
  if (!isSupabaseConfigured) return DEFAULT_COMMERCE_RULES;
  const { data } = await supabaseAdmin()
    .from("commerce_rules")
    .select(RULES_COLS)
    .eq("id", 1)
    .maybeSingle();
  return data ? toRules(data as CommerceRulesRow) : DEFAULT_COMMERCE_RULES;
}

export interface CommerceRulesPatch {
  minOrderPaise?: number;
  freeDeliveryThresholdPaise?: number;
  shippingType?: ShippingType;
  shippingFlatPaise?: number;
  shippingSlabs?: ShippingSlab[];
  taxMode?: TaxMode;
  taxRateBps?: number;
  currency?: string;
}

/**
 * Apply an editable subset of fields to the singleton row (upserting id = 1 so
 * the row is created if it was ever cleared), and return the fresh config.
 */
export async function updateCommerceRules(patch: CommerceRulesPatch): Promise<CommerceRulesRecord> {
  const db = supabaseAdmin();
  const row: Record<string, unknown> = { id: 1 };
  if (patch.minOrderPaise !== undefined) row.min_order_paise = Math.max(0, Math.round(patch.minOrderPaise));
  if (patch.freeDeliveryThresholdPaise !== undefined)
    row.free_delivery_threshold_paise = Math.max(0, Math.round(patch.freeDeliveryThresholdPaise));
  if (patch.shippingType !== undefined) row.shipping_type = toShippingType(patch.shippingType);
  if (patch.shippingFlatPaise !== undefined)
    row.shipping_flat_paise = Math.max(0, Math.round(patch.shippingFlatPaise));
  if (patch.shippingSlabs !== undefined) row.shipping_slabs = toSlabs(patch.shippingSlabs);
  if (patch.taxMode !== undefined) row.tax_mode = toTaxMode(patch.taxMode);
  if (patch.taxRateBps !== undefined) row.tax_rate_bps = Math.max(0, Math.round(patch.taxRateBps));
  if (patch.currency !== undefined) row.currency = patch.currency.trim().toUpperCase() || "INR";

  const { data, error } = await db
    .from("commerce_rules")
    .upsert(row, { onConflict: "id" })
    .select(RULES_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to save commerce rules.");
  return toRules(data as CommerceRulesRow);
}

/* ── delivery_slots ───────────────────────────────────────────────────── */

/** All delivery slots, ordered by sort then label. */
export async function listDeliverySlots(): Promise<DeliverySlotRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin()
    .from("delivery_slots")
    .select(SLOT_COLS)
    .order("sort", { ascending: true })
    .order("label", { ascending: true });
  return ((data as DeliverySlotRow[] | null) ?? []).map(toSlot);
}

export interface NewSlotInput {
  label: string;
  windowText?: string | null;
  sort?: number;
  active?: boolean;
}

/** Create a delivery slot and return the fresh record. */
export async function createSlot(input: NewSlotInput): Promise<DeliverySlotRecord> {
  const { data, error } = await supabaseAdmin()
    .from("delivery_slots")
    .insert({
      label: input.label.trim(),
      window_text: input.windowText?.trim() || null,
      sort: Math.round(input.sort ?? 0),
      active: input.active ?? true,
    })
    .select(SLOT_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create slot.");
  return toSlot(data as DeliverySlotRow);
}

export interface SlotUpdateInput {
  label?: string;
  windowText?: string | null;
  sort?: number;
  active?: boolean;
}

/** Apply an editable subset of fields to a slot and return the fresh record. */
export async function updateSlot(id: string, input: SlotUpdateInput): Promise<DeliverySlotRecord | null> {
  const db = supabaseAdmin();
  const patch: Record<string, string | number | boolean | null> = {};
  if (input.label !== undefined) patch.label = input.label.trim();
  if (input.windowText !== undefined) patch.window_text = input.windowText?.trim() || null;
  if (input.sort !== undefined) patch.sort = Math.round(input.sort);
  if (input.active !== undefined) patch.active = input.active;
  if (Object.keys(patch).length === 0) {
    const { data } = await db.from("delivery_slots").select(SLOT_COLS).eq("id", id).maybeSingle();
    return data ? toSlot(data as DeliverySlotRow) : null;
  }
  const { data, error } = await db
    .from("delivery_slots")
    .update(patch)
    .eq("id", id)
    .select(SLOT_COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSlot(data as DeliverySlotRow) : null;
}

/** Delete a delivery slot. */
export async function deleteSlot(id: string): Promise<void> {
  await supabaseAdmin().from("delivery_slots").delete().eq("id", id);
}

/* ── serviceable_areas ────────────────────────────────────────────────── */

/** All serviceable areas, newest first. */
export async function listServiceableAreas(): Promise<ServiceableAreaRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin()
    .from("serviceable_areas")
    .select(AREA_COLS)
    .order("pincode", { ascending: true });
  return ((data as ServiceableAreaRow[] | null) ?? []).map(toArea);
}

export interface AreaInput {
  id?: string;
  pincode: string;
  area?: string | null;
  community?: string | null;
  active?: boolean;
}

/**
 * Insert or update a serviceable area. When `id` is present the row is updated;
 * otherwise it's inserted. Pincode is trimmed; blank pincodes are rejected.
 */
export async function upsertArea(input: AreaInput): Promise<ServiceableAreaRecord> {
  const db = supabaseAdmin();
  const pincode = input.pincode.trim();
  if (!pincode) throw new Error("Pincode is required.");

  if (input.id) {
    const patch: Record<string, string | boolean | null> = { pincode };
    if (input.area !== undefined) patch.area = input.area?.trim() || null;
    if (input.community !== undefined) patch.community = input.community?.trim() || null;
    if (input.active !== undefined) patch.active = input.active;
    const { data, error } = await db
      .from("serviceable_areas")
      .update(patch)
      .eq("id", input.id)
      .select(AREA_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to update area.");
    return toArea(data as ServiceableAreaRow);
  }

  const { data, error } = await db
    .from("serviceable_areas")
    .insert({
      pincode,
      area: input.area?.trim() || null,
      community: input.community?.trim() || null,
      active: input.active ?? true,
    })
    .select(AREA_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create area.");
  return toArea(data as ServiceableAreaRow);
}

/** Delete a serviceable area. */
export async function deleteArea(id: string): Promise<void> {
  await supabaseAdmin().from("serviceable_areas").delete().eq("id", id);
}

export interface AreaImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Bulk-import pincode rows from parsed CSV cells. Existing pincodes are skipped
 * (not duplicated); blank pincodes are skipped with a note. Per-row failures are
 * collected, not thrown. Each row is `{ pincode, area?, community? }`.
 */
export async function importAreas(
  rows: readonly { pincode: string; area?: string; community?: string }[],
): Promise<AreaImportResult> {
  const result: AreaImportResult = { created: 0, skipped: 0, errors: [] };
  const db = supabaseAdmin();
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const lineNo = i + 1;
    const pincode = (rows[i].pincode ?? "").trim();
    if (!pincode) {
      result.skipped++;
      result.errors.push(`Row ${lineNo}: missing pincode, skipped.`);
      continue;
    }
    if (seen.has(pincode)) {
      result.skipped++;
      continue;
    }
    seen.add(pincode);
    try {
      const { data: existing } = await db
        .from("serviceable_areas")
        .select("id")
        .eq("pincode", pincode)
        .maybeSingle();
      if (existing) {
        result.skipped++;
        continue;
      }
      await db.from("serviceable_areas").insert({
        pincode,
        area: rows[i].area?.trim() || null,
        community: rows[i].community?.trim() || null,
        active: true,
      });
      result.created++;
    } catch (err) {
      result.skipped++;
      const message = err instanceof Error ? err.message : "unknown error";
      result.errors.push(`Row ${lineNo}: ${message}, skipped.`);
    }
  }
  return result;
}

/**
 * Serviceability lookup. True when an ACTIVE serviceable_areas row matches the
 * pincode. When the table is empty (no areas configured yet) it returns `true`
 * so serviceability is non-blocking until the admin curates the list.
 */
export async function isServiceable(pincode: string): Promise<boolean> {
  const pin = (pincode ?? "").trim();
  if (!pin) return false;
  if (!isSupabaseConfigured) return true;
  const db = supabaseAdmin();

  const { count: total } = await db
    .from("serviceable_areas")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  // No active areas configured → don't block checkout.
  if (!total) return true;

  const { count: match } = await db
    .from("serviceable_areas")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .eq("pincode", pin);
  return Boolean(match && match > 0);
}

/**
 * The gated-community names configured for a delivery pincode, taken from the
 * ACTIVE `serviceable_areas` rows. Used by coupon area-targeting so a
 * community-restricted code is matched against the curated list rather than
 * anything the client claims. Returns an empty array when the pincode is
 * unknown, has no community set, or the DB is unconfigured — never throws.
 */
export async function communitiesForPincode(pincode: string): Promise<string[]> {
  const pin = (pincode ?? "").trim();
  if (!pin || !isSupabaseConfigured) return [];
  try {
    const { data } = await supabaseAdmin()
      .from("serviceable_areas")
      .select("community")
      .eq("active", true)
      .eq("pincode", pin);
    const rows = (data as { community: string | null }[] | null) ?? [];
    return rows
      .map((r) => (r.community ?? "").trim())
      .filter((c): c is string => c.length > 0);
  } catch {
    return [];
  }
}

/* ── public-safe read ─────────────────────────────────────────────────── */

/**
 * The customer-facing commerce rules for the storefront — the economics plus
 * the ACTIVE delivery windows. Never exposes admin-only metadata.
 */
export async function getPublicCommerceRules(): Promise<PublicCommerceRules> {
  const [rules, slots] = await Promise.all([getCommerceRules(), listDeliverySlots()]);
  return {
    minOrderPaise: rules.minOrderPaise,
    freeDeliveryThresholdPaise: rules.freeDeliveryThresholdPaise,
    shippingType: rules.shippingType,
    shippingFlatPaise: rules.shippingFlatPaise,
    shippingSlabs: rules.shippingSlabs,
    taxMode: rules.taxMode,
    taxRateBps: rules.taxRateBps,
    currency: rules.currency,
    deliverySlots: slots
      .filter((s) => s.active)
      .map((s) => ({ id: s.id, label: s.label, windowText: s.windowText })),
  };
}
