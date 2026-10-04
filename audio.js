/* MAROC BRIDGES — sound: a light looping Moroccan game tune, click accents, and "yallah yallah" */
const AC = window.AudioContext || window.webkitAudioContext;
let ctx=null, master=null, musicBus=null, sfxBus=null, started=false, timer=null;
let muted = false; try{ muted = localStorage.getItem('mb_muted')==='1'; }catch(_){}
const listeners=new Set();

/* D Hijaz: D Eb F# G A Bb C */
const f = (semi, oct=4) => 293.66 * Math.pow(2, (semi + (oct-4)*12)/12);
const H = {D:0, Eb:1, Fs:4, G:5, A:7, Bb:8, C:10};
const BPM = 96, STEP = 60/BPM/4;                // 16th notes
/* 4-bar melody (64 steps); null = rest; [note, octave, length] */
const MEL = [
 ['A',4,2],null,['Bb',4,1],['A',4,1], ['G',4,2],null,['Fs',4,2],null, ['G',4,1],['A',4,1],['Bb',4,2],null,['A',4,4],null,null,null,
 ['D',5,2],null,['C',5,1],['Bb',4,1], ['A',4,2],null,['G',4,2],null, ['Fs',4,1],['G',4,1],['A',4,2],null,['D',4,4],null,null,null,
 ['A',4,2],null,['Bb',4,1],['C',5,1], ['D',5,2],null,['C',5,1],['Bb',4,1], ['A',4,2],null,['G',4,1],['Fs',4,1],['G',4,4],null,null,null,
 ['Fs',4,1],['G',4,1],['A',4,1],['Bb',4,1], ['A',4,2],null,['G',4,2],null, ['Fs',4,2],null,['Eb',4,2],null,['D',4,4],null,null,null ];
/* darbuka: D = doum (low), T = tek (high), k = soft ka */
const DRUM = 'D..kT.k.D.D.T.k.';
const BASS = [['D',2],['D',2],['G',2],['D',2]];

function ensure(){
  if(ctx) return ctx;
  if(!AC) return null;
  ctx = new AC();
  ctx.onstatechange=()=>{ if(ctx.state!=='running'&&started&&!document.hidden) ctx.resume().catch(()=>{}); };
  master = ctx.createGain(); master.gain.value = muted?0:1; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3; comp.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = .16; musicBus.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = .5; sfxBus.connect(comp);
  // a touch of room
  const delay = ctx.createDelay(); delay.delayTime.value = STEP*3; const fb = ctx.createGain(); fb.gain.value=.22; const wet=ctx.createGain(); wet.gain.value=.25;
  musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
  return ctx;
}
function pluck(freq, t, dur=.35, vol=.6, bus=musicBus, bright=2400){
  const o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain(), lp=ctx.createBiquadFilter();
  o.type='triangle'; o2.type='sawtooth'; o.frequency.value=freq; o2.frequency.value=freq*1.003;
  const g2=ctx.createGain(); g2.gain.value=.18;
  lp.type='lowpass'; lp.frequency.setValueAtTime(bright,t); lp.frequency.exponentialRampToValueAtTime(500,t+dur);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.006); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(bus);
  o.start(t); o2.start(t); o.stop(t+dur+.05); o2.stop(t+dur+.05);
}
function bass(freq,t,dur){ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=freq;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.55,t+.02); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t+dur+.05); }
let NOISE=null;
function noise(){ if(NOISE) return NOISE; const b=ctx.createBuffer(1,ctx.sampleRate*.3,ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return NOISE=b; }
function drum(kind,t){
  if(kind==='D'){ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(60,t+.15);
    g.gain.setValueAtTime(.9,t); g.gain.exponentialRampToValueAtTime(.001,t+.22); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t+.25); return; }
  const s=ctx.createBufferSource(); s.buffer=noise(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=kind==='T'?3200:2200; bp.Q.value=kind==='T'?2:1.4;
  const g=ctx.createGain(); const v=kind==='T'?.5:.22; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+(kind==='T'?.07:.05));
  s.connect(bp); bp.connect(g); g.connect(musicBus); s.start(t); s.stop(t+.1);
}
let step=0, nextT=0;
function schedule(){
  while(nextT < ctx.currentTime + .25){
    const s=step%64, bar=Math.floor(s/16);
    const m=MEL[s]; if(m) pluck(f(H[m[0]],m[1]), nextT, Math.max(.25,m[2]*STEP*1.6), .5);
    const dch=DRUM[s%16]; if(dch!=='.') drum(dch,nextT);
    if(s%16===0){ const b=BASS[bar]; bass(f(H[b[0]],b[1]), nextT, STEP*14); }
    if(s%16===8){ const b=BASS[bar]; bass(f(H[b[0]],b[1]+1)*1, nextT, STEP*6); }
    nextT += STEP*(s%2?0.94:1.06);               // a little swing
    step++;
  }
}
/* iPhone: let sound play even with the silent switch on, and unlock audio inside a real tap */
let unlocked=false, silentEl=null;
function unlock(){
  if(!ensure()) return;
  try{ if(navigator.audioSession) navigator.audioSession.type='playback'; }catch(_){}
  if(ctx.state!=='running') ctx.resume().catch(()=>{});
  if(silentEl&&silentEl.paused&&!muted) silentEl.play().catch(()=>{});
  if(unlocked) return; unlocked=true; loadYallah();
  try{ const b=ctx.createBuffer(1,1,22050), s=ctx.createBufferSource(); s.buffer=b; s.connect(ctx.destination); s.start(0); }catch(_){}
  try{ // a silent looping media element switches iOS to the "playback" audio session (ignores the mute switch)
    silentEl=document.createElement('audio'); silentEl.setAttribute('x-webkit-airplay','deny'); silentEl.loop=true; silentEl.preload='auto';
    silentEl.src='data/silence.mp3';
    silentEl.volume=0.01; const p=silentEl.play(); if(p&&p.catch) p.catch(()=>{});
  }catch(_){}
}
function startMusic(){
  if(!ensure()) return;
  unlock();
  if(started) return; started=true; nextT=ctx.currentTime+.08; step=0;
  timer=setInterval(schedule, 60); schedule();
}
/* SFX */
function sfx(name){
  if(!ensure()||muted) return; unlock();
  const t=ctx.currentTime+.01;
  if(name==='tap'){ pluck(f(H.A,5),t,.18,.5,sfxBus,4000); pluck(f(H.D,6),t+.05,.22,.4,sfxBus,4000); }
  else if(name==='pick'){ pluck(f(H.D,5),t,.2,.5,sfxBus,4200); pluck(f(H.Fs,5),t+.06,.2,.45,sfxBus,4200); pluck(f(H.A,5),t+.12,.3,.45,sfxBus,4200); }
  else if(name==='start'){ [H.D,H.Fs,H.A,H.D+12].forEach((n,i)=>pluck(f(n,5),t+i*.08,.35,.5,sfxBus,4500)); }
  else if(name==='arrive'){ [H.D,H.A,H.D+12,H.Fs+12].forEach((n,i)=>pluck(f(n,5),t+i*.1,.5,.5,sfxBus,4500)); drum('D',t); drum('T',t+.2); drum('D',t+.3); }
  else if(name==='open'){ pluck(f(H.G,5),t,.25,.45,sfxBus,3800); pluck(f(H.Bb,5),t+.07,.3,.4,sfxBus,3800); }
  else if(name==='close'){ pluck(f(H.Bb,5),t,.2,.4,sfxBus,3500); pluck(f(H.G,5),t+.06,.25,.35,sfxBus,3500); }
  else if(name==='win'){ [0,4,7,12,16,19,24].forEach((n,i)=>pluck(f(H.D+n,4),t+i*.09,.6,.5,sfxBus,5000)); [0,.18,.36,.54].forEach(d=>drum(d%.36?'T':'D',t+d)); }
}
/* "yallah yallah": played through the same audio engine as the music, so it never steals the phone's audio */
let yBuf=null, yLoading=null;
function loadYallah(){ if(yBuf||yLoading||!ensure()) return yLoading; yLoading=fetch('data/yalla.mp3').then(r=>r.arrayBuffer()).then(b=>new Promise((res,rej)=>ctx.decodeAudioData(b,res,rej))).then(buf=>yBuf=buf).catch(()=>null); return yLoading; }
async function yallah(){
  if(muted||!ensure()) return; unlock();
  await loadYallah(); if(!yBuf) return;
  const s=ctx.createBufferSource(); s.buffer=yBuf; const g=ctx.createGain(); g.gain.value=1.6; s.connect(g); g.connect(sfxBus); s.start(ctx.currentTime+.02); duck(yBuf.duration+.2);
}
function duck(sec){ if(!musicBus) return; const t=ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(.05,t,.05); musicBus.gain.setTargetAtTime(.16,t+sec,.3); }
function setMuted(m){
  muted=m; try{ localStorage.setItem('mb_muted',m?'1':'0'); }catch(_){}
  if(master) master.gain.setTargetAtTime(m?0:1, ctx.currentTime, .05);
  if(!m) startMusic();
  listeners.forEach(fn=>fn(m));
}
document.addEventListener('visibilitychange',()=>{ if(!ctx) return; if(document.hidden){ ctx.suspend(); if(silentEl) silentEl.pause(); } else if(started){ ctx.resume(); if(silentEl&&!muted) silentEl.play().catch(()=>{}); } });
export const Sound = { get state(){return ctx?ctx.state:'none'}, get playing(){return started}, unlock, startMusic, sfx, yallah, setMuted, get muted(){return muted}, onChange:fn=>listeners.add(fn) };
