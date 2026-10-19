"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ng/logo";
import { useCaptain, formatCaptainDate } from "@/components/ng/captain/captain-store";
import { UiIcon } from "@/components/ui/ui-icon";

const TABS = [
  { href: "/captain", label: "Today", icon: "home", iconLine: "home" },
  { href: "/captain/intake", label: "Intake", icon: "user-plus-bold", iconLine: "user-plus-linear" },
  { href: "/captain/pickups", label: "Pickups", icon: "order", iconLine: "order" },
  { href: "/captain/settle", label: "Settle", icon: "wallet", iconLine: "wallet" },
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
  /** Small context line above the title (date, section). */
  eyebrow?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { captain, pendingCount, signedOut } = useCaptain();
  const today = formatCaptainDate();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/captain/logout", { method: "POST" });
    } catch {
      /* the cookie expires on its own; still leave the app */
    }
    router.replace("/captain/login");
  }

  return (
    <div className="min-h-dvh bg-ng-forest-deep text-ng-cream flex justify-center">
      {/* Phone-shaped container: full width on mobile, framed on larger screens */}
      <div className="w-full max-w-[460px] min-h-dvh bg-ng-paper text-ng-ink relative flex flex-col sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[36px] sm:overflow-hidden sm:ring-1 sm:ring-ng-forest-deep/15 sm:shadow-xl">
        {/* ===== Top bar: who is signed in, where, and whether sales are saved ===== */}
        <header className="bg-ng-forest-deep text-ng-cream">
          <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <div className="flex items-center gap-3">
              <Logo variant="full" tone="white" className="!h-[24px]" priority />
              <div className="ml-auto flex items-center gap-2">
                <SyncChip pending={pendingCount} signedOut={signedOut} />
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ng-cream ring-1 ring-ng-cream/25 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-cream"
                >
                  <Icon name="login-3-bold" size={16} />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 items-center gap-2 text-[13px] text-ng-cream/80">
              <UiIcon name="location" size={15} className="text-ng-leaf shrink-0" />
              <span className="truncate">
                <span className="font-semibold text-ng-cream">{captain?.name ?? "Captain"}</span>
                {captain?.stall ? `, ${captain.stall}` : ""}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-ng-cream/65">{today}</span>
            </div>
          </div>
        </header>

        {signedOut ? (
          <div role="alert" className="flex items-start gap-3 border-b border-ng-amber/40 bg-ng-amber/15 px-4 py-3">
            <Icon name="danger-triangle-bold" size={18} className="mt-0.5 shrink-0 text-ng-soil" />
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-ng-ink text-pretty">
              You have been signed out.
              {pendingCount > 0
                ? ` ${pendingCount} sale${pendingCount === 1 ? " is" : "s are"} kept on this phone and will be sent after you sign in.`
                : " Sign in again to keep working."}
            </p>
            <Link
              href={`/captain/login?next=${encodeURIComponent(pathname)}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-ng-forest px-4 text-[13px] font-semibold text-ng-cream"
            >
              Sign in
            </Link>
          </div>
        ) : null}

        {/* ===== Title block ===== */}
        <div className="px-4 pt-5 pb-1">
          {eyebrow ? (
            <div className="text-[13px] font-medium text-ng-forest mb-1">{eyebrow}</div>
          ) : null}
          <h1 className="font-display text-[28px] text-ng-forest-deep leading-[1.1] text-balance">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[14px] text-ng-ink-muted mt-1.5 leading-snug text-pretty">{subtitle}</p>
          ) : null}
        </div>

        {/* ===== Content ===== */}
        <main className="flex-1 px-4 pt-3 pb-[max(7rem,calc(6rem+env(safe-area-inset-bottom)))]">
          {children}
        </main>

        {/* ===== Bottom tab bar ===== */}
        <nav
          aria-label="Captain sections"
          className="sticky bottom-0 z-20 border-t border-ng-line bg-ng-paper pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-4 px-1">
            {TABS.map((t) => {
              const isActive =
                t.href === "/captain" ? pathname === "/captain" : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[12px] cursor-pointer transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ng-forest",
                    isActive ? "text-ng-forest font-semibold" : "text-ng-ink-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                      isActive ? "bg-ng-forest text-ng-cream" : "text-ng-ink-muted",
                    )}
                  >
                    <Icon name={isActive ? t.icon : t.iconLine} size={20} />
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

/** Whether every sale on this phone has reached the server. */
function SyncChip({ pending, signedOut }: { pending: number; signedOut: boolean }) {
  const waiting = pending > 0;
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold tabular-nums",
        waiting || signedOut ? "bg-ng-amber/25 text-ng-cream" : "bg-ng-cream/10 text-ng-cream/85",
      )}
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn("size-2 rounded-full", waiting || signedOut ? "bg-ng-amber" : "bg-ng-leaf")}
      />
      {waiting ? `${pending} not sent` : signedOut ? "Signed out" : "All saved"}
    </span>
  );
}

/** Pickup status as a chip. Each status gets its own colour and its own word,
 *  so it never depends on colour alone. */
export function CaptainStatusChip({ status }: { status: "due" | "collected" | "handed_over" }) {
  const map = {
    due: { label: "Due", cls: "bg-ng-amber/20 text-ng-soil ring-ng-amber/40" },
    collected: { label: "Collected", cls: "bg-ng-leaf/20 text-ng-forest-deep ring-ng-leaf/50" },
    handed_over: { label: "Handed over", cls: "bg-ng-forest text-ng-cream ring-ng-forest" },
  }[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", map.cls)}>
      {map.label}
    </span>
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
    paper: "bg-ng-white border-ng-line text-ng-ink",
    sage: "bg-ng-sage/55 border-ng-line text-ng-forest-deep",
  };
  return <div className={cn("rounded-2xl border p-4", map[tone], className)}>{children}</div>;
}

/**
 * Canonical dark "forest" surface: the single emphasis treatment shared by
 * every captain screen (today's total, reconciled total, next stop, submitted).
 * Flat on purpose so figures read in sunlight. Callers set padding via
 * `className` (heroes use `p-5`, inline confirmations `p-4`).
 */
export function CaptainHero({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-ng-forest-deep text-ng-cream", className)}>{children}</div>
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
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  className?: string;
  /** One clear next step, e.g. a link or a retry button. */
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ng-line bg-ng-white px-5 py-7 text-center",
        className,
      )}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-ng-sage/50">
        <Icon name={icon} size={24} className="text-ng-forest" />
      </div>
      <p className="mt-3 text-[15px] font-semibold text-ng-forest-deep text-balance">{title}</p>
      {hint ? (
        <p className="mx-auto mt-1 max-w-[18rem] text-[13px] leading-snug text-ng-ink-muted text-pretty">{hint}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
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
    paper: "bg-ng-white border border-ng-line",
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
          "font-display text-[22px] leading-none mt-2 truncate tabular-nums",
          onDark ? "text-ng-cream" : "text-ng-forest-deep",
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "text-[12px] mt-1.5",
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
    <div className={cn("flex items-center justify-between gap-3 mt-7 mb-3", className)}>
      <h2 className="font-display text-[18px] text-ng-forest-deep text-balance">{children}</h2>
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
