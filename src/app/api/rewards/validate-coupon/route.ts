/**
 * POST /api/rewards/validate-coupon — server-side coupon check for checkout.
 *
 * Auth is the signed `ng_session` cookie resolved to the canonical `customer_id`
 * via {@link getCustomerSession}. The discount and every gate (active, validity
 * window, minimum order, global + per-customer usage limits) are computed
 * server-side from the coupon catalogue — the client's claimed amount is never
 * trusted. This is the read-only quote; the authoritative charge happens again
 * inside the create-order path when the order is actually placed.
 *
 * Body: `{ code: string, subtotalPaise: number }`.
 * Reply: `{ ok, valid, discountPaise, reason, coupon }` — `valid: false` with a
 * concrete `reason` is still a 200 (the coupon simply doesn't apply).
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import { validateCouponServer } from "@/lib/rewards";

// supabase-admin + jose (via the session) need the Node runtime.
export const runtime = "nodejs";

function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return Response.json({ ok: false, error: "missing-code" }, { status: 400 });
  }
  const subtotalPaise = Math.max(0, int(body.subtotalPaise));
  // Delivery pincode for area-targeted coupons. This is the QUOTE path, so the
  // client-supplied pincode is accepted for the preview only — the create-order
  // path re-checks against the order's real address snapshot before charging.
  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : null;

  const result = await validateCouponServer(code, subtotalPaise, session.customerId, { pincode });
  return Response.json({
    ok: true,
    valid: result.valid,
    discountPaise: result.discountPaise,
    reason: result.reason,
    coupon: result.coupon
      ? {
          code: result.coupon.code,
          kind: result.coupon.kind,
          value: result.coupon.value,
          minOrderPaise: result.coupon.minOrderPaise,
          capPaise: result.coupon.capPaise,
        }
      : null,
  });
}
