/**
 * POST /api/orders — order creation and the SBIePay handoff.
 *
 * The database, the customer session, the gateway seam and the email senders
 * are mocked at their module boundary. Nothing here reaches Supabase or SBI.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getCustomerSession: vi.fn(),
  getCustomerById: vi.fn(),
  createOrder: vi.fn(),
  recordGatewayHandoff: vi.fn(),
  failUnpaidOnlineOrder: vi.fn(),
  beginPayment: vi.fn(),
  isOnlinePaymentAvailable: vi.fn(),
  sendOrderPlacedEmail: vi.fn(),
  afterResponse: vi.fn(),
}));

// The real SbiepayError is imported below, so its own imports must be safe in Node.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/customer-session", () => ({ getCustomerSession: m.getCustomerSession }));
vi.mock("@/lib/customer-identity", () => ({ getCustomerById: m.getCustomerById }));
vi.mock("@/lib/orders", () => {
  class OutOfStockError extends Error {
    constructor(readonly variantIds: string[]) {
      super("out-of-stock");
    }
  }
  class UnpricedItemsError extends Error {
    constructor(readonly titles: string[]) {
      super("item-unavailable");
    }
  }
  return {
    createOrder: m.createOrder,
    recordGatewayHandoff: m.recordGatewayHandoff,
    failUnpaidOnlineOrder: m.failUnpaidOnlineOrder,
    listOrdersForCustomer: vi.fn(),
    OutOfStockError,
    UnpricedItemsError,
  };
});
vi.mock("@/lib/rewards", () => {
  class CouponInvalidError extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  }
  return { CouponInvalidError, getLoyaltyConfig: vi.fn(), redeemPaisePerPoint: vi.fn(() => 10) };
});
vi.mock("@/lib/payments", () => ({
  beginPayment: m.beginPayment,
  isOnlinePaymentAvailable: m.isOnlinePaymentAvailable,
}));
vi.mock("@/lib/order-emails", () => ({ sendOrderPlacedEmail: m.sendOrderPlacedEmail }));
vi.mock("@/lib/after-response", () => ({ afterResponse: m.afterResponse }));

import { POST, maxDuration } from "./route";
import { SbiepayError } from "@/lib/sbiepay-client";

const ORDER = {
  id: "ord-1",
  orderNumber: "NG-26-1001",
  totalPaise: 220_000,
  currency: "INR",
  userEmail: "asha@example.com",
  userPhone: "+919800000000",
  paymentStatus: "pending",
};

function orderRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [{ productId: "p1", variantId: "v1", title: "A2 Ghee", qty: 1 }],
      addressSnapshot: { fullName: "Asha Rao", pincode: "500001" },
      slotSnapshot: { id: "slot-1" },
      ...body,
    }),
  });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  m.getCustomerSession.mockResolvedValue({ customerId: "cust-1" });
  m.getCustomerById.mockResolvedValue({
    primaryEmail: "asha@example.com",
    primaryPhone: "+919800000000",
  });
  m.isOnlinePaymentAvailable.mockReturnValue(true);
  m.createOrder.mockImplementation(async (input: { paymentMethod: string }) => ({
    ...ORDER,
    paymentMethod: input.paymentMethod,
  }));
  m.sendOrderPlacedEmail.mockResolvedValue(undefined);
  m.recordGatewayHandoff.mockResolvedValue(true);
  m.failUnpaidOnlineOrder.mockResolvedValue({ id: "ord-1" });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/orders — online (UPI) order", () => {
  it("hands the order to the gateway and returns 201 with the payment action", async () => {
    m.beginPayment.mockResolvedValue({
      action: "https://sbi.example/pay/abc",
      fields: {},
      reference: "SBI-REF-1",
    });

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      orderNumber: "NG-26-1001",
      payment: { action: "https://sbi.example/pay/abc", fields: {}, reference: "SBI-REF-1" },
    });
    expect(m.createOrder).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: "upi" }));
    expect(m.beginPayment).toHaveBeenCalledWith({
      id: "ord-1",
      orderNumber: "NG-26-1001",
      totalPaise: 220_000,
      currency: "INR",
      customerEmail: "asha@example.com",
      customerPhone: "+919800000000",
    });
  });

  it("saves SBI's order reference on the order so the sweep can look it up directly", async () => {
    m.beginPayment.mockResolvedValue({
      action: "https://sbi.example/pay/abc",
      fields: {},
      reference: "SBI-REF-1",
    });

    await POST(orderRequest({ paymentMethod: "upi" }));

    expect(m.recordGatewayHandoff).toHaveBeenCalledWith("ord-1", "SBI-REF-1");
  });

  it("still returns the payment action when saving the reference fails", async () => {
    // Best-effort: the customer must reach the bank page; the sweep falls back
    // to a date-window lookup for an order with no stored reference.
    m.beginPayment.mockResolvedValue({
      action: "https://sbi.example/pay/abc",
      fields: {},
      reference: "SBI-REF-1",
    });
    m.recordGatewayHandoff.mockResolvedValue(false);

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(201);
    expect((await res.json()).payment.action).toBe("https://sbi.example/pay/abc");
  });

  it("does not record a handoff for a COD order", async () => {
    await POST(orderRequest({ paymentMethod: "cod" }));

    expect(m.recordGatewayHandoff).not.toHaveBeenCalled();
  });

  it("does not send the order-placed email at creation — that waits for payment", async () => {
    m.beginPayment.mockResolvedValue({ action: "https://sbi.example/pay/abc", fields: {} });

    await POST(orderRequest({ paymentMethod: "upi" }));

    expect(m.afterResponse).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it("returns 500 create-failed when the gateway refuses the handoff (SbiepayError 905)", async () => {
    m.beginPayment.mockRejectedValue(
      new SbiepayError("order/create (mId=1000605): Invalid request", "905", 200),
    );

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "create-failed" });
    // No "order received" mail for a payment that never opened.
    expect(m.afterResponse).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  /*
   * createOrder has already reserved stock, recorded the coupon use and burned
   * the redeemed points by the time the gateway is asked. A handoff that fails
   * (live today: SBI error 905) would otherwise leave an order nobody can pay
   * and a customer whose points and coupon are gone.
   */
  it("fails the order and releases its holds when the gateway refuses the handoff", async () => {
    m.beginPayment.mockRejectedValue(
      new SbiepayError("order/create (mId=1000605): Invalid request", "905", 200),
    );

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(500);
    expect(m.failUnpaidOnlineOrder).toHaveBeenCalledTimes(1);
    expect(m.failUnpaidOnlineOrder).toHaveBeenCalledWith("ord-1");
    expect(m.recordGatewayHandoff).not.toHaveBeenCalled();
  });

  it("treats a gateway that returns no session as a failed handoff too", async () => {
    // isOnlinePaymentAvailable() can flip between the guard and the handoff.
    m.beginPayment.mockResolvedValue(null);

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "create-failed" });
    expect(m.failUnpaidOnlineOrder).toHaveBeenCalledWith("ord-1");
  });

  it("does not fail the order when the handoff succeeds", async () => {
    m.beginPayment.mockResolvedValue({ action: "https://sbi.example/pay/abc", fields: {} });

    await POST(orderRequest({ paymentMethod: "upi" }));

    expect(m.failUnpaidOnlineOrder).not.toHaveBeenCalled();
  });

  it("does not roll back when order CREATION fails (nothing was persisted to release)", async () => {
    m.createOrder.mockRejectedValue(new Error("db down"));

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(500);
    expect(m.failUnpaidOnlineOrder).not.toHaveBeenCalled();
  });

  it("logs one line naming the error code, HTTP status and failing step — never the error object", async () => {
    m.beginPayment.mockRejectedValue(
      new SbiepayError("order/create (mId=1000605): Invalid request", "905", 200),
    );

    await POST(orderRequest({ paymentMethod: "upi" }));

    expect(consoleError).toHaveBeenCalledTimes(1);
    const args = consoleError.mock.calls[0];
    // A single string: a thrown fetch error can carry request headers (credentials).
    expect(args).toHaveLength(1);
    const line = args[0] as string;
    expect(line).toMatch(/^order-create-failed: SbiepayError/);
    expect(line).toContain("code=905");
    expect(line).toContain("http=200");
    expect(line).toContain("order/create");
  });

  it("logs a plain gateway error without a code suffix", async () => {
    m.beginPayment.mockRejectedValue(new Error("sbiepay-no-transaction-url"));

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "order-create-failed: Error: sbiepay-no-transaction-url",
    );
  });

  it("rejects UPI with payment-unavailable when no gateway is configured, before creating anything", async () => {
    m.isOnlinePaymentAvailable.mockReturnValue(false);

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "payment-unavailable", method: "upi" });
    expect(m.createOrder).not.toHaveBeenCalled();
    expect(m.beginPayment).not.toHaveBeenCalled();
    expect(m.afterResponse).not.toHaveBeenCalled();
  });
});

describe("POST /api/orders — Cash on Delivery", () => {
  it("schedules the order-placed email and opens no payment session", async () => {
    const res = await POST(orderRequest({ paymentMethod: "cod" }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, orderNumber: "NG-26-1001", payment: null });
    expect(m.beginPayment).not.toHaveBeenCalled();

    expect(m.afterResponse).toHaveBeenCalledTimes(1);
    expect(m.afterResponse.mock.calls[0][0]).toBe("order NG-26-1001 placed notification");
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledWith("ord-1");
  });

  it("treats an unknown payment method as COD, never as a method that skips collection", async () => {
    await POST(orderRequest({ paymentMethod: "card" }));

    expect(m.createOrder).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: "cod" }));
    expect(m.beginPayment).not.toHaveBeenCalled();
  });
});

describe("POST /api/orders - route config", () => {
  it("allows longer than the platform default: token (15s) + order/create (25s) can exceed it", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(60);
  });
});

describe("POST /api/orders — guards", () => {
  it("returns 401 without a session", async () => {
    m.getCustomerSession.mockResolvedValue(null);

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(401);
    expect(m.createOrder).not.toHaveBeenCalled();
  });

  it("returns 400 empty-cart when no line is valid", async () => {
    const res = await POST(orderRequest({ paymentMethod: "cod", items: [{ qty: 0 }] }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "empty-cart" });
  });
});

describe("POST /api/orders — items the catalog cannot price", () => {
  it("answers 409 item-unavailable with the item names and never opens a payment", async () => {
    const { UnpricedItemsError } = await import("@/lib/orders");
    m.createOrder.mockRejectedValue(new UnpricedItemsError(["Groundnut Oil 1L"]));

    const res = await POST(orderRequest({ paymentMethod: "upi" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      error: "item-unavailable",
      titles: ["Groundnut Oil 1L"],
    });
    expect(m.beginPayment).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it("refuses a Cash on Delivery order with an unpriced item the same way", async () => {
    const { UnpricedItemsError } = await import("@/lib/orders");
    m.createOrder.mockRejectedValue(new UnpricedItemsError(["Old item"]));

    const res = await POST(orderRequest({ paymentMethod: "cod" }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("item-unavailable");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });
});
