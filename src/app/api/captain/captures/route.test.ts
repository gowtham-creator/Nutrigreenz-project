import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/captains", () => ({
  addCapture: vi.fn(),
  captainStats: vi.fn(),
  listCapturesForCaptain: vi.fn(),
  normalizeMobile10: (raw: string) => (/^[6-9]\d{9}$/.test(raw) ? raw : null),
  requireActiveCaptain: vi.fn(),
}));
vi.mock("@/lib/captain-allocations", () => ({ allocationsForCaptain: vi.fn() }));

import { POST } from "@/app/api/captain/captures/route";
import { addCapture, captainStats, requireActiveCaptain } from "@/lib/captains";
import { allocationsForCaptain } from "@/lib/captain-allocations";

const allocation = [
  { variantId: "v1", productId: "p1", sku: "HNY-500", title: "Wild honey", unit: "500g", pack: null, price: 349.5, pricePaise: 34_950, overridden: false, available: 4 },
  { variantId: "v2", productId: "p2", sku: "", title: "Sesame oil", unit: "1L", pack: "tin", price: 420, pricePaise: 42_000, overridden: true, available: 9 },
];
const post = (body: unknown) =>
  POST(new Request("http://x/api/captain/captures", { method: "POST", body: JSON.stringify(body) }));
const base = { name: "Lakshmi", mobile: "9876501234", payMode: "cash", clientRef: "OFF-LOCAL-abc12345" };

beforeEach(() => {
  vi.mocked(requireActiveCaptain).mockResolvedValue({ captainId: "cap-1", phone: "9876543210" });
  vi.mocked(allocationsForCaptain).mockResolvedValue(allocation);
  vi.mocked(addCapture).mockImplementation(async (_id, input) => ({ id: "c1", items: input.items }) as never);
  vi.mocked(captainStats).mockResolvedValue({ count: 1, orders: 1, gmvPaise: 0, cashPaise: 0, upiPaise: 0 });
});

describe("POST /api/captain/captures", () => {
  it("records allocated lines at the allocation's price, SKU and title", async () => {
    const res = await post({ ...base, items: [{ variantId: "v1", sku: "WRONG", title: "Anything", unit: "x", price: 349.5, qty: 2 }] });
    expect(res.status).toBe(200);
    const input = vi.mocked(addCapture).mock.calls[0][1];
    expect(input.items).toEqual([
      { variantId: "v1", productId: "p1", sku: "HNY-500", title: "Wild honey", unit: "500g", pricePaise: 34_950, qty: 2 },
    ]);
    expect(input.clientRef).toBe("OFF-LOCAL-abc12345");
  });

  it("accepts a variant with no SKU (it used to be rejected and the sale dropped)", async () => {
    const res = await post({ ...base, items: [{ variantId: "v2", sku: "", title: "Sesame oil", price: 420, qty: 1 }] });
    expect(res.status).toBe(200);
    expect(vi.mocked(addCapture).mock.calls[0][1].items[0]).toMatchObject({ unit: "1L · tin", pricePaise: 42_000 });
  });

  it("matches a queued line without variantId by SKU", async () => {
    const res = await post({ ...base, items: [{ sku: "HNY-500", title: "Wild honey", price: 349.5, qty: 1 }] });
    expect(res.status).toBe(200);
  });

  it("refuses a product the captain is not allocated (fail-closed)", async () => {
    const res = await post({ ...base, items: [{ variantId: "v-other", sku: "X", title: "X", price: 10, qty: 1 }] });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "not_allocated" });
    expect(addCapture).not.toHaveBeenCalled();
  });

  it("refuses a client price that differs from the allocation", async () => {
    const res = await post({ ...base, items: [{ variantId: "v1", sku: "HNY-500", title: "Wild honey", price: 1, qty: 3 }] });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "price_changed" });
    expect(addCapture).not.toHaveBeenCalled();
  });

  it("validates quantity and mobile", async () => {
    expect((await post({ ...base, items: [{ variantId: "v1", price: 349.5, qty: 1000 }] })).status).toBe(400);
    expect((await post({ ...base, mobile: "12345", items: [{ variantId: "v1", price: 349.5, qty: 1 }] })).status).toBe(400);
  });

  it("ignores a malformed client ref", async () => {
    await post({ ...base, clientRef: "x y", items: [{ variantId: "v1", price: 349.5, qty: 1 }] });
    expect(vi.mocked(addCapture).mock.calls[0][1].clientRef).toBeNull();
  });

  it("is closed to a signed-out or deactivated captain", async () => {
    vi.mocked(requireActiveCaptain).mockResolvedValue(Response.json({ ok: false }, { status: 401 }));
    expect((await post({ ...base, items: [] })).status).toBe(401);
    expect(allocationsForCaptain).not.toHaveBeenCalled();
  });
});
