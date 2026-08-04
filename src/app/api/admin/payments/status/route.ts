import { requireApiPermission } from "@/lib/admin-api-guard";
import {
  currentProvider,
  sbiepayEnv,
  sbiepayBaseUrl,
  isLiveGateway,
  isOnlinePaymentAvailable,
  missingSbiepayConfig,
  availableMethods,
  sbiepayKeyId,
  sbiepayKeySecret,
  sbiepayEncryptionKey,
} from "@/lib/payments";

export const runtime = "nodejs";
// Configuration changes on redeploy; a cached answer would describe the past.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments/status — is the gateway actually configured?
 *
 * Exists because there is no other way to find out. Vercel encrypts environment
 * variables at rest and never returns them, so a credential that was pasted
 * wrongly — a trailing space, a swapped secret and encryption key, a value left
 * as a placeholder — is indistinguishable from a correct one until a customer
 * tries to pay. This asks the running server what it can actually see.
 *
 * It reports SHAPE, never values: whether each credential is present, and how
 * long it is. Length is enough to catch the common paste errors (an empty
 * field, a truncated key) without the response ever carrying a secret, which
 * matters because this is a network response that could be logged or screen-shared.
 *
 * Admin-only, behind the same permission as the rest of the payment surface.
 */

/** Describe a credential without disclosing it. */
function shape(name: string, value: string | null): { name: string; present: boolean; length: number } {
  return { name, present: Boolean(value), length: value?.length ?? 0 };
}

export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;

  const env = sbiepayEnv();
  const prefix = env === "live" ? "SBIEPAY_LIVE" : "SBIEPAY_TEST";

  /*
   * Read through the same accessors the payment code uses, rather than
   * process.env directly. A check that looked at the raw variables could report
   * "configured" for a value the adapter treats as absent — a placeholder, say
   * — which would make this diagnostic actively misleading.
   */
  return Response.json({
    ok: true,
    provider: currentProvider(),
    environment: env,
    baseUrl: sbiepayBaseUrl(),
    live: isLiveGateway(),
    onlinePaymentAvailable: isOnlinePaymentAvailable(),
    checkoutOffers: availableMethods(),
    credentials: env
      ? [
          shape(`${prefix}_API_KEY_ID`, sbiepayKeyId()),
          shape(`${prefix}_API_KEY_SECRET`, sbiepayKeySecret()),
          shape(`${prefix}_ENCRYPTION_KEY`, sbiepayEncryptionKey()),
        ]
      : [],
    problems: missingSbiepayConfig(),
  });
}
