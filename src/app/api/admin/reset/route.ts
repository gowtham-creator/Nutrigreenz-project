/**
 * POST /api/admin/reset — complete an operator password reset.
 *
 * Accepts `{ token, password }`. Verifies the reset token's signature + expiry
 * and CONSUMES it (single-use), then stores a fresh PBKDF2 hash for the bound
 * admin via {@link setAdminPassword}. Returns `{ ok: true }` on success, or a
 * 400 with a stable error code (`invalid-token` | `weak-password` |
 * `bad-request`). The token is never trusted for identity beyond its verified
 * signature — the email is recovered from the signed payload, never the client.
 */
import { consumeAdminResetToken } from "@/lib/admin-password-reset";
import { setAdminPassword } from "@/lib/admins";

export const runtime = "nodejs";

/** Minimum length for a self-chosen operator password. */
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const o =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const token = typeof o.token === "string" ? o.token : "";
  const password = typeof o.password === "string" ? o.password : "";

  if (!token) {
    return Response.json({ ok: false, error: "invalid-token" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json({ ok: false, error: "weak-password" }, { status: 400 });
  }

  const email = await consumeAdminResetToken(token);
  if (!email) {
    return Response.json({ ok: false, error: "invalid-token" }, { status: 400 });
  }

  const ok = await setAdminPassword(email, password);
  if (!ok) {
    // Token consumed but the admin row vanished — treat as invalid.
    return Response.json({ ok: false, error: "invalid-token" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
