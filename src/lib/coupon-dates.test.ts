/**
 * Coupon dates are IST calendar days. These pin the two ways the UTC offset
 * bites: a stored end dying at 5:30 AM on its last day, and a stored start
 * reading back as the day before.
 */
import { describe, expect, it } from "vitest";
import {
  couponDay,
  couponDayLabel,
  couponEndInstant,
  couponSavedMessage,
  couponStartInstant,
  couponStatus,
  couponValidityLabel,
  editedCouponDatesProblem,
  isCouponDay,
  newCouponDatesProblem,
  readCouponWindow,
} from "@/lib/coupon-dates";

describe("couponSavedMessage", () => {
  const saved = { code: "FRESH50", targetLabel: "All customers", startDay: "2026-11-20", editing: false };

  it("says live only for a code that is live", () => {
    expect(couponSavedMessage({ ...saved, status: "live" })).toEqual({
      title: "FRESH50 is live",
      description: "All customers · valid at checkout now.",
    });
  });

  it("names the opening day for a future-dated code and never claims it is live", () => {
    const message = couponSavedMessage({ ...saved, status: "scheduled" });

    expect(message.title).toBe("FRESH50 is scheduled");
    expect(message.description).toBe("All customers · opens at checkout on 20 Nov.");
    expect(`${message.title} ${message.description}`).not.toMatch(/live|now/i);
  });

  it("says a saved edit is updated, and still tells the truth about when it works", () => {
    const message = couponSavedMessage({ ...saved, status: "scheduled", editing: true });

    expect(message.title).toBe("FRESH50 updated");
    expect(message.description).toContain("opens at checkout on 20 Nov");
  });

  it("warns when the saved code can't be used", () => {
    expect(couponSavedMessage({ ...saved, status: "ended", editing: true }).description).toMatch(/won't work/);
    expect(couponSavedMessage({ ...saved, status: "inactive", editing: true }).description).toMatch(/won't work/);
  });
});

describe("editedCouponDatesProblem", () => {
  const dated = { startsAt: couponStartInstant("2026-11-01"), endsAt: couponEndInstant("2026-11-30") };

  it("lets an older coupon with no dates be saved without any", () => {
    expect(editedCouponDatesProblem("", "", { startsAt: null, endsAt: null })).toBeNull();
  });

  it("won't let a dated coupon be blanked into an open-ended one", () => {
    expect(editedCouponDatesProblem("", "2026-11-30", dated)).toMatch(/start date/);
    expect(editedCouponDatesProblem("2026-11-01", "", dated)).toMatch(/end date/);
  });

  it("still refuses an end before the start", () => {
    expect(editedCouponDatesProblem("2026-11-10", "2026-11-09", dated)).toMatch(/before the start/);
  });

  it("allows an end in the past, so an ended coupon can be edited", () => {
    expect(editedCouponDatesProblem("2026-01-01", "2026-01-31", dated)).toBeNull();
  });
});

describe("day → stored instant", () => {
  it("opens at midnight in India, which is the evening before in UTC", () => {
    expect(couponStartInstant("2026-11-05")).toBe("2026-11-04T18:30:00.000Z");
  });

  it("closes at the last millisecond of the day in India", () => {
    expect(couponEndInstant("2026-11-05")).toBe("2026-11-05T18:29:59.999Z");
  });

  it("keeps a coupon alive through the evening of its last day", () => {
    const end = Date.parse(couponEndInstant("2026-11-05"));
    expect(end).toBeGreaterThan(Date.parse("2026-11-05T16:30:00+05:30"));
    expect(end).toBeGreaterThan(Date.parse("2026-11-05T23:59:59+05:30"));
    expect(end).toBeLessThan(Date.parse("2026-11-06T00:00:00+05:30"));
  });
});

describe("couponDay — reading back", () => {
  it("gives the IST day where slicing the ISO string gives the day before", () => {
    const stored = couponStartInstant("2026-11-05");
    expect(stored.slice(0, 10)).toBe("2026-11-04");
    expect(couponDay(stored)).toBe("2026-11-05");
  });

  it("round-trips both edges, so re-saving a form never moves a coupon", () => {
    expect(couponDay(couponStartInstant("2026-12-31"))).toBe("2026-12-31");
    expect(couponDay(couponEndInstant("2026-12-31"))).toBe("2026-12-31");
  });

  it("reads an old midnight-UTC end as the day the operator picked", () => {
    expect(couponDay("2026-11-05T00:00:00+00:00")).toBe("2026-11-05");
  });

  it("is blank for nothing, and for a value that is not a date", () => {
    expect(couponDay(null)).toBe("");
    expect(couponDay(undefined)).toBe("");
    expect(couponDay("not-a-date")).toBe("");
  });
});

describe("isCouponDay", () => {
  it("accepts a real day and refuses one the calendar does not have", () => {
    expect(isCouponDay("2028-02-29")).toBe(true);
    expect(isCouponDay("2026-02-29")).toBe(false);
    expect(isCouponDay("2026-02-31")).toBe(false);
    expect(isCouponDay("2026-13-01")).toBe(false);
    expect(isCouponDay("05/11/2026")).toBe(false);
    expect(isCouponDay(null)).toBe(false);
  });
});

describe("labels", () => {
  it("shows a window as short days", () => {
    expect(
      couponValidityLabel(couponStartInstant("2026-11-01"), couponEndInstant("2026-11-30")),
    ).toBe("1 Nov – 30 Nov");
  });

  it("labels the days in IST, not the machine's zone", () => {
    expect(couponDayLabel("2026-11-05")).toBe("5 Nov");
    expect(couponDayLabel("2026-11-05", { year: true })).toBe("5 Nov 2026");
  });

  it("adds the year only when the window crosses one", () => {
    expect(
      couponValidityLabel(couponStartInstant("2026-12-20"), couponEndInstant("2027-01-05")),
    ).toBe("20 Dec 2026 – 5 Jan 2027");
  });

  it("says something true about a coupon missing a bound", () => {
    expect(couponValidityLabel(null, couponEndInstant("2026-11-30"))).toBe("Until 30 Nov");
    expect(couponValidityLabel(couponStartInstant("2026-11-01"), null)).toBe("From 1 Nov");
    expect(couponValidityLabel(null, null)).toBe("No dates");
  });
});

describe("couponStatus", () => {
  const coupon = {
    active: true,
    startsAt: couponStartInstant("2026-11-05"),
    endsAt: couponEndInstant("2026-11-10"),
  };
  const at = (iso: string) => Date.parse(iso);

  it("is Scheduled until midnight IST on the first day", () => {
    expect(couponStatus(coupon, at("2026-11-04T23:59:59+05:30"))).toBe("scheduled");
    expect(couponStatus(coupon, at("2026-11-05T00:00:00+05:30"))).toBe("live");
  });

  it("is Live right up to the end of the last day, then Ended", () => {
    expect(couponStatus(coupon, at("2026-11-10T23:59:59+05:30"))).toBe("live");
    expect(couponStatus(coupon, at("2026-11-11T00:00:00+05:30"))).toBe("ended");
  });

  it("does not call a switched-off code Live", () => {
    expect(couponStatus({ ...coupon, active: false }, at("2026-11-07T12:00:00+05:30"))).toBe("inactive");
  });

  it("keeps Ended for a code that is both over and switched off", () => {
    expect(couponStatus({ ...coupon, active: false }, at("2026-12-01T12:00:00+05:30"))).toBe("ended");
  });

  it("treats a coupon with no dates as Live", () => {
    expect(couponStatus({ active: true, startsAt: null, endsAt: null }, at("2026-11-07T12:00:00Z"))).toBe("live");
  });
});

describe("newCouponDatesProblem", () => {
  const today = "2026-11-01";

  it("requires both dates", () => {
    expect(newCouponDatesProblem("", "2026-11-30", today)).toMatch(/start date/);
    expect(newCouponDatesProblem("2026-11-01", "", today)).toMatch(/end date/);
  });

  it("refuses an end before the start, and allows a one-day coupon", () => {
    expect(newCouponDatesProblem("2026-11-10", "2026-11-09", today)).toMatch(/before the start/);
    expect(newCouponDatesProblem("2026-11-10", "2026-11-10", today)).toBeNull();
  });

  it("refuses an end in the past but allows one that is today", () => {
    expect(newCouponDatesProblem("2026-10-01", "2026-10-31", today)).toMatch(/past/);
    expect(newCouponDatesProblem("2026-10-01", today, today)).toBeNull();
  });
});

describe("readCouponWindow", () => {
  it("converts days to IST instants", () => {
    expect(readCouponWindow({ startsAt: "2026-11-01", endsAt: "2026-11-30" })).toEqual({
      ok: true,
      startsAt: "2026-10-31T18:30:00.000Z",
      endsAt: "2026-11-30T18:29:59.999Z",
    });
  });

  it("allows a single-day window", () => {
    expect(readCouponWindow({ startsAt: "2026-11-05", endsAt: "2026-11-05" }).ok).toBe(true);
  });

  it("tells absent, cleared and set apart", () => {
    expect(readCouponWindow({})).toEqual({ ok: true, startsAt: undefined, endsAt: undefined });
    expect(readCouponWindow({ startsAt: null, endsAt: "" })).toEqual({ ok: true, startsAt: null, endsAt: null });
  });

  it("keeps a full timestamp as the instant it already is", () => {
    expect(readCouponWindow({ endsAt: "2026-11-05T18:29:59.999Z" })).toEqual({
      ok: true,
      startsAt: undefined,
      endsAt: "2026-11-05T18:29:59.999Z",
    });
  });

  it("refuses an end before the start", () => {
    expect(readCouponWindow({ startsAt: "2026-11-10", endsAt: "2026-11-09" }).ok).toBe(false);
  });

  it("refuses anything that is not a date", () => {
    expect(readCouponWindow({ endsAt: "soon" }).ok).toBe(false);
    expect(readCouponWindow({ endsAt: "2026-02-31" }).ok).toBe(false);
    expect(readCouponWindow({ startsAt: 20261101 }).ok).toBe(false);
  });
});
