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
import { getLoyaltyConfig } from "@/lib/rewards";
import {
  deviceFingerprint,
  getStorefrontFlags,
  isReferralProgrammeOpen,
  recordAttribution,
  rewardReferralIfEligible,
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

describe("rewardReferralIfEligible", () => {
  const ORDER = {
    id: "ord-1",
    customer_id: "friend",
    subtotal_paise: 60_000,
    status: "confirmed",
    payment_method: "cod",
    payment_status: "pending",
  };
  const ATTRIBUTION = {
    id: "attr-1",
    referrer_customer_id: "referrer",
    referee_customer_id: "friend",
    created_at: new Date().toISOString(),
    status: "pending",
  };

  function rewardDb(
    order: Record<string, unknown> = ORDER,
    config: Record<string, unknown> = CONFIG,
    rewardedThisMonth = 0,
  ) {
    return installDb((op) => {
      if (op.table === "orders") return { data: order };
      if (op.table === "referral_attributions" && op.action === "update") return { data: { id: "attr-1" } };
      if (op.table === "referral_attributions" && op.head) return { count: rewardedThisMonth };
      if (op.table === "referral_attributions") return { data: ATTRIBUTION };
      return { data: null };
    }, config);
  }

  const ledger = (ops: FakeOp[]) =>
    ops
      .filter((o) => o.table === "loyalty_ledger" && o.action === "insert")
      .map((o) => o.payload as { customer_id: string; delta_points: number; reason: string });
  const claimed = (ops: FakeOp[]) =>
    ops.some((o) => o.table === "referral_attributions" && o.action === "update");

  beforeEach(() => {
    vi.mocked(getLoyaltyConfig).mockResolvedValue({ redeemPointsPerRupee: 10 } as never);
  });

  it("pays both sides on a confirmed cash order", async () => {
    const { ops } = rewardDb();

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toEqual([
      { customer_id: "referrer", order_id: "ord-1", delta_points: 200, reason: "referral_referrer" },
      { customer_id: "friend", order_id: "ord-1", delta_points: 1_000, reason: "referral_referee" },
    ]);
  });

  it("pays on an order that went straight past confirmed", async () => {
    const { ops } = rewardDb({ ...ORDER, status: "packed" });

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toHaveLength(2);
  });

  it("pays nothing on an order nobody has confirmed", async () => {
    const { ops } = rewardDb({ ...ORDER, status: "placed" });

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toEqual([]);
    expect(claimed(ops)).toBe(false);
  });

  it("pays nothing on a cancelled order", async () => {
    const { ops } = rewardDb({ ...ORDER, status: "cancelled" });

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toEqual([]);
  });

  it("pays nothing on a confirmed online order that is still unpaid", async () => {
    const { ops } = rewardDb({ ...ORDER, payment_method: "upi", payment_status: "pending" });

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toEqual([]);
    expect(claimed(ops)).toBe(false);
  });

  it("pays once that online order is paid", async () => {
    const { ops } = rewardDb({ ...ORDER, payment_method: "upi", payment_status: "paid" });

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toHaveLength(2);
  });

  it("pays nothing while the programme toggle is off, and keeps the referral pending", async () => {
    const { ops } = rewardDb(ORDER, { ...CONFIG, enabled: false });

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toEqual([]);
    expect(claimed(ops)).toBe(false);
  });

  it("pays nothing while the feature flag is off, and keeps the referral pending", async () => {
    const { ops } = rewardDb();
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);

    await rewardReferralIfEligible("ord-1");

    expect(ledger(ops)).toEqual([]);
    expect(claimed(ops)).toBe(false);
  });

  it("still holds the qualifying minimum and the monthly cap", async () => {
    const small = rewardDb({ ...ORDER, subtotal_paise: 49_899 });
    await rewardReferralIfEligible("ord-1");
    expect(ledger(small.ops)).toEqual([]);

    const capped = rewardDb(ORDER, CONFIG, 10);
    await rewardReferralIfEligible("ord-1");
    expect(ledger(capped.ops)).toEqual([]);
  });
});
