// @vitest-environment jsdom
/**
 * The rewards panel on its own: what it asks the coupon APIs and what it hands
 * back. The page test covers the panel and the page together; these are the two
 * things only visible from here, a prop changing and the coupon it builds.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));

import { RewardsPanel } from "./rewards-panel";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const props: ComponentProps<typeof RewardsPanel> = {
  subtotal: 1200,
  appliedCoupon: null,
  onApplyCoupon: () => {},
  onRemoveCoupon: () => {},
  loyaltyAvailable: 0,
  loyaltyQuote: { points: 0, discountPaise: 0, blocked: "no-balance" },
  loyaltyRedeemed: 0,
  onToggleLoyalty: () => {},
  loyaltyRules: { redeemPointsPerRupee: 10, minRedeemPoints: 100, maxRedeemPercent: 20 },
  deliveryPincode: "500075",
  deliveryAddressText: "Flat 402, SAS Crown",
};

const offerRequests = () =>
  fetchMock.mock.calls
    .filter(([input]) => String(input) === "/api/rewards/available-coupons")
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);

function replyToCoupon(stacksWithLoyalty: boolean | undefined) {
  fetchMock.mockImplementation(async (input) =>
    Response.json(
      String(input) === "/api/rewards/validate-coupon"
        ? { valid: true, discountPaise: 5000, reason: "ok", coupon: { code: "SOLO50" }, stacksWithLoyalty }
        : { eligible: [], almostThere: [] },
    ),
  );
}

async function apply() {
  fireEvent.change(screen.getByPlaceholderText("e.g. FRESH50"), { target: { value: "SOLO50" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  replyToCoupon(true);
});
afterEach(cleanup);

describe("RewardsPanel — offers", () => {
  it("asks again when the delivery address changes, on the same pincode", async () => {
    const { rerender } = render(<RewardsPanel {...props} />);
    await waitFor(() => expect(offerRequests()).toHaveLength(1));
    expect(offerRequests()[0].addressText).toBe("Flat 402, SAS Crown");

    // Two societies can share a pincode, so the pincode alone wouldn't re-run this.
    rerender(<RewardsPanel {...props} deliveryAddressText="Villa 9, Green Park" />);

    await waitFor(() => expect(offerRequests()).toHaveLength(2));
    expect(offerRequests()[1].addressText).toBe("Villa 9, Green Park");
  });

  it("sends no address rather than an empty one when none is selected", async () => {
    render(<RewardsPanel {...props} deliveryAddressText={null} />);
    await waitFor(() => expect(offerRequests()).toHaveLength(1));
    expect(offerRequests()[0].addressText).toBeNull();
  });
});

describe("RewardsPanel — the coupon it hands back", () => {
  it.each([
    ["false", false, false],
    ["true", true, true],
    // An older server: the same default the route and createOrder use.
    ["absent", undefined, true],
  ])("passes on stacksWithLoyalty when the server says %s", async (_label, reply, expected) => {
    replyToCoupon(reply);
    const onApplyCoupon = vi.fn();
    render(<RewardsPanel {...props} onApplyCoupon={onApplyCoupon} />);

    await apply();

    await waitFor(() => expect(onApplyCoupon).toHaveBeenCalledTimes(1));
    expect(onApplyCoupon.mock.calls[0][0]).toMatchObject({
      code: "SOLO50",
      stacksWithLoyalty: expected,
    });
  });
});
