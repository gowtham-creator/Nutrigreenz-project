/**
 * PATCH  /api/account/addresses/:id { ... }            — update an address
 * PATCH  /api/account/addresses/:id { setDefault: true } — make it the default
 * DELETE /api/account/addresses/:id                     — delete an address
 *
 * Customer address book item operations (Milestone 2, Task T4). Auth is the
 * signed `ng_session` cookie resolved to the owning `customer_id`; every write
 * is scoped by BOTH `id` and `customer_id`, so a caller can only mutate their
 * own canonical customer's addresses. Country stays locked to 'India'.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import {
  deleteAddress,
  setDefaultAddress,
  updateAddress,
  type AddressInput,
  type AddressLabel,
} from "@/lib/customer-addresses";
import { plainText, TEXT_LIMITS } from "@/lib/sanitize-text";

export const runtime = "nodejs";

function normalizeLabel(value: unknown): AddressLabel | undefined {
  if (value === "home" || value === "work" || value === "other") return value;
  return undefined;
}

/** Capped and stripped — see the POST route beside this one. An edit needs the
 *  same ceiling as a create, or the cap is one request away from being bypassed. */
function str(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return plainText(value, max);
}

function num(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

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
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;

  // Dedicated "set as default" path (exactly one default per customer).
  if (data.setDefault === true) {
    const address = await setDefaultAddress(session.customerId, id);
    if (!address) {
      return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    return Response.json({ ok: true, address });
  }

  const address = await updateAddress(session.customerId, id, parseInput(data));
  if (!address) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return Response.json({ ok: true, address });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const removed = await deleteAddress(session.customerId, id);
  if (!removed) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
