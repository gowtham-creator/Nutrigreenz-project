/**
 * The subscription API refuses when the feature is off or nobody is signed in,
 * scopes everything to the session's customer, and turns lifecycle errors
 * into the status codes the pages expect.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  getCustomerSession: vi.fn(),
  createSubscription: vi.fn(),
  listSubscriptionsForCustomer: vi.fn(),
  pauseSubscription: vi.fn(),
  payForDelivery: vi.fn(),
  runSubscriptionCycle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  featureOffResponse: (await importOriginal<typeof import("@/lib/feature-flags")>()).featureOffResponse,
  isFeatureEnabled: m.isFeatureEnabled,
}));
vi.mock("@/lib/customer-session", () => ({ getCustomerSession: m.getCustomerSession }));
vi.mock("@/lib/orders", () => {
  class OutOfStockError extends Error {
    variantIds = ["v1"];
  }
  class BelowMinimumOrderError extends Error {
    minOrderPaise = 1;
  }
  class NotServiceableError extends Error {
    pincode = "";
  }
  class UnpricedItemsError extends Error {
    titles = [];
  }
  return { OutOfStockError, BelowMinimumOrderError, NotServiceableError, UnpricedItemsError };
});
vi.mock("@/lib/subscriptions", () => {
  class SubscriptionError extends Error {
    code: string;
    detail?: Record<string, unknown>;
    constructor(code: string, detail?: Record<string, unknown>) {
      super(code);
      this.code = code;
      this.detail = detail;
    }
  }
  return {
    SubscriptionError,
    createSubscription: m.createSubscription,
    listSubscriptionsForCustomer: m.listSubscriptionsForCustomer,
    pauseSubscription: m.pauseSubscription,
    resumeSubscription: vi.fn(),
    skipNextDelivery: vi.fn(),
    cancelSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    getSubscriptionForCustomer: vi.fn(),
    payForDelivery: m.payForDelivery,
    runSubscriptionCycle: m.runSubscriptionCycle,
  };
});

import { GET as list, POST as create } from "./route";
import { POST as act } from "./[id]/route";
import { POST as pay } from "./deliveries/[id]/pay/route";
import { GET as cron } from "../cron/subscriptions/route";
import { SubscriptionError } from "@/lib/subscriptions";
import { OutOfStockError } from "@/lib/orders";

const post = (body: unknown) =>
  new Request("http://x/api/subscriptions", { method: "POST", body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  m.isFeatureEnabled.mockResolvedValue(true);
  m.getCustomerSession.mockResolvedValue({ uid: "u1", customerId: "c1" });
});

describe("/api/subscriptions", () => {
  it("is not found while the feature is off", async () => {
    m.isFeatureEnabled.mockResolvedValue(false);
    expect((await list()).status).toBe(404);
    expect((await create(post({}))).status).toBe(404);
    expect(m.listSubscriptionsForCustomer).not.toHaveBeenCalled();
  });

  it("asks for sign-in", async () => {
    m.getCustomerSession.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
  });

  it("lists only the session customer's subscriptions", async () => {
    m.listSubscriptionsForCustomer.mockResolvedValue([{ id: "s1" }]);
    const res = await list();
    expect(res.status).toBe(200);
    expect(m.listSubscriptionsForCustomer).toHaveBeenCalledWith("c1");
    expect(await res.json()).toMatchObject({ ok: true, subscriptions: [{ id: "s1" }] });
  });

  it("creates for the session customer and answers 201", async () => {
    m.createSubscription.mockResolvedValue({ subscription: { id: "s1" }, firstDelivery: null });
    const body = { items: [{ variantId: "v", qty: 2 }], frequencyDays: 7, startOn: "2026-11-14", slotId: "x", paymentMethod: "upi" };
    const res = await create(post({ ...body, customerId: "someone-else" }));
    expect(res.status).toBe(201);
    expect(m.createSubscription.mock.calls[0][0]).toBe("c1");
  });

  it("rejects a non-object body", async () => {
    expect((await create(post([1, 2]))).status).toBe(400);
  });

  it("maps customer-fixable errors to 4xx with the code", async () => {
    m.createSubscription.mockRejectedValue(new SubscriptionError("not-serviceable", { pincode: "500001" }));
    const res = await create(post({}));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "not-serviceable", pincode: "500001" });

    m.createSubscription.mockRejectedValue(new SubscriptionError("bad-frequency"));
    expect((await create(post({}))).status).toBe(400);
  });

  it("hides unexpected errors behind a 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    m.createSubscription.mockRejectedValue(new Error("db down"));
    const res = await create(post({}));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "server-error" });
    spy.mockRestore();
  });
});

describe("/api/subscriptions/:id actions", () => {
  it("pauses with the session customer", async () => {
    m.pauseSubscription.mockResolvedValue({ id: "s1", status: "paused" });
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ action: "pause", until: "2026-12-01" }) });
    const res = await act(req, params("s1"));
    expect(res.status).toBe(200);
    expect(m.pauseSubscription).toHaveBeenCalledWith("c1", "s1", "2026-12-01");
  });

  it("refuses an unknown action", async () => {
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ action: "delete" }) });
    expect((await act(req, params("s1"))).status).toBe(400);
  });
});

describe("pay for a delivery", () => {
  it("returns the gateway handoff", async () => {
    m.payForDelivery.mockResolvedValue({ orderNumber: "NG-26-1100", payment: { action: "https://sbiepay.sbi.bank.in/x", fields: {} } });
    const res = await pay(new Request("http://x", { method: "POST" }), params("d1"));
    expect(res.status).toBe(201);
    expect(m.payForDelivery).toHaveBeenCalledWith("c1", "d1");
  });

  it("reports out of stock as a 409", async () => {
    m.payForDelivery.mockRejectedValue(new OutOfStockError());
    const res = await pay(new Request("http://x", { method: "POST" }), params("d1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "out-of-stock" });
  });
});

describe("subscription cron", () => {
  it("refuses without the cron secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(new Request("http://x"))).status).toBe(401);
    expect(m.runSubscriptionCycle).not.toHaveBeenCalled();
  });

  it("runs the cycle with the secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    m.runSubscriptionCycle.mockResolvedValue({ today: "2026-11-12", resumed: 0, missed: 0, scheduled: 2, errors: 0 });
    const res = await cron(new Request("http://x", { headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, scheduled: 2 });
  });
});
