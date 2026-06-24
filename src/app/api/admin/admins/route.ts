import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { listAdmins, createAdmin, adminEmailExists } from "@/lib/admins";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";

/** Only a signed-in super-admin may list or create admins. */
async function isSuperAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return Boolean(session && session.role === "superadmin");
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

/** GET — list admins. */
export async function GET(): Promise<Response> {
  if (!(await isSuperAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: true, admins: [] });
  const admins = await listAdmins();
  return Response.json({ ok: true, admins });
}

/** POST — create an admin and deliver their credentials. */
export async function POST(request: Request): Promise<Response> {
  if (!(await isSuperAdmin())) return Response.json({ ok: false }, { status: 401 });
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

  if (!name || !EMAIL_RE.test(email) || phoneDigits.length !== 10 || password.length < 8) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (await adminEmailExists(email)) {
    return Response.json({ ok: false, error: "exists" }, { status: 409 });
  }

  const admin = await createAdmin({
    name,
    email,
    phone: `+91${phoneDigits}`,
    password,
    role: "admin",
  });

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

  return Response.json({ ok: true, admin, sent, pending });
}
