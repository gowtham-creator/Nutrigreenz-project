/**
 * The admin coupon routes: dates required to create, IST days stored as the
 * instants they stand for, and older coupons left editable.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  createCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../guard", () => ({
  requireSuperAdmin: async () => null,
  superAdminEmail: async () => "owner@example.com",
}));
vi.mock("../../guard", () => ({
  requireSuperAdmin: async () => null,
  superAdminEmail: async () => "owner@example.com",
}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/activity-log", () => ({ logActivity: m.logActivity }));
vi.mock("@/lib/rewards", () => ({
  listCoupons: vi.fn(),
  createCoupon: m.createCoupon,
  updateCoupon: m.updateCoupon,
  removeCoupon: vi.fn(),
}));

import { POST } from "./route";
import { PATCH } from "./[id]/route";

const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

const VALID = {
  code: "FRESH50",
  kind: "percent",
  value: 10,
  startsAt: today,
  endsAt: future,
};

const create = (body: Record<string, unknown>) =>
  POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) }));

const edit = (body: Record<string, unknown>) =>
  PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "coupon-1" }),
  });

const errorOf = async (res: Response) => ((await res.json()) as { error?: string }).error;

beforeEach(() => {
  m.createCoupon.mockImplementation(async (input: Record<string, unknown>) => ({
    ...input,
    customerPhones: input.customerPhones ?? null,
    stackLoyalty: input.stackLoyalty ?? true,
  }));
  m.updateCoupon.mockResolvedValue({ code: "FRESH50", customerPhones: null, stackLoyalty: true });
  m.logActivity.mockResolvedValue(undefined);
});

describe("POST /api/admin/marketing/coupons", () => {
  it("creates with IST day boundaries", async () => {
    const res = await create({ ...VALID, startsAt: "2030-11-05", endsAt: "2030-11-30" });

    expect(res.status).toBe(201);
    expect(m.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: "2030-11-04T18:30:00.000Z",
        endsAt: "2030-11-30T18:29:59.999Z",
      }),
    );
  });

  it.each([
    ["no dates", { startsAt: undefined, endsAt: undefined }],
    ["no start", { startsAt: undefined }],
    ["no end", { endsAt: undefined }],
    ["blank dates", { startsAt: "", endsAt: "" }],
    ["null end", { endsAt: null }],
  ])("refuses %s with dates-required", async (_name, change) => {
    const res = await create({ ...VALID, ...change });

    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("dates-required");
    expect(m.createCoupon).not.toHaveBeenCalled();
  });

  it("refuses an end before the start with dates-invalid", async () => {
    const res = await create({ ...VALID, startsAt: "2030-11-10", endsAt: "2030-11-09" });

    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("dates-invalid");
  });

  it("refuses something that isn't a date", async () => {
    expect(await errorOf(await create({ ...VALID, endsAt: "next week" }))).toBe("dates-invalid");
  });

  it("stores customer numbers as E.164", async () => {
    await create({ ...VALID, customerPhones: ["98765 43210", "+919876543210"] });

    expect(m.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhones: ["+919876543210"] }),
    );
  });

  it("refuses a bad number instead of widening the code to everyone", async () => {
    const res = await create({ ...VALID, customerPhones: ["12345"] });

    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("customer-phones-invalid");
    expect(m.createCoupon).not.toHaveBeenCalled();
  });

  it("refuses an empty list, which would otherwise mean anyone", async () => {
    expect(await errorOf(await create({ ...VALID, customerPhones: [] }))).toBe(
      "customer-phones-invalid",
    );
  });

  it("keeps a full Places address whole when communities arrive as a list", async () => {
    const community = "SAS Crown, Golden Mile Road, Kokapet, Hyderabad, Telangana, India";

    await create({ ...VALID, communities: [community], pincodes: ["500075"] });

    expect(m.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ communities: [community], pincodes: ["500075"] }),
    );
  });

  it("persists the loyalty toggle and cleans the description", async () => {
    await create({ ...VALID, stackLoyalty: false, description: "  <b>₹50</b> off {brand}  " });

    expect(m.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ stackLoyalty: false, description: "₹50 off brand" }),
    );
  });

  it("refuses an over-long description by name", async () => {
    const res = await create({ ...VALID, description: "x".repeat(121) });

    expect(res.status).toBe(400);
    expect(m.createCoupon).not.toHaveBeenCalled();
  });

  it("logs a count of customers, not their numbers", async () => {
    await create({ ...VALID, customerPhones: ["9876543210"] });

    const logged = JSON.stringify(m.logActivity.mock.calls[0][0]);
    expect(logged).toContain('"customerCount":1');
    expect(logged).not.toContain("9876543210");
  });
});

describe("PATCH /api/admin/marketing/coupons/[id]", () => {
  it("lets an older coupon with no dates be edited without any", async () => {
    const res = await edit({ value: 15, startsAt: null, endsAt: null });

    expect(res.status).toBe(200);
    expect(m.updateCoupon).toHaveBeenCalledWith(
      "coupon-1",
      expect.objectContaining({ value: 15, startsAt: null, endsAt: null }),
    );
  });

  it("leaves the dates alone when the request doesn't mention them", async () => {
    await edit({ active: false });

    expect(m.updateCoupon).toHaveBeenCalledWith("coupon-1", { active: false });
  });

  it("converts dates to IST day boundaries", async () => {
    await edit({ startsAt: "2030-11-05", endsAt: "2030-11-30" });

    expect(m.updateCoupon).toHaveBeenCalledWith("coupon-1", {
      startsAt: "2030-11-04T18:30:00.000Z",
      endsAt: "2030-11-30T18:29:59.999Z",
    });
  });

  it("refuses an end before the start", async () => {
    const res = await edit({ startsAt: "2030-11-10", endsAt: "2030-11-09" });

    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("dates-invalid");
    expect(m.updateCoupon).not.toHaveBeenCalled();
  });

  it("allows an end in the past, so an ended coupon can still be edited", async () => {
    expect((await edit({ startsAt: "2020-01-01", endsAt: "2020-01-31" })).status).toBe(200);
  });

  it("clears the customer list with null", async () => {
    await edit({ customerPhones: null });

    expect(m.updateCoupon).toHaveBeenCalledWith("coupon-1", { customerPhones: null });
  });

  it("refuses a bad number", async () => {
    const res = await edit({ customerPhones: ["12345"] });

    expect(await errorOf(res)).toBe("customer-phones-invalid");
    expect(m.updateCoupon).not.toHaveBeenCalled();
  });

  it("keeps a community and its pincode together", async () => {
    await edit({ communities: ["SAS Crown, Kokapet"], pincodes: ["500075"] });

    expect(m.updateCoupon).toHaveBeenCalledWith("coupon-1", {
      communities: ["SAS Crown, Kokapet"],
      pincodes: ["500075"],
    });
  });
});
