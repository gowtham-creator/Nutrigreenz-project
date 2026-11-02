// @vitest-environment jsdom
/**
 * The control center must only show what is real, and its sub-nav must land.
 *
 * Two hard-coded cards used to sit at the foot of this page, listing Razorpay
 * and "COD off" while the shop ran SBIePay with COD on, and shipping zones that
 * never existed. One of them also carried the "Payment" anchor, so the anchor
 * is pinned here along with their absence.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  Pass: ({ children }: { children?: ReactNode }) => children,
  Nothing: () => null,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/ng/admin/admin-shell", () => ({ AdminShell: fx.Pass, Card: fx.Pass, Pill: fx.Pass }));
vi.mock("@/components/ui/icon", () => ({ Icon: fx.Nothing }));
vi.mock("@/components/ui/ui-icon", () => ({ UiIcon: fx.Nothing }));
vi.mock("@/components/ng/admin/super/controls", () => ({
  NumberField: fx.Nothing,
  Toggle: fx.Nothing,
  SaveBar: fx.Nothing,
}));
vi.mock("@/components/ng/admin/super/command-center", () => ({
  CommandCenterHero: fx.Nothing,
  SectionHeader: fx.Nothing,
  PrimarySection: fx.Pass,
}));
vi.mock("@/components/ng/admin/super/coupon-campaign-builder", () => ({ CouponCampaignBuilder: fx.Nothing }));
vi.mock("@/components/ng/admin/super/payment-gateway-panel", () => ({
  PaymentGatewayPanel: () => <div>gateway panel</div>,
}));
vi.mock("@/components/ng/admin/super/commerce-config", () => ({ CommerceConfigPanel: fx.Nothing }));
vi.mock("@/components/ng/admin/super/referral-config", () => ({ ReferralConfigSection: fx.Nothing }));
vi.mock("@/components/ng/admin/super/roles-and-logs", () => ({ RolesAndLogs: fx.Nothing }));
vi.mock("@/components/ng/admin/when-visible", () => ({ WhenVisible: fx.Pass }));
vi.mock("@/lib/admin-auth", () => ({ getAdminRole: () => "superadmin", getAdminEmail: () => "owner@example.com" }));
vi.mock("@/lib/admin-get", () => ({ adminGet: async () => null, invalidateAdminGet: () => {} }));

import AdminConfig from "./page";

afterEach(cleanup);

describe("/admin/config", () => {
  it("shows no invented shipping zones or payment methods", () => {
    render(<AdminConfig />);

    for (const stale of ["Shipping zones", "Payment methods", "UPI · Razorpay", "Mumbai"]) {
      expect(screen.queryByText(stale)).toBeNull();
    }
  });

  it("has no sub-nav link left pointing at a removed section", () => {
    render(<AdminConfig />);

    expect(screen.queryByRole("link", { name: "Shipping" })).toBeNull();
  });

  it("lands the Payment link on the real gateway panel", () => {
    const { container } = render(<AdminConfig />);

    expect(screen.getByRole("link", { name: "Payment" }).getAttribute("href")).toBe("#payment");
    expect(container.querySelector("#payment")?.textContent).toContain("gateway panel");
  });
});
