import type { CSSProperties } from "react";

/**
 * BotanicalField — the engraved groundnut plant that frames the two
 * photo-card bands.
 *
 * ── Why an engraving, and why this one ────────────────────────────────────
 *
 * This used to be a hand-coded sprig tiled across the band. At any size it
 * read as a doodle, and a tiled repeat is the first thing the eye finds. The
 * art here is the Arachis hypogaea plate from Vilmorin-Andrieux, "Les Plantes
 * Potagères" (Paris, 1904): a real wood engraving, in the public domain, and
 * the same plate the oil labels use — so the site and the bottle share one
 * botanical hand. Provenance and the tracing method are in
 * nutrigreenz-packaging/20_assets/botanical/vector/SOURCE.md.
 *
 * ── How it is drawn ───────────────────────────────────────────────────────
 *
 * Each figure is a single-path SVG used as a CSS mask over a flat `color`, so
 * one file serves the sage band and the cream one without a tinted copy per
 * band. The plant is placed once on each side and large, rather than tiled
 * small: the plate was engraved for reproduction at roughly 12 cm, and below
 * about a third of that the hatching closes up into a smudge. The plate's pod
 * studies were tried here too and read as exactly that — foliage survives
 * being a faint background, pods do not.
 *
 * The far plant is mirrored and set at a different scale and height, so the
 * pair frames the heading like a plate border instead of stamping the same
 * shape twice. The field fades toward the middle so the foliage dresses the
 * margins and never sits under the heading. Decorative only — `aria-hidden`,
 * and always beneath the content layer.
 */

/* Content-hashed name (first 8 hex of its sha256). Cloudflare sits in front of
   Vercel and caches /images/* at the edge — 404s included — so a file that is
   added or changed needs a URL the edge has never seen, not a purge. Change the
   artwork, rename the file to its new hash. */
const PLANT = "/images/botanical/groundnut-plant.9daf8ab6.svg";
// The traced artwork's own viewBox, so the mask never letterboxes.
const PLANT_RATIO = "412.25 / 357.36";

function Plant({ color, style }: { color: string; style: CSSProperties }) {
  const mask = `url(${PLANT}) center / contain no-repeat`;
  return (
    <span
      className="absolute block"
      style={{ aspectRatio: PLANT_RATIO, backgroundColor: color, mask, WebkitMask: mask, ...style }}
    />
  );
}

/* Clear through the middle, where the heading sits; full strength at the edges. */
const EDGE_FADE =
  "linear-gradient(90deg, #000 0%, rgba(0,0,0,.9) 12%, transparent 36%, transparent 64%, rgba(0,0,0,.9) 88%, #000 100%)";

export function BotanicalField({
  color,
  opacity = 0.3,
  flip = false,
}: {
  /** Ink colour for the engraving, e.g. "#6F8F67". */
  color: string;
  opacity?: number;
  /** Swap sides, so two bands on one page do not repeat the same layout. */
  flip?: boolean;
}) {
  const near = flip ? "right" : "left";
  const far = flip ? "left" : "right";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ opacity, maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
    >
      <Plant
        color={color}
        style={{ [near]: "-6%", top: "clamp(12px, 3%, 40px)", width: "clamp(300px, 36vw, 680px)" }}
      />
      <Plant
        color={color}
        style={{
          [far]: "-9%",
          top: "clamp(40px, 9%, 96px)",
          width: "clamp(260px, 31vw, 580px)",
          transform: "scaleX(-1) rotate(-4deg)",
        }}
      />
    </div>
  );
}
