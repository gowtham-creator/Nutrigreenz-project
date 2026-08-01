import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  render,
  type NotifyType,
  type NotifyChannel,
  type TemplateVars,
} from "@/lib/notification-templates";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { sendSms, isSmsConfigured } from "@/lib/sms";
import { marketingAudience, type Recipient } from "@/lib/marketing-audience";

/**
 * Send a campaign to customers on the channels each of them allows.
 *
 * What changed, and why it mattered:
 *
 * - It sent to every customer row with no consent check and no unsubscribe.
 *   Audience now comes from {@link marketingAudience}, which drops opted-out
 *   channels and refuses outright if the consent columns are missing.
 * - Pressing send twice sent twice. Every delivery is now written to
 *   `campaign_sends` under a unique index, and an already-sent recipient is
 *   skipped, so a retry after a partial failure resumes instead of re-blasting.
 * - Nothing recorded what went out. Each attempt is now logged with its channel,
 *   destination and outcome.
 * - WhatsApp is no longer offered here. It shares the promotional-consent
 *   problem with SMS and needs an approved Meta template per message; keeping a
 *   dead toggle in the UI invited someone to tick it and believe it sent.
 *
 * Still inline over the audience. That is fine at this base size and wrong at
 * scale — see the note on BATCH below.
 */

/** Sent in slices so one slow provider call cannot stall the whole run. */
const BATCH = 25;

export interface BroadcastInput {
  type: NotifyType;
  channels: NotifyChannel[];
  vars: TemplateVars;
  /**
   * Campaign identity — usually the coupon code. Deduplication is scoped to
   * this key, so re-sending "the same campaign" is a no-op while a genuinely
   * new campaign reaches everyone again.
   */
  campaignKey: string;
}

export interface ChannelResult {
  sent: number;
  /** Eligible, but not messaged — no address, opted out, or already sent. */
  skipped: number;
  failed: number;
  /** Set when the channel could not run at all (provider or compliance gate). */
  blocked?: string;
}

export interface BroadcastResult {
  audience: number;
  email: ChannelResult;
  sms: ChannelResult;
}

const empty = (): ChannelResult => ({ sent: 0, skipped: 0, failed: 0 });

/**
 * Promotional SMS in India needs a DLT-registered PROMOTIONAL template.
 *
 * The transactional template used for OTPs must not carry campaign copy: it is
 * a TRAI violation and gets the sender header blocked, which would also take
 * down OTP login. So campaign SMS refuses to run until a promotional template
 * id is configured, rather than quietly borrowing the transactional one.
 */
function promoTemplateId(): string | null {
  return process.env.MSG91_PROMO_TEMPLATE_ID?.trim() || null;
}

/** Recipients already delivered to for this campaign, per channel. */
async function alreadySent(campaignKey: string): Promise<Map<string, Set<string>>> {
  const seen = new Map<string, Set<string>>();
  const { data } = await supabaseAdmin()
    .from("campaign_sends")
    .select("customer_id, channel")
    .eq("campaign_key", campaignKey)
    .eq("status", "sent");
  for (const r of (data ?? []) as { customer_id: string; channel: string }[]) {
    const bucket = seen.get(r.customer_id) ?? new Set<string>();
    bucket.add(r.channel);
    seen.set(r.customer_id, bucket);
  }
  return seen;
}

interface SendLog {
  campaign_key: string;
  customer_id: string;
  channel: string;
  destination: string;
  status: "sent" | "failed";
  error?: string | null;
}

/**
 * Record the run.
 *
 * Best-effort and last: the messages have already left, so a logging failure
 * must not surface as a send failure. It costs idempotency on the next retry,
 * which is the lesser harm.
 */
async function writeLog(rows: SendLog[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    await supabaseAdmin().from("campaign_sends").insert(rows);
  } catch {
    /* ignore — see above */
  }
}

function unsubscribeUrl(token: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";
  return `${site.replace(/\/$/, "")}/unsubscribe?t=${encodeURIComponent(token)}`;
}

/**
 * Append the unsubscribe footer.
 *
 * Not optional and not configurable: a marketing email without a working
 * opt-out is the thing the consent columns exist to prevent, and the
 * storefront's own privacy policy promises one.
 */
function withUnsubscribe(html: string, token: string): string {
  const url = unsubscribeUrl(token);
  return `${html}
<div style="margin:24px auto 0;max-width:600px;padding:16px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.6;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;">
  You are receiving this because you shop with Nutri Greenz.
  <a href="${url}" style="color:#1f4d2e;text-decoration:underline;">Unsubscribe</a> from offers.
</div>`;
}

export async function broadcastCampaign(input: BroadcastInput): Promise<BroadcastResult> {
  const want = new Set(input.channels);
  const res: BroadcastResult = { audience: 0, email: empty(), sms: empty() };

  // Throws ConsentColumnsMissing when the migration has not run — the caller
  // turns that into an explicit error rather than an empty, silent success.
  const audience: Recipient[] = await marketingAudience();
  res.audience = audience.length;
  if (audience.length === 0) return res;

  const wantEmail = want.has("email");
  const wantSms = want.has("sms");

  if (wantEmail && !isEmailConfigured()) res.email.blocked = "email-provider-not-configured";
  if (wantSms && !isSmsConfigured()) res.sms.blocked = "sms-provider-not-configured";
  else if (wantSms && !promoTemplateId()) res.sms.blocked = "no-promotional-dlt-template";

  const canEmail = wantEmail && !res.email.blocked;
  const canSms = wantSms && !res.sms.blocked;
  if (!canEmail && !canSms) return res;

  const sent = await alreadySent(input.campaignKey);
  const log: SendLog[] = [];

  for (let i = 0; i < audience.length; i += BATCH) {
    const slice = audience.slice(i, i + BATCH);

    await Promise.all(
      slice.map(async (r) => {
        const done = sent.get(r.customerId);

        if (canEmail) {
          if (!r.email || done?.has("email")) {
            res.email.skipped += 1;
          } else {
            const m = render(input.type, "email", { ...input.vars, customerName: r.name ?? "" });
            try {
              await sendEmail({
                to: r.email,
                subject: m.subject ?? "",
                html: withUnsubscribe(m.html ?? m.body, r.unsubscribeToken),
              });
              res.email.sent += 1;
              log.push({
                campaign_key: input.campaignKey,
                customer_id: r.customerId,
                channel: "email",
                destination: r.email,
                status: "sent",
              });
            } catch (err) {
              res.email.failed += 1;
              log.push({
                campaign_key: input.campaignKey,
                customer_id: r.customerId,
                channel: "email",
                destination: r.email,
                status: "failed",
                error: err instanceof Error ? err.message.slice(0, 300) : "send-failed",
              });
            }
          }
        }

        if (canSms) {
          if (!r.phone || done?.has("sms")) {
            res.sms.skipped += 1;
          } else {
            const body = render(input.type, "sms", { ...input.vars, customerName: r.name ?? "" }).body;
            const out = await sendSms({
              to: r.phone,
              body,
              // Always the promotional template — never the transactional one.
              templateId: promoTemplateId() ?? undefined,
            });
            if (out.ok) {
              res.sms.sent += 1;
              log.push({
                campaign_key: input.campaignKey,
                customer_id: r.customerId,
                channel: "sms",
                destination: r.phone,
                status: "sent",
              });
            } else {
              res.sms.failed += 1;
              log.push({
                campaign_key: input.campaignKey,
                customer_id: r.customerId,
                channel: "sms",
                destination: r.phone,
                status: "failed",
                error: out.error ?? "sms-failed",
              });
            }
          }
        }
      }),
    );
  }

  await writeLog(log);
  return res;
}
