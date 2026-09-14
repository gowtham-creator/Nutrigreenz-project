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
}

const SLIDES: PromoSlideDef[] = [
  {
    id: "ghee",
    label: "A2 Bilona Ghee",
    tag: "New Launch",
    img: "/images/hero/launch-ghee.webp",
    alt: "Nutri Greenz A2 Desi Cow Ghee · made from curd, 100% A2 milk",
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
    alt: "Nutri Greenz cold-pressed groundnut oil · cold-pressed, zero refining",
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
    alt: "Nutri Greenz Wild Raw Honey · raw & unheated, no added sugar",
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
          <div aria-hidden className="invisible">
            <PromoSlide slide={SLIDES[0]} priority />
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
      <div className="relative z-10 flex w-full max-w-[17rem] sm:max-w-md md:max-w-xl lg:max-w-2xl flex-col justify-center gap-3 p-6 pt-[72px] sm:gap-3.5 sm:p-12 sm:pt-[76px] md:p-14 md:pt-[76px] lg:pl-16">
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

      <CornerTag label={promo.title} />

      {/*
        The top padding is restated at EVERY breakpoint that sets `p-*`.
        `md:p-14` sits after `sm:pt-16` in Tailwind's generated sheet, so the
        shorthand silently won at md and up and the column kept a 56px top
        inset — less than the 69px corner tag standing in front of it. The
        clearance is now stated per breakpoint so no shorthand can undercut it.
      */}
      <div className="relative z-10 flex w-full max-w-[17rem] sm:max-w-md md:max-w-xl lg:max-w-2xl flex-col justify-center gap-3.5 p-6 pt-[72px] sm:gap-4 sm:p-12 sm:pt-[76px] md:p-14 md:pt-[76px] lg:pl-16">
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
