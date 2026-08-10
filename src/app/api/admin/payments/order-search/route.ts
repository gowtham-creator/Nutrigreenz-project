import { requireApiPermission } from "@/lib/admin-api-guard";
import { isOnlinePaymentAvailable, sbiepayEnv } from "@/lib/payments";
import type { SbiepayExchange } from "@/lib/sbiepay-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments/order-search — run the Order Search API and show both
 * sides of the call.
 *
 * SBI's merchant support asks for "Order search logs" before they will process
 * an integration further. We call `order/status` on every callback and on every
 * reconcile sweep, but nothing kept the exchange: the ciphertext is a local
 * inside the client and the plaintext is returned as a parsed object, so by the
 * time a caller has an answer there is nothing left to send them.
 *
 * This runs the same call through the same client — same token, same
 * encryption, same whitelisted proxy — with the capture hook attached, and
 * returns the encrypted request, the raw enciphered response and its plaintext.
 * It is the real code path, not a reimplementation, so what support receives is
 * what production actually sends.
 *
 * Query: one of `ref` (our orderRefNumber), `sbiRef`, or `atrn`. Amount is
 * required by the bank even where the field table implies otherwise, and
 * defaults to 1.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;

  if (!isOnlinePaymentAvailable()) {
    return Response.json({ ok: false, error: "gateway-not-configured" }, { status: 503 });
  }

  const q = new URL(request.url).searchParams;
  const ref = q.get("ref")?.trim();
  const sbiRef = q.get("sbiRef")?.trim();
  const atrn = q.get("atrn")?.trim();
  const orderAmount = Number(q.get("amount")) || 1;

  if (!ref && !sbiRef && !atrn) {
    return Response.json(
      { ok: false, error: "give one of ref, sbiRef or atrn" },
      { status: 400 },
    );
  }

  /*
   * A reference lookup when we have a bank reference, otherwise a date window
   * wide enough to contain the payment plus our own order number — the same
   * two shapes confirmGatewayPayment uses, so the log shows a real query.
   */
  const criteria = sbiRef
    ? { sbiOrderRefNumber: sbiRef, orderAmount }
    : atrn
      ? { atrnNumber: atrn, orderAmount }
      : {
          fromDate: Date.now() - 24 * 60 * 60_000,
          toDate: Date.now(),
          orderRefNumber: ref,
          orderAmount,
        };

  const exchanges: SbiepayExchange[] = [];
  let result: unknown = null;
  let error: string | null = null;

  try {
    const { searchSbiepayOrderWithCapture } = await import("@/lib/sbiepay-client");
    result = await searchSbiepayOrderWithCapture(criteria, (x) => exchanges.push(x));
  } catch (err) {
    error = err instanceof Error ? err.message : "unknown";
  }

  return Response.json(
    {
      ok: error === null,
      environment: sbiepayEnv(),
      criteria,
      error,
      /*
       * Everything support asks for: what we sent in the clear, what went on
       * the wire enciphered, what came back enciphered, and its plaintext.
       * No credential appears — the key and bearer live in headers the client
       * never copies into the exchange.
       */
      exchanges,
      result,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
