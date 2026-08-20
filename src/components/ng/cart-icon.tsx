import { cn } from "@/lib/utils";

/**
 * Brand cart glyph (client-supplied Icons8 mark).
 *
 * This used to ship as two 30x30 PNGs — a dark one and a white one — because a
 * raster cannot recolour from `currentColor`. Two problems came with that. The
 * glyph is drawn at 42px in the empty-bag state and larger again on retina, so
 * a 30px source was being upscaled roughly 3x and looked visibly soft. And
 * every surface had to know which of the two files it wanted.
 *
 * It is a traced vector now, painted as a MASK over `bg-current`, exactly like
 * the rest of the supplied icon set. That makes it sharp at any size on any
 * display and lets it inherit the surrounding text colour.
 *
 * `tone` is kept so existing call sites do not change meaning: it now maps to a
 * colour class rather than to a different file. Passing neither leaves the
 * glyph on `currentColor`, which is what most surfaces want.
 */
export function CartIcon({
  size = 18,
  tone,
  className,
}: {
  size?: number;
  tone?: "dark" | "white";
  className?: string;
}) {
  const url = "url(/icons/ui/cart.svg)";
  return (
    <span
      aria-hidden
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
      className={cn(
        "inline-block shrink-0 bg-current",
        tone === "white" && "text-ng-cream",
        tone === "dark" && "text-ng-forest-deep",
        className,
      )}
    />
  );
}
