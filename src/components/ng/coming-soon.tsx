"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * The pre-launch "coming soon" film, shown once per visit before the store.
 *
 * The store is browsable, but customers were ordering without knowing it had not
 * opened. It plays for 22 seconds and can be skipped after a few, because a page
 * that holds people hostage loses them. A thin strip then stays on every page.
 *
 * Rendered in the server HTML rather than after mount, or the store would flash
 * first. That inline script runs before paint, so a repeat page in the same visit
 * and the operator routes never show it. The store's HTML still sits underneath,
 * so search engines see the real pages.
 *
 * Super Admin → Feature toggles → "Coming soon banner" removes it at launch.
 */

const SEEN_KEY = "ng-soon-seen";
const DURATION_MS = 22_000;
const SCENE_STARTS_MS = [6_000, 14_000];
const SKIP_AFTER_MS = 4_000;

const INIT = `(function(){try{var p=location.pathname,h=document.documentElement;if(/^\\/(admin|captain|unsubscribe)(\\/|$)|^\\/checkout\\/success/.test(p)){h.dataset.ngSoon="off";return}if(sessionStorage.getItem("${SEEN_KEY}")==="1")h.dataset.ngSoon="seen"}catch(e){}})()`;

const CSS = `html[data-ng-soon] .ng-soon-intro{display:none}html[data-ng-soon="off"] .ng-soon-strip{display:none}`;

const SCENE_EASE = [0.22, 1, 0.36, 1] as const;

export function ComingSoon() {
  const [scene, setScene] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [closed, setClosed] = useState(false);
  const [launched, setLaunched] = useState(false);
  const reduce = useReducedMotion();

  const close = useCallback(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* Private mode: it just plays again on the next page. */
    }
    document.body.style.overflow = "";
    setClosed(true);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch("/api/feature-flags", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { flags?: { coming_soon?: boolean } } | null) => {
        if (alive && j?.flags?.coming_soon === false) {
          document.body.style.overflow = "";
          setLaunched(true);
        }
      })
      .catch(() => {});

    // Already seen, or an operator route: the CSS has hidden it, so no film runs.
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!document.documentElement.dataset.ngSoon) {
      document.body.style.overflow = "hidden";
      SCENE_STARTS_MS.forEach((at, i) => timers.push(setTimeout(() => setScene(i + 1), at)));
      timers.push(setTimeout(() => setCanSkip(true), SKIP_AFTER_MS));
      timers.push(setTimeout(close, DURATION_MS));
    }
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      document.body.style.overflow = "";
    };
  }, [close]);

  if (launched) return null;

  const rise = (delay = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.3 : 1.1, delay, ease: SCENE_EASE },
  });

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: INIT }} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ng-soon-strip bg-ng-forest-deep px-4 py-2 text-center text-[12.5px] font-semibold text-ng-cream">
        Coming soon. Nutri Greenz opens shortly.
      </div>

      <AnimatePresence>
        {closed ? null : (
          <motion.div
            key="intro"
            role="dialog"
            aria-modal="true"
            aria-label="Nutri Greenz is coming soon"
            className="ng-soon-intro fixed inset-0 z-[200] overflow-hidden bg-[#FDFEF8]"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            <AnimatePresence mode="wait">
              {scene === 0 ? (
                <motion.div
                  key="logo"
                  className="absolute inset-0 grid place-items-center px-6"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: reduce ? 0.3 : 2.2, ease: SCENE_EASE }}
                    className="relative aspect-[500/275] w-[min(72vw,460px)]"
                  >
                    <Image src="/brand/logo-stacked.png" alt="Nutri Greenz" fill priority sizes="460px" className="object-contain" />
                  </motion.div>
                </motion.div>
              ) : null}

              {scene === 1 ? (
                <motion.div
                  key="bottle"
                  className="absolute inset-0 mx-auto flex max-w-5xl flex-col items-center justify-center gap-6 px-6 md:flex-row md:gap-16"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 70 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0.3 : 1.8, ease: SCENE_EASE }}
                    className="relative h-[46vh] w-[62vw] max-w-[320px] shrink-0 md:h-[78vh] md:w-[34vw]"
                  >
                    <Image
                      src="/images/products/oils/groundnut.webp"
                      alt="Nutri Greenz cold-pressed groundnut oil"
                      fill
                      sizes="(min-width: 768px) 34vw, 62vw"
                      className="object-contain mix-blend-multiply"
                    />
                  </motion.div>
                  <div className="max-w-md text-center md:text-left">
                    <motion.p {...rise(0.5)} className="font-display text-[clamp(34px,5.4vw,64px)] leading-[1.05] text-ng-forest-deep">
                      Traditionally pressed.
                    </motion.p>
                    <motion.p {...rise(1.5)} className="mt-1 font-display text-[clamp(34px,5.4vw,64px)] italic leading-[1.05] text-ng-clay">
                      Truly farm fresh.
                    </motion.p>
                    <motion.p {...rise(2.6)} className="mt-5 text-[15px] leading-relaxed text-ng-ink-muted">
                      Cold-pressed. Unrefined. Born in soil.
                    </motion.p>
                  </div>
                </motion.div>
              ) : null}

              {scene === 2 ? (
                <motion.div
                  key="soon"
                  className="absolute inset-0 grid place-items-center bg-ng-forest-deep px-6 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.9 }}
                >
                  <Image
                    src="/images/hero/launch-groundnut-farm.b036d757.webp"
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover opacity-25"
                  />
                  <div className="relative">
                    <motion.div {...rise(0.3)} className="relative mx-auto aspect-[500/275] w-[min(46vw,200px)]">
                      <Image src="/brand/logo-stacked-light.png" alt="" fill sizes="200px" className="object-contain" />
                    </motion.div>
                    <motion.h1 {...rise(0.8)} className="mt-7 font-display text-[clamp(52px,11vw,132px)] leading-none text-ng-cream">
                      Coming soon
                    </motion.h1>
                    <motion.p {...rise(1.6)} className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-ng-cream/80">
                      Our store isn&rsquo;t open yet. We&rsquo;re getting the first harvest ready for you.
                    </motion.p>
                    <motion.button
                      {...rise(2.6)}
                      type="button"
                      onClick={close}
                      className="mt-8 min-h-12 rounded-full bg-ng-cream px-7 text-[14px] font-semibold text-ng-forest-deep cursor-pointer"
                    >
                      Look around the store
                    </motion.button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {canSkip && scene < 2 ? (
              <button
                type="button"
                onClick={close}
                className="absolute right-5 top-5 min-h-11 rounded-full px-4 text-[13px] font-semibold text-ng-ink-muted underline underline-offset-4 cursor-pointer"
              >
                Skip
              </button>
            ) : null}

            <motion.div
              aria-hidden
              className="absolute bottom-0 left-0 h-[3px] origin-left bg-ng-clay"
              style={{ width: "100%" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: DURATION_MS / 1000, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
