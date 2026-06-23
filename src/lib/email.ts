/**
 * Transactional email via Brevo (https://developers.brevo.com). Server-only.
 *
 * Configure with `BREVO_API_KEY` + `BREVO_SENDER_EMAIL` (a verified sender) and
 * optionally `BREVO_SENDER_NAME`. When unset, {@link isEmailConfigured} is false
 * and {@link sendEmail} throws a clear error so callers can fail gracefully.
 */
import "server-only";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** True when Brevo credentials + a sender address are configured. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

/** Send a single transactional email. Throws on misconfiguration or API error. */
export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Nutri Greenz";
  if (!apiKey || !senderEmail) {
    throw new Error("Email is not configured (set BREVO_API_KEY + BREVO_SENDER_EMAIL).");
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

/** A small, on-brand OTP email body. */
export function otpEmailHtml(code: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a2b22">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:18px;font-weight:700;color:#14532d">Nutri Greenz · Admin</div>
    <p style="font-size:15px;line-height:1.6;margin:20px 0 8px">Your sign-in code is:</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#14532d;background:#fff;border:1px solid #d9d3c2;border-radius:12px;padding:18px 0;text-align:center">${code}</div>
    <p style="font-size:13px;color:#5b6b60;margin-top:16px">It expires in 10 minutes. If you didn't try to sign in, ignore this email.</p>
  </div></body></html>`;
}
