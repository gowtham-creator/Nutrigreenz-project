/**
 * 10-specimen-sheet.jsx — brand token specimen, A3 landscape.
 *
 * Per the brief: the token sheet is shown and signed off BEFORE any label is
 * designed. Its job is to make one decision easy to make — deep forest ground
 * or warm cream — because the two references disagree and everything else
 * depends on which wins.
 *
 * Run:  osascript -e 'tell application "Adobe Illustrator" to do javascript file "<abs path>"'
 */
#target illustrator

/*
 * Font guard — runs before anything is drawn.
 *
 * The previous label silently rendered in Helvetica because the brand faces
 * were not installed and Illustrator substituted without complaint. A specimen
 * sheet set in the wrong typeface is worse than no specimen sheet, so this
 * stops rather than substitutes.
 */
function requireFont(name) {
  try { return app.textFonts.getByName(name).name; } catch (e) { return null; }
}
function findFont(pattern) {
  for (var i = 0; i < app.textFonts.length; i++) {
    if (pattern.test(app.textFonts[i].name)) return app.textFonts[i].name;
  }
  return null;
}
var F_SERIF = findFont(/^RobotoSlab/i);
var F_SANS  = findFont(/^HankenGrotesk/i);
if (!F_SERIF || !F_SANS) {
  var miss = new File("/tmp/ng-ai-test/specimen-result.txt");
  miss.open("w");
  miss.write("BLOCKED: brand fonts not visible to Illustrator.\n" +
             "RobotoSlab: " + (F_SERIF || "MISSING") + "\n" +
             "HankenGrotesk: " + (F_SANS || "MISSING") + "\n" +
             "They are installed in ~/Library/Fonts. Quit and reopen Illustrator so it rescans, then re-run.");
  miss.close();
  throw new Error("brand fonts not loaded - see /tmp/ng-ai-test/specimen-result.txt");
}

// ── tokens ────────────────────────────────────────────────────────────────
var T = {
  forest:     [88, 55, 84, 72],   // CMYK, approximating #123024
  forestEdge: [90, 60, 85, 85],
  forestMid:  [85, 45, 78, 45],
  gold:       [25, 40, 95, 8],    // #B8912F
  goldLight:  [15, 25, 70, 0],
  cream:      [5, 6, 14, 0],      // #F2EADA
  vegGreen:   [80, 0, 100, 0],
  black:      [0, 0, 0, 100],
  accents: [
    ["Groundnut", [25, 50, 80, 5]],
    ["Sesame",    [30, 40, 70, 10]],
    ["Mustard",   [18, 30, 95, 2]],
    ["Coconut",   [40, 15, 40, 5]],
    ["Olive",     [50, 25, 85, 15]],
    ["Safflower", [15, 50, 85, 3]]
  ]
};

var MM = 2.834645669; // mm → points

function cmyk(c) {
  var k = new CMYKColor();
  k.cyan = c[0]; k.magenta = c[1]; k.yellow = c[2]; k.black = c[3];
  return k;
}

function rect(layer, xmm, ymm, wmm, hmm, fill) {
  var r = layer.pathItems.rectangle(-ymm * MM, xmm * MM, wmm * MM, hmm * MM);
  r.filled = true; r.fillColor = cmyk(fill); r.stroked = false;
  return r;
}

function line(layer, x1, y1, x2, y2, colour, wmm) {
  var p = layer.pathItems.add();
  p.setEntirePath([[x1 * MM, -y1 * MM], [x2 * MM, -y2 * MM]]);
  p.filled = false; p.stroked = true;
  p.strokeColor = cmyk(colour); p.strokeWidth = (wmm || 0.35) * MM;
  return p;
}

function txt(layer, xmm, ymm, str, sizePt, font, colour, tracking) {
  var t = layer.textFrames.add();
  t.contents = str;
  t.top = -ymm * MM; t.left = xmm * MM;
  var a = t.textRange.characterAttributes;
  a.size = sizePt;
  a.fillColor = cmyk(colour);
  if (tracking) a.tracking = tracking;
  try { a.textFont = app.textFonts.getByName(font); } catch (e) { /* fallback silently */ }
  return t;
}

// ── document ──────────────────────────────────────────────────────────────
var W = 420, H = 297; // A3 landscape, mm
var doc = app.documents.add(DocumentColorSpace.CMYK, W * MM, H * MM);
doc.rulerUnits = RulerUnits.Millimeters;

var L = {};
function layer(name) { var l = doc.layers.add(); l.name = name; return l; }
// created bottom-up, so add in reverse of the stack
L.type    = layer("40_TYPE");
L.art     = layer("30_ARTWORK");
L.bg      = layer("10_BACKGROUND");

// white page
rect(L.bg, 0, 0, W, H, [0, 0, 0, 0]);

var SERIF = findFont(/^RobotoSlab-Bold/i)   || F_SERIF;
var SANS  = findFont(/^HankenGrotesk-Regular/i) || F_SANS;
var SANSB = findFont(/^HankenGrotesk-Bold/i)    || F_SANS;

// ── header ────────────────────────────────────────────────────────────────
txt(L.type, 18, 22, "NUTRI GREENZ", 26, SERIF, T.forest, 120);
txt(L.type, 18, 30, "LABEL SYSTEM — TOKEN SPECIMEN  ·  v0.1 PROPOSAL  ·  NOT APPROVED", 8, SANSB, T.gold, 180);
line(L.art, 18, 35, W - 18, 35, T.gold, 0.5);

// ── GROUND A: deep forest ────────────────────────────────────────────────
var ax = 18, ay = 46, aw = 186, ah = 96;
rect(L.bg, ax, ay, aw, ah, T.forest);
rect(L.bg, ax, ay + ah - 14, aw, 14, T.forestEdge);
line(L.art, ax + 6, ay + 6, ax + aw - 6, ay + 6, T.gold, 0.4);
line(L.art, ax + 6, ay + ah - 6, ax + aw - 6, ay + ah - 6, T.gold, 0.4);
txt(L.type, ax + 10, ay + 18, "OPTION A", 9, SANSB, T.gold, 200);
txt(L.type, ax + 10, ay + 34, "DEEP FOREST", 22, SERIF, T.cream, 40);
txt(L.type, ax + 10, ay + 44, "Your brief. Gold reads as foil. Heavier, more premium.", 8, SANS, T.goldLight, 0);
txt(L.type, ax + 10, ay + 52, "NOT CHOSEN - kept for reference only.", 8, SANS, T.goldLight, 0);
txt(L.type, ax + 10, ay + 68, "COLD-PRESSED  ·  WOOD-PRESSED  ·  UNREFINED", 7, SANSB, T.gold, 220);
txt(L.type, ax + 10, ay + 84, "GROUNDNUT OIL", 18, SERIF, T.cream, 0);

// ── GROUND B: warm cream ─────────────────────────────────────────────────
var bx = 216, by = 46, bw = 186, bh = 96;
rect(L.bg, bx, by, bw, bh, T.cream);
rect(L.bg, bx + bw - 58, by, 58, bh, T.forestMid);
line(L.art, bx + 6, by + 6, bx + bw - 64, by + 6, T.gold, 0.4);
txt(L.type, bx + 10, by + 18, "OPTION B", 9, SANSB, T.gold, 200);
txt(L.type, bx + 10, by + 34, "WARM CREAM", 22, SERIF, T.forest, 40);
txt(L.type, bx + 10, by + 44, "CHOSEN - cream ground with crop line-art behind the type.", 8, SANSB, T.forest, 0);
txt(L.type, bx + 10, by + 52, "Less ink coverage, cheaper to print. Dark block carries contrast.", 8, SANS, T.forestMid, 0);
txt(L.type, bx + 10, by + 68, "COLD-PRESSED  ·  WOOD-PRESSED  ·  UNREFINED", 7, SANSB, T.gold, 220);
txt(L.type, bx + 10, by + 84, "GROUNDNUT OIL", 18, SERIF, T.forest, 0);
txt(L.type, bx + bw - 52, by + 16, "NUTRITION", 7, SANSB, T.cream, 150);
txt(L.type, bx + bw - 52, by + 26, "Energy", 6, SANS, T.cream, 0);
txt(L.type, bx + bw - 52, by + 34, "Total Fat", 6, SANS, T.cream, 0);
txt(L.type, bx + bw - 52, by + 42, "Saturated", 6, SANS, T.cream, 0);

// ── palette row ──────────────────────────────────────────────────────────
var py = 158;
txt(L.type, 18, py, "PALETTE", 9, SANSB, T.forest, 200);
line(L.art, 18, py + 4, W - 18, py + 4, T.gold, 0.3);
var swatches = [
  ["Forest", T.forest], ["Forest mid", T.forestMid], ["Gold", T.gold],
  ["Gold light", T.goldLight], ["Cream", T.cream], ["Veg green", T.vegGreen], ["Black (barcode)", T.black]
];
for (var i = 0; i < swatches.length; i++) {
  var sx = 18 + i * 42;
  rect(L.bg, sx, py + 10, 34, 26, swatches[i][1]);
  txt(L.type, sx, py + 42, swatches[i][0], 6.5, SANSB, T.forest, 0);
}
txt(L.type, 18 + 5 * 42, py + 50, "regulated — do not brand-match", 5.5, SANS, T.forestMid, 0);

// ── product accents ──────────────────────────────────────────────────────
var qy = 214;
txt(L.type, 18, qy, "PRODUCT ACCENTS — one per variety, so the range reads as a family", 9, SANSB, T.forest, 120);
line(L.art, 18, qy + 4, W - 18, qy + 4, T.gold, 0.3);
for (var j = 0; j < T.accents.length; j++) {
  var qx = 18 + j * 42;
  rect(L.bg, qx, qy + 10, 34, 18, T.accents[j][1]);
  txt(L.type, qx, qy + 34, T.accents[j][0], 6.5, SANSB, T.forest, 0);
}

// ── type pairing ─────────────────────────────────────────────────────────
var ty = 262;
txt(L.type, 18, ty, "TYPE", 9, SANSB, T.forest, 200);
line(L.art, 18, ty + 4, 200, ty + 4, T.gold, 0.3);
txt(L.type, 18, ty + 14, "Roboto Slab — product name", 13, SERIF, T.forest, 0);
txt(L.type, 18, ty + 22, "Hanken Grotesk — nutrition, compliance, legal", 8, SANS, T.forestMid, 0);
txt(L.type, 18, ty + 29, "Script for the tagline: NOT YET CHOSEN — see brand-tokens.json", 7, SANSB, [0, 100, 0, 0], 0);

txt(L.type, 216, ty, "OPEN DECISIONS", 9, SANSB, T.forest, 200);
line(L.art, 216, ty + 4, W - 18, ty + 4, T.gold, 0.3);
txt(L.type, 216, ty + 13, "1  Ground: DECIDED - B, warm cream + crop motif", 8, SANSB, T.forest, 0);
txt(L.type, 216, ty + 20, "2  Display serif: keep Roboto Slab, or license a high-contrast face?", 7.5, SANS, T.forestMid, 0);
txt(L.type, 216, ty + 27, "3  English-only, or English + Telugu? Changes the back panel entirely.", 7.5, SANS, T.forestMid, 0);
txt(L.type, 216, ty + 34, "4  Gold as foil, or CMYK build? Decides how it is specified.", 7.5, SANS, T.forestMid, 0);

// ── save + export ────────────────────────────────────────────────────────
var base = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
var ai = new File(base + "00_spec/NG_TOKEN_SPECIMEN_v01.ai");
var opts = new IllustratorSaveOptions();
opts.compatibility = Compatibility.ILLUSTRATOR17;
doc.saveAs(ai, opts);

var png = new File(base + "00_spec/NG_TOKEN_SPECIMEN_v01.png");
var eo = new ExportOptionsPNG24();
eo.antiAliasing = true; eo.transparency = false;
eo.horizontalScale = 200; eo.verticalScale = 200;
doc.exportFile(png, ExportType.PNG24, eo);

var log = new File("/tmp/ng-ai-test/specimen-result.txt");
log.open("w");
log.write("OK artboards=" + doc.artboards.length + " layers=" + doc.layers.length + " w=" + W + "mm h=" + H + "mm\nfonts used: " + SERIF + " / " + SANS + " / " + SANSB);
log.close();
