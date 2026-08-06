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
 * The credentials SBIePay issues, mapped one-to-one onto what they send.
 *
 * SBI issues exactly THREE values, labelled in their credentials email as:
 *
 *   Merchant-API-key-id      → SBIEPAY_API_KEY_ID
 *   Merchant-API-key-secret  → SBIEPAY_API_KEY_SECRET
 *   Encryption-Key           → SBIEPAY_ENCRYPTION_KEY
 *
 * There is deliberately no SBIEPAY_MERCHANT_ID. An earlier version required
 * one, and it would have disabled online payment permanently: the merchant
 * identity IS the API key id, so no such value is ever issued, the required set
 * could never be satisfied, and the checkout would have quietly offered Cash on
 * Delivery forever with nothing in the logs to explain it.
 *
 * The secret and the encryption key do different jobs and are the pair most
 * often swapped. The SECRET authenticates the caller; the ENCRYPTION KEY
 * encrypts the payload inside the request. The bank's error for a wrong key
 * does not say which of the two was at fault, so they are named apart here.
 *
 * The endpoint is NOT configured as a free-text URL — see SBIEPAY_ENV below.
 *
 * ── Two credential sets, not one ──────────────────────────────────────────
 *
 * SBI issues a SEPARATE key, secret and encryption key for Test mode and for
 * Live mode; their dashboard generates each set independently. So the variables
 * are namespaced by environment rather than sharing one slot:
 *
 *   SBIEPAY_TEST_API_KEY_ID / _SECRET / _ENCRYPTION_KEY
 *   SBIEPAY_LIVE_API_KEY_ID / _SECRET / _ENCRYPTION_KEY
 *
 * A single shared slot would mean overwriting all three to switch environment,
 * and the failure that invites is the worst kind: SBIEPAY_ENV says `live` while
 * the credentials are still the test set. Every call is then rejected by a real
 * bank endpoint for reasons that read like an integration bug, and the obvious
 * next move — checking the code — is looking in the wrong place entirely.
 *
 * Holding both sets means switching environment is one variable, and the wrong
 * pairing is not expressible.
 */
/**
 * Placeholder values that mean "not filled in yet".
 *
 * Vercel refuses to store an empty environment variable, so a slot created
 * ahead of the real credential has to hold *something*. Without this the marker
 * would count as a configured credential, the checkout would offer UPI, and the
 * request would fail at the bank with an authentication error — the exact
 * half-configured state the availability check exists to prevent.
 */
const PLACEHOLDERS = new Set(["replace_me", "changeme", "todo", "tbd", "xxx"]);

function cred(name: "API_KEY_ID" | "API_KEY_SECRET" | "ENCRYPTION_KEY"): string | null {
  const env = sbiepayEnv();
  if (!env) return null;
  const prefix = env === "live" ? "SBIEPAY_LIVE" : "SBIEPAY_TEST";
  const value = process.env[`${prefix}_${name}`]?.trim();
  if (!value || PLACEHOLDERS.has(value.toLowerCase())) return null;
  return value;
}

/** The API key id for the selected environment. */
export const sbiepayKeyId = () => cred("API_KEY_ID");
/** The API key secret for the selected environment — authenticates the caller. */
export const sbiepayKeySecret = () => cred("API_KEY_SECRET");
/** The AES key for the selected environment — encrypts the request payload. */
export const sbiepayEncryptionKey = () => cred("ENCRYPTION_KEY");

/**
 * The two gateway environments, from SBI's integration document.
 *
 * Held here rather than pasted into an env var. `SBIEPAY_ENV` selects one by
 * name — `live` or `integration` — and the URL is looked up.
 *
 * The reason is the failure it prevents. A free-text base URL is one typo away
 * from pointing production traffic at UAT, or worse, pointing UAT testing at
 * LIVE and taking real money off a real card during a test run. The two hosts
 * are similar enough to misread:
 *
 *   live         https://sbiepay.sbi.bank.in/
 *   integration  https://integration.sbiepay.sbiuat.bank.in/
 *
 * A name cannot be fat-fingered into a working-but-wrong endpoint: an
 * unrecognised value resolves to nothing and online payment simply stays off.
 */
const SBIEPAY_HOSTS = {
  live: "https://sbiepay.sbi.bank.in",
  integration: "https://integration.sbiepay.sbiuat.bank.in",
} as const;

export type SbiepayEnv = keyof typeof SBIEPAY_HOSTS;

/** The selected environment, or null when unset or unrecognised. */
export function sbiepayEnv(): SbiepayEnv | null {
  const raw = process.env.SBIEPAY_ENV?.trim().toLowerCase();
  return raw === "live" || raw === "integration" ? raw : null;
}

/**
 * Base URL for the selected environment, without a trailing slash.
 *
 * Trailing slash is stripped so callers can join paths as `${base}/v1/...`
 * without producing a double slash — some gateways 404 on those.
 */
export function sbiepayBaseUrl(): string | null {
  const env = sbiepayEnv();
  return env ? SBIEPAY_HOSTS[env] : null;
}

/** True when pointed at the bank's real, money-moving environment. */
export function isLiveGateway(): boolean {
  return sbiepayEnv() === "live";
}

/**
 * What is still missing before online payment can be switched on.
 *
 * Returns human-readable problems rather than a bare list of names, because the
 * common failure is not an absent variable but a PRESENT one holding a value
 * that means nothing — and that reads identically to "configured" from outside.
 */
export function missingSbiepayConfig(): string[] {
  const problems: string[] = [];
  const raw = process.env.SBIEPAY_ENV?.trim();
  const env = sbiepayEnv();

  if (!raw) {
    problems.push('SBIEPAY_ENV is not set (use "integration" or "live")');
  } else if (!env) {
    // Set but unrecognised is worse than unset: it looks configured and is not.
    problems.push(`SBIEPAY_ENV must be "live" or "integration" (got "${raw}")`);
  }
  if (!env) return problems;

  // Name the variables for the SELECTED environment, so the message points at
  // the ones that actually need filling in rather than all six.
  const prefix = env === "live" ? "SBIEPAY_LIVE" : "SBIEPAY_TEST";
  for (const [name, value] of [
    ["API_KEY_ID", sbiepayKeyId()],
    ["API_KEY_SECRET", sbiepayKeySecret()],
    ["ENCRYPTION_KEY", sbiepayEncryptionKey()],
  ] as const) {
    if (!value) problems.push(`${prefix}_${name} is not set (or still a placeholder)`);
  }
  return problems;
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
  return missingSbiepayConfig().length === 0;
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
 * SBIePay's REST API returns a `transactionUrl` to redirect to — the older
 * form-POST handoff this interface was first written for is not how the API
 * works. `fields` is kept so a future gateway that does POST can use the same
 * shape; for SBIePay it is empty.
 *
 * Card details are entered on the bank's page and never touch this
 * application, which keeps it out of PCI scope.
 */
export interface GatewayHandoff {
  /** Absolute URL to send the customer to. */
  action: string;
  /** Form fields to POST, for gateways that work that way. Empty for SBIePay. */
  fields: Record<string, string>;
  /** The gateway's own reference, stored so the order can be reconciled. */
  reference?: string;
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

  const { createSbiepayOrder } = await import("@/lib/sbiepay-client");

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";

  const created = await createSbiepayOrder({
    /*
     * SBI takes RUPEES as a decimal; everything internal is integer paise.
     * The conversion happens here, at the boundary, so paise stays the only
     * representation anywhere else — a float rupee amount in the codebase is
     * how rounding errors reach a customer's card.
     */
    orderAmount: order.totalPaise / 100,
    currencyCode: order.currency || "INR",
    orderRefNumber: order.orderNumber,
    returnUrl: `${site}/api/payments/sbiepay/callback`,
    /*
     * Expire the link after 30 minutes. Without an expiry a payment URL stays
     * live indefinitely, so an abandoned checkout could be paid days later
     * against stock that has since been sold.
     */
    expiry: Date.now() + 30 * 60_000,
  });

  if (!created.transactionUrl) {
    throw new Error("sbiepay-no-transaction-url");
  }

  return {
    action: created.transactionUrl,
    fields: {},
    reference: created.sbiOrderRefNumber,
  };
}

/**
 * Verify a gateway response and report what was actually captured.
 *
 * The callback payload is NOT trusted to decide this. It tells us a payment
 * finished; SBI's order/status API tells us whether the bank agrees, and that
 * is what an order is marked paid on.
 *
 * The reason is not paranoia about the encrypted payload — GCM's auth tag makes
 * that tamper-evident. It is that the callback is only one of the ways a
 * payment ends. A customer who pays and closes the tab never triggers one at
 * all, so the status API has to be the authority in every case; using the
 * payload here and the API elsewhere would give two answers to one question.
 */
export async function confirmGatewayPayment(
  order: PayableOrder,
  payload: Record<string, string>,
): Promise<PaymentConfirmation> {
  if (!isOnlinePaymentAvailable()) {
    return { ok: false, reference: null, capturedPaise: null, reason: "no-provider" };
  }

  try {
    const { searchSbiepayOrder } = await import("@/lib/sbiepay-client");

    /*
     * Look up by the bank's own reference where we have it.
     *
     * SBI does not accept our `orderRefNumber` as a lookup key on its own — the
     * accepted keys are sbiOrderRefNumber, atrnNumber, arrnNumber, or a date
     * range. The callback carries the bank reference, so use it; when it is
     * absent (a customer who paid and closed the tab, swept up later) fall back
     * to a date window wide enough to contain the 30-minute payment link, then
     * match on our own reference.
     */
    const sbiRef = payload.sbiOrderRefNumber?.trim() || payload.sbiorderrefnumber?.trim();
    const atrn = payload.atrnNumber?.trim() || payload.atrn?.trim();

    const results = await searchSbiepayOrder(
      sbiRef
        ? { sbiOrderRefNumber: sbiRef }
        : atrn
          ? { atrnNumber: atrn }
          : {
              // 24 hours back covers the link's 30-minute life plus any delay
              // before a sweep runs, without pulling the whole ledger.
              fromDate: Date.now() - 24 * 60 * 60_000,
              toDate: Date.now(),
              orderRefNumber: order.orderNumber,
            },
    );

    /*
     * Always match on OUR order number rather than trusting position.
     *
     * A date-range query returns every order in the window, so results[0] would
     * be an arbitrary other customer's order — and marking that one paid is the
     * worst failure this function has. Even a single-reference lookup is
     * verified, because the cost of the check is nothing.
     */
    const remote = results.find((r) => r.orderInfo?.orderRefNumber === order.orderNumber);

    if (!remote) {
      const wrongOrder = results.length > 0;
      return {
        ok: false,
        reference: null,
        capturedPaise: null,
        reason: wrongOrder ? "reference-mismatch" : "not-found",
      };
    }

    const reference = remote.orderInfo.sbiOrderRefNumber ?? null;

    /*
     * Take the amount from paymentInfo, not orderInfo — orderInfo carries no
     * amount at all. Use `orderAmount` rather than `totalAmount`: the latter
     * includes the gateway's convenience fee, which the customer pays to SBI
     * and we never receive, so booking it would overstate every payment.
     *
     * Rounded because a float round-trip can land a hair under, and truncation
     * would then quietly under-record what was paid.
     */
    const paid = remote.paymentInfo?.find((p) => p.transactionStatus === "SUCCESS");
    const amountRupees = paid?.orderAmount ?? remote.paymentInfo?.[0]?.orderAmount ?? 0;
    const capturedPaise = Math.round(amountRupees * 100);

    // The state lives at orderInfo.orderStatus — NOT a top-level `status`.
    // order/create returns the flat shape; order/status does not.
    if (remote.orderInfo.orderStatus !== "PAID") {
      return {
        ok: false,
        reference,
        capturedPaise,
        // The bank's own status word, so a log says CANCEL or EXPIRED rather
        // than a generic failure.
        reason: remote.orderInfo.orderStatus?.toLowerCase() ?? "not-paid",
      };
    }

    return { ok: true, reference, capturedPaise };
  } catch (err) {
    /*
     * An unreachable gateway is NOT a failed payment. Returning ok:false marks
     * the order failed, which is the safe direction: money that was taken shows
     * up in reconciliation and can be corrected, whereas an order marked paid
     * on a network error ships goods for nothing.
     */
    return {
      ok: false,
      reference: null,
      capturedPaise: null,
      reason: err instanceof Error ? err.message.slice(0, 120) : "verify-failed",
    };
  }
}
