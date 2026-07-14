"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ng/logo";
import { useCaptain, formatCaptainDate } from "@/components/ng/captain/captain-store";

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
  const today = formatCaptainDate();

  return (
    <div className="min-h-screen bg-ng-forest-deep text-ng-cream flex justify-center">
      {/* Phone-shaped container — full width on mobile, framed on desktop */}
      <div className="w-full max-w-[460px] min-h-screen bg-ng-paper text-ng-ink relative flex flex-col sm:my-6 sm:min-h-[calc(100vh-3rem)] sm:rounded-[36px] sm:overflow-hidden sm:ring-1 sm:ring-ng-forest-deep/15 sm:shadow-[0_40px_90px_-20px_rgba(10,31,18,0.55)]">
        {/* ===== On-duty top bar — lush forest gradient ===== */}
        <header className="relative overflow-hidden bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-forest-deep text-ng-cream">
          {/* layered plant-green ambience */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(115% 80% at 85% -12%, rgba(102,191,115,0.30), transparent 58%), radial-gradient(100% 70% at 0% 6%, rgba(76,175,80,0.16), transparent 55%)",
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-ng-leaf/45 to-transparent" aria-hidden />

          <div className="relative px-5 pt-[max(1.15rem,env(safe-area-inset-top))] pb-4">
            {/* Row 1 — brand · role · duty · avatar */}
            <div className="flex items-center gap-2.5">
              <Logo variant="full" tone="white" className="!h-[26px]" priority />
              <span className="inline-flex items-center gap-1 rounded-md bg-ng-leaf/15 ring-1 ring-ng-leaf/35 px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.18em] text-ng-leaf">
                <Icon name="shield-star-bold" size={11} className="text-ng-leaf" />
                Captain
              </span>

              <div className="ml-auto flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-soft/55 ring-1 ring-ng-leaf/25 px-2.5 py-[5px] text-[10px] font-semibold text-ng-leaf-soft"
                  title="On duty · captures sync to HQ when you're back online"
                >
                  <span className="relative flex size-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full rounded-full bg-ng-leaf opacity-70 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-ng-leaf" />
                  </span>
                  On duty
                </span>
                <div
                  className="relative size-9 rounded-full bg-ng-leaf text-ng-forest-deep flex items-center justify-center font-display text-[13px] font-semibold ring-2 ring-ng-leaf/30 ring-offset-2 ring-offset-ng-forest-deep"
                  aria-hidden
                >
                  {captain.initials}
                </div>
              </div>
            </div>

            {/* Row 2 — one grouped context strip (identity + shift), no scattered pills */}
            <div className="mt-3.5 rounded-2xl bg-ng-forest-soft/30 ring-1 ring-ng-leaf/12 divide-y divide-ng-leaf/10">
              <div className="flex items-center gap-2 px-3 py-2">
                <Icon name="map-point-bold" size={14} className="text-ng-leaf shrink-0" />
                <span className="font-semibold text-ng-cream truncate text-[12px]">{captain.name}</span>
                <span className="text-ng-cream/30">·</span>
                <span className="truncate text-[12px] text-ng-cream/70">{captain.area}</span>
                <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[10px] text-ng-cream/60">
                  <Icon name="cloud-bold" size={12} className="text-ng-leaf-soft" />
                  Offline-ready
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <Icon name="routing-2-bold" size={14} className="text-ng-leaf shrink-0" />
                <span className="text-[11.5px] text-ng-cream/55 shrink-0">Today · {today}</span>
                <span className="text-ng-cream/25">·</span>
                <span className="text-[11.5px] font-semibold text-ng-cream truncate">{captain.stall}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ===== Title block ===== */}
        <div className="px-5 pt-5 pb-1.5">
          {eyebrow ? (
            <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-ng-forest font-bold mb-1.5">
              <span className="inline-block h-[3px] w-3.5 rounded-full bg-ng-leaf" aria-hidden />
              {eyebrow}
            </div>
          ) : null}
          <h1 className="font-display text-[clamp(26px,7vw,33px)] text-ng-forest-deep leading-[1.05] tracking-tight">
            {title}
          </h1>
          {subtitle ? <p className="text-[13px] text-ng-ink-muted mt-2 leading-snug">{subtitle}</p> : null}
        </div>

        {/* ===== Content ===== */}
        <main className="flex-1 px-5 pt-3 pb-[max(7.5rem,calc(6.5rem+env(safe-area-inset-bottom)))]">
          {children}
        </main>

        {/* ===== Bottom tab bar ===== */}
        <nav
          aria-label="Captain sections"
          className="sticky bottom-0 z-20 border-t border-ng-line bg-ng-paper/92 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-4 px-2 py-1.5">
            {TABS.map((t) => {
              const isActive =
                t.href === "/captain" ? pathname === "/captain" : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[10.5px] cursor-pointer transition-colors",
                    isActive ? "text-ng-forest font-bold" : "text-ng-ink-soft hover:text-ng-forest",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full transition-all duration-200",
                      isActive
                        ? "size-9 bg-ng-forest text-ng-cream shadow-[0_6px_16px_-4px_rgba(20,51,31,0.55)]"
                        : "size-9 text-ng-ink-soft group-hover:bg-ng-sage/40",
                    )}
                  >
                    <Icon name={isActive ? t.icon : t.iconLine} size={21} />
                  </span>
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
  tone?: "paper" | "sage";
}) {
  const map: Record<"paper" | "sage", string> = {
    paper: "bg-ng-white border-ng-line text-ng-ink shadow-[0_1px_3px_rgba(10,31,18,0.04)]",
    sage: "bg-ng-sage/55 border-ng-line text-ng-forest-deep",
  };
  return <div className={cn("rounded-2xl border p-4", map[tone], className)}>{children}</div>;
}

/**
 * Canonical dark "forest" surface — the single hero/emphasis treatment shared by
 * every captain screen (mission, reconciled total, next stop, submitted). Bakes
 * in the lush gradient + soft plant-green ambience so the surfaces never diverge.
 * Callers set padding via `className` (heroes use `p-5`, inline confirmations `p-4`).
 */
export function CaptainHero({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-ng-forest-deep text-ng-cream",
        "bg-ng-forest-deep bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-forest-deep",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -top-14 -right-12 size-44 rounded-full bg-ng-leaf/20 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-ng-green-bright/12 blur-2xl"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * Shared empty-state block — one calm, consistent pattern (icon chip · title ·
 * hint) reused across Today, Pickups, Intake and Settle so "nothing here yet"
 * always reads the same.
 */
export function CaptainEmpty({
  icon,
  title,
  hint,
  className,
}: {
  icon: string;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ng-line bg-ng-sage/45 px-5 py-8 text-center",
        className,
      )}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-ng-white/70 ring-1 ring-ng-line-soft">
        <Icon name={icon} size={24} className="text-ng-forest" />
      </div>
      <p className="mt-3 text-[13.5px] font-semibold text-ng-forest-deep">{title}</p>
      {hint ? (
        <p className="mx-auto mt-1 max-w-[17rem] text-[12px] leading-snug text-ng-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Compact metric tile — one consistent stat card shared across Today, Pickups
 * and Settle so the dashboards read as one system. `tone` adapts it to paper
 * surfaces or the dark forest heroes.
 */
export function CaptainStat({
  icon,
  label,
  value,
  tone = "paper",
}: {
  icon: string;
  label: string;
  value: string | number;
  tone?: "paper" | "forest" | "sage" | "onForest";
}) {
  const surface: Record<string, string> = {
    paper: "bg-ng-white border border-ng-line shadow-[0_1px_3px_rgba(10,31,18,0.04)]",
    forest: "bg-ng-forest border border-ng-forest",
    sage: "bg-ng-sage/45 border border-ng-line",
    onForest: "bg-ng-forest-soft/40 border border-ng-leaf/12",
  };
  const onDark = tone === "forest" || tone === "onForest";
  return (
    <div className={cn("rounded-2xl px-3 py-3", surface[tone])}>
      <Icon name={icon} size={17} className={onDark ? "text-ng-leaf" : "text-ng-forest"} />
      <div
        className={cn(
          "font-display text-[19px] leading-none mt-2 truncate",
          onDark ? "text-ng-cream" : "text-ng-forest-deep",
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "text-[10px] uppercase tracking-wider mt-1",
          onDark ? "text-ng-leaf-soft" : "text-ng-ink-soft",
        )}
      >
        {label}
      </div>
    </div>
  );
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
      <h2 className="font-display text-[16px] text-ng-forest-deep flex items-center gap-2">
        <span className="inline-block h-3.5 w-1 rounded-full bg-ng-leaf" aria-hidden />
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * SVG progress ring for the "daily mission" framing. Pure presentation; the
 * stroke fills toward `value / max`. Renders the value/label in the centre.
 */
export function CaptainRing({
  value,
  max,
  size = 92,
  stroke = 9,
  className,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: ReactNode;
}) {
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(1, value / safeMax));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-ng-cream/12"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="text-ng-leaf motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
