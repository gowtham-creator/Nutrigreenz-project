import { describe, expect, it } from "vitest";
import { paymentMethodLabel } from "@/lib/payment-label";

describe("paymentMethodLabel - the name a receipt prints for how an order was paid", () => {
  it("names the gateway for an order that went through it", () => {
    expect(paymentMethodLabel({ paymentMethod: "upi", paymentProvider: "sbiepay" })).toBe("SBIePay");
  });

  it("never prints the placeholder provider 'none'", () => {
    expect(paymentMethodLabel({ paymentMethod: "upi", paymentProvider: "none" })).toBe("Online");
    expect(paymentMethodLabel({ paymentMethod: "upi", paymentProvider: "" })).toBe("Online");
    expect(paymentMethodLabel({ paymentMethod: "upi", paymentProvider: null })).toBe("Online");
  });

  it("calls a cash-on-delivery order what it is, whatever the provider column holds", () => {
    expect(paymentMethodLabel({ paymentMethod: "cod", paymentProvider: "none" })).toBe(
      "Cash on delivery",
    );
    expect(paymentMethodLabel({ paymentMethod: "cod", paymentProvider: "razorpay" })).toBe(
      "Cash on delivery",
    );
  });

  it("falls back to the stored provider name, capitalised, for any other gateway", () => {
    expect(paymentMethodLabel({ paymentMethod: "upi", paymentProvider: "razorpay" })).toBe("Razorpay");
  });
});
