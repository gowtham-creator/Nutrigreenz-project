import { requireSuperAdmin, superAdminEmail } from "../guard";
import { logActivity } from "@/lib/activity-log";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { couponEndInstant, isCouponDay } from "@/lib/coupon-dates";
import {
  FREQUENCIES,
  listSchedules,
  offlineAudience,
  smsBlocked,
  startCampaign,
  type Frequency,
} from "@/lib/offline-campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A first run messages the whole offline audience one SMS at a time.
export const maxDuration = 300;

/**
 * SMS campaigns to offline (stall) customers.
 *
 *   GET  ?captainId=&community=  → the schedules, plus how many people the
 *        chosen filter reaches and whether SMS can go out at all.
 *   POST { campaignKey, vars, audience, frequency, endsOn } → send the first run
 *        now and repeat on schedule until endsOn (an IST day).
 *
 * Super-admin only, like the online campaign sender beside it.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });

  const url = new URL(request.url);
  const filter = {
    captainId: url.searchParams.get("captainId")?.trim() || null,
    community: url.searchParams.get("community")?.trim() || null,
  };
  try {
    const [schedules, audience] = await Promise.all([listSchedules(), offlineAudience(filter)]);
    return Response.json(
      { ok: true, schedules, audience: audience.length, blocked: smsBlocked() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/does not exist|42P01|schema cache|Could not find the table/i.test(message)) {
      return Response.json({ ok: false, error: "setup-pending" }, { status: 503 });
    }
    console.error("[offline-campaign] read failed:", err);
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const campaignKey = text(body.campaignKey, 40).toUpperCase();
  const frequency = text(body.frequency, 20) as Frequency;
  if (!campaignKey) return Response.json({ ok: false, error: "campaign-key-required" }, { status: 400 });
  if (!FREQUENCIES.includes(frequency)) return Response.json({ ok: false, error: "invalid-frequency" }, { status: 400 });
  const endsOn = text(body.endsOn, 10);
  if (frequency !== "once" && !isCouponDay(endsOn)) {
    return Response.json({ ok: false, error: "end-date-required" }, { status: 400 });
  }

  // Sending with nothing able to send would record a campaign that never went out.
  const blocked = smsBlocked();
  if (blocked) return Response.json({ ok: false, error: blocked }, { status: 409 });

  const rawVars = typeof body.vars === "object" && body.vars ? (body.vars as Record<string, unknown>) : {};
  const vars = Object.fromEntries(
    ["offerCode", "offerTitle", "discount", "validTill", "ctaUrl"].map((k) => [k, text(rawVars[k], 160)]),
  );
  const rawAudience = typeof body.audience === "object" && body.audience ? (body.audience as Record<string, unknown>) : {};
  const audience = {
    captainId: text(rawAudience.captainId, 64) || null,
    community: text(rawAudience.community, 200) || null,
  };

  try {
    const actor = await superAdminEmail();
    const { schedule, result } = await startCampaign({
      campaignKey,
      vars,
      audience,
      frequency,
      endsAt: isCouponDay(endsOn) ? couponEndInstant(endsOn) : null,
      byEmail: actor,
    });
    await logActivity({
      actorEmail: actor,
      actorRole: "superadmin",
      action: "campaign.offline_start",
      target: campaignKey,
      meta: { frequency, audience, sent: result.sent, failed: result.failed },
    });
    return Response.json({ ok: true, schedule, result });
  } catch (err) {
    console.error("[offline-campaign] start failed:", err);
    return Response.json({ ok: false, error: "send-failed" }, { status: 500 });
  }
}
