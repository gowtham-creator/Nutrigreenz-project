/**
 * A coupon's validity window, chosen as IST calendar days and stored as instants.
 *
 * `<input type=date>` gives a bare "2026-11-05". Handed to Postgres as it stands
 * that is midnight UTC, which is 5:30 AM in India, so a coupon died at 5:30 on
 * the morning of its last day and a start date opened five and a half hours
 * late. The operator means a day in India: the window opens at 00:00:00 IST on
 * the first day and closes at 23:59:59.999 IST on the last.
 *
 * The same offset works against us reading back. Midnight IST is 18:30 UTC the
 * evening before, so `.slice(0, 10)` on a stored start shows the previous day,
 * and saving that form moves the coupon back a day on every edit. Always go
 * through {@link couponDay}.
 *
 * Pure and dependency-free apart from the IST day helper, so the two admin forms
 * and the API routes judge a date the same way.
 */
import { istDay } from "@/lib/order-periods";

const IST = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
const LAST_MS_OF_DAY = DAY_MS - 1;

/** A real calendar day as YYYY-MM-DD. "2026-02-31" is not one. */
export function isCouponDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  // Date.UTC rolls an impossible day into the next month, so the round trip
  // exposes it where Date.parse would quietly accept it.
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

/** The instant 00:00:00.000 IST begins on a YYYY-MM-DD day. */
function istDayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS;
}

/** The first instant of an IST day, as ISO. */
export function couponStartInstant(day: string): string {
  return new Date(istDayStartMs(day)).toISOString();
}

/** The last millisecond of an IST day, as ISO. */
export function couponEndInstant(day: string): string {
  return new Date(istDayStartMs(day) + LAST_MS_OF_DAY).toISOString();
}

/** The IST day of a stored instant as YYYY-MM-DD, or "" when there is none. */
export function couponDay(instant: string | null | undefined): string {
  if (!instant) return "";
  const ms = Date.parse(instant);
  return Number.isFinite(ms) ? istDay(ms) : "";
}

/** "5 Nov", or "5 Nov 2026" with `year`, for a YYYY-MM-DD day. */
export function couponDayLabel(day: string, opts: { year?: boolean } = {}): string {
  if (!isCouponDay(day)) return "";
  return new Date(istDayStartMs(day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(opts.year ? { year: "numeric" as const } : {}),
    timeZone: IST,
  });
}

/**
 * "1 Nov – 30 Nov".
 *
 * Coupons made before dates were required can have either bound missing, and
 * the list must still say something true about them. The year appears only when
 * the window crosses one, where the short form would read backwards.
 */
export function couponValidityLabel(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): string {
  const start = couponDay(startsAt);
  const end = couponDay(endsAt);
  if (start && end) {
    const year = start.slice(0, 4) !== end.slice(0, 4);
    return `${couponDayLabel(start, { year })} – ${couponDayLabel(end, { year })}`;
  }
  if (end) return `Until ${couponDayLabel(end)}`;
  if (start) return `From ${couponDayLabel(start)}`;
  return "No dates";
}

export type CouponStatus = "scheduled" | "live" | "ended" | "inactive";

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
  inactive: "Inactive",
};

/**
 * Where a coupon stands at `nowMs`, by the same comparisons checkout makes.
 *
 * Inactive is a state of its own because the list has no other way to show it:
 * a code switched off in the live-coupons panel would otherwise read "Live" here
 * while checkout refuses it. An ended code stays Ended either way, since that is
 * the more useful fact about it.
 */
export function couponStatus(
  coupon: { active?: boolean; startsAt?: string | null; endsAt?: string | null },
  nowMs: number,
): CouponStatus {
  if (coupon.endsAt && Date.parse(coupon.endsAt) < nowMs) return "ended";
  if (coupon.active === false) return "inactive";
  if (coupon.startsAt && Date.parse(coupon.startsAt) > nowMs) return "scheduled";
  return "live";
}

/**
 * What is wrong with the dates on a new coupon, in toast copy, or null.
 *
 * Both admin forms use this, so they cannot drift. Only for creating: an older
 * coupon being edited may legitimately have no dates, or have already ended.
 */
export function newCouponDatesProblem(
  startDay: string,
  endDay: string,
  todayIst: string,
): string | null {
  if (!startDay) return "Choose a start date";
  if (!endDay) return "Choose an end date";
  if (endDay < startDay) return "The end date can't be before the start date";
  if (endDay < todayIst) return "The end date can't be in the past";
  return null;
}

/**
 * What is wrong with the dates when editing a coupon, in toast copy, or null.
 *
 * A coupon that never had a date stays that way until someone gives it one, but
 * blanking a date it has would quietly make it open-ended.
 */
export function editedCouponDatesProblem(
  startDay: string,
  endDay: string,
  was: { startsAt?: string | null; endsAt?: string | null },
): string | null {
  if (was.startsAt && !startDay) return "Choose a start date";
  if (was.endsAt && !endDay) return "Choose an end date";
  if (startDay && endDay && endDay < startDay) return "The end date can't be before the start date";
  return null;
}

/**
 * The toast after saving a coupon.
 *
 * It follows the coupon's real standing because "is live, valid at checkout now"
 * on a code that opens next week sends an operator off to announce a code that
 * customers will find refused.
 */
export function couponSavedMessage(input: {
  code: string;
  targetLabel: string;
  status: CouponStatus;
  /** The first day, YYYY-MM-DD. */
  startDay: string;
  editing: boolean;
}): { title: string; description: string } {
  const { code, targetLabel, status, startDay, editing } = input;
  const titles: Record<CouponStatus, string> = {
    live: `${code} is live`,
    scheduled: `${code} is scheduled`,
    ended: `${code} saved`,
    inactive: `${code} saved`,
  };
  const details: Record<CouponStatus, string> = {
    live: "valid at checkout now.",
    scheduled: `opens at checkout on ${couponDayLabel(startDay)}.`,
    ended: "past its end date, so it won't work at checkout.",
    inactive: "switched off, so it won't work at checkout.",
  };
  return {
    title: editing ? `${code} updated` : titles[status],
    description: `${targetLabel} · ${details[status]}`,
  };
}

export type CouponWindowRead =
  | { ok: true; startsAt: string | null | undefined; endsAt: string | null | undefined }
  | { ok: false };

/**
 * One date from an admin request: absent stays undefined (leave it alone),
 * null/blank is null (open-ended), a day becomes its IST instant, and a full
 * timestamp is kept as the instant it already is. Anything else is invalid.
 */
function readDate(raw: unknown, toInstant: (day: string) => string): string | null | undefined | false {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  if (!value) return null;
  if (isCouponDay(value)) return toInstant(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : false;
}

/**
 * Read `startsAt` / `endsAt` from an admin request, converted to stored instants.
 *
 * Fails when a value is not a date or when both are present and end before they
 * start. Whether they are required is the caller's business: creating demands
 * both, while editing must keep working for coupons that never had any.
 */
export function readCouponWindow(body: { startsAt?: unknown; endsAt?: unknown }): CouponWindowRead {
  const startsAt = readDate(body.startsAt, couponStartInstant);
  const endsAt = readDate(body.endsAt, couponEndInstant);
  if (startsAt === false || endsAt === false) return { ok: false };
  if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt)) return { ok: false };
  return { ok: true, startsAt, endsAt };
}
