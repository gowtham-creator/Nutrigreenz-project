// @vitest-environment jsdom
/**
 * The /sitemap page is linked from the footer, so it must not list a feature
 * that is switched off, or a link that goes nowhere.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getStorefrontFlags: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/seo", () => ({ pageMeta: (x: object) => x }));
vi.mock("@/lib/referrals", () => ({ getStorefrontFlags: m.getStorefrontFlags }));
vi.mock("@/components/ng/section", () => ({
  Section: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ng/page-shell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => children,
  PageHero: () => null,
}));

import SitemapPage from "./page";

const ALL_ON = {
  subscriptions: true,
  referrals: true,
  community_bundles: true,
  captain_network: true,
  auto_product_badges: true,
};

const links = () =>
  screen.getAllByRole("link").map((a) => a.getAttribute("href"));

afterEach(cleanup);
beforeEach(() => {
  m.getStorefrontFlags.mockResolvedValue(ALL_ON);
});

describe("/sitemap", () => {
  it("lists every feature while they are on", async () => {
    render(await SitemapPage());
    expect(links()).toEqual(
      expect.arrayContaining(["/referral", "/captain", "/community/bundle"]),
    );
  });

  it("never lists the subscriptions page, which does not exist", async () => {
    render(await SitemapPage());
    expect(links()).not.toContain("/account/subscriptions");
  });

  it("drops referrals when the programme is closed", async () => {
    m.getStorefrontFlags.mockResolvedValue({ ...ALL_ON, referrals: false });
    render(await SitemapPage());
    expect(links()).not.toContain("/referral");
    expect(links()).toContain("/account/orders");
  });

  it("drops the captain section and its note when the network is off", async () => {
    m.getStorefrontFlags.mockResolvedValue({ ...ALL_ON, captain_network: false });
    render(await SitemapPage());
    expect(links().some((href) => href?.startsWith("/captain"))).toBe(false);
    expect(screen.queryByText(/Captain PWA is installable/)).toBeNull();
  });

  it("drops the community section and its note when bundles are off", async () => {
    m.getStorefrontFlags.mockResolvedValue({ ...ALL_ON, community_bundles: false });
    render(await SitemapPage());
    expect(links().some((href) => href?.startsWith("/community"))).toBe(false);
    expect(screen.queryByText(/Community bundle is gated/)).toBeNull();
  });
});
