/**
 * POST /api/admin/orders/[id]/cancel — cancel an order that has not been delivered.
 *
 * Admin-gated with the same `orders` permission as advancing a status. Gives
 * back the order's stock, coupon and points (see `cancelOrder`), then emails
 * the customer and the operators. The cancellation is credited to the signed-in
 * admin in the order's status-event audit trail.
 *
 * Body: { reason?: string } — shown to the customer in their email, so it
 * should be written for them. `[id]` accepts the uuid id or the order number.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { cancelOrder } from "@/lib/orders";
import { sendOrderCancelledEmail } from "@/lib/order-emails";
import { afterResponse } from "@/lib/after-response";

export const runtime = "nodejs";

/** Long enough for a sentence or two; the reason lands in an email. */
const MAX_REASON = 500;

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

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is a cancel without a reason.
  }
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>).reason : null;
  const reason = typeof raw === "string" ? raw.trim().slice(0, MAX_REASON) : null;

  const { id } = await params;
  const result = await cancelOrder(id, session.email ?? "admin", reason);

  if (!result.ok) {
    const code =
      result.error === "not-found"
        ? 404
        : result.error === "unavailable"
          ? 503
          : 409; // not-cancellable, payment-pending
    return Response.json({ ok: false, error: result.error }, { status: code });
  }

  const oid = result.order?.id;
  if (oid) {
    // Registered with the platform so the send survives this response.
    afterResponse(`order ${oid} cancelled notification`, sendOrderCancelledEmail(oid));
  }

  return Response.json({ ok: true, order: result.order });
}
