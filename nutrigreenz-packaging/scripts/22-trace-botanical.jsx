/**
 * 22-trace-botanical.jsx — turn the Köhler 1887 plate into gold vector art.
 *
 * Source: Arachide, Vilmorin-Andrieux & Cie, 1883 — a WOOD ENGRAVING.
 * Licence: PUBLIC DOMAIN (Wikimedia Commons file record: Copyrighted = False,
 * LicenseShortName = "Public domain"). Verified on the specific plate, not the
 * collection, per brand-spec.md.
 *
 * The Köhler 1887 chromolithograph was tried first and rejected: it is a TONAL
 * plate, so a black-and-white trace turned its dark leaves into solid gold
 * blobs. An engraving is already line and stipple, which is what survives a
 * single-ink trace and what "engraving feel" in the brief actually means.
 *
 * Replaces the procedurally drawn plant. A real engraving carries density and
 * varied line weight that cannot be written by hand in code, which is the whole
 * gap between this and the reference standard.
 *
 * Output is a standalone _ART file per the brief's deliverable matrix: Stage 3,
 * transparent, pure paths.
 */
#target illustrator

var MM = 2.834645669;
var DIR = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
var SRC = DIR + "20_assets/illustrations/vilmorin-plant-trace-src.png";

function log(s) { var f = new File("/tmp/ng-ai-test/trace-result.txt"); f.open("w"); f.write(s); f.close(); }

var src = new File(SRC);
if (!src.exists) { log("BLOCKED: source not found - " + SRC); throw new Error("no source"); }

// A4-ish scratch doc just to hold the traced art.
var doc = app.documents.add(DocumentColorSpace.CMYK, 400*MM, 700*MM);
doc.rulerUnits = RulerUnits.Millimeters;
var lay = doc.layers[0];
lay.name = "30_ARTWORK";

var placed = lay.placedItems.add();
placed.file = src;
placed.top = 0;
placed.left = 0;

/*
 * Image Trace. BLACKANDWHITE with a high threshold keeps the engraved linework
 * and drops the flat tonal washes — a colour trace of a chromolithograph
 * produces hundreds of muddy shapes that will not print as one gold ink.
 */
var traced = placed.trace();
var opts = traced.tracing.tracingOptions;
opts.tracingMode = TracingModeType.TRACINGMODEBLACKANDWHITE;
opts.threshold = 128;          // engraving line survives, paper tone drops
opts.pathFitting = 1.2;
opts.minimumArea = 6;          // keep stipple, drop scanner noise
opts.cornerAngle = 20;
opts.ignoreWhite = true;

var group = traced.tracing.expandTracing();

// Recolour every path to the brand gold and drop any fill-less strays.
var GOLD = new CMYKColor();
GOLD.cyan = 25; GOLD.magenta = 45; GOLD.yellow = 95; GOLD.black = 10;

var painted = 0;
function paint(items) {
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.typename === "GroupItem") { paint(it.pageItems); continue; }
    if (it.typename === "CompoundPathItem") { paint(it.pathItems); continue; }
    if (it.typename === "PathItem") {
      if (it.filled) { it.fillColor = GOLD; painted++; }
      if (it.stroked) { it.strokeColor = GOLD; }
    }
  }
}
paint(group.pageItems ? group.pageItems : [group]);

// Fit to a sensible artboard so the _ART file is usable as-is.
doc.artboards[0].artboardRect = [
  group.left, group.top, group.left + group.width, group.top - group.height
];

var so = new IllustratorSaveOptions();
so.compatibility = Compatibility.ILLUSTRATOR17;
doc.saveAs(new File(DIR + "20_assets/illustrations/NG_ART_groundnut_vilmorin_v01.ai"), so);

var eo = new ExportOptionsPNG24();
eo.antiAliasing = true; eo.transparency = true;
eo.horizontalScale = 100; eo.verticalScale = 100;
doc.exportFile(new File(DIR + "50_exports/print/NG_ART_groundnut_vilmorin_v01.png"), ExportType.PNG24, eo);

log("OK traced. paths painted=" + painted +
    "  art " + (group.width/MM).toFixed(1) + "x" + (group.height/MM).toFixed(1) + "mm");
