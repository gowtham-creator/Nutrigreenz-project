"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "../button";
import { Icon } from "@/components/ui/icon";
import { FloatIn, MagneticHover } from "../motion";

/**
 * Hero — a wide promotional **banner slideshow** (Anveshan-style format).
 *
 * A first-section, full-width carousel of product ad banners. Every slide is
 * the same recipe: a light, airy product-scene photograph (jar/bottle/pack +
 * floating claim badges, generated on-brand) anchored right, with live HTML
 * copy on the left — corner tag → playful Hinglish headline → sub-line →
 * dashed tagline → an Anveshan-orange Shop Now. Auto-advances (~7s), pauses on
 * hover / focus-within / reduced-motion, and exposes clickable dots +
 * prev/next arrows. Keyed crossfade via framer-motion.
 */

const AUTO_MS = 7000;

interface PromoSlideDef {
  id: string;
  label: string;
  /** Corner tag copy, e.g. "NEW LAUNCH". */
  tag: string;
  img: string;
  alt: string;
  /** Small lead-in line above the headline. */
  kicker: string;
  /** The big serif headline… */
  title: string;
  /** …and its italic hand-written-style tail, underlined. */
  script: string;
  sub: string;
  tagline: string;
  cta: { label: string; href: string };
  /** Left legibility wash colour matched to each artwork's background. */
  wash: string;
}

const SLIDES: PromoSlideDef[] = [
  {
    id: "ghee",
    label: "A2 Bilona Ghee",
    tag: "New Launch",
    img: "/images/hero/launch-ghee.webp",
    alt: "Nutri Greenz A2 Desi Cow Ghee — made from curd, 100% A2 milk",
    kicker: "Ghar jaisa ghee?",
    title: "A2 Bilona",
    script: "Ab Hoga.",
    sub: "Introducing A2 Desi Cow Ghee | Bilona-churned",
    tagline: "Your family's daily dose of purity",
    cta: { label: "Shop Now", href: "/products/pure-ghee" },
    wash: "#E7F1E4",
  },
  {
    id: "oils",
    label: "Cold-pressed oils",
    tag: "6 Varieties",
    img: "/images/hero/launch-oils.webp",
    alt: "Nutri Greenz cold-pressed groundnut oil — cold-pressed, zero refining",
    kicker: "Refined oil? Chhodo.",
    title: "Cold-Pressed",
    script: "Apnao.",
    sub: "Six wood-pressed oils | Groundnut to coconut",
    tagline: "Nothing added. Nothing refined.",
    cta: { label: "Shop Oils", href: "/shop/cold-pressed-oils" },
    // Warm golden-wheat — matches the oils artwork and reads distinctly from
    // the ghee slide's sage green (no two banners share a wash now).
    wash: "#F3E9C9",
  },
  {
    id: "honey",
    label: "Wild raw honey",
    tag: "Raw & Pure",
    img: "/images/hero/launch-honey.webp",
    alt: "Nutri Greenz Wild Raw Honey — raw & unheated, no added sugar",
    kicker: "Cheeni nahi,",
    title: "Sahi Shahad",
    script: "Ab Hoga.",
    sub: "Wild Raw Honey | Unheated · Unfiltered",
    tagline: "No added sugar. Ever.",
    cta: { label: "Shop Honey", href: "/products/raw-honey" },
    wash: "#F4EFE0",
  },
  {
    id: "rice",
    label: "Basmati rice",
    tag: "Coming Soon",
    img: "/images/hero/launch-rice.webp",
    alt: "Nutri Greenz Basmati Rice — extra-long grain, naturally aged",
    kicker: "Biryani plans?",
    title: "Basmati",
    script: "Aa Raha Hai.",
    sub: "Extra-long grain | Naturally aged for aroma",
    tagline: "From Indian paddies to your kitchen",
    cta: { label: "Explore the pantry", href: "/shop" },
    // Cool pale mint — kept clearly lighter/cooler than the ghee sage so all
    // four banner gradients are visually distinct.
    wash: "#EAF3EC",
  },
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

  const count = SLIDES.length;
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

  const current = SLIDES[index];

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
            <PromoSlide slide={SLIDES[0]} />
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
              <PromoSlide slide={current} />
            </motion.div>
          </AnimatePresence>

          {/* Controls — prev · dots · next grouped into one pill at the bottom. */}
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ng-forest-deep/65 px-1.5 py-1.5 shadow-[0_8px_24px_rgba(20,40,24,0.42)] ring-1 ring-white/25 backdrop-blur-md md:bottom-5">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous banner"
              className="grid h-11 w-11 lg:h-9 lg:w-9 place-items-center rounded-full text-ng-cream transition-colors hover:bg-ng-cream/20 hover:text-white active:scale-95"
            >
              <Icon name="alt-arrow-left-linear" size={18} />
            </button>

            <div role="tablist" aria-label="Choose banner" className="flex items-center gap-2.5 px-1">
              {SLIDES.map((s, i) => {
                const active = i === index;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Go to ${s.label} banner`}
                    onClick={() => go(i)}
                    className="group grid place-items-center p-1 min-h-[44px] min-w-[44px]"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all duration-300 ${
                        active ? "w-7 bg-ng-cream" : "w-2 bg-ng-cream/70 group-hover:bg-ng-cream/95"
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
              className="grid h-11 w-11 lg:h-9 lg:w-9 place-items-center rounded-full text-ng-cream transition-colors hover:bg-ng-cream/20 hover:text-white active:scale-95"
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
   Promo slide — light ad banner: product scene photo right, HTML copy left
   (Anveshan format: tag → Hinglish headline → sub → dashed tagline → orange
   Shop Now).
   ────────────────────────────────────────────────────────────────────────── */
function PromoSlide({ slide }: { slide: PromoSlideDef }) {
  return (
    <div className="relative flex h-full min-h-[inherit] overflow-hidden" style={{ backgroundColor: slide.wash }}>
      <Image
        src={slide.img}
        alt={slide.alt}
        fill
        priority={slide.id === SLIDES[0].id}
        sizes="100vw"
        className="object-cover object-right"
      />
      {/* Left legibility wash. Desktop: a gentle fade so the product still shows.
          Mobile (sm:hidden): a near-solid wash across most of the width so the
          headline never collides with the baked-in product art / claim badges;
          the product just peeks on the right edge. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden sm:block"
        style={{
          background: `linear-gradient(to right, ${slide.wash}F2 0%, ${slide.wash}B3 42%, transparent 68%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 sm:hidden"
        style={{
          background: `linear-gradient(to right, ${slide.wash}FA 0%, ${slide.wash}FA 58%, ${slide.wash}D9 74%, transparent 100%)`,
        }}
      />

      {/* Corner tag */}
      <div className="absolute left-0 top-0 z-10 rounded-br-3xl bg-ng-forest-deep px-5 py-3 text-ng-cream">
        <span className="block font-display text-[13px] font-bold uppercase leading-[1.15] tracking-wider">
          {slide.tag.split(" ").map((w) => (
            <span key={w} className="block">{w}</span>
          ))}
        </span>
      </div>

      <div className="relative z-10 flex w-full max-w-[17rem] sm:max-w-md md:max-w-xl lg:max-w-2xl flex-col justify-center gap-4 p-6 pt-14 sm:gap-5 sm:p-12 sm:pt-16 md:p-14 lg:pl-16">
        <FloatIn delay={0.05}>
          <p className="font-sans text-[clamp(15px,2vw,26px)] font-semibold text-ng-forest">{slide.kicker}</p>
          <h2 className="mt-1 font-display text-[clamp(30px,5.4vw,68px)] leading-[0.98] text-ng-forest-deep">
            {slide.title}{" "}
            <em className="relative whitespace-nowrap italic text-ng-forest">
              {slide.script}
              <span aria-hidden className="absolute -bottom-1.5 left-0 h-[3px] w-full rounded-full bg-ng-forest/70" />
            </em>
          </h2>
        </FloatIn>

        <FloatIn delay={0.15}>
          <p className="font-sans text-[clamp(15px,1.6vw,20px)] font-medium text-ng-forest">{slide.sub}</p>
        </FloatIn>

        <FloatIn delay={0.22}>
          <div className="inline-flex rounded-xl border border-dashed border-ng-forest/60 px-5 py-2.5">
            <span className="font-sans text-[clamp(14px,1.4vw,18px)] font-medium text-ng-forest-deep">
              {slide.tagline}
            </span>
          </div>
        </FloatIn>

        <FloatIn delay={0.3}>
          <MagneticHover>
            <Button
              size="lg"
              asChild
              className="w-fit border-0 bg-[#E8833A] text-white shadow-[0_4px_14px_rgba(232,131,58,0.38)] hover:bg-[#D9772F] hover:text-white"
            >
              <Link href={slide.cta.href}>{slide.cta.label}</Link>
            </Button>
          </MagneticHover>
        </FloatIn>
      </div>
    </div>
  );
}
