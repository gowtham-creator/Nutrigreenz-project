/**
 * SMS campaigns to offline customers: people who bought at a captain's stall or
 * were registered as a captain's customer. They are known only by mobile.
 *
 * A campaign can go out once or repeat every week, fortnight or month until its
 * end date, so a stall customer keeps hearing about the offer. Each run has its
 * own key (code@IST day): a repeat reaches everyone again, a retried run never
 * messages anyone twice.
 *
 * Who is never messaged: numbers on the do-not-message list, and anyone whose
 * online account has opted out of SMS. Promotional SMS must use the DLT
 * promotional template, so nothing goes out until that is configured.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeMobile10 } from "@/lib/captains";
import { render, type TemplateVars } from "@/lib/notification-templates";
import { sendSms, isSmsConfigured } from "@/lib/sms";
import { promoTemplateId } from "@/lib/broadcast";
import { istDay } from "@/lib/order-periods";

export type Frequency = "once" | "weekly" | "fortnightly" | "monthly";
export const FREQUENCIES: readonly Frequency[] = ["once", "weekly", "fortnightly", "monthly"];

export interface AudienceFilter {
  captainId?: string | null;
  community?: string | null;
}

export interface OfflineContact {
  mobile: string;
  name: string | null;
}

export interface RunResult {
  audience: number;
  sent: number;
  skipped: number;
  failed: number;
  blocked?: "sms-provider-not-configured" | "no-promotional-dlt-template";
}

export interface Schedule {
  id: string;
  campaignKey: string;
  audience: AudienceFilter;
  vars: TemplateVars;
  frequency: Frequency;
  nextRunAt: string;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastResult: RunResult | null;
}

const SCHEDULE_COLS =
  "id, campaign_key, audience, vars, frequency, next_run_at, ends_at, active, created_at, last_run_at, last_result";

interface ScheduleRow {
  id: string;
  campaign_key: string;
  audience: AudienceFilter | null;
  vars: TemplateVars | null;
  frequency: Frequency;
  next_run_at: string;
  ends_at: string | null;
  active: boolean;
  created_at: string;
  last_run_at: string | null;
  last_result: RunResult | null;
}

function toSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    campaignKey: r.campaign_key,
    audience: r.audience ?? {},
    vars: r.vars ?? {},
    frequency: r.frequency,
    nextRunAt: r.next_run_at,
    endsAt: r.ends_at,
    active: r.active,
    createdAt: r.created_at,
    lastRunAt: r.last_run_at,
    lastResult: r.last_result,
  };
}

/** The next send after `from`, or null for a one-off. Months keep the day of the month. */
export function nextRun(from: Date, frequency: Frequency): Date | null {
  if (frequency === "once") return null;
  if (frequency === "monthly") {
    const d = new Date(from);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  return new Date(from.getTime() + (frequency === "weekly" ? 7 : 14) * 86_400_000);
}

/** Why SMS can't go out right now, or null when it can. */
export function smsBlocked(): RunResult["blocked"] | null {
  if (!isSmsConfigured()) return "sms-provider-not-configured";
  if (!promoTemplateId()) return "no-promotional-dlt-template";
  return null;
}

/**
 * Pick the audience out of the raw rows. Pure. One entry per mobile, the first
 * name seen, filtered to a captain or a community, with everyone who asked not
 * to be messaged left out.
 */
export function selectAudience(
  sales: { captain_id: string; customer_mobile: string; customer_name: string | null; community: string | null }[],
  intros: { captain_id: string; mobile: string; name: string | null }[],
  blocked: Set<string>,
  filter: AudienceFilter,
): OfflineContact[] {
  const out = new Map<string, OfflineContact>();
  const add = (mobile: string | null, name: string | null) => {
    if (!mobile || blocked.has(mobile)) return;
    const seen = out.get(mobile);
    if (!seen) out.set(mobile, { mobile, name: name?.trim() || null });
    else if (!seen.name && name?.trim()) seen.name = name.trim();
  };
  const community = filter.community?.trim().toLowerCase() || null;
  for (const s of sales) {
    if (filter.captainId && s.captain_id !== filter.captainId) continue;
    if (community && (s.community ?? "").trim().toLowerCase() !== community) continue;
    add(normalizeMobile10(s.customer_mobile), s.customer_name);
  }
  // A registration carries no community, so it only joins an all-community send.
  if (!community) {
    for (const i of intros) {
      if (filter.captainId && i.captain_id !== filter.captainId) continue;
      add(normalizeMobile10(i.mobile), i.name);
    }
  }
  return [...out.values()];
}

const MISSING_TABLE = /does not exist|42P01|schema cache|Could not find the table/i;

/** Every offline customer the filter reaches, minus anyone who opted out. */
export async function offlineAudience(filter: AudienceFilter): Promise<OfflineContact[]> {
  const db = supabaseAdmin();
  const [sales, intros, optouts, smsOptOuts] = await Promise.all([
    db.from("captain_captures").select("captain_id, customer_mobile, customer_name, community").limit(20_000),
    db.from("captain_customer_intros").select("captain_id, mobile, name").limit(20_000),
    db.from("offline_contact_optouts").select("mobile").limit(20_000),
    db.from("customers").select("primary_phone").eq("marketing_sms_opt_out", true).limit(20_000),
  ]);
  if (sales.error) throw new Error(sales.error.message);
  if (optouts.error) throw new Error(optouts.error.message);
  if (intros.error && !MISSING_TABLE.test(intros.error.message)) throw new Error(intros.error.message);
  if (smsOptOuts.error) throw new Error(smsOptOuts.error.message);

  const blocked = new Set<string>();
  for (const r of (optouts.data as { mobile: string }[] | null) ?? []) blocked.add(r.mobile);
  for (const r of (smsOptOuts.data as { primary_phone: string | null }[] | null) ?? []) {
    const ten = normalizeMobile10(r.primary_phone);
    if (ten) blocked.add(ten);
  }
  return selectAudience(
    (sales.data as Parameters<typeof selectAudience>[0] | null) ?? [],
    intros.error ? [] : ((intros.data as Parameters<typeof selectAudience>[1] | null) ?? []),
    blocked,
    filter,
  );
}

/** Send one run of a campaign. Safe to retry: a number already sent this run is skipped. */
export async function runCampaign(input: {
  campaignKey: string;
  runKey: string;
  vars: TemplateVars;
  audience: AudienceFilter;
}): Promise<RunResult> {
  const blocked = smsBlocked();
  const contacts = await offlineAudience(input.audience);
  const res: RunResult = { audience: contacts.length, sent: 0, skipped: 0, failed: 0 };
  if (blocked) return { ...res, blocked };

  const db = supabaseAdmin();
  const { data: done, error } = await db
    .from("offline_campaign_sends")
    .select("mobile")
    .eq("run_key", input.runKey)
    .eq("status", "sent");
  if (error) throw new Error(error.message);
  const already = new Set(((done as { mobile: string }[] | null) ?? []).map((r) => r.mobile));

  const template = promoTemplateId() ?? undefined;
  for (const c of contacts) {
    if (already.has(c.mobile)) {
      res.skipped += 1;
      continue;
    }
    const body = render("offer", "sms", { ...input.vars, customerName: c.name ?? "" }).body;
    // Always the promotional template — never the transactional one used for OTPs.
    const out = await sendSms({ to: `91${c.mobile}`, body, templateId: template });
    const row = {
      campaign_key: input.campaignKey,
      run_key: input.runKey,
      mobile: c.mobile,
      status: out.ok ? "sent" : "failed",
      error: out.ok ? null : out.error ?? "sms-failed",
    };
    if (out.ok) res.sent += 1;
    else res.failed += 1;
    const { error: logError } = await db.from("offline_campaign_sends").insert(row);
    if (logError) console.error(`[offline-campaigns] send log failed for ${input.runKey}: ${logError.message}`);
  }
  return res;
}

/** Start a campaign. The first run goes out now; repeats follow on schedule. */
export async function startCampaign(input: {
  campaignKey: string;
  vars: TemplateVars;
  audience: AudienceFilter;
  frequency: Frequency;
  endsAt: string | null;
  byEmail: string;
  now?: Date;
}): Promise<{ schedule: Schedule; result: RunResult }> {
  const now = input.now ?? new Date();
  const result = await runCampaign({
    campaignKey: input.campaignKey,
    runKey: `${input.campaignKey}@${istDay(now.getTime())}`,
    vars: input.vars,
    audience: input.audience,
  });
  const next = nextRun(now, input.frequency);
  const ends = input.endsAt ? Date.parse(input.endsAt) : null;
  const active = Boolean(next && (ends === null || next.getTime() <= ends));
  const { data, error } = await supabaseAdmin()
    .from("campaign_schedules")
    .insert({
      campaign_key: input.campaignKey,
      audience: input.audience,
      vars: input.vars,
      frequency: input.frequency,
      next_run_at: (next ?? now).toISOString(),
      ends_at: input.endsAt,
      active,
      created_by: input.byEmail,
      last_run_at: now.toISOString(),
      last_result: result,
    })
    .select(SCHEDULE_COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "schedule-failed");
  return { schedule: toSchedule(data as ScheduleRow), result };
}

export async function listSchedules(): Promise<Schedule[]> {
  const { data, error } = await supabaseAdmin()
    .from("campaign_schedules")
    .select(SCHEDULE_COLS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (MISSING_TABLE.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data as ScheduleRow[] | null) ?? []).map(toSchedule);
}

export async function stopSchedule(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("campaign_schedules")
    .update({ active: false })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}

/**
 * Send every repeat that is due. Called by the daily cron. A schedule is moved on
 * BEFORE it sends, so an overlapping cron call cannot send the same run twice;
 * the run key makes a retry of a half-finished run skip whoever already got it.
 */
export async function runDueSchedules(now: Date = new Date()): Promise<{ ran: number; results: RunResult[] }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("campaign_schedules")
    .select(SCHEDULE_COLS)
    .eq("active", true)
    .lte("next_run_at", now.toISOString());
  if (error) {
    if (MISSING_TABLE.test(error.message)) return { ran: 0, results: [] };
    throw new Error(error.message);
  }
  const results: RunResult[] = [];
  for (const s of ((data as ScheduleRow[] | null) ?? []).map(toSchedule)) {
    const ends = s.endsAt ? Date.parse(s.endsAt) : null;
    if (ends !== null && now.getTime() > ends) {
      await db.from("campaign_schedules").update({ active: false }).eq("id", s.id);
      continue;
    }
    const next = nextRun(new Date(s.nextRunAt), s.frequency);
    const stillOn = Boolean(next && (ends === null || next.getTime() <= ends));
    const { data: claimed } = await db
      .from("campaign_schedules")
      .update({ next_run_at: (next ?? now).toISOString(), active: stillOn, last_run_at: now.toISOString() })
      .eq("id", s.id)
      .eq("next_run_at", s.nextRunAt)
      .select("id");
    if (!claimed || (claimed as unknown[]).length === 0) continue;

    const result = await runCampaign({
      campaignKey: s.campaignKey,
      runKey: `${s.campaignKey}@${istDay(now.getTime())}`,
      vars: s.vars,
      audience: s.audience,
    });
    await db.from("campaign_schedules").update({ last_result: result }).eq("id", s.id);
    results.push(result);
  }
  return { ran: results.length, results };
}

/** Put a number on the do-not-message list. */
export async function optOutMobile(raw: string, byEmail: string): Promise<boolean> {
  const mobile = normalizeMobile10(raw);
  if (!mobile) return false;
  const { error } = await supabaseAdmin()
    .from("offline_contact_optouts")
    .upsert({ mobile, created_by: byEmail }, { onConflict: "mobile", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return true;
}
