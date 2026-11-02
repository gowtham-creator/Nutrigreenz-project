/**
 * `isFeatureEnabled` — the gate every store page and API asks.
 *
 * The fake does not interpret filters, so each test scripts the answer for the
 * one row the gate reads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type FakeResult } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown, configured: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  get isSupabaseConfigured() {
    return h.configured;
  },
  supabaseAdmin: () => h.db,
}));

import { featureOffResponse, isFeatureEnabled } from "@/lib/feature-flags";

function flagDb(result: FakeResult) {
  const fake = createFakeSupabase(() => result);
  h.db = fake.client;
  return fake;
}

beforeEach(() => {
  h.configured = true;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("isFeatureEnabled", () => {
  it("reads only the row it was asked about", async () => {
    const { ops } = flagDb({ data: { enabled: true } });

    await expect(isFeatureEnabled("referrals")).resolves.toBe(true);

    expect(ops).toHaveLength(1);
    expect(ops[0].table).toBe("feature_flags");
    expect(filterOn(ops[0], "key")?.value).toBe("referrals");
  });

  it("is false when the switch is off", async () => {
    flagDb({ data: { enabled: false } });
    await expect(isFeatureEnabled("referrals")).resolves.toBe(false);
  });

  it("uses the shipped default when the row is missing", async () => {
    flagDb({ data: null });
    await expect(isFeatureEnabled("referrals")).resolves.toBe(true);
    await expect(isFeatureEnabled("captain_network")).resolves.toBe(false);
  });

  it("fails open on a read error, even for a default-off flag", async () => {
    flagDb({ error: { message: "connection reset" } });
    await expect(isFeatureEnabled("referrals")).resolves.toBe(true);
    await expect(isFeatureEnabled("captain_network")).resolves.toBe(true);
  });

  it("fails open when the read throws", async () => {
    h.db = {
      from: () => {
        throw new Error("no client");
      },
    };
    await expect(isFeatureEnabled("community_bundles")).resolves.toBe(true);
  });

  it("uses the shipped default when the database is not configured", async () => {
    h.configured = false;
    await expect(isFeatureEnabled("referrals")).resolves.toBe(true);
    await expect(isFeatureEnabled("captain_network")).resolves.toBe(false);
  });
});

describe("featureOffResponse", () => {
  it("is an uncached 404, as if the feature had never been there", async () => {
    const res = featureOffResponse();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: false, error: "not-found" });
  });
});
