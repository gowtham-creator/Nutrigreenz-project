/**
 * POST /api/admin/marketing/broadcast
 *
 * "Send now" used to reach the whole base. A code limited to named customers must
 * go only to those numbers, and the list comes from the saved coupon so that
 * nothing in the request can widen it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  broadcastCampaign: vi.fn(),
  couponAudiencePhones: vi.fn(),
  logActivity: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "cookie" }) }),
}));
vi.mock("@/lib/admin-auth", () => ({ ADMIN_COOKIE: "ng_admin" }));
vi.mock("@/lib/admin-session", () => ({ verifyToken: m.verifyToken }));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/broadcast", () => ({ broadcastCampaign: m.broadcastCampaign }));
vi.mock("@/lib/marketing-audience", () => ({ ConsentColumnsMissing: class extends Error {} }));
vi.mock("@/lib/activity-log", () => ({ logActivity: m.logActivity }));
vi.mock("@/lib/rewards", () => ({ couponAudiencePhones: m.couponAudiencePhones }));

import { POST } from "./route";

const RESULT = {
  audience: 2,
  email: { sent: 2, skipped: 0, failed: 0 },
  sms: { sent: 0, skipped: 0, failed: 0 },
};

const send = (body: Record<string, unknown> = {}) =>
  POST(
    new Request("http://localhost/api/admin/marketing/broadcast", {
      method: "POST",
      body: JSON.stringify({
        type: "offer",
        channels: ["email"],
        campaignKey: "VIP20",
        vars: {},
        ...body,
      }),
    }),
  );

beforeEach(() => {
  m.verifyToken.mockResolvedValue({ role: "superadmin", email: "owner@example.com" });
  m.broadcastCampaign.mockResolvedValue(RESULT);
  m.logActivity.mockResolvedValue(undefined);
});

describe("POST /api/admin/marketing/broadcast", () => {
  it("sends a customer-targeted code only to its saved numbers", async () => {
    m.couponAudiencePhones.mockResolvedValue(["+919876543210", "+919876543211"]);

    const res = await send();

    expect(res.status).toBe(200);
    expect(m.couponAudiencePhones).toHaveBeenCalledWith("VIP20");
    expect(m.broadcastCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ phones: ["+919876543210", "+919876543211"] }),
    );
  });

  it("ignores any list in the request: only the saved coupon decides", async () => {
    m.couponAudiencePhones.mockResolvedValue(["+919876543210"]);

    await send({ phones: ["+919000000000", "+919000000001"] });

    expect(m.broadcastCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ phones: ["+919876543210"] }),
    );
  });

  it("leaves every other code going to the whole base", async () => {
    m.couponAudiencePhones.mockResolvedValue(null);

    await send();

    expect(m.broadcastCampaign).toHaveBeenCalledWith(expect.objectContaining({ phones: null }));
  });

  it("sends nothing when the coupon can't be read, rather than falling back to everyone", async () => {
    m.couponAudiencePhones.mockRejectedValue(new Error("connection reset"));

    const res = await send();

    expect(res.status).toBe(500);
    expect(m.broadcastCampaign).not.toHaveBeenCalled();
  });

  it("logs how many numbers it was limited to, not the numbers", async () => {
    m.couponAudiencePhones.mockResolvedValue(["+919876543210"]);

    await send();

    const logged = JSON.stringify(m.logActivity.mock.calls[0][0]);
    expect(logged).toContain('"limitedToNumbers":1');
    expect(logged).not.toContain("+919876543210");
  });

  it("refuses anyone but a super admin", async () => {
    m.verifyToken.mockResolvedValue({ role: "admin", email: "staff@example.com" });

    const res = await send();

    expect(res.status).toBe(401);
    expect(m.broadcastCampaign).not.toHaveBeenCalled();
  });
});
