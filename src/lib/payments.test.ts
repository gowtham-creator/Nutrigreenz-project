/**
 * confirmGatewayPayment — how an order is looked up at the bank.
 *
 * The SBIePay client is mocked at its module boundary; the tests assert the
 * criteria it is called with, because the lookup key decides whether a payment
 * is found at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ searchSbiepayOrder: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/sbiepay-client", () => ({ searchSbiepayOrder: m.searchSbiepayOrder }));

import { confirmGatewayPayment, type PayableOrder } from "@/lib/payments";

const NOW = new Date("2026-10-03T12:00:00Z").getTime();

const ORDER: PayableOrder = {
  id: "ord-1",
  orderNumber: "NG-26-1001",
  totalPaise: 220_000,
  currency: "INR",
};

/** A status-API record for our order, in the given bank state. */
function record(orderStatus: string, orderRefNumber = ORDER.orderNumber.replace(/[^A-Za-z0-9]/g, "")) {
  return {
    orderInfo: { sbiOrderRefNumber: "SBI-REF-1", orderRefNumber, orderStatus },
    paymentInfo: [{ transactionStatus: "SUCCESS", orderAmount: 2200 }],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("PAYMENT_PROVIDER", "sbiepay");
  vi.stubEnv("SBIEPAY_ENV", "integration");
  vi.stubEnv("SBIEPAY_TEST_API_KEY_ID", "key-id");
  vi.stubEnv("SBIEPAY_TEST_API_KEY_SECRET", "key-secret");
  vi.stubEnv("SBIEPAY_TEST_ENCRYPTION_KEY", "enc-key");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("confirmGatewayPayment — lookup key", () => {
  it("prefers the bank reference carried by the callback", async () => {
    m.searchSbiepayOrder.mockResolvedValue([record("PAID")]);

    await confirmGatewayPayment(
      { ...ORDER, gatewayRef: "STORED-REF" },
      { sbiOrderRefNumber: "PAYLOAD-REF", atrnNumber: "ATRN-9" },
    );

    expect(m.searchSbiepayOrder).toHaveBeenCalledWith({
      sbiOrderRefNumber: "PAYLOAD-REF",
      orderAmount: 2200,
    });
  });

  it("looks up directly by the SBI reference stored at handoff when the payload has none (the sweep)", async () => {
    m.searchSbiepayOrder.mockResolvedValue([record("PAID")]);

    const result = await confirmGatewayPayment({ ...ORDER, gatewayRef: "SBI-REF-1" }, {});

    expect(m.searchSbiepayOrder).toHaveBeenCalledTimes(1);
    expect(m.searchSbiepayOrder).toHaveBeenCalledWith({
      sbiOrderRefNumber: "SBI-REF-1",
      orderAmount: 2200,
    });
    expect(result).toEqual({ ok: true, reference: "SBI-REF-1", capturedPaise: 220_000 });
  });

  it("falls back to a date window that starts at the order's creation, not 24h before now", async () => {
    // A 40-hour-old order: a fixed "last 24h" window would not contain it.
    const createdAt = new Date(NOW - 40 * 3_600_000).toISOString();
    m.searchSbiepayOrder.mockResolvedValue([record("PAID")]);

    await confirmGatewayPayment({ ...ORDER, createdAt }, {});

    const criteria = m.searchSbiepayOrder.mock.calls[0][0];
    expect(criteria.sbiOrderRefNumber).toBeUndefined();
    expect(criteria.orderRefNumber).toBe("NG261001");
    expect(criteria.toDate).toBe(NOW);
    // Starts just before creation (clock skew), so the whole life is covered.
    expect(criteria.fromDate).toBeLessThan(Date.parse(createdAt));
    expect(Date.parse(createdAt) - criteria.fromDate).toBeLessThanOrEqual(10 * 60_000);
  });

  it("uses a 48-hour window when the order's creation time is unknown", async () => {
    m.searchSbiepayOrder.mockResolvedValue([record("PAID")]);

    await confirmGatewayPayment(ORDER, {});

    const criteria = m.searchSbiepayOrder.mock.calls[0][0];
    expect(NOW - criteria.fromDate).toBeGreaterThanOrEqual(48 * 3_600_000);
  });
});

describe("confirmGatewayPayment — a miss", () => {
  it("is conclusive ('not-found') after a direct lookup by the bank's own reference", async () => {
    m.searchSbiepayOrder.mockResolvedValue([]);

    const result = await confirmGatewayPayment({ ...ORDER, gatewayRef: "SBI-REF-1" }, {});

    expect(result).toMatchObject({ ok: false, reason: "not-found" });
  });

  it("is only 'not-found-in-window' after a date-range search, which can miss on a busy day", async () => {
    // A range query has no pagination in our client: a result set truncated by
    // the bank looks exactly like "no such order". It must not read as final.
    m.searchSbiepayOrder.mockResolvedValue([]);

    const result = await confirmGatewayPayment(ORDER, {});

    expect(result).toMatchObject({ ok: false, reason: "not-found-in-window" });
  });

  it("still reports reference-mismatch when the window returns only other customers' orders", async () => {
    m.searchSbiepayOrder.mockResolvedValue([record("PAID", "NG-26-7777")]);

    const result = await confirmGatewayPayment(ORDER, {});

    expect(result).toMatchObject({ ok: false, reason: "reference-mismatch" });
  });
});
