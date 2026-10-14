/* =========================================================
   Game state
   ========================================================= */
const G = { scene: 'title', mode: 'adventure', level: 0, stage: 0, frame: 0, t: 0, hitstop: 0, trauma: 0, punch: 1, timeScale: 1, slowT: 0, cam: { cx: 640, cy: 300, z: 1 }, fade: 0, fadeDir: 0,
  res: 1, dpr: 1, Z: 1, Zbase: 1, viewW: 800, viewH: 400, ui: 1, safe: { t: 0, r: 0, b: 0, l: 0 }, portrait: false, world: false, cine: 0, bannerT: 999, flash: 0, hurtFlash: 0,
  fps: 60, levelDone: 0, levelT: 0, gameOver: 0, gameOverT: 0, countdown: 0, matchOver: 0, matchT: 0, hazardT: 0, hazardWarn: 0, theme: THEMES.beach };
let map = [], MW = 40, MH = 17;
let P = null, players = [], ents = [], parts = [], texts = [], projs = [], plats = [], movers = [], decor = [], signs = [], lasers = [], corpses = [], boss = null, arena = null, raft = null, exitP = null, geysers = [], spawns = [];
let stats = {}, checkpoint = { x: 80, y: 340 }, UID = 1, STAGE = null, LEVEL = null;
let view = { l: 0, t: 0, r: 800, b: 400 };
const tile = (tx, ty) => { if (tx < 0 || tx >= MW) return G.mode === 'match' ? '.' : '#'; if (ty < 0) return '.'; if (ty >= MH) return G.mode === 'match' ? '.' : map[MH - 1][tx]; return map[ty][tx]; };
const setTile = (tx, ty, c) => { if (ty >= 0 && ty < MH && tx >= 0 && tx < MW) map[ty][tx] = c; };
const SOLID = { '#': 1, 'R': 1, 'G': 1 };
let crumbled = {};
const isSolid = (tx, ty) => !!SOLID[tile(tx, ty)];
const isOneWay = (tx, ty) => { const c = tile(tx, ty); return c === 'P' || (c === 'X' && !(crumbled[tx + ',' + ty] && crumbled[tx + ',' + ty].gone)); };
const alive = () => players.filter(p => !p.dead && !p.downed && !p.out);
const inPlay = () => players.filter(p => !p.out);
function nearest(x, y, excl) { let best = null, bd = 1e9; for (const p of players) { if (p === excl || p.out || p.dead) continue; const d = Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y); if (d < bd) { bd = d; best = p; } } return best; }
function nearestTarget(x, y) { const n = nearest(x, y, null); return n || { x, y: y, w: 20, h: 40, vx: 0, dead: true, dummy: true }; }

function burst(x, y, n, cols, spd, life, o) {
  o = o || {};
  if (parts.length > 800) parts.splice(0, parts.length - 700);
  for (let i = 0; i < n; i++) {
    const a = o.dir !== undefined ? o.dir + rnd(-(o.spread || .5), o.spread || .5) : rnd(0, TAU), s = rnd(spd * .35, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), life: rnd(life * .6, life), max: life, c: cols[(Math.random() * cols.length) | 0], g: o.g === undefined ? .25 : o.g, sz: rnd(o.sz || 2, (o.sz || 2) * 2), type: o.type || 'dot', drag: o.drag || .97, add: !!o.add });
  }
}
function ringFx(x, y, r0, r1, col, life, w) { parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 1, type: 'ring', r0, r1, c: col, life, max: life, sz: w || 3, add: true }); }
function floatText(x, y, txt, col, size, o) { texts.push({ x, y, txt: String(txt), c: col || '#fff', life: 52, size: size || 12, crit: o && o.crit }); }
function addTrauma(v) { if (motionOK()) G.trauma = Math.min(1, G.trauma + v); }
function slowmo(sec) { if (motionOK()) G.slowT = Math.max(G.slowT, sec); }
function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms || 2600); }

function makeEnemy(kind, tx, ty) {
  const d = DIFF[settings.diff], n = Math.max(1, players.length), scale = 1 + .45 * (n - 1);
  const e = { id: UID++, kind, x: tx * TS, y: ty * TS, vx: 0, vy: 0, dir: -1, hp: 1, max: 1, flash: 0, stun: 0, dead: false, onGround: false, t: Math.random() * 100, state: 'walk', st: 0, cd: 0, contact: 10, g: .8, burn: 0, sq: 0 };
  if (kind === 'c') Object.assign(e, { w: 32, h: 20, hp: 30, contact: 10, speed: 1.2 });
  if (kind === 's') Object.assign(e, { w: 28, h: 22, hp: 22, contact: 10, cd: 40 });
  if (kind === 'j') Object.assign(e, { w: 24, h: 26, hp: 20, contact: 12, g: 0, fly: true });
  if (kind === 'm') Object.assign(e, { w: 24, h: 24, hp: 25, contact: 8, g: 0, fly: true, cd: 70, state: 'idle' });
  if (kind === 'd') Object.assign(e, { w: 30, h: 16, hp: 30, contact: 12, g: 0, fly: true, state: 'patrol', cd: 40 });
  if (kind === 'Z') Object.assign(e, { w: 88, h: 52, hp: 380, contact: 20, boss: true, state: 'sleep', g: .9, name: 'BIG CLAW' });
  e.y = (ty + 1) * TS - e.h; if (e.fly) e.y = ty * TS + (TS - e.h) / 2;
  e.baseY = e.y; e.hp = Math.round(e.hp * d.hp * scale); e.max = e.hp; e.hpLag = e.hp;
  return e;
}
function makePlayer(slot, x, y) {
  const h = HEROES[slot.hero];
  const p = { idx: slot.idx, src: slot.src, bot: slot.src === 'bot', hero: h, col: PCOL[slot.idx], x, y, w: 20, h: 40, vx: 0, vy: 0, facing: 1, onGround: false, wasAir: false, jumps: h.jumps, coyote: 0, jbuf: 0, hp: h.hp, max: h.hp,
    inv: 60, dodge: 0, dodgeCd: 0, dvx: 0, dvy: 0, airDodge: 1, atk: null, combo: 0, comboT: 0, meter: 0, heavyCd: 0, dead: 0, deadT: 0, rot: 0, phase: 0, drop: 0, hurtT: 0, ride: null, anim: 'idle', shield: 0, wall: 0, ctrlLock: 0, sq: 0, trail: [], chain: [], groundTile: null,
    in: BLANK(), prev: {}, just: {}, downed: 0, downT: 0, revive: 0, out: false, stocks: settings.stocks, dmg: 0, kos: 0, dealt: 0, lastHit: -1, lastHitT: 0, respawnT: 0, botT: 0, botDir: 1, botJumpT: 0, score: 0 };
  for (let i = 0; i < 7; i++) p.chain.push({ x, y });
  return p;
}

/* ---------- level / stage loading ---------- */
function buildMap(rows, width) {
  map = []; MW = width; MH = rows.length;
  for (const r of rows) map.push((r + R40 + R40).slice(0, MW).split(''));
}
function clearWorld() { crumbled = {}; ents = []; parts = []; texts = []; projs = []; plats = []; decor = []; signs = []; lasers = []; corpses = []; boss = null; arena = null; raft = null; exitP = null; geysers = []; spawns = []; }
function startLevel(fromCheckpoint) {
  LEVEL = LEVELS[G.level]; STAGE = null; G.theme = THEMES[LEVEL.theme];
  if (!fromCheckpoint) stats = { time: 0, coins: 0, shells: 0, kos: 0, combo: 0, deaths: 0, lives: DIFF[settings.diff].lives + (players.length > 1 ? players.length : 0), got: {} };
  const meters = players.map(p => fromCheckpoint ? Math.floor(p.meter / 2) : 0);
  clearWorld();
  const rows = []; for (let r = 0; r < 17; r++) { let row = ''; for (const ch of LEVEL.chunks) row += ((ch[r] || '') + R40).slice(0, 40); rows.push(row); }
  buildMap(rows, LEVEL.chunks.length * 40);
  let start = { x: 80, y: 340 }, signIdx = 0;
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const c = map[ty][tx]; if ('.#RPXWGS'.includes(c)) continue;
    const x = tx * TS, y = ty * TS;
    if (c === '@') start = { x: x + 6, y: y + TS - 40 };
    else if (c === 'T') decor.push({ x: x + 16, y: y + TS, hgt: 110 + hash(tx, ty) * 70, lean: hash(tx, ty + 1) > .5 ? 1 : -1 });
    else if (c === 't') signs.push({ x: x + 16, y: y + TS, s: SIGNS[Math.min(signIdx++, SIGNS.length - 1)], a: 0 });
    else if (c === 'o') ents.push({ kind: 'coin', x: x + 8, y: y + 8, w: 16, h: 16, t: hash(tx, ty) * 60 });
    else if (c === 'H') ents.push({ kind: 'heart', x: x + 7, y: y + 8, w: 18, h: 16, t: 0 });
    else if (c === 'K') { const key = tx + ',' + ty; if (!stats.got[key]) ents.push({ kind: 'shell', x: x + 6, y: y + 6, w: 20, h: 20, t: 0, key }); }
    else if (c === 'F') ents.push({ kind: 'beacon', x: x + 12, y: y + TS - 56, w: 8, h: 56, on: false, t: 0 });
    else if (c === 'B') ents.push({ kind: 'bounce', x: x + 2, y: y + 18, w: 28, h: 14, sq: 0 });
    else if (c === 'C') ents.push({ id: UID++, kind: 'crate', x: x + 2, y: y + 4, w: 28, h: 28, hp: 1 });
    else if (c === 'E') raft = { kind: 'raft', x: x - 16, y: y + 22, oy: y + 22, w: 72, h: 14, t: 0, dx: 0, dy: 0 };
    else if (c === 'Q') exitP = { x: x - 8, y: y - 40, w: 48, h: 72, t: 0 };
    else if (c === 'L') plats.push({ kind: 'log', x, y: y + 12, w: 64, h: 12, ox: x, oy: y + 12, range: 112, axis: 'x', t: hash(tx, ty) * 10, dx: 0, dy: 0 });
    else if (c === 'l') plats.push({ kind: 'lift', x: x - 16, y: y + 12, w: 64, h: 12, ox: x - 16, oy: y + 12, range: 150, axis: 'y', t: hash(tx, ty) * 5, dx: 0, dy: 0 });
    else if (c === 'Y') lasers.push({ tx, ty, x: x + 16, top: y + 22, bottom: y + 22, off: (tx * 37) % 180, period: 180, offT: 92, warnT: 32, state: 0 });
    else if (c === 'Z') { boss = makeEnemy('Z', tx, ty); boss.spawnX = boss.x; boss.spawnY = boss.y; ents.push(boss); arena = { x0: (tx - 20) * TS, x1: (tx + 11) * TS, gate: [], active: false, cleared: false }; }
    else if ('csjmd'.includes(c)) {
      const e = makeEnemy(c, tx, ty); ents.push(e);
      if (c === 'm') { let gy = ty; while (gy < MH && !isSolid(tx, gy)) gy++; decor.push({ x: x + 12, y: gy * TS, hgt: gy * TS - (e.y + e.h) + 6, lean: 0, monkey: true }); }
    }
    map[ty][tx] = '.';
  }
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (map[ty][tx] === 'G' && arena) arena.gate.push([tx, ty]);
  for (const L of lasers) { let ty = L.ty + 1; while (ty < MH + 4 && !isSolid(L.tx, ty) && !isOneWay(L.tx, ty)) ty++; L.bottom = ty * TS; }
  movers = plats.slice(); if (raft) movers.push(raft);
  if (!fromCheckpoint) checkpoint = start;
  players = players.map((p, i) => { const np = makePlayer({ idx: p.idx, src: p.src, hero: HEROES.indexOf(p.hero) }, checkpoint.x + i * 26, checkpoint.y); np.meter = meters[i] || 0; return np; });
  if (fromCheckpoint) for (const e of ents) if (e.kind === 'beacon' && Math.abs(e.x - checkpoint.x) < 40) e.on = true;
  Object.assign(G, { hitstop: 0, trauma: 0, fade: 1, fadeDir: -1, levelDone: 0, levelT: 0, gameOver: 0, gameOverT: 0, cine: 0, flash: 0, hurtFlash: 0, matchOver: 0, countdown: 0, world: true });
  G.cam.cx = checkpoint.x + 120; G.cam.cy = checkpoint.y; G.cam.z = 1;
  if (!fromCheckpoint) G.bannerT = 0;
  Sound.play(LEVEL.song);
}
function startMatch() {
  STAGE = STAGES[G.stage]; LEVEL = null; G.theme = THEMES[STAGE.theme];
  stats = { time: 0, coins: 0, shells: 0, kos: 0, combo: 0, deaths: 0, lives: 0, got: {} };
  clearWorld();
  buildMap(STAGE.rows.map(r => (r + R40).slice(0, 40)), 40);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const c = map[ty][tx];
    if ('1234'.includes(c)) { spawns[+c - 1] = { x: tx * TS + 6, y: (ty + 1) * TS - 40 }; map[ty][tx] = '.'; }
    else if (c === 'g') { geysers.push({ x: tx * TS + 16, y: (ty + 1) * TS, t: 0, state: 0 }); map[ty][tx] = '.'; }
  }
  STAGE.x0 = 1e9; STAGE.x1 = 0; STAGE.floorY = 0;
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (SOLID[map[ty][tx]]) { STAGE.x0 = Math.min(STAGE.x0, tx * TS); STAGE.x1 = Math.max(STAGE.x1, (tx + 1) * TS); STAGE.floorY = Math.max(STAGE.floorY, ty * TS); }
  players = players.map((p, i) => { const sp = spawns[i] || spawns[0]; const np = makePlayer({ idx: p.idx, src: p.src, hero: HEROES.indexOf(p.hero) }, sp.x, sp.y); np.facing = sp.x < MW * TS / 2 ? 1 : -1; np.inv = 0; return np; });
  Object.assign(G, { hitstop: 0, trauma: 0, fade: 1, fadeDir: -1, levelDone: 0, gameOver: 0, cine: 0, flash: 0, hurtFlash: 0, matchOver: 0, matchT: 0, countdown: 200, hazardT: 0, hazardWarn: 0, world: true, bannerT: 999 });
  G.cam.cx = MW * TS / 2; G.cam.cy = MH * TS * .55; G.cam.z = 1;
  Sound.play(STAGE.song);
}

/* =========================================================
   Physics
   ========================================================= */
function moveBody(e, oneWay, isP) {
  e.hitWall = 0;
  e.x += e.vx;
  let t = Math.floor(e.y / TS), b = Math.floor((e.y + e.h - .01) / TS);
  if (e.vx > 0) { const r = Math.floor((e.x + e.w - .01) / TS); for (let ty = t; ty <= b; ty++) if (isSolid(r, ty)) { e.x = r * TS - e.w; e.vx = 0; e.hitWall = 1; break; } }
  else if (e.vx < 0) { const l = Math.floor(e.x / TS); for (let ty = t; ty <= b; ty++) if (isSolid(l, ty)) { e.x = (l + 1) * TS; e.vx = 0; e.hitWall = -1; break; } }
  const prevB = e.y + e.h;
  e.y += e.vy; e.onGround = false; e.groundTile = null;
  const l = Math.floor(e.x / TS), r = Math.floor((e.x + e.w - .01) / TS);
  t = Math.floor(e.y / TS); b = Math.floor((e.y + e.h - .01) / TS);
  if (e.vy > 0) {
    for (let tx = l; tx <= r; tx++) {
      if (isSolid(tx, b) || (oneWay && isOneWay(tx, b) && prevB <= b * TS + 1 && !(e.drop > 0))) { e.y = b * TS - e.h; e.vy = 0; e.onGround = true; e.groundTile = [tx, b]; break; }
    }
  } else if (e.vy < 0) {
    let hit = false; for (let tx = l; tx <= r; tx++) if (isSolid(tx, t)) { hit = true; break; }
    if (hit) {
      let fixed = false;
      if (isP) {
        const tb = Math.floor((e.y + e.h - .01) / TS);
        for (let o = 1; o <= 10 && !fixed; o++) for (const s of [-1, 1]) {
          const nx = e.x + s * o, nl = Math.floor(nx / TS), nr = Math.floor((nx + e.w - .01) / TS); let ok = true;
          for (let ty = t; ty <= tb && ok; ty++) for (let tx = nl; tx <= nr; tx++) if (isSolid(tx, ty)) { ok = false; break; }
          if (ok) { e.x = nx; fixed = true; break; }
        }
      }
      if (!fixed) { e.y = (t + 1) * TS; e.vy = 0; }
    }
  }
  e.ride = null;
  if (oneWay && e.vy >= 0 && !(e.drop > 0)) {
    for (const p of movers) {
      if (e.x + e.w > p.x && e.x < p.x + p.w && prevB <= p.y + 3 + Math.max(0, p.dy || 0) && e.y + e.h >= p.y) { e.y = p.y - e.h; e.vy = 0; e.onGround = true; e.ride = p; break; }
    }
  }
}

/* =========================================================
   Players
   ========================================================= */
function playerHurt(dmg, kx, ky, from) {
  if (P.dead || P.downed || P.out || P.inv > 0 || P.dodge > 0 || P.shield > 0 || G.levelDone || G.matchOver || G.countdown > 0) return false;
  const h = P.hero;
  if (G.mode === 'match') { hitPlayer(P, dmg, kx, ky, 'big', from || null); return true; }
  dmg = Math.max(1, Math.round(dmg * DIFF[settings.diff].dmg * (h.id === 'rook' ? .85 : 1)));
  P.hp -= dmg; P.inv = 72; P.hurtT = 18; P.vx = kx; P.vy = ky; P.atk = null; P.combo = 0; P.comboT = 0; P.wall = 0;
  floatText(P.x + 10, P.y - 6, '-' + dmg, '#ff4d6d', 14); addTrauma(.45); G.hitstop = 5; G.hurtFlash = 1; Sound.sfx.hurt(); if (!P.bot && P.src === 'touch') buzz(40);
  burst(P.x + 10, P.y + 18, 12, ['#ff4d6d', '#ffd0d8', '#ffffff'], 5, 26, { add: true, type: 'spark', g: .1 });
  if (P.hp <= 0) { P.hp = 0; downPlayer(P); }
  return true;
}
function downPlayer(p) {
  if (players.length > 1 && alive().length > 1) { p.downed = 1; p.downT = 900; p.revive = 0; p.atk = null; p.vx = 0; p.vy = -6; Sound.sfx.die(); floatText(p.x + 10, p.y - 20, 'DOWN!', '#ff4d6d', 16, { crit: true }); return; }
  p.dead = 1; p.deadT = 0; p.vy = -12; p.vx = -p.facing * 3; Sound.sfx.die(); stats.deaths++; slowmo(.5);
}
function teamWipeOrRespawn(p) {
  stats.lives--;
  if (stats.lives < 0) { stats.lives = 0; G.gameOver = 1; G.gameOverT = 0; return; }
  const lead = alive()[0];
  const sx = lead ? lead.x - 20 : checkpoint.x, sy = lead ? lead.y - 10 : checkpoint.y;
  Object.assign(p, { x: sx, y: sy, vx: 0, vy: 0, hp: p.hero.hp, dead: 0, deadT: 0, downed: 0, rot: 0, inv: 110, atk: null, shield: 0, dodge: 0, hurtT: 0, wall: 0 });
  p.meter = Math.floor(p.meter / 2);
  if (!lead) { resetBoss(); Sound.play(LEVEL.song); G.fade = 1; G.fadeDir = -1; for (const q of players) if (q !== p) { Object.assign(q, { x: checkpoint.x, y: checkpoint.y, vx: 0, vy: 0, hp: q.hero.hp, dead: 0, downed: 0, inv: 110, atk: null }); } }
}
function resetBoss() {
  if (!boss || boss.dead) return;
  Object.assign(boss, { hp: boss.max, hpLag: boss.max, state: 'sleep', x: boss.spawnX, y: boss.spawnY, vx: 0, vy: 0, enraged: false, spawned: false, stun: 0 });
  if (arena) arena.active = false;
  for (let i = ents.length - 1; i >= 0; i--) if (ents[i].add) ents.splice(i, 1);
  projs = projs.filter(p => p.owner !== 'e');
}
function startAttack(kind) {
  const h = P.hero;
  if (kind === 'light') {
    const n = (P.atk && P.atk.kind === 'light' && P.atk.n < 3) ? P.atk.n + 1 : 1;
    P.atk = { kind: 'light', n, t: 0, dur: n === 3 ? 22 : 15, active: n === 3 ? [6, 13] : [3, 9], dmg: h.light[n - 1], hit: {} };
    (n === 3 ? Sound.sfx.swing3 : Sound.sfx.swing)();
    if (n === 3) P.vx = P.facing * 5; else P.vx *= .3;
  } else if (kind === 'air') { P.atk = { kind: 'air', n: 0, t: 0, dur: 18, active: [3, 13], dmg: h.light[1] + 2, hit: {} }; Sound.sfx.swing(); }
  else if (kind === 'pogo') { P.atk = { kind: 'pogo', n: 0, t: 0, dur: 18, active: [1, 17], dmg: h.light[0] + 4, hit: {} }; Sound.sfx.swing(); if (P.vy < 2) P.vy = 2; }
  else if (kind === 'heavy') {
    P.heavyCd = 52; P.atk = { kind: 'heavy', n: 0, t: 0, dur: 22, active: [2, 17], dmg: h.heavy, hit: {} }; Sound.sfx.heavy();
    if (h.id === 'rook') { P.atk.dur = 20; P.vx = P.facing * 11; }
    if (h.id === 'kiko') { P.atk.dur = 13; P.atk.active = [0, 13]; P.vx = P.facing * 18; P.vy = 0; P.inv = Math.max(P.inv, 15); burst(P.x + 10, P.y + 20, 10, ['#2de2c3', '#ffffff'], 4, 18, { add: true, type: 'spark', g: 0 }); }
    if (h.id === 'marisol') { P.atk.active = [-1, -1]; P.atk.dur = 20; P.vx = -P.facing * 2.4; projs.push({ kind: 'wave', x: P.x + (P.facing > 0 ? 16 : -40), y: P.y + 2, w: 36, h: 36, vx: P.facing * 7.2, vy: 0, life: 60, dmg: h.heavy, hit: {}, t: 0, owner: P, facing: P.facing }); Sound.sfx.splash(); }
    if (h.id === 'tito') { P.atk.dur = 24; P.atk.active = [2, 15]; P.vy = -14.5; P.vx = P.facing * 3; P.onGround = false; burst(P.x + 10, P.y + 36, 16, ['#ff7b2e', '#ffd166', '#ff4d3a'], 5, 26, { add: true, g: -.05 }); }
  }
}
function useUlt() {
  const h = P.hero; P.meter = 0; Sound.sfx.ult(); addTrauma(.8); G.hitstop = 12; G.flash = .8; G.punch = 1.07; buzz(80);
  floatText(P.x + 10, P.y - 24, h.ult.toUpperCase() + '!', '#ffc65c', 18, { crit: true });
  ringFx(P.x + 10, P.y + 20, 10, 220, h.c.glow, 30, 6);
  const onScreen = e => e.hp !== undefined && !e.dead && e.kind !== 'crate' && !(e.boss && e.state === 'sleep') && e.x + e.w > view.l - 20 && e.x < view.r + 20;
  if (h.id === 'rook') { P.shield = 300; P.hp = Math.min(P.max, P.hp + 25); if (G.mode === 'match') P.dmg = Math.max(0, P.dmg - 25); burst(P.x + 10, P.y + 20, 40, ['#ffc65c', '#fff6d8'], 6, 40, { add: true, g: 0 }); }
  if (h.id === 'kiko') { let i = 0; for (const e of ents) if (onScreen(e)) { e.pending = (e.pending || []); for (let kk = 0; kk < 3; kk++) e.pending.push({ at: G.frame + 8 + i * 5 + kk * 11, dmg: 15, by: P }); i++; } for (const o of players) if (o !== P && !o.out && !o.dead) { o.pending = (o.pending || []); for (let kk = 0; kk < 3; kk++) o.pending.push({ at: G.frame + 8 + i * 5 + kk * 11, dmg: 12, by: P }); i++; } P.inv = Math.max(P.inv, 70); }
  if (h.id === 'marisol') projs.push({ kind: 'tsunami', x: view.l - 80, y: G.cam.cy - 240, w: 80, h: 480, vx: 10, vy: 0, life: 170, dmg: 55, hit: {}, t: 0, owner: P, facing: 1 });
  if (h.id === 'tito') { P.atk = { kind: 'ultpunch', n: 0, t: 0, dur: 32, active: [9, 15], dmg: 75, hit: {} }; }
}
function attackBox() {
  const a = P.atk, h = P.h, f = P.facing, cx = P.x + P.w / 2, fy = P.y + P.h;
  if (a.kind === 'light') { const big = a.n === 3, w = big ? 46 : 36; return { x: f > 0 ? P.x + P.w - 4 : P.x - w + 4, y: P.y - (big ? 10 : 4), w, h: big ? 50 : 40 }; }
  if (a.kind === 'air') return { x: P.x - 26, y: P.y - 12, w: P.w + 52, h: P.h + 22 };
  if (a.kind === 'pogo') return { x: P.x - 10, y: fy - 8, w: P.w + 20, h: 32 };
  if (a.kind === 'ultpunch') return { x: cx - 140, y: fy - 170, w: 280, h: 200 };
  if (h.id === 'tito') return { x: f > 0 ? P.x + 4 : P.x - 28, y: P.y - 30, w: 44, h: 66 };
  if (h.id === 'kiko') return { x: P.x - 20, y: P.y - 4, w: P.w + 40, h: 46 };
  return { x: f > 0 ? P.x + P.w - 6 : P.x - 30, y: P.y - 4, w: 36, h: 46 };
}
/* bot brain: writes into P.in like a controller */
function botThink() {
  const o = P.in, skill = DIFF[settings.diff].bot; for (const key in o) o[key] = 0;
  P.botT--;
  if (G.mode === 'match') {
    const t = nearest(P.x + 10, P.y + 20, P); if (!t) return;
    const dx = t.x - P.x, dy = t.y - P.y, ad = Math.abs(dx), stageL = STAGE.x0, stageR = STAGE.x1, floorY = STAGE.floorY;
    const offStage = P.x < stageL - 10 || P.x + P.w > stageR + 10 || P.y > floorY + 30;
    if (offStage) { const cx = (stageL + stageR) / 2; o.x = sign(cx - P.x); if (P.vy > 2 && (P.jumps > 0 || P.wall) && Math.random() < .4) o.jump = 1; if (P.y > floorY - 40 && P.heavyCd === 0 && (P.hero.id === 'tito' || P.hero.id === 'kiko') && Math.random() < .3) o.spec = 1; if (P.vy > 6 && Math.random() < .2) o.jump = 1; return; }
    if (P.botT <= 0) { P.botT = 10 + Math.random() * 30 * (1.2 - skill); P.botDir = ad > 40 ? sign(dx) : (Math.random() < .3 ? -sign(dx) : sign(dx)); }
    o.x = P.botDir * (ad > 26 ? 1 : .3);
    if (dy < -60 && P.onGround && Math.random() < .08 * skill) o.jump = 1;
    if (dy < -40 && !P.onGround && P.jumps > 0 && Math.random() < .05) o.jump = 1;
    const nearEdgeL = P.x < stageL + 40 && o.x < 0, nearEdgeR = P.x + P.w > stageR - 40 && o.x > 0; if ((nearEdgeL || nearEdgeR) && P.onGround) { o.x = 0; if (ad > 60 && Math.random() < .1) o.jump = 1; }
    if (o.x) { const ax = o.x > 0 ? P.x + P.w + 12 : P.x - 12, gtx = Math.floor(ax / TS); let ground = false; for (let ty = Math.floor((P.y + P.h) / TS); ty < Math.floor((P.y + P.h) / TS) + 6; ty++) if (isSolid(gtx, ty) || isOneWay(gtx, ty)) { ground = true; break; } if (!ground && (P.onGround || P.vy > 0)) { if (Math.abs(dy) < 30 && ad < 90 && P.onGround && Math.random() < .5) { o.x = 0; } else o.x = 0; } }
    if (!P.onGround && (P.x < stageL + 20 || P.x + P.w > stageR - 20)) o.x = sign((stageL + stageR) / 2 - P.x);
    if (ad < 48 && Math.abs(dy) < 44) { if (Math.random() < .12 * skill + .03) o.atk = 1; if (Math.random() < .02 * skill && P.heavyCd === 0) o.spec = 1; }
    else if (ad < 120 && Math.random() < .01 * skill && P.heavyCd === 0) o.spec = 1;
    if (t.atk && t.atk.t < 4 && ad < 70 && Math.random() < .35 * skill && P.dodgeCd === 0 && P.x > stageL + 80 && P.x + P.w < stageR - 80) { o.dodge = 1; o.x = -sign(dx); }
    if (P.meter >= 100 && ad < 160 && Math.random() < .05) o.ult = 1;
    if (P.vy > 0 && dy > 30 && ad < 30 && Math.random() < .3) { o.y = 1; o.atk = 1; }
    return;
  }
  // adventure co-op bot: follow the leader, attack nearby enemies
  const lead = players.find(q => !q.bot && !q.dead && !q.out) || players[0]; let tgt = null, td = 1e9;
  for (const e of ents) { if (e.hp === undefined || e.dead || e.kind === 'crate' || (e.boss && e.state === 'sleep')) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < td && d < 220) { td = d; tgt = e; } }
  const downed = players.find(q => q.downed && q !== P);
  if (downed && Math.abs(downed.x - P.x) < 300) { o.x = sign(downed.x - P.x) * (Math.abs(downed.x - P.x) > 14 ? 1 : 0); if (downed.y < P.y - 40 && P.onGround && Math.random() < .1) o.jump = 1; return; }
  if (tgt) { const dx = tgt.x - P.x; o.x = Math.abs(dx) > 30 ? sign(dx) : 0; if (Math.abs(dx) < 50 && Math.random() < .14 * skill + .04) o.atk = 1; if (tgt.y < P.y - 40 && P.onGround && Math.random() < .08) o.jump = 1; if ((tgt.state === 'charge' || tgt.state === 'telegraph') && Math.random() < .2 * skill && P.dodgeCd === 0) o.dodge = 1; if (P.meter >= 100 && Math.random() < .03) o.ult = 1; return; }
  if (lead && lead !== P) { const dx = lead.x - 40 - P.x; o.x = Math.abs(dx) > 24 ? sign(dx) : 0; if (lead.y < P.y - 30 && P.onGround && Math.random() < .12) o.jump = 1; if (P.hitWall && Math.random() < .3) o.jump = 1; if (P.vy > 4 && P.y > lead.y + 80 && Math.random() < .2) o.jump = 1; }
}
function updatePlayer() {
  const h = P.hero, inp = P.in, just = P.just;
  if (P.out) return;
  if (P.dead) {
    P.deadT++; P.vy += .7; P.y += P.vy; P.x += P.vx; P.rot += .14 * P.facing; P.anim = 'dead';
    if (P.deadT > 75) { if (G.mode === 'match') matchRespawn(P); else teamWipeOrRespawn(P); }
    return;
  }
  if (P.downed) {
    P.downT--; P.vy = Math.min(P.vy + .8, 14); P.vx *= .8; moveBody(P, true, true); P.anim = 'dead';
    let helper = null; for (const q of players) if (q !== P && !q.dead && !q.downed && !q.out && Math.abs(q.x - P.x) < 36 && Math.abs(q.y - P.y) < 50) helper = q;
    if (helper) { P.revive += 1 / (helper.hero.id === 'marisol' ? 50 : 90); if (G.frame % 6 === 0) burst(P.x + 10, P.y + 10, 1, ['#2de2c3', '#ffffff'], 1.5, 20, { add: true, g: -.06 }); } else P.revive = Math.max(0, P.revive - 1 / 180);
    if (P.revive >= 1) { P.downed = 0; P.hp = Math.round(P.max * .4); P.inv = 90; P.revive = 0; Sound.sfx.revive(); floatText(P.x + 10, P.y - 20, 'REVIVED!', '#2de2c3', 16, { crit: true }); ringFx(P.x + 10, P.y + 20, 6, 70, '#2de2c3', 24, 4); if (helper) helper.meter = Math.min(100, helper.meter + 20); }
    else if (P.downT <= 0 || alive().length === 0) { P.downed = 0; P.dead = 1; P.deadT = 40; P.vy = -8; stats.deaths++; }
    return;
  }
  for (const tr of P.trail) tr.life--; P.trail = P.trail.filter(tr => tr.life > 0);
  const frozen = G.cine > 0 || G.countdown > 0 || G.matchOver;
  if (frozen) { P.vx *= .8; P.vy = Math.min(P.vy + .82, 14); moveBody(P, true, true); P.anim = G.matchOver && P.winner ? 'win' : P.onGround ? 'idle' : 'fall'; P.atk = null; updateChain(); return; }
  if (P.ride) { P.x += P.ride.dx || 0; P.y += P.ride.dy || 0; }
  P.comboT = Math.max(0, P.comboT - 1); if (P.comboT === 0) P.combo = 0;
  P.inv = Math.max(0, P.inv - 1); P.hurtT = Math.max(0, P.hurtT - 1); P.heavyCd = Math.max(0, P.heavyCd - 1); P.dodgeCd = Math.max(0, P.dodgeCd - 1); P.shield = Math.max(0, P.shield - 1); P.drop = Math.max(0, P.drop - 1);
  if (P.pending && P.pending.length) { for (let i = P.pending.length - 1; i >= 0; i--) if (P.pending[i].at <= G.frame) { const ph = P.pending.splice(i, 1)[0]; if (ph.by !== P && !P.dead) { parts.push({ x: P.x + 10 + rnd(-14, 14), y: P.y + 20 + rnd(-14, 14), vx: 0, vy: 0, g: 0, drag: 1, life: 12, max: 12, type: 'clone', c: '#2de2c3', sz: 1, f: 1, hero: ph.by.hero }); const sv = P.inv; P.inv = 0; playerHurt(ph.dmg, 0, -3, ph.by); if (P.inv === 0) P.inv = sv; } } }
  const mx = inp.x, dirX = Math.abs(mx) > .3 ? sign(mx) : 0, spdF = clamp((Math.abs(mx) - .2) / .5, .35, 1);
  if (P.dodge > 0) {
    P.dodge--; P.vx = P.dvx; P.vy = P.dvy;
    if (G.frame % 2 === 0) P.trail.push({ x: P.x, y: P.y, f: P.facing, life: 14, anim: 'dodge', phase: 0 });
    if (P.dodge === 0) { P.vx *= .45; P.vy *= .35; }
  } else if (P.hurtT > 0) { P.vx *= G.mode === 'match' ? .96 : .9; }
  else {
    const acc = P.onGround ? h.speed : h.air, lockGround = P.atk && P.onGround && P.atk.kind === 'light';
    if (P.ctrlLock > 0) { P.ctrlLock--; P.vx = lerp(P.vx, dirX * acc, .05); }
    else if (lockGround) P.vx *= .78;
    else if (dirX) { P.vx = lerp(P.vx, dirX * acc * spdF, P.onGround ? .32 : .16); if (!(P.atk && P.atk.kind === 'heavy')) P.facing = dirX; }
    else P.vx = lerp(P.vx, 0, P.onGround ? .38 : .07);
    if (P.atk && P.atk.kind === 'heavy') { const kk = P.atk.t / P.atk.dur; if (h.id === 'rook') P.vx = P.facing * 11 * (1 - kk * .6); if (h.id === 'kiko') P.vx = P.facing * 18 * (1 - kk * .5); }
  }
  if (P.onGround) { P.coyote = 7; P.jumps = h.jumps; P.airDodge = 1; }
  else { if (P.coyote === 1) P.jumps = Math.min(P.jumps, h.jumps - 1); P.coyote = Math.max(0, P.coyote - 1); }
  if (P.wall) P.airDodge = 1;
  P.jbuf = just.jump ? 8 : Math.max(0, P.jbuf - 1);
  const canAct = P.dodge === 0 && P.hurtT === 0 && !(P.atk && (P.atk.kind === 'heavy' || P.atk.kind === 'ultpunch'));
  if (P.jbuf > 0 && canAct) {
    if (inp.y > .5 && P.onGround && ((P.groundTile && isOneWay(P.groundTile[0], P.groundTile[1])) || (P.ride && P.ride.kind !== 'raft'))) { P.drop = 12; P.y += 3; P.onGround = false; P.jbuf = 0; P.coyote = 0; }
    else if (P.coyote > 0) { P.vy = -h.jump; P.coyote = 0; P.jumps = h.jumps - 1; P.onGround = false; P.jbuf = 0; P.sq = -.2; Sound.sfx.jump(); burst(P.x + 10, P.y + 40, 6, ['#fff2d6', '#f0cf95'], 2.4, 18, { g: .05 }); if (P.atk && P.atk.kind === 'light') P.atk = null; }
    else if (P.wall) { P.vy = -h.jump * .95; P.vx = -P.wall * 8; P.facing = -P.wall; P.ctrlLock = 10; P.jumps = Math.max(P.jumps, h.jumps - 1); P.jbuf = 0; P.sq = -.2; Sound.sfx.wall(); burst(P.x + (P.wall > 0 ? 20 : 0), P.y + 20, 8, ['#fff2d6', '#c7d3df'], 3, 18, { dir: P.wall > 0 ? Math.PI : 0, spread: .8, g: .1 }); P.wall = 0; }
    else if (P.jumps > 0) { P.vy = -h.jump * .9; P.jumps--; P.jbuf = 0; P.sq = -.22; Sound.sfx.djump(); ringFx(P.x + 10, P.y + 40, 4, 26, '#bff7ee', 16, 2.5); burst(P.x + 10, P.y + 36, 8, ['#ffffff', '#bff7ee'], 3, 18, { g: .02, add: true }); if (P.atk && P.atk.kind !== 'pogo') P.atk = null; }
  }
  if (!inp.jump && P.vy < -4.5 && !(P.atk && P.atk.kind === 'heavy') && P.hurtT === 0) P.vy = -4.5;
  if (just.dodge && P.dodge === 0 && P.dodgeCd === 0 && P.hurtT === 0 && (P.onGround || P.airDodge > 0)) {
    let dx = Math.abs(inp.x) > .3 ? inp.x : 0, dy = (!P.onGround && Math.abs(inp.y) > .3) ? inp.y : 0;
    if (!dx && !dy) dx = P.facing; const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    P.dodge = 12; P.dodgeCd = 26; P.dvx = dx * 10.5; P.dvy = dy * 10.5; if (!P.onGround) P.airDodge = 0; if (dx) P.facing = sign(dx); P.atk = null; P.wall = 0;
    Sound.sfx.dodge(); ringFx(P.x + 10, P.y + 20, 6, 30, h.c.glow, 14, 2);
  }
  if (just.atk && canAct && P.dodge === 0) {
    if (P.onGround) { if (!P.atk || (P.atk.kind === 'light' && P.atk.t >= P.atk.dur - 10)) startAttack('light'); }
    else if (!P.atk) startAttack(inp.y > .5 ? 'pogo' : 'air');
  }
  if (just.spec && P.dodge === 0 && P.hurtT === 0 && P.heavyCd === 0 && (!P.atk || P.atk.kind === 'light' || P.atk.kind === 'air')) startAttack('heavy');
  else if (just.spec && P.heavyCd > 0 && !P.atk && !P.bot) floatText(P.x + 10, P.y - 10, 'COOLDOWN', '#94b9c2', 9);
  if (just.ult && P.meter >= 100 && P.hurtT === 0) useUlt();
  if (P.atk) { P.atk.t++; if (P.atk.t >= P.atk.dur) P.atk = null; }
  const vyBefore = P.vy;
  if (P.dodge === 0) {
    let g = .82, maxF = 14;
    if (inp.y > .5 && !P.onGround && P.vy > 0 && !P.wall) { g = 1.4; maxF = 19; }
    if (h.id === 'marisol' && inp.jump && P.vy > 0 && inp.y <= .5 && !P.wall && P.hurtT === 0) { g = .32; maxF = 3.4; if (G.frame % 4 === 0) burst(P.x + 10, P.y + 40, 1, ['#5be7ff', '#e9fbff'], 1, 20, { add: true, g: .02 }); }
    if (P.atk && P.atk.kind === 'air') maxF = Math.min(maxF, 4.5);
    if (P.hurtT > 0 && G.mode === 'match') g = .6;
    P.vy = Math.min(P.vy + g, maxF);
    if (P.wall && P.vy > 2.6) P.vy = 2.6;
  }
  moveBody(P, true, true);
  if (arena && arena.active && P.x < arena.x0 + 2) { P.x = arena.x0 + 2; if (P.vx < 0) P.vx = 0; }
  if (G.mode !== 'match' && P.x < 0) P.x = 0;
  if (P.onGround && P.wasAir) {
    const hard = vyBefore > 11; P.sq = hard ? .28 : .16; Sound.sfx.land();
    burst(P.x + 10, P.y + 40, hard ? 12 : 5, ['#fff2d6', '#f0cf95', '#e2b46e'], hard ? 4 : 2.5, 20, { g: .05, dir: -Math.PI / 2, spread: 1.4 });
    if (hard) addTrauma(.15);
  }
  P.wasAir = !P.onGround;
  P.wall = 0;
  if (!P.onGround && P.dodge === 0 && P.hurtT === 0) {
    const t0 = Math.floor((P.y + 6) / TS), t1 = Math.floor((P.y + P.h - 6) / TS);
    const test = tx => { for (let ty = t0; ty <= t1; ty++) if (!isSolid(tx, ty)) return false; return true; };
    if (inp.x < -.3 && test(Math.floor((P.x - 1) / TS))) P.wall = -1;
    else if (inp.x > .3 && test(Math.floor((P.x + P.w + 1) / TS))) P.wall = 1;
  }
  if (P.wall && P.vy > 0) { P.facing = -P.wall; if (G.frame % 5 === 0) burst(P.x + (P.wall > 0 ? 20 : 0), P.y + 30, 1, ['#fff2d6', '#c7d3df'], 1, 16, { g: .05 }); }
  if (P.onGround && P.groundTile && tile(P.groundTile[0], P.groundTile[1]) === 'X') { const kk = P.groundTile.join(','); if (!crumbled[kk]) crumbled[kk] = { t: 0, gone: false, tx: P.groundTile[0], ty: P.groundTile[1] }; }
  // hazards (adventure)
  if (G.mode !== 'match') {
    const tx0 = Math.floor(P.x / TS), tx1 = Math.floor((P.x + P.w - 1) / TS), tyF = Math.floor((P.y + P.h - 1) / TS), tyM = Math.floor((P.y + P.h * .6) / TS);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tile(tx, tyF) === 'S' && P.y + P.h > tyF * TS + 12) playerHurt(20, (P.x + 10 < tx * TS + 16 ? -1 : 1) * 4, -10);
      if (tile(tx, tyM) === 'W' && !P.dead) {
        Sound.sfx.splash(); burst(P.x + 10, tyM * TS, 22, ['#5be7ff', '#bff7ee', '#ffffff'], 6, 34, { g: .25, dir: -Math.PI / 2, spread: 1 });
        const lost = Math.round(25 * DIFF[settings.diff].dmg); P.hp -= lost; P.shield = 0;
        if (P.hp <= 0) { P.hp = 0; downPlayer(P); if (P.downed) { P.downed = 0; P.dead = 1; P.deadT = 40; } }
        else { const lead = alive().find(q => q !== P); P.x = lead ? lead.x : checkpoint.x; P.y = lead ? lead.y - 10 : checkpoint.y; P.vx = P.vy = 0; P.inv = 90; floatText(P.x + 10, P.y - 10, '-' + lost, '#ff4d6d', 14); if (!lead) { G.fade = .85; G.fadeDir = -1; } }
        break;
      }
    }
  } else {
    // blast zones
    const W = MW * TS, H = MH * TS;
    if (P.x < -90 || P.x > W + 70 || P.y > H + 40 || P.y < -420) knockOut(P);
  }
  if (P.dodge > 0) P.anim = 'dodge';
  else if (P.hurtT > 0) P.anim = 'hurt';
  else if (P.atk) P.anim = P.atk.kind;
  else if (P.wall && P.vy > 0) P.anim = 'wall';
  else if (!P.onGround) P.anim = P.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(P.vx) > .6) { const pp = P.phase; P.anim = 'run'; P.phase += Math.abs(P.vx) * .11; if (Math.floor(pp / Math.PI) !== Math.floor(P.phase / Math.PI)) burst(P.x + 10 - P.facing * 6, P.y + 40, 2, ['#fff2d6', '#f0cf95'], 1.2, 14, { g: -.02 }); }
  else P.anim = 'idle';
  P.sq = lerp(P.sq, 0, .2);
  if (P.shield > 0 && G.frame % 5 === 0) burst(P.x + 10, P.y + 20, 1, ['#ffc65c'], 1.5, 24, { add: true, g: -.04 });
  if (h.id === 'tito' && P.atk && (P.atk.kind === 'heavy' || P.atk.kind === 'ultpunch') && G.frame % 2 === 0) burst(P.x + 10 + P.facing * 12, P.y + 6, 2, ['#ff7b2e', '#ffd166'], 2, 18, { add: true, g: -.15 });
  updateChain();
  if (P.atk && P.atk.t >= P.atk.active[0] && P.atk.t <= P.atk.active[1]) {
    const a = P.atk, hb = attackBox();
    const kbFor = e => { let kx = 2.6 * P.facing, ky = -2.6, kind = 'light';
      if (a.kind === 'light' && a.n === 3) { kx = 7 * P.facing; ky = -6; kind = 'big'; }
      if (a.kind === 'air') { kx = 4 * (sign(e.x + e.w / 2 - P.x - P.w / 2) || P.facing); ky = -4; }
      if (a.kind === 'pogo') { kx = 0; ky = 3; }
      if (a.kind === 'heavy') { kx = 9 * P.facing; ky = h.id === 'tito' ? -13 : -6; kind = 'heavy'; }
      if (a.kind === 'ultpunch') { kx = 12 * (sign(e.x - P.x) || 1); ky = -12; kind = 'heavy'; }
      return [kx, ky, kind]; };
    for (const e of ents) {
      if (e.hp === undefined || e.dead || (e.boss && e.state === 'sleep') || a.hit[e.id] || !overlap(hb, e)) continue;
      a.hit[e.id] = 1; const [kx, ky, kind] = kbFor(e); hitEnemy(e, a.dmg, kx, ky, kind);
      if (a.kind === 'pogo') { P.vy = -12; P.jumps = Math.max(P.jumps, 1); P.airDodge = 1; P.atk = null; Sound.sfx.pogo(); ringFx(P.x + 10, P.y + 42, 4, 30, h.c.glow, 14, 3); break; }
    }
    if (G.mode === 'match' && P.atk) for (const o of players) {
      if (o === P || o.out || o.dead || a.hit['p' + o.idx] || !overlap(hb, o)) continue;
      if (o.inv > 0 || o.dodge > 0 || o.shield > 0) continue;
      a.hit['p' + o.idx] = 1; const [kx, ky, kind] = kbFor(o); hitPlayer(o, a.dmg, kx, ky, kind, P);
      if (a.kind === 'pogo') { P.vy = -12; P.jumps = Math.max(P.jumps, 1); P.atk = null; Sound.sfx.pogo(); break; }
    }
    if (P.atk) for (const pr of projs) if (pr.owner === 'e' && !pr.dead && overlap(hb, pr)) { pr.dead = true; burst(pr.x + pr.w / 2, pr.y + pr.h / 2, 10, ['#ffffff', h.c.glow], 4, 18, { add: true, type: 'spark', g: 0 }); floatText(pr.x, pr.y - 10, 'DEFLECT', '#2de2c3', 10); Sound.sfx.hit(); }
  }
}
function updateChain() {
  const h = P.hero, ch = P.chain; if (h.id !== 'kiko' && h.id !== 'marisol') return;
  const f = P.facing, mar = h.id === 'marisol';
  ch[0].x = P.x + P.w / 2 - f * (mar ? 6 : 2); ch[0].y = P.y + P.h - (mar ? 42 : 31) + (P.anim === 'dodge' ? 6 : 0);
  for (let i = 1; i < ch.length; i++) {
    const c = ch[i], pr = ch[i - 1];
    const tx = pr.x - f * 5 - P.vx * .35, ty = pr.y + (mar ? 4.5 : 1) + Math.sin(G.frame * .16 + i * .9) * (mar ? .8 : 1.6);
    c.x = lerp(c.x, tx, .45); c.y = lerp(c.y, ty, .45);
    const dx = c.x - pr.x, dy = c.y - pr.y, d = Math.hypot(dx, dy) || 1, L = mar ? 5.5 : 6.5;
    c.x = pr.x + dx / d * L; c.y = pr.y + dy / d * L;
  }
}
/* match: damage % + knockback */
function hitPlayer(o, dmg, kx, ky, kind, from) {
  if (o.shield > 0) { floatText(o.x + 10, o.y - 12, 'BLOCK', '#ffc65c', 11); return; }
  const rookBlock = o.atk && o.atk.kind === 'heavy' && o.hero.id === 'rook' && from && (o.facing > 0) === (from.x > o.x);
  if (rookBlock) { floatText(o.x + 10, o.y - 12, 'BLOCK', '#2de2c3', 11); Sound.sfx.hit(); return; }
  dmg = Math.round(dmg * (o.hero.id === 'rook' ? .85 : 1));
  o.dmg += dmg; if (from) { from.dealt += dmg; from.combo++; from.comboT = 100; from.meter = Math.min(100, from.meter + (kind === 'light' ? 5 : 8)); o.lastHit = from.idx; o.lastHitT = G.frame; stats.combo = Math.max(stats.combo, from.combo); }
  const mult = kind === 'light' ? 1 : kind === 'big' ? 1.7 : 2.3, kb = (2.2 + o.dmg * .075) * mult / o.hero.bulk;
  const dirx = sign(kx) || (from ? sign(o.x - from.x) || 1 : 1);
  o.vx = dirx * kb; o.vy = kind === 'light' ? -kb * .5 - 1 : Math.min(-kb * .85, ky * .5); o.hurtT = Math.round(10 + kb * 1.4); o.inv = kind === 'light' ? 6 : 10; o.atk = null; o.wall = 0; o.dodge = 0;
  floatText(o.x + 10, o.y - 8, dmg, kind === 'light' ? '#ffffff' : '#ffc65c', kind === 'light' ? 12 : 16, { crit: kind !== 'light' });
  (kind === 'light' ? Sound.sfx.hit : Sound.sfx.hit2)(); G.hitstop = kind === 'light' ? 3 : 6 + Math.min(6, kb * .2 | 0); addTrauma(kind === 'light' ? .12 : .3 + Math.min(.4, kb * .02)); if (o.src === 'touch') buzz(kind === 'light' ? 12 : 30);
  if (kind !== 'light') G.punch = Math.max(G.punch, 1.025);
  burst(o.x + 10, o.y + 20, kind === 'light' ? 8 : 14, ['#ffffff', '#ffe7a8', from ? from.hero.c.glow : '#fff'], kind === 'light' ? 5 : 7, 18, { add: true, type: 'spark', g: 0, drag: .88 });
  ringFx(o.x + 10, o.y + 20, 4, kind === 'light' ? 24 : 40, '#ffffff', 12, kind === 'light' ? 2.5 : 4);
  if (kb > 18) { slowmo(.12); o.launch = 1; }
}
function knockOut(o) {
  if (o.out || o.dead) return;
  o.stocks--; stats.deaths++; o.dead = 1; o.deadT = 20; o.vx = 0; o.vy = 0;
  const killer = (o.lastHit >= 0 && G.frame - o.lastHitT < 400) ? players.find(q => q.idx === o.lastHit) : null;
  if (killer) { killer.kos++; killer.meter = Math.min(100, killer.meter + 25); floatText(killer.x + 10, killer.y - 24, 'KO!', '#ffc65c', 20, { crit: true }); }
  Sound.sfx.ko(); addTrauma(.9); G.flash = .7; G.punch = 1.06; slowmo(.5); buzz(60);
  const ex = clamp(o.x + 10, view.l + 30, view.r - 30), ey = clamp(o.y + 20, view.t + 30, view.b - 30);
  burst(ex, ey, 40, [o.col, '#ffffff', '#ffc65c'], 9, 40, { add: true, type: 'spark', g: .1 }); ringFx(ex, ey, 10, 160, o.col, 24, 6);
  floatText(ex, ey - 20, o.bot ? 'BOT ' + (o.idx + 1) + ' OUT' : 'P' + (o.idx + 1) + ' OUT', o.col, 16, { crit: true });
  if (o.stocks <= 0) { o.out = true; o.dead = 0; checkMatchEnd(); }
}
function matchRespawn(o) {
  if (o.out) return;
  o.dead = 0; o.deadT = 0; o.rot = 0; o.dmg = 0; o.hp = o.max; o.inv = 150; o.atk = null; o.hurtT = 0; o.launch = 0;
  const sp = spawns[o.idx % spawns.length] || { x: MW * TS / 2, y: 100 }; o.x = (STAGE.x0 + STAGE.x1) / 2 - 10 + (o.idx - 1.5) * 40; o.y = 2 * TS; o.vx = 0; o.vy = 0; o.jumps = o.hero.jumps;
  o.plat = 140; ringFx(o.x + 10, o.y + 20, 4, 60, o.col, 20, 3);
}
function checkMatchEnd() {
  const left = inPlay();
  if (left.length <= 1 && players.length >= 2 && !G.matchOver) { G.matchOver = 1; G.matchT = 0; if (left[0]) { left[0].winner = 1; } Sound.stop(); Sound.sfx.win(); slowmo(1); G.flash = 1; progress.matches = (progress.matches || 0) + 1; saveProgress(); }
}

/* =========================================================
   Enemies, pickups, projectiles, hazards
   ========================================================= */
function enemyLedgeAhead(e) {
  const ax = e.dir > 0 ? e.x + e.w + 3 : e.x - 3, ftx = Math.floor(ax / TS), fty = Math.floor((e.y + e.h + 3) / TS);
  return e.onGround && !isSolid(ftx, fty) && !isOneWay(ftx, fty);
}
function hitEnemy(e, dmg, kx, ky, kind) {
  if (e.kind === 'crate') {
    e.dead = true; Sound.sfx.crate(); burst(e.x + 14, e.y + 14, 18, ['#b9773e', '#e2a466', '#2de2c3'], 6, 32, { g: .35 });
    for (let i = 0; i < 4; i++) ents.push({ kind: 'coin', x: e.x + 6, y: e.y, w: 16, h: 16, t: i * 7, vx: (i - 1.5) * 2.4, vy: -7 - i * .6, loose: 1 });
    if (Math.random() < .35) ents.push({ kind: 'heart', x: e.x + 5, y: e.y, w: 18, h: 16, t: 0 });
    return;
  }
  const stunned = e.boss && e.state === 'stunned';
  let mult = stunned ? 1.8 : 1;
  const recent = G.frame - (e.lastHitF || -999) < 60 && e.lastHitBy !== undefined && e.lastHitBy !== P.idx; if (recent) mult *= 1.15;
  e.lastHitF = G.frame; e.lastHitBy = P.idx;
  dmg = Math.round(dmg * mult);
  e.hp -= dmg; e.flash = 8;
  if (P.hero.id === 'tito') e.burn = 3;
  if (!e.boss) { e.vx = kx; e.vy = e.fly ? ky * .5 : ky; e.stun = 16; if (e.kind === 'd' && e.state !== 'patrol') e.state = 'rise'; }
  P.combo++; P.comboT = 100; stats.combo = Math.max(stats.combo, P.combo); P.meter = Math.min(100, P.meter + (kind === 'light' ? 5 : 8));
  const big = kind !== 'light';
  floatText(e.x + e.w / 2, e.y - 8, dmg, stunned ? '#ff6b4a' : recent ? '#2de2c3' : big ? '#ffc65c' : '#ffffff', big ? 16 : 12, { crit: stunned || big });
  if (recent && G.frame % 3 === 0) floatText(e.x + e.w / 2, e.y - 26, 'TEAM!', '#2de2c3', 10);
  (big ? Sound.sfx.hit2 : Sound.sfx.hit)(); G.hitstop = big ? 6 : 3; addTrauma(big ? .3 : .12); if (P.src === 'touch') buzz(big ? 25 : 10);
  if (big) G.punch = Math.max(G.punch, 1.025);
  const hx = e.x + e.w / 2, hy = e.y + e.h / 2;
  burst(hx, hy, big ? 14 : 8, ['#ffffff', '#ffe7a8', P.hero.c.glow], big ? 7 : 5, 18, { add: true, type: 'spark', g: 0, drag: .88 });
  ringFx(hx, hy, 4, big ? 40 : 24, '#ffffff', 12, big ? 4 : 2.5);
  if (e.hp <= 0) killEnemy(e, kx);
}
function killEnemy(e, kx) {
  if (e.dead) return;
  e.dead = true; stats.kos++; if (P) P.meter = Math.min(100, P.meter + 12); Sound.sfx.kill(); addTrauma(.25);
  const n = e.boss ? 16 : 1 + ((Math.random() * 2.2) | 0);
  for (let i = 0; i < n; i++) ents.push({ kind: 'coin', x: e.x + e.w / 2 - 8, y: e.y, w: 16, h: 16, t: i * 5, vx: rnd(-4, 4), vy: rnd(-10, -5), loose: 1 });
  if (e.boss) {
    slowmo(1.4); G.flash = 1; G.punch = 1.1; addTrauma(1); Sound.sfx.win(); Sound.play(LEVEL.song);
    floatText(e.x + e.w / 2, e.y - 30, 'BIG CLAW DOWN!', '#ffc65c', 22, { crit: true });
    for (let kk = 0; kk < 4; kk++) ringFx(e.x + e.w / 2, e.y + e.h / 2, 10, 120 + kk * 60, kk % 2 ? '#ff6b4a' : '#ffc65c', 30 + kk * 8, 6);
    burst(e.x + e.w / 2, e.y + e.h / 2, 60, ['#ff6b4a', '#ffc65c', '#ffffff', '#5be7ff'], 10, 60, { add: true, type: 'spark', g: .05, drag: .95 });
    if (arena) { arena.cleared = true; arena.active = false; Sound.sfx.gate(); for (const [tx, ty] of arena.gate) { setTile(tx, ty, '.'); burst(tx * TS + 16, ty * TS + 16, 6, ['#ff6b4a', '#ffc65c'], 4, 30, { add: true, g: -.05 }); } }
  }
  corpses.push(Object.assign({}, e, { vx: (kx ? sign(kx) : -e.dir) * (e.boss ? 1 : 4) + e.vx * .3, vy: e.boss ? -6 : -8, rot: 0, vr: rnd(-.25, .25) * (e.boss ? .2 : 1), life: e.boss ? 60 : 26, flash: 0 }));
}
function updateEnts() {
  for (const p of plats) { p.t += 1 / 60; const o = Math.sin(p.t * 1.1) * p.range / 2; if (p.axis === 'x') { const nx = p.ox + o; p.dx = nx - p.x; p.x = nx; p.dy = 0; } else { const ny = p.oy - p.range / 2 - o; p.dy = ny - p.y; p.y = ny; p.dx = 0; } }
  if (raft) { raft.t += 1 / 60; const ny = raft.oy + Math.sin(raft.t * 2) * 2; raft.dy = ny - raft.y; raft.y = ny; raft.dx = 0; }
  if (exitP) exitP.t++;
  for (const kk in crumbled) { const c = crumbled[kk]; c.t++; if (!c.gone && c.t > 30) { c.gone = true; burst(c.tx * TS + 16, c.ty * TS + 6, 10, ['#b9773e', '#e2a466'], 3, 28, { g: .3 }); Sound.sfx.crate(); } else if (c.gone && c.t > 240) delete crumbled[kk]; }
  for (const L of lasers) {
    const c = (G.frame + L.off) % L.period, prev = L.state;
    L.state = c < L.offT ? 0 : c < L.offT + L.warnT ? 1 : 2;
    const near = Math.abs(L.x - G.cam.cx) < G.viewW;
    if (L.state === 2 && prev !== 2 && near) Sound.sfx.laser();
    if (L.state === 2) {
      if (G.frame % 3 === 0 && near) burst(L.x, L.bottom - 2, 2, ['#ff6b4a', '#ffd0c2', '#ffffff'], 3, 14, { add: true, type: 'spark', g: .1, dir: -Math.PI / 2, spread: 1.3 });
      for (const pl of players) { P = pl; if (!pl.dead && !pl.downed && overlap({ x: L.x - 5, y: L.top, w: 10, h: L.bottom - L.top }, pl) && playerHurt(18, (pl.x + 10 < L.x ? -1 : 1) * 6, -7)) Sound.sfx.zap(); }
    }
  }
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i]; if (!e) continue; e.t = (e.t || 0) + 1;
    if (e.kind === 'coin') {
      if (e.loose) {
        e.vy += .6; e.x += e.vx; e.y += e.vy;
        const ty = Math.floor((e.y + e.h) / TS), tx = Math.floor((e.x + 8) / TS);
        if (e.vy > 0 && (isSolid(tx, ty) || isOneWay(tx, ty))) { e.y = ty * TS - e.h; e.vy = -e.vy * .4; e.vx *= .7; }
        if (tile(tx, Math.floor((e.y + 8) / TS)) === 'W' || e.y > MH * TS + 100) { ents.splice(i, 1); continue; }
        if (e.t > 24 && Math.abs(e.vy) < 1 && Math.abs(e.vx) < .3) e.loose = 0;
      }
      let taken = false;
      for (const pl of players) {
        if (pl.dead || pl.downed || pl.out) continue;
        const dx = pl.x + 10 - (e.x + 8), dy = pl.y + 20 - (e.y + 8), d = Math.hypot(dx, dy);
        if (d < 80 && (!e.loose || e.t > 18)) { e.x += dx * .2; e.y += dy * .2; e.loose = 0; }
        if (overlap(pl, e)) { taken = true; stats.coins++; pl.score++; Sound.sfx.coin(); burst(e.x + 8, e.y + 8, 6, ['#ffc65c', '#fff6d8'], 2.5, 16, { add: true, g: 0 }); pl.meter = Math.min(100, pl.meter + 1); break; }
      }
      if (taken) ents.splice(i, 1);
      continue;
    }
    if (e.kind === 'heart') { for (const pl of players) if (!pl.dead && !pl.downed && !pl.out && overlap(pl, e) && (pl.hp < pl.max || G.mode === 'match')) { ents.splice(i, 1); pl.hp = Math.min(pl.max, pl.hp + 30); pl.dmg = Math.max(0, pl.dmg - 30); Sound.sfx.heart(); floatText(pl.x + 10, pl.y - 10, '+30', '#ff4d6d', 14); burst(e.x + 9, e.y + 8, 14, ['#ff4d6d', '#ffffff'], 3, 26, { add: true, g: -.05 }); break; } continue; }
    if (e.kind === 'shell') { for (const pl of players) if (!pl.dead && !pl.downed && overlap(pl, e)) { ents.splice(i, 1); stats.shells++; stats.got[e.key] = 1; Sound.sfx.shell(); floatText(pl.x + 10, pl.y - 20, 'PACT SHELL ' + stats.shells + '/3', '#2de2c3', 16, { crit: true }); ringFx(e.x + 10, e.y + 10, 6, 90, '#2de2c3', 30, 5); burst(e.x + 10, e.y + 10, 30, ['#2de2c3', '#ffffff', '#ffc65c'], 6, 40, { add: true, g: -.02 }); G.hitstop = 8; buzz(30); break; } continue; }
    if (e.kind === 'beacon') { if (!e.on) for (const pl of players) if (!pl.dead && !pl.downed && overlap(pl, e)) { e.on = true; e.t = 0; checkpoint = { x: e.x - 6, y: e.y + e.h - 40 }; Sound.sfx.beacon(); floatText(e.x + 4, e.y - 12, 'CHECKPOINT', '#2de2c3', 13); ringFx(e.x + 4, e.y + 6, 4, 60, '#2de2c3', 26, 4); for (const q of players) { q.hp = Math.min(q.max, q.hp + 15); if (q.downed) { q.downed = 0; q.hp = Math.round(q.max * .5); q.inv = 60; } } break; } continue; }
    if (e.kind === 'bounce') { e.sq = Math.max(0, e.sq - 1); for (const pl of players) if (pl.vy > 0 && !pl.dead && !pl.downed && overlap(pl, e) && pl.y + pl.h < e.y + 12) { pl.vy = -19; pl.jumps = pl.hero.jumps; pl.airDodge = 1; e.sq = 12; pl.sq = -.3; Sound.sfx.bounce(); burst(e.x + 14, e.y, 10, ['#ffffff', '#ff9fb3'], 4, 20, { add: true }); } continue; }
    if (e.kind === 'crate') { if (e.dead) ents.splice(i, 1); continue; }
    if (e.dead) { ents.splice(i, 1); continue; }
    if (e.pending && e.pending.length) {
      for (let kk = e.pending.length - 1; kk >= 0 && !e.dead; kk--) if (e.pending[kk].at <= G.frame) { const ph = e.pending.splice(kk, 1)[0]; P = ph.by; parts.push({ x: e.x + e.w / 2 + rnd(-14, 14), y: e.y + e.h / 2 + rnd(-14, 14), vx: 0, vy: 0, g: 0, drag: 1, life: 12, max: 12, type: 'clone', c: '#2de2c3', sz: 1, f: Math.random() < .5 ? 1 : -1, hero: ph.by.hero }); hitEnemy(e, ph.dmg, 0, -2, 'heavy'); }
      if (e.dead) { const j = ents.indexOf(e); if (j >= 0) ents.splice(j, 1); continue; }
    }
    if (e.burn > 0 && G.frame % 30 === 0) { e.burn--; e.hp -= 3; floatText(e.x + e.w / 2, e.y - 6, 3, '#ff7b2e', 10); burst(e.x + e.w / 2, e.y + 4, 4, ['#ff7b2e', '#ffd166'], 2, 18, { add: true, g: -.15 }); if (e.hp <= 0) { killEnemy(e, 0); const j = ents.indexOf(e); if (j >= 0) ents.splice(j, 1); continue; } }
    e.flash = Math.max(0, e.flash - 1);
    if (e.boss) e.hpLag = lerp(e.hpLag, e.hp, .04);
    if (e.stun > 0 && !e.boss) {
      e.stun--;
      if (e.fly) { e.x += e.vx; e.y += e.vy; e.vx *= .86; e.vy *= .86; if (e.kind === 'j' || e.kind === 'm') e.baseY = lerp(e.baseY, e.y, .3); }
      else { e.vy += e.g; e.vx *= .88; moveBody(e, true, false); }
      continue;
    }
    const T = nearestTarget(e.x + e.w / 2, e.y + e.h / 2), noT = T.dummy;
    const dxp = (T.x + T.w / 2) - (e.x + e.w / 2), dyp = (T.y + T.h / 2) - (e.y + e.h / 2);
    if (e.kind === 'c') {
      e.cd = Math.max(0, e.cd - 1);
      if (e.state === 'walk') { e.vx = e.dir * e.speed; if (enemyLedgeAhead(e) || e.hitWall) e.dir *= -1; if (e.cd === 0 && Math.abs(dxp) < 170 && Math.abs(dyp) < 50 && !noT) { e.state = 'telegraph'; e.st = 24; e.dir = dxp > 0 ? 1 : -1; e.vx = 0; } }
      else if (e.state === 'telegraph') { e.vx = 0; if (--e.st <= 0) { e.state = 'charge'; e.st = 34; } }
      else if (e.state === 'charge') { e.vx = e.dir * 6.4; if (enemyLedgeAhead(e) || e.hitWall || --e.st <= 0) { e.state = 'rest'; e.st = 30; e.vx = 0; } if (G.frame % 3 === 0) burst(e.x + e.w / 2, e.y + e.h, 1, ['#fff2d6', '#f0cf95'], 1.5, 14, { g: -.02 }); }
      else if (e.state === 'rest') { e.vx = 0; if (--e.st <= 0) { e.state = 'walk'; e.cd = 90; } }
      else e.state = 'walk';
      e.vy += e.g; moveBody(e, true, false);
    } else if (e.kind === 's') {
      if (e.onGround) { e.vx *= .7; e.sq = lerp(e.sq, 0, .2); if (--e.cd <= 0) { const near = Math.abs(dxp) < 280 && !noT; e.dir = near ? (dxp > 0 ? 1 : -1) : (Math.random() < .5 ? 1 : -1); e.vx = e.dir * (near ? 3.4 : 2); e.vy = near ? -10.4 : -8; e.cd = near ? 55 : 90; e.sq = -.3; burst(e.x + 14, e.y + 22, 4, ['#fff2d6'], 2, 14, { g: .05 }); } }
      const wasAir = !e.onGround; e.vy += e.g; moveBody(e, true, false); if (e.hitWall) e.dir *= -1; if (e.onGround && wasAir) e.sq = .3;
    } else if (e.kind === 'j') {
      const near = Math.abs(dxp) < 320 && !noT;
      e.vx = lerp(e.vx, near ? clamp(dxp, -1, 1) * .7 : Math.sin(e.t / 60) * .6, .05);
      e.x += e.vx; e.y = e.baseY + Math.sin(e.t / 25) * 14;
      if (isSolid(Math.floor(e.x / TS), Math.floor(e.y / TS)) || isSolid(Math.floor((e.x + e.w) / TS), Math.floor(e.y / TS))) e.vx *= -1;
    } else if (e.kind === 'm') {
      e.dir = dxp > 0 ? 1 : -1; e.cd = Math.max(0, e.cd - 1);
      if (e.state === 'wind') {
        if (--e.st <= 0) {
          e.state = 'idle'; e.cd = 120;
          const vy = -11, g = .56, dy = Math.max(20, T.y + 20 - e.y), tt = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g, dist = (T.x + T.vx * 18) - e.x;
          projs.push({ kind: 'coconut', x: e.x + 8, y: e.y, w: 14, h: 14, vx: clamp(dist / tt, -8, 8), vy, g, life: 300, owner: 'e', dmg: 12, t: 0 });
          Sound.sfx.throwc();
        }
      } else if (e.cd === 0 && Math.abs(dxp) < 380 && !noT) { e.state = 'wind'; e.st = 26; }
    } else if (e.kind === 'd') {
      e.cd = Math.max(0, e.cd - 1);
      if (e.state === 'patrol') {
        const near = Math.abs(dxp) < 400 && !noT;
        e.vx = lerp(e.vx, near ? clamp(dxp * .03, -3.2, 3.2) : Math.sin(e.t / 50) * 1.2, .08); e.x += e.vx;
        e.y = lerp(e.y, e.baseY + Math.sin(e.t / 22) * 6, .1);
        if (near && Math.abs(dxp) < 28 && dyp > 30 && e.cd === 0) { e.state = 'lock'; e.st = 36; Sound.sfx.lock(); }
      } else if (e.state === 'lock') { e.x += clamp(dxp * .06, -1.4, 1.4); if (--e.st <= 0) { e.state = 'dive'; e.vy = 2; } }
      else if (e.state === 'dive') {
        e.vy = Math.min(e.vy + 1.2, 15); e.y += e.vy;
        const ty = Math.floor((e.y + e.h) / TS), tx = Math.floor((e.x + e.w / 2) / TS);
        if (isSolid(tx, ty) || isOneWay(tx, ty) || tile(tx, ty) === 'W' || e.y > e.baseY + 360) { e.state = 'rise'; e.vy = 0; addTrauma(.2); Sound.sfx.crate(); burst(e.x + 15, e.y + 16, 14, ['#ff6b4a', '#ffd0c2', '#ffffff'], 5, 20, { add: true, type: 'spark', g: .1 }); }
      } else if (e.state === 'rise') { e.y -= 3.2; e.x += e.vx * .3; if (e.y <= e.baseY) { e.y = e.baseY; e.state = 'patrol'; e.cd = 70; } }
      if (isSolid(Math.floor((e.x + (e.vx > 0 ? e.w : 0)) / TS), Math.floor((e.y + e.h / 2) / TS))) e.vx *= -1;
    } else if (e.kind === 'Z') updateBoss(e, dxp, T);
    for (const pl of players) {
      if (pl.dead || pl.downed || pl.out || e.dead || !overlap(pl, e) || (e.boss && (e.state === 'sleep' || e.state === 'intro'))) continue;
      P = pl; const ddx = pl.x + pl.w / 2 - (e.x + e.w / 2);
      const blocked = pl.atk && pl.atk.kind === 'heavy' && pl.hero.id === 'rook' && (pl.facing > 0) === (ddx < 0);
      if (!blocked) playerHurt(e.contact * (e.state === 'charge' ? 1.3 : 1), (ddx > 0 ? 1 : -1) * (e.boss ? 9 : 5.5), -8);
      else if (!e.boss) { e.vx = pl.facing * 8; e.stun = 18; }
    }
  }
  // projectiles
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.t++; p.life--;
    if (p.kind === 'coconut' || p.kind === 'bubble') {
      p.vy += p.g; p.x += p.vx; p.y += p.vy;
      const tx = Math.floor((p.x + p.w / 2) / TS), ty = Math.floor((p.y + p.h) / TS);
      if (p.vy > 0 && (isSolid(tx, ty) || isOneWay(tx, ty) || tile(tx, ty) === 'W')) { p.dead = true; burst(p.x + p.w / 2, p.y + p.h, 10, p.kind === 'bubble' ? ['#5be7ff', '#e9fbff'] : ['#6b4423', '#c49a6c'], 4, 22, { g: .3 }); (p.kind === 'bubble' ? Sound.sfx.pop : Sound.sfx.crate)(); }
      if (p.y > MH * TS + 200) p.dead = true;
    } else if (p.kind === 'shock') {
      p.x += p.vx; const tx = Math.floor((p.x + p.w / 2) / TS), ty = Math.floor((p.y + p.h + 2) / TS);
      if (!isSolid(tx, ty) || isSolid(Math.floor((p.vx > 0 ? p.x + p.w : p.x) / TS), Math.floor((p.y + 4) / TS))) p.dead = true;
      if (G.frame % 2 === 0) burst(p.x + p.w / 2, p.y + p.h, 2, ['#fff2d6', '#f0cf95'], 2.5, 16, { g: .15, dir: -Math.PI / 2, spread: .8 });
    } else {
      p.x += p.vx; p.y += p.vy;
      if (p.kind === 'wave') { const tx = Math.floor((p.vx > 0 ? p.x + p.w : p.x) / TS), ty = Math.floor((p.y + p.h / 2) / TS); if (isSolid(tx, ty)) p.dead = true; if (G.frame % 2 === 0) burst(p.x + rnd(0, p.w), p.y + rnd(0, p.h), 1, ['#5be7ff', '#ffffff'], 1.5, 16, { add: true, g: .05 }); }
      else if (G.frame % 2 === 0) burst(p.x + p.w, p.y + rnd(0, p.h), 4, ['#5be7ff', '#bff7ee', '#ffffff'], 4, 24, { g: .1 });
    }
    if (p.owner !== 'e' && p.owner !== 'h') {
      P = p.owner;
      for (const e of ents) { if (e.hp === undefined || e.dead || (e.boss && e.state === 'sleep') || p.hit[e.id] || !overlap(p, e)) continue; p.hit[e.id] = 1; hitEnemy(e, p.dmg, sign(p.vx) * (p.kind === 'tsunami' ? 11 : 7), -5, 'heavy'); }
      if (G.mode === 'match') for (const o of players) { if (o === p.owner || o.out || o.dead || o.inv > 0 || o.dodge > 0 || p.hit['p' + o.idx] || !overlap(p, o)) continue; p.hit['p' + o.idx] = 1; hitPlayer(o, p.dmg, sign(p.vx) * 9, -6, 'heavy', p.owner); }
    } else {
      for (const pl of players) {
        if (pl.dead || pl.downed || pl.out || !overlap(p, pl)) continue; P = pl;
        const blocked = pl.atk && pl.atk.kind === 'heavy' && pl.hero.id === 'rook';
        if (blocked) { p.dead = true; floatText(pl.x + 10, pl.y - 12, 'BLOCK', '#2de2c3', 11); Sound.sfx.hit(); burst(p.x + p.w / 2, p.y + p.h / 2, 10, ['#ffffff', '#ffc65c'], 4, 16, { add: true, type: 'spark', g: 0 }); }
        else if (playerHurt(p.dmg, (sign(p.vx) || 1) * 5, -7)) p.dead = p.kind !== 'wave' && p.kind !== 'tsunami';
      }
    }
    if (p.life <= 0 || p.dead) projs.splice(i, 1);
  }
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i]; c.vy += c.boss ? .25 : .6; c.x += c.vx; c.y += c.vy; c.rot += c.vr; c.life--;
    if (c.boss && G.frame % 4 === 0) burst(c.x + rnd(0, c.w), c.y + rnd(0, c.h), 3, ['#ff6b4a', '#ffc65c', '#ffffff'], 4, 26, { add: true, type: 'spark', g: 0 });
    if (c.life <= 0) {
      const cols = c.kind === 'j' ? ['#a58bff', '#e3d9ff'] : c.kind === 's' ? ['#ffd36b', '#fff2b8'] : c.kind === 'd' ? ['#cfd8e3', '#ff6b4a', '#5be7ff'] : c.kind === 'm' ? ['#8b5a2b', '#d9a066'] : ['#ff7a52', '#ffc4a8', '#ffffff'];
      burst(c.x + c.w / 2, c.y + c.h / 2, c.boss ? 50 : 18, cols, c.boss ? 9 : 5, 32, { g: .2 }); ringFx(c.x + c.w / 2, c.y + c.h / 2, 4, c.boss ? 140 : 36, '#ffffff', 16, 3);
      corpses.splice(i, 1);
    }
  }
  // level end: every active player on the raft / in the portal
  if (!G.levelDone && G.mode !== 'match') {
    const ex = raft ? { x: raft.x, y: raft.y - 40, w: raft.w, h: 46 } : exitP;
    const ready = ex && (!arena || arena.cleared) && alive().length > 0 && alive().every(pl => overlap(pl, ex));
    if (ready) { G.levelDone = 1; G.levelT = 0; Sound.stop(); Sound.sfx.win(); buzz(60); burst(ex.x + ex.w / 2, ex.y + 20, 50, ['#ffc65c', '#2de2c3', '#ffffff', '#ff6b4a'], 7, 60, { add: true, g: -.02 }); }
    else if (ex && alive().length > 1 && alive().some(pl => overlap(pl, ex)) && G.frame % 60 === 0) floatText(ex.x + ex.w / 2, ex.y - 20, 'WAITING FOR TEAM', '#ffc65c', 11);
  }
}
function updateBoss(e, dxp, T) {
  if (e.state === 'sleep') {
    if (arena && alive().some(pl => pl.x > arena.x0 + 140)) { e.state = 'intro'; e.st = 110; arena.active = true; G.cine = 110; Sound.play('boss'); Sound.sfx.roar(); addTrauma(.6); buzz(60); for (const pl of players) if (pl.x < arena.x0 + 10 && !pl.dead) { pl.x = arena.x0 + 20; } }
    e.vy += e.g; moveBody(e, true, false); return;
  }
  const spd = e.enraged ? 1.45 : 1;
  if (e.hp < e.max * .5 && !e.spawned) {
    e.spawned = true;
    for (let kk = 0; kk < 2; kk++) { const c = makeEnemy('c', Math.floor((arena.x0 + 200 + kk * 520) / TS), 2); c.add = true; c.vy = 4; ents.push(c); }
    floatText(e.x + e.w / 2, e.y - 24, 'REINFORCEMENTS!', '#ff6b4a', 14); Sound.sfx.roar();
  }
  if (e.hp < e.max * .3 && !e.enraged) { e.enraged = true; floatText(e.x + e.w / 2, e.y - 24, 'ENRAGED!', '#ff4d6d', 18, { crit: true }); Sound.sfx.roar(); addTrauma(.6); }
  e.st--;
  if (e.state === 'intro') { e.vx = 0; if (e.st === 60) { Sound.sfx.roar(); addTrauma(.5); } if (e.st <= 0) { e.state = 'walk'; e.st = 50; } }
  else if (e.state === 'walk') {
    e.dir = dxp > 0 ? 1 : -1; e.vx = e.dir * 1.8 * spd;
    if (e.st <= 0) { const r = Math.random(); if (e.hp < e.max * .65 && r < .3) { e.state = 'volley'; e.st = 64; e.shots = 0; } else if (Math.abs(dxp) < 140 || r < .55) { e.state = 'slam'; e.vy = -17; e.air = false; Sound.sfx.whoosh(); } else { e.state = 'telegraph'; e.st = 40; } }
  }
  else if (e.state === 'telegraph') { e.vx = 0; if (G.frame % 4 === 0) burst(e.x + (e.dir > 0 ? 0 : e.w), e.y + e.h, 3, ['#fff2d6', '#f0cf95'], 3, 14, { g: .05 }); if (e.st <= 0) { e.state = 'charge'; e.st = 66; e.dir = dxp > 0 ? 1 : -1; Sound.sfx.whoosh(); } }
  else if (e.state === 'charge') {
    e.vx = e.dir * 10.4 * spd; if (G.frame % 2 === 0) burst(e.x + e.w / 2, e.y + e.h, 2, ['#fff2d6', '#f0cf95'], 3, 16, { g: -.02 });
    if (e.hitWall) { e.state = 'stunned'; e.st = 100; e.vx = 0; addTrauma(.75); G.punch = 1.04; Sound.sfx.slam(); floatText(e.x + e.w / 2, e.y - 24, 'STUNNED · HIT NOW', '#ffc65c', 13); burst(e.x + (e.dir > 0 ? e.w : 0), e.y + 16, 22, ['#ffffff', '#ffc65c', '#5be7ff'], 7, 26, { add: true, type: 'spark', g: .05 }); }
    else if (e.st <= 0) { e.state = 'walk'; e.st = 50; }
  }
  else if (e.state === 'stunned') { e.vx = 0; if (G.frame % 9 === 0) parts.push({ x: e.x + rnd(10, e.w - 10), y: e.y - 8, vx: 0, vy: -.4, g: 0, drag: 1, life: 24, max: 24, type: 'star', c: '#ffc65c', sz: 4, add: true }); if (e.st <= 0) { e.state = 'walk'; e.st = 50; } }
  else if (e.state === 'slam') {
    e.vx = e.dir * 2.4; if (!e.onGround) e.air = true;
    if (e.onGround && e.air) {
      e.state = 'walk'; e.st = 70 / spd; addTrauma(.85); G.punch = 1.05; Sound.sfx.slam(); buzz(50);
      burst(e.x + e.w / 2, e.y + e.h, 26, ['#fff2d6', '#f0cf95', '#e2b46e'], 6, 32, { g: .2, dir: -Math.PI / 2, spread: 1.4 }); ringFx(e.x + e.w / 2, e.y + e.h, 10, 120, '#fff2d6', 20, 5);
      for (const s of [-1, 1]) projs.push({ kind: 'shock', x: s < 0 ? e.x - 24 : e.x + e.w, y: e.y + e.h - 22, w: 24, h: 22, vx: s * 6.4 * spd, vy: 0, life: 110, owner: 'e', dmg: 15, t: 0 });
    }
  }
  else if (e.state === 'volley') {
    e.vx = 0;
    if (e.st % 16 === 0 && e.shots < 3 + (e.enraged ? 2 : 0)) {
      e.shots++; const dist = T.x - (e.x + e.w / 2) + rnd(-60, 60), tt = 52;
      projs.push({ kind: 'bubble', x: e.x + e.w / 2 - 10, y: e.y - 6, w: 20, h: 20, vx: clamp(dist / tt, -9, 9), vy: -12, g: .42, life: 240, owner: 'e', dmg: 12, t: 0 });
      Sound.sfx.pop();
    }
    if (e.st <= 0) { e.state = 'walk'; e.st = 50; }
  }
  e.vy += e.g; moveBody(e, false, false);
  if (arena) { const bx = e.x; e.x = clamp(e.x, arena.x0 + 4, arena.x1 - e.w - 4); if (e.x !== bx) e.hitWall = bx < e.x ? -1 : 1; }
}
/* stage hazards (match) */
function updateHazards() {
  if (!STAGE || !settings.hazards || G.matchOver || G.countdown > 0) return;
  G.hazardT++;
  const W = MW * TS;
  if (STAGE.hazard === 'wave') {
    if (G.hazardT === 2100) { G.hazardWarn = 120; floatText(G.cam.cx, G.cam.cy - 120, 'WAVE INCOMING', '#5be7ff', 18, { crit: true }); Sound.sfx.whoosh(); }
    if (G.hazardT >= 2220) { G.hazardT = 0; projs.push({ kind: 'tsunami', x: -120, y: MH * TS - 9 * TS, w: 80, h: 5 * TS, vx: 9, vy: 0, life: 200, dmg: 9, hit: {}, t: 0, owner: 'h', facing: 1 }); Sound.sfx.splash(); addTrauma(.3); }
  } else if (STAGE.hazard === 'coconut') {
    if (G.hazardT % 150 === 0) { const x = rnd(9 * TS, 38 * TS); projs.push({ kind: 'coconut', x, y: -40, w: 14, h: 14, vx: rnd(-1, 1), vy: 2, g: .4, life: 400, owner: 'h', dmg: 10, t: 0 }); }
  } else if (STAGE.hazard === 'geyser') {
    for (const gz of geysers) {
      gz.t++;
      if (gz.state === 0 && gz.t > 330 + gz.x % 90) { gz.state = 1; gz.t = 0; }
      else if (gz.state === 1) { if (G.frame % 4 === 0) burst(gz.x + rnd(-14, 14), gz.y, 2, ['#ff7a3a', '#ffd27a'], 1.5, 18, { add: true, g: -.1 }); if (gz.t > 60) { gz.state = 2; gz.t = 0; Sound.sfx.geyser(); addTrauma(.3); } }
      else if (gz.state === 2) { if (G.frame % 2 === 0) burst(gz.x + rnd(-16, 16), gz.y - rnd(0, 180), 3, ['#ff7a3a', '#ffd27a', '#fff'], 3, 20, { add: true, g: -.2 }); for (const pl of players) if (!pl.dead && !pl.out && pl.inv === 0 && pl.dodge === 0 && overlap(pl, { x: gz.x - 18, y: gz.y - 190, w: 36, h: 190 })) hitPlayer(pl, 12, 0, -14, 'heavy', null); if (gz.t > 40) { gz.state = 0; gz.t = 0; } }
    }
  }
  // tsunami hazard hits
  for (const p of projs) if (p.owner === 'h' && (p.kind === 'tsunami')) for (const o of players) { if (o.out || o.dead || o.inv > 0 || o.dodge > 0 || p.hit['p' + o.idx] || !overlap(p, o)) continue; p.hit['p' + o.idx] = 1; hitPlayer(o, p.dmg, 8, -5, 'big', null); }
}
function updateFx() {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life--; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; if (p.life <= 0) parts.splice(i, 1); }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life--; t.y -= t.life > 36 ? 1.4 : .3; if (t.life <= 0) texts.splice(i, 1); }
  G.flash = Math.max(0, G.flash - .05); G.hurtFlash = Math.max(0, G.hurtFlash - .04);
  G.trauma = Math.max(0, G.trauma - .022); G.punch = lerp(G.punch, 1, .1);
}

/* =========================================================
   Camera & simulation step
   ========================================================= */
function updateCamera() {
  const vw0 = cv.width / G.Zbase, vh0 = cv.height / G.Zbase;
  let tx, ty, z = 1;
  if (G.mode === 'match') {
    const ps = inPlay().filter(p => !p.dead); const W = MW * TS, H = MH * TS;
    let minx = W * .2, maxx = W * .8, miny = H * .2, maxy = H * .75;
    for (const p of ps) { minx = Math.min(minx, p.x - 90); maxx = Math.max(maxx, p.x + p.w + 90); miny = Math.min(miny, p.y - 100); maxy = Math.max(maxy, p.y + p.h + 60); }
    minx = Math.max(minx, -60); maxx = Math.min(maxx, W + 60); miny = Math.max(miny, -200); maxy = Math.min(maxy, H + 20);
    z = clamp(Math.min(vw0 / (maxx - minx), vh0 / (maxy - miny + 120)), .55, 1.05);
    tx = (minx + maxx) / 2; ty = (miny + maxy) / 2 + (vh0 / z) * .13;
  } else {
    const ps = alive().length ? alive() : players.filter(p => !p.out);
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, lead = null;
    for (const p of ps) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x + p.w); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y + p.h); if (!lead || p.x > lead.x) lead = p; }
    if (!lead) { lead = players[0]; minx = lead.x; maxx = lead.x + 20; miny = lead.y; maxy = lead.y + 40; }
    tx = (minx + maxx) / 2 + (ps.length === 1 ? lead.facing * vw0 * .08 + lead.vx * 8 : 0);
    ty = (miny + maxy) / 2 + (G.portrait ? vh0 * .1 : -vh0 * .06);
    if (G.cine > 0 && boss) tx = (boss.x + boss.w / 2 + lead.x) / 2;
    if (G.levelDone && raft) tx = raft.x + 36;
    if (ps.length > 1) z = clamp(Math.min(vw0 / (maxx - minx + 260), vh0 / (maxy - miny + 220)), .62, 1);
    const vw = vw0 / z, vh = vh0 / z;
    let lo = vw / 2, hi = MW * TS - vw / 2;
    if (arena && arena.active) { lo = arena.x0 + vw / 2; hi = arena.x1 - vw / 2; }
    tx = lo > hi ? (lo + hi) / 2 : clamp(tx, lo, hi);
    ty = Math.min(ty, (G.portrait ? MH * TS + vh * .08 : MH * TS) - vh / 2);
    // teleport stragglers next to the leader
    for (const p of ps) if (p !== lead && Math.abs(p.x - lead.x) > vw0 * 1.1 && p.y > lead.y - 40) { p.x = lead.x - 30; p.y = lead.y - 20; p.vx = p.vy = 0; p.inv = 60; ringFx(p.x + 10, p.y + 20, 4, 40, p.col, 16, 3); }
  }
  G.cam.cx = lerp(G.cam.cx, tx, .1); G.cam.cy = lerp(G.cam.cy, ty, .09); G.cam.z = lerp(G.cam.z, z, .06);
  G.Z = G.Zbase * G.cam.z; G.viewW = cv.width / G.Z; G.viewH = cv.height / G.Z;
}
function pollPlayers() {
  for (const pl of players) {
    if (pl.bot) { P = pl; if (!pl.dead && !pl.downed && !pl.out && G.countdown === 0 && !G.matchOver && !G.levelDone) botThink(); else for (const key in pl.in) pl.in[key] = 0; }
    else readSrc(pl.src, pl.in);
    edge(pl.in, pl.prev, pl.just);
  }
}
function step() {
  G.frame++; G.t += 1 / 60;
  if (G.fadeDir) { G.fade = clamp(G.fade + G.fadeDir * .045, 0, 1); if (G.fade === 0 || G.fade === 1) G.fadeDir = 0; }
  if (G.scene !== 'play') return;
  G.bannerT++;
  if (G.hitstop > 0) { G.hitstop--; return; }
  if (G.countdown > 0) { const c = G.countdown; G.countdown--; if (c === 180 || c === 120 || c === 60) Sound.sfx.count(); if (c === 1) { Sound.sfx.go(); G.flash = .4; } for (const pl of players) { P = pl; updatePlayer(); } updateFx(); updateCamera(); return; }
  if (G.levelDone) {
    G.levelT++; for (const pl of players) { pl.anim = 'win'; if (raft) { pl.x = raft.x + 12 + (pl.idx % 4) * 14; pl.y = raft.y - pl.h; pl.facing = 1; } }
    if (raft) { raft.t += 1 / 60; raft.x += 1.3; raft.y = raft.oy + Math.sin(raft.t * 2) * 2; if (G.frame % 3 === 0) burst(raft.x, raft.y + 10, 2, ['#bff7ee', '#ffffff'], 1.5, 22, { g: .05 }); }
    const fx = raft ? raft.x + 36 : exitP.x + 24, fy = raft ? raft.y : exitP.y + 40;
    if (G.levelT % 20 === 0 && G.levelT < 100) burst(fx + rnd(-30, 30), fy - rnd(40, 120), 24, ['#ffc65c', '#2de2c3', '#ff6b4a', '#ffffff'], 6, 40, { add: true, type: 'spark', g: .08 });
    updateFx(); updateCamera(); if (G.levelT === 150) showResults(true); return;
  }
  if (G.gameOver) { G.gameOverT++; updateFx(); if (G.gameOverT === 80) showResults(false); return; }
  if (G.matchOver) { G.matchT++; for (const pl of players) { P = pl; updatePlayer(); } updateFx(); updateCamera(); if (G.matchT === 150) showResults(true); return; }
  stats.time += 1 / 60;
  if (G.cine > 0) G.cine--;
  for (const pl of players) { P = pl; updatePlayer(); if (pl.plat > 0) pl.plat--; }
  updateEnts(); if (G.mode === 'match') updateHazards(); updateCamera(); updateFx();
  P = players[0];
  const low = players.some(p => !p.bot && p.hp > 0 && p.hp < p.max * .25 && !p.dead && G.mode !== 'match');
  if (low && G.frame % 70 === 0) Sound.sfx.heartbeat();
  const tp = players.find(p => p.src === 'touch'); if (tp) { const u = $('tUlt'); u.style.setProperty('--m', tp.meter.toFixed(0)); u.classList.toggle('ready', tp.meter >= 100 && !tp.dead); }
}
