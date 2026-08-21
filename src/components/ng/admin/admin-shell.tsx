"use client";

import { SessionCountdown } from "@/components/ng/admin/session-timer";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { fetchAdminMe } from "@/lib/admin-me-client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "../logo";
import { Icon } from "@/components/ui/icon";
import { UiIcon, UI_ICON_NAMES, type UiIconName } from "@/components/ui/ui-icon";
import { CountUp } from "@/components/ng/admin/count-up";
import { BrandIcon } from "@/components/ui/brand-icon";
import { getAdminEmail, getAdminRole, signOutAdmin, type AdminRole } from "@/lib/admin-auth";
import { readCachedPhoto, writeCachedPhoto } from "@/lib/admin-photo-cache";
import { DEFAULT_ADMIN_PERMISSIONS, type PermissionKey } from "@/lib/admin-permissions";
import { ADMIN_VERSION_LABEL } from "@/lib/app-version";

// Each nav item carries its permission `key` (see admin-permissions.ts). The nav
// is filtered by the signed-in admin's EFFECTIVE grants; `superadminOnly` is an
// ADDITIONAL gate kept intact (the Edge proxy still enforces those routes).
type NavItem = { href: string; label: string; icon: string; key: PermissionKey; superadminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "widget-5-bold", key: "overview" },
  // Catalog is the single product surface — it maps onto the real inventory
  // admin (products, pricing, stock, variants). The old mock catalog route now
  // redirects here, so there is no separate "Inventory" nav item.
  { href: "/admin/inventory", label: "Catalog", icon: "catalog", key: "catalog" },
  // Editorial content surfaces — the storefront Journal + Farms directories.
  { href: "/admin/journal", label: "Journal", icon: "notebook-bold", key: "journal" },
  { href: "/admin/farms", label: "Farms", icon: "leaf-bold", key: "farms" },
  { href: "/admin/orders", label: "Orders", icon: "clipboard-list-bold", key: "orders" },
  { href: "/admin/marketing", label: "Marketing", icon: "speaker-bold", key: "marketing", superadminOnly: true },
  // Reporting & analytics (Phase 8) — visible to both admin and superadmin.
  { href: "/admin/reports", label: "Reports", icon: "reports", key: "reports" },
  // Product & customer analytics (demand signals + sign-in mix) — both roles.
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", key: "analytics" },
  // DEDUPED canonical customer directory (one row per real person).
  { href: "/admin/referrals", label: "Referrals", icon: "users-group-rounded-bold", key: "referrals" },
  { href: "/admin/customers", label: "Customers", icon: "customer", key: "customers" },
  // Field-sales captains — roster, community stalls, commissions and settlements.
  { href: "/admin/captains", label: "Captains", icon: "captain", key: "captains" },
  { href: "/admin/people", label: "People", icon: "users-group-rounded-bold", key: "people", superadminOnly: true },
  // Customer-saved products (wishlist demand signal) — both roles can view.
  { href: "/admin/wishlists", label: "Wishlists", icon: "wishlist", key: "wishlists" },
  // Audit log — the completed-action trail for the whole team. Both roles.
  { href: "/admin/audit", label: "Audit log", icon: "audit", key: "audit" },
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
      // Shared cache: the nav below mounts at the same moment and needs the
      // same answer, so the two of them cost one request rather than two.
      const data = await fetchAdminMe();
      if (!data || !alive) return;
      const next = data.profile?.photoUrl ?? null;
      setPhotoUrl(next);
      writeCachedPhoto(next);
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
        <span className="ng-on-dark size-9 rounded-full overflow-hidden bg-[var(--ng-chrome-deep)] text-ng-cream flex items-center justify-center font-display text-[14px]">
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
              {/* Solid ground, not a 20% tint: clay/20 over cream resolves to
                  #E8DCBD, and clay-deep on that is 3.93:1 — under the 4.5:1
                  that 9.5px bold needs. This pair measures 5.31:1. */}
              {role === "superadmin" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F5E6C4] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#7A5717]">
                  <UiIcon name="admin" size={10} />
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
            <UiIcon name="customer" size={16} className="text-ng-ink-muted" />
            Profile
          </Link>
          {/*
            Opens in a new tab, like every other admin console.

            An operator clicks this to CHECK something — how a price reads,
            whether a product went live — and then carries on working. Same-tab
            navigation threw away the queue, the filters and the scroll position
            to answer a five-second question, and made the click feel dead while
            the storefront's first paint arrived.

            A plain <a> rather than <Link>: this leaves the admin entirely, so
            there is no client-side route to prefetch or transition, and Link
            would only add work for a navigation the browser handles natively.
          */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-sans font-medium text-ng-ink hover:bg-ng-line-soft transition-colors"
          >
            <BrandIcon name="store" weight="solid" size={16} className="text-ng-ink-muted" />
            View store
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-sans font-medium text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors"
          >
            <BrandIcon name="signOut" weight="solid" size={16} />
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
        {/*
          The real horizontal lockup, not the mark beside re-typed text.

          This previously set "Nutri Greenz" in the display face next to the
          mark, which is not the wordmark: the actual one is all caps, drawn
          with its own letterforms, and carries the "Born in Soil, built for
          tomorrow" line. Setting a brand name in whatever serif is to hand
          produces something that reads as the logo at a glance and is wrong on
          inspection — the one place that is least acceptable is the operator's
          own console, which is where staff learn what the mark looks like.

          Width-constrained rather than height-constrained so the lockup fits
          the 240px rail with its padding at any height the asset happens to be.
        */}
        <Link href="/" onClick={onNavigate} className="mb-1 block">
          <Logo variant="full" tone="white" className="h-auto w-[168px]" />
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ng-clay font-mono">{ADMIN_VERSION_LABEL}</span>
          {/* Inverted for the dark sidebar. A translucent gold chip on forest
              resolved to #2C3418 with clay text at 3.98:1 — a dark badge on a
              dark ground, which cannot separate however the ink is tuned. A
              light gold ground with near-black ink is 9.53:1. */}
          {isSuper ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ng-clay-light px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ng-forest-deep">
              <UiIcon name="admin" size={10} />
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
              /* Warm the route on hover. Admin pages are cookie-gated and so
                 dynamic; Next prefetches those only as far as their loading
                 boundary, which /admin/loading.tsx now provides. Pointing at an
                 item is a strong signal it is about to be clicked, and by then
                 the shell and skeleton are already in the router cache. */
              prefetch
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl font-sans font-semibold text-[13.5px] tracking-[0.01em] transition-colors mb-0.5",
                isActive
                  ? "bg-[var(--rail-active)] text-[var(--rail-ink)]"
                  : "text-[var(--rail-ink-dim)] hover:bg-[var(--rail-hover)] hover:text-[var(--rail-ink)]",
              )}
            >
              {/* The nav mixes Solar names with the supplied Icons8 marks, so
                  the family is chosen by name. Rendering everything through
                  <Icon> would leave the migrated rows blank — a name with no
                  Solar glyph resolves to nothing and fails silently. */}
              {UI_ICON_NAMES.has(n.icon) ? (
                <UiIcon
                  name={n.icon as UiIconName}
                  size={18}
                  className={cn("transition-colors", isActive ? "text-ng-clay" : "text-ng-cream/60")}
                />
              ) : (
                <Icon
                  name={n.icon}
                  size={18}
                  className={cn("transition-colors", isActive ? "text-ng-clay" : "text-ng-cream/60")}
                />
              )}
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4">
        {/* Sits on the permanently dark rail, so it opts out of the inversion
            too. Its `/75` and `/5` opacity forms measured 1.08:1 before. */}
        <div className="ng-on-dark rounded-2xl bg-ng-cream/5 border border-ng-cream/10 p-4 text-[12px] font-medium text-ng-cream/75">
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
      const data = await fetchAdminMe();
      if (alive && data && Array.isArray(data.permissions)) {
        setPerms(new Set<string>(data.permissions));
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
    <div className="flex min-h-screen bg-[var(--ng-admin-ground)] text-ng-ink">
      {/* Sidebar — sticky rail on lg+, hidden below (opens as a drawer instead) */}
      <aside className="ng-rail hidden lg:flex flex-col w-60 shrink-0 bg-[var(--ng-chrome-deep)] text-[var(--rail-ink-dim)] sticky top-0 h-screen overflow-y-auto">
        <SidebarContent navItems={navItems} isSuper={isSuper} active={active} />
      </aside>

      {/* Mobile drawer — overlay + slide-in nav below lg */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--ng-chrome-deep)_55%,transparent)] backdrop-blur-sm cursor-pointer"
          />
          <aside className="ng-rail absolute inset-y-0 left-0 flex flex-col w-60 max-w-[82vw] bg-[var(--ng-chrome-deep)] text-[var(--rail-ink-dim)] overflow-y-auto shadow-[0_0_48px_rgba(0,0,0,0.35)]">
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
        <header className="sticky top-0 z-10 border-b border-ng-line-soft/70 bg-[color-mix(in_srgb,var(--ng-admin-ground)_86%,transparent)] backdrop-blur-xl">
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
                  <h1 className="font-display text-[25px] leading-[1.15] tracking-[-0.02em] text-ng-forest-deep">{title}</h1>
                  {subtitle ? <p className="mt-1.5 font-sans text-[13px] font-medium leading-snug text-ng-ink-soft">{subtitle}</p> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {/* Left of the identity: the live session countdown. Hidden on
                    phones, where the header has room for the identity and one
                    control and the clock is the more sacrificial of the two. */}
                <SessionCountdown className="hidden md:inline-flex" />
                <AnimatedThemeToggle />
                <AdminIdentity />
              </div>
            </div>
            {/* Row 2 — page actions on their own row, centred, wrapping on small
                screens so they never overflow. Omitted when a page passes no
                actions.

                The row measures as exactly centred (340px clear either side at
                1440px), but reads right-heavy: five outline buttons followed by
                one solid primary pulls the eye to the end. `[&>*:last-child]`
                gives the primary a little air so the group reads as "utilities,
                then the main action" rather than an unbalanced run of six. */}
            {actions ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3 [&>*:last-child]:sm:ml-2">
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
    <div className="ng-surface h-full">
      <div className="ng-surface-core flex h-full flex-col p-5">
        {/* Label sits QUIETER than before and the number louder. A KPI tile has
            one job — the figure — and the old 11px label at the same ink weight
            as the value made the eye choose between them. */}
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ng-ink-soft">
          {label}
        </div>
        {/* tabular-nums so a column of tiles keeps its digits on a shared grid
            and the numbers stop shifting as they update. */}
        {/* Tweened, so a figure that changes under a live refresh is SEEN to
            change. The dashboards poll and update in place without a loading
            state — motion is the only signal left that a number moved. */}
        <div className="mt-3 font-display text-[36px] leading-[0.95] tracking-[-0.02em] tabular-nums text-ng-forest-deep">
          <CountUp value={value} />
        </div>
        {delta ? (
          <div className={cn("mt-auto pt-3 text-[12px] font-semibold tabular-nums", trendColor)}>
            {trendArrow} {delta}
          </div>
        ) : null}
      </div>
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
  // Edge-to-edge cards opt out of the card's inner padding via `!p-0` so their
  // table rows can run flush to the rounded border (each row supplies its own
  // px-*). In that case the title header must carry its OWN px/pt so the first
  // letter is never clipped by `overflow-hidden`, and the children must stay
  // unpadded. Plain cards keep their `p-6` look.
  const edgeToEdge = /(^|\s)!p-0(\s|$)/.test(className ?? "");
  /*
   * The class list is split between the two surfaces.
   *
   * `className` used to land on a single element that was both the card's
   * outer edge and its inner padding box. Now those are two elements, and the
   * distinction matters: a caller passing `mb-6` means "space below this card",
   * which belongs on the outer shell, while one passing `py-16` (an empty
   * state) or `!p-0` (a flush table) means "space around my content", which
   * belongs on the inner face.
   *
   * Sending everything to the shell would inflate the bezel itself — a 64px
   * tray around a 6px face — so padding and text-alignment are routed inward
   * and everything else stays out.
   */
  const parts = (className ?? "").split(/\s+/).filter(Boolean);
  const toCore = (c: string) => /^!?(p|px|py|pt|pb|pl|pr)-/.test(c) || /^text-(center|left|right)$/.test(c);
  const shellClass = parts.filter((c) => !toCore(c)).join(" ");
  const coreClass = parts.filter(toCore).join(" ");
  const hasHeader = Boolean(title || action);
  return (
    /*
     * `min-w-0` on both surfaces, and it is load-bearing rather than tidy.
     *
     * A grid or flex item defaults to `min-width: auto`, meaning it refuses to
     * shrink below its content's intrinsic minimum. Several cards wrap a wide
     * table in `overflow-x-auto` around a `min-w-[720px]` rail — the scroller
     * is meant to absorb that width. It cannot: the 720px floor propagates up
     * through the card and forces the whole grid column open, so at tablet
     * widths the console itself scrolled sideways instead of the table.
     *
     * `min-w-0` removes that floor, which is what lets the inner scroller do
     * the job it was added for. It belongs on the component rather than on each
     * call site because it is true of every card: a card should never push its
     * container wider than the container is.
     */
    <section className={cn("ng-surface h-full min-w-0", shellClass)}>
      <div className={cn("ng-surface-core flex h-full min-w-0 flex-col", edgeToEdge ? "overflow-hidden" : "p-6", coreClass)}>
        {hasHeader && (
          <header
            className={cn(
              "flex items-center justify-between gap-4 mb-5",
              edgeToEdge && "px-6 pt-6",
            )}
          >
            {title ? (
              <h2 className="font-display text-[18px] tracking-[-0.01em] text-ng-forest-deep">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {action}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

/*
 * Status pills.
 *
 * ── Why these are explicit colours and not palette tints ──────────────────
 *
 * The old map was five tints of the brand: `bg-ng-forest/15 text-ng-forest`
 * and friends. Two problems came out of that. Every tint of a green-and-gold
 * palette lands in the same narrow band, so the pills read as a row of beige
 * and grey lozenges rather than as states — and three different pipeline
 * stages (confirmed, packed, shipped) all mapped to the single `info` tone, so
 * they were not merely dull, they were indistinguishable.
 *
 * A status pipeline needs a stage to be identifiable at a glance from across a
 * table, which is the one job the brand palette is wrong for: it is designed to
 * harmonise, and these need to separate. So each stage gets its own hue, held
 * to the pale-ground/dark-ink pattern so they still sit quietly in a cream
 * admin rather than glowing.
 *
 * Every pair is measured: at 11px bold the pills need 4.5:1 and the weakest
 * here is 4.74:1.
 */
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "progress" | "transit";
  children: ReactNode;
}) {
  /*
   * Each tone carries a dark counterpart, because the light pills are pale
   * grounds with dark ink — on a dark console those invert into seven glowing
   * lozenges, the brightest thing on the screen, for information that is not
   * the most important thing on it. The dark set keeps the same hue and the
   * same relationship (tinted ground, legible ink of the same family) with the
   * values swapped: deep ground, light ink. Every pair measured above 7.7:1.
   *
   * Written as `dark:` variants rather than CSS variables so both palettes stay
   * visible in one place; a reader comparing "what is placed in light vs dark"
   * should not have to open another file.
   */
  const map: Record<string, string> = {
    neutral: "bg-[#EDEDE6] text-[#4A5249] ng-dark:bg-[#232821] ng-dark:text-[#B4BDB2]",
    success: "bg-[#D9EFD9] text-[#1B5E20] ng-dark:bg-[#13301A] ng-dark:text-[#9BD9A4]",
    warn: "bg-[#FDF0D5] text-[#8A6420] ng-dark:bg-[#3A2E12] ng-dark:text-[#F0D091]",
    danger: "bg-[#FBE0DB] text-[#9B2C15] ng-dark:bg-[#3A1810] ng-dark:text-[#F0A48D]",
    info: "bg-[#DCE8F5] text-[#1F4E85] ng-dark:bg-[#16283F] ng-dark:text-[#A8CBF0]",
    /* Packed — between acknowledged and moving. */
    progress: "bg-[#E7E2F3] text-[#4A3B7A] ng-dark:bg-[#241E3A] ng-dark:text-[#C3B8EC]",
    /* Shipped — on its way, not yet arrived. */
    transit: "bg-[#D7EDE8] text-[#1C5F52] ng-dark:bg-[#0F2E28] ng-dark:text-[#8FD9C8]",
  };
  return (
    <span className={cn("inline-block px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold", map[tone])}>
      {children}
    </span>
  );
}
