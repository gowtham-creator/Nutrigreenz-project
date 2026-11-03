/**
 * Assigning a community delivery: what it refuses, which orders it takes, and
 * that a run nobody could be linked to does not stay on a captain's screen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: () => h.db }));
vi.mock("@/lib/captains", () => ({ getCaptainById: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn() }));

import { getCaptainById } from "@/lib/captains";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { assignCommunityDelivery, deliveryForOrder, removeCommunityDelivery } from "./community-delivery";

// Tuesday 3 Nov 2026, 7:00 PM IST.
const NOW = new Date("2026-11-03T13:30:00Z");

const input = {
  orderIds: ["o1", "o2"],
  captainId: "cap-1",
  deliveryDate: "2026-11-05",
  windowText: "Evening (5:00 PM – 8:00 PM)",
  community: "SAS Crown",
  address: "Kokapet, Hyderabad",
  byEmail: "ops@example.com",
};

function install(respond: Responder) {
  const fake = createFakeSupabase(respond);
  h.db = fake.client;
  return fake;
}

/** Orders o1 and o2 are eligible, and both link. */
const happy: Responder = (op) => {
  if (op.table === "orders" && op.action === "select") return { data: [{ id: "o1" }, { id: "o2" }] };
  if (op.table === "captain_pickups" && op.action === "insert") return { data: { id: "run-1" } };
  if (op.table === "orders" && op.action === "update") return { data: [{ id: "o1" }, { id: "o2" }] };
  return undefined;
};

beforeEach(() => {
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  vi.mocked(getCaptainById).mockResolvedValue({ id: "cap-1", name: "Sneha Kumar", active: true } as never);
});

describe("assignCommunityDelivery", () => {
  it("creates the run with its IST day and slot, and links the orders", async () => {
    const fake = install(happy);

    const res = await assignCommunityDelivery(input, NOW);

    expect(res).toEqual({ ok: true, pickupId: "run-1", orderIds: ["o1", "o2"] });
    const run = fake.ops.find((op) => op.table === "captain_pickups" && op.action === "insert");
    expect(run?.payload).toMatchObject({
      captain_id: "cap-1",
      status: "due",
      delivery_date: "2026-11-05",
      due_at: "2026-11-04T18:30:00.000Z",
      window_text: input.windowText,
    });
  });

  it("takes only orders still on no run, and refuses failed payments", async () => {
    const fake = install(happy);
    await assignCommunityDelivery(input, NOW);

    const read = fake.ops.find((op) => op.table === "orders" && op.action === "select")!;
    expect(filterOn(read, "pickup_id", "is")?.value).toBeNull();
    expect(filterOn(read, "payment_status", "neq")?.value).toBe("failed");
    const link = fake.ops.find((op) => op.table === "orders" && op.action === "update")!;
    expect(filterOn(link, "pickup_id", "is")?.value).toBeNull();
  });

  it("allows today in India even when it is already tomorrow nowhere else", async () => {
    install(happy);
    const res = await assignCommunityDelivery({ ...input, deliveryDate: "2026-11-03" }, NOW);
    expect(res.ok).toBe(true);
  });

  it("refuses a past date, a bad date, and an empty slot before touching anything", async () => {
    const fake = install(happy);
    await expect(assignCommunityDelivery({ ...input, deliveryDate: "2026-11-02" }, NOW)).resolves.toEqual({ ok: false, error: "past-date" });
    await expect(assignCommunityDelivery({ ...input, deliveryDate: "soon" }, NOW)).resolves.toEqual({ ok: false, error: "invalid-date" });
    await expect(assignCommunityDelivery({ ...input, windowText: "  " }, NOW)).resolves.toEqual({ ok: false, error: "invalid-window" });
    expect(fake.ops).toHaveLength(0);
  });

  it("refuses an inactive captain, and refuses while the captain network is off", async () => {
    install(happy);
    vi.mocked(getCaptainById).mockResolvedValue({ id: "cap-1", name: "S", active: false } as never);
    await expect(assignCommunityDelivery(input, NOW)).resolves.toEqual({ ok: false, error: "captain-unavailable" });

    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    await expect(assignCommunityDelivery(input, NOW)).resolves.toEqual({ ok: false, error: "captain-network-off" });
  });

  it("removes the empty run when another operator took every order first", async () => {
    const fake = install((op) => {
      if (op.table === "orders" && op.action === "update") return { data: [] };
      return happy(op);
    });

    await expect(assignCommunityDelivery(input, NOW)).resolves.toEqual({ ok: false, error: "no-orders" });

    const removed = fake.ops.find((op) => op.table === "captain_pickups" && op.action === "delete");
    expect(filterOn(removed!, "id")?.value).toBe("run-1");
  });
});

describe("removeCommunityDelivery", () => {
  it("removes only a run the captain has not started", async () => {
    const fake = install((op) => (op.action === "delete" ? { data: [{ id: "run-1" }] } : undefined));
    await expect(removeCommunityDelivery("run-1")).resolves.toBe(true);
    expect(filterOn(fake.ops[0], "status")?.value).toBe("due");
  });

  it("says so when the captain has already collected", async () => {
    install((op) => (op.action === "delete" ? { data: [] } : undefined));
    await expect(removeCommunityDelivery("run-1")).resolves.toBe(false);
  });
});

describe("deliveryForOrder", () => {
  it("gives the customer the day, slot and the captain's first name only", async () => {
    install((op) => {
      if (op.table === "orders") return { data: { pickup_id: "run-1" } };
      return { data: { captain_id: "cap-1", delivery_date: "2026-11-05", window_text: "Evening" } };
    });
    await expect(deliveryForOrder("o1")).resolves.toEqual({
      deliveryDate: "2026-11-05",
      windowText: "Evening",
      captainName: "Sneha",
    });
  });

  it("is null for an unassigned order, and never throws", async () => {
    install(() => ({ data: { pickup_id: null } }));
    await expect(deliveryForOrder("o1")).resolves.toBeNull();

    install(() => {
      throw new Error("column does not exist");
    });
    await expect(deliveryForOrder("o1")).resolves.toBeNull();
  });
});
