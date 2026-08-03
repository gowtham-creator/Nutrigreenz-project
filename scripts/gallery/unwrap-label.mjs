import sharp from "sharp";

/**
 * Flatten the label off an existing bottle render.
 *
 * The approved storefront artwork — deep green, botanical line work, the cream
 * wordmark panel, the clay product block, the bowl illustration — only exists
 * baked into a curved product shot. Redrawing it would produce a near-match
 * that is subtly not the approved design, and the difference would show the
 * moment the two sat side by side on a product page.
 *
 * So it is recovered instead. This is the exact inverse of the wrap in
 * bottle-mockup.mjs: a column at angle θ on a cylinder appears at horizontal
 * position sin θ, so sampling at sin θ for angles spread evenly across the
 * visible arc pulls the curved face back to flat. The middle of the panel is
 * barely touched; the edges are stretched back out.
 *
 * Columns very close to the silhouette carry almost no information — at ±90°
 * an entire span of label is crushed into one pixel — so `usableArc` stops
 * short of the edge and the caller composites the remainder.
 */
export async function unwrapFace(renderPath, band, opts = {}) {
  const usableArc = ((opts.usableArc ?? 76) * Math.PI) / 180; // half-angle kept
  const out = opts.out ?? { w: 1200, h: 900 };

  const img = sharp(renderPath).ensureAlpha();
  const meta = await img.metadata();

  const left = Math.round(meta.width * band.left);
  const top = Math.round(meta.height * band.top);
  const w = Math.round(meta.width * (band.right - band.left));
  const h = Math.round(meta.height * (band.bottom - band.top));

  const { data, info } = await img
    .extract({ left, top, width: w, height: h })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const SW = info.width;
  const SH = info.height;
  const C = info.channels;
  const W = out.w;
  const H = out.h;
  const dst = Buffer.alloc(W * H * 4, 0);

  /*
   * The crop spans the full silhouette, which is ±90°. Source position for an
   * angle θ is therefore (sin θ + 1) / 2 across the crop.
   */
  for (let x = 0; x < W; x++) {
    const theta = ((x / (W - 1)) * 2 - 1) * usableArc;
    const u = (Math.sin(theta) + 1) / 2;
    const sx = Math.min(SW - 1, Math.max(0, Math.round(u * (SW - 1))));

    /*
     * Undo the vertical foreshortening the curve introduced: the edges of a
     * cylinder photograph slightly shorter than the centre, so they are
     * stretched back before sampling.
     */
    const scaleY = 1 - 0.05 * (1 - Math.cos(theta));

    for (let y = 0; y < H; y++) {
      const t = y / (H - 1) - 0.5;
      const sy = Math.round((t * scaleY + 0.5) * (SH - 1));
      if (sy < 0 || sy >= SH) continue;
      const si = (sy * SW + sx) * C;
      const di = (y * W + x) * 4;
      dst[di] = data[si];
      dst[di + 1] = data[si + 1];
      dst[di + 2] = data[si + 2];
      dst[di + 3] = C === 4 ? data[si + 3] : 255;
    }
  }

  return sharp(dst, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

/**
 * Even out the studio lighting the render baked in.
 *
 * The recovered panel is brighter down the middle and falls off toward the
 * edges, because that is how the bottle was lit. Left in, that gradient gets
 * re-shaded when the panel is wrapped again and the result reads as a dirty
 * label. This divides the per-column mean back out, flattening the field while
 * leaving the artwork's own tones alone.
 */
export async function evenLighting(buf, strength = 0.85) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // Column means, then a wide blur so local artwork does not drive the curve.
  const means = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * C;
      s += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    means[x] = s / H;
  }
  const R = Math.max(8, Math.round(W * 0.06));
  const smooth = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    let s = 0;
    let n = 0;
    for (let k = -R; k <= R; k++) {
      const j = x + k;
      if (j < 0 || j >= W) continue;
      s += means[j];
      n++;
    }
    smooth[x] = s / n;
  }
  const target = smooth.reduce((a, b) => a + b, 0) / W;

  const out = Buffer.from(data);
  for (let x = 0; x < W; x++) {
    const g = smooth[x] > 1 ? target / smooth[x] : 1;
    const f = 1 + (g - 1) * strength;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * C;
      out[i] = Math.min(255, Math.round(data[i] * f));
      out[i + 1] = Math.min(255, Math.round(data[i + 1] * f));
      out[i + 2] = Math.min(255, Math.round(data[i + 2] * f));
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}
