// @vitest-environment jsdom
/**
 * /checkout/failed: honest about what we know, and never an invitation to pay
 * twice.
 *
 * Some customers land here with their money already taken: the bank could not
 * be asked, or had not finished. Telling them it "was returned by your bank" or
 * will be "refunded automatically" asserts things we do not know, and a
 * "Try again" button on that page is how one order gets paid for twice.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  search: "",
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
vi.mock("@/components/ng/page-shell", () => ({ PageShell: fx.Pass }));
vi.mock("@/components/ng/section", () => ({ Section: fx.Pass }));
vi.mock("@/components/ng/motion", () => ({ FloatIn: fx.Pass, Reveal: fx.Pass }));
vi.mock("@/components/ng/button", () => ({ Button: fx.Pass }));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/ui/ui-icon", () => ({ UiIcon: () => null }));
vi.mock("@/components/ui/app-icon", () => ({ AppIcon: () => null }));

import CheckoutFailedPage from "./page";

afterEach(cleanup);

function renderWith(search: string) {
  fx.search = search;
  return render(<CheckoutFailedPage />);
}

const hrefs = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));
const tryAgainOffered = () => hrefs().includes("/checkout");

/** Claims about the customer's money we cannot back up from this page. */
const UNKNOWABLE = /returned by your bank|refunded automatically|returned automatically|will be returned|releases it/i;

describe("/checkout/failed — payment not confirmed yet", () => {
  it.each(["pending", "unconfirmed"])(
    "reason=%s says we couldn't confirm it, not to pay again, and offers no Try again",
    (reason) => {
      renderWith(`order=NG-26-1001&reason=${reason}`);

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "We couldn't confirm your payment yet",
      );
      expect(document.body.textContent).toContain(
        "If money left your account, don't pay again; we'll confirm it shortly and email you.",
      );
      expect(tryAgainOffered()).toBe(false);
      expect(hrefs()).toContain("/contact");
      expect(screen.getByText("NG-26-1001")).toBeTruthy();
    },
  );

  // What the callback sends today when the bank's answer is missing or does
  // not match: the order is left pending for the sweep, so the money may be taken.
  it.each(["not-found", "reference-mismatch"])(
    "treats the callback's '%s' (left pending for the sweep) as unconfirmed",
    (reason) => {
      renderWith(`order=NG-26-1001&reason=${reason}`);

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "We couldn't confirm your payment yet",
      );
      expect(tryAgainOffered()).toBe(false);
    },
  );
});

describe("/checkout/failed — the bank said no", () => {
  it.each(["declined", "failed", "attempt_fail", "cancel", "expired"])(
    "reason=%s offers Try again",
    (reason) => {
      renderWith(`order=NG-26-1001&reason=${reason}`);

      expect(tryAgainOffered()).toBe(true);
    },
  );
});

describe("/checkout/failed — never asserts what we do not know", () => {
  it.each([
    "",
    "declined",
    "failed",
    "attempt_fail",
    "cancel",
    "expired",
    "amount-mismatch",
    "unknown-order",
    "no-reference",
    "unavailable",
    "pending",
    "unconfirmed",
    "something-new",
  ])("reason=%j makes no refund or hold claims", (reason) => {
    renderWith(`order=NG-26-1001&reason=${reason}`);

    expect(document.body.textContent).not.toMatch(UNKNOWABLE);
  });

  it("does not offer Try again after an amount mismatch", () => {
    renderWith("order=NG-26-1001&reason=amount-mismatch");

    expect(tryAgainOffered()).toBe(false);
  });
});

describe("/checkout/failed — unknown reasons", () => {
  it.each([
    "Your refund has been processed",
    "<b>call 0000000000 for a refund</b>",
    "fetch failed",
    "constructor",
    "__proto__",
    "toString",
  ])("renders %j as the generic message and never echoes it", (reason) => {
    renderWith(`order=NG-26-1001&reason=${encodeURIComponent(reason)}`);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Your payment did not complete",
    );
    expect(document.body.textContent).not.toContain(reason);
  });

  it("does not echo a crafted order reference that is not an order number", () => {
    renderWith(`order=${encodeURIComponent("Refund ready, call 0000000000")}&reason=declined`);

    expect(document.body.textContent).not.toContain("call 0000000000");
  });
});
