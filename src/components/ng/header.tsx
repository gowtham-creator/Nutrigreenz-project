"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./logo";
import { Button } from "./button";
import { LocationPill } from "./location/location-pill";
import { LocationOnboarding } from "./location/location-onboarding";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV: Array<{ label: string; href: string; mega?: Array<{ label: string; href: string; description?: string }> }> = [
  {
    label: "Shop",
    href: "/shop",
    mega: [
      { label: "Cold-pressed oils", href: "/shop/oils", description: "Wood-pressed groundnut, sunflower, coconut" },
      { label: "A2 Ghee", href: "/shop/ghee", description: "Gir cow, cultured, bilona" },
      { label: "Honey & sweeteners", href: "/shop/honey", description: "Multifloral, kashmiri, jaggery" },
      { label: "Millets & grains", href: "/shop/millets", description: "Foxtail, finger, pearl + 9 more" },
      { label: "Spices & masalas", href: "/shop/spices", description: "Stone-ground, sun-dried" },
      { label: "Superfoods", href: "/shop/superfoods", description: "Moringa, ashwagandha, turmeric latte" },
      { label: "Pulses & dals", href: "/shop/pulses", description: "Heritage cultivars, hand-cleaned" },
      { label: "Gifting", href: "/shop/gifting", description: "Festival hampers, corporate boxes" },
    ],
  },
  { label: "Our farms", href: "/farms" },
  { label: "Traceability", href: "/traceability" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

export function Header() {
  const [openMega, setOpenMega] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { isAuthed, account } = useAuth();
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const shopHref = isAuthed ? "/shop" : "/auth?next=/shop";
  const accountHref = isAuthed ? "/account" : "/auth?next=/account";
  const accountInitial = account?.name?.trim()?.[0]?.toUpperCase();

  return (
    <header
      className="sticky top-0 z-40 glass-strong border-b border-ng-line"
      onMouseLeave={() => setOpenMega(null)}
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8 flex items-center justify-between h-[68px]">
        {/* Logo + delivery location */}
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Nutri Greenz home" className="shrink-0">
            <Logo className="h-10" priority />
          </Link>
          <LocationPill className="hidden md:inline-flex" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpenMega(item.mega ? item.label : null)}
            >
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full px-4 py-2 text-[14px] font-medium transition-colors duration-200",
                  isActive(item.href)
                    ? "bg-ng-forest text-ng-cream"
                    : openMega === item.label
                      ? "bg-ng-sage/60 text-ng-forest-deep"
                      : "text-ng-ink hover:bg-ng-sage/55 hover:text-ng-forest-deep",
                )}
              >
                {item.label}
              </Link>
              {item.mega && openMega === item.label ? (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3">
                  <div className="bg-ng-paper border border-ng-line rounded-2xl shadow-[var(--shadow-ng-float)] p-6 w-[680px] grid grid-cols-2 gap-x-8 gap-y-3">
                    {item.mega.map((m) => (
                      <Link
                        key={m.label}
                        href={m.href}
                        className="group flex flex-col gap-0.5 rounded-xl px-3.5 py-2.5 hover:bg-ng-forest transition-colors duration-200"
                      >
                        <span className="font-display text-[16px] text-ng-forest-deep group-hover:text-ng-cream transition-colors">
                          {m.label}
                        </span>
                        {m.description ? (
                          <span className="text-[12px] text-ng-ink-soft group-hover:text-ng-cream/75 transition-colors">{m.description}</span>
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
        <div className="flex items-center gap-2">
          <button
            aria-label="Search"
            className="hidden md:inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ng-sage/50 transition-colors text-ng-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </button>
          <Link
            href={accountHref}
            aria-label={isAuthed ? "Account" : "Sign in"}
            className="hidden md:inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ng-sage/50 transition-colors text-ng-ink"
          >
            {isAuthed && accountInitial ? (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ng-forest font-display text-[13px] font-semibold text-ng-cream">
                {accountInitial}
              </span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            )}
          </Link>
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ng-sage/50 transition-colors text-ng-ink"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
            {wishlistCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-ng-clay text-ng-soil text-[10px] font-semibold inline-flex items-center justify-center">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ng-sage/50 transition-colors text-ng-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {count > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-ng-forest text-ng-paper text-[10px] font-semibold inline-flex items-center justify-center">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
          <Button variant="primary" size="sm" className="hidden sm:inline-flex ml-1" asChild>
            <Link href={shopHref}>Shop now</Link>
          </Button>
          <button
            aria-label="Open menu"
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ng-sage/50 text-ng-ink"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile delivery-location row */}
      <div className="md:hidden border-t border-ng-line-soft">
        <LocationPill variant="compact" />
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
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                isActive(item.href)
                  ? "bg-ng-forest text-ng-cream"
                  : "text-ng-ink hover:bg-ng-sage/50 hover:text-ng-forest-deep",
              )}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
