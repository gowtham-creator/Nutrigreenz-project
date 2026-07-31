import "server-only";

/**
 * The payment seam.
 *
 * One place decides whether online payment is available and, when it is, how an
 * order is handed to the gateway. Everything else in the app asks this module
 * rather than knowing about any particular provider — so switching from
 * Razorpay to SBIePay, or running neither, is a change here and nowhere else.
 *
 * The rule this module exists to enforce: **an order is never marked paid
 * because the browser said so.** A redirect back from a gateway carries
 * parameters the customer can edit. Payment is confirmed only by
 * {@link confirmGatewayPayment}, which re-checks the amount and order against
 * the gateway's own signed response on the server.
 *
 * Today `PAYMENT_PROVIDER` is unset, so {@link isOnlinePaymentAvailable} is
 * false and the checkout offers Cash on Delivery alone. It does not offer a UPI
 * button that fails, and it never fabricates a paid state — an order that looks
 * paid but was never charged is far worse than one honest missing option.
 */

/** How a customer pays. Mirrors the `orders.payment_method` check constraint. */
export type PaymentMethod = "upi" | "cod";

/** Which gateway is wired, if any. */
export type PaymentProvider = "sbiepay" | "none";

export function currentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === "sbiepay" ? "sbiepay" : "none";
}

/**
 * True when a real gateway is configured AND holds every credential it needs.
 *
 * Checked as a set rather than one flag: a half-configured gateway would let
 * the checkout offer UPI and then fail at the redirect, after the customer has
 * entered an address and committed to the order. Better to not offer it.
 */
export function isOnlinePaymentAvailable(): boolean {
  if (currentProvider() !== "sbiepay") return false;
  return Boolean(
    process.env.SBIEPAY_MERCHANT_ID &&
      process.env.SBIEPAY_API_KEY &&
      process.env.SBIEPAY_API_SECRET &&
      process.env.SBIEPAY_BASE_URL,
  );
}

/** The methods the checkout should show, in display order. */
export function availableMethods(): PaymentMethod[] {
  return isOnlinePaymentAvailable() ? ["upi", "cod"] : ["cod"];
}

/** The minimum an order needs for the gateway to open a transaction. */
export interface PayableOrder {
  id: string;
  orderNumber: string;
  /** Amount to charge, integer paise. Never a float — see `docs` on money. */
  totalPaise: number;
  currency: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

/**
 * Where to send the customer to pay.
 *
 * SBIePay uses a browser form-POST redirect, so this returns the target plus the
 * fields to post rather than a URL to follow. That model is deliberate: the card
 * details are entered on the bank's page, never ours, which keeps this
 * application out of PCI scope entirely.
 */
export interface GatewayHandoff {
  /** Absolute URL of the gateway's payment page. */
  action: string;
  /** Hidden form fields to POST, already encrypted per the gateway's spec. */
  fields: Record<string, string>;
}

/** Outcome of verifying a gateway response, server-side. */
export interface PaymentConfirmation {
  ok: boolean;
  /** The gateway's transaction reference, stored for settlement reconciliation. */
  reference: string | null;
  /** Amount the gateway says was actually captured, integer paise. */
  capturedPaise: number | null;
  /** Machine-readable reason when `ok` is false — logged, never shown raw. */
  reason?: string;
}

/**
 * Begin a payment. Returns null when no gateway is configured, which callers
 * must treat as "this order cannot be paid online" — not as success.
 */
export async function beginPayment(order: PayableOrder): Promise<GatewayHandoff | null> {
  if (!isOnlinePaymentAvailable()) return null;

  /*
   * SBIePay adapter goes here once their integration kit arrives.
   *
   * It cannot be written from the credentials alone: the request body is AES
   * encrypted, and the kit specifies the key length, the mode (CBC vs ECB), IV
   * handling and padding. Guessing any of those produces a request the bank
   * rejects with a generic error, so this deliberately stays unimplemented
   * rather than shipping a plausible-looking encryption that cannot work.
   *
   * Everything around it — the routes, the order transitions, the admin
   * surfacing — is already built and exercised by the COD path, so only these
   * two functions need filling in.
   */
  throw new Error("sbiepay-adapter-not-implemented");
}

/**
 * Verify a gateway response and report what was actually captured.
 *
 * Called from the server-side callback with the gateway's own payload. It must
 * re-derive the amount and order reference from the *signed* response — the
 * query string the browser arrives with is attacker-controlled and is only ever
 * used to look up which order to verify, never to decide that it is paid.
 */
export async function confirmGatewayPayment(
  _order: PayableOrder,
  _payload: Record<string, string>,
): Promise<PaymentConfirmation> {
  if (!isOnlinePaymentAvailable()) {
    return { ok: false, reference: null, capturedPaise: null, reason: "no-provider" };
  }
  throw new Error("sbiepay-adapter-not-implemented");
}
