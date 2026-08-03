/**
 * Wrap the label face onto the bottles, in both themes.
 *
 * Run:  node scripts/gallery/build-bottle-shots.mjs
 *
 * The face comes from build-label-faces.mjs — a real HTML layout, so element
 * placement is editable. It used to be a bitmap recovered from a render, which
 * is why the block, badges and bowl could not be moved to match the reference.
 */
import sharp from "sharp";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyFace } from "./wrap-face.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "public/images/products/oils");
const REVIEW = path.join(process.env.HOME ?? ROOT, "Downloads", "nutrigreenz-gallery");
const FACES = path.join(ROOT, "assets-src/label-faces");

const BOTTLE_FILLED = path.join(ROOT, "assets-src/bottle-filled-1l.png");
const BOTTLE_EMPTY = path.join(ROOT, "assets-src/bottle-empty-1l.png");

/* Half-arc the face spans on the glass. */
const ARC = 76;

/*
 * Label position, measured off each photograph rather than guessed — the filled
 * bottle is shot on warm grey, so a white threshold reads the whole frame as
 * subject.
 */
const BAND_FILLED = { left: 0.344, right: 0.656, top: 0.395, bottom: 0.845 };
const BAND_EMPTY  = { left: 0.353, right: 0.649, top: 0.430, bottom: 0.865 };

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(REVIEW, { recursive: true });

  for (const theme of ["green", "blush"]) {
    const face = await readFile(path.join(FACES, `groundnut-1l-${theme}.png`));

    for (const [suffix, base, band] of [
      ["filled", BOTTLE_FILLED, BAND_FILLED],
      ["empty", BOTTLE_EMPTY, BAND_EMPTY],
    ]) {
      const composed = await applyFace(base, face, band, { arc: ARC });
      const name = `groundnut-1l-${theme}-${suffix}`;
      await sharp(composed).resize({ width: 1400 }).webp({ quality: 92 })
        .toFile(path.join(OUT, `${name}.webp`));
      await writeFile(path.join(REVIEW, `${name}.png`), composed);
      console.log(`  ✓ ${name}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
