/**
 * Put the approved Nutri Greenz label on a bottle.
 *
 * Run:  node scripts/gallery/build-bottle-shots.mjs
 *
 * The label is the APPROVED storefront artwork — recovered flat off the
 * existing product render by unwrap-label.mjs, then wrapped back onto a
 * different bottle. Recovering it rather than redrawing it matters: a redraw
 * would be a near-match that is subtly not the approved design, and the
 * difference would show the moment the two sat together on a product page.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unwrapFace, evenLighting } from "./unwrap-label.mjs";
import { applyFace } from "./wrap-face.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "images/products/oils");
const REVIEW = path.join(process.env.HOME ?? ROOT, "Downloads", "nutrigreenz-gallery");

const SOURCE_RENDER = path.join(OUT, "groundnut-wordmark.webp");
const BOTTLE_FILLED = path.join(ROOT, "assets-src/bottle-filled-1l.png");
const BOTTLE_EMPTY = path.join(ROOT, "assets-src/bottle-empty-1l.png");

/* The label band on the source render, measured by hue rather than guessed. */
const SOURCE_BAND = { left: 0.3286, right: 0.6714, top: 0.3920, bottom: 0.8682 };

/* Half-arc the label face spans. Same value in both directions. */
const ARC = 76;

/*
 * Where the label sits on each bottle, measured off the photographs by colour
 * saturation — the filled bottle is shot on warm grey, so a white threshold
 * reads the whole frame as subject.
 */
const BAND_FILLED = { left: 0.344, right: 0.656, top: 0.395, bottom: 0.845 };
const BAND_EMPTY  = { left: 0.353, right: 0.649, top: 0.430, bottom: 0.865 };

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(REVIEW, { recursive: true });

  // Recover the approved artwork, then flatten the studio lighting the render
  // baked in — left in, it would be re-shaded on the new bottle and read as a
  // dirty label.
  const raw = await unwrapFace(SOURCE_RENDER, SOURCE_BAND, {
    usableArc: ARC,
    out: { w: 1400, h: 1000 },
  });
  const face = await evenLighting(raw, 0.85);
  await writeFile(path.join(REVIEW, "groundnut-label-flat.png"), face);
  console.log("  ✓ groundnut-label-flat  (the label, flat)");

  const shots = [
    { name: "groundnut-filled-labelled", base: BOTTLE_FILLED, band: BAND_FILLED },
    { name: "groundnut-empty-labelled",  base: BOTTLE_EMPTY,  band: BAND_EMPTY  },
  ];

  for (const s of shots) {
    const composed = await applyFace(s.base, face, s.band, { arc: ARC });
    await sharp(composed).resize({ width: 1400 }).webp({ quality: 92 })
      .toFile(path.join(OUT, `${s.name}.webp`));
    await writeFile(path.join(REVIEW, `${s.name}.png`), composed);
    console.log(`  ✓ ${s.name}`);
  }

  // The bare bottles are deliverables in their own right.
  for (const [name, src] of [
    ["groundnut-bottle-empty", BOTTLE_EMPTY],
    ["groundnut-bottle-filled", BOTTLE_FILLED],
  ]) {
    await sharp(src).resize({ width: 1400 }).webp({ quality: 92 })
      .toFile(path.join(OUT, `${name}.webp`));
    console.log(`  ✓ ${name}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
