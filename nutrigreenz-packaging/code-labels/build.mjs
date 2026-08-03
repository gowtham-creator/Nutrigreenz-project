/**
 * build.mjs — Nutri Greenz wrap labels, generated from a spec and exported to
 * print-ready PDF.
 *
 * Why HTML/CSS rather than the Illustrator scripts this replaces: the ExtendScript
 * route positioned every element by hand-computed millimetre, so each type-size
 * change meant re-deriving a dozen y-offsets and re-running to see whether
 * anything collided. Here the browser does the layout — flexbox and grid keep
 * blocks apart by construction, text wraps instead of overflowing, and `mm` in
 * CSS maps 1:1 onto the PDF page.
 *
 * LABEL SIZE IS COMPUTED, NOT GUESSED. A wrap label's length is the jar's
 * circumference plus an overlap; its height comes from the jar's straight wall.
 * The earlier versions used a 280x120 example from the brief for every SKU,
 * which is why the artwork never matched a real container.
 *
 *   node build.mjs            # all SKUs
 *   node build.mjs a2-bilona-500  # one
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, "..");
const OUT = join(PKG, "50_exports", "print");
const BLEED = 3;   // mm, all round
const SAFE = 4;    // mm inside trim — nothing critical crosses this

/* ── the catalogue ──────────────────────────────────────────────────────
 * `jarDia` and `wallH` are the physical container. Everything else on the
 * label is derived from them, so a 250ml and a 1L are genuinely different
 * artboards rather than one file scaled.
 *
 * DIMENSIONS_UNCONFIRMED: these are standard sizes for squat ghee jars.
 * Replace with the vendor's measurements before any plate is cut.
 */
const SKUS = [
  {
    id: "a2-bilona-500", name: "A2 BILONA GHEE", volume: "500 ml",
    jarDia: 75, wallH: 95,
    ingredients: "A2 Desi cow milk fat.",
    story: "Churned from curd, never cream — so every spoon carries the sweet caramel aroma our grandmothers knew.",
    serving: "1 Tbsp (14 g)",
  },
  {
    id: "a2-bilona-250", name: "A2 BILONA GHEE", volume: "250 ml",
    jarDia: 62, wallH: 72,
    ingredients: "A2 Desi cow milk fat.",
    story: "Churned from curd, never cream — so every spoon carries the sweet caramel aroma our grandmothers knew.",
    serving: "1 Tbsp (14 g)",
  },
  {
    id: "a2-bilona-1l", name: "A2 BILONA GHEE", volume: "1 L",
    jarDia: 95, wallH: 118,
    ingredients: "A2 Desi cow milk fat.",
    story: "Churned from curd, never cream — so every spoon carries the sweet caramel aroma our grandmothers knew.",
    serving: "1 Tbsp (14 g)",
  },
  {
    /* Tall round oil bottle, as in the client's reference photographs. */
    id: "groundnut-oil-1l", name: "GROUNDNUT OIL", volume: "1 L",
    jarDia: 85, wallH: 132, accent: "oil",
    ingredients: "Cold-pressed Groundnut (Arachis hypogaea) oil.",
    story: "Purely pressed, never processed. We draw our groundnut oil on a wooden ghani turning slow and cold, so every drop keeps its aroma and natural antioxidants.",
    serving: "1 Tbsp (14 ml)",
    allergen: "CONTAINS GROUNDNUT (PEANUT). Pressed on equipment shared with sesame, mustard and coconut.",
  },
  {
    id: "buffalo-500", name: "CULTURED BUFFALO GHEE", volume: "500 ml",
    jarDia: 75, wallH: 95,
    ingredients: "Buffalo milk fat, cultured.",
    story: "Cultured slowly, churned by hand — a denser, whiter ghee with the deep aroma our grandmothers cooked with.",
    serving: "1 Tbsp (14 g)",
  },
];

const COMPANY = {
  legal: "Nutri Greenz Farm Technologies Pvt. Ltd.",
  addr: "1st Floor, H.No. 5-35/167, Double Road, Moosapet,<br>Kukatpally, Hyderabad, Telangana 500072",
  addrShort: "Kukatpally, Hyderabad, Telangana 500072",
  phone: "+91 8074553370",
  email: "nutrigreenzfarm@gmail.com",
};

/* Every value the client has not supplied is a visible magenta placeholder.
   A plausible-looking invented FSSAI number or calorie figure is far more
   dangerous than an obvious blank. */
const F = (t) => `<span class="flag">&lt;&lt;${t}&gt;&gt;</span>`;

/* Minimal inline marks. The certification logos are PLACEHOLDER CHIPS — the
   real ZED / ISO / Swachh Bharat artwork is supplied by the client and must not
   be redrawn by hand, since each is a registered mark with its own usage rules. */
const ICON = {
  fb: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"/></svg>`,
  ig: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  recycle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 18H4.5l2-3.5M12 4l2.2 3.8M17 18h2.5l-2-3.5M9.8 7.8 12 4M7 18l3.4-6M17 18l-3.4-6"/><path d="m5.2 13 1.8-3M18.8 13 17 10M10.5 20h3"/></svg>`,
};

/* Condensed set for small packs — the mandatory core. Whether this shortening
   is permitted at this pack size is a question for the labelling consultant,
   not an assertion made here. */
const NUTRITION_SMALL = [
  ["CALORIES", "kcal", 1, 0], ["Total Fat", "g", 1, 0],
  ["Saturated Fat", "g", 0, 1], ["Trans Fat", "g", 0, 1],
  ["Total Carbohydrate", "g", 1, 0], ["Total Sugars", "g", 0, 1],
  ["Protein", "g", 1, 0], ["Sodium", "mg", 1, 0],
];

const NUTRITION = [
  ["CALORIES", "kcal", 1, 0], ["Total Fat", "g", 1, 0],
  ["Saturated Fat", "g", 0, 1], ["Trans Fat", "g", 0, 1],
  ["MUFA", "g", 0, 1], ["PUFA", "g", 0, 1],
  ["Cholesterol", "mg", 1, 0], ["Protein", "g", 1, 0],
  ["Total Carbohydrate", "g", 1, 0], ["Dietary Fibre", "g", 0, 1],
  ["Total Sugars", "g", 0, 1], ["Added Sugars", "g", 0, 2],
  ["Sodium", "mg", 1, 0],
];

/** Decorative scene printed ON the label: trees, sun, cow, grain. */
function motifSVG(w, h, creamW) {
  const tree = (x, y, s, stroke, op) => {
    let p = `<g stroke="${stroke}" stroke-width="${0.3 * s}" fill="none" opacity="${op}" stroke-linecap="round">`;
    p += `<path d="M${x} ${y} q${0.4 * s} ${-4 * s} 0 ${-8 * s}"/>`;
    p += `<path d="M${x} ${y - 3.5 * s} l${-2.4 * s} ${-2 * s}"/><path d="M${x} ${y - 4.6 * s} l${2.4 * s} ${-2 * s}"/>`;
    for (let a = 0; a < 13; a++) {
      const th = Math.PI * (0.06 + 0.88 * a / 12);
      const r = (3.6 + 0.5 * Math.sin(a * 1.9)) * s;
      const lx = x + Math.cos(th) * r, ly = y - 7.4 * s - Math.sin(th) * r * 0.8;
      p += `<ellipse cx="${lx}" cy="${ly}" rx="${1.5 * s}" ry="${1.05 * s}" transform="rotate(${(th * 180 / Math.PI) - 90} ${lx} ${ly})"/>`;
    }
    return p + "</g>";
  };
  const sun = (x, y, r, stroke, op) => {
    let p = `<g stroke="${stroke}" stroke-width="0.34" fill="none" opacity="${op}" stroke-linecap="round"><circle cx="${x}" cy="${y}" r="${r}"/>`;
    for (let a = 0; a < 16; a++) {
      const th = a / 16 * Math.PI * 2;
      p += `<line x1="${x + Math.cos(th) * (r + 1.2)}" y1="${y + Math.sin(th) * (r + 1.2)}" x2="${x + Math.cos(th) * (r + 3)}" y2="${y + Math.sin(th) * (r + 3)}"/>`;
    }
    return p + "</g>";
  };
  const cow = (x, y, s, stroke, op) => {
    let p = `<g stroke="${stroke}" stroke-width="${0.3 * s}" fill="none" opacity="${op}" stroke-linecap="round">`;
    p += `<path d="M${x - 4.6 * s} ${y} q${0.6 * s} ${-2.6 * s} ${3.4 * s} ${-2.5 * s} q${3 * s} 0 ${3.8 * s} ${1.2 * s} l${0.4 * s} ${1.3 * s}"/>`;
    p += `<path d="M${x + 3.9 * s} ${y - 1.3 * s} q${1.8 * s} ${0.2 * s} ${2 * s} ${1.9 * s}"/>`;
    p += `<path d="M${x + 5 * s} ${y - 1.9 * s} l${1 * s} ${-1 * s}"/>`;
    for (let i = 0; i < 4; i++) p += `<line x1="${x - 3.4 * s + i * 2.2 * s}" y1="${y}" x2="${x - 3.4 * s + i * 2.2 * s}" y2="${y + 3.2 * s}"/>`;
    p += `<path d="M${x - 4.6 * s} ${y - 0.4 * s} q${-1.4 * s} ${2 * s} ${-0.8 * s} ${3.4 * s}"/>`;
    return p + "</g>";
  };
  const grain = (x, y, hgt, stroke, op) => {
    let p = `<g stroke="${stroke}" stroke-width="0.26" fill="none" opacity="${op}" stroke-linecap="round">`;
    p += `<path d="M${x} ${y} q${1.1} ${-hgt * 0.5} ${0.3} ${-hgt}"/>`;
    for (let i = 0; i < 8; i++) {
      const t = i / 7, sx = x + 1.1 * Math.sin(t * Math.PI) + 0.3 * t, sy = y - hgt * (0.24 + 0.72 * t);
      p += `<ellipse cx="${sx - 0.9}" cy="${sy - 0.9}" rx="1.1" ry="0.62" transform="rotate(-38 ${sx - 0.9} ${sy - 0.9})"/>`;
      p += `<ellipse cx="${sx + 0.9}" cy="${sy - 0.9}" rx="1.1" ry="0.62" transform="rotate(38 ${sx + 0.9} ${sy - 0.9})"/>`;
    }
    return p + "</g>";
  };

  const B = "#B0872F", W = "#FFFFFF";
  let s = `<svg class="motif" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;
  // cream side — brass, faint
  s += sun(w * 0.10, h * 0.16, h * 0.055, B, 0.17);
  s += tree(w * 0.16, h - 3, h * 0.020, B, 0.16);
  s += tree(w * 0.34, h - 2, h * 0.026, B, 0.14);
  s += cow(w * 0.26, h - 5, h * 0.021, B, 0.16);
  s += tree(w * 0.52, h - 3, h * 0.022, B, 0.13);
  for (let i = 0; i * 6 < creamW; i++) s += grain(2 + i * 6, h - 1.5, 9 + (i % 4) * 4.5, B, 0.18);
  // golden side — white, stronger
  s += sun(creamW + (w - creamW) * 0.62, h * 0.62, h * 0.05, W, 0.34);
  s += tree(creamW + (w - creamW) * 0.20, h - 3, h * 0.024, W, 0.30);
  s += tree(creamW + (w - creamW) * 0.55, h - 2, h * 0.030, W, 0.26);
  s += cow(creamW + (w - creamW) * 0.38, h - 5, h * 0.023, W, 0.30);
  for (let i = 0; creamW + i * 5.4 < w; i++) s += grain(creamW + 2 + i * 5.4, h - 1.5, 10 + (i % 4) * 5, W, 0.34);
  return s + "</svg>";
}

/** Placeholder bars. Deliberately NOT a scannable code — there is no GS1 prefix. */
function barcodeSVG() {
  let seed = 7, x = 0, bars = "";
  for (let i = 0; i < 58; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const w = 0.5 + ((seed >> 16) % 3) * 0.3;
    bars += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="30" fill="#000"/>`;
    x += w + 0.55;
  }
  return `<svg viewBox="0 0 ${x.toFixed(0)} 30" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/*
 * LEFT PANEL — brand / contact face. Fixed running order, per the client's
 * reference bottle, identical at every pack size:
 *
 *   quote + short story → Manufactured & Marketed by → fssai mark + licence
 *   → feedback line → social icons with handle → certification marks
 *   → barcode → website
 *
 * Note what is NOT here: ingredients, storage, best before, country of origin.
 * Those live on the golden statutory face so the two panels do not compete,
 * which is also what frees enough room for this order to hold at 250ml.
 */
const brandFace = (sku) => `
  <div class="story">
    <span class="story__mark story__mark--open">&ldquo;</span>
    <p class="story__text">${sku.story}</p>
    <span class="story__mark story__mark--close">&rdquo;</span>
  </div>

  <p class="byline">Manufactured &amp; Marketed by:</p>
  <p class="byline__co">${COMPANY.legal}</p>
  <p class="byline__addr">${COMPANY.addr}</p>

  <div class="fssai fssai--stack">
    <span class="fssai__mark">fssai</span>
    <span>LIC. No. ${F("14-DIGIT")}</span>
  </div>

  <p class="feedback">For feedback or complaints, please contact us at
     ${COMPANY.phone} or email us at ${COMPANY.email}</p>

  <p class="social">
    <span class="social__ic">${ICON.fb}</span>
    <span class="social__ic">${ICON.ig}</span>
    <span class="social__handle">nutrigreenz</span>
  </p>

  <div class="certs">
    ${["SWACHH<br>BHARAT", "ZED", "ISO"].map(t => `<span class="cert">${t}</span>`).join("")}
    <span class="cert cert--recycle">${ICON.recycle}</span>
    <span class="certs__origin">PRODUCT OF INDIA</span>
  </div>

  <div class="barcode barcode--brand">
    ${barcodeSVG()}<p class="barcode__num">8 901234 567890</p>
  </div>
  <p class="note">${F("PLACEHOLDER — NEEDS GS1 PREFIX")}</p>

  <p class="weburl">WWW.NUTRIGREENZ.FARM</p>`;

/*
 * RIGHT PANEL — the statutory face on golden. Also identical at every size.
 */
const nutritionTable = (sku) => `
  <div class="nutri">
    <h2>NUTRITION FACTS</h2>
    <p class="nutri__serv">${F("n")} servings per container</p>
    <table>
      <tr class="hd"><td>Serving Size</td><td>${sku.serving}</td></tr>
      <tr class="hd"><td>Amount Per Serving</td><td>% RDA*</td></tr>
      ${NUTRITION.map(([label, unit, major, indent]) => `
      <tr class="${major ? "major" : ""} ${indent === 1 ? "sub" : indent === 2 ? "sub2" : ""}">
        <td>${label} (${F(unit)})</td><td>${major ? F("%") : ""}</td></tr>`).join("")}
    </table>
    <p class="nutri__note">* % RDA shows how much a nutrient in a serving contributes to a daily
      diet; 2,000 kcal a day is used for general advice. ALL VALUES PROVISIONAL — LAB COA REQUIRED.</p>
  </div>`;

/*
 * GOLDEN FACE — ingredients, net quantity, the nutrition table, then the rest
 * of the statutory copy.
 *
 * The "Manufactured & Marketed by" line and the FSSAI licence are deliberately
 * NOT repeated here: both appear in full on the brand face, and a wrap label
 * that says the same thing twice wastes the space the nutrition table needs.
 */
const statBlock = (sku) => `
  <dl class="stat">
    <div class="inline"><b>INGREDIENTS:</b><span>${sku.ingredients}</span></div>
    <div class="inline"><b>NET QUANTITY:</b><span>${sku.volume} / ${F("g")}</span></div>
  </dl>
  ${nutritionTable(sku)}
  <dl class="stat">
    ${sku.allergen ? `<dt>ALLERGEN ADVICE:</dt><dd class="allergen">${sku.allergen}</dd>` : ""}
    <dt>STORAGE INFORMATION:</dt>
    <dd>Store in a cool and dry place away from direct heat and light, with the lid tightly closed.</dd>
    <dt>BEST BEFORE:</dt><dd>${F("n")} months from the date of manufacture.</dd>
    <dt>COUNTRY OF ORIGIN:</dt><dd>India</dd>
  </dl>`;

function html(sku) {
  // Wrap length = circumference + overlap. Height = the jar's straight wall.
  const wrap = Math.round(Math.PI * sku.jarDia) + 5;
  const h = sku.wallH;
  const W = wrap + BLEED * 2, H = h + BLEED * 2;

  // Column split. The display panel is widest because it is the face a shopper
  // sees; the legal repeat takes the golden third.
  /* The same four zones at every pack size, per the client's consistency rule.
     What made this possible is moving ingredients/storage/best-before off the
     brand face and onto the golden one — the two panels no longer duplicate
     each other, so both fit even on a 250ml jar. */
  /* Three panels: brand face · display · golden statutory (which now carries
     the nutrition table). The golden face is widest because it holds the most. */
  /* The display face carries a wordmark, a name and one line, so it had width
     it did not need while the golden face overflowed. Rebalanced toward the
     panel doing the work. */
  const story = wrap * 0.27;
  const pdp   = wrap * 0.27;
  const legal = wrap - story - pdp;
  const creamW = BLEED + story + pdp;

  const logo = "file://" + join(PKG, "20_assets/icons/NG_wordmark.png");

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${join(HERE, "label.css")}">
<style>
  @page { size: ${W}mm ${H}mm; margin: 0; }
  body  { width: ${W}mm; height: ${H}mm; }
  .label{ --w:${W}mm; --h:${H}mm; --safe:${BLEED + SAFE}mm;
          --col-story:${story}mm; --col-pdp:${pdp}mm; --col-legal:${legal}mm;
          grid-template-columns:${story}mm ${pdp}mm ${legal}mm;
          padding:${BLEED}mm; }
</style></head><body>
<div class="label">
  ${motifSVG(W, H, creamW)}

  <section class="zone zone--story">
    ${brandFace(sku)}
  </section>

  <section class="zone zone--pdp">
    <img class="logo" src="${logo}" alt="Nutri Greenz">
    <div class="pdp__rule"></div>
    <h1 class="pdp__name">${sku.name}</h1>
    <div class="pdp__rule"></div>
    <p class="pdp__pure">100% Pure</p>
  </section>

  <section class="zone zone--legal">
    ${statBlock(sku)}
    <div class="varblock">
      <div class="veg"><i></i></div>
      <div class="overprint">
        <div class="overprint__mrp">MRP ₹ <span class="overprint__tax">(incl. of all taxes)</span></div>
        ${["USP", "BATCH NO", "DATE OF MFG", "USE BY"].map(l => `<div class="overprint__row">${l}<i></i></div>`).join("")}
      </div>
      <p class="note">${F("OVERPRINTED AT PACKING")}</p>
    </div>
  </section>

  ${process.env.NG_CLEAN ? "" : `<div class="guides">
    <div class="bleed"></div><div class="safe"></div>
    ${[story, story + pdp].map(x => `<div class="fold" style="left:${BLEED + x}mm"></div>`).join("")}
  </div>`}
</div></body></html>`;
}

/* ── render ─────────────────────────────────────────────────────────────── */
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const targets = only ? SKUS.filter(s => s.id === only) : SKUS;
if (targets.length === 0) { console.error(`no SKU "${only}"`); process.exit(1); }

const browser = await chromium.launch();
for (const sku of targets) {
  const wrap = Math.round(Math.PI * sku.jarDia) + 5;
  const W = wrap + BLEED * 2, H = sku.wallH + BLEED * 2;
  /* Viewport sized to the label at 4x, so the PNG captures the whole strip.
     A fixed 2400x1200 window clipped anything taller than the viewport. */
  const PXMM = 4;
  const page = await browser.newPage({
    viewport: { width: Math.ceil(W * PXMM), height: Math.ceil(H * PXMM) },
    deviceScaleFactor: 2,
  });
  const file = join(HERE, `.tmp-${sku.id}.html`);
  writeFileSync(file, html(sku), "utf8");
  await page.goto("file://" + file, { waitUntil: "networkidle" });

  /*
   * Auto-fit. Rather than hand-tuning point sizes until nothing overflows —
   * which is what made the Illustrator route so slow — each zone is measured
   * against its box and its type scaled down until the content fits.
   *
   * The floor is deliberate: FSSAI sets a 1mm minimum height for general
   * declarations, so type is never allowed below ~5pt. If a zone still
   * overflows at the floor the build REPORTS it rather than shipping clipped
   * legal copy, because silently cropping an allergen line is the one failure
   * that must never reach a press.
   */
  const fit = await page.evaluate(() => {
    const MIN = 0.72;          // ~5pt against a 7pt base
    const report = [];
    for (const zone of document.querySelectorAll(".zone")) {
      let scale = 1;
      const inner = zone.firstElementChild ? zone : null;
      // Overflow can be vertical OR horizontal. The golden face flows in two
      // columns, so content that does not fit spills sideways and is clipped by
      // overflow:hidden — invisible to a height-only check, which is how a
      // clipped nutrition table nearly shipped looking fine.
      const over = () =>
        zone.scrollHeight > zone.clientHeight + 1 ||
        zone.scrollWidth > zone.clientWidth + 1;

      while (over() && scale > MIN) {
        scale -= 0.02;
        zone.style.fontSize = `${scale}em`;
        zone.style.setProperty("--fit", scale);
        for (const el of zone.querySelectorAll("*")) el.style.zoom = "";
        zone.style.zoom = scale;
      }
      if (over()) {
        report.push({
          zone: zone.className,
          axis: zone.scrollWidth > zone.clientWidth + 1 ? "wide" : "tall",
          over: Math.max(
            zone.scrollHeight - zone.clientHeight,
            zone.scrollWidth - zone.clientWidth,
          ),
        });
      }
    }
    return report;
  });
  for (const r of fit) {
    console.warn(`  ⚠ ${sku.id}: ${r.zone} overflows ${r.axis} by ${Math.round(r.over / 3.78)}mm at the type floor`);
  }

  /*
   * NG_CLEAN=1 drops the bleed/safe/fold guides and the magenta placeholder
   * flags, and writes a *-CLEAN file. That output is for bottle mockups: the
   * guides are instructions to a printer, and cropping a panel with a dashed
   * magenta fold line down its edge puts that line on the product photo.
   * The print files keep their guides, which is the whole point of them.
   */
  const suffix = process.env.NG_CLEAN ? "-CLEAN" : "";
  const base = join(OUT, `NG-GHEE-${sku.id.toUpperCase()}${suffix}`);
  await page.pdf({ path: `${base}.pdf`, width: `${W}mm`, height: `${H}mm`,
                   printBackground: true, pageRanges: "1" });
  await page.locator(".label").screenshot({ path: `${base}.png` });
  await page.close();
  console.log(`  ${sku.id.padEnd(16)} ${W}×${H}mm  (jar ⌀${sku.jarDia}mm, wall ${sku.wallH}mm)`);
}
await browser.close();
console.log(`\n  PDF + PNG in 50_exports/print/`);
