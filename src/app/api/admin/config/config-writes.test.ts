/**
 * What a Super Admin save does beyond writing the row: pages cached for 60s are
 * busted, so the storefront does not contradict the new setting for a minute.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  revalidateStorefront: vi.fn(),
  updateCommerceRules: vi.fn(),
  updateFeatureFlags: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./guard", () => ({ requireSuperAdmin: m.requireSuperAdmin }));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/revalidate-storefront", () => ({ revalidateStorefront: m.revalidateStorefront }));
vi.mock("@/lib/commerce-rules", () => ({
  getCommerceRules: vi.fn(),
  updateCommerceRules: m.updateCommerceRules,
}));
vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: [{ key: "referrals" }],
  listFeatureFlags: vi.fn(),
  updateFeatureFlags: m.updateFeatureFlags,
}));

import { PUT as putCommerce } from "./commerce/route";
import { PUT as putFeatures } from "./features/route";

const put = (body: unknown) =>
  new Request("http://localhost/api/admin/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  m.requireSuperAdmin.mockResolvedValue(null);
  m.updateCommerceRules.mockResolvedValue({ currency: "INR" });
  m.updateFeatureFlags.mockResolvedValue([]);
});

describe("saving the commerce rules", () => {
  it("busts the cached storefront pages", async () => {
    const res = await putCommerce(put({ freeDeliveryThresholdPaise: 79_900 }));
    expect(res.status).toBe(200);
    expect(m.revalidateStorefront).toHaveBeenCalledTimes(1);
  });

  it("leaves the cache alone when the save fails", async () => {
    m.updateCommerceRules.mockRejectedValue(new Error("nope"));
    const res = await putCommerce(put({ freeDeliveryThresholdPaise: 79_900 }));
    expect(res.status).toBe(400);
    expect(m.revalidateStorefront).not.toHaveBeenCalled();
  });
});

describe("saving a feature flag", () => {
  it("busts the cached storefront pages", async () => {
    const res = await putFeatures(put({ referrals: false }));
    expect(res.status).toBe(200);
    expect(m.updateFeatureFlags).toHaveBeenCalledWith({ referrals: false });
    expect(m.revalidateStorefront).toHaveBeenCalledTimes(1);
  });
});
