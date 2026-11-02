import type { OrderRecord } from "@/lib/orders";

/**
 * The totals on an invoice or receipt, worked out in one place.
 *
 * Pure and free of "server-only", so the PDF, the order email and the order
 * screens share one rule and cannot show the same order two different ways.
 *
 * The ladder carries what the customer pays and nothing else. It used to print
 * "Total excluding tax" plus CGST/SGST or IGST on every order; the owner asked
 * for those to go, because prices are GST-inclusive and the rows only restated
 * money already inside the subtotal. GST is now one note under the ladder.
 *
 * Discount, Loyalty credit and Tax stay, but only when they are non-zero. Each
 * of them moves the total, so leaving one out would give a document whose rows
 * do not add up to its own Total.
 */

export type DocumentKind = "invoice" | "receipt";

type LadderOrder = Pick<
  OrderRecord,
  | "status"
  | "paymentStatus"
  | "paidAt"
  | "placedAt"
  | "createdAt"
  | "subtotalPaise"
  | "discountPaise"
  | "loyaltyRedeemedPaise"
  | "shippingPaise"
  | "taxPaise"
  | "totalPaise"
  | "couponCode"
>;

export interface LadderRow {
  label: string;
  /** Ready to print: "₹100.00", "-₹10.00" or "Free". */
  value: string;
  /** Signed, so everything above Total sums to it. */
  paise: number;
  /** The row the eye should land on: the last one on the ladder. */
  strong: boolean;
}

export interface InvoiceLadder {
  rows: LadderRow[];
  /** Where the money stands, in one line. Also the document's footer. */
  headline: string;
  /** Money is still owed, so "Amount due" and "Date due" apply. */
  due: boolean;
  issuedOn: string;
  paidOn: string;
}

export const money = (paise: number) =>
  `₹${(Math.round(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function longDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  // The server runs in UTC; the invoice carries the date in India.
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

/**
 * The coupon's own part of an order's discount.
 *
 * orders.discount_paise is NOT the coupon discount: createOrder stores the
 * coupon AND the loyalty credit in it, while loyalty_redeemed_paise repeats the
 * loyalty part. Printing both as they stand subtracts the points twice, so a
 * ₹100 coupon plus ₹30 of points read as ₹130 + ₹30 on a ladder whose Total had
 * only taken off ₹130.
 */
export function couponSharePaise(order: Pick<OrderRecord, "discountPaise" | "loyaltyRedeemedPaise">): number {
  return Math.max(0, order.discountPaise - order.loyaltyRedeemedPaise);
}

export function invoiceLadder(order: LadderOrder, kind: DocumentKind): InvoiceLadder {
  const isReceipt = kind === "receipt";
  const paid = order.paymentStatus === "paid";
  const cancelled = order.status === "cancelled";
  // Checked alongside payment because a cancelled COD order stays "pending" for
  // good: its status alone would keep billing the customer for it.
  const due = !paid && !cancelled;

  const amount = money(order.totalPaise);
  const issuedOn = longDate(order.placedAt ?? order.createdAt);
  const paidOn = longDate(order.paidAt ?? order.placedAt ?? order.createdAt);
  const paidLine = `${amount} paid on ${paidOn}`;

  // A paid and cancelled order says what was paid and stops there: the order row
  // does not record a refund, so the document must not claim one either way.
  let headline = paidLine;
  if (!isReceipt && cancelled) {
    headline = paid ? `Order cancelled - ${paidLine}` : "Order cancelled - nothing to pay";
  } else if (!isReceipt && due) {
    headline = `${amount} due ${issuedOn}`;
  }

  const coupon = couponSharePaise(order);
  const closing = isReceipt ? "Amount paid" : due ? "Amount due" : null;

  const row = (label: string, value: string, paise: number, strong = false): LadderRow => ({
    label,
    value,
    paise,
    strong,
  });

  const rows: LadderRow[] = [
    row("Subtotal", money(order.subtotalPaise), order.subtotalPaise),
    ...(coupon > 0
      ? [row(order.couponCode ? `Discount (${order.couponCode})` : "Discount", `-${money(coupon)}`, -coupon)]
      : []),
    ...(order.loyaltyRedeemedPaise > 0
      ? [row("Loyalty credit", `-${money(order.loyaltyRedeemedPaise)}`, -order.loyaltyRedeemedPaise)]
      : []),
    row("Delivery", order.shippingPaise > 0 ? money(order.shippingPaise) : "Free", order.shippingPaise),
    ...(order.taxPaise > 0 ? [row("Tax", money(order.taxPaise), order.taxPaise)] : []),
    row("Total", amount, order.totalPaise, closing === null),
    ...(closing ? [row(closing, amount, order.totalPaise, true)] : []),
  ];

  return { rows, headline, due, issuedOn, paidOn };
}
