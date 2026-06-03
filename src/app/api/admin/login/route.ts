import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_EMAIL_COOKIE } from "@/lib/admin-auth";
import { createToken } from "@/lib/admin-session";

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
 * Server-side credential validation for the admin portal. The passcode is
 * checked against `process.env.ADMIN_PASSCODE` (no fallback — if unset, login
 * always fails). On success we set two cookies:
 *   - `ng_admin`       — httpOnly, signed session token (the real gate)
 *   - `ng_admin_email` — readable email string, for UI display only
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

  const expectedEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const expectedPasscode = process.env.ADMIN_PASSCODE;

  // No passcode configured → always fail (fail closed).
  if (!expectedPasscode) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const emailOk =
    email.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  const passOk = timingSafeEqual(passcode, expectedPasscode);

  if (!emailOk || !passOk) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const normalizedEmail = expectedEmail;
  const token = await createToken(normalizedEmail);
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

  return Response.json({ ok: true });
}
