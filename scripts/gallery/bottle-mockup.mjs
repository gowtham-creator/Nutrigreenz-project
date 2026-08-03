import sharp from "sharp";

/**
 * Wrap a flat label panel onto a bottle photograph.
 *
 * Why this exists rather than another generated render: an image model cannot
 * be trusted with regulated copy. Asked twice for a back label it produced
 * "NET QUANTITY 100 ml" on a one-litre bottle and a calorie figure of 130 —
 * both invented, both statutory declarations, on artwork bound for a live
 * product page. The label generator in nutrigreenz-packaging already produces
 * the real panel; this puts that exact artwork on the bottle so the text on the
 * image and the text going to print are the same text.
 *
 * The warp is a per-column vertical scale plus a horizontal compression toward
 * the edges — the standard approximation of a flat sheet wrapped on a cylinder.
 * A column at angle θ from the bottle's centre line is foreshortened by cos θ
 * horizontally, and its visible height shrinks slightly toward the silhouette.
 * Shading multiplies a soft cylindrical falloff over the top so the panel sits
 * in the bottle's own light rather than looking pasted on.
 */

/**
 * @param labelBuf   PNG/WebP buffer of the flat panel (already cropped)
 * @param out        { w, h } target size of the warped panel in px
 * @param opts.wrap  how far around the cylinder the panel spans, in degrees.
 *                   ~150° reads as a label seen face-on with both edges curving
 *                   away; lower values look flatter.
 */
export async function cylindricalWarp(labelBuf, out, opts = {}) {
  const wrapDeg = opts.wrap ?? 150;
  const curveDepth = opts.curveDepth ?? 0.06; // vertical bow at the edges
  const shade = opts.shade ?? 0.55; // 0 = flat lighting, 1 = heavy falloff

  const src = sharp(labelBuf).ensureAlpha();
  const meta = await src.metadata();
  const { data, info } = await src
    .resize(out.w, out.h, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  const ch = info.channels;
  const dst = Buffer.alloc(W * H * 4, 0);

  const half = ((wrapDeg / 2) * Math.PI) / 180;

  for (let x = 0; x < W; x++) {
    // Destination column → angle across the cylinder face.
    const t = (x / (W - 1)) * 2 - 1; // -1 … 1
    const theta = t * half;
    /*
     * Source column. sin θ / sin(half) maps the destination's linear span back
     * onto the label's own coordinates: the middle of the panel is barely
     * stretched, the edges compress hard, which is what makes it read as
     * curvature rather than a squeeze.
     */
    const u = Math.sin(theta) / Math.sin(half);
    const sx = Math.round(((u + 1) / 2) * (W - 1));
    if (sx < 0 || sx >= W) continue;

    // Edges of a cylinder are further from the camera → slightly shorter.
    const scaleY = 1 - curveDepth * (1 - Math.cos(theta));
    const bow = ((1 - scaleY) * H) / 2;

    // Lambert-ish falloff, brightest just off centre like a real specular roll.
    const light = Math.cos(theta - 0.18);
    const shadeF = 1 - shade * (1 - Math.max(0, light));

    for (let y = 0; y < H; y++) {
      const sy = Math.round((y - bow) / scaleY);
      if (sy < 0 || sy >= H) continue;
      const si = (sy * W + sx) * ch;
      const di = (y * W + x) * 4;
      dst[di] = Math.round(data[si] * shadeF);
      dst[di + 1] = Math.round(data[si + 1] * shadeF);
      dst[di + 2] = Math.round(data[si + 2] * shadeF);
      dst[di + 3] = ch === 4 ? data[si + 3] : 255;
    }
  }

  void meta;
  return sharp(dst, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

/**
 * Composite a warped panel onto a bare bottle shot.
 *
 * `band` is where the label sits on the bottle, as fractions of the bottle
 * image — measured off the actual photograph rather than guessed, because a
 * label floating off the glass is the tell that gives a mockup away.
 */
export async function applyLabel(bottlePath, labelBuf, band, opts = {}) {
  const bottle = sharp(bottlePath).ensureAlpha();
  const { width, height } = await bottle.metadata();

  const w = Math.round(width * (band.right - band.left));
  const h = Math.round(height * (band.bottom - band.top));
  const warped = await cylindricalWarp(labelBuf, { w, h }, opts);

  return bottle
    .composite([
      {
        input: warped,
        left: Math.round(width * band.left),
        top: Math.round(height * band.top),
        blend: "over",
      },
    ])
    .png()
    .toBuffer();
}

/** Crop one panel out of the flat three-panel label artwork. */
export async function panelOf(labelPath, share) {
  const img = sharp(labelPath);
  const { width, height } = await img.metadata();
  return img
    .extract({
      left: Math.round(width * share.left),
      top: Math.round(height * share.top),
      width: Math.round(width * (share.right - share.left)),
      height: Math.round(height * (share.bottom - share.top)),
    })
    .png()
    .toBuffer();
}
