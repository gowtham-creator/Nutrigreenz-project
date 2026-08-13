/**
 * IndiaFlag — the national flag, drawn to the specification.
 *
 * ── Why this is a drawing and not a mask ──────────────────────────────────
 *
 * Every other mark on the vision row is a monochrome glyph tinted from
 * `currentColor`. This one cannot be: a tricolour rendered in a single colour
 * is not the flag, it is three identical stripes. So it is the one icon here
 * that carries its own colour.
 *
 * ── The specification ─────────────────────────────────────────────────────
 *
 * Drawn to the Flag Code of India rather than by eye, because a national flag
 * with the wrong proportions or a chakra with the wrong number of spokes is
 * the kind of detail people notice and write in about:
 *
 *   · 3:2 ratio, width to height.
 *   · Three equal horizontal bands: India saffron #FF9933, white, India green
 *     #138808.
 *   · The Ashoka Chakra centred in the white band, navy blue #000080, with a
 *     diameter three-quarters the height of that band.
 *   · Twenty-four spokes, evenly spaced — generated rather than hand-written,
 *     which is the only way to be sure there are exactly twenty-four.
 *
 * ── One thing to be aware of ──────────────────────────────────────────────
 *
 * Part III of the Flag Code restricts use of the national flag for commercial
 * purposes. A small flag illustrating the words "Healthy Nation" in a mission
 * statement is ordinary and widely done, and is not the flag being used to
 * sell or brand a product — but it is a commercial site, so the decision is
 * worth making knowingly rather than by accident.
 */
export function IndiaFlag({ size = 24, className }: { size?: number; className?: string }) {
  const W = 90;
  const H = 60;
  const band = H / 3;
  const cy = H / 2;
  // Chakra diameter is three-quarters of the white band's height.
  const r = (band * 0.75) / 2;

  return (
    <svg
      width={size * 1.5}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Flag of India"
      className={className}
    >
      <rect width={W} height={band} y={0} fill="#FF9933" />
      <rect width={W} height={band} y={band} fill="#FFFFFF" />
      <rect width={W} height={band} y={band * 2} fill="#138808" />

      <g stroke="#000080" fill="none" strokeWidth={r * 0.075}>
        <circle cx={W / 2} cy={cy} r={r} />
        {/* 24 spokes, generated so the count cannot drift. */}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI * 2) / 24;
          return (
            <line
              key={i}
              x1={W / 2}
              y1={cy}
              x2={W / 2 + r * Math.cos(a)}
              y2={cy + r * Math.sin(a)}
            />
          );
        })}
      </g>
      <circle cx={W / 2} cy={cy} r={r * 0.14} fill="#000080" />

      {/* A hairline edge, so the white band still reads as flag rather than as
          a gap when this sits on a pale card. */}
      <rect
        width={W}
        height={H}
        fill="none"
        stroke="rgba(10,31,18,0.18)"
        strokeWidth="1"
      />
    </svg>
  );
}
