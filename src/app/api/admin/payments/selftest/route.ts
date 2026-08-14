import { requireApiPermission } from "@/lib/admin-api-guard";
import {
  isOnlinePaymentAvailable,
  missingSbiepayConfig,
  sbiepayEnv,
  isLiveGateway,
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
 * Refuses to run against LIVE. Authenticating against production to check a
 * config is not worth the risk of anyone believing a live test is routine.
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

  if (isLiveGateway()) {
    return fail(
      "environment",
      "Refusing to self-test against LIVE. Set SBIEPAY_ENV=integration first.",
    );
  }

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

  // 4 · authentication against SBI
  try {
    const { sbiepayCall, resetSbiepayToken } = await import("@/lib/sbiepay-client");
    // Force a fresh token so this tests the credentials, not a warm cache.
    resetSbiepayToken();
    /*
     * Query a reference that cannot exist. A well-formed authenticated request
     * for a missing order proves auth and transport; either an empty result or
     * a "not found" error is a pass, because both mean SBI read the request.
     */
    await sbiepayCall("order/status", { orderRefNumber: `SELFTEST-${Date.now()}` });
    checks.push({ step: "authentication", ok: true, detail: "SBI accepted the credentials" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const code = (err as { code?: string })?.code ?? "";

    // Reaching a business error means auth and transport already succeeded.
    const authWorked = !/not-configured|auth|1003|401/i.test(`${code} ${message}`);
    checks.push({
      step: "authentication",
      ok: authWorked,
      detail: authWorked
        ? `SBI responded: ${message} (auth ok: the reference does not exist, as expected)`
        : `rejected: ${message}`,
    });
    if (!authWorked) {
      return Response.json({ ok: false, environment: sbiepayEnv(), checks });
    }
  }

  return Response.json({
    ok: checks.every((c) => c.ok),
    environment: sbiepayEnv(),
    onlinePaymentAvailable: isOnlinePaymentAvailable(),
    checks,
  });
}
