// @vitest-environment jsdom
/**
 * /checkout/success — what the customer is told, and when the cart empties.
 *
 * Arriving here proves nothing: the receipt in sessionStorage is written BEFORE
 * the bank redirect, and anyone can open this URL. So the page asks the server
 * (GET /api/orders/[number], owner-scoped) and renders by payment state:
 *
 *   - online + paid      -> confirmed, server total, cart cleared
 *   - online + pending   -> "Confirming your payment", polled for ~30s, cart kept
 *   - online + failed    -> pointed at /checkout/failed, cart kept
 *   - Cash on Delivery   -> confirmed (pending is normal for COD), cart cleared
 *
 * The cart (and the checkout draft) must empty exactly once, and only on a
 * confirmed order. Emptying it on an unpaid order leaves nothing to retry with.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ clear: vi.fn(), clearCheckoutDraft: vi.fn() }));
const fx = vi.hoisted(() => ({
  cart: { clear: (() => {}) as () => void },
  search: "order=NG-26-1001",
  receipt: null as unknown,
  Pass: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(fx.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/cart", () => ({ useCart: () => ({ clear: fx.cart.clear }) }));
vi.mock("@/components/ng/page-shell", () => ({ PageShell: fx.Pass }));
vi.mock("@/components/ng/section", () => ({ Section: fx.Pass }));
vi.mock("@/components/ng/motion", () => ({
  FloatIn: fx.Pass,
  Reveal: fx.Pass,
  Stagger: fx.Pass,
  StaggerItem: fx.Pass,
}));
vi.mock("@/components/ng/button", () => ({ Button: fx.Pass }));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/ui/ui-icon", () => ({ UiIcon: () => null }));
vi.mock("@/components/ng/checkout/no-cancellation", () => ({ NoCancellationNotice: () => null }));
vi.mock("@/components/ng/checkout/order-receipt", () => ({ loadReceipt: () => fx.receipt }));
vi.mock("@/components/ng/checkout/checkout-draft", () => ({
  clearCheckoutDraft: m.clearCheckoutDraft,
}));

import CheckoutSuccessPage from "./page";

type Method = "upi" | "cod";
type Payment = "pending" | "paid" | "failed";

/** The owner-scoped order as GET /api/orders/[number] returns it. */
function serverOrder(paymentMethod: Method, paymentStatus: Payment) {
  return {
    id: "ord-1",
    orderNumber: "NG-26-1001",
    status: "placed",
    paymentStatus,
    paymentMethod,
    paymentProvider: paymentMethod === "upi" ? "sbiepay" : "cod",
    subtotalPaise: 120000,
    discountPaise: 0,
    shippingPaise: 4000,
    taxPaise: 0,
    totalPaise: 124000,
    couponCode: null,
    loyaltyRedeemedPaise: 0,
    currency: "INR",
    addressSnapshot: {
      fullName: "Asha Rao",
      line1: "12 Farm Road",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500001",
    },
    slotSnapshot: { label: "Tomorrow, 7 to 9 AM" },
    placedAt: "2026-10-08T10:00:00.000Z",
    items: [
      {
        id: "item-1",
        productId: "p1",
        variantId: "v1",
        variantSku: "GHEE-500",
        title: "A2 Ghee",
        qty: 1,
        unitPricePaise: 120000,
        lineTotalPaise: 120000,
        snapshot: { unit: "500 ml" },
      },
    ],
    events: [],
  };
}

/**
 * A minimal stand-in for `fetch`'s Response. The page only reads `ok`,
 * `status` and `json()`; a real Response would drag stream timing into tests
 * that also fake timers.
 */
function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
const okOrder = (method: Method, payment: Payment) =>
  reply(200, { ok: true, order: serverOrder(method, payment) });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("fetch", fetchMock);
  fx.cart.clear = m.clear;
  fx.search = "order=NG-26-1001";
  fx.receipt = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Let pending fetches resolve and run any timers due within `ms`. */
async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("/checkout/success — reads the order from the server", () => {
  it("asks the owner-scoped order endpoint for this order number", async () => {
    fetchMock.mockResolvedValue(okOrder("upi", "paid"));

    render(<CheckoutSuccessPage />);
    await advance();

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/orders/NG-26-1001");
  });

  it("does not claim the order before the server answers", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<CheckoutSuccessPage />);

    expect(screen.queryByText("Order confirmed")).toBeNull();
    expect(screen.queryByText(/Total paid/)).toBeNull();
    expect(m.clear).not.toHaveBeenCalled();
  });
});

describe("/checkout/success — online payment", () => {
  it("confirms a paid order with the server's total and empties the cart", async () => {
    // A stale client receipt with a different total must not be what we show.
    fx.receipt = {
      id: "NG-26-1001",
      total: 999,
      payment: { category: "upi", label: "UPI", categoryLabel: "UPI" },
    };
    fetchMock.mockResolvedValue(okOrder("upi", "paid"));

    render(<CheckoutSuccessPage />);
    await advance();

    expect(screen.getByText("Order confirmed")).toBeTruthy();
    expect(screen.getByText(/Total paid/)).toBeTruthy();
    expect(screen.getAllByText("₹1,240").length).toBeGreaterThan(0);
    expect(screen.queryByText("₹999")).toBeNull();
    expect(m.clear).toHaveBeenCalledTimes(1);
    expect(m.clearCheckoutDraft).toHaveBeenCalledTimes(1);
  });

  it("shows 'Confirming your payment' while the bank has not confirmed, and keeps the cart", async () => {
    fetchMock.mockResolvedValue(okOrder("upi", "pending"));

    render(<CheckoutSuccessPage />);
    await advance();

    expect(screen.getByText("Confirming your payment")).toBeTruthy();
    expect(screen.queryByText("Order confirmed")).toBeNull();
    expect(screen.queryByText(/Total paid/)).toBeNull();
    expect(screen.queryByText(/Paid via/)).toBeNull();
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.clearCheckoutDraft).not.toHaveBeenCalled();
  });

  it("polls a pending order and confirms it once the server says paid", async () => {
    fetchMock
      .mockResolvedValueOnce(okOrder("upi", "pending"))
      .mockResolvedValueOnce(okOrder("upi", "pending"))
      .mockResolvedValue(okOrder("upi", "paid"));

    render(<CheckoutSuccessPage />);
    await advance();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(m.clear).not.toHaveBeenCalled();

    await advance(3000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Order confirmed")).toBeTruthy();
    expect(m.clear).toHaveBeenCalledTimes(1);

    // Settled: no more requests.
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops polling after about 30 seconds and says we'll email once confirmed", async () => {
    fetchMock.mockResolvedValue(okOrder("upi", "pending"));

    render(<CheckoutSuccessPage />);
    await advance();
    await advance(30_000);
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBeGreaterThan(5);
    expect(calls).toBeLessThanOrEqual(11);

    expect(screen.getByText(/we'll email you/i)).toBeTruthy();
    expect(screen.queryByText("Order confirmed")).toBeNull();
    expect(m.clear).not.toHaveBeenCalled();

    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it("sends a failed payment to /checkout/failed and keeps the cart", async () => {
    fetchMock.mockResolvedValue(okOrder("upi", "failed"));

    render(<CheckoutSuccessPage />);
    await advance();

    const link = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.startsWith("/checkout/failed"));
    expect(link?.getAttribute("href")).toBe("/checkout/failed?order=NG-26-1001");
    expect(screen.queryByText("Order confirmed")).toBeNull();
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.clearCheckoutDraft).not.toHaveBeenCalled();
  });

  it("keeps trying through a network blip instead of giving up on the first error", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(okOrder("upi", "paid"));

    render(<CheckoutSuccessPage />);
    await advance();
    expect(m.clear).not.toHaveBeenCalled();

    await advance(3000);
    expect(screen.getByText("Order confirmed")).toBeTruthy();
    expect(m.clear).toHaveBeenCalledTimes(1);
  });
});

describe("/checkout/success — Cash on Delivery", () => {
  it("confirms a COD order whose payment is pending (normal for COD) and empties the cart", async () => {
    fetchMock.mockResolvedValue(okOrder("cod", "pending"));

    render(<CheckoutSuccessPage />);
    await advance();

    expect(screen.getByText("Order confirmed")).toBeTruthy();
    expect(screen.queryByText("Confirming your payment")).toBeNull();
    expect(screen.queryByText(/Total paid/)).toBeNull();
    expect(screen.getByText(/Pay on delivery/)).toBeTruthy();
    expect(m.clear).toHaveBeenCalledTimes(1);
    expect(m.clearCheckoutDraft).toHaveBeenCalledTimes(1);

    // Nothing to wait for.
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("/checkout/success — when the server cannot vouch for the order", () => {
  it.each([
    ["the customer is signed out (401)", () => reply(401, { ok: false, error: "unauthenticated" })],
    ["the order is not theirs or does not exist (404)", () => reply(404, { ok: false, error: "not-found" })],
  ])("never confirms, and keeps the cart, when %s", async (_label, respond) => {
    fetchMock.mockResolvedValue(respond());

    render(<CheckoutSuccessPage />);
    await advance();
    await advance(30_000);

    expect(screen.queryByText("Order confirmed")).toBeNull();
    expect(screen.queryByText(/Total paid/)).toBeNull();
    expect(m.clear).not.toHaveBeenCalled();
    // A definitive answer: no point asking again.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not trust a receipt when there is no order number at all", async () => {
    fx.search = "";

    render(<CheckoutSuccessPage />);
    await advance();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Order confirmed")).toBeNull();
    expect(m.clear).not.toHaveBeenCalled();
  });
});

describe("/checkout/success — empties the cart once", () => {
  it("clears the cart exactly once, even under StrictMode's double effects", async () => {
    fetchMock.mockResolvedValue(okOrder("upi", "paid"));

    render(
      <StrictMode>
        <CheckoutSuccessPage />
      </StrictMode>,
    );
    await advance();

    expect(screen.getAllByText("NG-26-1001")).not.toHaveLength(0);
    expect(m.clear).toHaveBeenCalledTimes(1);
  });

  it("does not clear again when re-rendered with a new clear function", async () => {
    fetchMock.mockResolvedValue(okOrder("upi", "paid"));
    const { rerender } = render(<CheckoutSuccessPage />);
    await advance();

    const laterClear = vi.fn();
    fx.cart.clear = laterClear;
    rerender(<CheckoutSuccessPage />);
    await advance();

    expect(m.clear).toHaveBeenCalledTimes(1);
    expect(laterClear).not.toHaveBeenCalled();
  });
});
