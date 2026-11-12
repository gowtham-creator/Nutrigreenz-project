/**
 * GET   /api/subscriptions/:id  one subscription (only the owner's).
 * PATCH /api/subscriptions/:id  change frequencyDays, paymentMethod, slotId,
 *                                addressSnapshot or items ([{ variantId, qty }]).
 * POST  /api/subscriptions/:id  an action: { action: "pause", until?: "YYYY-MM-DD" }
 *                                | { action: "resume" } | { action: "skip" }
 *                                | { action: "cancel", reason?: string }
 */
import {
  cancelSubscription,
  getSubscriptionForCustomer,
  pauseSubscription,
  resumeSubscription,
  skipNextDelivery,
  updateSubscription,
  type SubscriptionItemInput,
} from "@/lib/subscriptions";
import { errorResponse, json, readBody, requireSubscriptionsCustomer } from "@/lib/subscriptions-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const who = await requireSubscriptionsCustomer();
  if (who instanceof Response) return who;
  const { id } = await params;
  try {
    const subscription = await getSubscriptionForCustomer(who.customerId, id);
    if (!subscription) return json({ ok: false, error: "not-found" }, 404);
    return json({ ok: true, subscription });
  } catch (err) {
    return errorResponse(err, "subscription-get-failed");
  }
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const who = await requireSubscriptionsCustomer();
  if (who instanceof Response) return who;
  const { id } = await params;
  const body = await readBody(request);
  if (!body) return json({ ok: false, error: "bad-request" }, 400);
  try {
    const subscription = await updateSubscription(who.customerId, id, {
      frequencyDays: body.frequencyDays,
      paymentMethod: body.paymentMethod,
      slotId: body.slotId,
      addressSnapshot: body.addressSnapshot,
      items: Array.isArray(body.items) ? (body.items as SubscriptionItemInput[]) : undefined,
    });
    return json({ ok: true, subscription });
  } catch (err) {
    return errorResponse(err, "subscription-update-failed");
  }
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const who = await requireSubscriptionsCustomer();
  if (who instanceof Response) return who;
  const { id } = await params;
  const body = await readBody(request);
  if (!body) return json({ ok: false, error: "bad-request" }, 400);
  try {
    switch (body.action) {
      case "pause":
        return json({ ok: true, subscription: await pauseSubscription(who.customerId, id, body.until) });
      case "resume":
        return json({ ok: true, subscription: await resumeSubscription(who.customerId, id) });
      case "skip":
        return json({ ok: true, subscription: await skipNextDelivery(who.customerId, id) });
      case "cancel":
        return json({ ok: true, subscription: await cancelSubscription(who.customerId, id, body.reason) });
      default:
        return json({ ok: false, error: "bad-action" }, 400);
    }
  } catch (err) {
    return errorResponse(err, "subscription-action-failed");
  }
}
