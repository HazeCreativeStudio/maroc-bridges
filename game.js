import * as THREE from 'three';
import {RoundedBoxGeometry} from './lib/RoundedBoxGeometry.js';
import {RoomEnvironment} from './lib/RoomEnvironment.js';

/* =====================================================================
   MAROC BRIDGES: the game
   intro (3D diorama) → world map (3D board) → location (street map)
   ===================================================================== */

const $ = s => document.querySelector(s);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;
const E = {
  inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  out:t=>1-Math.pow(1-t,3),
  in:t=>t*t*t,
  sine:t=>-(Math.cos(Math.PI*t)-1)/2,
  back:t=>{const c1=1.9,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);},
  elastic:t=>t<=0?0:t>=1?1:Math.pow(2,-10*t)*Math.sin((t*10-.75)*(2*Math.PI)/3)+1,
  lin:t=>t
};
const wait = ms => new Promise(r=>setTimeout(r,ms));
const IMG = k => `img/${k}.jpg`;

/* ---------------- trip data ---------------- */
const STAYS = [
  { id:"marrakech", place:"Marrakech", stay:"Riad Imilchil", nights:"Nacht 1–2", n:2, lat:31.622708, lng:-7.980829,
    photos:["s_marrakech","s_marrakech_2","s_marrakech_3"],
    blurb:"Een kleine riad in het rustigere zuidelijke deel van de medina, een paar steegjes van het Bahia-paleis. De kamers combineren Marokkaans vakwerk met strakke, moderne lijnen. Er is een klein binnenzwembad en het ontbijt wordt op het dakterras geserveerd. Het Jemaa el-Fnaa-plein ligt op zo'n 15 minuten lopen.",
    when:"Ontbijt op het dakterras, 7:00–10:00.",
    tip:"Vraag de gastheren of ze je de eerste avond terugbrengen. In het donker lijken alle steegjes rond Jnane Ben Chegra op elkaar." },
  { id:"aitbenhaddou", place:"Aït Benhaddou", stay:"Dar Mouna", nights:"Nacht 3", n:1, z:15, lat:31.062310, lng:-7.126352,
    photos:["s_ait"],
    blurb:"Een familiehuis uit de jaren veertig, gebouwd door de vader van de huidige eigenaar, op 200 meter van de poort van de ksar, aan de overkant van de rivier. Elke kamer kijkt uit op de ksar of het zwembad. Het zwembad wordt gevoed door bronwater, er is een hammam op houtvuur en de groenten komen uit de eigen tuin.",
    when:"Zonsondergang vanaf het terras, met de ksar recht voor je.",
    tip:"Boek de kookles voor de middag van aankomst en drink daarna thee op het terras terwijl de ksar oplicht." },
  { id:"dades", place:"Boumalne Dadès", stay:"Sahara Stars Dades", nights:"Nacht 4–5", n:2, z:15.6, lat:31.362036, lng:-5.911116,
    photos:["s_dades"],
    blurb:"Een hotel in riadstijl in de wijk Jida, aan de rand van Boumalne, op zo'n 13 minuten lopen van het begin van de Dadès-kloof. Buitenzwembad, tuin, terras, een bar-lounge en twee restaurants.",
    when:"Vroeg ontbijt op je kloofdag.",
    tip:"Vraag op dag 5 om ontbijt om 7:30 en vertrek om 8:30: dan is de weg door de kloof rustig en valt er zacht licht op de rotswanden." },
  { id:"ergchebbi", place:"Erg Chebbi", stay:"Madu Luxury Camp", nights:"Nacht 6", n:1, z:13.5, lat:31.190968, lng:-3.943228,
    photos:["s_erg"],
    blurb:"Het woestijnkamp van Riad Madu bij Hassilabied. Acht Berbertenten tussen de duinen, elk met een king-, queen- of twinbed en een eigen terrasje, ongeveer een uur per kameel vanaf de riad.",
    when:"Inchecken 14:00–16:30, zodat je bij zonsondergang in het zand zit.",
    tip:"Laat de grote tassen achter bij Riad Madu en neem een zachte overnachtingstas mee. Van november tot maart zijn de nachten koud: vraag om extra dekens." },
  { id:"ouarzazate", place:"Ouarzazate", stay:"La Terrasse des Délices", nights:"Nacht 7", n:1, z:15.4, lat:30.918317, lng:-6.963771,
    photos:["s_ouarz"], credit:"Foto ter illustratie: de oase van Fint · Fraguando, CC BY-SA 4.0",
    blurb:"Een auberge in Douar Taharbilte in de oase van Fint, 12 km buiten Ouarzazate. Kleine terrassen en salons, een zwembad en een panoramaterras boven de palmen. De keuken kookt traditionele gerechten uit Zuid-Marokko.",
    when:"Diner op het panoramaterras.",
    tip:"Kom aan voor het donker. De laatste kilometers naar Fint zijn smal: vraag de auberge om een routebeschrijving of om je in Ouarzazate op te halen." }
];
/* legs: key = destination; "home" = back to Marrakech */
const LEGS = {
  aitbenhaddou:{ title:"Over de Hoge Atlas", meta:"≈200 km · ±6 uur met stops, via Telouet",
    path:[[31.62,-7.9802],[31.6,-7.8],[31.563,-7.667],[31.5,-7.5],[31.42,-7.4],[31.33,-7.37],[31.287,-7.383],[31.3,-7.3],[31.28695,-7.23675],[31.215,-7.205],[31.16,-7.17],[31.085,-7.146],[31.0437,-7.1295]]},
  dades:{ title:"Vallei van de duizend kasbahs", meta:"≈150 km · ±3 uur, via Skoura en Kelaat M'Gouna",
    path:[[31.0437,-7.1295],[31,-7.05],[30.92,-6.91],[30.97,-6.75],[31.0535,-6.559],[31.15,-6.35],[31.242,-6.128],[31.31,-6.05],[31.3922,-5.9925]]},
  ergchebbi:{ title:"De Sahara in", meta:"≈260 km · ±5 uur, via de Todra-kloof",
    path:[[31.3922,-5.9925],[31.4,-5.8],[31.48,-5.6],[31.515,-5.53],[31.5,-5.03],[31.49,-4.4],[31.43,-4.23],[31.282,-4.264],[31.2,-4.08],[31.146,-4.028],[31.125,-3.986]]},
  ouarzazate:{ title:"Terug langs de Draa", meta:"≈370 km · ±6 uur, via N'Kob en Agdz",
    path:[[31.125,-3.986],[31.146,-4.028],[31.282,-4.264],[31.2,-4.6],[31.115,-5.17],[30.78,-5.57],[30.87,-5.866],[30.62,-6.17],[30.698,-6.449],[30.8,-6.6],[30.88,-6.8],[30.86,-6.9],[30.8215,-6.948]]},
  home:{ title:"De weg naar huis", meta:"≈200 km · ±4 uur over de Tichka-pas",
    path:[[30.8215,-6.948],[30.87,-6.93],[30.93,-6.95],[31,-7.1],[31.1,-7.3],[31.17,-7.45],[31.287,-7.383],[31.4,-7.38],[31.5,-7.5],[31.563,-7.667],[31.62,-7.9802]]}
};
const legInto = i => LEGS[STAYS[i].id];
const NL = {lat:52.31, lng:4.76};

/* ---------------- projection (mercator degrees, centred on southern Morocco) ---------------- */
const merc = lat => Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI;
const M0 = merc(31.3);
const LAND_TOP = 0.2;
const P = (lat,lng,y=LAND_TOP) => new THREE.Vector3(lng+6, y, -(merc(lat)-M0));

/* ---------------- renderer ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
const DPR = Math.min(devicePixelRatio||1, 2);
renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const pmrem = new THREE.PMREMGenerator(renderer);
const ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
const camTgt = new THREE.Vector3();
function look(){ camera.lookAt(camTgt); }

/* ---------------- tiny tween engine ---------------- */
let tweens = [];
function tween(dur, fn, ez=E.inOut){ return new Promise(res=>tweens.push({t:0,dur,fn,ez,res})); }
function stepTweens(dt){
  tweens = tweens.filter(tw=>{ tw.t+=dt; const k=Math.min(1,tw.t/tw.dur); tw.fn(tw.ez(k),k); if(k>=1){tw.res();return false;} return true; });
}
function camTo(pos, tgt, dur, arc=0, ez=E.inOut){
  const p0=camera.position.clone(), t0=camTgt.clone();
  return tween(dur, k=>{ camera.position.lerpVectors(p0,pos,k); camera.position.y += Math.sin(k*Math.PI)*arc; camTgt.lerpVectors(t0,tgt,k); look(); }, ez);
}

/* ---------------- materials & mesh helpers ---------------- */
const MC = {};
function M(color, o={}){
  const k = color+JSON.stringify(o);
  if(!MC[k]){
    MC[k] = new THREE.MeshStandardMaterial({ color, roughness:o.r??0.62, metalness:o.m??0,
      emissive:o.e??0x000000, emissiveIntensity:o.ei??1, transparent:o.o!=null, opacity:o.o??1,
      side:o.ds?THREE.DoubleSide:THREE.FrontSide, vertexColors:!!o.vc, map:o.map||null, envMapIntensity:o.env??0.1 });
  }
  return MC[k];
}
function mesh(geo, mat, x=0, y=0, z=0, cast=true){
  const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=true; return m;
}
const RB = (w,h,d,r=0.06,s=3) => new RoundedBoxGeometry(w,h,d,s,Math.min(r,w/2-0.001,h/2-0.001,d/2-0.001));
const SPH = (r,ws=28,hs=20) => new THREE.SphereGeometry(r,ws,hs);
const CYL = (rt,rb,h,s=24) => new THREE.CylinderGeometry(rt,rb,h,s);
function lathe(prof, seg=28){ return new THREE.LatheGeometry(prof.map(([x,y])=>new THREE.Vector2(x,y)), seg); }
function ad(p,m){p.add(m);return m;}
function ell(rx,ry,rz,mat,x,y,z){ const m=mesh(SPH(1),mat,x,y,z); m.scale.set(rx,ry,rz); return m; }

function canvasTex(w,h,draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
const RUG_TEX = canvasTex(256,256,(g,w,h)=>{
  g.fillStyle='#b8322a'; g.fillRect(0,0,w,h);
  g.fillStyle='#f2c14e'; g.fillRect(0,0,w,18); g.fillRect(0,h-18,w,18);
  g.fillStyle='#1f6f8b'; g.fillRect(0,22,w,8); g.fillRect(0,h-30,w,8);
  for(let y=46;y<h-46;y+=40) for(let x=-20;x<w+20;x+=40){
    g.fillStyle=(Math.round((x+y)/40)%2)?'#f6e2b3':'#1f6f8b';
    g.beginPath(); g.moveTo(x+20,y); g.lineTo(x+38,y+20); g.lineTo(x+20,y+40); g.lineTo(x+2,y+20); g.closePath(); g.fill();
    g.fillStyle='#b8322a'; g.beginPath(); g.moveTo(x+20,y+10); g.lineTo(x+29,y+20); g.lineTo(x+20,y+30); g.lineTo(x+11,y+20); g.closePath(); g.fill();
  }
});
RUG_TEX.wrapS = RUG_TEX.wrapT = THREE.RepeatWrapping;
const STRIPE_TEX = canvasTex(64,256,(g,w,h)=>{ const cs=['#c0392b','#f2c14e','#1f6f8b','#f6e2b3','#2e8b57']; for(let i=0;i<16;i++){g.fillStyle=cs[i%cs.length]; g.fillRect(0,i*16,w,16);} });
const CLAP_TEX = canvasTex(256,64,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); g.fillStyle='#222'; for(let x=-64;x<w;x+=64){g.beginPath();g.moveTo(x,h);g.lineTo(x+32,h);g.lineTo(x+64,0);g.lineTo(x+32,0);g.closePath();g.fill();} });

/* ================================================================
   MODELS
   ================================================================ */
function buildVan(){
  const g = new THREE.Group();
  const white=M('#fbf2e3',{r:.32,env:.9}), stripe=M('#e8552c',{r:.4}), teal=M('#20a594',{r:.4});
  const glass=M('#21384f',{r:.1,m:.35,env:1.2}), tire=M('#2c2a2e',{r:.85}), hub=M('#d9dde2',{r:.25,m:.7}), chrome=M('#eef1f4',{r:.18,m:.85,env:1});
  const body = mesh(RB(2.5,1.22,1.12,.27,5),white,-0.08,0.97,0); g.add(body);
  g.add(mesh(RB(.66,.72,1.08,.25,5),white,1.2,.68,0));
  g.add(mesh(RB(2.53,.13,1.14,.05,2),stripe,-0.08,.74,0));
  g.add(mesh(RB(2.53,.07,1.14,.03,2),teal,-0.08,.63,0));
  g.add(mesh(RB(.05,.48,.94,.04,2),glass,1.18,1.2,0));
  for(const s of [-1,1]){ for(let i=0;i<4;i++) g.add(mesh(RB(.44,.36,.04,.07,2),glass,-0.96+i*.52,1.19,s*.565)); g.add(mesh(RB(.3,.36,.04,.07,2),glass,1.0,1.19,s*.565)); }
  g.add(mesh(RB(.04,.36,.82,.07,2),glass,-1.34,1.19,0));
  const wg=CYL(.31,.31,.25,28); wg.rotateX(Math.PI/2); const hg=CYL(.15,.15,.27,20); hg.rotateX(Math.PI/2);
  g.wheels=[];
  for(const [x,z] of [[.86,.47],[.86,-.47],[-.86,.47],[-.86,-.47]]){ const w=new THREE.Group(); w.position.set(x,.31,z); w.add(mesh(wg,tire)); w.add(mesh(hg,hub)); const sp=mesh(RB(.24,.05,.28,.02,1),M('#9aa3ad',{m:.6,r:.3}),0,0,0); w.add(sp); g.add(w); g.wheels.push(w); }
  for(const s of [-1,1]) g.add(mesh(SPH(.1,16,12),M('#fff6cf',{e:'#ffd76a',ei:.9,r:.2}),1.52,.8,s*.36));
  g.add(mesh(RB(.05,.2,.5,.03,2),M('#3a3940',{r:.5}),1.535,.6,0));
  g.add(mesh(RB(.18,.15,1.14,.07,2),chrome,1.52,.4,0));
  g.add(mesh(RB(.16,.15,1.14,.07,2),chrome,-1.34,.43,0));
  for(const s of [-1,1]) g.add(mesh(RB(.12,.1,.06,.03,2),M('#ff5a3c',{e:'#ff3b20',ei:.5}),-1.345,.86,s*.42));
  const bar=M('#6a4a34',{r:.6});
  for(const x of [-.95,-.1,.72]) g.add(mesh(RB(.07,.07,1.02,.03,1),bar,x,1.62,0));
  for(const s of [-1,1]) g.add(mesh(RB(1.8,.06,.06,.025,1),bar,-.1,1.66,s*.5));
  g.add(mesh(RB(.64,.38,.48,.08),M('#ee8a3a'),-.62,1.86,.2));
  g.add(mesh(RB(.52,.32,.42,.07),M('#2f80c4'),-.62,1.82,-.25));
  g.add(mesh(RB(.46,.28,.38,.07),M('#f4c84c'),.0,1.8,-.2));
  g.add(mesh(RB(.4,.2,.34,.06),M('#2bb39f'),.02,1.98,-.18));
  const rug=mesh(CYL(.16,.16,.98,24),M('#ffffff',{map:STRIPE_TEX}),.55,1.82,.06); rug.rotation.x=Math.PI/2; g.add(rug);
  g.add(mesh(RB(.06,.36,1.0,.02,1),M('#5b3a22'),.55,1.82,.06));
  return g;
}

function buildCamel(){
  const g = new THREE.Group();
  const fur=M('#dca865',{r:.8}), light=M('#f0c88c',{r:.8}), dark=M('#8a5a2e',{r:.8}), hoof=M('#5e3c22',{r:.7});
  const white=M('#ffffff',{r:.25}), black=M('#1b1410',{r:.2});
  g.add(ell(1.05,.62,.56,fur,0,1.55,0));
  g.add(ell(.5,.5,.42,fur,-.05,2.0,0));
  // saddle blanket
  const bl=mesh(RB(.95,.08,1.18,.04),M('#c0392b'),-.05,1.86,0); bl.rotation.z=.04; g.add(bl);
  g.add(mesh(RB(.98,.06,1.2,.03),M('#f2c14e'),-.05,1.8,0));
  for(let i=0;i<5;i++) for(const s of [-1,1]) g.add(mesh(SPH(.05,10,8),M(['#f2c14e','#1f6f8b','#2e8b57'][i%3]),-.4+i*.18,1.66,s*.6));
  // neck
  const neckCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.75,1.65,0),new THREE.Vector3(1.0,1.95,0),new THREE.Vector3(1.12,2.35,0),new THREE.Vector3(1.22,2.6,0)]);
  g.add(mesh(new THREE.TubeGeometry(neckCurve,24,.17,14),fur));
  const head=new THREE.Group(); head.position.set(1.3,2.66,0); g.add(head); g.head=head;
  head.add(ell(.36,.27,.27,fur,0,0,0));
  head.add(ell(.27,.2,.22,light,.3,-.06,0));
  for(const s of [-1,1]){
    head.add(ell(.035,.025,.03,dark,.53,-.03,s*.08));
    const eye=new THREE.Group(); eye.position.set(.12,.12,s*.17); head.add(eye);
    eye.add(mesh(SPH(.1,18,14),white,0,0,0));
    eye.add(mesh(SPH(.055,14,10),black,.05,0,s*.04));
    eye.add(mesh(SPH(.018,8,6),white,.09,.03,s*.06));
    const lid=ell(.112,.112,.112,fur,0,0,0); lid.scale.y=.02; lid.position.y=.07; eye.add(lid); (g.lids||(g.lids=[])).push(lid);
    const ear=mesh(SPH(.07,12,8),fur,-.18,.2,s*.18); ear.scale.set(.8,1.4,.6); head.add(ear);
  }
  ad(head,mesh(SPH(.14,14,10),dark,-.05,.24,0)).scale.set(1.2,.5,1); // tuft
  // legs
  for(const [x,z] of [[.6,.25],[.6,-.25],[-.6,.25],[-.6,-.25]]){
    g.add(mesh(new THREE.CapsuleGeometry(.11,.95,6,12),fur,x,.62,z));
    g.add(ell(.13,.1,.13,light,x,.6,z));
    g.add(ell(.15,.07,.14,hoof,x+.04,.06,z));
  }
  const tail=new THREE.Group(); tail.position.set(-1.0,1.65,0); g.add(tail); g.tail=tail;
  const t1=mesh(new THREE.CapsuleGeometry(.04,.4,4,8),fur,0,-.22,0); tail.add(t1);
  tail.add(ell(.07,.12,.07,dark,0,-.48,0));
  return g;
}

let LEAF_GEO=null;
function leafGeo(){
  if(LEAF_GEO) return LEAF_GEO;
  const L=1.4, s=new THREE.Shape(); s.moveTo(0,0);
  const n=9; for(let i=1;i<=n;i++){ const x=L*i/n, w=.2*Math.sin(Math.PI*i/n)+.02; s.lineTo(x-L/n*.5,w*1.15); s.lineTo(x,w*.75); }
  for(let i=n;i>=1;i--){ const x=L*i/n, w=.2*Math.sin(Math.PI*i/n)+.02; s.lineTo(x,-w*.75); s.lineTo(x-L/n*.5,-w*1.15); }
  const geo=new THREE.ShapeGeometry(s,2); const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i); p.setZ(i, -.55*Math.pow(x/L,2)*L - Math.abs(y)*.25); }
  geo.rotateX(-Math.PI/2); geo.computeVertexNormals(); LEAF_GEO=geo; return geo;
}
function buildPalm(h=3, lean=.35){
  const g=new THREE.Group(); const trunkA=M('#9b6a3e',{r:.9}), trunkB=M('#7d5230',{r:.9}), leaf=M('#3fa24e',{r:.65,ds:true}), leaf2=M('#5bbf5a',{r:.65,ds:true});
  const segs=8; let top=new THREE.Vector3();
  for(let i=0;i<segs;i++){ const t=i/segs, y=h*t, x=lean*Math.pow(t,2)*h*.4;
    const r=.16-.06*t; const m=mesh(CYL(r*.92,r,h/segs*1.02,12),i%2?trunkA:trunkB,x,y+h/segs/2,0); m.rotation.z=-lean*t*.5; g.add(m); top.set(x,y+h/segs,0); }
  const crown=new THREE.Group(); crown.position.copy(top); g.add(crown); g.crown=crown;
  const k=8; for(let i=0;i<k;i++){ const lf=mesh(leafGeo(),i%2?leaf:leaf2,0,0,0); lf.rotation.y=i/k*Math.PI*2+.2; lf.rotation.z=.15; lf.scale.setScalar(h/3*(0.9+.2*(i%3)/2)); crown.add(lf); }
  for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; crown.add(mesh(SPH(.07,10,8),M('#e0782a',{r:.5}),Math.cos(a)*.12,-.08,Math.sin(a)*.12)); }
  return g;
}
function buildLantern(glass='#ff9f43'){
  const g=new THREE.Group(); const brass=M('#c9973b',{m:.8,r:.32,env:1.1});
  g.add(mesh(CYL(.22,.26,.08,8),brass,0,.04,0));
  g.add(mesh(CYL(.24,.2,.5,8),M(glass,{e:glass,ei:1.4,r:.3,o:.92}),0,.33,0));
  for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; g.add(mesh(CYL(.015,.015,.52,4),brass,Math.cos(a)*.23,.33,Math.sin(a)*.23)); }
  g.add(mesh(CYL(.04,.27,.3,8),brass,0,.73,0));
  g.add(mesh(SPH(.06,10,8),brass,0,.92,0));
  const tor=new THREE.TorusGeometry(.08,.015,6,16); g.add(mesh(tor,brass,0,1.02,0));
  return g;
}
function buildTagine(c1='#c8643a', c2='#2a7f9e'){
  const g=new THREE.Group(); const clay=M(c1,{r:.6}), band=M(c2,{r:.5}), cream=M('#f6e2b3',{r:.55});
  g.add(mesh(lathe([[0,0],[.55,0],[.62,.05],[.62,.12],[.5,.14],[0,.14]]),clay));
  g.add(mesh(lathe([[.5,.13],[.46,.22],[.34,.42],[.2,.62],[.1,.8],[.05,.9],[0,.92]]),clay,0,0,0));
  ad(g,mesh(new THREE.TorusGeometry(.43,.03,8,32),band,0,.26,0)).rotation.x=Math.PI/2;
  ad(g,mesh(new THREE.TorusGeometry(.27,.025,8,32),cream,0,.5,0)).rotation.x=Math.PI/2;
  g.add(mesh(SPH(.08,12,10),cream,0,.96,0));
  return g;
}
function buildTeapot(){
  const g=new THREE.Group(); const s=M('#dfe4ea',{m:.95,r:.18,env:1.3});
  g.add(mesh(lathe([[0,0],[.22,0],[.3,.12],[.32,.26],[.26,.42],[.16,.5],[0,.5]]),s));
  g.add(mesh(lathe([[.17,.49],[.12,.6],[.06,.66],[0,.7]]),s));
  g.add(mesh(SPH(.05,10,8),s,0,.72,0));
  const sp=new THREE.CatmullRomCurve3([new THREE.Vector3(.25,.18,0),new THREE.Vector3(.42,.3,0),new THREE.Vector3(.5,.5,0),new THREE.Vector3(.6,.58,0)]);
  g.add(mesh(new THREE.TubeGeometry(sp,16,.035,8),s));
  const h=mesh(new THREE.TorusGeometry(.17,.03,8,20,Math.PI*1.2),s,-.3,.3,0); h.rotation.z=Math.PI*.4; g.add(h);
  return g;
}
function buildGlass(c){ const g=new THREE.Group(); g.add(mesh(CYL(.08,.065,.2,14),M(c,{o:.75,r:.15,e:c,ei:.15}),0,.1,0)); ad(g,mesh(new THREE.TorusGeometry(.08,.012,6,16),M('#e8b84a',{m:.8,r:.3}),0,.19,0)).rotation.x=Math.PI/2; return g; }
function buildBabouche(){ const g=new THREE.Group(); const y=M('#f4c430',{r:.55});
  g.add(ell(.34,.1,.15,y,0,.08,0)); g.add(ell(.2,.12,.13,y,.12,.13,0)); const tip=mesh(new THREE.ConeGeometry(.08,.2,12),y,.38,.1,0); tip.rotation.z=-Math.PI/2.3; g.add(tip);
  g.add(ell(.2,.06,.1,M('#7a3b16'),-.08,.16,0)); return g; }
function buildSpice(c){ const g=new THREE.Group(); g.add(mesh(lathe([[0,0],[.3,0],[.36,.12],[.36,.16],[0,.16]]),M('#2a7f9e',{r:.45}))); g.add(mesh(new THREE.ConeGeometry(.3,.5,24),M(c,{r:.95}),0,.4,0)); return g; }
function buildPouf(c='#d9883a'){ const g=new THREE.Group(); g.add(ell(.42,.24,.42,M(c,{r:.75}),0,.24,0)); ad(g,mesh(new THREE.TorusGeometry(.38,.025,6,32),M('#f6e2b3'),0,.3,0)).rotation.x=Math.PI/2; return g; }
function buildRug(w=1.6,d=1.1){ const t=RUG_TEX.clone(); t.needsUpdate=true; const m=mesh(RB(w,.04,d,.02,1),M('#ffffff',{map:t,r:.95}),0,.02,0); return m; }
function buildCloud(){ const g=new THREE.Group(); const w=M('#ffffff',{r:.9,env:.3}); [[0,0,0,1],[.9,-.1,.1,.75],[-.9,-.15,0,.7],[.4,.35,0,.7],[-.4,.3,.1,.65]].forEach(([x,y,z,r])=>g.add(ell(r,r*.82,r*.8,w,x,y,z))); g.children.forEach(c=>c.castShadow=false); return g; }

/* ----- landmarks for the map ----- */
function buildKoutoubia(){
  const g=new THREE.Group(); const c=M('#d99a6a'), d=M('#a85a36'), gold=M('#f2c14e',{m:.75,r:.3,env:1.2}), tealM=M('#2a9d8f');
  g.add(mesh(RB(.56,2.3,.56,.04),c,0,1.15,0));
  for(const s of [-1,1]) for(const y of [.75,1.35,1.85]){ g.add(mesh(RB(.24,.34,.05,.05,2),d,0,y,s*.28)); g.add(mesh(RB(.05,.34,.24,.05,2),d,s*.28,y,0)); }
  g.add(mesh(RB(.62,.12,.62,.03),tealM,0,2.12,0));
  for(const s of [-1,1]) for(const t of [-1,0,1]){ g.add(mesh(RB(.1,.14,.1,.02,1),c,t*.22,2.34,s*.24)); g.add(mesh(RB(.1,.14,.1,.02,1),c,s*.24,2.34,t*.22)); }
  g.add(mesh(RB(.26,.5,.26,.03),c,0,2.52,0));
  g.add(mesh(SPH(.15,16,10,0,Math.PI*2,0,Math.PI/2),tealM,0,2.77,0));
  g.add(mesh(CYL(.018,.018,.55,6),gold,0,3.0,0));
  [[2.98,.08],[3.12,.065],[3.24,.05]].forEach(([y,r])=>g.add(mesh(SPH(r,14,10),gold,0,y,0)));
  const p=buildPalm(1.7,.4); p.position.set(.75,0,.35); g.add(p); g.palms=[p];
  const p2=buildPalm(1.3,.3); p2.position.set(-.7,0,.4); p2.rotation.y=2.5; g.add(p2); g.palms.push(p2);
  return g;
}
function buildKsar(){
  const g=new THREE.Group(); const mud=M('#c9814f'), mud2=M('#b86c40'), dark=M('#4a2a18');
  g.add(mesh(lathe([[0,0],[1.25,0],[1.1,.2],[.8,.5],[.4,.72],[0,.78]]),M('#c6935f',{r:.9})));
  const towers=[[-.35,.5,.0,1.2],[.25,.45,.3,.95],[.4,.35,-.3,1.05],[-.1,.7,-.35,.8],[.0,.75,.15,1.45]];
  towers.forEach(([x,y,z,h],i)=>{ const w=.34; const t=mesh(RB(w,h,w,.03),i%2?mud:mud2,x,y+h/2,z); g.add(t);
    for(const s of [-1,1]) for(const q of [-1,1]) g.add(mesh(RB(.08,.12,.08,.02,1),i%2?mud:mud2,x+s*w*.38,y+h+.05,z+q*w*.38));
    g.add(mesh(RB(.07,.1,.02,.02,1),dark,x,y+h*.7,z+w/2+.005)); g.add(mesh(RB(.02,.1,.07,.02,1),dark,x+w/2+.005,y+h*.55,z)); });
  return g;
}
function buildDades(){
  const g=new THREE.Group(); const rock=M('#c65b3a',{r:.9}), rock2=M('#d9764a',{r:.9});
  g.add(mesh(lathe([[0,0],[1.2,0],[1.0,.15],[0,.2]]),M('#c98a5b',{r:.95})));
  [[-.55,-.2,1.6,.26],[-.2,-.45,1.2,.22],[-.75,.25,1.1,.2],[-.35,.15,1.9,.25],[-.05,-.05,.9,.18]].forEach(([x,z,h,r],i)=>{
    const m=mesh(new THREE.CapsuleGeometry(r,h,6,14),i%2?rock:rock2,x,h/2+.15,z); m.scale.set(1,1,.85); g.add(m); });
  // little hotel with pool
  const wall=M('#e3a86f'); g.add(mesh(RB(.7,.4,.55,.04),wall,.55,.4,.25));
  g.add(mesh(RB(.3,.25,.3,.03),wall,.75,.72,.15));
  g.add(mesh(RB(.5,.05,.3,.03,1),M('#3fc7e0',{r:.1,e:'#1aa0c0',ei:.25}),.5,.21,.75));
  return g;
}
function buildErg(){
  const g=new THREE.Group(); const sand=M('#f2a65a',{r:.95}), sand2=M('#f6b871',{r:.95});
  g.add(ell(1.3,.55,1.0,sand,0,0,0)); g.add(ell(.8,.4,.7,sand2,.7,0,.5));
  const c=buildCamel(); c.scale.setScalar(.42); c.position.set(-.15,.42,0); c.rotation.y=-.5; g.add(c); g.camel=c;
  const tent=new THREE.Group(); tent.position.set(.75,.3,.55); g.add(tent);
  const tg=new THREE.ConeGeometry(.42,.5,4); tg.rotateY(Math.PI/4); tent.add(mesh(tg,M('#5a3420',{r:.9}),0,.25,0));
  tent.add(mesh(RB(.18,.22,.02,.02,1),M('#f2c14e',{e:'#f2a43a',ei:.6}),0,.12,.3));
  return g;
}
function buildOuarz(){
  const g=new THREE.Group();
  g.add(mesh(lathe([[0,0],[1.1,0],[.95,.15],[0,.18]]),M('#cfa26b',{r:.95})));
  const k=new THREE.Group(); k.position.set(-.45,.15,-.25); g.add(k);
  k.add(mesh(RB(.5,1.0,.5,.03),M('#c47a4a'),0,.5,0));
  for(const s of [-1,1]) for(const q of [-1,1]) k.add(mesh(RB(.1,.14,.1,.02,1),M('#c47a4a'),s*.19,1.06,q*.19));
  k.add(mesh(RB(.1,.16,.02,.02,1),M('#3d2416'),0,.7,.26));
  // clapperboard
  const cb=new THREE.Group(); cb.position.set(.3,.15,.2); cb.rotation.y=-.35; g.add(cb);
  cb.add(mesh(RB(.8,.6,.08,.03),M('#2a2a2e',{r:.4}),0,.42,0));
  cb.add(mesh(RB(.6,.05,.09,.01,1),M('#ffffff'),0,.5,0));
  cb.add(mesh(RB(.6,.05,.09,.01,1),M('#ffffff'),0,.36,0));
  const top=new THREE.Group(); top.position.set(-.4,.76,0); cb.add(top); g.clap=top;
  top.add(mesh(RB(.82,.14,.09,.02,1),M('#ffffff',{map:CLAP_TEX,r:.4}),.41,.07,0));
  cb.add(mesh(RB(.82,.12,.09,.02,1),M('#ffffff',{map:CLAP_TEX,r:.4}),0,.76,0));
  const p=buildPalm(1.4,.3); p.position.set(.55,.1,-.45); g.add(p); g.palms=[p];
  return g;
}
function buildWindmill(){
  const g=new THREE.Group();
  g.add(mesh(lathe([[0,0],[.55,0],[.45,1.3],[.32,1.6],[0,1.6]],12),M('#7a4b2c',{r:.8})));
  g.add(mesh(new THREE.ConeGeometry(.42,.5,12),M('#3d5a40'),0,1.85,0));
  g.add(mesh(RB(.16,.3,.04,.03,1),M('#f6e2b3'),0,.2,.52));
  const hub=new THREE.Group(); hub.position.set(0,1.62,.42); g.add(hub); g.sails=hub;
  for(let i=0;i<4;i++){ const a=new THREE.Group(); a.rotation.z=i*Math.PI/2; hub.add(a);
    a.add(mesh(RB(.06,1.35,.04,.02,1),M('#5b3a22'),0,.7,0)); a.add(mesh(RB(.3,1.0,.02,.02,1),M('#fbf2e3',{r:.8}),.17,.82,0)); }
  hub.add(mesh(SPH(.09,12,8),M('#5b3a22'),0,0,.02));
  const tc=['#e63946','#ffb703','#ff6b9a','#ffffff'];
  for(let r=0;r<3;r++) for(let i=0;i<7;i++){ const x=-.9+i*.3, z=.9+r*.28; g.add(mesh(new THREE.CapsuleGeometry(.07,.08,4,8),M(tc[(r+i)%4]),x,.22,z)); g.add(mesh(CYL(.015,.015,.18,4),M('#3f8f3f'),x,.09,z)); }
  return g;
}
function buildPlane(){
  const g=new THREE.Group(); const w=M('#fbfbfb',{r:.3,env:1}), o=M('#ff7a3d',{r:.4}), gl=M('#24384e',{r:.1,m:.3});
  const f=mesh(new THREE.CapsuleGeometry(.36,2.4,10,20),w,0,0,0); f.rotation.z=Math.PI/2; g.add(f);
  const belly=mesh(new THREE.CapsuleGeometry(.365,1.9,8,20,),o,0,-.12,0); belly.rotation.z=Math.PI/2; belly.scale.set(.6,1,1.0); g.add(belly);
  g.add(mesh(RB(.55,.06,3.4,.03),w,-.05,-.05,0));
  g.add(mesh(RB(.32,.05,1.3,.025),w,-1.4,.12,0));
  const fin=mesh(RB(.5,.75,.06,.03),o,-1.42,.48,0); fin.rotation.z=.35; g.add(fin);
  for(const s of [-1,1]) ad(g,mesh(CYL(.13,.13,.45,16),M('#d7dce2',{m:.6,r:.3}),.05,-.22,s*.85)).rotation.z=Math.PI/2;
  for(let i=0;i<8;i++) for(const s of [-1,1]) g.add(mesh(SPH(.05,8,6),gl,.9-i*.26,.12,s*.33));
  g.add(mesh(RB(.2,.16,.5,.06,2),gl,1.32,.16,0));
  return g;
}

/* ================================================================
   LIGHTS
   ================================================================ */
function addLights(scene, {sky='#ffe9c9', ground='#b9764a', hemi=1.5, sun=3.0, shadow=2048, range=10}={}){
  scene.add(new THREE.HemisphereLight(sky, ground, hemi));
  const d=new THREE.DirectionalLight('#fff1d8', sun); d.position.set(6,10,5); d.castShadow=true;
  d.shadow.mapSize.set(shadow,shadow); const c=d.shadow.camera; c.left=-range;c.right=range;c.top=range;c.bottom=-range;c.near=.5;c.far=60; d.shadow.bias=-.0004; d.shadow.normalBias=.02; d.shadow.radius=4;
  scene.add(d); scene.add(d.target); return d;
}
function skyDome(top='#5fb8ec', mid='#a9dcf3', bot='#ffd9a8'){
  const geo=new THREE.SphereGeometry(200,32,16);
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:false,
    uniforms:{a:{value:new THREE.Color(top)},b:{value:new THREE.Color(mid)},c:{value:new THREE.Color(bot)}},
    vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 a,b,c;varying vec3 vP;void main(){float h=vP.y;vec3 col=h>0.15?mix(b,a,smoothstep(.15,.7,h)):mix(c,b,smoothstep(-.1,.15,h));gl_FragColor=vec4(col,1.);}'});
  const m=new THREE.Mesh(geo,mat); m.renderOrder=-1; return m;
}

/* ================================================================
   PLAYER CHARACTERS (one per traveller, each in their own djellaba)
   ================================================================ */
const CHARACTERS = [
  { id:"cock", name:"Cock", robe:"#2f5fd0", trim:"#f2c14e", skin:"#e8b496", hair:"baldtop", hairColor:"#dcdcdc",
    brows:"#bdbdbd", glasses:{color:"#4f6f9f", shape:"round"}, collar:"#ffffff", smile:.9, robeName:"Koningsblauwe djellaba" },
  { id:"margreet", name:"Margreet", robe:"#d63f86", trim:"#f2c14e", skin:"#f1c6aa", hair:"bob", hairColor:"#d3d0cc",
    brows:"#a99f95", eyes:"#5f7e9c", lashes:true, mouth:"open", collar:"#f6e6d6", robeName:"Fuchsiaroze djellaba" },
  { id:"bas", name:"Bas", robe:"#1f9e6a", trim:"#f2c14e", skin:"#eab99b", hair:"buzz", hairColor:"#857e76",
    brows:"#8f877d", eyes:"#6f8aa6", mouth:"open", grin:1.18, gap:true, beard:"stubble", beardColor:"#a2988c", collar:"#1f2a44", robeName:"Smaragdgroene djellaba" },
  { id:"inge", name:"Inge", robe:"#f0a51e", trim:"#a8322d", skin:"#f3c9a9", hair:"long", hairColor:"#c39554",
    brows:"#a8865a", eyes:"#5f8a8f", lashes:true, mouth:"open", freckles:true, earrings:"#e2a93a", collar:"#ffffff", robeName:"Saffraangele djellaba" },
  { id:"sem", name:"Sem", robe:"#9e2a3a", trim:"#f2c14e", skin:"#f2c4a4", hair:"sweep", hairColor:"#8a6844", hairLight:"#b9935d",
    brows:"#7a5b3c", eyes:"#62788f", mouth:"open", grin:1.1, collar:"#7d1f2c", scale:.86, pose:"thumbs", robeName:"Bordeauxrode djellaba" },
  { id:"vive", name:"Vive", robe:"#8d62d1", trim:"#f2c14e", skin:"#f4cdb2", hair:"ponytail", hairColor:"#d29a63",
    brows:"#c08a5a", eyes:"#6f8aa3", lashes:true, mouth:"open", grin:1.1, freckles:"many", earrings:"#d9dde2", earStud:true, collar:"#ffffff", scale:.8, robeName:"Lavendelpaarse djellaba" },
  { id:"jesse", name:"Jesse", robe:"#26386e", trim:"#e0393f", skin:"#f1c5a6", hair:"spiky", hairColor:"#957450", hairLight:"#b99a6c",
    brows:"#86684a", eyes:"#5d6f82", mouth:"open", grin:.92, gap:true, bigEars:true, collar:"#d8343f", scale:.78, robeName:"Marineblauwe djellaba" },
  { id:"freek", name:"Freek", robe:"#d9612a", trim:"#f6e2b3", skin:"#efbea2", hair:"shaved", hairColor:"#d6ad86",
    brows:"#b98d68", eyes:"#5a7fa8", smile:.75, smirk:.18, beard:"stubble", beardColor:"#c29a77", collar:"#6f7480", robeName:"Terracotta djellaba" },
  { id:"liesbeth", name:"Liesbeth", robe:"#119fbf", trim:"#f2c14e", skin:"#e4aa86", hair:"messybun", hairColor:"#4a3022",
    brows:"#3d281c", eyes:"#5a4130", lashes:true, squint:true, mouth:"open", grin:1.15, collar:"#3aa86b", robeName:"Turquoise djellaba" },
  { id:"saar", name:"Saar", robe:"#f09bbd", trim:"#f2c14e", skin:"#f2c2a2", hair:"wavy", hairColor:"#8a5d3b", hairLight:"#c49562",
    brows:"#6d4a30", eyes:"#5a3d28", lashes:true, mouth:"open", braces:true, earrings:"#d9dde2", hoopSize:1.7, sunnies:true, collar:"#f7d3e2", scale:.82, robeName:"Poederroze djellaba" },
  { id:"nova", name:"Nova", robe:"#6b2a63", trim:"#f2c14e", skin:"#ecb58f", hair:"ponytail", sleek:true, hairColor:"#a27b4e",
    brows:"#8a6845", eyes:"#6a8199", lashes:true, smile:.8, smirk:.1, necklace:"#e6c25a", lips:"#c8505c", collar:"#4a1c44", scale:.88, robeName:"Aubergine djellaba" },
  { id:"christa", name:"Christa", robe:"#8c9a33", trim:"#f6e2b3", skin:"#efc0a0", hair:"long", sweptBack:true, hairColor:"#7a4f31", hairLight:"#a97a4c",
    brows:"#6e4a30", eyes:"#6f7d55", lashes:true, mouth:"open", grin:1.1, freckles:true, earrings:"#e2a93a", earStud:true, pose:"thumbs", collar:"#556b3a", robeName:"Olijfgroene djellaba" }
];
const shade=(hex,amt)=>{ const c=new THREE.Color(hex); const h={}; c.getHSL(h); c.setHSL(h.h,h.s,clamp(h.l+amt,0,1)); return '#'+c.getHexString(); };

function buildCharacter(c){
  const g=new THREE.Group();
  const skin=M(c.skin,{r:.55}), robe=M(c.robe,{r:.78}), robeD=M(shade(c.robe,-.12),{r:.8}), trim=M(c.trim,{r:.4,m:.25});
  const white=M('#ffffff',{r:.25}), black=M('#1b1410',{r:.2});
  // robe (djellaba) — a soft bell shape
  const prof=[[0,.02],[.6,.02],[.63,.08],[.58,.36],[.5,.72],[.44,.98],[.38,1.14],[.26,1.24],[0,1.26]];
  g.add(mesh(lathe(prof,40),robe,0,0,0));
  const rAt=y=>{ for(let i=0;i<prof.length-1;i++){ const [r0,y0]=prof[i],[r1,y1]=prof[i+1]; if(y>=y0&&y<=y1) return lerp(r0,r1,(y-y0)/(y1-y0||1)); } return .3; };
  ad(g,mesh(new THREE.TorusGeometry(.615,.025,8,48),trim,0,.1,0)).rotation.x=Math.PI/2;
  // braided trim down the front + buttons
  const front=[]; for(let y=.12;y<=1.16;y+=.08) front.push(new THREE.Vector3(0,y,rAt(y)+.006));
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(front),32,.022,8),trim));
  for(let y=.82;y<=1.12;y+=.075) g.add(mesh(SPH(.026,10,8),trim,0,y,rAt(y)+.02));
  // hood hanging at the back
  const hood=ell(.3,.3,.17,robeD,0,1.06,-.33); g.add(hood);
  ad(g,mesh(new THREE.TorusGeometry(.2,.02,6,24,Math.PI),trim,0,1.12,-.43)).rotation.z=Math.PI;
  if(c.necklace){ const nk=mesh(new THREE.TorusGeometry(.17,.022,8,32),M(c.necklace,{m:.85,r:.3}),0,1.26,.02); nk.rotation.x=Math.PI/2-.25; g.add(nk); g.add(mesh(SPH(.04,10,8),M(c.necklace,{m:.85,r:.3}),0,1.19,.2)); }
  // neck and shirt collar
  g.add(mesh(CYL(.13,.15,.16,16),skin,0,1.3,0));
  for(const s of [-1,1]){ const col=mesh(RB(.16,.05,.11,.02,1),M(c.collar||'#ffffff',{r:.4}),s*.09,1.27,.13); col.rotation.z=s*.55; col.rotation.y=-s*.4; g.add(col); }
  // arms (wide sleeves) — pivots at the shoulders
  g.arms=[];
  for(const s of [-1,1]){ const arm=new THREE.Group(); arm.position.set(s*.4,1.1,0); g.add(arm); g.arms.push(arm);
    const sl=mesh(new THREE.CapsuleGeometry(.12,.38,6,14),robe,0,-.24,0); arm.add(sl);
    arm.add(mesh(CYL(.17,.13,.14,18),robeD,0,-.48,0));
    arm.add(mesh(SPH(.105,16,12),skin,0,-.6,0));
    arm.rotation.z=s*.32;
    if(c.pose==='thumbs'&&s>0){ const th=mesh(new THREE.CapsuleGeometry(.035,.07,4,8),skin,0,-.6,0); const d=new THREE.Vector2(Math.sin(1.9),Math.cos(1.9)); th.position.set(d.x*.11,-.6+d.y*.11,.02); th.rotation.z=-1.9; arm.add(th); } }
  g.pose=c.pose;
  // babouches peeking out
  for(const s of [-1,1]){ const b=ell(.11,.07,.2,M('#f4c430',{r:.55}),s*.17,.05,.42); g.add(b); }
  // head
  const head=new THREE.Group(); head.position.set(0,1.78,0); g.add(head); g.head=head;
  head.add(ell(.5,.48,.47,skin,0,0,0));
  for(const s of [-1,1]){ head.add(ell(c.bigEars?.1:.08,c.bigEars?.15:.12,.06,skin,s*(c.bigEars?.5:.49),-.02,-.02)); head.add(ell(.07,.045,.02,M('#f08e86',{o:.55,r:.6}),s*.27,-.12,.41)); }
  head.add(ell(.1,.1,.11,M(shade(c.skin,-.04),{r:.5}),0,-.04,.48));
  // eyes
  g.lids=[];
  for(const s of [-1,1]){ const e=new THREE.Group(); e.position.set(s*.17,.06,.41); head.add(e);
    e.add(ell(.1,.11,.06,white,0,0,0)); e.add(ell(.058,.064,.03,M(c.eyes||'#4a3424',{r:.3}),0,-.005,.045)); e.add(ell(.032,.036,.02,black,0,-.005,.06)); e.add(mesh(SPH(.016,8,6),white,.025,.03,.075));
    const lid=ell(.106,.116,.07,skin,0,0,0); lid.userData.sy=.116; lid.userData.rest=c.squint?.5:.01; lid.scale.y=.116*lid.userData.rest; lid.position.y=.07; e.add(lid); g.lids.push(lid);
    if(c.lashes) for(let k=0;k<3;k++){ const la=mesh(new THREE.CapsuleGeometry(.008,.035,3,5),M('#3a2a20',{r:.6}),s*(.17+.06*(k-1)+s*.03),.15+(k===1?.01:0),.43); la.rotation.z=-s*(.5+k*.35)+(s>0?0:0); head.add(la); }
    const brow=mesh(new THREE.CapsuleGeometry(.022,.1,4,8),M(c.brows||c.hairColor,{r:.8}),s*.17,.21,.44); brow.rotation.z=Math.PI/2+s*.12; head.add(brow); }
  // smile
  if(c.mouth==='open'){ const mo=ell(.13,.075,.05,M('#7a2f22',{r:.5}),0,-.2,.44); mo.scale.y=.07; head.add(mo);
    const mouth=new THREE.Group(); mouth.position.set(0,-.19,c.beard?.475:.445); mouth.rotation.x=-.3; mouth.scale.x=c.grin||1; head.add(mouth);
    const lip=new THREE.Shape(); lip.moveTo(-.13,0); lip.quadraticCurveTo(0,-.2,.13,0); lip.quadraticCurveTo(0,.02,-.13,0);
    mouth.add(mesh(new THREE.ShapeGeometry(lip,16),M('#8a2e26',{r:.5,ds:true}),0,0,0));
    const th=new THREE.Shape(); th.moveTo(-.105,-.005); th.quadraticCurveTo(0,.012,.105,-.005); th.quadraticCurveTo(.07,-.06,0,-.065); th.quadraticCurveTo(-.07,-.06,-.105,-.005);
    mouth.add(mesh(new THREE.ShapeGeometry(th,12),M(c.teeth||'#fbf6e8',{r:.3,ds:true}),0,0,.004));
    if(c.braces){ mouth.add(mesh(new THREE.PlaneGeometry(.17,.012),M('#c9ced6',{m:.8,r:.25,ds:true}),0,-.022,.008)); for(let k=-3;k<=3;k++) mouth.add(mesh(new THREE.PlaneGeometry(.014,.018),M('#aeb5bf',{m:.8,r:.25,ds:true}),k*.026,-.022,.009)); }
    if(c.gap) mouth.add(mesh(new THREE.PlaneGeometry(.008,.05),M('#5a1e18',{ds:true}),0,-.03,.007));
    head.remove(mo); }
  else { const arc=Math.PI*.7*(c.smile??.9); const sm=mesh(new THREE.TorusGeometry(.12,c.lips?.03:.022,8,24,arc),M(c.lips||'#7a2f22',{r:.5}),0,-.2,.44); sm.rotation.z=Math.PI*1.5-arc/2+(c.smirk||0); sm.rotation.x=-.25; if(c.beard) sm.position.z=.47; head.add(sm); }
  if(c.freckles){ const fm=M(shade(c.skin,-.22),{r:.7}); const nf=c.freckles==='many'?16:7; for(const s of [-1,1]) for(let k=0;k<nf;k++){ const x=s*(.1+((k*37)%11)/11*.24), y=-.03-((k*53)%13)/13*.13; head.add(mesh(SPH(.011,6,5),fm,x,y,Math.sqrt(Math.max(.01,1-(x/.5)**2-(y/.48)**2))*.47+.003)); }
    for(let k=0;k<(c.freckles==='many'?8:4);k++) head.add(mesh(SPH(.009,6,5),fm,-.05+(k%4)*.033,.0+(k>3?.04:0)+(k%2)*.015,.53)); }
  if(c.earrings&&c.earStud){ const em=M(c.earrings,{m:.85,r:.25}); for(const s of [-1,1]) head.add(mesh(SPH(.024,10,8),em,s*.5,-.11,.03)); }
  else if(c.earrings){ const em=M(c.earrings,{m:.8,r:.3}); for(const s of [-1,1]){ const hs=c.hoopSize||1; const ring=mesh(new THREE.TorusGeometry(.05*hs,.011+.005/hs,8,24),em,s*.47,-.16-.05*hs,.16); ring.rotation.y=s*.9; head.add(ring); head.add(mesh(SPH(.022,10,8),em,s*.47,-.14,.17)); } }
  // hair
  const hm=M(c.hairColor,{r:.85});
  const shell=(ps,pl,ts,tl,sc=1.035)=>{ const m=mesh(new THREE.SphereGeometry(.5,36,18,ps,pl,ts,tl),hm,0,0,0); m.scale.set(sc,.96*sc,.94*sc); m.material.side=THREE.DoubleSide; return m; };
  if(c.hair==='baldtop'){ head.add(shell(Math.PI/2+1.05,Math.PI*2-2.1,1.0,.95)); }
  else if(c.hair==='bob'){
    head.add(shell(0,Math.PI*2,0,1.2,1.07));
    const side=shell(Math.PI/2+.78,Math.PI*2-1.56,.9,1.05,1.1); side.scale.y=1.0; head.add(side);
    const fr=ell(.3,.085,.17,hm,-.06,.37,.31); fr.rotation.z=.42; fr.rotation.x=-.55; head.add(fr);
    const fr2=ell(.17,.07,.13,hm,.2,.4,.27); fr2.rotation.z=-.15; fr2.rotation.x=-.5; head.add(fr2);
    [[-.2,.47,.05,.4],[.12,.5,.0,-.3],[-.02,.52,-.15,.1],[.26,.42,-.12,-.6],[-.3,.4,-.12,.7]].forEach(([x,y,z,r])=>{ const tf=ell(.17,.07,.14,hm,x,y,z); tf.rotation.z=r; head.add(tf); }); }
  else if(c.hair==='buzz'){
    head.add(shell(0,Math.PI*2,0,.66,1.025));
    head.add(shell(Math.PI/2+.75,Math.PI*2-1.5,.5,1.05,1.03));
    for(let k=0;k<30;k++){ const th=.1+Math.random()*.58, ph=Math.random()*Math.PI*2; if(Math.sin(ph)>.2&&th>.42) continue;
      const tf=mesh(SPH(.05,8,6),hm,.515*Math.sin(th)*Math.cos(ph),.49*Math.cos(th)+.01,.48*Math.sin(th)*Math.sin(ph)); tf.scale.set(1,.55,1); head.add(tf); } }
  else if(c.hair==='sweep'){
    const hl=M(c.hairLight||c.hairColor,{r:.8});
    head.add(shell(0,Math.PI*2,0,.95,1.06));
    head.add(shell(Math.PI/2+.75,Math.PI*2-1.5,.7,.85,1.06));
    const f1=ell(.4,.12,.22,hm,.06,.33,.3); f1.rotation.z=-.38; f1.rotation.x=-.55; head.add(f1);
    const f2=ell(.26,.09,.16,hl,.2,.3,.36); f2.rotation.z=-.62; f2.rotation.x=-.45; head.add(f2);
    const f3=ell(.2,.08,.14,hl,-.12,.42,.24); f3.rotation.z=-.2; f3.rotation.x=-.6; head.add(f3);
    [[-.25,.45,-.05,.5],[.15,.5,-.1,-.3],[.0,.52,.08,.1]].forEach(([x,y,z,r])=>{ const tf=ell(.18,.08,.15,hm,x,y,z); tf.rotation.z=r; head.add(tf); }); }
  else if(c.hair==='ponytail'){
    if(!c.sleek){ head.add(shell(0,Math.PI*2,0,.92,1.05)); head.add(shell(Math.PI/2+.95,Math.PI*2-1.9,.6,.62,1.055)); }
    for(const s of [-1,1]){ const w=ell(.26,.08,.18,hm,s*.2,.36,.3); w.rotation.z=-s*.35; w.rotation.x=-.5; if(!c.sleek) head.add(w);
      const st=mesh(new THREE.CapsuleGeometry(.035,.32,4,8),hm,s*.44,-.08,.18); st.rotation.z=s*.12; if(!c.sleek) head.add(st); }
    if(c.sleek){ head.add(shell(0,Math.PI*2,0,.84,1.045));
      for(const s of [-1,1]){ const w=ell(.24,.07,.17,hm,s*.19,.4,.26); w.rotation.z=-s*.5; w.rotation.x=-.62; head.add(w); }
      head.add(shell(Math.PI*1.5-1.3,2.6,.5,.85,1.05));
      head.add(shell(Math.PI/2+1.25,Math.PI*2-2.5,.6,.55,1.05));
      const pt3=ell(.12,.3,.12,hm,.3,-.45,-.42); pt3.rotation.z=-.3; pt3.rotation.x=.3; head.add(pt3); }
    head.add(mesh(new THREE.TorusGeometry(.07,.03,8,18),M('#e05a8a',{r:.5}),0,.22,-.5));
    const pt=ell(.15,.36,.14,hm,0,-.12,-.6); pt.rotation.x=.35; head.add(pt);
    const pt2=ell(.1,.2,.1,hm,0,-.42,-.55); pt2.rotation.x=-.2; head.add(pt2); }
  else if(c.hair==='spiky'){
    const hl=M(c.hairLight||c.hairColor,{r:.8});
    head.add(shell(0,Math.PI*2,0,.98,1.05));
    head.add(shell(Math.PI/2+.85,Math.PI*2-1.7,.7,.75,1.045));
    const rows=[[.18,5,.0],[.36,7,.35],[.55,8,.1]];
    rows.forEach(([th,n,off],ri)=>{ for(let k=0;k<n;k++){ const ph=Math.PI*(.15+.7*(k+.5)/n)+off*.2;
      const nx=Math.sin(th)*Math.cos(ph), ny=Math.cos(th), nz=Math.sin(th)*Math.sin(ph);
      const sp=mesh(new THREE.ConeGeometry(.075,.17,7),(k+ri)%3?hm:hl,nx*.52,ny*.49,nz*.5);
      const dir=new THREE.Vector3(nx*.6,1,nz*.6+.55).normalize(); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir); head.add(sp); } });
    for(let k=0;k<6;k++){ const ph=Math.PI*(1.15+.7*k/5); const sp=mesh(new THREE.ConeGeometry(.07,.14,7),hm,Math.sin(.4)*Math.cos(ph)*.52,Math.cos(.4)*.49,Math.sin(.4)*Math.sin(ph)*.5); sp.rotation.x=-.6; head.add(sp); } }
  else if(c.hair==='shaved'){
    head.add(shell(0,Math.PI*2,0,.88,1.012));
    head.add(shell(Math.PI/2+.85,Math.PI*2-1.7,.8,.75,1.013)); }
  else if(c.hair==='messybun'){
    head.add(shell(0,Math.PI*2,0,.95,1.05));
    head.add(shell(Math.PI/2+.75,Math.PI*2-1.5,.6,.85,1.06));
    for(let k=0;k<14;k++){ const th=.25+(k%4)*.17, ph=k*2.39; if(Math.sin(ph)>.6&&th>.5) continue;
      head.add(ell(.13,.09,.12,hm,Math.sin(th)*Math.cos(ph)*.53,Math.cos(th)*.5,Math.sin(th)*Math.sin(ph)*.5)); }
    [[0,.5,-.2,.17],[.12,.58,-.24,.13],[-.11,.57,-.22,.13],[0,.64,-.12,.11]].forEach(([x,y,z,r])=>head.add(mesh(SPH(r,14,10),hm,x,y,z)));
    for(const s of [-1,1]){ const cv=new THREE.CatmullRomCurve3([new THREE.Vector3(s*.4,.2,.22),new THREE.Vector3(s*.5,.0,.18),new THREE.Vector3(s*.45,-.15,.24),new THREE.Vector3(s*.52,-.32,.16)]);
      head.add(mesh(new THREE.TubeGeometry(cv,20,.03,6),hm)); }
    const fr=ell(.25,.08,.16,hm,-.12,.38,.3); fr.rotation.z=.4; fr.rotation.x=-.5; head.add(fr); }
  else if(c.hair==='wavy'){
    const hl=M(c.hairLight||c.hairColor,{r:.8});
    head.add(shell(0,Math.PI*2,0,.85,1.06));
    head.add(shell(Math.PI/2+.62,Math.PI*2-1.24,.6,.95,1.07));
    for(const s of [-1,1]){ const w=ell(.27,.09,.2,hm,s*.2,.35,.3); w.rotation.z=-s*.42; w.rotation.x=-.5; head.add(w);
      for(let k=0;k<7;k++){ const y=.05-k*.13, x=s*(.46+.05*Math.sin(k*1.6)+k*.012), z=.02-k*.02; head.add(ell(.13,.1,.15,k>3?hl:hm,x,y,z)); } }
    for(let k=0;k<9;k++){ const y=-.05-k*.11, x=.25*Math.sin(k*1.3); head.add(ell(.3,.12,.16,k>4?hl:hm,x*.6,y,-.3-.02*k)); } }
  else if(c.hair==='short'){ head.add(shell(0,Math.PI*2,0,1.15)); }
  else if(c.hair==='long'){
    const hl=M(c.hairLight||c.hairColor,{r:.8});
    head.add(shell(0,Math.PI*2,0,c.sweptBack?.86:.8,1.06));
    head.add(shell(Math.PI/2+.62,Math.PI*2-1.24,.6,.95,1.07));
    for(const s of [-1,1]){ if(c.sweptBack){ const w=ell(.3,.08,.2,s>0?hl:hm,s*.16,.42,.22); w.rotation.z=-s*.25; w.rotation.x=-.8; head.add(w); }
      else { const w=ell(.27,.09,.2,hm,s*.2,.36,.3); w.rotation.z=-s*.42; w.rotation.x=-.5; head.add(w); }
      const cur=ell(.14,.52,.16,hm,s*.44,-.24,-.02); cur.rotation.z=s*.08; head.add(cur);
      if(c.hairLight){ const cl=ell(.1,.4,.12,hl,s*.47,-.36,.04); cl.rotation.z=s*.08; head.add(cl); } }
    head.add(ell(.5,.64,.25,hm,0,-.3,-.24)); }
  else if(c.hair==='bun'){ head.add(shell(0,Math.PI*2,0,1.15)); head.add(mesh(SPH(.17,16,12),hm,0,.45,-.18)); }
  else if(c.hair==='curly'){ for(let i=0;i<40;i++){ const th=Math.acos(1-Math.random()*1.05), ph=Math.random()*Math.PI*2; if(Math.sin(ph)>.55&&th>.6) continue; head.add(mesh(SPH(.11,10,8),hm,.52*Math.sin(th)*Math.cos(ph),.5*Math.cos(th),.5*Math.sin(th)*Math.sin(ph))); } }
  head.children.forEach(o=>{ if(o.material===hm) o.castShadow=false; });
  if(c.sunnies){ const sg=new THREE.Group(); sg.position.set(0,.5,.12); sg.rotation.x=-.75; head.add(sg); const fm=M('#3b2a33',{r:.3,m:.3}), lm=M('#2a2f3a',{r:.08,m:.4,env:1});
    for(const s of [-1,1]){ const l=ell(.14,.1,.03,lm,s*.16,0,0); sg.add(l); const fr=mesh(new THREE.TorusGeometry(.12,.018,6,24),fm,s*.16,0,.0); fr.scale.y=.75; sg.add(fr); }
    sg.add(mesh(RB(.08,.025,.025,.01,1),fm,0,.02,0)); }
  if(c.beard){ const bm=M(c.beardColor||c.hairColor,{r:.95,ds:true});
    const b=mesh(new THREE.SphereGeometry(.5,40,20,Math.PI/2-1.35,2.7,1.98,.9),bm,0,0,0); b.scale.set(1.025,.97,.955); head.add(b);
    const mu=ell(.15,.028,.05,bm,0,-.135,.458); mu.rotation.x=-.3; head.add(mu); }
  // glasses
  if(c.glasses){ const gm=M(c.glasses.color,{r:.3,m:.4});
    for(const s of [-1,1]){ head.add(mesh(new THREE.TorusGeometry(.135,.016,8,32),gm,s*.17,.06,.49));
      const tc=new THREE.CatmullRomCurve3([new THREE.Vector3(s*.3,.07,.49),new THREE.Vector3(s*.43,.08,.34),new THREE.Vector3(s*.5,.07,.04)]);
      head.add(mesh(new THREE.TubeGeometry(tc,12,.012,6),gm)); }
    const br=mesh(CYL(.012,.012,.1,6),gm,0,.08,.5); br.rotation.z=Math.PI/2; head.add(br); }
  g.userData.base=c.scale||1; g.scale.setScalar(g.userData.base);
  return g;
}

/* portraits for the picker, the HUD and the street map */
const PORTRAITS={};
function renderPortraits(){
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  r.setSize(320,320); r.setPixelRatio(1); r.toneMapping=THREE.ACESFilmicToneMapping;
  const S=new THREE.Scene(); S.environment=ENV; S.environmentIntensity=.3; S.add(new THREE.HemisphereLight('#ffe9c9','#b9764a',1.6));
  const d=new THREE.DirectionalLight('#fff1d8',3.0); d.position.set(2,5,6); S.add(d);
  const cam=new THREE.PerspectiveCamera(28,1,.1,50);
  CHARACTERS.forEach(c=>{ const g=buildCharacter(c); S.add(g);
    cam.position.set(.55,1.95,3.4); cam.lookAt(0,1.62,0); r.render(S,cam); PORTRAITS[c.id]=r.domElement.toDataURL('image/png');
    cam.position.set(1.1,1.5,5.6); cam.lookAt(0,1.12,0); r.render(S,cam); PORTRAITS[c.id+':full']=r.domElement.toDataURL('image/png');
    S.remove(g); });
  r.dispose(); r.forceContextLoss?.();
}

/* the picker scene: chosen traveller on a little rug pedestal */
const pick = { scene:new THREE.Scene(), t:0, model:null, pop:1 };
(function buildPick(){
  const S=pick.scene; S.environment=ENV; S.environmentIntensity=.3; S.add(skyDome('#5fb8ec','#a9dcf3','#ffcf98'));
  const sun=addLights(S,{range:4}); sun.position.set(-3,8,6);
  S.add(mesh(lathe([[0,0],[1.5,0],[1.62,-.12],[1.62,-.3],[1.45,-.42],[0,-.44]],48),M('#eeb06a',{r:.95}),0,0,0));
  S.add(mesh(lathe([[1.44,-.41],[1.1,-1.0],[.5,-1.4],[0,-1.5]],40),M('#c66e45',{r:.95}),0,0,0));
  const rug=mesh(CYL(1.25,1.25,.04,48),M('#ffffff',{map:RUG_TEX,r:.95}),0,.02,0); S.add(rug);
  const p1=buildPalm(2.6,.35); p1.position.set(-1.25,0,-.75); S.add(p1); pick.palm=p1;
  const l1=buildLantern('#ff9f43'); l1.scale.setScalar(.7); l1.position.set(1.05,0,.45); S.add(l1);
  const l2=buildLantern('#2ec4b6'); l2.scale.setScalar(.55); l2.position.set(1.25,0,-.15); S.add(l2);
  pick.slot=new THREE.Group(); S.add(pick.slot);
  [[-4,3.2,-6,1.1],[4.5,4,-8,1.3]].forEach(([x,y,z,s])=>{ const c=buildCloud(); c.position.set(x,y,z); c.scale.setScalar(s); S.add(c); });
})();
function setPickModel(c){
  pick.slot.clear(); const m=buildCharacter(c); pick.slot.add(m); pick.model=m; pick.pop=0; pick.t=0;
}
function updatePick(dt){
  pick.t+=dt; const t=pick.t;
  const asp=innerWidth/innerHeight; const dist=asp<1?9.6:6.2;
  camera.position.set(Math.sin(.15)*dist, 2.6, Math.cos(.15)*dist); camTgt.set(0,asp<1?.55:.95,0); look();
  pick.pop=Math.min(1,pick.pop+dt*1.8); const s=E.back(pick.pop)*(pick.model?pick.model.userData.base:1); if(pick.model){ pick.model.scale.set(s*(1+Math.sin(t*2.4)*.012), s*(1-Math.sin(t*2.4)*.012), s);
    pick.model.rotation.y=Math.sin(t*.6)*.45; animChar(pick.model,t,true); }
  if(pick.palm) pick.palm.crown.rotation.z=Math.sin(t*1.3)*.05;
}
function animChar(m,t,wave){
  if(m.arms){ if(wave&&m.pose==='thumbs'){ m.arms[1].rotation.z=1.9+Math.sin(t*5)*.07; m.arms[1].rotation.x=-.35; } else if(wave){ m.arms[1].rotation.z=2.5+Math.sin(t*7)*.32; m.arms[1].rotation.x=.15; } m.arms[0].rotation.z=-.32+Math.sin(t*1.8)*.04; }
  if(m.head){ m.head.rotation.z=Math.sin(t*1.6)*.06; m.head.rotation.y=Math.sin(t*.9)*.12; }
  const bl=(t%3.8)>3.66; m.lids.forEach(l=>l.scale.y=(l.userData.sy||1)*(bl?1:(l.userData.rest??.01)));
}

/* ================================================================
   INTRO SCENE
   ================================================================ */
const intro = { scene:new THREE.Scene(), t:0, props:[], started:false };
(function buildIntro(){
  const S=intro.scene; S.environment=ENV; S.environmentIntensity=.3; S.add(skyDome());
  intro.sun=addLights(S,{range:9}); intro.sun.position.set(-5,11,7);
  // floating sand island
  const isl=new THREE.Group(); S.add(isl);
  isl.add(mesh(lathe([[0,0],[6.2,0],[6.5,-.15],[6.5,-.45],[6.1,-.75],[0,-.8]],64),M('#eeb06a',{r:.95})));
  const under=mesh(lathe([[6.08,-.74],[5.4,-1.6],[4.0,-2.6],[2.2,-3.3],[0,-3.6]],48),M('#c66e45',{r:.95})); isl.add(under);
  isl.add(mesh(lathe([[6.44,-.42],[6.3,-.95],[5.6,-1.5],[5.5,-1.4]],64),M('#de8a54',{r:.95})));
  // dunes on the island
  [[-4.4,-2.6,1.6],[4.6,-2.9,1.3],[-1.5,-4.2,1.8],[2.2,-4.4,1.5]].forEach(([x,z,r])=>{ const d=ell(r,r*.38,r*.8,M('#e99f55',{r:.95}),x,0,z); isl.add(d); });
  // palms
  [[-3.3,-1.7,3.6,.4,.3],[3.8,-2.3,3.1,.35,2.6],[-1.6,-2.9,2.6,.3,1.2],[5.0,.6,2.2,.35,3.5]].forEach(([x,z,h,l,ry])=>{ const p=buildPalm(h,l); p.position.set(x,0,z); p.rotation.y=ry; S.add(p); intro.props.push({o:p,delay:1.1+Math.random()*.4,sway:true}); });
  // the van
  const van=buildVan(); van.position.set(0,0,.4); S.add(van); intro.van=van;
  // camel
  intro.charSlot=new THREE.Group(); intro.charSlot.position.set(-1.0,0,1.95); intro.charSlot.rotation.y=.35; intro.charSlot.userData.base=1.15; S.add(intro.charSlot); intro.props.push({o:intro.charSlot,delay:1.3,base:1.15});
  const camel=buildCamel(); camel.position.set(2.7,0,-.7); camel.rotation.y=Math.PI*0.85; camel.scale.setScalar(.95); S.add(camel); intro.camel=camel;
  intro.props.push({o:camel,delay:1.55,base:.95});
  // market corner
  const rug=buildRug(2.0,1.4); rug.position.set(-2.7,0,1.7); rug.rotation.y=.2; S.add(rug); intro.props.push({o:rug,delay:1.8});
  const tg=buildTagine(); tg.position.set(-3.1,.04,1.55); tg.scale.setScalar(.75); S.add(tg); intro.props.push({o:tg,delay:2.0,base:.75});
  const tg2=buildTagine('#2a7f9e','#f2c14e'); tg2.position.set(-2.35,.04,2.0); tg2.scale.setScalar(.55); S.add(tg2); intro.props.push({o:tg2,delay:2.1,base:.55});
  const tp=buildTeapot(); tp.position.set(-2.2,.04,1.25); tp.scale.setScalar(.85); tp.rotation.y=-.6; S.add(tp); intro.props.push({o:tp,delay:2.2,base:.85});
  ['#2e9e6e','#d94f6b','#3b7dd8'].forEach((c,i)=>{ const gl=buildGlass(c); gl.position.set(-1.85+i*.22,.04,1.6+i*.08); S.add(gl); intro.props.push({o:gl,delay:2.3+i*.06}); });
  const pf=buildPouf(); pf.position.set(-4.0,0,2.3); S.add(pf); intro.props.push({o:pf,delay:2.25});
  const pf2=buildPouf('#b8322a'); pf2.position.set(-1.2,0,2.9); pf2.scale.setScalar(.8); S.add(pf2); intro.props.push({o:pf2,delay:2.35,base:.8});
  ['#d8432a','#f2b134','#e07a2b'].forEach((c,i)=>{ const sp=buildSpice(c); sp.position.set(.2+i*.62,0,2.65-i*.1); sp.scale.setScalar(.8); S.add(sp); intro.props.push({o:sp,delay:2.4+i*.08,base:.8}); });
  for(const s of [0,1]){ const b=buildBabouche(); b.position.set(2.2+s*.36,0,2.25+s*.12); b.rotation.y=-.5-s*.2; S.add(b); intro.props.push({o:b,delay:2.6+s*.05}); }
  intro.lanterns=[];
  [['#ff9f43',3.6,1.5,1],['#2ec4b6',4.2,.9,.8],['#ff5d73',3.2,2.3,.7]].forEach(([c,x,z,s],i)=>{ const l=buildLantern(c); l.position.set(x,0,z); l.scale.setScalar(s); S.add(l); intro.props.push({o:l,delay:2.45+i*.1,base:s}); intro.lanterns.push(l); });
  const pl=new THREE.PointLight('#ffb460',6,6,1.6); pl.position.set(3.6,.8,1.6); S.add(pl); intro.lamp=pl;
  // floating clouds
  intro.clouds=[];
  [[-9,6.5,-10,1.6],[8,7.5,-12,1.9],[2,9.5,-16,1.4],[-14,4,-6,1.2],[13,4.5,-5,1.1]].forEach(([x,y,z,s])=>{ const c=buildCloud(); c.position.set(x,y,z); c.scale.setScalar(s); S.add(c); intro.clouds.push(c); });
  // dust puff pool
  intro.dust=[]; const dm=M('#f5d6a8',{r:1,o:.85});
  for(let i=0;i<26;i++){ const d=mesh(SPH(.22,12,8),dm,0,-10,0,false); d.visible=false; S.add(d); intro.dust.push({m:d,life:0}); }
})();

function introCamera(){
  const asp=innerWidth/innerHeight;
  const fitW = asp<1 ? 6.8 : 13;
  const dist = (fitW/2)/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(asp,.3));
  return {dist: Math.min(dist, asp<1?24:16), aimY: asp<1 ? 1.5 + dist*.08 : 2.2};
}
function updateIntro(dt){
  intro.t+=dt; const t=intro.t;
  const {dist,aimY}=introCamera();
  const k=E.sine(clamp(t/7.5,0,1));
  const ang=lerp(-.32,.18,k), elev=lerp(.16,.27,k);
  camera.position.set(Math.sin(ang)*dist*Math.cos(elev), Math.sin(elev)*dist+1.2, Math.cos(ang)*dist*Math.cos(elev));
  camTgt.set(0,aimY,0); look();
  // van drives in
  const van=intro.van; const dk=clamp((t-.3)/1.9,0,1);
  van.position.x = lerp(-13,0,E.out(dk));
  const speed = dk<1 ? (1-dk)*9 : 0;
  van.wheels.forEach(w=>w.rotation.z -= speed*dt/0.31);
  const settle = clamp((t-2.0)/.9,0,1);
  const sq = dk>=1 ? Math.sin(settle*Math.PI*3)*(1-settle)*.08 : 0;
  van.scale.set(1+sq*.6, 1-sq, 1+sq*.6);
  van.position.y = dk<1 ? Math.abs(Math.sin(t*16))*.05 : Math.sin(t*2.2)*.012;
  van.rotation.z = dk<1 ? -.03 : Math.sin(settle*Math.PI*2)*(1-settle)*.05;
  if(dk>0 && dk<1 && Math.random()<.55) puff(van.position.x-1.3, .15, van.position.z+(Math.random()-.5)*.9);
  intro.dust.forEach(d=>{ if(!d.m.visible) return; d.life+=dt; const a=d.life/1.0; if(a>=1){d.m.visible=false;return;} d.m.scale.setScalar(.4+a*1.4); d.m.position.y+=dt*.5; d.m.material.opacity=.8*(1-a); });
  // props pop in
  intro.props.forEach(p=>{ const b=p.base??1; const kk=clamp((t-p.delay)/.55,0,1); p.o.scale.setScalar(b*E.back(kk)); p.o.visible=kk>0;
    if(p.sway&&p.o.crown) p.o.crown.rotation.z=Math.sin(t*1.3+p.delay*3)*.05; });
  // camel life
  if(intro.charModel) animChar(intro.charModel,t,t>1.9);
  const c=intro.camel; c.head.rotation.z=Math.sin(t*1.4)*.08; c.head.rotation.y=Math.sin(t*.7)*.2; c.tail.rotation.x=Math.sin(t*3)*.35;
  const bl=(t%3.4)>3.25; c.lids.forEach(l=>l.scale.y=bl?.112:.002);
  intro.lanterns.forEach((l,i)=>l.rotation.y=t*.3+i);
  intro.lamp.intensity=5+Math.sin(t*9)*.4+Math.sin(t*23)*.3;
  intro.clouds.forEach((cl,i)=>cl.position.x+=dt*(.15+i*.03));
  if(t>2.2 && !intro.logo){ intro.logo=true; $('#logo').classList.add('go'); }
  if(t>4.8 && !intro.skip){ intro.skip=true; $('#skip').classList.add('on'); }
  if(t>9.5 && mode==='intro' && !busy) goMapFromIntro();
}
function puff(x,y,z){ const d=intro.dust.find(d=>!d.m.visible); if(!d) return; d.m.visible=true; d.life=0; d.m.position.set(x,y,z); d.m.material=d.m.material.clone(); }

/* ================================================================
   WORLD MAP SCENE
   ================================================================ */
const world = { scene:new THREE.Scene(), pads:[], marks:[], legMeshes:{}, pick:[] };
/* figures of the two stays that sit only ~25 km apart are lifted a little to the side; a pin marks the exact spot */
const LM_OFFSET = { aitbenhaddou:[-.36,.26], ouarzazate:[.36,.12] };
const LABEL_SIDES = { wide:{ marrakech:'left', aitbenhaddou:'left', dades:'top', ergchebbi:'top', ouarzazate:'bottom' },
                      tall:{ marrakech:'top', aitbenhaddou:'bottom', dades:'top', ergchebbi:'topleft', ouarzazate:'right' } };
const sideOf = id => LABEL_SIDES[innerWidth/innerHeight<.85?'tall':'wide'][id];
function padPos(i){ const s=STAYS[i]; return P(s.lat,s.lng); }
function lmPos(i){ const p=padPos(i); const o=LM_OFFSET[STAYS[i].id]; if(o){p.x+=o[0];p.z+=o[1];} return p; }
const NL_POS = P(NL.lat, NL.lng);

async function buildWorld(){
  const S=world.scene; S.environment=ENV; S.environmentIntensity=.25;
  S.background=new THREE.Color('#bfe9f7'); S.fog=new THREE.Fog('#bfe9f7',20,60);
  world.sun=addLights(S,{range:5,hemi:1.55,sun:2.9,shadow:2048});
  // sea
  const sea=mesh(new THREE.PlaneGeometry(600,600),M('#38b6dc',{r:.4,env:.35}),0,0,0,false); sea.rotation.x=-Math.PI/2; S.add(sea);
  // land
  const rings=await (await fetch('data/land.json')).json();
  const area=r=>{let s=0;for(let i=0;i<r.length;i++){const [x1,y1]=r[i],[x2,y2]=r[(i+1)%r.length];s+=x1*y2-x2*y1;}return s/2;};
  const big=rings.reduce((a,r)=>Math.abs(area(r))>Math.abs(area(a))?r:a); const sign=Math.sign(area(big));
  const shapes=rings.filter(r=>Math.sign(area(r))===sign).map(r=>new THREE.Shape(r.map(([x,y])=>new THREE.Vector2(x,-y))));
  const geo=new THREE.ExtrudeGeometry(shapes,{depth:.14,bevelEnabled:true,bevelThickness:.06,bevelSize:.05,bevelSegments:2,curveSegments:1});
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, col=new Float32Array(pos.count*3), cc=new THREE.Color();
  const stops=[[-30,'#5fb043'],[-14,'#74bd48'],[-6,'#9fbf4f'],[-2.2,'#bfba57'],[-.75,'#d9b45f'],[-.2,'#eaa95a'],[.6,'#ee9f4f'],[3,'#ec9446']].map(([z,c])=>[z,new THREE.Color(c)]);
  const side=new THREE.Color('#a0623a');
  for(let i=0;i<pos.count;i++){ const z=pos.getZ(i), y=pos.getY(i);
    let a=stops[0], b=stops[stops.length-1];
    for(let j=0;j<stops.length-1;j++) if(z>=stops[j][0]&&z<=stops[j+1][0]){a=stops[j];b=stops[j+1];break;}
    if(z<stops[0][0]) b=a; if(z>stops[stops.length-1][0]) a=b;
    cc.copy(a[1]).lerp(b[1], a===b?0:(z-a[0])/(b[0]-a[0]));
    if(y<.17) cc.lerp(side,.55);
    col[i*3]=cc.r; col[i*3+1]=cc.g; col[i*3+2]=cc.b; }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const land=mesh(geo,M('#ffffff',{vc:true,r:.95,env:.12})); land.castShadow=false; S.add(land);
  // mountains
  const mtn=(lng,lat,h,r,snow=true)=>{ const g=new THREE.Group(); const p=P(lat,lng,LAND_TOP-.02); g.position.copy(p);
    g.add(mesh(lathe([[r,0],[r*.82,h*.28],[r*.55,h*.6],[r*.28,h*.86],[r*.08,h*.99],[0,h]],20),M(snow?'#b8653a':'#c9773f',{r:.92,env:.2})));
    if(snow) g.add(mesh(lathe([[r*.5,h*.66],[r*.46,h*.7],[r*.28,h*.88],[r*.08,h*1.0],[0,h*1.01]],20),M('#ffffff',{r:.6})));
    g.rotation.y=Math.random()*6; S.add(g); };
  [[-8.5,31.03,.2,.22],[-8.1,31.1,.24,.24],[-7.72,31.2,.22,.22],
   [-6.95,31.55,.24,.24],[-6.55,31.72,.3,.27],[-6.15,31.86,.27,.26],[-5.75,31.98,.25,.25],[-5.3,32.12,.23,.25],[-4.85,32.3,.22,.24],[-4.4,32.48,.2,.23],
   [-5.2,33.05,.18,.24],[-4.6,33.35,.17,.23]].forEach(a=>mtn(...a));
  [[-5.62,30.98,.13,.2],[-5.28,30.9,.15,.22],[-4.95,31.0,.12,.19],[-8.6,30.2,.13,.22],[-8.0,30.05,.12,.2],[-7.3,30.35,.13,.21],[-6.3,30.25,.12,.2]].forEach(a=>mtn(...a,false));
  // dunes near Merzouga
  [[-3.92,31.22,.26],[-3.88,31.0,.3],[-3.95,30.9,.22],[-3.75,31.12,.24],[-3.82,31.32,.2]].forEach(([lng,lat,r])=>{ const p=P(lat,lng,LAND_TOP-.02); S.add(ell(r,r*.4,r*.75,M('#f0913f',{r:.95,env:.15}),p.x,p.y,p.z)); });
  // oasis palms
  world.palms=[];
  [[-7.93,31.69],[-7.86,31.66],[-6.58,31.07],[-6.53,31.03],[-6.97,30.83],[-6.48,30.47],[-6.3,30.3],[-5.53,31.53],[-5.58,31.5],[-4.03,31.07],[-6.1,31.25],[-6.15,31.22]].forEach(([lng,lat],i)=>{ const p=buildPalm(1.6,.3); p.scale.setScalar(.075); p.position.copy(P(lat,lng,LAND_TOP-.01)); p.rotation.y=i*1.7; S.add(p); world.palms.push(p); });
  // little earthen villages along the way
  const mudA=M('#c97b4b',{r:.9}), mudB=M('#d9935e',{r:.9}), mudC=M('#b8693e',{r:.9});
  const village=(lat,lng,n,seed)=>{ const c=P(lat,lng,LAND_TOP); for(let i=0;i<n;i++){ const a=seed+i*2.39, r=.03+.025*((i*7+seed*3)%5);
      const w=.022+.012*((i+seed)%3), h=.02+.016*((i*3+seed)%4); const b=mesh(RB(w,h,w,.006,1),[mudA,mudB,mudC][i%3],c.x+Math.cos(a)*r,LAND_TOP+h/2,c.z+Math.sin(a)*r); S.add(b); } };
  [[31.287,-7.383,4,1],[31.05,-6.58,6,2],[31.24,-6.13,6,3],[31.52,-5.53,7,4],[31.2,-4.08,5,5],[30.78,-5.57,5,6],[30.87,-5.87,4,7],[30.70,-6.45,5,8],[30.93,-6.91,7,9],[31.215,-7.205,3,10],[31.64,-7.95,8,11]].forEach(v=>village(...v));
  // clouds
  world.clouds=[];
  [[3.5,1.9,-3.2,.32],[-4.6,1.7,2.6,.28],[6,2.2,1.5,.36],[-3,2.6,-6,.4],[8,3,-15,.6],[-2,3.2,-20,.7]].forEach(([x,y,z,s])=>{ const c=buildCloud(); c.position.set(x,y,z); c.scale.setScalar(s); c.traverse(o=>o.castShadow=false); S.add(c); world.clouds.push(c); });
  // routes
  const ids=['aitbenhaddou','dades','ergchebbi','ouarzazate','home'];
  ids.forEach((id,li)=>{ const curve=legCurve(id, .035);
    const g=new THREE.Group(); S.add(g);
    if(id==='home'){ const n=Math.floor(curve.getLength()*14); for(let i=0;i<=n;i++){ const p=curve.getPointAt(i/n); g.add(mesh(SPH(.022,10,8),M('#ffffff',{r:.4}),p.x,p.y,p.z,false)); } }
    else { g.add(mesh(new THREE.TubeGeometry(curve,160,.042,8),M('#fff7ea',{r:.5}),0,0,0,false));
      const top=mesh(new THREE.TubeGeometry(curve,160,.026,8),M('#ff7a3d',{r:.45,e:'#ff5a1a',ei:.15}),0,.024,0,false); g.add(top); g.top=top; }
    world.legMeshes[id]=g; });
  // landmarks
  const builders={marrakech:buildKoutoubia, aitbenhaddou:buildKsar, dades:buildDades, ergchebbi:buildErg, ouarzazate:buildOuarz};
  const scales={marrakech:.2,aitbenhaddou:.25,dades:.23,ergchebbi:.27,ouarzazate:.26};
  STAYS.forEach((s,i)=>{
    const root=new THREE.Group(); root.position.copy(lmPos(i)); S.add(root);
    const pad=new THREE.Group(); root.add(pad);
    pad.add(mesh(CYL(.24,.26,.04,40),M('#fff7ea',{r:.5}),0,.02,0,false));
    const ring=mesh(new THREE.TorusGeometry(.25,.022,10,48),M('#ff7a3d',{r:.4,e:'#ff7a3d',ei:.25}),0,.045,0,false); ring.rotation.x=Math.PI/2; pad.add(ring); pad.ring=ring;
    const glow=mesh(new THREE.RingGeometry(.27,.36,48),M('#ffd27a',{o:.6,e:'#ffc04d',ei:.6,ds:true}),0,.03,0,false); glow.rotation.x=-Math.PI/2; pad.add(glow); pad.glow=glow;
    const lm=builders[s.id](); lm.scale.setScalar(scales[s.id]); lm.position.y=.04; root.add(lm);
    root.userData.i=i; lm.traverse(o=>{o.userData.i=i;}); pad.traverse(o=>{o.userData.i=i;});
    world.pads.push(pad); world.marks.push({root,lm,base:scales[s.id]}); world.pick.push(root);
    if(LM_OFFSET[s.id]){ const a=padPos(i), b=lmPos(i);
      const pin=new THREE.Group(); pin.position.copy(a); S.add(pin);
      pin.add(mesh(CYL(.045,.05,.03,24),M('#fff7ea',{r:.5}),0,.015,0,false));
      pin.add(mesh(SPH(.03,16,12),M('#ff7a3d',{r:.4,e:'#ff7a3d',ei:.3}),0,.045,0,false));
      const n=Math.max(4,Math.round(a.distanceTo(b)/.06)); for(let k=1;k<n;k++){ const p=a.clone().lerp(b,k/n); pin.add(mesh(SPH(.013,8,6),M('#fff7ea',{r:.5}),p.x-a.x,.02,p.z-a.z,false)); }
      pin.traverse(o=>o.userData.i=i); world.pick.push(pin); }
  });
  // Netherlands start
  const wm=buildWindmill(); wm.scale.setScalar(.35); wm.position.copy(NL_POS); S.add(wm); world.windmill=wm;
  // vehicles
  const van=buildVan(); van.scale.setScalar(.11); van.visible=false; S.add(van); world.van=van;
  const plane=buildPlane(); plane.scale.setScalar(.22); plane.visible=false; S.add(plane); world.plane=plane;
  makeLabels();
}
function legCurve(id, lift=.03){
  const leg=LEGS[id]; const pts=leg.path.map(([la,ln])=>P(la,ln,LAND_TOP+lift));
  const ends={aitbenhaddou:[0,1],dades:[1,2],ergchebbi:[2,3],ouarzazate:[3,4],home:[4,0]}[id];
  const a=padPos(ends[0]), b=padPos(ends[1]); pts[0].set(a.x,LAND_TOP+lift,a.z); pts[pts.length-1].set(b.x,LAND_TOP+lift,b.z);
  return new THREE.CatmullRomCurve3(pts,false,'centripetal');
}

/* labels projected from 3D */
const labelEls=[];
function makeLabels(){
  const box=$('#labels');
  STAYS.forEach((s,i)=>{ const b=document.createElement('button'); b.className='tag3d'; b.innerHTML=`<b>${i+1}</b><span>${s.place}</span>`;
    b.addEventListener('click',e=>{e.stopPropagation(); if(mode==='map'&&!busy) jumpTo(i);}); box.appendChild(b);
    labelEls.push({el:b, get side(){return sideOf(s.id);}, pos:()=>{ const side=sideOf(s.id); const k=world.marks[i]?world.marks[i].root.scale.x:1; const p=lmPos(i);
      if(side==='top'||side==='topleft') p.y+=.62*k; else if(side==='bottom'){ p.z+=.3*k; } else if(side==='right'){ p.x+=.3*k; p.y+=.15*k; } else { p.x-=.3*k; p.y+=.2*k; } return p; }}); });
  [['MAROKKO',32.75,-6.3,'geo land big'],['Hoge Atlas',32.3,-6.0,'geo mtn'],['Spanje',37.7,-4.6,'geo land'],['Algerije',32.6,-1.2,'geo land'],
   ['Atlantische Oceaan',31.6,-11.3,'geo sea'],['Middellandse Zee',36.4,-2.6,'geo sea'],['Sahara',30.05,-4.6,'geo land'],['Nederland',52.9,5.6,'geo land']].forEach(([txt,la,ln,cls])=>{
    const d=document.createElement('div'); d.className=cls; d.textContent=txt; box.appendChild(d); labelEls.push({el:d,pos:()=>P(la,ln,LAND_TOP),geo:true}); });
  const nl=document.createElement('div'); nl.className='tag3d small nl'; nl.innerHTML='<b>✈</b><span>Nederland</span>'; box.appendChild(nl);
  labelEls.push({el:nl,pos:()=>NL_POS.clone().add(new THREE.Vector3(0,.85,0))});
}
const _v=new THREE.Vector3();
function placeLabels(){
  const w=innerWidth,h=innerHeight;
  labelEls.forEach(L=>{ _v.copy(L.pos()).project(camera); const vis=_v.z<1&&Math.abs(_v.x)<1.2&&Math.abs(_v.y)<1.2;
    L.el.style.visibility=vis?'visible':'hidden'; if(!vis) return;
    L.el.style.transform=`translate(${(_v.x*.5+.5)*w}px,${(-_v.y*.5+.5)*h}px) ${L.side==='left'?'translate(-100%,-50%)':L.side==='right'?'translate(0,-50%)':L.side==='topleft'?'translate(-82%,-100%)':L.side==='bottom'?'translate(-50%,0)':L.geo?'translate(-50%,-50%)':'translate(-50%,-100%)'}`; });
}
function refreshLabelState(){
  labelEls.slice(0,5).forEach((L,i)=>{ L.el.classList.toggle('done',state.visited.has(i)); L.el.classList.toggle('here',state.cur===i&&state.started); });
  world.pads.forEach((p,i)=>{ const v=state.visited.has(i); p.ring.material=M(v?'#ffc93c':'#ff7a3d',{r:.4,e:v?'#ffb020':'#ff7a3d',ei:.25}); });
  ['aitbenhaddou','dades','ergchebbi','ouarzazate'].forEach((id,k)=>{ const g=world.legMeshes[id]; if(!g||!g.top) return; const done=state.visited.has(k+1)&&state.visited.has(k);
    g.top.material=M(done?'#ffc93c':'#ff7a3d',{r:.45,e:done?'#ffb020':'#ff5a1a',ei:.15}); });
}

/* camera framing on the board */
function ovr(){
  const asp=innerWidth/innerHeight, portrait=asp<.85;
  const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const pol=portrait?.5:.62;
  const T=portrait?new THREE.Vector3(-.12,0,.05):new THREE.Vector3(.0,0,.1);
  const halfW=portrait?2.65:3.0;            // keep Marrakech → Erg Chebbi on screen
  const D=portrait?clamp(halfW/(tan*asp),9,19):clamp(halfW/(tan*asp)*1.15+1.2,5.5,10);
  const dir=new THREE.Vector3(0, Math.cos(pol), Math.sin(pol));
  return {T, dir, D, pos:T.clone().addScaledVector(dir,D)};
}
function closeView(i, d=1.5){
  const o=ovr(); const T=lmPos(i).add(new THREE.Vector3(0,.22,0)); return {pos:T.clone().addScaledVector(o.dir,d), T};
}
function updateWorld(dt){
  const t=clockT; const fs=innerWidth/innerHeight<.85?1.18:1.05;
  world.marks.forEach(m=>m.root.scale.setScalar(fs));
  world.pads.forEach((p,i)=>{ const s=1+Math.sin(t*3+i)*.08; p.glow.scale.set(s,s,s); p.glow.material.opacity=.45+Math.sin(t*3+i)*.2; });
  world.marks.forEach((m,i)=>{ m.lm.position.y=.04+Math.max(0,Math.sin(t*2.2+i*1.3))*.03; if(m.lm.palms) m.lm.palms.forEach(pp=>pp.crown.rotation.z=Math.sin(t*1.5+i)*.06);
    if(m.lm.camel){ m.lm.camel.head.rotation.z=Math.sin(t*1.4)*.1; } if(m.lm.clap){ m.lm.clap.rotation.z=Math.max(0,Math.sin(t*2.5))*.45; } });
  if(world.windmill) world.windmill.sails.rotation.z-=dt*1.6;
  world.palms.forEach((p,i)=>p.crown.rotation.z=Math.sin(t*1.2+i)*.05);
  world.clouds.forEach((c,i)=>{ c.position.x+=dt*.05*(1+i%3*.3); if(c.position.x>12) c.position.x=-12; });
  // keep the sun's shadow box around the camera target
  world.sun.target.position.copy(camTgt); world.sun.position.copy(camTgt).add(new THREE.Vector3(3,8,4));
  const dist=camera.position.distanceTo(camTgt); const c=world.sun.shadow.camera; const r=clamp(dist*.55,2,9);
  if(Math.abs(c.right-r)>.2){ c.left=-r;c.right=r;c.top=r;c.bottom=-r;c.updateProjectionMatrix(); }
  world.scene.fog.near=dist*1.4; world.scene.fog.far=dist*4.5+10;
}

/* ================================================================
   ICONS (render each landmark to a PNG for the street map + chips)
   ================================================================ */
const ICONS={};
function renderIcons(){
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  r.setSize(256,256); r.setPixelRatio(1); r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.1;
  const S=new THREE.Scene(); S.environment=ENV; S.environmentIntensity=.3; S.add(new THREE.HemisphereLight('#fff0d6','#c78a5a',1.6));
  const d=new THREE.DirectionalLight('#fff1d8',3.2); d.position.set(3,6,5); S.add(d);
  const cam=new THREE.PerspectiveCamera(30,1,.1,100);
  const builders={marrakech:buildKoutoubia, aitbenhaddou:buildKsar, dades:buildDades, ergchebbi:buildErg, ouarzazate:buildOuarz};
  STAYS.forEach(s=>{ const g=builders[s.id](); S.add(g);
    const box=new THREE.Box3().setFromObject(g); const c=box.getCenter(new THREE.Vector3()); const sz=box.getSize(new THREE.Vector3()); const m=Math.max(sz.x,sz.y,sz.z);
    cam.position.set(c.x+m*1.15, c.y+m*.75, c.z+m*1.75); cam.lookAt(c); r.render(S,cam); ICONS[s.id]=r.domElement.toDataURL('image/png'); S.remove(g); });
  const v=buildVan(); S.add(v); cam.position.set(3.5,2.6,5.2); cam.lookAt(0,.9,0); r.render(S,cam); ICONS.van=r.domElement.toDataURL('image/png');
  r.dispose(); r.forceContextLoss?.();
}

/* ================================================================
   STATE / FLOW
   ================================================================ */
let mode='pick', busy=false, clockT=0, SPEED=1, player=null;
const state={ started:false, cur:0, visited:new Set() };
let activeScene=pick.scene;

function iris(shut){ return new Promise(r=>{ const el=$('#iris'); el.classList.toggle('shut',shut); setTimeout(r,580); }); }
function showHud(on){ $('#hud').hidden=!on; $('#labels').hidden=!on; }
function banner(small,big,sub){ const b=$('#banner'); if(!small){b.hidden=true;return;} b.querySelector('small').textContent=small; b.querySelector('b').textContent=big; b.querySelector('span').textContent=sub||''; b.hidden=false; b.style.animation='none'; void b.offsetWidth; b.style.animation=''; }
function setStartLabel(){ $('#start span').textContent = state.started ? 'VERDER' : 'START'; $('#hint').textContent = state.started ? `Ga verder in ${STAYS[state.cur].place}, of tik op een bestemming` : 'Tik op een bestemming, of…'; }

async function goMapFromIntro(){
  if(busy) return; busy=true; state.introDone=true; refreshPlayer();
  $('#skip').classList.remove('on');
  await iris(true);
  $('#intro').hidden=true; mode='map'; activeScene=world.scene;
  const o=ovr(); camera.position.copy(o.T.clone().addScaledVector(o.dir,o.D*1.9)).add(new THREE.Vector3(0,2,0)); camTgt.copy(o.T); look();
  refreshLabelState(); setStartLabel();
  await iris(false);
  showHud(true);
  await camTo(o.pos,o.T,2.0,0,E.out);
  busy=false;
}
async function backToMap(fromLoc=true){
  busy=true; await iris(true);
  $('#loc').hidden=true; $('#card').hidden=true; mode='map'; activeScene=world.scene;
  const c=closeView(state.cur,2.0); camera.position.copy(c.pos); camTgt.copy(c.T); look();
  world.van.visible=false; refreshLabelState(); setStartLabel();
  await iris(false); showHud(true);
  const o=ovr(); await camTo(o.pos,o.T,1.6,.6);
  busy=false;
}

/* ---------- player choice ---------- */
function refreshPlayer(){ if(!player) return; const b=$('#player'); b.querySelector('img').src=PORTRAITS[player.id]; b.querySelector('span').textContent=player.name; b.style.setProperty('--c',shade(player.robe,.32)); }
function choosePlayer(id){
  player=CHARACTERS.find(c=>c.id===id)||CHARACTERS[0]; try{ localStorage.setItem('mb_player',player.id); }catch(_){}
  document.querySelectorAll('.pick-card').forEach(el=>el.classList.toggle('on',el.dataset.id===player.id));
  const n=$('#pickName'); n.textContent=player.name; n.style.animation='none'; void n.offsetWidth; n.style.animation='';
  $('#pickRobe').innerHTML=`<i style="background:${player.robe}"></i>${player.robeName||'Djellaba'}`;
  $('#pickGo span').textContent=`SPEEL ALS ${player.name.toUpperCase()}`;
  setPickModel(player);
}
function buildPicker(){
  const g=$('#pickGrid'); g.classList.toggle('many',CHARACTERS.length>8);
  g.innerHTML=CHARACTERS.map(c=>`<button class="pick-card" data-id="${c.id}" style="--c:${shade(c.robe,.3)}"><i class="av"><img src="${PORTRAITS[c.id]}" alt=""></i><span>${c.name}</span></button>`).join('');
  g.querySelectorAll('.pick-card').forEach(b=>b.addEventListener('click',()=>choosePlayer(b.dataset.id)));
  let saved=null; try{ saved=localStorage.getItem('mb_player'); }catch(_){}
  choosePlayer(saved||CHARACTERS[0].id);
}
async function startFromPick(){
  if(busy||mode!=='pick') return; busy=true;
  await iris(true); $('#pick').hidden=true; refreshPlayer();
  intro.charSlot.clear(); intro.charModel=buildCharacter(player); intro.charSlot.add(intro.charModel);
  if(!state.introDone){ mode='intro'; activeScene=intro.scene; intro.t=0; $('#intro').hidden=false; busy=false; await iris(false); return; }
  mode='map'; activeScene=world.scene; refreshLabelState(); setStartLabel();
  const o=ovr(); camera.position.copy(o.pos); camTgt.copy(o.T); look();
  await iris(false); showHud(true); busy=false;
}
async function backToPick(){
  if(busy||mode!=='map') return; busy=true; await iris(true);
  showHud(false); mode='pick'; activeScene=pick.scene; $('#pick').hidden=false; setPickModel(player);
  await iris(false); busy=false;
}

/* start: fly from the Netherlands */
async function startJourney(){
  if(busy) return; busy=true; showHud(false); $('#labels').hidden=false;
  state.started=true; state.cur=0; refreshLabelState();
  const o=ovr();
  // go to the Netherlands
  const nlView=NL_POS.clone().addScaledVector(o.dir,3.2).add(new THREE.Vector3(0,.6,0));
  await camTo(nlView, NL_POS.clone().add(new THREE.Vector3(0,.3,0)), 2.2, 6);
  banner('Dag 1 · Vlucht','Amsterdam → Marrakech','±3,5 uur vliegen');
  await flight(NL_POS, lmPos(0), true);
  banner();
  await arrive(0);
}
async function flight(from, to, landing){
  const pl=world.plane; pl.visible=true;
  const a=from.clone().add(new THREE.Vector3(landing?.35:.3,.12,.25)), b=to.clone().add(new THREE.Vector3(landing?.32:.32,.12,landing?.3:.3));
  const dir=b.clone().sub(a); const L=dir.length();
  const c1=a.clone().addScaledVector(dir,.18).add(new THREE.Vector3(0,L*.12+1.2,0));
  const c2=a.clone().addScaledVector(dir,.82).add(new THREE.Vector3(0,L*.12+1.2,0));
  const curve=new THREE.CubicBezierCurve3(a,c1,c2,b);
  const o=ovr(); const off=o.dir.clone().multiplyScalar(4.2).add(new THREE.Vector3(0,1.2,0));
  const camStart=camera.position.clone(), tgtStart=camTgt.clone();
  const tmp=new THREE.Vector3(), tan=new THREE.Vector3(), q=new THREE.Quaternion(), m4=new THREE.Matrix4();
  await tween(7.2, (k)=>{
    curve.getPointAt(k,tmp); curve.getTangentAt(Math.min(k,.999),tan);
    pl.position.copy(tmp);
    m4.lookAt(new THREE.Vector3(),tan,new THREE.Vector3(0,1,0)); q.setFromRotationMatrix(m4); pl.quaternion.copy(q); pl.rotateY(-Math.PI/2);
    pl.rotateX(Math.sin(k*Math.PI*2)*.18);
    const lift=Math.sin(k*Math.PI)*4.5;
    const want=tmp.clone().add(off).addScaledVector(o.dir,lift).add(new THREE.Vector3(0,lift*.5,0));
    const blend=E.out(clamp(k*4,0,1));
    camera.position.lerpVectors(camStart,want,blend); camTgt.lerpVectors(tgtStart,tmp,blend); look();
  }, E.sine);
}
async function arrive(i){
  // dive to the landmark, then open the street map
  state.cur=i; refreshLabelState();
  const c=closeView(i,2.0); await camTo(c.pos,c.T,1.4,.3);
  confetti(40);
  await wait(350);
  await openLoc(i);
  busy=false;
}
async function jumpTo(i){
  if(busy) return; busy=true; showHud(false); $('#labels').hidden=false;
  state.started=true; state.cur=i; refreshLabelState();
  world.plane.visible=false;
  const c=closeView(i,2.0); await camTo(c.pos,c.T,1.6,.8);
  await openLoc(i); busy=false;
}

/* drive the van to the next stay */
async function driveNext(){
  if(busy) return; busy=true;
  const from=state.cur; const last=from===STAYS.length-1; const to=last?0:from+1;
  const legId=last?'home':STAYS[to].id; const leg=LEGS[legId];
  await iris(true);
  $('#loc').hidden=true; $('#card').hidden=true; mode='map'; activeScene=world.scene; $('#labels').hidden=false; world.plane.visible=false;
  const c=closeView(from,2.6); camera.position.copy(c.pos); camTgt.copy(c.T); look();
  await iris(false);
  banner(last?'Laatste rit':`Rit naar level ${to+1}`, leg.title, leg.meta);
  const curve=legCurve(legId,.0);
  const van=world.van; van.visible=true;
  const L=curve.getLength(); const dur=clamp(L*1.5,3.6,7.5);
  const o=ovr(); const tmp=new THREE.Vector3(), tan=new THREE.Vector3(), ahead=new THREE.Vector3();
  const camStart=camera.position.clone(), tgtStart=camTgt.clone();
  await tween(dur,(k)=>{
    curve.getPointAt(k,tmp); curve.getTangentAt(Math.min(k,.999),tan);
    van.position.copy(tmp); van.position.y=LAND_TOP+.005+Math.abs(Math.sin(k*120))*.006;
    van.rotation.set(0,Math.atan2(-tan.z,tan.x),0);
    van.wheels.forEach(w=>w.rotation.z-=.35);
    curve.getPointAt(Math.min(1,k+.04),ahead);
    const want=tmp.clone().addScaledVector(o.dir,3.1).add(new THREE.Vector3(0,.35,0));
    const blend=E.out(clamp(k*5,0,1));
    camera.position.lerpVectors(camStart,want,blend); camTgt.lerpVectors(tgtStart,ahead,blend); look();
  }, E.inOut);
  banner();
  state.visited.add(from); refreshLabelState();
  if(last){ await homeFlight(); return; }
  van.visible=false;
  await arrive(to);
}
async function homeFlight(){
  world.van.visible=false;
  banner('Dag 8 · Vlucht','Marrakech → Amsterdam','Tot de volgende keer, Marokko!');
  await flight(lmPos(0), NL_POS, false);
  banner(); confetti(120); $('#endTitle').textContent=`Reis voltooid, ${player.name}!`;
  $('#end').hidden=false; busy=false; mode='end';
}

/* ================================================================
   LOCATION VIEW (street map, only the stay)
   ================================================================ */
let lmap=null, lmarker=null, mapReady=null;
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function loadCss(href){ const l=document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); }
function ensureMap(){
  if(mapReady) return mapReady;
  mapReady=(async()=>{
    loadCss('lib/maplibre.css');
    await loadScript('maplibre-gl.js');
    const BASE=new URL('map/',document.baseURI).href;
    let INDEX=null; const BUNDLES={};
    const getIndex=()=>INDEX||(INDEX=fetch(BASE+'index.json').then(r=>r.json()));
    const b64=t=>{const bin=atob(t.trim());const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer;};
    const getBundle=n=>BUNDLES[n]||(BUNDLES[n]=fetch(BASE+n).then(r=>{if(!r.ok)throw new Error(n);return r.text();}).then(b64));
    let FD=null; const getFonts=()=>FD||(FD=fetch(BASE+'fonts.json').then(r=>r.json()));
    const FONTS={'Noto Sans Regular':'regular','Noto Sans Bold':'bold','Noto Sans Italic':'italic'};
    const RANGES=new Set(['0-255','256-511','512-767','768-1023','7680-7935','8192-8447']);
    const EMPTY=()=>({data:new ArrayBuffer(0)});
    maplibregl.addProtocol('mb',async params=>{
      const u=params.url.replace(/^mb:\/\//,'');
      if(u.startsWith('t/')){const idx=await getIndex();const e=idx[u.slice(2)];if(!e)return EMPTY();try{const buf=await getBundle(e[0]);return {data:buf.slice(e[1],e[1]+e[2])};}catch(_){return EMPTY();}}
      if(u.startsWith('g/')){const parts=decodeURIComponent(u.slice(2)).split('/');const range=parts.pop().replace('.pbf','');const f=FONTS[parts.join('/').split(',')[0].trim()];if(!f||!RANGES.has(range))return EMPTY();const fd=await getFonts();const t=fd[`${f}-${range}`];return t?{data:b64(t)}:EMPTY();}
      return EMPTY();
    });
    const style=await (await fetch(BASE+'style-light.json')).json();
    style.sprite=BASE+'liberty';
    style.layers=style.layers.filter(l=>!['poi','aerodrome_label'].includes(l['source-layer']));
    for(const l of style.layers){ if(l.type==='background') l.paint={'background-color':'#f2dcb0'};
      if(l.id&&/water/.test(l.id)&&l.type==='fill') l.paint={...l.paint,'fill-color':'#7fd3ea'}; }
    const s=STAYS[0];
    lmap=new maplibregl.Map({container:'locmap',style,center:[s.lng,s.lat],zoom:14,pitch:45,bearing:-15,maxZoom:17.5,minZoom:9,attributionControl:false,maxPitch:65});
    lmap.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    lmap.once('idle',()=>document.querySelectorAll('#locmap .maplibregl-ctrl-attrib').forEach(a=>a.classList.remove('maplibregl-compact-show')));
    const el=document.createElement('div'); el.className='lm';
    el.innerHTML='<i class="lm-sh"></i><div class="lm-in"><div class="lm-row"><img class="lm-char" alt=""><img class="lm-ico" alt=""></div><span></span></div><div class="lm-hint">Tik op je slaapplek</div>';
    el.addEventListener('click',e=>{e.stopPropagation(); openCard(state.cur);});
    lmarker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([s.lng,s.lat]).addTo(lmap);
    await new Promise(r=>lmap.loaded()?r():lmap.once('load',r));
  })();
  return mapReady;
}
async function openLoc(i){
  const s=STAYS[i];
  await iris(true);
  showHud(false); $('#loc').hidden=false; mode='loc';
  await ensureMap();
  lmap.resize();
  lmap.jumpTo({center:[s.lng,s.lat],zoom:13.2,pitch:20,bearing:10});
  lmarker.setLngLat([s.lng,s.lat]);
  const el=lmarker.getElement(); el.querySelector('.lm-ico').src=ICONS[s.id]; el.querySelector('.lm-char').src=PORTRAITS[player.id+':full']; el.querySelector('span').textContent=s.stay;
  const hint=el.querySelector('.lm-hint'); hint.hidden=state.visited.has(i)||state.seenCard?.has(i); hint.style.animation='none'; void hint.offsetWidth; hint.style.animation='';
  const chip=$('#chip'); chip.querySelector('img').src=ICONS[s.id]; chip.querySelector('small').textContent=`Level ${i+1} van 5 · ${s.nights}`; chip.querySelector('b').textContent=s.place;
  const last=i===STAYS.length-1;
  $('#next span').textContent=last?'Op naar huis':'Op naar de volgende locatie';
  $('#next small').textContent=last?'→ Marrakech ✈ Nederland':`→ ${STAYS[i+1].place}`;
  $('#explore').dataset.url=`https://www.google.com/maps/@?api=1&map_action=map&center=${s.lat},${s.lng}&zoom=15`;
  await iris(false);
  lmap.flyTo({center:[s.lng,s.lat],zoom:s.z||16.2,pitch:58,bearing:-22,duration:2600,essential:true,curve:1.2});
}
function openCard(i){
  const s=STAYS[i]; (state.seenCard||(state.seenCard=new Set())).add(i);
  lmarker.getElement().querySelector('.lm-hint').hidden=true;
  $('#gal').innerHTML=s.photos.map(k=>`<img src="${IMG(k)}" alt="${s.stay}" draggable="false">`).join('');
  $('#dots').innerHTML=s.photos.length>1?s.photos.map((_,j)=>`<i class="${j?'':'on'}"></i>`).join(''):'';
  $('#credit').textContent=s.credit||'';
  $('#cardBody').innerHTML=`<p class="kick">Level ${i+1} · ${s.place}</p><h2>${s.stay}</h2>
    <div class="pills"><span>🌙 ${s.nights}</span><span>🛏 ${s.n} ${s.n>1?'nachten':'nacht'}</span></div>
    <p>${s.blurb}</p>
    <div class="box"><b>Beste moment</b><p>${s.when}</p></div>
    <div class="box"><b>Tip</b><p>${s.tip}</p></div>`;
  const gal=$('#gal'); gal.scrollLeft=0; gal.onscroll=()=>{ const j=Math.round(gal.scrollLeft/gal.clientWidth); [...$('#dots').children].forEach((d,k)=>d.classList.toggle('on',k===j)); };
  $('#card').hidden=false; $('#card .card-in').scrollTop=0;
}

/* ================================================================
   CONFETTI
   ================================================================ */
function confetti(n=60){
  const box=$('#confetti'); const cs=['#ffc93c','#ff7a4d','#2cc3ae','#ff5d8f','#ffffff','#3b7dd8'];
  for(let i=0;i<n;i++){ const c=document.createElement('i'); c.style.left=Math.random()*100+'vw'; c.style.background=cs[i%cs.length];
    c.style.setProperty('--dx',(Math.random()*160-80)+'px'); c.style.setProperty('--r',(Math.random()*900-450)+'deg');
    c.style.animationDuration=(1.6+Math.random()*1.6)+'s'; c.style.animationDelay=(Math.random()*.4)+'s'; box.appendChild(c); setTimeout(()=>c.remove(),3800); }
}

/* ================================================================
   MAP INTERACTION (pan / pinch / tap on the board)
   ================================================================ */
const ray=new THREE.Raycaster(), ptr=new THREE.Vector2();
let drag=null; const touches=new Map();
canvas.addEventListener('pointerdown',e=>{ if(mode==='intro'){ return; } if(mode!=='map'||busy) return;
  canvas.setPointerCapture(e.pointerId); touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===1) drag={x:e.clientX,y:e.clientY,moved:0,t:performance.now()}; else drag=null;
});
canvas.addEventListener('pointermove',e=>{ if(mode!=='map'||busy||!touches.has(e.pointerId)) return;
  const prev=touches.get(e.pointerId); const cur={x:e.clientX,y:e.clientY};
  if(touches.size===2){ const pts=[...touches.entries()]; const other=pts.find(([id])=>id!==e.pointerId)[1];
    const d0=Math.hypot(prev.x-other.x,prev.y-other.y), d1=Math.hypot(cur.x-other.x,cur.y-other.y); if(d0>0) zoomBy(d0/d1); }
  else if(drag){ panBy(cur.x-prev.x, cur.y-prev.y); drag.moved+=Math.abs(cur.x-prev.x)+Math.abs(cur.y-prev.y); }
  touches.set(e.pointerId,cur);
});
const endPtr=e=>{ if(!touches.has(e.pointerId)) return; touches.delete(e.pointerId);
  if(mode==='map'&&!busy&&drag&&drag.moved<8&&touches.size===0){ tapAt(e.clientX,e.clientY); } if(touches.size===0) drag=null; };
canvas.addEventListener('pointerup',endPtr); canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{ if(mode!=='map'||busy) return; e.preventDefault(); zoomBy(Math.exp(e.deltaY*.0012)); },{passive:false});
function panBy(dx,dy){
  const dist=camera.position.distanceTo(camTgt); const s=dist*.0016*(900/innerHeight);
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0); right.y=0; right.normalize();
  const fwd=new THREE.Vector3().subVectors(camTgt,camera.position); fwd.y=0; fwd.normalize();
  const mv=right.multiplyScalar(-dx*s).addScaledVector(fwd,dy*s);
  const nt=camTgt.clone().add(mv); nt.x=clamp(nt.x,-5,5); nt.z=clamp(nt.z,-4,3.5); mv.subVectors(nt,camTgt);
  camTgt.add(mv); camera.position.add(mv); look();
}
function zoomBy(f){
  const off=camera.position.clone().sub(camTgt); const d=clamp(off.length()*f,2.2,14); off.setLength(d); camera.position.copy(camTgt).add(off); look();
}
function tapAt(x,y){
  ptr.set(x/innerWidth*2-1, -(y/innerHeight)*2+1); ray.setFromCamera(ptr,camera);
  const hit=ray.intersectObjects(world.pick,true)[0]; if(hit&&hit.object.userData.i!=null) jumpTo(hit.object.userData.i);
}

/* ================================================================
   BUTTONS
   ================================================================ */
$('#intro').addEventListener('click',()=>{ if(mode==='intro'&&intro.t>.6) goMapFromIntro(); });
$('#pickGo').addEventListener('click',startFromPick);
$('#player').addEventListener('click',backToPick);
$('#start').addEventListener('click',()=>{ if(mode!=='map'||busy) return; if(!state.started) startJourney(); else jumpTo(state.cur); });
$('#toMap').addEventListener('click',()=>{ if(mode==='loc'&&!busy) backToMap(); });
$('#next').addEventListener('click',()=>{ if(mode==='loc'&&!busy) driveNext(); });
$('#explore').addEventListener('click',()=>{ const u=$('#explore').dataset.url; if(u) window.open(u,'_blank','noopener'); });
$('#cardX').addEventListener('click',()=>{ $('#card').hidden=true; });
$('#card').addEventListener('click',e=>{ if(e.target.id==='card') $('#card').hidden=true; });
$('#again').addEventListener('click',async()=>{ $('#end').hidden=true; state.visited.clear(); state.started=false; state.cur=0; world.plane.visible=false; mode='map'; busy=true; refreshLabelState(); setStartLabel(); showHud(true); const o=ovr(); await camTo(o.pos,o.T,2.2,1.5); busy=false; });
$('#endMap').addEventListener('click',async()=>{ $('#end').hidden=true; mode='map'; busy=true; world.plane.visible=false; showHud(true); setStartLabel(); const o=ovr(); await camTo(o.pos,o.T,2.2,1.5); busy=false; });

/* ================================================================
   LOOP
   ================================================================ */
function resize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();
let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000)*SPEED; last=now; clockT+=dt;
  stepTweens(dt);
  if(mode==='pick') updatePick(dt);
  else if(mode==='intro') updateIntro(dt);
  else if(world.sun) updateWorld(dt);
  if(mode!=='loc'){ renderer.render(activeScene,camera); if(mode==='map'||mode==='end') placeLabels(); }
  requestAnimationFrame(frame);
}

/* letters of the logo */
document.querySelectorAll('.logo [data-word]').forEach((el,wi)=>{ el.innerHTML=[...el.dataset.word].map((c,i)=>`<span class="ch" style="animation-delay:${(wi*5+i)*.07}s,${(wi*5+i)*.07+.8}s">${c}</span>`).join(''); });

window.__mb={intro,world,state,pick,get mode(){return mode},get busy(){return busy},set speed(v){SPEED=v},camera,camTgt};
(async function boot(){
  try{ await document.fonts.load('40px "Lilita One"'); }catch(_){}
  await buildWorld();
  renderIcons(); renderPortraits(); buildPicker();
  renderer.compile(pick.scene,camera); renderer.compile(intro.scene,camera); renderer.compile(world.scene,camera);
  $('#loading').classList.add('off'); setTimeout(()=>$('#loading').remove(),500);
  requestAnimationFrame(t=>{last=t;frame(t);});
  ensureMap().catch(()=>{});
  if('serviceWorker' in navigator && location.hostname.endsWith('github.io')) navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
