import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/captain", label: "Today", icon: "◉" },
  { href: "/captain/pickups", label: "Pickups", icon: "▥" },
  { href: "/captain/intake", label: "Intake", icon: "↓" },
  { href: "/captain/settle", label: "Settle", icon: "₹" },
];

export function CaptainShell({
  children,
  active,
  title,
  subtitle,
}: {
  children: ReactNode;
  active: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ng-forest-deep text-ng-cream flex justify-center">
      {/* Phone-shaped container */}
      <div className="w-full max-w-[440px] min-h-screen bg-ng-cream text-ng-ink relative flex flex-col shadow-[0_30px_80px_rgba(20,52,32,0.4)]">
        {/* Status bar dummy */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between text-[11px] text-ng-ink-soft font-mono">
          <span>9:41</span>
          <span>Captain PWA · v0.3.2</span>
          <span>◉ ◉ ◉</span>
        </div>

        {/* Top header */}
        <header className="px-6 pt-3 pb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="size-10 rounded-full bg-ng-forest-deep text-ng-cream flex items-center justify-center font-display text-[14px]">SK</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft">Captain</div>
              <div className="font-display text-[16px] text-ng-forest-deep leading-tight">Sneha Kumar · BLR-South</div>
            </div>
            <button className="size-9 rounded-full bg-ng-paper border border-ng-line-soft flex items-center justify-center text-ng-ink-muted">⌥</button>
          </div>
          <h1 className="font-display text-[clamp(28px,6vw,36px)] text-ng-forest-deep leading-[1.05] tracking-tight">
            {title}
          </h1>
          {subtitle ? <p className="text-[13px] text-ng-ink-muted mt-2">{subtitle}</p> : null}
        </header>

        {/* Content */}
        <main className="flex-1 px-6 pb-24">{children}</main>

        {/* Bottom tab bar */}
        <nav className="sticky bottom-0 bg-ng-paper/95 backdrop-blur border-t border-ng-line-soft">
          <div className="grid grid-cols-4">
            {TABS.map((t) => {
              const isActive = active === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-3 text-[11px] transition-colors",
                    isActive ? "text-ng-forest font-semibold" : "text-ng-ink-soft hover:text-ng-forest",
                  )}
                >
                  <span className={cn("text-[18px]", isActive ? "text-ng-clay" : "")}>{t.icon}</span>
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
    paper: "bg-ng-paper border-ng-line-soft text-ng-ink",
    forest: "bg-ng-forest-deep border-ng-forest-deep text-ng-cream",
    clay: "bg-ng-clay/30 border-ng-clay/40 text-ng-forest-deep",
    sage: "bg-ng-sage/60 border-ng-line text-ng-forest-deep",
  };
  return <div className={cn("rounded-2xl border p-5", map[tone], className)}>{children}</div>;
}
