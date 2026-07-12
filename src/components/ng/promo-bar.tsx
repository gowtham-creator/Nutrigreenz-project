"use client";

import { useEffect, useState } from "react";

/**
 * PromoBar — the storefront top announcement marquee.
 *
 * Any LIVE occasion/seasonal sale is shown FIRST (in a warm marigold accent so
 * the discount pops), then the admin-managed evergreen notices (shipping /
 * membership / new-arrival lines). Both sets are fetched on mount — the live
 * lines from /api/promotions/messages and the evergreen lines from
 * /api/announcements — so the bar works on every page (including the
 * client-rendered checkout/auth shells) and updates within seconds of an
 * operator editing either surface in admin. If a fetch fails or returns nothing,
 * that set simply contributes no lines (the promos still show).
 */
export function PromoBar() {
  const [promo, setPromo] = useState<string[]>([]);
  const [evergreen, setEvergreen] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const pull = (url: string, apply: (messages: string[]) => void) => {
      fetch(url)
        .then((r) => (r.ok ? r.json() : { messages: [] }))
        .then((d) => {
          if (alive && Array.isArray(d?.messages)) apply(d.messages as string[]);
        })
        .catch(() => {});
    };
    pull("/api/promotions/messages", setPromo);
    pull("/api/announcements", setEvergreen);
    return () => {
      alive = false;
    };
  }, []);

  const items = [
    ...promo.map((text) => ({ text, promo: true })),
    ...evergreen.map((text) => ({ text, promo: false })),
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
