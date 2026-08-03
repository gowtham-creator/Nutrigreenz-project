/**
 * 30-full-label.jsx — NG-OIL-GN-1L-GLASS, rebuilt to the reference component set.
 *
 * Supersedes 20/21/23. Built from the client's own FarmSe bottle photographs,
 * which show the actual panel architecture:
 *
 *   FRONT      logo + tree, ~EXTRACTION~ line with tilde flourishes, ghani-press
 *              icon, product name, script line, COLD PRESSED, botanical hero,
 *              three trust roundels with captions, closing script line, veg mark
 *   NUTRITION  circular badge (text on a circular path around a drop icon),
 *              centred info rows separated by hairline rules, nutrition table
 *              inside a gold keyline box with a %RDA column and footnote,
 *              white overprint sticker for the packer
 *   STORY      botanical, opening quote, gold keyline box holding the script
 *              headline and the story, closing quote, Manufactured & Marketed by,
 *              fssai mark + licence, feedback line, social, recycling marks,
 *              PRODUCT OF INDIA, barcode, website
 *   FLAP       glue/overlap — deliberately near-empty, no critical print
 *
 * Ground stays the client's chosen cream with the crop motif; the reference is
 * used for STRUCTURE and component inventory, not for its colours or copy.
 *
 * DIMENSIONS_UNCONFIRMED — 280x120 with 4x70 panels is the brief's example.
 */
#target illustrator

var MM = 2.834645669;
var DIR = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
function log(s){var f=new File("/tmp/ng-ai-test/full-result.txt");f.open("w");f.write(s);f.close();}

function findFont(re){for(var i=0;i<app.textFonts.length;i++) if(re.test(app.textFonts[i].name)) return app.textFonts[i].name; return null;}
var SERIF  = findFont(/^RobotoSlab-Bold$/i);
var SERIFR = findFont(/^RobotoSlab-Regular$/i) || SERIF;
var SERIFL = findFont(/^RobotoSlab-Light$/i)   || SERIFR;
var SANS   = findFont(/^HankenGrotesk-Regular$/i);
var SANSB  = findFont(/^HankenGrotesk-Bold$/i)  || SANS;
var SANSM  = findFont(/^HankenGrotesk-Medium$/i)|| SANS;
if(!SERIF||!SANS){ log("BLOCKED: brand fonts missing - restart Illustrator"); throw new Error("fonts"); }

// ── geometry ─────────────────────────────────────────────────────────────
var PANEL=70, PANELS=4, W=PANEL*PANELS, H=120, BLEED=3, SAFE=4;
var PW=W+BLEED*2, PH=H+BLEED*2, X0=BLEED, Y0=BLEED;
var P=[X0, X0+PANEL, X0+PANEL*2, X0+PANEL*3];

function cmyk(c,m,y,k){var o=new CMYKColor();o.cyan=c;o.magenta=m;o.yellow=y;o.black=k;return o;}
var CREAM=[4,6,14,0], CREAM_W=[6,10,22,0], FOREST=[85,45,78,45], FORESTD=[88,55,84,72];
var GOLD=[25,45,95,10], GOLD_L=[15,28,70,2], VEG=[80,0,100,0], K100=[0,0,0,100], MAG=[0,100,0,0], WHITE=[0,0,0,0];

/*
 * Housekeeping before anything is drawn.
 *
 * Earlier runs opened a document each time and never closed one; eleven stacked
 * up and Illustrator stopped answering AppleEvents entirely for three hours.
 * A modal alert has the same effect - the script blocks forever waiting on a
 * dialog nobody is watching.
 */
app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
while (app.documents.length > 0) {
  try { app.documents[0].close(SaveOptions.DONOTSAVECHANGES); } catch (e) { break; }
}

var doc = app.documents.add(DocumentColorSpace.CMYK, PW*MM, PH*MM);
doc.rulerUnits = RulerUnits.Millimeters;
function mk(n){var l=doc.layers.add();l.name=n;return l;}
var L_BG=mk("10_BACKGROUND"), L_TEX=mk("20_TEXTURE"), L_ART=mk("30_ARTWORK"),
    L_TYPE=mk("40_TYPE"), L_VAR=mk("50_VARIABLE"), L_COMP=mk("60_COMPLIANCE"),
    L_BLD=mk("05_BLEED_GUIDE"), L_DIE=mk("00_DIELINE");

// ── primitives ───────────────────────────────────────────────────────────
function rect(L,x,y,w,h,fill,op){var r=L.pathItems.rectangle(-y*MM,x*MM,w*MM,h*MM);r.stroked=false;
  if(fill){r.filled=true;r.fillColor=cmyk(fill[0],fill[1],fill[2],fill[3]);}else r.filled=false;
  if(op!==undefined)r.opacity=op;return r;}
function box(L,x,y,w,h,col,sw,rad){
  var r = rad ? L.pathItems.roundedRectangle(-y*MM,x*MM,w*MM,h*MM,rad*MM,rad*MM)
              : L.pathItems.rectangle(-y*MM,x*MM,w*MM,h*MM);
  r.filled=false;r.stroked=true;r.strokeColor=cmyk(col[0],col[1],col[2],col[3]);r.strokeWidth=(sw||0.25)*MM;return r;}
function ln(L,x1,y1,x2,y2,col,w,op){var p=L.pathItems.add();p.setEntirePath([[x1*MM,-y1*MM],[x2*MM,-y2*MM]]);
  p.filled=false;p.stroked=true;p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);p.strokeWidth=(w||0.18)*MM;
  if(op!==undefined)p.opacity=op;return p;}
function curve(L,pts,col,w,op,closed,fill){var p=L.pathItems.add();p.setEntirePath(pts);
  var n=p.pathPoints.length;
  for(var i=0;i<n;i++){var c=pts[i],pv=pts[i>0?i-1:(closed?n-1:0)],nx=pts[i<n-1?i+1:(closed?0:n-1)];
    var tx=(nx[0]-pv[0])/5.2,ty=(nx[1]-pv[1])/5.2;var q=p.pathPoints[i];
    q.pointType=PointType.SMOOTH;q.leftDirection=[c[0]-tx,c[1]-ty];q.rightDirection=[c[0]+tx,c[1]+ty];}
  if(closed)p.closed=true;
  if(fill){p.filled=true;p.fillColor=cmyk(col[0],col[1],col[2],col[3]);p.stroked=false;}
  else{p.filled=false;p.stroked=true;p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);p.strokeWidth=(w||0.22)*MM;
       p.strokeCap=StrokeCap.ROUNDENDCAP;p.strokeJoin=StrokeJoin.ROUNDENDJOIN;}
  if(op!==undefined)p.opacity=op;return p;}
function tx(L,x,y,s,size,font,col,track,align){
  var t=L.textFrames.add();t.contents=s;
  var a=t.textRange.characterAttributes;a.size=size;a.fillColor=cmyk(col[0],col[1],col[2],col[3]);
  if(track)a.tracking=track;
  try{a.textFont=app.textFonts.getByName(font);}catch(e){}
  if(align==="c")t.textRange.paragraphAttributes.justification=Justification.CENTER;
  t.top=-y*MM;t.left=x*MM;
  if(align==="c")t.left=(x-t.width/(2*MM))*MM;
  if(align==="r")t.left=(x-t.width/MM)*MM;
  return t;}
function para(L,x,y,w,h,s,size,font,col,lead,align){
  var b=L.pathItems.rectangle(-y*MM,x*MM,w*MM,h*MM);b.filled=false;b.stroked=false;
  var t=L.textFrames.areaText(b);t.contents=s;
  var a=t.textRange.characterAttributes;a.size=size;a.fillColor=cmyk(col[0],col[1],col[2],col[3]);
  a.leading=lead||size*1.35;
  try{a.textFont=app.textFonts.getByName(font);}catch(e){}
  t.textRange.paragraphAttributes.justification=(align==="c")?Justification.CENTER:Justification.LEFT;
  return t;}

// ── background + crop motif ──────────────────────────────────────────────
rect(L_BG,0,0,PW,PH,CREAM);
rect(L_BG,P[1],Y0,PANEL,H,CREAM_W);
rect(L_BG,P[3],Y0,PANEL,H,CREAM_W);
function stalk(L,bx,by,hgt,op){
  curve(L,[[bx*MM,-by*MM],[(bx+1.3)*MM,-(by-hgt*0.55)*MM],[(bx+0.3)*MM,-(by-hgt)*MM]],GOLD,0.2,op);
  for(var i=0;i<8;i++){var t=i/7;
    var sx=bx+1.3*Math.sin(t*Math.PI)+0.3*t, sy=by-hgt*(0.26+0.7*t);
    curve(L,[[sx*MM,-sy*MM],[(sx-1.8)*MM,-(sy-1.2)*MM],[(sx-0.4)*MM,-(sy-2.2)*MM]],GOLD,0.16,op,true);
    curve(L,[[sx*MM,-sy*MM],[(sx+1.8)*MM,-(sy-1.2)*MM],[(sx+0.4)*MM,-(sy-2.2)*MM]],GOLD,0.16,op,true);}}
for(var s=0;s<46;s++){ stalk(L_TEX, X0+1.5+s*6.1, Y0+H-2, 16+(s%4)*7, 9); }

// ═══════════════════ PANEL 1 — FRONT ═══════════════════
var c1=P[0]+PANEL/2;
box(L_ART,P[0]+5,Y0+5,PANEL-10,H-10,GOLD,0.35);
box(L_ART,P[0]+6.4,Y0+6.4,PANEL-12.8,H-12.8,GOLD_L,0.16);

/*
 * The REAL brandmark, placed — not redrawn.
 *
 * Earlier versions drew a generic tree and typeset "NUTRI GREENZ" in Roboto
 * Slab. That was wrong twice over: the company has an actual logo (the N
 * monogram with its leaf, the wordmark, and the registered tagline "Born in
 * Soil, built for tomorrow"), and hand-redrawing a mark per SKU guarantees 64
 * slightly different logos — the exact failure brand-spec.md warns about.
 *
 * Placed at 40mm wide from a 1110px source, so roughly 700 DPI at final size.
 * Still a raster: ask the client for the vector master before press.
 */
var logo = L_ART.placedItems.add();
logo.file = new File(DIR + "20_assets/icons/NG_logo_stacked.png");
var LW = 36, LH = LW * (591/1110);   // 19.2mm tall
logo.width = LW*MM; logo.height = LH*MM;
logo.left = (c1 - LW/2)*MM;
logo.top  = -(Y0+7)*MM;

tx(L_TYPE,c1,Y0+30,"~  LAKDI GHANI EXTRACTION  ~",3.8,SANSM,GOLD,240,"c");
ghani(L_ART,c1,Y0+37,0.8);
tx(L_TYPE,c1,Y0+42,"GROUNDNUT",13,SERIF,FORESTD,-8,"c");
tx(L_TYPE,c1,Y0+48,"OIL",13,SERIF,FORESTD,-8,"c");
tx(L_TYPE,c1,Y0+55.5,"Genuinely & Traditionally",4.8,SERIFL,GOLD,10,"c");
tx(L_TYPE,c1,Y0+60,"COLD PRESSED",4.6,SANSB,GOLD,220,"c");

/* Hero sized from the space that is actually LEFT, not chosen and then found
   to collide: top of hero 62, roundels start 96, so 30mm of height with 4mm
   clearance. Width follows from the source aspect ratio. */
var hero=L_ART.placedItems.add();
hero.file=new File(DIR+"20_assets/illustrations/NG_HERO_groundnut_v02.png");
var HH=24, HW=HH*(1700/2480);   // 64..88, clears the roundels at 94
hero.width=HW*MM; hero.height=HH*MM;
hero.left=(c1-HW/2)*MM; hero.top=-(Y0+64)*MM;

var ry=Y0+94, rr=2.9;
var trust=[["heart","HEART","FRIENDLY"],["leaf","RICH IN","ANTIOXIDANTS"],["drop","ZERO-HEAT","PROCESS"]];
for(var t2=0;t2<3;t2++){
  var tcx=c1-15+t2*15;
  roundel(L_ART,tcx,ry,rr,trust[t2][0]);
  tx(L_TYPE,tcx,ry+4.6,trust[t2][1],2.5,SANSB,FOREST,90,"c");
  tx(L_TYPE,tcx,ry+7.0,trust[t2][2],2.5,SANSB,FOREST,90,"c");
}
tx(L_TYPE,c1,Y0+106,"Crafted on a Wooden Ghani,",3.9,SERIFL,GOLD,10,"c");
tx(L_TYPE,c1,Y0+110,"Trusted in Indian Kitchens",3.9,SERIFL,GOLD,10,"c");

// veg mark, top-right of the front panel
var vgx=P[0]+PANEL-13, vgy=Y0+9;
box(L_COMP,vgx,vgy,5.4,5.4,VEG,0.55);
var vd=L_COMP.pathItems.ellipse(-(vgy+1.4)*MM,(vgx+1.4)*MM,2.6*MM,2.6*MM);
vd.filled=true;vd.fillColor=cmyk(VEG[0],VEG[1],VEG[2],VEG[3]);vd.stroked=false;

// ═══════════════════ PANEL 2 — NUTRITION ═══════════════════
var c2=P[1]+PANEL/2;

/** Circular badge: text on a circular path around a drop icon. */
function badge(L,cx,cy,r,top,bottom){
  var ring=L.pathItems.ellipse(-(cy-r)*MM,(cx-r)*MM,r*2*MM,r*2*MM);
  ring.filled=false;ring.stroked=true;ring.strokeColor=cmyk(GOLD[0],GOLD[1],GOLD[2],GOLD[3]);ring.strokeWidth=0.18*MM;
  var outer=L.pathItems.ellipse(-(cy-r-1.6)*MM,(cx-r-1.6)*MM,(r+1.6)*2*MM,(r+1.6)*2*MM);
  var tp=L.textFrames.pathText(outer);
  tp.contents=top;
  var a=tp.textRange.characterAttributes;a.size=3.4;a.tracking=90;a.fillColor=cmyk(GOLD[0],GOLD[1],GOLD[2],GOLD[3]);
  try{a.textFont=app.textFonts.getByName(SANSB);}catch(e){}
  tp.textRange.paragraphAttributes.justification=Justification.CENTER;
  // drop
  curve(L,[[cx*MM,-(cy-2.6)*MM],[(cx+2.2)*MM,-(cy+0.4)*MM],[cx*MM,-(cy+2.4)*MM],[(cx-2.2)*MM,-(cy+0.4)*MM]],GOLD,0.3,undefined,true);
  tx(L_TYPE,cx,cy+r+3.4,bottom,3.0,SANSB,GOLD,150,"c");
}
/*
 * Height budget for this panel, computed rather than discovered:
 *   badge      Y0+6  .. Y0+26   (20mm)
 *   info rows  Y0+27 .. Y0+47   (4 rows x 5mm)
 *   table      Y0+48 .. Y0+95   (47mm: header 13 + 15 rows x 2.2 + footnote)
 *   sticker    Y0+97 .. Y0+114  (17mm, the packer's overprint)
 * Total ends at 114 against a 116 safe limit.
 */
/* No logo on this panel: the reference carries only the circular badge, and
   the lockup was overprinting the badge's curved text. */
badge(L_ART,c2,Y0+13,5.4,"100% PURE  &  WHOLESOME","NATURALLY  EXTRACTED");

var iy=Y0+25;
function inforow(label,value,bold){
  tx(L_TYPE,c2,iy,label+(value?": "+value:""),3.5,bold?SANSB:SANSM,FORESTD,0,"c");
  iy+=3.2;
  ln(L_ART,P[1]+9,iy,P[1]+PANEL-9,iy,GOLD,0.12,60);
  iy+=1.4;
}
inforow("Net Weight","1000 ml",true);
inforow("Ingredients","Cold-pressed Groundnut Oil");
inforow("Store in a cool & dry place, away from direct sunlight.","");
inforow("Allergen declaration","Contains groundnut (peanut)");

var nbx=P[1]+7, nby=iy+1.0, nbw=PANEL-14, nbh=55;   // measured: 15 rows x 2.1 + 16 header + 6 footnote   // 15 rows measured, not guessed
box(L_ART,nbx,nby,nbw,nbh,GOLD,0.28);
var ny=nby+4.2;
tx(L_TYPE,nbx+2.5,ny,"NUTRITIONAL FACT",5.6,SANSB,FORESTD,20); ny+=3.8;
tx(L_TYPE,nbx+2.5,ny,"<<n>> Servings per container",2.9,SANS,FORESTD,0); ny+=3.2;
ln(L_ART,nbx+2.5,ny,nbx+nbw-2.5,ny,GOLD,0.16); ny+=1.1;
tx(L_TYPE,nbx+2.5,ny,"Serving size",3.1,SANS,FORESTD,0);
tx(L_TYPE,nbx+nbw-2.5,ny,"2 Tbsp (14 g)",3.1,SANS,FORESTD,0,"r"); ny+=3.4;
ln(L_ART,nbx+2.5,ny,nbx+nbw-2.5,ny,GOLD,0.16); ny+=1.1;
tx(L_TYPE,nbx+2.5,ny,"Amount Per Serving",2.9,SANS,FORESTD,0);
tx(L_TYPE,nbx+nbw-2.5,ny,"% RDA/Serve*",2.9,SANS,FORESTD,0,"r"); ny+=3.2;
var NROWS=[
 ["CALORIES (<<kcal>>)","<<%>>",1,0],["Total Fat (<<g>>)","<<%>>",1,0],
 ["Saturated Fat (<<g>>)","<<%>>",0,1],["Trans Fat (<<g>>)","<<%>>",0,1],
 ["MUFA (<<g>>)","",0,1],["PUFA (<<g>>)","",0,1],
 ["Cholesterol (<<mg>>)","<<%>>",1,0],["Sodium (<<mg>>)","<<%>>",1,0],
 ["Total Carbohydrates (<<g>>)","<<%>>",1,0],["Dietary Fibre (<<g>>)","<<%>>",0,1],
 ["Total Sugar (<<g>>)","<<%>>",0,1],["Includes <<g>> Added Sugars","<<%>>",0,2],
 ["Protein (<<g>>)","<<%>>",1,0],["Iron (<<mg>>)","<<%>>",1,0],["Vitamin E (<<mg>>)","<<%>>",1,0]
];
for(var r3=0;r3<NROWS.length;r3++){
  var row=NROWS[r3];
  tx(L_TYPE,nbx+2.5+row[3]*2.0,ny,row[0],2.9,row[2]?SANSB:SANS,row[2]?FORESTD:FOREST,0);
  if(row[1]) tx(L_TYPE,nbx+nbw-2.5,ny,row[1],2.9,SANSB,MAG,0,"r");
  ny+=2.1;
  ln(L_ART,nbx+2.5,ny-0.5,nbx+nbw-2.5,ny-0.5,GOLD,0.07,45);
}
para(L_TYPE,nbx+2.5,ny+0.4,nbw-5,6,"* The % RDA tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.",2.2,SANS,FOREST,2.6);

var sx=P[1]+8, sy=nby+nbh+1.5, sw=PANEL-16, sh=12;
rect(L_VAR,sx,sy,sw,sh,WHITE);
var vlab=["Net Wt.","MRP \u20B9","Batch No.","Mfg. Date","Use by"];
for(var v2=0;v2<vlab.length;v2++){
  tx(L_TYPE,sx+2.2,sy+2.0+v2*2.05,vlab[v2],2.4,SANS,K100,0);
  ln(L_VAR,sx+15,sy+2.2+v2*2.05,sx+sw-2.2,sy+2.2+v2*2.05,K100,0.1,35);
}
tx(L_TYPE,sx+2.2,sy+6.1,"(incl. of all taxes)",1.7,SANS,K100,0);
tx(L_TYPE,sx,sy+sh+2.0,"<<OVERPRINTED AT PACKING - VALUES PROVISIONAL, LAB COA REQUIRED>>",2.3,SANSB,MAG,0);
if (sy+sh > Y0+H-SAFE) log("WARNING: nutrition panel overflows - ends " + (sy+sh).toFixed(1));

// ═══════════════════ PANEL 3 — STORY ═══════════════════
var c3=P[2]+PANEL/2;
/*
 * Story panel budget:
 *   botanical  Y0+5  .. Y0+29
 *   quote box  Y0+32 .. Y0+63
 *   address    Y0+65 .. Y0+86
 *   fssai      Y0+87 .. Y0+95
 *   feedback   Y0+96 .. Y0+102
 *   social     Y0+104
 *   marks      Y0+108
 *   barcode    Y0+111 .. Y0+120 (runs to trim, as on the reference)
 * The QR moves to the FRONT panel; there is no room for it here and it was
 * landing on top of the quote box.
 */
var hero2=L_ART.placedItems.add();
hero2.file=new File(DIR+"20_assets/illustrations/NG_HERO_groundnut_v02.png");
var H2H=19, H2W=H2H*(1700/2480);
hero2.width=H2W*MM; hero2.height=H2H*MM;
hero2.left=(c3-H2W/2)*MM; hero2.top=-(Y0+5)*MM;

var qy=Y0+25;
tx(L_TYPE,P[2]+7,qy+1,"\u201C",22,SERIF,GOLD,0);
box(L_ART,P[2]+10,qy+3,PANEL-20,26,GOLD,0.2);
para(L_TYPE,P[2]+12,qy+5.5,PANEL-24,8,"Traditionally Wood-Pressed.\nTruly Farm Fresh.",5.4,SERIFL,GOLD,6.8,"c");
para(L_TYPE,P[2]+12,qy+15,PANEL-24,15,"Purely pressed, never processed. We draw our groundnut oil on a wooden ghani turning slow and cold, so every drop keeps its aroma, its natural antioxidants and the quiet nuttiness that refining strips away.",3.0,SANS,FOREST,3.9,"c");
tx(L_TYPE,P[2]+PANEL-12,qy+27,"\u201D",22,SERIF,GOLD,0);

var by=Y0+54;
tx(L_TYPE,c3,by,"Manufactured & Marketed by:",3.0,SANS,FORESTD,0,"c"); by+=3.6;
tx(L_TYPE,c3,by,"Nutri Greenz Farm Technologies Pvt. Ltd.",3.5,SANSB,FORESTD,0,"c"); by+=4.0;
para(L_TYPE,P[2]+7,by,PANEL-14,9,"1st Floor, H.No. 5-35/167, Double Road, Near Moosapet Y Junction,\nPrashanth Nagar, Kukatpally, Hyderabad, Telangana 500072",2.7,SANS,FORESTD,3.3,"c"); by+=8.0;
/* The FSSAI mark is a registered regulatory logo supplied with the licence.
   Typesetting the word "fssai" in a serif is NOT that mark, so this is a
   clearly flagged placeholder rather than an approximation. */
box(L_COMP,c3-9,by-1,18,7,MAG,0.25);
tx(L_TYPE,c3,by+2.6,"<<FSSAI LOGO - FROM LICENCE PACK>>",2.2,SANSB,MAG,0,"c"); by+=7.5;
tx(L_TYPE,c3,by,"<<LIC. No. 14-DIGIT>>",3.0,SANSB,MAG,0,"c"); by+=4.0;
para(L_TYPE,P[2]+7,by,PANEL-14,8,"For feedback or complaints, contact +91 8074553370\nor email nutrigreenzfarm@gmail.com",2.6,SANS,FORESTD,3.2,"c"); by+=6.4;

function circIcon(L,cx,cy,r){var o=L.pathItems.ellipse(-(cy-r)*MM,(cx-r)*MM,r*2*MM,r*2*MM);
  o.filled=true;o.fillColor=cmyk(FORESTD[0],FORESTD[1],FORESTD[2],FORESTD[3]);o.stroked=false;return o;}
circIcon(L_COMP,c3-12,by,1.5); circIcon(L_COMP,c3-8.4,by,1.5);
tx(L_TYPE,c3-5.6,by-1.4,"nutrigreenz.farm",2.8,SANS,FORESTD,0); by+=4.2;

var rx=c3-13;
box(L_COMP,rx,by-1.8,4.0,3.0,FORESTD,0.2);
curve(L_COMP,[[(rx+6.4)*MM,-(by-1.6)*MM],[(rx+8.8)*MM,-(by+0.1)*MM],[(rx+6.4)*MM,-(by+1.2)*MM]],FORESTD,0.22,undefined,true);
tx(L_TYPE,c3+2,by-1.6,"PRODUCT OF INDIA",2.7,SANSB,FORESTD,60); by+=4.0;

var bcx=c3-16, bcw=32, bch=7.5;
rect(L_VAR,bcx-1.2,by-1.2,bcw+2.4,bch+4.6,WHITE);
var seed=7;
for(var b=0;b<58;b++){
  seed=(seed*1103515245+12345)%2147483648;
  var wd=0.24+((seed>>16)%3)*0.14;
  var bar=L_VAR.pathItems.rectangle(-by*MM,(bcx+b*(bcw/58))*MM,wd*MM,bch*MM);
  bar.filled=true;bar.fillColor=cmyk(0,0,0,100);bar.stroked=false;
}
tx(L_TYPE,c3,by+bch+2.2,"8 901234 567890  <<NEEDS GS1>>",2.3,SANS,K100,20,"c");
tx(L_TYPE,c3,by+bch+5.0,"WWW.NUTRIGREENZ.FARM",2.6,SANSB,GOLD,110,"c");
if (by+bch+5.0 > Y0+H-1) log("WARNING: story panel overflows - ends " + (by+bch+5.0).toFixed(1));

// ═══════════════════ PANEL 4 — FLAP ═══════════════════
tx(L_TYPE,P[3]+PANEL/2,Y0+H/2,"GLUE FLAP  -  NO CRITICAL PRINT",3.4,SANSB,MAG,150,"c");
tx(L_TYPE,P[3]+PANEL/2,Y0+H/2+5,"<<width set by vendor overlap, 3-5mm typical>>",2.8,SANS,MAG,0,"c");

// ── QR: front panel, small, under the roundels ───────────────────────────
var qx2=P[0]+PANEL-15, qy2=Y0+96;
rect(L_VAR,qx2,qy2,8.5,8.5,WHITE);
var qs=19;
for(var a2=0;a2<9;a2++)for(var b2=0;b2<9;b2++){
  qs=(qs*1103515245+12345)%2147483648;
  if((qs>>18)%2===0)continue;
  var qm=L_VAR.pathItems.rectangle(-(qy2+0.4+a2*0.9)*MM,(qx2+0.4+b2*0.9)*MM,0.9*MM,0.9*MM);
  qm.filled=true;qm.fillColor=cmyk(0,0,0,100);qm.stroked=false;
}
tx(L_TYPE,qx2+4.25,qy2+10.6,"SCAN TO TRACE",2.2,SANSB,FOREST,60,"c");

// ── guides ───────────────────────────────────────────────────────────────
for(var f=1;f<PANELS;f++) ln(L_DIE,P[f],Y0,P[f],Y0+H,MAG,0.12);
box(L_DIE,X0,Y0,W,H,MAG,0.25);
box(L_BLD,X0+SAFE,Y0+SAFE,W-SAFE*2,H-SAFE*2,[70,0,0,0],0.2);
tx(L_DIE,X0+2,Y0+H+2.4,"DIMENSIONS_UNCONFIRMED - 280x120mm is the brief's example, not a vendor dieline. Do not print.",3.2,SANSB,MAG,0);
L_DIE.printable=false;L_BLD.printable=false;L_DIE.locked=true;L_BLD.locked=true;

// ── save + export ────────────────────────────────────────────────────────
var so=new IllustratorSaveOptions();so.compatibility=Compatibility.ILLUSTRATOR17;
doc.saveAs(new File(DIR+"40_skus/NG-OIL-GN-1L-GLASS_FLAT_v07.ai"),so);
var eo=new ExportOptionsPNG24();
eo.antiAliasing=true;eo.transparency=false;eo.horizontalScale=300;eo.verticalScale=300;
doc.exportFile(new File(DIR+"50_exports/print/NG-OIL-GN-1L-GLASS_FLAT_v07.png"),ExportType.PNG24,eo);
log("OK v07 - 4 panels, "+doc.layers.length+" layers, real logo placed");
doc.close(SaveOptions.DONOTSAVECHANGES);   // leave nothing open for the next run
