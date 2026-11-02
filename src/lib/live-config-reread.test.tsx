// @vitest-environment jsdom
/**
 * The rule providers sit in the root layout and mount once per visit, so they
 * have to re-read for themselves: on the way into the cart or checkout, and
 * when a tab comes back. Otherwise an open tab shows a fee the server dropped.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { CommerceProvider, useCommerceRules, useCommerceStatus } from "@/lib/commerce";
import { LoyaltyConfigProvider, useLoyaltyConfig } from "@/lib/loyalty-config";

const rulesPayload = (shippingFlatPaise: number) => ({
  ok: true,
  rules: {
    minOrderPaise: 100,
    freeDeliveryThresholdPaise: 99_900,
    shippingType: "flat",
    shippingFlatPaise,
    shippingSlabs: [],
    taxMode: "inclusive",
    taxRateBps: 0,
    currency: "INR",
    deliverySlots: [{ id: "s1", label: "Morning", windowText: null }],
  },
});

function Probe() {
  const rules = useCommerceRules();
  const { slotsStatus } = useCommerceStatus();
  const { config } = useLoyaltyConfig();
  return (
    <div>
      <span data-testid="flat">{rules.shippingFlat}</span>
      <span data-testid="status">{slotsStatus}</span>
      <span data-testid="redeem">{config.redeemPointsPerRupee}</span>
    </div>
  );
}

const tree = (
  <CommerceProvider>
    <LoyaltyConfigProvider>
      <Probe />
    </LoyaltyConfigProvider>
  </CommerceProvider>
);

let flat = 5000;
let redeem = 10;
let rulesFail = false;
let fetchMock: ReturnType<typeof vi.fn>;

const calls = (url: string) => fetchMock.mock.calls.filter((c) => c[0] === url).length;
const fireVisible = () =>
  act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

beforeEach(() => {
  nav.pathname = "/";
  flat = 5000;
  redeem = 10;
  rulesFail = false;
  window.localStorage.clear();
  fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/commerce-rules") {
      if (rulesFail) throw new Error("offline");
      return { ok: true, json: async () => rulesPayload(flat) };
    }
    return { ok: true, json: async () => ({ ok: true, config: { redeemPointsPerRupee: redeem } }) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(cleanup);

/** Pretend the mount read happened longer ago than the re-read window. */
function later() {
  const now = Date.now() + 31_000;
  vi.spyOn(Date, "now").mockReturnValue(now);
}

describe("re-reading the live rules", () => {
  it("picks up a changed fee and redeem rate when the tab comes back", async () => {
    render(tree);
    await waitFor(() => expect(screen.getByTestId("flat").textContent).toBe("50"));

    flat = 2500;
    redeem = 20;
    later();
    await fireVisible();

    await waitFor(() => expect(screen.getByTestId("flat").textContent).toBe("25"));
    await waitFor(() => expect(screen.getByTestId("redeem").textContent).toBe("20"));
  });

  it("does not re-read a tab that was only away for a moment", async () => {
    render(tree);
    await waitFor(() => expect(screen.getByTestId("flat").textContent).toBe("50"));
    await fireVisible();
    expect(calls("/api/commerce-rules")).toBe(1);
    expect(calls("/api/loyalty-config")).toBe(1);
  });

  it("re-reads on the way into checkout", async () => {
    const view = render(tree);
    await waitFor(() => expect(screen.getByTestId("flat").textContent).toBe("50"));

    flat = 2500;
    later();
    nav.pathname = "/checkout";
    view.rerender(
      <CommerceProvider>
        <LoyaltyConfigProvider>
          <Probe />
        </LoyaltyConfigProvider>
      </CommerceProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("flat").textContent).toBe("25"));
  });

  it("keeps the slot list usable when a quiet re-read fails", async () => {
    render(tree);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("live"));

    rulesFail = true;
    later();
    await fireVisible();

    await waitFor(() => expect(calls("/api/commerce-rules")).toBe(2));
    expect(screen.getByTestId("status").textContent).toBe("live");
  });
});
