import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAPTAIN_SESSION_TTL_SECONDS,
  createCaptainToken,
  verifyCaptainSession,
} from "@/lib/captain-session";

const ID = "11111111-2222-3333-4444-555555555555";

/** Sign arbitrary claims with the test secret (to forge legacy tokens). */
async function signClaims(claims: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(claims)));
  const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64u(enc.encode(claims))}.${b64u(mac)}`;
}

describe("captain session token", () => {
  beforeEach(() => {
    vi.stubEnv("CAPTAIN_SESSION_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips the captain id and phone", async () => {
    const token = await createCaptainToken(ID, "9876543210");
    expect(await verifyCaptainSession(token)).toEqual({ captainId: ID, phone: "9876543210" });
  });

  it("carries a signed expiry, so a copied token stops working after the TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T08:00:00Z"));
    const token = await createCaptainToken(ID, "9876543210");
    vi.setSystemTime(new Date(Date.now() + (CAPTAIN_SESSION_TTL_SECONDS - 1) * 1000));
    expect(await verifyCaptainSession(token)).not.toBeNull();
    vi.setSystemTime(new Date(Date.now() + 2000));
    expect(await verifyCaptainSession(token)).toBeNull();
  });

  it("rejects a legacy token with no expiry, even when correctly signed", async () => {
    expect(await verifyCaptainSession(await signClaims(`${ID}|9876543210`))).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await createCaptainToken(ID, "9876543210");
    const [, sig] = token.split(".");
    const forged = `${btoa(`${ID}|9999999999|${Date.now() + 60_000}`).replace(/=+$/, "")}.${sig}`;
    expect(await verifyCaptainSession(forged)).toBeNull();
  });

  it("fails closed without a secret", async () => {
    const token = await createCaptainToken(ID, "9876543210");
    vi.stubEnv("CAPTAIN_SESSION_SECRET", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(await verifyCaptainSession(token)).toBeNull();
  });
});
