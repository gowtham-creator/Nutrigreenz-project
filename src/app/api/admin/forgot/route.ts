/**
 * POST /api/admin/forgot — request an operator password-reset link.
 *
 * Accepts `{ email }`. When it maps to a known, non-disabled admin we mint a
 * signed, single-use, 30-minute reset token and email a `/admin/reset` link via
 * Brevo. When email is unconfigured we log the link instead so the flow still
 * works in dev/CI. The response is ALWAYS a generic `{ ok: true }` — it never
 * reveals whether an account exists (no user-enumeration), and it never leaks
 * whether email delivery succeeded.
 */
import { getAdminByEmail } from "@/lib/admins";
import { createAdminResetToken } from "@/lib/admin-password-reset";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { checkResetAllowed, recordResetRequest } from "@/lib/admin-login-guard";

// supabase-admin + PBKDF2/HMAC via Web Crypto need the Node runtime.
export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz-project.vercel.app";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function resetEmailHtml(link: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a2b21">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #e6e1d5;border-radius:20px;padding:32px">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#4a6b52;font-weight:700">Nutri Greenz · Admin</div>
        <h1 style="font-size:22px;color:#14532d;margin:14px 0 8px">Reset your admin password</h1>
        <p style="font-size:14px;line-height:1.6;color:#55625a;margin:0 0 22px">
          We received a request to reset the passcode for your operator account. This link expires in 30 minutes and can be used only once. If you didn't request it, you can safely ignore this email — nothing will change.
        </p>
        <a href="${link}" style="display:inline-block;background:#14532d;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px">Choose a new password</a>
        <p style="font-size:12px;line-height:1.6;color:#8a948c;margin:22px 0 0;word-break:break-all">
          Or paste this link into your browser:<br>${link}
        </p>
      </div>
    </div>
  </body></html>`;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const rawEmail =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).email
      : undefined;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  /*
   * Throttle before doing any work.
   *
   * Unlimited, this endpoint is a free email cannon: anyone who knows an
   * operator's address can flood their inbox by replaying this request. Three
   * an hour is more than anyone legitimately needs.
   *
   * The two limits are enforced differently on purpose. A per-IP refusal can be
   * answered with 429 — it reveals nothing about which accounts exist. A
   * per-address one must be silent, because refusing loudly for a throttled
   * address while accepting an unknown one would turn the throttle into exactly
   * the account-enumeration oracle the generic response below exists to
   * prevent.
   */
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const limit = await checkResetAllowed(email, ip);
  if (!limit.ipAllowed) {
    return Response.json(
      { ok: false, error: "too-many-requests" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  if (EMAIL_RE.test(email) && limit.emailAllowed) {
    // Counted before the send, so a slow or failing mail provider cannot be
    // used to slip extra requests through while one is in flight.
    await recordResetRequest(email, ip);
    try {
      const admin = await getAdminByEmail(email);
      if (admin && admin.status !== "disabled") {
        const token = await createAdminResetToken(email);
        if (token) {
          const link = `${SITE}/admin/reset?token=${encodeURIComponent(token)}`;
          if (isEmailConfigured()) {
            await sendEmail({
              to: email,
              subject: "Reset your Nutri Greenz admin password",
              html: resetEmailHtml(link),
            });
          } else {
            console.info(`[admin/forgot] email not configured — reset link for ${email}: ${link}`);
          }
        }
      }
    } catch (err) {
      // Never surface failures to the caller (would leak account existence).
      console.error("[admin/forgot] could not issue reset link", err);
    }
  }

  // Generic success regardless of whether the email matched an account.
  return Response.json({ ok: true });
}
