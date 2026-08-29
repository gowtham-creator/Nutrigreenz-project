import { cn } from "@/lib/utils";

/**
 * AppIcon — the imported Icons8 glyphs, rendered so they behave like the rest
 * of the icon system.
 *
 * ── Why a mask and not an <img> ───────────────────────────────────────────
 *
 * Everything else on the page draws through `<Icon>`, which renders inline SVG
 * and therefore inherits `currentColor` — that is how a trust badge turns
 * `text-ng-leaf` green, dims to muted inside a disabled card, or flips for a
 * dark surface. These arrived as flat black PNGs. Dropped in as `<img>` they
 * would be permanently black, ignore every colour token around them, and read
 * as pasted-in clip art the moment they sit beside a Solar icon.
 *
 * Painting them as a CSS mask fixes that completely: the PNG supplies only the
 * SHAPE, the colour comes from `background-color: currentColor`, and the glyph
 * then responds to text colour exactly like an SVG. It costs one div.
 *
 * The trade-off is that a mask throws away colour, so this is only for the
 * single-colour glyphs. `fresh-colour.png` is a full-colour illustration and
 * must be rendered as a real image instead — see {@link AppIconColour}.
 *
 * ── On sharpness ──────────────────────────────────────────────────────────
 *
 * These used to be the PNGs themselves, which topped out at 100px (60 for
 * some, 50 for others) and so held up to roughly 48px on a 2x screen and no
 * further. On a 3x phone the smaller ones were soft at ordinary badge sizes.
 *
 * They are now traced to SVG, so there is no ceiling: the mask is vector and
 * stays sharp at any size and any pixel density. The old advice to keep them
 * at or below 48px no longer applies.
 */

/**
 * The imported PRODUCT glyphs. Files live under `public/icons/app/`.
 *
 * Everything generic — lab, shipping, location, profile, freshness, farm —
 * moved elsewhere. What no general library carries is a honey jar or a
 * cold-pressed oil bottle, so those stay here. They are now vector too, so the
 * scaling argument that once favoured a general set no longer applies.
 *
 * `honey-colour` and `oil-colour` sit alongside as full illustrations. A mask
 * would flatten them to a silhouette, so anything using them needs a real
 * <Image>.
 */
export type AppIconName =
  | "honey"
  | "oil"
  | "groundnut"
  | "sesame"
  | "olive"
  | "mustard"
  | "coconut"
  /* Interface marks that no vector set carries in the form we want: a cart with
     the arrow dropping in, and a solid envelope. */
  | "cart-add"
  | "email"
  | "message";

interface AppIconProps {
  name: AppIconName;
  /** Rendered px. Vector source, so any size is sharp. */
  size?: number;
  className?: string;
  /** Decorative by default; pass a label when the icon is the only meaning. */
  label?: string;
}

export function AppIcon({ name, size = 22, className, label }: AppIconProps) {
  /*
   * SVG, not PNG.
   *
   * These were 50-100px PNGs used as masks, which is fine on a 1x display and
   * visibly soft on every retina one: a 22px icon needs 44 real pixels at 2x
   * and 66 at 3x, so a 60px source was already being stretched and a 50px one
   * badly. Nothing about upscaling the PNGs would have helped — interpolating
   * a raster adds pixels, not detail.
   *
   * Traced to vector instead, so the same mask is now resolution-independent
   * and sharp at any size or density. The mask contract is unchanged: colour
   * still comes from `bg-current`, the file supplies only the shape.
   */
  const url = `url(/icons/app/${name}.svg)`;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
