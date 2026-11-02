/**
 * The serviceable-areas lookup, now that orders depend on it.
 *
 * The fake does not interpret filters, so each response is decided from the
 * filters the query carried: "any active row" versus "this pincode".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type FakeResult } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));

import { isServiceable } from "@/lib/commerce-rules";

/** A database with `active` live areas, of which `matches` are this pincode. */
function areasDb(active: FakeResult, matches: FakeResult = { count: 0 }) {
  const fake = createFakeSupabase((op) => (filterOn(op, "pincode") ? matches : active));
  h.db = fake.client;
  return fake;
}

describe("isServiceable", () => {
  beforeEach(() => {
    h.db = null;
  });

  it("is true for every pincode while no area is live", async () => {
    areasDb({ count: 0 });
    await expect(isServiceable("110001")).resolves.toBe(true);
  });

  it("does not refuse a blank pincode while no area is live", async () => {
    areasDb({ count: 0 });
    await expect(isServiceable("")).resolves.toBe(true);
  });

  it("is true for a pincode on the live list", async () => {
    const { ops } = areasDb({ count: 3 }, { count: 1 });

    await expect(isServiceable(" 500081 ")).resolves.toBe(true);

    expect(filterOn(ops[1], "pincode")?.value).toBe("500081");
    expect(filterOn(ops[1], "active")?.value).toBe(true);
  });

  it("is false for a pincode off the live list", async () => {
    areasDb({ count: 3 }, { count: 0 });
    await expect(isServiceable("110001")).resolves.toBe(false);
  });

  it("refuses a blank pincode once a list exists", async () => {
    areasDb({ count: 3 });
    await expect(isServiceable("")).resolves.toBe(false);
  });

  it("throws rather than answer when the count fails", async () => {
    areasDb({ error: { message: "connection reset" } });
    await expect(isServiceable("500081")).rejects.toThrow("connection reset");
  });

  it("throws rather than answer when the match fails", async () => {
    areasDb({ count: 3 }, { error: { message: "connection reset" } });
    await expect(isServiceable("500081")).rejects.toThrow("connection reset");
  });
});
