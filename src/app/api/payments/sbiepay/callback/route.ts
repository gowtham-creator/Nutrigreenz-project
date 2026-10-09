import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { recordCallback, decryptCallback, flattenDecrypted } from "@/lib/sbiepay-callback-log";
import { getOrder, onOnlineOrderPaid, transitionOrderPayment } from "@/lib/orders";
import { confirmGatewayPayment, isOnlinePaymentAvailable } from "@/lib/payments";
import { sendOrderPlacedEmail } from "@/lib/order-emails";
import { afterResponse } from "@/lib/after-response";

export const runtime = "nodejs";
// Never cached: this is the moment money is confirmed.
export const dynamic = "force-dynamic";

/**
 * The gateway return endpoint. SBIePay sends the customer's browser here after
 * they pay, and separately posts a server-to-server notification to the same
 * place.
 *
 * ── The rule this route exists to enforce ─────────────────────────────────
 *
 * An order is marked paid because the GATEWAY says so, verified on this server,
 * and for no other reason. The customer arrives here with a payload they could
 * have edited — a redirect is just a URL — so the incoming parameters are used
 * ONLY to identify which order to ask about. Whether it was paid, and for how
 * much, comes from `confirmGatewayPayment`, which checks the gateway's own
 * signature.
 *
 * The amount is re-checked too. A signed response that says ₹1 was captured on
 * a ₹2,200 order is a valid signature over a wrong amount, and treating that as
 * payment would be a way to buy anything for a rupee.
 *
 * ── Why it always redirects ───────────────────────────────────────────────
 *
 * A person is on the other end of this request. Whatever happens, they get sent
 * to a page that tells them where they stand. A JSON error body would leave a
 * customer who has just been charged staring at a stack trace.
 */

/**
 * The bank's own words for a payment that is over and did not succeed.
 *
 * Only these close an order as failed here. `confirmGatewayPayment` also
 * returns ok:false when it could not get an answer at all — a network error,
 * no matching record yet, a status that is not final — and none of those mean
 * the money was not taken. The reconcile sweep keeps the same rule (its own
 * set adds "not-found", which is only conclusive once the payment window has
 * closed, as it has for every order the sweep looks at).
 */
const BANK_DECLINED = new Set(["failed", "cancel", "expired", "attempt_fail"]);

/** Where to send the customer, given what we concluded. */
function redirectTo(path: string, params: Record<string, string>): Response {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";
  const url = new URL(path, site);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 303);
}

/** Collect the gateway's fields whether they arrive as a form post or a query. */
async function readPayload(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams) out[k] = v;

  if (request.method === "POST") {
    const type = request.headers.get("content-type") ?? "";
    try {
      if (type.includes("application/json")) {
        const body = (await request.json()) as Record<string, unknown>;
        for (const [k, v] of Object.entries(body)) out[k] = String(v);
      } else {
        // SBIePay posts form-encoded on the browser return leg.
        for (const [k, v] of (await request.formData()).entries()) {
          out[k] = typeof v === "string" ? v : "";
        }
      }
    } catch {
      // A malformed body is not fatal on its own — the query string may still
      // carry the order reference, and the verification step decides the rest.
    }
  }
  return out;
}

/**
 * Which order this callback is about.
 *
 * Called ONLY with fields lifted out of the decrypted payload. The plaintext
 * query string and form body are attacker-controlled — anyone can request
 * `GET /api/payments/sbiepay/callback?orderRefNumber=NG-…` — whereas the
 * ciphertext is GCM-authenticated, so a successful decryption is the proof that
 * SBI produced the payload. Taking the reference from anywhere else would let a
 * stranger point this route at any order.
 *
 * Several field names are tried because the browser leg and the server
 * notification do not always agree on spelling, and failing to find the order
 * would strand a real payment.
 */
function orderNumberFrom(payload: Record<string, string>): string | null {
  /*
   * `orderRefNumber` first — it is SBI's own name for our order reference, the
   * field we set in order/create and the one their status API echoes back.
   *
   * It was missing from this list, so every real payment would have failed to
   * find its order and landed on /checkout/failed?reason=no-reference, with the
   * money taken. The rest are kept as fallbacks: the browser return leg and the
   * server notification do not always agree on spelling, and a payment we
   * cannot match to an order is the worst outcome this route has.
   */
  for (const key of [
    "orderRefNumber",
    "orderRefNo",
    "merchantOrderNo",
    "orderNumber",
    "order_number",
    "orderId",
    "udf1",
  ]) {
    const value = payload[key]?.trim();
    if (value) return value;
  }

  // Case-insensitive sweep, because a gateway that changes `orderRefNumber` to
  // `OrderRefNumber` should not cost a customer their payment.
  const wanted = new Set([
    "orderrefnumber",
    "orderrefno",
    "merchantorderno",
    "ordernumber",
    "order_number",
    "orderid",
  ]);
  for (const [key, value] of Object.entries(payload)) {
    if (wanted.has(key.toLowerCase().replace(/[\s-]/g, "")) && value?.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function handle(request: Request): Promise<Response> {
  if (!isSupabaseConfigured || !isOnlinePaymentAvailable()) {
    return redirectTo("/checkout/failed", { reason: "unavailable" });
  }

  const payload = await readPayload(request);

  /*
   * Log the field NAMES the gateway sent, never the values.
   *
   * The names are the thing that has bitten us: `orderRefNumber` was missing
   * from the lookup list above and nothing recorded what actually arrived, so
   * the mismatch was invisible. Values are deliberately excluded — this payload
   * describes somebody's payment, and it does not belong in a log.
   */
  console.info("[sbiepay-callback] fields:", Object.keys(payload).sort().join(","));

  /*
   * Decrypt before doing anything else.
   *
   * A real return carries only `encryptedPaymentFinalResponse` and `mId`. The
   * order reference is NOT in the plaintext — it sits inside the ciphertext at
   * [0].orderInfo.orderRefNumber. Reading the plaintext for it therefore fails
   * on every genuine payment, and the customer is redirected to
   * /checkout/failed?reason=no-reference seconds after being charged. The
   * reconcile cron picks the order up within fifteen minutes, so the money is
   * not lost, but the shopper has already been told it failed.
   *
   * Flattening the decrypted fields gives the lookup and the confirmation step
   * the flat names they already expect — orderRefNumber for the order,
   * sbiOrderRefNumber and atrnNumber for the status query — so neither has to
   * change.
   */
  const decryption = await decryptCallback(payload);
  /*
   * ONLY the decrypted fields. The raw payload is not merged in: it is
   * unauthenticated, so neither the order reference nor the bank references
   * (sbiOrderRefNumber, atrnNumber) used for the status lookup may come from it.
   * If decryption failed this is empty, and we stop below without touching any
   * order — see the no-reference redirect.
   */
  const fields = flattenDecrypted(decryption.decrypted);

  const orderNumber = orderNumberFrom(fields);

  /*
   * Record the arrival verbatim — encrypted as received, and decrypted.
   *
   * Deliberately BEFORE the no-reference bail below, because a callback we
   * cannot match to an order is precisely the one worth having on file. It is
   * also not awaited: this is a diagnostic record, and a customer who has just
   * been charged must not wait on a logging insert, nor lose their redirect if
   * one fails.
   */
  void recordCallback({ method: request.method, orderNumber, payload, decryption });

  if (!orderNumber) {
    // Either the payload did not decrypt (a forged or corrupted request) or it
    // named no order. Neutral result, no lookup, no state change.
    console.warn("[sbiepay-callback] no authenticated order reference in callback");
    return redirectTo("/checkout/failed", { reason: "no-reference" });
  }

  // getOrder resolves either an id or an order number.
  const order = await getOrder(orderNumber);
  if (!order) {
    return redirectTo("/checkout/failed", { reason: "unknown-order" });
  }

  /*
   * Online orders only. A cash-on-delivery order sits at payment_status
   * "pending" by design, and order dispatch drops "failed" orders, so acting on
   * a callback that names one could make a real order vanish. A genuine gateway
   * payment is always for an order we opened a gateway session for.
   */
  if (order.paymentMethod !== "upi") {
    console.warn("[sbiepay-callback] callback names a non-online order, ignoring");
    return redirectTo("/checkout/failed", { reason: "unknown-order" });
  }

  /*
   * Already settled: stop here and send them to the receipt.
   *
   * The browser return and the server notification both land on this route, and
   * a customer may also refresh it. Without this, a second arrival would
   * re-process a completed payment.
   */
  if (order.paymentStatus === "paid") {
    return redirectTo("/checkout/success", { order: order.orderNumber });
  }

  const result = await confirmGatewayPayment(
    {
      id: order.id,
      orderNumber: order.orderNumber,
      totalPaise: order.totalPaise,
      currency: order.currency,
      customerEmail: order.userEmail,
      customerPhone: order.userPhone,
      createdAt: order.createdAt,
      gatewayRef: order.paymentRef,
    },
    /*
     * The decrypted fields, not the raw two.
     *
     * confirmGatewayPayment prefers a direct lookup on sbiOrderRefNumber or
     * atrnNumber and only falls back to a date-range scan when it has neither
     * (the order's saved gatewayRef counts as one). Both bank references live
     * inside the ciphertext, so passing the plaintext payload meant every real
     * payment took the slow path and matched by scanning a window of orders —
     * more work at the bank, and more ways to come back empty.
     */
    fields,
  );

  if (!result.ok) {
    /*
     * Close the order only when the bank itself said no. Anything else leaves
     * it pending: the reconcile sweep revisits pending orders and nothing else,
     * so marking an unanswered check "failed" wrote off a payment that may well
     * have been taken, and nothing would ever look at it again.
     *
     * Only from pending. A payment already confirmed must never be walked back
     * by a late-arriving failure notification for the same order.
     */
    if (result.reason && BANK_DECLINED.has(result.reason)) {
      await transitionOrderPayment(order.id, "pending", "failed", result.reference ?? null);
    }
    return redirectTo("/checkout/failed", {
      order: order.orderNumber,
      reason: result.reason ?? "declined",
    });
  }

  /*
   * Verified — but check the amount before believing it.
   *
   * A correctly signed response can still state a captured amount that is not
   * what the order costs. Accepting it would let anyone pay a rupee for
   * anything. A short capture is recorded as failed and left for a human,
   * because it means something is wrong that code should not paper over.
   */
  if (result.capturedPaise !== null && result.capturedPaise < order.totalPaise) {
    await transitionOrderPayment(order.id, "pending", "failed", result.reference ?? null);
    return redirectTo("/checkout/failed", {
      order: order.orderNumber,
      reason: "amount-mismatch",
    });
  }

  /*
   * Atomic. The browser return and SBI's server notification both land here and
   * can be in flight together; a plain read-then-write lets both believe they
   * were the one that marked it paid, and anything conditional on that
   * transition then happens twice. Exactly one caller gets a row back.
   *
   * Losing the race is a success, not an error — it means the other request
   * already confirmed this payment, so the customer still goes to the receipt.
   */
  const won = await transitionOrderPayment(
    order.id,
    // A 'failed' order is recoverable: the customer may have paid on a retry, or
    // late, after a decline was recorded. The bank says PAID, so it is paid.
    ["pending", "failed"],
    "paid",
    result.reference ?? null,
  );
  // The order-placed email for an online order is sent here, on payment, not
  // when it was created. Only the caller that won the transition sends it, so
  // the browser return and the server notification cannot both email.
  if (won) {
    // Earn the loyalty points (online orders earn on payment) and re-take any
    // stock/coupon/points released while the order was marked failed.
    await onOnlineOrderPaid(won);
    afterResponse(
      `order ${order.orderNumber} placed notification`,
      sendOrderPlacedEmail(order.id),
    );
  }
  return redirectTo("/checkout/success", { order: order.orderNumber });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
