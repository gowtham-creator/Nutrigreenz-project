import "server-only";
import { msg91AuthKey } from "@/lib/msg91";

/**
 * Transactional SMS via MSG91. BEST-EFFORT + env-gated: until the MSG91 auth key,
 * sender ID and DLT templates are configured (DLT registration is a client
 * blocker — see docs/Notification-Templates.md), every send is a safe no-op that
 * never throws into the caller. Once the env vars are set it starts delivering
 * with zero code change.
 *
 * Env:
 *   MSG91_AUTH_KEY    — account auth key (secret; legacy MSG91_AUTHKEY also accepted)
 *   MSG91_SENDER_ID   — the DLT-registered 6-char header (e.g. NUTGRZ)
 *   MSG91_SMS_ROUTE   — optional, defaults to the transactional route
 */

export function isSmsConfigured(): boolean {
  return Boolean(msg91AuthKey() && process.env.MSG91_SENDER_ID);
}

export interface SendSmsInput {
  /** E.164 recipient, e.g. +9198XXXXXXXX. */
  to: string;
  /** The message body (must match a DLT-registered template once live). */
  body: string;
  /** The DLT/MSG91 template (flow) id for this message, when registered. */
  templateId?: string;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** Send one SMS. No-ops (ok:false, skipped) until MSG91 is configured. */
export async function sendSms({ to, body, templateId }: SendSmsInput): Promise<SendResult> {
  if (!isSmsConfigured()) return { ok: false, skipped: true };
  const authkey = msg91AuthKey() as string;
  const sender = process.env.MSG91_SENDER_ID as string;
  const number = to.replace(/[^\d]/g, ""); // MSG91 wants digits with country code
  try {
    // MSG91 v5 flow API (template-based, DLT-compliant). `templateId` is the
    // MSG91 flow id mapped to the DLT content template.
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey },
      body: JSON.stringify({
        template_id: templateId ?? process.env.MSG91_DEFAULT_TEMPLATE_ID,
        sender,
        short_url: "0",
        recipients: [{ mobiles: number, body }],
      }),
    });
    if (!res.ok) return { ok: false, error: `msg91-${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
