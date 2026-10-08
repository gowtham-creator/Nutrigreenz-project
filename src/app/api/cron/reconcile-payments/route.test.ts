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
    expect(m.transitionOrderPayment).toHaveBeenCalledWith("ord-1", "pending", "paid", "SBI-REF-1");
    expect(m.afterResponse).toHaveBeenCalledTimes(1);
    expect(m.afterResponse.mock.calls[0][0]).toBe("order NG-26-1001 placed notification");
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
    expect(m.sendOrderPlacedEmail).toHaveBeenCalledWith("ord-1");
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
