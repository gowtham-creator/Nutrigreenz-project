/**
 * Nutri Greenz label artwork generator — Groundnut Oil 1 L.
 *
 * Emits true vector SVG at exact millimetre dimensions. SVG opens natively in
 * Illustrator with live, editable text and named layers, which is what makes
 * this a working master rather than a picture of a label.
 *
 * WHAT THIS IS: a design proof for client sign-off.
 * WHAT THIS IS NOT: a press-ready file. Four things block that, all of them
 * inputs nobody has supplied yet, and none of which this script will invent:
 *
 *   1. The vendor dieline. 95 x 120 mm is the build target from Label-Spec.md,
 *      not a measured die. It is also almost certainly a FRONT PANEL, not a
 *      wrap: a 1 L bottle is roughly 250-300 mm around.
 *   2. Colour. SVG is RGB. The brand greens and the brass must be assigned
 *      Pantone spots (or CMYK builds) and drawn down on the real stock before
 *      any plate is cut.
 *   3. Nutrition figures. Every number in the panel is a placeholder pending a
 *      lab COA. Printing generic values would be a misdeclaration.
 *   4. The FSSAI licence number, and whether it is the manufacturer's or the
 *      marketer's.
 *
 * Deliberately absent: the row of three circular badges (FIRST PRESS /
 * 0% CHOLESTEROL / RICH IN OMEGA) on the current mockups. "0% cholesterol" is
 * true of every vegetable oil and is a regulated nutrient claim; "rich in omega"
 * needs a substantiated figure. They are replaced by the traceability panel,
 * which is the thing this brand can print and its competitors cannot.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { textToPath, measure } from "./outline.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));

/* ── Dimensions (mm) ─────────────────────────────────────────────────────── */
const W = 95;          // panel width  — BUILD TARGET, awaiting vendor dieline
const H = 120;         // panel height — BUILD TARGET, awaiting vendor dieline
const BLEED = 3;       // per Label-Spec.md
const SAFE = 4;        // keep all critical content inside this

const PW = W + BLEED * 2;
const PH = H + BLEED * 2;
const X0 = BLEED;      // dieline origin inside the bleed box
const Y0 = BLEED;

/* ── Palette (RGB — see note 2 above) ────────────────────────────────────── */
const C = {
  forest: "#1E4A33",
  deep: "#17402B",
  cream: "#F0E9D9",
  brass: "#9A7B3C",
  gold: "#B79A46",
  veg: "#2E9B37",   // prescribed by regulation — confirm exact value
  k: "#000000",
};

/* ── Type (SIL OFL, same families as the storefront) ─────────────────────── */
const SERIF = "Roboto Slab";
const SANS = "Hanken Grotesk";

/**
 * The fonts are embedded base64 rather than merely named.
 *
 * Naming a font in an SVG only works if the machine opening it already has that
 * font. The first proof rendered in Helvetica because it did not — and a label
 * that silently substitutes its typeface is the single most common way artwork
 * reaches a printer looking wrong. Both families are SIL OFL / Apache 2.0, so
 * embedding and redistributing them is permitted; the licences ship alongside
 * in fonts/.
 *
 * Illustrator does not honour @font-face on SVG import, so the outlined variant
 * built below is the one to hand a printer. This embed is what makes the PNG
 * proof and any browser preview correct.
 */
function fontFace(family, file, weightRange) {
  const b64 = readFileSync(join(OUT, "fonts", file)).toString("base64");
  return `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${b64}) format('truetype');font-weight:${weightRange};font-style:normal;}`;
}
const FONT_CSS = () =>
  fontFace(SERIF, "RobotoSlab[wght].ttf", "100 900") +
  fontFace(SANS, "HankenGrotesk[wght].ttf", "100 900");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** When true, every text run is emitted as vector paths instead of <text>. */
let OUTLINED = false;

/** A text run. Sizes are in mm so they map 1:1 to the printed result. */
function t(x, y, str, {
  size = 3, weight = 400, fill = C.deep, family = SANS,
  anchor = "start", tracking = 0, lineHeight = 1.25, maxLines = 1,
} = {}) {
  const lines = String(str).split("\n").slice(0, maxLines === 1 ? 1 : 99);
  return lines.map((ln, i) => {
    const ly = y + i * size * lineHeight;
    if (OUTLINED) {
      return textToPath(join(OUT, "fonts"), { x, y: ly, str: ln, size, weight, family, fill, anchor, tracking });
    }
    return `<text x="${x}" y="${ly}" font-family="${family}" font-size="${size}" ` +
      `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ` +
      `letter-spacing="${tracking}">${esc(ln)}</text>`;
  }).join("\n      ");
}

/** Placeholder text — rendered in magenta so it cannot survive to press unnoticed. */
function ph(x, y, str, opts = {}) {
  return t(x, y, str, { ...opts, fill: "#E5007D" });
}

/* ── FRONT PANEL ─────────────────────────────────────────────────────────── */
/*
 * Laid out as four bands that cannot overlap, because the first proof put the
 * net-quantity figure underneath the traceability strip and hid the veg mark
 * behind it entirely — and net quantity and the veg mark are both mandatory
 * declarations, not decoration.
 *
 *   0–24   masthead (forest)
 *   26–90  product panel (cream)
 *   93–105 traceability strip
 *  107–120 statutory footer: veg mark left, net quantity right
 */
const BAND = { head: 24, panelTop: 26, panelBot: 90, traceTop: 92, traceH: 12, footTop: 105 };

function front() {
  const cx = X0 + W / 2;
  const ft = Y0 + BAND.traceTop;
  const ff = Y0 + BAND.footTop;
  return `
  <g id="BACKGROUND">
    <rect x="0" y="0" width="${PW}" height="${PH}" fill="${C.forest}"/>
    <rect x="${X0 + 7}" y="${Y0 + BAND.panelTop}" width="${W - 14}" height="${BAND.panelBot - BAND.panelTop}" rx="9" fill="${C.cream}"/>
  </g>

  <g id="TYPE">
      ${t(cx, Y0 + 13, "NUTRI GREENZ", { size: 5.2, weight: 700, fill: C.cream, family: SERIF, anchor: "middle", tracking: 0.9 })}
      ${t(cx, Y0 + 18.5, "FARM TECHNOLOGIES", { size: 1.9, weight: 500, fill: C.gold, anchor: "middle", tracking: 1.5 })}

      ${t(cx, Y0 + 36, "COLD-PRESSED", { size: 2.5, weight: 700, fill: C.brass, anchor: "middle", tracking: 2.2 })}
      ${t(cx, Y0 + 48, "GROUNDNUT", { size: 9, weight: 700, fill: C.deep, family: SERIF, anchor: "middle", tracking: -0.2 })}
      ${t(cx, Y0 + 58, "OIL", { size: 9, weight: 700, fill: C.deep, family: SERIF, anchor: "middle", tracking: -0.2 })}
      <line x1="${cx - 16}" y1="${Y0 + 62}" x2="${cx + 16}" y2="${Y0 + 62}" stroke="${C.gold}" stroke-width="0.4"/>
      ${t(cx, Y0 + 66.5, "WOOD-PRESSED  ·  UNREFINED", { size: 2.2, weight: 600, fill: C.forest, anchor: "middle", tracking: 1.1 })}
  </g>

  <g id="HERO-PLACEHOLDER">
    <!-- No approved hero exists. The current mockup uses an AI-rendered peanut
         bowl at ~269 DPI, below press minimum. Left framed and flagged rather
         than filled with something that cannot legally or physically print. -->
    <rect x="${cx - 16}" y="${Y0 + 70}" width="32" height="17" rx="2"
          fill="none" stroke="#E5007D" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>
    ${ph(cx, Y0 + 79.5, "HERO — AWAITING ASSET", { size: 1.8, weight: 600, anchor: "middle" })}
  </g>

  <g id="TRACEABILITY">
    <!-- Replaces the FIRST PRESS / 0% CHOLESTEROL / RICH IN OMEGA roundels.
         "0% cholesterol" is true of every vegetable oil and is a regulated
         nutrient claim; "rich in omega" needs a substantiated figure. This panel
         is what the brand can print and its competitors cannot. -->
    <rect x="${X0 + 7}" y="${ft}" width="${W - 14}" height="${BAND.traceH}" rx="2" fill="${C.deep}"/>
      ${t(X0 + 11, ft + 4.5, "TRACE THIS BOTTLE", { size: 1.9, weight: 700, fill: C.gold, tracking: 1.2 })}
      ${ph(X0 + 11, ft + 8.8, "LOT <<BATCH>>  ·  <<FARM>>, <<DISTRICT>>", { size: 1.75, weight: 500 })}
    <rect x="${X0 + W - 19}" y="${ft + 1.5}" width="9" height="9" fill="${C.cream}"/>
      ${ph(X0 + W - 14.5, ft + 6.7, "QR", { size: 2.2, weight: 700, anchor: "middle" })}
  </g>

  <g id="MANDATORY">
    <!-- Veg mark: filled circle inside a square outline. Geometry and the green
         are prescribed by regulation, not brand choices — confirm both. -->
    <g id="VEG-MARK" transform="translate(${X0 + 8}, ${ff + 4})">
      <rect x="0" y="0" width="6.5" height="6.5" fill="none" stroke="${C.veg}" stroke-width="0.65"/>
      <circle cx="3.25" cy="3.25" r="1.85" fill="${C.veg}"/>
    </g>
      ${t(X0 + W - 8, ff + 3, "NET QUANTITY", { size: 1.8, weight: 600, fill: C.gold, anchor: "end", tracking: 1 })}
      ${t(X0 + W - 8, ff + 10.5, "1 L", { size: 6.4, weight: 700, fill: C.cream, family: SERIF, anchor: "end" })}
  </g>`;
}

/* ── BACK PANEL ──────────────────────────────────────────────────────────── */
function back() {
  let y = Y0 + 6.5;
  const L = X0 + 7;
  const R = X0 + W - 7;
  const rows = [];
  const line = (str, o = {}) => { rows.push(t(L, y, str, o)); y += (o.size ?? 2.2) * 1.5; };
  const gap = (n = 2) => { y += n; };

  rows.push(`<rect x="0" y="0" width="${PW}" height="${PH}" fill="${C.cream}"/>`);

  line("INGREDIENTS", { size: 2.2, weight: 700, tracking: 0.8 });
  line("Cold-pressed Groundnut Oil (100%)", { size: 2.2, weight: 400 });
  gap(1.5);

  // A4 — groundnut is a listed allergen. Boxed because it must not be missed.
  rows.push(`<rect x="${L - 2}" y="${y - 3}" width="${W - 10}" height="7.5" rx="1" fill="none" stroke="${C.deep}" stroke-width="0.4"/>`);
  line("ALLERGEN: CONTAINS GROUNDNUT (PEANUT).", { size: 2.2, weight: 700 });
  line("Pressed on equipment that also handles sesame, mustard and coconut.", { size: 1.9, weight: 400 });
  gap(2.5);

  line("NUTRITIONAL INFORMATION", { size: 2.2, weight: 700, tracking: 0.8 });
  rows.push(ph(L, y, "ALL VALUES PROVISIONAL — REPLACE FROM LAB COA BEFORE PRINT", { size: 1.7, weight: 600 }));
  y += 3.5;
  const nut = [
    ["Energy", "<<kcal>>"], ["Total Fat", "<<g>>"], ["  Saturated", "<<g>>"],
    ["  Trans fat", "<<g>>"], ["  MUFA", "<<g>>"], ["  PUFA", "<<g>>"],
    ["Cholesterol", "<<mg>>"], ["Protein", "<<g>>"], ["Carbohydrate", "<<g>>"],
  ];
  rows.push(t(L, y, "Per 100 ml", { size: 1.8, weight: 600 }));
  rows.push(t(R, y, "Per serving (14 ml)", { size: 1.8, weight: 600, anchor: "end" }));
  y += 3;
  for (const [k, v] of nut) {
    rows.push(t(L, y, k, { size: 1.9, weight: 400 }));
    rows.push(ph(R - 22, y, v, { size: 1.9, weight: 400, anchor: "end" }));
    rows.push(ph(R, y, v, { size: 1.9, weight: 400, anchor: "end" }));
    rows.push(`<line x1="${L}" y1="${y + 0.9}" x2="${R}" y2="${y + 0.9}" stroke="${C.deep}" stroke-width="0.08" opacity="0.35"/>`);
    y += 2.85;
  }
  gap(1);

  line("STORAGE", { size: 2.1, weight: 700, tracking: 0.8 });
  line("Store in a cool, dark place away from direct sunlight.", { size: 1.9 });
  line("Natural sediment is normal in unrefined oil.", { size: 1.9 });
  gap(2);

  rows.push(t(L, y, "Manufactured & Marketed by", { size: 1.9, weight: 700 })); y += 3;
  line("Nutri Greenz Farm Technologies Pvt. Ltd.", { size: 1.9, weight: 600 });
  line("1st Floor, H.No. 5-35/167, Double Road, Near Moosapet Y Junction,", { size: 1.8 });
  line("Prashanth Nagar, Kukatpally, Hyderabad, Telangana 500072", { size: 1.8 });
  line("Consumer care: +91 8074553370 · nutrigreenzfarm@gmail.com", { size: 1.8 });
  line("Country of origin: India", { size: 1.8, weight: 600 });
  gap(1);

  /* FSSAI mark and the barcode share a row.
     Stacked, the barcode ran past the dieline: the back panel simply carries
     more mandatory content than 120 mm allows at legible type sizes. Pairing
     them is also how real packs lay this out. */
  rows.push(`<rect x="${L}" y="${y}" width="24" height="9" rx="1" fill="none" stroke="${C.deep}" stroke-width="0.4"/>`);
  rows.push(ph(L + 12, y + 5.5, "FSSAI LOGO", { size: 1.7, weight: 600, anchor: "middle" }));
  rows.push(`<rect x="${R - 27}" y="${y}" width="27" height="9" fill="none" stroke="#E5007D" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`);
  rows.push(ph(R - 13.5, y + 5.4, "EAN-13 — NEEDS GS1", { size: 1.6, weight: 600, anchor: "middle" }));
  y += 11.5;

  rows.push(ph(L, y, "FSSAI Lic. No. <<14-DIGIT — UNCONFIRMED>>", { size: 1.8, weight: 600 }));
  rows.push(ph(L, y + 3, "<<manufacturer's or marketer's licence? — confirm>>", { size: 1.6 }));
  y += 5.5;

  rows.push(`<rect x="${L}" y="${y}" width="${W - 14}" height="9.5" rx="1" fill="none" stroke="#E5007D" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`);
  rows.push(ph(L + 2, y + 3.8, "VARIABLE DATA — over-printed at packing", { size: 1.8, weight: 700 }));
  rows.push(ph(L + 2, y + 7.2, "Batch  ·  Mfg date  ·  Best before  ·  MRP ₹500 (incl. of all taxes)", { size: 1.8 }));
  y += 9.5;

  /* Guard: nothing may cross the safe zone. Caught the barcode overflow that
     three visual passes had missed. */
  const bottomLimit = Y0 + H - SAFE;
  if (y > bottomLimit) {
    console.warn(`  ⚠ BACK PANEL OVERFLOWS: content ends at ${y.toFixed(1)}mm, safe limit ${bottomLimit}mm`);
  } else {
    console.log(`  back panel ends at ${y.toFixed(1)}mm vs ${bottomLimit}mm safe limit — OK`);
  }

  return `<g id="BACK">\n      ${rows.join("\n      ")}\n  </g>`;
}

/* ── Non-printing guides ─────────────────────────────────────────────────── */
function guides() {
  return `
  <g id="SAFE-ZONE" data-printing="false">
    <rect x="${X0 + SAFE}" y="${Y0 + SAFE}" width="${W - SAFE * 2}" height="${H - SAFE * 2}"
          fill="none" stroke="#00A0FF" stroke-width="0.2" stroke-dasharray="2 2"/>
  </g>
  <g id="DIELINE" data-printing="false">
    <!-- Spot colour CutContour, 100% magenta, stroke only, set to overprint.
         Illustrator: assign the CutContour swatch after opening. -->
    <rect x="${X0}" y="${Y0}" width="${W}" height="${H}"
          fill="none" stroke="#FF00FF" stroke-width="0.25"/>
  </g>`;
}

function doc(title, body, outlined = false) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ${title}
  Panel ${W} x ${H} mm  ·  bleed ${BLEED} mm  ·  safe margin ${SAFE} mm
  DESIGN PROOF — not press-ready. See build-label.mjs header for the four blockers.
  Magenta type = placeholder that must be replaced before print.
-->
<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm"
     viewBox="0 0 ${PW} ${PH}" version="1.1">
  <title>${esc(title)}</title>
  ${outlined ? "<!-- Type converted to outlines: no fonts required. -->" : `<defs><style type="text/css"><![CDATA[${FONT_CSS()}]]></style></defs>`}
${body}
${guides()}
</svg>
`;
}

mkdirSync(OUT, { recursive: true });

/* Widest line on the front, checked against the safe zone rather than eyeballed. */
const widest = measure(join(OUT, "fonts"), { str: "GROUNDNUT", size: 9, weight: 700, family: SERIF, tracking: -0.2 });
const safeW = W - SAFE * 2;
console.log(`  widest headline: ${widest.toFixed(1)}mm vs ${safeW}mm safe width — ${widest <= safeW ? "OK" : "OVERFLOW"}`);

for (const outlined of [false, true]) {
  OUTLINED = outlined;
  const tag = outlined ? "OUTLINED" : "EDITABLE";
  const files = [
    [`NG_oil_groundnut_1L_glass_FRONT_v01_${tag}.svg`, doc("Nutri Greenz — Groundnut Oil 1 L — front panel", front(), outlined)],
    [`NG_oil_groundnut_1L_glass_BACK_v01_${tag}.svg`, doc("Nutri Greenz — Groundnut Oil 1 L — back panel", back(), outlined)],
  ];
  for (const [name, svg] of files) {
    writeFileSync(join(OUT, name), svg, "utf8");
    console.log(`  ${name}  ${(svg.length / 1024).toFixed(1)} KB`);
  }
}
console.log(`\n  Panel ${W}x${H}mm + ${BLEED}mm bleed. Fonts: ${SERIF} / ${SANS} (SIL OFL / Apache 2.0).`);
