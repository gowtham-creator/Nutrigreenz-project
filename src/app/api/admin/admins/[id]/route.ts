import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import {
  getAdminById,
  updateAdmin,
  resetAdminPassword,
  deleteAdminById,
  type AdminRole,
  type AdminStatus,
} from "@/lib/admins";
import { setAdminFactors } from "@/lib/admin-security";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity-log";

/** The signed-in super-admin's email, or null when not a super-admin. */
async function superAdminEmail(): Promise<string | null> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session && session.role === "superadmin" ? session.email : null;
}

const ROLES: AdminRole[] = ["admin", "superadmin"];
const STATUSES: AdminStatus[] = ["active", "invited", "disabled"];

function credentialsEmailHtml(name: string, email: string, password: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a2b22">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:18px;font-weight:700;color:#14532d">Nutri Greenz · Admin access</div>
    <p style="font-size:15px;line-height:1.6">Hi ${name || "there"}, here are your updated sign-in details for the Nutri Greenz admin portal:</p>
    <div style="background:#fff;border:1px solid #d9d3c2;border-radius:12px;padding:16px 18px;margin:14px 0">
      <div style="font-size:13px;color:#5b6b60">Email</div><div style="font-size:16px;font-weight:600">${email}</div>
      <div style="font-size:13px;color:#5b6b60;margin-top:10px">Temporary password</div><div style="font-size:18px;font-weight:700;letter-spacing:1px;color:#14532d">${password}</div>
    </div>
    <p style="font-size:13px;color:#5b6b60">Please change this password after your next sign-in. If you didn't expect this, ignore the email.</p>
  </div></body></html>`;
}

/** PATCH — edit name, mobile, role or status. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/admins/[id]">,
): Promise<Response> {
  const actorEmail = await superAdminEmail();
  if (!actorEmail) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const patch: { name?: string; phone?: string; role?: AdminRole; status?: AdminStatus } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    patch.name = name;
  }
  if (body.phone !== undefined) {
    const digits = String(body.phone).replace(/\D/g, "");
    if (digits.length !== 10) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    patch.phone = `+91${digits}`;
  }
  if (body.role !== undefined) {
    const role = String(body.role);
    if (!ROLES.includes(role as AdminRole)) {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    patch.role = role as AdminRole;
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!STATUSES.includes(status as AdminStatus)) {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    patch.status = status as AdminStatus;
  }

  const admin = await updateAdmin(id, patch);
  if (!admin) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  // Persist per-admin sign-in factors when supplied. otpEmail/otpPhone track the
  // admin's own contact so codes reach THEM; keep otpPhone in sync when the
  // mobile changed. Best-effort — a failure here must not fail the profile edit.
  if (typeof body.factors === "object" && body.factors) {
    const f = body.factors as Record<string, unknown>;
    try {
      await setAdminFactors(admin.email, {
        emailOtp: Boolean(f.emailOtp),
        phoneOtp: Boolean(f.phoneOtp),
        totp: Boolean(f.totp),
        otpEmail: admin.email,
        ...(patch.phone ? { otpPhone: patch.phone } : {}),
      });
    } catch {
      /* non-fatal */
    }
  }

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.update",
    target: admin.email,
    meta: { changed: Object.keys(patch) },
  });

  return Response.json({ ok: true, admin });
}

/** POST — per-row credential actions (reset password, resend credentials). */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/admins/[id]">,
): Promise<Response> {
  const actorEmail = await superAdminEmail();
  if (!actorEmail) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (action !== "reset-password" && action !== "resend") {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = await getAdminById(id);
  if (!admin) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  const password = await resetAdminPassword(id);
  if (!password) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  // Deliver the new credentials by email when configured.
  //  · "resend"         → email the target admin only.
  //  · "reset-password" → email BOTH the target admin and the acting super-admin
  //                       (best-effort; a send failure must not break the reset).
  const sent: string[] = [];
  const pending: string[] = [];
  if (isEmailConfigured()) {
    const html = credentialsEmailHtml(admin.name ?? "", admin.email, password);
    try {
      await sendEmail({ to: admin.email, subject: "Your Nutri Greenz admin access", html });
      sent.push("admin");
    } catch {
      pending.push("admin");
    }
    if (action === "reset-password" && actorEmail.toLowerCase() !== admin.email.toLowerCase()) {
      try {
        await sendEmail({ to: actorEmail, subject: "Your Nutri Greenz admin access", html });
        sent.push("you");
      } catch {
        pending.push("you");
      }
    }
  } else {
    pending.push("admin");
    if (action === "reset-password" && actorEmail.toLowerCase() !== admin.email.toLowerCase()) {
      pending.push("you");
    }
  }

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.reset_password",
    target: admin.email,
    meta: { action },
  });

  return Response.json({ ok: true, email: admin.email, password, sent, pending });
}

/** DELETE — remove an admin permanently. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/admins/[id]">,
): Promise<Response> {
  const actorEmail = await superAdminEmail();
  if (!actorEmail) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const admin = await getAdminById(id);
  if (!admin) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  await deleteAdminById(id);

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.delete",
    target: admin.email,
  });

  return Response.json({ ok: true });
}
