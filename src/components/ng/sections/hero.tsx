"use client";

import Link from "next/link";
import { Button } from "../button";
import { Stars } from "../stars";
import { Logo } from "../logo";
import { PRODUCE_ICONS, type ProduceIconName } from "../produce-icons";
import { Reveal, FloatIn, Parallax, MagneticHover } from "../motion";

/**
 * Hero — the singular homepage showpiece banner (Anveshan-style).
 *
 * A confident, full-bleed promotional banner split ~55/45:
 *  • LEFT  — deep forest-green copy panel: teardrop badge, huge serif headline,
 *            gold accent sub-headline, benefit lines, a cream/gold pill CTA, and
 *            a trust strip. A faint botanical leaf line-pattern textures it.
 *  • RIGHT — a complete brand showcase (no hero photo exists yet): a tonal
 *            farm-landscape backdrop, a "product spotlight" glass card (brand
 *            mark, drop-in slot for a future product shot) ringed by an orbit of
 *            the colourful produce icons, plus floating glass trust chips
 *            (trace/lot, rating, free-delivery).
 *
 * Built entirely from real brand assets so it reads as designed, not placeholder.
 */

/** Colourful produce icons that orbit the spotlight — accent colour matches the live Categories grid. */
const ORBIT: { icon: ProduceIconName; tint: string }[] = [
  { icon: "oil", tint: "text-ng-leaf" },
  { icon: "ghee", tint: "text-ng-clay" },
  { icon: "honey", tint: "text-ng-amber" },
  { icon: "grain", tint: "text-ng-clay-deep" },
  { icon: "nuts", tint: "text-ng-terracotta" },
  { icon: "milk", tint: "text-ng-blue" },
];

const BENEFITS = [
  "Cold-pressed oils & bilona A2 ghee",
  "Single-origin from 42 partner farms",
  "Every lot lab-tested — zero adulterants",
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ng-paper px-4 pb-10 pt-4 sm:px-6 md:px-8 md:pb-14 md:pt-6">
      <Reveal>
        <div className="relative grid min-h-[clamp(560px,80vh,760px)] overflow-hidden rounded-[28px] shadow-[var(--shadow-ng-float)] md:rounded-[36px] lg:grid-cols-[1.18fr_1fr]">
          {/* ─────────────────────────── LEFT — copy panel ─────────────────────────── */}
          <div className="relative isolate flex flex-col justify-center overflow-hidden bg-ng-forest px-6 py-12 sm:px-10 md:px-12 md:py-16 lg:px-16">
            {/* Faint botanical leaf line-pattern */}
            <BotanicalPattern />

            {/* Warm gold + leaf radial wash */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 opacity-80"
              style={{
                background:
                  "radial-gradient(ellipse 75% 60% at 8% 4%, rgba(181,134,47,0.26), transparent 58%), radial-gradient(ellipse 65% 65% at 96% 100%, rgba(102,191,115,0.20), transparent 60%)",
              }}
            />
            {/* Parallaxed depth blob — drifts slower behind the panel */}
            <Parallax speed={0.28} className="pointer-events-none absolute inset-0 -z-10">
              <div
                aria-hidden
                className="absolute -bottom-28 -left-20 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
                style={{ background: "radial-gradient(circle, rgba(102,191,115,0.30), transparent 70%)" }}
              />
            </Parallax>

            <div className="relative z-10 max-w-xl">
              {/* Teardrop badge */}
              <Reveal delay={0.05}>
                <span className="inline-flex items-center gap-2 rounded-full rounded-tl-sm bg-ng-clay px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ng-soil shadow-[0_6px_18px_rgba(181,134,47,0.38)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-ng-soil/70" />
                  Single-origin · New harvest
                </span>
              </Reveal>

              {/* Huge serif headline */}
              <Reveal delay={0.1}>
                <h1 className="mt-6 font-display text-[clamp(40px,6.4vw,82px)] font-semibold leading-[0.94] tracking-tight text-ng-cream">
                  Real food,
                  <br />
                  grown the
                  <br />
                  <span className="text-ng-leaf">honest way.</span>
                </h1>
              </Reveal>

              {/* Gold accent sub-headline */}
              <Reveal delay={0.15}>
                <p className="mt-5 font-display text-[clamp(17px,2.1vw,23px)] font-medium leading-snug text-ng-clay">
                  Straight from the farm to your kitchen — nothing in between.
                </p>
              </Reveal>

              {/* Benefit lines */}
              <Reveal delay={0.2}>
                <ul className="mt-6 space-y-2.5">
                  {BENEFITS.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[14px] leading-snug text-ng-cream/85 sm:text-[15px]">
                      <LeafTick className="mt-0.5 h-4 w-4 shrink-0 text-ng-leaf" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Reveal>

              {/* CTA + secondary link */}
              <Reveal delay={0.25}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <MagneticHover>
                    <Button variant="gold" size="lg" asChild className="rounded-full">
                      <Link href="/shop">
                        Shop the harvest
                        <span aria-hidden className="ml-0.5">→</span>
                      </Link>
                    </Button>
                  </MagneticHover>
                  <MagneticHover>
                    <Button
                      variant="glass"
                      size="lg"
                      asChild
                      className="rounded-full !bg-ng-cream/10 !text-ng-cream ring-1 ring-inset ring-ng-cream/25 backdrop-blur hover:!bg-ng-cream/15"
                    >
                      <Link href="/traceability">Trace a lot</Link>
                    </Button>
                  </MagneticHover>
                </div>
              </Reveal>

              {/* Trust strip */}
              <Reveal delay={0.3}>
                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-ng-cream/15 pt-6">
                  <div className="flex items-center gap-2">
                    <Stars rating={4.8} size="sm" />
                    <span className="text-[13px] text-ng-cream/75">4.8 · 12,400+ reviews</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-ng-cream/75">
                    <span className="h-1.5 w-1.5 rounded-full bg-ng-leaf" />
                    FSSAI · ISO 22000 certified
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* ─────────────────────────── RIGHT — brand showcase ─────────────────────────── */}
          <div className="relative isolate min-h-[380px] overflow-hidden bg-ng-cream-deep lg:min-h-0">
            {/* Soft tonal gradient base (stands in for a farm-landscape photo) */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "linear-gradient(168deg, #F5F2E0 0%, #ECE7D2 48%, #DCE3CF 100%)",
              }}
            />
            {/* Tonal farm-landscape backdrop */}
            <HeroScene />
            {/* Warm light blooms for depth */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 70% 22%, rgba(181,134,47,0.16), transparent 62%), radial-gradient(ellipse 55% 55% at 18% 82%, rgba(102,191,115,0.18), transparent 64%)",
              }}
            />

            {/* Stage */}
            <div className="relative z-10 grid h-full min-h-[380px] place-items-center px-8 py-14 sm:px-12 lg:items-center lg:px-10">
              <div className="relative w-full max-w-[320px]">
                {/* Orbiting colourful produce icons (decorative arc framing the card) */}
                <OrbitIcons />

                {/* Product spotlight glass card — drop a real product shot into this slot later */}
                <FloatIn className="relative z-10">
                  <div className="glass-strong relative overflow-hidden rounded-[28px] border border-white/50 px-7 pb-7 pt-8 text-center shadow-[var(--shadow-ng-float)]">
                    {/* gold corner ribbon */}
                    <span className="absolute right-4 top-4 rounded-full bg-ng-clay/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ng-soil shadow-sm">
                      Bestseller
                    </span>

                    {/* brand mark medallion (photo slot) */}
                    <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-white to-ng-cream shadow-[var(--shadow-ng-card)] ring-1 ring-ng-clay/20">
                      <Logo variant="mark" tone="forest" className="h-16 w-16" />
                    </div>

                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ng-clay-deep">
                      This week&rsquo;s harvest
                    </p>
                    <h3 className="mt-1.5 font-display text-[22px] font-semibold leading-tight text-ng-forest-deep">
                      Cold-Pressed
                      <br />
                      Groundnut Oil
                    </h3>
                    <p className="mt-2 text-[12.5px] text-ng-ink-muted">
                      Anantapur · pressed fresh · glass-bottled
                    </p>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Stars rating={4.9} size="sm" />
                      <span className="text-[12px] text-ng-ink-soft">(1,820)</span>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-ng-forest px-4 py-3 text-left">
                      <div className="leading-tight">
                        <div className="font-display text-[20px] font-semibold text-ng-cream">₹389</div>
                        <div className="text-[11px] text-ng-cream/60 line-through">₹450</div>
                      </div>
                      <span className="rounded-full bg-ng-clay px-3.5 py-1.5 text-[12px] font-semibold text-ng-soil">
                        Add to bag
                      </span>
                    </div>
                  </div>
                </FloatIn>

                {/* Floating trust chips — offset clear of the card's edges & CTA row */}
                <FloatIn delay={0.2} className="absolute -left-6 top-10 z-20 sm:-left-12 md:-left-16">
                  <div className="glass-strong rounded-2xl px-3.5 py-2.5 shadow-[var(--shadow-ng-card)]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-ng-forest">
                      Lot · NG-24-051
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ng-ink-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-ng-success" />
                      Lab-tested · traceable
                    </div>
                  </div>
                </FloatIn>

                <FloatIn delay={0.45} className="absolute -bottom-5 -left-4 z-20 sm:-left-10 md:-left-14">
                  <div className="glass-strong flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-[var(--shadow-ng-card)]">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-leaf/20 text-ng-forest">
                      <TruckGlyph className="h-4 w-4" />
                    </span>
                    <div className="leading-tight">
                      <div className="text-[12.5px] font-semibold text-ng-forest-deep">Free delivery</div>
                      <div className="text-[11px] text-ng-ink-muted">on orders ₹599+</div>
                    </div>
                  </div>
                </FloatIn>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Orbiting colourful produce icons — a styled ring that implies the range.
   ────────────────────────────────────────────────────────────────────────── */
function OrbitIcons() {
  // Arc framing the card — biased to the top and RIGHT so the icons stay clearly
  // visible (the left side is reserved for the floating trust chips).
  const positions = [
    "-top-6 left-6 sm:left-2",
    "-top-7 right-8 sm:right-4",
    "top-14 -right-3 sm:-right-7 md:-right-10",
    "bottom-24 -right-2 sm:-right-6 md:-right-9",
    "-bottom-6 right-10 sm:right-6",
    "-bottom-6 left-1/3",
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {ORBIT.map((o, i) => {
        const Icon = PRODUCE_ICONS[o.icon];
        return (
          <FloatIn key={o.icon} delay={0.15 + i * 0.12} className={`absolute ${positions[i]}`}>
            <span
              className={`grid h-[52px] w-[52px] place-items-center rounded-2xl border border-white/70 bg-white/85 ${o.tint} shadow-[var(--shadow-ng-card)] backdrop-blur-sm`}
            >
              <Icon size={26} />
            </span>
          </FloatIn>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   HeroScene — a compact tonal farm-landscape backdrop (rolling fields, trees,
   sun) echoing FooterScene, sat in the lower band of the right panel.
   Purely decorative; tonal so the spotlight card reads clearly on top.
   ────────────────────────────────────────────────────────────────────────── */
const SUN = "#B5862F";
const FAR = "#C7CDB0";
const MID = "#A9BE94";
const NEAR = "#8FB07C";
const HILL = "#6E9A5E";

function HeroScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 select-none">
      <svg
        className="block h-[220px] w-full sm:h-[260px] md:h-[300px]"
        viewBox="0 0 720 320"
        preserveAspectRatio="xMidYMax slice"
        role="presentation"
      >
        {/* sun glow */}
        <circle cx="520" cy="120" r="46" fill={SUN} opacity="0.18" />
        <circle cx="520" cy="120" r="26" fill={SUN} opacity="0.30" />
        {/* far rolling ridge */}
        <path d="M0 196 C140 156 250 188 360 174 C470 160 590 196 720 168 L720 320 L0 320 Z" fill={FAR} opacity="0.9" />
        {/* mid hills */}
        <path d="M0 232 C120 200 240 232 360 216 C480 200 600 236 720 214 L720 320 L0 320 Z" fill={MID} opacity="0.92" />
        {/* near field band */}
        <path d="M0 268 C160 246 320 270 480 258 C580 250 660 266 720 258 L720 320 L0 320 Z" fill={NEAR} />
        {/* foreground furrow strip */}
        <path d="M0 296 C180 282 360 300 540 290 C620 286 680 296 720 292 L720 320 L0 320 Z" fill={HILL} />
        {/* furrow ticks */}
        <g stroke="#5C8A50" strokeWidth="2" strokeLinecap="round" opacity="0.55">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={i} x1={20 + i * 40} y1="306" x2={28 + i * 40} y2="298" />
          ))}
        </g>
        {/* stippled trees on the ridge */}
        {[120, 200, 470, 560, 630].map((x, i) => (
          <g key={x} transform={`translate(${x} ${182 - (i % 2) * 8})`}>
            <rect x="-2" y="0" width="4" height="22" fill={HILL} rx="2" />
            <circle cx="0" cy="-6" r="16" fill={MID} />
            <circle cx="-9" cy="2" r="11" fill={NEAR} opacity="0.9" />
            <circle cx="9" cy="2" r="11" fill={NEAR} opacity="0.9" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Small inline glyphs (no external icon deps needed for these accents) ── */
function LeafTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M2.5 9.5C2.5 5.5 5.5 2.5 13.5 2.5C13.5 9 9.5 13.5 4 13.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 13.5L9 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TruckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 6.5h9v8H3zM12 9h4l3 3v2.5h-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="16.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="16.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/* ── Faint repeating leaf-branch motif that textures the green panel ── */
function BotanicalPattern() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]">
      <svg width="100%" height="100%" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="ng-hero-leaf" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
            <g fill="none" stroke="#66BF73" strokeWidth="2" strokeLinecap="round">
              <path d="M30 100 C30 70 30 40 30 20" />
              <path d="M30 74 C46 68 52 56 52 40" />
              <path d="M30 64 C14 58 8 46 8 30" />
              <path d="M90 110 C90 86 90 60 90 44" />
              <path d="M90 84 C106 78 112 66 112 50" />
              <path d="M90 74 C74 69 68 57 68 41" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ng-hero-leaf)" />
      </svg>
    </div>
  );
}
