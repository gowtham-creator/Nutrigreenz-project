/**
 * What counts as owning a phone, for a coupon limited to named customers.
 *
 * `customers.primary_phone` is deliberately not consulted: the Google enrichment
 * fills it from a profile anyone can edit, which would let someone claim another
 * person's offer by adding that person's number to their Google account.
 */
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));

import { normalizePhoneE164, verifiedPhonesOf } from "@/lib/customer-identity";

function useDb(respond: Responder) {
  const fake = createFakeSupabase(respond);
  h.db = fake.client;
  return fake;
}

describe("verifiedPhonesOf", () => {
  it("returns the customer's verified numbers", async () => {
    useDb(() => ({ data: [{ phone: "+919876543210" }, { phone: "+919876543211" }] }));

    expect(await verifiedPhonesOf("cust-1")).toEqual(["+919876543210", "+919876543211"]);
  });

  it("asks only for this customer's verified identities", async () => {
    const fake = useDb(() => ({ data: [] }));

    await verifiedPhonesOf("cust-1");

    const read = fake.ops[0];
    expect(read.table).toBe("customer_identities");
    expect(filterOn(read, "customer_id", "eq")?.value).toBe("cust-1");
    expect(filterOn(read, "verified", "eq")?.value).toBe(true);
  });

  it("never reads customers.primary_phone, which an unverified Google number can fill", async () => {
    const fake = useDb(() => ({ data: [] }));

    await verifiedPhonesOf("cust-1");

    expect(fake.ops.map((o) => o.table)).toEqual(["customer_identities"]);
  });

  it("normalises and de-dupes", async () => {
    useDb(() => ({ data: [{ phone: "98765 43210" }, { phone: "+919876543210" }, { phone: null }] }));

    expect(await verifiedPhonesOf("cust-1")).toEqual(["+919876543210"]);
  });

  it("reads a failed lookup as no numbers, which refuses the code", async () => {
    useDb(() => ({ error: { message: "connection reset" } }));

    expect(await verifiedPhonesOf("cust-1")).toEqual([]);
  });

  it("never throws", async () => {
    h.db = {
      from: () => {
        throw new Error("no client");
      },
    };

    await expect(verifiedPhonesOf("cust-1")).resolves.toEqual([]);
  });

  it("asks nothing for no customer", async () => {
    const fake = useDb(() => ({ data: [] }));

    expect(await verifiedPhonesOf("")).toEqual([]);
    expect(fake.ops).toHaveLength(0);
  });
});

describe("normalizePhoneE164", () => {
  it("is still exported from here, where its callers import it", () => {
    expect(normalizePhoneE164("98765 43210")).toBe("+919876543210");
  });
});
