/**
 * SBIePay return/notification callback — the only place an online order is
 * marked paid.
 *
 * Decryption, the order store, the gateway status check and the email senders
 * are mocked at their module boundaries. `flattenDecrypted` is the real one, so
 * the test also covers lifting `orderRefNumber` out of the decrypted envelope.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  isOnlinePaymentAvailable: vi.fn(),
  confirmGatewayPayment: vi.fn(),
  getOrder: vi.fn(),
  transitionOrderPayment: vi.fn(),
  decryptCallback: vi.fn(),
  recordCallback: vi.fn(),
  sendOrderPlacedEmail: vi.fn(),
  afterResponse: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/sbiepay-callback-log", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/sbiepay-callback-log")>();
  return { ...real, decryptCallback: m.decryptCallback, recordCallback: m.recordCallback };
});
vi.mock("@/lib/orders", () => ({
  getOrder: m.getOrder,
  transitionOrderPayment: m.transitionOrderPayment,
}));
vi.mock("@/lib/payments", () => ({
  confirmGatewayPayment: m.confirmGatewayPayment,
  isOnlinePaymentAvailable: m.isOnlinePaymentAvailable,
  sbiepayEncryptionKey: vi.fn(() => null),
}));
vi.mock("@/lib/order-emails", () => ({ sendOrderPlacedEmail: m.sendOrderPlacedEmail }));
vi.mock("@/lib/after-response", () => ({ afterResponse: m.afterResponse }));

import { GET, POST } from "./route";

const SITE = "https://shop.test";
const ORDER_NUMBER = "NG-26-1001";

const ORDER = {
  id: "ord-1",
  orderNumber: ORDER_NUMBER,
  totalPaise: 220_000,
  currency: "INR",
  userEmail: "asha@example.com",
  userPhone: "+919800000000",
  paymentMethod: "upi",
};

/** What SBI's ciphertext decrypts to: the order reference is only in here. */
const DECRYPTED = [
  {
    orderInfo: {
      orderRefNumber: ORDER_NUMBER,
      sbiOrderRefNumber: "SBI-REF-1",
      orderStatus: "PAID",
    },
    paymentInfo: { atrnNumber: "ATRN-1", transactionStatus: "SUCCESS" },
  },
];

const PAID = { ok: true, reference: "SBI-REF-1", capturedPaise: 220_000 };

/**
 * An in-memory order row with the same compare-and-set contract as the real
 * `transitionOrderPayment`: it returns the row only when the status was still
 * `expected`, so exactly one of two concurrent callers can win.
 */
function orderStore(initial: "pending" | "paid" | "failed" = "pending") {
  const row = { paymentStatus: initial as string };
  m.getOrder.mockImplementation(async () => ({ ...ORDER, paymentStatus: row.paymentStatus }));
  m.transitionOrderPayment.mockImplementation(
    async (_id: string, expected: string | string[], next: string) => {
      const from = Array.isArray(expected) ? expected : [expected];
      if (!from.includes(row.paymentStatus)) return null;
      row.paymentStatus = next;
      return { ...ORDER, paymentStatus: next };
    },
  );
  return row;
}

/** The browser return leg: a form post carrying only the ciphertext and mId. */
function browserReturn(): Request {
  return new Request(`${SITE}/api/payments/sbiepay/callback`, {
    method: "POST",
    body: new URLSearchParams({
      encryptedPaymentFinalResponse: "c".repeat(128),
      mId: "1000605",
    }),
  });
}

/** SBI's server-to-server notification, posted as JSON. */
function serverNotification(): Request {
  return new Request(`${SITE}/api/payments/sbiepay/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ encryptedPaymentFinalResponse: "c".repeat(128), mId: "1000605" }),
  });
}

function redirectOf(res: Response): { path: string; params: Record<string, string> } {
  expect(res.status).toBe(303);
  const url = new URL(res.headers.get("location") ?? "");
  expect(url.origin).toBe(SITE);
  return { path: url.pathname, params: Object.fromEntries(url.searchParams) };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  m.isOnlinePaymentAvailable.mockReturnValue(true);
  m.decryptCallback.mockResolvedValue({
    decrypted: DECRYPTED,
    encField: "encryptedPaymentFinalResponse",
    note: null,
  });
  m.recordCallback.mockResolvedValue(undefined);
  m.sendOrderPlacedEmail.mockResolvedValue(undefined);
});

describe("callback — verified payment", () => {
  it("marks the order paid, sends the order-placed email once, and redirects to success", async () => {
    const row = orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue(PAID);

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/success",
      params: { order: ORDER_NUMBER },
    });
    expect(row.paymentStatus).toBe("paid");
    expect(m.transitionOrderPayment).toHaveBeenCalledWith(
      "ord-1",
      ["pending", "failed"],
      "paid",
      "SBI-REF-1",
    );
    expect(m.afterResponse).toHaveBeenCalledTimes(1);
    expect(m.afterResponse.mock.calls[0][0]).toBe(`order ${ORDER_NUMBER} placed notification`);
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledWith("ord-1");
  });

  it("verifies with the decrypted fields (bank refs), not the two plaintext ones", async () => {
    orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue(PAID);

    await POST(browserReturn());

    expect(m.confirmGatewayPayment).toHaveBeenCalledTimes(1);
    const [payable, fields] = m.confirmGatewayPayment.mock.calls[0];
    expect(payable).toEqual({
      id: "ord-1",
      orderNumber: ORDER_NUMBER,
      totalPaise: 220_000,
      currency: "INR",
      customerEmail: "asha@example.com",
      customerPhone: "+919800000000",
    });
    expect(fields).toMatchObject({
      orderRefNumber: ORDER_NUMBER,
      sbiOrderRefNumber: "SBI-REF-1",
      atrnNumber: "ATRN-1",
    });
    expect(m.recordCallback).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", orderNumber: ORDER_NUMBER }),
    );
  });

  it("sends exactly one email when the browser return and server notification race", async () => {
    const row = orderStore("pending");
    // Hold both requests at verification until both have read the order as
    // pending — the window in which a read-then-write would double-process.
    let arrivals = 0;
    let release!: () => void;
    const bothVerifying = new Promise<void>((resolve) => (release = resolve));
    m.confirmGatewayPayment.mockImplementation(async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await bothVerifying;
      return PAID;
    });

    const [a, b] = await Promise.all([POST(browserReturn()), POST(serverNotification())]);

    // Both callers saw a pending order and both tried to mark it paid…
    expect(m.transitionOrderPayment).toHaveBeenCalledTimes(2);
    const results = await Promise.all(
      m.transitionOrderPayment.mock.results.map((r) => r.value as Promise<unknown>),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    // …but only the winner emails, and both customers land on the receipt.
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
    expect(m.afterResponse).toHaveBeenCalledTimes(1);
    expect(row.paymentStatus).toBe("paid");
    expect(redirectOf(a).path).toBe("/checkout/success");
    expect(redirectOf(b).path).toBe("/checkout/success");
  });

  it("redirects an already-paid order to success without re-verifying or re-emailing", async () => {
    orderStore("paid");

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/success",
      params: { order: ORDER_NUMBER },
    });
    expect(m.confirmGatewayPayment).not.toHaveBeenCalled();
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
    expect(m.afterResponse).not.toHaveBeenCalled();
  });
});

describe("callback — recovering a payment that was marked failed", () => {
  /*
   * An order can be 'failed' (a decline recorded earlier) and then be paid by
   * the customer on a retry or late. The bank is the authority: when it says
   * PAID, a failed order must become paid, or the customer is charged for goods
   * that are never dispatched.
   */
  it("moves a failed order to paid when the bank says PAID, emailing once", async () => {
    const row = orderStore("failed");
    m.confirmGatewayPayment.mockResolvedValue(PAID);

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/success",
      params: { order: ORDER_NUMBER },
    });
    expect(row.paymentStatus).toBe("paid");
    expect(m.transitionOrderPayment).toHaveBeenCalledWith(
      "ord-1",
      ["pending", "failed"],
      "paid",
      "SBI-REF-1",
    );
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledWith("ord-1");
  });

  it("emails exactly once when the browser return and server notification both recover it", async () => {
    const row = orderStore("failed");
    let arrivals = 0;
    let release!: () => void;
    const bothVerifying = new Promise<void>((resolve) => (release = resolve));
    m.confirmGatewayPayment.mockImplementation(async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await bothVerifying;
      return PAID;
    });

    const [a, b] = await Promise.all([POST(browserReturn()), POST(serverNotification())]);

    expect(row.paymentStatus).toBe("paid");
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
    expect(redirectOf(a).path).toBe("/checkout/success");
    expect(redirectOf(b).path).toBe("/checkout/success");
  });

  it("leaves a failed order failed when the bank still says it failed", async () => {
    const row = orderStore("failed");
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: "SBI-REF-1",
      capturedPaise: 0,
      reason: "failed",
    });

    const res = await POST(browserReturn());

    expect(redirectOf(res).path).toBe("/checkout/failed");
    expect(row.paymentStatus).toBe("failed");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it("does not recover a failed order whose captured amount is short", async () => {
    const row = orderStore("failed");
    m.confirmGatewayPayment.mockResolvedValue({ ok: true, reference: "SBI-REF-1", capturedPaise: 100 });

    const res = await POST(browserReturn());

    expect(redirectOf(res).params.reason).toBe("amount-mismatch");
    expect(row.paymentStatus).toBe("failed");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });
});

describe("callback — payment not accepted", () => {
  it("marks a bank-declined payment failed and redirects to failed, with no email", async () => {
    const row = orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: "SBI-REF-1",
      capturedPaise: 0,
      reason: "failed",
    });

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/failed",
      params: { order: ORDER_NUMBER, reason: "failed" },
    });
    expect(m.transitionOrderPayment).toHaveBeenCalledTimes(1);
    expect(m.transitionOrderPayment).toHaveBeenCalledWith("ord-1", "pending", "failed", "SBI-REF-1");
    expect(row.paymentStatus).toBe("failed");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
    expect(m.afterResponse).not.toHaveBeenCalled();
  });

  it.each(["cancel", "expired", "attempt_fail"])(
    "marks the order failed on the bank's final word %s and passes it through as the reason",
    async (reason) => {
      const row = orderStore("pending");
      m.confirmGatewayPayment.mockResolvedValue({
        ok: false,
        reference: "SBI-REF-1",
        capturedPaise: 0,
        reason,
      });

      const res = await POST(browserReturn());

      expect(redirectOf(res).params).toEqual({ order: ORDER_NUMBER, reason });
      expect(row.paymentStatus).toBe("failed");
      expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
    },
  );

  /*
   * confirmGatewayPayment returns ok:false for "the bank said no" AND for "we
   * could not get an answer". The second must not close the order: the
   * reconcile sweep only revisits `pending` orders, so a captured payment
   * marked failed here would never be looked at again.
   */
  it.each([
    ["the status call failed on the network", "fetch failed"],
    ["the bank has no matching record yet", "not-found"],
    ["the lookup returned someone else's order", "reference-mismatch"],
    ["the bank's status is not final yet", "pending"],
  ])("leaves the order pending for the sweep when %s", async (_label, reason) => {
    const row = orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: null,
      capturedPaise: null,
      reason,
    });

    const res = await POST(browserReturn());

    expect(redirectOf(res).path).toBe("/checkout/failed");
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(row.paymentStatus).toBe("pending");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it("fails a short capture as amount-mismatch and never marks it paid", async () => {
    const row = orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue({
      ok: true,
      reference: "SBI-REF-1",
      capturedPaise: 100, // ₹1 against a ₹2,200 order
    });

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/failed",
      params: { order: ORDER_NUMBER, reason: "amount-mismatch" },
    });
    expect(m.transitionOrderPayment).toHaveBeenCalledTimes(1);
    expect(m.transitionOrderPayment).toHaveBeenCalledWith("ord-1", "pending", "failed", "SBI-REF-1");
    expect(row.paymentStatus).toBe("failed");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it("does not walk back a paid order on a late failure notification", async () => {
    const row = orderStore("paid");
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: null,
      capturedPaise: null,
      reason: "failed",
    });

    const res = await POST(serverNotification());

    expect(redirectOf(res).path).toBe("/checkout/success");
    expect(row.paymentStatus).toBe("paid");
  });
});

describe("callback — online orders only", () => {
  /*
   * A COD order sits at payment_status "pending" by design (cash is collected at
   * the door). Order-dispatch drops failed orders, so flipping one to "failed"
   * because a callback named it would make a real order vanish from dispatch.
   */
  it.each([
    ["a bank-declined payment", { ok: false, reference: "SBI-REF-1", capturedPaise: 0, reason: "failed" }],
    ["a verified payment", PAID],
    ["a short capture", { ok: true, reference: "SBI-REF-1", capturedPaise: 100 }],
  ])("does not touch a cash-on-delivery order, even for %s", async (_label, outcome) => {
    const row = orderStore("pending");
    m.getOrder.mockImplementation(async () => ({
      ...ORDER,
      paymentMethod: "cod",
      paymentStatus: row.paymentStatus,
    }));
    m.confirmGatewayPayment.mockResolvedValue(outcome);

    const res = await POST(browserReturn());

    expect(redirectOf(res).path).toBe("/checkout/failed");
    expect(m.confirmGatewayPayment).not.toHaveBeenCalled();
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(row.paymentStatus).toBe("pending");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });
});

describe("callback — cannot identify the order", () => {
  it("redirects with no-reference when neither the ciphertext nor the plaintext names an order", async () => {
    m.decryptCallback.mockResolvedValue({ decrypted: null, encField: null, note: "no key" });

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/failed",
      params: { reason: "no-reference" },
    });
    expect(m.getOrder).not.toHaveBeenCalled();
    expect(m.confirmGatewayPayment).not.toHaveBeenCalled();
    // Recorded anyway: an unmatched callback is the one most worth keeping.
    expect(m.recordCallback).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: null }),
    );
  });

  it("redirects with unknown-order when the reference matches no order", async () => {
    m.getOrder.mockResolvedValue(null);

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/failed",
      params: { reason: "unknown-order" },
    });
    expect(m.getOrder).toHaveBeenCalledWith(ORDER_NUMBER);
    expect(m.confirmGatewayPayment).not.toHaveBeenCalled();
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  /*
   * Anyone can type GET /api/payments/sbiepay/callback?orderRefNumber=NG-… into a
   * browser. Only the decrypted payload is authenticated (GCM), so only it may
   * say which order a callback is about — otherwise the endpoint is an oracle
   * (and a trigger) for any order number.
   */
  it("does not act on an order reference taken from the raw query string when decryption fails", async () => {
    m.decryptCallback.mockResolvedValue({ decrypted: null, encField: null, note: "bad ciphertext" });
    orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue(PAID);

    const res = await GET(
      new Request(`${SITE}/api/payments/sbiepay/callback?orderRefNumber=${ORDER_NUMBER}`),
    );

    expect(redirectOf(res)).toEqual({
      path: "/checkout/failed",
      params: { reason: "no-reference" },
    });
    expect(m.getOrder).not.toHaveBeenCalled();
    expect(m.confirmGatewayPayment).not.toHaveBeenCalled();
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
    // Still on file for diagnosis, but with no order attributed to it.
    expect(m.recordCallback).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: null }));
  });

  it.each([
    ["a POST body", () =>
      new Request(`${SITE}/api/payments/sbiepay/callback`, {
        method: "POST",
        body: new URLSearchParams({ orderRefNumber: ORDER_NUMBER, merchantOrderNo: ORDER_NUMBER }),
      })],
    ["a JSON notification", () =>
      new Request(`${SITE}/api/payments/sbiepay/callback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderRefNumber: ORDER_NUMBER }),
      })],
  ])("ignores a plaintext order reference in %s that did not decrypt", async (_label, build) => {
    m.decryptCallback.mockResolvedValue({ decrypted: null, encField: null, note: null });
    const row = orderStore("pending");

    const res = await POST(build());

    expect(redirectOf(res).params.reason).toBe("no-reference");
    expect(m.getOrder).not.toHaveBeenCalled();
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(row.paymentStatus).toBe("pending");
  });

  it("takes the order from the decrypted payload even when the plaintext names a different one", async () => {
    orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue(PAID);

    const res = await GET(
      new Request(`${SITE}/api/payments/sbiepay/callback?orderRefNumber=NG-26-9999`),
    );

    expect(m.getOrder).toHaveBeenCalledTimes(1);
    expect(m.getOrder).toHaveBeenCalledWith(ORDER_NUMBER);
    expect(redirectOf(res).params.order).toBe(ORDER_NUMBER);
  });

  it("verifies with the decrypted bank references only, never plaintext ones a caller could supply", async () => {
    orderStore("pending");
    m.confirmGatewayPayment.mockResolvedValue(PAID);

    await GET(
      new Request(
        `${SITE}/api/payments/sbiepay/callback?sbiOrderRefNumber=SOMEONE-ELSE&atrnNumber=EVIL&extra=1`,
      ),
    );

    const [, fields] = m.confirmGatewayPayment.mock.calls[0];
    expect(fields).toMatchObject({ sbiOrderRefNumber: "SBI-REF-1", atrnNumber: "ATRN-1" });
    expect(fields).not.toHaveProperty("extra");
  });

  it("redirects with unavailable when online payment is switched off", async () => {
    m.isOnlinePaymentAvailable.mockReturnValue(false);

    const res = await POST(browserReturn());

    expect(redirectOf(res)).toEqual({
      path: "/checkout/failed",
      params: { reason: "unavailable" },
    });
    expect(m.getOrder).not.toHaveBeenCalled();
  });
});
