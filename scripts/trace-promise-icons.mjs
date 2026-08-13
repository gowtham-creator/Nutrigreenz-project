/**
 * Vectorise the four "Why choose Nutri Greenz" promise icons.
 *
 * The marks are supplied as flat black PNGs between 64 and 96 pixels square.
 * The homepage draws them at 64 CSS pixels — 128 device pixels on a retina
 * display — so most of them were covering about twice the pixels they actually
 * contained, and looked soft for it.
 *
 * Upscaling the raster cannot help: there is no detail in the file to enlarge.
 * This traces the alpha channel to outlines instead, which produces real vector
 * art that stays sharp at any size on any display.
 *
 * The 8x interpolation before tracing is the part that matters. potrace follows
 * the pixel boundary exactly, so tracing a 64px bitmap yields visibly stepped
 * curves; interpolating first puts sub-pixel information along each edge for the
 * tracer to follow, and the curves come out smooth.
 *
 * Re-run when a promise icon is replaced:
 *   node scripts/trace-promise-icons.mjs <tree.png> <press.png> <verified.png> <tractor.png>
 *
 * Requires `potrace` and `svgo`, which are not runtime dependencies — install
 * them transiently: `npm install --no-save potrace svgo`.
 */
import sharp from "sharp";
import potrace from "potrace";
import { optimize } from "svgo";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "public/icons/promise");
const NAMES = ["tree", "press", "verified", "tractor"];

const sources = process.argv.slice(2);
if (sources.length !== NAMES.length) {
  console.error(`Expected ${NAMES.length} source PNGs, in order: ${NAMES.join(", ")}`);
  process.exit(1);
}

const trace = (buf, opts) =>
  new Promise((res, rej) => potrace.trace(buf, opts, (e, svg) => (e ? rej(e) : res(svg))));

for (const [i, src] of sources.entries()) {
  const name = NAMES[i];
  const meta = await sharp(src).metadata();

  const upscaled = await sharp(src)
    .ensureAlpha()
    .resize(meta.width * 8, meta.height * 8, { kernel: "lanczos3" })
    .extractChannel("alpha")
    // potrace reads dark-on-light; the alpha channel is ink-on-nothing, so it
    // has to be inverted before the shape means the same thing to the tracer.
    .negate()
    .png()
    .toBuffer();

  const traced = await trace(upscaled, {
    threshold: 128,
    turdSize: 8,
    optCurve: true,
    optTolerance: 0.2,
    alphaMax: 1.0,
  });

  const { data } = optimize(traced, {
    multipass: true,
    floatPrecision: 2,
    plugins: [
      "preset-default",
      /*
       * `stroke` only — NOT `fill-rule`, and not `fill`.
       *
       * potrace emits one path per glyph whose interior counters are cut out by
       * `fill-rule="evenodd"`. Strip that attribute and the renderer falls back
       * to nonzero winding, which fills every counter in: the press, the
       * document and the tractor each came out as a solid black blob with all
       * their internal detail gone. Only the tree survived, because a tree
       * silhouette has no holes to lose.
       *
       * `fill` stays for the same reason it is harmless — these are painted as
       * masks, where the alpha is what is read and the colour comes from
       * `currentColor` at the render site regardless.
       */
      { name: "removeAttrs", params: { attrs: "stroke" } },
    ],
  });

  writeFileSync(join(DEST, `${name}.svg`), data);
  console.log(
    `${name.padEnd(10)} ${meta.width}px png -> ${(data.length / 1024).toFixed(1)}KB svg`,
  );
}
