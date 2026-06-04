"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ng/logo";
import { useCaptain } from "@/components/ng/captain/captain-store";

const TABS = [
  { href: "/captain", label: "Today", icon: "home-smile-bold", iconLine: "home-smile-linear" },
  { href: "/captain/intake", label: "Intake", icon: "user-plus-bold", iconLine: "user-plus-linear" },
  { href: "/captain/pickups", label: "Pickups", icon: "box-bold", iconLine: "box-linear" },
  { href: "/captain/settle", label: "Settle", icon: "wallet-money-bold", iconLine: "wallet-money-linear" },
] as const;

export function CaptainShell({
  children,
  title,
  subtitle,
  eyebrow,
}: {
  children: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small uppercase kicker above the title. */
  eyebrow?: ReactNode;
}) {
  const pathname = usePathname();
  const { captain } = useCaptain();

  return (
    <div className="min-h-screen bg-ng-forest-deep text-ng-cream flex justify-center">
      {/* Phone-shaped container — full width on mobile, framed on desktop */}
      <div className="w-full max-w-[460px] min-h-screen bg-ng-paper text-ng-ink relative flex flex-col sm:my-6 sm:min-h-[calc(100vh-3rem)] sm:rounded-[32px] sm:overflow-hidden sm:shadow-[0_30px_80px_rgba(10,31,18,0.45)]">
        {/* Top bar — Nutri Greenz mark + captain identity */}
        <header className="px-5 pt-5 pb-4 bg-ng-forest-deep text-ng-cream">
          <div className="flex items-center gap-3">
            <Logo variant="full" tone="white" className="!h-7" priority />
            <span className="text-[10px] uppercase tracking-[0.18em] text-ng-leaf-soft/90 border-l border-ng-cream/20 pl-3">
              Captain
            </span>
            <div className="ml-auto flex items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-soft/70 px-2.5 py-1 text-[10.5px] font-medium text-ng-leaf-soft"
                title="Offline-first: captures sync to HQ when you're back online"
              >
                <Icon name="cloud-bold" size={13} />
                Offline-ready
              </span>
              <div
                className="size-9 rounded-full bg-ng-leaf text-ng-forest-deep flex items-center justify-center font-display text-[13px] font-semibold"
                aria-hidden
              >
                {captain.initials}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-ng-cream/80">
            <Icon name="map-point-bold" size={14} className="text-ng-leaf" />
            <span className="font-medium text-ng-cream">{captain.name}</span>
            <span className="text-ng-cream/40">·</span>
            <span>{captain.area}</span>
          </div>
        </header>

        {/* Title block */}
        <div className="px-5 pt-5 pb-2">
          {eyebrow ? (
            <div className="text-[11px] uppercase tracking-[0.16em] text-ng-clay-deep font-semibold mb-1.5">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="font-display text-[clamp(26px,7vw,34px)] text-ng-forest-deep leading-[1.05] tracking-tight">
            {title}
          </h1>
          {subtitle ? <p className="text-[13px] text-ng-ink-muted mt-2">{subtitle}</p> : null}
        </div>

        {/* Content */}
        <main className="flex-1 px-5 pt-3 pb-28">{children}</main>

        {/* Bottom tab bar */}
        <nav
          aria-label="Captain sections"
          className="sticky bottom-0 z-20 bg-ng-paper/95 backdrop-blur border-t border-ng-line"
        >
          <div className="grid grid-cols-4">
            {TABS.map((t) => {
              const isActive =
                t.href === "/captain" ? pathname === "/captain" : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] transition-colors",
                    isActive ? "text-ng-forest font-semibold" : "text-ng-ink-soft hover:text-ng-forest",
                  )}
                >
                  <Icon
                    name={isActive ? t.icon : t.iconLine}
                    size={22}
                    className={isActive ? "text-ng-forest" : "text-ng-ink-soft"}
                  />
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function CaptainCard({
  children,
  className,
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "forest" | "clay" | "sage";
}) {
  const map: Record<string, string> = {
    paper: "bg-ng-white border-ng-line text-ng-ink shadow-[0_1px_3px_rgba(10,31,18,0.04)]",
    forest: "bg-ng-forest-deep border-ng-forest-deep text-ng-cream",
    clay: "bg-ng-clay/20 border-ng-clay/40 text-ng-forest-deep",
    sage: "bg-ng-sage/55 border-ng-line text-ng-forest-deep",
  };
  return <div className={cn("rounded-2xl border p-4", map[tone], className)}>{children}</div>;
}

/** Small labelled section heading with optional trailing action. */
export function CaptainSectionHead({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mt-6 mb-3", className)}>
      <h2 className="font-display text-[16px] text-ng-forest-deep">{children}</h2>
      {action}
    </div>
  );
}
