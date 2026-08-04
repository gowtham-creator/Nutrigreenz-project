/**
 * The folk-art field scene that fills the lower half of the label.
 *
 * This is the thing that was missing. The previous version placed a few
 * decorative sprigs in the outer margins and left the middle empty, which read
 * as plain because it WAS plain — the reference carries a full-height
 * illustrated scene in the lower half: trees, a working figure, a ghani press,
 * a mortar and pestle, grain and birds, drawn as FILLED silhouettes rather than
 * outlines, rising up around the product bowl.
 *
 * Filled, not stroked, is most of the difference. Outlined line-art at low
 * opacity disappears into the field; solid shapes at low opacity read as a
 * printed illustration.
 *
 * All drawn from scratch here in SVG. It is Nutri Greenz artwork in the folk
 * idiom, not a trace of anyone's file.
 */

/** A broad canopy tree — the anchor of each corner. */
const tree = (x, y, s, o, c) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="${c}" opacity="${o}">
    <path d="M0 0 L-5 -95 L5 -95 Z"/>
    <path d="M0 -60 L-34 -84 L-30 -78 Z M0 -60 L34 -84 L30 -78 Z
             M0 -34 L-26 -56 L-23 -50 Z M0 -34 L26 -56 L23 -50 Z"/>
    <ellipse cx="0" cy="-112" rx="52" ry="40"/>
    <ellipse cx="-38" cy="-96" rx="30" ry="24"/>
    <ellipse cx="38" cy="-96" rx="30" ry="24"/>
    <ellipse cx="-20" cy="-134" rx="26" ry="21"/>
    <ellipse cx="22" cy="-132" rx="24" ry="20"/>
  </g>`;

/** A slimmer, taller tree so the skyline is not repetitive. */
const tree2 = (x, y, s, o, c) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="${c}" opacity="${o}">
    <path d="M0 0 L-4 -110 L4 -110 Z"/>
    <path d="M0 -74 L-28 -96 L-25 -90 Z M0 -74 L28 -96 L25 -90 Z"/>
    <ellipse cx="0" cy="-128" rx="34" ry="46"/>
    <ellipse cx="-24" cy="-112" rx="20" ry="26"/>
    <ellipse cx="24" cy="-112" rx="20" ry="26"/>
  </g>`;

/** Stone mortar and pestle — the hand-processing cue. */
const mortar = (x, y, s, o, c) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="${c}" opacity="${o}">
    <path d="M-30 0 q 4 -34 30 -34 q 26 0 30 34 Z"/>
    <rect x="-36" y="-40" width="72" height="8" rx="4"/>
    <rect x="14" y="-92" width="9" height="56" rx="4" transform="rotate(12 18 -64)"/>
    <ellipse cx="26" cy="-92" rx="10" ry="7" transform="rotate(12 26 -92)"/>
  </g>`;

/** Wooden ghani / kolhu press — the method cue. */
const ghani = (x, y, s, o, c) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="${c}" opacity="${o}">
    <path d="M-34 0 L-27 -40 L27 -40 L34 0 Z"/>
    <rect x="-4" y="-84" width="8" height="46" rx="3"/>
    <path d="M-30 -84 L30 -84 L26 -76 L-26 -76 Z"/>
    <circle cx="0" cy="-94" r="9"/>
  </g>`;

/** A woman carrying a headload — the farmer figure. */
const figure = (x, y, s, o, c) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="${c}" opacity="${o}">
    <circle cx="0" cy="-86" r="11"/>
    <path d="M-15 -104 q 15 -10 30 0 q -15 5 -30 0 Z"/>
    <path d="M-9 -74 q 9 -6 18 0 l 9 40 q -18 8 -36 0 Z"/>
    <path d="M-9 -34 l -5 34 h 8 l 6 -30 Z M9 -34 l 5 34 h -8 l -6 -30 Z"/>
    <path d="M-9 -70 q -14 12 -12 30 l 6 2 q 0 -16 10 -24 Z"/>
    <path d="M9 -70 q 14 12 12 30 l -6 2 q 0 -16 -10 -24 Z"/>
  </g>`;

/** Grain stalks, filled rather than outlined. */
const grain = (x, y, s, o, c) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="${c}" opacity="${o}">
    <rect x="-1.6" y="-64" width="3.2" height="64" rx="1.6"/>
    <path d="M0 -62 q 13 4 15 18 q -13 -2 -15 -18 Z"/>
    <path d="M0 -62 q -13 4 -15 18 q 13 -2 15 -18 Z"/>
    <path d="M0 -44 q 13 4 15 18 q -13 -2 -15 -18 Z"/>
    <path d="M0 -44 q -13 4 -15 18 q 13 -2 15 -18 Z"/>
    <path d="M0 -26 q 12 4 14 16 q -12 -2 -14 -16 Z"/>
    <path d="M0 -26 q -12 4 -14 16 q 12 -2 14 -16 Z"/>
  </g>`;

/** A leafy sprig for filling gaps between the larger pieces. */
const sprig = (x, y, s, rot, o, c) => `
  <g transform="translate(${x},${y}) rotate(${rot}) scale(${s})" fill="${c}" opacity="${o}">
    <rect x="-1.4" y="-70" width="2.8" height="70" rx="1.4"/>
    <path d="M0 -60 q 16 -6 22 6 q -16 6 -22 -6 Z"/>
    <path d="M0 -60 q -16 -6 -22 6 q 16 6 22 -6 Z"/>
    <path d="M0 -40 q 15 -6 21 6 q -15 6 -21 -6 Z"/>
    <path d="M0 -40 q -15 -6 -21 6 q 15 6 21 -6 Z"/>
    <path d="M0 -20 q 13 -5 18 5 q -13 5 -18 -5 Z"/>
    <path d="M0 -20 q -13 -5 -18 5 q 13 5 18 -5 Z"/>
  </g>`;

/** A pair of birds in the upper field. */
const birds = (x, y, s, o, c) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${c}"
     stroke-width="3" stroke-linecap="round" opacity="${o}">
    <path d="M0 0 q 9 -9 18 0 M18 0 q 9 -9 18 0"/>
    <path d="M46 22 q 7 -7 14 0 M60 22 q 7 -7 14 0"/>
  </g>`;

/** The sun, low behind the scene. */
const sun = (x, y, r, o, c) => {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 16;
    const x1 = Math.cos(a) * (r + 10);
    const y1 = Math.sin(a) * (r + 10);
    const x2 = Math.cos(a) * (r + 30);
    const y2 = Math.sin(a) * (r + 30);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}"
             stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
  }).join("");
  return `<g transform="translate(${x},${y})" opacity="${o}">
    <circle r="${r}" fill="${c}"/>${rays}</g>`;
};

/**
 * Compose the scene.
 *
 * The horizon sits just under the product block so the illustration rises
 * around the bowl instead of sitting in a separate band beneath it — that
 * interlock is what makes the reference feel designed rather than assembled.
 */
export function fieldScene(t, W, H) {
  const c = t.botanical;
  const o = t.sceneAlpha ?? 0.34;
  /*
   * The horizon sits well above the base so the skyline rises to meet the bowl.
   * Pinned near the bottom it read as a separate strip under the artwork, which
   * is exactly the disconnected look being fixed.
   */
  const ground = H * 0.895;

  return `
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
       style="position:absolute;inset:0;z-index:0"
       xmlns="http://www.w3.org/2000/svg">
    ${sun(W * 0.5, H * 0.038, 30, o * 0.5, c)}
    ${birds(W * 0.14, H * 0.075, 0.9, o * 0.8, c)}
    ${birds(W * 0.70, H * 0.055, 0.8, o * 0.7, c)}

    <!-- Skyline: taller at the edges so the eye is held inside the label. -->
    ${tree(W * 0.085, ground, 1.95, o, c)}
    ${tree2(W * 0.215, ground, 1.55, o * 0.85, c)}
    ${tree(W * 0.915, ground, 1.90, o, c)}
    ${tree2(W * 0.795, ground, 1.50, o * 0.85, c)}

    <!-- Village life, worked in around the bowl. -->
    ${figure(W * 0.325, ground, 1.55, o * 0.95, c)}
    ${mortar(W * 0.155, ground, 1.50, o * 0.9, c)}
    ${ghani(W * 0.845, ground, 1.55, o * 0.9, c)}

    ${grain(W * 0.062, ground, 1.45, o * 0.8, c)}
    ${grain(W * 0.115, ground, 1.20, o * 0.7, c)}
    ${grain(W * 0.268, ground, 1.30, o * 0.75, c)}
    ${grain(W * 0.735, ground, 1.28, o * 0.75, c)}
    ${grain(W * 0.945, ground, 1.40, o * 0.8, c)}

    ${sprig(W * 0.045, H * 0.70, 0.95, -8, o * 0.7, c)}
    ${sprig(W * 0.955, H * 0.68, 0.9, 10, o * 0.7, c)}
    ${sprig(W * 0.395, ground, 0.85, -4, o * 0.6, c)}
    ${sprig(W * 0.645, ground, 0.9, 6, o * 0.6, c)}
  </svg>`;
}
