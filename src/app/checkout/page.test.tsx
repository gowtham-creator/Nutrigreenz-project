// @vitest-environment jsdom
/**
 * Checkout `handlePlaceOrder` — what happens after the order POST returns.
 *
 * The page is rendered for real; its data hooks, heavy presentational pieces
 * and the network are stubbed. The cases are the ones that decide whether a
 * customer is sent to the bank, sent to the receipt, or left on checkout with
 * their cart intact.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  clear: vi.fn(),
  toastError: vi.fn(),
  saveReceipt: vi.fn(),
  clearCheckoutDraft: vi.fn(),
  navigate: vi.fn(),
}));

// Fixtures are hoisted with the mocks: `vi.mock` factories run before the
// module body, so they cannot see ordinary top-level constants.
const fx = vi.hoisted(() => {
  const address = {
    id: "addr-1",
    fullName: "Asha Rao",
    line1: "12 Farm Road",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
  };
  const slot = { id: "slot-1", label: "Tomorrow · 7–9 AM" };
  return {
    address,
    slot,
    items: [
      {
        lineId: "l1",
        productId: "p1",
        variantId: "v1",
        variantSku: "GHEE-500",
        title: "A2 Ghee",
        qty: 1,
        price: 1200,
        unit: "500 ml",
        image: "/ghee.png",
        variantLabel: "500 ml",
      },
    ],
    rules: {
      minOrderValue: 0,
      freeDeliveryThreshold: 599,
      shippingFlat: 40,
      taxMode: "inclusive",
      deliverySlots: [slot],
    },
    // Presentational shells render their children and nothing else.
    Pass: ({ children }: { children?: ReactNode }) => children,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push, replace: m.replace }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { error: m.toastError, success: vi.fn() } }));

vi.mock("@/components/ng/page-shell", () => ({ PageShell: fx.Pass }));
vi.mock("@/components/ng/section", () => ({ Section: fx.Pass }));
vi.mock("@/components/ng/motion", () => ({
  FloatIn: fx.Pass,
  MagneticHover: fx.Pass,
  Reveal: fx.Pass,
  Stagger: fx.Pass,
  StaggerItem: fx.Pass,
}));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/ui/ui-icon", () => ({ UiIcon: () => null }));
vi.mock("@/components/ng/button", () => ({
  Button: ({
    asChild,
    children,
    onClick,
    disabled,
  }: {
    asChild?: boolean;
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
}));
vi.mock("@/components/ng/checkout/address-picker", () => ({ AddressPicker: () => null }));
vi.mock("@/components/ng/checkout/slot-picker", () => ({ SlotPicker: () => null }));
vi.mock("@/components/ng/checkout/rewards-panel", () => ({
  RewardsPanel: ({
    onApplyCoupon,
  }: {
    onApplyCoupon: (coupon: unknown, discount: number) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onApplyCoupon({ code: "WELCOME50", description: "", type: "flat", value: 50 }, 50)
      }
    >
      apply coupon
    </button>
  ),
}));
vi.mock("@/components/ng/checkout/no-cancellation", () => ({ NoCancellationAck: () => null }));
vi.mock("@/components/ng/checkout/order-summary", () => ({ OrderSummary: () => null }));
vi.mock("@/components/ng/checkout/payment-picker", () => ({
  PaymentPicker: ({ onSelect }: { onSelect: (s: unknown) => void }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onSelect({ category: "upi", id: "upi", label: "UPI", categoryLabel: "UPI" })
        }
      >
        choose upi
      </button>
      <button
        type="button"
        onClick={() =>
          onSelect({
            category: "cod",
            id: "cod",
            label: "Cash on Delivery",
            categoryLabel: "Cash on Delivery",
          })
        }
      >
        choose cod
      </button>
    </div>
  ),
}));
vi.mock("@/components/ng/checkout/checkout-draft", () => ({
  readCheckoutDraft: () => null,
  writeCheckoutDraft: vi.fn(),
  clearCheckoutDraft: m.clearCheckoutDraft,
}));
vi.mock("@/components/ng/checkout/order-receipt", () => ({ saveReceipt: m.saveReceipt }));

// Data hooks.
vi.mock("@/lib/cart", () => ({
  useCart: () => ({ items: fx.items, subtotal: 1200, clear: m.clear }),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthed: true,
    loading: false,
    account: { email: "asha@example.com", phone: "+919800000000" },
  }),
}));
vi.mock("@/lib/commerce", () => ({ useCommerceRules: () => fx.rules }));
vi.mock("@/lib/loyalty-config", () => ({
  useLoyaltyConfig: () => ({
    config: { minRedeemPoints: 100, redeemPointsPerRupee: 10, maxRedeemPercent: 20 },
  }),
}));
vi.mock("@/lib/addresses", () => ({
  useAddresses: () => ({ addresses: [fx.address], defaultAddress: fx.address }),
}));
vi.mock("@/lib/serviceability", () => ({ fetchServiceable: async () => true }));
vi.mock("@/lib/rewards-client", async (importOriginal) => ({
  // The real coupon-reason copy, so the test pins what the customer reads.
  ...(await importOriginal<typeof import("@/lib/rewards-client")>()),
  fetchRewards: async () => ({ balance: 0 }),
}));

import CheckoutPage from "./page";

const GATEWAY_URL = "https://sbiepay.sbi.bank.in/secure/AggregatorHostedListener";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

/**
 * `window.location` is unforgeable in jsdom, so `assign` cannot be spied on
 * in place. Replace the whole object for the test with one whose `assign`
 * records the target — the page only ever calls `window.location.assign`.
 */
const realLocation = window.location;
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, assign: m.navigate },
  });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

async function placeOrderWith(method: "upi" | "cod") {
  render(<CheckoutPage />);
  fireEvent.click(screen.getByRole("button", { name: `choose ${method}` }));
  const pay = await screen.findByRole("button", { name: /^Pay / });
  fireEvent.click(pay);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  return pay;
}

function postedBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe("checkout — online payment (UPI)", () => {
  it("sends the customer to the gateway and keeps the cart until payment is confirmed", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        ok: true,
        orderNumber: "NG-26-1001",
        payment: { action: GATEWAY_URL, fields: {}, reference: "SBI-REF-1" },
      }),
    );

    await placeOrderWith("upi");

    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(GATEWAY_URL));
    expect(postedBody().paymentMethod).toBe("upi");
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.toastError).not.toHaveBeenCalled();
    // The receipt is keyed by the server's order number, ready for the success page.
    expect(m.saveReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: "NG-26-1001" }));
    // Not paid yet: if the bank sends them back, checkout must still be filled in.
    expect(m.clearCheckoutDraft).not.toHaveBeenCalled();
  });

  it("POSTs a hidden form when the gateway hands back form fields", async () => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(function (this: HTMLFormElement) {});
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        ok: true,
        orderNumber: "NG-26-1001",
        payment: { action: GATEWAY_URL, fields: { encData: "abc", mId: "1000605" } },
      }),
    );

    await placeOrderWith("upi");

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const form = submit.mock.contexts[0] as HTMLFormElement;
    expect(form.method.toLowerCase()).toBe("post");
    expect(form.action).toBe(GATEWAY_URL);
    expect(Object.fromEntries(new FormData(form))).toEqual({ encData: "abc", mId: "1000605" });
    expect(m.navigate).not.toHaveBeenCalled();
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
  });

  it.each([
    ["the order route returns 500", () => jsonResponse(500, { ok: false, error: "create-failed" })],
    ["the order route is unavailable (503)", () => jsonResponse(503, { ok: false, error: "unavailable" })],
    [
      "the order is created but no payment link comes back",
      () => jsonResponse(201, { ok: true, orderNumber: "NG-26-1001", payment: null }),
    ],
  ])("stays on checkout with the cart intact when %s", async (_label, respond) => {
    fetchMock.mockResolvedValue(respond());

    const pay = await placeOrderWith("upi");

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/^We couldn't open the payment page/),
      ),
    );
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
    expect(m.saveReceipt).not.toHaveBeenCalled();
    expect(m.clearCheckoutDraft).not.toHaveBeenCalled();
    // The button is usable again so the customer can retry or switch to COD.
    await waitFor(() => expect((pay as HTMLButtonElement).disabled).toBe(false));
  });

  it("stays on checkout with the cart intact on a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await placeOrderWith("upi");

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/^We couldn't open the payment page/),
      ),
    );
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
  });
});

describe("checkout — only SBIePay may receive the customer", () => {
  it.each([
    "https://sbiepay.sbi.bank.in/secure/AggregatorHostedListener",
    "https://integration.sbiepay.sbiuat.bank.in/secure/AggregatorHostedListener",
    "https://pay.sbi.bank.in/listener",
  ])("follows %s", async (action) => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { ok: true, orderNumber: "NG-26-1001", payment: { action, fields: {} } }),
    );

    await placeOrderWith("upi");

    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(action));
    expect(m.toastError).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-SBI host", "https://evil.example/pay"],
    ["plain http", "http://sbiepay.sbi.bank.in/secure/AggregatorHostedListener"],
    ["a look-alike host", "https://sbiepay.sbi.bank.in.evil.example/pay"],
    ["a suffix that is not a subdomain", "https://notsbi.bank.in/pay"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path", "/checkout/success?order=NG-26-1001"],
  ])("refuses %s and shows the payment error instead", async (_label, action) => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(function (this: HTMLFormElement) {});
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        ok: true,
        orderNumber: "NG-26-1001",
        payment: { action, fields: { encData: "abc" } },
      }),
    );

    const pay = await placeOrderWith("upi");

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/^We couldn't open the payment page/),
      ),
    );
    expect(submit).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    await waitFor(() => expect((pay as HTMLButtonElement).disabled).toBe(false));
  });
});

describe("checkout — coming back from the bank's page", () => {
  function pageshow(persisted: boolean) {
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", { value: persisted });
    window.dispatchEvent(event);
  }

  it("re-enables the pay button when the page is restored from the back/forward cache", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        ok: true,
        orderNumber: "NG-26-1001",
        payment: { action: GATEWAY_URL, fields: {} },
      }),
    );

    await placeOrderWith("upi");
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(GATEWAY_URL));
    // Frozen mid-submit, exactly as the customer left it.
    expect(
      (screen.getByRole("button", { name: /Placing order/ }) as HTMLButtonElement).disabled,
    ).toBe(true);

    act(() => pageshow(true));

    const pay = await screen.findByRole("button", { name: /^Pay / });
    expect((pay as HTMLButtonElement).disabled).toBe(false);
  });

  it("ignores an ordinary (non-restored) pageshow", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        ok: true,
        orderNumber: "NG-26-1001",
        payment: { action: GATEWAY_URL, fields: {} },
      }),
    );

    await placeOrderWith("upi");
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(GATEWAY_URL));

    act(() => pageshow(false));

    expect(screen.getByRole("button", { name: /Placing order/ })).toBeTruthy();
  });
});

describe("checkout — Cash on Delivery", () => {
  it("clears the cart and goes to the success page with the server's order number", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { ok: true, orderNumber: "NG-26-1001", payment: null }),
    );

    await placeOrderWith("cod");

    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/checkout/success?order=NG-26-1001"));
    expect(postedBody().paymentMethod).toBe("cod");
    expect(m.clear).toHaveBeenCalledTimes(1);
    // A COD order is placed the moment the server creates it.
    expect(m.clearCheckoutDraft).toHaveBeenCalledTimes(1);
    expect(m.navigate).not.toHaveBeenCalled();
    expect(m.toastError).not.toHaveBeenCalled();
  });

  /*
   * A COD order the server did not create must not end on the success page.
   * This used to fall through to "Order confirmed" with a client-made order
   * number, clearing the cart, for every non-OK answer but 401.
   */
  it.each([
    ["the order route returns 500", () => Promise.resolve(jsonResponse(500, { ok: false, error: "create-failed" }))],
    ["the order route is unavailable (503)", () => Promise.resolve(jsonResponse(503, { ok: false, error: "unavailable" }))],
    ["the request fails on the network", () => Promise.reject(new TypeError("Failed to fetch"))],
    [
      "the response carries no order number",
      () => Promise.resolve(jsonResponse(201, { ok: true, payment: null })),
    ],
  ])("stays on checkout with the cart intact when %s", async (_label, respond) => {
    fetchMock.mockImplementation(respond);

    const pay = await placeOrderWith("cod");

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/^We couldn't place your order/),
      ),
    );
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.saveReceipt).not.toHaveBeenCalled();
    expect(m.clearCheckoutDraft).not.toHaveBeenCalled();
    await waitFor(() => expect((pay as HTMLButtonElement).disabled).toBe(false));
  });

  it("names the out-of-stock item on 409 and keeps the cart", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { ok: false, error: "out-of-stock", variantIds: ["v1"] }),
    );

    const pay = await placeOrderWith("cod");

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith(expect.stringMatching(/A2 Ghee.*out of stock/)),
    );
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.saveReceipt).not.toHaveBeenCalled();
    await waitFor(() => expect((pay as HTMLButtonElement).disabled).toBe(false));
  });

  it("explains a rejected coupon, drops it, and keeps the cart", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { ok: false, error: "coupon-invalid", reason: "expired" }),
    );

    render(<CheckoutPage />);
    fireEvent.click(screen.getByRole("button", { name: "apply coupon" }));
    fireEvent.click(screen.getByRole("button", { name: "choose cod" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Pay / }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(postedBody().couponCode).toBe("WELCOME50");

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/WELCOME50.*This coupon has expired\./),
      ),
    );
    expect(m.clear).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.saveReceipt).not.toHaveBeenCalled();

    // The next attempt goes out without the coupon.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { ok: true, orderNumber: "NG-26-1002", payment: null }),
    );
    const pay = await screen.findByRole("button", { name: /^Pay / });
    await waitFor(() => expect((pay as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(pay);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const retried = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as Record<string, unknown>;
    expect(retried.couponCode).toBeNull();
    expect(retried.discountPaise).toBe(0);
  });
});

describe("checkout — rejected before payment, either method", () => {
  it("names the out-of-stock item for an online order too, instead of a gateway error", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { ok: false, error: "out-of-stock", variantIds: ["v1"] }),
    );

    await placeOrderWith("upi");

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith(expect.stringMatching(/A2 Ghee.*out of stock/)),
    );
    expect(m.navigate).not.toHaveBeenCalled();
    expect(m.clear).not.toHaveBeenCalled();
  });
});

describe("checkout — expired session", () => {
  it.each(["upi", "cod"] as const)(
    "sends a %s customer back to sign in on 401, keeping the cart",
    async (method) => {
      fetchMock.mockResolvedValue(jsonResponse(401, { ok: false, error: "unauthenticated" }));

      await placeOrderWith(method);

      await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/auth?next=/checkout"));
      expect(m.toastError).toHaveBeenCalledWith("Please sign in again to place your order.");
      expect(m.clear).not.toHaveBeenCalled();
      expect(m.push).not.toHaveBeenCalled();
      expect(m.navigate).not.toHaveBeenCalled();
    },
  );
});
