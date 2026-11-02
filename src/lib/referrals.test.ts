/**
 * The referral engine's switches, guards and qualifying rules.
 *
 * The Supabase client is a recording fake (src/test/fake-supabase.ts), so each
 * test can assert which rows a query touched, and that a refused referral wrote
 * nothing. The feature switch and loyalty config are mocked at their boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));
vi.mock("@/lib/feature-flags", () => ({ getFeatureFlags: vi.fn(), isFeatureEnabled: vi.fn() }));
vi.mock("@/lib/rewards", () => ({ getLoyaltyConfig: vi.fn() }));

import { getFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags";
import {
  getStorefrontFlags,
  isReferralProgrammeOpen,
  recordAttribution,
} from "@/lib/referrals";

const CONFIG = {
  referrer_points: 200,
  referee_discount_paise: 10_000,
  min_qualifying_order_paise: 49_900,
  max_per_month: 10,
  expiry_days: 30,
  enabled: true,
  block_same_device: true,
  dedupe_mobile: true,
};

function installDb(extra: Responder = () => undefined, config: Record<string, unknown> = CONFIG) {
  const fake = createFakeSupabase((op) => {
    if (op.table === "referral_config") return { data: config };
    return extra(op);
  });
  h.db = fake.client;
  return fake;
}

beforeEach(() => {
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
});

describe("isReferralProgrammeOpen", () => {
  it("is open when both switches are on", async () => {
    installDb();
    await expect(isReferralProgrammeOpen()).resolves.toBe(true);
    expect(isFeatureEnabled).toHaveBeenCalledWith("referrals");
  });

  it("is closed by the feature flag", async () => {
    installDb();
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    await expect(isReferralProgrammeOpen()).resolves.toBe(false);
  });

  it("is closed by the programme toggle", async () => {
    installDb(undefined, { ...CONFIG, enabled: false });
    await expect(isReferralProgrammeOpen()).resolves.toBe(false);
  });
});

describe("getStorefrontFlags", () => {
  const FLAGS = {
    subscriptions: true,
    referrals: true,
    community_bundles: false,
    captain_network: true,
    auto_product_badges: true,
  };

  it("reports referrals off when only the programme toggle is off", async () => {
    installDb(undefined, { ...CONFIG, enabled: false });
    vi.mocked(getFeatureFlags).mockResolvedValue(FLAGS);

    await expect(getStorefrontFlags()).resolves.toEqual({ ...FLAGS, referrals: false });
  });

  it("leaves the other flags as stored", async () => {
    installDb();
    vi.mocked(getFeatureFlags).mockResolvedValue(FLAGS);

    await expect(getStorefrontFlags()).resolves.toEqual(FLAGS);
  });
});

describe("recordAttribution — the switches", () => {
  const signup = { refereeCustomerId: "friend", code: "ABC123" };

  it("records nothing when the feature flag is off", async () => {
    const { ops } = installDb();
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);

    await expect(recordAttribution(signup)).resolves.toEqual({ ok: false, reason: "disabled" });
    expect(ops.filter((o) => o.action === "insert")).toEqual([]);
  });

  it("records nothing when the programme toggle is off", async () => {
    const { ops } = installDb(undefined, { ...CONFIG, enabled: false });

    await expect(recordAttribution(signup)).resolves.toEqual({ ok: false, reason: "disabled" });
    expect(ops.filter((o) => o.action === "insert")).toEqual([]);
  });
});
