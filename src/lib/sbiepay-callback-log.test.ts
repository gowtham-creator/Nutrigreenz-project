/**
 * flattenDecrypted - lifting the decrypted SBIePay envelope into flat fields.
 *
 * The status API (and so the callback ciphertext, which mirrors it) returns
 * `paymentInfo` as an ARRAY of attempts. Dropping it loses `atrnNumber`, the
 * bank's transaction reference, which is what a direct status lookup and a
 * settlement dispute are keyed on.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: false, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/payments", () => ({ sbiepayEncryptionKey: vi.fn() }));
vi.mock("@/lib/sbiepay-crypto", () => ({ decodeCallbackPayload: vi.fn() }));

import { flattenDecrypted } from "@/lib/sbiepay-callback-log";

const ORDER_INFO = {
  orderRefNumber: "NG-26-1001",
  sbiOrderRefNumber: "SBI-REF-1",
  orderStatus: "PAID",
};

describe("flattenDecrypted", () => {
  it("keeps the atrnNumber when paymentInfo is an array (the real shape)", () => {
    const flat = flattenDecrypted([
      {
        orderInfo: ORDER_INFO,
        paymentInfo: [{ atrnNumber: "ATRN-1", transactionStatus: "SUCCESS", orderAmount: 2200 }],
      },
    ]);

    expect(flat).toMatchObject({
      orderRefNumber: "NG-26-1001",
      sbiOrderRefNumber: "SBI-REF-1",
      orderStatus: "PAID",
      atrnNumber: "ATRN-1",
      transactionStatus: "SUCCESS",
      orderAmount: "2200",
    });
  });

  it("prefers the SUCCESS attempt when the customer failed first and then paid", () => {
    const flat = flattenDecrypted([
      {
        orderInfo: ORDER_INFO,
        paymentInfo: [
          { atrnNumber: "ATRN-FAILED", transactionStatus: "FAILED" },
          { atrnNumber: "ATRN-PAID", transactionStatus: "SUCCESS" },
        ],
      },
    ]);

    expect(flat.atrnNumber).toBe("ATRN-PAID");
    expect(flat.transactionStatus).toBe("SUCCESS");
  });

  it("falls back to the first attempt when none succeeded", () => {
    const flat = flattenDecrypted([
      {
        orderInfo: { ...ORDER_INFO, orderStatus: "FAILED" },
        paymentInfo: [
          { atrnNumber: "ATRN-A", transactionStatus: "FAILED" },
          { atrnNumber: "ATRN-B", transactionStatus: "FAILED" },
        ],
      },
    ]);

    expect(flat.atrnNumber).toBe("ATRN-A");
  });

  it("still reads paymentInfo given as a single object", () => {
    const flat = flattenDecrypted([
      { orderInfo: ORDER_INFO, paymentInfo: { atrnNumber: "ATRN-1", transactionStatus: "SUCCESS" } },
    ]);

    expect(flat.atrnNumber).toBe("ATRN-1");
  });

  it("accepts an envelope that is not wrapped in an array", () => {
    const flat = flattenDecrypted({
      orderInfo: ORDER_INFO,
      paymentInfo: [{ atrnNumber: "ATRN-1" }],
    } as unknown as Record<string, unknown>);

    expect(flat).toMatchObject({ orderRefNumber: "NG-26-1001", atrnNumber: "ATRN-1" });
  });

  it("copes with a null or empty paymentInfo and skips nested values", () => {
    expect(
      flattenDecrypted([{ orderInfo: { ...ORDER_INFO, otherDetails: { a: 1 } }, paymentInfo: null }]),
    ).toEqual({
      orderRefNumber: "NG-26-1001",
      sbiOrderRefNumber: "SBI-REF-1",
      orderStatus: "PAID",
    });
    expect(flattenDecrypted([{ orderInfo: ORDER_INFO, paymentInfo: [] }]).orderRefNumber).toBe(
      "NG-26-1001",
    );
    expect(flattenDecrypted(null)).toEqual({});
  });
});
