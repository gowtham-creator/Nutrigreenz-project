/**
 * 23-place-hero.jsx — put the real botanical into the front panel.
 *
 * Source: Arachis hypogaea, Franz Eugen Köhler's Medizinal-Pflanzen, 1887.
 * Licence: PUBLIC DOMAIN — Wikimedia Commons file record gives
 * Copyrighted = False, LicenseShortName = "Public domain". Verified on this
 * specific plate, per brand-spec.md.
 *
 * Two auto-trace attempts were made first and both failed, which is worth
 * recording so nobody repeats them:
 *   · The Köhler plate is a chromolithograph — TONAL, not line art. A
 *     black-and-white trace turns its dark leaves into solid gold blobs.
 *   · The Vilmorin 1883 wood engraving is genuine line work but the only scan
 *     is 529px wide; its lines are 1-2px, so any threshold merges them.
 *
 * So the plate is placed as a toned raster instead. At 1700px in a 30mm frame
 * that is ~1440 DPI, far above the 300 DPI press minimum, and it keeps the
 * painting's modelling — which is the whole point. The paper is keyed to alpha
 * so it drops onto the cream ground with no white box.
 *
 * The front panel is rebuilt around it: the illustration now leads, with the
 * product name beneath, because the brief is explicit that the illustration IS
 * the product.
 */
#target illustrator

var MM = 2.834645669;
var DIR = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
function log(s){var f=new File("/tmp/ng-ai-test/hero-result.txt");f.open("w");f.write(s);f.close();}

var doc = null;
for (var d = 0; d < app.documents.length; d++)
  if (/NG-OIL-GN-1L-GLASS/.test(app.documents[d].name)) { doc = app.documents[d]; break; }
if (!doc) { log("BLOCKED: label document not open"); throw new Error("no doc"); }
app.activeDocument = doc;

function L(n){
  for (var i=0;i<doc.layers.length;i++) if (doc.layers[i].name===n) return doc.layers[i];
  log("BLOCKED: layer '"+n+"' missing"); throw new Error("layer "+n);
}
for (var u=0;u<doc.layers.length;u++){ doc.layers[u].locked=false; doc.layers[u].visible=true; }

var L_ART = L("30_ARTWORK"), L_TYPE = L("40_TYPE"), L_COMP = L("60_COMPLIANCE");

var PANEL=70, H=120, BLEED=3, X0=BLEED, Y0=BLEED;
var fcx = X0 + PANEL/2;

function cmyk(c,m,y,k){var o=new CMYKColor();o.cyan=c;o.magenta=m;o.yellow=y;o.black=k;return o;}
var GOLD=[25,45,95,10], GOLD_L=[15,28,70,2], FORESTD=[88,55,84,72], FOREST=[85,45,78,45];

function findFont(re){for(var i=0;i<app.textFonts.length;i++) if(re.test(app.textFonts[i].name)) return app.textFonts[i].name; return null;}
var SERIF=findFont(/^RobotoSlab-Bold$/i), SANSM=findFont(/^HankenGrotesk-Medium$/i)||findFont(/^HankenGrotesk-Regular$/i), SANSB=findFont(/^HankenGrotesk-Bold$/i);

/*
 * Clear the old front-panel contents. Everything left of the first fold on the
 * artwork/type layers goes, so the panel can be rebuilt cleanly rather than
 * having a third generation of plant drawn on top of the previous two.
 */
function clearFront(lay) {
  for (var i = lay.pageItems.length - 1; i >= 0; i--) {
    var it = lay.pageItems[i];
    var cx = (it.left + it.width/2) / MM;
    if (cx < X0 + PANEL) { try { it.remove(); } catch(e) {} }
  }
}
clearFront(L_ART);
clearFront(L_TYPE);
clearFront(L_COMP);

function tx(lay,x,y,s,size,font,col,track,align){
  var t=lay.textFrames.add(); t.contents=s;
  var a=t.textRange.characterAttributes;
  a.size=size; a.fillColor=cmyk(col[0],col[1],col[2],col[3]);
  if(track)a.tracking=track;
  try{a.textFont=app.textFonts.getByName(font);}catch(e){}
  if(align==="c")t.textRange.paragraphAttributes.justification=Justification.CENTER;
  t.top=-y*MM; t.left=x*MM;
  if(align==="c")t.left=(x-t.width/(2*MM))*MM;
  if(align==="r")t.left=(x-t.width/MM)*MM;
  return t;
}
function ln(lay,x1,y1,x2,y2,col,w){
  var p=lay.pathItems.add(); p.setEntirePath([[x1*MM,-y1*MM],[x2*MM,-y2*MM]]);
  p.filled=false;p.stroked=true;p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);p.strokeWidth=(w||0.25)*MM;
  return p;
}
function diamond(lay,x,y,r,col){
  var p=lay.pathItems.add();
  p.setEntirePath([[x*MM,-(y-r)*MM],[(x+r)*MM,-y*MM],[x*MM,-(y+r)*MM],[(x-r)*MM,-y*MM]]);
  p.closed=true;p.filled=true;p.stroked=false;p.fillColor=cmyk(col[0],col[1],col[2],col[3]);
  return p;
}
function ruleD(lay,x1,x2,y){
  ln(lay,x1+2,y,x2-2,y,GOLD,0.3);
  ln(lay,x1+3.5,y+0.7,x2-3.5,y+0.7,GOLD_L,0.14);
  diamond(lay,x1,y,0.7,GOLD); diamond(lay,x2,y,0.7,GOLD);
}

// ── frame ────────────────────────────────────────────────────────────────
var fx=X0+6, fy=Y0+6, fw=PANEL-12, fh=H-12;
var fr=L_ART.pathItems.rectangle(-fy*MM,fx*MM,fw*MM,fh*MM);
fr.filled=false;fr.stroked=true;fr.strokeColor=cmyk(GOLD[0],GOLD[1],GOLD[2],GOLD[3]);fr.strokeWidth=0.35*MM;
var fr2=L_ART.pathItems.rectangle(-(fy+1.6)*MM,(fx+1.6)*MM,(fw-3.2)*MM,(fh-3.2)*MM);
fr2.filled=false;fr2.stroked=true;fr2.strokeColor=cmyk(GOLD_L[0],GOLD_L[1],GOLD_L[2],GOLD_L[3]);fr2.strokeWidth=0.18*MM;

// ── masthead ─────────────────────────────────────────────────────────────
tx(L_TYPE,fcx,Y0+9,"NUTRI GREENZ",11.5,SERIF,FORESTD,90,"c");
tx(L_TYPE,fcx,Y0+15.5,"FARM  TECHNOLOGIES",4.2,SANSM,GOLD,300,"c");
ruleD(L_ART,fcx-15,fcx+15,Y0+21);
tx(L_TYPE,fcx,Y0+24.5,"COLD-PRESSED",5.4,SANSB,GOLD,340,"c");

// ── HERO — the illustration leads ────────────────────────────────────────
var hero = L_ART.placedItems.add();
hero.file = new File(DIR + "20_assets/illustrations/NG_HERO_groundnut_v02.png");
// 1700x2480 source → 30mm wide keeps the aspect and lands ~1440 DPI
var HW = 30, HH = HW * (2480/1700);
hero.width  = HW*MM;
hero.height = HH*MM;
hero.left   = (fcx - HW/2)*MM;
hero.top    = -(Y0+30)*MM;

// ── product name beneath the hero ────────────────────────────────────────
var ny = Y0 + 30 + HH + 4;
tx(L_TYPE,fcx,ny,"GROUNDNUT",16.5,SERIF,FORESTD,-10,"c");
tx(L_TYPE,fcx,ny+7.2,"OIL",16.5,SERIF,FORESTD,-10,"c");
ruleD(L_ART,fcx-13,fcx+13,ny+16.5);
tx(L_TYPE,fcx,ny+19.5,"WOOD-PRESSED  ·  UNREFINED",4.6,SANSM,FOREST,250,"c");
tx(L_TYPE,fcx,ny+25,"Single-origin  ·  Anantapur",4.6,SANSM,GOLD,120,"c");

// ── mandatory: veg mark + net quantity ───────────────────────────────────
var vgx=X0+10, vgy=Y0+H-16;
var vsq=L_COMP.pathItems.rectangle(-vgy*MM,vgx*MM,6*MM,6*MM);
vsq.filled=false;vsq.stroked=true;vsq.strokeColor=cmyk(80,0,100,0);vsq.strokeWidth=0.6*MM;
var vd=L_COMP.pathItems.ellipse(-(vgy+1.5)*MM,(vgx+1.5)*MM,3*MM,3*MM);
vd.filled=true;vd.fillColor=cmyk(80,0,100,0);vd.stroked=false;
tx(L_TYPE,X0+PANEL-10,Y0+H-18,"NET QUANTITY",3.8,SANSM,GOLD,160,"r");
tx(L_TYPE,X0+PANEL-10,Y0+H-12,"1 L",12,SERIF,FORESTD,0,"r");

// ── re-lock guides, save, export ─────────────────────────────────────────
L("00_DIELINE").locked=true; L("00_DIELINE").printable=false;
L("05_BLEED_GUIDE").locked=true; L("05_BLEED_GUIDE").printable=false;

var so=new IllustratorSaveOptions(); so.compatibility=Compatibility.ILLUSTRATOR17;
doc.saveAs(new File(DIR+"40_skus/NG-OIL-GN-1L-GLASS_FLAT_v03.ai"),so);
var eo=new ExportOptionsPNG24();
eo.antiAliasing=true;eo.transparency=false;eo.horizontalScale=300;eo.verticalScale=300;
doc.exportFile(new File(DIR+"50_exports/print/NG-OIL-GN-1L-GLASS_FLAT_v03.png"),ExportType.PNG24,eo);

log("OK hero placed " + HW.toFixed(1) + "x" + HH.toFixed(1) + "mm, name block at y=" + ny.toFixed(1));
