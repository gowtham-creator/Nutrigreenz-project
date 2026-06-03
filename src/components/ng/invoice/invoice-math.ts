/**
 * GST invoice maths for Nutri Greenz tax invoices.
 *
 * Storefront prices are GST-INCLUSIVE (`taxInclusive`). India treats packaged
 * foods/edible oils at 5% GST, split evenly into CGST 2.5% + SGST 2.5% for an
 * intra-state (Telangana → Telangana) supply. We back-calculate the taxable
 * value out of each inclusive line price:
 *
 *   taxable = inclusive / (1 + rate)
 *   gst     = inclusive − taxable           (= taxable * rate)
 *   cgst = sgst = gst / 2
 *
 * Everything is rounded only for display; intermediate sums stay in paise-safe
 * floats and we expose a final round-off so the printed grand total ties out.
 */

import type { CartItem } from "@/types/nutrigreenz";

/** Flat 5% GST slab for groceries / edible oils / honey etc. */
export const GST_RATE = 0.05;

/** Mock HSN codes by product tag (real invoices map SKU → HSN). */
const HSN_BY_TAG: Record<string, string> = {
  oil: "1509",
  ghee: "0405",
  honey: "0409",
  millet: "1008",
  flour: "1102",
  superfood: "1404",
  spice: "0910",
  pulse: "0713",
  fruit: "0813",
  gifting: "2106",
};
const HSN_FALLBACK = "2106"; // food preparations n.e.s.

export function hsnFor(item: CartItem): string {
  const tag = (item as CartItem & { tags?: string[] }).tags?.[0];
  return (tag && HSN_BY_TAG[tag]) || HSN_FALLBACK;
}

export interface InvoiceLine {
  productId: string;
  title: string;
  unit?: string;
  hsn: string;
  qty: number;
  /** GST-inclusive unit price (₹). */
  rate: number;
  /** GST-inclusive line total = rate * qty. */
  gross: number;
  /** Net-of-GST taxable value (₹). */
  taxable: number;
  cgst: number;
  sgst: number;
  gstRate: number;
}

export interface InvoiceTotals {
  taxableValue: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  /** Inclusive subtotal (sum of line gross) = taxable + tax. */
  itemsTotal: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  shipping: number;
  /** taxableValue + cgst + sgst − discounts + shipping, before round-off. */
  preRound: number;
  /** Round-off applied to reach a whole-rupee grand total (±). */
  roundOff: number;
  grandTotal: number;
}

/** Back-calculate per-line GST from an inclusive price. */
export function buildLines(items: CartItem[]): InvoiceLine[] {
  return items.map((item) => {
    const gross = item.price * item.qty;
    const taxable = gross / (1 + GST_RATE);
    const tax = gross - taxable;
    return {
      productId: item.productId,
      title: item.title,
      unit: item.unit,
      hsn: hsnFor(item),
      qty: item.qty,
      rate: item.price,
      gross,
      taxable,
      cgst: tax / 2,
      sgst: tax / 2,
      gstRate: GST_RATE,
    };
  });
}

/**
 * Aggregate lines into invoice totals, layering coupon/loyalty/shipping on top.
 * `grandTotal` is forced to a whole rupee and `roundOff` records the delta.
 */
export function computeInvoiceTotals(args: {
  lines: InvoiceLine[];
  couponDiscount: number;
  loyaltyDiscount: number;
  shipping: number;
  /** Authoritative grand total from the receipt (paid amount), if present. */
  paidTotal?: number;
}): InvoiceTotals {
  const { lines, couponDiscount, loyaltyDiscount, shipping, paidTotal } = args;

  const taxableValue = lines.reduce((s, l) => s + l.taxable, 0);
  const cgst = lines.reduce((s, l) => s + l.cgst, 0);
  const sgst = lines.reduce((s, l) => s + l.sgst, 0);
  const totalTax = cgst + sgst;
  const itemsTotal = taxableValue + totalTax;

  const preRound =
    itemsTotal - couponDiscount - loyaltyDiscount + shipping;
  const grandTotal =
    typeof paidTotal === "number" ? Math.round(paidTotal) : Math.round(preRound);
  const roundOff = grandTotal - preRound;

  return {
    taxableValue,
    cgst,
    sgst,
    totalTax,
    itemsTotal,
    couponDiscount,
    loyaltyDiscount,
    shipping,
    preRound,
    roundOff,
    grandTotal,
  };
}

/** ₹ with two decimals + Indian grouping — invoices show paise, not rounded. */
export function inr2(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ── Amount in words (Indian numbering: lakh / crore) ─────────────── */

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 0) return twoDigits(rest);
  const head = `${ONES[h]} Hundred`;
  return rest === 0 ? head : `${head} ${twoDigits(rest)}`;
}

/** "Rupees One Thousand Two Hundred and Forty Only" (Indian numbering). */
export function amountInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - whole) * 100);

  let words: string;
  if (whole === 0) {
    words = "Zero";
  } else {
    const crore = Math.floor(whole / 10000000);
    const lakh = Math.floor((whole % 10000000) / 100000);
    const thousand = Math.floor((whole % 100000) / 1000);
    const hundred = whole % 1000;

    const parts: string[] = [];
    if (crore) parts.push(`${twoDigits(crore)} Crore`);
    if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
    if (hundred) parts.push(threeDigits(hundred));
    words = parts.join(" ");
  }

  const sign = amount < 0 ? "Minus " : "";
  const paisePart =
    paise > 0 ? ` and ${twoDigits(paise)} Paise` : "";
  return `${sign}Rupees ${words}${paisePart} Only`;
}
