/**
 * Render the oil label front face in both themes.
 *
 * Run:  node scripts/gallery/build-label-faces.mjs
 *
 * Output is the FLAT face. build-bottle-shots.mjs wraps it onto a bottle, so
 * placement is fixed once here and every pack size inherits it.
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { labelFaceHtml, THEMES } from "./label-face.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "assets-src/label-faces");
const REVIEW = path.join(process.env.HOME ?? ROOT, "Downloads", "nutrigreenz-gallery");

const SKU = {
  id: "groundnut-1l",
  method: "COLD-PRESSED",
  name: "GROUNDNUT<br>OIL",
  from: "TRADITIONALLY COLD-PRESSED<br>BY THE FARMERS OF TELANGANA",
  qty: "1L / 909g",
  bowl: "file://" + path.join(ROOT, "assets-src/bowl-groundnut.png"),
};

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(REVIEW, { recursive: true });

  const browser = await chromium.launch();
  // 4x, then downsample — the botanical hairlines and small caps have to
  // survive being wrapped onto a curve.
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 4,
  });
  const tmp = path.join(ROOT, "public/__label-render.html");

  for (const theme of Object.keys(THEMES)) {
    await writeFile(tmp, labelFaceHtml(SKU, theme), "utf8");
    await page.goto(`file://${tmp}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    // Fail loudly rather than shipping a face with a missing bowl or a
    // fallback serif — both look plausible and are wrong.
    const bad = await page.evaluate(() => ({
      broken: [...document.images].filter((i) => !i.complete || !i.naturalWidth).length,
      fontOk: document.fonts.check('700 40px "Hanken Grotesk"'),
    }));
    if (bad.broken) throw new Error(`${theme}: ${bad.broken} image(s) failed to load`);
    if (!bad.fontOk) throw new Error(`${theme}: Hanken Grotesk did not load`);

    const png = await page.screenshot({ type: "png" });
    const file = path.join(OUT, `groundnut-1l-${theme}.png`);
    await sharp(png).resize(1400, 1000).png().toFile(file);
    await writeFile(path.join(REVIEW, `label-face-${theme}.png`), await sharp(png).png().toBuffer());
    console.log(`  ✓ ${theme}`);
  }

  await browser.close();
  await rm(tmp, { force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
