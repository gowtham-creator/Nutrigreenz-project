import "server-only";
import { sendEmail, isEmailConfigured } from "@/lib/email";

/**
 * Tell the super admins when someone is attacking an admin account.
 *
 * A lockout is the system working — but it is also the only moment anyone finds
 * out that an account is under attack. Without a notification the lock expires
 * three hours later and nobody ever knows it happened, which means a slow
 * credential-stuffing run against the portal is invisible indefinitely.
 *
 * ── Sending must never block signing in ───────────────────────────────────
 *
 * Every call here is wrapped so a mail failure cannot change the outcome of an
 * authentication request. If the alert cannot be sent, that is logged and the
 * login flow continues exactly as it would have. An outage at the mail provider
 * must not become an outage of the admin portal.
 */

/**
 * Who hears about it.
 *
 * `admin@nutrigreenz.farm` and `ramakrishna@nutrigreenz.farm` are the intended
 * addresses but do not exist yet, so alerts go to the personal addresses behind
 * them. Overridable by env so this can be corrected without a deploy once the
 * domain mailboxes are live.
 */
function recipients(): string[] {
  const configured = process.env.SECURITY_ALERT_EMAILS?.trim();
  if (configured) {
    return configured
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }
  return ["gowtham5.gr15@gmail.com", "nutrigreenzfarm@gmail.com"];
}

/** Which factor was being attacked. */
export type LockScope = "password" | "authenticator" | "email-code";

const SCOPE_LABEL: Record<LockScope, string> = {
  password: "passcode",
  authenticator: "authenticator app (TOTP)",
  "email-code": "emailed sign-in code",
};

export interface LockoutAlert {
  /** The account that was locked. */
  email: string;
  scope: LockScope;
  failures: number;
  lockedForMinutes: number;
  /** Best-effort. Null behind a proxy that strips it. */
  ip: string | null;
  userAgent?: string | null;
}

/**
 * Mask the account so a forwarded alert does not itself leak a valid admin
 * address. Enough to recognise the account, not enough to reuse.
 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const name = email.slice(0, at);
  const domain = email.slice(at);
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${"*".repeat(Math.max(3, name.length - 2))}${domain}`;
}

function html(alert: LockoutAlert, when: string): string {
  const rows: [string, string][] = [
    ["Account", maskEmail(alert.email)],
    ["Factor", SCOPE_LABEL[alert.scope]],
    ["Failed attempts", String(alert.failures)],
    ["Locked for", `${alert.lockedForMinutes} minutes`],
    ["Source IP", alert.ip ?? "not recorded"],
    ["Time (IST)", when],
  ];
  if (alert.userAgent) rows.push(["Device", alert.userAgent.slice(0, 120)]);

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f3ec;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fffdf7;border:1px solid #e3e0d4;border-radius:16px;">
    <tr><td style="padding:22px 24px 0;">
      <div style="display:inline-block;padding:5px 11px;border-radius:999px;background:#b4462f14;color:#8f3623;font-size:12px;font-weight:700;letter-spacing:.02em;">SECURITY ALERT</div>
      <h1 style="margin:14px 0 6px;font-size:19px;line-height:1.3;color:#1d3025;">An admin account has been locked</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5b6660;">
        Too many failed sign-in attempts were made, so the account is temporarily
        locked. If this was you, wait for the lock to expire and try again. If it
        was not, treat it as an attempted break-in.
      </p>
    </td></tr>
    <tr><td style="padding:0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13.5px;">
        ${rows
          .map(
            ([k, v], i) => `<tr>
          <td style="padding:9px 0;color:#5b6660;border-top:${i === 0 ? "none" : "1px solid #ece9de"};width:42%;">${k}</td>
          <td style="padding:9px 0;color:#1d3025;font-weight:600;border-top:${i === 0 ? "none" : "1px solid #ece9de"};">${v}</td>
        </tr>`,
          )
          .join("")}
      </table>
    </td></tr>
    <tr><td style="padding:18px 24px 24px;">
      <div style="padding:13px 15px;border-radius:12px;background:#f3f1e7;font-size:12.5px;line-height:1.6;color:#5b6660;">
        <strong style="color:#1d3025;">If this was not you:</strong> reset that
        account's passcode, and revoke its sessions from
        Super Admin → Admins. The lock alone only buys time.
      </div>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Send the lockout notification. Never throws.
 *
 * @returns true if it went out, false if it could not be sent (already logged).
 */
export async function alertAccountLocked(alert: LockoutAlert): Promise<boolean> {
  try {
    if (!isEmailConfigured()) {
      console.warn("[security-alert] email not configured; lockout not notified");
      return false;
    }
    const to = recipients();
    if (to.length === 0) return false;

    const when = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date());

    // The masked account in the subject makes a phone notification useful on
    // its own, without opening the mail.
    const subject = `Security: admin account locked — ${maskEmail(alert.email)}`;
    const body = html(alert, when);

    /*
     * One mail per recipient, settled rather than raced.
     *
     * `sendEmail` takes a single address, and `Promise.all` would abandon the
     * remaining sends the moment one rejected — so a single stale address in
     * the list would stop the other super admin being told their portal is
     * under attack. Every recipient gets their own attempt.
     */
    const results = await Promise.allSettled(
      to.map((address) => sendEmail({ to: address, subject, html: body })),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      console.error(`[security-alert] ${failed}/${to.length} lockout notifications failed`);
    }
    // True if at least one person heard about it.
    return failed < to.length;
  } catch (err) {
    // Deliberately swallowed. See the note at the top: a mail failure must not
    // change the outcome of an authentication request.
    console.error(
      "[security-alert] could not send lockout notification:",
      err instanceof Error ? err.message : "unknown",
    );
    return false;
  }
}
