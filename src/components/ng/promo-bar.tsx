"use client";

import { useEffect, useState } from "react";

/**
 * PromoBar — the storefront top announcement marquee.
 *
 * Live promotion lines (marigold) scroll first, then the admin-managed evergreen
 * notices. BOTH sets are fetched in PARALLEL and committed in ONE state update so
 * the marquee builds its scrolling track exactly once — the earlier version set
 * two separate states, rebuilding the track mid-animation, which showed up as a
 * stutter/freeze. The bar reserves its height while the fetch is in flight, so
 * the lines arriving causes no layout shift.
 */
export function PromoBar() {
  const [items, setItems] = useState<{ text: string; promo: boolean }[] | null>(null);

  useEffect(() => {
    let alive = true;
    const grab = async (url: string): Promise<string[]> => {
      try {
        const r = await fetch(url);
        if (!r.ok) return [];
        const d = await r.json();
        return Array.isArray(d?.messages) ? (d.messages as string[]) : [];
      } catch {
        return [];
      }
    };
    void Promise.all([grab("/api/promotions/messages"), grab("/api/announcements")]).then(
      ([promo, evergreen]) => {
        if (!alive) return;
        setItems([
          ...promo.map((text) => ({ text, promo: true })),
          ...evergreen.map((text) => ({ text, promo: false })),
        ]);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const list = items ?? [];
  // Two identical copies → the track animates by -50% for a seamless loop.
  const loop = [...list, ...list];

  return (
    <div className="bg-ng-forest-deep text-ng-paper py-2 overflow-hidden">
      {/* Fixed height reserves the bar so nothing shifts before the lines load. */}
      <div className="marquee h-[18px]">
        {list.length > 0 ? (
          <div className="marquee__track font-sans text-[12px] font-medium uppercase tracking-[0.12em]">
            {loop.map((it, i) => (
              <span key={i} className="marquee__item" aria-hidden={i >= list.length}>
                <span aria-hidden className={it.promo ? "text-ng-amber" : "text-ng-clay"}>
                  ◆
                </span>
                <span className={it.promo ? "font-bold text-ng-amber" : undefined}>{it.text}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
