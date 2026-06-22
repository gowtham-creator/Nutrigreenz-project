import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_ROLE_COOKIE,
  ADMIN_MFA_COOKIE,
} from "@/lib/admin-auth";
import {
  createMfaTicket,
  createToken,
  type AdminRole,
} from "@/lib/admin-session";
import { isTotpConfigured } from "@/lib/totp";

/** Session lifetime: 12 hours (seconds). */
const MAX_AGE = 60 * 60 * 12;

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

  // No credential set matched → fail closed.
  if (!role || !normalizedEmail) {
    return Response.json({ ok: false }, { status: 401 });
  }

  // Super-admin clears a second factor when an authenticator is configured.
  // Defer the real session: stash a short-lived signed ticket and ask the
  // client for the TOTP code (verified by /api/admin/login-2fa).
  if (role === "superadmin" && isTotpConfigured()) {
    const ticket = await createMfaTicket(normalizedEmail);
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
    return Response.json({ ok: true, mfaRequired: true });
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

  return Response.json({ ok: true });
}
