/**
 * GET  /api/admin/me   — the signed-in operator's own profile.
 * PATCH /api/admin/me  — persist their editable name + mobile.
 *
 * Identity is resolved from the signed `ng_admin` session (see `./guard`), so a
 * caller can only ever read/edit their OWN row — the client never supplies an
 * id. Both admin and super-admin may use this; `/admin/profile` is not
 * super-admin-only. Node runtime: it touches the service-role DB client.
 */
import { currentAdminSession } from "./guard";
import { getAdminByEmail, updateAdminProfile } from "@/lib/admins";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import type { AdminRole } from "@/lib/admin-session";

export const runtime = "nodejs";

/** The profile payload shape returned to the client. */
interface ProfilePayload {
  email: string;
  role: AdminRole;
  name: string | null;
  phone: string | null;
  photoUrl: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
}

/**
 * Build the profile from the (tamper-proof) session + the DB row. Role/email
 * always come from the signed token; the rest from the `admins` row when one
 * exists (an env-only operator simply has null meta).
 */
function buildProfile(
  email: string,
  role: AdminRole,
  record: Awaited<ReturnType<typeof getAdminByEmail>>,
): ProfilePayload {
  return {
    email,
    role,
    name: record?.name ?? null,
    phone: record?.phone ?? null,
    photoUrl: record?.photoUrl ?? null,
    createdAt: record?.createdAt ?? null,
    lastLoginAt: record?.lastLoginAt ?? null,
  };
}

export async function GET(): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  const record = await getAdminByEmail(session.email); // never throws
  return Response.json({
    ok: true,
    profile: buildProfile(session.email, session.role, record),
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const patch: { name?: string; phone?: string | null } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const name = body.name.trim();
    if (!name) return Response.json({ ok: false, error: "name-required" }, { status: 400 });
    patch.name = name.slice(0, 80);
  }

  if (body.phone !== undefined) {
    // Accept a raw/formatted number; store canonical E.164 (+91XXXXXXXXXX) to
    // match the rest of the system, or null to clear. Blank clears; anything
    // that isn't a clean 10-digit Indian mobile is rejected.
    const digits = String(body.phone ?? "").replace(/\D/g, "");
    if (digits.length === 0) {
      patch.phone = null;
    } else if (digits.length === 10) {
      patch.phone = `+91${digits}`;
    } else {
      return Response.json({ ok: false, error: "invalid-phone" }, { status: 400 });
    }
  }

  const updated = await updateAdminProfile({ email: session.email, role: session.role, ...patch });
  if (!updated) {
    return Response.json({ ok: false, error: "save-failed" }, { status: 500 });
  }

  await logActivity({
    actorEmail: session.email,
    actorRole: session.role,
    action: "admin.profile_update",
    target: session.email,
    meta: {
      name: patch.name ?? undefined,
      phone: patch.phone ?? undefined,
    },
  });

  return Response.json({
    ok: true,
    profile: buildProfile(session.email, session.role, updated),
  });
}
