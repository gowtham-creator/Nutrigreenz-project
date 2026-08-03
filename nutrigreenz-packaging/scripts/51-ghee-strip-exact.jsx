/**
 * 51-ghee-strip-exact.jsx — A2 Bilona Ghee wrap strip, built to the client's
 * approved render.
 *
 * Supersedes 50. The earlier version had the structure wrong in four ways; this
 * matches the render zone for zone:
 *
 *   1  LEFT, cream        statutory block #1 — ingredients, net qty, MFD BY +
 *                         FSSAI licence, MKT BY + FSSAI licence, storage,
 *                         best before, feedback paragraph
 *   2  CENTRE, cream      principal display panel — stacked logo (monogram +
 *                         wordmark + tagline between gold rules), product name
 *                         in BRASS serif, "100% Pure", wheat motif at the foot
 *   3  NUTRITION          a rounded DARK GREEN BOX floating on the cream, not a
 *                         full-height panel
 *   4  RIGHT, GOLDEN      statutory block #2 repeated on a golden-yellow field,
 *                         plus circular seal, barcode and the white
 *                         MRP/USP/BATCH/MFG/USE-BY overprint box
 *
 * The repeat of the statutory block is deliberate on a wrap: whichever way the
 * jar is turned on shelf, the legal copy is readable.
 *
 * DIMENSIONS_UNCONFIRMED — 500ml jar circumference not yet supplied.
 */
#target illustrator

var MM = 2.834645669;
var DIR = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
function log(s){var f=new File("/tmp/ng-ai-test/ghee2-result.txt");f.open("w");f.write(s);f.close();}

function findFont(re){for(var i=0;i<app.textFonts.length;i++) if(re.test(app.textFonts[i].name)) return app.textFonts[i].name; return null;}
var SERIF=findFont(/^RobotoSlab-Bold$/i), SERIFR=findFont(/^RobotoSlab-Regular$/i)||SERIF,
    SERIFL=findFont(/^RobotoSlab-Light$/i)||SERIFR,
    SANS=findFont(/^HankenGrotesk-Regular$/i), SANSB=findFont(/^HankenGrotesk-Bold$/i)||SANS,
    SANSM=findFont(/^HankenGrotesk-Medium$/i)||SANS;
if(!SERIF||!SANS){log("BLOCKED: fonts missing");throw new Error("fonts");}

/* Proportions taken from the render (3.17:1) rather than guessed. */
var W=230, H=122, BLEED=3, SAFE=3.5;
var PW=W+BLEED*2, PH=H+BLEED*2, X0=BLEED, Y0=BLEED;
var CREAM_END = X0 + W*0.725;          // cream ends, golden field begins
var Z1 = X0+6,          Z1W = 56;      // left statutory
var Z2 = X0+66,         Z2W = 56;      // centre display panel
var Z3 = X0+126,        Z3W = 38;      // nutrition box
var Z4 = CREAM_END+4,   Z4W = (X0+W)-CREAM_END-8;   // golden statutory

function cmyk(c,m,y,k){var o=new CMYKColor();o.cyan=c;o.magenta=m;o.yellow=y;o.black=k;return o;}
var CREAM=[2,4,12,0], GOLDEN=[5,25,82,0], GOLDEN_D=[8,32,90,2],
    GREEN=[85,45,88,42], GREEND=[88,52,88,60],
    BRASS=[24,45,92,10], GOLD_L=[16,30,72,2],
    INK=[68,55,60,60], WHITE=[0,0,0,0], K100=[0,0,0,100], MAG=[0,100,0,0], VEG=[80,0,100,0];

app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
while(app.documents.length>0){try{app.documents[0].close(SaveOptions.DONOTSAVECHANGES);}catch(e){break;}}

var doc=app.documents.add(DocumentColorSpace.CMYK,PW*MM,PH*MM);
doc.rulerUnits=RulerUnits.Millimeters;
function mk(n){var l=doc.layers.add();l.name=n;return l;}
var L_BG=mk("10_BACKGROUND"),L_TEX=mk("20_TEXTURE"),L_ART=mk("30_ARTWORK"),
    L_TYPE=mk("40_TYPE"),L_VAR=mk("50_VARIABLE"),L_COMP=mk("60_COMPLIANCE"),
    L_BLD=mk("05_BLEED_GUIDE"),L_DIE=mk("00_DIELINE");

function rect(L,x,y,w,h,f,op){var r=L.pathItems.rectangle(-y*MM,x*MM,w*MM,h*MM);r.stroked=false;
  if(f){r.filled=true;r.fillColor=cmyk(f[0],f[1],f[2],f[3]);}else r.filled=false;
  if(op!==undefined)r.opacity=op;return r;}
function rrect(L,x,y,w,h,rad,f,op){var r=L.pathItems.roundedRectangle(-y*MM,x*MM,w*MM,h*MM,rad*MM,rad*MM);
  r.stroked=false;r.filled=true;r.fillColor=cmyk(f[0],f[1],f[2],f[3]);
  if(op!==undefined)r.opacity=op;return r;}
function box(L,x,y,w,h,col,sw,rad){var r=rad?L.pathItems.roundedRectangle(-y*MM,x*MM,w*MM,h*MM,rad*MM,rad*MM)
  :L.pathItems.rectangle(-y*MM,x*MM,w*MM,h*MM);
  r.filled=false;r.stroked=true;r.strokeColor=cmyk(col[0],col[1],col[2],col[3]);r.strokeWidth=(sw||0.22)*MM;return r;}
function ln(L,x1,y1,x2,y2,col,w,op){var p=L.pathItems.add();p.setEntirePath([[x1*MM,-y1*MM],[x2*MM,-y2*MM]]);
  p.filled=false;p.stroked=true;p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);p.strokeWidth=(w||0.18)*MM;
  if(op!==undefined)p.opacity=op;return p;}
function curve(L,pts,col,w,op,cl,fl){var p=L.pathItems.add();p.setEntirePath(pts);
  var n=p.pathPoints.length;
  for(var i=0;i<n;i++){var c=pts[i],pv=pts[i>0?i-1:(cl?n-1:0)],nx=pts[i<n-1?i+1:(cl?0:n-1)];
    var tx=(nx[0]-pv[0])/5.2,ty=(nx[1]-pv[1])/5.2;var q=p.pathPoints[i];
    q.pointType=PointType.SMOOTH;q.leftDirection=[c[0]-tx,c[1]-ty];q.rightDirection=[c[0]+tx,c[1]+ty];}
  if(cl)p.closed=true;
  if(fl){p.filled=true;p.fillColor=cmyk(col[0],col[1],col[2],col[3]);p.stroked=false;}
  else{p.filled=false;p.stroked=true;p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);p.strokeWidth=(w||0.2)*MM;
       p.strokeCap=StrokeCap.ROUNDENDCAP;p.strokeJoin=StrokeJoin.ROUNDENDJOIN;}
  if(op!==undefined)p.opacity=op;return p;}
function tx(L,x,y,s,size,font,col,track,align){var t=L.textFrames.add();t.contents=s;
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

// ── grounds: cream left two-thirds, golden right third ───────────────────
rect(L_BG,0,0,PW,PH,CREAM);
rect(L_BG,CREAM_END,0,PW-CREAM_END,PH,GOLDEN);

/*
 * MOTIF SCENE — printed across the whole label, not a band at the foot.
 *
 * The reference fills its entire golden field with pale line-art: trees, a sun,
 * a grazing cow and grain. That coverage is what stops the label reading as an
 * empty field with text floating on it, which is exactly how the earlier
 * version looked. Kept at low opacity so it sits behind the type.
 */
function tree(L,cx,cy,sc,op,col){
  // trunk + branches
  curve(L,[[cx*MM,-cy*MM],[(cx+0.3*sc)*MM,-(cy-3*sc)*MM],[cx*MM,-(cy-6.5*sc)*MM]],col,0.28*sc,op);
  curve(L,[[cx*MM,-(cy-3.4*sc)*MM],[(cx-2.2*sc)*MM,-(cy-5.2*sc)*MM]],col,0.2*sc,op);
  curve(L,[[cx*MM,-(cy-4.2*sc)*MM],[(cx+2.2*sc)*MM,-(cy-6.0*sc)*MM]],col,0.2*sc,op);
  // canopy as a ring of small leaf lobes
  for(var a=0;a<14;a++){
    var th=Math.PI*(0.06+0.88*a/13), rr=(3.4+0.55*Math.sin(a*1.9))*sc;
    var lx=cx+Math.cos(th)*rr, ly=cy-6.2*sc-Math.sin(th)*rr*0.82;
    curve(L,[[lx*MM,-ly*MM],[(lx-0.9*sc)*MM,-(ly-1.5*sc)*MM],[(lx+0.5*sc)*MM,-(ly-2.4*sc)*MM],[(lx+1.1*sc)*MM,-(ly-0.9*sc)*MM]],col,0.18*sc,op,true);
  }
}
function sun(L,cx,cy,r,op,col){
  var c=L.pathItems.ellipse(-(cy-r)*MM,(cx-r)*MM,r*2*MM,r*2*MM);
  c.filled=false;c.stroked=true;c.strokeColor=cmyk(col[0],col[1],col[2],col[3]);
  c.strokeWidth=0.3*MM;c.opacity=op;
  for(var a=0;a<16;a++){var th=a/16*Math.PI*2;
    ln(L,cx+Math.cos(th)*(r+1.1),cy+Math.sin(th)*(r+1.1),
         cx+Math.cos(th)*(r+2.6),cy+Math.sin(th)*(r+2.6),col,0.24,op);}
}
function cow(L,cx,cy,sc,op,col){
  // body, head, legs, tail — a simple grazing silhouette in line
  curve(L,[[(cx-4.4*sc)*MM,-cy*MM],[(cx-3.6*sc)*MM,-(cy-2.2*sc)*MM],[(cx+2.6*sc)*MM,-(cy-2.4*sc)*MM],[(cx+4.2*sc)*MM,-(cy-0.6*sc)*MM],[(cx+3.8*sc)*MM,-cy*MM]],col,0.26*sc,op);
  curve(L,[[(cx+3.9*sc)*MM,-(cy-1.2*sc)*MM],[(cx+5.6*sc)*MM,-(cy-1.0*sc)*MM],[(cx+6.0*sc)*MM,-(cy+0.6*sc)*MM]],col,0.24*sc,op);
  curve(L,[[(cx+5.4*sc)*MM,-(cy-1.6*sc)*MM],[(cx+6.2*sc)*MM,-(cy-2.4*sc)*MM]],col,0.18*sc,op);
  for(var i=0;i<4;i++){var lx2=cx-3.4*sc+i*2.2*sc;
    ln(L,lx2,cy,lx2,cy+3.0*sc,col,0.22*sc,op);}
  curve(L,[[(cx-4.4*sc)*MM,-(cy-0.4*sc)*MM],[(cx-5.6*sc)*MM,-(cy+1.6*sc)*MM],[(cx-5.2*sc)*MM,-(cy+3.0*sc)*MM]],col,0.18*sc,op);
}
function grainTuft(L,bx,by,hgt,op,col){
  curve(L,[[bx*MM,-by*MM],[(bx+0.9)*MM,-(by-hgt*0.55)*MM],[(bx+0.2)*MM,-(by-hgt)*MM]],col,0.2,op);
  for(var i=0;i<7;i++){var t=i/6;
    var sx=bx+0.9*Math.sin(t*Math.PI)+0.2*t, sy=by-hgt*(0.24+0.72*t);
    curve(L,[[sx*MM,-sy*MM],[(sx-1.2)*MM,-(sy-0.85)*MM],[(sx-0.28)*MM,-(sy-1.6)*MM]],col,0.16,op,true);
    curve(L,[[sx*MM,-sy*MM],[(sx+1.2)*MM,-(sy-0.85)*MM],[(sx+0.28)*MM,-(sy-1.6)*MM]],col,0.16,op,true);}
}

/* CREAM field: brass line-art, low opacity so the dense left column stays
   readable on top of it. */
sun(L_TEX, X0+22, Y0+16, 6.0, 15, BRASS);
tree(L_TEX, X0+34, Y0+H-6, 1.15, 15, BRASS);
tree(L_TEX, X0+96, Y0+H-5, 1.45, 14, BRASS);
tree(L_TEX, X0+150, Y0+H-6, 1.2, 13, BRASS);
cow(L_TEX, X0+118, Y0+H-8, 1.0, 14, BRASS);
for(var g=0; g<30; g++){
  var gx = X0+3+g*5.6; if(gx > CREAM_END-3) break;
  grainTuft(L_TEX, gx, Y0+H-2, 9+(g%4)*4.5, 17, BRASS);
}

/* GOLDEN field: WHITE line-art at higher opacity — this is the full-coverage
   treatment in the reference, and white on gold is what makes it read. */
sun(L_TEX, X0+W-18, Y0+94, 5.4, 32, WHITE);
tree(L_TEX, CREAM_END+13, Y0+H-6, 1.35, 30, WHITE);
tree(L_TEX, CREAM_END+42, Y0+H-5, 1.7, 26, WHITE);
tree(L_TEX, CREAM_END+68, Y0+H-6, 1.3, 28, WHITE);
cow(L_TEX, CREAM_END+55, Y0+H-9, 1.1, 30, WHITE);
for(var g2=0; g2<18; g2++){
  var gx2 = CREAM_END+2+g2*4.8; if(gx2 > X0+W-2) break;
  grainTuft(L_TEX, gx2, Y0+H-2, 10+(g2%4)*5, 32, WHITE);
}

/* The statutory block, drawn twice — once on cream, once on golden. */
function statutory(x,w,startY,col,headCol,brief){
  var y=startY;
  function kv(head,val,size){
    var t=tx(L_TYPE,x,y,head,size||2.7,SANSB,headCol,10);
    tx(L_TYPE,x+t.width/MM+1.2,y,val,size||2.7,SANS,col,0);
    y+=3.1;
  }
  kv("INGREDIENTS:","A2 Desi cow milk fat.",4.6);
  kv("NET QUANTITY:","500 ml / <<g>>",4.6);
  y+=0.6;
  tx(L_TYPE,x,y,"MFD. BY:",4.4,SANSB,headCol,10);
  para(L_TYPE,x,y+3.0,w,10,"Nutri Greenz Farm Technologies Pvt. Ltd.\n1st Floor, H.No. 5-35/167, Double Road, Moosapet,\nKukatpally, Hyderabad, Telangana 500072",3.9,SANS,col,4.7);
  y+=15.0;
  tx(L_TYPE,x,y,"fssai",5.0,SERIFL,headCol,20);
  tx(L_TYPE,x+11,y,"LIC NO. <<14-DIGIT>>",4.2,SANSB,MAG,0);
  y+=6.6;
  tx(L_TYPE,x,y,"MKT. BY:",4.4,SANSB,headCol,10);
  para(L_TYPE,x,y+3.0,w,7,"Nutri Greenz Farm Technologies Pvt. Ltd.\nKukatpally, Hyderabad, Telangana 500072",3.9,SANS,col,4.7);
  y+=10.8;
  tx(L_TYPE,x,y,"fssai",5.0,SERIFL,headCol,20);
  tx(L_TYPE,x+11,y,"LIC NO. <<14-DIGIT>>",4.2,SANSB,MAG,0);
  y+=6.8;
  tx(L_TYPE,x,y,"STORAGE INFORMATION:",4.4,SANSB,headCol,10);
  para(L_TYPE,x,y+3.0,w,9,"Store in a cool and dry place away from direct heat\nand light, with the lid tightly closed.",3.9,SANS,col,4.7);
  y+=11.4;
  para(L_TYPE,x,y,w,7,"BEST BEFORE 12 MONTHS FROM THE\nDATE OF MANUFACTURE.",4.3,SANSB,headCol,5.2);
  y+=10.4;
  if (!brief) {
    para(L_TYPE,x,y,w,9,"For feedback or complaints, contact +91 8074553370\nor email nutrigreenzfarm@gmail.com",3.6,SANS,col,4.4);
    y+=9.2;
  }
  tx(L_TYPE,x,y,"COUNTRY OF ORIGIN: INDIA",4.2,SANSB,headCol,10);
  return y+5;
}

// ── ZONE 1 — brand story, then the statutory block ───────────────────────
/* The story sits ABOVE the legal copy, not instead of it: the statutory block
   is mandatory, so the story has to earn its space rather than take theirs.

   Positions are computed, not eyeballed. `t.top` is the TOP of the glyph box,
   so a 15pt quote mark occupies ~5.3mm downward from wherever it is placed —
   putting it at the same y as the text start drops it BELOW the first line,
   which is what went wrong before. */
var QT = 15, QH = QT * 0.353;          // pt -> mm for the quote glyphs
tx(L_TYPE, Z1, Y0+5, "\u201C", QT, SERIF, BRASS, 0);
para(L_TYPE, Z1+2, Y0+5+QH+0.5, Z1W-5, 18,
     "Churned from curd, never cream \u2014 so every spoon carries the sweet caramel aroma our grandmothers knew.",
     4.2, SERIFR, GREEND, 5.3);
tx(L_TYPE, Z1+Z1W-4.5, Y0+5+QH+6.5, "\u201D", QT, SERIF, BRASS, 0);
ln(L_ART, Z1, Y0+25, Z1+Z1W, Y0+25, BRASS, 0.35);

var end1 = statutory(Z1, Z1W, Y0+29, INK, GREEND);
if(end1 > Y0+H-SAFE) log("WARNING: left statutory overflows at "+end1.toFixed(1));

// ── ZONE 2 — principal display panel ─────────────────────────────────────
var c2 = Z2 + Z2W/2;
var logo = L_ART.placedItems.add();
/* WORDMARK ONLY — name + tagline, no N monogram. Client instruction:
   this is the single lockup used on every label and every image. */
logo.file = new File(DIR+"20_assets/icons/NG_wordmark.png");
var LW = 52, LH = LW*(220/1282);
logo.width = LW*MM; logo.height = LH*MM;
logo.left = (c2-LW/2)*MM; logo.top = -(Y0+26)*MM;

var ny = Y0+26+LH+16;
ln(L_ART, c2-22, ny, c2+22, ny, BRASS, 0.4);
tx(L_TYPE, c2, ny+8, "A2 BILONA GHEE", 14.5, SERIF, BRASS, -4, "c");
ln(L_ART, c2-22, ny+13.5, c2+22, ny+13.5, BRASS, 0.4);
tx(L_TYPE, c2, ny+19, "100% Pure", 8.4, SERIFR, INK, 0, "c");

// ── ZONE 3 — nutrition, a rounded dark-green box on the cream ────────────
var nby = Y0+8, nbh = H-16;
rrect(L_BG, Z3, nby, Z3W, nbh, 3.5, GREEN);
var tX = Z3+3.5, tW = Z3W-7, ty = nby+6;
tx(L_TYPE,tX,ty,"NUTRITION FACTS",8.6,SANSB,WHITE,0); ty+=5.8;
tx(L_TYPE,tX,ty,"<<n>> Servings per container",3.6,SANS,GOLD_L,0); ty+=4.2;
ln(L_ART,tX,ty,tX+tW,ty,WHITE,0.25,75); ty+=1.2;
tx(L_TYPE,tX,ty,"Serving Size",3.9,SANS,WHITE,0);
tx(L_TYPE,tX+tW,ty,"1 Tbsp (14 g)",3.9,SANS,WHITE,0,"r"); ty+=4.6;
ln(L_ART,tX,ty,tX+tW,ty,WHITE,0.14,50); ty+=1.2;
tx(L_TYPE,tX,ty,"Amount Per Serving",3.2,SANS,GOLD_L,0);
tx(L_TYPE,tX+tW,ty,"% RDA/Serve*",3.2,SANS,GOLD_L,0,"r"); ty+=3.8;
var NR=[["CALORIES (<<kcal>>)","<<%>>",1,0],["Total Fat (<<g>>)","<<%>>",1,0],
        ["Saturated Fat (<<g>>)","<<%>>",0,1],["Trans Fat (<<g>>)","",0,1],
        ["MUFA (<<g>>)","",0,1],["PUFA (<<g>>)","",0,1],
        ["Cholesterol (<<mg>>)","<<%>>",1,0],["Protein (<<g>>)","<<%>>",1,0],
        ["Total Carbohydrate (<<g>>)","<<%>>",1,0],["Dietary Fibre (<<g>>)","<<%>>",0,1],
        ["Total Sugar (<<g>>)","",0,1],["Includes <<g>> Added Sugars","<<%>>",0,2],
        ["Sodium (<<mg>>)","<<%>>",1,0]];
for(var r=0;r<NR.length;r++){
  tx(L_TYPE,tX+NR[r][3]*2.4,ty,NR[r][0],3.7,NR[r][2]?SANSB:SANS,WHITE,0);
  if(NR[r][1]) tx(L_TYPE,tX+tW,ty,NR[r][1],3.7,SANSB,MAG,0,"r");
  ty+=3.75;
  ln(L_ART,tX,ty-0.6,tX+tW,ty-0.6,WHITE,0.07,32);
}
para(L_TYPE,tX,ty+0.4,tW,8,"*The % RDA tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice. VALUES PROVISIONAL - LAB COA REQUIRED.",1.85,SANS,MAG,2.3);
if(ty+7 > nby+nbh) log("WARNING: nutrition box overflows at "+(ty+7).toFixed(1));

// ── ZONE 4 — statutory repeat on golden + seal, barcode, overprint ───────
/* The right column repeats the legal copy but shares its field with the
   barcode and the overprint box, so it stops after Best Before and drops the
   feedback paragraph — that text already appears in full on the cream panel. */
var end4 = statutory(Z4, Z4W-6, Y0+7, GREEND, GREEND, true);
if(end4 > Y0+H-SAFE) log("WARNING: right statutory overflows at "+end4.toFixed(1));

// circular seal, top right — typographic, since the wordmark cannot be
// legibly set inside a 10mm circle and the N monogram is no longer used.
var sx0 = X0+W-14, sy0 = Y0+13;
var so1=L_ART.pathItems.ellipse(-(sy0-6)*MM,(sx0-6)*MM,12*MM,12*MM);
so1.filled=true;so1.fillColor=cmyk(GREEN[0],GREEN[1],GREEN[2],GREEN[3]);so1.stroked=false;
var so2=L_ART.pathItems.ellipse(-(sy0-5)*MM,(sx0-5)*MM,10*MM,10*MM);
so2.filled=false;so2.stroked=true;so2.strokeColor=cmyk(GOLD_L[0],GOLD_L[1],GOLD_L[2],GOLD_L[3]);so2.strokeWidth=0.2*MM;
tx(L_TYPE,sx0,sy0-2.8,"100%",4.2,SANSB,WHITE,20,"c");
tx(L_TYPE,sx0,sy0+1.2,"PURE",4.2,SANSB,WHITE,20,"c");
ln(L_ART,sx0-2.6,sy0+2.6,sx0+2.6,sy0+2.6,GOLD_L,0.15);

// barcode
var bcx=Z4+2, bcy=Y0+H-44, bcw=32, bch=13;
rect(L_ART,bcx-1.2,bcy-1.2,bcw+2.4,bch+5,WHITE);   // backing below the type
var sd=11;
for(var b=0;b<54;b++){sd=(sd*1103515245+12345)%2147483648;
  var wd=0.22+((sd>>16)%3)*0.12;
  var br=L_COMP.pathItems.rectangle(-bcy*MM,(bcx+b*(bcw/54))*MM,wd*MM,bch*MM);
  br.filled=true;br.fillColor=cmyk(0,0,0,100);br.stroked=false;}
tx(L_TYPE,bcx+bcw/2,bcy+bch+3.0,"8 901234 567890",2.8,SANS,K100,10,"c");

// white overprint box: MRP / USP / BATCH / DATE OF MFG / USE BY
var ox=Z4+2, oy=Y0+H-26, ow=46, oh=21;
rect(L_ART,ox,oy,ow,oh,WHITE);                     // backing below the type
tx(L_TYPE,ox+2,oy+3.6,"MRP ₹",3.6,SANSB,K100,0);
tx(L_TYPE,ox+15,oy+3.6,"(incl. of all taxes)",2.4,SANS,K100,0);
var vl=["USP:","BATCH NO:","DATE OF MFG:","USE BY:"];
for(var v=0;v<vl.length;v++){
  tx(L_TYPE,ox+2,oy+9+v*3.2,vl[v],3.0,SANSB,K100,0);
  ln(L_VAR,ox+16,oy+9.3+v*3.2,ox+ow-2,oy+9.3+v*3.2,K100,0.12,40);
}
tx(L_TYPE,ox,oy-2.2,"<<OVERPRINTED AT PACKING>>",2.4,SANSB,MAG,0);

// veg mark, bottom of the golden field
box(L_COMP,X0+W-11,Y0+H-53,6.0,6.0,VEG,0.55);
var vd=L_COMP.pathItems.ellipse(-(Y0+H-51.5)*MM,(X0+W-9.5)*MM,3.0*MM,3.0*MM);
vd.filled=true;vd.fillColor=cmyk(VEG[0],VEG[1],VEG[2],VEG[3]);vd.stroked=false;

// ── guides ───────────────────────────────────────────────────────────────
box(L_DIE,X0,Y0,W,H,MAG,0.25);
ln(L_DIE,CREAM_END,Y0,CREAM_END,Y0+H,MAG,0.12);
box(L_BLD,X0+SAFE,Y0+SAFE,W-SAFE*2,H-SAFE*2,[70,0,0,0],0.18);
tx(L_DIE,X0+2,Y0+H+2.4,"DIMENSIONS_UNCONFIRMED - 230x122mm assumed for a 500ml ghee jar. Get the vendor dieline before print.",2.8,SANSB,MAG,0);
L_DIE.printable=false;L_BLD.printable=false;L_DIE.locked=true;L_BLD.locked=true;

var so=new IllustratorSaveOptions();so.compatibility=Compatibility.ILLUSTRATOR17;
doc.saveAs(new File(DIR+"40_skus/NG-GHEE-A2BILONA-500ML_FLAT_v16.ai"),so);
var eo=new ExportOptionsPNG24();
eo.antiAliasing=true;eo.transparency=false;eo.horizontalScale=300;eo.verticalScale=300;
doc.exportFile(new File(DIR+"50_exports/print/NG-GHEE-A2BILONA-500ML_FLAT_v16.png"),ExportType.PNG24,eo);
log("OK ghee exact "+W+"x"+H+"mm, 4 zones");
doc.close(SaveOptions.DONOTSAVECHANGES);
