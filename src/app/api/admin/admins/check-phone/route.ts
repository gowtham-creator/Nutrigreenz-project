import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { phoneTaken } from "@/lib/admins";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/admin-allowlist";

/** The signed-in super-admin's email, or null when not a super-admin. */
async function superAdminEmail(): Promise<string | null> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return session && session.role === "superadmin" ? session.email : null;
}

/** GET — live "is this mobile already taken?" check for the add-admin modal. */
export async function GET(request: Request): Promise<Response> {
  if (!(await superAdminEmail())) return Response.json({ ok: false }, { status: 401 });

  const digits = (new URL(request.url).searchParams.get("phone") ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return Response.json({ ok: true, exists: false });

  const phone = `+91${digits}`;

  // Env-configured numbers are taken even before the DB is wired up.
  if (!isSupabaseConfigured) {
    const target = normalizePhone(phone);
    const envTaken = [process.env.ADMIN_PHONE, process.env.STAFF_ADMIN_PHONE]
      .map((p) => (p ? normalizePhone(p) : ""))
      .includes(target);
    return Response.json({ ok: true, exists: envTaken });
  }

  const exists = await phoneTaken(phone);
  return Response.json({ ok: true, exists });
}
