import { describe, expect, it } from "vitest";
import {
  addDays,
  applySubscriberDiscountPaise,
  daysBetween,
  formatDeliveryDate,
  indiaToday,
  isFrequency,
  isIsoDate,
  rollForward,
  startWindow,
} from "./subscriptions-core";

describe("subscription dates", () => {
  it("uses the calendar day in India, not UTC", () => {
    // 20:00 UTC on 11 Nov is 01:30 on 12 Nov in India.
    expect(indiaToday(new Date("2026-11-11T20:00:00Z"))).toBe("2026-11-12");
    expect(indiaToday(new Date("2026-11-11T18:00:00Z"))).toBe("2026-11-11");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-11-12", "2026-12-12")).toBe(30);
  });

  it("rejects impossible dates", () => {
    expect(isIsoDate("2026-11-12")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("12-11-2026")).toBe(false);
    expect(isIsoDate(20261112)).toBe(false);
  });

  it("opens the start window two days out for thirty days", () => {
    expect(startWindow("2026-11-12")).toEqual({ earliest: "2026-11-14", latest: "2026-12-12" });
  });

  it("rolls a stale date forward by whole cycles only", () => {
    expect(rollForward("2026-11-20", 7, "2026-11-14")).toBe("2026-11-20");
    expect(rollForward("2026-11-01", 7, "2026-11-14")).toBe("2026-11-15");
    expect(rollForward("2026-11-01", 14, "2026-11-15")).toBe("2026-11-15");
    expect(rollForward("2026-10-01", 30, "2026-11-14")).toBe("2026-11-30");
  });

  it("only allows weekly, fortnightly and monthly", () => {
    expect([7, 14, 30].every(isFrequency)).toBe(true);
    expect(isFrequency(10)).toBe(false);
    expect(isFrequency("7")).toBe(false);
  });

  it("formats a delivery date without shifting the day", () => {
    expect(formatDeliveryDate("2026-11-14")).toMatch(/14 Nov/);
  });
});

describe("subscriber discount", () => {
  it("takes 8% off in whole paise", () => {
    expect(applySubscriberDiscountPaise(50000, 800)).toBe(46000);
    expect(applySubscriberDiscountPaise(12345, 800)).toBe(11357);
  });

  it("clamps silly discounts", () => {
    expect(applySubscriberDiscountPaise(10000, -500)).toBe(10000);
    expect(applySubscriberDiscountPaise(10000, 9000)).toBe(5000);
  });
});
