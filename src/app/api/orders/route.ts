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
  failUnpaidOnlineOrder,
  listOrdersForCustomer,
  recordGatewayHandoff,
  OutOfStockError,
  UnpricedItemsError,
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
/*
 * Placing an online order calls SBIePay twice in sequence - an access token
 * (15s timeout) then order/create (25s timeout) - on top of the order insert,
 * stock reservation and reward bookkeeping. Those timeouts alone add up to 40s,
 * so the platform default can cut the request off mid-handoff, after stock is
 * reserved and before the customer is told anything. Route segment config:
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md
 */
export const maxDuration = 60;

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

  /*
   * Refuse an online order the gateway cannot actually take.
   *
   * This is the bug behind NG-26-1005 … 1008: the checkout draft is persisted to
   * localStorage, so a UPI selection made while the picker still offered it was
   * restored on a later visit even though `availableMethods()` had narrowed to
   * COD. The picker rendered UPI disabled but kept it SELECTED, checkout posted
   * `paymentMethod: "upi"`, and this route accepted it on the strength of the
   * string alone. `beginPayment` then returned null (no gateway), leaving an
   * order that was real enough to appear in the admin list and trigger an
   * order-placed email, yet could never be paid — an order nobody placed on
   * purpose and nobody could complete.
   *
   * Rejecting rather than quietly downgrading to COD is deliberate: switching a
   * customer from "pay now" to "pay the rider in cash" without asking changes
   * the terms of the sale. A 400 lets checkout re-prompt with what is on offer.
   */
  const wantsUpi = b.paymentMethod === "upi";
  if (wantsUpi && !isOnlinePaymentAvailable()) {
    return Response.json(
      { ok: false, error: "payment-unavailable", method: "upi" },
      { status: 400 },
    );
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
      // tampered body can never select a method that skips collection. By this
      // point `upi` has also been confirmed payable — see the guard above.
      paymentMethod: wantsUpi ? "upi" : "cod",
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
    //
    // Cash on Delivery only. An online order is not placed until SBI confirms
    // payment, so its email goes from the gateway callback instead; sending it
    // here told customers "order received" for payments that then failed.
    if (order.paymentMethod !== "upi") {
      afterResponse(
        `order ${order.orderNumber} placed notification`,
        sendOrderPlacedEmail(order.id),
      );
    }

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
    let payment: Awaited<ReturnType<typeof beginPayment>> = null;
    if (wantsOnline) {
      try {
        payment = isOnlinePaymentAvailable()
          ? await beginPayment({
              id: order.id,
              orderNumber: order.orderNumber,
              totalPaise: order.totalPaise,
              currency: order.currency,
              customerEmail: order.userEmail,
              customerPhone: order.userPhone,
            })
          : null;
        // An online order that got no payment session cannot be paid.
        if (!payment) throw new Error("payment-handoff-unavailable");
      } catch (err) {
        /*
         * The order exists and is already holding stock, a coupon use and the
         * customer's burned points, and it can never be paid (live today: SBI
         * error 905). Fail it and give those back before reporting the error,
         * or each failed attempt leaks stock and costs the customer points for
         * an order that was never placed. failUnpaidOnlineOrder never throws.
         */
        await failUnpaidOnlineOrder(order.id);
        throw err;
      }
    }

    /*
     * Remember SBI's reference for this order so the callback and the reconcile
     * sweep can ask the bank about it directly. Best-effort: a failure here must
     * not stop the customer reaching the payment page — see recordGatewayHandoff.
     */
    if (payment?.reference) {
      await recordGatewayHandoff(order.id, payment.reference);
    }

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
    // Lines the catalog cannot price (an old cart): nothing was created.
    if (err instanceof UnpricedItemsError) {
      return Response.json(
        { ok: false, error: "item-unavailable", titles: err.titles },
        { status: 409 },
      );
    }
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
    /*
     * Everything else is a 500, and the customer sees only "create-failed" —
     * so without this line the cause never reaches anyone. The gateway refusing
     * a handoff looks identical from outside to the database being down, and a
     * checkout that fails silently is the one failure worth paying a log line
     * for. Fields only, never the error object: a thrown fetch error can carry
     * request headers, and those hold the bank credentials.
     */
    const detail = (() => {
      if (!(err instanceof Error)) return String(err);
      // Read by shape rather than importing SbiepayError: the gateway client is
      // loaded lazily by beginPayment, and a static import here would pull it
      // into every order request whether or not one is paid online.
      const e = err as Error & { code?: string; httpStatus?: number };
      const extra = e.code ? ` code=${e.code} http=${e.httpStatus ?? "-"}` : "";
      return `${err.name}${extra}: ${err.message}`;
    })();
    console.error(`order-create-failed: ${detail}`);
    return Response.json({ ok: false, error: "create-failed" }, { status: 500 });
  }
}
