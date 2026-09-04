import { cookies } from "next/headers";
import { sendAdminInvite } from "@/lib/admin-invite";
import { TEXT_LIMITS, plainText } from "@/lib/sanitize-text";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import {
  getAdminById,
  updateAdmin,
  clearAdminPassword,
  deleteAdminById,
  countActiveSuperadmins,
  type AdminRole,
  type AdminStatus,
} from "@/lib/admins";
import { sanitizePermissions } from "@/lib/admin-permissions";
import { setAdminFactors } from "@/lib/admin-security";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";

/** The signed-in super-admin's email, or null when not a super-admin. */
async function superAdminEmail(): Promise<string | null> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session && session.role === "superadmin" ? session.email : null;
}

const ROLES: AdminRole[] = ["admin", "superadmin"];
const STATUSES: AdminStatus[] = ["active", "invited", "disabled"];

/**
 * Owner guard.
 *
 * A PROTECTED admin (the owner) may only ever be mutated by itself. Every other
 * operator — including another super-admin — is refused, which is what makes the
 * owner account impossible to demote, suspend, password-reset or delete from
 * inside the portal. Returns a 403 Response to short-circuit with, or null when
 * the mutation is allowed.
 *
 * Note the flag is never accepted from a request body anywhere in this API, so
 * protection cannot be granted or stripped by a compromised session; it is set
 * in SQL only.
 */
async function protectedTargetDenial(
  targetId: string,
  actorEmail: string,
): Promise<Response | null> {
  const target = await getAdminById(targetId);
  if (!target) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  if (!target.isProtected) return null;
  if (target.email.trim().toLowerCase() === actorEmail.trim().toLowerCase()) return null;

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.protected_denied",
    target: target.email,
    meta: { reason: "attempted mutation of the protected owner account" },
  });

  return Response.json(
    {
      ok: false,
      error: "protected-account",
      message:
        "This is the owner account. It can only be changed by the account holder.",
    },
    { status: 403 },
  );
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

  // Owner guard — refuse before reading the body or touching the row.
  const denied = await protectedTargetDenial(id, actorEmail);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const patch: {
    name?: string;
    phone?: string;
    role?: AdminRole;
    status?: AdminStatus;
    permissions?: string[];
  } = {};

  if (body.name !== undefined) {
    const name = plainText(body.name, TEXT_LIMITS.name);
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
  // Granted portal sections — sanitised against the catalogue. Irrelevant for a
  // superadmin (they always hold every permission), but harmless to store.
  if (body.permissions !== undefined) {
    patch.permissions = sanitizePermissions(body.permissions);
  }

  // Last-superadmin guard: never let the roster demote or deactivate the FINAL
  // active superadmin (this also covers a superadmin demoting/deactivating
  // themselves when they are the only one) — that would lock everyone out of
  // admin management. Refuse with 409 before touching the row.
  const current = await getAdminById(id);
  if (!current) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  const willDemote = patch.role === "admin" && current.role === "superadmin";
  const willDeactivate =
    patch.status !== undefined && patch.status !== "active" && current.role === "superadmin";
  if (current.status === "active" && (willDemote || willDeactivate)) {
    if ((await countActiveSuperadmins()) <= 1) {
      return Response.json(
        {
          ok: false,
          error: "last-superadmin",
          message: "Cannot demote or deactivate the last active superadmin.",
        },
        { status: 409 },
      );
    }
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

  // Owner guard — no other operator may reset the owner's credentials.
  const denied = await protectedTargetDenial(id, actorEmail);
  if (denied) return denied;

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

  /*
   * Invalidate the existing credential, then send a setup LINK.
   *
   * `clearAdminPassword` nulls the passcode hash, which `verifyAdminLogin`
   * refuses — so the moment a super admin clicks "reset", the old password
   * stops working. That is the half the previous flow got wrong in the other
   * direction: it minted a NEW temporary password that then stayed valid
   * indefinitely and could be reused for every subsequent sign-in.
   *
   * The link goes ONLY to the account holder. It is deliberately not copied to
   * the acting super admin, as the old credentials email was — a reset is not a
   * reason for another person to hold your means of access.
   */
  const cleared = await clearAdminPassword(id);
  if (!cleared) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  const invite = await sendAdminInvite(admin.email, admin.name ?? "", { isNew: false });
  const sent = invite.sent.map(() => "admin");
  const pending = invite.pending.map(() => "admin");

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.reset_password",
    target: admin.email,
    meta: { action },
  });

  /*
   * `password` is deliberately NOT returned.
   *
   * It used to be, so the super-admin UI could display the new temporary
   * password — which disclosed another operator's credential to somebody with
   * no need to know it. The response now carries only where the link went.
   */
  return Response.json({ ok: true, email: admin.email, sent, pending, setupLink: invite.link });
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

  // Owner guard — the protected account cannot be deleted by anyone else.
  const denied = await protectedTargetDenial(id, actorEmail);
  if (denied) return denied;

  const admin = await getAdminById(id);
  if (!admin) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  // Last-superadmin guard: refuse to delete the final active superadmin.
  if (admin.role === "superadmin" && admin.status === "active") {
    if ((await countActiveSuperadmins()) <= 1) {
      return Response.json(
        {
          ok: false,
          error: "last-superadmin",
          message: "Cannot delete the last active superadmin.",
        },
        { status: 409 },
      );
    }
  }

  await deleteAdminById(id);

  await logActivity({
    actorEmail,
    actorRole: "superadmin",
    action: "admin.delete",
    target: admin.email,
  });

  return Response.json({ ok: true });
}
