/**
 * Build the label-C product master: blank bottle, cut out, then labelled.
 *
 * Outputs RGBA with a transparent background, so panel composition is a plain
 * paste with no further masking.
 *
 * ── Why the cutout happens BEFORE the label ───────────────────────────────
 *
 * The obvious order — label the bottle, then cut it out — cannot work. The
 * bottle is rendered on a neutral grey sweep, so the fill has to grow by local
 * similarity with a saturation guard to follow that gradient. Label C is cream:
 * neutral, bright, and therefore indistinguishable from the sweep by exactly
 * the test that removes the sweep. Run that way the fill walked down the glass
 * edge, into the label, and hollowed it out — the field showed through the
 * artwork.
 *
 * Cutting the BLANK bottle first removes the conflict entirely. Nothing neutral
 * needs protecting at that point: the sweep goes, the amber oil and green cap
 * stay, and the label is laid on afterwards where no mask will ever touch it.
 *
 * Run: node branding/apply-label-c.mjs
 */
import sharp from "sharp";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BOTTLE = path.join(ROOT, "public/images/products/oils/groundnut-bottle-filled.webp");
const LABEL = path.join(ROOT, "branding/previews/front-oil.png");
const OUT = path.join(ROOT, "branding/oils/groundnut-C-front.png");

/* Measured off the render (1400x2087). The body's flat face, corner to corner. */
const BODY = { left: 458, right: 872, top: 620, bottom: 1880 };
const WIDTH_FRAC = 0.94;
const CENTRE_FRAC = 0.56;

/** Neutral-and-bright test: the sweep is grey, the oil amber, the cap green. */
const NEUTRAL = 32;
const LOCAL = 22;
const MIN_BRIGHT = 150;

async function cutBlankBottle(src) {
  const { data, info } = await sharp(src)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  const neutral = (i) => {
    const p = i * ch;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx - mn <= NEUTRAL && mx >= MIN_BRIGHT;
  };
  const close = (a, b) => {
    const pa = a * ch, pb = b * ch;
    return (
      Math.abs(data[pa] - data[pb]) <= LOCAL &&
      Math.abs(data[pa + 1] - data[pb + 1]) <= LOCAL &&
      Math.abs(data[pa + 2] - data[pb + 2]) <= LOCAL
    );
  };

  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) {
    const i = y * w + x; if (!bg[i] && neutral(i)) { bg[i] = 1; stack.push(i); }
  }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) {
    const i = y * w + x; if (!bg[i] && neutral(i)) { bg[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    const step = (n) => { if (!bg[n] && neutral(n) && close(n, i)) { bg[n] = 1; stack.push(n); } };
    if (x > 0) step(i - 1);
    if (x < w - 1) step(i + 1);
    if (y > 0) step(i - w);
    if (y < h - 1) step(i + w);
  }

  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (bg[i]) { data[i * ch + 3] = 0; continue; }
    if (y < top) top = y; if (y > bottom) bottom = y;
    if (x < left) left = x; if (x > right) right = x;
  }
  return { data, info, box: { left, top, width: right - left + 1, height: bottom - top + 1 } };
}

const { data, info, box } = await cutBlankBottle(BOTTLE);
console.log(`bottle cut: ${box.width}x${box.height} @ ${box.left},${box.top}`);

/*
 * Position off the MEASURED cut, not a hand-typed BODY box.
 *
 * The hardcoded estimate put the face at 458–872; the mask actually finds it at
 * 481–920. Ten pixels of drift is enough to push the label to a negative left
 * offset and clip its edge off, and the numbers would have to be re-measured by
 * hand for every new bottle render. The cut box already knows where the widest
 * part of the glass is, so the label is centred in that.
 */
const lm = await sharp(LABEL).metadata();
const labelW = Math.round(box.width * WIDTH_FRAC);
const labelH = Math.round((labelW / lm.width) * lm.height);

const left = Math.round(box.width / 2 - labelW / 2);
const top = Math.round(box.height * CENTRE_FRAC - labelH / 2);
console.log(`label ${labelW}x${labelH} @ ${left},${top} (in cropped frame)`);

/* The bottle's light, multiplied over the paper so it sits on glass not in front of it. */
const shading = Buffer.from(
  `<svg width="${labelW}" height="${labelH}">
     <defs>
       <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
         <stop offset="0"    stop-color="#000000" stop-opacity="0.16"/>
         <stop offset="0.22" stop-color="#ffffff" stop-opacity="0.10"/>
         <stop offset="0.55" stop-color="#000000" stop-opacity="0.00"/>
         <stop offset="1"    stop-color="#000000" stop-opacity="0.22"/>
       </linearGradient>
     </defs>
     <rect width="${labelW}" height="${labelH}" fill="url(#g)"/>
   </svg>`,
);

const label = await sharp(LABEL)
  .resize(labelW, labelH, { fit: "fill" })
  .composite([{ input: shading, blend: "over" }])
  .png()
  .toBuffer();

await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .extract(box)
  .composite([{ input: label, left, top }])
  .png()
  .toFile(OUT);

console.log("wrote", path.relative(ROOT, OUT));
