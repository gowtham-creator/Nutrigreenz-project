import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { listAdmins, createAdmin, adminEmailExists, phoneTaken } from "@/lib/admins";
import { sanitizePermissions } from "@/lib/admin-permissions";
import { setAdminFactors } from "@/lib/admin-security";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity-log";

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

function credentialsEmailHtml(name: string, email: string, password: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a2b22">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:18px;font-weight:700;color:#14532d">Nutri Greenz · Admin access</div>
    <p style="font-size:15px;line-height:1.6">Hi ${name || "there"}, you've been added as an <b>Admin</b>. Sign in at the Nutri Greenz admin portal with:</p>
    <div style="background:#fff;border:1px solid #d9d3c2;border-radius:12px;padding:16px 18px;margin:14px 0">
      <div style="font-size:13px;color:#5b6b60">Email</div><div style="font-size:16px;font-weight:600">${email}</div>
      <div style="font-size:13px;color:#5b6b60;margin-top:10px">Temporary password</div><div style="font-size:18px;font-weight:700;letter-spacing:1px;color:#14532d">${password}</div>
    </div>
    <p style="font-size:13px;color:#5b6b60">Please change this password after your first sign-in. If you didn't expect this, ignore the email.</p>
  </div></body></html>`;
}

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
export async function POST(request: Request): Promise<Response> {
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

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phoneDigits = String(body.phone ?? "").replace(/\D/g, "");
  const password = String(body.password ?? "");
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
  if (password.length < 12) {
    return Response.json({ ok: false, error: "weak-password" }, { status: 400 });
  }
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
    password,
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

  // Deliver credentials. Email via Brevo; SMS/WhatsApp await their providers.
  const sent: string[] = [];
  const pending: string[] = [];
  if (channels.includes("email")) {
    if (isEmailConfigured()) {
      try {
        await sendEmail({
          to: email,
          subject: "Your Nutri Greenz admin access",
          html: credentialsEmailHtml(name, email, password),
        });
        sent.push("email");
      } catch {
        pending.push("email");
      }
    } else {
      pending.push("email");
    }
  }
  if (channels.includes("sms")) pending.push("sms");
  if (channels.includes("whatsapp")) pending.push("whatsapp");

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.create",
    target: admin.email,
    meta: { name: admin.name ?? null, role: admin.role },
  });

  return Response.json({ ok: true, admin, sent, pending });
}
