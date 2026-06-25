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
