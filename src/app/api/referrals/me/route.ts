/**
 * GET /api/referrals/me — the signed-in customer's own referral code, share
 * link, and how many of their referrals have paid out. Mints the code on first
 * call. Scoped strictly to the caller's canonical customer via `ng_session`.
 */
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerReferralSummary } from "@/lib/referrals";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const summary = await getCustomerReferralSummary(session.customerId);
  return Response.json({ ok: true, ...summary });
}
