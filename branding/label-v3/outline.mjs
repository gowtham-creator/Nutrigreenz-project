/**
 * Text → vector outlines.
 *
 * Two reasons this exists rather than leaving live <text> everywhere:
 *
 *  1. A named font only renders if the opening machine has it installed. The
 *     first proof of this label silently fell back to Helvetica, and embedding
 *     the font as base64 @font-face did not help either, because neither librsvg
 *     nor Illustrator honours @font-face on SVG import. Outlines always render
 *     exactly as designed, on any machine, in any application.
 *  2. It is what a printer wants. Outlined type cannot substitute or reflow on
 *     their RIP, which is the failure that ruins a print run.
 *
 * The editable master keeps live text; this produces the OUTLINED sibling. That
 * is the standard split — edit the master, hand over the outlines.
 */
import { createRequire } from "node:module";

// fontkit ships CJS with no default export under ESM — bridge it.
const fontkit = createRequire(import.meta.url)("fontkit");
import { join } from "node:path";

const cache = new Map();

/** Load a variable font instanced at a given weight. */
function faceFor(dir, file, weight) {
  const key = `${file}@${weight}`;
  if (!cache.has(key)) {
    const f = fontkit.openSync(join(dir, file));
    cache.set(key, f.variationAxes?.wght ? f.getVariation({ wght: weight }) : f);
  }
  return cache.get(key);
}

const FILES = { "Roboto Slab": "RobotoSlab[wght].ttf", "Hanken Grotesk": "HankenGrotesk[wght].ttf" };

/**
 * Fallback face for characters the brand fonts do not carry.
 *
 * Neither Roboto Slab nor Hanken Grotesk includes U+20B9, the rupee sign — and
 * MRP in rupees is a mandatory Legal Metrology declaration, so "Rs." is not an
 * acceptable substitute on an Indian pack. Without this the glyph silently
 * became a .notdef box, which is precisely the kind of defect that survives to
 * press because it looks like a rendering artefact rather than a missing glyph.
 */
const FALLBACK = "NotoSans[wdth,wght].ttf";

/** Split a string into runs of characters the primary face can actually draw. */
function splitByCoverage(face, fb, str) {
  const runs = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    const covered = face.hasGlyphForCodePoint
      ? face.hasGlyphForCodePoint(cp)
      : (face.glyphForCodePoint(cp)?.id ?? 0) !== 0;
    const use = covered ? "primary" : "fallback";
    if (runs.length && runs[runs.length - 1].use === use) runs[runs.length - 1].text += ch;
    else runs.push({ use, text: ch });
  }
  return runs;
}

/**
 * Convert one text run to an SVG <path>.
 *
 * `letter-spacing` is applied per glyph rather than by the renderer, because
 * once type is outlined there is no renderer left to apply it — the tracking
 * has to be baked into the geometry or the outlined version drifts away from
 * the editable one.
 */
export function textToPath(dir, {
  x, y, str, size, weight = 400, family = "Hanken Grotesk",
  fill = "#000", anchor = "start", tracking = 0,
}) {
  const face = faceFor(dir, FILES[family] ?? FILES["Hanken Grotesk"], weight);
  const fb = faceFor(dir, FALLBACK, weight);
  const runs = splitByCoverage(face, fb, str);

  // Two passes: measure everything first so `anchor` can be resolved, then draw.
  const laid = [];
  let total = 0;
  for (const r of runs) {
    const f = r.use === "primary" ? face : fb;
    const scale = size / f.unitsPerEm;
    const run = f.layout(r.text);
    for (const g of run.glyphs) {
      laid.push({ g, scale, adv: g.advanceWidth * scale + tracking });
      total += g.advanceWidth * scale + tracking;
    }
  }
  if (laid.length > 0) total -= tracking;

  let penX = anchor === "middle" ? x - total / 2 : anchor === "end" ? x - total : x;
  const parts = [];
  for (const { g, scale, adv } of laid) {
    const d = g.path.toSVG();
    if (d) {
      // fontkit's y axis points up; SVG's points down.
      parts.push(`<path d="${d}" transform="translate(${penX.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(6)} ${(-scale).toFixed(6)})" fill="${fill}"/>`);
    }
    penX += adv;
  }
  return parts.join("");
}

/** Measured width of a run — used to check nothing overflows the safe zone. */
export function measure(dir, { str, size, weight = 400, family = "Hanken Grotesk", tracking = 0 }) {
  const face = faceFor(dir, FILES[family] ?? FILES["Hanken Grotesk"], weight);
  const fb = faceFor(dir, FALLBACK, weight);
  let total = 0, n = 0;
  for (const r of splitByCoverage(face, fb, str)) {
    const f = r.use === "primary" ? face : fb;
    const scale = size / f.unitsPerEm;
    for (const g of f.layout(r.text).glyphs) { total += g.advanceWidth * scale + tracking; n++; }
  }
  return Math.max(0, total - (n ? tracking : 0));
}
