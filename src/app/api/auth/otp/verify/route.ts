import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { NG_SESSION_COOKIE, createSessionToken } from "@/lib/session";
import {
  linkUserToCustomer,
  resolveCustomer,
  normalizePhoneE164,
} from "@/lib/customer-identity";
import { verifyOtp, isMsg91OtpConfigured, normalizeMsg91Mobile } from "@/lib/msg91-otp";
import {
  checkOtpVerifyAllowed,
  recordOtpVerifyFailure,
  clearOtpVerifyFailures,
} from "@/lib/otp-verify-guard";

// resolveCustomer + supabaseAdmin need the Node runtime (not Edge).
export const runtime = "nodejs";

/** Session lifetime: 30 days (seconds) — MATCHES /api/auth/session. */
const MAX_AGE = 60 * 60 * 24 * 30;

/**
 * POST /api/auth/otp/verify  { phone, code }
 *
 * MSG91 storefront customer sign-in — the flag-selectable alternative to the
 * Firebase `/api/auth/session` path. MSG91 verifies the code server-side; on
 * success we find-or-create the canonical customer and mint the SAME signed
 * `ng_session` cookie as the Firebase path, REUSING the identical helpers
 * (`resolveCustomer` + `linkUserToCustomer` + `createSessionToken`) so the
 * downstream session shape and customer dedup are byte-for-byte identical.
 *
 * The only difference from the Firebase path is the identity source: instead of
 * a verified Firebase UID we derive a stable synthetic UID from the verified
 * number (`msg91:<E.164>`). `resolveCustomer` still dedups by VERIFIED phone, so
 * a number that already has a Firebase-minted customer resolves to that same
 * canonical customer rather than forking a new one.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isMsg91OtpConfigured()) {
    return Response.json({ ok: false, error: "SMS OTP not configured" }, { status: 503 });
  }

  let phone: unknown;
  let code: unknown;
  try {
    const body = await request.json();
    phone = body?.phone;
    code = body?.code;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof phone !== "string" || typeof code !== "string") {
    return Response.json({ ok: false }, { status: 400 });
  }

  const mobile = normalizeMsg91Mobile(phone);
  if (!mobile) {
    return Response.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }

  /*
   * 1. Throttle BEFORE spending a verification.
   *
   * This endpoint trades six digits for a thirty-day session, so without a
   * counter it is simply a guessing game with unlimited turns. The number and
   * the source address are counted separately: the first stops one account
   * being hammered, the second stops one attacker spreading single guesses
   * across many numbers and tripping neither. See `@/lib/otp-verify-guard`.
   */
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const throttle = await checkOtpVerifyAllowed(mobile, ip);
  if (!throttle.allowed) {
    return Response.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(throttle.retryAfterSec) } },
    );
  }

  // 2. Verify the code with MSG91 (fail closed). We never see the code beyond here.
  const verified = await verifyOtp(phone, code);
  if (!verified.ok) {
    // Count the miss, then answer exactly as before — the 401 must not reveal
    // how close the caller is to a lock, or a prober learns the limit for free.
    await recordOtpVerifyFailure(mobile, ip);
    return Response.json({ ok: false }, { status: 401 });
  }

  // Correct code — release this number's counter (the IP's is left standing).
  await clearOtpVerifyFailures(mobile);

  // Canonical E.164 for storage/dedup; stable synthetic UID keyed by the number.
  const e164 = normalizePhoneE164(phone) ?? `+${mobile}`;
  const uid = `msg91:${e164}`;

  // 3. Best-effort user upsert + canonical customer dedup — mirrors
  //    /api/auth/session. Any failure here is swallowed; the session still mints.
  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin()
        .from("users")
        .upsert(
          {
            firebase_uid: uid,
            phone: e164,
            provider: "phone",
            last_login_at: new Date().toISOString(),
          },
          { onConflict: "firebase_uid" },
        );
    } catch {
      // Swallow — the signed session still mints; the row reconciles next login.
    }

    try {
      const resolved = await resolveCustomer({
        provider: "phone",
        providerUid: uid,
        phone: e164,
        phoneVerified: true, // MSG91 OTP == verified, exactly like Firebase phone.
      });
      await linkUserToCustomer(uid, resolved.customer.id);
    } catch {
      // Swallow — dedup is best-effort; the signed session must still mint.
    }
  }

  // 4. Mint the signed, httpOnly session cookie bound to the UID (same as Firebase).
  const token = await createSessionToken(uid);
  const c = await cookies();
  c.set({
    name: NG_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return Response.json({ ok: true });
}
