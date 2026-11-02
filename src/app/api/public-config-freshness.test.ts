/**
 * The public config reads must never be cached.
 *
 * Vercel's CDN honoured `public, max-age=60` (seen live: x-vercel-cache HIT,
 * age 47) and the browser's `cache: "no-store"` does not reach past it, so a
 * Super Admin change could take six minutes to arrive while the server was
 * already charging from the new value.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getPublicLoyaltyConfig: vi.fn(),
  getStorefrontFlags: vi.fn(),
  isServiceable: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rewards", () => ({ getPublicLoyaltyConfig: m.getPublicLoyaltyConfig }));
vi.mock("@/lib/referrals", () => ({ getStorefrontFlags: m.getStorefrontFlags }));
vi.mock("@/lib/commerce-rules", () => ({ isServiceable: m.isServiceable }));

import { GET as loyaltyConfig } from "./loyalty-config/route";
import { GET as featureFlags } from "./feature-flags/route";
import { GET as serviceable } from "./commerce-rules/serviceable/route";
import { GET as geoPincode } from "./geo/pincode/route";

beforeEach(() => {
  m.getPublicLoyaltyConfig.mockResolvedValue({ earnEnabled: false });
  m.getStorefrontFlags.mockResolvedValue({ referrals: true });
  m.isServiceable.mockResolvedValue(true);
  // India Post is optional: the offline table answers when it cannot be reached.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
});

describe("public config reads", () => {
  it("does not cache the loyalty config", async () => {
    const res = await loyaltyConfig();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not cache the feature flags", async () => {
    const res = await featureFlags();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not cache a serviceability answer", async () => {
    const res = await serviceable(
      new Request("http://localhost/api/commerce-rules/serviceable?pincode=500081"),
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not cache the pincode lookup, which carries the serviceable flag", async () => {
    const res = await geoPincode(new Request("http://localhost/api/geo/pincode?pincode=500081"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
