"use client";

import { useEffect, useState } from "react";

/** Evergreen notices that always scroll in the top bar. */
const BASE_MESSAGES = [
  "Free shipping on orders over ₹599 · Across India",
  "New arrivals · Anantapur cold-pressed groundnut oil — now in 1L glass",
  "Members get 5% back on every order · Join free",
];

/**
 * PromoBar — the storefront top announcement marquee.
 *
 * Any LIVE occasion/seasonal sale is shown FIRST (in a warm marigold accent so
 * the discount pops), then the evergreen shipping/membership notes. The live
 * lines are fetched on mount from /api/promotions/messages so the bar works on
 * every page (including the client-rendered checkout/auth shells) and updates
 * within seconds of a promo being toggled in admin.
 */
export function PromoBar() {
  const [promo, setPromo] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/promotions/messages")
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => {
        if (alive && Array.isArray(d?.messages)) setPromo(d.messages as string[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const items = [
    ...promo.map((text) => ({ text, promo: true })),
    ...BASE_MESSAGES.map((text) => ({ text, promo: false })),
  ];
  // Two identical copies → the marquee track animates by -50% for a seamless,
  // continuous left-scrolling loop.
  const loop = [...items, ...items];

  return (
    <div className="bg-ng-forest-deep text-ng-paper py-2 overflow-hidden">
      <div className="marquee">
        <div className="marquee__track font-sans text-[12px] font-medium uppercase tracking-[0.12em]">
          {loop.map((it, i) => (
            <span key={i} className="marquee__item" aria-hidden={i >= items.length}>
              <span aria-hidden className={it.promo ? "text-ng-amber" : "text-ng-clay"}>
                ◆
              </span>
              <span className={it.promo ? "font-bold text-ng-amber" : undefined}>{it.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
