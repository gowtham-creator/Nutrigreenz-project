import QRCode from "qrcode";
import { currentAdminSession } from "../../guard";
import { getTotpEnrollment, setPendingTotpSecret } from "@/lib/admin-security";
import { generateTotpSecret, buildOtpauthUri } from "@/lib/totp";

/**
 * POST /api/admin/me/totp/setup — begin authenticator enrollment.
 * Generates a fresh per-admin secret, stores it as PENDING (not yet enforced at
 * login), and returns the QR + key to add to Google / Microsoft Authenticator.
 * Confirming a code via /confirm is what actually turns it on.
 */
export async function POST(): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  if ((await getTotpEnrollment(session.email)).enrolled) {
    return Response.json({ ok: false, error: "already-enrolled" }, { status: 409 });
  }

  const secret = generateTotpSecret();
  await setPendingTotpSecret(session.email, secret);
  const otpauthUri = buildOtpauthUri(session.email, secret);
  const qrDataUri = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 224 });

  return Response.json({ ok: true, secret, otpauthUri, qrDataUri });
}
