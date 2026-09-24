import { cookies } from "next/headers";
import { ADMIN_MFA_COOKIE } from "@/lib/admin-auth";
import { verifyMfaTicket } from "@/lib/admin-session";
import { getAdminFactors } from "@/lib/admin-security";
import { sendOtp, isMsg91OtpConfigured } from "@/lib/msg91-otp";
import { checkOtpSendAllowed, clientIp } from "@/lib/otp-send-guard";

// Uses fetch to MSG91 from the server; keep on the Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/admin/mfa/phone-send
 *
 * Mobile-OTP second factor via MSG91 (used when `NEXT_PUBLIC_OTP_PROVIDER=msg91`)
 * — the MSG91 counterpart of `/api/admin/mfa/email-send`. Sends a code to the
 * admin's SERVER-STORED `otpPhone`, NEVER a client-supplied number. Gated by the
 * signed `ng_admin_mfa` ticket, so a code can't be requested without first
 * clearing the passcode step.
 */
export async function POST(request: Request): Promise<Response> {
  const c = await cookies();
  const ticket = await verifyMfaTicket(c.get(ADMIN_MFA_COOKIE)?.value);
  if (!ticket) {
    return Response.json({ ok: false, restart: true }, { status: 401 });
  }
  if (!isMsg91OtpConfigured()) {
    return Response.json({ ok: false, error: "SMS OTP not configured" }, { status: 503 });
  }

  // The destination is the admin's own saved number, resolved from their identity.
  const factors = await getAdminFactors(ticket.email);
  if (!factors.otpPhone) {
    return Response.json({ ok: false, error: "no_phone_factor" }, { status: 400 });
  }

  // Anti-abuse: OTP_RESEND_SECONDS between sends, and at most 5 sends an hour
  // per number (see otp-send-guard), before spending an SMS.
  const limit = await checkOtpSendAllowed(factors.otpPhone, clientIp(request));
  if (!limit.ok) {
    return Response.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const result = await sendOtp(factors.otpPhone);
  if (!result.ok) {
    return Response.json({ ok: false, error: "send-failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
