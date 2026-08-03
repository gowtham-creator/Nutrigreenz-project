/**
 * 50-ghee-strip.jsx — A2 Desi Cow Ghee, flat wrap strip for the 500ml jar.
 *
 * Built to the layout in the client's own OpenArt render: one continuous strip
 * reading left-to-right as it wraps —
 *
 *   LEFT    statutory block (ingredients, net qty, mfd/mkt by, FSSAI, storage,
 *           best before, feedback)
 *   CENTRE  principal display panel: wordmark, product name, purity line,
 *           gold grain motif at the foot
 *   RIGHT   NUTRITION FACTS reversed out of a dark forest block
 *
 * Uses the WORDMARK lockup (name + tagline, no monogram) per the client's
 * instruction, placed from the real brand file rather than typeset.
 *
 * Cow ghee palette: warm cream ground, forest nutrition block, gold ornament —
 * carried from the client's render so the ghee line reads as one family.
 *
 * DIMENSIONS_UNCONFIRMED — jar circumference not yet supplied.
 */
#target illustrator

var MM=2.834645669;
var DIR="/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
function log(s){var f=new File("/tmp/ng-ai-test/ghee-result.txt");f.open("w");f.write(s);f.close();}

function findFont(re){for(var i=0;i<app.textFonts.length;i++) if(re.test(app.textFonts[i].name)) return app.textFonts[i].name; return null;}
var SERIF=findFont(/^RobotoSlab-Bold$/i), SERIFL=findFont(/^RobotoSlab-Light$/i)||SERIF,
    SANS=findFont(/^HankenGrotesk-Regular$/i), SANSB=findFont(/^HankenGrotesk-Bold$/i)||SANS,
    SANSM=findFont(/^HankenGrotesk-Medium$/i)||SANS;
if(!SERIF||!SANS){log("BLOCKED: fonts missing");throw new Error("fonts");}

/* 500ml ghee jar. Squatter and wider than the oil bottle: a wrap of ~250mm at
   ~95mm tall is the usual proportion for this jar shape. UNCONFIRMED. */
var W=250,H=95,BLEED=3,SAFE=4;
var PW=W+BLEED*2,PH=H+BLEED*2,X0=BLEED,Y0=BLEED;
/* Three zones, not four equal panels — the centre display panel is widest
   because it is the face a shopper sees. */
var Z=[X0, X0+78, X0+168, X0+W];   // left stat | centre PDP | right nutrition

function cmyk(c,m,y,k){var o=new CMYKColor();o.cyan=c;o.magenta=m;o.yellow=y;o.black=k;return o;}
var CREAM=[3,6,16,0], CREAM_W=[5,10,24,0], FOREST=[86,48,80,52], FORESTD=[88,58,84,72],
    GOLD=[22,42,92,8], GOLD_L=[14,26,68,2], INK=[70,55,60,58], WHITE=[0,0,0,0],
    VEG=[80,0,100,0], K100=[0,0,0,100], MAG=[0,100,0,0];

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
  else{p.filled=false;p.stroked=true;p.strokeColor=cmyk(col[0],col[1],col[2],col[3]);p.strokeWidth=(w||0.22)*MM;
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

// ── ground ───────────────────────────────────────────────────────────────
rect(L_BG,0,0,PW,PH,CREAM);
rect(L_BG,Z[0],Y0,Z[1]-Z[0],H,CREAM_W);          // left stat panel, warmer

/* Gold grain/wave motif along the foot — the device in the client's render. */
function grainWave(L,x0,x1,yb,amp,op){
  var pts=[],n=26;
  for(var i=0;i<=n;i++){var t=i/n;
    pts.push([(x0+(x1-x0)*t)*MM, -(yb - amp*Math.sin(t*Math.PI*3.0))*MM]);}
  curve(L,pts,GOLD,0.3,op);
  for(var s=0;s<18;s++){
    var t2=(s+0.5)/18, bx=x0+(x1-x0)*t2, by=yb-amp*Math.sin(t2*Math.PI*3.0);
    curve(L,[[bx*MM,-by*MM],[(bx-1.4)*MM,-(by-2.6)*MM],[(bx-0.3)*MM,-(by-4.6)*MM]],GOLD,0.22,op);
    curve(L,[[bx*MM,-by*MM],[(bx+1.4)*MM,-(by-2.6)*MM],[(bx+0.3)*MM,-(by-4.6)*MM]],GOLD,0.22,op);
  }
}
grainWave(L_TEX,X0,Z[2],Y0+H-4,2.4,26);
grainWave(L_TEX,X0,Z[2],Y0+H-10,1.8,14);

// ══════════════ LEFT — statutory block ══════════════
var lx=Z[0]+7, lw=Z[1]-Z[0]-14, ly=Y0+10;
function head(t){ tx(L_TYPE,lx,ly,t,3.2,SANSB,FORESTD,30); ly+=3.4; }
function body(t,lines){ para(L_TYPE,lx,ly,lw,lines*3.4+2,t,2.8,SANS,INK,3.3); ly+=lines*3.1+2.4; }

head("INGREDIENTS");
body("A2 Desi cow milk fat (100%).",1);
head("NET QUANTITY");
body("500 ml  (<<g>> net weight)",1);
head("MFD. & MKT. BY");
body("Nutri Greenz Farm Technologies Pvt. Ltd.\n1st Floor, H.No. 5-35/167, Double Road,\nNear Moosapet Y Junction, Prashanth Nagar,\nKukatpally, Hyderabad, Telangana 500072",4);
tx(L_TYPE,lx,ly,"fssai",4.0,SERIFL,FORESTD,30);
box(L_COMP,lx+8,ly-1.4,15,4.6,MAG,0.2);
tx(L_TYPE,lx+8.7,ly+1.5,"<<FSSAI MARK>>",1.7,SANSB,MAG,0); ly+=5.2;
tx(L_TYPE,lx,ly,"<<14-DIGIT LICENCE No.>>",2.8,SANSB,MAG,0); ly+=4.4;
head("STORAGE INFORMATION");
body("Store in a cool, dry place away from direct\nheat and light, with the lid tightly closed.\nUse a dry spoon.",3);
head("BEST BEFORE");
body("<<n>> months from the date of manufacture.",1);
para(L_TYPE,lx,ly,lw,10,"For feedback or complaints, contact\n+91 8074553370 or nutrigreenzfarm@gmail.com",2.6,SANS,INK,3.1);
ly+=7;
tx(L_TYPE,lx+7,Y0+H-7.5,"COUNTRY OF ORIGIN: INDIA",2.8,SANSB,FORESTD,10);
if(ly>Y0+H-SAFE) log("WARNING: left panel overflows at "+ly.toFixed(1));

// veg mark, bottom-left of the statutory panel
box(L_COMP,lx,Y0+H-11,5.0,5.0,VEG,0.55);
var vd=L_COMP.pathItems.ellipse(-(Y0+H-9.7)*MM,(lx+1.3)*MM,2.4*MM,2.4*MM);
vd.filled=true;vd.fillColor=cmyk(VEG[0],VEG[1],VEG[2],VEG[3]);vd.stroked=false;

// ══════════════ CENTRE — principal display panel ══════════════
var cx=(Z[1]+Z[2])/2;

// wordmark: name + tagline, no monogram, per the client's instruction
var wm=L_ART.placedItems.add();
wm.file=new File(DIR+"20_assets/icons/NG_wordmark.png");
var WW=56, WH=WW*(220/1282);
wm.width=WW*MM; wm.height=WH*MM;
wm.left=(cx-WW/2)*MM; wm.top=-(Y0+11)*MM;

// descriptor pill
var pwd=32, pht=6.6;
var pl=L_ART.pathItems.roundedRectangle(-(Y0+11+WH+5)*MM,(cx-pwd/2)*MM,pwd*MM,pht*MM,(pht/2)*MM,(pht/2)*MM);
pl.filled=true;pl.fillColor=cmyk(FOREST[0],FOREST[1],FOREST[2],FOREST[3]);pl.stroked=false;
tx(L_TYPE,cx,Y0+11+WH+6.8,"BILONA-CHURNED",3.8,SANSB,CREAM,180,"c");

var ny=Y0+11+WH+16;
tx(L_TYPE,cx,ny,"A2 DESI",13,SERIF,FORESTD,-6,"c");
tx(L_TYPE,cx,ny+8,"COW GHEE",13,SERIF,FORESTD,-6,"c");
ln(L_ART,cx-22,ny+18,cx+22,ny+18,GOLD,0.3);
para(L_TYPE,cx-30,ny+20,60,9,"Made from curd, not cream.\nSlow-churned in the traditional way.",3.2,SANS,FOREST,4.1,"c");
ln(L_ART,cx-22,ny+30,cx+22,ny+30,GOLD,0.3);
tx(L_TYPE,cx,ny+34,"100% PURE",4.6,SANSB,GOLD,200,"c");

// net quantity, bottom-right of the display panel
ln(L_ART,Z[2]-34,Y0+H-14,Z[2]-8,Y0+H-14,INK,0.2);
tx(L_TYPE,Z[2]-8,Y0+H-12.6,"NET CONTENT",2.7,SANSM,INK,110,"r");
tx(L_TYPE,Z[2]-8,Y0+H-8,"500 ml",6.0,SANSB,FORESTD,0,"r");

// ══════════════ RIGHT — nutrition, reversed out of forest ══════════════
var nx0=Z[2], nw=Z[3]-Z[2];
rect(L_BG,nx0,Y0,nw,H,FOREST);
var tX=nx0+6, tW=nw-12, ty=Y0+11;
tx(L_TYPE,tX,ty,"NUTRITION FACTS",7.0,SANSB,CREAM,10); ty+=5.0;
tx(L_TYPE,tX,ty,"<<n>> Servings per container",3.0,SANS,GOLD_L,0); ty+=3.6;
ln(L_ART,tX,ty,tX+tW,ty,CREAM,0.3,70); ty+=1.4;
tx(L_TYPE,tX,ty,"Serving size",3.2,SANS,CREAM,0);
tx(L_TYPE,tX+tW,ty,"1 Tbsp (14 g)",3.2,SANS,CREAM,0,"r"); ty+=3.8;
ln(L_ART,tX,ty,tX+tW,ty,CREAM,0.18,55); ty+=1.4;
tx(L_TYPE,tX,ty,"Amount Per Serving",2.9,SANS,GOLD_L,0);
tx(L_TYPE,tX+tW,ty,"% RDA/Serve*",2.9,SANS,GOLD_L,0,"r"); ty+=3.4;
var NR=[["CALORIES (<<kcal>>)","<<%>>",1,0],["Total Fat (<<g>>)","<<%>>",1,0],
        ["Saturated Fat (<<g>>)","<<%>>",0,1],["Trans Fat (<<g>>)","",0,1],
        ["MUFA (<<g>>)","",0,1],["PUFA (<<g>>)","",0,1],
        ["Cholesterol (<<mg>>)","<<%>>",1,0],["Sodium (<<mg>>)","<<%>>",1,0],
        ["Total Carbohydrates (<<g>>)","<<%>>",1,0],["Dietary Fibre (<<g>>)","<<%>>",0,1],
        ["Total Sugar (<<g>>)","",0,1],["Includes <<g>> Added Sugars","<<%>>",0,2],
        ["Protein (<<g>>)","<<%>>",1,0]];
for(var r=0;r<NR.length;r++){
  tx(L_TYPE,tX+NR[r][3]*2.2,ty,NR[r][0],3.0,NR[r][2]?SANSB:SANS,CREAM,0);
  if(NR[r][1]) tx(L_TYPE,tX+tW,ty,NR[r][1],3.0,SANSB,MAG,0,"r");
  ty+=3.05;
  ln(L_ART,tX,ty-0.75,tX+tW,ty-0.75,CREAM,0.08,35);
}
para(L_TYPE,tX,ty+0.6,tW,9,"* The % RDA tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.  VALUES PROVISIONAL - LAB COA REQUIRED.",2.2,SANS,MAG,2.7);
if(ty+8>Y0+H-SAFE) log("WARNING: nutrition column overflows at "+(ty+8).toFixed(1));

// ── variable data + barcode, on the left panel foot ──────────────────────
var vx=Z[1]-32, vy=Y0+H-40;
rect(L_VAR,vx,vy,28,14,WHITE);
var vlab=["MRP ₹","Batch No.","Mfg. Date","Use by"];
for(var v=0;v<vlab.length;v++){
  tx(L_TYPE,vx+1.6,vy+2.4+v*2.7,vlab[v],2.4,SANS,K100,0);
  ln(L_VAR,vx+11,vy+2.6+v*2.7,vx+26.4,vy+2.6+v*2.7,K100,0.1,35);
}
tx(L_TYPE,vx,vy+16.2,"<<OVERPRINTED AT PACKING>>",1.9,SANSB,MAG,0);

var bcx=Z[1]-32, bcy=Y0+H-19, bcw=24, bch=6;
rect(L_VAR,bcx-1,bcy-1,bcw+2,bch+4,WHITE);
var sd=11;
for(var b=0;b<50;b++){sd=(sd*1103515245+12345)%2147483648;
  var wd=0.2+((sd>>16)%3)*0.12;
  var br=L_VAR.pathItems.rectangle(-bcy*MM,(bcx+b*(bcw/50))*MM,wd*MM,bch*MM);
  br.filled=true;br.fillColor=cmyk(0,0,0,100);br.stroked=false;}
tx(L_TYPE,bcx,bcy+bch+2.2,"8 901234 567890  <<GS1>>",2.1,SANS,K100,10);

// ── guides ───────────────────────────────────────────────────────────────
ln(L_DIE,Z[1],Y0,Z[1],Y0+H,MAG,0.12);
ln(L_DIE,Z[2],Y0,Z[2],Y0+H,MAG,0.12);
box(L_DIE,X0,Y0,W,H,MAG,0.25);
box(L_BLD,X0+SAFE,Y0+SAFE,W-SAFE*2,H-SAFE*2,[70,0,0,0],0.2);
tx(L_DIE,X0+2,Y0+H+2.4,"DIMENSIONS_UNCONFIRMED - 250x95mm assumed for a 500ml ghee jar. Get the vendor dieline before print.",3.0,SANSB,MAG,0);
L_DIE.printable=false;L_BLD.printable=false;L_DIE.locked=true;L_BLD.locked=true;

var so=new IllustratorSaveOptions();so.compatibility=Compatibility.ILLUSTRATOR17;
doc.saveAs(new File(DIR+"40_skus/NG-GHEE-A2COW-500ML_FLAT_v02.ai"),so);
var eo=new ExportOptionsPNG24();
eo.antiAliasing=true;eo.transparency=false;eo.horizontalScale=300;eo.verticalScale=300;
doc.exportFile(new File(DIR+"50_exports/print/NG-GHEE-A2COW-500ML_FLAT_v02.png"),ExportType.PNG24,eo);
log("OK ghee strip "+W+"x"+H+"mm, "+doc.layers.length+" layers");
doc.close(SaveOptions.DONOTSAVECHANGES);
