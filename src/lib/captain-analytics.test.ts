/**
 * Captain analytics: what falls in each IST period, what the filters do, and that
 * the figures and the sales list always agree.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/captains", () => ({ listCaptains: vi.fn() }));

import { quarterStart, resolveRange, summariseSales, type CaptureRow } from "./captain-analytics";

// Tuesday 3 Nov 2026, 7:00 PM IST.
const NOW = new Date("2026-11-03T13:30:00Z");

let n = 0;
function sale(istLocal: string, patch: Partial<CaptureRow> = {}): CaptureRow {
  n += 1;
  return {
    id: `s${n}`,
    captain_id: "cap-a",
    customer_name: "Asha",
    customer_mobile: "9800000001",
    community: "SAS Crown",
    items: [{ title: "Groundnut Oil", qty: 2 }],
    total_paise: 10_000,
    pay_mode: "cash",
    captured_at: new Date(`${istLocal}+05:30`).toISOString(),
    ...patch,
  };
}

const ROWS = [
  sale("2026-11-03T10:00:00", { pay_mode: "upi", total_paise: 20_000 }),
  sale("2026-11-02T10:00:00", { captain_id: "cap-b", community: "My Home" }),
  sale("2026-11-01T23:59:00"), // Sunday: last week, this month
  sale("2026-10-15T10:00:00", { community: null }), // last month, this quarter
  sale("2026-09-30T23:00:00"), // last quarter
];

const options = (over = {}) => ({
  now: NOW,
  from: "2026-11-01",
  to: "2026-11-03",
  community: null,
  captainNames: new Map([["cap-a", "Sneha"], ["cap-b", "Arjun"]]),
  ...over,
});

describe("summariseSales", () => {
  const a = summariseSales(ROWS, options());

  it("counts each IST period, with weeks from Monday and calendar quarters", () => {
    expect(a.periods.today).toMatchObject({ sales: 1, gmvPaise: 20_000, from: "2026-11-03" });
    expect(a.periods.week).toMatchObject({ sales: 2, from: "2026-11-02" });
    expect(a.periods.month).toMatchObject({ sales: 3, from: "2026-11-01" });
    expect(a.periods.quarter).toMatchObject({ sales: 4, from: "2026-10-01" });
  });

  it("splits cash and UPI", () => {
    expect(a.range).toMatchObject({ sales: 3, gmvPaise: 40_000, cashPaise: 20_000, upiPaise: 20_000 });
  });

  it("puts a sale at 11:59 PM IST on its Indian date, and zero-fills the days", () => {
    expect(a.range.daily).toEqual([
      { day: "2026-11-01", sales: 1, gmvPaise: 10_000 },
      { day: "2026-11-02", sales: 1, gmvPaise: 10_000 },
      { day: "2026-11-03", sales: 1, gmvPaise: 20_000 },
    ]);
  });

  it("finds one chosen day, newest first when there are several", () => {
    const day = summariseSales(ROWS, options({ from: "2026-11-02", to: "2026-11-02" }));
    expect(day.sales.map((s) => s.captainName)).toEqual(["Arjun"]);
    expect(day.range.sales).toBe(1);
    expect(a.sales[0].capturedAt > a.sales[1].capturedAt).toBe(true);
  });

  it("narrows every figure to one community, and still lists them all to choose from", () => {
    const one = summariseSales(ROWS, options({ community: "My Home" }));
    expect(one.periods.quarter.sales).toBe(1);
    expect(one.range.sales).toBe(1);
    expect(one.communities).toEqual(["My Home", "SAS Crown"]);
  });

  it("offers assigned communities that have not sold yet", () => {
    expect(summariseSales([], options({ assigned: ["Aparna"] })).communities).toEqual(["Aparna"]);
  });

  it("ranks captains and communities, and names a sale with no community", () => {
    expect(a.byCaptain.map((c) => [c.name, c.gmvPaise])).toEqual([["Sneha", 30_000], ["Arjun", 10_000]]);
    const october = summariseSales(ROWS, options({ from: "2026-10-01", to: "2026-10-31" }));
    expect(october.byCommunity).toEqual([{ community: "No community", sales: 1, gmvPaise: 10_000 }]);
  });

  it("shows items in plain words", () => {
    expect(a.sales[0].items).toBe("Groundnut Oil × 2");
  });
});

describe("dates", () => {
  it("starts quarters on January, April, July and October", () => {
    expect(quarterStart(new Date("2026-02-10T06:00:00Z"))).toBe("2026-01-01");
    expect(quarterStart(new Date("2026-06-30T06:00:00Z"))).toBe("2026-04-01");
    expect(quarterStart(NOW)).toBe("2026-10-01");
  });

  it("defaults to this month, ignores nonsense, and never runs backwards", () => {
    expect(resolveRange(null, null, NOW)).toEqual({ from: "2026-11-01", to: "2026-11-03" });
    expect(resolveRange("rubbish", "2026-11-02", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-02" });
    expect(resolveRange("2026-11-02", "2026-10-02", NOW)).toEqual({ from: "2026-10-02", to: "2026-11-02" });
  });
});
