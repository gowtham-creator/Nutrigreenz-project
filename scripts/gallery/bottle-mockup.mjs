import sharp from "sharp";

/**
 * Wrap the full label around a bottle and render the visible arc.
 *
 * The first version mapped ONE flat panel across the bottle face, so the label
 * stopped dead at the silhouette and no neighbouring panel curved away. A wrap
 * label does not work like that: it is one continuous strip around the whole
 * circumference, and what you see is an arc of it, with panels compressing hard
 * toward each edge.
 *
 * So this samples the WHOLE label by angle. A point at angle θ around the jar
 * sits at horizontal position sin θ, and its place on the strip is θ/2π along
 * the circumference. Rotating the bottle is then just moving `centre`.
 *
 * The label text is the artwork going to print — cropped out of the label
 * generator's own export — because an image model cannot be trusted with
 * statutory copy. Asked for a back label it produced "NET QUANTITY 100 ml" on a
 * one-litre bottle and an invented calorie figure.
 */

/**
 * @param labelBuf  the full flat label strip (one wrap = 360°)
 * @param out       { w, h } size of the rendered arc in px
 * @param opts.centre   which point of the strip faces the camera, 0…1.
 *                      Increasing it turns the bottle to the RIGHT.
 * @param opts.maxAngle half the visible arc, in degrees. 72° shows the face
 *                      plus a believable amount curving away at each edge.
 */
export async function wrapLabel(labelBuf, out, opts = {}) {
  const centre = opts.centre ?? 0.5;
  const maxAngle = ((opts.maxAngle ?? 72) * Math.PI) / 180;
  const shade = opts.shade ?? 0.5;

  const src = sharp(labelBuf).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const SW = info.width;
  const SH = info.height;
  const C = info.channels;

  const W = out.w;
  const H = out.h;
  const dst = Buffer.alloc(W * H * 4, 0);

  const sinMax = Math.sin(maxAngle);

  for (let x = 0; x < W; x++) {
    /*
     * Destination x is a position across the bottle's flat silhouette, which is
     * sin θ. Invert it to recover the angle — that is what makes the middle of
     * the face nearly untouched while the edges compress, instead of the whole
     * panel simply squashing.
     */
    const t = (x / (W - 1)) * 2 - 1; // -1 … 1 across the bottle
    const theta = Math.asin(Math.max(-1, Math.min(1, t * sinMax)));

    // Position along the strip: the wrap is 360°, so θ/2π of its width.
    let u = centre + theta / (2 * Math.PI);
    u -= Math.floor(u); // the strip is a loop
    const sx = Math.min(SW - 1, Math.max(0, Math.round(u * SW)));

    // Edges sit further from the camera, so they read very slightly shorter.
    const scaleY = 1 - 0.05 * (1 - Math.cos(theta));
    const bow = ((1 - scaleY) * H) / 2;

    // Light rolls off toward the edges; brightest just left of centre.
    const light = Math.cos(theta - 0.2);
    const shadeF = 1 - shade * (1 - Math.max(0, light));

    for (let y = 0; y < H; y++) {
      const sy = Math.round(((y - bow) / scaleY) * (SH / H));
      if (sy < 0 || sy >= SH) continue;
      const si = (sy * SW + sx) * C;
      const di = (y * W + x) * 4;
      dst[di] = Math.round(data[si] * shadeF);
      dst[di + 1] = Math.round(data[si + 1] * shadeF);
      dst[di + 2] = Math.round(data[si + 2] * shadeF);
      dst[di + 3] = C === 4 ? data[si + 3] : 255;
    }
  }

  return sharp(dst, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

/**
 * Trim the printer's bleed off the strip so the wrap is exactly one
 * circumference. Leaving it on makes the label 4% too long and every panel
 * drifts out of position as it goes round.
 */
export async function trimBleed(labelPath, bleedFrac) {
  const img = sharp(labelPath);
  const { width, height } = await img.metadata();
  const dx = Math.round(width * bleedFrac);
  const dy = Math.round(height * bleedFrac * (width / height));
  return img
    .extract({
      left: dx,
      top: dy,
      width: width - dx * 2,
      height: height - dy * 2,
    })
    .png()
    .toBuffer();
}

/** Composite the rendered arc onto the bottle photograph. */
export async function applyWrap(bottlePath, labelStrip, band, opts = {}) {
  const bottle = sharp(bottlePath).ensureAlpha();
  const { width, height } = await bottle.metadata();

  const w = Math.round(width * (band.right - band.left));
  const h = Math.round(height * (band.bottom - band.top));
  const arc = await wrapLabel(labelStrip, { w, h }, opts);

  return bottle
    .composite([
      {
        input: arc,
        left: Math.round(width * band.left),
        top: Math.round(height * band.top),
        blend: "over",
      },
    ])
    .png()
    .toBuffer();
}
