/**
 * GET /r/<code> — a referral share link. Stamps a short-lived, httpOnly `ng_ref`
 * cookie with the code, then bounces to the storefront home. Attribution itself
 * happens server-side on the referee's next authenticated request (see
 * `getCustomerSession`), so the code never has to survive in the client.
 */
import { NextResponse } from "next/server";
import { getReferralConfig } from "@/lib/referrals";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;
  const clean = (code || "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 16);
  const origin = new URL(request.url).origin;
  const res = NextResponse.redirect(new URL("/", origin));
  if (clean) {
    // Cap the window at ~7 days (or the configured expiry, whichever is smaller)
    // so the cookie doesn't linger and re-trigger capture indefinitely.
    let days = 7;
    try {
      const config = await getReferralConfig();
      days = Math.min(7, Math.max(1, config.expiryDays));
    } catch {
      /* default 7 */
    }
    res.cookies.set("ng_ref", clean, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: days * 24 * 60 * 60,
    });
  }
  return res;
}
