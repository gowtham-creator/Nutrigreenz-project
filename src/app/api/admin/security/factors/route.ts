import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { getAdminFactors, setAdminFactors, hasSecurityRow } from "@/lib/admin-security";
import { isTotpConfigured } from "@/lib/totp";
import { isEmailConfigured } from "@/lib/email";

/** Authenticate the request as a signed-in super-admin, or null. */
async function requireSuperAdmin(): Promise<string | null> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  if (!session || session.role !== "superadmin") return null;
  return session.email;
}

/** GET — current factor settings + which factors are actually available. */
export async function GET(): Promise<Response> {
  const email = await requireSuperAdmin();
  if (!email) return Response.json({ ok: false }, { status: 401 });
  const factors = await getAdminFactors(email);
  // With no saved settings yet, reflect the *effective* default so the toggles
  // match real login behaviour: an env-configured authenticator gates sign-in
  // until the super-admin turns it off (which then writes a row, below).
  if (!(await hasSecurityRow(email)) && isTotpConfigured()) factors.totp = true;
  return Response.json({
    ok: true,
    factors,
    available: {
      totp: isTotpConfigured(),
      email: isEmailConfigured(),
      phone: Boolean(process.env.ADMIN_PHONE),
    },
  });
}

function isEmailLike(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** PUT — update factor settings. A factor can only be enabled when usable. */
export async function PUT(request: Request): Promise<Response> {
  const email = await requireSuperAdmin();
  if (!email) return Response.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const patch: {
    emailOtp?: boolean;
    phoneOtp?: boolean;
    totp?: boolean;
    otpEmail?: string | null;
    otpPhone?: string | null;
  } = {};

  if (typeof body.totp === "boolean") {
    if (body.totp && !isTotpConfigured()) {
      return Response.json({ ok: false, error: "totp-unavailable" }, { status: 409 });
    }
    patch.totp = body.totp;
  }

  if (typeof body.emailOtp === "boolean") {
    if (body.emailOtp && !isEmailConfigured()) {
      return Response.json({ ok: false, error: "email-unavailable" }, { status: 409 });
    }
    patch.emailOtp = body.emailOtp;
    // Default the destination to the admin's own email when enabling.
    if (body.emailOtp) patch.otpEmail = email;
  }

  if (typeof body.otpEmail === "string" && body.otpEmail) {
    if (!isEmailLike(body.otpEmail)) {
      return Response.json({ ok: false, error: "bad-email" }, { status: 400 });
    }
    patch.otpEmail = body.otpEmail.trim().toLowerCase();
  }

  if (typeof body.phoneOtp === "boolean") {
    if (body.phoneOtp && typeof body.otpPhone !== "string") {
      // Need a number on file to enable phone OTP — default to the operator
      // number (ADMIN_PHONE) so the super-admin can enable it in one tap.
      const current = await getAdminFactors(email);
      if (!current.otpPhone) {
        const fallback = process.env.ADMIN_PHONE;
        if (fallback) patch.otpPhone = fallback;
        else return Response.json({ ok: false, error: "phone-required" }, { status: 409 });
      }
    }
    patch.phoneOtp = body.phoneOtp;
  }

  if (typeof body.otpPhone === "string" && body.otpPhone) {
    if (!/^\+\d{8,15}$/.test(body.otpPhone)) {
      return Response.json({ ok: false, error: "bad-phone" }, { status: 400 });
    }
    patch.otpPhone = body.otpPhone;
  }

  await setAdminFactors(email, patch);
  return Response.json({ ok: true, factors: await getAdminFactors(email) });
}
