/**
 * Replace every OLD-label groundnut image still in use with the current pack.
 *
 * Two label generations shipped side by side: the old rust panel reading
 * "BY THE FARMERS OF TELANGANA", and the current cream arch reading
 * "WOOD-PRESSED · UNREFINED". Four old-label files were still being served —
 * the base product shot and three manifest panels — so one product page
 * advertised two different packs.
 *
 * Sources are the finished new-label renders in branding/oils/.
 *
 * Run: node branding/relabel-groundnut.mjs
 */
import sharp from "sharp";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OILS = path.join(ROOT, "public/images/products/oils");
const GAL = path.join(OILS, "gallery");
const MASTER = path.join(ROOT, "branding/oils/groundnut-01-front-final.png");
const WHITE = 238;

/**
 * Cut the product off its white studio canvas, returning RGBA with the
 * background transparent.
 *
 * Flood-filled inward from the borders rather than thresholded globally: the
 * label carries a white "WOOD-PRESSED · UNREFINED" banner, and a global
 * threshold punches a hole straight through it. Only white reachable from the
 * edge is background.
 */
async function cutout(src) {
  const { data, info } = await sharp(src)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: ch } = info;
  const isWhite = (i) => {
    const p = i * ch;
    return data[p] >= WHITE && data[p + 1] >= WHITE && data[p + 2] >= WHITE;
  };

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
    if (x > 0)     { const n = i - 1; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
    if (x < w - 1) { const n = i + 1; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
    if (y > 0)     { const n = i - w; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
    if (y < h - 1) { const n = i + w; if (!bg[n] && isWhite(n)) { bg[n] = 1; stack.push(n); } }
  }

  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (bg[i]) { data[i * ch + 3] = 0; continue; }
    if (y < top) top = y; if (y > bottom) bottom = y;
    if (x < left) left = x; if (x > right) right = x;
  }

  const rgba = await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();
  return rgba;
}

const bottle = await cutout(MASTER);

/** 1 — base product shot. Matches sesame/coconut: 1200x1789 on near-white. */
{
  const body = await sharp(bottle).resize(null, Math.round(1789 * 0.92), { fit: "inside" }).toBuffer();
  await sharp({ create: { width: 1200, height: 1789, channels: 3, background: { r: 252, g: 255, b: 248 } } })
    .composite([{ input: body, gravity: "center" }])
    .webp({ quality: 92 })
    .toFile(path.join(OILS, "groundnut.webp"));
  console.log("  rebuilt  groundnut.webp");
}

/** 2 — gallery hero. Square on brand cream, matching the other oil heroes. */
{
  const body = await sharp(bottle).resize(null, Math.round(1200 * 0.78), { fit: "inside" }).toBuffer();
  await sharp({ create: { width: 1200, height: 1200, channels: 3, background: { r: 249, g: 250, b: 245 } } })
    .composite([{ input: body, gravity: "center" }])
    .webp({ quality: 92 })
    .toFile(path.join(GAL, "groundnut-oil-hero.webp"));
  console.log("  rebuilt  gallery/groundnut-oil-hero.webp");
}

/**
 * 3 — comparison panel.
 *
 * The category tile already makes this exact argument against refined oil, and
 * it was rendered against the current pack. Reusing it beats re-rendering the
 * old panel, and keeps one comparison claim on the site instead of two.
 */
{
  await sharp(path.join(OILS, "oils-tile-comparison.webp"))
    .resize(1200, 1200, { fit: "cover" })
    .webp({ quality: 92 })
    .toFile(path.join(GAL, "groundnut-oil-comparison.webp"));
  console.log("  rebuilt  gallery/groundnut-oil-comparison.webp");
}

/**
 * 4 — "Only One Ingredient" panel.
 *
 * Only the bottle is wrong; the copy is fine. The old bottle is painted out
 * with the panel's own cream and the new one dropped into the same footprint,
 * so the layout and text stay exactly as authored.
 */
{
  const src = path.join(GAL, "groundnut-oil-ingredient.webp");
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  // Panel cream, sampled from a corner well away from the artwork.
  const bgc = { r: data[0], g: data[1], b: data[2] };
  const near = (i) =>
    Math.abs(data[i * ch] - bgc.r) < 12 &&
    Math.abs(data[i * ch + 1] - bgc.g) < 12 &&
    Math.abs(data[i * ch + 2] - bgc.b) < 12;

  // The bottle lives in the left third; the copy sits right of it.
  let top = h, left = w, right = -1, bottom = -1;
  const limit = Math.floor(w * 0.34);
  for (let y = 0; y < h; y++) for (let x = 0; x < limit; x++) {
    if (near(y * w + x)) continue;
    if (y < top) top = y; if (y > bottom) bottom = y;
    if (x < left) left = x; if (x > right) right = x;
  }
  const box = { left, top, width: right - left + 1, height: bottom - top + 1 };
  console.log(`     old bottle box ${box.width}x${box.height} @ ${box.left},${box.top}`);

  const patch = await sharp({
    create: { width: box.width + 8, height: box.height + 8, channels: 3, background: bgc },
  }).png().toBuffer();

  const fresh = await sharp(bottle).resize(null, box.height, { fit: "inside" }).toBuffer();
  const fm = await sharp(fresh).metadata();

  await sharp(src)
    .composite([
      { input: patch, left: Math.max(0, box.left - 4), top: Math.max(0, box.top - 4) },
      { input: fresh, left: Math.round(box.left + box.width / 2 - fm.width / 2), top: box.top },
    ])
    .webp({ quality: 92 })
    .toFile(path.join(GAL, "_ingredient-tmp.webp"));

  await sharp(path.join(GAL, "_ingredient-tmp.webp")).toFile(src);
  console.log("  rebuilt  gallery/groundnut-oil-ingredient.webp");
}

console.log("done");
