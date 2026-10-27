/**
 * The Orders portal's period windows: IST calendar days, Monday weeks and
 * calendar months, whatever time zone the server runs in.
 */
import { describe, expect, it } from "vitest";
import { istDay, periodRangeLabel, periodWindows } from "./order-periods";

// Tuesday 27 Oct 2026, 7:00 PM IST.
const TUE_EVENING = new Date("2026-10-27T13:30:00Z");

describe("periodWindows", () => {
  it("cuts today at midnight IST, not midnight UTC", () => {
    const w = periodWindows(TUE_EVENING).today;
    expect(w.from).toBe("2026-10-26T18:30:00.000Z");
    expect(w.to).toBe("2026-10-27T18:30:00.000Z");
    expect(w.previousFrom).toBe("2026-10-25T18:30:00.000Z");
    expect(w.previousTo).toBe("2026-10-26T18:30:00.000Z");
    expect(w.days).toEqual(["2026-10-27"]);
  });

  it("treats 12:10 AM IST as the new day while it is still the previous day in UTC", () => {
    const justAfterMidnight = new Date("2026-10-27T18:40:00Z"); // 28 Oct, 12:10 AM IST
    expect(istDay(justAfterMidnight.getTime())).toBe("2026-10-28");
    expect(periodWindows(justAfterMidnight).today.from).toBe("2026-10-27T18:30:00.000Z");
  });

  it("starts the week on Monday and lists its days up to today", () => {
    const w = periodWindows(TUE_EVENING).week;
    expect(w.from).toBe("2026-10-25T18:30:00.000Z"); // Mon 26 Oct, 00:00 IST
    expect(w.to).toBe("2026-11-01T18:30:00.000Z"); // Mon 2 Nov, 00:00 IST
    expect(w.previousFrom).toBe("2026-10-18T18:30:00.000Z");
    expect(w.days).toEqual(["2026-10-26", "2026-10-27"]);
  });

  it("keeps Sunday in the week that began the Monday before", () => {
    const sunday = new Date("2026-11-01T06:00:00Z"); // Sun 1 Nov, 11:30 AM IST
    const w = periodWindows(sunday).week;
    expect(w.from).toBe("2026-10-25T18:30:00.000Z");
    expect(w.days).toHaveLength(7);
  });

  it("uses the calendar month, with last month as the comparison", () => {
    const w = periodWindows(TUE_EVENING).month;
    expect(w.from).toBe("2026-09-30T18:30:00.000Z"); // 1 Oct, 00:00 IST
    expect(w.to).toBe("2026-10-31T18:30:00.000Z"); // 1 Nov, 00:00 IST
    expect(w.previousFrom).toBe("2026-08-31T18:30:00.000Z"); // 1 Sep
    expect(w.previousTo).toBe(w.from);
    expect(w.days).toHaveLength(27);
    expect(w.days[0]).toBe("2026-10-01");
  });

  it("rolls January back into December of the year before", () => {
    const w = periodWindows(new Date("2027-01-15T06:00:00Z")).month;
    expect(w.from).toBe("2026-12-31T18:30:00.000Z");
    expect(w.previousFrom).toBe("2026-11-30T18:30:00.000Z");
  });
});

describe("periodRangeLabel", () => {
  const w = periodWindows(TUE_EVENING);

  it("names the day, the Monday–Sunday span and the month", () => {
    expect(periodRangeLabel(w.today)).toMatch(/Tue.*27 Oct/);
    expect(periodRangeLabel(w.week)).toBe("26 Oct – 1 Nov");
    expect(periodRangeLabel(w.month)).toBe("October 2026");
  });
});
