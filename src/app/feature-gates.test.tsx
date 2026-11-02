/**
 * Turning a feature off must really close it: the page 404s and its API refuses,
 * on the server, whatever the browser has cached or a link still points at.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  isReferralProgrammeOpen: vi.fn(),
  getReferralConfig: vi.fn(),
  getStorefrontFlags: vi.fn(),
  getCustomerReferralSummary: vi.fn(),
  getCustomerSession: vi.fn(),
  otpProvider: vi.fn(),
}));

class NotFound extends Error {}

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound();
  },
}));
vi.mock("@/lib/seo", () => ({ pageMeta: (m: object) => m }));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/components/ng/captain/captain-store", () => ({
  CaptainStoreProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  featureOffResponse: (await importOriginal<typeof import("@/lib/feature-flags")>()).featureOffResponse,
  isFeatureEnabled: m.isFeatureEnabled,
}));
vi.mock("@/lib/referrals", () => ({
  getCustomerReferralSummary: m.getCustomerReferralSummary,
  getReferralConfig: m.getReferralConfig,
  getStorefrontFlags: m.getStorefrontFlags,
  isReferralProgrammeOpen: m.isReferralProgrammeOpen,
}));
vi.mock("@/lib/customer-session", () => ({ getCustomerSession: m.getCustomerSession }));
vi.mock("@/lib/rewards", () => ({ getLoyaltyConfig: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifyIdToken: vi.fn(), isAdminConfigured: true }));
vi.mock("@/lib/captains", () => ({ getCaptainByPhone: vi.fn(), toCaptainMe: vi.fn() }));
vi.mock("@/lib/captain-session", () => ({ mintCaptainSession: vi.fn() }));
vi.mock("@/lib/otp-provider", () => ({ otpProvider: m.otpProvider }));
vi.mock("@/lib/msg91-otp", () => ({ verifyOtp: vi.fn(), isMsg91OtpConfigured: () => true }));

import ReferralLayout from "./referral/layout";
import CommunityBundleLayout from "./community/bundle/layout";
import CaptainLayout from "./captain/layout";
import { GET as shareLink } from "./r/[code]/route";
import { GET as referralsMe } from "./api/referrals/me/route";
import { GET as publicFlags } from "./api/feature-flags/route";
import { POST as captainLogin } from "./api/captain/login/route";

const child = "the page";

beforeEach(() => {
  m.isFeatureEnabled.mockResolvedValue(true);
  m.isReferralProgrammeOpen.mockResolvedValue(true);
  m.getReferralConfig.mockResolvedValue({ expiryDays: 30 });
});

describe("feature pages", () => {
  it("renders the referral page while the programme is open", async () => {
    await expect(ReferralLayout({ children: child })).resolves.toBe(child);
  });

  it("404s the referral page when the programme is closed", async () => {
    m.isReferralProgrammeOpen.mockResolvedValue(false);
    await expect(ReferralLayout({ children: child })).rejects.toBeInstanceOf(NotFound);
  });

  it("renders the community section while its switch is on", async () => {
    await expect(CommunityBundleLayout({ children: child })).resolves.toBe(child);
    expect(m.isFeatureEnabled).toHaveBeenCalledWith("community_bundles");
  });

  it("404s the community section when its switch is off", async () => {
    m.isFeatureEnabled.mockResolvedValue(false);
    await expect(CommunityBundleLayout({ children: child })).rejects.toBeInstanceOf(NotFound);
  });

  it("renders the captain tool while its switch is on", async () => {
    await expect(CaptainLayout({ children: child })).resolves.toBeTruthy();
    expect(m.isFeatureEnabled).toHaveBeenCalledWith("captain_network");
  });

  it("404s the captain tool when its switch is off", async () => {
    m.isFeatureEnabled.mockResolvedValue(false);
    await expect(CaptainLayout({ children: child })).rejects.toBeInstanceOf(NotFound);
  });
});

describe("GET /r/<code>", () => {
  const click = () =>
    shareLink(new Request("https://nutrigreenz.farm/r/abc123"), {
      params: Promise.resolve({ code: "abc123" }),
    });

  it("stamps the referral cookie while the programme is open", async () => {
    const res = await click();
    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toContain("ng_ref=ABC123");
  });

  it("still lands on the shop, with no cookie, when the programme is closed", async () => {
    m.isReferralProgrammeOpen.mockResolvedValue(false);

    const res = await click();

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://nutrigreenz.farm/");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("GET /api/referrals/me", () => {
  it("404s when the programme is closed, without minting a code", async () => {
    m.isReferralProgrammeOpen.mockResolvedValue(false);

    const res = await referralsMe();

    expect(res.status).toBe(404);
    expect(m.getCustomerSession).not.toHaveBeenCalled();
    expect(m.getCustomerReferralSummary).not.toHaveBeenCalled();
  });

  it("still asks for a session while the programme is open", async () => {
    m.getCustomerSession.mockResolvedValue(null);
    const res = await referralsMe();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/feature-flags", () => {
  it("answers with the map the storefront should act on", async () => {
    m.getStorefrontFlags.mockResolvedValue({ referrals: false, subscriptions: true });

    const res = await publicFlags();

    expect((await res.json()).flags).toEqual({ referrals: false, subscriptions: true });
  });
});

describe("POST /api/captain/login", () => {
  const login = () =>
    captainLogin(
      new Request("http://localhost/api/captain/login", {
        method: "POST",
        body: JSON.stringify({ idToken: "token" }),
      }),
    );

  it("404s when the captain network is off, before verifying anything", async () => {
    m.isFeatureEnabled.mockResolvedValue(false);

    const res = await login();

    expect(res.status).toBe(404);
    expect(m.otpProvider).not.toHaveBeenCalled();
  });

  it("goes on to verify the login while the network is on", async () => {
    await login();
    expect(m.otpProvider).toHaveBeenCalled();
  });
});
