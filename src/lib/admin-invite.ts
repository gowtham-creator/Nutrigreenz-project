import "server-only";
import { createAdminResetToken } from "@/lib/admin-password-reset";
import { isEmailConfigured, sendEmail } from "@/lib/email";

/**
 * Operator invitations — a one-time setup LINK, never a password.
 *
 * ── What this replaces ────────────────────────────────────────────────────
 *
 * The portal used to generate (or let a super admin type) a temporary password,
 * store it, email it in plaintext, and hand it back in the API response so the
 * UI could display it. A penetration test raised three separate findings
 * against that one design:
 *
 *   · the temp password was shown to the SUPER ADMIN in the resend dialog,
 *     disclosing another person's credential to someone with no need for it;
 *   · it was emailed in plaintext, stayed valid indefinitely, and could be
 *     reused for every subsequent sign-in rather than being consumed;
 *   · a super admin could set another operator's password by hand.
 *
 * They share a root cause: somebody other than the account holder knew the
 * credential. No amount of shortening the password's life fixes that, so the
 * password is removed from the flow entirely.
 *
 * ── How it works now ──────────────────────────────────────────────────────
 *
 * The account is created with NO passcode hash, which `verifyAdminLogin`
 * already refuses to sign in. The invited person receives a signed, single-use,
 * time-limited link and chooses their own password on arrival. Nothing secret
 * is displayed, returned, or stored in a mailbox — and the invite is worthless
 * the moment it is used or expires.
 *
 * This reuses the existing `/admin/reset` machinery rather than adding a
 * parallel one: the token is already HMAC-signed, persisted for single use, and
 * consumed by a route that sets the password and clears
 * `must_change_password`. An invite is a password reset for an account that
 * never had one, so the two are the same operation.
 */

/**
 * Invites live longer than resets.
 *
 * A reset is 30 minutes because the person requesting it is sitting at the
 * screen waiting. An invite is sent to somebody who may be asleep, off-shift,
 * or not expecting it, and an expired invite means a support round-trip. Two
 * days is long enough to be practical and short enough that a forgotten
 * mailbox is not a standing way in.
 */
export const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";

function inviteEmailHtml(name: string, link: string, isNew: boolean): string {
  const heading = isNew ? "You've been given admin access" : "Set a new admin password";
  const lead = isNew
    ? "An operator account has been created for you on the Nutri Greenz portal. Choose your password to activate it."
    : "A new setup link was requested for your Nutri Greenz operator account. Choose your password to continue.";
  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#14331f">
    <div style="font-size:20px;font-weight:700;color:#14532d;margin-bottom:6px">${heading}</div>
    <p style="font-size:14px;color:#5b6b60;line-height:1.6">${name ? `Hi ${name}, ` : ""}${lead}</p>
    <div style="margin:26px 0">
      <a href="${link}" style="display:inline-block;background:#14532d;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px">Choose your password</a>
    </div>
    <p style="font-size:12px;color:#5b6b60;line-height:1.6">
      This link expires in 48 hours and can be used only once. Nobody at Nutri Greenz
      knows or can see your password, including the administrator who invited you.
      If you weren't expecting this, ignore this email — nothing changes.
    </p>
    <p style="font-size:11px;color:#8a988e;word-break:break-all;line-height:1.5">
      Or paste this link into your browser:<br>${link}
    </p>
  </div>`;
}

export interface InviteResult {
  /** Channels the invite reached. */
  sent: string[];
  /** Channels that could not be delivered — the caller reports these. */
  pending: string[];
  /**
   * The setup link, returned ONLY when email is unconfigured.
   *
   * Without it a local or misconfigured deployment could create operators that
   * nobody can ever sign in as, with no way to recover. It is a fallback for an
   * environment with no mail transport, never part of the normal path — and it
   * is a single-use link rather than a password, so it cannot be replayed.
   */
  link?: string;
}

/**
 * Mint a one-time setup link for `email` and send it. Never throws, and never
 * returns anything secret when email is working.
 */
export async function sendAdminInvite(
  email: string,
  name: string,
  opts: { isNew: boolean } = { isNew: true },
): Promise<InviteResult> {
  const token = await createAdminResetToken(email, INVITE_TOKEN_TTL_MS);
  if (!token) {
    // Fail closed and say so: the caller surfaces this as "pending" rather than
    // pretending an invite went out.
    return { sent: [], pending: ["email"] };
  }

  const link = `${SITE}/admin/reset?token=${encodeURIComponent(token)}`;

  if (!isEmailConfigured()) return { sent: [], pending: ["email"], link };

  try {
    await sendEmail({
      to: email,
      subject: opts.isNew ? "Your Nutri Greenz admin access" : "Set your Nutri Greenz password",
      html: inviteEmailHtml(name, link, opts.isNew),
    });
    return { sent: ["email"], pending: [] };
  } catch {
    return { sent: [], pending: ["email"] };
  }
}
