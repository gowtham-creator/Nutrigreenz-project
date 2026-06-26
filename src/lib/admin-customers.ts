/**
 * Admin-facing, DEDUPED customer directory (Customer Identity — Task T5).
 *
 * The admin portal must show ONE canonical row per real person, NOT the
 * duplicated `public.users` sign-in rows (a single human can appear in `users`
 * once per Google + phone sign-in). This module reads the canonical
 * `public.customers` table built by T1–T4, joins in its provider identities
 * (`public.customer_identities`), saved addresses (`public.addresses`) and the
 * linked live `public.users` rows (via the `users.customer_id` backlink), and
 * folds them into a single deduped view.
 *
 * Dedup contract:
 *   - A merged customer leaves a tombstone behind (`customers.merged_into` set
 *     to the survivor's id). Tombstones are NEVER listed — only LIVE canonical
 *     customers (`merged_into IS NULL`) appear.
 *   - `providers` is aggregated from the distinct providers on a customer's
 *     identities (e.g. ['google','phone']).
 *
 * Service-role only — imported from Node route handlers, never client/Edge
 * (mirrors `@/lib/customer-identity` and `@/lib/admins`). This is an ADDITIVE
 * READ view: it does not touch any existing `users`-based code path.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { CustomerProvider } from "@/lib/customer-identity";

/** A single linked live sign-in row (`public.users`) under a canonical customer. */
export interface LinkedUser {
  id: string;
  firebaseUid: string | null;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  photoUrl: string | null;
  provider: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

/** A provider identity row attached to a canonical customer. */
export interface CustomerIdentitySummary {
  id: string;
  provider: CustomerProvider;
  email: string | null;
  phone: string | null;
  verified: boolean;
  createdAt: string;
}

/** A saved delivery address (admin view — read-only). */
export interface CustomerAddressSummary {
  id: string;
  label: string | null;
  fullName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  isDefault: boolean;
}

/** One DEDUPED canonical customer row for the admin list. */
export interface AdminCustomerRow {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  /** Distinct providers across this customer's identities, sorted stably. */
  providers: CustomerProvider[];
  /** Number of provider identities folded into this canonical customer. */
  identityCount: number;
  /** Number of saved delivery addresses owned by this customer. */
  addressCount: number;
  createdAt: string;
  /** Most-recent `last_login_at` across all linked `users` rows, or null. */
  lastActive: string | null;
}

/** Full detail for one canonical customer. */
export interface AdminCustomerDetail {
  customer: AdminCustomerRow;
  identities: CustomerIdentitySummary[];
  addresses: CustomerAddressSummary[];
  linkedUsers: LinkedUser[];
}

/** A page of deduped customers plus the total count of LIVE canonical rows. */
export interface AdminCustomerPage {
  customers: AdminCustomerRow[];
  /** Total LIVE canonical customers matching the search (for pagination). */
  total: number;
  /** Total sign-in identities folded across all LIVE customers (dedup proof). */
  identitiesTotal: number;
  /** Total LIVE canonical customers (people) — the dedup target count. */
  customersTotal: number;
}

interface CustomerRow {
  id: string;
  display_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  created_at: string;
  merged_into: string | null;
}

interface IdentityRow {
  id: string;
  customer_id: string;
  provider: CustomerProvider;
  email: string | null;
  phone: string | null;
  verified: boolean;
  created_at: string;
}

interface AddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_default: boolean;
}

interface UserRow {
  id: string;
  customer_id: string | null;
  firebase_uid: string | null;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  photo_url: string | null;
  provider: string | null;
  last_login_at: string | null;
  created_at: string | null;
}

const CUSTOMER_COLS =
  "id, display_name, primary_email, primary_phone, created_at, merged_into";
const IDENTITY_COLS =
  "id, customer_id, provider, email, phone, verified, created_at";
const ADDRESS_COLS =
  "id, customer_id, label, full_name, phone, city, state, pincode, is_default";
const USER_COLS =
  "id, customer_id, firebase_uid, email, phone, full_name, photo_url, provider, last_login_at, created_at";

const PROVIDER_ORDER: CustomerProvider[] = ["google", "phone"];

/** Sort providers into a stable, human-friendly order (google before phone). */
function sortProviders(set: Set<CustomerProvider>): CustomerProvider[] {
  const ordered = PROVIDER_ORDER.filter((p) => set.has(p));
  // Defensive: surface any unexpected provider value after the known ones.
  for (const p of set) if (!ordered.includes(p)) ordered.push(p);
  return ordered;
}

/** Newest of two nullable ISO timestamps, or null when both are null. */
function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export interface ListCustomersInput {
  /** Free-text search over display name / email / phone. */
  search?: string;
  /** Page size (default 50, capped at 200). */
  limit?: number;
  /** Row offset for pagination (default 0). */
  offset?: number;
}

/**
 * List DEDUPED canonical customers — one row per real person.
 *
 * Excludes tombstones (`merged_into IS NOT NULL`) so a merged duplicate never
 * shows up. For each live customer we aggregate provider identities, count
 * addresses, and surface the most-recent linked-`users` login as `lastActive`.
 *
 * Returns empty results (not an error) when Supabase is unconfigured or the
 * canonical table is empty — the table fills as sign-ins land + the backfill
 * runs, so the UI shows a friendly empty state rather than a failure.
 */
export async function listCustomers(
  input: ListCustomersInput = {},
): Promise<AdminCustomerPage> {
  const empty: AdminCustomerPage = {
    customers: [],
    total: 0,
    identitiesTotal: 0,
    customersTotal: 0,
  };

  const db = supabaseAdmin();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const search = input.search?.trim() ?? "";

  // Base query: LIVE canonical customers only (tombstone exclusion).
  let q = db
    .from("customers")
    .select(CUSTOMER_COLS, { count: "exact" })
    .is("merged_into", null);

  if (search) {
    // Escape PostgREST `or` reserved characters in the user term.
    const safe = search.replace(/[,()]/g, " ");
    q = q.or(
      `display_name.ilike.%${safe}%,primary_email.ilike.%${safe}%,primary_phone.ilike.%${safe}%`,
    );
  }

  const {
    data: customerData,
    count,
    error,
  } = await q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (error) return empty;
  const customerRows = (customerData ?? []) as CustomerRow[];

  // Whole-table totals for the dedup summary header (independent of the page).
  const [{ count: liveTotal }, { count: idTotal }] = await Promise.all([
    db.from("customers").select("id", { count: "exact", head: true }).is("merged_into", null),
    db.from("customer_identities").select("id", { count: "exact", head: true }),
  ]);

  if (customerRows.length === 0) {
    return {
      customers: [],
      total: count ?? 0,
      identitiesTotal: idTotal ?? 0,
      customersTotal: liveTotal ?? 0,
    };
  }

  const ids = customerRows.map((c) => c.id);

  // Fan out the per-customer aggregates in parallel, scoped to this page.
  const [identitiesRes, addressesRes, usersRes] = await Promise.all([
    db.from("customer_identities").select(IDENTITY_COLS).in("customer_id", ids),
    db.from("addresses").select("id, customer_id").in("customer_id", ids),
    db.from("users").select("id, customer_id, last_login_at").in("customer_id", ids),
  ]);

  const identityRows = (identitiesRes.data ?? []) as IdentityRow[];
  const addressRows = (addressesRes.data ?? []) as Array<{ customer_id: string }>;
  const userRows = (usersRes.data ?? []) as Array<{
    customer_id: string | null;
    last_login_at: string | null;
  }>;

  const providersByCustomer = new Map<string, Set<CustomerProvider>>();
  const identityCountByCustomer = new Map<string, number>();
  for (const r of identityRows) {
    let set = providersByCustomer.get(r.customer_id);
    if (!set) {
      set = new Set<CustomerProvider>();
      providersByCustomer.set(r.customer_id, set);
    }
    set.add(r.provider);
    identityCountByCustomer.set(
      r.customer_id,
      (identityCountByCustomer.get(r.customer_id) ?? 0) + 1,
    );
  }

  const addressCountByCustomer = new Map<string, number>();
  for (const r of addressRows) {
    addressCountByCustomer.set(
      r.customer_id,
      (addressCountByCustomer.get(r.customer_id) ?? 0) + 1,
    );
  }

  const lastActiveByCustomer = new Map<string, string | null>();
  for (const r of userRows) {
    if (!r.customer_id) continue;
    lastActiveByCustomer.set(
      r.customer_id,
      maxIso(lastActiveByCustomer.get(r.customer_id) ?? null, r.last_login_at),
    );
  }

  const customers: AdminCustomerRow[] = customerRows.map((c) => ({
    id: c.id,
    displayName: c.display_name,
    primaryEmail: c.primary_email,
    primaryPhone: c.primary_phone,
    providers: sortProviders(providersByCustomer.get(c.id) ?? new Set()),
    identityCount: identityCountByCustomer.get(c.id) ?? 0,
    addressCount: addressCountByCustomer.get(c.id) ?? 0,
    createdAt: c.created_at,
    lastActive: lastActiveByCustomer.get(c.id) ?? null,
  }));

  return {
    customers,
    total: count ?? customers.length,
    identitiesTotal: idTotal ?? 0,
    customersTotal: liveTotal ?? 0,
  };
}

/**
 * Full detail for one canonical customer: the row itself plus its identities,
 * addresses and linked live `users` rows. Returns null when the id is unknown
 * or is a tombstone (a merged duplicate is never shown directly).
 */
export async function getCustomer(id: string): Promise<AdminCustomerDetail | null> {
  const db = supabaseAdmin();

  const { data: customerData, error } = await db
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("id", id)
    .is("merged_into", null)
    .maybeSingle();

  if (error || !customerData) return null;
  const c = customerData as CustomerRow;

  const [identitiesRes, addressesRes, usersRes] = await Promise.all([
    db
      .from("customer_identities")
      .select(IDENTITY_COLS)
      .eq("customer_id", id)
      .order("created_at", { ascending: true }),
    db
      .from("addresses")
      .select(ADDRESS_COLS)
      .eq("customer_id", id)
      .order("is_default", { ascending: false }),
    db
      .from("users")
      .select(USER_COLS)
      .eq("customer_id", id)
      .order("last_login_at", { ascending: false, nullsFirst: false }),
  ]);

  const identityRows = (identitiesRes.data ?? []) as IdentityRow[];
  const addressRows = (addressesRes.data ?? []) as AddressRow[];
  const userRows = (usersRes.data ?? []) as UserRow[];

  const providers = new Set<CustomerProvider>();
  let lastActive: string | null = null;
  for (const r of identityRows) providers.add(r.provider);
  for (const r of userRows) lastActive = maxIso(lastActive, r.last_login_at);

  const customer: AdminCustomerRow = {
    id: c.id,
    displayName: c.display_name,
    primaryEmail: c.primary_email,
    primaryPhone: c.primary_phone,
    providers: sortProviders(providers),
    identityCount: identityRows.length,
    addressCount: addressRows.length,
    createdAt: c.created_at,
    lastActive,
  };

  const identities: CustomerIdentitySummary[] = identityRows.map((r) => ({
    id: r.id,
    provider: r.provider,
    email: r.email,
    phone: r.phone,
    verified: r.verified,
    createdAt: r.created_at,
  }));

  const addresses: CustomerAddressSummary[] = addressRows.map((r) => ({
    id: r.id,
    label: r.label,
    fullName: r.full_name,
    phone: r.phone,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    isDefault: r.is_default,
  }));

  const linkedUsers: LinkedUser[] = userRows.map((r) => ({
    id: r.id,
    firebaseUid: r.firebase_uid,
    email: r.email,
    phone: r.phone,
    fullName: r.full_name,
    photoUrl: r.photo_url,
    provider: r.provider,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
  }));

  return { customer, identities, addresses, linkedUsers };
}
