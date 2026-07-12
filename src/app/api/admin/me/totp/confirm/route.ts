import { currentAdminSession } from "../../guard";
import { getTotpSecret, enableTotp } from "@/lib/admin-security";
import { verifyTotp } from "@/lib/totp";
import { logActivity } from "@/lib/activity-log";

/**
 * POST /api/admin/me/totp/confirm { code } — finish authenticator enrollment.
 * Verifies the 6-digit code against the pending secret and, on success, enables
 * the factor so the admin's NEXT sign-in requires their authenticator.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  let code: unknown;
  try {
    code = (await request.json())?.code;
  } catch {
    return Response.json({ ok: false, error: "bad-code" }, { status: 400 });
  }
  if (typeof code !== "string") {
    return Response.json({ ok: false, error: "bad-code" }, { status: 400 });
  }

  const secret = await getTotpSecret(session.email);
  if (!secret) return Response.json({ ok: false, error: "no-setup" }, { status: 409 });

  if (!(await verifyTotp(code, secret))) {
    return Response.json({ ok: false, error: "bad-code" }, { status: 400 });
  }

  await enableTotp(session.email);
  await logActivity({
    actorEmail: session.email,
    actorRole: session.role,
    action: "admin.totp_enrolled",
    target: session.email,
    meta: null,
  });
  return Response.json({ ok: true });
}
