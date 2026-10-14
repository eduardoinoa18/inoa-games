<script>
(() => {
'use strict';
/* =========================================================
   Core helpers
   ========================================================= */
const TS = 32;
const $ = id => document.getElementById(id);
const cv = $('game');
const ctx = cv.getContext('2d', { alpha: false });
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const TAU = Math.PI * 2;
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const FD = '"Unbounded", "Manrope", system-ui, sans-serif', FB = '"Manrope", system-ui, sans-serif', FP = '"Press Start 2P", ui-monospace, monospace';
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function rr(c, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  c.moveTo(x + tl, y); c.lineTo(x + w - tr, y); if (tr) c.arcTo(x + w, y, x + w, y + tr, tr); else c.lineTo(x + w, y);
  c.lineTo(x + w, y + h - br); if (br) c.arcTo(x + w, y + h, x + w - br, y + h, br); else c.lineTo(x + w, y + h);
  c.lineTo(x + bl, y + h); if (bl) c.arcTo(x, y + h, x, y + h - bl, bl); else c.lineTo(x, y + h);
  c.lineTo(x, y + tl); if (tl) c.arcTo(x, y, x + tl, y, tl); else c.lineTo(x, y);
  c.closePath();
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const glowCache = new Map();
function glowSprite(col) {
  let s = glowCache.get(col); if (s) return s;
  s = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), c = hexRgb(col);
  gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); gr.addColorStop(.3, `rgba(${c[0]},${c[1]},${c[2]},.45)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowCache.set(col, s); return s;
}
function glow(c, x, y, r, col, a) {
  if (a <= 0.01 || r <= 0) return;
  const pc = c.globalCompositeOperation, pa = c.globalAlpha;
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, a);
  c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
  c.globalCompositeOperation = pc; c.globalAlpha = pa;
}

/* =========================================================
   Settings & save
   ========================================================= */
const reduceOS = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = { sfx: 80, music: 60, diff: 0, btn: 68, haptics: 1, motion: reduceOS ? 0 : 1, quality: 'auto', fps: 0, touch: 'auto', depth: 1, stocks: 3, hazards: 1, heroes: [0, 1, 2, 3] };
const progress = { levels: {}, matches: 0 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('pixelpact3.settings') || '{}')); } catch (e) {}
try { Object.assign(progress, JSON.parse(localStorage.getItem('pixelpact3.progress') || '{}')); } catch (e) {}
settings.diff = clamp(settings.diff | 0, 0, 2); if (!Array.isArray(settings.heroes) || settings.heroes.length !== 4) settings.heroes = [0, 1, 2, 3];
const saveSettings = () => { try { localStorage.setItem('pixelpact3.settings', JSON.stringify(settings)); } catch (e) {} };
const saveProgress = () => { try { localStorage.setItem('pixelpact3.progress', JSON.stringify(progress)); } catch (e) {} };
const DIFF = [{ hp: .75, dmg: .6, bot: .45, name: 'Friendly', lives: 99 }, { hp: 1, dmg: 1, bot: .7, name: 'Normal', lives: 3 }, { hp: 1.35, dmg: 1.5, bot: 1, name: 'Brutal', lives: 3 }];
const motionOK = () => settings.motion === 1;
function buzz(ms) { if (!settings.haptics) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

/* =========================================================
   Audio: synth SFX + layered music sequencer
   ========================================================= */
const Sound = (() => {
  let ac = null, master, sfxBus, musBus, verbIn, noiseBuf, song = null, step = 0, nextT = 0;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.connect(ac.destination);
      master = ac.createGain(); master.gain.value = .9; master.connect(comp);
      sfxBus = ac.createGain(); sfxBus.connect(master); musBus = ac.createGain(); musBus.connect(master);
      const verb = ac.createConvolver(), len = (ac.sampleRate * 2.2) | 0, ib = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ib.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      verb.buffer = ib; verbIn = ac.createGain(); verbIn.gain.value = .3; verbIn.connect(verb);
      const vOut = ac.createGain(); vOut.gain.value = .5; verb.connect(vOut); vOut.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      vol(); nextT = ac.currentTime + .1;
    } catch (e) { ac = null; }
  }
  function vol() { if (!ac) return; sfxBus.gain.value = settings.sfx / 100 * .6; musBus.gain.value = settings.music / 100 * .42; }
  function tone(f0, f1, dur, type, v, delay, o) {
    if (!ac) return; o = o || {}; const t = ac.currentTime + (delay || 0);
    const os = ac.createOscillator(), g = ac.createGain(); os.type = type || 'square';
    os.frequency.setValueAtTime(f0, t); if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, v || .2), t + (o.a || .005)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let n = os; if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); n = f; }
    n.connect(g); g.connect(o.bus || sfxBus); if (o.verb) g.connect(verbIn); os.start(t); os.stop(t + dur + .05);
  }
  function noise(dur, v, type, freq, delay, o) {
    if (!ac) return; o = o || {}; const t = ac.currentTime + Math.max(0, delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1000; if (o.q) f.Q.value = o.q;
    const g = ac.createGain(); g.gain.setValueAtTime(Math.max(.0002, v || .2), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.bus || sfxBus); if (o.verb) g.connect(verbIn); s.start(t); s.stop(t + dur + .05);
  }
  const sfx = {
    jump: () => { tone(260, 620, .13, 'square', .14, 0, { lp: 2400 }); noise(.06, .07, 'highpass', 3000); },
    djump: () => { tone(420, 980, .12, 'triangle', .18); tone(620, 1400, .14, 'sine', .1, .04, { verb: true }); noise(.1, .07, 'highpass', 5000); },
    wall: () => { tone(300, 700, .1, 'square', .12, 0, { lp: 2000 }); noise(.08, .14, 'bandpass', 1200); },
    land: () => noise(.07, .1, 'lowpass', 700),
    dodge: () => { noise(.18, .2, 'bandpass', 2600, 0, { q: .6 }); tone(1100, 300, .15, 'sawtooth', .04, 0, { lp: 3000 }); },
    swing: () => noise(.09, .15, 'bandpass', 3200, 0, { q: 1.2 }),
    swing3: () => { noise(.14, .2, 'bandpass', 2200, 0, { q: 1 }); tone(400, 200, .12, 'sawtooth', .05, 0, { lp: 1500 }); },
    hit: () => { tone(240, 90, .09, 'square', .2, 0, { lp: 2500 }); noise(.07, .2, 'lowpass', 2200); },
    hit2: () => { tone(180, 60, .16, 'sawtooth', .22, 0, { lp: 1800 }); noise(.12, .28, 'lowpass', 1600); tone(90, 40, .2, 'sine', .3); },
    heavy: () => { tone(150, 45, .28, 'sawtooth', .22, 0, { lp: 1400 }); noise(.2, .22, 'lowpass', 900); },
    hurt: () => { tone(320, 80, .3, 'sawtooth', .2, 0, { lp: 1600 }); noise(.15, .18, 'lowpass', 1200); },
    coin: () => { tone(1320, 1320, .05, 'square', .07, 0, { lp: 5000 }); tone(1760, 1760, .16, 'triangle', .1, .05, { verb: true }); },
    heart: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .16, 'triangle', .14, i * .07, { verb: true })),
    shell: () => { [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, f * 1.005, .3, 'triangle', .14, i * .08, { verb: true })); noise(.6, .05, 'highpass', 6000, .1, { verb: true }); },
    beacon: () => { tone(330, 660, .4, 'sine', .18, 0, { verb: true }); tone(495, 990, .5, 'triangle', .1, .1, { verb: true }); },
    bounce: () => tone(180, 900, .2, 'triangle', .22),
    crate: () => { noise(.14, .26, 'lowpass', 1500); tone(140, 60, .12, 'square', .12, 0, { lp: 900 }); },
    die: () => [560, 420, 300, 180].forEach((f, i) => tone(f, f * .7, .24, 'sawtooth', .16, i * .13, { lp: 2000, verb: true })),
    kill: () => { tone(620, 140, .22, 'square', .14, 0, { lp: 2600 }); noise(.2, .22, 'lowpass', 2600); tone(1200, 1800, .08, 'sine', .07, .05); },
    ko: () => { tone(900, 60, .5, 'sawtooth', .25, 0, { lp: 2500, verb: true }); noise(.4, .3, 'lowpass', 900, 0, { verb: true }); },
    ult: () => { [220, 330, 440, 660, 880, 1320].forEach((f, i) => tone(f, f * 2, .35, 'sawtooth', .12, i * .06, { lp: 3500, verb: true })); noise(.7, .22, 'bandpass', 800, 0, { verb: true }); },
    roar: () => { tone(110, 38, .9, 'sawtooth', .28, 0, { lp: 700 }); noise(.8, .28, 'lowpass', 500, 0, { verb: true }); },
    slam: () => { tone(70, 28, .45, 'sine', .5); noise(.35, .38, 'lowpass', 600, 0, { verb: true }); },
    splash: () => { noise(.45, .26, 'bandpass', 900, 0, { q: .5 }); noise(.3, .1, 'highpass', 4000, .05); },
    throwc: () => tone(520, 220, .1, 'triangle', .12),
    laser: () => tone(1400, 1250, .22, 'sawtooth', .035, 0, { lp: 4000 }),
    zap: () => { tone(900, 120, .25, 'sawtooth', .18, 0, { lp: 3000 }); noise(.15, .18, 'highpass', 2500); },
    lock: () => { tone(1200, 1200, .06, 'square', .07); tone(1200, 1200, .06, 'square', .07, .12); },
    select: () => tone(660, 990, .07, 'triangle', .12),
    back: () => tone(660, 440, .07, 'triangle', .1),
    join: () => { tone(440, 880, .12, 'triangle', .16); tone(880, 1320, .18, 'triangle', .12, .1, { verb: true }); },
    ready: () => { tone(784, 784, .1, 'square', .1); tone(1175, 1175, .2, 'triangle', .12, .1, { verb: true }); },
    count: () => tone(880, 880, .12, 'square', .14),
    go: () => { tone(1175, 1175, .3, 'square', .16, 0, { verb: true }); tone(1568, 1568, .4, 'triangle', .12, .05, { verb: true }); },
    heartbeat: () => { tone(62, 50, .12, 'sine', .3); tone(62, 50, .12, 'sine', .22, .18); },
    star: () => tone(880, 1760, .25, 'triangle', .16, 0, { verb: true }),
    win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, .2, 'square', .12, i * .1, { lp: 3200, verb: true })),
    whoosh: () => noise(.5, .12, 'bandpass', 600, 0, { q: .4 }),
    pogo: () => { tone(500, 1100, .1, 'square', .12, 0, { lp: 2600 }); noise(.06, .16, 'lowpass', 2000); },
    gate: () => tone(200, 800, .6, 'sawtooth', .09, 0, { lp: 2000, verb: true }),
    pop: () => { tone(900, 400, .08, 'sine', .14); noise(.06, .1, 'highpass', 3000); },
    revive: () => [392, 523, 659, 784].forEach((f, i) => tone(f, f, .2, 'triangle', .14, i * .09, { verb: true })),
    geyser: () => { noise(.6, .3, 'bandpass', 500, 0, { q: .5 }); tone(120, 400, .5, 'sawtooth', .1, 0, { lp: 1200 }); }
  };
  const SONGS = {
    title: { bpm: 88, chords: [[57, 64, 67, 72], [53, 60, 64, 69], [48, 55, 64, 67], [55, 62, 65, 71]], pad: 1.1, padLp: 1100, arp: 2, bass: 'x.......x.......', kick: 'x.........x.....', snare: '........x.......', hat: '..x...x...x...x.', lead: null },
    beach: { bpm: 116, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], pad: .8, padLp: 1500, arp: 1, bass: 'x..x..x...x..x..', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
      lead: [72,0,76,0,79,0,76,74, 72,0,0,74,76,0,0,0, 72,0,69,0,72,0,76,0, 74,0,72,0,69,0,0,0, 69,0,72,0,77,0,76,74, 72,0,69,0,72,0,74,0, 74,0,0,71,74,0,79,0, 77,0,76,0,74,0,71,0] },
    canopy: { bpm: 126, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 67]], pad: .7, padLp: 1700, arp: 1, bass: 'x.x...x.x.x...x.', kick: 'x..x....x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx',
      lead: [74,0,78,0,81,0,78,0, 76,0,74,0,0,0,0,0, 73,0,76,0,78,0,81,0, 79,0,78,0,0,0,0,0, 74,0,78,0,81,0,83,0, 81,0,78,0,76,0,0,0, 71,0,74,0,78,0,81,0, 79,0,76,0,74,0,0,0] },
    cave: { bpm: 96, chords: [[52, 55, 59, 62], [48, 52, 55, 59], [50, 53, 57, 60], [47, 50, 54, 57]], pad: 1.2, padLp: 900, arp: 2, bass: 'x.......x...x...', kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.',
      lead: [0,0,67,0,0,0,66,0, 64,0,0,0,0,0,0,0, 0,0,69,0,0,0,67,0, 64,0,62,0,0,0,0,0, 0,0,71,0,0,0,69,0, 67,0,0,0,0,0,0,0, 0,0,66,0,0,0,64,0, 62,0,0,0,0,0,0,0] },
    boss: { bpm: 146, chords: [[57, 60, 64], [53, 57, 60], [55, 58, 62], [52, 56, 59]], pad: .7, padLp: 1800, arp: 1, bass: 'xx.xxx.xxx.xxx.x', kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
      lead: [69,69,72,69,76,0,74,72, 69,0,72,0,76,77,76,74, 72,72,77,72,81,0,79,77, 76,0,77,0,72,0,69,0, 70,70,74,70,79,0,77,74, 70,0,74,0,77,79,77,74, 71,71,76,71,80,0,79,76, 75,0,76,0,80,0,83,0] },
    match: { bpm: 138, chords: [[55, 58, 62, 65], [51, 55, 58, 62], [53, 56, 60, 63], [50, 53, 57, 60]], pad: .6, padLp: 2000, arp: 1, bass: 'x.xx..x.x.xx..x.', kick: 'x...x..xx...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
      lead: [79,0,82,79,86,0,84,82, 79,0,0,0,77,0,79,0, 75,0,79,75,82,0,79,0, 77,0,0,0,0,0,0,0, 80,0,84,80,87,0,86,84, 80,0,0,0,79,0,77,0, 74,0,77,74,81,0,79,77, 74,0,0,0,0,0,0,0] }
  };
  const mf = n => 440 * Math.pow(2, (n - 69) / 12);
  function play(name) { const s = SONGS[name] || null; if (song === s) return; song = s; step = 0; if (ac) nextT = ac.currentTime + .08; }
  function stop() { song = null; }
  function voice(f, t, dur, type, v, o) {
    const os = ac.createOscillator(), g = ac.createGain(); os.type = type; os.frequency.value = f; if (o.det) os.detune.value = o.det;
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = f * .012; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + .05); }
    const a = o.a || .008; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); if (o.hold) g.gain.setValueAtTime(v, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let n = os; if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; os.connect(fl); n = fl; }
    n.connect(g); g.connect(musBus); if (o.verb) g.connect(verbIn); os.start(t); os.stop(t + dur + .05);
  }
  function drum(k, t, v) {
    if (k === 'k') { const os = ac.createOscillator(), g = ac.createGain(); os.type = 'sine'; os.frequency.setValueAtTime(140, t); os.frequency.exponentialRampToValueAtTime(42, t + .18); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .28); os.connect(g); g.connect(musBus); os.start(t); os.stop(t + .3); }
    else if (k === 's') { noise(.16, .2, 'bandpass', 1900, t - ac.currentTime, { bus: musBus, verb: true, q: .8 }); tone(200, 120, .1, 'triangle', .1, t - ac.currentTime, { bus: musBus }); }
    else noise(.04, v || .035, 'highpass', 7500, t - ac.currentTime, { bus: musBus });
  }
  function schedule(s, t, spb) {
    const i = s % 16, ch = song.chords[Math.floor(s / 16) % song.chords.length];
    if (i === 0) for (const n of ch) { voice(mf(n), t, spb * 16 * .98, 'sawtooth', .04 * song.pad, { lp: song.padLp, det: 7, a: .3, hold: 1, verb: true }); voice(mf(n), t, spb * 16 * .98, 'sawtooth', .04 * song.pad, { lp: song.padLp, det: -7, a: .3, hold: 1 }); }
    if (song.bass[i] === 'x') { voice(mf(ch[0] - 12), t, spb * 1.8, 'triangle', .2, {}); voice(mf(ch[0] - 24), t, spb * 1.6, 'square', .045, { lp: 500 }); }
    if (song.arp && i % song.arp === 0) voice(mf(ch[Math.floor(s / song.arp) % ch.length] + 12), t, spb * 1.5, 'triangle', .05, { verb: true });
    if (song.lead) { const n = song.lead[s % song.lead.length]; if (n) voice(mf(n), t, spb * 1.8, 'square', .045, { lp: 3200, verb: true, vib: true }); }
    if (song.kick[i] === 'x') drum('k', t); if (song.snare[i] === 'x') drum('s', t); if (song.hat[i] === 'x') drum('h', t, i % 4 === 0 ? .05 : .03);
  }
  function tick() {
    if (!ac || !song || settings.music === 0) return;
    const spb = 60 / song.bpm / 4;
    if (nextT < ac.currentTime) nextT = ac.currentTime + .02;
    while (nextT < ac.currentTime + .2) { schedule(step, nextT, spb); nextT += spb; step++; }
  }
  return { init, vol, sfx, play, stop, tick };
})();

/* =========================================================
   Input: sources (2 keyboard layouts, 4 gamepads, touch, bot)
   ========================================================= */
const keys = {};
const BLANK = () => ({ x: 0, y: 0, jump: 0, atk: 0, spec: 0, dodge: 0, ult: 0, pause: 0, ok: 0, back: 0 });
const tch = BLANK();
let inputKind = matchMedia('(pointer:coarse)').matches ? 'touch' : 'key';
addEventListener('keydown', e => { if (e.repeat) return; keys[e.code] = 1; inputKind = 'key'; if (G.scene === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });
const k = c => keys[c] ? 1 : 0;
const SRC_NAMES = { k1: 'Keyboard · WASD', k2: 'Keyboard · Arrows', touch: 'Touch', pad0: 'Gamepad 1', pad1: 'Gamepad 2', pad2: 'Gamepad 3', pad3: 'Gamepad 4', bot: 'Bot' };
function readSrc(src, o) {
  o.x = 0; o.y = 0; o.jump = o.atk = o.spec = o.dodge = o.ult = o.pause = o.ok = o.back = 0;
  if (src === 'k1') { o.x = (k('KeyD')) - (k('KeyA')); o.y = (k('KeyS')) - (k('KeyW')); o.jump = k('Space') || k('KeyW'); o.atk = k('KeyJ') || k('KeyZ'); o.spec = k('KeyK') || k('KeyX'); o.dodge = k('KeyL') || k('ShiftLeft') || k('KeyC'); o.ult = k('KeyU') || k('KeyV'); o.pause = k('Escape') || k('KeyP'); o.ok = k('Enter'); o.back = k('Escape') || k('Backspace'); }
  else if (src === 'k2') { o.x = k('ArrowRight') - k('ArrowLeft'); o.y = k('ArrowDown') - k('ArrowUp'); o.jump = k('ArrowUp') || k('Numpad0'); o.atk = k('KeyN') || k('Numpad1'); o.spec = k('KeyM') || k('Numpad2'); o.dodge = k('Comma') || k('Numpad3') || k('ShiftRight'); o.ult = k('Period') || k('Numpad4'); o.pause = k('Escape'); o.ok = k('NumpadEnter') || k('Enter'); o.back = k('Escape'); }
  else if (src === 'touch') { Object.assign(o, tch); o.pause = 0; }
  else if (src.startsWith('pad')) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], g = pads[+src.slice(3)];
    if (g) {
      const b = i => g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > .5) ? 1 : 0, ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      o.x = Math.abs(ax) > .25 ? ax : 0; o.y = Math.abs(ay) > .25 ? ay : 0;
      if (b(14)) o.x = -1; if (b(15)) o.x = 1; if (b(12)) o.y = -1; if (b(13)) o.y = 1;
      o.jump = b(0); o.ok = b(0); o.atk = b(2); o.spec = b(1); o.back = b(1); o.dodge = b(7) || b(6) || b(5) || b(4); o.ult = b(3); o.pause = b(9);
      if (o.x || o.y || g.buttons.some(q => q.pressed)) inputKind = 'pad';
    }
  }
  o.x = clamp(o.x, -1, 1); o.y = clamp(o.y, -1, 1);
}
function edge(o, prev, just) { for (const key in o) { just[key] = (o[key] && !prev[key]) ? 1 : 0; prev[key] = o[key]; } }
/* menu input: union of every real source */
const menuIn = BLANK(), menuPrev = {}, menuJust = {}, tmpIn = BLANK();
const ALL_SRC = ['k1', 'k2', 'touch', 'pad0', 'pad1', 'pad2', 'pad3'];
function pollMenu() {
  for (const key in menuIn) menuIn[key] = 0;
  for (const s of ALL_SRC) { readSrc(s, tmpIn); for (const key in tmpIn) if (tmpIn[key]) menuIn[key] = tmpIn[key]; }
  edge(menuIn, menuPrev, menuJust);
}
/* Touch stick + buttons */
const stickZone = $('stickZone'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
let stickId = null, sbx = 0, sby = 0;
function stickMove(e) {
  const R = 50; let dx = e.clientX - sbx, dy = e.clientY - sby; const L = Math.hypot(dx, dy);
  if (L > R) { dx *= R / L; dy *= R / L; }
  stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  tch.x = Math.abs(dx / R) < .18 ? 0 : dx / R; tch.y = Math.abs(dy / R) < .18 ? 0 : dy / R;
}
stickZone.addEventListener('pointerdown', e => {
  if (stickId !== null) return; stickId = e.pointerId; try { stickZone.setPointerCapture(e.pointerId); } catch (_) {}
  const r = stickZone.getBoundingClientRect(); sbx = clamp(e.clientX, r.left + 66, r.right - 66); sby = clamp(e.clientY, r.top + 66, r.bottom - 66);
  stickBase.style.left = (sbx - r.left) + 'px'; stickBase.style.top = (sby - r.top) + 'px'; stickBase.classList.add('active'); stickMove(e); inputKind = 'touch'; e.preventDefault();
});
stickZone.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; tch.x = tch.y = 0; stickBase.classList.remove('active'); stickBase.style.left = ''; stickBase.style.top = ''; stickKnob.style.transform = 'translate(-50%,-50%)'; };
stickZone.addEventListener('pointerup', stickEnd); stickZone.addEventListener('pointercancel', stickEnd);
for (const [id, key] of [['tJump', 'jump'], ['tAtk', 'atk'], ['tSpec', 'spec'], ['tDodge', 'dodge'], ['tUlt', 'ult']]) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { tch[key] = 1; el.classList.add('down'); inputKind = 'touch'; buzz(8); try { el.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
  const up = () => { tch[key] = 0; el.classList.remove('down'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, up));
}
document.addEventListener('contextmenu', e => { if (e.target.closest('#touch') || e.target === cv) e.preventDefault(); });
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') inputKind = 'touch'; else if (e.pointerType === 'mouse' && G.scene !== 'play') inputKind = 'key'; }, { capture: true });

/* =========================================================
   Heroes
   ========================================================= */
const HEROES = [
  { id: 'rook', name: 'Rook Ironhide', short: 'Rook', role: 'Tank', tag: 'Shield knight', speed: 3.8, air: 3.6, jump: 13.6, jumps: 2, hp: 120, light: [10, 10, 18], heavy: 26, bulk: 1.18, wlen: 20,
    sig: 'Shield Bash', sigDesc: 'Charges behind his shield. Blocks projectiles and claws from the front.', ult: 'Fortress Wall', ultDesc: 'A golden barrier for 5 seconds and 25 health back.', perk: 'Takes 15% less damage and is harder to launch.',
    c: { skin: '#f0c08a', hair: '#d9dfe8', hair2: '#a7b2c2', body: '#4a6488', body2: '#7f9cc6', limb: '#3e5474', back: '#2a3a52', accent: '#ffc65c', boot: '#2a2230', metal: '#d3dce7', glow: '#ffc65c' } },
  { id: 'kiko', name: 'Kiko Breeze', short: 'Kiko', role: 'Speed', tag: 'Wind ninja', speed: 5.2, air: 4.9, jump: 13.2, jumps: 3, hp: 90, light: [8, 8, 14], heavy: 20, bulk: .86, wlen: 11,
    sig: 'Shadow Dash', sigDesc: 'Slices through everything in a line and cannot be hit while dashing.', ult: 'Clone Storm', ultDesc: 'Shadow clones strike every enemy on screen three times.', perk: 'Triple jump and the fastest run speed.',
    c: { skin: '#e5b088', hair: '#1d2340', hair2: '#121731', body: '#22345a', body2: '#3d5f99', limb: '#1c2b4a', back: '#121c33', accent: '#2de2c3', boot: '#151a2c', metal: '#d6fff7', glow: '#2de2c3' } },
  { id: 'marisol', name: 'Marisol Tidecaller', short: 'Marisol', role: 'Ranged', tag: 'Tide mage', speed: 4.2, air: 4.0, jump: 13.8, jumps: 2, hp: 100, light: [9, 9, 15], heavy: 22, bulk: .95, wlen: 24,
    sig: 'Wave Push', sigDesc: 'Sends a rolling wave that pierces everything in its path.', ult: 'Tsunami', ultDesc: 'A wall of water sweeps the whole screen.', perk: 'Hold jump while falling to glide.',
    c: { skin: '#c58a5c', hair: '#1a7f96', hair2: '#0f5668', body: '#1f9c8c', body2: '#86e0d2', limb: '#17786c', back: '#0e534c', accent: '#ff6b4a', boot: '#124a52', metal: '#e9fbff', glow: '#5be7ff' } },
  { id: 'tito', name: 'Tito Fuego', short: 'Tito', role: 'Bruiser', tag: 'Flame boxer', speed: 4.4, air: 4.1, jump: 13.8, jumps: 2, hp: 105, light: [11, 11, 17], heavy: 28, bulk: 1.06, wlen: 6,
    sig: 'Fire Uppercut', sigDesc: 'A rising flaming punch that launches enemies and carries Tito upward.', ult: 'Volcano Fist', ultDesc: 'One giant punch that erupts on impact.', perk: 'Every hit sets enemies on fire for extra damage.',
    c: { skin: '#9a6a40', hair: '#ff4d3a', hair2: '#ffb02e', body: '#b8431c', body2: '#f4a261', limb: '#8f3416', back: '#5e200e', accent: '#ffe66d', boot: '#3a1c10', metal: '#ff9a3c', glow: '#ff7b2e' } }
];
const PCOL = ['#2de2c3', '#ff6b4a', '#ffc65c', '#b48cff'];
const SIGNS = [
  { k: 'A  D', p: 'STICK', t: 'STICK', label: 'Move' },
  { k: 'SPACE', p: 'A', t: 'JUMP', label: 'Jump, then again in the air' },
  { k: 'J', p: 'X', t: 'ATTACK', label: 'Tap 3 times for a combo' },
  { k: 'L', p: 'RT', t: 'DODGE', label: 'Dodge through danger' },
  { k: 'K', p: 'B', t: 'SPECIAL', label: 'Your signature move' },
  { k: 'S + J', p: '↓ + X', t: '↓ + ATTACK', label: 'In the air: pogo off enemies' },
  { k: 'D + SPACE', p: '→ + A', t: 'PUSH + JUMP', label: 'Wall jump up the cliff' },
  { k: '', p: '', t: '', label: 'Lasers pulse. Wait for the gap' },
  { k: '', p: '', t: '', label: 'Stand by a downed friend to revive' }
];

/* =========================================================
   Level & stage data
   # sand/rock  R rock  P plank  X crumbling plank  W water  S urchin  G gate  V lava(hazard tile)
   @ start  t sign  T palm  o coin  H heart  K Pact Shell  F checkpoint  B bounce clam  C crate
   c crab  s slime  j jelly  m monkey  d drone  Y laser  L log  l lift  Z Big Claw  E raft  Q exit portal  g geyser spot
   ========================================================= */
const R40 = '........................................';
const LEVELS = [
  { id: '1-1', name: 'Driftwood Beach', theme: 'beach', song: 'beach', par: 300, desc: 'Sunny shore. Learn the moves, cross the tidepools, beat Big Claw at the pier.', chunks: [
    ['', '', '', '', '', '', '', '.........................PPP............', '.........................ooo............', '..................PPPP..................', '..................oooo......oo..........', '................ooo.............oo......', '..@..t....t.c...t...T....t.s....t..C....', '########################################', '########################################', '########################################', '########################################'],
    ['', '', '', '...........................K............', '..........................PPPP....oooo..', '..................................PPPP..', '....................oooo................', '....................PPPP................', '', '..............oooo......................', '..............PPPP......................', '..........................o.............', '......c..........s.....T.....s...B..c...', '########WWWW############################', '########WWWW############################', '########WWWW############################', '########WWWW############################'],
    ['', '', '', '', '', '', '', '......................j.................', '..........H.............................', '....................oo..oo..j...........', '....................XX..XX..............', '........L......ooo......................', '..F.t...........S............c......C...', '######WWWWWWWW#####WWWWWWWWW############', '######WWWWWWWW#####WWWWWWWWW############', '######WWWWWWWW#####WWWWWWWWW############', '######WWWWWWWW#####WWWWWWWWW############'],
    ['', '', '', '........................K...............', '.......................PPPP.............', '................oooo....................', '................PPPP....................', '', '............oooo.............o..........', '........m...PPPP....m...........m.......', '', '...................................o....', '.....c........s............SSS.....c..C.', '########################################', '########################################', '########################################', '########################################'],
    ['', '', '', '', '', '', '.........ooo............................', '....j...................................', '..........ooooc.....s.....o.............', '..........RRRRRRRRRRRRRRRR..............', '..........RRRRRRRRRRRRRRRR..............', '.......l..RRRR..........................', '......t...RRRR....K.........SS..c...F...', '########################################', '########################################', '########################################', '########################################'],
    ['', '', '', '', '...........d...................d........', '', '......................ooo...............', '........Y.............PPP.......Y.......', '', '...........oo......................oo...', '..........PPPP.........Y..........PPPP..', '', '.t.H......s.......c........o.o.o....c...', '#####################WWWWWW#############', '#####################WWWWWW#############', '#####################WWWWWW#############', '#####################WWWWWW#############'],
    ['...............................G........', '...............................G........', '...............................G........', '...............................G........', '...............................G........', '...............................G........', '...............................G........', '...............................G........', '......PPPP..............PPPP...G........', '...............................G........', '...............................G........', '...H...........................G........', '....................Z..........G....E...', '#####################################WWW', '#####################################WWW', '#####################################WWW', '#####################################WWW']
  ] },
  { id: '1-2', name: 'Palm Canopy', theme: 'canopy', song: 'canopy', par: 320, desc: 'Treetop village. Climb through the palms, dodge coconuts, ride the lifts to the portal.', chunks: [
    ['', '', '', '', '', '', '..................oooo..................', '..................PPPP......PPP.........', '........................................', '............PPP.......m.....ooo.........', '............ooo........................K', '.......................................P', '..@..t......t......s........c.........t.', '########################################', '########################################', '########################################', '########################################'],
    ['', '', '..............K.........................', '..............PP.............oooo.......', '........................j....PPPP.......', '......ooo...............................', '......PPP.......ooo.....................', '................PPP......m..............', '............................j...........', '.........m..........PPPP................', '....................oooo.......PPP......', '...............................ooo......', '....c.......B..........s....F.......s...', '#######WWWWWWWWW########################', '#######WWWWWWWWW########################', '#######WWWWWWWWW########################', '#######WWWWWWWWW########################'],
    ['', '', '', '....................oooo................', '....................PPPP................', '........................................', '..........ooo.............j.............', '..........XXX...................PPPP....', '................................oooo....', '....H...........m.......................', '..l.......................l.............', '........................................', '..t...........SSS..........c..s.....C...', '########WWWWWWWWWWWWWWWWWWWW############', '########WWWWWWWWWWWWWWWWWWWW############', '########WWWWWWWWWWWWWWWWWWWW############', '########WWWWWWWWWWWWWWWWWWWW############'],
    ['', '', '', '..........K.............................', '..........PP............................', '.......................m................', '......oooo..........PPPP................', '......PPPP..........oooo................', '........................................', '.............PPP.............m..........', '.............ooo........................', '........................................', '...c.........s........c.......s....Q....', '########################################', '########################################', '########################################', '########################################']
  ] },
  { id: '1-3', name: 'Tidepool Caves', theme: 'cave', song: 'cave', par: 340, desc: 'Dark sea cave lit by crystals. Water, urchins and jellies. Watch your footing.', chunks: [
    ['', '', '', '', '', '', '', '....................RRR.................', '....................ooo.................', '.............RRR........................', '.............ooo......j.................', '........................................', '..@..t.....s......c..........t.....C....', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR'],
    ['', '', '......K.................................', '......PPP..........ooo..................', '...................PPP..........ooo.....', '..........j.....................PPP.....', '......................................j.', '..............ooo.......................', '..............XXX.......................', '........................................', '.........L.............L................', '........................................', '..F.........S.............s.....H.......', 'RRRRRWWWWWWWWWWWRRRRWWWWWWWWWRRRRRRRRRRR', 'RRRRRWWWWWWWWWWWRRRRWWWWWWWWWRRRRRRRRRRR', 'RRRRRWWWWWWWWWWWRRRRWWWWWWWWWRRRRRRRRRRR', 'RRRRRWWWWWWWWWWWRRRRWWWWWWWWWRRRRRRRRRRR'],
    ['', '', '', '', '', '........................K...............', '........................PP..............', '.........oooo...................j.......', '.........RRRR.......j...................', '.........RRRR...........................', '.........RRRR.....ooo.........RRRR......', '.........RRRR.....PPP.........oooo......', '..t..c...SRRRS........s....c..RRRR.s....', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR'],
    ['', '', '', '', '........................K...............', '.......................PPP..............', '........................................', '..........ooo...............j...........', '..........PPP...........................', '........................................', '....l...........ooo.........l...........', '................PPP.....................', '..H.......s...........c....s..........Q.', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', 'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR']
  ] }
];
/* Match stages: 36 wide. Spawn points 1..4. Blast zone = map bounds + margin. */
const STAGES = [
  { id: 'docks', name: 'Driftwood Docks', theme: 'beach', song: 'match', hazard: 'wave', desc: 'One wide pier, two floating planks. The fair stage. A wave rolls through every 40 s.', rows: [
    '', '', '', '', '', '', '', '', '', '',
    '..........PPPP..........PPPP............',
    '', '', '', '',
    '........1.....2..........3.....4........',
    '......##############################....',
    '......##############################....',
    '', '', ''] },
  { id: 'canopy', name: 'Canopy Clash', theme: 'canopy', song: 'match', hazard: 'coconut', desc: 'Tall treetops on three levels. Juggle-heavy. Coconuts fall from shaking palms.', rows: [
    '', '', '', '', '', '',
    '.................PPPPPP.................',
    '', '', '',
    '.........PPPPP.............PPPPP........',
    '', '', '',
    '..........1......2....3......4..........',
    '.........################################',
    '.........##############################.',
    '', '', ''] },
  { id: 'molten', name: 'Molten Crown', theme: 'molten', song: 'boss', hazard: 'geyser', desc: 'A crater rim over lava. Small rock perches. Geysers erupt under the marked spots.', rows: [
    '', '', '', '', '', '', '', '',
    '......PPP..........................PPP..',
    '', '', '',
    '..................PPPP..................',
    '', '',
    '........1....g...2......3...g....4......',
    '........RRRRRRRRRRRRRRRRRRRRRRRRRRRR....',
    '........RRRRRRRRRRRRRRRRRRRRRRRRRRRR....',
    '', '', ''] }
];
const THEMES = {
  beach: { sky: ['#0b3550', '#2c7a8e', '#f2977a', '#ffc982', '#ffe2a8'], sun: 1, sea: ['#3fa2ad', '#17708a', '#0a3e54'], dune: '#e6b673', sand: ['#ffdb93', '#f2c176', '#e1a862', '#cb8f4f', '#b07843', '#966339'], rock: ['#7d90aa', '#56667e', '#46546a'], water: ['rgba(40,175,195,.9)', 'rgba(18,122,155,.94)', 'rgba(10,78,112,.97)'], grass: ['#3fae7a', '#6fd39a'], city: 1, fog: 'rgba(255,200,150,0)' },
  canopy: { sky: ['#0f3b3a', '#1f7a62', '#9fd36a', '#f6e58d', '#ffd27a'], sun: 1, sea: ['#2f8f7a', '#17605a', '#0b3a3a'], dune: '#5aa15a', sand: ['#9ad66b', '#6fb24e', '#4f8f3e', '#3e7332', '#2f5a28', '#244620'], rock: ['#7d90aa', '#56667e', '#46546a'], water: ['rgba(60,200,170,.9)', 'rgba(20,140,120,.94)', 'rgba(10,90,80,.97)'], grass: ['#b7f27a', '#e6ff9a'], city: 0, fog: 'rgba(160,220,120,.12)' },
  cave: { sky: ['#03070e', '#071423', '#0c2236', '#123048', '#163a52'], sun: 0, sea: ['#1a6a7a', '#0d3f52', '#061f2c'], dune: '#1b2a3a', sand: ['#4c6a84', '#3b566d', '#2f4557', '#263848', '#1d2c3a', '#15212c'], rock: ['#4c6a84', '#3b566d', '#2f4557'], water: ['rgba(40,220,210,.75)', 'rgba(20,150,160,.9)', 'rgba(10,80,100,.97)'], grass: ['#2de2c3', '#9ff7e6'], city: 0, fog: 'rgba(10,40,60,.35)', crystals: 1 },
  molten: { sky: ['#1a0612', '#4a0f1a', '#b8331f', '#ff7a3a', '#ffd27a'], sun: 1, sea: ['#ff7a2e', '#c23a12', '#5a1208'], dune: '#3a2024', sand: ['#8a6a6a', '#6a4a4a', '#4f3636', '#3d2a2a', '#2e2020', '#231818'], rock: ['#8a7f7f', '#5a4e4e', '#443a3a'], water: ['rgba(255,140,40,.95)', 'rgba(220,80,20,.96)', 'rgba(120,30,10,.98)'], grass: ['#ff9a3c', '#ffd27a'], city: 0, fog: 'rgba(255,90,30,.12)', lava: 1 }
};
