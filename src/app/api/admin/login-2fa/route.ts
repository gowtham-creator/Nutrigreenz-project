import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_ROLE_COOKIE,
  ADMIN_MFA_COOKIE,
} from "@/lib/admin-auth";
import { createToken, verifyMfaTicket } from "@/lib/admin-session";
import { verifyTotp } from "@/lib/totp";
import { verifyEmailOtp, getAdminFactors } from "@/lib/admin-security";
import { verifyIdToken } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity-log";

/** Session lifetime: 12 hours (seconds) — matches /api/admin/login. */
const MAX_AGE = 60 * 60 * 12;

/**
 * POST /api/admin/login-2fa
 *
 * Second factor for super-admin sign-in. The client reaches here only after
 * `/api/admin/login` accepted the passcode and returned `{ mfaRequired: true }`,
 * setting a short-lived httpOnly `ng_admin_mfa` ticket. We:
 *   1. Verify that ticket (signed, unexpired, carries the `mfa` tag).
 *   2. Verify the submitted 6-digit code against `ADMIN_TOTP_SECRET`.
 *   3. On success, mint the real `ng_admin` session (superadmin) and consume
 *      the one-time MFA ticket.
 *
 * The ticket uses a distinct `mfa` payload tag, so it can never be replayed as
 * an `ng_admin` session token even if copied into that cookie.
 */
export async function POST(request: Request): Promise<Response> {
  let code: unknown;
  let method: unknown;
  let idToken: unknown;
  try {
    const body = await request.json();
    code = body?.code;
    method = body?.method;
    idToken = body?.idToken;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  // Default to TOTP so the existing authenticator-only flow keeps working.
  const factor =
    method === "email" ? "email" : method === "phone" ? "phone" : "totp";
  if (factor === "phone" ? typeof idToken !== "string" : typeof code !== "string") {
    return Response.json({ ok: false }, { status: 400 });
  }

  const c = await cookies();
  const email = await verifyMfaTicket(c.get(ADMIN_MFA_COOKIE)?.value);
  if (!email) {
    // Missing/expired/forged ticket — make the client restart at the passcode.
    return Response.json({ ok: false, restart: true }, { status: 401 });
  }

  let ok = false;
  if (factor === "totp") {
    const secret = process.env.ADMIN_TOTP_SECRET;
    ok = secret ? await verifyTotp(code as string, secret) : false;
  } else if (factor === "email") {
    ok = await verifyEmailOtp(email, code as string);
  } else {
    // phone: verify the Firebase ID token and match the number on file.
    try {
      const decoded = await verifyIdToken(idToken as string);
      const f = await getAdminFactors(email);
      ok =
        decoded.firebase?.sign_in_provider === "phone" &&
        Boolean(decoded.phone_number) &&
        Boolean(f.otpPhone) &&
        f.otpPhone === decoded.phone_number;
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const token = await createToken(email, "superadmin");
  const secure = process.env.NODE_ENV === "production";

  c.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  c.set({
    name: ADMIN_EMAIL_COOKIE,
    value: email,
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  c.set({
    name: ADMIN_ROLE_COOKIE,
    value: "superadmin",
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  // Consume the one-time MFA ticket so it can't be reused.
  c.set({
    name: ADMIN_MFA_COOKIE,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Best-effort audit of the completed (second-factor) sign-in.
  await logActivity({
    actorEmail: email,
    actorRole: "superadmin",
    action: "admin.signin",
    meta: { method: factor },
  });

  return Response.json({ ok: true });
}
