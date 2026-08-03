/**
 * Composite the REAL label artwork onto a bare bottle photograph.
 *
 * Run:  node scripts/gallery/build-bottle-shots.mjs
 *
 * Produces a front view (display panel) and a back view (golden statutory
 * panel) carrying the exact text that goes to print, because it crops that text
 * out of the label generator's own output.
 *
 * The alternative — asking an image model for a back label — was tried twice
 * and produced "NET QUANTITY 100 ml" on a one-litre bottle and an invented
 * calorie figure. Statutory copy is not something to generate.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyLabel, panelOf } from "./bottle-mockup.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUBLIC = path.join(ROOT, "public");

const BOTTLE = path.join(ROOT, "assets-src/bottle-empty-1l.png");
const LABEL = path.join(
  ROOT,
  "nutrigreenz-packaging/50_exports/print/NG-GHEE-GROUNDNUT-OIL-1L.png",
);

/*
 * Where the label sits on the glass, as fractions of the bottle image.
 * Measured off the photograph — the body spans x 0.353–0.649 and the glass runs
 * y 0.294–0.943 — not guessed. A label that floats off the silhouette is the
 * tell that gives a mockup away.
 */
const BAND = { left: 0.354, right: 0.648, top: 0.5, bottom: 0.855 };

/*
 * Panel shares of the flat artwork, including the 3mm bleed on each end.
 * build.mjs splits the printable wrap 0.27 / 0.27 / 0.46 as story · display ·
 * golden, so those fractions are recomputed here across the full bled sheet.
 */
const WRAP_MM = Math.round(Math.PI * 85) + 5; // groundnut 1L jar ⌀85mm
const BLEED_MM = 3;
const SHEET = WRAP_MM + BLEED_MM * 2;
const at = (mm) => (BLEED_MM + mm) / SHEET;

const PANELS = {
  display: { left: at(WRAP_MM * 0.27), right: at(WRAP_MM * 0.54), top: 0.06, bottom: 0.94 },
  golden: { left: at(WRAP_MM * 0.54), right: at(WRAP_MM), top: 0.06, bottom: 0.94 },
};

async function main() {
  const outDir = path.join(PUBLIC, "images/products/oils");
  await mkdir(outDir, { recursive: true });

  const shots = [
    // Front: the display face — wordmark, product name, 100% Pure.
    { name: "groundnut-front", panel: PANELS.display, wrap: 150 },
    // Back: the golden statutory face — the panel a shopper turns the bottle for.
    { name: "groundnut-back", panel: PANELS.golden, wrap: 150 },
  ];

  for (const s of shots) {
    const flat = await panelOf(LABEL, s.panel);
    const composed = await applyLabel(BOTTLE, flat, BAND, { wrap: s.wrap });
    const out = path.join(outDir, `${s.name}.webp`);
    await sharp(composed).resize({ width: 1400 }).webp({ quality: 92 }).toFile(out);
    console.log(`  ✓ ${path.relative(ROOT, out)}`);

    // Review copy alongside the rest of the gallery proofs.
    const review = path.join(process.env.HOME ?? ROOT, "Downloads", "nutrigreenz-gallery");
    await mkdir(review, { recursive: true });
    await writeFile(path.join(review, `${s.name}.png`), composed);
  }

  // The bare bottle is a deliverable in its own right.
  const bare = path.join(outDir, "groundnut-bottle-empty.webp");
  await sharp(BOTTLE).resize({ width: 1400 }).webp({ quality: 92 }).toFile(bare);
  console.log(`  ✓ ${path.relative(ROOT, bare)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
