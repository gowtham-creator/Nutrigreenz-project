/**
 * Render PDP gallery panels to WebP.
 *
 * Run:  node scripts/gallery/build.mjs [product-slug]
 *
 * Renders each panel at 2× and downsamples, so type is sharp on a retina
 * screen without shipping a 2400px file. Output goes to
 * public/images/products/<category>/gallery/.
 *
 * Assets are loaded straight off disk through a file:// base URL, so the
 * generator needs no dev server and cannot pick up a stale cached image.
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PRODUCTS, PENDING } from "./data.mjs";
import { cutout } from "./cutout.mjs";
import {
  CSS,
  nutritionPanel,
  ingredientPanel,
  sourcingPanel,
  usagePanel,
  heroPanel,
  comparisonPanel,
  benefitsPanel,
} from "./panels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = path.join(ROOT, "public");
const SIZE = 1200;
const SCALE = 2;

/** Panels per product. The review panel is absent on purpose — see PENDING. */
function panelsFor(p) {
  const dir = `/images/products/${p.category}`;
  const photo = (name, fallback) => {
    const f = path.join(PUBLIC, dir.slice(1), name);
    return existsSync(f) ? `${dir}/${name}` : fallback;
  };

  /*
   * Real photography, generated for Nutri Greenz rather than borrowed.
   *
   * The bowl slot previously fell back to oils-infographic.webp — an
   * infographic with its own captions, nested inside another infographic.
   */
  const storyPhoto =
    p.category === "oils"
      ? photo("oils-farm.webp", photo("oils-lifestyle.webp", p.bottle))
      : photo("ghee-farm.webp", p.bottle);
  const bowlPhoto =
    p.category === "oils"
      ? photo("oils-bowl.webp", p.bottle)
      : photo("ghee-benefit-bowl.webp", p.bottle);

  /*
   * Nutrition is rendered once PER PACK SIZE.
   *
   * "Servings per container" is the one figure on these panels that changes
   * with the bottle — 65 for a litre, 32 for 500 ml. A single panel reused
   * across sizes would print a wrong number on a food product, so each size
   * gets its own file and the storefront picks by SKU.
   */
  const sizes = Object.keys(p.nutrition.servingsPerContainer ?? { "1L": 0 });

  return [
    ["hero", heroPanel(p)],
    ["ingredient", ingredientPanel(p)],
    ["sourcing", sourcingPanel(p, storyPhoto)],
    ["benefits", benefitsPanel(p, bowlPhoto)],
    ["comparison", comparisonPanel(p)],
    // Photo tiles only when EVERY mode has a real file — a half-photo,
    // half-icon row looks like a build error rather than a design.
    ["usage", usagePanel(p, p.usage.modes.every((m) => existsSync(path.join(PUBLIC, m.img.slice(1)))))],
    ...sizes.map((s) => [`nutrition-${s.toLowerCase()}`, nutritionPanel(p, s)]),
  ];
}

/**
 * Rewrite site-absolute asset paths to on-disk file URLs.
 *
 * `/images/foo.webp` inside a `file://` page resolves against the FILESYSTEM
 * root, not `public/` — so every image silently rendered as nothing. Absolute
 * file URLs remove the ambiguity.
 */
function resolveAssets(markup) {
  return markup.replace(/(["'(])\/images\//g, `$1file://${PUBLIC}/images/`);
}

function html(body) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;700;800&family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <style>
    @font-face{font-family:Hanken;src:local("Hanken Grotesk")}
    body{font-family:"Hanken Grotesk",Hanken,system-ui,sans-serif}
    .src-lead{font-family:Lora,Georgia,serif !important}
    ${CSS}
  </style></head><body>${body}</body></html>`;
}

async function main() {
  const only = process.argv[2];
  const slugs = only ? [only] : Object.keys(PRODUCTS);
  const missing = slugs.filter((s) => !PRODUCTS[s]);
  if (missing.length) {
    console.error(`Unknown product: ${missing.join(", ")}`);
    console.error(`Known: ${Object.keys(PRODUCTS).join(", ")}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: SCALE,
  });

  // Scratch page, inside public/ so file:// asset loads are same-origin.
  const tmpPage = path.join(PUBLIC, "__gallery-render.html");

  const written = [];
  const cacheDir = path.join(ROOT, ".gallery-cache");

  for (const slug of slugs) {
    const p = PRODUCTS[slug];
    /*
     * Swap the bottle for a background-free cutout.
     *
     * Done once per product and cached — the flood fill is the slowest step
     * here, and the source render never changes between panels.
     */
    const cut = await cutout(path.join(PUBLIC, p.bottle.slice(1)), cacheDir);
    p.bottle = `file://${cut}`;
    // The refined-oil bottle needs the same treatment — it was shipped with its
    // white studio box intact, which painted over the right column's copy.
    if (p.refinedBottle?.startsWith("/")) {
      const cutR = await cutout(path.join(PUBLIC, p.refinedBottle.slice(1)), cacheDir);
      p.refinedBottle = `file://${cutR}`;
    }
    const outDir = path.join(PUBLIC, "images", "products", p.category, "gallery");
    await mkdir(outDir, { recursive: true });

    for (const [name, body] of panelsFor(p)) {
      /*
       * The page is written into public/ and opened as a real file, rather than
       * pushed in with setContent. setContent leaves the document on
       * about:blank, and Chromium refuses to load file:// subresources from
       * there — so every image came back blank.
       */
      await writeFile(tmpPage, resolveAssets(html(body)), "utf8");
      await page.goto(`file://${tmpPage}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);

      /*
       * Fail loudly on a missing asset or an unloaded brand font.
       *
       * Both failed silently on the first run — every image rendered as blank
       * space and the type fell back to a serif — and the output still looked
       * plausible enough to ship. A panel that is quietly wrong is worse than
       * one that refuses to build.
       */
      const bad = await page.evaluate(() => {
        const broken = [...document.images]
          .filter((i) => !i.complete || i.naturalWidth === 0)
          .map((i) => i.src);
        const fontOk = document.fonts.check('700 40px "Hanken Grotesk"');
        return { broken, fontOk };
      });
      if (bad.broken.length) {
        throw new Error(`${slug}-${name}: image failed to load\n  ${bad.broken.join("\n  ")}`);
      }
      if (!bad.fontOk) {
        throw new Error(`${slug}-${name}: Hanken Grotesk did not load — type would fall back to a serif`);
      }

      const png = await page.screenshot({ type: "png" });
      const out = path.join(outDir, `${slug}-${name}.webp`);
      await sharp(png).resize(SIZE, SIZE).webp({ quality: 88 }).toFile(out);

      /*
       * Review copies go to ~/Downloads, NOT into public/.
       *
       * public/ is served, and these PNGs are ~850 KB each against ~40 KB for
       * the WebP that actually ships — 14 MB of unversioned images the CDN
       * would happily serve to anyone who guessed the path. That is the same
       * bandwidth leak that exhausted the Vercel transfer budget once already.
       */
      const review = path.join(
        process.env.HOME ?? ROOT,
        "Downloads",
        "nutrigreenz-gallery",
      );
      await mkdir(review, { recursive: true });
      await writeFile(path.join(review, `${slug}-${name}.png`), png);

      written.push(path.relative(ROOT, out));
      console.log(`  ✓ ${slug}-${name}`);
    }
  }

  await browser.close();
  // Never leave the scratch page behind — public/ is served to the world.
  await rm(tmpPage, { force: true });

  /*
   * Emit a manifest of what was ACTUALLY rendered.
   *
   * The storefront imports this rather than composing paths by hand, so it
   * cannot reference a panel that was never built — the failure mode being a
   * broken image on a live product page, which is worse than no panel at all.
   * Regenerating the images regenerates the manifest in the same run.
   */
  if (!only) {
    const manifest = {};
    for (const slug of slugs) {
      const p = PRODUCTS[slug];
      const dir = `/images/products/${p.category}/gallery`;
      const names = panelsFor(p).map(([n]) => n);
      manifest[slug] = {
        category: p.category,
        title: p.shortTitle,
        // Order matters: this is the order a shopper swipes through.
        panels: names
          .filter((n) => !n.startsWith("nutrition-"))
          .map((n) => ({ name: n, src: `${dir}/${slug}-${n}.webp` })),
        nutritionBySize: Object.fromEntries(
          names
            .filter((n) => n.startsWith("nutrition-"))
            .map((n) => [n.replace("nutrition-", ""), `${dir}/${slug}-${n}.webp`]),
        ),
      };
    }
    const file = path.join(ROOT, "src/components/ng/pdp/gallery-manifest.ts");
    await writeFile(
      file,
      `// GENERATED by scripts/gallery/build.mjs — do not edit by hand.\n` +
        `// Run \`node scripts/gallery/build.mjs\` to regenerate.\n\n` +
        `export interface GalleryPanel { name: string; src: string }\n` +
        `export interface ProductGallery {\n` +
        `  category: string;\n  title: string;\n` +
        `  panels: GalleryPanel[];\n` +
        `  /** Keyed by lower-cased pack size, e.g. "1l", "500ml". */\n` +
        `  nutritionBySize: Record<string, string>;\n}\n\n` +
        `export const GALLERY: Record<string, ProductGallery> = ${JSON.stringify(manifest, null, 2)};\n`,
      "utf8",
    );
    console.log(`\n  ✓ manifest → ${path.relative(ROOT, file)}`);
  }

  console.log(`\n${written.length} panels written.`);
  console.log("\nStill provisional — see scripts/gallery/data.mjs:");
  for (const n of PENDING) console.log(`  · ${n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
