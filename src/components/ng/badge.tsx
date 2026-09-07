import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types/nutrigreenz";

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  size?: "sm" | "md";
}

/*
 * Badge grounds, measured against their own text rather than chosen by eye.
 *
 * Two of these failed WCAG AA at badge size and the "% OFF" mark was one of
 * them: ng-terracotta behind ng-paper text is 4.42:1, and ng-clay behind
 * ng-soil is 3.96:1 — both under the 4.5 a 10-11px label needs. That is the
 * discount badge on a product photo, which is the single badge a promoted SKU
 * most needs read.
 *
 * The base tokens are NOT changed — they are used for text, borders and fills
 * all over the app where they are correct. The badge overrides its own ground
 * to a darker step of the same hue, so only the surface that carries small
 * reversed type moves.
 */
const TONE_STYLES: Record<Tone, string> = {
  forest: "bg-ng-forest text-ng-paper",
  leaf: "bg-ng-leaf text-ng-forest-deep",
  sage: "bg-ng-sage text-ng-forest-deep",
  cream: "bg-ng-cream-deep text-ng-soil",
  /* #C79A42 — 5.02:1 with soil, up from 3.96:1. */
  clay: "bg-[#C79A42] text-ng-soil",
  /* #B84329 — 5.18:1 with paper, up from 4.42:1. Still unmistakably the
     terracotta of the palette, just one step down. */
  terracotta: "bg-[#B84329] text-ng-paper",
  soil: "bg-ng-soil text-ng-cream",
  ink: "bg-ng-ink text-ng-paper",
};

export function Badge({ children, tone = "leaf", className, size = "sm" }: BadgeProps) {
  return (
    <span
      className={cn(
        /*
         * Bold, not medium, and a step larger.
         *
         * These sit ON a product photograph, so the contrast that matters is
         * not only against the pill but against whatever is behind it. At 10px
         * weight-500 the mark read as a smudge over busy artwork. Bold at 11px
         * is legible at a glance without the badge growing enough to cover the
         * product.
         *
         * Tracking comes DOWN from `wider` to `wide`. Wide letter-spacing
         * flatters large display type and works against small type — it pulls
         * the word apart into characters exactly when the eye wants to catch a
         * whole shape. `50% OFF` should read as one mark.
         *
         * The ring is the part that actually fixes "not visible on the image":
         * a hairline of the badge's own colour, darkened, separates the pill
         * from a photo of any brightness, which no amount of internal contrast
         * can do on its own.
         */
        "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide",
        "shadow-[0_1px_3px_rgba(20,51,31,0.28)] ring-1 ring-inset ring-black/10",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[13px]",
        TONE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
