import "server-only";
import { sbiepayFetch } from "@/lib/sbiepay-fetch";
import { encryptPayload, decryptPayload } from "@/lib/sbiepay-crypto";
import { sbiepayKeyId, sbiepayKeySecret, sbiepayEncryptionKey } from "@/lib/payments";

/**
 * SBIePay API transport.
 *
 * Every call is the same three steps, so they live here once:
 *
 *   1. get a bearer token from /token/access using the two key headers
 *   2. POST `{ encryptedRequest }` — the payload AES-GCM encrypted
 *   3. read `{ status, data: [ciphertext] }` and decrypt the first element
 *
 * Ported from `epay_nodejs_sdk@1.0.1` rather than depending on it: the SDK
 * calls through axios, which cannot use the undici ProxyAgent that carries our
 * whitelisted static IP, so every SDK call would leave from a rotating Vercel
 * address and be refused by the bank.
 */

const API_PREFIX = "/api/transaction/v1";

/** SBI answers 200 with `status: 0` for failures — HTTP status is not enough. */
interface Envelope {
  status: number;
  data?: string[];
  errors?: { errorCode: string; errorMessage: string }[];
}

export class SbiepayError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "SbiepayError";
  }
}

/*
 * Cached access token.
 *
 * The token is a JWT with a one-hour life (`iat`/`exp` an hour apart in SBI's
 * own sample). Fetching a fresh one per call would double every payment's
 * latency and hammer their auth endpoint; caching until shortly before expiry
 * costs nothing and removes that.
 *
 * Module scope, so it survives between requests on a warm Vercel instance and
 * is simply re-fetched on a cold one.
 */
let token: { value: string; expiresAt: number } | null = null;

/** Seconds of headroom, so a token cannot expire mid-flight. */
const EXPIRY_SKEW_MS = 120_000;

/** Read `exp` from the JWT rather than assuming an hour. */
function expiryOf(jwt: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { exp?: number };
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // Unreadable token: fall through to a conservative fixed life rather than
    // treating it as immortal.
  }
  return Date.now() + 45 * 60_000;
}

function credentials(): { keyId: string; keySecret: string; encKey: string } {
  const keyId = sbiepayKeyId();
  const keySecret = sbiepayKeySecret();
  const encKey = sbiepayEncryptionKey();
  if (!keyId || !keySecret || !encKey) {
    throw new SbiepayError("SBIePay credentials are not configured", "not-configured");
  }
  return { keyId, keySecret, encKey };
}

async function accessToken(force = false): Promise<string> {
  if (!force && token && Date.now() < token.expiresAt - EXPIRY_SKEW_MS) {
    return token.value;
  }
  const { keyId, keySecret } = credentials();

  const res = await sbiepayFetch({
    path: `${API_PREFIX}/token/access`,
    method: "POST",
    headers: {
      "Merchant-API-Key-Id": keyId,
      "Merchant-API-Key-Secret": keySecret,
    },
    timeoutMs: 15_000,
  });

  let body: Envelope;
  try {
    body = JSON.parse(res.body) as Envelope;
  } catch {
    throw new SbiepayError("Auth response was not JSON", "auth-bad-response", res.status);
  }

  const value = body.data?.[0];
  if (body.status !== 1 || !value) {
    const err = body.errors?.[0];
    throw new SbiepayError(
      err?.errorMessage ?? "Could not obtain an access token",
      err?.errorCode ?? "auth-failed",
      res.status,
    );
  }

  token = { value, expiresAt: expiryOf(value) };
  return value;
}

/** Discard the cached token. Used after a 401 so the next call re-authenticates. */
export function resetSbiepayToken(): void {
  token = null;
}

/**
 * Call one SBIePay endpoint: encrypt, post, decrypt.
 *
 * `retryOnAuthFailure` covers the one case worth a second attempt — a token
 * that expired between the cache check and the bank reading it. Anything else
 * is surfaced, because retrying a payment call that failed for an unknown
 * reason risks charging twice.
 */
export async function sbiepayCall<T>(
  endpoint: string,
  payload: unknown,
  retryOnAuthFailure = true,
): Promise<T> {
  const { encKey } = credentials();
  const bearer = await accessToken();

  const encryptedRequest = await encryptPayload(encKey, payload);

  const res = await sbiepayFetch({
    path: `${API_PREFIX}/${endpoint}`,
    method: "POST",
    headers: { authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ encryptedRequest }),
    timeoutMs: 25_000,
  });

  if (res.status === 401 && retryOnAuthFailure) {
    resetSbiepayToken();
    return sbiepayCall<T>(endpoint, payload, false);
  }

  let body: Envelope;
  try {
    body = JSON.parse(res.body) as Envelope;
  } catch {
    throw new SbiepayError(
      `${endpoint} returned a non-JSON response`,
      "bad-response",
      res.status,
    );
  }

  // status 0 with HTTP 200 is SBI's failure shape.
  if (body.status !== 1 || !body.data?.[0]) {
    const err = body.errors?.[0];
    throw new SbiepayError(
      err?.errorMessage ?? `${endpoint} failed`,
      err?.errorCode ?? "call-failed",
      res.status,
    );
  }

  return JSON.parse(await decryptPayload(encKey, body.data[0])) as T;
}

/* ── Orders ───────────────────────────────────────────────────────────── */

export interface CreateOrderInput {
  /** Amount in RUPEES — SBI takes a decimal, not paise. */
  orderAmount: number;
  currencyCode: string;
  /** Our order number. Comes back on the callback, so it is how we re-identify. */
  orderRefNumber: string;
  returnUrl: string;
  /**
   * How long the payment link stays valid, in MINUTES. Maximum 30.
   *
   * SBI's documentation types this as a timestamp; it is not one. Sending an
   * epoch value in any unit is rejected with error 2104 ("expiry cannot exceed
   * 30 minutes") because the number, read as minutes, is enormous. Verified by
   * probing the sandbox with each encoding — see the note in beginPayment().
   */
  expiry?: number;
  customerId?: string;
}

export interface SbiepayOrder {
  orderAmount: number;
  currencyCode: string;
  orderRefNumber: string;
  sbiOrderRefNumber: string;
  status: "CREATED" | "ATTEMPTED" | "FAILED" | "CANCEL" | "EXPIRED" | "PAID" | "ATTEMPT_FAIL";
  /** Where to send the customer to pay. */
  transactionUrl: string;
  orderHash: string;
  returnUrl: string;
  orderRetryCount: number;
  mId: string;
}

export const createSbiepayOrder = (input: CreateOrderInput) =>
  sbiepayCall<SbiepayOrder>("order/create", input);

/* ── Order status ─────────────────────────────────────────────────────── */

/**
 * `order/status` does NOT return the flat shape `order/create` does.
 *
 * Create answers with the order object itself (`status: "CREATED"`). Status
 * answers with an ARRAY of `{ orderInfo, paymentInfo }`, where the state lives
 * at `orderInfo.orderStatus` — a different field, one level down.
 *
 * Reading `status` off this response yields `undefined`, which is never "PAID",
 * so a paid order would have been confirmed as failed. Typing the two responses
 * separately is what stops them being confused again.
 */
export interface SbiepayOrderSearchResult {
  orderInfo: {
    sbiOrderRefNumber: string;
    orderRefNumber: string;
    orderStatus: "CREATED" | "ATTEMPTED" | "FAILED" | "CANCEL" | "EXPIRED" | "PAID" | "ATTEMPT_FAIL";
    currencyCode: string;
    otherDetails: unknown;
  };
  paymentInfo:
    | {
        atrnNumber: string;
        /** Rupees, as a decimal — the order value without gateway charges. */
        orderAmount: number;
        /** Rupees, including any convenience fee. Not what we booked. */
        totalAmount: number;
        transactionStatus: "SUCCESS" | "FAILED" | "PENDING" | string;
        payMode: string;
        bankName: string | null;
        bankTxnNumber: string | null;
        currencyCode: string;
        transactionTime: number;
        CIN: string | null;
      }[]
    | null;
}

/**
 * Criteria SBI accepts for a status lookup.
 *
 * Note what is absent: our own `orderRefNumber` is not on the bank's list of
 * mandatory keys. At least one of `sbiOrderRefNumber`, `atrnNumber`, `arrnNumber`
 * or a `fromDate`/`toDate` pair must be present, and a request carrying only
 * `orderRefNumber` is rejected — which is exactly the "Order Amount is
 * required" error the self-test surfaced.
 */
export interface OrderSearchCriteria {
  sbiOrderRefNumber?: string;
  atrnNumber?: string;
  arrnNumber?: string;
  /** Epoch ms. If one date is given the other is mandatory. */
  fromDate?: number;
  toDate?: number;
  /** Narrowing only — never sufficient on its own. */
  orderRefNumber?: string;
  orderAmount?: number;
}

/**
 * Ask SBI what actually happened to an order.
 *
 * This is the authoritative check. The callback tells us a payment finished;
 * this tells us whether the bank agrees, which is what an order is marked paid
 * on. A customer closing the tab after paying never triggers a callback at all,
 * and only this can find those.
 */
export async function searchSbiepayOrder(
  criteria: OrderSearchCriteria,
): Promise<SbiepayOrderSearchResult[]> {
  if (
    !criteria.sbiOrderRefNumber &&
    !criteria.atrnNumber &&
    !criteria.arrnNumber &&
    !(criteria.fromDate && criteria.toDate)
  ) {
    throw new SbiepayError(
      "order/status needs sbiOrderRefNumber, atrnNumber, arrnNumber, or a fromDate+toDate pair",
      "insufficient-criteria",
    );
  }
  const found = await sbiepayCall<SbiepayOrderSearchResult | SbiepayOrderSearchResult[]>(
    "order/status",
    criteria,
  );
  // A single match may come back unwrapped; callers should not have to care.
  return Array.isArray(found) ? found : [found];
}
