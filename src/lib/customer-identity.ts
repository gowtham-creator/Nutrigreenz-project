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
  /**
   * When this row has been merged INTO a survivor, the survivor's id; null for a
   * live (un-merged) customer. The row is kept (never deleted) as an audit
   * breadcrumb + forwarding pointer.
   */
  mergedInto: string | null;
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
  merged_into: string | null;
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
  "id, display_name, primary_email, primary_phone, created_at, updated_at, merged_into";
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
    mergedInto: r.merged_into,
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

/** Fetch a single canonical customer by id, or null. */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const { data } = await supabaseAdmin()
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("id", id)
    .maybeSingle();
  return data ? toCustomer(data as CustomerRow) : null;
}

/**
 * Whether the canonical customer OWNS an OTP-VERIFIED phone. True iff either:
 *   (a) a `customer_identities` row for this customer carries a non-null phone
 *       with `verified = true` (the identity model's verified-phone record), or
 *   (b) `customers.primary_phone` is set — that column is ONLY ever seeded from a
 *       verified number (see {@link resolveCustomer} / {@link attachVerifiedPhone}),
 *       so it is a trusted verified signal and covers phone sign-in users whose
 *       verified identity row exists under a different provider tag.
 *
 * Used to gate welcome / first-order coupons (which must tie the bonus to a
 * deduped, verified identity) WITHOUT touching the normal checkout path.
 *
 * Fail-safe by contract: this NEVER throws and returns FALSE on any error or
 * missing config, so a transient lookup failure can never silently GRANT a
 * phone-gated bonus. A false negative can only ever block a *welcome* coupon
 * (the customer re-verifies inline); it is never consulted for a normal order,
 * so it can never block ordinary checkout.
 */
export async function hasVerifiedPhone(customerId: string): Promise<boolean> {
  if (!customerId) return false;
  try {
    const db = supabaseAdmin();

    // (a) A verified phone identity attached to this canonical customer.
    const { data: idRow, error: idErr } = await db
      .from("customer_identities")
      .select("id")
      .eq("customer_id", customerId)
      .eq("verified", true)
      .not("phone", "is", null)
      .limit(1)
      .maybeSingle();
    if (!idErr && idRow) return true;

    // (b) The trusted dedup key — primary_phone is only ever set from a verified
    //     number, so its presence proves ownership of a verified phone.
    const { data: custRow, error: custErr } = await db
      .from("customers")
      .select("primary_phone")
      .eq("id", customerId)
      .maybeSingle();
    if (custErr) return false;
    return Boolean((custRow as { primary_phone: string | null } | null)?.primary_phone);
  } catch {
    // Fail safe: a lookup error must NEVER be read as "has a verified phone".
    return false;
  }
}

/**
 * Find the canonical customer that OWNS a VERIFIED phone, by either:
 *   (a) `customers.primary_phone` equals the number (the dedup key is always a
 *       verified number — `resolveCustomer` only seeds it from a verified phone), or
 *   (b) a `customer_identities` row with this phone and `verified = true`.
 *
 * Returns the owning customer, or null when nobody verifiably owns it. A loser
 * row that was already merged away (`merged_into` set) is followed to its
 * survivor so we never relink onto a tombstone.
 */
export async function findCustomerOwningVerifiedPhone(
  phoneE164: string,
): Promise<Customer | null> {
  const normalized = normalizePhoneE164(phoneE164);
  if (!normalized) return null;

  // (a) primary_phone match — the trusted dedup key.
  const byPrimary = await findCustomerByPhone(normalized);
  if (byPrimary) return resolveSurvivor(byPrimary);

  // (b) a verified phone identity pointing at some customer.
  const { data: idRow } = await supabaseAdmin()
    .from("customer_identities")
    .select(IDENTITY_COLS)
    .eq("phone", normalized)
    .eq("verified", true)
    .limit(1)
    .maybeSingle();
  if (!idRow) return null;

  const identity = toIdentity(idRow as CustomerIdentityRow);
  const owner = await getCustomerById(identity.customerId);
  return owner ? resolveSurvivor(owner) : null;
}

/** Follow a merged loser's forwarding pointer to its live survivor (1 hop is
 *  enough — a survivor is never itself merged away, by construction). */
async function resolveSurvivor(customer: Customer): Promise<Customer> {
  if (!customer.mergedInto) return customer;
  const survivor = await getCustomerById(customer.mergedInto);
  return survivor ?? customer;
}

/**
 * Merge the `loserId` customer INTO the `survivorId` customer — non-destructive
 * and idempotent. NEVER deletes a row.
 *
 * Steps:
 *   1. Re-point every `customer_identities.customer_id` from loser → survivor.
 *   2. Re-point every `users.customer_id` from loser → survivor.
 *   3. Backfill ONLY the survivor's EMPTY canonical fields from the loser
 *      (display_name / primary_email / primary_phone) — never overwrite a
 *      value the survivor already has.
 *   4. Stamp `loser.merged_into = survivor` so the loser becomes an audit
 *      breadcrumb + forwarding pointer.
 *
 * No-op (returns the survivor unchanged) when `loserId === survivorId` or the
 * loser is already merged. Re-running with the same pair is a safe no-op: the
 * relinks have nothing left to move and the backfill only touches empty fields.
 */
export async function mergeCustomers(
  survivorId: string,
  loserId: string,
): Promise<Customer> {
  const db = supabaseAdmin();

  // Idempotency / self-merge guard.
  if (survivorId === loserId) {
    const same = await getCustomerById(survivorId);
    if (!same) throw new Error(`mergeCustomers: customer ${survivorId} not found`);
    return same;
  }

  const survivor = await getCustomerById(survivorId);
  const loser = await getCustomerById(loserId);
  if (!survivor) throw new Error(`mergeCustomers: survivor ${survivorId} not found`);
  if (!loser) throw new Error(`mergeCustomers: loser ${loserId} not found`);

  // Already merged into THIS survivor → nothing to do (idempotent).
  if (loser.mergedInto === survivorId) return survivor;

  // 1. Relink the loser's provider identities onto the survivor.
  await db
    .from("customer_identities")
    .update({ customer_id: survivorId })
    .eq("customer_id", loserId);

  // 2. Repoint any live users rows from loser → survivor.
  await db
    .from("users")
    .update({ customer_id: survivorId })
    .eq("customer_id", loserId);

  // 3. Backfill ONLY the survivor's empty canonical fields from the loser.
  //
  // `primary_email` and `primary_phone` carry PARTIAL-UNIQUE indexes, so the
  // value must be cleared on the loser BEFORE it is written to the survivor —
  // otherwise the copy collides with the loser's own (about-to-be-tombstoned)
  // row. We move the value (clear loser → set survivor); the relinked identity
  // rows still retain the original email/phone for audit, so nothing is lost.
  const patch: Record<string, string> = {};
  const loserClear: Record<string, null> = {};
  if (!survivor.displayName && loser.displayName) patch.display_name = loser.displayName;
  if (!survivor.primaryEmail && loser.primaryEmail) {
    patch.primary_email = loser.primaryEmail;
    loserClear.primary_email = null;
  }
  if (!survivor.primaryPhone && loser.primaryPhone) {
    patch.primary_phone = loser.primaryPhone;
    loserClear.primary_phone = null;
  }

  // Free the moved unique values on the loser first (keeps the unique index happy).
  if (Object.keys(loserClear).length > 0) {
    await db.from("customers").update(loserClear).eq("id", loserId);
  }

  let merged = survivor;
  if (Object.keys(patch).length > 0) {
    const { data } = await db
      .from("customers")
      .update(patch)
      .eq("id", survivorId)
      .select(CUSTOMER_COLS)
      .single();
    if (data) merged = toCustomer(data as CustomerRow);
  }

  // 4. Tombstone the loser: keep the row, stamp the forwarding pointer.
  await db
    .from("customers")
    .update({ merged_into: survivorId })
    .eq("id", loserId);

  return merged;
}

/** Result of {@link attachVerifiedPhone}. */
export interface AttachVerifiedPhoneResult {
  /** True when a DIFFERENT customer owned the phone and was merged in. */
  merged: boolean;
  /** The surviving canonical customer id the phone is now attached to. */
  customerId: string;
}

/**
 * Attach a VERIFIED phone to `currentCustomerId`, de-duplicating against any
 * existing owner of that phone.
 *
 * Cases:
 *   - Nobody (or the current customer) owns the phone → attach to the current
 *     customer: set `primary_phone` if empty + upsert a verified phone identity.
 *   - A DIFFERENT customer owns the phone → MERGE the two. The survivor is the
 *     OLDER `created_at` (stable, takeover-safe); the newer row is merged in.
 *     The verified phone identity is then ensured on the survivor.
 *
 * Non-destructive (never deletes) and idempotent (re-running attaches/merges to
 * the same survivor with no further effect). Caller must have already verified
 * ownership of the phone (Firebase phone OTP).
 */
export async function attachVerifiedPhone(
  currentCustomerId: string,
  phoneE164: string,
): Promise<AttachVerifiedPhoneResult> {
  const phone = normalizePhoneE164(phoneE164);
  if (!phone) {
    // Unnormalizable number — fail safe, attach nothing, no merge.
    return { merged: false, customerId: currentCustomerId };
  }

  const owner = await findCustomerOwningVerifiedPhone(phone);

  // Different customer owns this number → merge. Older row survives.
  if (owner && owner.id !== currentCustomerId) {
    const current = await getCustomerById(currentCustomerId);
    let survivorId = owner.id;
    let loserId = currentCustomerId;
    if (current) {
      // Older created_at wins; tie → keep the existing owner as survivor.
      const ownerOlder = owner.createdAt <= current.createdAt;
      survivorId = ownerOlder ? owner.id : current.id;
      loserId = ownerOlder ? current.id : owner.id;
    }
    await mergeCustomers(survivorId, loserId);
    await ensurePhoneOnCustomer(survivorId, phone);
    return { merged: true, customerId: survivorId };
  }

  // Nobody else owns it (or the current customer already does) → attach here.
  await ensurePhoneOnCustomer(currentCustomerId, phone);
  return { merged: false, customerId: currentCustomerId };
}

/**
 * Ensure `customer` carries the verified `phone`: set `primary_phone` only when
 * it is currently empty (never overwrite), and upsert a verified phone identity
 * for the number. Idempotent.
 */
async function ensurePhoneOnCustomer(
  customerId: string,
  phone: string,
): Promise<void> {
  const db = supabaseAdmin();

  const customer = await getCustomerById(customerId);
  if (customer && !customer.primaryPhone) {
    await db
      .from("customers")
      .update({ primary_phone: phone })
      .eq("id", customerId);
  }

  // Upsert a verified phone identity. provider_uid is the E.164 number so the
  // (provider, provider_uid) unique key makes this idempotent per number.
  await db
    .from("customer_identities")
    .upsert(
      {
        customer_id: customerId,
        provider: "phone" as CustomerProvider,
        provider_uid: phone,
        phone,
        verified: true,
      },
      { onConflict: "provider,provider_uid" },
    );
}
