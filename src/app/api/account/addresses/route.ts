/**
 * GET  /api/account/addresses        — list the signed-in customer's addresses
 * POST /api/account/addresses { ... } — create a new address
 *
 * Customer address book (Milestone 2, Task T4). Addresses are attached to the
 * CANONICAL `public.customers` row, so they are shared across a person's Google
 * + phone sign-ins. Auth is the signed `ng_session` cookie, resolved to the
 * owning `customer_id` via {@link getCustomerSession}; every operation is scoped
 * strictly to that customer. Country is locked to 'India'; the FIRST address a
 * customer saves becomes the default (label 'home' when unspecified).
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import {
  createAddress,
  listAddresses,
  type AddressInput,
  type AddressLabel,
} from "@/lib/customer-addresses";
import { plainText, TEXT_LIMITS } from "@/lib/sanitize-text";

// supabase-admin + firebase-admin (jose, via session) need the Node runtime.
export const runtime = "nodejs";

function normalizeLabel(value: unknown): AddressLabel | undefined {
  if (value === "home" || value === "work" || value === "other") return value;
  return undefined;
}

/*
 * Capped and stripped, not merely trimmed.
 *
 * This is a CUSTOMER-writable surface and it had no length ceiling at all —
 * whatever was sent was trimmed and stored. Entersoft's retest reported
 * "Improper Input Length Validation" still open and was right: the earlier
 * sanitisation sweeps covered the admin routes and never reached the address
 * book. `plainText` adds the tag, template-brace and bidi-override stripping
 * the rest of the API already applies — see sanitize-text.ts for why input is
 * cleaned even though output is escaped.
 */

/** A cleaned, length-capped string. `null` clears the field; `undefined` leaves it. */
function str(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  // An entry that was pure markup collapses to "", which the lib treats as blank
  // rather than storing the payload.
  return plainText(value, max);
}

function num(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Coerce an untrusted JSON body into a typed, sanitized AddressInput. */
function parseInput(body: Record<string, unknown>): AddressInput {
  return {
    fullName: str(body.fullName, TEXT_LIMITS.name),
    phone: str(body.phone, TEXT_LIMITS.phone),
    label: normalizeLabel(body.label),
    customLabel: str(body.customLabel, TEXT_LIMITS.label),
    buildingFloorFlat: str(body.buildingFloorFlat, TEXT_LIMITS.addressLine),
    roadStreet: str(body.roadStreet, TEXT_LIMITS.addressLine),
    areaLandmark: str(body.areaLandmark, TEXT_LIMITS.addressLine),
    city: str(body.city, TEXT_LIMITS.area),
    pincode: str(body.pincode, TEXT_LIMITS.pincode),
    region: str(body.region, TEXT_LIMITS.area),
    state: str(body.state, TEXT_LIMITS.area),
    isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined,
    lat: num(body.lat),
    lng: num(body.lng),
    // country is intentionally ignored — the lib forces "India".
  };
}

export async function GET(): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, addresses: [] });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const addresses = await listAddresses(session.customerId);
  return Response.json({ ok: true, addresses });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  try {
    const address = await createAddress(
      session.customerId,
      parseInput(body as Record<string, unknown>),
    );
    return Response.json({ ok: true, address }, { status: 201 });
  } catch {
    return Response.json({ ok: false, error: "create-failed" }, { status: 500 });
  }
}
