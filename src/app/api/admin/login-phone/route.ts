import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_ROLE_COOKIE,
} from "@/lib/admin-auth";
import { ADMIN_SESSION_TTL_SECONDS, createToken } from "@/lib/admin-session";
import { adminByPhone, touchAdminLastLogin } from "@/lib/admins";
import { isAdminConfigured, verifyIdToken } from "@/lib/firebase-admin";
import { operatorForPhone } from "@/lib/admin-allowlist";
import { logActivity } from "@/lib/activity-log";

// firebase-admin needs the Node runtime (not Edge).
export const runtime = "nodejs";

/** Session lifetime: 12 hours (seconds) — mirrors the passcode login. */
// 30-min idle session, slid on activity via /api/admin/heartbeat.
const MAX_AGE = ADMIN_SESSION_TTL_SECONDS;

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

  // 3. Allowlist → operator identity (fail closed). The number maps back to the
  //    SAME canonical email as passcode sign-in, so phone sign-in lands in the
  //    existing admin profile (e.g. admin@nutrigreenz.in) — not a phone-keyed one.
  // Env allowlist first (fast path); then any admin whose OWN saved profile phone
  // matches, so a super-admin who changed their number can sign in with it.
  const op = operatorForPhone(phone) ?? (await adminByPhone(phone));
  if (!op) {
    return Response.json({ ok: false, error: "not-authorised" }, { status: 403 });
  }

  // 4. Mint the same signed session cookies as the passcode login, keyed on the
  //    canonical operator email.
  void touchAdminLastLogin(op.email); // record the successful phone sign-in
  const token = await createToken(op.email, op.role);
  const secure = process.env.NODE_ENV === "production";
  const base = { secure, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
  const c = await cookies();

  c.set({ name: ADMIN_COOKIE, value: token, httpOnly: true, ...base });
  c.set({ name: ADMIN_EMAIL_COOKIE, value: op.email, httpOnly: false, ...base });
  c.set({ name: ADMIN_ROLE_COOKIE, value: op.role, httpOnly: false, ...base });

  // Best-effort audit of the phone-OTP sign-in.
  await logActivity({
    actorEmail: op.email,
    actorRole: op.role,
    action: "admin.signin",
    meta: { method: "phone" },
  });

  return Response.json({ ok: true });
}
