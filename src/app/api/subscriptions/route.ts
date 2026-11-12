/**
 * GET  /api/subscriptions  the signed-in customer's subscriptions.
 * POST /api/subscriptions  create one. Body:
 *   { items: [{ variantId, qty }], frequencyDays: 7|14|30, startOn: "YYYY-MM-DD",
 *     addressSnapshot: Address, slotId, paymentMethod: "upi"|"cod" }
 *
 * Everything is re-checked on the server: catalogue, prices, minimum order,
 * serviceable pincode, live slot, and which payment methods are switched on.
 * When the first delivery is already due, it comes back as `firstDelivery` so
 * the page can go straight to payment.
 */
import { createSubscription, listSubscriptionsForCustomer } from "@/lib/subscriptions";
import { errorResponse, json, readBody, requireSubscriptionsCustomer } from "@/lib/subscriptions-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const who = await requireSubscriptionsCustomer();
  if (who instanceof Response) return who;
  try {
    const subscriptions = await listSubscriptionsForCustomer(who.customerId);
    return json({ ok: true, subscriptions });
  } catch (err) {
    return errorResponse(err, "subscriptions-list-failed");
  }
}

export async function POST(request: Request): Promise<Response> {
  const who = await requireSubscriptionsCustomer();
  if (who instanceof Response) return who;
  const body = await readBody(request);
  if (!body) return json({ ok: false, error: "bad-request" }, 400);
  try {
    const result = await createSubscription(who.customerId, {
      items: Array.isArray(body.items) ? body.items : [],
      frequencyDays: body.frequencyDays,
      startOn: body.startOn,
      addressSnapshot: body.addressSnapshot,
      slotId: body.slotId,
      paymentMethod: body.paymentMethod,
    });
    return json({ ok: true, ...result }, 201);
  } catch (err) {
    return errorResponse(err, "subscription-create-failed");
  }
}
