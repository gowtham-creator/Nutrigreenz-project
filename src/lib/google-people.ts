/**
 * Google People API auto-enrichment (Milestone 2, Task T6) — Decision C.
 *
 * Server-only. Given a Google OAuth ACCESS token (captured client-side via
 * `GoogleAuthProvider.credentialFromResult(result)?.accessToken`), best-effort
 * fetch the signed-in Google account's `phoneNumbers` + `addresses` and:
 *   - AUTO-IMPORT the addresses onto the caller's CANONICAL customer (the user's
 *     OWN data → safe). The first import becomes Home + default; imports are
 *     IDEMPOTENT (an identical address is skipped, so repeat sign-ins never
 *     duplicate).
 *   - For the phone: set the customer's OWN `primary_phone` ONLY when it
 *     collides with NO other customer. A COLLIDING number is NEVER auto-merged —
 *     it is returned as `prefillPhone` so the client opens the T3 link-phone
 *     prompt PRE-FILLED for the takeover-safe OTP step.
 *
 * Graceful no-op by contract: a missing/expired token, denied scopes (403), an
 * empty profile, or ANY transient error leaves the session untouched and reports
 * `enriched: false` — the existing T3 manual prompt remains the fallback, so
 * Google sign-in can never break because of People API.
 */
import "server-only";
import {
  createAddress,
  listAddresses,
  type AddressInput,
  type CustomerAddress,
} from "@/lib/customer-addresses";
import {
  findCustomerOwningVerifiedPhone,
  getCustomerById,
  normalizePhoneE164,
} from "@/lib/customer-identity";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PEOPLE_API_URL =
  "https://people.googleapis.com/v1/people/me?personFields=phoneNumbers,addresses,names";

/** The (subset of the) People API `person` payload we consume. */
interface PeoplePerson {
  names?: Array<{ displayName?: string }>;
  phoneNumbers?: Array<{ value?: string; canonicalForm?: string; type?: string }>;
  addresses?: Array<{
    formattedValue?: string;
    type?: string;
    streetAddress?: string;
    extendedAddress?: string;
    poBox?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  }>;
}

/** Outcome of an enrichment pass (mirrors the route's JSON contract). */
export interface EnrichResult {
  enriched: boolean;
  addressesAdded: number;
  /** Set ONLY when the People-API phone collides with ANOTHER customer → OTP. */
  prefillPhone?: string;
}

/** A graceful no-op outcome (used on every failure / empty / 403 path). */
const NO_OP: EnrichResult = { enriched: false, addressesAdded: 0 };

/**
 * Best-effort fetch of the Google profile for `accessToken`. Returns null on ANY
 * non-OK response (notably 401/403 when the sensitive scopes weren't granted) or
 * a network/parse error — the caller treats null as "nothing to enrich".
 */
async function fetchPerson(accessToken: string): Promise<PeoplePerson | null> {
  try {
    const res = await fetch(PEOPLE_API_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      // Diagnostic only — status + error reason, never profile data.
      console.error("[google-enrich] people api", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json: unknown = await res.json();
    if (typeof json !== "object" || json === null) return null;
    const person = json as PeoplePerson;
    console.log(
      "[google-enrich] people api ok — addresses:",
      person.addresses?.length ?? 0,
      "phones:",
      person.phoneNumbers?.length ?? 0,
    );
    return person;
  } catch (err) {
    console.error("[google-enrich] people api fetch failed", err);
    return null;
  }
}

/**
 * Map a Google People address → the structured M1 address schema. Country is
 * always coerced to "India" by the lib; we keep the Google value only as a sanity
 * check. Returns null when the address carries no usable street/city/pincode.
 */
function mapAddress(
  addr: NonNullable<PeoplePerson["addresses"]>[number],
  fullName: string | null,
): AddressInput | null {
  // Building/Floor/Flat ← streetAddress (+ poBox when present, before street).
  const buildingFloorFlat =
    [addr.poBox, addr.streetAddress].filter(Boolean).join(", ").trim() || null;
  // Road/Street ← extendedAddress (Google's secondary line).
  const roadStreet = addr.extendedAddress?.trim() || null;
  const city = addr.city?.trim() || null;
  const pincode = addr.postalCode?.trim() || null;
  const region = addr.region?.trim() || null;
  // Google's `region` is the state/province in IN; carry it to both fields so the
  // structured schema's State is populated even when only `region` is provided.
  const state = addr.region?.trim() || null;

  // Nothing usable → skip (don't create an empty row).
  if (!buildingFloorFlat && !roadStreet && !city && !pincode) return null;

  // Map Google's address `type` (home/work/other) onto our label vocabulary.
  const type = (addr.type ?? "").toLowerCase();
  const label = type === "work" ? "work" : type === "home" ? "home" : "other";

  return {
    fullName,
    phone: null,
    label,
    buildingFloorFlat,
    roadStreet,
    areaLandmark: null,
    city,
    pincode,
    region,
    state,
    isDefault: false,
  };
}

/** A stable signature for an address used to dedupe imports (idempotency). */
function addressSignature(parts: {
  buildingFloorFlat: string | null;
  roadStreet: string | null;
  city: string | null;
  pincode: string | null;
  state: string | null;
}): string {
  return [
    parts.buildingFloorFlat,
    parts.roadStreet,
    parts.city,
    parts.pincode,
    parts.state,
  ]
    .map((p) => (p ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

/** Signature of an already-saved DB address (same fields as the mapped input). */
function existingSignature(a: CustomerAddress): string {
  return addressSignature({
    buildingFloorFlat: a.buildingFloorFlat,
    roadStreet: a.roadStreet,
    city: a.city,
    pincode: a.pincode,
    state: a.state,
  });
}

/**
 * Auto-import the Google addresses onto `customerId`, idempotently. Skips any
 * address whose signature already exists for the customer (so repeat sign-ins
 * never duplicate). The FIRST address a brand-new customer saves is forced to
 * Home + default by {@link createAddress}, so no special-casing is needed here.
 * Returns the count actually created.
 */
async function importAddresses(
  customerId: string,
  addresses: NonNullable<PeoplePerson["addresses"]>,
  fullName: string | null,
): Promise<number> {
  const existing = await listAddresses(customerId);
  const seen = new Set(existing.map(existingSignature));

  let added = 0;
  for (const raw of addresses) {
    const mapped = mapAddress(raw, fullName);
    if (!mapped) continue;
    const sig = addressSignature({
      buildingFloorFlat: mapped.buildingFloorFlat ?? null,
      roadStreet: mapped.roadStreet ?? null,
      city: mapped.city ?? null,
      pincode: mapped.pincode ?? null,
      state: mapped.state ?? null,
    });
    if (seen.has(sig)) continue; // idempotent — already imported
    seen.add(sig);
    // Sequential by design: preserves source order so the FIRST imported address
    // wins the Home/default rule in `createAddress`.
    await createAddress(customerId, mapped);
    added += 1;
  }
  return added;
}

/**
 * Resolve the People-API phone for `customerId`, takeover-safe:
 *   - COLLISION with ANOTHER customer → return the E.164 number as `prefillPhone`
 *     (do NOT merge; the client opens the OTP prompt pre-filled).
 *   - No collision → set the customer's OWN `primary_phone` when it is empty
 *     (additive; never overwrite an existing number). Returns undefined.
 */
async function resolvePhone(
  customerId: string,
  phoneNumbers: NonNullable<PeoplePerson["phoneNumbers"]>,
): Promise<string | undefined> {
  // First normalizable number wins (canonicalForm is already +E.164 when present).
  let e164: string | null = null;
  for (const p of phoneNumbers) {
    e164 = normalizePhoneE164(p.canonicalForm ?? p.value);
    if (e164) break;
  }
  if (!e164) return undefined;

  const owner = await findCustomerOwningVerifiedPhone(e164);
  if (owner && owner.id !== customerId) {
    // Owned by someone else → NEVER auto-merge; defer to the OTP prompt.
    return e164;
  }

  // Nobody else owns it → set our own primary_phone only when it's empty.
  const customer = await getCustomerById(customerId);
  if (customer && !customer.primaryPhone) {
    await supabaseAdmin()
      .from("customers")
      .update({ primary_phone: e164 })
      .eq("id", customerId);
  }
  return undefined;
}

/**
 * Enrich `customerId` from the Google account behind `accessToken`. Best-effort:
 * any failure (no token, denied scopes, empty profile, transient error) returns a
 * graceful no-op so Google sign-in is never blocked and the T3 prompt remains the
 * fallback.
 */
export async function enrichFromGoogle(
  customerId: string,
  accessToken: string,
): Promise<EnrichResult> {
  if (!accessToken) {
    console.log("[google-enrich] skipped — no access token in request");
    return NO_OP;
  }

  const person = await fetchPerson(accessToken);
  if (!person) return NO_OP;

  const fullName = person.names?.find((n) => n.displayName)?.displayName ?? null;

  let addressesAdded = 0;
  if (person.addresses && person.addresses.length > 0) {
    try {
      addressesAdded = await importAddresses(
        customerId,
        person.addresses,
        fullName,
      );
      console.log("[google-enrich] addresses imported:", addressesAdded);
    } catch (err) {
      // Address import is best-effort; never let it break enrichment.
      console.error("[google-enrich] address import failed", err);
      addressesAdded = 0;
    }
  }

  let prefillPhone: string | undefined;
  if (person.phoneNumbers && person.phoneNumbers.length > 0) {
    try {
      prefillPhone = await resolvePhone(customerId, person.phoneNumbers);
    } catch {
      prefillPhone = undefined;
    }
  }

  return { enriched: true, addressesAdded, ...(prefillPhone ? { prefillPhone } : {}) };
}
