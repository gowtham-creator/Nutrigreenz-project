import "server-only";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { OrderWithDetail } from "@/lib/orders";
import { NOTO_SANS_REGULAR_B64, NOTO_SANS_BOLD_B64 } from "@/lib/invoice-fonts";

/**
 * Server-side INVOICE and RECEIPT PDFs.
 *
 * Modelled on the Stripe-style billing documents the client supplied as the
 * reference: a plain white page, one accent-free column of label/value pairs, a
 * large "amount due / amount paid" headline, a borderless line-item table and a
 * right-aligned totals ladder. No cards, no coloured banding — a billing document
 * has to read as a record, not as marketing.
 *
 * Two documents, deliberately:
 *   · INVOICE — what is owed. Issued when the order is placed.
 *   · RECEIPT — proof of payment. Carries the payment method and "amount paid",
 *     which is what a customer actually needs when claiming or reconciling.
 *
 * Built with pdf-lib rather than a headless browser: no binary to ship and cold
 * starts stay fast.
 */

const INK = rgb(0.06, 0.06, 0.06);
const MUTED = rgb(0.42, 0.44, 0.46);
const RULE = rgb(0.86, 0.87, 0.88);
const A4: [number, number] = [595.28, 841.89];
const M = 48;

const SELLER = {
  name: "Nutri Greenz Farm Technologies Pvt. Ltd.",
  lines: [
    "1st Floor, H.No. 5-35/167, Double Road",
    "Near Moosapet Y Junction, Prashanth Nagar",
    "Kukatpally, Hyderabad, Telangana 500072",
    "India",
    "customersupport@nutrigreenz.farm",
  ],
};

const money = (paise: number) =>
  `₹${(Math.round(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Normalise text for the embedded font.
 *
 * The rupee sign is deliberately preserved — the subset Noto Sans face carries
 * U+20B9, which is the whole reason it is embedded. Only typographic quotes and
 * dashes are folded to ASCII equivalents, and anything the subset genuinely
 * cannot draw is dropped rather than rendered as a blank box.
 */
function safe(text: string): string {
  return text
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^ -ÿ₹·°]/g, "");
}

function longDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function snap(src: Record<string, unknown> | null, key: string): string {
  const v = src?.[key];
  return typeof v === "string" ? v.trim() : "";
}

type Kind = "invoice" | "receipt";

/** Shared layout for both documents — they differ only in heading and meta. */
async function build(order: OrderWithDetail, kind: Kind): Promise<Uint8Array> {
  const isReceipt = kind === "receipt";
  const doc = await PDFDocument.create();
  // Required before embedding a custom (non-standard) font.
  doc.registerFontkit(fontkit);
  doc.setTitle(`${isReceipt ? "Receipt" : "Invoice"} ${order.orderNumber}`);
  doc.setProducer("Nutri Greenz");

  const page: PDFPage = doc.addPage(A4);
  // Noto Sans rather than Helvetica: the standard PDF faces cannot encode the
  // rupee sign, which is not optional on an Indian tax invoice.
  const bold = await doc.embedFont(Buffer.from(NOTO_SANS_BOLD_B64, "base64"), { subset: true });
  const body = await doc.embedFont(Buffer.from(NOTO_SANS_REGULAR_B64, "base64"), { subset: true });
  const W = page.getWidth();
  let y = page.getHeight() - M;

  const put = (
    s: string,
    x: number,
    yy: number,
    o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; right?: number } = {},
  ) => {
    const f = o.f ?? body;
    const size = o.size ?? 8.5;
    const str = safe(s);
    const drawX = o.right !== undefined ? o.right - f.widthOfTextAtSize(str, size) : x;
    page.drawText(str, { x: drawX, y: yy, font: f, size, color: o.color ?? INK });
  };

  const rule = (yy: number) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.7, color: RULE });

  /* ── heading + mark ─────────────────────────────────────────────────── */
  put(isReceipt ? "Receipt" : "Invoice", M, y - 20, { f: bold, size: 23 });
  // Wordmark stands in for the logo: an embedded raster at this size would look
  // soft, and the reference document uses a plain mark in the same corner.
  put("NUTRI GREENZ", W - M, y - 14, { f: bold, size: 11, right: W - M });
  y -= 46;

  /* ── document meta ──────────────────────────────────────────────────── */
  const metaRows: [string, string][] = isReceipt
    ? [
        ["Invoice number", order.orderNumber],
        ["Receipt number", `${order.orderNumber}-R`],
        ["Date paid", longDate(order.placedAt ?? order.createdAt)],
        ["Payment method", order.paymentProvider ? order.paymentProvider.toUpperCase() : "Online"],
      ]
    : [
        ["Invoice number", order.orderNumber],
        ["Date of issue", longDate(order.placedAt ?? order.createdAt)],
        ["Date due", longDate(order.placedAt ?? order.createdAt)],
      ];

  for (const [label, value] of metaRows) {
    put(label, M, y, { f: bold, size: 8.5 });
    put(value, M + 104, y, { size: 8.5 });
    y -= 12.5;
  }
  y -= 22;

  /* ── seller / bill to ───────────────────────────────────────────────── */
  const colR = M + 300;
  put(SELLER.name, M, y, { f: bold });
  put("Bill to", colR, y, { f: bold });
  y -= 12;

  const addr = order.addressSnapshot as Record<string, unknown> | null;
  const buyer = [
    snap(addr, "fullName") || order.userEmail || "Customer",
    [snap(addr, "line1"), snap(addr, "line2")].filter(Boolean).join(", "),
    [snap(addr, "city"), snap(addr, "pincode")].filter(Boolean).join(" "),
    snap(addr, "state"),
    "India",
    order.userEmail ?? "",
  ].filter(Boolean);

  const rows = Math.max(SELLER.lines.length, buyer.length);
  for (let i = 0; i < rows; i++) {
    if (SELLER.lines[i]) put(SELLER.lines[i], M, y, { size: 8.5 });
    if (buyer[i]) put(buyer[i], colR, y, { size: 8.5 });
    y -= 11.5;
  }
  y -= 26;

  /* ── amount headline ────────────────────────────────────────────────── */
  const when = longDate(order.placedAt ?? order.createdAt);
  put(
    isReceipt
      ? `${money(order.totalPaise)} paid on ${when}`
      : `${money(order.totalPaise)} due ${when}`,
    M,
    y,
    { f: bold, size: 15 },
  );
  y -= 40;

  /* ── line items ─────────────────────────────────────────────────────── */
  const xQty = W - M - 210;
  const xUnit = W - M - 140;
  const xAmt = W - M;

  put("Description", M, y, { size: 7.8, color: MUTED });
  put("Qty", xQty, y, { size: 7.8, color: MUTED, right: xQty + 20 });
  put("Unit price", xUnit, y, { size: 7.8, color: MUTED, right: xUnit + 62 });
  put("Amount", xAmt, y, { size: 7.8, color: MUTED, right: xAmt });
  y -= 7;
  rule(y);
  y -= 15;

  for (const it of order.items) {
    const title = it.title.length > 52 ? `${it.title.slice(0, 51)}...` : it.title;
    put(title, M, y, { size: 9 });
    put(String(it.qty), xQty, y, { size: 9, right: xQty + 20 });
    put(money(it.unitPricePaise), xUnit, y, { size: 9, right: xUnit + 62 });
    put(money(it.lineTotalPaise), xAmt, y, { size: 9, right: xAmt });
    y -= 16;
  }

  /* ── totals ladder ──────────────────────────────────────────────────── */
  y -= 8;
  const tl = W - M - 250;
  const line = (label: string, value: string, strong = false) => {
    rule(y + 10);
    put(label, tl, y, { f: strong ? bold : body, size: strong ? 9 : 8.7 });
    put(value, xAmt, y, { f: strong ? bold : body, size: strong ? 9 : 8.7, right: xAmt });
    y -= 15;
  };

  line("Subtotal", money(order.subtotalPaise));
  if (order.discountPaise > 0) {
    line(order.couponCode ? `Discount (${order.couponCode})` : "Discount", `-${money(order.discountPaise)}`);
  }
  if (order.loyaltyRedeemedPaise > 0) {
    line("Loyalty credit", `-${money(order.loyaltyRedeemedPaise)}`);
  }
  line("Delivery", order.shippingPaise > 0 ? money(order.shippingPaise) : "Free");
  if (order.taxPaise > 0) {
    line("Tax", money(order.taxPaise));
  } else {
    line("Tax", "Included");
  }
  line("Total", money(order.totalPaise));
  line(isReceipt ? "Amount paid" : "Amount due", money(order.totalPaise), true);

  /* ── footer ─────────────────────────────────────────────────────────── */
  const fy = M + 16;
  rule(fy + 16);
  if (isReceipt) {
    put(`${order.orderNumber}-R - ${money(order.totalPaise)} paid on ${when}`, M, fy, {
      size: 7.8,
      color: MUTED,
    });
  } else {
    put(`${order.orderNumber} - ${money(order.totalPaise)} due ${when}`, M, fy, {
      size: 7.8,
      color: MUTED,
    });
  }
  put("Page 1 of 1", xAmt, fy, { size: 7.8, color: MUTED, right: xAmt });

  return doc.save();
}

/** The invoice — what is owed. */
export function buildInvoicePdf(order: OrderWithDetail): Promise<Uint8Array> {
  return build(order, "invoice");
}

/** The receipt — proof of payment, with the method used. */
export function buildReceiptPdf(order: OrderWithDetail): Promise<Uint8Array> {
  return build(order, "receipt");
}

/** Base64 of both documents, for attaching to a transactional email. */
export async function billingAttachments(
  order: OrderWithDetail,
): Promise<{ name: string; content: string }[]> {
  const [invoice, receipt] = await Promise.all([
    buildInvoicePdf(order),
    buildReceiptPdf(order),
  ]);
  const out = [
    { name: `Invoice-${order.orderNumber}.pdf`, content: Buffer.from(invoice).toString("base64") },
  ];
  // A receipt only means something once money has actually been taken; sending
  // one against an unpaid order would be a false record.
  if (order.paymentStatus === "paid") {
    out.push({
      name: `Receipt-${order.orderNumber}.pdf`,
      content: Buffer.from(receipt).toString("base64"),
    });
  }
  return out;
}
