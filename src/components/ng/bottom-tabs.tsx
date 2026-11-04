"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { useScrollChrome } from "@/lib/use-scroll-chrome";
import { useIsOperator } from "@/lib/operator-surface";
import { cn } from "@/lib/utils";

/**
 * App-style tab bar for phones and tablets, in the manner of iOS's Liquid Glass
 * tab bars: a floating frosted capsule in the store's cream, with a pill in the
 * deep green of the groundnut oil label (#1E4A33) that slides to the chosen tab.
 *
 * - Touch a tab and the pill sets off at once: a spring-like glide with a small
 *   overshoot and a brief liquid stretch, while the icons cross-fade to cream.
 * - Press and slide along the bar: the pill follows the thumb like a lens, and
 *   lifting off opens the tab underneath.
 * - Slides away while scrolling down and returns on scrolling up.
 *
 * Smoothness: the pill moves with CSS transforms, which the browser runs on the
 * compositor. A JavaScript-driven spring stalled while the next page was being
 * built after a tap; this keeps gliding regardless.
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
      [...list.children]
        .filter((el) => el.tagName === "LI")
        .map((el) => {
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
  const pillW = Math.max(0, (slots[0]?.w ?? 0) - pillInset * 2);
  const restIndex = pressIndex ?? selected;
  const dragging = dragX !== null;
  const pillX = (() => {
    if (!slots.length) return null;
    if (dragging) {
      const first = slots[0].x + pillInset;
      const last = slots[slots.length - 1].x + pillInset;
      return Math.min(last, Math.max(first, dragX - pillW / 2));
    }
    return restIndex >= 0 ? slots[restIndex].x + pillInset : null;
  })();
  const litIndex = dragging ? nearest(dragX) : restIndex;

  // Each time the pill sets off for a new tab, restart its liquid stretch.
  const [moves, setMoves] = useState({ index: restIndex, count: 0 });
  if (!dragging && restIndex !== moves.index) setMoves({ index: restIndex, count: moves.count + 1 });

  // The first placement lands without a glide in from the left edge.
  const [placed, setPlaced] = useState(false);
  if (pillX !== null && !placed) setPlaced(true);
  const firstFrame = pillX !== null && !placed;

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
    const next = e.clientX - list.getBoundingClientRect().left;
    if (dragX !== null && nearest(next) !== nearest(dragX)) buzz();
    setDragX(next);
  };
  const endPress = (commit: boolean) => {
    const p = press.current;
    press.current = null;
    if (!p?.sliding) {
      // A tap: the link's click (which fires next) records the choice. If the
      // finger lifted somewhere else, the pill goes home.
      if (!commit) setPressIndex(null);
      else window.setTimeout(() => setPressIndex(null), 400);
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
          "transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
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
            {/* The pill: deep label-green glass behind the tabs. The outer
                layer glides (compositor transform); the inner layer stretches
                and presses. */}
            {pillX !== null && pillW > 0 ? (
              <span
                aria-hidden
                className="ng-pill-track pointer-events-none absolute inset-y-0 left-0 z-0 will-change-transform"
                style={{
                  width: pillW,
                  transform: `translate3d(${pillX}px,0,0)`,
                  transition: dragging || firstFrame ? "none" : undefined,
                }}
              >
                <span
                  key={moves.count}
                  className={cn("ng-pill block h-full w-full", moves.count > 0 && !dragging && "ng-pill-stretch")}
                  data-lens={dragging ? "" : undefined}
                  data-pressed={pressIndex !== null && !dragging ? "" : undefined}
                />
              </span>
            ) : null}

            {tabs.map((t, i) => {
              const on = i === litIndex;
              return (
                <li key={t.label} className="relative z-10 flex">
                  <Link
                    href={t.href}
                    aria-current={i === routeIndex ? "page" : undefined}
                    onClick={() => choose(i)}
                    draggable={false}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-0.5 rounded-[28px] text-[11.5px] font-semibold",
                      "[-webkit-tap-highlight-color:transparent] outline-none",
                      "transition-[color] duration-300 ease-out motion-reduce:transition-none",
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
