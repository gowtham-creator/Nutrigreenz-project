import "server-only";

/**
 * WhatsApp Business messages via MSG91's WhatsApp API. BEST-EFFORT + env-gated:
 * until a WhatsApp Business number + approved Meta templates are configured (a
 * client setup — see docs/Notification-Templates.md), every send is a safe no-op.
 * Marketing WhatsApp must use an APPROVED template; free-form text only works
 * inside a 24h customer-service window.
 *
 * Env:
 *   MSG91_AUTH_KEY          — account auth key (secret, shared with SMS)
 *   MSG91_WHATSAPP_NUMBER   — the provisioned WhatsApp Business number (integrated)
 */

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_WHATSAPP_NUMBER);
}

export interface SendWhatsAppInput {
  /** E.164 recipient. */
  to: string;
  /** Approved Meta template name (required for marketing / out-of-session). */
  templateName?: string;
  /** Ordered template variables ({{1}}, {{2}}, …). */
  templateVars?: string[];
  /** Fallback free-text body (only delivers inside an open 24h session). */
  body?: string;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** Send one WhatsApp message. No-ops until a WhatsApp number is configured. */
export async function sendWhatsApp({
  to,
  templateName,
  templateVars,
  body,
}: SendWhatsAppInput): Promise<SendResult> {
  if (!isWhatsAppConfigured()) return { ok: false, skipped: true };
  const authkey = process.env.MSG91_AUTH_KEY as string;
  const from = process.env.MSG91_WHATSAPP_NUMBER as string;
  const number = to.replace(/[^\d]/g, "");
  try {
    const res = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey },
      body: JSON.stringify({
        integrated_number: from,
        recipient_number: number,
        content_type: templateName ? "template" : "text",
        ...(templateName
          ? { template: { name: templateName, language: "en", components: templateVars ?? [] } }
          : { text: body ?? "" }),
      }),
    });
    if (!res.ok) return { ok: false, error: `msg91-wa-${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
