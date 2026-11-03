/**
 * Captain conversions: first touch wins, only later orders count, and someone
 * already shopping online is not anyone's conversion.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/captains", () => ({
  listCaptains: vi.fn(),
  normalizeMobile10: (raw: string | null) => {
    const d = (raw ?? "").replace(/\D/g, "");
    const ten = d.length > 10 ? d.slice(-10) : d;
    return /^[6-9]\d{9}$/.test(ten) ? ten : null;
  },
}));

import { buildConversions, type OfflineTouch, type OnlineOrderRow } from "./captain-conversions";

const touch = (captainId: string, mobile: string, at: string, kind: "sale" | "registered" = "sale"): OfflineTouch => ({
  captainId,
  mobile,
  name: `Buyer ${mobile.slice(-2)}`,
  at,
  kind,
  paise: kind === "sale" ? 5_000 : 0,
});

let n = 0;
const order = (phone: string, at: string, paise = 10_000): OnlineOrderRow => ({
  id: `o${++n}`,
  order_number: `NG-${n}`,
  customer_id: null,
  user_phone: phone,
  total_paise: paise,
  placed_at: at,
});

const names = new Map([["sneha", "Sneha"], ["arjun", "Arjun"]]);
const phone = (o: OnlineOrderRow) => o.user_phone;

describe("buildConversions", () => {
  it("credits a conversion when the customer orders online after the captain met them", () => {
    const r = buildConversions(
      [touch("sneha", "9800000001", "2026-10-01T10:00:00Z")],
      [order("9800000001", "2026-10-04T10:00:00Z"), order("9800000001", "2026-10-09T10:00:00Z", 20_000)],
      phone,
      names,
    );
    expect(r.customers[0]).toMatchObject({
      status: "converted",
      firstOnlineOrder: "NG-1",
      onlineOrders: 2,
      onlinePaise: 30_000,
      daysToConvert: 3,
    });
    expect(r.captains[0]).toMatchObject({ name: "Sneha", converted: 1, rate: 1, onlinePaise: 30_000 });
  });

  it("gives the credit to the captain who met them first, once", () => {
    const r = buildConversions(
      [touch("arjun", "9800000002", "2026-10-05T10:00:00Z"), touch("sneha", "9800000002", "2026-10-01T10:00:00Z")],
      [order("9800000002", "2026-10-06T10:00:00Z")],
      phone,
      names,
    );
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].captainId).toBe("sneha");
    expect(r.captains.map((c) => c.name)).toEqual(["Sneha"]);
  });

  it("does not count someone who already shopped online before the captain met them", () => {
    const r = buildConversions(
      [touch("sneha", "9800000003", "2026-10-10T10:00:00Z")],
      [order("9800000003", "2026-10-02T10:00:00Z"), order("9800000003", "2026-10-12T10:00:00Z")],
      phone,
      names,
    );
    expect(r.customers[0].status).toBe("already-online");
    expect(r.overall).toMatchObject({ converted: 0, alreadyOnline: 1, rate: 0 });
  });

  it("counts registered customers like stall customers, and leaves them out of offline sales", () => {
    const r = buildConversions(
      [touch("arjun", "9800000004", "2026-10-01T10:00:00Z", "registered")],
      [order("+91 98000 00004", "2026-10-03T10:00:00Z")],
      (o) => (o.user_phone ?? "").replace(/\D/g, "").slice(-10),
      names,
    );
    expect(r.customers[0]).toMatchObject({ via: "registered", status: "converted", offlineSales: 0 });
  });

  it("rates conversions against customers who were not online already", () => {
    const r = buildConversions(
      [
        touch("sneha", "9800000005", "2026-10-01T10:00:00Z"),
        touch("sneha", "9800000006", "2026-10-01T10:00:00Z"),
        touch("sneha", "9800000007", "2026-10-05T10:00:00Z"),
      ],
      [order("9800000005", "2026-10-02T10:00:00Z"), order("9800000007", "2026-10-01T10:00:00Z")],
      phone,
      names,
    );
    expect(r.overall).toMatchObject({ offlineCustomers: 3, converted: 1, alreadyOnline: 1, rate: 0.5 });
  });
});
