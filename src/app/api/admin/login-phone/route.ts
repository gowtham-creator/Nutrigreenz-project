import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_ROLE_COOKIE,
} from "@/lib/admin-auth";
import { createToken } from "@/lib/admin-session";
import { isAdminConfigured, verifyIdToken } from "@/lib/firebase-admin";
import { roleForPhone } from "@/lib/admin-allowlist";

// firebase-admin needs the Node runtime (not Edge).
export const runtime = "nodejs";

/** Session lifetime: 12 hours (seconds) — mirrors the passcode login. */
const MAX_AGE = 60 * 60 * 12;

/**
 * POST /api/admin/login-phone  { idToken: string }
 *
 * Phone-OTP admin sign-in. The client completes Firebase phone-OTP, then sends
 * the resulting Firebase ID token here. We:
 *   1. verify the token server-side with the Firebase Admin SDK,
 *   2. require it to be a PHONE sign-in carrying a phone number,
 *   3. check that number against the operator allowlist (ADMIN_PHONE /
 *      STAFF_ADMIN_PHONE) → role, and
 *   4. only then mint the SAME signed `ng_admin` session as the passcode login.
 *
 * Passing OTP is necessary but NOT sufficient: a verified number that isn't on
 * the allowlist is rejected with 403. Lives under `/api/...` so the `/admin/...`
 * proxy matcher does not block it.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAdminConfigured) {
    return Response.json({ ok: false, error: "auth-unavailable" }, { status: 503 });
  }

  let idToken: unknown;
  try {
    idToken = (await request.json())?.idToken;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // 1. Verify the Firebase ID token.
  let phone: string | undefined;
  let provider: string | undefined;
  try {
    const decoded = await verifyIdToken(idToken);
    phone = decoded.phone_number;
    provider = decoded.firebase?.sign_in_provider;
  } catch (err) {
    // Surface the real reason in server logs. A client-side "expired code" is
    // almost always THIS throwing (issuer/audience mismatch, clock skew, bad
    // signature) rather than a genuinely-expired OTP.
    console.error(
      "[login-phone] verifyIdToken failed:",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ ok: false, error: "verify-failed" }, { status: 401 });
  }

  // 2. Must be a phone sign-in with a phone number.
  if (provider !== "phone" || !phone) {
    console.error("[login-phone] non-phone token", { provider, hasPhone: Boolean(phone) });
    return Response.json({ ok: false, error: "not-phone" }, { status: 401 });
  }

  // 3. Allowlist → role (fail closed).
  const role = roleForPhone(phone);
  if (!role) {
    return Response.json({ ok: false, error: "not-authorised" }, { status: 403 });
  }

  // 4. Mint the same signed session cookies as the passcode login. The phone
  //    number is the operator identity (the email cookie is display-only).
  const token = await createToken(phone, role);
  const secure = process.env.NODE_ENV === "production";
  const base = { secure, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
  const c = await cookies();

  c.set({ name: ADMIN_COOKIE, value: token, httpOnly: true, ...base });
  c.set({ name: ADMIN_EMAIL_COOKIE, value: phone, httpOnly: false, ...base });
  c.set({ name: ADMIN_ROLE_COOKIE, value: role, httpOnly: false, ...base });

  return Response.json({ ok: true });
}
