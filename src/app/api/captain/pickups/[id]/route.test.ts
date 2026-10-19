import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/captains", () => ({ advancePickup: vi.fn(), requireActiveCaptain: vi.fn() }));

import { PATCH } from "@/app/api/captain/pickups/[id]/route";
import { advancePickup, requireActiveCaptain } from "@/lib/captains";

const pickup = { id: "p1", captainId: "cap-1", community: "X", address: null, status: "due", dueAt: null, updatedAt: "x", createdAt: "x" } as const;
const patch = (body: unknown) =>
  PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "p1" }),
  } as never);

beforeEach(() => {
  vi.mocked(requireActiveCaptain).mockResolvedValue({ captainId: "cap-1", phone: "9876543210" });
});

describe("PATCH /api/captain/pickups/[id]", () => {
  it("scopes the update to the signed-in captain", async () => {
    vi.mocked(advancePickup).mockResolvedValue({ ok: true, pickup: { ...pickup, status: "collected" } });
    const res = await patch({ status: "collected" });
    expect(res.status).toBe(200);
    expect(advancePickup).toHaveBeenCalledWith("p1", "cap-1", "collected");
  });

  it("answers 409 with the current pickup on an illegal jump", async () => {
    vi.mocked(advancePickup).mockResolvedValue({ ok: false, reason: "invalid_transition", pickup });
    const res = await patch({ status: "handed_over" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "invalid_transition", pickup: { status: "due" } });
  });

  it("404s an unknown or someone else's pickup, 400s a bad status", async () => {
    vi.mocked(advancePickup).mockResolvedValue({ ok: false, reason: "not-found" });
    expect((await patch({ status: "collected" })).status).toBe(404);
    expect((await patch({ status: "lost" })).status).toBe(400);
  });
});
