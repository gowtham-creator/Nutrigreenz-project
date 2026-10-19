import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "t" }) }) }));
vi.mock("@/lib/admin-session", () => ({ verifyToken: vi.fn(async () => ({ email: "a@x", role: "superadmin", tokenVersion: 0 })) }));
vi.mock("@/lib/admin-api-guard", () => ({ requireApiPermission: vi.fn(async () => null) }));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));
vi.mock("@/lib/captains", () => ({
  captainHasHistory: vi.fn(),
  captainPhoneExists: vi.fn(),
  captainStats: vi.fn(),
  deleteCaptain: vi.fn(),
  getCaptainById: vi.fn(),
  listCapturesForCaptain: vi.fn(),
  listSettlementsForCaptain: vi.fn(),
  normalizeMobile10: (s: string) => s,
  updateCaptain: vi.fn(),
}));

import { DELETE } from "@/app/api/admin/captains/[id]/route";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { captainHasHistory, deleteCaptain, getCaptainById } from "@/lib/captains";

const del = () => DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id: "c1" }) } as never);

beforeEach(() => {
  vi.mocked(requireApiPermission).mockResolvedValue(null);
  vi.mocked(getCaptainById).mockResolvedValue({ id: "c1" } as never);
});

describe("DELETE /api/admin/captains/[id]", () => {
  it("refuses to delete a captain with sales history (the cascade would erase cash records)", async () => {
    vi.mocked(captainHasHistory).mockResolvedValue(true);
    const res = await del();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "has_history" });
    expect(deleteCaptain).not.toHaveBeenCalled();
  });

  it("deletes a captain with no history", async () => {
    vi.mocked(captainHasHistory).mockResolvedValue(false);
    expect((await del()).status).toBe(200);
    expect(deleteCaptain).toHaveBeenCalledWith("c1");
  });

  it("is gated by the captains permission", async () => {
    vi.mocked(requireApiPermission).mockResolvedValue(Response.json({ ok: false }, { status: 403 }));
    expect((await del()).status).toBe(403);
    expect(deleteCaptain).not.toHaveBeenCalled();
  });
});
