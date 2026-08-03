/**
 * 40-label-v2.jsx — NG-OIL-GN-1L-GLASS, rebuilt to the architecture the client
 * pointed at.
 *
 * Supersedes 30. The structural differences, which are what actually changed:
 *
 *   · A LARGE ROUNDED COLOUR PANEL dominates the front, rather than a thin gold
 *     frame on cream. One product accent per variety, so the range reads as a
 *     family on shelf.
 *   · The descriptor sits in a PILL OUTLINE, not as loose letterspaced caps.
 *   · The hero is PHOTOGRAPHIC in feel — actual groundnut pods in natural
 *     colour — not a line engraving.
 *   · A SOURCING LINE ("BY THE FARMERS OF …") between rules.
 *   · Background motifs are LARGE and SOFT, tone on tone, rather than dozens of
 *     small repeated stalks.
 *   · The back panel is TWO COLUMNS: nutrition box left, statutory text right.
 *     Far denser and better organised than the single column it replaces.
 *
 * Ground and palette remain the client's own; only the structure is taken from
 * the reference. No competitor mark, asset or copy is reproduced.
 *
 * DIMENSIONS_UNCONFIRMED — 280x120 with 4x70 panels is the brief's example.
 */
#target illustrator

var MM = 2.834645669;
var DIR = "/Users/gowthamreddy/nutrigreenz project/nutrigreenz-packaging/";
function log(s){var f=new File("/tmp/ng-ai-test/v2-result.txt");f.open("w");f.write(s);f.close();}

function findFont(re){for(var i=0;i<app.textFonts.length;i++) if(re.test(app.textFonts[i].name)) return app.textFonts[i].name; return null;}
var SERIF=findFont(/^RobotoSlab-Bold$/i), SERIFR=findFont(/^RobotoSlab-Regular$/i)||findFont(/^RobotoSlab-Bold$/i),
    SERIFL=findFont(/^RobotoSlab-Light$/i)||SERIFR,
    SANS=findFont(/^HankenGrotesk-Regular$/i), SANSB=findFont(/^HankenGrotesk-Bold$/i)||findFont(/^HankenGrotesk-Regular$/i),
    SANSM=findFont(/^HankenGrotesk-Medium$/i)||SANS, SANSSB=findFont(/^HankenGrotesk-SemiBold$/i)||SANSB;
if(!SERIF||!SANS){log("BLOCKED: fonts missing");throw new Error("fonts");}

var PANEL=70,PANELS=4,W=PANEL*PANELS,H=120,BLEED=3,SAFE=4;
var PW=W+BLEED*2,PH=H+BLEED*2,X0=BLEED,Y0=BLEED;
var P=[X0,X0+PANEL,X0+PANEL*2,X0+PANEL*3];

function cmyk(c,m,y,k){var o=new CMYKColor();o.cyan=c;o.magenta=m;o.yellow=y;o.black=k;return o;}
// Warm neutral ground + the groundnut accent. One accent per variety.
var CREAM=[5,8,18,0], CREAM_D=[8,13,26,0], TERRA=[22,68,82,12], TERRA_D=[28,74,86,26];
var FOREST=[85,45,78,45], FORESTD=[88,55,84,72], INK=[70,55,60,55];
var GOLD=[25,45,95,10], WHITE=[0,0,0,0], VEG=[80,0,100,0], K100=[0,0,0,100], MAG=[0,100,0,0];

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
function pill(L,x,y,w,h,col,sw){var r=L.pathItems.roundedRectangle(-y*MM,x*MM,w*MM,h*MM,(h/2)*MM,(h/2)*MM);
  r.filled=false;r.stroked=true;r.strokeColor=cmyk(col[0],col[1],col[2],col[3]);r.strokeWidth=(sw||0.3)*MM;return r;}
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
rect(L_BG,P[1],Y0,PANEL,H,CREAM_D);
rect(L_BG,P[3],Y0,PANEL,H,CREAM_D);

/* Large, soft, tone-on-tone motifs. The previous version used 46 small stalks
   which read as a busy pattern; the reference uses a few oversized shapes at
   very low contrast so they sit behind the type instead of competing. */
function bigLeaf(L,cx,cy,sc,rot,op){
  function C(pts,w,cl){
    var m=[];
    for(var i=0;i<pts.length;i++){
      var x=pts[i][0]*sc,y=pts[i][1]*sc;
      var rx=x*Math.cos(rot)-y*Math.sin(rot), ry=x*Math.sin(rot)+y*Math.cos(rot);
      m.push([(cx+rx)*MM,-(cy+ry)*MM]);
    }
    return curve(L,m,GOLD,w,op,cl);
  }
  C([[0,-9],[5.4,-3.6],[6.3,2.7],[0,9],[-6.3,2.7],[-5.4,-3.6]],0.5,true);
  C([[0,-8],[0,8]],0.32);
  for(var i=-3;i<=3;i++){ if(!i)continue;
    C([[0,i*1.9],[4.6*(i>0?1:1),i*1.9+3.0]],0.24);
    C([[0,i*1.9],[-4.6,i*1.9+3.0]],0.24);
  }
}
function bigGhani(L,cx,cy,sc,op){
  function C(pts,w,cl){var m=[];for(var i=0;i<pts.length;i++)m.push([(cx+pts[i][0]*sc)*MM,-(cy+pts[i][1]*sc)*MM]);
    return curve(L,m,GOLD,w,op,cl);}
  C([[-6,3],[-4.6,9],[4.6,9],[6,3]],0.55,true);
  C([[-7,3],[7,3]],0.5);
  C([[-0.7,2.6],[-0.7,-8]],0.55);
  C([[-0.7,-8],[5.6,-5.6]],0.5);
  C([[5.6,-5.6],[5.6,-2.2]],0.4);
  C([[-4.6,-3],[-1,-4.4]],0.35);
}
bigLeaf(L_TEX,P[0]+14,Y0+96,1.5,-0.35,10);
bigLeaf(L_TEX,P[0]+57,Y0+104,1.2,0.5,9);
bigGhani(L_TEX,P[1]+14,Y0+100,1.3,8);
bigLeaf(L_TEX,P[1]+56,Y0+96,1.4,0.2,8);
bigLeaf(L_TEX,P[2]+13,Y0+104,1.3,-0.2,8);
bigGhani(L_TEX,P[2]+57,Y0+98,1.2,7);
bigLeaf(L_TEX,P[3]+20,Y0+60,2.0,0.3,7);
bigLeaf(L_TEX,P[3]+52,Y0+96,1.5,-0.4,7);

// ══════════════ PANEL 1 — FRONT ══════════════
var c1=P[0]+PANEL/2;

// logo on the cream band
var logo=L_ART.placedItems.add();
/* WORDMARK ONLY, per client instruction — no N monogram anywhere. */
logo.file=new File(DIR+"20_assets/icons/NG_wordmark.png");
var LW=46,LH=LW*(220/1282);
logo.width=LW*MM;logo.height=LH*MM;
logo.left=(c1-LW/2)*MM;logo.top=-(Y0+7)*MM;

/* The dominant element: one large rounded colour panel. */
var PX=P[0]+6, PY=Y0+21, PWd=PANEL-12, PHt=82;
rrect(L_BG,PX,PY,PWd,PHt,5,TERRA);
rrect(L_BG,PX,PY+PHt-26,PWd,26,5,TERRA_D,55);   // subtle foot shading

// descriptor in a pill outline
var pw=34, ph=7.4;
pill(L_ART,c1-pw/2,PY+6,pw,ph,CREAM,0.35);
tx(L_TYPE,c1,PY+8.2,"WOOD-PRESSED",4.6,SANSB,CREAM,180,"c");

tx(L_TYPE,c1,PY+17,"GROUNDNUT",14,SERIF,CREAM,-10,"c");
tx(L_TYPE,c1,PY+24.5,"OIL",14,SERIF,CREAM,-10,"c");

// sourcing line between rules
ln(L_ART,PX+9,PY+34.5,PX+PWd-9,PY+34.5,CREAM,0.2,55);
para(L_TYPE,PX+6,PY+36,PWd-12,9,"BY THE FARMERS OF\nANANTAPUR, ANDHRA PRADESH",3.4,SANSB,CREAM,4.4,"c");
ln(L_ART,PX+9,PY+45.5,PX+PWd-9,PY+45.5,CREAM,0.2,55);

// photographic hero, inside the panel
var hero=L_ART.placedItems.add();
hero.file=new File(DIR+"20_assets/illustrations/NG_HERO_groundnut_pods_soft.png");
var HW=54,HH=HW*(1150/1900);
hero.width=HW*MM;hero.height=HH*MM;
hero.left=(c1-HW/2)*MM;hero.top=-(PY+46)*MM;

// veg mark + net quantity, below the panel
var vgy=Y0+PHt+24;
box(L_COMP,P[0]+9,vgy,5.2,5.2,VEG,0.55);
var vd=L_COMP.pathItems.ellipse(-(vgy+1.35)*MM,(P[0]+10.35)*MM,2.5*MM,2.5*MM);
vd.filled=true;vd.fillColor=cmyk(VEG[0],VEG[1],VEG[2],VEG[3]);vd.stroked=false;
ln(L_ART,P[0]+PANEL-30,vgy,P[0]+PANEL-9,vgy,INK,0.2);
tx(L_TYPE,P[0]+PANEL-9,vgy+1.2,"NET QUANTITY",2.9,SANSM,INK,110,"r");
tx(L_TYPE,P[0]+PANEL-9,vgy+5,"1 L",6.4,SANSB,FORESTD,0,"r");
tx(L_TYPE,P[0]+PANEL-9,vgy+8.6,"<<net weight g - to be weighed>>",2.0,SANSB,MAG,0,"r");

// ══════════════ PANEL 2 — BACK, two columns ══════════════
var bx=P[1]+7, bw=PANEL-14;
tx(L_TYPE,bx,Y0+11,"GROUNDNUT OIL",8.4,SERIF,FORESTD,-5);
para(L_TYPE,bx,Y0+15,bw,8,"Sensory Notes: Our Groundnut Oil is sweet and nutty.",3.2,SANSM,FOREST,4.0);

var COLW=(bw-4)/2, LCOL=bx, RCOL=bx+COLW+4, CTOP=Y0+24;

// LEFT — nutrition, in a light box like the reference
rrect(L_BG,LCOL,CTOP,COLW,62,1.5,WHITE,88);
box(L_ART,LCOL,CTOP,COLW,62,INK,0.2,1.5);
var ny=CTOP+4;
tx(L_TYPE,LCOL+2,ny,"NUTRITION FACTS",4.4,SANSB,FORESTD,10); ny+=3.4;
tx(L_TYPE,LCOL+2,ny,"<<n>> servings per container",2.4,SANS,INK,0); ny+=2.8;
ln(L_ART,LCOL+2,ny,LCOL+COLW-2,ny,INK,0.3); ny+=1.2;
tx(L_TYPE,LCOL+2,ny,"Serving Size",2.5,SANS,INK,0);
tx(L_TYPE,LCOL+COLW-2,ny,"1 Tbsp (15 g)",2.5,SANS,INK,0,"r"); ny+=3.0;
ln(L_ART,LCOL+2,ny,LCOL+COLW-2,ny,INK,0.16); ny+=1.2;
tx(L_TYPE,LCOL+2,ny,"Amount Per Serving",2.4,SANS,INK,0);
tx(L_TYPE,LCOL+COLW-2,ny,"% RDA*",2.4,SANS,INK,0,"r"); ny+=2.8;
var NR=[["CALORIES (<<kcal>>)","<<%>>",1,0],["Total Fat (<<g>>)","<<%>>",1,0],
        ["Saturated Fat (<<g>>)","<<%>>",0,1],["Trans Fat (<<g>>)","",0,1],
        ["MUFA (<<g>>)","",0,1],["PUFA (<<g>>)","",0,1],
        ["Cholesterol (<<mg>>)","<<%>>",1,0],["Sodium (<<mg>>)","<<%>>",1,0],
        ["Total Carbohydrate (<<g>>)","<<%>>",1,0],["Dietary Fibre (<<g>>)","<<%>>",0,1],
        ["Total Sugars (<<g>>)","",0,1],["Includes <<g>> Added Sugars","<<%>>",0,2],
        ["Protein (<<g>>)","<<%>>",1,0],["Vitamin E (<<mg>>)","<<%>>",1,0]];
for(var r=0;r<NR.length;r++){
  tx(L_TYPE,LCOL+2+NR[r][3]*1.8,ny,NR[r][0],2.4,NR[r][2]?SANSB:SANS,NR[r][2]?FORESTD:INK,0);
  if(NR[r][1]) tx(L_TYPE,LCOL+COLW-2,ny,NR[r][1],2.4,SANSB,MAG,0,"r");
  ny+=2.15;
  ln(L_ART,LCOL+2,ny-0.55,LCOL+COLW-2,ny-0.55,INK,0.07,40);
}
para(L_TYPE,LCOL+2,ny+0.3,COLW-4,7,"* The % RDA tells you how much a nutrient in a serving contributes to a daily diet. 2,000 kcal a day is used for general nutrition advice. VALUES PROVISIONAL - LAB COA REQUIRED.",1.9,SANS,MAG,2.3);

// RIGHT — statutory text
var ry2=CTOP+1;
function blk(head,body,gap){
  tx(L_TYPE,RCOL,ry2,head,2.8,SANSB,FORESTD,20); ry2+=2.9;
  var lines=body.split("\n").length;
  para(L_TYPE,RCOL,ry2,COLW,lines*3.4+2,body,2.5,SANS,INK,3.0);
  ry2+=lines*2.85+(gap===undefined?1.9:gap);
}
blk("INGREDIENTS","Arachis hypogaea\n(Groundnut) seed oil");
blk("STORAGE INFORMATION","Store in a dry place away\nfrom direct heat and light,\nwith the lid tightly closed.");
blk("ALLERGY ADVICE","Contains peanut. Pressed on\nequipment shared with sesame,\nmustard and coconut.");
blk("NET QUANTITY","1 L (<<g>> net weight)");
tx(L_TYPE,RCOL,ry2,"fssai",4.4,SERIFL,FORESTD,30);
box(L_COMP,RCOL+8,ry2-1.6,13,5,MAG,0.2);
tx(L_TYPE,RCOL+8.6,ry2+1.6,"<<FSSAI MARK>>",1.7,SANSB,MAG,0); ry2+=5.4;
tx(L_TYPE,RCOL,ry2,"<<14-DIGIT LICENCE>>",2.6,SANSB,MAG,0); ry2+=4.4;
blk("MFD. & MKT. BY","Nutri Greenz Farm\nTechnologies Pvt. Ltd.\n1st Floor, H.No. 5-35/167,\nDouble Road, Moosapet,\nKukatpally, Hyderabad,\nTelangana 500072");
blk("BEST BEFORE","<<n>> MONTHS FROM THE\nDATE OF MANUFACTURE");
tx(L_TYPE,RCOL,ry2,"COUNTRY OF ORIGIN: INDIA",2.6,SANSB,FORESTD,10);

// variable-data block + barcode, bottom left
var vy=CTOP+64;
tx(L_TYPE,LCOL,vy,"MRP ₹",3.0,SANSB,FORESTD,0);
tx(L_TYPE,LCOL,vy+2.8,"(incl. of all taxes)",2.0,SANS,INK,0);
var vrows=["USP:","BATCH NO:","DATE OF MFG:","USE BY:"];
for(var v=0;v<vrows.length;v++){
  tx(L_TYPE,LCOL,vy+6.4+v*3.0,vrows[v],2.5,SANSB,FORESTD,0);
  ln(L_VAR,LCOL+13,vy+6.7+v*3.0,LCOL+COLW,vy+6.7+v*3.0,INK,0.12,45);
}
ln(L_VAR,LCOL+9,vy+0.4,LCOL+COLW,vy+0.4,INK,0.12,45);
tx(L_TYPE,LCOL,vy+18.6,"<<OVERPRINTED AT PACKING>>",1.9,SANSB,MAG,0);

var bcx=LCOL, bcy=vy+21, bcw=26, bch=6.5;
rect(L_VAR,bcx-1,bcy-1,bcw+2,bch+4.4,WHITE);
var sd=7;
for(var b=0;b<52;b++){sd=(sd*1103515245+12345)%2147483648;
  var wd=0.22+((sd>>16)%3)*0.13;
  var br=L_VAR.pathItems.rectangle(-bcy*MM,(bcx+b*(bcw/52))*MM,wd*MM,bch*MM);
  br.filled=true;br.fillColor=cmyk(0,0,0,100);br.stroked=false;}
tx(L_TYPE,bcx,bcy+bch+2.4,"8 906136 780897",2.3,SANS,K100,15);

// ══════════════ PANEL 3 — STORY ══════════════
var c3=P[2]+PANEL/2;
var logo3=L_ART.placedItems.add();
logo3.file=new File(DIR+"20_assets/icons/NG_wordmark.png");
var M3=42,M3H=M3*(220/1282);
logo3.width=M3*MM;logo3.height=M3H*MM;
logo3.left=(c3-M3/2)*MM;logo3.top=-(Y0+10)*MM;

tx(L_TYPE,c3,Y0+26,"OUR STORY",4.4,SANSB,GOLD,260,"c");
ln(L_ART,c3-12,Y0+30,c3+12,Y0+30,GOLD,0.3);

var sty=Y0+36;
tx(L_TYPE,P[2]+8,sty,"“",20,SERIF,GOLD,0);
para(L_TYPE,P[2]+11,sty+3,PANEL-22,10,"Traditionally Wood-Pressed.\nTruly Farm Fresh.",5.6,SERIFL,GOLD,7.0,"c");
para(L_TYPE,P[2]+9,sty+15,PANEL-18,26,"Purely pressed, never processed. We draw our groundnut oil on a wooden ghani turning slow and cold, so every drop keeps its aroma, its natural antioxidants and the quiet nuttiness that refining strips away.",3.2,SANS,FOREST,4.2,"c");
tx(L_TYPE,P[2]+PANEL-13,sty+34,"”",20,SERIF,GOLD,0);

ln(L_ART,c3-18,Y0+82,c3+18,Y0+82,GOLD,0.25);
tx(L_TYPE,c3,Y0+86,"SCAN TO TRACE THIS BOTTLE",2.9,SANSB,FOREST,120,"c");
var qx=c3-6, qy=Y0+90;
rect(L_VAR,qx,qy,12,12,WHITE);
var qs=19;
for(var a=0;a<12;a++)for(var b2=0;b2<12;b2++){qs=(qs*1103515245+12345)%2147483648;
  if((qs>>18)%2===0)continue;
  var qm=L_VAR.pathItems.rectangle(-(qy+a)*MM,(qx+b2)*MM,1*MM,1*MM);
  qm.filled=true;qm.fillColor=cmyk(0,0,0,100);qm.stroked=false;}
tx(L_TYPE,c3,Y0+108,"For feedback: +91 8074553370",2.6,SANS,INK,0,"c");
tx(L_TYPE,c3,Y0+112,"nutrigreenzfarm@gmail.com",2.6,SANS,INK,0,"c");
tx(L_TYPE,c3,Y0+116,"WWW.NUTRIGREENZ.FARM",2.8,SANSB,GOLD,110,"c");

// ══════════════ PANEL 4 — FLAP ══════════════
tx(L_TYPE,P[3]+PANEL/2,Y0+H/2,"GLUE FLAP  -  NO CRITICAL PRINT",3.2,SANSB,MAG,150,"c");
tx(L_TYPE,P[3]+PANEL/2,Y0+H/2+5,"<<width set by vendor overlap, 3-5mm typical>>",2.6,SANS,MAG,0,"c");

// ── guides ───────────────────────────────────────────────────────────────
for(var f=1;f<PANELS;f++) ln(L_DIE,P[f],Y0,P[f],Y0+H,MAG,0.12);
box(L_DIE,X0,Y0,W,H,MAG,0.25);
box(L_BLD,X0+SAFE,Y0+SAFE,W-SAFE*2,H-SAFE*2,[70,0,0,0],0.2);
tx(L_DIE,X0+2,Y0+H+2.4,"DIMENSIONS_UNCONFIRMED - 280x120mm is the brief's example, not a vendor dieline. Do not print.",3.2,SANSB,MAG,0);
L_DIE.printable=false;L_BLD.printable=false;L_DIE.locked=true;L_BLD.locked=true;

var so=new IllustratorSaveOptions();so.compatibility=Compatibility.ILLUSTRATOR17;
doc.saveAs(new File(DIR+"40_skus/NG-OIL-GN-1L-GLASS_FLAT_v13.ai"),so);
var eo=new ExportOptionsPNG24();
eo.antiAliasing=true;eo.transparency=false;eo.horizontalScale=300;eo.verticalScale=300;
doc.exportFile(new File(DIR+"50_exports/print/NG-OIL-GN-1L-GLASS_FLAT_v13.png"),ExportType.PNG24,eo);
log("OK v13 - panel architecture, "+doc.layers.length+" layers");
doc.close(SaveOptions.DONOTSAVECHANGES);
