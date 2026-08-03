import sharp from "sharp";

/**
 * Wrap a flat label face back onto a bottle.
 *
 * Exact inverse of unwrap-label.mjs: a column at angle θ on a cylinder appears
 * at horizontal position sin θ, so a face sampled evenly in θ maps back to the
 * curve. Same arc in both directions, so the artwork returns to the glass
 * without drifting.
 */
export async function wrapFace(faceBuf, out, opts = {}) {
  const arc = ((opts.arc ?? 76) * Math.PI) / 180;
  const shade = opts.shade ?? 0.42;

  const { data, info } = await sharp(faceBuf).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const SW = info.width, SH = info.height, C = info.channels;
  const W = out.w, H = out.h;
  const dst = Buffer.alloc(W * H * 4, 0);
  const sinArc = Math.sin(arc);

  for (let x = 0; x < W; x++) {
    const t = (x / (W - 1)) * 2 - 1;
    const theta = Math.asin(Math.max(-1, Math.min(1, t * sinArc)));
    // Linear in θ across the flat face — the mapping the unwrap produced.
    const u = (theta / arc + 1) / 2;
    const sx = Math.min(SW - 1, Math.max(0, Math.round(u * (SW - 1))));

    const scaleY = 1 - 0.05 * (1 - Math.cos(theta));
    const bow = ((1 - scaleY) * H) / 2;
    // Light rolls off toward the silhouette; brightest just left of centre.
    const shadeF = 1 - shade * (1 - Math.max(0, Math.cos(theta - 0.2)));

    for (let y = 0; y < H; y++) {
      const sy = Math.round(((y - bow) / scaleY) * (SH / H));
      if (sy < 0 || sy >= SH) continue;
      const si = (sy * SW + sx) * C, di = (y * W + x) * 4;
      dst[di]     = Math.round(data[si]     * shadeF);
      dst[di + 1] = Math.round(data[si + 1] * shadeF);
      dst[di + 2] = Math.round(data[si + 2] * shadeF);
      dst[di + 3] = C === 4 ? data[si + 3] : 255;
    }
  }
  return sharp(dst, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

export async function applyFace(bottlePath, faceBuf, band, opts = {}) {
  const bottle = sharp(bottlePath).ensureAlpha();
  const { width, height } = await bottle.metadata();
  const w = Math.round(width * (band.right - band.left));
  const h = Math.round(height * (band.bottom - band.top));
  const curved = await wrapFace(faceBuf, { w, h }, opts);
  return bottle.composite([{
    input: curved,
    left: Math.round(width * band.left),
    top: Math.round(height * band.top),
    blend: "over",
  }]).png().toBuffer();
}
