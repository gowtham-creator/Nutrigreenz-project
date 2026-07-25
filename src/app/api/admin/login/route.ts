import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_ROLE_COOKIE,
  ADMIN_MFA_COOKIE,
} from "@/lib/admin-auth";
import {
  ADMIN_SESSION_TTL_SECONDS,
  createMfaTicket,
  createToken,
  type AdminRole,
} from "@/lib/admin-session";
import { isTotpConfigured } from "@/lib/totp";
import {
  getAdminFactors,
  hasSecurityRow,
  resolveTotpSecret,
  isEnvTotpAdmin,
} from "@/lib/admin-security";
import { verifyAdminLogin, touchAdminLastLogin, getAdminTokenVersion } from "@/lib/admins";
import { isEmailConfigured } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/admin-login-guard";

/** Session lifetime: 12 hours (seconds). */
// 30-min idle session, slid on activity via /api/admin/heartbeat.
const MAX_AGE = ADMIN_SESSION_TTL_SECONDS;

/** Default operator email if `ADMIN_EMAIL` is not configured. */
const DEFAULT_ADMIN_EMAIL = "admin@nutrigreenz.farm";

const encoder = new TextEncoder();

/** Length-safe constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/** Treat "1"/"true"/"yes"/"on" (case-insensitive) as an enabled boolean flag. */
function envFlagEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Best-effort caller IP from the standard proxy headers (throttling key). */
function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}

/** Mask an E.164 number to its last two digits (a hint, never the full number). */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 2) return "••••••";
  return `••••••${digits.slice(-2)}`;
}

/**
 * POST /api/admin/login
 *
 * Server-side credential validation for the admin portal. Two roles are
 * supported:
 *   - `superadmin` — the EXISTING `ADMIN_EMAIL` (default `admin@nutrigreenz.farm`)
 *     / `ADMIN_PASSCODE` credentials. Always available (no new env required).
 *   - `admin`      — the OPTIONAL `STAFF_ADMIN_EMAIL` / `STAFF_ADMIN_PASSCODE`
 *     credentials. Only honoured when BOTH env vars are set; otherwise staff
 *     login simply fails closed (no auth hole).
 *
 * On success we set three cookies:
 *   - `ng_admin`       — httpOnly, signed session token binding email+role (the
 *                        real gate; role is tamper-proof inside the HMAC).
 *   - `ng_admin_email` — readable email string, for UI display only.
 *   - `ng_admin_role`  — readable role string, for UI gating only (no auth
 *                        power; the proxy enforces real access via the token).
 *
 * This route lives under `/api/...`, NOT `/admin/...`, so the proxy matcher
 * (`/admin/:path*`) does not block it.
 */
export async function POST(request: Request): Promise<Response> {
  let email: unknown;
  let passcode: unknown;
  try {
    const body = await request.json();
    email = body?.email;
    passcode = body?.passcode;
  } catch {
    return Response.json({ ok: false }, { status: 401 });
  }

  if (typeof email !== "string" || typeof passcode !== "string") {
    return Response.json({ ok: false }, { status: 401 });
  }

  const inputEmail = email.trim().toLowerCase();
  const ip = clientIp(request);

  // Brute-force lockout: refuse before spending any credential check when this
  // email or IP is currently locked (5 fails → 15-min window). Fails OPEN when
  // Supabase is unconfigured, so the demo never locks every operator out.
  const throttle = await checkLoginAllowed(inputEmail, ip);
  if (!throttle.allowed) {
    return Response.json(
      {
        ok: false,
        error: "locked",
        message: `Too many attempts. Try again in ${throttle.retryAfterSec}s.`,
      },
      { status: 429, headers: { "retry-after": String(throttle.retryAfterSec) } },
    );
  }

  // --- Super Admin: existing ADMIN_* credentials (always available) ---
  const superEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const superPasscode = process.env.ADMIN_PASSCODE;

  // --- Staff Admin: optional STAFF_ADMIN_* credentials (both must be set) ---
  const staffEmail = process.env.STAFF_ADMIN_EMAIL;
  const staffPasscode = process.env.STAFF_ADMIN_PASSCODE;

  let normalizedEmail: string | null = null;
  let role: AdminRole | null = null;

  // Try super admin first. Guard on a configured passcode (fail closed).
  if (superPasscode) {
    const emailOk = inputEmail === superEmail.trim().toLowerCase();
    const passOk = timingSafeEqual(passcode, superPasscode);
    if (emailOk && passOk) {
      normalizedEmail = superEmail;
      role = "superadmin";
    }
  }

  // Otherwise try staff admin, only when BOTH staff env vars are present.
  if (!role && staffEmail && staffPasscode) {
    const emailOk = inputEmail === staffEmail.trim().toLowerCase();
    const passOk = timingSafeEqual(passcode, staffPasscode);
    if (emailOk && passOk) {
      normalizedEmail = staffEmail;
      role = "admin";
    }
  }

  // Finally try a DB-backed admin (created via People → Add admin).
  if (!role && isSupabaseConfigured) {
    try {
      const dbAdmin = await verifyAdminLogin(inputEmail, passcode);
      if (dbAdmin) {
        normalizedEmail = dbAdmin.email;
        role = dbAdmin.role;
      }
    } catch {
      /* DB hiccup → fall through to fail-closed */
    }
  }

  // No credential set matched → record the failed attempt (arming a lock once the
  // cap is hit) and fail closed.
  if (!role || !normalizedEmail) {
    await recordLoginFailure(inputEmail, ip);
    return Response.json({ ok: false }, { status: 401 });
  }

  // Valid credential — clear the passcode counters even if a second factor is
  // still owed, so a legitimate operator is never throttled on their own MFA.
  await recordLoginSuccess(inputEmail, ip);

  // Second factors gate EVERY admin (not just super-admins): the enabled set comes
  // from each admin's saved settings (`admin_security`). A factor only counts when
  // it is actually usable — a verifiable TOTP secret, a configured email sender, or
  // a saved mobile number — so the chooser never shows a dead option and an admin is
  // never locked out of a factor they can't complete. Back-compat: the env
  // super-admin with no saved row still gates on the env TOTP secret as before.
  let factors: string[] = [];
  // The number a mobile-OTP factor is sent to (echoed to the client so it can
  // auto-send the Firebase OTP to the saved operator number). Never a secret —
  // it's the operator's own number, already shown in their profile.
  let otpPhone: string | null = null;
  try {
    if (isSupabaseConfigured && (await hasSecurityRow(normalizedEmail))) {
      const f = await getAdminFactors(normalizedEmail);
      // TOTP gates login only when a verifiable secret exists (the admin's OWN
      // enrolled secret, or the env secret for the env super-admin). When TOTP is
      // enabled but not yet enrolled, we DON'T gate here — the post-login setup
      // prompt makes them scan a QR, and the NEXT sign-in then requires it.
      if (f.totp && (await resolveTotpSecret(normalizedEmail))) {
        factors.push("totp");
      }
      if (f.emailOtp && isEmailConfigured()) factors.push("email");
      // Mobile OTP is delivered via Firebase phone auth (login-2fa verifies the
      // returned token against this number) — no SMS provider required today.
      if (f.phoneOtp && f.otpPhone) {
        factors.push("phone");
        otpPhone = f.otpPhone;
      }
    } else if (isEnvTotpAdmin(normalizedEmail) && isTotpConfigured()) {
      factors = ["totp"];
    }
  } catch {
    // DB hiccup → fall back to env TOTP for the env super-admin so MFA still gates.
    if (isEnvTotpAdmin(normalizedEmail) && isTotpConfigured()) factors = ["totp"];
  }

  // Fail-closed MFA guard for the highest-privilege role. When ADMIN_REQUIRE_MFA
  // is enabled, a superadmin may ONLY sign in by completing a second factor — if
  // none is configured (no admin_security row AND no env ADMIN_TOTP_SECRET) we
  // refuse here rather than mint a passcode-only superadmin session. The flag
  // defaults OFF so the demo keeps working on the passcode alone; set
  // ADMIN_REQUIRE_MFA=1 in production so the super-admin is never fail-open.
  if (
    role === "superadmin" &&
    factors.length === 0 &&
    envFlagEnabled(process.env.ADMIN_REQUIRE_MFA)
  ) {
    return Response.json({ ok: false, error: "mfa_required" }, { status: 403 });
  }

  // One or more factors → defer the session: stash a short-lived signed ticket
  // (bound to email + role) and ask the client to complete ANY one factor
  // (verified by login-2fa, which mints the session for the ticket's role).
  if (factors.length > 0) {
    const ticket = await createMfaTicket(normalizedEmail, role);
    const secure = process.env.NODE_ENV === "production";
    const c = await cookies();
    c.set({
      name: ADMIN_MFA_COOKIE,
      value: ticket,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 5,
    });
    // Only a MASKED hint of the OTP number crosses the wire (last 2 digits) —
    // the client needs a hint, never the full number pre-2FA.
    return Response.json({
      ok: true,
      mfaRequired: true,
      factors,
      otpPhone: maskPhone(otpPhone),
    });
  }

  void touchAdminLastLogin(normalizedEmail); // record the successful sign-in
  const tokenVersion = await getAdminTokenVersion(normalizedEmail);
  const token = await createToken(normalizedEmail, role, tokenVersion);
  const secure = process.env.NODE_ENV === "production";
  const c = await cookies();

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
    value: normalizedEmail,
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  // Readable role cookie — UI gating only, NO auth power. The proxy enforces
  // real access via the signed `ng_admin` token (which also carries the role).
  c.set({
    name: ADMIN_ROLE_COOKIE,
    value: role,
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  // Best-effort audit (never blocks the sign-in). MFA-gated sign-ins are logged
  // when they complete in login-2fa / login-phone instead.
  await logActivity({
    actorEmail: normalizedEmail,
    actorRole: role,
    action: "admin.signin",
    meta: { method: "passcode" },
  });

  return Response.json({ ok: true });
}
