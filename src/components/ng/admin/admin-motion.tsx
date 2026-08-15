"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Entry motion for operator dashboards.
 *
 * ── Why this exists when `components/ng/motion.tsx` already does ──────────
 *
 * The storefront's `Reveal` / `Stagger` are tuned for a marketing page: 16–24px
 * of travel, a long duration, `whileInView` so a section animates as it is
 * scrolled to. On a dashboard that is wrong in three ways. An operator is not
 * browsing, they are looking for a number; a card that slides 24px is a card
 * whose value cannot be read for 600ms. And `whileInView` means a figure that
 * is already on screen animates again on every navigation back.
 *
 * So: short travel (8px), quick spring, once on mount, and a stagger tight
 * enough to read as one gesture rather than a queue. The point is to lead the
 * eye left-to-right across a row of tiles in the order the data should be read,
 * not to make an entrance.
 *
 * ── Reduced motion ────────────────────────────────────────────────────────
 *
 * Honoured properly rather than by shortening the duration: with
 * `prefers-reduced-motion` set, the children render at their final position
 * with no transform at all. A vestibular trigger is not fixed by making the
 * same movement faster.
 */

const EASE_SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 };

export function AdminStagger({
  children,
  className,
  /** Seconds between each child. Small — this is rhythm, not a queue. */
  step = 0.05,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: step } } }}
    >
      {children}
    </motion.div>
  );
}

export function AdminStaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        shown: { opacity: 1, y: 0, transition: EASE_SPRING },
      }}
    >
      {children}
    </motion.div>
  );
}
