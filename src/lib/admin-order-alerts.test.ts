/**
 * Operator "new order" alert — the Customer row.
 *
 * `customerName` is private, so it is exercised through `sendAdminOrderAlert`
 * with email, the admin roster and the order store mocked, reading the name
 * back out of the rendered HTML.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  getOrder: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ sendEmail: m.sendEmail, isEmailConfigured: () => true }));
vi.mock("@/lib/admin-identity", () => ({ adminMailbox: (email: string) => email }));
vi.mock("@/lib/orders", () => ({ getOrder: m.getOrder }));
vi.mock("@/lib/supabase-admin", () => {
  // Just enough of the query builder for the two roster reads.
  const result = (data: unknown) => ({ data, error: null });
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: async () => result([{ email: "ops@nutrigreenz.farm", status: "active" }]),
        in: async () => result(table === "admin_security" ? [] : null),
      }),
    }),
  };
  return { isSupabaseConfigured: true, supabaseAdmin: () => db };
});

import { sendAdminOrderAlert, sendAdminOrderCancelledAlert } from "./admin-order-alerts";

function orderWith(addressSnapshot: Record<string, unknown> | null) {
  return {
    id: "ord-1",
    orderNumber: "NG-26-1001",
    totalPaise: 220_000,
    paymentMethod: "upi",
    paymentStatus: "paid",
    userEmail: "asha@example.com",
    userPhone: "+919800000000",
    items: [{ title: "A2 Ghee", variantSku: "GHEE-500", qty: 1, lineTotalPaise: 220_000 }],
    addressSnapshot,
  };
}

/** The value cell of the alert's "Customer" row. */
async function customerCell(addressSnapshot: Record<string, unknown> | null): Promise<string> {
  m.getOrder.mockResolvedValue(orderWith(addressSnapshot));
  await sendAdminOrderAlert("ord-1");
  expect(m.sendEmail).toHaveBeenCalledTimes(1);
  const { html } = m.sendEmail.mock.calls[0][0] as { html: string };
  const match = html.match(/>Customer<\/td>\s*<td[^>]*>([^<]*)<\/td>/);
  expect(match).not.toBeNull();
  return match![1];
}

beforeEach(() => {
  m.sendEmail.mockReset();
  m.sendEmail.mockResolvedValue(undefined);
  // The customer-name tests read the single roster email; the always-list
  // has its own tests below.
  process.env.ORDER_ALERT_ALWAYS = "";
});

describe("admin order alert — customer name", () => {
  it("uses fullName, the field saved addresses actually carry", async () => {
    expect(await customerCell({ fullName: "Asha Rao", name: "Old Name", line1: "12 Farm Rd" })).toBe(
      "Asha Rao",
    );
  });

  it("falls back to name for older snapshots", async () => {
    expect(await customerCell({ name: "Ravi Kumar", line1: "12 Farm Rd" })).toBe("Ravi Kumar");
  });

  it("skips a blank fullName and falls back to name", async () => {
    expect(await customerCell({ fullName: "   ", name: "Ravi Kumar" })).toBe("Ravi Kumar");
  });

  it("trims the name", async () => {
    expect(await customerCell({ fullName: "  Asha Rao  " })).toBe("Asha Rao");
  });

  it("shows — when the snapshot has no name", async () => {
    expect(await customerCell({ line1: "12 Farm Rd", fullName: 42 })).toBe("—");
  });

  it("shows — when there is no address snapshot", async () => {
    expect(await customerCell(null)).toBe("—");
  });

  it("escapes the name before putting it in HTML", async () => {
    expect(await customerCell({ fullName: '<img src=x onerror="x">' })).toBe(
      "&lt;img src=x onerror=&quot;x&quot;&gt;",
    );
  });
});

describe("admin order alert — always-notify inboxes", () => {
  const sentTo = () => m.sendEmail.mock.calls.map((c) => (c[0] as { to: string }).to);

  it("also emails the owner's inbox by default, alongside the admin roster", async () => {
    delete process.env.ORDER_ALERT_ALWAYS;
    m.getOrder.mockResolvedValue(orderWith({ fullName: "Asha Rao" }));
    await sendAdminOrderAlert("ord-1");
    expect(sentTo()).toEqual(["ops@nutrigreenz.farm", "nutrigreenzfarmtech@gmail.com"]);
  });

  it("takes the list from ORDER_ALERT_ALWAYS and sends each inbox one copy", async () => {
    process.env.ORDER_ALERT_ALWAYS = "Owner@Example.com, ops@nutrigreenz.farm, not-an-email";
    m.getOrder.mockResolvedValue(orderWith({ fullName: "Asha Rao" }));
    await sendAdminOrderAlert("ord-1");
    expect(sentTo()).toEqual(["ops@nutrigreenz.farm", "Owner@Example.com"]);
  });

  it("can be switched off with an empty ORDER_ALERT_ALWAYS", async () => {
    process.env.ORDER_ALERT_ALWAYS = "";
    m.getOrder.mockResolvedValue(orderWith({ fullName: "Asha Rao" }));
    await sendAdminOrderAlert("ord-1");
    expect(sentTo()).toEqual(["ops@nutrigreenz.farm"]);
  });
});

describe("admin order alert — cancelled", () => {
  const cancelled = (overrides: Record<string, unknown> = {}) => ({
    ...orderWith({ fullName: "Asha Rao" }),
    status: "cancelled",
    events: [
      { status: "placed", by: "system", note: "Order placed", at: "2026-10-25T04:48:05Z" },
      { status: "cancelled", by: "ops@nutrigreenz.farm", note: "Out of stock <today>", at: "2026-10-25T06:00:00Z" },
    ],
    ...overrides,
  });

  it("says who cancelled it and why, linking straight to the order", async () => {
    m.getOrder.mockResolvedValue(cancelled());
    await sendAdminOrderCancelledAlert("ord-1");
    const { subject, html } = m.sendEmail.mock.calls[0][0] as { subject: string; html: string };
    expect(subject).toBe("Order NG-26-1001 cancelled · ₹2,200.00");
    expect(html).toContain("Order cancelled");
    expect(html).toContain("ops@nutrigreenz.farm");
    expect(html).toContain("Out of stock &lt;today&gt;");
    expect(html).toContain("/admin/orders/ord-1");
  });

  it("flags the refund the team now owes on a paid online order", async () => {
    m.getOrder.mockResolvedValue(cancelled());
    await sendAdminOrderCancelledAlert("ord-1");
    const { html } = m.sendEmail.mock.calls[0][0] as { html: string };
    expect(html).toContain("Refund due: ₹2,200.00 (refund it in the payment gateway)");
  });

  it("owes nothing on an unpaid cash-on-delivery order", async () => {
    m.getOrder.mockResolvedValue(cancelled({ paymentMethod: "cod", paymentStatus: "pending" }));
    await sendAdminOrderCancelledAlert("ord-1");
    const { html } = m.sendEmail.mock.calls[0][0] as { html: string };
    expect(html).not.toContain("Refund due");
  });
});
