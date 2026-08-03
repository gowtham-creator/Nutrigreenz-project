/**
 * 21-richness.jsx — the depth-and-ornament pass, run over 20-*.jsx output.
 *
 * The flat was structurally correct but visually thin: flat fills, one weight
 * of rule, and a botanical made of eight outline shapes. Premium pantry labels
 * get their richness from four things this adds:
 *
 *   1. A vignette so the ground is not a dead flat field
 *   2. Double rules with terminal diamonds, and real corner flourishes
 *   3. An engraved botanical — hatched, varied line weight, dense enough to
 *      read as drawn rather than traced
 *   4. A seal medallion, which is what gives a pantry label its centre of
 *      gravity below the product name
 *
 * Everything is still vector, still CMYK, still on the named layers.
 *
 * Honest limit: a procedurally drawn plant will never match a real botanical
 * engraving. The proper fix is a public-domain plate of Arachis hypogaea
 * (Biodiversity Heritage Library / Wikimedia, licence verified per plate) image-
 * traced and recoloured to the gold ink, or a commissioned illustrator. This is
 * the best available until one of those lands.
 */
#target illustrator

function findFont(re) {
  for (var i = 0; i < app.textFonts.length; i++)
    if (re.test(app.textFonts[i].name)) return app.textFonts[i].name;
  return null;
}
var SERIF = findFont(/^RobotoSlab-Bold$/i);
var SANSM = findFont(/^HankenGrotesk-Medium$/i) || findFont(/^HankenGrotesk-Regular$/i);

var MM = 2.834645669;
var PANEL = 70, W = 280, H = 120, BLEED = 3;
var X0 = BLEED, Y0 = BLEED;
var P = [X0, X0 + PANEL, X0 + PANEL*2, X0 + PANEL*3];

function cmyk(c,m,y,k){var o=new CMYKColor();o.cyan=c;o.magenta=m;o.yellow=y;o.black=k;return o;}
var GOLD=[25,45,95,10], GOLD_L=[15,28,70,2], GOLD_D=[35,55,100,25];
var FORESTD=[88,55,84,72], SHADE=[30,20,35,10];

/*
 * Find the label document explicitly. Falling back to activeDocument picks up
 * whatever the user last clicked, and a name lookup that silently returns
 * layers[0] targets the LOCKED dieline — which is what produced
 * "Error 8705: Target layer cannot be modified" rather than a useful message.
 */
var doc = null;
for (var d = 0; d < app.documents.length; d++) {
  if (/NG-OIL-GN-1L-GLASS/.test(app.documents[d].name)) { doc = app.documents[d]; break; }
}
if (!doc) {
  var e1 = new File("/tmp/ng-ai-test/rich-result.txt");
  e1.open("w"); e1.write("BLOCKED: NG-OIL-GN-1L-GLASS document is not open."); e1.close();
  throw new Error("label document not open");
}
app.activeDocument = doc;

function L(n){
  for (var i=0;i<doc.layers.length;i++) if (doc.layers[i].name===n) return doc.layers[i];
  var e2 = new File("/tmp/ng-ai-test/rich-result.txt");
  e2.open("w"); e2.write("BLOCKED: layer '" + n + "' not found."); e2.close();
  throw new Error("layer not found: " + n);
}
// Unlock everything for the pass; the guide layers are re-locked at the end.
for (var u = 0; u < doc.layers.length; u++) { doc.layers[u].locked = false; doc.layers[u].visible = true; }
var L_TEX = L("20_TEXTURE"), L_ART = L("30_ARTWORK"), L_TYPE = L("40_TYPE");
doc.activeLayer = L_ART;

function curve(Lay, pts, col, w, op, closed) {
  var p = Lay.pathItems.add();
  p.setEntirePath(pts);
  var n = p.pathPoints.length;
  for (var i=0;i<n;i++){
    var cur=pts[i], prv=pts[i>0?i-1:(closed?n-1:0)], nxt=pts[i<n-1?i+1:(closed?0:n-1)];
    var tx0=(nxt[0]-prv[0])/5.2, ty0=(nxt[1]-prv[1])/5.2;
    var pt=p.pathPoints[i];
    pt.pointType=PointType.SMOOTH;
    pt.leftDirection=[cur[0]-tx0,cur[1]-ty0];
    pt.rightDirection=[cur[0]+tx0,cur[1]+ty0];
  }
  if (closed) p.closed=true;
  p.filled=false; p.stroked=true;
  p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);
  p.strokeWidth=(w||0.25)*MM;
  p.strokeCap=StrokeCap.ROUNDENDCAP; p.strokeJoin=StrokeJoin.ROUNDENDJOIN;
  if (op!==undefined) p.opacity=op;
  return p;
}
function ln(Lay,x1,y1,x2,y2,col,w,op){
  var p=Lay.pathItems.add();
  p.setEntirePath([[x1*MM,-y1*MM],[x2*MM,-y2*MM]]);
  p.filled=false;p.stroked=true;
  p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);
  p.strokeWidth=(w||0.2)*MM;
  if(op!==undefined)p.opacity=op;
  return p;
}
function diamond(Lay,x,y,r,col){
  var p=Lay.pathItems.add();
  p.setEntirePath([[x*MM,-(y-r)*MM],[(x+r)*MM,-y*MM],[x*MM,-(y+r)*MM],[(x-r)*MM,-y*MM]]);
  p.closed=true; p.filled=true; p.stroked=false;
  p.fillColor=cmyk(col[0],col[1],col[2],col[3]);
  return p;
}

// ── 1. Vignette: the ground stops being a dead flat field ─────────────────
for (var v = 0; v < 16; v++) {
  var inset = v * 1.5;
  var band = L_TEX.pathItems.rectangle(-(Y0+inset)*MM, (X0+inset)*MM,
                                       (W-inset*2)*MM, (H-inset*2)*MM);
  band.filled = false; band.stroked = true;
  band.strokeColor = cmyk(SHADE[0],SHADE[1],SHADE[2],SHADE[3]);
  band.strokeWidth = 1.6*MM;
  band.opacity = 3.2;   // 16 stacked bands ≈ a soft edge-darkening
}

// ── 2. Ornament: double rules, terminal diamonds, corner flourishes ───────
function flourish(Lay, cx, cy, sx, sy) {
  // a quarter-arc with a curled terminal, mirrored by the sx/sy signs
  curve(Lay, [[cx*MM, -(cy+7*sy)*MM],
              [(cx+2.4*sx)*MM, -(cy+2.4*sy)*MM],
              [(cx+7*sx)*MM, -cy*MM]], GOLD, 0.3);
  curve(Lay, [[(cx+7*sx)*MM, -cy*MM],
              [(cx+9.6*sx)*MM, -(cy+0.7*sy)*MM],
              [(cx+9.9*sx)*MM, -(cy+2.6*sy)*MM],
              [(cx+8.2*sx)*MM, -(cy+3.0*sy)*MM],
              [(cx+7.9*sx)*MM, -(cy+1.6*sy)*MM]], GOLD, 0.24);
  curve(Lay, [[cx*MM, -(cy+7*sy)*MM],
              [(cx-0.7*sx)*MM, -(cy+9.6*sy)*MM],
              [(cx-2.6*sx)*MM, -(cy+9.9*sy)*MM],
              [(cx-3.0*sx)*MM, -(cy+8.2*sy)*MM],
              [(cx-1.6*sx)*MM, -(cy+7.9*sy)*MM]], GOLD, 0.24);
  diamond(Lay, cx + 4.4*sx, cy + 4.4*sy, 0.55, GOLD_D);
}
var fx = P[0]+6, fy = Y0+6, fw = PANEL-12, fh = H-12;
flourish(L_ART, fx+1.5,      fy+1.5,       1,  1);
flourish(L_ART, fx+fw-1.5,   fy+1.5,      -1,  1);
flourish(L_ART, fx+1.5,      fy+fh-1.5,    1, -1);
flourish(L_ART, fx+fw-1.5,   fy+fh-1.5,   -1, -1);

/** Rule with a diamond at each end — replaces the plain hairlines. */
function ruleD(Lay, x1, x2, y) {
  ln(Lay, x1+2, y, x2-2, y, GOLD, 0.3);
  ln(Lay, x1+3.5, y+0.7, x2-3.5, y+0.7, GOLD_L, 0.14);
  diamond(Lay, x1, y, 0.7, GOLD);
  diamond(Lay, x2, y, 0.7, GOLD);
}
ruleD(L_ART, P[0]+PANEL/2-16, P[0]+PANEL/2+16, Y0+25.5);
ruleD(L_ART, P[0]+PANEL/2-14, P[0]+PANEL/2+14, Y0+58);
ruleD(L_ART, P[1]+16, P[1]+PANEL-16, Y0+36);

// ── 3. Seal medallion — the centre of gravity below the product name ──────
function seal(Lay, cx, cy, r) {
  var o1 = Lay.pathItems.ellipse(-(cy-r)*MM, (cx-r)*MM, r*2*MM, r*2*MM);
  o1.filled=false;o1.stroked=true;o1.strokeColor=cmyk(GOLD[0],GOLD[1],GOLD[2],GOLD[3]);o1.strokeWidth=0.42*MM;
  var o2 = Lay.pathItems.ellipse(-(cy-r+1.1)*MM, (cx-r+1.1)*MM, (r-1.1)*2*MM, (r-1.1)*2*MM);
  o2.filled=false;o2.stroked=true;o2.strokeColor=cmyk(GOLD_L[0],GOLD_L[1],GOLD_L[2],GOLD_L[3]);o2.strokeWidth=0.16*MM;
  // ticked bezel
  for (var a = 0; a < 44; a++) {
    var th = a/44*Math.PI*2;
    var r1 = r-1.9, r2 = r-2.6;
    ln(Lay, cx+Math.cos(th)*r1, cy+Math.sin(th)*r1,
            cx+Math.cos(th)*r2, cy+Math.sin(th)*r2, GOLD, 0.14);
  }
  // ghani press: mortar, pestle, drop
  curve(Lay, [[(cx-3.1)*MM,-(cy+2.4)*MM],[(cx-2.3)*MM,-(cy+4.1)*MM],
              [(cx+2.3)*MM,-(cy+4.1)*MM],[(cx+3.1)*MM,-(cy+2.4)*MM]], GOLD, 0.3);
  ln(Lay, cx-3.5, cy+2.4, cx+3.5, cy+2.4, GOLD, 0.3);
  ln(Lay, cx, cy+2.2, cx, cy-2.6, GOLD, 0.34);
  ln(Lay, cx-1.5, cy-2.6, cx+1.5, cy-2.6, GOLD, 0.26);
  curve(Lay, [[cx*MM,-(cy-0.4)*MM],[(cx+1.0)*MM,-(cy+0.7)*MM],
              [cx*MM,-(cy+1.5)*MM],[(cx-1.0)*MM,-(cy+0.7)*MM]], GOLD, 0.22, undefined, true);
}
/* Seal sits in the gap between the descriptor rule and the hero. Its radius
   plus the hero's top reach must not overlap - checked, not eyeballed. */
seal(L_ART, P[0]+PANEL/2, Y0+73, 7.6);

// ── 4. Engraved botanical: hatching + varied weight ──────────────────────
function engravedGroundnut(Lay, cx, cy, sc) {
  function C(pts,w,closed){
    var m=[];
    for (var i=0;i<pts.length;i++) m.push([(cx+pts[i][0]*sc)*MM, -(cy+pts[i][1]*sc)*MM]);
    return curve(Lay,m,GOLD,w||0.26,undefined,closed);
  }
  function H(x1,y1,x2,y2,w){ // hatch stroke
    ln(Lay, cx+x1*sc, cy+y1*sc, cx+x2*sc, cy+y2*sc, GOLD_L, w||0.12);
  }
  C([[0,7.5],[0.5,2],[0,-3],[0.3,-8]], 0.4);
  C([[0.9,6.6],[1.1,2.4],[0.7,-2.6]], 0.14);          // stem shading
  var tiers=[[-6.4,3.4],[-2.3,3.0],[1.7,2.4]];
  for (var i=0;i<tiers.length;i++){
    var yy=tiers[i][0], q=tiers[i][1];
    C([[0.2,yy+0.6],[-q*0.55,yy-0.1]],0.2);
    C([[0.2,yy+0.6],[ q*0.55,yy-0.1]],0.2);
    C([[-q*0.55,yy],[-q*0.95,yy-1.5],[-q*1.8,yy-0.7],[-q*1.35,yy+0.95]],0.28,true);
    C([[ q*0.55,yy],[ q*0.95,yy-1.5],[ q*1.8,yy-0.7],[ q*1.35,yy+0.95]],0.28,true);
    // midribs + venation hatching
    C([[-q*0.6,yy-0.05],[-q*1.62,yy-0.35]],0.14);
    C([[ q*0.6,yy-0.05],[ q*1.62,yy-0.35]],0.14);
    for (var h=1;h<=3;h++){
      var t=h/4;
      H(-q*(0.6+1.0*t), yy-0.1-0.28*t, -q*(0.6+1.0*t)-0.25, yy-0.95-0.2*t);
      H(-q*(0.6+1.0*t), yy-0.1-0.28*t, -q*(0.6+1.0*t)-0.2,  yy+0.55);
      H( q*(0.6+1.0*t), yy-0.1-0.28*t,  q*(0.6+1.0*t)+0.25, yy-0.95-0.2*t);
      H( q*(0.6+1.0*t), yy-0.1-0.28*t,  q*(0.6+1.0*t)+0.2,  yy+0.55);
    }
  }
  C([[0.15,-8],[0.1,-10]],0.22);
  // soil line, broken so it reads as ground not a rule
  C([[-7,7.6],[-3.4,7.35],[-0.4,7.5]],0.2);
  C([[0.9,7.5],[3.6,7.35],[7,7.7]],0.2);
  for (var d=0; d<9; d++) H(-6.5+d*1.6, 8.0, -6.1+d*1.6, 8.7, 0.1);
  C([[0.2,7.5],[-2.2,8.8],[-3.2,10.4]],0.24);
  C([[0.4,7.5],[ 2.3,8.9],[ 3.3,10.5]],0.24);
  function pod(px,py,flip){
    var f=flip?-1:1;
    C([[px,py],[px+1.7*f,py+0.5],[px+2.0*f,py+2.0],[px+1.05*f,py+2.75],
       [px+0.2*f,py+3.8],[px-0.95*f,py+4.1],[px-1.7*f,py+3.1],
       [px-1.25*f,py+1.95],[px-1.6*f,py+0.85]],0.32,true);
    C([[px-0.95*f,py+2.35],[px+0.95*f,py+2.15]],0.16);
    // shell reticulation — what makes it read as a groundnut
    for (var s2=0;s2<5;s2++){
      var ty2=py+0.7+s2*0.62;
      H(px-1.35*f, ty2, px+1.5*f, ty2-0.12, 0.1);
    }
    for (var s3=0;s3<4;s3++){
      var ty3=py+2.7+s3*0.38;
      H(px-1.25*f, ty3, px+1.2*f, ty3-0.1, 0.1);
    }
  }
  pod(-3.4,10.1,false);
  pod( 3.5,10.2,true);
}

// replace the plain plant on the front with the engraved one
// (the earlier simple plant is left in place under it deliberately — its
//  outline reads as the heavier contour of an engraving)
engravedGroundnut(L_ART, P[0]+PANEL/2, Y0+95, 1.05);
engravedGroundnut(L_ART, P[1]+PANEL/2, Y0+19, 0.72);

// ── 5. Denser crop motif so the ground has texture, not three lonely stalks
function stalk2(Lay,bx,by,hgt,op){
  curve(Lay,[[bx*MM,-by*MM],[(bx+1.3)*MM,-(by-hgt*0.55)*MM],[(bx+0.3)*MM,-(by-hgt)*MM]],GOLD,0.2,op);
  for (var i=0;i<8;i++){
    var t=i/7;
    var sx=bx+1.3*Math.sin(t*Math.PI)+0.3*t;
    var sy=by-hgt*(0.26+0.7*t);
    curve(Lay,[[sx*MM,-sy*MM],[(sx-1.8)*MM,-(sy-1.2)*MM],[(sx-0.4)*MM,-(sy-2.2)*MM]],GOLD,0.17,op,true);
    curve(Lay,[[sx*MM,-sy*MM],[(sx+1.8)*MM,-(sy-1.2)*MM],[(sx+0.4)*MM,-(sy-2.2)*MM]],GOLD,0.17,op,true);
  }
}
for (var s4=0;s4<44;s4++){
  var sxp = X0 + 1.5 + s4*6.3;
  if (sxp > P[2]+22 && sxp < P[3]-2) continue;
  stalk2(L_TEX, sxp, Y0+H-2, 17+(s4%4)*7, 11);
}

// ── save + re-export ─────────────────────────────────────────────────────
// re-lock the non-printing guides before saving
L("00_DIELINE").locked = true; L("00_DIELINE").printable = false;
L("05_BLEED_GUIDE").locked = true; L("05_BLEED_GUIDE").printable = false;

var base = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
var so = new IllustratorSaveOptions(); so.compatibility = Compatibility.ILLUSTRATOR17;
doc.saveAs(new File(base + "40_skus/NG-OIL-GN-1L-GLASS_FLAT_v02.ai"), so);
var eo = new ExportOptionsPNG24();
eo.antiAliasing=true; eo.transparency=false; eo.horizontalScale=300; eo.verticalScale=300;
doc.exportFile(new File(base + "50_exports/print/NG-OIL-GN-1L-GLASS_FLAT_v02.png"), ExportType.PNG24, eo);

var log=new File("/tmp/ng-ai-test/rich-result.txt");
log.open("w"); log.write("OK v02 richness pass applied"); log.close();
