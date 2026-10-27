/**
 * The Orders portal's periods (today, this week, this month) as IST calendar
 * windows. Pure and dependency-free so the server summary and the browser's
 * list filter cut the day at the same instant: midnight in India, not UTC.
 * Weeks start on Monday.
 */

export type SummaryPeriod = "today" | "week" | "month";
export const SUMMARY_PERIODS: readonly SummaryPeriod[] = ["today", "week", "month"];

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;

/** The IST calendar date of an instant, as YYYY-MM-DD. */
export function istDay(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant 00:00 IST begins on a YYYY-MM-DD day. */
function istMidnight(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS;
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** First day of the month `n` months away from the month `day` falls in. */
function monthStart(day: string, n = 0): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7)) - 1 + n;
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

export interface PeriodWindow {
  key: SummaryPeriod;
  /** Start, inclusive (ISO). */
  from: string;
  /** End, exclusive: the start of the next period (ISO). */
  to: string;
  /** The same period one step back, inclusive start / exclusive end. */
  previousFrom: string;
  previousTo: string;
  /** IST days from the period's first day through today, for the daily chart. */
  days: string[];
}

/**
 * The today / this week / this month windows around `now`, in IST.
 * Pure, so the boundaries can be tested without a database.
 */
export function periodWindows(now: Date): Record<SummaryPeriod, PeriodWindow> {
  const nowMs = now.getTime();
  const today = istDay(nowMs);
  const iso = (ms: number) => new Date(ms).toISOString();
  const daysFrom = (first: string) => {
    const out: string[] = [];
    for (let d = first; d <= today && out.length < 32; d = addDays(d, 1)) out.push(d);
    return out;
  };

  const dayFrom = istMidnight(today);

  // getUTCDay on the IST date: 0 = Sunday. Weeks start on Monday.
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((dow + 6) % 7));
  const weekFrom = istMidnight(monday);

  const first = monthStart(today);
  const monthFrom = istMidnight(first);

  return {
    today: {
      key: "today",
      from: iso(dayFrom),
      to: iso(dayFrom + DAY_MS),
      previousFrom: iso(dayFrom - DAY_MS),
      previousTo: iso(dayFrom),
      days: [today],
    },
    week: {
      key: "week",
      from: iso(weekFrom),
      to: iso(weekFrom + 7 * DAY_MS),
      previousFrom: iso(weekFrom - 7 * DAY_MS),
      previousTo: iso(weekFrom),
      days: daysFrom(monday),
    },
    month: {
      key: "month",
      from: iso(monthFrom),
      to: iso(istMidnight(monthStart(today, 1))),
      previousFrom: iso(istMidnight(monthStart(today, -1))),
      previousTo: iso(monthFrom),
      days: daysFrom(first),
    },
  };
}

/** How the portal names each period's comparison ("vs 4 by this time yesterday"). */
export const PERIOD_COMPARISON: Record<SummaryPeriod, string> = {
  today: "by this time yesterday",
  week: "at this point last week",
  month: "at this point last month",
};

export const PERIOD_LABEL: Record<SummaryPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
};

const IST = "Asia/Kolkata";

/** "Tue, 27 Oct" · "26 Oct – 1 Nov" · "October 2026", in IST. */
export function periodRangeLabel(w: Pick<PeriodWindow, "key" | "from" | "to">): string {
  const from = new Date(w.from);
  if (w.key === "today") {
    return from.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST });
  }
  if (w.key === "month") {
    return from.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: IST });
  }
  const last = new Date(Date.parse(w.to) - DAY_MS);
  const short = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
  return `${short(from)} – ${short(last)}`;
}
