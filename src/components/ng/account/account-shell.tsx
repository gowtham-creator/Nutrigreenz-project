import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "../page-shell";
import { AccountIdentity, SignOutButton } from "./account-identity";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type AccountSection =
  | "overview"
  | "orders"
  | "wishlist"
  | "addresses"
  | "loyalty"
  | "referral"
  | "profile";

const NAV: { key: AccountSection; href: string; label: string; icon: string }[] = [
  { key: "overview", href: "/account", label: "Overview", icon: "widget-5-bold" },
  { key: "orders", href: "/account/orders", label: "Orders", icon: "box-bold" },
  { key: "wishlist", href: "/wishlist", label: "Wishlist", icon: "heart-bold" },
  { key: "addresses", href: "/account/addresses", label: "Addresses", icon: "map-point-bold" },
  { key: "loyalty", href: "/loyalty", label: "Loyalty", icon: "wallet-money-bold" },
  { key: "referral", href: "/referral", label: "Refer & earn", icon: "users-group-rounded-bold" },
  { key: "profile", href: "/account/profile", label: "Profile", icon: "user-bold" },
];

/**
 * Shared chrome for every customer account page: the storefront header/footer
 * plus a persistent account nav (vertical sidebar on desktop, scrollable tab
 * strip on mobile) so any sub-page can jump back to the profile or sideways.
 */
export function AccountShell({
  active,
  children,
}: {
  active: AccountSection;
  children: ReactNode;
}) {
  return (
    <PageShell className="relative">
      {/* Soft, reduced-motion-safe ambient blobs behind the whole suite. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] overflow-hidden">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-ng-leaf/12 blur-3xl" />
        <div className="absolute -right-28 top-10 h-72 w-72 rounded-full bg-ng-forest-soft/12 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8 py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[262px_1fr] lg:gap-10">
          {/* Account nav */}
          <aside className="min-w-0 lg:sticky lg:top-[84px] h-fit">
            <AccountIdentity />

            <nav className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] lg:mx-0 lg:flex-col lg:gap-1 lg:rounded-3xl lg:border lg:border-ng-line-soft lg:bg-ng-paper/70 lg:p-2 lg:backdrop-blur-sm lg:shadow-[var(--shadow-ng-card)] lg:[mask-image:none]">
              {NAV.map((n) => {
                const isActive = n.key === active;
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex min-h-[44px] items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-3 text-[14px] font-medium transition-all duration-200",
                      isActive
                        ? "bg-ng-forest text-ng-cream shadow-[0_6px_18px_-8px_rgba(20,51,31,0.6)]"
                        : "text-ng-ink-muted hover:bg-ng-sage/50 hover:text-ng-ink hover:translate-x-0.5",
                    )}
                  >
                    <Icon
                      name={n.icon}
                      size={18}
                      className={cn(
                        "transition-colors",
                        isActive ? "text-ng-leaf" : "text-ng-ink-soft group-hover:text-ng-forest",
                      )}
                    />
                    {n.label}
                    {isActive ? (
                      <Icon name="alt-arrow-right-linear" size={15} className="ml-auto hidden text-ng-cream/70 lg:inline" />
                    ) : null}
                  </Link>
                );
              })}
              <SignOutButton />
            </nav>
          </aside>

          {/* Page content */}
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </PageShell>
  );
}
