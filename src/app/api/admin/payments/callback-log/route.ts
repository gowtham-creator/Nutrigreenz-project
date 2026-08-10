import { requireApiPermission } from "@/lib/admin-api-guard";
import { listCallbacks } from "@/lib/sbiepay-callback-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments/callback-log — what SBIePay actually posted back.
 *
 * Exists to answer one question the gateway's support team asks every time:
 * "share the final encrypted and decrypted responses received at your return
 * URL". Until now we could produce neither, because the callback read their
 * POST as plain form fields and never decrypted anything.
 *
 * Returns the payload verbatim alongside its plaintext, so the answer is a
 * copy-paste rather than a code change under time pressure.
 *
 * Behind the same `orders` permission as the rest of the payment surface, and
 * never cached — a stale answer here describes the wrong transaction.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;

  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10;

  const entries = await listCallbacks(limit);

  return Response.json(
    { ok: true, count: entries.length, entries },
    { headers: { "cache-control": "no-store" } },
  );
}
