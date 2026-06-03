"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "../logo";
import { Icon } from "@/components/ui/icon";
import { getAdminEmail, signOutAdmin } from "@/lib/admin-auth";

const NAV = [
  { href: "/admin", label: "Overview", icon: "widget-5-bold" },
  { href: "/admin/catalog", label: "Catalog", icon: "bag-4-bold" },
  { href: "/admin/orders", label: "Orders", icon: "clipboard-list-bold" },
  { href: "/admin/inventory", label: "Inventory", icon: "box-minimalistic-bold" },
  { href: "/admin/marketing", label: "Marketing", icon: "speaker-bold" },
  { href: "/admin/people", label: "People", icon: "users-group-rounded-bold" },
  { href: "/admin/config", label: "Config", icon: "settings-bold" },
];

/** Top-right admin identity chip with a sign-out dropdown. */
function AdminIdentity() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEmail(getAdminEmail());
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
    signOutAdmin();
    router.push("/admin/login");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-ng-line-soft transition-colors"
      >
        <span className="size-9 rounded-full bg-ng-forest-deep text-ng-cream flex items-center justify-center font-display text-[14px]">
          {initial}
        </span>
        <Icon name="alt-arrow-down-bold" size={14} className="text-ng-ink-soft" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[0_12px_32px_rgba(31,77,46,0.12)] p-2 z-20"
        >
          <div className="px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-ng-ink-soft font-mono">
              Signed in as
            </div>
            <div className="font-mono text-[12.5px] text-ng-forest-deep truncate mt-0.5">
              {email ?? "admin"}
            </div>
          </div>
          <div className="h-px bg-ng-line-soft my-1" />
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-sans text-ng-ink hover:bg-ng-line-soft transition-colors"
          >
            <Icon name="shop-2-bold" size={16} className="text-ng-ink-soft" />
            View store
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-sans text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors"
          >
            <Icon name="logout-3-bold" size={16} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
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
  return (
    <div className="min-h-screen bg-ng-cream text-ng-ink flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-ng-forest-deep text-ng-cream/80 sticky top-0 h-screen overflow-y-auto">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2.5 mb-1">
            <Logo variant="mark" tone="white" className="h-9" />
            <span className="font-display text-[17px] text-ng-cream">Nutri Greenz</span>
          </Link>
          <div className="text-[10px] uppercase tracking-wider text-ng-clay mt-3 font-mono">Admin · v0.4.1</div>
        </div>
        <nav className="px-3 pb-6">
          {NAV.map((n) => {
            const isActive = active === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-sans font-medium text-[13.5px] tracking-[0.01em] transition-colors mb-0.5",
                  isActive
                    ? "bg-ng-cream/10 text-ng-cream"
                    : "text-ng-cream/70 hover:bg-ng-cream/5 hover:text-ng-cream",
                )}
              >
                <Icon
                  name={n.icon}
                  size={18}
                  className={cn(
                    "transition-colors",
                    isActive ? "text-ng-clay" : "text-ng-cream/45",
                  )}
                />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-ng-cream/5 border border-ng-cream/10 p-4 text-[12px] text-ng-cream/60">
            <div className="text-ng-clay font-semibold mb-1">Need a hand?</div>
            Slack #admin-portal · runbook link in handbook
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-ng-cream/85 backdrop-blur border-b border-ng-line-soft">
          <div className="px-8 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-[24px] text-ng-forest-deep leading-tight tracking-[-0.01em] truncate">{title}</h1>
              {subtitle ? <p className="font-sans text-[12.5px] text-ng-ink-soft mt-1.5">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {actions}
              <AdminIdentity />
            </div>
          </div>
        </header>
        <main className="px-8 py-8">{children}</main>
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
    <div className="rounded-2xl bg-ng-paper border border-ng-line-soft p-5">
      <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft">{label}</div>
      <div className="font-display text-[34px] text-ng-forest-deep leading-none mt-3">{value}</div>
      {delta ? (
        <div className={cn("text-[12px] mt-3 font-medium", trendColor)}>
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
  return (
    <section className={cn("rounded-2xl bg-ng-paper border border-ng-line-soft p-6", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 mb-5">
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
