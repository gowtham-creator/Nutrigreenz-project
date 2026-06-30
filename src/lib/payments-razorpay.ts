/**
 * Payment gateway seam (Razorpay) — Phase C.
 *
 * This is the SINGLE integration point for online payment. Today it is a
 * deliberate NO-OP: Razorpay KYC + live keys have not landed, so we do NOT
 * fabricate a "paid" state. Orders are created with `payment_status = 'pending'`
 * and stay there until a real gateway verification flips them.
 *
 * When the keys arrive, fill in the two functions below — `createPaymentIntent`
 * (server-side `orders.create`) and `verifyPayment` (HMAC signature check on the
 * checkout callback / webhook) — WITHOUT touching the orders data model. Callers
 * already treat a `null` intent as "no online payment configured yet" and leave
 * the order pending, so wiring the real gateway is purely additive.
 *
 * Server-only — import from Node route handlers, never client/Edge. The secret
 * key must never reach the browser.
 */
import "server-only";

/** True once Razorpay credentials are present in the environment. */
export const isRazorpayConfigured = Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
);

/** The minimal order shape the payment seam needs to open an intent. */
export interface PayableOrder {
  /** Internal order id (uuid). */
  id: string;
  /** Human order number, e.g. "NG-26-1042". */
  orderNumber: string;
  /** Amount to charge, in integer paise. */
  totalPaise: number;
  /** ISO currency code, e.g. "INR". */
  currency: string;
}

/**
 * A gateway payment intent the client uses to open the checkout. `null` means
 * "no online payment configured" — the order remains `pending` and the customer
 * is shown a confirmation without an online charge (Phase-C interim behaviour).
 */
export interface PaymentIntent {
  /** Gateway key (e.g. "razorpay"). */
  provider: string;
  /** Gateway order/intent id to hand to the client SDK. */
  intentId: string;
  /** Amount in paise (echoed back for the client SDK). */
  amountPaise: number;
  currency: string;
  /** Publishable key id for the browser SDK (never the secret). */
  keyId: string;
}

/**
 * Open a payment intent for an order.
 *
 * STUB: returns `null` while Razorpay is unconfigured, so the order is left
 * `payment_status = 'pending'`. When live, this should call Razorpay
 * `orders.create({ amount: totalPaise, currency })` and return the intent so the
 * client can launch checkout. It must never throw on the unconfigured path.
 */
export async function createPaymentIntent(
  _order: PayableOrder,
): Promise<PaymentIntent | null> {
  if (!isRazorpayConfigured) return null;
  // TODO(razorpay): create the gateway order and return a real PaymentIntent.
  //   const rp = new Razorpay({ key_id, key_secret });
  //   const intent = await rp.orders.create({
  //     amount: _order.totalPaise, currency: _order.currency,
  //     receipt: _order.orderNumber, notes: { orderId: _order.id },
  //   });
  //   return { provider: "razorpay", intentId: intent.id,
  //     amountPaise: _order.totalPaise, currency: _order.currency, keyId };
  return null;
}

/** The fields a Razorpay checkout callback / webhook hands back for verification. */
export interface PaymentVerification {
  /** Gateway order/intent id (razorpay_order_id). */
  intentId: string;
  /** Gateway payment id (razorpay_payment_id). */
  paymentId: string;
  /** HMAC signature (razorpay_signature) to verify against the secret. */
  signature: string;
}

/** Outcome of a verification attempt — only `ok: true` should mark an order paid. */
export interface PaymentVerificationResult {
  ok: boolean;
  /** The gateway payment id to store on the order when `ok`. */
  paymentRef?: string;
  /** Reason when verification failed (for logs; never shown raw to users). */
  reason?: string;
}

/**
 * Verify a payment callback/webhook signature.
 *
 * STUB: returns `{ ok: false }` while Razorpay is unconfigured — we never mark an
 * order paid without a real, verified signature. When live, this should recompute
 * `HMAC_SHA256(intentId + "|" + paymentId, key_secret)` and compare (constant
 * time) against `signature`, returning `{ ok: true, paymentRef: paymentId }` on a
 * match.
 */
export async function verifyPayment(
  _input: PaymentVerification,
): Promise<PaymentVerificationResult> {
  if (!isRazorpayConfigured) {
    return { ok: false, reason: "gateway-not-configured" };
  }
  // TODO(razorpay): const expected = crypto
  //     .createHmac("sha256", key_secret)
  //     .update(`${_input.intentId}|${_input.paymentId}`)
  //     .digest("hex");
  //   const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(_input.signature));
  //   return ok ? { ok: true, paymentRef: _input.paymentId } : { ok: false, reason: "bad-signature" };
  return { ok: false, reason: "not-implemented" };
}
