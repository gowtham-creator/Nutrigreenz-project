/**
 * GET /api/orders/[number] — the signed-in customer's OWN order detail.
 *
 * Auth is the signed `ng_session` cookie → canonical `customer_id`. Ownership is
 * enforced: the resolved order's `customer_id` MUST equal the caller's, else 404
 * (we never reveal another customer's order). `[number]` is the human order
 * number (NG-YY-XXXX); an internal uuid id is also accepted.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const { number } = await params;
  const order = await getOrder(number);
  // Not found OR not owned by this customer → 404 (no cross-customer disclosure).
  if (!order || order.customerId !== session.customerId) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  return Response.json({ ok: true, order });
}
