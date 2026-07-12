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
import { getAdminFactors, hasSecurityRow } from "@/lib/admin-security";
import { verifyAdminLogin } from "@/lib/admins";
import { isEmailConfigured } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";

/** Session lifetime: 12 hours (seconds). */
// 30-min idle session, slid on activity via /api/admin/heartbeat.
const MAX_AGE = ADMIN_SESSION_TTL_SECONDS;

/** Default operator email if `ADMIN_EMAIL` is not configured. */
const DEFAULT_ADMIN_EMAIL = "admin@nutrigreenz.in";

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

/**
 * POST /api/admin/login
 *
 * Server-side credential validation for the admin portal. Two roles are
 * supported:
 *   - `superadmin` — the EXISTING `ADMIN_EMAIL` (default `admin@nutrigreenz.in`)
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

  // No credential set matched → fail closed.
  if (!role || !normalizedEmail) {
    return Response.json({ ok: false }, { status: 401 });
  }

  // Work out which second factors gate this sign-in (super-admin only). The
  // enabled set is driven by the admin's saved settings (`admin_security`); a
  // factor only counts when it is actually usable (secret/provider present).
  // Back-compat: with no saved row, env TOTP gates login exactly as before.
  let factors: string[] = [];
  // The number a mobile-OTP factor is sent to (echoed to the client so it can
  // auto-send the Firebase OTP to the saved operator number). Never a secret —
  // it's the operator's own number, already shown in their profile.
  let otpPhone: string | null = null;
  if (role === "superadmin") {
    try {
      if (isSupabaseConfigured && (await hasSecurityRow(normalizedEmail))) {
        const f = await getAdminFactors(normalizedEmail);
        if (f.totp && isTotpConfigured()) factors.push("totp");
        if (f.emailOtp && isEmailConfigured()) factors.push("email");
        // Mobile OTP (#42): offered only when the Mobile factor is on AND a
        // destination number is saved, so the chooser never shows a dead option.
        // login-2fa already verifies a Firebase phone token against this number.
        if (f.phoneOtp && f.otpPhone) {
          factors.push("phone");
          otpPhone = f.otpPhone;
        }
      } else if (isTotpConfigured()) {
        factors = ["totp"];
      }
    } catch {
      // DB hiccup → fall back to env TOTP so MFA still gates the sign-in.
      if (isTotpConfigured()) factors = ["totp"];
    }
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
    return Response.json({ ok: true, mfaRequired: true, factors, otpPhone });
  }

  const token = await createToken(normalizedEmail, role);
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
