/**
 * POST /api/admin/orders/[id]/status — advance an order's fulfilment status.
 *
 * Admin/superadmin-gated. Forward-only: the target must be a LATER stage than the
 * current one (placed → confirmed → packed → shipped → delivered). Any backward,
 * lateral, cancel or refund move is rejected — there is deliberately NO cancel
 * endpoint (§3.9 no-cancellation). The transition is credited to the signed-in
 * admin's email in the order's status-event audit trail.
 *
 * Body: { status: OrderStatus, note?: string }. `[id]` accepts the uuid id or the
 * human order number.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { advanceOrderStatus } from "@/lib/orders";
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from "@/lib/order-emails";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;
  const session = await verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
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
  const b = body as Record<string, unknown>;
  const nextStatus = typeof b.status === "string" ? b.status.trim() : "";
  const note = typeof b.note === "string" ? b.note : null;
  if (!nextStatus) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const { id } = await params;
  const byEmail = session.email ?? "admin";
  const result = await advanceOrderStatus(id, nextStatus, byEmail, note);

  if (!result.ok) {
    const code =
      result.error === "not-found"
        ? 404
        : result.error === "not-forward"
          ? 409 // conflict: backward / lateral / no-cancel
          : 400; // invalid-status
    return Response.json({ ok: false, error: result.error }, { status: code });
  }

  // Notify the customer on the shipped / delivered milestones (best-effort).
  const oid = result.order?.id;
  if (oid) {
    if (nextStatus === "shipped") void sendOrderShippedEmail(oid);
    else if (nextStatus === "delivered") void sendOrderDeliveredEmail(oid);
  }

  return Response.json({ ok: true, order: result.order });
}
