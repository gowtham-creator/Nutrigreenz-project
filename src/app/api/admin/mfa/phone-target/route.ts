import { cookies } from "next/headers";
import { ADMIN_MFA_COOKIE } from "@/lib/admin-auth";
import { verifyMfaTicket } from "@/lib/admin-session";
import { getAdminFactors } from "@/lib/admin-security";

export const runtime = "nodejs";

/**
 * POST /api/admin/mfa/phone-target
 *
 * Returns the admin's own stored mobile number in E.164 for the FIREBASE
 * mobile-OTP second factor.
 *
 * Why this exists: Firebase phone auth is client-side by design —
 * `signInWithPhoneNumber(auth, e164, recaptcha)` must run in the browser and
 * needs the real number. `/api/admin/login` deliberately returns only a masked
 * hint (`••••••70`) so a stolen passcode never reveals the full number on the
 * login screen. Passing that mask to Firebase silently failed, which left the
 * phone factor unusable for every admin on the Firebase provider.
 *
 * The MSG91 provider does not need this: there the server sends the SMS itself
 * via /api/admin/mfa/phone-send and the number never leaves the server.
 *
 * Exposure is deliberately narrow:
 *   · requires a valid, unconsumed `ng_admin_mfa` ticket — i.e. the passcode
 *     step has already been cleared for this identity;
 *   · returns only the number belonging to THAT identity, never an arbitrary one;
 *   · only when the admin actually has the phone factor enabled;
 *   · POST-only and never cached, so it cannot be triggered by navigation.
 *
 * In other words it reveals nothing that the very next step — sending an SMS to
 * that same number — does not already act on.
 */
export async function POST(): Promise<Response> {
  const c = await cookies();
  const ticket = await verifyMfaTicket(c.get(ADMIN_MFA_COOKIE)?.value);
  if (!ticket) {
    // Missing/expired/forged ticket → make the client restart at the passcode.
    return Response.json({ ok: false, restart: true }, { status: 401 });
  }

  const factors = await getAdminFactors(ticket.email);
  if (!factors.phoneOtp || !factors.otpPhone) {
    return Response.json({ ok: false, error: "no_phone_factor" }, { status: 400 });
  }

  return Response.json(
    { ok: true, phone: factors.otpPhone },
    { headers: { "cache-control": "no-store" } },
  );
}
