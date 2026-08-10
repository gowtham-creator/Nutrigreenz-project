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
 * The sources top out at 100px (60 for profile, 50 for location), so they hold
 * up to roughly 48px on a 2x screen and no further. That covers every badge and
 * chip we use them in. Anything larger — a hero mark, a print asset — needs
 * vector art, not these.
 */

/** The imported glyphs. Filenames live under `public/icons/app/`. */
export type AppIconName = "location" | "profile" | "fresh" | "lab" | "shipping-free";

interface AppIconProps {
  name: AppIconName;
  /** Rendered px. Keep at or below 48 — see the note on sharpness above. */
  size?: number;
  className?: string;
  /** Decorative by default; pass a label when the icon is the only meaning. */
  label?: string;
}

export function AppIcon({ name, size = 22, className, label }: AppIconProps) {
  const url = `url(/icons/app/${name}.png)`;
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
