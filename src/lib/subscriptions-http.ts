/**
 * Shared plumbing for the /api/subscriptions routes: the feature switch, the
 * signed-in customer, and turning lifecycle errors into the right status code.
 */
import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { featureOffResponse, isFeatureEnabled } from "@/lib/feature-flags";
import { getCustomerSession } from "@/lib/customer-session";
import {
  BelowMinimumOrderError,
  NotServiceableError,
  OutOfStockError,
  UnpricedItemsError,
} from "@/lib/orders";
import { SubscriptionError, type SubscriptionErrorCode } from "@/lib/subscriptions";

const NO_STORE = { "cache-control": "no-store" };

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/** The customer id, or the Response to return instead (feature off / unavailable / signed out). */
export async function requireSubscriptionsCustomer(): Promise<{ customerId: string } | Response> {
  if (!(await isFeatureEnabled("subscriptions"))) return featureOffResponse();
  if (!isSupabaseConfigured) return json({ ok: false, error: "unavailable" }, 503);
  const session = await getCustomerSession();
  if (!session) return json({ ok: false, error: "unauthenticated" }, 401);
  return { customerId: session.customerId };
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const STATUS: Record<SubscriptionErrorCode, number> = {
  "bad-frequency": 400,
  "bad-start-date": 400,
  "no-items": 400,
  "too-many-items": 400,
  "item-unavailable": 409,
  "below-minimum": 409,
  "bad-address": 400,
  "not-serviceable": 409,
  "slot-unavailable": 409,
  "payment-unavailable": 400,
  "not-found": 404,
  "bad-state": 409,
  busy: 409,
};

/** Map a thrown error to a response. Unknown errors are logged and answered 500. */
export function errorResponse(err: unknown, label: string): Response {
  if (err instanceof SubscriptionError) {
    return json({ ok: false, error: err.code, ...(err.detail ?? {}) }, STATUS[err.code]);
  }
  if (err instanceof OutOfStockError) return json({ ok: false, error: "out-of-stock", variantIds: err.variantIds }, 409);
  if (err instanceof BelowMinimumOrderError) {
    return json({ ok: false, error: "below-minimum", minOrderPaise: err.minOrderPaise }, 409);
  }
  if (err instanceof NotServiceableError) return json({ ok: false, error: "not-serviceable", pincode: err.pincode }, 409);
  if (err instanceof UnpricedItemsError) return json({ ok: false, error: "item-unavailable", titles: err.titles }, 409);
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(`${label}: ${detail}`);
  return json({ ok: false, error: "server-error" }, 500);
}
