// @vitest-environment jsdom
/**
 * /account — the Wallet credit tile.
 *
 * It has to agree with /loyalty, which values the balance at the live redeem
 * rate and floors to whole rupees. It used to read `pointsPerRupee`, a field the
 * config never had, so it fell back to 1 and showed points as rupees.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  balance: 0,
  redeemPointsPerRupee: 10,
  Pass: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/ng/account/account-shell", () => ({ AccountShell: fx.Pass }));
vi.mock("@/components/ng/button", () => ({ Button: fx.Pass }));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/ng/motion", () => ({ Reveal: fx.Pass, Stagger: fx.Pass, StaggerItem: fx.Pass }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ account: { name: "Asha Rao" }, isAuthed: true, loading: false }),
}));
vi.mock("@/lib/loyalty-config", () => ({
  useLoyaltyConfig: () => ({ config: { redeemPointsPerRupee: fx.redeemPointsPerRupee } }),
}));
vi.mock("@/lib/rewards-client", () => ({
  fetchRewards: async () => ({ balance: fx.balance }),
}));
vi.mock("@/lib/orders-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders-client")>()),
  fetchMyOrders: async () => [],
}));

import AccountPage from "./page";

beforeEach(() => {
  fx.balance = 0;
  fx.redeemPointsPerRupee = 10;
});
afterEach(cleanup);

/** The figure printed above the "Wallet credit" label. */
async function walletTile() {
  const label = await screen.findByText("Wallet credit");
  return label.previousElementSibling?.textContent;
}

describe("/account — Wallet credit", () => {
  it("values the balance at the redeem rate, not as rupees", async () => {
    fx.balance = 1234;

    render(<AccountPage />);

    expect(await screen.findByText("₹123")).toBeTruthy();
    expect(await walletTile()).toBe("₹123");
  });

  it("follows the live rate", async () => {
    fx.balance = 1000;
    fx.redeemPointsPerRupee = 4;

    render(<AccountPage />);

    expect(await screen.findByText("₹250")).toBeTruthy();
  });

  it("floors like /loyalty, so nine points is not yet a rupee", async () => {
    fx.balance = 9;

    render(<AccountPage />);

    expect(await screen.findByText("₹0")).toBeTruthy();
  });
});
