"use client";

import Link from "next/link";
import { useFeatureFlag } from "@/components/ng/feature-gate";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./logo";
import { Button } from "./button";
import { LocationPill } from "./location/location-pill";
import { LocationOnboarding } from "./location/location-onboarding";
import { useCart } from "@/lib/cart";
import { CartIcon } from "@/components/ng/cart-icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { ProfileMenu } from "./profile-menu";
import { SiteSearch } from "./search/site-search";
import { cn } from "@/lib/utils";
import { useScrollChrome } from "@/lib/use-scroll-chrome";

const NAV: Array<{
  label: string;
  href: string;
  /** Hidden while this feature is switched off. */
  feature?: FeatureFlagKey;
  mega?: Array<{ label: string; href: string; description?: string }>;
}> = [
  {
    label: "Shop",
    href: "/shop",
    mega: [
      { label: "Cold-Pressed Oils", href: "/shop/oils", description: "Groundnut, sesame, safflower, olive, mustard, coconut" },
      { label: "Ghee", href: "/shop/ghee", description: "Pure, traditional ghee" },
      { label: "Honey", href: "/shop/honey", description: "Raw, unprocessed honey" },
    ],
  },
  { label: "Subscribe & save", href: "/subscriptions", feature: "subscriptions" },
  { label: "Our farms", href: "/farms" },
  { label: "Traceability", href: "/traceability" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

export function Header() {
  const [openMega, setOpenMega] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count } = useCart();
  const subscriptionsOn = useFeatureFlag("subscriptions");
  const nav = NAV.filter((item) => !item.feature || subscriptionsOn);
  const { count: wishlistCount } = useWishlist();
  const { isAuthed } = useAuth();
  const pathname = usePathname();
  // Phones and tablets: the delivery location shows only at the very top.
  const { atTop } = useScrollChrome();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const shopHref = isAuthed ? "/shop" : "/auth?next=/shop";

  return (
    <header
      className="sticky top-[env(safe-area-inset-top)] z-40 glass-strong border-b border-ng-line"
      onMouseLeave={() => setOpenMega(null)}
    >
      <div className="relative mx-auto max-w-7xl px-3 sm:px-5 md:px-8 lg:max-xl:px-6 flex items-center h-[64px] lg:h-[68px]">
        {/* Phones and tablets, app-style: menu on the left, the logo centred,
            search and cart on the right. */}
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="lg:hidden inline-flex shrink-0 h-11 w-11 items-center justify-center rounded-full text-ng-ink hover:bg-ng-forest/[0.06] active:bg-ng-forest/[0.1] [-webkit-tap-highlight-color:transparent]"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6.5h16M4 12h16M4 17.5h16" />
          </svg>
        </button>

        {/* Tablets: the delivery location sits in the header beside the menu,
            keeping the header to one clean row as on Anveshan. Phones get it
            on its own row below. */}
        <LocationPill className="hidden md:max-lg:inline-flex ml-2 max-w-[180px]" />

        {/* Logo + delivery location (desktop) */}
        <div className="flex items-center gap-3 max-lg:absolute max-lg:left-1/2 max-lg:-translate-x-1/2">
          <Link href="/" aria-label="Nutri Greenz home" className="shrink-0">
            <Logo className="h-[26px] min-[375px]:h-[28px] min-[400px]:h-[32px] min-[430px]:h-[34px] md:h-10" priority />
          </Link>
          <LocationPill className="hidden lg:inline-flex lg:max-[1099px]:max-w-[170px]" />
        </div>

        {/* Desktop nav — every laptop and desktop width (1024px up), centred
            between the location pill and the icons so the space either side is
            equal. Between 1024 and 1280 the links tighten up to fit; narrower
            screens use the hamburger and the bottom tab bar. */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-1 mx-4 xl:gap-2 xl:mx-6">
          {nav.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpenMega(item.mega ? item.label : null)}
            >
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-200 min-[1180px]:px-3.5 xl:px-4 xl:text-[14px]",
                  isActive(item.href)
                    ? "bg-gradient-to-b from-ng-forest to-ng-forest-deep text-ng-cream shadow-[0_2px_10px_-4px_rgba(20,51,31,0.55)] ring-1 ring-inset ring-ng-leaf/15"
                    : openMega === item.label
                      ? "bg-ng-forest/[0.06] text-ng-forest-deep"
                      : "text-ng-ink hover:bg-ng-forest/[0.06] hover:text-ng-forest-deep",
                )}
              >
                {item.label}
              </Link>
              {item.mega && openMega === item.label ? (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3">
                  {/* One column, not two.
                      Three categories in a 2-up grid left the fourth cell
                      empty, so the panel read as a wide rectangle with a hole
                      in it. Stacked, the panel is only as big as its contents
                      and the eye travels straight down the list. Width is set
                      so the longest description ("Groundnut, sesame, …") wraps
                      to two lines rather than running long. */}
                  <div className="bg-ng-paper border border-ng-line rounded-2xl shadow-[var(--shadow-ng-float)] p-3 w-[380px] flex flex-col gap-1">
                    {item.mega.map((m) => (
                      <Link
                        key={m.label}
                        href={m.href}
                        className="group flex flex-col gap-1 rounded-xl px-4 py-3 hover:bg-ng-forest transition-colors duration-200"
                      >
                        <span className="font-display text-[17px] leading-tight text-ng-forest-deep group-hover:text-ng-cream transition-colors">
                          {m.label}
                        </span>
                        {m.description ? (
                          <span className="text-[12.5px] leading-snug text-ng-ink-soft group-hover:text-ng-cream/75 transition-colors">
                            {m.description}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 ml-auto sm:gap-1 lg:gap-2">
          {/* Was a bare <button> with no handler — it drew a magnifier and did
              nothing — and `hidden xl:inline-flex`, so below 1280px there was no
              search control at all, phones included. */}
          <SiteSearch />
          {/* Profile shows from tablets up (search, profile, cart, as on Anveshan);
              phones reach it from the bottom tab bar. Wishlist is desktop-only
              here and in the bottom bar below that. */}
          <div className="hidden md:block shrink-0">
            <ProfileMenu />
          </div>
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="relative hidden lg:inline-flex shrink-0 h-11 w-11 md:h-10 md:w-10 items-center justify-center rounded-full hover:bg-ng-forest/[0.06] transition-colors text-ng-ink"
          >
            <UiIcon name="wishlist" size={20} />
            {wishlistCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-ng-clay-deep text-ng-paper text-[10px] font-semibold inline-flex items-center justify-center">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative inline-flex shrink-0 h-11 w-11 md:h-10 md:w-10 items-center justify-center rounded-full hover:bg-ng-forest/[0.06] transition-colors text-ng-ink"
          >
            <CartIcon size={20} tone="dark" />
            {count > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-ng-forest text-ng-paper text-[10px] font-semibold inline-flex items-center justify-center">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
          <Button variant="primary" size="sm" className="hidden xl:inline-flex ml-1 whitespace-nowrap shrink-0" asChild>
            <Link href={shopHref}>Shop now</Link>
          </Button>
        </div>
      </div>

      {/* Mobile delivery-location row */}
      <div
        className={cn(
          "md:hidden grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none",
          atTop ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!atTop}
        inert={!atTop}
      >
        <div className="overflow-hidden">
          <div className="border-t border-ng-line-soft">
            <LocationPill variant="compact" />
          </div>
        </div>
      </div>

      {/* First-visit location prompt (mounted once, header is on every page) */}
      <LocationOnboarding />

      {/* Mobile drawer */}
      <div
        className={cn(
          "lg:hidden overflow-hidden border-t border-ng-line-soft transition-[max-height] duration-500",
          mobileOpen ? "max-h-[60vh]" : "max-h-0",
        )}
      >
        <nav className="px-5 py-4 flex flex-col gap-1">
          {nav.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-gradient-to-b from-ng-forest to-ng-forest-deep text-ng-cream ring-1 ring-inset ring-ng-leaf/15"
                    : "text-ng-ink hover:bg-ng-forest/[0.06] hover:text-ng-forest-deep",
                )}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
              {item.mega ? (
                <div className="ml-3 flex flex-col gap-1 border-l border-ng-line-soft pl-3">
                  {item.mega.map((m) => (
                    <Link
                      key={m.href}
                      href={m.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl px-3 py-2.5 text-[14px] text-ng-ink-soft hover:bg-ng-forest/[0.06] hover:text-ng-forest-deep transition-colors"
                    >
                      {m.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
