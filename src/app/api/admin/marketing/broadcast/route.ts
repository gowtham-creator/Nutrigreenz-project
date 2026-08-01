import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { broadcastCampaign } from "@/lib/broadcast";
import { ConsentColumnsMissing } from "@/lib/marketing-audience";
import { logActivity } from "@/lib/activity-log";
import type { NotifyChannel, NotifyType } from "@/lib/notification-templates";

export const runtime = "nodejs";
// A send can outlast the default budget once the audience grows.
export const maxDuration = 300;

const MARKETING_TYPES: NotifyType[] = ["promotion", "campaign", "offer"];
// WhatsApp is not offered: it needs an approved Meta template per message and
// its own consent basis. A toggle that silently no-ops invites someone to tick
// it and believe the campaign went out.
const CHANNELS: NotifyChannel[] = ["email", "sms"];

/** The signed-in super-admin's email, or null. */
async function superAdminEmail(): Promise<string | null> {
  const session = await verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
  return session && session.role === "superadmin" ? session.email : null;
}

/**
 * POST /api/admin/marketing/broadcast — super-admin only.
 *
 * Sends a promotion / campaign / offer to customers who have not opted out, on
 * the channels each of them can actually receive. Body:
 * `{ type, channels[], vars, campaignKey }`.
 *
 * `campaignKey` (normally the coupon code) scopes deduplication: a delivered
 * recipient is never messaged twice for the same campaign, so a retry after a
 * partial failure resumes rather than re-blasting the people who already got it.
 */
export async function POST(request: Request): Promise<Response> {
  const actor = await superAdminEmail();
  if (!actor) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const type = String(body.type ?? "") as NotifyType;
  if (!MARKETING_TYPES.includes(type)) {
    return Response.json({ ok: false, error: "invalid-type" }, { status: 400 });
  }
  const channels = (Array.isArray(body.channels) ? body.channels : [])
    .map(String)
    .filter((c): c is NotifyChannel => CHANNELS.includes(c as NotifyChannel));
  if (channels.length === 0) {
    return Response.json({ ok: false, error: "no-channels" }, { status: 400 });
  }
  const vars = typeof body.vars === "object" && body.vars ? (body.vars as Record<string, string>) : {};

  // Without a campaign key there is nothing to deduplicate against, so every
  // press of the button would message everyone again. Required, not defaulted.
  const campaignKey = String(body.campaignKey ?? "").trim().toUpperCase();
  if (!campaignKey) {
    return Response.json({ ok: false, error: "campaign-key-required" }, { status: 400 });
  }

  let result;
  try {
    result = await broadcastCampaign({ type, channels, vars, campaignKey });
  } catch (err) {
    if (err instanceof ConsentColumnsMissing) {
      // Fail loudly. Without the consent columns every customer looks like
      // consent, and the failure mode of guessing is messaging the whole base.
      return Response.json(
        { ok: false, error: "consent-not-configured" },
        { status: 503 },
      );
    }
    return Response.json({ ok: false, error: "send-failed" }, { status: 500 });
  }

  await logActivity({
    actorEmail: actor,
    actorRole: "superadmin",
    action: "marketing.broadcast",
    target: campaignKey,
    meta: {
      type,
      channels,
      audience: result.audience,
      emailSent: result.email.sent,
      smsSent: result.sms.sent,
      emailFailed: result.email.failed,
      smsFailed: result.sms.failed,
      blocked: [result.email.blocked, result.sms.blocked].filter(Boolean),
    },
  });

  return Response.json({ ok: true, result });
}
