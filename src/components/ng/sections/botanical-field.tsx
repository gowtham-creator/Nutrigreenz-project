/**
 * BotanicalField — the faint leafy line pattern that runs behind the two
 * photo-card bands.
 *
 * ── Why this is drawn rather than downloaded ──────────────────────────────
 *
 * Both bands need a pale botanical texture at the edges so the coloured
 * surface reads as a designed ground rather than a flat fill. That could have
 * been a PNG, but a tiling pattern of foliage is exactly the kind of asset that
 * gets lifted from whatever site inspired it, and a competitor's decorative
 * artwork is theirs. This is our own sprig, repeated.
 *
 * It is also cheaper than the file it replaces: one inline <svg> with a
 * <pattern>, no network request, no layout shift, and it tints from the
 * `color` prop so the same component serves the cream band and the blue one.
 *
 * Decorative only — `aria-hidden`, no focusable content, and it never sits
 * above the text layer.
 */
export function BotanicalField({
  color,
  opacity = 0.5,
  className,
}: {
  /** Stroke colour for the foliage, e.g. "#C8A668". */
  color: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity }}
    >
      <defs>
        {/*
          One sprig per 190px tile, drawn twice at different scales and angles so
          the repeat does not read as a grid. Stroke-only: a filled pattern at
          this opacity turns into blotches at small sizes, where a line keeps its
          shape.
        */}
        <pattern
          id="ng-botanical"
          width="190"
          height="190"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round">
            {/* Tall sprig */}
            <path d="M40 168 C40 130, 40 96, 40 62" />
            <path d="M40 148 C24 142, 18 128, 20 114 C34 116, 40 132, 40 148 Z" />
            <path d="M40 128 C56 122, 62 108, 60 94 C46 96, 40 112, 40 128 Z" />
            <path d="M40 106 C24 100, 18 86, 20 72 C34 74, 40 90, 40 106 Z" />
            <path d="M40 84 C56 78, 62 64, 60 50 C46 52, 40 68, 40 84 Z" />
            {/* Short sprig, mirrored and set on the diagonal */}
            <g transform="translate(132 96) rotate(24) scale(0.62)">
              <path d="M0 72 C0 44, 0 20, 0 -6" />
              <path d="M0 56 C-16 50, -22 36, -20 22 C-6 24, 0 40, 0 56 Z" />
              <path d="M0 34 C16 28, 22 14, 20 0 C6 2, 0 18, 0 34 Z" />
              <path d="M0 12 C-16 6, -22 -8, -20 -22 C-6 -20, 0 -4, 0 12 Z" />
            </g>
            {/* Scattered seed dots, to break the vertical rhythm */}
            <circle cx="104" cy="24" r="2.2" />
            <circle cx="118" cy="36" r="1.6" />
            <circle cx="92" cy="40" r="1.6" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ng-botanical)" />
    </svg>
  );
}
