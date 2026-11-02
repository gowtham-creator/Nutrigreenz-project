/**
 * POST /api/admin/orders/bundles/pickups — assign a captain, date and slot to a
 * community's orders, then tell each customer when to expect them.
 *
 * Gated like the bundle list it sits on. The orders still unassigned are the only
 * ones linked, so a stale screen cannot move an order off another run.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { logActivity } from "@/lib/activity-log";
import { afterResponse } from "@/lib/after-response";
import { deliveryWhenLabel } from "@/lib/community-label";
import { assignCommunityDelivery, type AssignError } from "@/lib/community-delivery";
import { sendDeliveryScheduledEmail } from "@/lib/order-emails";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const STATUS: Record<AssignError, number> = {
  "invalid-date": 400,
  "past-date": 400,
  "invalid-window": 400,
  "no-orders": 409,
  "captain-unavailable": 409,
  "captain-network-off": 409,
  unavailable: 503,
};

const text = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(request: Request): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;
  const admin = await verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!admin) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const orderIds = Array.isArray(body.orderIds)
    ? body.orderIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 500)
    : [];
  const deliveryDate = text(body.deliveryDate, 10);
  const windowText = text(body.windowText, 120);

  const result = await assignCommunityDelivery({
    orderIds,
    captainId: text(body.captainId, 64),
    deliveryDate,
    windowText,
    community: text(body.community, 200) || "Community",
    address: text(body.address, 300) || null,
    byEmail: admin.email,
  });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: STATUS[result.error] });
  }

  await logActivity({
    actorEmail: admin.email,
    actorRole: admin.role,
    action: "delivery.assign",
    target: result.pickupId,
    meta: { orders: result.orderIds.length, deliveryDate, windowText },
  });

  const when = deliveryWhenLabel(deliveryDate, windowText);
  afterResponse(
    "delivery-scheduled-emails",
    Promise.allSettled(result.orderIds.map((id) => sendDeliveryScheduledEmail(id, when))),
  );
  return Response.json({ ok: true, pickupId: result.pickupId, orders: result.orderIds.length });
}
