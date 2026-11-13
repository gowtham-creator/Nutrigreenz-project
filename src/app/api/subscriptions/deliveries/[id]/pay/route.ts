/**
 * POST /api/subscriptions/deliveries/:id/pay
 *
 * Pay for one due delivery. Creates its order (server prices, subscriber
 * discount, stock held) and returns the SBIePay handoff in the same shape as
 * POST /api/orders: { orderNumber, payment: { action, fields } | null }.
 * A cash on delivery subscription gets its order and `payment: null`.
 */
import { payForDelivery } from "@/lib/subscriptions";
import { errorResponse, json, requireSubscriptionsCustomer } from "@/lib/subscriptions-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Same budget as POST /api/orders: two sequential SBIePay calls after the insert.
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await requireSubscriptionsCustomer();
  if (who instanceof Response) return who;
  const { id } = await params;
  try {
    const result = await payForDelivery(who.customerId, id);
    return json({ ok: true, ...result }, 201);
  } catch (err) {
    return errorResponse(err, "subscription-pay-failed");
  }
}
