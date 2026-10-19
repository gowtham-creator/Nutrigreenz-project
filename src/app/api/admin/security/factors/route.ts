import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import {
  getAdminFactors,
  setAdminFactors,
  hasSecurityRow,
  getTotpEnrollment,
} from "@/lib/admin-security";
import { isTotpConfigured } from "@/lib/totp";
import { isEmailConfigured } from "@/lib/email";
import { adminMailbox } from "@/lib/admin-identity";

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

  /*
   * Report where a code would ACTUALLY land, not where the account lives.
   *
   * While the domain has no mailbox, super-admin codes are redirected to a
   * working address. The console used to name the account address, which would
   * have left the operator watching an inbox that can never receive anything
   * and concluding the feature was broken. This is the one place the
   * redirection has to be visible.
   */
  factors.otpEmail = factors.otpEmail || adminMailbox(email);
  const enrollment = await getTotpEnrollment(email);
  return Response.json({
    ok: true,
    factors,
    /**
     * Whether this admin has actually completed authenticator enrolment (QR
     * scanned AND a code confirmed). The toggle needs this to decide between
     * "turn it on" and "walk them through setup first".
     */
    totpEnrolled: enrollment.enrolled,
    available: {
      // Availability is PER-ADMIN, not per-environment. These were previously
      // derived from ADMIN_TOTP_SECRET / ADMIN_PHONE, which are only set for the
      // legacy env-configured super-admin — so every database-backed admin saw
      // all three toggles as unavailable and switched off, no matter what was
      // actually stored against their account.
      //
      // Any admin can enrol their own authenticator, so TOTP is always offerable.
      totp: true,
      email: isEmailConfigured(),
      // Mobile OTP needs a number on file for THIS admin.
      phone: Boolean(factors.otpPhone) || Boolean(process.env.ADMIN_PHONE),
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
    // Turning the authenticator ON is NOT something this toggle can do on its
    // own. Setting the flag without a confirmed enrolment makes the next sign-in
    // demand a 6-digit code from an authenticator that was never set up — an
    // unrecoverable lock-out. Enrolment (/api/admin/me/totp/setup → /confirm) is
    // the only path that enables it, and it flips this flag itself on success.
    // Turning it OFF is always permitted.
    if (body.totp && !(await getTotpEnrollment(email)).enrolled) {
      return Response.json(
        {
          ok: false,
          error: "totp-not-enrolled",
          message:
            "Scan the QR code with your authenticator app and confirm a code to turn this on.",
        },
        { status: 409 },
      );
    }
    patch.totp = body.totp;
  }

  if (typeof body.emailOtp === "boolean") {
    if (body.emailOtp && !isEmailConfigured()) {
      return Response.json({ ok: false, error: "email-unavailable" }, { status: 409 });
    }
    patch.emailOtp = body.emailOtp;
    // Seed a destination ONLY when none is on file. This previously reset the
    // destination to the account's own address every time the factor was toggled,
    // silently discarding a custom one — which matters when the account address
    // has no mailbox behind it and codes were deliberately pointed elsewhere.
    if (body.emailOtp && typeof body.otpEmail !== "string") {
      const current = await getAdminFactors(email);
      // Seed the DELIVERABLE address, not the account address. Storing the
      // latter would write `cubixso@nutrigreenz.farm` — which has no mailbox —
      // as an explicit destination, and an explicit destination outranks the
      // override at send time. Turning the factor on would then switch off the
      // only thing making its codes arrive.
      if (!current.otpEmail) patch.otpEmail = adminMailbox(email);
    }
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

  try {
    await setAdminFactors(email, patch);
  } catch (err) {
    // Enabling TOTP without an enrolled secret would lock the account out, so
    // it is refused. Say why, rather than returning a bare 500 that reads as
    // "couldn't update - try again" and invites a retry that cannot succeed.
    if (err instanceof Error && err.message === "totp-not-enrolled") {
      return Response.json(
        {
          ok: false,
          error: "totp-not-enrolled",
          message: "Scan the QR code and confirm a code first. Turning this on before setup would lock the account out.",
        },
        { status: 409 },
      );
    }
    throw err;
  }
  const saved = await getAdminFactors(email);
  saved.otpEmail = saved.otpEmail || adminMailbox(email);
  return Response.json({ ok: true, factors: saved });
}
