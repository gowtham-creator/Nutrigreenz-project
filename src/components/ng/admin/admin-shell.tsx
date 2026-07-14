"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "../logo";
import { Icon } from "@/components/ui/icon";
import { getAdminEmail, getAdminRole, signOutAdmin, type AdminRole } from "@/lib/admin-auth";
import { readCachedPhoto, writeCachedPhoto } from "@/lib/admin-photo-cache";
import { DEFAULT_ADMIN_PERMISSIONS, type PermissionKey } from "@/lib/admin-permissions";

// Each nav item carries its permission `key` (see admin-permissions.ts). The nav
// is filtered by the signed-in admin's EFFECTIVE grants; `superadminOnly` is an
// ADDITIONAL gate kept intact (the Edge proxy still enforces those routes).
type NavItem = { href: string; label: string; icon: string; key: PermissionKey; superadminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "widget-5-bold", key: "overview" },
  // Catalog is the single product surface — it maps onto the real inventory
  // admin (products, pricing, stock, variants). The old mock catalog route now
  // redirects here, so there is no separate "Inventory" nav item.
  { href: "/admin/inventory", label: "Catalog", icon: "bag-4-bold", key: "catalog" },
  // Editorial content surfaces — the storefront Journal + Farms directories.
  { href: "/admin/journal", label: "Journal", icon: "notebook-bold", key: "journal" },
  { href: "/admin/farms", label: "Farms", icon: "leaf-bold", key: "farms" },
  { href: "/admin/orders", label: "Orders", icon: "clipboard-list-bold", key: "orders" },
  { href: "/admin/marketing", label: "Marketing", icon: "speaker-bold", key: "marketing", superadminOnly: true },
  // Reporting & analytics (Phase 8) — visible to both admin and superadmin.
  { href: "/admin/reports", label: "Reports", icon: "chart-2-bold", key: "reports" },
  // Product & customer analytics (demand signals + sign-in mix) — both roles.
  { href: "/admin/analytics", label: "Analytics", icon: "chart-square-bold", key: "analytics" },
  // DEDUPED canonical customer directory (one row per real person).
  { href: "/admin/customers", label: "Customers", icon: "user-rounded-bold", key: "customers" },
  { href: "/admin/people", label: "People", icon: "users-group-rounded-bold", key: "people", superadminOnly: true },
  // Customer-saved products (wishlist demand signal) — both roles can view.
  { href: "/admin/wishlists", label: "Wishlists", icon: "heart-bold", key: "wishlists" },
  // Audit log — the completed-action trail for the whole team. Both roles.
  { href: "/admin/audit", label: "Audit log", icon: "history-2-bold", key: "audit" },
  // Super Admin control center — gated below; only superadmins see this item.
  { href: "/admin/config", label: "Config", icon: "settings-bold", key: "config", superadminOnly: true },
];

/** Human-friendly label for an admin role, shown under the identity chip. */
function roleLabel(role: AdminRole | null): string {
  if (role === "superadmin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Admin";
}

/** Top-right admin identity chip with a sign-out dropdown. */
function AdminIdentity() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Identity is read from readable cookies (instant). The saved photo comes from
  // /api/admin/me, but we CACHE it in localStorage and paint the cached value on
  // mount so the chip doesn't flash the initial letter on every navigation while
  // the request is in flight — the network result just refreshes the cache.
  // Re-runs when the profile page dispatches `ng:profile-updated` after a save.
  useEffect(() => {
    setEmail(getAdminEmail());
    setRole(getAdminRole());
    const cached = readCachedPhoto();
    if (cached) setPhotoUrl(cached);

    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/me");
        if (!res.ok || !alive) return;
        const data = await res.json();
        const next = (data.profile?.photoUrl as string | null) ?? null;
        if (!alive) return;
        setPhotoUrl(next);
        writeCachedPhoto(next);
      } catch {
        /* ignore — the chip falls back to the initial */
      }
    }
    void load();
    const onUpdated = () => void load();
    window.addEventListener("ng:profile-updated", onUpdated);
    return () => {
      alive = false;
      window.removeEventListener("ng:profile-updated", onUpdated);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initial = (email?.trim()?.[0] ?? "A").toUpperCase();

  function handleSignOut() {
    // signOutAdmin clears the server cookies, then redirects to /admin/login.
    void signOutAdmin();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full pl-1 pr-2.5 py-1 hover:bg-ng-line-soft transition-colors cursor-pointer"
      >
        <span className="size-9 rounded-full overflow-hidden bg-ng-forest-deep text-ng-cream flex items-center justify-center font-display text-[14px]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="size-full object-cover"
              onError={() => {
                // Stale/broken cached URL — drop it and show the initial.
                setPhotoUrl(null);
                writeCachedPhoto(null);
              }}
            />
          ) : (
            initial
          )}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight min-w-0">
          <span className="font-mono text-[12.5px] font-medium text-ng-forest-deep truncate max-w-[150px]">
            {email ?? "admin"}
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ng-ink-muted">
            {roleLabel(role)}
          </span>
        </span>
        <Icon name="alt-arrow-down-bold" size={14} className="text-ng-ink-soft" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[0_12px_32px_rgba(31,77,46,0.12)] p-2 z-20"
        >
          <div className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ng-ink-muted font-mono">
                Signed in as
              </div>
              {role === "superadmin" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-ng-clay/20 text-ng-clay-deep font-bold px-2 py-0.5 text-[9.5px] uppercase tracking-wider">
                  <Icon name="crown-bold" size={10} />
                  Super
                </span>
              ) : null}
            </div>
            <div className="font-mono text-[12.5px] font-medium text-ng-forest-deep truncate mt-0.5">
              {email ?? "admin"}
            </div>
            <div className="text-[11.5px] font-medium text-ng-ink-muted mt-0.5">{roleLabel(role)}</div>
          </div>
          <div className="h-px bg-ng-line-soft my-1" />
          <Link
            href="/admin/profile"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-sans font-medium text-ng-ink hover:bg-ng-line-soft transition-colors"
          >
            <Icon name="user-circle-bold" size={16} className="text-ng-ink-muted" />
            Profile
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-sans font-medium text-ng-ink hover:bg-ng-line-soft transition-colors"
          >
            <Icon name="shop-2-bold" size={16} className="text-ng-ink-muted" />
            View store
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-sans font-medium text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors"
          >
            <Icon name="logout-3-bold" size={16} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sidebar contents (brand, nav, help card). Shared between the sticky desktop
 * rail and the mobile overlay drawer. `onNavigate` lets the drawer close itself
 * when a link is tapped.
 */
function SidebarContent({
  navItems,
  isSuper,
  active,
  onNavigate,
}: {
  navItems: NavItem[];
  isSuper: boolean;
  active: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="p-6">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 mb-1">
          <Logo variant="mark" tone="white" className="h-9" />
          <span className="font-display text-[17px] text-ng-cream">Nutri Greenz</span>
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ng-clay font-mono">Admin · v0.4.1</span>
          {isSuper ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ng-clay/20 text-ng-clay font-bold px-2 py-0.5 text-[9px] uppercase tracking-wider">
              <Icon name="crown-bold" size={10} />
              Super Admin
            </span>
          ) : null}
        </div>
      </div>
      <nav className="px-3 pb-6">
        {navItems.map((n) => {
          const isActive = active === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl font-sans font-semibold text-[13.5px] tracking-[0.01em] transition-colors mb-0.5",
                isActive
                  ? "bg-ng-cream/12 text-ng-cream"
                  : "text-ng-cream/80 hover:bg-ng-cream/5 hover:text-ng-cream",
              )}
            >
              <Icon
                name={n.icon}
                size={18}
                className={cn(
                  "transition-colors",
                  isActive ? "text-ng-clay" : "text-ng-cream/60",
                )}
              />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4">
        <div className="rounded-2xl bg-ng-cream/5 border border-ng-cream/10 p-4 text-[12px] font-medium text-ng-cream/75">
          <div className="text-ng-clay font-bold text-[12.5px] mb-1">Need a hand?</div>
          Slack #admin-portal · runbook link in handbook
        </div>
      </div>
    </>
  );
}

export function AdminShell({
  children,
  active,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  active: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  // Role gates the nav: the Config (Super Admin) item is shown only to
  // superadmins; the edge proxy enforces the actual route protection.
  const [role, setRole] = useState<AdminRole | null>(null);
  // The signed-in admin's EFFECTIVE section grants (from /api/admin/me). Null
  // until it loads — we fall back to the default admin set so the nav paints
  // immediately without flashing (superadmins short-circuit to every item).
  const [perms, setPerms] = useState<Set<string> | null>(null);
  // Mobile-only: the sidebar collapses below `lg` and opens as an overlay drawer.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    setRole(getAdminRole());
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/me");
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (alive && Array.isArray(data.permissions)) {
          setPerms(new Set<string>(data.permissions));
        }
      } catch {
        /* ignore — the nav falls back to the default admin set */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const isSuper = role === "superadmin";
  // Filter the nav by BOTH the effective grants AND the intact `superadminOnly`
  // gate. Superadmins always see every item. Denied sections are also blocked
  // server-side by each section's `requirePermission` guard — this is UX, not
  // the security boundary.
  const effectivePerms = perms ?? new Set<string>(DEFAULT_ADMIN_PERMISSIONS);
  const navItems = NAV.filter(
    (n) => (!n.superadminOnly || isSuper) && (isSuper || effectivePerms.has(n.key)),
  );

  return (
    <div className="min-h-screen bg-ng-cream text-ng-ink flex">
      {/* Sidebar — sticky rail on lg+, hidden below (opens as a drawer instead) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-ng-forest-deep text-ng-cream/80 sticky top-0 h-screen overflow-y-auto">
        <SidebarContent navItems={navItems} isSuper={isSuper} active={active} />
      </aside>

      {/* Mobile drawer — overlay + slide-in nav below lg */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ng-forest-deep/40 backdrop-blur-sm cursor-pointer"
          />
          <aside className="absolute inset-y-0 left-0 flex flex-col w-60 max-w-[82vw] bg-ng-forest-deep text-ng-cream/80 overflow-y-auto shadow-[0_0_48px_rgba(0,0,0,0.35)]">
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="grid size-9 place-items-center rounded-full text-ng-cream/70 hover:bg-ng-cream/10 hover:text-ng-cream transition-colors cursor-pointer"
              >
                <Icon name="close-circle-bold" size={20} />
              </button>
            </div>
            <SidebarContent
              navItems={navItems}
              isSuper={isSuper}
              active={active}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-ng-cream/85 backdrop-blur border-b border-ng-line-soft">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            {/* Row 1 — heading (left) + operator identity, which is always pinned
                to the top-right corner instead of being lumped in with the page
                action buttons (where a long row would strand it on its own line). */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setDrawerOpen(true)}
                  className="lg:hidden grid size-9 shrink-0 place-items-center rounded-full text-ng-forest-deep hover:bg-ng-line-soft transition-colors cursor-pointer"
                >
                  <Icon name="hamburger-menu-bold" size={22} />
                </button>
                <div className="min-w-0">
                  <h1 className="font-display text-[24px] text-ng-forest-deep leading-tight tracking-[-0.01em]">{title}</h1>
                  {subtitle ? <p className="font-sans text-[13px] font-medium text-ng-ink-soft mt-1.5">{subtitle}</p> : null}
                </div>
              </div>
              <div className="shrink-0">
                <AdminIdentity />
              </div>
            </div>
            {/* Row 2 — page actions on their own row: right-aligned from sm up,
                wrapping on small screens so they never overflow. Omitted when a
                page passes no actions. */}
            {actions ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {actions}
              </div>
            ) : null}
          </div>
        </header>
        <main className="px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  delta,
  trend,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
}) {
  const trendColor =
    trend === "up" ? "text-ng-success" : trend === "down" ? "text-ng-terracotta" : "text-ng-ink-soft";
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  return (
    <div className="flex flex-col h-full rounded-2xl bg-ng-paper border border-ng-line-soft p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">{label}</div>
      <div className="font-display text-[34px] text-ng-forest-deep leading-none mt-3">{value}</div>
      {delta ? (
        <div className={cn("text-[12px] mt-auto pt-3 font-semibold", trendColor)}>
          {trendArrow} {delta}
        </div>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Edge-to-edge cards opt out of the section's own padding via `!p-0` so their
  // table rows can run flush to the rounded border (each row supplies its own
  // px-*). In that case the title header must carry its OWN px/pt so the first
  // letter is never clipped by `overflow-hidden`, and the children must stay
  // unpadded. Plain cards keep their original `p-6` look — the header sits flush
  // inside that padding (no extra px/pt), so nothing double-pads.
  const edgeToEdge = /(^|\s)!p-0(\s|$)/.test(className ?? "");
  const hasHeader = Boolean(title || action);
  return (
    <section className={cn("flex flex-col h-full rounded-2xl bg-ng-paper border border-ng-line-soft p-6", className)}>
      {hasHeader && (
        <header
          className={cn(
            "flex items-center justify-between gap-4 mb-5",
            edgeToEdge && "px-6 pt-6",
          )}
        >
          {title ? <h2 className="font-display text-[18px] text-ng-forest-deep">{title}</h2> : <span />}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warn" | "danger" | "info"; children: ReactNode }) {
  const map: Record<string, string> = {
    neutral: "bg-ng-line-soft text-ng-ink-muted",
    success: "bg-ng-success/15 text-ng-success",
    warn: "bg-ng-clay/30 text-ng-clay-deep",
    danger: "bg-ng-terracotta/15 text-ng-terracotta",
    info: "bg-ng-forest/15 text-ng-forest",
  };
  return (
    <span className={cn("inline-block px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold", map[tone])}>
      {children}
    </span>
  );
}
