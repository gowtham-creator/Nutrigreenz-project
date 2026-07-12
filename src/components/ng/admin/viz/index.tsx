/**
 * Admin data-viz primitives — hand-authored CSS/SVG, NO chart libraries.
 *
 * Everything here is a server-safe, dependency-free chart: sparklines, mini
 * bar/line/area, donut/gauge rings, trend chips, progress meters and pipeline
 * funnels. Colours map to the ng-* token palette so charts read as one designed
 * product alongside Card / Pill / StatTile.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Palette tokens usable as SVG stroke/fill via CSS custom props. */
export type VizTone = "forest" | "leaf" | "clay" | "terracotta" | "blue" | "amber" | "ink";

const TONE_STROKE: Record<VizTone, string> = {
  forest: "var(--ng-forest)",
  leaf: "var(--ng-leaf)",
  clay: "var(--ng-clay)",
  terracotta: "var(--ng-terracotta)",
  blue: "var(--ng-blue)",
  amber: "var(--ng-amber)",
  ink: "var(--ng-ink-muted)",
};

function buildPoints(values: number[], w: number, h: number, pad = 2) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
}

/* ------------------------------------------------------------------ */
/* TrendChip — compact ▲/▼ pill with a delta                          */
/* ------------------------------------------------------------------ */

export function TrendChip({
  delta,
  direction,
  className,
}: {
  delta: string;
  direction: "up" | "down" | "flat";
  className?: string;
}) {
  const map = {
    up: { c: "text-ng-success bg-ng-success/12", a: "M3 8.5L6 5.5L8 7.5L11 4" },
    down: { c: "text-ng-terracotta bg-ng-terracotta/12", a: "M3 4L6 7L8 5L11 8.5" },
    flat: { c: "text-ng-ink-muted bg-ng-line-soft", a: "M3 6.5H11" },
  }[direction];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        map.c,
        className,
      )}
    >
      <svg width="13" height="11" viewBox="0 0 14 12" fill="none" aria-hidden>
        <path d={map.a} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {delta}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — tiny line+area, in-flow with metric                    */
/* ------------------------------------------------------------------ */

export function Sparkline({
  data,
  tone = "forest",
  width = 120,
  height = 36,
  fill = true,
  className,
}: {
  data: number[];
  tone?: VizTone;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
}) {
  const pts = buildPoints(data, width, height, 3);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pts[0][0].toFixed(1)},${height} ${line} ${pts[pts.length - 1][0].toFixed(1)},${height}`;
  const last = pts[pts.length - 1];
  const gid = `spark-${tone}-${width}-${height}-${Math.round(data[0] ?? 0)}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TONE_STROKE[tone]} stopOpacity="0.22" />
          <stop offset="100%" stopColor={TONE_STROKE[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <polygon points={area} fill={`url(#${gid})`} /> : null}
      <polyline
        points={line}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={TONE_STROKE[tone]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* MiniBars — compact vertical bar chart                              */
/* ------------------------------------------------------------------ */

export function MiniBars({
  data,
  tone = "forest",
  width = 120,
  height = 36,
  highlightLast = true,
  className,
}: {
  data: number[];
  tone?: VizTone;
  width?: number;
  height?: number;
  highlightLast?: boolean;
  className?: string;
}) {
  const max = Math.max(...data, 1);
  const gap = 2;
  const bw = (width - gap * (data.length - 1)) / data.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {data.map((v, i) => {
        const bh = Math.max(2, (v / max) * (height - 2));
        const x = i * (bw + gap);
        const isLast = i === data.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={height - bh}
            width={bw}
            height={bh}
            rx={Math.min(2, bw / 2)}
            fill={TONE_STROKE[tone]}
            opacity={highlightLast && !isLast ? 0.3 : highlightLast ? 1 : 0.65}
          />
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* AreaChart — larger labelled trend chart with grid + axis           */
/* ------------------------------------------------------------------ */

export function AreaChart({
  series,
  labels,
  height = 220,
  formatY,
  className,
}: {
  /** one or two named series sharing the same x-axis */
  series: { name: string; data: number[]; tone: VizTone }[];
  labels: string[];
  height?: number;
  formatY?: (v: number) => string;
  className?: string;
}) {
  const W = 720;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 26;
  const allVals = series.flatMap((s) => s.data);
  const max = Math.max(...allVals, 1);
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const gridLines = 4;

  const toPts = (data: number[]) => {
    const step = data.length > 1 ? (W - padL - padR) / (data.length - 1) : 0;
    return data.map((v, i) => {
      const x = padL + i * step;
      const y = padT + (1 - v / niceMax) * (H - padT - padB);
      return [x, y] as const;
    });
  };

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.name} id={`area-${s.name.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TONE_STROKE[s.tone]} stopOpacity="0.20" />
              <stop offset="100%" stopColor={TONE_STROKE[s.tone]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* grid */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padT + (i / gridLines) * (H - padT - padB);
          const val = niceMax * (1 - i / gridLines);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--ng-line-soft)" strokeWidth="1" />
              <text x={padL} y={y - 3} fontSize="11" fill="var(--ng-ink-soft)" className="font-mono font-medium">
                {formatY ? formatY(val) : Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* series */}
        {series.map((s) => {
          const pts = toPts(s.data);
          const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
          const area = `${pts[0][0]},${H - padB} ${line} ${pts[pts.length - 1][0]},${H - padB}`;
          return (
            <g key={s.name}>
              <polygon points={area} fill={`url(#area-${s.name.replace(/\s/g, "")})`} />
              <polyline
                points={line}
                fill="none"
                stroke={TONE_STROKE[s.tone]}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="3" fill="var(--ng-paper)" stroke={TONE_STROKE[s.tone]} strokeWidth="2" />
              ))}
            </g>
          );
        })}
      </svg>

      {/* x labels */}
      <div className="flex justify-between px-1 mt-1">
        {labels.map((l, i) => (
          <span key={i} className="text-[11px] text-ng-ink-soft font-mono font-medium">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DonutChart — proportion ring with legend                           */
/* ------------------------------------------------------------------ */

export function DonutChart({
  segments,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
  className,
}: {
  segments: { label: string; value: number; tone: VizTone }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ng-line-soft)" strokeWidth={thickness} />
          {segments.map((s, i) => {
            const len = (s.value / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={TONE_STROKE[s.tone]}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue ? (
              <span className="font-display text-[26px] text-ng-forest-deep leading-none tabular-nums">{centerValue}</span>
            ) : null}
            {centerLabel ? <span className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mt-1">{centerLabel}</span> : null}
          </div>
        )}
      </div>
      <ul className="space-y-2 min-w-0">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[12.5px]">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: TONE_STROKE[s.tone] }} />
            <span className="text-ng-ink-muted font-medium truncate">{s.label}</span>
            <span className="ml-auto font-mono tabular-nums text-ng-forest-deep font-semibold pl-3">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HBars — horizontal labelled bars (top categories / products)       */
/* ------------------------------------------------------------------ */

export function HBars({
  rows,
  tone = "forest",
  formatValue,
  className,
}: {
  rows: { label: string; value: number; hint?: string; tone?: VizTone }[];
  tone?: VizTone;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className={cn("space-y-3.5", className)}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-[12.5px] font-semibold text-ng-ink truncate">{r.label}</span>
            <span className="font-mono text-[12px] tabular-nums text-ng-forest-deep font-semibold shrink-0">
              {formatValue ? formatValue(r.value) : r.value}
              {r.hint ? <span className="text-ng-ink-soft font-sans font-medium ml-1.5">{r.hint}</span> : null}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ng-line-soft overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: TONE_STROKE[r.tone ?? tone] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* StockMeter — low/ok/out stock indicator bar                        */
/* ------------------------------------------------------------------ */

export function StockMeter({
  stock,
  threshold,
  capacity,
  className,
}: {
  stock: number;
  threshold: number;
  capacity?: number;
  className?: string;
}) {
  const cap = capacity ?? Math.max(threshold * 2.5, stock);
  const pct = Math.min(100, (stock / cap) * 100);
  const state = stock <= 0 ? "out" : stock <= threshold ? "low" : "ok";
  const color =
    state === "out" ? "var(--ng-ink-muted)" : state === "low" ? "var(--ng-terracotta)" : "var(--ng-leaf)";
  const thresholdPct = Math.min(100, (threshold / cap) * 100);
  return (
    <div className={cn("flex items-center gap-2.5 min-w-[120px]", className)}>
      <div className="relative h-2 flex-1 rounded-full bg-ng-line-soft overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
        {/* reorder threshold marker */}
        <span
          className="absolute top-[-2px] bottom-[-2px] w-px bg-ng-ink-soft/50"
          style={{ left: `${thresholdPct}%` }}
          aria-hidden
        />
      </div>
      <span className="font-mono text-[11.5px] font-semibold tabular-nums text-ng-ink w-9 text-right">{stock}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline — order-status funnel                                      */
/* ------------------------------------------------------------------ */

export function Pipeline({
  stages,
  className,
}: {
  stages: { label: string; value: number; tone: VizTone }[];
  className?: string;
}) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className={cn("space-y-3", className)}>
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-[12px] font-medium text-ng-ink-muted flex items-center gap-2">
              <span className="font-mono text-[11px] font-medium text-ng-ink-soft">{String(i + 1).padStart(2, "0")}</span>
              {s.label}
            </div>
            <div className="flex-1 h-7 rounded-lg bg-ng-line-soft/60 overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center justify-end pr-2.5 transition-all"
                style={{ width: `${Math.max(8, pct)}%`, background: TONE_STROKE[s.tone] }}
              >
                <span className="font-mono text-[11.5px] font-bold text-white tabular-nums">{s.value}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GaugeRing — single-metric progress ring (SLA / fulfilment)         */
/* ------------------------------------------------------------------ */

export function GaugeRing({
  value,
  label,
  tone = "leaf",
  size = 72,
  thickness = 8,
  suffix = "%",
}: {
  value: number;
  label?: ReactNode;
  tone?: VizTone;
  size?: number;
  thickness?: number;
  suffix?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const len = (Math.min(100, value) / 100) * c;
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ng-line-soft)" strokeWidth={thickness} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[15px] text-ng-forest-deep tabular-nums">
            {value}
            {suffix}
          </span>
        </div>
      </div>
      {label ? <div className="text-[12px] font-medium text-ng-ink-muted leading-snug">{label}</div> : null}
    </div>
  );
}
