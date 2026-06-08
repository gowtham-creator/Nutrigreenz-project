"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "../button";
import { Stars } from "../stars";
import { Logo } from "../logo";
import { Icon } from "@/components/ui/icon";
import { PRODUCE_ICONS } from "../produce-icons";
import { FloatIn, MagneticHover } from "../motion";

/**
 * Hero — a wide promotional **banner slideshow** (Anveshan-style format).
 *
 * A first-section, full-width carousel of 3 wide promo slides. Each slide is a
 * left copy panel + right illustrated product/brand composition, sized to a
 * fixed banner height so there's zero layout shift between slides. Auto-advances
 * (~6s), pauses on hover / focus-within / reduced-motion, and exposes clickable
 * dots + prev/next arrows. Keyed crossfade via framer-motion, always
 * reduced-motion safe (a slide is never left stuck hidden).
 *
 * No real product photos: the right-side visuals are composed entirely from
 * brand assets — the produce category icons (PRODUCE_ICONS), the brand mark
 * (<Logo variant="mark"/>), a hand-authored SVG "splash/burst", glass product
 * chips, gradients and gold accents — so a real photo can drop in later.
 */

const COUPON = "HARVEST20";
/** Dwell per slide. Deliberately unhurried so copy is readable before the
    crossfade; the timer is also reset on every manual nav (see effect below). */
const AUTO_MS = 7000;

const BENEFITS = [
  "Cold-pressed oils & bilona A2 ghee",
  "Single-origin from 42 partner farms",
  "Every lot lab-tested — zero adulterants",
];

type SlideId = "sale" | "brand" | "harvest";

const SLIDE_META: { id: SlideId; label: string }[] = [
  { id: "sale", label: "Harvest Sale" },
  { id: "brand", label: "Our promise" },
  { id: "harvest", label: "New harvest" },
];

/* ──────────────────────────────────────────────────────────────────────────
   Slideshow shell
   ────────────────────────────────────────────────────────────────────────── */
export function Hero() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const labelId = useId();

  const count = SLIDE_META.length;
  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Auto-advance — paused on hover/focus, when the tab is hidden, or reduced
  // motion. Depending on `index` restarts the timer after every change (manual
  // or auto), so a slide is never cut short right after you click an arrow/dot.
  useEffect(() => {
    if (paused || reduce) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [paused, reduce, count, index]);

  // Pause autoplay while the tab is backgrounded.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
  };

  const current = SLIDE_META[index];

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label="Promotional banners"
      className="relative isolate px-4 pb-7 pt-4 sm:px-6 md:px-8 md:pb-9 md:pt-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div className="relative overflow-hidden rounded-[28px] shadow-[var(--shadow-ng-float)] md:rounded-[36px]">
        {/* Equal-height stage — the height is fixed by the banner clamp so slides
            never shift layout. The active slide is absolutely overlaid via
            AnimatePresence; a hidden sizer reserves the height. */}
        <div className="relative min-h-[clamp(472px,64vh,600px)]">
          {/* Invisible sizer: keeps the tallest reasonable banner height reserved. */}
          <div aria-hidden className="invisible">
            <SaleSlide reduce={reduce} />
          </div>

          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={current.id}
              className="absolute inset-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.012 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.992 }}
              transition={{ duration: reduce ? 0.3 : 0.7, ease: [0.16, 1, 0.3, 1] }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}: ${current.label}`}
              aria-labelledby={labelId}
            >
              {current.id === "sale" && <SaleSlide reduce={reduce} />}
              {current.id === "brand" && <BrandSlide reduce={reduce} />}
              {current.id === "harvest" && <HarvestSlide reduce={reduce} />}
            </motion.div>
          </AnimatePresence>

          {/* Controls — prev · dots · next grouped into one pill at the bottom.
              Side-mounted arrows were colliding with the headline copy at
              tablet widths, so the whole control set lives here instead, clear
              of every slide's text. */}
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ng-forest-deep/40 px-1.5 py-1.5 shadow-[0_6px_20px_rgba(20,40,24,0.25)] ring-1 ring-white/10 backdrop-blur-md md:bottom-5">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous banner"
              className="grid h-8 w-8 place-items-center rounded-full text-ng-cream/90 transition-colors hover:bg-ng-cream/15 hover:text-ng-cream active:scale-95"
            >
              <Icon name="alt-arrow-left-linear" size={18} />
            </button>

            <div role="tablist" aria-label="Choose banner" className="flex items-center gap-2.5 px-1">
              {SLIDE_META.map((s, i) => {
                const active = i === index;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Go to ${s.label} banner`}
                    onClick={() => go(i)}
                    className="group grid place-items-center p-1"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all duration-300 ${
                        active ? "w-7 bg-ng-cream" : "w-2 bg-ng-cream/50 group-hover:bg-ng-cream/80"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={next}
              aria-label="Next banner"
              className="grid h-8 w-8 place-items-center rounded-full text-ng-cream/90 transition-colors hover:bg-ng-cream/15 hover:text-ng-cream active:scale-95"
            >
              <Icon name="alt-arrow-right-linear" size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared slide frame — left copy panel + right visual, equal height.
   ────────────────────────────────────────────────────────────────────────── */
function SlideFrame({
  bgClass,
  bgStyle,
  left,
  right,
}: {
  bgClass: string;
  bgStyle?: React.CSSProperties;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className={`grid h-full min-h-[clamp(472px,64vh,600px)] overflow-hidden lg:grid-cols-[1.12fr_1fr] ${bgClass}`} style={bgStyle}>
      <div className="relative isolate flex flex-col justify-center px-6 pb-16 pt-9 sm:px-10 md:px-12 md:pb-16 md:pt-12 lg:px-16">
        {left}
      </div>
      <div className="relative isolate min-h-[210px] overflow-hidden lg:min-h-0">{right}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SLIDE 1 — Sale / Offer (primary)
   ────────────────────────────────────────────────────────────────────────── */
function SaleSlide({ reduce }: { reduce: boolean | null }) {
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(COUPON);
    } catch {
      /* clipboard may be unavailable — still flag success for UX parity */
    }
    setCopied(true);
    toast.success("Code copied", { description: `Use “${COUPON}” at checkout` });
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <SlideFrame
      bgClass="bg-ng-cream"
      bgStyle={{
        background:
          "radial-gradient(ellipse 90% 80% at 0% 0%, rgba(178,199,178,0.55), transparent 55%), radial-gradient(ellipse 80% 90% at 100% 100%, rgba(102,191,115,0.18), transparent 60%), linear-gradient(150deg, #F5F2E0 0%, #EAF0E2 52%, #DDE8D6 100%)",
      }}
      left={
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-ng-clay px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ng-soil shadow-[0_6px_18px_rgba(181,134,47,0.32)]">
            <span className={`h-1.5 w-1.5 rounded-full bg-ng-soil/80 ${reduce ? "" : "animate-pulse"}`} />
            Harvest Sale is Live
          </span>

          <h1 className="mt-5 font-display text-[clamp(34px,5.6vw,68px)] font-semibold leading-[0.96] tracking-tight text-ng-forest-deep">
            Harvest Sale
            <br />
            <span className="text-ng-clay">is Live!</span>
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed text-ng-ink-muted md:text-[16px]">
            Beat the rush — stock the pantry with cold-pressed oils, bilona ghee &amp; raw
            honey while the harvest lasts.
          </p>

          {/* Offer pill + dashed coupon chip */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-ng-forest px-4 py-2.5 text-[14px] font-semibold text-ng-cream shadow-[var(--shadow-ng-card)]">
              <Icon name="tag-price-bold" size={17} className="text-ng-leaf" />
              Get Flat 20% Off
            </span>

            <button
              type="button"
              onClick={copyCode}
              aria-label={`Copy coupon code ${COUPON}`}
              className="group inline-flex items-center gap-2.5 rounded-full border border-dashed border-ng-clay/70 bg-ng-paper/70 px-4 py-2.5 text-ng-forest backdrop-blur-sm transition-colors hover:bg-ng-paper"
            >
              <span className="text-[12px] uppercase tracking-[0.14em] text-ng-ink-muted">Use code</span>
              <span className="font-mono text-[15px] font-semibold tracking-wide text-ng-clay-deep">{COUPON}</span>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ng-forest text-ng-cream transition-transform group-active:scale-90">
                <Icon name={copied ? "check-circle-bold" : "copy-linear"} size={14} />
              </span>
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <MagneticHover>
              <Button variant="gold" size="lg" asChild className="rounded-full">
                <Link href="/shop">
                  Shop the sale
                  <Icon name="arrow-right-linear" size={18} />
                </Link>
              </Button>
            </MagneticHover>
            <div className="flex items-center gap-2">
              <Stars rating={4.8} size="sm" showCount={false} />
              <span className="text-[13px] text-ng-ink-soft">4.8 · 12,400+ reviews</span>
            </div>
          </div>
        </div>
      }
      right={<ProductSplash reduce={reduce} />}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SLIDE 2 — Brand (reuses the prior hero's left-panel message)
   ────────────────────────────────────────────────────────────────────────── */
function BrandSlide({ reduce }: { reduce: boolean | null }) {
  return (
    <SlideFrame
      bgClass="bg-ng-forest"
      left={
        <>
          <BotanicalPattern />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse 75% 60% at 8% 4%, rgba(181,134,47,0.26), transparent 58%), radial-gradient(ellipse 65% 65% at 96% 100%, rgba(102,191,115,0.20), transparent 60%)",
            }}
          />
          <div className="relative z-10 max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full rounded-tl-sm bg-ng-clay px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ng-soil shadow-[0_6px_18px_rgba(181,134,47,0.38)]">
              <span className="h-1.5 w-1.5 rounded-full bg-ng-soil/70" />
              Single-origin · New harvest
            </span>

            <h1 className="mt-4 font-display text-[clamp(32px,5.2vw,58px)] font-semibold leading-[0.98] tracking-tight text-ng-cream">
              Real food,
              <br />
              grown the <span className="text-ng-leaf">honest way.</span>
            </h1>

            <p className="mt-3 font-display text-[clamp(15px,1.9vw,20px)] font-medium leading-snug text-ng-clay">
              Straight from the farm to your kitchen — nothing in between.
            </p>

            <ul className="mt-4 space-y-2">
              {BENEFITS.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[14px] leading-snug text-ng-cream/85 sm:text-[15px]">
                  <LeafTick className="mt-0.5 h-4 w-4 shrink-0 text-ng-leaf" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-3">
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
          </div>
        </>
      }
      right={<BrandComposition reduce={reduce} />}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SLIDE 3 — Seasonal / new harvest
   ────────────────────────────────────────────────────────────────────────── */
function HarvestSlide({ reduce }: { reduce: boolean | null }) {
  return (
    <SlideFrame
      bgClass="bg-ng-cream"
      bgStyle={{
        background:
          "radial-gradient(ellipse 85% 80% at 100% 0%, rgba(242,158,18,0.16), transparent 55%), linear-gradient(150deg, #FAF6E8 0%, #F1ECD8 55%, #E7E2C9 100%)",
      }}
      left={
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-ng-leaf/15 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ng-forest-soft ring-1 ring-ng-leaf/30">
            <span className="h-1.5 w-1.5 rounded-full bg-ng-green-bright" />
            Fresh off the fields
          </span>

          <h1 className="mt-5 font-display text-[clamp(34px,5.6vw,64px)] font-semibold leading-[0.96] tracking-tight text-ng-forest-deep">
            This season&rsquo;s
            <br />
            <span className="text-ng-clay">new harvest</span>
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed text-ng-ink-muted md:text-[16px]">
            Just pressed, just churned, just bottled. Be first to taste the freshest
            single-origin lots — added to the shop every week.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <MagneticHover>
              <Button variant="primary" size="lg" asChild className="rounded-full">
                <Link href="/shop">
                  Explore new arrivals
                  <Icon name="arrow-right-linear" size={18} />
                </Link>
              </Button>
            </MagneticHover>
            <div className="flex items-center gap-2 text-[13px] text-ng-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-ng-leaf" />
              FSSAI · ISO 22000 certified
            </div>
          </div>
        </div>
      }
      right={<HarvestComposition reduce={reduce} />}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   RIGHT-SIDE VISUALS — composed from brand assets only (no photos).
   ────────────────────────────────────────────────────────────────────────── */

/** SALE badge — a starburst seal that tucks into the top-right corner. */
function SaleBadge({ className }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute z-30 ${className ?? ""}`}>
      <div className="relative grid h-[96px] w-[96px] place-items-center sm:h-[112px] sm:w-[112px]">
        <Starburst className="absolute inset-0 h-full w-full text-ng-clay drop-shadow-[0_8px_18px_rgba(181,134,47,0.35)]" />
        <div className="relative px-1 text-center leading-none text-ng-soil">
          <span className="block font-display text-[20px] font-bold tracking-tight sm:text-[24px]">SALE</span>
          <span className="mt-1 block whitespace-nowrap text-[8.5px] font-semibold uppercase tracking-[0.06em] sm:text-[10px]">
            up to 20% off
          </span>
        </div>
      </div>
    </div>
  );
}

/** Slide 1 visual — a produce-cluster bursting out of a hand-drawn splash. */
function ProductSplash({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="relative grid h-full min-h-[210px] place-items-center px-6 py-10 sm:px-10">
      <SaleBadge className="right-5 top-5 sm:right-8 sm:top-8" />

      {/* Soft light bloom behind the cluster */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 55% 45%, rgba(255,255,255,0.85), transparent 62%), radial-gradient(ellipse 50% 50% at 50% 80%, rgba(102,191,115,0.16), transparent 65%)",
        }}
      />

      <div className="relative w-full max-w-[340px]">
        {/* Hand-authored splash/burst */}
        <SplashBurst className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 text-ng-leaf/35" />

        {/* Central glass product card (real photo drops in later) */}
        <FloatIn className="relative z-10">
          <div className="glass-strong relative mx-auto w-[210px] overflow-hidden rounded-[26px] border border-white/55 px-6 pb-6 pt-7 text-center shadow-[var(--shadow-ng-float)]">
            <span className="absolute right-3.5 top-3.5 rounded-full bg-ng-clay/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ng-soil shadow-sm">
              20% off
            </span>
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-white to-ng-cream shadow-[var(--shadow-ng-card)] ring-1 ring-ng-clay/20">
              <Logo variant="mark" tone="forest" className="h-14 w-14" />
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-ng-clay-deep">
              This week&rsquo;s harvest
            </p>
            <h3 className="mt-1 font-display text-[19px] font-semibold leading-tight text-ng-forest-deep">
              Cold-Pressed Oil
            </h3>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <span className="font-display text-[20px] font-semibold text-ng-forest">₹389</span>
              <span className="text-[12px] text-ng-ink-soft line-through">₹450</span>
            </div>
          </div>
        </FloatIn>

        {/* Produce chips bursting out of the splash */}
        <BurstChip reduce={reduce} delay={0.15} icon="oil" tint="text-ng-leaf" className="-left-6 top-2 sm:-left-10" />
        <BurstChip reduce={reduce} delay={0.3} icon="honey" tint="text-ng-amber" className="-right-5 top-6 sm:-right-9" />
        <BurstChip reduce={reduce} delay={0.45} icon="ghee" tint="text-ng-clay" className="-left-4 bottom-6 sm:-left-8" />
        <BurstChip reduce={reduce} delay={0.6} icon="spice" tint="text-ng-terracotta" className="-right-4 bottom-2 sm:-right-8" />
        <BurstChip reduce={reduce} delay={0.75} icon="seedling" tint="text-ng-green-bright" className="left-1/2 -top-7 -translate-x-1/2" />
      </div>
    </div>
  );
}

/** Slide 2 visual — the brand mark medallion + an orbit of produce chips. */
function BrandComposition({ reduce }: { reduce: boolean | null }) {
  const ORBIT: { icon: keyof typeof PRODUCE_ICONS; tint: string; pos: string; delay: number }[] = [
    { icon: "oil", tint: "text-ng-leaf", pos: "-left-4 top-4 sm:-left-8", delay: 0.15 },
    { icon: "ghee", tint: "text-ng-clay", pos: "right-2 top-1 sm:right-0", delay: 0.28 },
    { icon: "honey", tint: "text-ng-amber", pos: "-right-5 top-1/2 -translate-y-1/2 sm:-right-9", delay: 0.41 },
    { icon: "fruit", tint: "text-ng-terracotta", pos: "right-4 bottom-2 sm:right-2", delay: 0.54 },
    { icon: "seedling", tint: "text-ng-green-bright", pos: "-left-3 bottom-6 sm:-left-7", delay: 0.67 },
  ];
  return (
    <div className="relative grid h-full min-h-[210px] place-items-center overflow-hidden px-8 py-10">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: "linear-gradient(168deg, #F5F2E0 0%, #ECE7D2 48%, #DCE3CF 100%)" }}
      />
      <HeroScene />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 60% 28%, rgba(181,134,47,0.16), transparent 62%), radial-gradient(ellipse 55% 55% at 22% 80%, rgba(102,191,115,0.18), transparent 64%)",
        }}
      />

      <div className="relative w-full max-w-[300px]">
        <FloatIn className="relative z-10">
          <div className="glass-strong relative mx-auto grid h-[200px] w-[200px] place-items-center rounded-full border border-white/55 text-center shadow-[var(--shadow-ng-float)]">
            <div aria-hidden className="absolute inset-3 rounded-full border border-dashed border-ng-clay/35" />
            <div>
              <Logo variant="mark" tone="forest" className="mx-auto h-16 w-16" />
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-ng-clay-deep">Nutri Greenz</p>
              <p className="mt-0.5 text-[11px] text-ng-ink-muted">Farm to kitchen</p>
            </div>
          </div>
        </FloatIn>

        {ORBIT.map((o) => (
          <BurstChip key={o.icon} reduce={reduce} delay={o.delay} icon={o.icon} tint={o.tint} className={o.pos} />
        ))}

        <FloatIn delay={0.5} className="absolute -bottom-3 left-1/2 z-20 -translate-x-1/2">
          <div className="glass-strong flex items-center gap-2 rounded-full px-3.5 py-2 shadow-[var(--shadow-ng-card)]">
            <span className="h-1.5 w-1.5 rounded-full bg-ng-success" />
            <span className="text-[11px] font-semibold text-ng-forest-deep">Lab-tested · traceable</span>
          </div>
        </FloatIn>
      </div>
    </div>
  );
}

/** Slide 3 visual — a fresh seasonal trio of produce chips around a leaf burst. */
function HarvestComposition({ reduce }: { reduce: boolean | null }) {
  const items: { icon: keyof typeof PRODUCE_ICONS; tint: string; label: string }[] = [
    { icon: "seedling", tint: "text-ng-green-bright", label: "Sun-dried superfoods" },
    { icon: "honey", tint: "text-ng-amber", label: "Forest raw honey" },
    { icon: "oil", tint: "text-ng-leaf", label: "Cold-pressed oils" },
  ];
  return (
    <div className="relative grid h-full min-h-[210px] place-items-center px-6 py-10 sm:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 58% 55% at 55% 42%, rgba(255,255,255,0.8), transparent 62%), radial-gradient(ellipse 55% 55% at 50% 85%, rgba(242,158,18,0.14), transparent 65%)",
        }}
      />
      <SplashBurst className="absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 text-ng-clay/25" />

      <div className="relative z-10 grid w-full max-w-[320px] gap-3">
        {items.map((it, i) => {
          const Glyph = PRODUCE_ICONS[it.icon];
          return (
            <FloatIn key={it.icon} delay={reduce ? 0 : 0.15 + i * 0.12}>
              <div className="glass-strong flex items-center gap-3.5 rounded-2xl border border-white/55 px-4 py-3.5 shadow-[var(--shadow-ng-card)]">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/80 ${it.tint} ring-1 ring-ng-line`}>
                  <Glyph size={26} />
                </span>
                <div className="leading-tight">
                  <div className="font-display text-[15px] font-semibold text-ng-forest-deep">{it.label}</div>
                  <div className="text-[11.5px] text-ng-ink-muted">Fresh lot · just added</div>
                </div>
                <span className="ml-auto rounded-full bg-ng-leaf/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ng-forest-soft">
                  New
                </span>
              </div>
            </FloatIn>
          );
        })}
      </div>
    </div>
  );
}

/** A single floating produce chip used by the splash / brand compositions. */
function BurstChip({
  reduce,
  delay,
  icon,
  tint,
  className,
}: {
  reduce: boolean | null;
  delay: number;
  icon: keyof typeof PRODUCE_ICONS;
  tint: string;
  className?: string;
}) {
  const Glyph = PRODUCE_ICONS[icon];
  return (
    <FloatIn delay={reduce ? 0 : delay} className={`absolute z-20 ${className ?? ""}`}>
      <span
        className={`grid h-[52px] w-[52px] place-items-center rounded-2xl border border-white/70 bg-white/85 ${tint} shadow-[var(--shadow-ng-card)] backdrop-blur-sm`}
      >
        <Glyph size={26} />
      </span>
    </FloatIn>
  );
}

/* ── Hand-authored SVG splash / burst ── */
function SplashBurst({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" className={`pointer-events-none ${className ?? ""}`} aria-hidden>
      <g fill="currentColor">
        <path d="M200 36c14 34 8 64 30 70s44-22 60-6-6 46 2 64 44 16 44 38-36 28-40 50 18 44 2 60-46-2-66 8-26 42-50 42-30-32-52-40-50 6-66-10 6-46-4-66-40-24-40-48 30-30 36-52-16-44 0-60 44 4 64-6 26-46 40-46Z" opacity="0.55" />
      </g>
      <g fill="currentColor" opacity="0.4">
        <circle cx="60" cy="120" r="9" />
        <circle cx="350" cy="150" r="11" />
        <circle cx="320" cy="320" r="8" />
        <circle cx="80" cy="320" r="10" />
        <circle cx="200" cy="22" r="7" />
      </g>
    </svg>
  );
}

/* ── Tonal farm-landscape backdrop (reused on the brand slide) ── */
const SUN = "#B5862F";
const FAR = "#C7CDB0";
const MID = "#A9BE94";
const NEAR = "#8FB07C";
const HILL = "#6E9A5E";

function HeroScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 select-none">
      <svg
        className="block h-[180px] w-full sm:h-[220px] md:h-[260px]"
        viewBox="0 0 720 320"
        preserveAspectRatio="xMidYMax slice"
        role="presentation"
      >
        <circle cx="520" cy="120" r="46" fill={SUN} opacity="0.18" />
        <circle cx="520" cy="120" r="26" fill={SUN} opacity="0.30" />
        <path d="M0 196 C140 156 250 188 360 174 C470 160 590 196 720 168 L720 320 L0 320 Z" fill={FAR} opacity="0.9" />
        <path d="M0 232 C120 200 240 232 360 216 C480 200 600 236 720 214 L720 320 L0 320 Z" fill={MID} opacity="0.92" />
        <path d="M0 268 C160 246 320 270 480 258 C580 250 660 266 720 258 L720 320 L0 320 Z" fill={NEAR} />
        <path d="M0 296 C180 282 360 300 540 290 C620 286 680 296 720 292 L720 320 L0 320 Z" fill={HILL} />
        <g stroke="#5C8A50" strokeWidth="2" strokeLinecap="round" opacity="0.55">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={i} x1={20 + i * 40} y1="306" x2={28 + i * 40} y2="298" />
          ))}
        </g>
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

/* ── Starburst seal outline for the SALE badge ──
   Points are precomputed to fixed precision (24-point alternating r=50/42 star)
   so the SVG string is byte-identical on the server and client — generating them
   with Math.cos/sin at render time produced subtly different floats and a
   hydration mismatch. */
const STARBURST_POINTS =
  "100.00,50.00 90.57,60.87 93.30,75.00 79.70,79.70 75.00,93.30 60.87,90.57 50.00,100.00 39.13,90.57 25.00,93.30 20.30,79.70 6.70,75.00 9.43,60.87 0.00,50.00 9.43,39.13 6.70,25.00 20.30,20.30 25.00,6.70 39.13,9.43 50.00,0.00 60.87,9.43 75.00,6.70 79.70,20.30 93.30,25.00 90.57,39.13";

function Starburst({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon points={STARBURST_POINTS} fill="currentColor" />
    </svg>
  );
}

/* ── Small inline glyphs ── */
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

/* ── Faint repeating leaf-branch motif that textures the green brand slide ── */
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
