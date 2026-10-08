// @vitest-environment jsdom
/**
 * /checkout/success empties the cart — once.
 *
 * An online order keeps its cart through the bank redirect (so /checkout/failed
 * can offer "Try again"); arriving here is the signal it was paid. Clearing more
 * than once is harmless today, but clearing on every render would wipe anything
 * the customer adds afterwards from this page.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ clear: vi.fn() }));
const fx = vi.hoisted(() => ({
  cart: { clear: (() => {}) as () => void },
  Pass: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("order=NG-26-1001"),
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
vi.mock("@/components/ng/checkout/order-summary", () => ({ OrderSummary: () => null }));
vi.mock("@/components/ng/checkout/no-cancellation", () => ({ NoCancellationNotice: () => null }));
vi.mock("@/components/ng/checkout/order-receipt", () => ({ loadReceipt: () => null }));

import CheckoutSuccessPage from "./page";

afterEach(cleanup);

describe("/checkout/success", () => {
  it("clears the cart exactly once, even under StrictMode's double effects", async () => {
    fx.cart.clear = m.clear;

    render(
      <StrictMode>
        <CheckoutSuccessPage />
      </StrictMode>,
    );

    expect(await screen.findAllByText("NG-26-1001")).not.toHaveLength(0);
    expect(m.clear).toHaveBeenCalledTimes(1);
  });

  it("does not clear again when re-rendered with a new clear function", async () => {
    fx.cart.clear = m.clear;
    const { rerender } = render(<CheckoutSuccessPage />);
    await screen.findAllByText("NG-26-1001");

    const laterClear = vi.fn();
    fx.cart.clear = laterClear;
    rerender(<CheckoutSuccessPage />);

    expect(m.clear).toHaveBeenCalledTimes(1);
    expect(laterClear).not.toHaveBeenCalled();
  });
});
