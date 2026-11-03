/** The offline campaigns cron only runs for a caller holding CRON_SECRET. */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true }));
const run = vi.hoisted(() => vi.fn(async () => ({ ran: 1, results: [{ audience: 3, sent: 3, skipped: 0, failed: 0 }] })));
vi.mock("@/lib/offline-campaigns", () => ({ runDueSchedules: run }));

import { GET } from "./route";

const call = (auth?: string) =>
  GET(new Request("http://x/api/cron/offline-campaigns", { headers: auth ? { authorization: auth } : {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  run.mockClear();
});

describe("GET /api/cron/offline-campaigns", () => {
  it("refuses without the secret, and when no secret is set at all", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("sends what is due for the scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ ok: true, ran: 1, sent: 3 });
  });
});
