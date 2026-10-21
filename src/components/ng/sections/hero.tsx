"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../button";
import { Icon } from "@/components/ui/icon";
import { FloatIn, MagneticHover } from "../motion";
import { useDragSwipe } from "@/components/ng/use-drag-swipe";

/**
 * Hero — a wide promotional **banner slideshow** (wide banner format).
 *
 * A first-section, full-width carousel of product ad banners. Every slide is
 * the same recipe: a light, airy product-scene photograph (jar/bottle/pack +
 * floating claim badges, generated on-brand) anchored right, with live HTML
 * copy on the left — corner tag → playful Hinglish headline → sub-line →
 * dashed tagline → a warm-orange Shop Now. Auto-advances (~7s), pauses on
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
  /**
   * Opacity of the left legibility wash, 0 to 1. Omitted means "flat ground",
   * which keeps the original near-opaque ramp.
   *
   * Measured, not eyeballed. The photographic banners are lit with their left
   * half held soft and open, so each one already clears WCAG AA against the
   * forest headline ink with no wash at all:
   *
   *   ghee 5.91:1   oils 4.57:1   honey 5.15:1   rice 4.98:1
   *
   * (oils is the groundnut-farm art, measured for the lighter sub-copy ink
   * at the 5th-percentile pixel with the wash applied.)
   *
   * The 0.10 they carry is margin, not necessity, and buys a little headroom
   * for the lighter weights in the sub-copy (final: 5.31:1 to 6.39:1). It
   * replaces the 0.95 the illustrated art needed. Push this back up and you
   * are covering the photograph you paid to shoot, so re-measure first.
   */
  washAlpha?: number;
  /** Crop for the stacked art band below lg. Defaults to keeping the product right of centre. */
  bandPos?: string;
}

const SLIDES: PromoSlideDef[] = [
  {
    id: "oils",
    label: "Cold-pressed groundnut oil",
    tag: "Farm fresh",
    img: "/images/hero/launch-groundnut-farm.b1607961.webp",
    alt: "Nutri Greenz cold-pressed groundnut oil in 5 L and 10 L cans on a wooden table at a groundnut farm at sunrise",
    kicker: "Khet se seedha,",
    title: "Cold-pressed",
    script: "groundnut oil.",
    sub: "Simple ingredients, real goodness | 5 L and 10 L",
    tagline: "No adulteration, no preservatives",
    cta: { label: "Shop groundnut oil", href: "/products/groundnut-cold-pressed-oil" },
    // Warm golden-wheat, matched to the sunrise over the groundnut field.
    wash: "#F3E9C9",
    washAlpha: 0.1,
    // The cans sit hard right in this art; anchor right so the 10 L is never clipped on phones.
    bandPos: "object-right",
  },
  {
    id: "ghee",
    label: "A2 Bilona Ghee",
    tag: "New launch",
    img: "/images/hero/launch-ghee-photo.webp",
    alt: "Nutri Greenz A2 Desi Cow Ghee · made from curd, 100% A2 milk",
    kicker: "Ghar jaisa ghee?",
    title: "A2 Bilona",
    script: "Ab hoga.",
    sub: "Introducing A2 Desi Cow Ghee | Bilona-churned",
    tagline: "Your family's daily dose of purity",
    cta: { label: "Shop ghee", href: "/shop/ghee" },
    wash: "#E7F1E4",
    washAlpha: 0.1,
  },
  {
    id: "honey",
    label: "Wild raw honey",
    tag: "Raw & pure",
    img: "/images/hero/launch-honey-photo.webp",
    alt: "Nutri Greenz Wild Raw Honey · raw & unheated, no added sugar",
    kicker: "Cheeni nahi,",
    title: "Sahi shahad",
    script: "Ab hoga.",
    sub: "Wild Raw Honey | Unheated · Unfiltered",
    tagline: "No added sugar, ever",
    cta: { label: "Shop honey", href: "/shop/honey" },
    wash: "#F4EFE0",
    washAlpha: 0.1,
  },
  {
    id: "rice",
    label: "Everyday rice",
    tag: "Coming soon",
    img: "/images/hero/launch-rice-photo.webp",
    alt: "Nutri Greenz rice - Sona Masoori, HMT and Basmati, naturally aged",
    kicker: "Roz ka chawal,",
    title: "Goodness in",
    script: "every grain.",
    sub: "Sona Masoori · HMT · Basmati · Naturally aged",
    tagline: "Fresh, pure grains for everyday meals",
    cta: { label: "Explore the pantry", href: "/shop" },
    // Warm cream to match the new rice artwork's soft beige backdrop.
    wash: "#F4ECD8",
    washAlpha: 0.1,
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
  /*
   * A live promotion takes the hero on its own.
   *
   * The promo used to sit in slot 0 and rotate with the four evergreen slides,
   * which reads as "here is a sale, and here are four other things" — the
   * festival is gone in eight seconds and a shopper who looked away misses it
   * entirely. On the one day a campaign is actually running, the hero should be
   * about that campaign.
   *
   * Solo also means `count` is 1, so autoplay has nothing to advance to and the
   * arrows and dots hide themselves. No date logic and nothing to switch back:
   * when the promotion is deactivated or its window closes, `promo` is null and
   * the carousel returns exactly as it was.
   */
  const items: SlideItem[] = promo
    ? [{ kind: "promo" as const, key: "active-promo", label: promo.title, promo }]
    : SLIDES.map((s) => ({ kind: "slide" as const, key: s.id, label: s.label, slide: s }));

  const count = items.length;
  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Finger-swipe on touch/pointer devices — drag left/right to advance, with a
  // small live nudge for feedback. Keeps the existing crossfade, arrows and dots
  // untouched; a committed swipe just calls next()/prev().
  const { offset: dragX, dragging, handlers: swipe } = useDragSwipe({
    onSwipeLeft: next,
    onSwipeRight: prev,
    threshold: 44,
    maxOffset: 120,
  });

  // Auto-advance — paused on hover/focus, during an active drag, when the tab is
  // hidden, or under reduced motion. Depending on `index` restarts the timer
  // after every change (manual or auto), so a slide is never cut short right
  // after you click an arrow/dot or finish a swipe.
  useEffect(() => {
    // Nothing to advance to when a promotion owns the hero on its own.
    if (count < 2 || paused || reduce || dragging) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [paused, reduce, count, index, dragging]);

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
      <div
        {...swipe}
        className="relative touch-pan-y select-none overflow-hidden rounded-[28px] shadow-[var(--shadow-ng-float)] md:rounded-[36px]"
      >
        {/*
          Equal-height stage — slides never shift layout. All of them stay
          mounted and cross-fade by opacity, so every image preloads up-front
          (no lazy pop-in when the carousel advances); a hidden sizer reserves
          the height.

          The height was `clamp(440px, 60vh, 600px)`. That 440px FLOOR was
          taller than a landscape phone: on an 844x390 viewport the stage came
          out 440px on a 390px screen, so the CTA and the carousel's own dots
          sat below the fold and the control could not be operated at all.

          `min(…, 74dvh)` caps the floor against the real viewport, so a short
          screen shrinks the banner instead of overflowing it. Tall viewports
          are unaffected — the cap only binds when the screen is short.

          dvh, not vh: on mobile browsers vh is the height with the URL bar
          hidden, which is exactly the measurement that overflows while the bar
          is still showing.
        */}
        <div className="relative min-h-[min(clamp(440px,60dvh,600px),74dvh)]">
          {/* Invisible sizer: keeps the tallest reasonable banner height reserved. */}
          {/* Every slide in one grid cell, so the stage takes the tallest one.
              Stacked on a phone, slides differ in height with their copy; a
              first-slide sizer would clip the CTA off a longer one. */}
          <div aria-hidden className="invisible grid [&>*]:[grid-area:1/1]">
            {items.map((item) =>
              item.kind === "promo" ? (
                <PromoBannerSlide key={item.key} promo={item.promo} />
              ) : (
                <PromoSlide key={item.key} slide={item.slide} />
              ),
            )}
          </div>

          {/* Swipe layer: only the slides translate with the finger; the sizer and
              controls stay put. Snaps back (dragX → 0) with a short transition on
              release while the crossfade advances to the new slide. */}
          <div
            className={`absolute inset-0 ${dragging || reduce ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"}`}
            style={{ transform: `translate3d(${dragX}px, 0, 0)` }}
          >
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
          </div>

          {/* Controls — prev · dots · next in one slim glass pill at the bottom.
              Compact and light so it sits over the art without dominating it;
              44px touch targets are preserved via padding on the hit area.

              Hidden entirely on a single slide. A prev/next pair and one dot
              that cannot go anywhere is a control that lies about what it does,
              and it covers the artwork to do it. */}
          {count > 1 ? (
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
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Corner tag — shared by the static slides and the live-promotion banner.

   Both used to carry their own copy of this markup, and only one of them got
   fixed when the stacking overflowed. One component means the next change
   cannot land on half the slides.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Words too short to hold a line of their own.
 *
 * "Raw & Pure" set one word per line put the ampersand on its own row: three
 * lines tall, with a single character marooned in the middle of them. Joining
 * connectors to the word before both reads better and keeps the tag shorter —
 * the same change fixes the typography and the height.
 */
const TAG_CONNECTORS = new Set(["&", "+", "and", "of", "the", "n", "·"]);

/** Split a tag into stacked lines, keeping connectors attached to the word before. */
function stackTagWords(tag: string): string[] {
  const lines: string[] = [];
  for (const word of tag.split(" ").filter(Boolean)) {
    if (lines.length > 0 && TAG_CONNECTORS.has(word.toLowerCase())) {
      lines[lines.length - 1] += ` ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

/**
 * The dark occasion tag pinned to the banner's top-left corner.
 *
 * Its height is set by its content while the copy column that has to clear it
 * carries a fixed inset, so stacking is capped at three lines. Past that the
 * label wraps normally and the tag stops growing, whatever an operator types
 * into the promotion form.
 */
function CornerTag({ label }: { label: string }) {
  const lines = stackTagWords(label);
  return (
    <div className="absolute left-0 top-0 z-10 max-w-[42%] rounded-br-3xl rounded-tl-[28px] bg-ng-forest-deep px-5 py-3 text-ng-cream sm:max-w-[30%] md:rounded-tl-[36px]">
      <span className="block font-display text-[13px] font-bold uppercase leading-[1.15] tracking-wider">
        {lines.length > 3
          ? label
          : lines.map((line, i) => (
              <span key={`${line}-${i}`} className="block">
                {line}
              </span>
            ))}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Promo slide — light ad banner: product scene photo right, HTML copy left
   (banner format: tag → Hinglish headline → sub → dashed tagline → orange
   Shop Now).
   ────────────────────────────────────────────────────────────────────────── */
/** 0–1 alpha as the two-digit hex suffix of an 8-digit CSS colour. */
function alphaHex(a: number): string {
  return Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/**
 * Desktop legibility fade.
 *
 * A photographic banner carries its own open left side, so the wash is anchored
 * on the measured `washAlpha` and thins to nothing well before the product.
 * A slide without one keeps the original near-opaque ramp, which flat
 * illustrated art still needs to stop it bleeding under the copy.
 */
function desktopWash(slide: PromoSlideDef): string {
  const w = slide.wash;
  const a = slide.washAlpha;
  if (a == null) {
    return `linear-gradient(to right, ${w}F2 0%, ${w}B3 42%, transparent 68%)`;
  }
  return `linear-gradient(to right, ${w}${alphaHex(a)} 0%, ${w}${alphaHex(a * 0.72)} 42%, transparent 68%)`;
}

function PromoSlide({ slide, priority = false }: { slide: PromoSlideDef; priority?: boolean }) {
  return (
    <div className="relative flex h-full min-h-[inherit] flex-col overflow-hidden lg:flex-row" style={{ backgroundColor: slide.wash }}>
      {/* Phones: the wide 21:9 art cannot fit a tall frame with copy on top of
          it; the crop lost the product and left the text on a blur. Below md
          the art gets its own band, cropped to keep the product (it sits right
          of centre in every banner), and the copy sits on a solid panel
          underneath. Tablets too: the honey art centres its jar with badges
          on the left, so copy over it collided at 820px. From lg up the art
          fills the frame behind the copy. The band is capped at 46dvh so a
          phone held sideways still shows the button. */}
      <div className="relative aspect-[4/3] max-h-[46dvh] w-full shrink-0 sm:aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto lg:max-h-none">
        <Image
          src={slide.img}
          alt={slide.alt}
          fill
          priority={priority}
          quality={90}
          sizes="100vw"
          className={`object-cover ${slide.bandPos ?? "object-[85%_center]"} lg:object-right`}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/4 lg:hidden"
          style={{ background: `linear-gradient(to bottom, transparent, ${slide.wash})` }}
        />
      </div>
      {/* Left legibility wash.
          Over a photographic ground this is deliberately light: the alpha is the
          measured minimum that clears WCAG AA against the headline ink (see
          `bgWash`), so the scene still reads as a photograph. Slides with no
          `bg` keep the original near-opaque fade, which is what a flat ground
          needs to stop the artwork bleeding under the copy.
          Mobile carries more cover than desktop because the crop puts the copy
          over busier pixels. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden lg:block"
        style={{ background: desktopWash(slide) }}
      />

      <CornerTag label={slide.tag} />

      {/*
        Top clearance is restated at EVERY breakpoint that sets `p-*`.
        `md:p-14` sits after `sm:pt-16` in Tailwind's generated sheet, so the
        shorthand won from md up and the column kept a 56px inset behind a tag
        standing 54–69px tall. Measured at 1440px, all five static slides had
        their kicker printing through the tag.

        The type scale comes down with it. The column is vertically centred, so
        content taller than the padded box does not clip — it overflows evenly
        in BOTH directions and walks up under the tag. Padding alone could not
        have fixed that; the content had to fit as well.
      */}
      {/* Stacked (below lg) the corner tag sits on the art, so the copy needs
          no tag clearance, only room at the bottom for the slider controls. */}
      <div className="relative z-10 flex w-full flex-1 flex-col justify-center gap-2.5 px-5 pb-16 pt-3 sm:gap-3 sm:px-8 sm:pb-[4.5rem] md:px-12 lg:max-w-xl lg:gap-3.5 lg:p-14 lg:pt-[76px] lg:pl-16 xl:max-w-2xl">
        <FloatIn delay={0.05}>
          <p className="font-sans text-[clamp(14px,1.5vw,20px)] font-semibold text-ng-forest">{slide.kicker}</p>
          <h2 className="mt-1 font-display text-[clamp(28px,4.6vw,60px)] leading-[0.98] text-ng-forest-deep">
            {slide.title}{" "}
            <em className="relative whitespace-nowrap italic text-ng-forest">
              {slide.script}
              <span aria-hidden className="absolute -bottom-1.5 left-0 h-[3px] w-full rounded-full bg-ng-forest/70" />
            </em>
          </h2>
        </FloatIn>

        <FloatIn delay={0.15}>
          <p className="line-clamp-2 font-sans text-[clamp(14px,1.35vw,17px)] font-medium leading-snug text-ng-forest">
            {slide.sub}
          </p>
        </FloatIn>

        <FloatIn delay={0.22}>
          <div className="inline-flex rounded-xl border border-dashed border-ng-forest/60 px-4 py-2">
            <span className="font-sans text-[clamp(13px,1.2vw,16px)] font-medium text-ng-forest-deep">
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
    <div className="relative flex h-full min-h-[inherit] flex-col overflow-hidden lg:flex-row" style={{ backgroundColor: wash }}>
      {/* Same stacking as the static slides: art in its own band below lg. */}
      <div className="relative aspect-[4/3] max-h-[46dvh] w-full shrink-0 sm:aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto lg:max-h-none">
        <Image
          src={`/images/banners/sale-${promo.bannerKey}.webp`}
          alt={promo.title}
          fill
          priority={priority}
          quality={90}
          sizes="100vw"
          className="object-cover object-[85%_center] lg:object-right"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/4 lg:hidden"
          style={{ background: `linear-gradient(to bottom, transparent, ${wash})` }}
        />
      </div>
      {/* Left legibility wash, lg and up where the copy sits on the art. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden lg:block"
        style={{ background: `linear-gradient(to right, ${wash}F2 0%, ${wash}B3 42%, transparent 68%)` }}
      />

      <CornerTag label={promo.title} />

      {/*
        The top padding is restated at EVERY breakpoint that sets `p-*`.
        `md:p-14` sits after `sm:pt-16` in Tailwind's generated sheet, so the
        shorthand silently won at md and up and the column kept a 56px top
        inset — less than the 69px corner tag standing in front of it. The
        clearance is now stated per breakpoint so no shorthand can undercut it.
      */}
      <div className="relative z-10 flex w-full flex-1 flex-col justify-center gap-3 px-5 pb-16 pt-3 sm:px-8 sm:pb-[4.5rem] md:px-12 lg:max-w-xl lg:gap-4 lg:p-14 lg:pt-[76px] lg:pl-16 xl:max-w-2xl">
        <FloatIn delay={0.05}>
          {/*
            Sized DOWN, deliberately. At clamp(…,60px) the headline set larger
            than the discount it introduces and ran to three lines, so the eye
            met the qualifier before the offer. The banner's hierarchy is
            occasion tag → what's on sale → how much off, and the type scale now
            follows it. `text-balance` keeps a two-line headline evenly split
            rather than leaving one word stranded.
          */}
          <h2 className="text-balance font-display text-[clamp(22px,3vw,38px)] leading-[1.08] text-ng-forest-deep">
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
            {/* Capped at two lines and a comfortable measure. This is the one
                field with no length discipline of its own — it explains the
                offer rather than announcing it, so a long entry should run out
                of room quietly instead of pushing the CTA off the banner. */}
            <p className="line-clamp-2 max-w-[46ch] font-sans text-[clamp(14px,1.35vw,17px)] font-medium leading-snug text-ng-forest">
              {promo.subcopy}
            </p>
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
