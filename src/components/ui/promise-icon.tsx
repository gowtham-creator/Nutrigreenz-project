import { cn } from "@/lib/utils";

/**
 * PromiseIcon — the four large marks in the "Why choose Nutri Greenz" row.
 *
 * ── Why these are masks and not <img> ─────────────────────────────────────
 *
 * They arrived as flat black PNGs, which cannot take a colour: dropped in as
 * images they would be black on a cream band no matter what the surrounding
 * text does. Painted as CSS masks over `bg-current`, the shape comes from the
 * file and the colour from `currentColor`, exactly like {@link AppIcon} does
 * for the produce glyphs.
 *
 * ── Why they were vectorised first ────────────────────────────────────────
 *
 * The supplied files were 96, 80, 64 and 80 pixels square. This row draws them
 * at 64 CSS pixels, which is 128 device pixels on any retina display — so
 * three of the four were being asked to cover roughly twice the pixels they
 * contained, and the softness that produces is exactly what "resize these for
 * better quality" was asking about. Upscaling a raster cannot fix that; there
 * is no detail in the file to enlarge.
 *
 * So the alpha channel of each was interpolated up 8x and traced to outlines
 * with potrace (see `scripts/trace-promise-icons.mjs`). The tracer follows the
 * pixel boundary, so tracing the small bitmaps directly would have produced
 * visibly stepped curves; interpolating first puts sub-pixel information along
 * the edge for it to follow. The result is real vector art that is sharp at
 * any size and on any display, which no version of the PNGs could be.
 *
 * Source: Icons8. Credited on /policies/attributions along with the rest.
 */

const PROMISE_ICONS = {
  tree: "tree",
  press: "press",
  verified: "verified",
  tractor: "tractor",
} as const;

export type PromiseIconName = keyof typeof PROMISE_ICONS;

export function PromiseIcon({
  name,
  size = 64,
  className,
}: {
  name: PromiseIconName;
  size?: number;
  className?: string;
}) {
  const url = `url(/icons/promise/${PROMISE_ICONS[name]}.svg)`;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
