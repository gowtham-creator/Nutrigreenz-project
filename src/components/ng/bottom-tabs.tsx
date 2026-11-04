"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { useScrollChrome } from "@/lib/use-scroll-chrome";
import { useIsOperator } from "@/lib/operator-surface";
import { cn } from "@/lib/utils";

/**
 * App-style tab bar for phones and tablets: Home, Shop, Wishlist and Profile
 * one thumb-tap away. The cart stays in the header.
 *
 * Slightly see-through, it slides away while scrolling down and comes back on
 * any scroll up. A press fills the tab with the brand green, so a tap feels
 * answered at once.
 *
 * Hidden where the page has its own bottom bar or none belongs: product pages
 * (their Add to cart bar), the cart and checkout, sign-in, and the admin and
 * captain apps. A spacer of the same height keeps the footer clear of it.
 */
const HIDDEN = /^\/(products|cart|checkout|auth|admin|captain|unsubscribe|r)(\/|$)/;

/** The owner's filled icons, used as masks so they take the tab's colour. */
function TabIcon({ src }: { src: string }) {
  return (
    <span
      aria-hidden
      className="block size-[22px] bg-current"
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

export function BottomTabs() {
  const pathname = usePathname() ?? "/";
  const { count: saved } = useWishlist();
  const { isAuthed } = useAuth();
  const { hidden } = useScrollChrome();
  const operator = useIsOperator();
  if (HIDDEN.test(pathname) || operator) return null;

  const tabs = [
    { href: "/", match: "/", label: "Home", icon: "/images/tabs/home.png" },
    { href: isAuthed ? "/shop" : "/auth?next=/shop", match: "/shop", label: "Shop", icon: "/images/tabs/shop.png" },
    { href: "/wishlist", match: "/wishlist", label: "Wishlist", icon: "/icons/ui/wishlist.svg", badge: saved },
    {
      href: isAuthed ? "/account" : "/auth?next=/account",
      match: "/account",
      label: "Profile",
      icon: "/images/tabs/profile.png",
    },
  ];
  const active = (m: string) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`));

  return (
    <>
      <div aria-hidden className="ng-store-only lg:hidden h-[calc(64px+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Main"
        className={cn(
          "ng-store-only lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-ng-line/70 bg-ng-paper/90",
          "pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-14px_rgba(16,40,24,0.35)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          hidden ? "translate-y-full" : "translate-y-0",
        )}
      >
        <ul className="mx-auto grid h-16 max-w-2xl grid-cols-4 px-2">
          {tabs.map((t) => {
            const on = active(t.match);
            return (
              <li key={t.label} className="flex items-center justify-center">
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "group flex h-14 w-full max-w-24 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11.5px] font-semibold",
                    "[-webkit-tap-highlight-color:transparent] select-none transition-[background-color,color,transform] duration-150",
                    "active:scale-[0.94] active:bg-ng-forest active:text-ng-cream",
                    on ? "text-ng-forest-deep" : "text-ng-ink-muted",
                  )}
                >
                  <span
                    className={cn(
                      "relative grid h-8 w-12 place-items-center rounded-full transition-colors duration-150",
                      on ? "bg-ng-sage/70" : "group-active:bg-transparent",
                    )}
                  >
                    <TabIcon src={t.icon} />
                    {t.badge ? (
                      <span className="absolute -top-0.5 right-1 min-w-4 h-4 px-1 rounded-full bg-ng-clay-deep text-ng-paper text-[10px] font-semibold inline-flex items-center justify-center">
                        {t.badge > 99 ? "99+" : t.badge}
                      </span>
                    ) : null}
                  </span>
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
