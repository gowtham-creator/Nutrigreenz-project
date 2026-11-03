/**
 * Offline SMS campaigns: who is in the audience, who never is, and when a
 * repeat goes out again.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/sms", () => ({ sendSms: vi.fn(), isSmsConfigured: () => true }));
vi.mock("@/lib/broadcast", () => ({ promoTemplateId: () => "promo-1" }));
vi.mock("@/lib/captains", () => ({
  normalizeMobile10: (raw: string | null) => {
    const d = (raw ?? "").replace(/\D/g, "");
    const ten = d.length > 10 ? d.slice(-10) : d;
    return /^[6-9]\d{9}$/.test(ten) ? ten : null;
  },
}));

import { nextRun, selectAudience } from "./offline-campaigns";

const sale = (captain: string, mobile: string, name: string | null, community: string | null) => ({
  captain_id: captain,
  customer_mobile: mobile,
  customer_name: name,
  community,
});

const SALES = [
  sale("sneha", "9800000001", "Asha", "SAS Crown"),
  sale("sneha", "9800000001", null, "SAS Crown"),
  sale("arjun", "9800000002", "Ravi", "My Home"),
  sale("sneha", "12345", "Bad number", "SAS Crown"),
];
const INTROS = [{ captain_id: "arjun", mobile: "9800000003", name: "Meena" }];

describe("selectAudience", () => {
  it("lists each valid mobile once, stall and registered customers together", () => {
    const a = selectAudience(SALES, INTROS, new Set(), {});
    expect(a.map((c) => c.mobile)).toEqual(["9800000001", "9800000002", "9800000003"]);
    expect(a[0].name).toBe("Asha");
  });

  it("narrows to one captain or one community", () => {
    expect(selectAudience(SALES, INTROS, new Set(), { captainId: "arjun" }).map((c) => c.name)).toEqual(["Ravi", "Meena"]);
    expect(selectAudience(SALES, INTROS, new Set(), { community: "sas crown" }).map((c) => c.name)).toEqual(["Asha"]);
  });

  it("never includes someone who asked not to be messaged", () => {
    const a = selectAudience(SALES, INTROS, new Set(["9800000002"]), {});
    expect(a.map((c) => c.mobile)).not.toContain("9800000002");
  });
});

describe("nextRun", () => {
  const from = new Date("2026-11-04T04:30:00Z");

  it("repeats weekly, fortnightly and monthly, and not at all for a one-off", () => {
    expect(nextRun(from, "weekly")?.toISOString()).toBe("2026-11-11T04:30:00.000Z");
    expect(nextRun(from, "fortnightly")?.toISOString()).toBe("2026-11-18T04:30:00.000Z");
    expect(nextRun(from, "monthly")?.toISOString()).toBe("2026-12-04T04:30:00.000Z");
    expect(nextRun(from, "once")).toBeNull();
  });
});
