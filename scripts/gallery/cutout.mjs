import sharp from "sharp";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

/**
 * Knock the white studio background out of a product render.
 *
 * The bottle shots are shot/rendered on white. Dropped straight onto a cream
 * panel they show as a white rectangle, and on the dark half of the comparison
 * panel the box is glaring. `mix-blend-mode: multiply` is the usual trick, but
 * it fails in both directions here: it does nothing inside a stacking context,
 * and over dark green it would crush the bottle almost to black.
 *
 * So the background is genuinely removed once, to a transparent PNG that can be
 * placed on any colour.
 *
 * Flood-fill from the edges rather than keying every white pixel: the label has
 * a cream panel and white highlights that must survive. Only white REACHABLE
 * from the border is background.
 */
export async function cutout(srcAbs, cacheDir, { threshold = 232, feather = 0.6 } = {}) {
  await mkdir(cacheDir, { recursive: true });
  const out = path.join(cacheDir, `${path.parse(srcAbs).name}-cutout.png`);
  if (existsSync(out)) return out;

  const img = sharp(srcAbs).ensureAlpha();
  const { width, height } = await img.metadata();
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });

  const n = width * height;
  const bg = new Uint8Array(n); // 1 = background
  const stack = [];

  const isPale = (i) => {
    const o = i * 4;
    return data[o] >= threshold && data[o + 1] >= threshold && data[o + 2] >= threshold;
  };

  // Seed from every border pixel that is pale.
  for (let x = 0; x < width; x++) {
    const top = x;
    const bot = (height - 1) * width + x;
    if (isPale(top)) { bg[top] = 1; stack.push(top); }
    if (isPale(bot)) { bg[bot] = 1; stack.push(bot); }
  }
  for (let y = 0; y < height; y++) {
    const l = y * width;
    const r = y * width + width - 1;
    if (isPale(l)) { bg[l] = 1; stack.push(l); }
    if (isPale(r)) { bg[r] = 1; stack.push(r); }
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i - x) / width;
    // 4-connected: diagonals leak through thin glass edges.
    if (x > 0)          { const j = i - 1;     if (!bg[j] && isPale(j)) { bg[j] = 1; stack.push(j); } }
    if (x < width - 1)  { const j = i + 1;     if (!bg[j] && isPale(j)) { bg[j] = 1; stack.push(j); } }
    if (y > 0)          { const j = i - width; if (!bg[j] && isPale(j)) { bg[j] = 1; stack.push(j); } }
    if (y < height - 1) { const j = i + width; if (!bg[j] && isPale(j)) { bg[j] = 1; stack.push(j); } }
  }

  /*
   * Soften the boundary.
   *
   * A hard binary mask leaves a jagged, aliased edge against the panel — the
   * exact "cut out in a hurry" look. Any background pixel touching a kept pixel
   * gets partial alpha instead of none.
   */
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (!bg[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    let keptNeighbour = false;
    if (x > 0 && !bg[i - 1]) keptNeighbour = true;
    if (x < width - 1 && !bg[i + 1]) keptNeighbour = true;
    if (y > 0 && !bg[i - width]) keptNeighbour = true;
    if (y < height - 1 && !bg[i + width]) keptNeighbour = true;
    data[o + 3] = keptNeighbour ? Math.round(255 * feather) : 0;
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(out);
  return out;
}
