/**
 * GET /api/admin/referrals — referral programme reporting for operators.
 * Gated by the `referrals` permission (which also enforces admin auth + token
 * revocation). Returns attributions newest-first plus headline counts.
 *
 * Query: `?limit=100&offset=0`.
 */
import { requireApiPermission } from "@/lib/admin-api-guard";
import { listReferralAttributions } from "@/lib/referrals";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("referrals");
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const page = await listReferralAttributions(limit, offset);
  return Response.json({ ok: true, ...page });
}
