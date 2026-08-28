/**
 * Compose a PDP panel: generated scene + the REAL bottle.
 *
 * ── Why the bottle is never generated ─────────────────────────────────────
 *
 * Handing the model a reference bottle and asking it to keep the label gets
 * about ninety-five per cent of the way there and then quietly corrupts a word:
 * the first attempt came back reading "ODLD-PRESSED" instead of "COLD-PRESSED".
 * On a food product that is a misprinted regulated claim, and it is subtle
 * enough to survive a glance.
 *
 * So the model only ever paints the SCENE — soil, plants, jute, light, which it
 * is genuinely good at — and the product is composited from the real render.
 * The label is then pixel-exact by construction rather than by luck.
 *
 * Usage: node branding/compose-panel.mjs <scene.png> <out.webp> [scalePct] [xPct]
 */
import sharp from "sharp";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MASTER = path.join(ROOT, "branding/oils/groundnut-C-front.png");
const SIZE = 1200;
/*
 * 228, not 238.
 *
 * The master render carries a soft grey studio shadow to the right of the
 * bottle. At 238 that shadow read as product, rode along inside the cutout
 * bounding box, and landed on the field as a pale smear brighter than the soil
 * under it. It is edge-connected, so widening the threshold lets the flood fill
 * swallow it.
 *
 * The label's cream panel is safe at this value — its blue channel sits at 224,
 * below the cut — and the interior whites are protected by the flood fill
 * regardless, since nothing enclosed by the label is reachable from the border.
 */
const WHITE = 228;

/** Lift the product off its white studio canvas; returns RGBA with alpha=0 background. */
async function cutout(src) {
  const { data, info } = await sharp(src)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  /*
   * Background test, two parts.
   *
   * A fixed brightness cut worked on the old master, which sat on flat white.
   * The label-C bottle is rendered on a grey studio sweep that falls off toward
   * the corners, so any single threshold either keeps half the backdrop or eats
   * into the glass. The whole rectangle came through as "product" on the first
   * run.
   *
   * So the fill grows by LOCAL similarity — a neighbour joins if it is close to
   * the pixel it spread from — which follows a smooth gradient wherever it
   * goes. The saturation guard is what stops it walking into the bottle: the
   * sweep is neutral grey, while the oil is amber and the cap deep green, and
   * neither survives a channel spread this tight.
   */
  const NEUTRAL = 20;
  const LOCAL = 16;
  const isNeutral = (i) => {
    const p = i * ch;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx - mn <= NEUTRAL && mx >= WHITE - 90;
  };
  const close = (a, b) => {
    const pa = a * ch, pb = b * ch;
    return (
      Math.abs(data[pa] - data[pb]) <= LOCAL &&
      Math.abs(data[pa + 1] - data[pb + 1]) <= LOCAL &&
      Math.abs(data[pa + 2] - data[pb + 2]) <= LOCAL
    );
  };
  const isWhite = (i) => isNeutral(i);
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) {
    const i = y * w + x; if (!bg[i] && isWhite(i)) { bg[i] = 1; stack.push(i); }
  }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) {
    const i = y * w + x; if (!bg[i] && isWhite(i)) { bg[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0)     { const n = i - 1; if (!bg[n] && isWhite(n) && close(n, i)) { bg[n] = 1; stack.push(n); } }
    if (x < w - 1) { const n = i + 1; if (!bg[n] && isWhite(n) && close(n, i)) { bg[n] = 1; stack.push(n); } }
    if (y > 0)     { const n = i - w; if (!bg[n] && isWhite(n) && close(n, i)) { bg[n] = 1; stack.push(n); } }
    if (y < h - 1) { const n = i + w; if (!bg[n] && isWhite(n) && close(n, i)) { bg[n] = 1; stack.push(n); } }
  }
  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (bg[i]) { data[i * ch + 3] = 0; continue; }
    if (y < top) top = y; if (y > bottom) bottom = y;
    if (x < left) left = x; if (x > right) right = x;
  }
  /*
   * Trim the last slice of the base.
   *
   * The master was shot on a white floor and carries a reflection under the
   * bottle. That reflection is ENCLOSED by the glass silhouette, so the flood
   * fill cannot reach it from the border no matter how wide the white threshold
   * is opened — raising it to 216 only ate into the glass and left the crescent
   * exactly where it was. Cropping the bottom 2.5% removes it outright, and
   * costs nothing visually: the composited contact shadow is what sells the
   * bottle standing on the ground anyway.
   */
  const cropH = Math.round((bottom - top + 1) * 0.975);

  return sharp(data, { raw: { width: w, height: h, channels: ch } })
    .extract({ left, top, width: right - left + 1, height: cropH })
    .png()
    .toBuffer();
}

const [scene, out, scalePct = "74", xPct = "60"] = process.argv.slice(2);
if (!scene || !out) {
  console.error("usage: node branding/compose-panel.mjs <scene.png> <out.webp> [scalePct] [xPct]");
  process.exit(1);
}

/*
 * The master already carries its own alpha — branding/apply-label-c.mjs cuts
 * the blank bottle off its sweep and only then lays the label on. Re-running a
 * mask here would find the cream label neutral-and-bright, exactly like the
 * studio grey it was built to remove, and hollow the artwork out.
 */
const bottle = await sharp(MASTER).ensureAlpha().png().toBuffer();
const h = Math.round(SIZE * (Number(scalePct) / 100));
const body = await sharp(bottle).resize(null, h, { fit: "inside" }).toBuffer();
const bm = await sharp(body).metadata();

/*
 * A contact shadow, so the bottle sits ON the ground instead of floating above
 * it. Without this the composite reads as a cut-out pasted on a photo, which is
 * exactly the look these panels are meant to avoid.
 */
const shadowW = Math.round(bm.width * 1.05);
const shadowH = Math.round(bm.width * 0.16);
/*
 * Rendered straight from the SVG rather than composited onto a transparent
 * canvas first. Blurring a composite of transparent-black bled the unpremul-
 * tiplied edges outward and the "shadow" landed as a pale smudge — lighter
 * than the soil it was meant to darken.
 */
const shadow = await sharp(
  Buffer.from(
    `<svg width="${shadowW}" height="${shadowH}"><ellipse cx="${shadowW / 2}" cy="${shadowH / 2}" rx="${shadowW / 2.3}" ry="${shadowH / 2.6}" fill="#2a1608" fill-opacity="0.5"/></svg>`,
  ),
)
  .blur(16)
  .png()
  .toBuffer();

const left = Math.round(SIZE * (Number(xPct) / 100) - bm.width / 2);
const top = Math.round((SIZE - h) / 2);

await sharp(scene)
  .resize(SIZE, SIZE, { fit: "cover" })
  .composite([
    { input: shadow, left, top: top + h - Math.round(shadowH * 0.55) },
    { input: body, left, top },
  ])
  .webp({ quality: 92 })
  .toFile(out);

console.log(`composed ${out}  bottle ${bm.width}x${h} @ ${left},${top}`);
