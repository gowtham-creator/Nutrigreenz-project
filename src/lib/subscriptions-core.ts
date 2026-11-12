/**
 * Subscription rules shared by the server and the browser. No I/O here, so the
 * storefront shows exactly the dates and prices the server will use.
 *
 * Dates are calendar days in India (Asia/Kolkata) as "YYYY-MM-DD" strings. A
 * delivery date is a day, not an instant, so it is never carried as a Date.
 */

/** Subscriber price cut, in basis points (800 = 8%). */
export const SUBSCRIBER_DISCOUNT_BPS = 800;

/** How many days before its date a delivery becomes due (order or pay link). */
export const DUE_LEAD_DAYS = 2;

/** The earliest first delivery, counted from today. Equal to the lead, so the
 *  first delivery can be ordered (or paid for) the moment the customer signs up. */
export const MIN_START_OFFSET_DAYS = DUE_LEAD_DAYS;

/** The latest first delivery a customer can pick, counted from today. */
export const MAX_START_OFFSET_DAYS = 30;

/** At most this many products on one subscription. */
export const MAX_SUBSCRIPTION_ITEMS = 10;

export const MAX_ITEM_QTY = 20;

export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type SubscriptionPaymentMethod = "upi" | "cod";
export type DeliveryStatus = "due" | "processing" | "ordered" | "skipped" | "missed" | "failed";

export const FREQUENCIES: readonly { days: 7 | 14 | 30; label: string; short: string }[] = [
  { days: 7, label: "Every week", short: "Weekly" },
  { days: 14, label: "Every 2 weeks", short: "Fortnightly" },
  { days: 30, label: "Every month", short: "Monthly" },
];

export type FrequencyDays = (typeof FREQUENCIES)[number]["days"];

export function isFrequency(value: unknown): value is FrequencyDays {
  return FREQUENCIES.some((f) => f.days === value);
}

export function frequencyLabel(days: number): string {
  return FREQUENCIES.find((f) => f.days === days)?.label ?? `Every ${days} days`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's date in India. */
export function indiaToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** The first and last dates a new subscription may start on. */
export function startWindow(today: string): { earliest: string; latest: string } {
  return {
    earliest: addDays(today, MIN_START_OFFSET_DAYS),
    latest: addDays(today, MAX_START_OFFSET_DAYS),
  };
}

/**
 * Move a delivery date forward by whole cycles until it is on or after
 * `earliest`. Used after a pause, or when the scheduler was down for a while,
 * so a subscription never produces deliveries for dates already gone.
 */
export function rollForward(date: string, frequencyDays: number, earliest: string): string {
  if (date >= earliest) return date;
  const behind = daysBetween(date, earliest);
  const cycles = Math.ceil(behind / frequencyDays);
  return addDays(date, cycles * frequencyDays);
}

/** A unit price after the subscriber discount, in whole paise. */
export function applySubscriberDiscountPaise(unitPricePaise: number, bps: number): number {
  const b = Math.min(5000, Math.max(0, Math.round(bps)));
  return Math.max(0, Math.round((unitPricePaise * (10000 - b)) / 10000));
}

/** "Fri, 14 Nov" for a YYYY-MM-DD date. */
export function formatDeliveryDate(date: string): string {
  if (!isIsoDate(date)) return date;
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
