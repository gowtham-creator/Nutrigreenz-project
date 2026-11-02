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
 * Body: `{ code: string, subtotalPaise: number, pincode?, addressText?, productIds? }`.
 * Reply: `{ ok, valid, discountPaise, reason, coupon, stacksWithLoyalty }` —
 * `valid: false` with a concrete `reason` is still a 200 (the coupon simply
 * doesn't apply). `stacksWithLoyalty: false` tells checkout that this code takes
 * points off the order; the create-order path enforces that either way.
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
  // Delivery address as text, for community-targeted coupons. Preview only, for
  // the same reason: the create-order path re-checks against the address snapshot
  // of the order itself. Capped because every byte is compared per coupon.
  const addressText = typeof body.addressText === "string" ? body.addressText.slice(0, 500) : null;
  /*
   * Product ids in the cart, for product-targeted coupons.
   *
   * These were missing, and product targeting fails CLOSED on an empty cart
   * context — so a product-targeted code was rejected here every time, even
   * when the cart held exactly the product it targets. The code was
   * unusable at checkout while looking perfectly valid in the admin.
   *
   * Client-supplied, like the pincode, and for the same reason: this is the
   * read-only quote. The create-order path re-derives both from the persisted
   * order before any money is charged, so a forged list buys a wrong preview
   * and nothing more.
   */
  const productIds = Array.isArray(body.productIds)
    ? body.productIds.filter((id): id is string => typeof id === "string" && Boolean(id))
    : [];

  const result = await validateCouponServer(code, subtotalPaise, session.customerId, {
    pincode,
    addressText,
    productIds,
  });
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
    stacksWithLoyalty: result.coupon?.stackLoyalty ?? true,
  });
}
