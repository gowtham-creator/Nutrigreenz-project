"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * App-style tab bar for phones and tablets, like a shopping app: Home, Shop,
 * Wishlist, Cart and Account always one thumb-tap away at the bottom.
 *
 * Hidden where the page has its own bottom bar or none belongs: product pages
 * (their Add to cart bar), the cart and checkout, sign-in, and the admin and
 * captain apps. A spacer of the same height keeps the footer clear of it.
 */
const HIDDEN = /^\/(products|cart|checkout|auth|admin|captain|unsubscribe|r)(\/|$)/;

export function BottomTabs() {
  const pathname = usePathname() ?? "/";
  const { count } = useCart();
  const { count: saved } = useWishlist();
  const { isAuthed } = useAuth();
  if (HIDDEN.test(pathname)) return null;

  const tabs = [
    { href: "/", match: "/", label: "Home", icon: "home-2-bold" },
    { href: isAuthed ? "/shop" : "/auth?next=/shop", match: "/shop", label: "Shop", icon: "shop-bold" },
    { href: "/wishlist", match: "/wishlist", label: "Wishlist", icon: "heart-bold", badge: saved },
    { href: "/cart", match: "/cart", label: "Cart", icon: "cart-large-2-bold", badge: count },
    { href: isAuthed ? "/account" : "/auth?next=/account", match: "/account", label: "Account", icon: "user-rounded-bold" },
  ];
  const active = (m: string) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`));

  return (
    <>
      <div aria-hidden className="lg:hidden h-[calc(64px+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Main"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-ng-line bg-ng-paper/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-12px_rgba(16,40,24,0.25)]"
      >
        <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5">
          {tabs.map((t) => {
            const on = active(t.match);
            return (
              <li key={t.label}>
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className="flex h-full flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold"
                >
                  <span
                    className={cn(
                      "relative grid h-8 w-12 place-items-center rounded-full transition-colors",
                      on ? "bg-ng-sage/60 text-ng-forest-deep" : "text-ng-ink-soft",
                    )}
                  >
                    <Icon name={t.icon} size={21} />
                    {t.badge ? (
                      <span className="absolute -top-0.5 right-1 min-w-4 h-4 px-1 rounded-full bg-ng-forest text-ng-paper text-[10px] font-semibold inline-flex items-center justify-center">
                        {t.badge > 99 ? "99+" : t.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className={on ? "text-ng-forest-deep" : "text-ng-ink-muted"}>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
