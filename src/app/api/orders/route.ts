/**
 * POST /api/orders — place an order (the checkout place-order seam).
 * GET  /api/orders — list the signed-in customer's own orders (newest first).
 *
 * Auth is the signed `ng_session` cookie, resolved to the canonical
 * `customer_id` via {@link getCustomerSession}. Totals are RECOMPUTED server-side
 * from the persisted variant/product prices + the live commerce rules — the
 * client-supplied amounts are never trusted. The order is persisted as
 * `status = 'placed'`, `payment_status = 'pending'`. Payment is opened through
 * the seam in src/lib/payments.ts, which returns null when no gateway is
 * configured — the order then stays pending and is settled as cash on delivery.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerById } from "@/lib/customer-identity";
import {
  createOrder,
  listOrdersForCustomer,
  OutOfStockError,
  type OrderLineInput,
} from "@/lib/orders";
import {
  CouponInvalidError,
  getLoyaltyConfig,
  redeemPaisePerPoint,
} from "@/lib/rewards";
import { beginPayment, isOnlinePaymentAvailable } from "@/lib/payments";
import { sendOrderPlacedEmail } from "@/lib/order-emails";
import { afterResponse } from "@/lib/after-response";

// supabase-admin + firebase-admin (jose, via session) need the Node runtime.
export const runtime = "nodejs";

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

/** Coerce one untrusted line into a typed OrderLineInput (price is server-side). */
function parseLine(raw: unknown): OrderLineInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const qty = int(o.qty);
  if (qty <= 0) return null;
  const title = str(o.title) ?? str(o.variantLabel) ?? "Item";
  return {
    productId: str(o.productId),
    variantId: str(o.variantId),
    variantSku: str(o.variantSku),
    title,
    qty,
    snapshot: typeof o.snapshot === "object" && o.snapshot !== null
      ? (o.snapshot as Record<string, unknown>)
      : (raw as Record<string, unknown>),
  };
}

export async function GET(): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, orders: [] });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const orders = await listOrdersForCustomer(session.customerId);
  return Response.json({ ok: true, orders });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
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

  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items = rawItems
    .map(parseLine)
    .filter((l): l is OrderLineInput => l !== null);
  if (items.length === 0) {
    return Response.json({ ok: false, error: "empty-cart" }, { status: 400 });
  }

  // Snapshot the customer's contact for attribution even if the FK is later cleared.
  const customer = await getCustomerById(session.customerId);

  // The client may request a redemption as points (`loyaltyPoints`) or, for the
  // current checkout, as a paise value — either way the server RE-CLAMPS it to
  // the live balance + guardrails, so this is only a request, never a claim. A
  // paise request is converted to points at the LIVE redeem rate, so an admin
  // changing the redeem ratio in loyalty config takes effect immediately (rather
  // than a hardcoded 10 paise/point).
  const directPoints = int(b.loyaltyPoints);
  let requestedPoints = Math.max(0, directPoints);
  if (directPoints <= 0) {
    const redeemedPaise = int(b.loyaltyRedeemedPaise);
    if (redeemedPaise > 0) {
      const paisePerPoint = redeemPaisePerPoint(await getLoyaltyConfig());
      requestedPoints = Math.max(0, Math.floor(redeemedPaise / paisePerPoint));
    }
  }

  try {
    const order = await createOrder({
      customerId: session.customerId,
      userEmail: customer?.primaryEmail ?? str(b.userEmail),
      userPhone: customer?.primaryPhone ?? str(b.userPhone),
      items,
      couponCode: str(b.couponCode),
      loyaltyPoints: requestedPoints,
      // Only "upi" or "cod" are accepted; anything else falls back to cod, so a
      // tampered body can never select a method that skips collection.
      paymentMethod: b.paymentMethod === "upi" ? "upi" : "cod",
      addressSnapshot:
        typeof b.addressSnapshot === "object" && b.addressSnapshot !== null
          ? (b.addressSnapshot as Record<string, unknown>)
          : null,
      slotSnapshot:
        typeof b.slotSnapshot === "object" && b.slotSnapshot !== null
          ? (b.slotSnapshot as Record<string, unknown>)
          : null,
    });

    // Order-placed confirmation email (best-effort, fire-and-forget so it never
    // delays the response). When a live gateway is wired, move this to the PAID
    // webhook so it fires on payment rather than placement.
    // The order is created with status `placed`; "confirmed" is a separate step an
    // operator takes, and has its own email. Sending the confirmation here meant
    // the customer was told it was confirmed before anyone had looked at it, then
    // received the identical mail again when it actually was.
    afterResponse(
      `order ${order.orderNumber} placed notification`,
      sendOrderPlacedEmail(order.id),
    );

    /*
     * Hand the order to the gateway when one is configured AND the customer
     * chose to pay online. A COD order must not open a payment session: it
     * would leave an abandoned transaction at the bank for money that is
     * collected in cash at the door.
     *
     * Null means no gateway, which callers treat as "cannot be paid online" —
     * never as success. The order stays `pending` either way; nothing here
     * marks it paid, because only a verified server-side callback may do that.
     */
    const wantsOnline = order.paymentMethod === "upi";
    const payment =
      wantsOnline && isOnlinePaymentAvailable()
        ? await beginPayment({
            id: order.id,
            orderNumber: order.orderNumber,
            totalPaise: order.totalPaise,
            currency: order.currency,
            customerEmail: order.userEmail,
            customerPhone: order.userPhone,
          })
        : null;

    return Response.json(
      {
        ok: true,
        orderNumber: order.orderNumber,
        order,
        payment,
      },
      { status: 201 },
    );
  } catch (err) {
    // Insufficient stock is a client-actionable conflict, not a 500 — the order
    // was rejected BEFORE persistence (no oversell), so the cart can be adjusted
    // and retried.
    if (err instanceof OutOfStockError) {
      return Response.json(
        { ok: false, error: "out-of-stock", variantIds: err.variantIds },
        { status: 409 },
      );
    }
    // A coupon that failed server re-validation is a client error, not a 500 —
    // surface the concrete reason so checkout can explain why it was dropped.
    if (err instanceof CouponInvalidError) {
      return Response.json(
        { ok: false, error: "coupon-invalid", reason: err.reason },
        { status: 400 },
      );
    }
    return Response.json({ ok: false, error: "create-failed" }, { status: 500 });
  }
}
