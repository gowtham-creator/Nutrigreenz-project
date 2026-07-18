import { verifyIdToken, isAdminConfigured } from "@/lib/firebase-admin";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCaptainByPhone, toCaptainMe } from "@/lib/captains";
import { mintCaptainSession } from "@/lib/captain-session";
import { otpProvider } from "@/lib/otp-provider";
import { verifyOtp, isMsg91OtpConfigured } from "@/lib/msg91-otp";

// firebase-admin / MSG91 need the Node runtime (not Edge).
export const runtime = "nodejs";

/**
 * POST /api/captain/login
 *
 * The captain field tool's sign-in. Two flag-selectable verification paths, both
 * resolving to the SAME captain lookup + `ng_captain` session mint:
 *   · Firebase (DEFAULT):  { idToken } — the client completes Firebase phone-OTP
 *       and posts the ID token; we verify it (`verifyIdToken`, JWKS) and read the
 *       verified `phone_number`.
 *   · MSG91 (flag=msg91):  { phone, code } — the client sent the code via
 *       /api/auth/otp/send; we verify it server-side with MSG91 (`verifyOtp`) and
 *       trust the number it was verified against.
 *
 * Access is granted ONLY when the number belongs to an ACTIVE captain; otherwise
 * we fail closed with a single, non-enumerating message. On success we mint the
 * signed httpOnly `ng_captain` session cookie the proxy checks on every
 * `/captain/*` request. This lives under `/api/...`, so the proxy matcher does
 * not gate it.
 */

const NOT_A_CAPTAIN = "This number isn't registered as an active captain.";

export async function POST(request: Request): Promise<Response> {
  let body: { idToken?: unknown; phone?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  let phone: string | null = null;

  if (otpProvider() === "msg91") {
    // MSG91 path — verify the SMS code, then trust the number it was sent to.
    if (!isMsg91OtpConfigured()) {
      return Response.json({ ok: false, error: "SMS OTP not configured" }, { status: 503 });
    }
    if (!isSupabaseConfigured) {
      return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
    }
    const rawPhone = body.phone;
    const code = body.code;
    if (typeof rawPhone !== "string" || rawPhone.length === 0 || typeof code !== "string") {
      return Response.json({ ok: false, error: "missing_code" }, { status: 400 });
    }
    const verified = await verifyOtp(rawPhone, code);
    if (!verified.ok) {
      return Response.json({ ok: false, error: "invalid_code" }, { status: 401 });
    }
    phone = rawPhone;
  } else {
    // Firebase path — unchanged from the original ID-token verification.
    const idToken = body.idToken;
    if (typeof idToken !== "string" || idToken.length === 0) {
      return Response.json({ ok: false, error: "missing_token" }, { status: 400 });
    }
    // Fail closed (503) when the pieces needed to authenticate aren't configured,
    // rather than throwing into an unhandled 500.
    if (!isAdminConfigured) {
      return Response.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
    }
    if (!isSupabaseConfigured) {
      return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
    }
    try {
      const decoded = await verifyIdToken(idToken);
      phone = decoded.phone_number ?? null;
    } catch {
      return Response.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }
    if (!phone) {
      return Response.json({ ok: false, error: "no_phone" }, { status: 401 });
    }
  }

  const captain = await getCaptainByPhone(phone);
  // Same status + message whether the number is unknown or inactive — never
  // reveal which, and never sign in a disabled captain.
  if (!captain || !captain.active) {
    return Response.json({ ok: false, error: "not_a_captain", message: NOT_A_CAPTAIN }, { status: 403 });
  }

  await mintCaptainSession(captain.id, captain.phone);
  return Response.json({ ok: true, captain: toCaptainMe(captain) });
}
