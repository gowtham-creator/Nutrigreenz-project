/**
 * The totals ladder, and the invoice and receipt PDFs built from it.
 *
 * pdf-lib encodes text against a subset font, so the saved bytes cannot be
 * searched. The document tests read the strings handed to PDFPage.drawText
 * instead, which is exactly what ends up on the page.
 */
import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import type { OrderWithDetail } from "@/lib/orders";

vi.mock("server-only", () => ({}));

import { gstFor, gstNote } from "@/lib/gst";
import { buildInvoicePdf, buildReceiptPdf } from "@/lib/invoice-pdf";
import { couponSharePaise, invoiceLadder, type InvoiceLadder } from "@/lib/invoice-ladder";

const GSTIN = "36AALCN3064D1ZJ";

interface Priced {
  subtotal?: number;
  coupon?: number;
  points?: number;
  shipping?: number;
  tax?: number;
}

/**
 * An order, priced the way createOrder prices one: discount_paise holds the
 * coupon AND the points. Worked out here rather than written out, so "the rows
 * add up" tests the ladder against the real arithmetic.
 */
function order(
  { subtotal = 220_000, coupon = 0, points = 0, shipping = 0, tax = 0 }: Priced = {},
  overrides: Partial<OrderWithDetail> = {},
): OrderWithDetail {
  const discountPaise = Math.min(coupon + points, subtotal);
  return {
    id: "ord-1",
    orderNumber: "NG-26-1001",
    customerId: "cust-1",
    userEmail: "asha@example.com",
    userPhone: null,
    status: "placed",
    paymentStatus: "pending",
    paymentMethod: "cod",
    paidAt: null,
    paymentProvider: "none",
    paymentRef: null,
    subtotalPaise: subtotal,
    discountPaise,
    shippingPaise: shipping,
    taxPaise: tax,
    totalPaise: subtotal - discountPaise + shipping + tax,
    couponCode: coupon > 0 ? "HARVEST10" : null,
    loyaltyRedeemedPaise: points,
    currency: "INR",
    addressSnapshot: { fullName: "Asha Rao", line1: "1 Lake Road", city: "Hyderabad", state: "Telangana", pincode: "500001" },
    slotSnapshot: null,
    placedAt: "2026-10-01T10:00:00Z",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:05:00Z",
    items: [
      {
        id: "i1",
        orderId: "ord-1",
        productId: "p1",
        variantId: "v1",
        variantSku: "GHEE-500",
        title: "A2 Ghee",
        qty: 1,
        unitPricePaise: subtotal,
        lineTotalPaise: subtotal,
        snapshot: null,
      },
    ],
    events: [],
    ...overrides,
  };
}

const PAID_ONLINE: Partial<OrderWithDetail> = {
  paymentStatus: "paid",
  paymentMethod: "upi",
  paymentProvider: "sbiepay",
  paidAt: "2026-10-03T10:05:00Z",
};

const labels = (l: InvoiceLadder) => l.rows.map((r) => r.label);
const rowNamed = (l: InvoiceLadder, label: string) => l.rows.find((r) => r.label === label);

/** The rows above Total, summed, against Total itself. */
function expectToAddUp(o: OrderWithDetail, kind: "invoice" | "receipt") {
  const { rows } = invoiceLadder(o, kind);
  const totalAt = rows.findIndex((r) => r.label === "Total");
  const sum = rows.slice(0, totalAt).reduce((s, r) => s + r.paise, 0);
  expect(sum).toBe(o.totalPaise);
  expect(rows[totalAt].paise).toBe(o.totalPaise);
}

describe("invoiceLadder - what is owed", () => {
  it("bills an unpaid COD order", () => {
    const l = invoiceLadder(order({ shipping: 4_900 }), "invoice");
    expect(labels(l)).toEqual(["Subtotal", "Delivery", "Total", "Amount due"]);
    expect(rowNamed(l, "Amount due")).toMatchObject({ value: "₹2,249.00", strong: true });
    expect(rowNamed(l, "Total")?.strong).toBe(false);
    expect(l.due).toBe(true);
    expect(l.headline).toBe("₹2,249.00 due 1 October 2026");
  });

  it("still bills an order whose online payment failed", () => {
    const l = invoiceLadder(order({}, { paymentStatus: "failed", paymentMethod: "upi" }), "invoice");
    expect(l.due).toBe(true);
    expect(labels(l)).toContain("Amount due");
  });

  it("says a paid order was paid, on the day it was paid", () => {
    const l = invoiceLadder(order({}, PAID_ONLINE), "invoice");
    expect(labels(l)).toEqual(["Subtotal", "Delivery", "Total"]);
    expect(rowNamed(l, "Total")?.strong).toBe(true);
    expect(l.due).toBe(false);
    expect(l.headline).toBe("₹2,200.00 paid on 3 October 2026");
  });

  it("falls back to the order date when a paid order has no paidAt", () => {
    const l = invoiceLadder(order({}, { ...PAID_ONLINE, paidAt: null }), "invoice");
    expect(l.headline).toBe("₹2,200.00 paid on 1 October 2026");
  });

  it("never asks for money on a cancelled order", () => {
    const l = invoiceLadder(order({}, { status: "cancelled" }), "invoice");
    expect(labels(l)).toEqual(["Subtotal", "Delivery", "Total"]);
    expect(rowNamed(l, "Total")?.strong).toBe(true);
    expect(l.due).toBe(false);
    expect(l.headline).toBe("Order cancelled - nothing to pay");
  });

  it("records the payment on a cancelled order that was paid, without claiming a refund", () => {
    const l = invoiceLadder(order({}, { ...PAID_ONLINE, status: "cancelled" }), "invoice");
    expect(l.due).toBe(false);
    expect(l.headline).toBe("Order cancelled - ₹2,200.00 paid on 3 October 2026");
    expect(l.headline).not.toMatch(/\bdue\b|refund/i);
  });

  it("keeps Amount paid on the receipt, dated by the payment", () => {
    const l = invoiceLadder(order({}, PAID_ONLINE), "receipt");
    expect(labels(l)).toEqual(["Subtotal", "Delivery", "Total", "Amount paid"]);
    expect(rowNamed(l, "Amount paid")).toMatchObject({ value: "₹2,200.00", strong: true });
    expect(l.headline).toBe("₹2,200.00 paid on 3 October 2026");
  });
});

describe("invoiceLadder - conditional rows", () => {
  it("shows a coupon and points separately, without taking the points off twice", () => {
    const o = order({ subtotal: 100_000, coupon: 10_000, points: 3_000 });
    const l = invoiceLadder(o, "invoice");
    expect(o.totalPaise).toBe(87_000);
    expect(rowNamed(l, "Discount (HARVEST10)")?.value).toBe("-₹100.00");
    expect(rowNamed(l, "Loyalty credit")?.value).toBe("-₹30.00");
    expectToAddUp(o, "invoice");
  });

  it("shows no Discount row when points are the only saving", () => {
    const l = invoiceLadder(order({ points: 3_000 }), "invoice");
    expect(labels(l)).toEqual(["Subtotal", "Loyalty credit", "Delivery", "Total", "Amount due"]);
  });

  it("shows no Loyalty row when a coupon is the only saving", () => {
    const l = invoiceLadder(order({ coupon: 10_000 }), "invoice");
    expect(labels(l)).toEqual(["Subtotal", "Discount (HARVEST10)", "Delivery", "Total", "Amount due"]);
  });

  it("labels a discount that carries no coupon code", () => {
    const l = invoiceLadder(order({ coupon: 10_000 }, { couponCode: null }), "invoice");
    expect(labels(l)).toContain("Discount");
  });

  it("adds a Tax row only when tax went on top", () => {
    const o = order({ subtotal: 100_000, tax: 5_000 });
    expect(rowNamed(invoiceLadder(o, "invoice"), "Tax")?.value).toBe("₹50.00");
    expect(labels(invoiceLadder(order(), "invoice"))).not.toContain("Tax");
    expectToAddUp(o, "invoice");
  });

  it("prints free delivery as Free and paid delivery as money", () => {
    expect(rowNamed(invoiceLadder(order(), "invoice"), "Delivery")?.value).toBe("Free");
    expect(rowNamed(invoiceLadder(order({ shipping: 4_900 }), "invoice"), "Delivery")?.value).toBe("₹49.00");
  });
});

describe("invoiceLadder - reconciliation", () => {
  const prices: Priced[] = [];
  for (const coupon of [0, 10_000])
    for (const points of [0, 3_000])
      for (const shipping of [0, 4_900])
        for (const tax of [0, 5_000]) prices.push({ subtotal: 100_000, coupon, points, shipping, tax });
  // Coupon and points that cover the whole subtotal, and an odd paise value.
  prices.push({ subtotal: 100_000, coupon: 70_000, points: 30_000 }, { subtotal: 33_333, coupon: 1_111, points: 77 });

  const states: Partial<OrderWithDetail>[] = [{}, PAID_ONLINE, { status: "cancelled" }];

  it("always adds up to Total", () => {
    for (const p of prices) {
      for (const s of states) {
        expectToAddUp(order(p, s), "invoice");
        expectToAddUp(order(p, s), "receipt");
      }
    }
  });

  it("never prints a tax breakdown", () => {
    for (const p of prices) {
      for (const s of states) {
        expect(labels(invoiceLadder(order(p, s), "invoice")).join()).not.toMatch(/CGST|SGST|IGST|excluding/i);
      }
    }
  });
});

describe("couponSharePaise", () => {
  it("is what remains of the discount once the points are taken out", () => {
    expect(couponSharePaise({ discountPaise: 13_000, loyaltyRedeemedPaise: 3_000 })).toBe(10_000);
    expect(couponSharePaise({ discountPaise: 3_000, loyaltyRedeemedPaise: 3_000 })).toBe(0);
  });
});

/** Builds the document and returns every string drawn on it, joined by lines. */
async function drawnText(build: () => Promise<Uint8Array>): Promise<string> {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  await build();
  const text = draw.mock.calls.map(([drawn]) => drawn).join("\n");
  // A second spyOn returns this same spy, so without this the next document in
  // the test would be read with this one's text still in it.
  draw.mockRestore();
  return text;
}

describe("PDFs", () => {
  const cases: [string, OrderWithDetail][] = [
    ["unpaid COD", order({ shipping: 4_900 })],
    ["paid online", order({}, PAID_ONLINE)],
    ["cancelled", order({}, { status: "cancelled" })],
    ["coupon and points", order({ coupon: 10_000, points: 3_000 })],
    ["exclusive tax", order({ tax: 11_000 })],
  ];

  it.each(cases)("builds an invoice and a receipt for %s", async (_name, o) => {
    for (const bytes of [await buildInvoicePdf(o), await buildReceiptPdf(o)]) {
      expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    }
  });

  it("prints no tax rows, and the GST note on both documents", async () => {
    const o = order({}, { addressSnapshot: { state: "Karnataka" } });
    for (const build of [buildInvoicePdf, buildReceiptPdf]) {
      const text = await drawnText(() => build(o));
      // A ladder row is its own string, so a tax row would start a line.
      expect(text).not.toMatch(/^(CGST|SGST|IGST)|Total excluding tax/m);
      expect(text).toContain("Prices include GST at 5% (IGST ₹104.76). Place of supply: Karnataka.");
    }
  });

  it("gives a due date and a due footer only while money is owed", async () => {
    const owed = await drawnText(() => buildInvoicePdf(order()));
    expect(owed).toContain("Date due");
    expect(owed).toContain("NG-26-1001 - ₹2,200.00 due 1 October 2026");

    const paid = await drawnText(() => buildInvoicePdf(order({}, PAID_ONLINE)));
    expect(paid).not.toMatch(/Date due|Amount due/);
    expect(paid).toContain("NG-26-1001 - ₹2,200.00 paid on 3 October 2026");

    const cancelled = await drawnText(() => buildInvoicePdf(order({}, { status: "cancelled" })));
    expect(cancelled).not.toMatch(/Date due|Amount due/);
    expect(cancelled).toContain("NG-26-1001 - Order cancelled - nothing to pay");
  });

  it("dates the receipt's headline and meta by the payment", async () => {
    const text = await drawnText(() => buildReceiptPdf(order({}, PAID_ONLINE)));
    expect(text).toContain("Date paid\n3 October 2026");
    expect(text).toContain("NG-26-1001-R - ₹2,200.00 paid on 3 October 2026");
    expect(text).not.toContain("1 October 2026");
  });
});

describe("GST note", () => {
  const delivered = (state: string) => ({ addressSnapshot: { state } });

  it("gives CGST and SGST inside Telangana", () => {
    expect(gstNote(order({ subtotal: 100 }, delivered("Telangana")))).toBe(
      "Prices include GST at 5% (CGST ₹0.02 + SGST ₹0.03). Place of supply: Telangana.",
    );
  });

  it("gives IGST outside Telangana", () => {
    expect(gstNote(order({ subtotal: 100 }, delivered("Karnataka")))).toBe(
      "Prices include GST at 5% (IGST ₹0.05). Place of supply: Karnataka.",
    );
  });

  it("does not claim prices include GST when tax went on top", () => {
    const note = gstNote(order({ tax: 11_000 }, delivered("Karnataka")));
    expect(note).toBe("Tax is added to the prices shown above. Place of supply: Karnataka.");
    expect(note).not.toMatch(/Prices include|CGST|SGST|IGST|₹/);
  });

  it("prints a CGST and SGST that sum to the GST exactly", () => {
    for (const subtotal of [100, 101, 999, 33_333, 220_000, 1_234_567]) {
      const o = order({ subtotal });
      const printed = gstNote(o).match(/CGST ₹([\d,.]+) \+ SGST ₹([\d,.]+)/);
      expect(printed).not.toBeNull();
      const paise = (s: string) => Math.round(Number(s.replace(/,/g, "")) * 100);
      expect(paise(printed![1]) + paise(printed![2])).toBe(gstFor(o).gstPaise);
    }
  });

  // A real state fits on one line; the snapshot is free text, so nothing says it must.
  const longState = "Dadra and Nagar Haveli and Daman and Diu ".repeat(3).trim();

  it("wraps a note too wide for the page instead of cutting it", async () => {
    const o = order({}, delivered(longState));
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    await buildInvoicePdf(o);
    const lines = draw.mock.calls.map(([text]) => text);
    const start = lines.findIndex((l) => l.startsWith("Prices include GST"));
    const end = lines.findIndex((l) => l.endsWith("Diu."));
    expect(end).toBeGreaterThan(start);
    expect(lines.slice(start, end + 1).join(" ")).toBe(gstNote(o));
  });

  it("keeps every line of the note clear of the footer, whatever the order's length", async () => {
    const footerTop = 48 + 34;
    const one = order({}, delivered(longState)).items[0];
    for (let n = 16; n <= 30; n++) {
      const items = Array.from({ length: n }, (_, i) => ({ ...one, id: `i${i}` }));
      const draw = vi.spyOn(PDFPage.prototype, "drawText");
      await buildInvoicePdf(order({}, { ...delivered(longState), items }));
      const noteLines = draw.mock.calls.filter(([text]) => /Prices include GST|Place of supply|Daman|Diu/.test(text));
      expect(noteLines.length).toBeGreaterThan(1);
      for (const [, opts] of noteLines) expect(opts!.y).toBeGreaterThanOrEqual(footerTop);
      draw.mockRestore();
    }
  });
});

describe("PDFs - seller GSTIN", () => {
  const documents = [
    ["invoice", buildInvoicePdf],
    ["receipt", buildReceiptPdf],
  ] as const;

  it.each(documents)("prints the company GSTIN on the %s", async (_name, build) => {
    expect(await drawnText(() => build(order()))).toContain(`GSTIN: ${GSTIN}`);
  });

  it.each(documents)("ignores an invalid override on the %s", async (_name, build) => {
    vi.stubEnv("SELLER_GSTIN", "36AALCN3064");
    const text = await drawnText(() => build(order()));
    expect(text).toContain(`GSTIN: ${GSTIN}`);
    expect(text).not.toContain("36AALCN3064\n");
  });

  it.each(documents)("lets a valid override replace it on the %s", async (_name, build) => {
    vi.stubEnv("SELLER_GSTIN", " 29aalcn3064d1zk ");
    const text = await drawnText(() => build(order()));
    expect(text).toContain("GSTIN: 29AALCN3064D1ZK");
    expect(text).not.toContain(GSTIN);
  });
});
