/**
 * Who a campaign reaches. The failure that matters is a private code going to the
 * whole base, so an empty list has to mean nobody.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));

import { marketingAudience } from "@/lib/marketing-audience";

const ROW = {
  id: "cust-1",
  display_name: "Asha",
  primary_email: "asha@example.com",
  primary_phone: "+919876543210",
  marketing_email_opt_out: false,
  marketing_sms_opt_out: false,
  unsubscribe_token: "tok",
};

function useDb(respond: Responder) {
  const fake = createFakeSupabase(respond);
  h.db = fake.client;
  return fake;
}

describe("marketingAudience", () => {
  beforeEach(() => {
    useDb(() => ({ data: [ROW] }));
  });

  it("reads the whole base when no filter is given, as it always has", async () => {
    const fake = useDb(() => ({ data: [ROW] }));

    expect(await marketingAudience()).toHaveLength(1);

    const read = fake.ops[0];
    expect(filterOn(read, "primary_phone")).toBeUndefined();
    expect(filterOn(read, "merged_into", "is")).toBeDefined();
  });

  it("treats a null filter as no filter", async () => {
    const fake = useDb(() => ({ data: [ROW] }));

    await marketingAudience({ phones: null });

    expect(filterOn(fake.ops[0], "primary_phone")).toBeUndefined();
  });

  it("narrows to the listed numbers at the query, not after reading everyone", async () => {
    const fake = useDb(() => ({ data: [ROW] }));

    await marketingAudience({ phones: ["+919876543210", "+919876543211"] });

    expect(filterOn(fake.ops[0], "primary_phone", "in")?.value).toEqual([
      "+919876543210",
      "+919876543211",
    ]);
  });

  it("reaches nobody for an empty list, and doesn't even query", async () => {
    const fake = useDb(() => ({ data: [ROW] }));

    expect(await marketingAudience({ phones: [] })).toEqual([]);
    expect(fake.ops).toHaveLength(0);
  });

  it("still honours an opt-out for a listed number", async () => {
    useDb(() => ({ data: [{ ...ROW, marketing_sms_opt_out: true }] }));

    const [recipient] = await marketingAudience({ phones: ["+919876543210"] });

    expect(recipient.phone).toBeNull();
    expect(recipient.email).toBe("asha@example.com");
  });
});
