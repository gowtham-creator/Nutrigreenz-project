/**
 * Reconcile sweep — settles online orders whose callback never arrived.
 *
 * A recovered payment is a real order the customer paid for. The order-placed
 * email (customer confirmation + operator alert) for an online order is sent on
 * payment, not creation, so the sweep has to send it when it is the one that
 * confirms the payment — otherwise nobody is told.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listStalePendingPayments: vi.fn(),
  getOrder: vi.fn(),
  transitionOrderPayment: vi.fn(),
  onOnlineOrderPaid: vi.fn(),
  failUnpaidOnlineOrder: vi.fn(),
  confirmGatewayPayment: vi.fn(),
  isOnlinePaymentAvailable: vi.fn(),
  sendOrderPlacedEmail: vi.fn(),
  afterResponse: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/orders", () => ({
  listStalePendingPayments: m.listStalePendingPayments,
  getOrder: m.getOrder,
  transitionOrderPayment: m.transitionOrderPayment,
  onOnlineOrderPaid: m.onOnlineOrderPaid,
  failUnpaidOnlineOrder: m.failUnpaidOnlineOrder,
}));
vi.mock("@/lib/payments", () => ({
  confirmGatewayPayment: m.confirmGatewayPayment,
  isOnlinePaymentAvailable: m.isOnlinePaymentAvailable,
}));
vi.mock("@/lib/order-emails", () => ({ sendOrderPlacedEmail: m.sendOrderPlacedEmail }));
vi.mock("@/lib/after-response", () => ({ afterResponse: m.afterResponse }));

import { GET } from "./route";

const SECRET = "test-cron-secret";

const ORDER = {
  id: "ord-1",
  orderNumber: "NG-26-1001",
  totalPaise: 220_000,
  currency: "INR",
  userEmail: "asha@example.com",
  userPhone: "+919800000000",
  paymentMethod: "upi",
  paymentStatus: "pending",
  paymentRef: "SBI-REF-1",
  createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
};

function cronRequest(secret = SECRET): Request {
  return new Request("https://shop.test/api/cron/reconcile-payments", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  m.isOnlinePaymentAvailable.mockReturnValue(true);
  m.listStalePendingPayments.mockResolvedValue([{ id: "ord-1", orderNumber: "NG-26-1001" }]);
  m.getOrder.mockResolvedValue(ORDER);
  m.sendOrderPlacedEmail.mockResolvedValue(undefined);
  m.onOnlineOrderPaid.mockResolvedValue(undefined);
  m.failUnpaidOnlineOrder.mockResolvedValue({ ...ORDER, paymentStatus: "failed" });
});

describe("reconcile sweep", () => {
  it("refuses a caller without the cron secret", async () => {
    const res = await GET(cronRequest("wrong"));

    expect(res.status).toBe(401);
    expect(m.listStalePendingPayments).not.toHaveBeenCalled();
  });

  it("marks a recovered payment paid and sends the order-placed email once", async () => {
    m.confirmGatewayPayment.mockResolvedValue({
      ok: true,
      reference: "SBI-REF-1",
      capturedPaise: 220_000,
    });
    m.transitionOrderPayment.mockResolvedValue({ ...ORDER, paymentStatus: "paid" });

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ ok: true, checked: 1, paid: 1 });
    expect(m.transitionOrderPayment).toHaveBeenCalledWith(
      "ord-1",
      ["pending", "failed"],
      "paid",
      "SBI-REF-1",
    );
    expect(m.afterResponse).toHaveBeenCalledTimes(1);
    expect(m.afterResponse.mock.calls[0][0]).toBe("order NG-26-1001 placed notification");
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledWith("ord-1");
  });

  it("runs the paid-order bookkeeping for a recovered payment, and not when it lost the race", async () => {
    m.confirmGatewayPayment.mockResolvedValue({ ok: true, reference: "SBI-REF-1", capturedPaise: 220_000 });
    m.transitionOrderPayment.mockResolvedValueOnce({ ...ORDER, paymentStatus: "paid" });
    await GET(cronRequest());
    expect(m.onOnlineOrderPaid).toHaveBeenCalledTimes(1);
    expect(m.onOnlineOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ id: "ord-1" }));

    m.transitionOrderPayment.mockResolvedValueOnce(null);
    await GET(cronRequest());
    expect(m.onOnlineOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("does not email when a callback settled the order first (it already did)", async () => {
    m.confirmGatewayPayment.mockResolvedValue({
      ok: true,
      reference: "SBI-REF-1",
      capturedPaise: 220_000,
    });
    m.transitionOrderPayment.mockResolvedValue(null);

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({
      paid: 1,
      outcomes: [{ orderNumber: "NG-26-1001", result: "paid", detail: "settled concurrently" }],
    });
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
    expect(m.afterResponse).not.toHaveBeenCalled();
  });

  it("fails a short capture without emailing", async () => {
    m.confirmGatewayPayment.mockResolvedValue({
      ok: true,
      reference: "SBI-REF-1",
      capturedPaise: 100,
    });

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ failed: 1 });
    expect(m.transitionOrderPayment).toHaveBeenCalledWith("ord-1", "pending", "failed", "SBI-REF-1");
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
    // Money WAS taken: left for a human with the stock still held.
    expect(m.failUnpaidOnlineOrder).not.toHaveBeenCalled();
  });

  it("never asks the bank about, or flips, a cash-on-delivery order", async () => {
    // Defence in depth: the list query already excludes COD, but a COD order
    // must not be flipped even if one slipped through (it sits at "pending" by
    // design, and a failed order is dropped from dispatch).
    m.getOrder.mockResolvedValue({ ...ORDER, paymentMethod: "cod" });
    m.confirmGatewayPayment.mockResolvedValue({ ok: false, reference: null, capturedPaise: null, reason: "not-found" });

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ checked: 1, paid: 0, failed: 0 });
    expect(m.confirmGatewayPayment).not.toHaveBeenCalled();
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it("looks the order up by the SBI reference saved at handoff and by its creation time", async () => {
    m.confirmGatewayPayment.mockResolvedValue({ ok: true, reference: "SBI-REF-1", capturedPaise: 220_000 });
    m.transitionOrderPayment.mockResolvedValue({ ...ORDER, paymentStatus: "paid" });

    await GET(cronRequest());

    const [payable, payload] = m.confirmGatewayPayment.mock.calls[0];
    expect(payable).toMatchObject({
      id: "ord-1",
      gatewayRef: "SBI-REF-1",
      createdAt: ORDER.createdAt,
    });
    expect(payload).toEqual({});
  });

  it("closes an order as failed when the bank has no record of its own reference", async () => {
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: null,
      capturedPaise: null,
      reason: "not-found",
    });

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ failed: 1 });
    expect(m.failUnpaidOnlineOrder).toHaveBeenCalledWith("ord-1", null);
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
  });

  it.each(["failed", "cancel", "expired", "attempt_fail"])(
    "fails the order and releases its holds on the bank's final word %s",
    async (reason) => {
      m.confirmGatewayPayment.mockResolvedValue({
        ok: false,
        reference: "SBI-REF-1",
        capturedPaise: 0,
        reason,
      });

      const res = await GET(cronRequest());

      expect(await res.json()).toMatchObject({ failed: 1 });
      expect(m.failUnpaidOnlineOrder).toHaveBeenCalledWith("ord-1", "SBI-REF-1");
    },
  );

  it("does NOT close a young order on a date-window miss - the window can truncate", async () => {
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: null,
      capturedPaise: null,
      reason: "not-found-in-window",
    });

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ stillPending: 1, failed: 0 });
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
  });

  it("closes an old order that a date-window search has repeatedly failed to find", async () => {
    // Otherwise an order with no stored reference (the handoff never completed)
    // would sit pending, holding stock, until it aged out of the sweep.
    m.getOrder.mockResolvedValue({
      ...ORDER,
      paymentRef: null,
      createdAt: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    });
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: null,
      capturedPaise: null,
      reason: "not-found-in-window",
    });

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ failed: 1 });
    expect(m.failUnpaidOnlineOrder).toHaveBeenCalledWith("ord-1", null);
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
  });

  it("leaves an order pending when the bank could not be asked", async () => {
    m.confirmGatewayPayment.mockResolvedValue({
      ok: false,
      reference: null,
      capturedPaise: null,
      reason: "fetch failed",
    });

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ stillPending: 1, failed: 0 });
    expect(m.transitionOrderPayment).not.toHaveBeenCalled();
    expect(m.sendOrderPlacedEmail).not.toHaveBeenCalled();
  });
});
