/**
 * The order email's "Payment" line.
 *
 * Driven through sendOrderPlacedEmail with the transport and every side channel
 * mocked; the rendered HTML is read back from what would have been sent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  getOrder: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ sendEmail: m.sendEmail, isEmailConfigured: () => true }));
vi.mock("@/lib/orders", () => ({ getOrder: m.getOrder }));
vi.mock("@/lib/notification-templates", () => ({ render: vi.fn(() => ({ body: "" })) }));
vi.mock("@/lib/sms", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/invoice-pdf", () => ({ billingAttachments: vi.fn(async () => []) }));
vi.mock("@/lib/admin-order-alerts", () => ({ sendAdminOrderAlert: vi.fn() }));

import { sendOrderPlacedEmail } from "@/lib/order-emails";

const ORDER = {
  id: "ord-1",
  orderNumber: "NG-26-1001",
  userEmail: "asha@example.com",
  userPhone: null,
  status: "placed",
  paymentStatus: "paid",
  paymentMethod: "upi",
  paymentProvider: "sbiepay",
  paidAt: "2026-10-01T10:05:00Z",
  subtotalPaise: 220_000,
  discountPaise: 0,
  shippingPaise: 0,
  taxPaise: 0,
  totalPaise: 220_000,
  couponCode: null,
  loyaltyRedeemedPaise: 0,
  currency: "INR",
  addressSnapshot: { fullName: "Asha Rao", pincode: "500001" },
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
      unitPricePaise: 220_000,
      lineTotalPaise: 220_000,
      snapshot: null,
    },
  ],
  events: [],
};

async function paymentLineFor(overrides: Record<string, unknown>): Promise<string> {
  m.getOrder.mockResolvedValue({ ...ORDER, ...overrides });
  await sendOrderPlacedEmail("ord-1");
  const html = m.sendEmail.mock.calls[0][0].html as string;
  const at = html.indexOf(">Payment<");
  expect(at).toBeGreaterThan(-1);
  return html.slice(at, at + 400).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.sendEmail.mockResolvedValue(undefined);
});

describe("order email - Payment line", () => {
  it("names the gateway for a paid online order", async () => {
    expect(await paymentLineFor({})).toContain("Paid · SBIePay");
  });

  it("never says 'Paid · none'", async () => {
    const line = await paymentLineFor({ paymentProvider: "none" });
    expect(line).toContain("Paid · Online");
    expect(line).not.toMatch(/none/i);
  });

  it("says 'Paid · Cash on delivery' for a COD order marked paid", async () => {
    const line = await paymentLineFor({ paymentMethod: "cod", paymentProvider: "none" });
    expect(line).toContain("Paid · Cash on delivery");
  });

  it("says Pending for an unpaid order", async () => {
    const line = await paymentLineFor({ paymentStatus: "pending", paidAt: null });
    expect(line).toContain("Pending");
  });
});
