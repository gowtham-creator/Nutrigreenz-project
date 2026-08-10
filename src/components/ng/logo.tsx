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

/**
 * The trademark symbol shown beside the lockup.
 *
 * ™, not ®, and the difference is not cosmetic. ® asserts a REGISTERED mark,
 * and under s.107 of the Trade Marks Act 1999 using it on a mark that is not
 * registered in India is an offence carrying a fine and up to three years.
 * ™ carries no such condition — it may be used on a pending or unregistered
 * mark — so it is the safe symbol until the registration certificate exists.
 *
 * When the registration is granted this becomes "®" and every surface follows,
 * because it is rendered here rather than baked into the artwork.
 *
 * NOTE: the bottle labels already print ®. If the mark is not yet registered
 * that is the artwork that needs correcting, not this.
 */
const TRADEMARK = "™";

interface LogoProps {
  className?: string;
  variant?: Variant;
  tone?: Tone;
  priority?: boolean;
  /**
   * Set false where the lockup is decorative and the mark is already asserted
   * nearby — repeating it in a footer that also carries the legal line just
   * adds visual noise.
   */
  showTrademark?: boolean;
}

export function Logo({
  className,
  variant = "full",
  tone = "default",
  priority,
  showTrademark = true,
}: LogoProps) {
  const a = ASSETS[variant];
  const src = tone === "white" ? a.light : a.color;

  const image = (
    <Image
      src={src}
      alt="Nutri Greenz"
      width={a.w}
      height={a.h}
      priority={priority}
      className={cn(a.base, "w-auto object-contain", className)}
    />
  );

  if (!showTrademark) return image;

  /*
   * Rendered as live text rather than burnt into the six PNGs: it stays sharp
   * at any size, inherits the surrounding colour so the cream knockout needs no
   * second asset, and switching to ® later is one character here instead of a
   * re-export of every file.
   *
   * aria-hidden because the symbol is legal notice to a reader, not information
   * to a listener — the image already announces "Nutri Greenz", and a screen
   * reader saying "trade mark" after every header logo is noise.
   */
  return (
    <span className="relative inline-flex shrink-0 items-start">
      {image}
      <span
        aria-hidden="true"
        className={cn(
          "ml-[0.15em] select-none text-[0.5em] font-medium leading-none",
          tone === "white" ? "text-ng-paper/70" : "text-ng-forest/55",
        )}
      >
        {TRADEMARK}
      </span>
    </span>
  );
}
