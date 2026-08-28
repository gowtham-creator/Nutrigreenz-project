/**
 * Format branding masters into PDP gallery images.
 *
 * The masters in `branding/oils/*-master.png` are tall product renders on a
 * white studio canvas. The gallery style set by the A2 ghee and groundnut sets
 * is square, 1200x1200, on the brand cream. This lifts the product off the
 * white and re-centres it on cream at a consistent scale, writing webp into
 * `public/images/products/<category>/gallery/`.
 *
 * ── Why a flood fill and not a trim ───────────────────────────────────────
 *
 * `sharp.trim()` crops to a bounding box using a single reference colour. These
 * masters have a white canvas that is not perfectly uniform, so trim left a
 * white slab behind the bottle and threw the centring off.
 *
 * The obvious alternative — make every near-white pixel transparent — is worse:
 * the labels carry a white "WOOD-PRESSED · UNREFINED" banner and a cream panel,
 * and a global threshold punches holes straight through them.
 *
 * So the background is found by flooding inward from the borders. Only white
 * that is CONNECTED to the edge is background; white enclosed by the label is
 * part of the product and survives untouched.
 *
 * Run: node branding/build-product-gallery.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SIZE = 1200;
/** Fraction of the canvas the product may occupy — matches the A2 hero framing. */
const INSET = 0.78;
/** A channel value at or above this, on all three channels, reads as studio white. */
const WHITE = 238;

/** Sample the brand cream straight off an existing gallery image. */
async function brandCream() {
  const ref = path.join(ROOT, "public/images/products/ghee/gallery/a2-cow-ghee-hero.webp");
  const { data } = await sharp(ref).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

/**
 * Return the bounding box of the subject: everything not reachable from the
 * border through contiguous white.
 */
function subjectBounds(data, w, h, channels) {
  const isWhite = (i) => {
    const p = i * channels;
    return data[p] >= WHITE && data[p + 1] >= WHITE && data[p + 2] >= WHITE;
  };

  const bg = new Uint8Array(w * h);
  const stack = [];

  // Seed from every border pixel that is white.
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!bg[i] && isWhite(i)) { bg[i] = 1; stack.push(i); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!bg[i] && isWhite(i)) { bg[i] = 1; stack.push(i); }
    }
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0)     { const n = i - 1; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
    if (x < w - 1) { const n = i + 1; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
    if (y > 0)     { const n = i - w; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
    if (y < h - 1) { const n = i + w; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
  }

  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bg[y * w + x]) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) throw new Error("no subject found — the whole frame read as background");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function build(src, out, bg) {
  const { data, info } = await sharp(src)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const box = subjectBounds(data, info.width, info.height, info.channels);
  const target = Math.round(SIZE * INSET);

  const product = await sharp(src)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .extract(box)
    .resize(target, target, { fit: "inside" })
    // The subject was cut out of white, so its own anti-aliased edge is white.
    // Removing that halo is what makes it sit on cream instead of floating in a box.
    .removeAlpha()
    .toBuffer();

  await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: bg } })
    .composite([{ input: product, gravity: "center", blend: "multiply" }])
    .webp({ quality: 92 })
    .toFile(out);

  return box;
}

/**
 * Square, full-bleed artwork — already 2048x2048 on its own background.
 *
 * These must NOT go through `build()`. Flood-filling a full-bleed photograph
 * finds no border white to remove, and re-centring one on cream would letterbox
 * an image that is already correctly composed. They only need scaling.
 */
async function passthrough(src, out) {
  await sharp(src).resize(SIZE, SIZE, { fit: "cover" }).webp({ quality: 92 }).toFile(out);
}

const OILS = ["coconut", "mustard", "olive", "safflower", "sesame"];
/** Shared across every oil — one press, one range, one comparison. */
const TILES = ["comparison", "range", "sizes", "why", "woodpress"];

/*
 * Groundnut-only PDP additions.
 *
 * `groundnut-02-back.png` is deliberately absent. It is an unfilled print
 * template: the FSSAI licence box is empty, the manufacturer address is masked,
 * and MRP, batch number, MFD and USE BY are all blank rules. Publishing it
 * would put a label with no licence number and no price on a live product page,
 * which Legal Metrology and FSSAI both require to be present. It can go in once
 * a filled artwork exists.
 */
const GROUNDNUT_CUTOUT = [["groundnut-01-front-final", "groundnut-oil-front"]];
const GROUNDNUT_FULLBLEED = [
  ["groundnut-03-infographic", "groundnut-oil-infographic"],
  ["groundnut-04-lifestyle", "groundnut-oil-lifestyle"],
];

const bg = await brandCream();
console.log(`brand cream: rgb(${bg.r}, ${bg.g}, ${bg.b})`);

const outDir = path.join(ROOT, "public/images/products/oils/gallery");
await mkdir(outDir, { recursive: true });

for (const oil of OILS) {
  const out = path.join(outDir, `${oil}-oil-hero.webp`);
  const b = await build(path.join(ROOT, `branding/oils/${oil}-master.png`), out, bg);
  console.log(`  hero  ${oil}-oil-hero.webp   subject ${b.width}x${b.height} @ ${b.left},${b.top}`);
}

for (const tile of TILES) {
  const out = path.join(outDir, `oils-tile-${tile}.webp`);
  const b = await build(path.join(ROOT, `branding/oils/oils-tile-${tile}.png`), out, bg);
  console.log(`  tile  oils-tile-${tile}.webp   subject ${b.width}x${b.height}`);
}

for (const [src, name] of GROUNDNUT_CUTOUT) {
  const out = path.join(outDir, `${name}.webp`);
  const b = await build(path.join(ROOT, `branding/oils/${src}.png`), out, bg);
  console.log(`  gn    ${name}.webp   subject ${b.width}x${b.height}`);
}

for (const [src, name] of GROUNDNUT_FULLBLEED) {
  const out = path.join(outDir, `${name}.webp`);
  await passthrough(path.join(ROOT, `branding/oils/${src}.png`), out);
  console.log(`  gn    ${name}.webp   full-bleed`);
}

console.log("done");
