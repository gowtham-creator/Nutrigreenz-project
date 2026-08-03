/**
 * 20-groundnut-1L-flat.jsx — NG-OIL-GN-1L-GLASS, full flat wrap.
 *
 * Four panels on one continuous strip, per the brief:
 *   FRONT (70) · STORY side (70) · BACK (70) · VARIABLE side (70) = 280mm
 *
 * DIMENSIONS ARE UNCONFIRMED. 280x120 with 4x70 panels is the example in the
 * brief's own sku-master.json, used here so there is something real to look at.
 * A watermark sits on the dieline layer and must not be removed until the
 * bottle vendor's measurements replace these numbers.
 *
 * Ground: warm cream with a gold crop motif behind the type, per the client's
 * OpenArt renders. Story panel follows the FarmSe device the client supplied:
 * botanical, opening quote, script headline, story, closing quote.
 */
#target illustrator

// ── font guard: never silently substitute ────────────────────────────────
function findFont(re) {
  for (var i = 0; i < app.textFonts.length; i++)
    if (re.test(app.textFonts[i].name)) return app.textFonts[i].name;
  return null;
}
var SERIF  = findFont(/^RobotoSlab-Bold$/i)     || findFont(/^RobotoSlab/i);
var SERIFR = findFont(/^RobotoSlab-Regular$/i)  || SERIF;
var SANS   = findFont(/^HankenGrotesk-Regular$/i);
var SANSB  = findFont(/^HankenGrotesk-Bold$/i)  || SANS;
var SANSM  = findFont(/^HankenGrotesk-Medium$/i)|| SANS;
if (!SERIF || !SANS) {
  var m = new File("/tmp/ng-ai-test/flat-result.txt");
  m.open("w"); m.write("BLOCKED: brand fonts missing. Restart Illustrator."); m.close();
  throw new Error("fonts missing");
}

// ── geometry (mm) ─────────────────────────────────────────────────────────
var PANEL = 70, PANELS = 4;
var W = PANEL * PANELS;      // 280
var H = 120;
var BLEED = 3, SAFE = 4;
var PW = W + BLEED * 2, PH = H + BLEED * 2;
var X0 = BLEED, Y0 = BLEED;
var P = [X0, X0 + PANEL, X0 + PANEL * 2, X0 + PANEL * 3];  // panel left edges

var MM = 2.834645669;

// ── colour ────────────────────────────────────────────────────────────────
function cmyk(c, m, y, k) { var o = new CMYKColor(); o.cyan=c; o.magenta=m; o.yellow=y; o.black=k; return o; }
var CREAM   = [4, 6, 14, 0];
var CREAM_W = [6, 9, 20, 0];
var FOREST  = [85, 45, 78, 45];
var FORESTD = [88, 55, 84, 72];
var GOLD    = [25, 45, 95, 10];
var GOLD_L  = [15, 28, 70, 2];
var VEG     = [80, 0, 100, 0];
var K100    = [0, 0, 0, 100];
var MAGENTA = [0, 100, 0, 0];

// ── document ──────────────────────────────────────────────────────────────
var doc = app.documents.add(DocumentColorSpace.CMYK, PW * MM, PH * MM);
doc.rulerUnits = RulerUnits.Millimeters;

/*
 * Layers. `layers.add()` inserts at the TOP of the stack, so they are created
 * in bottom-to-top order and the LAST one added ends up on top. Getting this
 * backwards puts 10_BACKGROUND over everything and the label renders as four
 * empty colour fields.
 *
 * Deviation from the brief, deliberate: the two guide layers sit at the TOP,
 * not the bottom. The brief lists 00_DIELINE first, but a dieline underneath an
 * opaque full-bleed background cannot be seen, which defeats its purpose. Names
 * are exactly as specified; only the z-order of the two non-printing layers
 * differs.
 */
function mklayer(n) { var l = doc.layers.add(); l.name = n; return l; }
var L_BG   = mklayer("10_BACKGROUND");
var L_TEX  = mklayer("20_TEXTURE");
var L_ART  = mklayer("30_ARTWORK");
var L_TYPE = mklayer("40_TYPE");
var L_VAR  = mklayer("50_VARIABLE");
var L_COMP = mklayer("60_COMPLIANCE");
var L_BLD  = mklayer("05_BLEED_GUIDE");
var L_DIE  = mklayer("00_DIELINE");

// ── primitives ────────────────────────────────────────────────────────────
function rect(L, x, y, w, h, fill, op) {
  var r = L.pathItems.rectangle(-y*MM, x*MM, w*MM, h*MM);
  r.stroked = false;
  if (fill) { r.filled = true; r.fillColor = cmyk(fill[0],fill[1],fill[2],fill[3]); }
  else r.filled = false;
  if (op !== undefined) r.opacity = op;
  return r;
}
function rrect(L, x, y, w, h, rad, fill) {
  var r = L.pathItems.roundedRectangle(-y*MM, x*MM, w*MM, h*MM, rad*MM, rad*MM);
  r.stroked = false; r.filled = true;
  r.fillColor = cmyk(fill[0],fill[1],fill[2],fill[3]);
  return r;
}
function ln(L, x1, y1, x2, y2, col, w, op) {
  var p = L.pathItems.add();
  p.setEntirePath([[x1*MM, -y1*MM], [x2*MM, -y2*MM]]);
  p.filled = false; p.stroked = true;
  p.strokeColor = cmyk(col[0],col[1],col[2],col[3]);
  p.strokeWidth = (w||0.3)*MM;
  if (op !== undefined) p.opacity = op;
  return p;
}
/**
 * Smooth curve through the given points.
 *
 * setEntirePath() alone produces CORNER points, so a "leaf" drawn as five
 * points came out as a diamond and the whole botanical read as a lattice. This
 * derives Catmull-Rom tangents and writes them into each point's handles, which
 * is what actually makes an engraved line drawing look drawn.
 */
function curve(L, pts, col, w, op, closed) {
  var p = L.pathItems.add();
  p.setEntirePath(pts);
  var n = p.pathPoints.length;
  for (var i = 0; i < n; i++) {
    var cur = pts[i];
    var prv = pts[i > 0 ? i - 1 : (closed ? n - 1 : 0)];
    var nxt = pts[i < n - 1 ? i + 1 : (closed ? 0 : n - 1)];
    // tangent along the chord between neighbours, scaled back so it curves
    // rather than loops
    var tx0 = (nxt[0] - prv[0]) / 5.2;
    var ty0 = (nxt[1] - prv[1]) / 5.2;
    var pt = p.pathPoints[i];
    pt.pointType = PointType.SMOOTH;
    pt.leftDirection  = [cur[0] - tx0, cur[1] - ty0];
    pt.rightDirection = [cur[0] + tx0, cur[1] + ty0];
  }
  if (closed) p.closed = true;
  p.filled = false; p.stroked = true;
  p.strokeColor = cmyk(col[0],col[1],col[2],col[3]);
  p.strokeWidth = (w||0.25)*MM;
  p.strokeCap = StrokeCap.ROUNDENDCAP;
  p.strokeJoin = StrokeJoin.ROUNDENDJOIN;
  if (op !== undefined) p.opacity = op;
  return p;
}
/** Point text. mm coords, size in pt. */
function tx(L, x, y, s, size, font, col, track, align) {
  var t = L.textFrames.add();
  t.contents = s;
  var a = t.textRange.characterAttributes;
  a.size = size;
  a.fillColor = cmyk(col[0],col[1],col[2],col[3]);
  if (track) a.tracking = track;
  try { a.textFont = app.textFonts.getByName(font); } catch(e) {}
  if (align === "c") t.textRange.paragraphAttributes.justification = Justification.CENTER;
  if (align === "r") t.textRange.paragraphAttributes.justification = Justification.RIGHT;
  t.top = -y*MM; t.left = x*MM;
  if (align === "c") t.left = (x - t.width/(2*MM))*MM;
  if (align === "r") t.left = (x - t.width/MM)*MM;
  return t;
}
/** Wrapped paragraph inside a box. */
function para(L, x, y, w, h, s, size, font, col, lead, align) {
  var box = L.pathItems.rectangle(-y*MM, x*MM, w*MM, h*MM);
  box.filled = false; box.stroked = false;
  var t = L.textFrames.areaText(box);
  t.contents = s;
  var a = t.textRange.characterAttributes;
  a.size = size;
  a.fillColor = cmyk(col[0],col[1],col[2],col[3]);
  a.leading = lead || size * 1.35;
  try { a.textFont = app.textFonts.getByName(font); } catch(e) {}
  t.textRange.paragraphAttributes.justification =
    align === "c" ? Justification.CENTER : Justification.LEFT;
  return t;
}

// ══════════════════════════════════════════════════════════════════════════
// 10_BACKGROUND — cream ground, dark nutrition block
// ══════════════════════════════════════════════════════════════════════════
rect(L_BG, 0, 0, PW, PH, CREAM);
rect(L_BG, P[1], Y0, PANEL, H, CREAM_W);            // story panel, warmer
rect(L_BG, P[2] + 26, Y0, PANEL - 26, H, FOREST);   // nutrition block on the back
rect(L_BG, P[3], Y0, PANEL, H, CREAM_W);

// ══════════════════════════════════════════════════════════════════════════
// 20_TEXTURE — the crop motif the client asked for, behind the type
// ══════════════════════════════════════════════════════════════════════════
/** One paddy/wheat stalk: stem + paired grains, single weight, no fill. */
function stalk(L, bx, by, hgt, op) {
  curve(L, [[bx*MM, -(by)*MM], [(bx+1.5)*MM, -(by-hgt*0.55)*MM], [(bx+0.4)*MM, -(by-hgt)*MM]], GOLD, 0.22, op);
  var n = 7;
  for (var i = 0; i < n; i++) {
    var t = i / (n - 1);
    var sx = bx + 1.5*Math.sin(t*Math.PI) + 0.4*t;
    var sy = by - hgt*(0.30 + 0.66*t);
    curve(L, [[sx*MM, -sy*MM], [(sx-2.1)*MM, -(sy-1.5)*MM], [(sx-0.5)*MM, -(sy-2.6)*MM]], GOLD, 0.2, op);
    curve(L, [[sx*MM, -sy*MM], [(sx+2.1)*MM, -(sy-1.5)*MM], [(sx+0.5)*MM, -(sy-2.6)*MM]], GOLD, 0.2, op);
  }
}
// Bled across the light panels as ground texture, per brand-tokens.
for (var s = 0; s < 26; s++) {
  var sxp = X0 + 3 + s * 10.6;
  // skip the dark nutrition block
  if (sxp > P[2] + 22 && sxp < P[3] - 2) continue;
  stalk(L_TEX, sxp, Y0 + H - 3, 26 + (s % 3) * 5, 14);
}

// ══════════════════════════════════════════════════════════════════════════
// 30_ARTWORK — gold rules, frames, botanical hero
// ══════════════════════════════════════════════════════════════════════════
// panel fold guides (printing hairlines are wrong; these live on the die layer)
for (var f = 1; f < PANELS; f++) {
  ln(L_DIE, P[f], Y0, P[f], Y0 + H, MAGENTA, 0.15);
}

// FRONT: bordered frame per the brief
var fx = P[0] + 6, fy = Y0 + 6, fw = PANEL - 12, fh = H - 12;
var fr = L_ART.pathItems.rectangle(-fy*MM, fx*MM, fw*MM, fh*MM);
fr.filled = false; fr.stroked = true;
fr.strokeColor = cmyk(GOLD[0],GOLD[1],GOLD[2],GOLD[3]); fr.strokeWidth = 0.35*MM;
// inner hairline
var fr2 = L_ART.pathItems.rectangle(-(fy+1.6)*MM, (fx+1.6)*MM, (fw-3.2)*MM, (fh-3.2)*MM);
fr2.filled = false; fr2.stroked = true;
fr2.strokeColor = cmyk(GOLD_L[0],GOLD_L[1],GOLD_L[2],GOLD_L[3]); fr2.strokeWidth = 0.18*MM;

/** Groundnut plant, single-weight gold line drawing. Stage-3 art, no fills. */
function groundnutPlant(L, cx, cy, sc) {
  function C(pts, w, closed) {
    var mapped = [];
    for (var i = 0; i < pts.length; i++)
      mapped.push([(cx + pts[i][0]*sc)*MM, -(cy + pts[i][1]*sc)*MM]);
    return curve(L, mapped, GOLD, w || 0.28, undefined, closed);
  }
  /* Arachis hypogaea: an upright stem, opposed pairs of oval leaflets, and the
     pods underground. The pods are the point — they are what distinguishes a
     groundnut from any other legume, so they are drawn largest and clearest. */
  C([[0, 7.5], [0.5, 2], [0, -3], [0.3, -8]], 0.34);              // stem
  // three tiers of paired leaflets, largest at the base
  var tiers = [[-6.6, 3.5], [-2.4, 3.1], [1.6, 2.5]];
  for (var i = 0; i < tiers.length; i++) {
    var yy = tiers[i][0], ln2 = tiers[i][1];
    // petiole out to each leaflet
    C([[0.2, yy + 0.6], [-ln2*0.55, yy - 0.1]], 0.2);
    C([[0.2, yy + 0.6], [ ln2*0.55, yy - 0.1]], 0.2);
    // leaflet ovals
    C([[-ln2*0.55, yy], [-ln2*0.95, yy-1.5], [-ln2*1.75, yy-0.7], [-ln2*1.35, yy+0.9]], 0.26, true);
    C([[ ln2*0.55, yy], [ ln2*0.95, yy-1.5], [ ln2*1.75, yy-0.7], [ ln2*1.35, yy+0.9]], 0.26, true);
  }
  C([[0.15, -8], [0.1, -9.6]], 0.24);                              // tip
  // soil line
  C([[-6, 7.6], [0, 7.4], [6, 7.7]], 0.2);
  // pegs down to the pods
  C([[0.2, 7.5], [-2.2, 8.8], [-3.2, 10.4]], 0.24);
  C([[0.4, 7.5], [ 2.3, 8.9], [ 3.3, 10.5]], 0.24);
  // two shells, the classic pinched groundnut silhouette
  function pod(px, py, flip) {
    var f = flip ? -1 : 1;
    C([[px, py], [px + 1.6*f, py + 0.5], [px + 1.9*f, py + 1.9],
       [px + 1.0*f, py + 2.6], [px + 0.2*f, py + 3.6], [px - 0.9*f, py + 3.9],
       [px - 1.6*f, py + 3.0], [px - 1.2*f, py + 1.9], [px - 1.5*f, py + 0.8]], 0.28, true);
    C([[px - 0.9*f, py + 2.3], [px + 0.9*f, py + 2.1]], 0.16);      // waist
  }
  pod(-3.4, 10.2, false);
  pod( 3.5, 10.3, true);
}

// Front hero is drawn by 21-richness.jsx (engraved version) so the two
// scripts cannot both place a plant and overlap each other.

// STORY panel: botanical at top + quote device
// Story-panel botanical also comes from 21-richness.jsx.
ln(L_ART, P[1]+10, Y0+34, P[1]+PANEL-10, Y0+34, GOLD, 0.28);

// BACK: rule under the heading zone
ln(L_ART, P[2]+5, Y0+13, P[2]+23, Y0+13, GOLD, 0.28);

// VARIABLE panel: framed block
var vb = L_ART.pathItems.rectangle(-(Y0+18)*MM, (P[3]+7)*MM, (PANEL-14)*MM, 52*MM);
vb.filled = false; vb.stroked = true;
vb.strokeColor = cmyk(GOLD[0],GOLD[1],GOLD[2],GOLD[3]); vb.strokeWidth = 0.3*MM;

// ══════════════════════════════════════════════════════════════════════════
// 40_TYPE
// ══════════════════════════════════════════════════════════════════════════
var fcx = P[0] + PANEL/2;
/*
 * Vertical rhythm. `t.top` is the TOP of the text frame, not the baseline —
 * treating it as a baseline is what put a gold rule straight through "OIL".
 * Each block below is placed by its top edge and the next one clears it by the
 * cap height of the type above.
 */
tx(L_TYPE, fcx, Y0+13, "NUTRI GREENZ", 14, SERIF, FORESTD, 90, "c");   // ~4.9mm tall
tx(L_TYPE, fcx, Y0+20, "FARM  TECHNOLOGIES", 4.6, SANSM, GOLD, 300, "c");
ln(L_ART, fcx-15, Y0+25.5, fcx+15, Y0+25.5, GOLD, 0.3);
tx(L_TYPE, fcx, Y0+30, "COLD-PRESSED", 6, SANSB, GOLD, 340, "c");
tx(L_TYPE, fcx, Y0+38, "GROUNDNUT", 21, SERIF, FORESTD, -10, "c");     // ~7.4mm tall
tx(L_TYPE, fcx, Y0+47, "OIL", 21, SERIF, FORESTD, -10, "c");
ln(L_ART, fcx-13, Y0+58, fcx+13, Y0+58, GOLD, 0.25);
tx(L_TYPE, fcx, Y0+61, "WOOD-PRESSED  ·  UNREFINED", 5, SANSM, FOREST, 250, "c");
tx(L_TYPE, fcx, Y0+99, "Single-origin  ·  Anantapur", 5.2, SANSM, GOLD, 120, "c");

// STORY panel — the FarmSe device the client pointed at
var scx = P[1] + PANEL/2;
tx(L_TYPE, P[1]+11, Y0+50, "“", 26, SERIF, GOLD, 0, "l");
para(L_TYPE, P[1]+10, Y0+52, PANEL-20, 14,
     "Traditionally Wood-Pressed.\nTruly Farm Fresh.", 7.4, SERIFR, GOLD, 9.5, "c");
para(L_TYPE, P[1]+9, Y0+70, PANEL-18, 30,
     "Purely pressed, never processed. We draw our groundnut oil on a wooden ghani turning slow and cold, so every drop keeps its aroma, its natural antioxidants and the quiet nuttiness that refining strips away.",
     5.4, SANS, FOREST, 7.4, "c");
tx(L_TYPE, P[1]+PANEL-16, Y0+96, "”", 26, SERIF, GOLD, 0, "l");

// BACK panel
var bx0 = P[2] + 5;
tx(L_TYPE, bx0, Y0+11, "INGREDIENTS", 5.2, SANSB, FORESTD, 150);
para(L_TYPE, bx0, Y0+14, 20, 8, "Cold-pressed Groundnut Oil (100%)", 4.4, SANS, FORESTD, 5.6);
tx(L_TYPE, bx0, Y0+27, "ALLERGEN", 5.2, SANSB, FORESTD, 150);
para(L_TYPE, bx0, Y0+30, 21, 14, "CONTAINS GROUNDNUT (PEANUT). Pressed on equipment that also handles sesame, mustard and coconut.", 4.2, SANS, FORESTD, 5.4);
tx(L_TYPE, bx0, Y0+50, "STORAGE", 5.2, SANSB, FORESTD, 150);
para(L_TYPE, bx0, Y0+53, 21, 12, "Store in a cool, dark place. Natural sediment is normal in unrefined oil.", 4.2, SANS, FORESTD, 5.4);
tx(L_TYPE, bx0, Y0+70, "USAGE", 5.2, SANSB, FORESTD, 150);
para(L_TYPE, bx0, Y0+73, 21, 12, "Tempering, deep-frying, pickling and everyday South Indian cooking.", 4.2, SANS, FORESTD, 5.4);

// nutrition block, reversed out of the dark field
var nx = P[2] + 29;
tx(L_TYPE, nx, Y0+12, "NUTRITION FACTS", 5.6, SANSB, CREAM, 110);
tx(L_TYPE, nx, Y0+17, "Per 100 ml", 4, SANSM, GOLD_L, 60);
tx(L_TYPE, P[2]+PANEL-5, Y0+17, "Per 14 ml", 4, SANSM, GOLD_L, 60, "r");
var rows = [["Energy","<<kcal>>","<<kcal>>"],["Total Fat","<<g>>","<<g>>"],
            ["  Saturated","<<g>>","<<g>>"],["  Trans fat","<<g>>","<<g>>"],
            ["  MUFA","<<g>>","<<g>>"],["  PUFA","<<g>>","<<g>>"],
            ["Cholesterol","<<mg>>","<<mg>>"],["Protein","<<g>>","<<g>>"],
            ["Carbohydrate","<<g>>","<<g>>"]];
var ry = Y0 + 22;
for (var r2 = 0; r2 < rows.length; r2++) {
  tx(L_TYPE, nx, ry, rows[r2][0], 4.1, SANS, CREAM, 0);
  tx(L_TYPE, P[2]+PANEL-17, ry, rows[r2][1], 4.1, SANS, MAGENTA, 0, "r");
  tx(L_TYPE, P[2]+PANEL-5,  ry, rows[r2][2], 4.1, SANS, MAGENTA, 0, "r");
  ln(L_ART, nx, ry+1.1, P[2]+PANEL-5, ry+1.1, GOLD_L, 0.08, 40);
  ry += 5.0;
}
tx(L_TYPE, nx, ry+3, "<<ALL VALUES PROVISIONAL - LAB COA REQUIRED>>", 3.5, SANSB, MAGENTA, 0);

// ══════════════════════════════════════════════════════════════════════════
// 60_COMPLIANCE
// ══════════════════════════════════════════════════════════════════════════
// veg mark, front bottom-left
var vgx = P[0]+10, vgy = Y0+H-16;
var vsq = L_COMP.pathItems.rectangle(-vgy*MM, vgx*MM, 6*MM, 6*MM);
vsq.filled = false; vsq.stroked = true;
vsq.strokeColor = cmyk(VEG[0],VEG[1],VEG[2],VEG[3]); vsq.strokeWidth = 0.6*MM;
var vdot = L_COMP.pathItems.ellipse(-(vgy+1.5)*MM, (vgx+1.5)*MM, 3*MM, 3*MM);
vdot.filled = true; vdot.fillColor = cmyk(VEG[0],VEG[1],VEG[2],VEG[3]); vdot.stroked = false;
// net quantity, front bottom-right per Legal Metrology placement
tx(L_TYPE, P[0]+PANEL-10, Y0+H-18, "NET QUANTITY", 4, SANSM, GOLD, 160, "r");
tx(L_TYPE, P[0]+PANEL-10, Y0+H-11, "1 L", 13, SERIF, FORESTD, 0, "r");

// FSSAI + address on the back panel foot
tx(L_TYPE, bx0, Y0+88, "Manufactured & Marketed by", 4, SANSB, FORESTD, 0);
para(L_TYPE, bx0, Y0+93, 20, 18,
     "Nutri Greenz Farm Technologies Pvt. Ltd.\n1st Floor, H.No. 5-35/167, Double Road, Near Moosapet Y Junction, Prashanth Nagar, Kukatpally, Hyderabad, Telangana 500072",
     3.6, SANS, FORESTD, 4.6);
var fsq = L_COMP.pathItems.rectangle(-(Y0+H-14)*MM, bx0*MM, 15*MM, 7*MM);
fsq.filled = false; fsq.stroked = true;
fsq.strokeColor = cmyk(FORESTD[0],FORESTD[1],FORESTD[2],FORESTD[3]); fsq.strokeWidth = 0.3*MM;
tx(L_TYPE, bx0+1.5, Y0+H-9.5, "<<FSSAI LOGO>>", 3.2, SANSB, MAGENTA, 0);
tx(L_TYPE, bx0, Y0+H-4.5, "<<LIC. No. 14-DIGIT>>", 3.4, SANSB, MAGENTA, 0);
tx(L_TYPE, bx0, Y0+H-1.5, "Product of India · care +91 8074553370", 3.2, SANS, FORESTD, 0);

// ══════════════════════════════════════════════════════════════════════════
// 50_VARIABLE — the packer's overprint block + barcode + QR
// ══════════════════════════════════════════════════════════════════════════
var vx = P[3] + 10;
tx(L_TYPE, vx, Y0+14, "BATCH  &  DATES", 5, SANSB, FORESTD, 200);
var vrows = ["Lot / Batch No.", "Mfg date", "Best before", "MRP (incl. all taxes)", "Net qty"];
var vy = Y0 + 24;
for (var v = 0; v < vrows.length; v++) {
  tx(L_TYPE, vx, vy, vrows[v], 4.2, SANSM, FORESTD, 0);
  ln(L_ART, vx+26, vy+0.6, P[3]+PANEL-10, vy+0.6, GOLD, 0.2);
  vy += 9;
}
tx(L_TYPE, vx, vy+2, "<<OVERPRINTED AT PACKING>>", 3.4, SANSB, MAGENTA, 0);

// EAN-13 placeholder, drawn as real bars so the block reads correctly at size
var bcx = P[3] + 12, bcy = Y0 + 80, bcw = 34, bch = 14;
rect(L_VAR, bcx-2, bcy-2, bcw+4, bch+7, [0,0,0,0]);
var seed = 7;
for (var b = 0; b < 58; b++) {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  var wdt = 0.28 + ((seed >> 16) % 3) * 0.16;
  var bxp = bcx + b * (bcw / 58);
  var bar = L_VAR.pathItems.rectangle(-bcy*MM, bxp*MM, wdt*MM, bch*MM);
  bar.filled = true; bar.fillColor = cmyk(0,0,0,100); bar.stroked = false;
}
tx(L_TYPE, bcx + bcw/2, bcy + bch + 3.6, "8 901234 567890", 4, SANS, K100, 40, "c");
tx(L_TYPE, bcx + bcw/2, bcy + bch + 7, "<<PLACEHOLDER - NEEDS GS1 PREFIX>>", 3, SANSB, MAGENTA, 0, "c");

// traceability QR on the story panel
var qx = P[1] + PANEL/2 - 6, qy = Y0 + 101;
rect(L_VAR, qx, qy, 12, 12, [0,0,0,0]);
var qseed = 19;
for (var qr = 0; qr < 12; qr++) for (var qc = 0; qc < 12; qc++) {
  qseed = (qseed * 1103515245 + 12345) % 2147483648;
  if ((qseed >> 18) % 2 === 0) continue;
  var qm = L_VAR.pathItems.rectangle(-(qy + qr)*MM, (qx + qc)*MM, 1*MM, 1*MM);
  qm.filled = true; qm.fillColor = cmyk(0,0,0,100); qm.stroked = false;
}
tx(L_TYPE, P[1] + PANEL/2, Y0 + 116, "SCAN TO TRACE THIS BOTTLE", 3.4, SANSB, FOREST, 120, "c");

// ══════════════════════════════════════════════════════════════════════════
// 00_DIELINE / 05_BLEED_GUIDE
// ══════════════════════════════════════════════════════════════════════════
var die = L_DIE.pathItems.rectangle(-Y0*MM, X0*MM, W*MM, H*MM);
die.filled = false; die.stroked = true;
die.strokeColor = cmyk(0,100,0,0); die.strokeWidth = 0.25*MM;
var safe = L_BLD.pathItems.rectangle(-(Y0+SAFE)*MM, (X0+SAFE)*MM, (W-SAFE*2)*MM, (H-SAFE*2)*MM);
safe.filled = false; safe.stroked = true;
safe.strokeColor = cmyk(70,0,0,0); safe.strokeWidth = 0.2*MM;
tx(L_DIE, X0+2, Y0+H+2.4, "DIMENSIONS_UNCONFIRMED - 280x120mm is the brief's example, not a vendor dieline. Do not print.", 3.4, SANSB, MAGENTA, 0);

L_DIE.printable = false; L_BLD.printable = false;
L_DIE.locked = true; L_BLD.locked = true;

// ── save + export ─────────────────────────────────────────────────────────
var base = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
var ai = new File(base + "40_skus/NG-OIL-GN-1L-GLASS_FLAT_v01.ai");
var so = new IllustratorSaveOptions(); so.compatibility = Compatibility.ILLUSTRATOR17;
doc.saveAs(ai, so);

var png = new File(base + "50_exports/print/NG-OIL-GN-1L-GLASS_FLAT_v01.png");
var eo = new ExportOptionsPNG24();
eo.antiAliasing = true; eo.transparency = false;
eo.horizontalScale = 300; eo.verticalScale = 300;
doc.exportFile(png, ExportType.PNG24, eo);

var log = new File("/tmp/ng-ai-test/flat-result.txt");
log.open("w");
log.write("OK " + PW + "x" + PH + "mm  layers=" + doc.layers.length +
          "  fonts: " + SERIF + " / " + SANS);
log.close();
