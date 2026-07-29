/**
 * GET /api/referrals/me — the signed-in customer's own referral code, share
 * link, and how many of their referrals have paid out. Mints the code on first
 * call. Scoped strictly to the caller's canonical customer via `ng_session`.
 */
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerReferralSummary, getReferralConfig } from "@/lib/referrals";
import { getLoyaltyConfig } from "@/lib/rewards";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const [summary, referral, loyalty] = await Promise.all([
    getCustomerReferralSummary(session.customerId),
    getReferralConfig(),
    getLoyaltyConfig(),
  ]);

  // Rewards are stored as points; the page talks in rupees. Convert once here at
  // the live redemption rate so the UI can never quote a stale ratio.
  const perRupee = loyalty.redeemPointsPerRupee > 0 ? loyalty.redeemPointsPerRupee : 10;
  const toRupees = (points: number) => Math.floor(points / perRupee);

  return Response.json({
    ok: true,
    ...summary,
    earnedRupees: toRupees(summary.earnedPoints),
    // The live programme terms, so the page states exactly what the engine pays.
    terms: {
      enabled: referral.enabled,
      referrerReward: toRupees(referral.referrerPoints),
      refereeDiscount: Math.round(referral.refereeDiscountPaise / 100),
      minOrder: Math.round(referral.minQualifyingOrderPaise / 100),
      expiryDays: referral.expiryDays,
      maxPerMonth: referral.maxPerMonth,
    },
  });
}
