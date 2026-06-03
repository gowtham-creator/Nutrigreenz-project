import Image from "next/image";
import { cn } from "@/lib/utils";

type Variant = "full" | "mark" | "wordmark";
type Tone = "default" | "white" | "forest";

/**
 * Brand logo — uses the client-supplied Nutri Greenz assets in /public/brand.
 * - `full`     → horizontal lockup (mark + wordmark + tagline)  → storefront header
 * - `mark`     → N-with-leaf icon only                          → admin / favicon / compact
 * - `wordmark` → wordmark + tagline                             → footer / secondary
 * `tone="white"` swaps to the cream knockout for dark backgrounds.
 */
const ASSETS: Record<Variant, { color: string; light: string; w: number; h: number; base: string }> = {
  full: { color: "/brand/logo-horizontal.png", light: "/brand/logo-horizontal-light.png", w: 1289, h: 259, base: "h-9" },
  mark: { color: "/brand/logo-mark.png", light: "/brand/logo-mark-light.png", w: 508, h: 469, base: "h-9" },
  wordmark: { color: "/brand/logo-wordmark.png", light: "/brand/logo-wordmark-light.png", w: 1282, h: 220, base: "h-6" },
};

interface LogoProps {
  className?: string;
  variant?: Variant;
  tone?: Tone;
  priority?: boolean;
}

export function Logo({ className, variant = "full", tone = "default", priority }: LogoProps) {
  const a = ASSETS[variant];
  const src = tone === "white" ? a.light : a.color;
  return (
    <Image
      src={src}
      alt="Nutri Greenz"
      width={a.w}
      height={a.h}
      priority={priority}
      className={cn(a.base, "w-auto object-contain", className)}
    />
  );
}
