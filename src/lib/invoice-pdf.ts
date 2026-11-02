import "server-only";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { OrderWithDetail } from "@/lib/orders";
import { NOTO_SANS_REGULAR_B64, NOTO_SANS_BOLD_B64 } from "@/lib/invoice-fonts";
import { gstNote } from "@/lib/gst";
import { invoiceLadder, money, type DocumentKind } from "@/lib/invoice-ladder";
import { paymentMethodLabel } from "@/lib/payment-label";

/**
 * Server-side INVOICE and RECEIPT PDFs.
 *
 * Modelled on the Stripe-style billing documents the client supplied as the
 * reference: a plain white page, one accent-free column of label/value pairs, a
 * large headline saying where the money stands, a borderless line-item table and
 * a right-aligned totals ladder. No cards, no coloured banding — a billing
 * document has to read as a record, not as marketing.
 *
 * Two documents, deliberately:
 *   · INVOICE — what the order came to, and what is still owed if anything. It
 *     can be downloaded at any time, so it has to stop saying "due" once the
 *     order is paid or cancelled.
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
    "1st Floor, H.No: 5-35/167, Double Road",
    "Near Moosapet Y Junction, Prashanth Nagar",
    "Kukatpally, Hyderabad, Telangana 500072",
    "India",
    "customersupport@nutrigreenz.farm",
  ],
};

/**
 * The company's registered GSTIN.
 *
 * A constant because it is public, printed on every invoice, and must appear
 * whether or not an environment is configured: a billing document from a
 * registered business should not lose its GSTIN to a missing variable.
 */
const SELLER_GSTIN = "36AALCN3064D1ZJ";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * The GSTIN to print: SELLER_GSTIN from the environment when it is valid,
 * otherwise the constant.
 *
 * The override is format-checked because a typo'd GSTIN on an invoice is as wrong
 * as an invented one, and a customer's accountant will reject it either way. A
 * bad value is ignored rather than printed.
 */
function sellerGstin(): string {
  const raw = process.env.SELLER_GSTIN?.trim().toUpperCase();
  return raw && GSTIN_RE.test(raw) ? raw : SELLER_GSTIN;
}

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

function snap(src: Record<string, unknown> | null, key: string): string {
  const v = src?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Truncate to a MEASURED width, not a character count.
 *
 * Counting characters is what let text run off the page: "WWWWW" and "iiiii"
 * are the same length and nowhere near the same width, so a title of wide
 * characters overflowed its column while a narrow one wasted half of it.
 */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const s = safe(text);
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  const ellipsis = "...";
  const room = maxWidth - font.widthOfTextAtSize(ellipsis, size);
  if (room <= 0) return "";
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(s.slice(0, mid), size) <= room) lo = mid;
    else hi = mid - 1;
  }
  return `${s.slice(0, lo).trimEnd()}${ellipsis}`;
}

/**
 * Word-wrap to a measured width.
 *
 * Used for the address blocks, where truncating would lose part of a real
 * postal address — the one thing on the document that has to stay complete.
 * A single word longer than the line is hard-cut, because leaving it to
 * overflow is what this whole change is about.
 */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(w, size) <= maxWidth) {
      line = w;
    } else {
      lines.push(fit(w, font, size, maxWidth));
      line = "";
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shared layout for both documents — they differ only in heading and meta. */
async function build(order: OrderWithDetail, kind: DocumentKind): Promise<Uint8Array> {
  const isReceipt = kind === "receipt";
  const ladder = invoiceLadder(order, kind);
  const doc = await PDFDocument.create();
  // Required before embedding a custom (non-standard) font.
  doc.registerFontkit(fontkit);
  doc.setTitle(`${isReceipt ? "Receipt" : "Invoice"} ${order.orderNumber}`);
  doc.setProducer("Nutri Greenz");

  // Noto Sans rather than Helvetica: the standard PDF faces cannot encode the
  // rupee sign, which is not optional on an Indian tax invoice.
  const bold = await doc.embedFont(Buffer.from(NOTO_SANS_BOLD_B64, "base64"), { subset: true });
  const body = await doc.embedFont(Buffer.from(NOTO_SANS_REGULAR_B64, "base64"), { subset: true });

  const W = A4[0];
  const H = A4[1];
  /* Where content must stop, leaving the footer rule its own clear band. */
  const FOOTER_TOP = M + 34;

  const pages: PDFPage[] = [];
  let page: PDFPage = doc.addPage(A4);
  pages.push(page);
  let y = H - M;

  const put = (
    s: string,
    x: number,
    yy: number,
    o: {
      f?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      right?: number;
      /** Hard ceiling on drawn width — the text is truncated to fit. */
      max?: number;
    } = {},
  ) => {
    const f = o.f ?? body;
    const size = o.size ?? 8.5;
    // Every string is measured against its column before it is drawn. Without
    // this, a long address line or product title simply ran off the page edge.
    const str = o.max !== undefined ? fit(s, f, size, o.max) : safe(s);
    const drawX = o.right !== undefined ? o.right - f.widthOfTextAtSize(str, size) : x;
    page.drawText(str, { x: drawX, y: yy, font: f, size, color: o.color ?? INK });
  };

  const rule = (yy: number) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.7, color: RULE });

  /**
   * Start a fresh page and return the y to continue from.
   *
   * There was no pagination at all: `y` decremented past the bottom of the
   * sheet, so an order with roughly twenty or more lines pushed the totals
   * ladder into the footer and then off the page entirely. The customer got an
   * invoice with no total on it — and the document still said "Page 1 of 1".
   */
  const newPage = () => {
    page = doc.addPage(A4);
    pages.push(page);
    y = H - M;
  };

  /** Break before drawing something `need` points tall. */
  const ensure = (need: number) => {
    if (y - need < FOOTER_TOP) newPage();
  };

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
        ["Date paid", ladder.paidOn],
        ["Payment method", paymentMethodLabel(order)],
      ]
    : [
        ["Invoice number", order.orderNumber],
        ["Date of issue", ladder.issuedOn],
        // A due date is a claim that money is owed, so it goes with the money.
        ...(ladder.due ? ([["Date due", ladder.issuedOn]] satisfies [string, string][]) : []),
      ];

  for (const [label, value] of metaRows) {
    put(label, M, y, { f: bold, size: 8.5 });
    put(value, M + 104, y, { size: 8.5 });
    y -= 12.5;
  }
  y -= 22;

  /* ── seller / bill to ───────────────────────────────────────────────── */
  const colR = M + 290;
  // Each column gets an explicit width, and a gutter so the two can never touch.
  const colLW = colR - M - 24;
  const colRW = W - M - colR;

  put(fit(SELLER.name, bold, 8.5, colLW), M, y, { f: bold });
  put("Bill to", colR, y, { f: bold });
  y -= 12;

  const addr = order.addressSnapshot as Record<string, unknown> | null;
  /*
   * The delivery address is WRAPPED, not truncated. Everything else on this
   * document can lose a few characters without harm; a postal address cannot,
   * and a customer claiming an expense needs it intact.
   */
  const buyer = [
    snap(addr, "fullName") || order.userEmail || "Customer",
    [snap(addr, "line1"), snap(addr, "line2")].filter(Boolean).join(", "),
    [snap(addr, "city"), snap(addr, "pincode")].filter(Boolean).join(" "),
    snap(addr, "state"),
    "India",
    order.userEmail ?? "",
  ]
    .filter(Boolean)
    .flatMap((l) => wrap(l, body, 8.5, colRW));

  const sellerLines = [...SELLER.lines, `GSTIN: ${sellerGstin()}`].flatMap((l) =>
    wrap(l, body, 8.5, colLW),
  );
  const rows = Math.max(sellerLines.length, buyer.length);
  ensure(rows * 11.5 + 26);
  for (let i = 0; i < rows; i++) {
    if (sellerLines[i]) put(sellerLines[i], M, y, { size: 8.5 });
    if (buyer[i]) put(buyer[i], colR, y, { size: 8.5 });
    y -= 11.5;
  }
  y -= 26;

  /* ── amount headline ────────────────────────────────────────────────── */
  put(ladder.headline, M, y, { f: bold, size: 15, max: W - 2 * M });
  y -= 40;

  /* ── line items ─────────────────────────────────────────────────────── */
  const xQty = W - M - 210;
  const xUnit = W - M - 140;
  const xAmt = W - M;
  // The description column stops short of the Qty column with a gutter, so a
  // long product name is cut rather than colliding with the numbers.
  const descW = xQty - M - 16;

  const itemHeader = () => {
    put("Description", M, y, { size: 7.8, color: MUTED });
    put("Qty", xQty, y, { size: 7.8, color: MUTED, right: xQty + 20 });
    put("Unit price", xUnit, y, { size: 7.8, color: MUTED, right: xUnit + 62 });
    put("Amount", xAmt, y, { size: 7.8, color: MUTED, right: xAmt });
    y -= 7;
    rule(y);
    y -= 15;
  };

  ensure(40);
  itemHeader();

  for (const it of order.items) {
    // Break before the row, then repeat the column headings — a continuation
    // page of bare numbers with no headings is unreadable.
    if (y - 16 < FOOTER_TOP) {
      newPage();
      itemHeader();
    }
    put(it.title, M, y, { size: 9, max: descW });
    put(String(it.qty), xQty, y, { size: 9, right: xQty + 20 });
    put(money(it.unitPricePaise), xUnit, y, { size: 9, right: xUnit + 62 });
    put(money(it.lineTotalPaise), xAmt, y, { size: 9, right: xAmt });
    y -= 16;
  }

  /* ── totals ladder ──────────────────────────────────────────────────── */
  y -= 8;
  const tl = W - M - 250;
  // Labels stop where the amount column begins; a long coupon code in
  // "Discount (SUMMERSALE2026)" would otherwise print over the figure.
  const labelW = xAmt - tl - 90;
  const line = (label: string, value: string, strong = false) => {
    // The ladder is the part that must never be orphaned: an invoice whose
    // total fell off the bottom of the page is not an invoice.
    ensure(15);
    rule(y + 10);
    put(label, tl, y, { f: strong ? bold : body, size: strong ? 9 : 8.7, max: labelW });
    put(value, xAmt, y, { f: strong ? bold : body, size: strong ? 9 : 8.7, right: xAmt });
    y -= 15;
  };

  /*
   * GST as a note, not as rows.
   *
   * This ladder used to break every order into "Total excluding tax" plus
   * CGST/SGST or IGST rows. The owner wants the ladder kept to what is paid, but
   * a tax invoice must still state the tax amount, so the amounts moved into the
   * small line below, alongside the place of supply that a GST invoice also has
   * to carry. invoiceLadder() and gstNote() are shared with the order email, so
   * the two documents still cannot disagree.
   */
  for (const r of ladder.rows) line(r.label, r.value, r.strong);

  // Wrapped, never cut with `max`: a truncated tax amount is worse than a second
  // line. All of it is reserved up front so it cannot run into the footer.
  y -= 4;
  const note = wrap(gstNote(order), body, 7.8, W - 2 * M);
  ensure(note.length * 12);
  for (const l of note) {
    put(l, M, y, { size: 7.8, color: MUTED });
    y -= 12;
  }

  /* ── footer ─────────────────────────────────────────────────────────── */
  /*
   * Drawn last, on EVERY page, once the total is known.
   *
   * "Page 1 of 1" used to be a hardcoded string — it stayed "1 of 1" on a
   * document that had silently lost its second page's worth of content.
   */
  const fy = M + 16;
  const summary = `${order.orderNumber}${isReceipt ? "-R" : ""} - ${ladder.headline}`;

  pages.forEach((p, i) => {
    // `put`/`rule` write to the current page, so point them at this one.
    page = p;
    rule(fy + 16);
    put(summary, M, fy, { size: 7.8, color: MUTED, max: xAmt - M - 70 });
    put(`Page ${i + 1} of ${pages.length}`, xAmt, fy, { size: 7.8, color: MUTED, right: xAmt });
  });

  return doc.save();
}

/** The invoice — what the order came to, and what is still owed if anything. */
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
