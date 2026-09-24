"use client";

/**
 * Admin data-viz primitives — hand-authored CSS/SVG, NO chart libraries.
 *
 * Everything here is a dependency-free chart: sparklines, mini bar/line/area,
 * donut/gauge rings, trend chips, progress meters and pipeline funnels. Colours
 * map to the ng-* token palette so charts read as one designed product
 * alongside Card / Pill / StatTile.
 *
 * Marked "use client" because AreaChart tracks pointer position to show a
 * read-out on hover. Every importer is already a client component, so this
 * costs nothing — it just makes the boundary explicit instead of relying on
 * the module being pulled into a client graph by accident.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Palette tokens usable as SVG stroke/fill via CSS custom props.
 *
 * The first seven are the UI palette. The rest are the chart palette
 * (`--ng-viz-*` in globals.css), validated for colour-vision separation in
 * both themes: `stage1`..`stage5` for order status in flow order, the
 * `paid`/`pending`/`failed` status trio, `cat1`..`cat3` for unordered
 * identities, and `compare` for a previous-period line. Prefer them for data;
 * the UI tones were never tuned to be told apart.
 */
export type VizTone =
  | "forest"
  | "leaf"
  | "clay"
  | "terracotta"
  | "blue"
  | "amber"
  | "ink"
  | "stage1"
  | "stage2"
  | "stage3"
  | "stage4"
  | "stage5"
  | "paid"
  | "pending"
  | "failed"
  | "compare"
  | "cat1"
  | "cat2"
  | "cat3";

/** Order status → its step on the validated forest ramp, in flow order. */
export const STAGE_TONE = {
  placed: "stage1",
  confirmed: "stage2",
  packed: "stage3",
  shipped: "stage4",
  delivered: "stage5",
} as const satisfies Record<string, VizTone>;

/** Payment status → the reserved status trio. */
export const PAYMENT_TONE = {
  paid: "paid",
  pending: "pending",
  failed: "failed",
} as const satisfies Record<string, VizTone>;

const TONE_STROKE: Record<VizTone, string> = {
  forest: "var(--ng-forest)",
  leaf: "var(--ng-leaf)",
  clay: "var(--ng-clay)",
  terracotta: "var(--ng-terracotta)",
  blue: "var(--ng-blue)",
  amber: "var(--ng-amber)",
  ink: "var(--ng-ink-muted)",
  stage1: "var(--ng-viz-stage-1)",
  stage2: "var(--ng-viz-stage-2)",
  stage3: "var(--ng-viz-stage-3)",
  stage4: "var(--ng-viz-stage-4)",
  stage5: "var(--ng-viz-stage-5)",
  paid: "var(--ng-viz-paid)",
  pending: "var(--ng-viz-pending)",
  failed: "var(--ng-viz-failed)",
  compare: "var(--ng-viz-compare)",
  cat1: "var(--ng-viz-cat-1)",
  cat2: "var(--ng-viz-cat-2)",
  cat3: "var(--ng-viz-cat-3)",
};

/**
 * Change between two figures, as the chip and sentence a KPI needs.
 *
 * Returns null when there is nothing honest to say: no previous period, or a
 * previous value of zero, where any percentage is infinite and "+∞%" helps
 * nobody. `goodWhen` decides the colour, because a rise is good news for
 * revenue and bad news for money still owed.
 */
export function compareFigures(
  current: number,
  previous: number | null | undefined,
  goodWhen: "up" | "down" = "up",
): { text: string; direction: "up" | "down" | "flat"; sentiment: "good" | "bad" | "neutral" } | null {
  if (previous == null || previous === 0) return null;
  const change = (current - previous) / Math.abs(previous);
  const pct = Math.round(change * 100);
  if (pct === 0) return { text: "0%", direction: "flat", sentiment: "neutral" };
  const direction = pct > 0 ? "up" : "down";
  return {
    text: `${Math.abs(pct)}%`,
    direction,
    sentiment: direction === goodWhen ? "good" : "bad",
  };
}

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
  sentiment,
  className,
}: {
  delta: string;
  direction: "up" | "down" | "flat";
  /**
   * Colour, decided separately from the arrow. Up is not always good: more
   * money still owed is an arrow pointing up in the bad colour. Defaults to
   * the old coupling (up good, down bad) for existing callers.
   */
  sentiment?: "good" | "bad" | "neutral";
  className?: string;
}) {
  const arrow = {
    up: "M3 8.5L6 5.5L8 7.5L11 4",
    down: "M3 4L6 7L8 5L11 8.5",
    flat: "M3 6.5H11",
  }[direction];
  const tone = sentiment ?? (direction === "up" ? "good" : direction === "down" ? "bad" : "neutral");
  const colour = {
    good: "text-ng-success bg-ng-success/12",
    bad: "text-ng-terracotta bg-ng-terracotta/12",
    neutral: "text-ng-ink-muted bg-ng-line-soft",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        colour,
        className,
      )}
    >
      <svg width="13" height="11" viewBox="0 0 14 12" fill="none" aria-hidden>
        <path d={arrow} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
  annotatePeak = false,
  label,
  className,
}: {
  /**
   * Named series sharing the x-axis. A `compare` series is the previous
   * period: a recessive dashed line with no fill and no markers, there to give
   * the solid line something to be judged against rather than to be read.
   */
  series: { name: string; data: number[]; tone: VizTone; variant?: "compare" }[];
  labels: string[];
  height?: number;
  formatY?: (v: number) => string;
  /** Mark the highest point of the first solid series with its value. */
  annotatePeak?: boolean;
  /** Accessible name, announced when the chart takes keyboard focus. */
  label?: string;
  className?: string;
}) {
  const W = 720;
  const H = height;
  /*
   * The plot starts clear of the axis labels.
   *
   * padL was 8 and served two jobs at once: it positioned the y-axis text AND
   * marked where the line begins. So the first data point was drawn at exactly
   * the x the label occupies, and on any range whose first value sat near a
   * gridline the marker landed on top of the number — "45" and "₹2,030" with a
   * circle through them.
   *
   * The label now keeps the left gutter to itself and the plot begins after it.
   * Wide enough for a formatted rupee value, which is the longest thing that
   * ever renders there.
   */
  const padL = 62;
  const padR = 8;
  const padT = 16;
  const padB = 26;
  const allVals = series.flatMap((s) => s.data);
  const max = Math.max(...allVals, 1);
  const gridLines = 4;

  /*
   * A y-axis whose printed numbers match its evenly-spaced lines.
   *
   * The scale was `Math.ceil(max / 5) * 5`, which rounds the TOP of the axis
   * to a multiple of five but says nothing about whether that top divides by
   * the four gridlines beneath it. It usually does not, and the labels were
   * then rounded for display, so the axis printed uneven steps against evenly
   * spaced rules:
   *
   *   max 9  -> top 10 -> 10, 8, 5, 3, 0   gaps 2,3,2,3
   *   max 47 -> top 50 -> 50, 38, 25, 13, 0  gaps 12,13,12,13
   *
   * Six of eight sampled maxima came out uneven. On a chart of daily views,
   * where the peak is single digits, that is the common case — the axis was
   * misdescribing the data it sat next to.
   *
   * Standard nice-number scaling instead: round the STEP up to 1, 2, 2.5 or 5
   * times a power of ten, then derive the top from it. The top is a multiple
   * of the step by construction, so every label is exact and no rounding is
   * needed to print it.
   */
  const niceStep = useMemo(() => {
    /*
     * Candidate steps: familiar bases across each magnitude, keeping only
     * those that come out whole. These axes count things — orders, views,
     * saves — so a step of 2.5 would print "7.5 views", which is why the
     * textbook 1/2/2.5/5 set is filtered rather than used directly.
     *
     * 3, 6 and 8 are included alongside the usual bases because at the small
     * magnitudes this dashboard actually plots, restricting to 1/2/5 forces
     * large jumps: a peak of 23 would round to a top of 40 and leave the plot
     * using 57% of its height. With 6 available it tops at 24 and fills 96%.
     */
    const steps: number[] = [];
    for (let e = 0; e < 9; e++) {
      const mag = 10 ** e;
      for (const base of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8]) {
        const s = base * mag;
        if (Number.isInteger(s)) steps.push(s);
      }
    }
    const sorted = [...new Set(steps)].sort((a, b) => a - b);
    // Smallest step whose four intervals still cover the tallest value.
    return sorted.find((s) => s * gridLines >= max) ?? Math.ceil(max / gridLines);
  }, [max]);

  /** Top of the axis. A multiple of the step by construction, so every tick
   *  label is exact and none of them need rounding to print. */
  const niceMax = niceStep * gridLines;

  const plotY = (v: number) => padT + (1 - v / niceMax) * (H - padT - padB);
  const toPts = (data: number[]) => {
    const step = data.length > 1 ? (W - padL - padR) / (data.length - 1) : 0;
    return data.map((v, i) => [padL + i * step, plotY(v)] as const);
  };

  /* Hover read-out.
   *
   * The chart plotted its points and nothing else: you could see that Tuesday
   * was higher than Monday but never what either actually was. The x-axis is
   * also thinned to ~8 labels, so on a 90-day range most points had no date
   * against them at all.
   *
   * Pointer position maps back to the nearest data index. The SVG is stretched
   * to the container (`preserveAspectRatio="none"`), so screen x has to be
   * converted into viewBox units via the measured width rather than assumed. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  /* The chart's rendered width, so the date axis can hold as many labels as
     actually fit. A fixed eight collided in a half-width card: "20 Sept24
     Sept". Zero until measured, which falls back to the full eight. */
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setBoxW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
   * Which x labels to print. At most eight, evenly spaced, always including the
   * first and the last, and never two adjacent — computing the set up front is
   * what avoids the gap the old "print every Nth, then drop crowded ones" rule
   * produced at the right-hand end.
   */
  const xTickSet = useMemo(() => {
    const n = labels.length;
    const set = new Set<number>();
    if (n === 0) return set;
    // About 80px per date label, the width of "24 Sept" plus air either side.
    const fit = boxW > 0 ? Math.max(2, Math.min(8, Math.floor((boxW * (1 - (padL + padR) / W)) / 80))) : 8;
    if (n <= fit) {
      for (let i = 0; i < n; i++) set.add(i);
      return set;
    }
    /*
     * Eight ticks is the target, but not at any cost: eight spread over
     * fourteen points rounds two of them onto neighbouring slots, and two
     * dates in adjacent slots touch. Cap the count so consecutive ticks are
     * always at least two slots apart, then take whichever is smaller.
     */
    const count = Math.max(2, Math.min(fit, Math.floor((n - 1) / 2) + 1));
    for (let k = 0; k < count; k++) {
      set.add(Math.round((k * (n - 1)) / (count - 1)));
    }
    return set;
  }, [labels, boxW]);

  const pointCount = Math.max(...series.map((s) => s.data.length), 0);
  const stepX = pointCount > 1 ? (W - padL - padR) / (pointCount - 1) : 0;

  function handlePointer(e: React.PointerEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    if (!el || pointCount === 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = stepX > 0 ? Math.round((vbX - padL) / stepX) : 0;
    setHover(Math.min(Math.max(idx, 0), pointCount - 1));
  }

  /*
   * The same read-out from the keyboard. A chart that only answers a mouse
   * hides every exact value from anyone tabbing through the console: focus
   * lands on the latest point, the arrows walk the days, Escape lets go.
   */
  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (pointCount === 0) return;
    const at = hover ?? pointCount - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(at + 1, pointCount - 1);
    else if (e.key === "ArrowLeft") next = Math.max(at - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = pointCount - 1;
    else if (e.key === "Escape") {
      setHover(null);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setHover(next);
    }
  }

  const solid = series.filter((s) => s.variant !== "compare");
  const compare = series.find((s) => s.variant === "compare");
  const primary = solid[0];

  /* The single best point, when asked for. Only a strictly positive peak is
     marked: labelling "Best day ₹0" on an empty range is noise, not a fact. */
  let peakIdx: number | null = null;
  if (annotatePeak && primary) {
    let bestV = 0;
    primary.data.forEach((v, i) => {
      if (v > bestV) {
        bestV = v;
        peakIdx = i;
      }
    });
  }

  const hoverX = hover !== null ? padL + hover * stepX : 0;
  // Keep the card inside the chart: flip it to the left of the guide once the
  // guide passes the midpoint, instead of letting it run off the edge.
  const hoverPct = W > 0 ? (hoverX / W) * 100 : 0;
  const flip = hoverPct > 55;
  const pctX = (x: number) => `${(x / W) * 100}%`;
  const fmt = (v: number) => (formatY ? formatY(v) : v.toLocaleString("en-IN"));

  /* Change against the previous period at the hovered day, when both lines
     have a value there and the earlier one is not zero. */
  const hoverDelta =
    hover !== null && primary && compare
      ? compareFigures(primary.data[hover] ?? 0, compare.data[hover])
      : null;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ng-leaf/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ng-admin-core)]",
        className,
      )}
      onPointerMove={handlePointer}
      onPointerLeave={() => setHover(null)}
      tabIndex={pointCount > 0 ? 0 : undefined}
      role="group"
      aria-roledescription="chart"
      aria-label={label ? `${label}. Use the arrow keys to read each day.` : undefined}
      onKeyDown={handleKey}
      onFocus={() => setHover((h) => h ?? (pointCount > 0 ? pointCount - 1 : null))}
      onBlur={() => setHover(null)}
    >
      {/* A legend whenever there is more than one line, so which line is which
          never rests on colour alone. One series needs none: the card title
          already names it. */}
      {series.length > 1 ? (
        <div className="mb-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[11.5px] font-medium text-ng-ink-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              {s.variant === "compare" ? (
                <span aria-hidden className="w-4 border-t-[1.5px] border-dashed" style={{ borderColor: TONE_STROKE[s.tone] }} />
              ) : (
                <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: TONE_STROKE[s.tone] }} />
              )}
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            {solid.map((s) => (
              <linearGradient key={s.name} id={`area-${s.name.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TONE_STROKE[s.tone]} stopOpacity="0.18" />
                <stop offset="100%" stopColor={TONE_STROKE[s.tone]} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid. The baseline (i === gridLines) is the axis itself and carries
              more weight than the rules above it, which only help the eye judge
              height. `non-scaling-stroke` because the SVG stretches to the card:
              without it a 1px rule became 1.4px on a wide screen. */}
          {Array.from({ length: gridLines + 1 }).map((_, i) => {
            const y = padT + (i / gridLines) * (H - padT - padB);
            return (
              <line
                key={i}
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke={i === gridLines ? "var(--ng-line)" : "var(--ng-line-soft)"}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* The previous period first, so the current line always sits on top
              of it where they cross. */}
          {compare ? (
            <polyline
              points={toPts(compare.data).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
              fill="none"
              stroke={TONE_STROKE[compare.tone]}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {/* `key` carries a signature of the plotted values, so changing the
              range remounts the group and replays .ng-chart-in. Keying on the
              series name alone would reuse the node and the new shape would
              simply appear. */}
          {solid.map((s) => {
            const pts = toPts(s.data);
            if (pts.length === 0) return null;
            const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
            const area = `${pts[0][0]},${H - padB} ${line} ${pts[pts.length - 1][0]},${H - padB}`;
            return (
              <g key={`${s.name}-${s.data.length}-${s.data.reduce((a, b) => a + b, 0)}`} className="ng-chart-in">
                <polygon points={area} fill={`url(#area-${s.name.replace(/\W/g, "")})`} />
                <polyline
                  points={line}
                  fill="none"
                  stroke={TONE_STROKE[s.tone]}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {/* Vertical guide under the pointer. Drawn after the series so it
              reads as an overlay. */}
          {hover !== null ? (
            <line
              x1={hoverX}
              y1={padT}
              x2={hoverX}
              y2={H - padB}
              stroke="var(--ng-ink-soft)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {/*
          Axis labels and point markers are HTML laid over the plot, not SVG.

          The SVG stretches to the card with preserveAspectRatio="none", which
          stretched everything drawn inside it too: the y-axis numbers came out
          wider than they were tall, and every point marker was an ellipse.
          Positioned in percent across and in pixels down (the SVG is exactly
          `height` pixels tall, so its y units ARE pixels), they stay round and
          the text stays text.

          Markers are selective. A dot on every point of a 90-day line is 90
          dots of noise; the hovered day, the latest day and the peak are the
          three that answer a question.
        */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padT + (i / gridLines) * (H - padT - padB);
          const val = niceMax * (1 - i / gridLines);
          return (
            <span
              key={i}
              aria-hidden
              className="absolute left-0 -translate-y-1/2 pr-2 text-right font-mono text-[11px] font-medium tabular-nums text-ng-ink-muted"
              style={{ top: y, width: pctX(padL) }}
            >
              {fmt(val)}
            </span>
          );
        })}

        {primary && primary.data.length > 0 ? (
          <>
            {peakIdx !== null && peakIdx !== hover ? (
              <PointMarker
                left={pctX(padL + peakIdx * stepX)}
                top={plotY(primary.data[peakIdx])}
                colour={TONE_STROKE[primary.tone]}
                label={`Best · ${fmt(primary.data[peakIdx])}`}
                align={peakIdx / Math.max(1, pointCount - 1) > 0.8 ? "end" : peakIdx / Math.max(1, pointCount - 1) < 0.2 ? "start" : "center"}
              />
            ) : null}
            {hover === null && peakIdx !== primary.data.length - 1 ? (
              <PointMarker
                left={pctX(padL + (primary.data.length - 1) * stepX)}
                top={plotY(primary.data[primary.data.length - 1])}
                colour={TONE_STROKE[primary.tone]}
              />
            ) : null}
          </>
        ) : null}
        {hover !== null
          ? solid.map((s) =>
              s.data[hover] !== undefined ? (
                <PointMarker
                  key={s.name}
                  left={pctX(hoverX)}
                  top={plotY(s.data[hover])}
                  colour={TONE_STROKE[s.tone]}
                  emphasis
                />
              ) : null,
            )
          : null}

        {/* The read-out. HTML so it uses the console's own tokens and type.
            Values lead and names follow: the number is the answer, the series
            name only says which answer. */}
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[148px] rounded-xl border border-ng-line-soft bg-ng-paper px-3 py-2 shadow-[var(--shadow-ng-card)]"
            style={{
              left: `${hoverPct}%`,
              transform: flip ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
            role="status"
            aria-live="polite"
          >
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ng-ink-soft">
              {labels[hover] ?? ""}
            </div>
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-2 whitespace-nowrap py-0.5">
                {s.variant === "compare" ? (
                  <span
                    aria-hidden
                    className="h-0 w-3 shrink-0 border-t-[1.5px] border-dashed"
                    style={{ borderColor: TONE_STROKE[s.tone] }}
                  />
                ) : (
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_STROKE[s.tone] }} />
                )}
                <span
                  className={cn(
                    "text-[12.5px] font-semibold tabular-nums",
                    s.variant === "compare" ? "text-ng-ink-muted" : "text-ng-ink",
                  )}
                >
                  {fmt(s.data[hover] ?? 0)}
                </span>
                <span className="ml-auto pl-3 text-[11.5px] text-ng-ink-soft">{s.name}</span>
              </div>
            ))}
            {hoverDelta ? (
              <div className="mt-1.5 border-t border-ng-line-soft pt-1.5">
                <TrendChip delta={hoverDelta.text} direction={hoverDelta.direction} sentiment={hoverDelta.sentiment} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/*
        x labels — thinned to fit, with the ticks they belong to.

        Rendering one label per point collides as soon as a range covers a
        couple of weeks. The shown indices are chosen up front: evenly spaced
        across the range, first and last always included, and never two
        adjacent. Each label sits under its own point because the row runs over
        the plot's width only, from padL to the right padding.
      */}
      <div
        className="relative mt-1 h-5"
        aria-hidden
        style={{ marginLeft: pctX(padL), marginRight: pctX(padR) }}
      >
        {labels.map((l, i) =>
          xTickSet.has(i) ? (
            <span
              key={i}
              className={cn(
                "absolute top-0 flex flex-col items-center whitespace-nowrap font-mono text-[10.5px] font-medium text-ng-ink-soft",
                i === 0 ? "translate-x-0 items-start" : i === labels.length - 1 ? "-translate-x-full items-end" : "-translate-x-1/2",
              )}
              style={{ left: labels.length > 1 ? `${(i / (labels.length - 1)) * 100}%` : "0%" }}
            >
              <span className="mb-0.5 block h-1.5 w-px bg-ng-line" />
              {l}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** A round point marker laid over a stretched SVG plot, with an optional tag. */
function PointMarker({
  left,
  top,
  colour,
  label,
  emphasis = false,
  align = "center",
}: {
  left: string;
  top: number;
  colour: string;
  label?: string;
  emphasis?: boolean;
  align?: "start" | "center" | "end";
}) {
  return (
    <span aria-hidden className="pointer-events-none absolute z-[1]" style={{ left, top }}>
      <span
        className={cn(
          "absolute block -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
          emphasis ? "size-[11px]" : "size-[9px]",
        )}
        style={{
          borderColor: colour,
          background: emphasis ? colour : "var(--ng-paper)",
          /* A ring of card colour so the dot separates from the line it sits
             on and from the area fill under it. */
          boxShadow: "0 0 0 2px var(--ng-paper)",
        }}
      />
      {label ? (
        <span
          className={cn(
            "absolute bottom-3 whitespace-nowrap rounded-md border border-ng-line-soft bg-ng-paper px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ng-ink shadow-[var(--shadow-admin-rest)]",
            align === "start" ? "left-0 -translate-x-2" : align === "end" ? "right-0 translate-x-2" : "left-0 -translate-x-1/2",
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
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
  formatValue,
  className,
}: {
  segments: { label: string; value: number; tone: VizTone }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  /** How a single segment's value reads in the centre while it is active. */
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  /*
   * One segment can be "active": hovered on the ring, or hovered or focused in
   * the legend. The ring and the list are two views of the same numbers, so
   * pointing at either lights up both, and the centre swaps from the total to
   * that segment's value and share. The rest dim rather than vanish, so the
   * part is always seen against the whole it belongs to.
   */
  const [active, setActive] = useState<number | null>(null);

  /*
   * Percentages by largest remainder, so the column adds up to 100.
   *
   * Rounding each share on its own is what produced "Placed 25% · Confirmed 38%
   * · Delivered 38%" against eight orders — 101% — and once a reader has caught
   * the legend disagreeing with itself, they stop trusting it to say which arc
   * is which. Floors first, then the leftover points go to whichever segments
   * were cut hardest.
   */
  const shares = segments.map((s) => (s.value / total) * 100);
  const pct = shares.map(Math.floor);
  let leftover = 100 - pct.reduce((a, b) => a + b, 0);
  const byRemainder = shares
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem);
  for (const { i } of byRemainder) {
    if (leftover <= 0) break;
    // A segment with no orders must never be rounded up to 1%.
    if (segments[i].value === 0) continue;
    pct[i] += 1;
    leftover -= 1;
  }

  // Each arc starts where the previous one ended. Precomputed rather than
  // accumulated inside the render loop — mutating during render is not safe
  // under the React Compiler and can desync across re-renders.
  const arcs = segments.reduce<{ len: number; start: number }[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    const start = prev ? prev.start + prev.len : 0;
    acc.push({ len: (s.value / total) * c, start });
    return acc;
  }, []);

  const current = active !== null ? segments[active] : null;

  return (
    /*
     * Wraps rather than squeezes.
     *
     * The ring is `shrink-0` at a fixed size, so in a narrow card the legend was
     * the only thing left to give: it collapsed to 18px and its counts spilled
     * out past the card and widened the whole console at tablet widths.
     *
     * `flex-wrap` plus a 180px basis on the list means the legend drops BELOW
     * the ring once it cannot hold its own width, which is the layout it wants
     * anyway in a narrow column. No breakpoint is involved, so it responds to
     * the space the card actually has rather than to the size of the window.
     */
    <div className={cn("flex flex-wrap items-center gap-6", className)} onPointerLeave={() => setActive(null)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ng-line-soft)" strokeWidth={thickness} />
          {segments.map((s, i) => {
            const { len, start } = arcs[i];
            if (len <= 0) return null;
            /*
             * A 2px gap of card colour between arcs, so two neighbouring steps
             * of one ramp never fuse into a single band. Only cut when there is
             * room, so a thin sliver is never erased by its own gap.
             */
            const gap = len > 4 ? 2 : 0;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={TONE_STROKE[s.tone]}
                strokeWidth={thickness}
                strokeDasharray={`${len - gap} ${c - len + gap}`}
                strokeDashoffset={-start}
                strokeLinecap="butt"
                className="cursor-default transition-opacity duration-200 ease-out"
                style={{ opacity: active === null || active === i ? 1 : 0.28 }}
                onPointerEnter={() => setActive(i)}
              />
            );
          })}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center"
          aria-live="polite"
        >
          {current ? (
            <>
              <span className="font-display text-[24px] leading-none text-ng-forest-deep tabular-nums">
                {formatValue ? formatValue(current.value) : current.value.toLocaleString("en-IN")}
              </span>
              <span className="mt-1 max-w-full truncate text-[11px] font-semibold text-ng-ink-muted">
                {current.label} · {pct[active!]}%
              </span>
            </>
          ) : centerLabel || centerValue ? (
            <>
              {centerValue ? (
                <span className="font-display text-[26px] leading-none text-ng-forest-deep tabular-nums">{centerValue}</span>
              ) : null}
              {centerLabel ? (
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">{centerLabel}</span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <ul className="min-w-0 flex-1 basis-[180px] space-y-0.5">
        {segments.map((s, i) => {
          const empty = s.value === 0;
          const on = active === i;
          return (
            <li key={s.label}>
              {/* A button, so the legend is the keyboard route into the ring:
                  focus a row and the centre reads out that segment. */}
              <button
                type="button"
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${s.label}: ${s.value.toLocaleString("en-IN")}, ${pct[i]}%`}
                className={cn(
                  "flex w-full cursor-default items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-[12.5px] outline-none transition-colors duration-150",
                  "focus-visible:ring-2 focus-visible:ring-ng-leaf/50",
                  on ? "bg-ng-line-soft" : "",
                )}
              >
                {/*
                  A ring, not a disc: a hue is far easier to name along an edge
                  around a light centre than as a small dark dot. Rows with no
                  orders are drawn hollow and dimmed. The status is still listed,
                  because "nothing is packed right now" is worth knowing, but it
                  no longer looks like a segment to hunt for on the ring.
                */}
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full border-2"
                  style={{ borderColor: TONE_STROKE[s.tone], opacity: empty ? 0.35 : 1 }}
                />
                {/* `min-w-0` is what makes `truncate` work inside a flex row. */}
                <span className={cn("min-w-0 truncate font-medium", empty ? "text-ng-ink-soft" : "text-ng-ink-muted")}>
                  {s.label}
                </span>
                {/* The count is the unambiguous number. A percentage alone cannot
                    tell 3 orders of 8 from 3,000 of 8,000. */}
                <span className={cn("ml-auto pl-3 font-mono tabular-nums", empty ? "text-ng-ink-soft" : "text-ng-forest-deep")}>
                  {s.value.toLocaleString("en-IN")}
                </span>
                <span
                  className={cn(
                    "w-10 shrink-0 text-right font-mono font-semibold tabular-nums",
                    empty ? "text-ng-ink-soft" : "text-ng-forest-deep",
                  )}
                >
                  {pct[i]}%
                </span>
              </button>
            </li>
          );
        })}
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
  /*
   * Keyed on the data so a filter change REMOUNTS the list and replays the
   * growth. Without this the bars would animate once on first paint and then
   * silently jump to new widths, which is the behaviour being fixed.
   */
  const dataKey = rows.map((r) => `${r.label}:${r.value}`).join("|");

  return (
    <ul key={dataKey} className={cn("space-y-3.5", className)}>
      {rows.map((r, i) => (
        <li key={r.label} className="group">
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-[12.5px] font-semibold text-ng-ink truncate transition-colors group-hover:text-ng-forest-deep">
              {r.label}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-ng-forest-deep font-semibold shrink-0">
              {formatValue ? formatValue(r.value) : r.value}
              {r.hint ? <span className="text-ng-ink-soft font-sans font-medium ml-1.5">{r.hint}</span> : null}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ng-line-soft overflow-hidden">
            <div
              className="ng-bar-grow h-full rounded-full transition-[filter,height] duration-200 group-hover:brightness-110"
              style={{
                width: `${Math.max(4, (r.value / max) * 100)}%`,
                background: TONE_STROKE[r.tone ?? tone],
                /* Staggered so the eye reads the ranking in order. Capped at
                   eight rows — beyond that the last bar would arrive late
                   enough to look like it had stalled. */
                animationDelay: `${Math.min(i, 8) * 55}ms`,
              }}
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
  stages: { label: string; value: number; tone: VizTone; href?: string }[];
  className?: string;
}) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className={cn("space-y-2.5", className)}>
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const row = (
          <>
            <div className="flex w-32 shrink-0 items-center gap-2 text-[12.5px] font-medium text-ng-ink-muted">
              <span className="font-mono text-[11px] font-medium text-ng-ink-soft">{String(i + 1).padStart(2, "0")}</span>
              {s.label}
            </div>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-ng-line-soft/60">
              <div
                className="h-full rounded-md transition-[width] duration-300 ease-out"
                /* An empty stage keeps no sliver: a 0 drawn as a coloured stub
                   reads as "a few", which is exactly the wrong message on a
                   work queue. */
                style={{ width: s.value > 0 ? `${Math.max(4, pct)}%` : "0%", background: TONE_STROKE[s.tone] }}
              />
            </div>
            {/* The count sits beside the bar, in ink, not inside it in the bar's
                colour. Text on a fill had to be re-contrasted for every tone in
                both themes; beside it, it is always the console's own ink. */}
            <span
              className={cn(
                "w-10 shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums",
                s.value > 0 ? "text-ng-forest-deep" : "text-ng-ink-soft",
              )}
            >
              {s.value.toLocaleString("en-IN")}
            </span>
          </>
        );
        return s.href ? (
          <a
            key={s.label}
            href={s.href}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-0.5 outline-none transition-colors hover:bg-ng-line-soft/50 focus-visible:ring-2 focus-visible:ring-ng-leaf/50"
          >
            {row}
          </a>
        ) : (
          <div key={s.label} className="flex items-center gap-3">
            {row}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ShareBar — one quantity split into parts, with a labelled legend    */
/* ------------------------------------------------------------------ */

/**
 * A single bar split into its parts: booked revenue into collected, pending
 * and failed, say. Where three separate tiles make the reader add them up, one
 * bar shows the whole and each part's share of it at a glance.
 *
 * Parts are separated by a 2px gap of card colour so neighbours never fuse;
 * the legend carries every value and share in text, so nothing depends on
 * colour alone.
 */
export function ShareBar({
  parts,
  formatValue,
  className,
}: {
  parts: { label: string; value: number; tone: VizTone; note?: string }[];
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const fmt = (v: number) => (formatValue ? formatValue(v) : v.toLocaleString("en-IN"));
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className={className} onPointerLeave={() => setActive(null)}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-ng-line-soft">
        {total > 0
          ? parts.map((p, i) =>
              p.value > 0 ? (
                <div
                  key={p.label}
                  className="h-full transition-opacity duration-200 ease-out first:rounded-l-full last:rounded-r-full"
                  style={{
                    flexGrow: p.value,
                    flexBasis: 0,
                    minWidth: 4,
                    background: TONE_STROKE[p.tone],
                    opacity: active === null || active === i ? 1 : 0.3,
                  }}
                  onPointerEnter={() => setActive(i)}
                />
              ) : null,
            )
          : null}
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {parts.map((p, i) => (
          <li
            key={p.label}
            className={cn(
              "-mx-2 rounded-lg px-2 py-1 transition-colors duration-150",
              active === i ? "bg-ng-line-soft/60" : "",
            )}
            onPointerEnter={() => setActive(i)}
          >
            <div className="flex items-center gap-2 text-[12px] font-medium text-ng-ink-muted">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full border-2"
                style={{ borderColor: TONE_STROKE[p.tone], opacity: p.value === 0 ? 0.35 : 1 }}
              />
              {p.label}
              <span className="ml-auto font-mono font-semibold tabular-nums text-ng-ink-soft">{share(p.value)}%</span>
            </div>
            <div className="mt-1 font-mono text-[17px] font-semibold tabular-nums text-ng-forest-deep">{fmt(p.value)}</div>
            {p.note ? <div className="mt-0.5 text-[11.5px] font-medium text-ng-ink-soft">{p.note}</div> : null}
          </li>
        ))}
      </ul>
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
