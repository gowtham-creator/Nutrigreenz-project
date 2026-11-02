// @vitest-environment jsdom
/**
 * The wallet page advertises referrals, so it has to stop when the programme
 * does. Only that part is pinned here.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getReferralConfig: vi.fn(),
  isReferralProgrammeOpen: vi.fn(),
  getLoyaltyConfig: vi.fn(),
  // Hoisted with the mocks: `vi.mock` factories run before the module body.
  Pass: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/seo", () => ({ pageMeta: (x: object) => x }));
vi.mock("@/components/ng/account/account-shell", () => ({ AccountShell: m.Pass }));
vi.mock("@/components/ng/button", () => ({ Button: m.Pass }));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/ui/ui-icon", () => ({ UiIcon: () => null }));
vi.mock("@/components/ng/motion", () => ({ Reveal: m.Pass, Stagger: m.Pass, StaggerItem: m.Pass }));
vi.mock("@/lib/customer-session", () => ({ getCustomerSession: async () => null }));
vi.mock("@/lib/rewards", () => ({
  getLoyaltyConfig: m.getLoyaltyConfig,
  loyaltyBalance: vi.fn(),
  listLoyaltyLedger: vi.fn(),
}));
vi.mock("@/lib/referrals", () => ({
  getReferralConfig: m.getReferralConfig,
  isReferralProgrammeOpen: m.isReferralProgrammeOpen,
}));

import LoyaltyPage from "./page";

afterEach(cleanup);
beforeEach(() => {
  m.getLoyaltyConfig.mockResolvedValue({
    earnPointsPerRupee: 1,
    redeemPointsPerRupee: 10,
    minRedeemPoints: 100,
    maxRedeemPercent: 20,
    expiryMonths: 12,
    earnEnabled: true,
  });
  m.getReferralConfig.mockResolvedValue({
    enabled: true,
    referrerPoints: 200,
    refereeDiscountPaise: 10_000,
  });
});

describe("/loyalty — referrals", () => {
  it("advertises referrals while the programme is open", async () => {
    m.isReferralProgrammeOpen.mockResolvedValue(true);

    render(await LoyaltyPage());

    expect(screen.getByText("Get your referral link")).toBeTruthy();
    expect(screen.getByText(/Refer a friend/)).toBeTruthy();
    expect(screen.getByText(/every referral earns/)).toBeTruthy();
  });

  it("says nothing about referrals once the programme is closed", async () => {
    m.isReferralProgrammeOpen.mockResolvedValue(false);

    render(await LoyaltyPage());

    expect(screen.queryByText("Get your referral link")).toBeNull();
    expect(screen.queryByText(/Refer a friend/)).toBeNull();
    expect(screen.queryByText(/every referral earns/)).toBeNull();
    expect(screen.getByText(/Every order earns/)).toBeTruthy();
  });
});
