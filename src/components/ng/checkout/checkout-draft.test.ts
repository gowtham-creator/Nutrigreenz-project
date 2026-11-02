// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearCheckoutDraft, readCheckoutDraft, writeCheckoutDraft } from "./checkout-draft";

afterEach(clearCheckoutDraft);

describe("checkout draft", () => {
  it("keeps whether the coupon stacks, which the points on the page depend on", () => {
    writeCheckoutDraft({
      applied: {
        coupon: {
          code: "SOLO50",
          description: "",
          type: "flat",
          value: 50,
          active: true,
          stacksWithLoyalty: false,
        },
        discount: 50,
      },
      redeemLoyalty: false,
    });

    expect(readCheckoutDraft()?.applied?.coupon.stacksWithLoyalty).toBe(false);
  });
});
