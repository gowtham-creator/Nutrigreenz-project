"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform, useVelocity } from "framer-motion";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { useScrollChrome } from "@/lib/use-scroll-chrome";
import { useIsOperator } from "@/lib/operator-surface";
import { cn } from "@/lib/utils";

/**
 * App-style tab bar for phones and tablets, in the manner of iOS's Liquid Glass
 * tab bars: a floating frosted capsule in the store's cream, with a green glass
 * pill that slides to the selected tab.
 *
 * - Touch a tab and the pill moves at once, stretching with its speed and
 *   settling like a drop of liquid; each icon turns cream as the pill passes
 *   under it, so the highlight never runs ahead of the pill.
 * - Press and slide along the bar: the pill follows the thumb, swelling a
 *   little like a lens, and lifting off opens the tab underneath.
 * - The pill is the deep green of the groundnut oil label (#1E4A33) with cream
 *   on it, like the label itself.
 * - Slides away while scrolling down and returns on any scroll up.
 *
 * Hidden where the page has its own bottom bar or none belongs: product pages
 * (their Add to cart bar), the cart and checkout, sign-in, and the admin and
 * captain apps. A spacer of the same height keeps the footer clear of it.
 */
const HIDDEN = /^\/(products|cart|checkout|auth|admin|captain|unsubscribe|r)(\/|$)/;

/** Cream on the label-green pill. */
const ON_PILL = "#F5F1E6";

/** Movement before a press becomes a slide rather than a tap. */
const SLIDE_THRESHOLD_PX = 8;

/** The owner's filled icons, used as masks so they take the tab's colour. */
function TabIcon({ src }: { src: string }) {
  return (
    <span
      aria-hidden
      className="block size-[22px] bg-current"
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

interface Slot {
  x: number;
  w: number;
}

function buzz() {
  try {
    navigator.vibrate?.(6);
  } catch {
    /* No haptics here (iOS Safari ignores vibrate). */
  }
}

export function BottomTabs() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { count: saved } = useWishlist();
  const { isAuthed } = useAuth();
  const { hidden } = useScrollChrome();
  const operator = useIsOperator();
  const reduce = useReducedMotion();

  const tabs = [
    { href: "/", match: "/", label: "Home", icon: "/images/tabs/home.png" },
    { href: isAuthed ? "/shop" : "/auth?next=/shop", match: "/shop", label: "Shop", icon: "/images/tabs/shop.png" },
    { href: "/wishlist", match: "/wishlist", label: "Wishlist", icon: "/icons/ui/wishlist.svg", badge: saved },
    {
      href: isAuthed ? "/account" : "/auth?next=/account",
      match: "/account",
      label: "Profile",
      icon: "/images/tabs/profile.png",
    },
  ];
  const isActive = (m: string) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`));
  const routeIndex = tabs.findIndex((t) => isActive(t.match));

  // The tab just chosen, shown at once while the page loads; it gives way to
  // the route as soon as the address changes.
  const [picked, setPicked] = useState<{ index: number; from: string } | null>(null);
  const selected = picked && picked.from === pathname ? picked.index : routeIndex;

  /* ── Geometry ─────────────────────────────────────────────────────────── */
  const listRef = useRef<HTMLUListElement>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setSlots(
      [...list.children].map((el) => {
        const li = el as HTMLElement;
        return { x: li.offsetLeft, w: li.offsetWidth };
      }),
    );
  }, []);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  /* ── Press and slide ──────────────────────────────────────────────────── */
  const press = useRef<{ startX: number; pointerId: number; sliding: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [dragX, setDragX] = useState<number | null>(null);
  // The tab under a finger that has just touched down: the pill heads there
  // straight away instead of waiting for the finger to lift.
  const [pressIndex, setPressIndex] = useState<number | null>(null);

  const nearest = useCallback(
    (x: number) => {
      let best = 0;
      let bestD = Infinity;
      slots.forEach((s, i) => {
        const d = Math.abs(s.x + s.w / 2 - x);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    },
    [slots],
  );

  /* ── The pill ─────────────────────────────────────────────────────────── */
  const pillInset = 4;
  const slotW = slots[0]?.w ?? 0;
  const pillW = Math.max(0, slotW - pillInset * 2);
  const target = (() => {
    if (!slots.length) return null;
    if (dragX !== null) {
      const first = slots[0].x + pillInset;
      const last = slots[slots.length - 1].x + pillInset;
      return Math.min(last, Math.max(first, dragX - pillW / 2));
    }
    const at = pressIndex ?? selected;
    if (at < 0) return null;
    return slots[at].x + pillInset;
  })();

  // Quick and a touch springy, so it feels like it answers the finger; while
  // sliding it tracks the thumb almost exactly.
  const spring = reduce
    ? { stiffness: 2000, damping: 200, mass: 0.2 }
    : dragX !== null
      ? { stiffness: 1400, damping: 70, mass: 0.25 }
      : { stiffness: 560, damping: 38, mass: 0.55 };
  const x = useSpring(0, spring);
  // Liquid: the pill stretches along its path in proportion to its speed and
  // narrows a touch, then relaxes back into shape as it settles.
  const velocity = useVelocity(x);
  const scaleX = useTransform(velocity, [-3200, 0, 3200], reduce ? [1, 1, 1] : [1.22, 1, 1.22], { clamp: true });
  const scaleY = useTransform(velocity, [-3200, 0, 3200], reduce ? [1, 1, 1] : [0.92, 1, 0.92], { clamp: true });

  // Which tab the pill is over right now, read from where it actually is.
  const [over, setOver] = useState<number | null>(null);
  useMotionValueEvent(x, "change", (v) => {
    if (!slots.length) return;
    const i = nearest(v + pillW / 2);
    setOver((prev) => (prev === i ? prev : i));
  });
  const lit = target === null ? -1 : (over ?? (pressIndex ?? selected));
  const placed = useRef(false);
  useEffect(() => {
    if (target === null) return;
    if (!placed.current) {
      // First placement lands without a slide in from the left edge.
      x.jump(target);
      placed.current = true;
    } else {
      x.set(target);
    }
  }, [target, x]);

  if (HIDDEN.test(pathname) || operator) return null;

  const choose = (index: number) => {
    setPicked({ index, from: pathname });
    setPressIndex(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    press.current = { startX: e.clientX, pointerId: e.pointerId, sliding: false };
    const list = listRef.current;
    if (!list || !slots.length) return;
    const index = nearest(e.clientX - list.getBoundingClientRect().left);
    if (index !== selected) buzz();
    setPressIndex(index);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const p = press.current;
    const list = listRef.current;
    if (!p || !list) return;
    if (!p.sliding) {
      if (Math.abs(e.clientX - p.startX) < SLIDE_THRESHOLD_PX) return;
      p.sliding = true;
      try {
        list.setPointerCapture(p.pointerId);
      } catch {
        /* The pointer already left; the slide still works. */
      }
    }
    const left = list.getBoundingClientRect().left;
    const next = e.clientX - left;
    const before = dragX !== null ? nearest(dragX) : selected;
    if (nearest(next) !== before) buzz();
    setDragX(next);
  };
  const endPress = (commit: boolean) => {
    const p = press.current;
    press.current = null;
    if (!p?.sliding) {
      // A tap: the link's click (which fires next) records the choice. If the
      // finger lifted somewhere else, the pill goes home.
      window.setTimeout(() => setPressIndex(null), 400);
      if (!commit) setPressIndex(null);
      return;
    }
    // The link under the finger would also receive this as a click.
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 350);
    if (commit && dragX !== null) {
      const index = nearest(dragX);
      setPicked({ index, from: pathname });
      if (index !== routeIndex) router.push(tabs[index].href);
    }
    setPressIndex(null);
    setDragX(null);
  };

  return (
    <>
      <div aria-hidden className="ng-store-only lg:hidden h-[calc(84px+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Main"
        className={cn(
          "ng-store-only lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3",
          "pb-[calc(env(safe-area-inset-bottom)+10px)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          hidden ? "translate-y-[calc(100%+12px)]" : "translate-y-0",
        )}
      >
        {/* The glass: the store's cream, frosted, with a light catching the top
            edge and a soft contact shadow underneath. */}
        <div
          className={cn(
            "pointer-events-auto relative mx-auto h-[66px] max-w-md rounded-[33px] p-1",
            "bg-ng-paper/80 backdrop-blur-2xl backdrop-saturate-[1.8]",
            "border border-white/70 ring-1 ring-[rgba(30,74,51,0.08)]",
            "shadow-[0_14px_34px_-14px_rgba(16,40,24,0.45),0_2px_6px_-2px_rgba(16,40,24,0.12),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(30,74,51,0.06)]",
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          />

          <ul
            ref={listRef}
            className="relative grid h-full touch-none select-none grid-cols-4"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => endPress(true)}
            onPointerCancel={() => endPress(false)}
            onClickCapture={(e) => {
              if (swallowClick.current) {
                e.preventDefault();
                e.stopPropagation();
                swallowClick.current = false;
              }
            }}
          >
            {/* The pill: label-green glass. It sits behind the tabs. */}
            {target !== null && pillW > 0 ? (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-0"
                style={{ x, width: pillW, scaleX, scaleY }}
              >
                <motion.span
                  className="block h-full w-full rounded-[28px]"
                  initial={false}
                  animate={{ scale: dragX !== null ? 1.08 : pressIndex !== null ? 0.97 : 1 }}
                  transition={{ type: "spring", stiffness: 700, damping: 32 }}
                  style={{
                    // Deep label green, a little clearer while it is being
                    // slid, like a lens lifted off the glass.
                    background:
                      dragX !== null
                        ? "linear-gradient(180deg, rgba(46,104,73,0.82) 0%, rgba(30,74,51,0.86) 100%)"
                        : "linear-gradient(180deg, #2A5E42 0%, #1E4A33 55%, #17402B 100%)",
                    border: "1px solid rgba(23,64,43,0.9)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 4px rgba(0,0,0,0.18), 0 8px 18px -8px rgba(23,64,43,0.7)",
                  }}
                />
              </motion.span>
            ) : null}

            {tabs.map((t, i) => {
              const on = i === lit;
              return (
                <li key={t.label} className="relative z-10 flex">
                  <Link
                    href={t.href}
                    aria-current={i === routeIndex ? "page" : undefined}
                    onClick={() => choose(i)}
                    draggable={false}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-0.5 rounded-[28px] text-[11.5px] font-semibold",
                      "[-webkit-tap-highlight-color:transparent] outline-none transition-colors duration-150",
                      "focus-visible:ring-2 focus-visible:ring-[rgba(30,74,51,0.45)]",
                      !on && "text-ng-ink-muted",
                    )}
                    style={on ? { color: ON_PILL } : undefined}
                  >
                    <span className="relative grid h-7 w-10 place-items-center">
                      <TabIcon src={t.icon} />
                      {t.badge ? (
                        <span className="absolute -top-1 right-0 min-w-4 h-4 px-1 rounded-full bg-ng-clay-deep text-ng-paper text-[10px] font-semibold inline-flex items-center justify-center">
                          {t.badge > 99 ? "99+" : t.badge}
                        </span>
                      ) : null}
                    </span>
                    <span>{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
