const TAU = Math.PI * 2, OUTLINE = '#0a1a24';
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v, easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function rr(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const glowCache = new Map();
function glow(c, x, y, r, col, a) { if (a <= .01 || r <= 0) return; let s = glowCache.get(col); if (!s) { s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), k = hexRgb(col); gr.addColorStop(0, `rgba(${k[0]},${k[1]},${k[2]},1)`); gr.addColorStop(.3, `rgba(${k[0]},${k[1]},${k[2]},.45)`); gr.addColorStop(1, `rgba(${k[0]},${k[1]},${k[2]},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowCache.set(col, s); } const pc = c.globalCompositeOperation, pa = c.globalAlpha; c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, a); c.drawImage(s, x - r, y - r, r * 2, r * 2); c.globalCompositeOperation = pc; c.globalAlpha = pa; }
const HEROES = [
  { id: 'rook', name: 'Rook Ironhide', role: 'Tank · Shield knight', desc: 'Shield Bash blocks anything in front of him. Fortress Wall makes the whole team untouchable for five seconds.', bulk: 1.18, wlen: 20, c: { skin: '#f0c08a', hair: '#d9dfe8', hair2: '#a7b2c2', body: '#4a6488', body2: '#7f9cc6', limb: '#3e5474', back: '#2a3a52', accent: '#ffc65c', boot: '#2a2230', metal: '#d3dce7', glow: '#ffc65c' } },
  { id: 'kiko', name: 'Kiko Breeze', role: 'Speed · Wind ninja', desc: 'Triple jump, the fastest run, and a Shadow Dash that slices through a whole line of enemies.', bulk: .86, wlen: 11, c: { skin: '#e5b088', hair: '#1d2340', hair2: '#121731', body: '#22345a', body2: '#3d5f99', limb: '#1c2b4a', back: '#121c33', accent: '#2de2c3', boot: '#151a2c', metal: '#d6fff7', glow: '#2de2c3' } },
  { id: 'marisol', name: 'Marisol Tidecaller', role: 'Ranged · Tide mage', desc: 'Wave Push rolls through crowds, she glides when you hold jump, and Tsunami sweeps the screen.', bulk: .95, wlen: 24, c: { skin: '#c58a5c', hair: '#1a7f96', hair2: '#0f5668', body: '#1f9c8c', body2: '#86e0d2', limb: '#17786c', back: '#0e534c', accent: '#ff6b4a', boot: '#124a52', metal: '#e9fbff', glow: '#5be7ff' } },
  { id: 'tito', name: 'Tito Fuego', role: 'Bruiser · Flame boxer', desc: 'Every punch sets enemies on fire. Fire Uppercut launches them, Volcano Fist erupts on impact.', bulk: 1.06, wlen: 6, c: { skin: '#9a6a40', hair: '#ff4d3a', hair2: '#ffb02e', body: '#b8431c', body2: '#f4a261', limb: '#8f3416', back: '#5e200e', accent: '#ffe66d', boot: '#3a1c10', metal: '#ff9a3c', glow: '#ff7b2e' } }
];
function heroPose(h, S) {
  const t = S.t || 0, a = S.anim || 'idle', k = S.k || 0, p = { lean: 0, bob: 0, rot: 0, lT: .1, lB: .12, rT: -.08, rB: .1, lU: -.15, lF: .35, rU: .22, rF: .45 };
  switch (a) {
    case 'idle': { const b = Math.sin(t / 18); p.bob = b * .8; p.lU = -.15 + b * .05; p.rU = .22 - b * .05; break; }
    case 'run': { const ph = S.phase || 0, s = Math.sin(ph), c = Math.cos(ph); p.lT = s * .95; p.lB = .25 + Math.max(0, -c) * 1.3; p.rT = -s * .95; p.rB = .25 + Math.max(0, c) * 1.3; p.rU = s; p.rF = 1; p.lU = -s; p.lF = 1; p.lean = .2; p.bob = -Math.abs(c) * 2.2 + 1; break; }
    case 'win': { const b = Math.abs(Math.sin(t / 10)); Object.assign(p, { rU: 2.75, rF: .2, lU: 2.5, lF: .2, bob: -b * 4, lT: .2, rT: -.2 }); break; }
    case 'light': { const n = S.n || 1; Object.assign(p, { lT: .55, lB: .5, rT: -.45, rB: .35, lean: .22, lU: -.6, lF: .6 }); if (n === 1) { p.rU = lerp(-1.3, 1.9, easeOut(k * 2.2)); p.rF = .25; p.sw = [-1.3, p.rU]; } else if (n === 2) { p.rU = lerp(2.5, .2, easeOut(k * 2.2)); p.rF = .2; p.sw = [2.5, p.rU]; p.lean = .15; } else { p.rU = lerp(3.3, .5, easeOut(k * 1.8)); p.rF = .1; p.sw = [3.3, p.rU]; p.lean = .38; p.bob = k < .3 ? -3 : 0; } break; }
    case 'jump': Object.assign(p, { lT: .95, lB: 1.7, rT: .25, rB: .7, rU: 2.3, rF: .35, lU: 1.9, lF: .4, lean: .06 }); break;
    case 'fall': Object.assign(p, { lT: .25, lB: .35, rT: -.25, rB: .55, rU: 1.5, rF: .5, lU: 1.2, lF: .5 }); break;
  }
  return p;
}
function drawHead(c, h, hc, r, S) {
  const C = h.c, t = S.t || 0, a = S.anim;
  c.fillStyle = C.skin; c.beginPath(); c.arc(hc.x, hc.y, r, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(hc.x - r * .25, hc.y + r * .1, r * .85, Math.PI * .55, Math.PI * 1.25); c.fill();
  if (h.id === 'rook') { c.fillStyle = C.metal; c.beginPath(); c.arc(hc.x, hc.y, r + .8, Math.PI + .25, TAU - .25); c.closePath(); c.fill(); c.fillStyle = C.hair2; c.fillRect(hc.x - r * .9, hc.y - r * .28, r * 1.8, r * .14); c.fillStyle = C.metal; c.fillRect(hc.x + r * .5, hc.y - r * .3, r * .2, r * .6); const sw = Math.sin(t / 9) * 2; c.fillStyle = C.accent; c.beginPath(); c.moveTo(hc.x - r * .1, hc.y - r * .95); c.quadraticCurveTo(hc.x - r * 1.1, hc.y - r * 1.9 + sw, hc.x - r * 1.9, hc.y - r * .9 + sw); c.quadraticCurveTo(hc.x - r * .9, hc.y - r * 1.15, hc.x - r * .4, hc.y - r * .55); c.closePath(); c.fill(); }
  else if (h.id === 'kiko') { c.fillStyle = C.hair; c.beginPath(); c.arc(hc.x, hc.y, r + .6, Math.PI - .15, TAU + .1); c.closePath(); c.fill(); c.save(); c.beginPath(); c.arc(hc.x, hc.y, r, 0, TAU); c.clip(); c.fillStyle = C.hair2; c.fillRect(hc.x - r, hc.y + r * .28, r * 2, r); c.fillStyle = C.accent; c.fillRect(hc.x - r, hc.y - r * .42, r * 2, r * .26); c.restore(); }
  else if (h.id === 'marisol') { c.fillStyle = C.hair; c.beginPath(); c.arc(hc.x, hc.y, r + .8, Math.PI - .5, TAU + .15); c.closePath(); c.fill(); c.beginPath(); c.ellipse(hc.x - r * .55, hc.y + r * .25, r * .55, r * .9, 0, 0, TAU); c.fill(); c.fillStyle = C.accent; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(hc.x - r * .15 + Math.cos(i * 1.57) * 2, hc.y - r * .9 + Math.sin(i * 1.57) * 2, 1.9, 0, TAU); c.fill(); } c.fillStyle = '#ffc65c'; c.beginPath(); c.arc(hc.x - r * .15, hc.y - r * .9, 1.3, 0, TAU); c.fill(); }
  else { for (let layer = 0; layer < 2; layer++) { c.fillStyle = layer ? C.hair2 : C.hair; c.beginPath(); const n = 5; for (let i = 0; i <= n; i++) { const ang = Math.PI * 1.08 + (i / n) * Math.PI * .84, bx = hc.x + Math.cos(ang) * r * .95, by = hc.y + Math.sin(ang) * r * .95, len = (layer ? .45 : .8) * r + Math.sin(t * .35 + i * 1.7) * r * .18, tx = bx + Math.cos(ang) * len - len * .55, ty = by + Math.sin(ang) * len; if (i === 0) c.moveTo(bx, by); c.lineTo(tx, ty); if (i < n) { const ang2 = Math.PI * 1.08 + ((i + .5) / n) * Math.PI * .84; c.lineTo(hc.x + Math.cos(ang2) * r * .9, hc.y + Math.sin(ang2) * r * .9); } } c.closePath(); c.fill(); } }
  const ex = hc.x + r * .42, ey = hc.y - r * .06;
  if ((t % 210) < 7) { c.strokeStyle = OUTLINE; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ex - 2.2, ey); c.lineTo(ex + 2.2, ey); c.stroke(); }
  else { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, r * .22, r * .28, 0, 0, TAU); c.fill(); c.fillStyle = OUTLINE; c.beginPath(); c.arc(ex + r * .08, ey + r * .03, r * .14, 0, TAU); c.fill(); }
  if (h.id !== 'kiko') { c.strokeStyle = 'rgba(60,20,10,.7)'; c.lineWidth = 1.1; c.beginPath(); if (a === 'win') c.arc(hc.x + r * .5, hc.y + r * .38, r * .2, 0, Math.PI); else { c.moveTo(hc.x + r * .38, hc.y + r * .48); c.lineTo(hc.x + r * .62, hc.y + r * .45); } c.stroke(); c.fillStyle = 'rgba(255,107,74,.25)'; c.beginPath(); c.arc(hc.x + r * .2, hc.y + r * .3, r * .18, 0, TAU); c.fill(); }
}
function drawGear(c, h, A, front, p) {
  const C = h.c, hd = A[2], a = A[3], dx = Math.sin(a), dy = Math.cos(a);
  const blade = (len, w, col, edge) => { c.lineCap = 'round'; c.strokeStyle = OUTLINE; c.lineWidth = w + 2.4; c.beginPath(); c.moveTo(hd.x, hd.y); c.lineTo(hd.x + dx * len, hd.y + dy * len); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(hd.x, hd.y); c.lineTo(hd.x + dx * len, hd.y + dy * len); c.stroke(); if (edge) { c.strokeStyle = edge; c.lineWidth = 1; c.beginPath(); c.moveTo(hd.x + dx * 3, hd.y + dy * 3); c.lineTo(hd.x + dx * len, hd.y + dy * len); c.stroke(); } };
  if (h.id === 'rook') { const shield = (cx, cy) => { c.fillStyle = OUTLINE; c.beginPath(); c.arc(cx, cy, 10.5, 0, TAU); c.fill(); const g = c.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 10); g.addColorStop(0, '#fff'); g.addColorStop(.3, C.metal); g.addColorStop(1, '#7d8aa0'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 9.2, 0, TAU); c.fill(); c.strokeStyle = C.accent; c.lineWidth = 1.8; c.beginPath(); c.arc(cx, cy, 7, 0, TAU); c.stroke(); c.fillStyle = C.accent; c.beginPath(); c.arc(cx, cy, 2.6, 0, TAU); c.fill(); }; if (front) { blade(20, 3.2, C.metal, '#fff'); c.strokeStyle = C.accent; c.lineWidth = 2.6; c.beginPath(); c.moveTo(hd.x + dx * 2 - dy * 5, hd.y + dy * 2 + dx * 5); c.lineTo(hd.x + dx * 2 + dy * 5, hd.y + dy * 2 - dx * 5); c.stroke(); } else shield(hd.x - 2, hd.y - 2); }
  else if (h.id === 'kiko') blade(front ? 11 : 9, 2.2, C.metal, C.accent);
  else if (h.id === 'marisol' && front) { c.lineCap = 'round'; c.strokeStyle = OUTLINE; c.lineWidth = 5; c.beginPath(); c.moveTo(hd.x - dx * 12, hd.y - dy * 12); c.lineTo(hd.x + dx * 24, hd.y + dy * 24); c.stroke(); c.strokeStyle = '#8a5a32'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(hd.x - dx * 12, hd.y - dy * 12); c.lineTo(hd.x + dx * 24, hd.y + dy * 24); c.stroke(); const ox = hd.x + dx * 26, oy = hd.y + dy * 26; c.fillStyle = OUTLINE; c.beginPath(); c.arc(ox, oy, 5.6, 0, TAU); c.fill(); c.fillStyle = '#c9fbff'; c.beginPath(); c.arc(ox, oy, 4.4, 0, TAU); c.fill(); glow(c, ox, oy, 14, C.glow, .55); }
  else if (h.id === 'tito') { const r = 5.6 * h.bulk; c.fillStyle = OUTLINE; c.beginPath(); c.arc(hd.x, hd.y, r + 1.4, 0, TAU); c.fill(); const g = c.createRadialGradient(hd.x - 2, hd.y - 2, 1, hd.x, hd.y, r); g.addColorStop(0, '#ffe0a8'); g.addColorStop(1, C.metal); c.fillStyle = g; c.beginPath(); c.arc(hd.x, hd.y, r, 0, TAU); c.fill(); if (front) glow(c, hd.x, hd.y, 16, C.glow, .5); }
}
function drawHero(c, h, S, x, y, f, sc) {
  const C = h.c, B = h.bulk, p = heroPose(h, S), tw = 14 * B, lw = 5.6 * B, aw = 4.8 * B, hr = h.id === 'kiko' ? 8.6 : 9.2, L1 = 8.5, L2 = 8.5, A1 = 7.2, A2 = 7.2;
  c.save(); c.translate(x, y); c.scale(f * sc, sc); c.translate(0, p.bob);
  const lean = p.lean, cl = Math.cos(lean), sl = Math.sin(lean), hip = { x: 0, y: -17 }, R = (dx, dy) => ({ x: hip.x + dx * cl - dy * sl, y: hip.y + dx * sl + dy * cl }), sh = R(0, -12.5), hc = R(1, -24.5);
  const leg = (ox, T, Bd) => { const a = { x: hip.x + ox, y: hip.y }, kk = { x: a.x + Math.sin(T) * L1, y: a.y + Math.cos(T) * L1 }; return [a, kk, { x: kk.x + Math.sin(T - Bd) * L2, y: kk.y + Math.cos(T - Bd) * L2 }]; };
  const arm = (ox, U, F) => { const a = { x: sh.x + ox, y: sh.y }, u = U + lean * .5, e = { x: a.x + Math.sin(u) * A1, y: a.y + Math.cos(u) * A1 }; return [a, e, { x: e.x + Math.sin(u + F) * A2, y: e.y + Math.cos(u + F) * A2 }, u + F]; };
  const bL = leg(-2.2 * B, p.lT, p.lB), fL = leg(2.2 * B, p.rT, p.rB), bA = arm(-2.5, p.lU, p.lF), fA = arm(2.5, p.rU, p.rF);
  const line = (pts, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0].x, pts[0].y); c.lineTo(pts[1].x, pts[1].y); c.lineTo(pts[2].x, pts[2].y); c.stroke(); };
  const boot = (pt, col, grow) => { c.fillStyle = col; c.beginPath(); c.ellipse(pt.x + 1.4, pt.y - .5, lw * .72 + grow, lw * .5 + grow, 0, 0, TAU); c.fill(); };
  const hand = (pt, col) => { c.fillStyle = col; c.beginPath(); c.arc(pt.x, pt.y, aw * .55, 0, TAU); c.fill(); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const pass of [0, 1]) {
    const ol = pass === 0;
    line(bA, ol ? aw + 3.2 : aw, ol ? OUTLINE : C.back); if (!ol) { hand(bA[2], C.skin); drawGear(c, h, bA, false, p); }
    line(bL, ol ? lw + 3.2 : lw, ol ? OUTLINE : C.back); boot(bL[2], ol ? OUTLINE : C.boot, ol ? 1.6 : 0);
    c.save(); c.translate(hip.x, hip.y); c.rotate(lean);
    if (ol) { c.fillStyle = OUTLINE; c.beginPath(); rr(c, -tw / 2 - 1.6, -15.6, tw + 3.2, 19.2, 6); c.fill(); }
    else { c.fillStyle = C.body; c.beginPath(); rr(c, -tw / 2, -14, tw, 16, 5); c.fill(); c.fillStyle = C.body2; c.beginPath(); rr(c, -tw / 2 + 1.5, -13, tw - 3, 5, 3); c.fill(); c.fillStyle = C.back; c.fillRect(-tw / 2, -2.5, tw, 3); if (h.id === 'rook') { c.fillStyle = C.metal; c.beginPath(); rr(c, -tw / 2 + 2, -10, tw - 4, 7, 3); c.fill(); c.fillStyle = C.accent; c.beginPath(); c.arc(1, -6.5, 2.2, 0, TAU); c.fill(); } if (h.id === 'kiko') { c.strokeStyle = C.accent; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-tw / 2, -12); c.lineTo(tw / 2, -1); c.stroke(); } if (h.id === 'tito') { c.fillStyle = C.skin; c.fillRect(-1.6, -14, 3.2, 11); } }
    c.restore();
    line(fL, ol ? lw + 3.2 : lw, ol ? OUTLINE : C.limb); boot(fL[2], ol ? OUTLINE : C.boot, ol ? 1.6 : 0);
    if (ol) { c.fillStyle = OUTLINE; c.beginPath(); c.arc(hc.x, hc.y, hr + 1.7, 0, TAU); c.fill(); if (h.id === 'tito') { c.beginPath(); c.arc(hc.x - 2, hc.y - hr * .6, hr * .9, 0, TAU); c.fill(); } } else drawHead(c, h, hc, hr, S);
    line(fA, ol ? aw + 3.2 : aw, ol ? OUTLINE : C.body2); if (!ol) { hand(fA[2], C.skin); drawGear(c, h, fA, true, p); }
  }
  if (p.sw && (S.k || 0) < .8) { const k = S.k || 0, rad = A1 + A2 + h.wlen * .85, a0 = Math.PI / 2 - (p.sw[0] + lean * .5), a1 = Math.PI / 2 - (p.sw[1] + lean * .5), ccw = a1 < a0; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .6 * (1 - k / .8); c.fillStyle = rgba(C.glow, .8); c.beginPath(); c.arc(sh.x, sh.y, rad, a0, a1, ccw); c.arc(sh.x, sh.y, rad * .5, a1, a0, !ccw); c.closePath(); c.fill(); c.restore(); }
  c.restore();
}
