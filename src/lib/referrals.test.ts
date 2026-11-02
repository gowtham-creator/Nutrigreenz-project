/**
 * The referral engine's switches, guards and qualifying rules.
 *
 * The Supabase client is a recording fake (src/test/fake-supabase.ts), so each
 * test can assert which rows a query touched, and that a refused referral wrote
 * nothing. The feature switch and loyalty config are mocked at their boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type FakeOp, type Responder } from "@/test/fake-supabase";

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
  deviceFingerprint,
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

describe("deviceFingerprint", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)";

  it("is stable for one device on one network", () => {
    expect(deviceFingerprint("49.36.1.2", IPHONE)).toBe(deviceFingerprint("49.36.1.2", IPHONE));
  });

  it("tells apart two people with the same phone on different networks", () => {
    expect(deviceFingerprint("49.36.1.2", IPHONE)).not.toBe(deviceFingerprint("49.36.9.9", IPHONE));
  });

  it("does not store the address or browser as given", () => {
    const hash = deviceFingerprint("49.36.1.2", IPHONE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives no fingerprint from half the inputs", () => {
    expect(deviceFingerprint(null, IPHONE)).toBeNull();
    expect(deviceFingerprint("49.36.1.2", null)).toBeNull();
  });
});

describe("recordAttribution — same-device block", () => {
  const signup = { refereeCustomerId: "friend", code: "ABC123", deviceHash: "hash-1" };

  /** A database where `seen` says whether this referrer already has this device. */
  function deviceDb(seen: boolean, config: Record<string, unknown> = CONFIG) {
    return installDb((op) => {
      if (op.table === "customers" && filterOn(op, "referral_code")) return { data: { id: "referrer" } };
      if (op.table === "customers") return { data: { primary_phone: null } };
      if (op.table === "referral_attributions" && op.action === "insert") {
        return { data: { id: "attr-1" } };
      }
      if (op.table === "referral_attributions" && filterOn(op, "signup_device_hash")) {
        return { data: seen ? [{ id: "attr-0" }] : [] };
      }
      return { data: null };
    }, config);
  }

  const deviceCheck = (ops: FakeOp[]) =>
    ops.find((o) => o.table === "referral_attributions" && filterOn(o, "signup_device_hash"));

  it("refuses a repeat sign-up for this referrer from this device", async () => {
    const { ops } = deviceDb(true);

    await expect(recordAttribution(signup)).resolves.toEqual({ ok: false, reason: "same-device" });
    expect(ops.filter((o) => o.action === "insert")).toEqual([]);
  });

  it("only looks at this referrer's own referrals, not every customer's", async () => {
    const { ops } = deviceDb(false);

    await expect(recordAttribution(signup)).resolves.toEqual({ ok: true, attributionId: "attr-1" });

    expect(filterOn(deviceCheck(ops)!, "referrer_customer_id")?.value).toBe("referrer");
  });

  it("skips the check when the guard is off", async () => {
    const { ops } = deviceDb(true, { ...CONFIG, block_same_device: false });

    await expect(recordAttribution(signup)).resolves.toMatchObject({ ok: true });
    expect(deviceCheck(ops)).toBeUndefined();
  });
});
