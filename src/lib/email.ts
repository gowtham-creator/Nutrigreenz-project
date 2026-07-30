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

/** A file to attach, as base64 content (Brevo's `attachment` shape). */
export interface EmailAttachment {
  /** File name shown to the recipient, e.g. "Invoice-NG-26-1000.pdf". */
  name: string;
  /** Base64-encoded file content. */
  content: string;
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  /** Optional attachments — used to send the tax invoice with the order email. */
  attachments?: EmailAttachment[];
}

/** Send a single transactional email. Throws on misconfiguration or API error. */
export async function sendEmail({ to, subject, html, attachments }: SendEmailArgs): Promise<void> {
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
      ...(attachments && attachments.length
        ? { attachment: attachments.map((a) => ({ name: a.name, content: a.content })) }
        : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

/**
 * The admin sign-in code email.
 *
 * Built on the same shell as the order emails — white page, 560px column, the
 * horizontal logo, the same ink/muted/rule palette — so a code that arrives
 * moments after an order confirmation clearly comes from the same company. The
 * old version used a different cream background, a different green and a
 * different type stack, which read like a second, unrelated sender.
 *
 * Two deliberate choices:
 *
 *  · The palette is pinned with `color-scheme: light only`. Gmail and Apple Mail
 *    force-invert unpinned mail, and an inverted code box put near-black digits
 *    on a near-black card — the one element that absolutely must stay readable.
 *
 *  · There is no button and no sign-in link anywhere in the body. A one-time
 *    code email that also carries a "click here to sign in" link is exactly the
 *    shape of a phishing mail, and it trains an admin to click links in mail
 *    asking for credentials. The code is copied by hand into a tab they already
 *    opened themselves.
 *
 * `expiryMinutes` is passed in from {@link EMAIL_OTP_TTL_MINUTES} rather than
 * written into the copy, so the sentence can't drift from the real TTL.
 */
export function otpEmailHtml(code: string, expiryMinutes = 10): string {
  const INK = "#141414";
  const MUTED = "#6B6F72";
  const LINE = "#E4E4E5";
  const PAGE = "#FFFFFF";
  const GREEN = "#14331F";
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";

  // Digits only — never interpolate an unvalidated value into the markup.
  const safeCode = /^\d{4,8}$/.test(code) ? code : "";
  const minutes = Math.max(1, Math.round(expiryMinutes));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>Your Nutri Greenz admin sign-in code</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};color:${INK};color-scheme:light only;-webkit-font-smoothing:antialiased">
  <!-- Preheader: puts the code in the inbox preview line, so it can be read
       without opening the mail. Hidden inside the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${safeCode} is your Nutri Greenz admin sign-in code. It expires in ${minutes} minutes.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:36px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

        <!-- Brand -->
        <tr>
          <td style="padding:0 0 34px">
            <img src="${SITE}/brand/logo-horizontal.png" alt="Nutri Greenz" width="132"
                 style="display:block;border:0;height:auto;width:132px;max-width:132px" />
          </td>
        </tr>

        <tr>
          <td style="padding:0 0 6px;font-size:13.5px;color:${MUTED}">Admin portal</td>
        </tr>
        <tr>
          <td style="padding:0 0 8px;font-size:26px;line-height:1.25;font-weight:700;color:${INK}">
            Your sign-in code
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 26px;font-size:14px;line-height:1.65;color:${MUTED}">
            Enter this code on the sign-in screen to finish signing in.
          </td>
        </tr>

        <!-- The code. Letter-spacing is padded on the right so the trailing gap
             doesn't push the digits off-centre inside the box. -->
        <tr>
          <td style="padding:0 0 20px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid ${LINE};border-radius:12px;background:#FAFAFA">
              <tr>
                <td align="center" style="padding:26px 16px;font-size:34px;line-height:1.1;font-weight:700;color:${INK};letter-spacing:10px;text-indent:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">
                  ${safeCode}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 0 30px;font-size:13px;line-height:1.7;color:${MUTED}">
            It expires in <strong style="color:${INK}">${minutes} minutes</strong> and works once.
          </td>
        </tr>

        <!-- Security note -->
        <tr>
          <td style="padding:0 0 6px;border-top:1px solid ${LINE}">
            <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:${MUTED}">
              <strong style="color:${INK}">Didn't try to sign in?</strong> Someone has your password.
              Ignore this code — it's useless on its own — then change the password and tell
              <a href="mailto:customersupport@nutrigreenz.farm" style="color:${GREEN}">customersupport@nutrigreenz.farm</a>.
            </p>
            <p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:${MUTED}">
              Nobody at Nutri Greenz will ever ask you for this code — not by phone, not by email,
              not on WhatsApp.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:30px 0 0">
            <p style="margin:0;font-size:12px;line-height:1.7;color:${MUTED}">
              <strong style="color:${INK}">Nutri Greenz Farm Technologies Pvt. Ltd.</strong><br />
              1st Floor, H.No. 5-35/167, Double Road, Near Moosapet Y Junction,<br />
              Prashanth Nagar, Kukatpally, Hyderabad, Telangana 500072
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}
