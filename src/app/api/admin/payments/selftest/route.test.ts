/**
 * GET /api/admin/payments/selftest - the SBI error-905 diagnosis.
 *
 * 905 means "SBI could not decrypt our payload with the key it holds for this
 * merchant". The gateway client reads the code out of the bank's JSON, where it
 * can arrive as a number or a string, and the self-test must recognise it
 * either way - or it reports a key mismatch as a pass.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sbiepayCall: vi.fn(),
  probeKeysOn: vi.fn(),
  env: "integration",
  keyId: "AB12cdef3456gh78",
  secret: "s".repeat(40),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-api-guard", () => ({ requireApiPermission: vi.fn(async () => null) }));
vi.mock("@/lib/payments", () => ({
  isOnlinePaymentAvailable: () => true,
  missingSbiepayConfig: () => [],
  sbiepayEnv: () => m.env,
  sbiepayEncryptionKey: () => "a2V5",
  sbiepayHostOf: (env: string) => `https://${env}.example`,
  sbiepayKeyId: () => m.keyId,
  sbiepayKeySecret: () => m.secret,
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
  probeKeysOn: m.probeKeysOn,
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
  m.probeKeysOn.mockReset();
  m.env = "integration";
  m.keyId = "AB12cdef3456gh78";
  m.secret = "s".repeat(40);
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

describe("selftest - keys refused (1003)", () => {
  const refused = () =>
    m.sbiepayCall.mockRejectedValue(
      Object.assign(new Error("token/access: API Key Id and API Key Secret was not found."), { code: "1003" }),
    );

  async function run() {
    const body = (await (await GET()).json()) as { ok: boolean; checks: { step: string; ok: boolean; detail: string }[] };
    return { body, other: body.checks.find((c) => c.step === "other environment") };
  }

  it("asks the test server, and says they are test keys when it accepts them", async () => {
    m.env = "live";
    refused();
    m.probeKeysOn.mockResolvedValue({ accepted: true, mId: "1000605", message: "token issued" });

    const { body, other } = await run();

    expect(m.probeKeysOn).toHaveBeenCalledWith("https://integration.example");
    expect(body.ok).toBe(false);
    expect(other?.detail).toContain("test (UAT) keys");
    expect(other?.detail).toContain('SBIEPAY_ENV to "integration"');
  });

  it("says SBI must activate the keys when neither server accepts them", async () => {
    m.env = "live";
    refused();
    m.probeKeysOn.mockResolvedValue({ accepted: false, mId: null, message: "API Key Id and API Key Secret was not found." });

    const { other } = await run();

    expect(other?.detail).toContain("not active in either environment");
  });

  it("asks the live server when the test environment refuses them", async () => {
    refused();
    m.probeKeysOn.mockResolvedValue({ accepted: false, mId: null, message: "not found" });

    await run();

    expect(m.probeKeysOn).toHaveBeenCalledWith("https://live.example");
  });
});

describe("selftest - keys in use", () => {
  async function line() {
    const body = (await (await GET()).json()) as { checks: { step: string; ok: boolean; detail: string }[] };
    return body.checks.find((c) => c.step === "keys in use")!;
  }

  it("shows the key id's ends and the lengths, never the secret", async () => {
    m.sbiepayCall.mockResolvedValue([]);
    const l = await line();
    expect(l.ok).toBe(true);
    expect(l.detail).toContain("AB12…gh78 (16 characters)");
    expect(l.detail).toContain("secret 40 characters");
    expect(l.detail).not.toContain("ssss");
  });

  it("flags quotes or spaces pasted into a key", async () => {
    m.sbiepayCall.mockResolvedValue([]);
    m.keyId = '"AB12cdef3456gh78"';
    m.secret = "abc def";
    const l = await line();
    expect(l.ok).toBe(false);
    expect(l.detail).toContain("the key id has quotes");
    expect(l.detail).toContain("the secret has quotes");
  });
});
