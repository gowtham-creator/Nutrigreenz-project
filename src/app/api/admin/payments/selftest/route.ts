import { requireApiPermission } from "@/lib/admin-api-guard";
import {
  isOnlinePaymentAvailable,
  missingSbiepayConfig,
  sbiepayEnv,
  sbiepayEncryptionKey,
} from "@/lib/payments";
import { isProxyConfigured, checkProxy } from "@/lib/sbiepay-fetch";
import { encryptPayload, decryptPayload } from "@/lib/sbiepay-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments/selftest — prove the integration works, without money.
 *
 * Four checks, in the order the real payment flow depends on them, so the first
 * failure is the thing to fix:
 *
 *   1. configuration   — are all the variables present and meaningful
 *   2. crypto          — does the AES-GCM envelope round-trip with our key
 *   3. proxy           — does traffic leave from the address SBI whitelisted
 *   4. authentication  — does SBI accept the key pair and issue a token
 *
 * Step 4 is the real proof: it makes an authenticated call to SBI's own
 * endpoint. If it passes, the credentials are right, the IP is whitelisted, and
 * the transport works — everything a payment needs except a customer.
 *
 * It deliberately does NOT create an order. An order is a real object in the
 * bank's system, and a diagnostic that leaves debris behind stops being safe to
 * run.
 *
 * Safe against LIVE as well: it creates nothing and moves no money. It gets a
 * token and searches for an order reference that cannot exist. That search is
 * an ENCRYPTED request, so on live it answers the question SBI support asks
 * first: can the bank decrypt what we send for this merchant?
 */

interface Check {
  step: string;
  ok: boolean;
  detail: string;
}

export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;

  const checks: Check[] = [];
  const fail = (step: string, detail: string) => {
    checks.push({ step, ok: false, detail });
    return Response.json({ ok: false, environment: sbiepayEnv(), checks });
  };

  // 1 · configuration
  const missing = missingSbiepayConfig();
  if (missing.length > 0) return fail("configuration", missing.join("; "));
  checks.push({ step: "configuration", ok: true, detail: "all variables set" });

  // 2 · crypto round-trip, using the real key
  try {
    const key = sbiepayEncryptionKey();
    if (!key) return fail("crypto", "encryption key unavailable");
    const probe = { selftest: true, at: Date.now() };
    const back = JSON.parse(await decryptPayload(key, await encryptPayload(key, probe)));
    if (back.at !== probe.at) return fail("crypto", "round-trip did not match");
    checks.push({
      step: "crypto",
      ok: true,
      detail: `AES-GCM round-trip ok (key ${Buffer.from(key, "base64").length * 8}-bit)`,
    });
  } catch (err) {
    // Almost always a wrong value in SBIEPAY_*_ENCRYPTION_KEY — the API secret
    // pasted into it, or a truncated copy.
    return fail("crypto", err instanceof Error ? err.message : "encryption failed");
  }

  // 3 · proxy — the whitelisted egress address
  if (!isProxyConfigured()) {
    return fail("proxy", "SBIEPAY_PROXY_URL is not set; SBI would refuse the call");
  }
  const expectedIp = process.env.SBIEPAY_WHITELISTED_IP?.trim() || undefined;
  const probe = await checkProxy(expectedIp);
  // The messages are already written to name their own fix — do not wrap them
  // in "unreachable:", which was wrong for half of them.
  if (!probe.ok) return fail("proxy", probe.error ?? "unreachable");
  if (probe.matchesWhitelist === false) {
    return fail(
      "proxy",
      `SBIEPAY_PROXY_URL points at ${probe.ip}, not the whitelisted ${expectedIp}`,
    );
  }
  checks.push({
    step: "proxy",
    ok: true,
    detail: `reached SBI via ${probe.ip}${probe.matchesWhitelist ? " (whitelisted)" : ""}`,
  });

  // 4 · token, then 5 · an encrypted request, against SBI
  const { sbiepayCall, resetSbiepayToken, currentSbiepayMerchantId } = await import(
    "@/lib/sbiepay-client"
  );
  // Force a fresh token so this tests the credentials, not a warm cache.
  resetSbiepayToken();
  try {
    /*
     * Search for a reference that cannot exist. SBI must authenticate us AND
     * decrypt the payload before it can say "not found", so an empty result or
     * a business error is a pass for both steps.
     */
    await sbiepayCall("order/status", { orderRefNumber: `SELFTEST-${Date.now()}`, orderAmount: 1 });
    checks.push({ step: "token", ok: true, detail: `issued for mId ${currentSbiepayMerchantId() ?? "?"}` });
    checks.push({ step: "encrypted request", ok: true, detail: "SBI decrypted and answered the request" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const code = (err as { code?: string })?.code ?? "";
    const mId = currentSbiepayMerchantId();

    // The token step failed: the key id / secret were refused.
    if (message.startsWith("token/access:") || /not-configured|1003|401/.test(`${code} ${message}`)) {
      checks.push({ step: "token", ok: false, detail: `rejected: ${message}` });
      return Response.json({ ok: false, environment: sbiepayEnv(), checks });
    }
    checks.push({ step: "token", ok: true, detail: `issued for mId ${mId ?? "?"}` });

    // 905: SBI could not decrypt our payload with the key it holds for this mId.
    if (code === "905") {
      checks.push({
        step: "encrypted request",
        ok: false,
        detail: `SBI error 905 for mId ${mId ?? "?"}: ${message}. The bank cannot decrypt our request with the encryption key it has on file for this merchant.`,
      });
      return Response.json({ ok: false, environment: sbiepayEnv(), checks });
    }

    // Any other business error means SBI decrypted and read the request.
    checks.push({
      step: "encrypted request",
      ok: true,
      detail: `SBI decrypted the request and answered: ${message} (expected: the reference does not exist)`,
    });
  }

  return Response.json({
    ok: checks.every((c) => c.ok),
    environment: sbiepayEnv(),
    onlinePaymentAvailable: isOnlinePaymentAvailable(),
    checks,
  });
}
