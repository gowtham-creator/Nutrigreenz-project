import { cookies } from "next/headers";
import { sendAdminInvite } from "@/lib/admin-invite";
import { TEXT_LIMITS, strictText } from "@/lib/sanitize-text";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { listAdmins, createAdmin, adminEmailExists, phoneTaken } from "@/lib/admins";
import { sanitizePermissions } from "@/lib/admin-permissions";
import { setAdminFactors } from "@/lib/admin-security";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import { withLengthValidation } from "@/lib/input-validation-guard";

/** Only a signed-in super-admin may list or create admins. */
async function isSuperAdmin(): Promise<boolean> {
  return Boolean(await superAdminEmail());
}

/** The signed-in super-admin's email, or null when not a super-admin. */
async function superAdminEmail(): Promise<string | null> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session && session.role === "superadmin" ? session.email : null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** GET — list admins (plus the optional built-in env staff email, if set). */
export async function GET(): Promise<Response> {
  if (!(await isSuperAdmin())) return Response.json({ ok: false }, { status: 401 });
  // Surface only the env staff EMAIL for an info row — never its passcode.
  const staffEmail = process.env.STAFF_ADMIN_EMAIL?.trim() || null;
  if (!isSupabaseConfigured) return Response.json({ ok: true, admins: [], staffEmail });
  const admins = await listAdmins();
  return Response.json({ ok: true, admins, staffEmail });
}

/** POST — create an admin and deliver their credentials. */
async function POSTHandler(request: Request): Promise<Response> {
  const actorEmail = await superAdminEmail();
  if (!actorEmail) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const name = strictText(body.name, TEXT_LIMITS.name, "Name");
  const email = String(body.email ?? "").trim().toLowerCase();
  const phoneDigits = String(body.phone ?? "").replace(/\D/g, "");
  const channels = (Array.isArray(body.channels) ? body.channels : ["email"]).map(String);
  const factors = (typeof body.factors === "object" && body.factors ? body.factors : {}) as Record<
    string,
    unknown
  >;
  // Sanitise the granted sections against the catalogue — never trust the body.
  // New admins are always role `admin`, so these govern what they can access.
  const permissions = sanitizePermissions(body.permissions);

  if (!name || !EMAIL_RE.test(email) || phoneDigits.length !== 10) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  /*
   * No password is accepted here any more — see `admin-invite.ts`. A super
   * admin invites; the invited person chooses their own credential. A body
   * still carrying `password` is simply ignored rather than rejected, so an
   * older client cannot break, and it can never be stored either way.
   */
  if (await adminEmailExists(email)) {
    return Response.json({ ok: false, error: "exists" }, { status: 409 });
  }

  const phone = `+91${phoneDigits}`;
  if (await phoneTaken(phone)) {
    return Response.json({ ok: false, error: "phone-exists" }, { status: 409 });
  }

  const admin = await createAdmin({
    name,
    email,
    phone,
    // No password: the row is created with a NULL passcode hash, which
    // `verifyAdminLogin` refuses, so the account is inert until its owner
    // completes the setup link below.
    role: "admin",
    permissions,
  });

  // Persist the per-admin sign-in factors the super-admin selected. otpEmail /
  // otpPhone default to the admin's OWN contact so codes go to them. Best-effort:
  // a failure here must not fail the create — factors can be set later via Edit.
  try {
    await setAdminFactors(email, {
      emailOtp: Boolean(factors.emailOtp),
      phoneOtp: Boolean(factors.phoneOtp),
      totp: Boolean(factors.totp),
      otpEmail: email,
      otpPhone: phone,
    });
  } catch {
    /* non-fatal */
  }

  // Send the one-time setup link. Nothing secret is generated, stored or
  // returned — see `admin-invite.ts` for why the temp password was removed.
  const invite = channels.includes("email")
    ? await sendAdminInvite(email, name, { isNew: true })
    : { sent: [] as string[], pending: [] as string[], link: undefined };
  const sent = [...invite.sent];
  const pending = [...invite.pending];
  if (channels.includes("sms")) pending.push("sms");
  if (channels.includes("whatsapp")) pending.push("whatsapp");

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.create",
    target: admin.email,
    meta: { name: admin.name ?? null, role: admin.role },
  });

  return Response.json({ ok: true, admin, sent, pending, setupLink: invite.link });
}


export const POST = withLengthValidation(POSTHandler);
