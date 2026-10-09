/**
 * GET /api/admin/payments/selftest - the SBI error-905 diagnosis.
 *
 * 905 means "SBI could not decrypt our payload with the key it holds for this
 * merchant". The gateway client reads the code out of the bank's JSON, where it
 * can arrive as a number or a string, and the self-test must recognise it
 * either way - or it reports a key mismatch as a pass.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sbiepayCall: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-api-guard", () => ({ requireApiPermission: vi.fn(async () => null) }));
vi.mock("@/lib/payments", () => ({
  isOnlinePaymentAvailable: () => true,
  missingSbiepayConfig: () => [],
  sbiepayEnv: () => "integration",
  sbiepayEncryptionKey: () => "a2V5",
}));
vi.mock("@/lib/sbiepay-fetch", () => ({
  isProxyConfigured: () => true,
  checkProxy: vi.fn(async () => ({ ok: true, ip: "1.2.3.4", matchesWhitelist: true })),
}));
vi.mock("@/lib/sbiepay-crypto", () => ({
  encryptPayload: vi.fn(async (_key: string, payload: unknown) => JSON.stringify(payload)),
  decryptPayload: vi.fn(async (_key: string, text: string) => text),
}));
vi.mock("@/lib/sbiepay-client", () => ({
  sbiepayCall: m.sbiepayCall,
  resetSbiepayToken: vi.fn(),
  currentSbiepayMerchantId: () => "1000605",
}));

import { GET } from "./route";

/** An error shaped like SbiepayError, with whatever type of `code` the bank sent. */
function bankError(code: unknown): Error {
  return Object.assign(new Error("Invalid request"), { code });
}

async function encryptedRequestCheck() {
  const res = await GET();
  const body = (await res.json()) as {
    ok: boolean;
    checks: { step: string; ok: boolean; detail: string }[];
  };
  return { body, check: body.checks.find((c) => c.step === "encrypted request")! };
}

beforeEach(() => {
  m.sbiepayCall.mockReset();
});

describe("selftest - SBI error 905", () => {
  it.each([
    ["a string", "905"],
    ["a number", 905],
  ])("reports a key mismatch when the code arrives as %s", async (_label, code) => {
    m.sbiepayCall.mockRejectedValue(bankError(code));

    const { body, check } = await encryptedRequestCheck();

    expect(check.ok).toBe(false);
    expect(check.detail).toContain("905");
    expect(check.detail).toContain("encryption key");
    expect(body.ok).toBe(false);
  });

  it("treats another business error as proof that SBI decrypted the request", async () => {
    m.sbiepayCall.mockRejectedValue(bankError("404"));

    const { check } = await encryptedRequestCheck();

    expect(check.ok).toBe(true);
  });

  it("passes when SBI answers normally", async () => {
    m.sbiepayCall.mockResolvedValue([]);

    const { body, check } = await encryptedRequestCheck();

    expect(check.ok).toBe(true);
    expect(body.ok).toBe(true);
  });
});
