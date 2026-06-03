"use client";

import { motion, useScroll, useTransform, useReducedMotion, type MotionProps, type Variants } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveal — fade + lift on enter viewport. Respect `prefers-reduced-motion` via framer-motion automatic detection.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  once = true,
  as: As = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
  as?: keyof typeof motion | "div" | "section" | "article" | "h1" | "h2" | "h3" | "p";
}) {
  const MotionTag = motion[As as keyof typeof motion] as typeof motion.div;
  const reduce = useReducedMotion();
  return (
    <MotionTag
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.05, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Stagger — wrap children that each get a staggered reveal.
 * Use with <StaggerItem> children.
 */
const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};
/* Reduced-motion variant: fade only, no slide. */
const staggerItemReduced: Variants = {
  hidden: { opacity: 0, y: 0 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  /** Accepted for API compatibility; the cascade now runs on mount. */
  once?: boolean;
}) {
  // Trigger the cascade on mount via `animate` rather than `whileInView`.
  // In this framer-motion + React 19 build, whileInView variant propagation
  // to children was intermittently failing and leaving StaggerItem content
  // stuck at the hidden (opacity:0) state. Mount-triggering guarantees the
  // children always become visible while preserving the staggered reveal.
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}
export function StaggerItem({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & MotionProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={reduce ? staggerItemReduced : staggerItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Parallax — scroll-linked Y translation. Slower than scroll for background elements.
 */
export function Parallax({
  children,
  className,
  speed = 0.3,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // Hooks must run unconditionally; gate the *output* on the motion preference.
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -120 * speed]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * FloatIn — subtle continuous float for hero / featured elements.
 */
export function FloatIn({
  children,
  className,
  delay = 0,
}: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) {
    // Opacity-only entrance, no transform; static wrapper (no infinite bob).
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
        className={className}
      >
        <div className="h-full w-full">{children}</div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
      className={cn("will-change-transform", className)}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity, delay }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * MagneticHover — light cursor-tracking lift for premium CTAs.
 */
export function MagneticHover({
  children,
  className,
  strength = 8,
}: { children: ReactNode; className?: string; strength?: number }) {
  return (
    <motion.div
      whileHover={{ y: -strength * 0.25, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.div>
  );
}
