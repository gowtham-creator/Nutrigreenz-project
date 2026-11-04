"use client";

import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * A thin track under a swipeable row showing how far along it you are, like a
 * shopping app's product carousels. Hidden when everything already fits.
 */
export function ScrollProgress({
  target,
  className,
}: {
  target: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [bar, setBar] = useState({ width: 1, left: 0 });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const max = el.scrollWidth - el.clientWidth;
      const width = el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1;
      const left = max > 0 ? (el.scrollLeft / max) * (1 - width) : 0;
      setBar((b) => (Math.abs(b.width - width) < 0.005 && Math.abs(b.left - left) < 0.005 ? b : { width, left }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    el.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    schedule();
    return () => {
      el.removeEventListener("scroll", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target]);

  if (bar.width >= 0.999) return <span className={cn("flex-1", className)} aria-hidden />;
  return (
    <span aria-hidden className={cn("relative h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-ng-line", className)}>
      <span
        className="absolute inset-y-0 rounded-full bg-ng-forest-deep transition-[left] duration-150"
        style={{ width: `${bar.width * 100}%`, left: `${bar.left * 100}%` }}
      />
    </span>
  );
}
