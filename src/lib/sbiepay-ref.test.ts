import { describe, expect, test } from "vitest";
import { fromSbiepayRef, toSbiepayRef } from "@/lib/sbiepay-ref";

describe("SBIePay order reference", () => {
  test("sends letters and digits only (LIVE rejects hyphens with error 2002)", () => {
    expect(toSbiepayRef("NG-26-1042")).toBe("NG261042");
    expect(toSbiepayRef("NG-25-AB12")).toBe("NG25AB12");
    expect(toSbiepayRef("NG-26-1042")).toMatch(/^[A-Za-z0-9]{1,50}$/);
  });

  test("never exceeds 50 characters", () => {
    expect(toSbiepayRef("N".repeat(80))).toHaveLength(50);
  });

  test("maps SBI's echo back to our order number", () => {
    expect(fromSbiepayRef("NG261042")).toBe("NG-26-1042");
    expect(fromSbiepayRef(toSbiepayRef("NG-25-AB12"))).toBe("NG-25-AB12");
  });

  test("leaves an old hyphenated reference or an id unchanged", () => {
    expect(fromSbiepayRef("NG-26-1042")).toBe("NG-26-1042");
    expect(fromSbiepayRef("3f1c2a9e-1111-2222-3333-444455556666")).toBe(
      "3f1c2a9e-1111-2222-3333-444455556666",
    );
  });
});
