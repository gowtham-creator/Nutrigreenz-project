"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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

const AUTO_MS = 4800;

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
    cta: { label: "Shop Ghee", href: "/shop/ghee" },
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
    cta: { label: "Shop Oils", href: "/shop/oils" },
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
    cta: { label: "Shop Honey", href: "/shop/honey" },
    wash: "#F4EFE0",
  },
  {
    id: "rice",
    label: "Everyday rice",
    tag: "Coming Soon",
    img: "/images/hero/rice-hero.webp",
    alt: "Nutri Greenz rice - Sona Masoori, HMT and Basmati, naturally aged",
    kicker: "Roz ka chawal,",
    title: "Goodness in",
    script: "Every Grain.",
    sub: "Sona Masoori · HMT · Basmati · Naturally aged",
    tagline: "Fresh, pure grains for everyday meals",
    cta: { label: "Explore the pantry", href: "/shop" },
    // Warm cream to match the new rice artwork's soft beige backdrop.
    wash: "#F4ECD8",
  },
];

/**
 * The subset of a resolved promotion the hero needs for its lead banner. A plain
 * serializable shape (no `server-only` import) so it crosses the Server → Client
 * boundary as a prop; a full `PromotionRecord` is structurally assignable to it.
 */
export interface HeroPromo {
  bannerKey: string;
  title: string;
  headline: string;
  subcopy: string | null;
  discountPercent: number;
  ctaLabel: string;
  ctaHref: string;
}

/** A carousel entry: the active-promotion banner, or a static launch slide. */
type SlideItem =
  | { kind: "promo"; key: string; label: string; promo: HeroPromo }
  | { kind: "slide"; key: string; label: string; slide: PromoSlideDef };

/* ──────────────────────────────────────────────────────────────────────────
   Slideshow shell
   ────────────────────────────────────────────────────────────────────────── */
export function Hero({ promo }: { promo?: HeroPromo | null }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  // When a promotion is live it leads the carousel; otherwise the hero is exactly
  // the four static slides. The promo only ever takes the first slot, so the
  // `index` cursor stays valid whether or not a promo is present.
  const items: SlideItem[] = [
    ...(promo
      ? [{ kind: "promo" as const, key: "active-promo", label: promo.title, promo }]
      : []),
    ...SLIDES.map((s) => ({ kind: "slide" as const, key: s.id, label: s.label, slide: s })),
  ];

  const count = items.length;
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
        {/* Equal-height stage — height fixed by the banner clamp so slides never
            shift layout. ALL slides stay mounted and are cross-faded by opacity,
            so every image preloads up-front (no lazy pop-in when the carousel
            advances); a hidden sizer reserves the height. */}
        <div className="relative min-h-[clamp(440px,60vh,600px)]">
          {/* Invisible sizer: keeps the tallest reasonable banner height reserved. */}
          <div aria-hidden className="invisible">
            <PromoSlide slide={SLIDES[0]} priority />
          </div>

          {items.map((item, i) => {
            const active = i === index;
            return (
              <motion.div
                key={item.key}
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: reduce ? 0.2 : 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ pointerEvents: active ? "auto" : "none" }}
                aria-hidden={!active}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}: ${item.label}`}
              >
                {item.kind === "promo" ? (
                  <PromoBannerSlide promo={item.promo} priority={i === 0} />
                ) : (
                  <PromoSlide slide={item.slide} priority={i === 0} />
                )}
              </motion.div>
            );
          })}

          {/* Controls — prev · dots · next in one slim glass pill at the bottom.
              Compact and light so it sits over the art without dominating it;
              44px touch targets are preserved via padding on the hit area. */}
          <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-ng-forest-deep/45 px-1 py-1 shadow-[0_6px_18px_rgba(20,40,24,0.28)] ring-1 ring-white/15 backdrop-blur-md md:bottom-5">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous banner"
              className="grid h-9 w-9 place-items-center rounded-full text-ng-cream/90 transition-colors hover:bg-ng-cream/15 hover:text-white active:scale-95"
            >
              <Icon name="alt-arrow-left-linear" size={17} />
            </button>

            <div role="tablist" aria-label="Choose banner" className="flex items-center gap-1.5 px-0.5">
              {items.map((item, i) => {
                const active = i === index;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Go to ${item.label} banner`}
                    onClick={() => go(i)}
                    className="group grid h-9 min-w-[22px] place-items-center px-1"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-all duration-300 ${
                        active ? "w-5 bg-ng-cream" : "w-1.5 bg-ng-cream/60 group-hover:bg-ng-cream/90"
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
              className="grid h-9 w-9 place-items-center rounded-full text-ng-cream/90 transition-colors hover:bg-ng-cream/15 hover:text-white active:scale-95"
            >
              <Icon name="alt-arrow-right-linear" size={17} />
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
function PromoSlide({ slide, priority = false }: { slide: PromoSlideDef; priority?: boolean }) {
  return (
    <div className="relative flex h-full min-h-[inherit] overflow-hidden" style={{ backgroundColor: slide.wash }}>
      {/* object-position: on mobile the wide 21:9 art is zoom-cropped hard, so we
          bias the crop toward the product (centre-right) instead of the far-right
          edge — otherwise only the badge/props survive. Desktop shows the full
          right composition. */}
      <Image
        src={slide.img}
        alt={slide.alt}
        fill
        priority={priority}
        quality={90}
        sizes="100vw"
        className="object-cover object-[62%_center] sm:object-right"
      />
      {/* Left legibility wash. Desktop: a gentle fade so the product still shows.
          Mobile (sm:hidden): opaque under the copy on the left, then fades by
          mid-frame so the product stays clearly visible on the right. */}
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
          background: `linear-gradient(to right, ${slide.wash}F7 0%, ${slide.wash}EE 38%, ${slide.wash}99 60%, transparent 82%)`,
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

/* ──────────────────────────────────────────────────────────────────────────
   Active-promotion banner — the live sale rendered in the PromoSlide format:
   festive banner art anchored right beneath a cream legibility wash, with the
   occasion tag → headline → bold "% OFF" → subcopy → orange CTA on the left.
   ────────────────────────────────────────────────────────────────────────── */
function PromoBannerSlide({ promo, priority = false }: { promo: HeroPromo; priority?: boolean }) {
  // A single cream wash keeps the forest copy legible over any of the nine
  // festive banner backgrounds — the same left-fade treatment the static slides
  // use, just with one shared colour since the artwork varies per promotion.
  const wash = "#F5F2E0";
  return (
    <div className="relative flex h-full min-h-[inherit] overflow-hidden" style={{ backgroundColor: wash }}>
      <Image
        src={`/images/banners/sale-${promo.bannerKey}.webp`}
        alt={promo.title}
        fill
        priority={priority}
        quality={90}
        sizes="100vw"
        className="object-cover object-[62%_center] sm:object-right"
      />
      {/* Left legibility wash — desktop gentle fade, mobile heavier under the copy. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden sm:block"
        style={{ background: `linear-gradient(to right, ${wash}F2 0%, ${wash}B3 42%, transparent 68%)` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 sm:hidden"
        style={{ background: `linear-gradient(to right, ${wash}F7 0%, ${wash}EE 38%, ${wash}99 60%, transparent 82%)` }}
      />

      {/* Corner tag — the promotion's name (e.g. "Diwali Sale"), word-stacked. */}
      <div className="absolute left-0 top-0 z-10 rounded-br-3xl bg-ng-forest-deep px-5 py-3 text-ng-cream">
        <span className="block font-display text-[13px] font-bold uppercase leading-[1.15] tracking-wider">
          {promo.title.split(" ").map((w, wi) => (
            <span key={`${w}-${wi}`} className="block">{w}</span>
          ))}
        </span>
      </div>

      <div className="relative z-10 flex w-full max-w-[17rem] sm:max-w-md md:max-w-xl lg:max-w-2xl flex-col justify-center gap-4 p-6 pt-14 sm:gap-5 sm:p-12 sm:pt-16 md:p-14 lg:pl-16">
        <FloatIn delay={0.05}>
          <h2 className="font-display text-[clamp(28px,4.6vw,60px)] leading-[1.02] text-ng-forest-deep">
            {promo.headline}
          </h2>
        </FloatIn>

        <FloatIn delay={0.14}>
          <p className="font-display text-[clamp(34px,6vw,78px)] font-bold leading-[0.92] text-ng-forest">
            {promo.discountPercent}%{" "}
            <span className="relative whitespace-nowrap text-ng-forest-deep">
              OFF
              <span aria-hidden className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-ng-forest/70" />
            </span>
          </p>
        </FloatIn>

        {promo.subcopy ? (
          <FloatIn delay={0.2}>
            <p className="font-sans text-[clamp(15px,1.6vw,20px)] font-medium text-ng-forest">{promo.subcopy}</p>
          </FloatIn>
        ) : null}

        <FloatIn delay={0.28}>
          <MagneticHover>
            <Button
              size="lg"
              asChild
              className="w-fit border-0 bg-[#E8833A] text-white shadow-[0_4px_14px_rgba(232,131,58,0.38)] hover:bg-[#D9772F] hover:text-white"
            >
              <Link href={promo.ctaHref}>{promo.ctaLabel}</Link>
            </Button>
          </MagneticHover>
        </FloatIn>
      </div>
    </div>
  );
}
