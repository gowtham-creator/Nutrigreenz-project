/**
 * The activity trail's filters: a time window and "changes only" narrow the
 * query itself, so a busy month is not cut off at the latest hundred.
 */
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: () => h.db }));

import { listActivity } from "./activity-log";

function install() {
  const fake = createFakeSupabase(() => ({
    data: [{ id: 1, actor_email: "a@x", actor_role: "admin", action: "admin.update", target: "b@x", meta: null, created_at: "2026-11-03T10:00:00Z" }],
  }));
  h.db = fake.client;
  return fake;
}

describe("listActivity", () => {
  it("reads only the window asked for, and leaves out sign-ins for admin changes", async () => {
    const fake = install();
    const rows = await listActivity(1000, { sinceIso: "2026-10-27T10:00:00.000Z", changesOnly: true });

    expect(rows[0]).toMatchObject({ id: "1", action: "admin.update" });
    const op = fake.ops[0];
    expect(filterOn(op, "created_at", "gte")?.value).toBe("2026-10-27T10:00:00.000Z");
    expect(filterOn(op, "action", "neq")?.value).toBe("admin.signin");
  });

  it("keeps the plain recent view unfiltered", async () => {
    const fake = install();
    await listActivity(100);
    expect(fake.ops[0].filters).toEqual([]);
  });
});
