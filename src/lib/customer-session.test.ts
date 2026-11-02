/**
 * Referral capture on the signed-in path: what reaches the attribution engine
 * from the request. The engine itself is covered in referrals.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/test/fake-supabase";

const m = vi.hoisted(() => ({
  db: null as unknown,
  recordAttribution: vi.fn(),
  cookies: {} as Record<string, string>,
  headers: {} as Record<string, string>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name in m.cookies ? { value: m.cookies[name] } : undefined),
  }),
  headers: async () => ({ get: (name: string) => m.headers[name] ?? null }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => m.db,
}));
vi.mock("@/lib/session", () => ({
  NG_SESSION_COOKIE: "ng_session",
  verifySessionToken: async () => "uid-1",
}));
vi.mock("@/lib/customer-identity", () => ({
  getCustomerByIdentity: vi.fn(),
  resolveCustomer: vi.fn(),
}));
vi.mock("@/lib/referrals", async () => ({
  // The real hash: this is about what goes in, and that it is not the raw string.
  deviceFingerprint: (await vi.importActual<typeof import("@/lib/referrals")>("@/lib/referrals"))
    .deviceFingerprint,
  recordAttribution: m.recordAttribution,
}));
vi.mock("@/lib/rewards", () => ({ getLoyaltyConfig: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ getFeatureFlags: vi.fn(), isFeatureEnabled: vi.fn() }));

import { getCustomerSession } from "@/lib/customer-session";
import { deviceFingerprint } from "@/lib/referrals";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)";

beforeEach(() => {
  m.db = createFakeSupabase(() => ({ data: { customer_id: "cust-1" } })).client;
  m.cookies = { ng_session: "token", ng_ref: "ABC123" };
  m.headers = { "x-forwarded-for": "49.36.1.2, 10.0.0.1", "user-agent": IPHONE };
  m.recordAttribution.mockResolvedValue({ ok: true, attributionId: "attr-1" });
});

describe("getCustomerSession — referral capture", () => {
  it("passes the hashed device, never the raw user-agent", async () => {
    await getCustomerSession();

    expect(m.recordAttribution).toHaveBeenCalledWith({
      refereeCustomerId: "cust-1",
      code: "ABC123",
      ip: "49.36.1.2",
      deviceHash: deviceFingerprint("49.36.1.2", IPHONE),
    });
  });

  it("skips the device when the request has no user-agent", async () => {
    m.headers = { "x-forwarded-for": "49.36.1.2" };

    await getCustomerSession();

    expect(m.recordAttribution).toHaveBeenCalledWith(
      expect.objectContaining({ deviceHash: null }),
    );
  });

  it("does nothing without a referral cookie", async () => {
    m.cookies = { ng_session: "token" };

    await getCustomerSession();

    expect(m.recordAttribution).not.toHaveBeenCalled();
  });
});
