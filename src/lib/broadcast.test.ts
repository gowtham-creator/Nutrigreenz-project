/**
 * Campaign sends: what each email carries, what the result reports, and that the
 * send log survives one bad row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: () => h.db }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), isEmailConfigured: () => true }));
vi.mock("@/lib/sms", () => ({ sendSms: vi.fn(), isSmsConfigured: () => false }));
vi.mock("@/lib/marketing-audience", () => ({
  marketingAudience: vi.fn(),
  customersWithoutEmail: vi.fn(),
}));

import { sendEmail } from "@/lib/email";
import { customersWithoutEmail, marketingAudience } from "@/lib/marketing-audience";
import { broadcastCampaign } from "./broadcast";

const recipient = (id: string) => ({
  customerId: id,
  name: "Asha",
  email: `${id}@example.com`,
  phone: null,
  unsubscribeToken: `token-${id}`,
});

const input = {
  type: "offer" as const,
  channels: ["email" as const],
  campaignKey: "QTR10",
  vars: { offerCode: "QTR10", offerTitle: "Harvest", discount: "10%" },
};

function install(respond: Responder = () => undefined) {
  const fake = createFakeSupabase(respond);
  h.db = fake.client;
  return fake;
}

beforeEach(() => {
  vi.mocked(sendEmail).mockResolvedValue(undefined);
  vi.mocked(marketingAudience).mockResolvedValue([recipient("a"), recipient("b")]);
  vi.mocked(customersWithoutEmail).mockResolvedValue(13);
});

describe("broadcastCampaign", () => {
  it("sends a plain-text part with the offer and an unsubscribe link", async () => {
    install();
    await broadcastCampaign(input);

    const { text } = vi.mocked(sendEmail).mock.calls[0][0];
    expect(text).toContain("QTR10");
    expect(text).toContain("/unsubscribe?t=token-a");
  });

  it("reports the customers it could not email without counting them as audience", async () => {
    install();
    const res = await broadcastCampaign(input);

    expect(res.audience).toBe(2);
    expect(res.email.sent).toBe(2);
    expect(res.noEmail).toBe(13);
  });

  it("does not report the whole base's gap on a send to a named list", async () => {
    install();
    const res = await broadcastCampaign({ ...input, phones: ["+919800000001"] });

    expect(res.noEmail).toBe(0);
    expect(customersWithoutEmail).not.toHaveBeenCalled();
  });

  it("keeps the record of everyone else when one row breaks the log insert", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = install((op) => {
      if (op.table !== "campaign_sends" || op.action !== "insert") return undefined;
      const row = op.payload as { customer_id?: string } | unknown[];
      if (Array.isArray(row) || (row as { customer_id: string }).customer_id === "a") {
        return { error: { message: "duplicate key" } };
      }
      return undefined;
    });

    await broadcastCampaign(input);

    const inserts = fake.ops.filter((op) => op.table === "campaign_sends" && op.action === "insert");
    expect(inserts).toHaveLength(3);
    expect(inserts[2].payload).toMatchObject({ customer_id: "b", status: "sent" });
  });
});
