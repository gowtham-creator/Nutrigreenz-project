import { cookies } from "next/headers";
import { ADMIN_MFA_COOKIE } from "@/lib/admin-auth";
import { verifyMfaTicket } from "@/lib/admin-session";
import { getAdminFactors, createEmailOtp, EMAIL_OTP_TTL_MINUTES } from "@/lib/admin-security";
import { isEmailConfigured, sendEmail, otpEmailHtml } from "@/lib/email";

/**
 * POST /api/admin/mfa/email-send
 *
 * Email-OTP second factor: sends a fresh code to the admin's configured email.
 * Only reachable after the passcode step (gated by the signed `ng_admin_mfa`
 * ticket), so a code can't be requested without first proving the password.
 */
export async function POST(): Promise<Response> {
  const c = await cookies();
  const ticket = await verifyMfaTicket(c.get(ADMIN_MFA_COOKIE)?.value);
  if (!ticket) {
    return Response.json({ ok: false, restart: true }, { status: 401 });
  }
  const { email } = ticket;
  if (!isEmailConfigured()) {
    return Response.json({ ok: false, error: "email-unavailable" }, { status: 503 });
  }

  // The code is keyed by the admin identity; delivered to the configured inbox.
  const factors = await getAdminFactors(email);
  const destination = factors.otpEmail || email;

  try {
    const code = await createEmailOtp(email);
    await sendEmail({
      to: destination,
      // The code goes in the preheader (the inbox preview line), not the
      // subject — a subject is what shows on a locked phone's notification.
      subject: "Your Nutri Greenz admin sign-in code",
      html: otpEmailHtml(code, EMAIL_OTP_TTL_MINUTES),
    });
  } catch {
    return Response.json({ ok: false, error: "send-failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
