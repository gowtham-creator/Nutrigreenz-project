/** Admin changes land in the activity log under the signed-in admin. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ session: null as null | { email: string; role: string }, log: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("@/lib/admin-auth", () => ({ ADMIN_COOKIE: "ng_admin" }));
vi.mock("@/lib/admin-session", () => ({ verifyToken: async () => h.session }));
vi.mock("@/lib/activity-log", () => ({ logActivity: h.log }));

import { recordAdminAction } from "./admin-action-log";

beforeEach(() => {
  h.log.mockReset();
  h.session = null;
});

describe("recordAdminAction", () => {
  it("records the change under the signed-in admin", async () => {
    h.session = { email: "owner@nutrigreenz.farm", role: "superadmin" };
    await recordAdminAction("config.features_updated", null, { coming_soon: false });
    expect(h.log).toHaveBeenCalledWith({
      actorEmail: "owner@nutrigreenz.farm",
      actorRole: "superadmin",
      action: "config.features_updated",
      target: null,
      meta: { coming_soon: false },
    });
  });

  it("records nothing without a session", async () => {
    await recordAdminAction("farm.updated", "anantapur");
    expect(h.log).not.toHaveBeenCalled();
  });

  it("never fails the change it records", async () => {
    h.session = { email: "a@b.c", role: "admin" };
    h.log.mockRejectedValueOnce(new Error("db down"));
    await expect(recordAdminAction("farm.updated", "x")).resolves.toBeUndefined();
  });
});
