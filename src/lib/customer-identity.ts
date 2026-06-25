/**
 * Customer identity / de-duplication resolver (Milestone 2, Task T1 scaffold).
 *
 * One canonical `public.customers` row per real person <-> many
 * `public.customer_identities` (one per auth provider). The dedup key is a
 * normalized E.164 mobile; email is a secondary key.
 *
 * Service-role only — imported from Node route handlers, never client/Edge
 * (mirrors `@/lib/admins`). RLS on both tables has no policies, so only the
 * service-role client (which bypasses RLS) can touch them.
 *
 * This module is the SINGLE entry point both sign-in flows will call later
 * (T2 phone, T3 Google). It is written but intentionally NOT wired into any
 * sign-in flow in this task. `resolveCustomer` is idempotent and
 * non-destructive: it never deletes rows; a merge by phone happens only when
 * the phone is VERIFIED, and is done by relinking identities.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type CustomerProvider = "google" | "phone";

/** A canonical customer record (camelCase view of `public.customers`). */
export interface Customer {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  /** Normalized E.164, or null for an email-only / not-yet-captured phone. */
  primaryPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A provider identity attached to a customer (`public.customer_identities`). */
export interface CustomerIdentity {
  id: string;
  customerId: string;
  provider: CustomerProvider;
  providerUid: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean;
  createdAt: string;
}

interface CustomerRow {
  id: string;
  display_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerIdentityRow {
  id: string;
  customer_id: string;
  provider: CustomerProvider;
  provider_uid: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean;
  created_at: string;
}

const CUSTOMER_COLS =
  "id, display_name, primary_email, primary_phone, created_at, updated_at";
const IDENTITY_COLS =
  "id, customer_id, provider, provider_uid, email, phone, verified, created_at";

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    displayName: r.display_name,
    primaryEmail: r.primary_email,
    primaryPhone: r.primary_phone,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toIdentity(r: CustomerIdentityRow): CustomerIdentity {
  return {
    id: r.id,
    customerId: r.customer_id,
    provider: r.provider,
    providerUid: r.provider_uid,
    email: r.email,
    phone: r.phone,
    verified: r.verified,
    createdAt: r.created_at,
  };
}

/**
 * Normalize a raw phone string to E.164 (`+<countrycode><number>`), or return
 * null when it can't be confidently normalized. Pure (no I/O).
 *
 * Rules (India-first, since this is an Indian store):
 *  - Strips spaces, dashes, parentheses, and a leading `00` international prefix.
 *  - `+<digits>` is kept as-is when it already looks like E.164.
 *  - A bare 10-digit Indian mobile (starting 6-9) gets the `+91` country code.
 *  - `91XXXXXXXXXX` (12 digits) is treated as India and prefixed with `+`.
 *  - Anything else that is a plausible 8–15 digit international number with a
 *    leading `+` is preserved; otherwise we return null rather than guess.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Keep a single leading '+', drop every other non-digit.
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/[^\d]/g, "");

  // Drop an international '00' prefix (e.g. 0091...) — treat like a '+'.
  let plus = hasPlus;
  if (!plus && digits.startsWith("00")) {
    digits = digits.slice(2);
    plus = true;
  }

  if (digits.length === 0) return null;

  if (plus) {
    // Already international: validate length and return canonical form.
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // No country code provided — apply India defaults.
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0") && /^0[6-9]/.test(digits)) {
    // Domestic trunk-prefixed Indian mobile (0XXXXXXXXXX).
    return `+91${digits.slice(1)}`;
  }

  // Ambiguous / unsupported — caller decides what to do with a null.
  return null;
}

const normalizeEmail = (email: string | null | undefined): string | null => {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
};

/** Find a canonical customer by normalized E.164 phone, or null. */
export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const normalized = normalizePhoneE164(phone);
  if (!normalized) return null;
  const { data } = await supabaseAdmin()
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("primary_phone", normalized)
    .maybeSingle();
  return data ? toCustomer(data as CustomerRow) : null;
}

/** Find a canonical customer by (lower-cased) email, or null. */
export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { data } = await supabaseAdmin()
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("primary_email", normalized)
    .maybeSingle();
  return data ? toCustomer(data as CustomerRow) : null;
}

/** Look up an identity by (provider, provider_uid). */
export async function getCustomerByIdentity(
  provider: CustomerProvider,
  uid: string,
): Promise<{ customer: Customer; identity: CustomerIdentity } | null> {
  const { data: identityRow } = await supabaseAdmin()
    .from("customer_identities")
    .select(IDENTITY_COLS)
    .eq("provider", provider)
    .eq("provider_uid", uid)
    .maybeSingle();
  if (!identityRow) return null;

  const identity = toIdentity(identityRow as CustomerIdentityRow);
  const { data: customerRow } = await supabaseAdmin()
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("id", identity.customerId)
    .maybeSingle();
  if (!customerRow) return null;

  return { customer: toCustomer(customerRow as CustomerRow), identity };
}

/** Input to {@link resolveCustomer}. */
export interface ResolveCustomerInput {
  provider: CustomerProvider;
  providerUid: string;
  email?: string | null;
  /** Raw phone; normalized to E.164 internally (ignored when unnormalizable). */
  phone?: string | null;
  /**
   * True only when the phone has been OTP-verified in THIS flow. A merge into
   * an existing phone-keyed customer happens only when this is true — this is
   * the takeover-safe guard (you can't claim someone else's number/orders).
   */
  phoneVerified?: boolean;
  displayName?: string | null;
}

/** Result of {@link resolveCustomer}. */
export interface ResolveCustomerResult {
  customer: Customer;
  identity: CustomerIdentity;
  /** True when a brand-new canonical customer was created in this call. */
  created: boolean;
  /** True when an existing identity was relinked onto another customer. */
  merged: boolean;
}

async function insertCustomer(fields: {
  displayName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
}): Promise<Customer> {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .insert({
      display_name: fields.displayName,
      primary_email: fields.primaryEmail,
      primary_phone: fields.primaryPhone,
    })
    .select(CUSTOMER_COLS)
    .single();
  if (error || !data) {
    throw new Error(`Failed to create customer: ${error?.message ?? "unknown"}`);
  }
  return toCustomer(data as CustomerRow);
}

/**
 * Patch only the canonical fields that are currently empty — we never overwrite
 * a value a customer already has (non-destructive). Phone is only filled when
 * the incoming phone is verified. Returns the (possibly updated) customer.
 */
async function backfillCustomerFields(
  customer: Customer,
  patch: { email: string | null; phone: string | null; phoneVerified: boolean; displayName: string | null },
): Promise<Customer> {
  const update: Record<string, string> = {};
  if (!customer.primaryEmail && patch.email) update.primary_email = patch.email;
  if (!customer.primaryPhone && patch.phone && patch.phoneVerified) {
    update.primary_phone = patch.phone;
  }
  if (!customer.displayName && patch.displayName) update.display_name = patch.displayName;

  if (Object.keys(update).length === 0) return customer;

  const { data } = await supabaseAdmin()
    .from("customers")
    .update(update)
    .eq("id", customer.id)
    .select(CUSTOMER_COLS)
    .single();
  return data ? toCustomer(data as CustomerRow) : customer;
}

/**
 * Upsert the (provider, provider_uid) identity row, relinking it to
 * `customerId` and refreshing its contact fields. Idempotent on the
 * `(provider, provider_uid)` unique constraint.
 */
async function upsertIdentity(input: {
  customerId: string;
  provider: CustomerProvider;
  providerUid: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
}): Promise<CustomerIdentity> {
  const { data, error } = await supabaseAdmin()
    .from("customer_identities")
    .upsert(
      {
        customer_id: input.customerId,
        provider: input.provider,
        provider_uid: input.providerUid,
        email: input.email,
        phone: input.phone,
        verified: input.verified,
      },
      { onConflict: "provider,provider_uid" },
    )
    .select(IDENTITY_COLS)
    .single();
  if (error || !data) {
    throw new Error(`Failed to upsert identity: ${error?.message ?? "unknown"}`);
  }
  return toIdentity(data as CustomerIdentityRow);
}

/**
 * Find-or-create the canonical customer for a sign-in, attach/update the
 * provider identity, and (only on a VERIFIED phone match) merge into the
 * existing phone-keyed customer.
 *
 * Resolution order:
 *   1. Known identity `(provider, providerUid)` -> reuse that customer.
 *   2. VERIFIED phone matches an existing customer -> merge onto it.
 *   3. Email matches an existing customer -> attach onto it.
 *   4. Otherwise -> create a fresh canonical customer.
 *
 * Idempotent and non-destructive: re-running with the same input is a no-op
 * beyond refreshing contact fields; nothing is ever deleted and existing
 * canonical values are never overwritten (only empty fields are backfilled).
 */
export async function resolveCustomer(
  input: ResolveCustomerInput,
): Promise<ResolveCustomerResult> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhoneE164(input.phone);
  const phoneVerified = Boolean(input.phoneVerified) && phone !== null;
  const displayName = input.displayName?.trim() || null;

  // 1. Already-known identity wins — just refresh and backfill.
  const existing = await getCustomerByIdentity(input.provider, input.providerUid);
  if (existing) {
    const customer = await backfillCustomerFields(existing.customer, {
      email,
      phone,
      phoneVerified,
      displayName,
    });
    const identity = await upsertIdentity({
      customerId: customer.id,
      provider: input.provider,
      providerUid: input.providerUid,
      email,
      phone,
      verified: existing.identity.verified || phoneVerified,
    });
    return { customer, identity, created: false, merged: false };
  }

  // 2. Merge by VERIFIED phone only (takeover-safe). 3. else attach by email.
  let target: Customer | null = null;
  let merged = false;
  if (phoneVerified && phone) {
    target = await findCustomerByPhone(phone);
    if (target) merged = true;
  }
  if (!target && email) {
    target = await findCustomerByEmail(email);
  }

  // 4. No match anywhere -> create a fresh canonical customer.
  let created = false;
  if (!target) {
    target = await insertCustomer({
      displayName,
      primaryEmail: email,
      // Only seed primary_phone from a verified number (keeps the dedup key trusted).
      primaryPhone: phoneVerified ? phone : null,
    });
    created = true;
  } else {
    target = await backfillCustomerFields(target, {
      email,
      phone,
      phoneVerified,
      displayName,
    });
  }

  const identity = await upsertIdentity({
    customerId: target.id,
    provider: input.provider,
    providerUid: input.providerUid,
    email,
    phone,
    verified: phoneVerified,
  });

  return { customer: target, identity, created, merged };
}

/**
 * Best-effort backlink: stamp `public.users.customer_id` with the canonical
 * customer for a Firebase UID. Used by the sign-in route after
 * {@link resolveCustomer} so the live `users` row points at its canonical
 * customer. Additive and non-destructive — it only writes the FK column and
 * never touches any other `users` field. Returns true on a successful update.
 *
 * The caller is expected to wrap this in its own try/catch; this helper itself
 * does not throw on a "no matching row" result (the row reconciles next login).
 */
export async function linkUserToCustomer(
  firebaseUid: string,
  customerId: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin()
    .from("users")
    .update({ customer_id: customerId })
    .eq("firebase_uid", firebaseUid);
  return !error;
}
