/**
 * Customer address book (Milestone 2, Task T4) — DB-backed, attached to the
 * CANONICAL `public.customers` row so a person's saved addresses are SHARED
 * across every sign-in identity (Google + phone) that resolves to the same
 * canonical customer.
 *
 * Service-role only — imported from Node route handlers, never client/Edge
 * (mirrors `@/lib/customer-identity` + `@/lib/admins`). RLS on `addresses` has
 * no policies, so only the service-role client (which bypasses RLS) can touch
 * it; every function here is scoped by `customerId`, and the API layer derives
 * that id strictly from the signed-in session.
 *
 * Structured M1 schema: Building/Floor/Flat, Road/Street, Area/Landmark, City,
 * Pincode, Region, State, Country (locked to 'India'); labels Home/Work/Other
 * (+ a custom label). Exactly one address per customer is the default, and the
 * FIRST address a customer saves is forced to the default (label 'home' when
 * unspecified — the Google/first-address "Home" rule).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AddressLabel = "home" | "work" | "other";

/** A saved delivery address (camelCase view of `public.addresses`). */
export interface CustomerAddress {
  id: string;
  customerId: string;
  fullName: string | null;
  phone: string | null;
  label: AddressLabel;
  customLabel: string | null;
  buildingFloorFlat: string | null;
  roadStreet: string | null;
  areaLandmark: string | null;
  city: string | null;
  pincode: string | null;
  region: string | null;
  state: string | null;
  country: string;
  isDefault: boolean;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Caller-supplied fields for a create/update (id + ownership are server-owned). */
export interface AddressInput {
  fullName?: string | null;
  phone?: string | null;
  label?: AddressLabel;
  customLabel?: string | null;
  buildingFloorFlat?: string | null;
  roadStreet?: string | null;
  areaLandmark?: string | null;
  city?: string | null;
  pincode?: string | null;
  region?: string | null;
  state?: string | null;
  /** Always coerced to "India" server-side; accepted only for API symmetry. */
  country?: string | null;
  isDefault?: boolean;
  lat?: number | null;
  lng?: number | null;
}

interface AddressRow {
  id: string;
  customer_id: string;
  full_name: string | null;
  phone: string | null;
  label: string | null;
  custom_label: string | null;
  building_floor_flat: string | null;
  road_street: string | null;
  area_landmark: string | null;
  city: string | null;
  pincode: string | null;
  region: string | null;
  state: string | null;
  country: string | null;
  is_default: boolean | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

const ADDRESS_COLS =
  "id, customer_id, full_name, phone, label, custom_label, building_floor_flat, road_street, area_landmark, city, pincode, region, state, country, is_default, lat, lng, created_at, updated_at";

const COUNTRY = "India";

function normalizeLabel(value: unknown): AddressLabel {
  return value === "work" || value === "other" ? value : "home";
}

function toAddress(r: AddressRow): CustomerAddress {
  return {
    id: r.id,
    customerId: r.customer_id,
    fullName: r.full_name,
    phone: r.phone,
    label: normalizeLabel(r.label),
    customLabel: r.custom_label,
    buildingFloorFlat: r.building_floor_flat,
    roadStreet: r.road_street,
    areaLandmark: r.area_landmark,
    city: r.city,
    pincode: r.pincode,
    region: r.region,
    state: r.state,
    country: r.country ?? COUNTRY,
    isDefault: Boolean(r.is_default),
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Map caller input → snake_case DB columns, dropping `undefined` keys. */
function toRow(input: AddressInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.fullName !== undefined) row.full_name = input.fullName;
  if (input.phone !== undefined) row.phone = input.phone;
  if (input.label !== undefined) row.label = normalizeLabel(input.label);
  if (input.customLabel !== undefined) row.custom_label = input.customLabel;
  if (input.buildingFloorFlat !== undefined)
    row.building_floor_flat = input.buildingFloorFlat;
  if (input.roadStreet !== undefined) row.road_street = input.roadStreet;
  if (input.areaLandmark !== undefined) row.area_landmark = input.areaLandmark;
  if (input.city !== undefined) row.city = input.city;
  if (input.pincode !== undefined) row.pincode = input.pincode;
  if (input.region !== undefined) row.region = input.region;
  if (input.state !== undefined) row.state = input.state;
  if (input.lat !== undefined) row.lat = input.lat;
  if (input.lng !== undefined) row.lng = input.lng;
  // Country is locked: we never trust a caller-supplied value.
  row.country = COUNTRY;
  return row;
}

/**
 * List a customer's addresses, default first then newest-first. Returns [] for
 * an unknown / empty customer. Never throws on "no rows".
 */
export async function listAddresses(
  customerId: string,
): Promise<CustomerAddress[]> {
  const { data, error } = await supabaseAdmin()
    .from("addresses")
    .select(ADDRESS_COLS)
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as AddressRow[]).map(toAddress);
}

/** Whether this customer already has at least one saved address. */
async function customerHasAddress(customerId: string): Promise<boolean> {
  const { count } = await supabaseAdmin()
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);
  return (count ?? 0) > 0;
}

/** Clear `is_default` on every OTHER address for this customer. */
async function clearOtherDefaults(
  customerId: string,
  exceptId: string | null,
): Promise<void> {
  let q = supabaseAdmin()
    .from("addresses")
    .update({ is_default: false })
    .eq("customer_id", customerId)
    .eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

/**
 * Create an address for a customer. The FIRST address a customer saves becomes
 * the default and its label defaults to 'home' when unspecified (the
 * Google/first-address "Home" rule). Country is forced to 'India'. When the new
 * address is the default, any previous default is demoted (exactly one default).
 */
export async function createAddress(
  customerId: string,
  input: AddressInput,
): Promise<CustomerAddress> {
  const isFirst = !(await customerHasAddress(customerId));

  const row = toRow(input);
  // First address → always default, and default its label to Home.
  const isDefault = isFirst ? true : Boolean(input.isDefault);
  row.is_default = isDefault;
  if (isFirst && input.label === undefined) row.label = "home";
  else if (row.label === undefined) row.label = normalizeLabel(input.label);
  row.customer_id = customerId;

  const { data, error } = await supabaseAdmin()
    .from("addresses")
    .insert(row)
    .select(ADDRESS_COLS)
    .single();
  if (error || !data) {
    throw new Error(`Failed to create address: ${error?.message ?? "unknown"}`);
  }
  const created = toAddress(data as AddressRow);

  if (created.isDefault) {
    await clearOtherDefaults(customerId, created.id);
  }
  return created;
}

/**
 * Patch an existing address. Ownership is enforced by `customer_id` so a caller
 * can never touch another customer's row. Promoting `isDefault` demotes every
 * other address; country stays locked to 'India'. Returns null when no matching
 * row exists for this customer.
 */
export async function updateAddress(
  customerId: string,
  addressId: string,
  input: AddressInput,
): Promise<CustomerAddress | null> {
  const row = toRow(input);
  if (input.isDefault !== undefined) row.is_default = Boolean(input.isDefault);

  const { data, error } = await supabaseAdmin()
    .from("addresses")
    .update(row)
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .select(ADDRESS_COLS)
    .maybeSingle();
  if (error || !data) return null;
  const updated = toAddress(data as AddressRow);

  if (updated.isDefault) {
    await clearOtherDefaults(customerId, updated.id);
  }
  return updated;
}

/**
 * Delete an address. If it was the default and others remain, the newest other
 * address is promoted so the customer always keeps exactly one default. Returns
 * true when a row was deleted.
 */
export async function deleteAddress(
  customerId: string,
  addressId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .select("id, is_default")
    .maybeSingle();
  if (error || !data) return false;

  const wasDefault = Boolean((data as { is_default: boolean | null }).is_default);
  if (wasDefault) {
    // Promote the newest remaining address (if any) to keep one default.
    const { data: next } = await supabaseAdmin()
      .from("addresses")
      .select("id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = (next as { id: string } | null)?.id ?? null;
    if (nextId) {
      await supabaseAdmin()
        .from("addresses")
        .update({ is_default: true })
        .eq("id", nextId)
        .eq("customer_id", customerId);
    }
  }
  return true;
}

/**
 * Make exactly one address the default for a customer: set it on the target
 * (scoped by `customer_id`) and clear it everywhere else. Returns the updated
 * address, or null when the target doesn't belong to this customer.
 */
export async function setDefaultAddress(
  customerId: string,
  addressId: string,
): Promise<CustomerAddress | null> {
  const { data, error } = await supabaseAdmin()
    .from("addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .select(ADDRESS_COLS)
    .maybeSingle();
  if (error || !data) return null;

  await clearOtherDefaults(customerId, addressId);
  return toAddress(data as AddressRow);
}
