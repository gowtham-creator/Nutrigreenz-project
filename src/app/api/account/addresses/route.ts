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

// supabase-admin + firebase-admin (jose, via session) need the Node runtime.
export const runtime = "nodejs";

function normalizeLabel(value: unknown): AddressLabel | undefined {
  if (value === "home" || value === "work" || value === "other") return value;
  return undefined;
}

function str(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value.trim() : undefined;
}

function num(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Coerce an untrusted JSON body into a typed, sanitized AddressInput. */
function parseInput(body: Record<string, unknown>): AddressInput {
  return {
    fullName: str(body.fullName),
    phone: str(body.phone),
    label: normalizeLabel(body.label),
    customLabel: str(body.customLabel),
    buildingFloorFlat: str(body.buildingFloorFlat),
    roadStreet: str(body.roadStreet),
    areaLandmark: str(body.areaLandmark),
    city: str(body.city),
    pincode: str(body.pincode),
    region: str(body.region),
    state: str(body.state),
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
