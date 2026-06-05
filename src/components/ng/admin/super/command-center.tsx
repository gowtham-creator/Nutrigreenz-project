"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Presentational building blocks for the Super Admin *control center*. These
 * elevate the page above a regular admin screen — a distinguished forest hero
 * with gold (clay) accents, a live KPI strip, and authoritative section
 * headers with a gold left-rule. Everything here is purely visual and
 * props-driven: it holds NO store state, so the page keeps full ownership of
 * the commerce/loyalty wiring. On-brand tokens throughout (ng-forest-deep,
 * ng-clay, ng-cream, font-display headings, font-mono tabular-nums figures).
 */

/* ----------------------------------------------------------------------- */
/* KPI chip — one compact stat in the hero's live summary strip.           */
/* ----------------------------------------------------------------------- */
export function KpiChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  /** When true the figure renders in gold to flag a headline number. */
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-ng-cream/[0.08] border border-ng-cream/15 px-3.5 py-2.5 min-w-0 h-full">
      <span className="grid place-items-center size-8 shrink-0 rounded-lg bg-ng-cream/10 text-ng-clay">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[9.5px] uppercase tracking-[0.12em] text-ng-cream/55 font-mono truncate">
          {label}
        </span>
        <span
          className={cn(
            "block font-mono tabular-nums text-[14px] font-semibold truncate",
            accent ? "text-ng-clay" : "text-ng-cream",
          )}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Command-center hero — the distinguished header band.                     */
/* ----------------------------------------------------------------------- */
export type Kpi = {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
};

export function CommandCenterHero({
  operator,
  kpis,
}: {
  /** The signed-in operator's identity (email), shown in the hero. */
  operator: string | null;
  kpis: Kpi[];
}) {
  return (
    // Break out of <main>'s px-8 so the band reads as a full-width header,
    // then re-pad inside. Forest→deep gradient with a faint gold top hairline.
    <header className="-mx-8 -mt-8 mb-7">
      <div className="relative overflow-hidden bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep text-ng-cream">
        {/* Gold top hairline + soft radial glow for depth. */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ng-clay/70 to-transparent" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-ng-clay/10 blur-3xl"
        />
        <div className="relative px-8 py-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center size-11 rounded-2xl bg-ng-clay/20 ring-1 ring-ng-clay/40 text-ng-clay shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
                  <Icon name="crown-bold" size={22} />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/20 ring-1 ring-ng-clay/30 text-ng-clay font-bold px-3 py-1 text-[10.5px] uppercase tracking-[0.14em]">
                  <Icon name="shield-check-bold" size={12} />
                  Control Center
                </span>
              </div>
              <h1 className="font-display text-[30px] sm:text-[34px] leading-[1.05] tracking-[-0.01em] mt-3.5">
                Super <em className="not-italic text-ng-clay">Admin</em>
                <span className="text-ng-cream/60 font-sans font-normal text-[20px] align-middle mx-2">·</span>
                <span className="text-ng-cream/90">Control Center</span>
              </h1>
              <p className="font-sans text-[13px] text-ng-cream/70 mt-2 max-w-xl">
                Global settings that drive the live storefront — cart, checkout,
                loyalty &amp; growth levers.
              </p>
              <div className="mt-3.5 flex items-center gap-2 text-[11.5px] text-ng-cream/55">
                <Icon name="user-circle-bold" size={14} className="text-ng-clay/80" />
                <span>Operator</span>
                <span className="font-mono text-ng-cream/85 truncate max-w-[220px]">
                  {operator ?? "admin"}
                </span>
              </div>
            </div>

            {/* Live system pill — signals "you are at the controls". */}
            <span className="inline-flex items-center gap-2 rounded-full bg-ng-cream/[0.08] border border-ng-cream/15 px-3.5 py-2 text-[11px] font-medium text-ng-cream/80 shrink-0">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-ng-success opacity-70 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-ng-success" />
              </span>
              Live · driving storefront
            </span>
          </div>

          {/* Live KPI strip — compact figures read from the stores. */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {kpis.map((k) => (
              <KpiChip
                key={k.label}
                icon={k.icon}
                label={k.label}
                value={k.value}
                accent={k.accent}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------------- */
/* Section header — refined icon chip + title + "what this controls".       */
/* ----------------------------------------------------------------------- */
export function SectionHeader({
  icon,
  title,
  caption,
  tone = "forest",
  badge,
  action,
}: {
  icon: string;
  title: React.ReactNode;
  caption: string;
  /** Accent colour for the icon chip. */
  tone?: "forest" | "clay";
  /** Right-aligned status (e.g. an "Unsaved" Pill or a §ref eyebrow). */
  badge?: React.ReactNode;
  /** Optional right-aligned affordance (e.g. "Add coupon"). */
  action?: React.ReactNode;
}) {
  const chip =
    tone === "clay"
      ? "bg-ng-clay/15 text-ng-clay-deep ring-ng-clay/25"
      : "bg-ng-forest/12 text-ng-forest ring-ng-forest/15";
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        <span className={cn("grid place-items-center size-10 shrink-0 rounded-xl ring-1", chip)}>
          <Icon name={icon} size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[18px] text-ng-forest-deep leading-tight">{title}</h2>
          <p className="text-[12px] text-ng-ink-soft mt-1">{caption}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        {action}
        {badge}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Section shell — wraps a Card with optional authoritative gold left-rule. */
/* ----------------------------------------------------------------------- */
export function PrimarySection({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  // A subtle gold left-accent marks the headline (primary) super-admin
  // controls so they read as authoritative above the secondary sections.
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-32 mb-6 rounded-2xl bg-gradient-to-r from-ng-clay/45 to-transparent p-px",
        "shadow-[0_2px_18px_rgba(31,77,46,0.07)]",
        className,
      )}
    >
      <div className="rounded-2xl bg-ng-cream/0">{children}</div>
    </section>
  );
}
