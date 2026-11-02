import { describe, expect, it } from "vitest";
import {
  couponCustomerPhone,
  normalizePhoneE164,
  phoneRowProblems,
  phoneRowsToList,
  readCustomerPhones,
} from "@/lib/phone-e164";

describe("phoneRowProblems", () => {
  it("leaves a blank box alone: it's the one the plus button just added", () => {
    expect(phoneRowProblems(["9876543210", "  "])).toEqual([null, null]);
  });

  it("flags a bad number on its own row", () => {
    expect(phoneRowProblems(["9876543210", "12345"])).toEqual([null, "Enter a valid mobile number"]);
  });

  it("flags the later row when two boxes hold the same number, however it was typed", () => {
    expect(phoneRowProblems(["+91 98765 43210", "9876543210"])).toEqual([
      null,
      "This number is already on the list",
    ]);
  });
});

describe("phoneRowsToList", () => {
  it("gives de-duped E.164 and drops blanks and bad rows", () => {
    expect(phoneRowsToList(["98765 43210", "", "9876543210", "12345", "9876543211"])).toEqual([
      "+919876543210",
      "+919876543211",
    ]);
  });
});

describe("couponCustomerPhone", () => {
  it("accepts the ways an Indian mobile gets typed", () => {
    for (const raw of ["9876543210", "98765 43210", "098765 43210", "+91 98765-43210", "919876543210"]) {
      expect(couponCustomerPhone(raw)).toBe("+919876543210");
    }
  });

  it("refuses an Indian number with a digit missing, which the general rule lets through", () => {
    expect(normalizePhoneE164("+91 98765 4321")).toBe("+91987654321");
    expect(couponCustomerPhone("+91 98765 4321")).toBeNull();
  });

  it("refuses an Indian number that cannot be a mobile", () => {
    expect(couponCustomerPhone("+91 12345 67890")).toBeNull();
  });

  it("refuses text and two numbers pasted into one box", () => {
    expect(couponCustomerPhone("call me")).toBeNull();
    expect(couponCustomerPhone("9876543210, 9876543211")).toBeNull();
    expect(couponCustomerPhone("")).toBeNull();
  });

  it("keeps a foreign number", () => {
    expect(couponCustomerPhone("+44 7911 123456")).toBe("+447911123456");
  });
});

describe("readCustomerPhones", () => {
  it("leaves an absent list alone and lets null clear it", () => {
    expect(readCustomerPhones(undefined)).toEqual({ ok: true, phones: undefined });
    expect(readCustomerPhones(null)).toEqual({ ok: true, phones: null });
  });

  it("normalises and de-dupes", () => {
    expect(readCustomerPhones(["98765 43210", "+919876543210", "9876543211"])).toEqual({
      ok: true,
      phones: ["+919876543210", "+919876543211"],
    });
  });

  it("refuses an empty list, which would otherwise mean anyone", () => {
    expect(readCustomerPhones([])).toEqual({ ok: false });
  });

  it("refuses the whole list when one number is bad", () => {
    expect(readCustomerPhones(["9876543210", "12345"])).toEqual({ ok: false });
    expect(readCustomerPhones(["9876543210", 42])).toEqual({ ok: false });
  });

  it("refuses anything that is not a list", () => {
    expect(readCustomerPhones("9876543210")).toEqual({ ok: false });
  });
});
