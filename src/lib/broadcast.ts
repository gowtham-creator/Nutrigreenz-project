import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  render,
  type NotifyType,
  type NotifyChannel,
  type TemplateVars,
} from "@/lib/notification-templates";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * Marketing broadcast: push a promotion / campaign / offer to every ONBOARDED
 * customer on the channels the admin chose. Best-effort per recipient — one
 * failure never aborts the run — and each channel no-ops until its provider
 * (Brevo / MSG91 / WhatsApp) is configured, so nothing is ever "sent" silently
 * to a dead channel. For a large base this should move to a queue; today it runs
 * inline over the (small) onboarded set.
 */

export interface BroadcastInput {
  /** Marketing message type: promotion | campaign | offer. */
  type: NotifyType;
  /** Channels to send on (admin/super-admin preference). */
  channels: NotifyChannel[];
  /** Copy variables: offerTitle, offerCode, discount, validTill, ctaUrl. */
  vars: TemplateVars;
}

export interface BroadcastResult {
  audience: number;
  email: { sent: number; skipped: number };
  sms: { sent: number; skipped: number };
  whatsapp: { sent: number; skipped: number };
}

export async function broadcastCampaign(input: BroadcastInput): Promise<BroadcastResult> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("customers")
    .select("primary_email, primary_phone")
    .is("merged_into", null);
  const rows =
    (data as Array<{ primary_email: string | null; primary_phone: string | null }> | null) ?? [];

  const res: BroadcastResult = {
    audience: rows.length,
    email: { sent: 0, skipped: 0 },
    sms: { sent: 0, skipped: 0 },
    whatsapp: { sent: 0, skipped: 0 },
  };
  const want = new Set(input.channels);

  for (const r of rows) {
    if (want.has("email")) {
      if (isEmailConfigured() && r.primary_email) {
        const m = render(input.type, "email", input.vars);
        try {
          await sendEmail({ to: r.primary_email, subject: m.subject ?? "", html: m.html ?? m.body });
          res.email.sent += 1;
        } catch {
          res.email.skipped += 1;
        }
      } else {
        res.email.skipped += 1;
      }
    }

    if (want.has("sms")) {
      if (r.primary_phone) {
        const out = await sendSms({ to: r.primary_phone, body: render(input.type, "sms", input.vars).body });
        if (out.ok) res.sms.sent += 1;
        else res.sms.skipped += 1;
      } else {
        res.sms.skipped += 1;
      }
    }

    if (want.has("whatsapp")) {
      if (r.primary_phone) {
        const out = await sendWhatsApp({
          to: r.primary_phone,
          body: render(input.type, "whatsapp", input.vars).body,
        });
        if (out.ok) res.whatsapp.sent += 1;
        else res.whatsapp.skipped += 1;
      } else {
        res.whatsapp.skipped += 1;
      }
    }
  }

  return res;
}
