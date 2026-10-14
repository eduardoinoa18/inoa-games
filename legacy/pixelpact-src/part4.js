/* =========================================================
   Rendering · heroes (procedural cartoon rigs)
   ========================================================= */
function heroPose(h, S) {
  const t = S.t || 0, a = S.anim || 'idle', k = S.k || 0;
  const p = { lean: 0, bob: 0, rot: 0, lT: .1, lB: .12, rT: -.08, rB: .1, lU: -.15, lF: .35, rU: .22, rF: .45 };
  switch (a) {
    case 'idle': { const b = Math.sin(t / 18); p.bob = b * .8; p.lU = -.15 + b * .05; p.rU = .22 - b * .05; break; }
    case 'run': { const ph = S.phase || 0, s = Math.sin(ph), c = Math.cos(ph); p.lT = s * .95; p.lB = .25 + Math.max(0, -c) * 1.3; p.rT = -s * .95; p.rB = .25 + Math.max(0, c) * 1.3; p.rU = s * 1.0; p.rF = 1.0; p.lU = -s * 1.0; p.lF = 1.0; p.lean = .2; p.bob = -Math.abs(c) * 2.2 + 1; break; }
    case 'jump': Object.assign(p, { lT: .95, lB: 1.7, rT: .25, rB: .7, rU: 2.3, rF: .35, lU: 1.9, lF: .4, lean: .06 }); break;
    case 'fall': Object.assign(p, { lT: .25, lB: .35, rT: -.25, rB: .55, rU: 1.5, rF: .5, lU: 1.2, lF: .5 }); break;
    case 'wall': Object.assign(p, { lT: .7, lB: 1.1, rT: .2, rB: .9, lU: -1.7, lF: -.2, rU: .6, rF: .8, lean: -.12 }); break;
    case 'dodge': Object.assign(p, { lT: 1.1, lB: 1.9, rT: .55, rB: 1.5, rU: -1.1, rF: .3, lU: -1.3, lF: .3, lean: .55, bob: 7 }); break;
    case 'hurt': Object.assign(p, { lean: -.35, rU: 2.5, rF: .6, lU: 2.7, lF: .6, lT: -.3, lB: .4, rT: .3, rB: .5 }); break;
    case 'dead': Object.assign(p, { lean: -.2, rU: 2.2, rF: .4, lU: 2.6, lF: .4, lT: .4, lB: .6, rT: -.3, rB: .4 }); break;
    case 'win': { const b = Math.abs(Math.sin(t / 10)); Object.assign(p, { rU: 2.75, rF: .2, lU: 2.5, lF: .2, bob: -b * 4, lT: .2, rT: -.2 }); break; }
    case 'light': {
      const n = S.n || 1; Object.assign(p, { lT: .55, lB: .5, rT: -.45, rB: .35, lean: .22, lU: -.6, lF: .6 });
      if (n === 1) { p.rU = lerp(-1.3, 1.9, easeOut(k * 2.2)); p.rF = .25; p.sw = [-1.3, p.rU]; }
      else if (n === 2) { p.rU = lerp(2.5, .2, easeOut(k * 2.2)); p.rF = .2; p.sw = [2.5, p.rU]; p.lean = .15; }
      else { p.rU = lerp(3.3, .5, easeOut(k * 1.8)); p.rF = .1; p.sw = [3.3, p.rU]; p.lean = .38; p.bob = k < .3 ? -3 : 0; }
      break;
    }
    case 'air': Object.assign(p, { rot: easeOut(k * 1.2) * TAU, rU: 1.6, rF: 0, lU: -1.6, lF: 0, lT: .8, lB: 1.3, rT: .6, rB: 1.2, spin: 1 }); break;
    case 'pogo': Object.assign(p, { lT: .9, lB: 1.6, rT: .6, rB: 1.4, rU: -.05, rF: 0, lU: .6, lF: .6, lean: -.05, pogo: 1 }); break;
    case 'heavy':
      if (h.id === 'rook') { const s = Math.sin(t * .6); Object.assign(p, { lean: .45, lU: 1.5, lF: 0, rU: -.6, rF: .8, lT: s * .8, lB: .6, rT: -s * .8, rB: .6, shieldFront: 1 }); }
      else if (h.id === 'kiko') Object.assign(p, { lean: .75, rU: -1.7, rF: 0, lU: -1.9, lF: 0, lT: -.9, lB: .6, rT: .9, rB: .3, dash: 1 });
      else if (h.id === 'marisol') Object.assign(p, { rU: 1.65, rF: 0, lU: .9, lF: .6, lean: .15, lT: .5, lB: .4, rT: -.5, rB: .3, cast: 1 });
      else Object.assign(p, { rU: lerp(.2, 3.1, easeOut(k * 2)), rF: .15, lT: 1.1, lB: 1.6, rT: -.15, rB: .2, lU: -.8, lF: .9, lean: .1, fire: 1 });
      break;
    case 'ultpunch': Object.assign(p, { rU: lerp(-1.2, 1.6, easeOut((k - .2) * 2.5)), rF: 0, lean: .4, lT: .6, lB: .5, rT: -.6, rB: .3, lU: -.9, lF: .8, fire: 1 }); break;
  }
  return p;
}
const OUTLINE = '#0a1a24';
function drawHead(c, h, hc, r, S) {
  const C = h.c, t = S.t || 0, a = S.anim;
  c.fillStyle = C.skin; c.beginPath(); c.arc(hc.x, hc.y, r, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(hc.x - r * .25, hc.y + r * .1, r * .85, Math.PI * .55, Math.PI * 1.25); c.fill();
  if (h.id === 'rook') {
    c.fillStyle = C.metal; c.beginPath(); c.arc(hc.x, hc.y, r + .8, Math.PI + .25, TAU - .25); c.closePath(); c.fill();
    c.fillStyle = C.hair2; c.fillRect(hc.x - r * .9, hc.y - r * .28, r * 1.8, r * .14);
    c.fillStyle = C.metal; c.fillRect(hc.x + r * .5, hc.y - r * .3, r * .2, r * .6);
    const sw = Math.sin(t / 9) * 2; c.fillStyle = C.accent; c.beginPath(); c.moveTo(hc.x - r * .1, hc.y - r * .95); c.quadraticCurveTo(hc.x - r * 1.1, hc.y - r * 1.9 + sw, hc.x - r * 1.9, hc.y - r * .9 + sw); c.quadraticCurveTo(hc.x - r * .9, hc.y - r * 1.15, hc.x - r * .4, hc.y - r * .55); c.closePath(); c.fill();
  } else if (h.id === 'kiko') {
    c.fillStyle = C.hair; c.beginPath(); c.arc(hc.x, hc.y, r + .6, Math.PI - .15, TAU + .1); c.closePath(); c.fill();
    c.save(); c.beginPath(); c.arc(hc.x, hc.y, r, 0, TAU); c.clip();
    c.fillStyle = C.hair2; c.fillRect(hc.x - r, hc.y + r * .28, r * 2, r);
    c.fillStyle = C.accent; c.fillRect(hc.x - r, hc.y - r * .42, r * 2, r * .26);
    c.restore();
  } else if (h.id === 'marisol') {
    c.fillStyle = C.hair; c.beginPath(); c.arc(hc.x, hc.y, r + .8, Math.PI - .5, TAU + .15); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(hc.x - r * .55, hc.y + r * .25, r * .55, r * .9, 0, 0, TAU); c.fill();
    c.fillStyle = C.accent; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(hc.x - r * .15 + Math.cos(i * 1.57) * 2, hc.y - r * .9 + Math.sin(i * 1.57) * 2, 1.9, 0, TAU); c.fill(); }
    c.fillStyle = '#ffc65c'; c.beginPath(); c.arc(hc.x - r * .15, hc.y - r * .9, 1.3, 0, TAU); c.fill();
  } else {
    for (let layer = 0; layer < 2; layer++) {
      c.fillStyle = layer ? C.hair2 : C.hair; c.beginPath();
      const n = 5;
      for (let i = 0; i <= n; i++) {
        const ang = Math.PI * 1.08 + (i / n) * Math.PI * .84, bx = hc.x + Math.cos(ang) * r * .95, by = hc.y + Math.sin(ang) * r * .95;
        const len = (layer ? .45 : .8) * r + Math.sin(t * .35 + i * 1.7) * r * .18, tx = bx + Math.cos(ang) * len - len * .55, ty = by + Math.sin(ang) * len;
        if (i === 0) c.moveTo(bx, by); c.lineTo(tx, ty);
        if (i < n) { const ang2 = Math.PI * 1.08 + ((i + .5) / n) * Math.PI * .84; c.lineTo(hc.x + Math.cos(ang2) * r * .9, hc.y + Math.sin(ang2) * r * .9); }
      }
      c.closePath(); c.fill();
    }
  }
  const ex = hc.x + r * .42, ey = hc.y - r * .06;
  if (a === 'hurt' || a === 'dead') { c.strokeStyle = OUTLINE; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ex - 2, ey - 2); c.lineTo(ex + 1.5, ey); c.lineTo(ex - 2, ey + 2); c.stroke(); }
  else if ((t % 210) < 7) { c.strokeStyle = OUTLINE; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ex - 2.2, ey); c.lineTo(ex + 2.2, ey); c.stroke(); }
  else { c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(ex, ey, r * .22, r * .28, 0, 0, TAU); c.fill(); c.fillStyle = OUTLINE; c.beginPath(); c.arc(ex + r * .08, ey + r * .03, r * .14, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(ex + r * .1, ey - r * .1, 1, 1); }
  if (h.id !== 'kiko') { c.strokeStyle = 'rgba(60,20,10,.7)'; c.lineWidth = 1.1; c.beginPath(); if (a === 'win') c.arc(hc.x + r * .5, hc.y + r * .38, r * .2, 0, Math.PI); else { c.moveTo(hc.x + r * .38, hc.y + r * .48); c.lineTo(hc.x + r * .62, hc.y + r * .45); } c.stroke(); c.fillStyle = 'rgba(255,107,74,.25)'; c.beginPath(); c.arc(hc.x + r * .2, hc.y + r * .3, r * .18, 0, TAU); c.fill(); }
}
function drawGear(c, h, A, front, p, S) {
  const C = h.c, hd = A[2], a = A[3], dx = Math.sin(a), dy = Math.cos(a), B = h.bulk;
  const blade = (len, w, col, edge) => {
    c.lineCap = 'round'; c.strokeStyle = OUTLINE; c.lineWidth = w + 2.4; c.beginPath(); c.moveTo(hd.x, hd.y); c.lineTo(hd.x + dx * len, hd.y + dy * len); c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(hd.x, hd.y); c.lineTo(hd.x + dx * len, hd.y + dy * len); c.stroke();
    if (edge) { c.strokeStyle = edge; c.lineWidth = 1; c.beginPath(); c.moveTo(hd.x + dx * 3, hd.y + dy * 3); c.lineTo(hd.x + dx * len, hd.y + dy * len); c.stroke(); }
  };
  if (h.id === 'rook') {
    const shield = (cx, cy) => { c.fillStyle = OUTLINE; c.beginPath(); c.arc(cx, cy, 10.5, 0, TAU); c.fill(); const g = c.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 10); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, C.metal); g.addColorStop(1, '#7d8aa0'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 9.2, 0, TAU); c.fill(); c.strokeStyle = C.accent; c.lineWidth = 1.8; c.beginPath(); c.arc(cx, cy, 7, 0, TAU); c.stroke(); c.fillStyle = C.accent; c.beginPath(); c.arc(cx, cy, 2.6, 0, TAU); c.fill(); };
    if (front) { blade(20, 3.2, C.metal, '#ffffff'); c.strokeStyle = C.accent; c.lineWidth = 2.6; c.beginPath(); c.moveTo(hd.x + dx * 2 - dy * 5, hd.y + dy * 2 + dx * 5); c.lineTo(hd.x + dx * 2 + dy * 5, hd.y + dy * 2 - dx * 5); c.stroke(); if (p.shieldFront) shield(hd.x + 4, hd.y - 6); }
    else if (!p.shieldFront) shield(hd.x - 2, hd.y - 2);
  } else if (h.id === 'kiko') { blade(front ? 11 : 9, 2.2, C.metal, C.accent); if (p.dash || S.anim === 'light') glow(c, hd.x + dx * 8, hd.y + dy * 8, 8, C.glow, .5); }
  else if (h.id === 'marisol' && front) {
    c.lineCap = 'round'; c.strokeStyle = OUTLINE; c.lineWidth = 5; c.beginPath(); c.moveTo(hd.x - dx * 12, hd.y - dy * 12); c.lineTo(hd.x + dx * 24, hd.y + dy * 24); c.stroke();
    c.strokeStyle = '#8a5a32'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(hd.x - dx * 12, hd.y - dy * 12); c.lineTo(hd.x + dx * 24, hd.y + dy * 24); c.stroke();
    const ox = hd.x + dx * 26, oy = hd.y + dy * 26; c.fillStyle = OUTLINE; c.beginPath(); c.arc(ox, oy, 5.6, 0, TAU); c.fill(); c.fillStyle = '#c9fbff'; c.beginPath(); c.arc(ox, oy, 4.4, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ox - 1.2, oy - 1.2, 1.4, 0, TAU); c.fill();
    glow(c, ox, oy, p.cast ? 26 : 14, C.glow, p.cast ? .9 : .55);
  } else if (h.id === 'tito') {
    const r = 5.6 * B; c.fillStyle = OUTLINE; c.beginPath(); c.arc(hd.x, hd.y, r + 1.4, 0, TAU); c.fill();
    const g = c.createRadialGradient(hd.x - 2, hd.y - 2, 1, hd.x, hd.y, r); g.addColorStop(0, '#ffe0a8'); g.addColorStop(1, C.metal); c.fillStyle = g; c.beginPath(); c.arc(hd.x, hd.y, r, 0, TAU); c.fill();
    c.strokeStyle = C.accent; c.lineWidth = 1.3; c.beginPath(); c.arc(hd.x, hd.y, r * .62, -1, 1); c.stroke();
    if (front && p.fire) glow(c, hd.x, hd.y, 22, C.glow, .9);
  }
}
function drawHero(c, h, S, x, y, f, sc, o) {
  o = o || {}; sc = sc || 1;
  const C = h.c, B = h.bulk, p = heroPose(h, S);
  const tw = 14 * B, lw = 5.6 * B, aw = 4.8 * B, hr = h.id === 'kiko' ? 8.6 : 9.2, L1 = 8.5, L2 = 8.5, A1 = 7.2, A2 = 7.2;
  c.save(); c.translate(x, y);
  const sq = S.sq || 0; c.scale(f * sc * (1 + sq), sc * (1 - sq));
  if (S.deadRot) { c.translate(0, -8); c.rotate(S.deadRot); }
  if (p.rot) { c.translate(0, -22); c.rotate(p.rot); c.translate(0, 22); }
  c.translate(0, p.bob);
  const lean = p.lean, cl = Math.cos(lean), sl = Math.sin(lean), hip = { x: 0, y: -17 };
  const R = (dx, dy) => ({ x: hip.x + dx * cl - dy * sl, y: hip.y + dx * sl + dy * cl });
  const sh = R(0, -12.5), hc = R(1, -24.5);
  const leg = (ox, T, Bd) => { const a = { x: hip.x + ox, y: hip.y }, kk = { x: a.x + Math.sin(T) * L1, y: a.y + Math.cos(T) * L1 }; return [a, kk, { x: kk.x + Math.sin(T - Bd) * L2, y: kk.y + Math.cos(T - Bd) * L2 }]; };
  const arm = (ox, U, F) => { const a = { x: sh.x + ox, y: sh.y }, u = U + lean * .5, e = { x: a.x + Math.sin(u) * A1, y: a.y + Math.cos(u) * A1 }; return [a, e, { x: e.x + Math.sin(u + F) * A2, y: e.y + Math.cos(u + F) * A2 }, u + F]; };
  const bL = leg(-2.2 * B, p.lT, p.lB), fL = leg(2.2 * B, p.rT, p.rB), bA = arm(-2.5, p.lU, p.lF), fA = arm(2.5, p.rU, p.rF);
  const sil = o.sil;
  if (!sil) {
    if (p.dash) { c.strokeStyle = rgba(C.glow, .5); c.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const yy = -40 + i * 9; c.beginPath(); c.moveTo(-14 - i * 3, yy); c.lineTo(-44 - i * 6, yy); c.stroke(); } }
    if (p.spin) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(C.glow, .45); c.lineWidth = 6; c.beginPath(); c.arc(0, -22, 27, 0, TAU); c.stroke(); c.restore(); }
  }
  const line = (pts, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0].x, pts[0].y); c.lineTo(pts[1].x, pts[1].y); c.lineTo(pts[2].x, pts[2].y); c.stroke(); };
  const boot = (pt, col, grow) => { c.fillStyle = col; c.beginPath(); c.ellipse(pt.x + 1.4, pt.y - .5, lw * .72 + grow, lw * .5 + grow, 0, 0, TAU); c.fill(); };
  const hand = (pt, col) => { c.fillStyle = col; c.beginPath(); c.arc(pt.x, pt.y, aw * .55, 0, TAU); c.fill(); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const pass of (sil ? [0] : [0, 1])) {
    const ol = pass === 0, OC = sil || (o.outline || OUTLINE);
    line(bA, ol ? aw + 3.2 : aw, ol ? OC : C.back);
    if (!ol) { hand(bA[2], C.skin); drawGear(c, h, bA, false, p, S); }
    line(bL, ol ? lw + 3.2 : lw, ol ? OC : C.back);
    boot(bL[2], ol ? OC : C.boot, ol ? 1.6 : 0);
    c.save(); c.translate(hip.x, hip.y); c.rotate(lean);
    if (ol) { c.fillStyle = OC; c.beginPath(); rr(c, -tw / 2 - 1.6, -15.6, tw + 3.2, 19.2, 6); c.fill(); }
    else {
      c.fillStyle = C.body; c.beginPath(); rr(c, -tw / 2, -14, tw, 16, 5); c.fill();
      c.fillStyle = C.body2; c.beginPath(); rr(c, -tw / 2 + 1.5, -13, tw - 3, 5, 3); c.fill();
      c.fillStyle = C.back; c.fillRect(-tw / 2, -2.5, tw, 3);
      if (h.id === 'rook') { c.fillStyle = C.metal; c.beginPath(); rr(c, -tw / 2 + 2, -10, tw - 4, 7, 3); c.fill(); c.fillStyle = C.accent; c.beginPath(); c.arc(1, -6.5, 2.2, 0, TAU); c.fill(); }
      if (h.id === 'kiko') { c.strokeStyle = C.accent; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-tw / 2, -12); c.lineTo(tw / 2, -1); c.stroke(); }
      if (h.id === 'marisol') { c.fillStyle = C.body2; c.beginPath(); c.moveTo(-4, -14); c.lineTo(4, -14); c.lineTo(0, -9); c.closePath(); c.fill(); c.strokeStyle = '#e9fbff'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4, -5); c.quadraticCurveTo(-2, -8, 0, -5); c.quadraticCurveTo(2, -2, 4, -5); c.stroke(); }
      if (h.id === 'tito') { c.fillStyle = C.skin; c.fillRect(-1.6, -14, 3.2, 11); c.fillStyle = C.accent; c.beginPath(); c.moveTo(2.5, -9); c.lineTo(5, -4); c.lineTo(3, -5.5); c.lineTo(3.5, -2); c.lineTo(1, -6); c.closePath(); c.fill(); }
    }
    c.restore();
    line(fL, ol ? lw + 3.2 : lw, ol ? OC : C.limb);
    boot(fL[2], ol ? OC : C.boot, ol ? 1.6 : 0);
    if (ol) { c.fillStyle = OC; c.beginPath(); c.arc(hc.x, hc.y, hr + 1.7, 0, TAU); c.fill(); if (h.id === 'tito') { c.beginPath(); c.arc(hc.x - 2, hc.y - hr * .6, hr * .9, 0, TAU); c.fill(); } }
    else drawHead(c, h, hc, hr, S);
    line(fA, ol ? aw + 3.2 : aw, ol ? OC : C.body2);
    if (!ol) { hand(fA[2], C.skin); drawGear(c, h, fA, true, p, S); }
  }
  if (!sil && p.sw && (S.k || 0) < .8) {
    const k = S.k || 0, rad = A1 + A2 + h.wlen * .85, a0 = Math.PI / 2 - (p.sw[0] + lean * .5), a1 = Math.PI / 2 - (p.sw[1] + lean * .5), ccw = a1 < a0;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .6 * (1 - k / .8);
    c.fillStyle = rgba(C.glow, .8); c.beginPath(); c.arc(sh.x, sh.y, rad, a0, a1, ccw); c.arc(sh.x, sh.y, rad * .5, a1, a0, !ccw); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(sh.x, sh.y, rad, a0, a1, ccw); c.arc(sh.x, sh.y, rad * .86, a1, a0, !ccw); c.closePath(); c.fill();
    c.restore();
  }
  if (!sil && p.pogo) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, 0, 0, 30); g.addColorStop(0, rgba(C.glow, .7)); g.addColorStop(1, rgba(C.glow, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.lineTo(0, 30); c.closePath(); c.fill(); c.restore(); }
  c.restore();
}
function drawChain(c, pts, w, col, tip) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < pts.length; i++) {
    const ww = w * (1 - i / pts.length * .6);
    c.strokeStyle = pass ? (i === pts.length - 1 && tip ? tip : col) : OUTLINE; c.lineWidth = pass ? ww : ww + 3;
    c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke();
  }
}

/* =========================================================
   Rendering · enemies
   ========================================================= */
function warnMark(c, x, y, t) { const s = 1 + Math.sin(t * .5) * .12; glow(c, x, y, 18, '#ff6b4a', .7); c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#ff6b4a'; c.beginPath(); rr(c, -5, -10, 10, 20, 4); c.fill(); c.fillStyle = '#fff'; c.fillRect(-1.5, -7, 3, 8); c.fillRect(-1.5, 3, 3, 3); c.restore(); }
function drawCrab(c, e, t) {
  const w = e.w, h = e.h, boss = !!e.boss, s = w / 32, cx = w / 2, cy = h * .5;
  const st = e.state, raised = st === 'telegraph' || st === 'charge' || st === 'intro';
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {
    const bx = cx + sd * (w * .2 + i * w * .08), by = cy + h * .1, ph = Math.sin(t * .35 + i * 1.7 + (sd > 0 ? Math.PI : 0)) * 2.2 * s;
    c.strokeStyle = OUTLINE; c.lineWidth = 3.6 * s; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + sd * (5 + i * 2) * s, by + h * .22 + ph * .3); c.lineTo(bx + sd * (7 + i * 3) * s, h - 1 + Math.min(0, ph) * .4); c.stroke();
    c.strokeStyle = boss ? '#7a2a1a' : '#b8432a'; c.lineWidth = 2 * s; c.stroke();
  }
  for (const sd of [-1, 1]) {
    const ex = cx + sd * w * .14, ey = cy - h * .75;
    c.strokeStyle = OUTLINE; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(ex, cy - h * .2); c.lineTo(ex, ey); c.stroke();
    if (!boss) { c.fillStyle = OUTLINE; c.beginPath(); c.arc(ex, ey, 3.6 * s, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 2.6 * s, 0, TAU); c.fill(); c.fillStyle = OUTLINE; c.beginPath(); c.arc(ex + sd * .6 * s, ey + .4 * s, 1.3 * s, 0, TAU); c.fill(); }
  }
  c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(cx, cy, w * .47 + 1.5, h * .44 + 1.5, 0, 0, TAU); c.fill();
  const g = c.createLinearGradient(0, cy - h * .45, 0, cy + h * .4);
  if (boss) { g.addColorStop(0, e.enraged ? '#ff6b6b' : '#e85a3c'); g.addColorStop(1, '#8e2a1a'); } else { g.addColorStop(0, '#ff9a6b'); g.addColorStop(1, '#c9452a'); }
  c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, w * .47, h * .44, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(cx - w * .08, cy - h * .2, w * .26, h * .12, 0, 0, TAU); c.fill();
  if (boss) {
    c.fillStyle = '#4d5b6e'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(cx + i * w * .24, cy - h * .05, w * .1, h * .22, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#7d8ca0'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(cx + i * w * .24, cy - h * .12, w * .06, h * .1, 0, 0, TAU); c.fill(); }
    if (e.hp < e.max * .5) { c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx + w * .1, cy - h * .3); c.lineTo(cx + w * .16, cy - h * .05); c.lineTo(cx + w * .12, cy + h * .15); c.stroke(); }
    const vcol = e.state === 'stunned' ? ((t >> 2) % 2 ? '#ffc65c' : '#ffffff') : e.enraged ? '#ff4d6d' : '#5be7ff';
    c.fillStyle = OUTLINE; c.beginPath(); rr(c, cx - w * .24, cy - h * .78, w * .48, h * .22, 6); c.fill();
    c.fillStyle = vcol; c.beginPath(); rr(c, cx - w * .21, cy - h * .74, w * .42, h * .14, 4); c.fill();
    glow(c, cx, cy - h * .67, w * .45, vcol, .55);
  } else { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx + w * .15, cy, 1.6 * s, 0, TAU); c.arc(cx - w * .2, cy + h * .1, 1.2 * s, 0, TAU); c.fill(); }
  const cr = boss ? 12 : 5 * s, snap = st === 'telegraph' ? ((t >> 2) % 2 ? .5 : 0) : 0;
  for (const sd of [-1, 1]) {
    const bx = cx + sd * (w * .52), by = cy - (raised ? h * .55 : h * .05);
    c.strokeStyle = OUTLINE; c.lineWidth = boss ? 5 : 3.4 * s; c.beginPath(); c.moveTo(cx + sd * w * .38, cy); c.lineTo(bx, by + cr); c.stroke();
    c.fillStyle = OUTLINE; c.beginPath(); c.arc(bx, by, cr + 1.5, 0, TAU); c.fill();
    c.fillStyle = boss ? '#c0392b' : '#ff7a52'; c.beginPath(); c.arc(bx, by, cr, 0, TAU); c.fill();
    if (boss) { c.strokeStyle = '#7d8ca0'; c.lineWidth = 2.4; c.beginPath(); c.arc(bx, by, cr * .7, 0, TAU); c.stroke(); }
    c.fillStyle = OUTLINE; c.beginPath(); c.moveTo(bx + sd * cr * .2, by); c.lineTo(bx + sd * cr * 1.4, by - cr * (.5 + snap)); c.lineTo(bx + sd * cr * 1.2, by + cr * .1); c.closePath(); c.fill();
  }
}
function drawSlime(c, e, t) {
  const w = e.w, h = e.h, sq = e.onGround ? (e.sq || Math.sin(t * .12) * .06) : -.18, hw = w * (1 + sq) / 2, hh = h * (1 - sq), cx = w / 2;
  c.fillStyle = OUTLINE; c.beginPath(); c.moveTo(cx - hw - 1.5, h + 1); c.quadraticCurveTo(cx - hw - 3, h - hh * 1.05, cx, h - hh - 1.5); c.quadraticCurveTo(cx + hw + 3, h - hh * 1.05, cx + hw + 1.5, h + 1); c.closePath(); c.fill();
  const g = c.createRadialGradient(cx - hw * .3, h - hh * .7, 2, cx, h - hh * .4, Math.max(4, hw * 1.3)); g.addColorStop(0, '#fff2b8'); g.addColorStop(.4, '#ffd36b'); g.addColorStop(1, '#e0952a');
  c.fillStyle = g; c.beginPath(); c.moveTo(cx - hw, h); c.quadraticCurveTo(cx - hw - 1.5, h - hh, cx, h - hh); c.quadraticCurveTo(cx + hw + 1.5, h - hh, cx + hw, h); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(cx - hw * .35, h - hh * .72, hw * .22, hh * .12, -.4, 0, TAU); c.fill();
  const ey = h - hh * .5; c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(cx + hw * .1, ey, 2.2, 3.2, 0, 0, TAU); c.ellipse(cx + hw * .55, ey, 2.2, 3.2, 0, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.fillRect(cx + hw * .1, ey - 2, 1, 1); c.fillRect(cx + hw * .55, ey - 2, 1, 1);
}
function drawJelly(c, e, t) {
  const w = e.w, cx = w / 2;
  glow(c, cx, 10, 26, '#a58bff', .35 + Math.sin(t * .08) * .15);
  c.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const x0 = 4 + i * (w - 8) / 4; c.strokeStyle = i % 2 ? 'rgba(199,184,255,.85)' : 'rgba(150,120,255,.85)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x0, 12); c.bezierCurveTo(x0 + Math.sin(t * .12 + i) * 4, 18, x0 - Math.sin(t * .1 + i) * 4, 22, x0 + Math.sin(t * .14 + i) * 3, 27); c.stroke(); }
  c.fillStyle = 'rgba(30,10,70,.7)'; c.beginPath(); c.ellipse(cx, 12, w / 2 + 1.5, 13.5, 0, Math.PI, TAU); c.closePath(); c.fill();
  const g = c.createLinearGradient(0, 0, 0, 12); g.addColorStop(0, 'rgba(227,217,255,.95)'); g.addColorStop(1, 'rgba(165,139,255,.85)');
  c.fillStyle = g; c.beginPath(); c.ellipse(cx, 12, w / 2, 12, 0, Math.PI, TAU); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(cx - 4, 5, 4, 2, -.3, 0, TAU); c.fill();
  c.fillStyle = OUTLINE; c.beginPath(); c.arc(cx + 2, 8, 1.6, 0, TAU); c.arc(cx + 7, 8, 1.6, 0, TAU); c.fill();
}
function drawMonkey(c, e, t) {
  const w = e.w, cx = w / 2, wind = e.state === 'wind', arm = wind ? -9 : 0;
  c.lineCap = 'round'; c.strokeStyle = OUTLINE; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - 6, 20); c.quadraticCurveTo(cx - 16, 22, cx - 14, 12); c.quadraticCurveTo(cx - 12, 6, cx - 9, 10); c.stroke();
  c.strokeStyle = '#8b5a2b'; c.lineWidth = 2.2; c.stroke();
  c.fillStyle = OUTLINE; c.beginPath(); c.arc(cx, 16, 9.5, 0, TAU); c.arc(cx + 1, 6, 8.5, 0, TAU); c.fill();
  c.fillStyle = '#8b5a2b'; c.beginPath(); c.arc(cx, 16, 8, 0, TAU); c.fill(); c.fillStyle = '#d9a066'; c.beginPath(); c.ellipse(cx + 1, 18, 5, 5.5, 0, 0, TAU); c.fill();
  c.fillStyle = '#8b5a2b'; c.beginPath(); c.arc(cx + 1, 6, 7, 0, TAU); c.arc(cx - 6, 4, 3, 0, TAU); c.fill();
  c.fillStyle = '#e8c19a'; c.beginPath(); c.ellipse(cx + 3, 7.5, 4.5, 4, 0, 0, TAU); c.fill();
  c.fillStyle = OUTLINE; c.beginPath(); c.arc(cx + 2.5, 5.5, 1.2, 0, TAU); c.arc(cx + 5.8, 5.5, 1.2, 0, TAU); c.fill();
  c.strokeStyle = OUTLINE; c.lineWidth = 4.2; c.beginPath(); c.moveTo(cx + 5, 13); c.lineTo(cx + 10, 13 + arm); c.stroke(); c.strokeStyle = '#8b5a2b'; c.lineWidth = 2.6; c.stroke();
  if (wind) { c.fillStyle = OUTLINE; c.beginPath(); c.arc(cx + 11, 9 + arm, 6, 0, TAU); c.fill(); c.fillStyle = '#6b4423'; c.beginPath(); c.arc(cx + 11, 9 + arm, 4.8, 0, TAU); c.fill(); }
}
function drawDrone(c, e, t) {
  const w = e.w, cx = w / 2, lock = e.state === 'lock' || e.state === 'dive';
  glow(c, cx, e.h + 4, 14, '#5be7ff', .5);
  for (const sd of [-1, 1]) { const rx = cx + sd * (w / 2 + 2), sw = 7 + Math.sin(t * 1.7 + sd) * 4; c.fillStyle = 'rgba(200,230,240,.4)'; c.beginPath(); c.ellipse(rx, 2, Math.abs(sw), 1.6, 0, 0, TAU); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + sd * w * .3, 7); c.lineTo(rx, 3); c.stroke(); }
  c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(cx, 9, w / 2 - 1, 7.5, 0, 0, TAU); c.fill();
  const g = c.createLinearGradient(0, 2, 0, 16); g.addColorStop(0, '#eef4fa'); g.addColorStop(1, '#6b7a8c'); c.fillStyle = g; c.beginPath(); c.ellipse(cx, 9, w / 2 - 2.5, 6, 0, 0, TAU); c.fill();
  c.fillStyle = '#2b3a4a'; c.beginPath(); c.ellipse(cx, 6, 6, 4, 0, Math.PI, TAU); c.fill();
  const eye = lock ? '#ff4d6d' : '#5be7ff'; c.fillStyle = eye; c.beginPath(); c.arc(cx + 3, 10, 2.4, 0, TAU); c.fill(); glow(c, cx + 3, 10, 10, eye, .9);
}
function drawEnemy(c, e, t) {
  c.save(); c.translate(Math.round(e.x), Math.round(e.y));
  if (e.rot) { c.translate(e.w / 2, e.h / 2); c.rotate(e.rot); c.translate(-e.w / 2, -e.h / 2); }
  if (e.dir > 0 && e.kind !== 'c' && e.kind !== 'Z' && e.kind !== 'j') { c.translate(e.w, 0); c.scale(-1, 1); }
  if (e.kind === 'c' || e.kind === 'Z') drawCrab(c, e, t); else if (e.kind === 's') drawSlime(c, e, t); else if (e.kind === 'j') drawJelly(c, e, t); else if (e.kind === 'm') drawMonkey(c, e, t); else if (e.kind === 'd') drawDrone(c, e, t);
  if (e.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = e.flash / 8 * .7; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(e.w / 2, e.h / 2, e.w * .6, e.h * .6, 0, 0, TAU); c.fill(); }
  c.restore();
}

/* =========================================================
   Rendering · world (themed, 2.5D)
   ========================================================= */
let sunSprite = null, cloudSprites = [], vignette = null;
function buildSprites() {
  sunSprite = document.createElement('canvas'); sunSprite.width = sunSprite.height = 256;
  const s = sunSprite.getContext('2d'), g = s.createLinearGradient(0, 28, 0, 228);
  g.addColorStop(0, '#fff8d8'); g.addColorStop(.5, '#ffd27a'); g.addColorStop(1, '#ff7a52');
  s.fillStyle = g; s.beginPath(); s.arc(128, 128, 100, 0, TAU); s.fill();
  s.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) { const y = 140 + i * 15, hh = 3 + i * 2.2; s.fillRect(0, y, 256, hh); }
  cloudSprites = [];
  for (let v = 0; v < 3; v++) {
    const cc = document.createElement('canvas'); cc.width = 360; cc.height = 120; const q = cc.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 40 + hash(v, i) * 280, y = 60 + (hash(i, v) - .5) * 30, r = 18 + hash(v + 9, i) * 26;
      const gr = q.createRadialGradient(x, y - r * .3, 2, x, y, r); gr.addColorStop(0, 'rgba(255,240,226,.95)'); gr.addColorStop(.7, 'rgba(255,210,190,.6)'); gr.addColorStop(1, 'rgba(255,190,170,0)');
      q.fillStyle = gr; q.beginPath(); q.arc(x, y, r, 0, TAU); q.fill();
    }
    cloudSprites.push(cc);
  }
}
function buildVignette() {
  vignette = document.createElement('canvas'); vignette.width = Math.max(1, cv.width >> 1); vignette.height = Math.max(1, cv.height >> 1);
  const v = vignette.getContext('2d'), w = vignette.width, h = vignette.height, g = v.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
  g.addColorStop(0, 'rgba(3,12,18,0)'); g.addColorStop(1, 'rgba(3,12,18,.55)'); v.fillStyle = g; v.fillRect(0, 0, w, h);
}
const TOWERS = Array.from({ length: 14 }, (_, i) => ({ x: i * 110 + hash(i, 1) * 60, w: 26 + hash(i, 2) * 30, h: 50 + hash(i, 3) * 120, top: hash(i, 4) }));
const wrap = (v, m) => ((v % m) + m) % m;
function drawBackdrop(left, top, z, t) {
  const TH = G.theme, W = cv.width, H = cv.height, Y = (wy, f) => (wy - top * f) * z, vwW = W / z;
  const hz = Y(236, .22);
  const sky = ctx.createLinearGradient(0, hz - 440 * z, 0, hz);
  TH.sky.forEach((c, i) => sky.addColorStop([0, .42, .72, .9, 1][i], c));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const sx = W * .68, sy = hz - 70 * z, sr = 62 * z;
  if (TH.sun) {
    glow(ctx, sx, sy, sr * 4.5, TH.lava ? '#ff6a3a' : '#ffb070', .55); glow(ctx, sx, sy, sr * 2.2, '#fff0c0', .5);
    ctx.drawImage(sunSprite, sx - sr * 1.28, sy - sr * 1.28, sr * 2.56, sr * 2.56);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const a = -1.2 + i * .55 + Math.sin(t * .2 + i) * .04; ctx.fillStyle = 'rgba(255,214,160,.045)'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - .06) * W * 1.4, sy + Math.sin(a - .06) * W * 1.4 + H); ctx.lineTo(sx + Math.cos(a + .06) * W * 1.4, sy + Math.sin(a + .06) * W * 1.4 + H); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    for (let i = 0; i < 6; i++) { const sw = (220 + (i * 37) % 120) * z, span = vwW + 500, cxw = (wrap(i * 430 + t * (8 + i * 2) - left * .06, span) - 250) * z, cy = hz - (90 + (i * 53) % 180) * z; ctx.globalAlpha = TH.lava ? .4 : .75; ctx.drawImage(cloudSprites[i % 3], cxw, cy - sw * .17, sw, sw / 3); ctx.globalAlpha = 1; }
  } else {
    // cave: stalactites and crystals
    for (let i = 0; i < 40; i++) { const xx = (wrap(i * 173 - left * .1, vwW + 100) - 50) * z, yy = (20 + (i * 97) % 140) * z; ctx.fillStyle = `rgba(120,220,255,${.25 + (i % 3) * .2})`; ctx.fillRect(xx, yy + Math.sin(t + i) * 2 * z, 2 * z, 2 * z); }
    ctx.fillStyle = '#0a1a2a';
    for (let i = 0; i < 18; i++) { const xx = (wrap(i * 230 - left * .18, vwW + 300) - 150) * z, ww = (30 + (i * 13) % 50) * z, hh = (60 + (i * 41) % 140) * z; ctx.beginPath(); ctx.moveTo(xx - ww, 0); ctx.lineTo(xx + ww, 0); ctx.lineTo(xx, hh); ctx.closePath(); ctx.fill(); }
    for (let i = 0; i < 7; i++) { const xx = (wrap(i * 360 + 100 - left * .25, vwW + 400) - 200) * z, yy = hz - (40 + (i * 29) % 90) * z; glow(ctx, xx, yy, 60 * z, i % 2 ? '#2de2c3' : '#5be7ff', .35 + Math.sin(t * 1.5 + i) * .1); ctx.fillStyle = i % 2 ? '#9ff7e6' : '#c9fbff'; ctx.beginPath(); ctx.moveTo(xx, yy - 26 * z); ctx.lineTo(xx + 9 * z, yy); ctx.lineTo(xx, yy + 10 * z); ctx.lineTo(xx - 9 * z, yy); ctx.closePath(); ctx.fill(); }
  }
  if (TH.city) {
    const span2 = 1540, off = wrap(left * .12, span2);
    for (let rep = -1; rep * span2 < vwW + span2; rep++) for (const tw of TOWERS) {
      const tx = (rep * span2 + tw.x - off) * z, th = tw.h * z * .55, tww = tw.w * z * .55; if (tx > W + 40 || tx + tww < -40) continue;
      ctx.fillStyle = '#5c93a0'; ctx.fillRect(tx, hz - th, tww, th);
      if (tw.top > .6) { ctx.beginPath(); ctx.moveTo(tx, hz - th); ctx.lineTo(tx + tww / 2, hz - th - tww * .6); ctx.lineTo(tx + tww, hz - th); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,230,170,.55)'; for (let k2 = 0; k2 < 12; k2++) { const wy = hz - th + (6 + k2 * 7) * z * .55; if (wy > hz - 3 * z) break; if (hash(tw.x | 0, k2) > .5) ctx.fillRect(tx + tww * .25, wy, tww * .5, Math.max(1, 1.2 * z)); }
      if (tw.top < .3 && ((t * 2 + tw.x) | 0) % 2) glow(ctx, tx + tww / 2, hz - th - 4 * z, 6 * z, '#ff4d6d', .8);
    }
    for (let i = 0; i < 3; i++) { const tx = (wrap(i * 520 + 200 - left * .14, vwW + 400) - 200) * z, ty = hz - 2 * z, hh = 70 * z; ctx.strokeStyle = '#e8f1f2'; ctx.lineWidth = Math.max(1, 2 * z); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - hh); ctx.stroke(); for (let b = 0; b < 3; b++) { const a = t * .8 + i + b * TAU / 3; ctx.beginPath(); ctx.moveTo(tx, ty - hh); ctx.lineTo(tx + Math.cos(a) * 26 * z, ty - hh + Math.sin(a) * 26 * z); ctx.stroke(); } }
    for (let i = 0; i < 3; i++) { const dx = (wrap(t * (40 + i * 15) + i * 700, vwW + 200) - 100) * z, dy = hz - (150 + i * 40) * z + Math.sin(t + i) * 6 * z; ctx.fillStyle = '#21404c'; ctx.fillRect(dx - 4 * z, dy, 8 * z, 2 * z); if (((t * 3 + i) | 0) % 2) glow(ctx, dx, dy + z, 5 * z, '#2de2c3', .9); }
  }
  // sea / lava
  const sea = ctx.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, TH.sea[0]); sea.addColorStop(.25, TH.sea[1]); sea.addColorStop(1, TH.sea[2]);
  ctx.fillStyle = sea; ctx.fillRect(0, hz, W, Math.max(0, H - hz));
  if (TH.sun) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const yy = hz + (4 + i * i * .9) * z, ww = (30 - i * .6) * z * (1 + Math.sin(t * 2 + i) * .3); ctx.fillStyle = `rgba(255,214,150,${.5 - i * .017})`; ctx.fillRect(sx - ww / 2 + Math.sin(t * 1.5 + i * 2) * 6 * z, yy, ww, Math.max(1, 1.6 * z)); } ctx.restore(); }
  ctx.fillStyle = TH.lava ? 'rgba(255,230,160,.4)' : 'rgba(200,245,240,.35)';
  for (let i = 0; i < 40; i++) { const f = .25 + (i % 5) * .05, yy = hz + (8 + (i * 37) % 160) * z, xx = (wrap(i * 211 + t * 14 - left * f, vwW + 80) - 40) * z; ctx.fillRect(xx, yy, (10 + (i % 4) * 8) * z, Math.max(1, z * .8)); }
  if (!TH.crystals) for (let i = 0; i < 4; i++) {
    const iw = (180 + i * 30) * z, ix = (wrap(i * 470 - left * .3, vwW + 600) - 300) * z, iy = hz + 10 * z;
    ctx.fillStyle = TH.lava ? '#3a1a1a' : TH.city ? '#2a6a6c' : '#1e5a46'; ctx.beginPath(); ctx.ellipse(ix + iw / 2, iy + 8 * z, iw / 2, 16 * z, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = TH.lava ? '#2a1010' : TH.city ? '#1f5759' : '#164536'; for (let k2 = 0; k2 < 3; k2++) { const px2 = ix + iw * (.3 + k2 * .2), ph = (26 + k2 * 8) * z; ctx.fillRect(px2, iy - ph + 4 * z, Math.max(1, 2.2 * z), ph); for (let l = 0; l < 5; l++) { const a = Math.PI + l * .75 + .2; ctx.beginPath(); ctx.ellipse(px2 + Math.cos(a) * 8 * z, iy - ph + 7 * z + Math.sin(a) * 3 * z, 9 * z, 2 * z, a, 0, TAU); ctx.fill(); } }
  }
  const dy0 = Y(372, .55);
  ctx.fillStyle = TH.dune; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 20) { const wx = x / z + left * .55; ctx.lineTo(x, dy0 - (Math.sin(wx / 140) * 18 + Math.sin(wx / 53) * 6 + 10) * z); }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  if (G.mode === 'match') {
    // arena floor grid in perspective: the 3D "stage" under the platforms
    const fy = Y(MH * TS - 2 * TS + 40, 1), vx = W / 2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(TH.lava ? '#ff7a3a' : '#2de2c3', .18); ctx.lineWidth = Math.max(1, z);
    for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(vx + i * 90 * z - left * z * .1, H); ctx.lineTo(vx + i * 20 * z, fy); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { const yy = fy + (H - fy) * Math.pow(i / 8, 1.8); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    ctx.restore();
  }
  if (TH.fog !== 'rgba(255,200,150,0)') { ctx.fillStyle = TH.fog; ctx.fillRect(0, 0, W, H); }
}
function sandDepth(tx, ty) { let d = 0; while (d < 5 && (tile(tx, ty - d - 1) === '#' || tile(tx, ty - d - 1) === 'R')) d++; return d; }
function drawFaces(t) {
  /* 2.5D: top faces and side faces converge toward the camera center */
  if (!settings.depth) return;
  const TH = G.theme, x0 = Math.floor(view.l / TS) - 1, x1 = Math.floor(view.r / TS) + 1, y0 = Math.max(0, Math.floor(view.t / TS)), y1 = Math.min(MH - 1, Math.floor(view.b / TS) + 1);
  const cxw = G.cam.cx, cyw = G.cam.cy, D = 11;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = tile(tx, ty); if (c !== '#' && c !== 'R' && c !== 'P' && c !== 'X') continue;
    const x = tx * TS, y = ty * TS, thin = c === 'P' || c === 'X';
    if (thin) { const cr = crumbled[tx + ',' + ty]; if (cr && cr.gone) continue; }
    const ox = clamp((cxw - (x + 16)) * .045, -D, D), oy = clamp((cyw - (y + 16)) * .02, -6, 2) - D * .55;
    const rock = c === 'R', base = rock ? TH.rock : [TH.sand[0], TH.sand[1], TH.sand[2]];
    const topOpen = thin ? true : !isSolid(tx, ty - 1), lOpen = thin ? tile(tx - 1, ty) !== c : !isSolid(tx - 1, ty), rOpen = thin ? tile(tx + 1, ty) !== c : !isSolid(tx + 1, ty);
    const hgt = thin ? 10 : TS;
    if (topOpen && oy < 0) { ctx.fillStyle = rgba(hexToHex(base[0]), 1); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + TS, y); ctx.lineTo(x + TS + ox, y + oy); ctx.lineTo(x + ox, y + oy); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill(); }
    if (ox > 0 && lOpen) { ctx.fillStyle = rock ? '#2f3a4c' : TH.sand[4]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ox, y + oy); ctx.lineTo(x + ox, y + hgt + oy); ctx.lineTo(x, y + hgt); ctx.closePath(); ctx.fill(); }
    if (ox < 0 && rOpen) { ctx.fillStyle = rock ? '#2f3a4c' : TH.sand[4]; ctx.beginPath(); ctx.moveTo(x + TS, y); ctx.lineTo(x + TS + ox, y + oy); ctx.lineTo(x + TS + ox, y + hgt + oy); ctx.lineTo(x + TS, y + hgt); ctx.closePath(); ctx.fill(); }
  }
}
function hexToHex(h) { return h; }
function drawTiles(t) {
  const TH = G.theme, SAND = TH.sand, x0 = Math.floor(view.l / TS) - 1, x1 = Math.floor(view.r / TS) + 1, y0 = Math.max(0, Math.floor(view.t / TS)), y1 = Math.min(MH - 1, Math.floor(view.b / TS) + 1);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = tile(tx, ty); if (c === '.') continue;
    const x = tx * TS, y = ty * TS;
    if (c === '#' || c === 'R') {
      const rock = c === 'R', d = sandDepth(tx, ty), top = d === 0;
      const lE = !SOLID[tile(tx - 1, ty)] && tile(tx - 1, ty) !== 'W', rE = !SOLID[tile(tx + 1, ty)] && tile(tx + 1, ty) !== 'W';
      const rad = [top && lE ? 10 : 0, top && rE ? 10 : 0, 0, 0];
      ctx.fillStyle = rock ? (top ? TH.rock[1] : TH.rock[2]) : SAND[Math.min(d + 1, 5)];
      ctx.beginPath(); rr(ctx, x, y, TS + .6, TS + .6, rad); ctx.fill();
      if (top) {
        ctx.fillStyle = rock ? TH.rock[0] : SAND[0]; ctx.beginPath(); rr(ctx, x, y, TS + .6, 7, [rad[0], rad[1], 0, 0]); ctx.fill();
        ctx.fillStyle = 'rgba(40,20,10,.22)'; ctx.fillRect(x, y + 7, TS + .6, 2);
        if (hash(tx, 7) > .3) { ctx.lineCap = 'round'; ctx.lineWidth = 1.6; for (let k2 = 0; k2 < 3; k2++) { const bx = x + 5 + hash(tx, k2 + 3) * 22, sw = Math.sin(t * 2 + tx + k2) * 1.6, hh = 6 + hash(tx, k2 + 9) * 6; ctx.strokeStyle = TH.grass[k2 % 2]; ctx.beginPath(); ctx.moveTo(bx, y + 3); ctx.quadraticCurveTo(bx + sw, y - hh * .5, bx + sw * 1.6 + 2, y - hh); ctx.stroke(); } }
        if (!rock && hash(tx + 3, ty) > .86 && !TH.lava) { ctx.fillStyle = '#fff4ec'; ctx.beginPath(); ctx.ellipse(x + 14, y + 1, 4, 2.6, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#ff9a7a'; ctx.fillRect(x + 12, y, 4, 1); }
        if (TH.crystals && hash(tx + 11, ty) > .8) { glow(ctx, x + 16, y - 6, 18, '#2de2c3', .5); ctx.fillStyle = '#9ff7e6'; ctx.beginPath(); ctx.moveTo(x + 16, y - 14); ctx.lineTo(x + 21, y); ctx.lineTo(x + 11, y); ctx.closePath(); ctx.fill(); }
      } else if (hash(tx, ty) > .55) { ctx.fillStyle = rock ? 'rgba(0,0,0,.25)' : 'rgba(120,70,30,.25)'; ctx.beginPath(); ctx.arc(x + 6 + hash(tx + 1, ty) * 20, y + 6 + hash(tx, ty + 1) * 20, rock ? 3 : 1.8, 0, TAU); ctx.fill(); }
      if (rock && hash(tx, ty + 5) > .5) { ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 8, y + 12); ctx.lineTo(x + 14, y + 20); ctx.lineTo(x + 12, y + 28); ctx.stroke(); }
      if (lE) { ctx.fillStyle = 'rgba(40,20,10,.25)'; ctx.fillRect(x, y + (top ? 9 : 0), 3, TS - (top ? 9 : 0)); }
      if (rE) { ctx.fillStyle = 'rgba(40,20,10,.25)'; ctx.fillRect(x + TS - 3, y + (top ? 9 : 0), 3, TS - (top ? 9 : 0)); }
      if (top && (tile(tx - 1, ty) === 'W' || tile(tx + 1, ty) === 'W')) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(tile(tx - 1, ty) === 'W' ? x : x + TS - 4, y + 2, 4, 6); }
    } else if (c === 'P' || c === 'X') {
      const cr = crumbled[tx + ',' + ty]; if (c === 'X' && cr && cr.gone) continue;
      const sh = cr && !cr.gone ? Math.round(Math.sin(cr.t * 1.6) * 1.5) : 0, xl = x + sh;
      ctx.fillStyle = 'rgba(40,20,10,.35)'; ctx.fillRect(xl, y + 10, TS, 3);
      ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, xl - .5, y - .5, TS + 1, 11, 3); ctx.fill();
      ctx.fillStyle = c === 'X' ? '#d6a066' : '#c07b40'; ctx.beginPath(); rr(ctx, xl + .5, y + .5, TS - 1, 9, 2.5); ctx.fill();
      ctx.fillStyle = c === 'X' ? '#f1c38f' : '#eaa96c'; ctx.fillRect(xl + 1, y + 1, TS - 2, 2);
      ctx.fillStyle = 'rgba(60,30,10,.5)'; ctx.fillRect(xl + 15, y + 2, 1.2, 7); ctx.fillRect(xl + 4, y + 5, 1.5, 1.5); ctx.fillRect(xl + 26, y + 5, 1.5, 1.5);
      if (c === 'X') { ctx.strokeStyle = 'rgba(60,30,10,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xl + 8, y + 1); ctx.lineTo(xl + 10, y + 5); ctx.lineTo(xl + 7, y + 9); ctx.moveTo(xl + 22, y + 2); ctx.lineTo(xl + 20, y + 8); ctx.stroke(); }
      const L = tile(tx - 1, ty), Rr = tile(tx + 1, ty);
      if (L !== 'P' && L !== 'X') { ctx.fillStyle = '#7a4a24'; ctx.fillRect(xl + 3, y + 9, 4, 14); ctx.strokeStyle = '#d9c39a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xl + 5, y + 2); ctx.quadraticCurveTo(xl - 4, y + 10, xl + 5, y + 16); ctx.stroke(); }
      if (Rr !== 'P' && Rr !== 'X') { ctx.fillStyle = '#7a4a24'; ctx.fillRect(xl + TS - 7, y + 9, 4, 14); }
    } else if (c === 'W') {
      const top = tile(tx, ty - 1) !== 'W';
      ctx.fillStyle = top ? TH.water[0] : (ty - 13 > 1 ? TH.water[2] : TH.water[1]); ctx.fillRect(x, y, TS + .6, TS + .6);
      ctx.fillStyle = TH.lava ? 'rgba(255,240,180,.25)' : 'rgba(190,255,250,.12)'; const ox = Math.sin(t * 1.4 + tx * 1.7 + ty) * 6; ctx.fillRect(x + 6 + ox, y + 10 + (ty % 2) * 8, 12, 1.4);
      if (TH.lava && top && G.frame % 20 === tx % 20) burst(x + 16, y + 4, 1, ['#ff9a3c', '#ffd27a'], 1, 30, { add: true, g: -.08 });
    } else if (c === 'S') {
      const cx = x + 16, cy = y + 22, pul = Math.sin(t * 3 + tx) * .5;
      glow(ctx, cx, cy, 20, '#ff6b4a', .25 + pul * .1);
      ctx.strokeStyle = '#1b0c30'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (let k2 = 0; k2 < 14; k2++) { const a = k2 / 14 * TAU, l = 14 + (k2 % 2) * 3 + pul; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke(); }
      const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 10); g.addColorStop(0, '#8a55d6'); g.addColorStop(1, '#2a1247'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff9a7a'; ctx.beginPath(); ctx.arc(cx + 2, cy - 2, 2, 0, TAU); ctx.fill();
    } else if (c === 'G') {
      const fl = .7 + Math.sin(t * 20 + ty * 3) * .2;
      ctx.fillStyle = 'rgba(255,107,74,.12)'; ctx.fillRect(x + 4, y, TS - 8, TS + .6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k2 = 0; k2 < 3; k2++) { ctx.fillStyle = `rgba(255,${120 + k2 * 40},${90 + k2 * 30},${.5 * fl})`; ctx.fillRect(x + 8 + k2 * 7, y, 2, TS + .6); }
      ctx.restore();
      if (tile(tx, ty - 1) !== 'G') { ctx.fillStyle = '#3a4658'; ctx.beginPath(); rr(ctx, x + 2, y - 6, TS - 4, 10, 3); ctx.fill(); glow(ctx, x + 16, y, 16, '#ff6b4a', .8); }
    }
  }
}
function drawWaterFront(t) {
  const TH = G.theme, x0 = Math.floor(view.l / TS) - 1, x1 = Math.floor(view.r / TS) + 1;
  for (let ty = 0; ty < MH; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tile(tx, ty) !== 'W' || tile(tx, ty - 1) === 'W') continue;
    const x = tx * TS, y = ty * TS, w1 = Math.sin(t * 3 + tx * 1.1) * 3, w2 = Math.sin(t * 3 + (tx + 1) * 1.1) * 3;
    ctx.fillStyle = TH.lava ? 'rgba(255,200,80,.5)' : 'rgba(90,230,225,.42)'; ctx.beginPath(); ctx.moveTo(x, y + 4 + w1); ctx.quadraticCurveTo(x + 16, y + 1 + (w1 + w2) / 2 - 2, x + TS + .6, y + 4 + w2); ctx.lineTo(x + TS + .6, y + 14); ctx.lineTo(x, y + 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = TH.lava ? 'rgba(255,240,200,.9)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 4 + w1); ctx.quadraticCurveTo(x + 16, y + 1 + (w1 + w2) / 2 - 2, x + TS + .6, y + 4 + w2); ctx.stroke();
  }
}
function drawPalm(c, d, t) {
  const sway = Math.sin(t * 1.4 + d.x * .01) * 3, hgt = d.hgt, segs = Math.max(4, Math.round(hgt / 12));
  let px = d.x, py = d.y; c.lineCap = 'round';
  for (let i = 0; i < segs; i++) {
    const k2 = (i + 1) / segs, nx = d.x + d.lean * k2 * k2 * hgt * .22 + sway * k2 * k2, ny = d.y - k2 * hgt, w = 8 - k2 * 3;
    c.strokeStyle = OUTLINE; c.lineWidth = w + 2.4; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
    c.strokeStyle = i % 2 ? '#9a6a3a' : '#7d522a'; c.lineWidth = w; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
    px = nx; py = ny;
  }
  for (let k2 = 0; k2 < 8; k2++) {
    const L = 30 + (k2 % 3) * 6, ang = -Math.PI / 2 + (k2 - 3.5) * .42 + Math.sin(t * 1.5 + k2) * .04, tipx = px + Math.cos(ang) * L, tipy = py + Math.sin(ang) * L * .55 + L * .45;
    const mx = (px + tipx) / 2, my = (py + tipy) / 2 - 10, nx = -(tipy - py) / L * 6, ny = (tipx - px) / L * 6;
    c.fillStyle = OUTLINE; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(mx + nx * 1.3, my + ny * 1.3, tipx, tipy); c.quadraticCurveTo(mx - nx * .7, my - ny * .7, px, py); c.fill();
    c.fillStyle = k2 % 2 ? '#2f9e6a' : '#3fbf7f'; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(mx + nx, my + ny, tipx, tipy); c.quadraticCurveTo(mx - nx * .4, my - ny * .4, px, py); c.fill();
    c.strokeStyle = 'rgba(200,255,220,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(mx, my, tipx, tipy); c.stroke();
  }
  c.fillStyle = OUTLINE; for (let k2 = 0; k2 < 3; k2++) { c.beginPath(); c.arc(px - 4 + k2 * 4, py + 3 + (k2 % 2) * 2, 4.4, 0, TAU); c.fill(); }
  c.fillStyle = '#6b4423'; for (let k2 = 0; k2 < 3; k2++) { c.beginPath(); c.arc(px - 4 + k2 * 4, py + 3 + (k2 % 2) * 2, 3.2, 0, TAU); c.fill(); }
}
function drawSign(s, t) {
  const n = nearest(s.x, s.y, null), near = n && Math.abs(n.x + 10 - s.x) < 230; s.a = lerp(s.a, near ? 1 : 0, .12);
  ctx.fillStyle = '#4a5a6e'; ctx.fillRect(s.x - 2, s.y - 30, 4, 30); ctx.fillStyle = '#2b3646'; ctx.beginPath(); rr(ctx, s.x - 7, s.y - 36, 14, 8, 3); ctx.fill();
  glow(ctx, s.x, s.y - 34, 10, '#2de2c3', .7);
  if (s.a < .03) return;
  const sg = s.s, src = n ? n.src : 'k1', key = src === 'touch' ? sg.t : src.startsWith('pad') ? sg.p : sg.k;
  ctx.font = `800 10px ${FB}`; const lw = ctx.measureText(sg.label).width; ctx.font = `600 8px ${FD}`; const kw = key ? ctx.measureText(key).width + 14 : 0;
  const w = lw + kw + (key ? 22 : 16), h = 24, x = s.x - w / 2, y = s.y - 74 + Math.sin(t * 2) * 2;
  ctx.save(); ctx.globalAlpha = (Math.sin(t * 23) > .96 ? .5 : 1) * s.a;
  ctx.fillStyle = 'rgba(45,226,195,.16)'; ctx.beginPath(); ctx.moveTo(s.x - 6, s.y - 34); ctx.lineTo(x + 8, y + h); ctx.lineTo(x + w - 8, y + h); ctx.lineTo(s.x + 6, s.y - 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(6,40,46,.82)'; ctx.beginPath(); rr(ctx, x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(45,226,195,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); rr(ctx, x, y, w, h, 5); ctx.stroke();
  let cx = x + 8; ctx.textBaseline = 'middle';
  if (key) { ctx.fillStyle = '#2de2c3'; ctx.beginPath(); rr(ctx, cx, y + 5, kw, 14, 3); ctx.fill(); ctx.fillStyle = '#04201c'; ctx.font = `600 8px ${FD}`; ctx.fillText(key, cx + 7, y + 12.5); cx += kw + 7; }
  ctx.fillStyle = '#effaf6'; ctx.font = `800 10px ${FB}`; ctx.fillText(sg.label, cx, y + 12.5);
  ctx.restore(); ctx.textBaseline = 'alphabetic';
}
function drawPickup(e, t) {
  if (e.kind === 'coin') {
    const sx = Math.cos(e.t / 8), x = e.x + 8, y = e.y + 8 + (e.loose ? 0 : Math.sin(e.t / 14) * 2);
    glow(ctx, x, y, 14, '#ffc65c', .35);
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(.15, Math.abs(sx)), 1);
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(0, 0, 8.4, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, '#fff3c0'); g.addColorStop(.5, '#ffc65c'); g.addColorStop(1, '#e08a2c'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(140,70,10,.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, TAU); ctx.stroke(); ctx.fillStyle = '#fff9e0'; ctx.fillRect(-1, -4, 2, 3);
    ctx.restore();
  } else if (e.kind === 'heart') {
    const x = e.x + 9, y = e.y + 7 + Math.sin(e.t / 12) * 2.5, s = 1 + Math.sin(e.t / 8) * .06;
    glow(ctx, x, y, 18, '#ff4d6d', .4);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const heart = r => { ctx.beginPath(); ctx.moveTo(0, r * .9); ctx.bezierCurveTo(-r * 1.4, -r * .1, -r * .7, -r * 1.1, 0, -r * .35); ctx.bezierCurveTo(r * .7, -r * 1.1, r * 1.4, -r * .1, 0, r * .9); ctx.fill(); };
    ctx.fillStyle = OUTLINE; heart(10); ctx.fillStyle = '#ff4d6d'; heart(8.2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-3.5, -3, 2, 1.4, -.6, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (e.kind === 'shell') {
    const x = e.x + 10, y = e.y + 10 + Math.sin(e.t / 10) * 3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, y - 120, 0, y); g.addColorStop(0, 'rgba(45,226,195,0)'); g.addColorStop(1, 'rgba(45,226,195,.25)'); ctx.fillStyle = g; ctx.fillRect(x - 8, y - 120, 16, 120); ctx.restore();
    glow(ctx, x, y, 30, '#2de2c3', .55 + Math.sin(e.t / 9) * .2);
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 14, y - 6, x + 11, y + 8); ctx.lineTo(x - 11, y + 8); ctx.quadraticCurveTo(x - 14, y - 6, x, y - 12); ctx.fill();
    const sg = ctx.createLinearGradient(0, y - 10, 0, y + 8); sg.addColorStop(0, '#e9fffb'); sg.addColorStop(1, '#2de2c3'); ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.quadraticCurveTo(x + 12, y - 5, x + 9.5, y + 6.5); ctx.lineTo(x - 9.5, y + 6.5); ctx.quadraticCurveTo(x - 12, y - 5, x, y - 10); ctx.fill();
    ctx.strokeStyle = 'rgba(10,90,80,.6)'; ctx.lineWidth = 1.2; for (let k2 = -2; k2 <= 2; k2++) { ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + k2 * 4, y + 6); ctx.stroke(); }
    ctx.fillStyle = '#2de2c3'; ctx.fillRect(x - 3, y + 7, 6, 3);
  } else if (e.kind === 'beacon') {
    const on = e.on, bx = e.x + 4, top = e.y;
    ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, e.x - 3, top + 6, 14, e.h - 6, 3); ctx.fill();
    ctx.fillStyle = '#7d8ca0'; ctx.beginPath(); rr(ctx, e.x - 1.5, top + 7.5, 11, e.h - 9, 2); ctx.fill();
    ctx.fillStyle = on ? '#2de2c3' : '#3a4658'; for (let k2 = 0; k2 < 4; k2++) ctx.fillRect(e.x + 1, top + 16 + k2 * 8, 6, 3);
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(bx, top + 4, 8, 0, TAU); ctx.fill(); ctx.fillStyle = on ? '#bff7ee' : '#5a6678'; ctx.beginPath(); ctx.arc(bx, top + 4, 6, 0, TAU); ctx.fill();
    if (on) { glow(ctx, bx, top + 4, 34, '#2de2c3', .8); const k2 = Math.min(1, e.t / 30); if (k2 > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, top - 400 * k2, 0, top); g.addColorStop(0, 'rgba(45,226,195,0)'); g.addColorStop(1, 'rgba(45,226,195,.35)'); ctx.fillStyle = g; ctx.fillRect(bx - 6, top - 400 * k2, 12, 400 * k2); ctx.restore(); } }
  } else if (e.kind === 'bounce') {
    const open = e.sq > 0 ? 6 : 0, x = e.x, y = e.y;
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(x + 14, y + 10, 16, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8fa8'; ctx.beginPath(); ctx.ellipse(x + 14, y + 10, 14.5, 4.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(x + 14, y + 6 - open, 16, 7, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#ffc4d2'; ctx.beginPath(); ctx.ellipse(x + 14, y + 6 - open, 14.5, 5.6, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,50,80,.5)'; ctx.lineWidth = 1; for (let k2 = -2; k2 <= 2; k2++) { ctx.beginPath(); ctx.moveTo(x + 14, y + 6 - open); ctx.lineTo(x + 14 + k2 * 5, y + 1 - open); ctx.stroke(); }
    if (open) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 14, y + 8, 3, 0, TAU); ctx.fill(); glow(ctx, x + 14, y + 8, 14, '#ffffff', .6); }
  } else if (e.kind === 'crate') {
    ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, e.x - 1, e.y - 1, 30, 30, 4); ctx.fill();
    ctx.fillStyle = '#c4874a'; ctx.beginPath(); rr(ctx, e.x + .5, e.y + .5, 27, 27, 3); ctx.fill();
    ctx.fillStyle = '#e2a466'; ctx.fillRect(e.x + 2, e.y + 2, 24, 2);
    ctx.strokeStyle = 'rgba(70,35,10,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e.x + 3, e.y + 3); ctx.lineTo(e.x + 25, e.y + 25); ctx.moveTo(e.x + 25, e.y + 3); ctx.lineTo(e.x + 3, e.y + 25); ctx.stroke();
    ctx.fillStyle = '#2de2c3'; ctx.fillRect(e.x + 1, e.y + 12, 26, 4);
    ctx.fillStyle = '#9fb0c4'; for (const [qx, qy] of [[0, 0], [22, 0], [0, 22], [22, 22]]) ctx.fillRect(e.x + qx + 1, e.y + qy + 1, 5, 5);
  }
}
function drawMovers(t) {
  for (const p of plats) {
    if (p.kind === 'log') {
      ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, p.x - 1, p.y - 1, p.w + 2, p.h + 2, 6); ctx.fill();
      ctx.fillStyle = '#9a5f2e'; ctx.beginPath(); rr(ctx, p.x, p.y, p.w, p.h, 5); ctx.fill();
      ctx.fillStyle = '#c4874a'; ctx.fillRect(p.x + 4, p.y + 1, p.w - 8, 2); ctx.fillStyle = '#4caf7a'; ctx.fillRect(p.x + 10, p.y - 1, 10, 2); ctx.fillRect(p.x + 40, p.y - 1, 6, 2);
      ctx.fillStyle = '#e2b47c'; ctx.beginPath(); ctx.ellipse(p.x + p.w - 3, p.y + p.h / 2, 3, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(p.x - 6 + Math.sin(t * 3) * 2, p.y + p.h + 2, p.w + 12, 1.5);
    } else {
      ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, p.x - 1, p.y - 1, p.w + 2, p.h + 2, 4); ctx.fill();
      const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h); g.addColorStop(0, '#d9e3ee'); g.addColorStop(1, '#6e7f94'); ctx.fillStyle = g; ctx.beginPath(); rr(ctx, p.x, p.y, p.w, p.h, 3); ctx.fill();
      ctx.fillStyle = '#2de2c3'; ctx.fillRect(p.x + 6, p.y + 4, p.w - 12, 2);
      glow(ctx, p.x + 14, p.y + p.h + 4, 14, '#5be7ff', .6 + Math.sin(t * 20) * .1); glow(ctx, p.x + p.w - 14, p.y + p.h + 4, 14, '#5be7ff', .6 + Math.sin(t * 20 + 1) * .1);
    }
  }
  if (raft) {
    const r = raft;
    ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 4); ctx.fill();
    for (let k2 = 0; k2 < 6; k2++) { ctx.fillStyle = k2 % 2 ? '#b9773e' : '#c98a4d'; ctx.fillRect(r.x + k2 * 12, r.y, 12, r.h); }
    ctx.fillStyle = '#eaa96c'; ctx.fillRect(r.x, r.y, r.w, 2);
    ctx.fillStyle = OUTLINE; ctx.fillRect(r.x + r.w - 20, r.y - 64, 4, 64);
    const sw = 32 + Math.sin(t * 3) * 3; ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(r.x + r.w - 20, r.y - 62); ctx.quadraticCurveTo(r.x + r.w - 20 - sw, r.y - 40, r.x + r.w - 20, r.y - 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4e4'; ctx.beginPath(); ctx.moveTo(r.x + r.w - 21, r.y - 60); ctx.quadraticCurveTo(r.x + r.w - 21 - sw + 3, r.y - 40, r.x + r.w - 21, r.y - 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6b4a'; ctx.fillRect(r.x + r.w - 21 - sw * .45, r.y - 42, sw * .45, 5);
    if (arena && arena.cleared && !G.levelDone) { const bob = Math.sin(t * 4) * 3; ctx.font = `800 11px ${FD}`; ctx.textAlign = 'center'; ctx.fillStyle = OUTLINE; ctx.fillText('BOARD', r.x + 37, r.y - 73 + bob); ctx.fillStyle = '#ffc65c'; ctx.fillText('BOARD', r.x + 36, r.y - 74 + bob); ctx.textAlign = 'left'; }
  }
  if (exitP) {
    const e = exitP, cx = e.x + e.w / 2, cy = e.y + e.h / 2, pul = Math.sin(e.t / 12);
    glow(ctx, cx, cy, 70, '#2de2c3', .35 + pul * .1);
    ctx.save(); ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) { ctx.rotate(e.t * .01 * (i % 2 ? -1 : 1)); ctx.strokeStyle = rgba(i === 1 ? '#ffffff' : '#2de2c3', .6 - i * .15); ctx.lineWidth = 3 - i * .6; ctx.beginPath(); ctx.ellipse(0, 0, 18 + i * 8, 30 + i * 8, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.5, 'rgba(45,226,195,.7)'); g.addColorStop(1, 'rgba(45,226,195,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, 20, 32, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a4658'; ctx.beginPath(); rr(ctx, e.x - 6, e.y + e.h - 6, e.w + 12, 10, 4); ctx.fill();
    if (G.frame % 6 === 0) burst(cx + rnd(-14, 14), cy + rnd(-20, 20), 1, ['#2de2c3', '#ffffff'], 1, 30, { add: true, g: -.05 });
    const bob = Math.sin(t * 4) * 3; ctx.font = `800 11px ${FD}`; ctx.textAlign = 'center'; ctx.fillStyle = OUTLINE; ctx.fillText('EXIT', cx + 1, e.y - 9 + bob); ctx.fillStyle = '#ffc65c'; ctx.fillText('EXIT', cx, e.y - 10 + bob); ctx.textAlign = 'left';
  }
  for (const gz of geysers) {
    ctx.fillStyle = gz.state ? '#ff7a3a' : '#5a3a3a'; ctx.beginPath(); ctx.ellipse(gz.x, gz.y - 2, 18, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(gz.x, gz.y - 2, 10, 3, 0, 0, TAU); ctx.fill();
    if (gz.state === 1) { glow(ctx, gz.x, gz.y, 30, '#ff7a3a', .5 + Math.sin(G.t * 20) * .3); warnMark(ctx, gz.x, gz.y - 40, G.frame); }
    if (gz.state === 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, gz.y - 190, 0, gz.y); g.addColorStop(0, 'rgba(255,200,100,0)'); g.addColorStop(.3, 'rgba(255,150,60,.7)'); g.addColorStop(1, 'rgba(255,255,220,.95)'); ctx.fillStyle = g; const w = 22 + Math.sin(G.t * 30) * 5; ctx.fillRect(gz.x - w / 2, gz.y - 190, w, 190); ctx.restore(); glow(ctx, gz.x, gz.y - 40, 60, '#ff7a3a', .8); }
  }
}
function drawLasers(t) {
  for (const L of lasers) {
    if (L.x < view.l - 40 || L.x > view.r + 40) continue;
    const ey = L.top - 12, hov = Math.sin(t * 3 + L.tx) * 2;
    glow(ctx, L.x, ey + 14 + hov, 14, '#5be7ff', .5);
    ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, L.x - 13, ey - 3 + hov, 26, 16, 5); ctx.fill();
    const g = ctx.createLinearGradient(0, ey + hov, 0, ey + 12 + hov); g.addColorStop(0, '#d9e3ee'); g.addColorStop(1, '#6e7f94'); ctx.fillStyle = g; ctx.beginPath(); rr(ctx, L.x - 11.5, ey - 1.5 + hov, 23, 13, 4); ctx.fill();
    const lc = L.state === 2 ? '#ff6b4a' : L.state === 1 ? ((G.frame >> 2) % 2 ? '#ff6b4a' : '#5a2a22') : '#3a4658';
    ctx.fillStyle = lc; ctx.beginPath(); ctx.arc(L.x, ey + 9 + hov, 3.5, 0, TAU); ctx.fill();
    if (L.state === 1) { ctx.strokeStyle = `rgba(255,107,74,${(G.frame >> 1) % 2 ? .55 : .2})`; ctx.lineWidth = 1; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(L.x, L.top); ctx.lineTo(L.x, L.bottom); ctx.stroke(); ctx.setLineDash([]); }
    if (L.state === 2) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const w = 10 + Math.sin(t * 40) * 2; ctx.fillStyle = 'rgba(255,90,60,.35)'; ctx.fillRect(L.x - w / 2, L.top, w, L.bottom - L.top);
      ctx.fillStyle = 'rgba(255,200,180,.9)'; ctx.fillRect(L.x - 1.5, L.top, 3, L.bottom - L.top);
      ctx.restore(); glow(ctx, L.x, L.bottom, 26, '#ff6b4a', .9); glow(ctx, L.x, L.top, 14, '#ff6b4a', .8);
    }
  }
}
function drawProj(c, p) {
  if (p.kind === 'coconut') { const x = p.x + 7, y = p.y + 7; c.fillStyle = OUTLINE; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill(); c.fillStyle = '#7a4f2a'; c.beginPath(); c.arc(x, y, 6.6, 0, TAU); c.fill(); c.fillStyle = '#3e2512'; const a = p.t * .3; for (let k2 = 0; k2 < 3; k2++) { c.beginPath(); c.arc(x + Math.cos(a + k2 * 2.1) * 3, y + Math.sin(a + k2 * 2.1) * 3, 1.2, 0, TAU); c.fill(); } }
  else if (p.kind === 'bubble') { const x = p.x + 10, y = p.y + 10; glow(c, x, y, 18, '#5be7ff', .5); c.fillStyle = 'rgba(91,231,255,.35)'; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); c.strokeStyle = 'rgba(233,251,255,.9)'; c.lineWidth = 1.6; c.stroke(); c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x - 3.5, y - 4, 3, 2, -.6, 0, TAU); c.fill(); }
  else if (p.kind === 'shock') { c.fillStyle = '#f0cf95'; c.beginPath(); c.moveTo(p.x, p.y + p.h); c.quadraticCurveTo(p.x + p.w / 2, p.y - 8, p.x + p.w, p.y + p.h); c.closePath(); c.fill(); c.fillStyle = '#fff2d6'; c.beginPath(); c.moveTo(p.x + 5, p.y + p.h); c.quadraticCurveTo(p.x + p.w / 2, p.y, p.x + p.w - 5, p.y + p.h); c.closePath(); c.fill(); }
  else if (p.kind === 'wave') {
    const f = p.facing, o = Math.sin(p.t / 2) * 2, w = p.w, h = p.h;
    glow(c, p.x + w / 2, p.y + h / 2, 34, '#5be7ff', .5);
    c.save(); c.translate(p.x + w / 2, p.y); c.scale(f, 1);
    c.fillStyle = 'rgba(30,150,190,.9)'; c.beginPath(); c.moveTo(-w / 2, h); c.quadraticCurveTo(-w / 2, 4 + o, w / 4, 2 + o); c.quadraticCurveTo(w / 2 + 4, 4, w / 4, 14); c.quadraticCurveTo(w / 2, h * .7, w / 2, h); c.closePath(); c.fill();
    c.strokeStyle = '#e9fbff'; c.lineWidth = 3; c.beginPath(); c.moveTo(-w / 2 + 6, 10 + o); c.quadraticCurveTo(w / 4, -2 + o, w / 2 - 2, 8); c.stroke();
    c.restore();
  } else if (p.kind === 'tsunami') {
    const g = c.createLinearGradient(p.x, 0, p.x + p.w, 0); g.addColorStop(0, 'rgba(20,110,150,0)'); g.addColorStop(.6, 'rgba(30,150,190,.8)'); g.addColorStop(1, 'rgba(120,230,240,.95)');
    c.fillStyle = g; c.fillRect(p.x, p.y, p.w, p.h);
    c.fillStyle = '#e9fbff'; for (let k2 = 0; k2 < 14; k2++) { const yy = p.y + k2 * (p.h / 14); c.beginPath(); c.arc(p.x + p.w + Math.sin(p.t * .3 + k2) * 6, yy, 7, 0, TAU); c.fill(); }
    glow(c, p.x + p.w, p.y + p.h / 2, p.h * .5, '#5be7ff', .4);
  }
}
function drawParticles(additive) {
  if (additive) ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    if (!!p.add !== additive) continue;
    const a = Math.min(1, p.life / p.max * 1.6);
    if (p.type === 'ring') { const k2 = 1 - p.life / p.max; ctx.strokeStyle = rgba(p.c, a * .9); ctx.lineWidth = Math.max(.5, p.sz * (1 - k2 * .7)); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.5, lerp(p.r0, p.r1, easeOut(k2))), 0, TAU); ctx.stroke(); }
    else if (p.type === 'spark') { ctx.strokeStyle = rgba(p.c, a); ctx.lineWidth = Math.max(1, p.sz * .7); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); ctx.stroke(); }
    else if (p.type === 'star') { ctx.fillStyle = rgba(p.c, a); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * .2); ctx.beginPath(); for (let k2 = 0; k2 < 5; k2++) { ctx.lineTo(Math.cos(k2 * 1.2566) * 5, Math.sin(k2 * 1.2566) * 5); ctx.lineTo(Math.cos(k2 * 1.2566 + .628) * 2, Math.sin(k2 * 1.2566 + .628) * 2); } ctx.closePath(); ctx.fill(); ctx.restore(); }
    else if (p.type === 'clone') { ctx.globalCompositeOperation = 'source-over'; drawHero(ctx, p.hero || HEROES[1], { anim: 'light', n: 2, k: 1 - p.life / p.max, t: G.frame }, p.x, p.y + 22, p.f, 1, { sil: rgba('#2de2c3', a * .7) }); if (additive) ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba('#ffffff', a); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 18, p.y - 10); ctx.lineTo(p.x + 18, p.y + 10); ctx.stroke(); }
    else { ctx.fillStyle = rgba(p.c, a); const s = p.sz; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawTexts() {
  ctx.textAlign = 'center';
  for (const ft of texts) {
    const pop = ft.life > 44 ? 1 + (ft.life - 44) / 8 * (ft.crit ? .8 : .45) : 1, a = Math.min(1, ft.life / 14);
    ctx.save(); ctx.translate(ft.x, ft.y); ctx.scale(pop, pop); ctx.globalAlpha = a;
    ctx.font = `900 ${ft.size}px ${FD}`; ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round'; ctx.strokeText(ft.txt, 0, 0); ctx.fillStyle = ft.c; ctx.fillText(ft.txt, 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
function heroState(p) { return { t: G.frame, anim: p.anim, phase: p.phase, n: p.atk ? p.atk.n : 0, k: p.atk ? p.atk.t / p.atk.dur : 0, sq: p.sq, deadRot: p.dead ? p.rot : 0 }; }
function drawPlayerOne(p, t) {
  const h = p.hero;
  if (p.out) return;
  for (const tr of p.trail) drawHero(ctx, h, { anim: tr.anim, t: G.frame, phase: tr.phase }, tr.x + 10, tr.y + 40, tr.f, 1, { sil: rgba(h.c.glow, tr.life / 14 * .45) });
  if (p.inv > 0 && !p.dead && p.shield === 0 && (G.frame % 8 < 3)) return;
  if (p.plat > 0) { ctx.fillStyle = rgba(p.col, .35); ctx.beginPath(); rr(ctx, p.x - 16, p.y + 40, 52, 6, 3); ctx.fill(); glow(ctx, p.x + 10, p.y + 42, 30, p.col, .5); }
  if (h.id === 'kiko' && !p.dead) drawChain(ctx, p.chain, 3.4, h.c.accent);
  if (h.id === 'marisol' && !p.dead) drawChain(ctx, p.chain, 7, h.c.hair, h.c.hair2);
  if (!p.dead && p.onGround) { ctx.fillStyle = 'rgba(10,20,30,.25)'; ctx.beginPath(); ctx.ellipse(p.x + 10, p.y + 40, 13, 3.5, 0, 0, TAU); ctx.fill(); }
  if (players.length > 1 && !p.dead) { glow(ctx, p.x + 10, p.y + 40, 22, p.col, .35); }
  drawHero(ctx, h, heroState(p), p.x + 10, p.y + 40, p.facing, 1, players.length > 1 ? { outline: p.idx === 0 ? OUTLINE : rgba(p.col, 1) } : {});
  if (p.downed) {
    ctx.fillStyle = 'rgba(6,24,33,.8)'; ctx.beginPath(); rr(ctx, p.x - 12, p.y - 24, 44, 8, 4); ctx.fill();
    ctx.fillStyle = p.revive > 0 ? '#2de2c3' : '#ff4d6d'; ctx.beginPath(); rr(ctx, p.x - 11, p.y - 23, 42 * (p.revive > 0 ? p.revive : p.downT / 900), 6, 3); ctx.fill();
    ctx.font = `800 9px ${FD}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText(p.revive > 0 ? 'REVIVING' : 'HELP!', p.x + 10, p.y - 30 + Math.sin(t * 8) * 2); ctx.textAlign = 'left';
  }
  if (p.shield > 0) {
    const a = p.shield < 60 ? (G.frame % 8 < 4 ? .3 : .8) : .8;
    glow(ctx, p.x + 10, p.y + 18, 46, '#ffc65c', .35 * a);
    ctx.strokeStyle = rgba('#ffc65c', .9 * a); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x + 10, p.y + 18, 32, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba('#fff6d8', .12 * a); ctx.fill();
  }
  if (p.meter >= 100 && !p.dead) glow(ctx, p.x + 10, p.y + 20, 30 + Math.sin(t * 8) * 4, h.c.glow, .25);
  if (players.length > 1 && !p.dead) { ctx.font = `800 8px ${FD}`; ctx.textAlign = 'center'; ctx.fillStyle = OUTLINE; ctx.fillText(p.bot ? 'BOT' : 'P' + (p.idx + 1), p.x + 11, p.y - 7); ctx.fillStyle = p.col; ctx.fillText(p.bot ? 'BOT' : 'P' + (p.idx + 1), p.x + 10, p.y - 8); ctx.textAlign = 'left'; }
  if (G.mode === 'match' && p.launch && p.hurtT > 0 && G.frame % 2 === 0) burst(p.x + 10, p.y + 20, 2, [p.col, '#ffffff'], 1, 14, { add: true, type: 'spark', g: 0 });
  if (p.launch && p.hurtT === 0) p.launch = 0;
}
function drawOffscreen() {
  if (G.mode !== 'match') return;
  for (const p of players) {
    if (p.out || p.dead) continue;
    const cx = p.x + 10, cy = p.y + 20; if (cx > view.l && cx < view.r && cy > view.t && cy < view.b) continue;
    const ax = clamp(cx, view.l + 30, view.r - 30), ay = clamp(cy, view.t + 30, view.b - 30);
    ctx.fillStyle = rgba(p.col, .9); ctx.beginPath(); ctx.arc(ax, ay, 14, 0, TAU); ctx.fill(); ctx.fillStyle = OUTLINE; ctx.font = `800 9px ${FD}`; ctx.textAlign = 'center'; ctx.fillText('P' + (p.idx + 1), ax, ay + 3); ctx.textAlign = 'left';
    ctx.strokeStyle = rgba(p.col, .9); ctx.lineWidth = 3; ctx.beginPath(); const ang = Math.atan2(cy - ay, cx - ax); ctx.moveTo(ax + Math.cos(ang) * 16, ay + Math.sin(ang) * 16); ctx.lineTo(ax + Math.cos(ang) * 26, ay + Math.sin(ang) * 26); ctx.stroke();
  }
}
function drawWorld(left, top, z, t) {
  ctx.setTransform(z, 0, 0, z, -left * z, -top * z);
  for (const d of decor) if (d.x > view.l - 120 && d.x < view.r + 120) drawPalm(ctx, d, t);
  for (const s of signs) if (s.x > view.l - 200 && s.x < view.r + 200) drawSign(s, t);
  drawFaces(t);
  drawTiles(t);
  drawLasers(t);
  drawMovers(t);
  for (const e of ents) {
    if (e.x + (e.w || 0) < view.l - 60 || e.x > view.r + 60) continue;
    if (e.hp === undefined || e.kind === 'crate') drawPickup(e, t);
    else {
      drawEnemy(ctx, e, G.frame);
      if ((e.state === 'telegraph' && !e.boss) || e.state === 'lock' || e.state === 'wind') warnMark(ctx, e.x + e.w / 2, e.y - 16, G.frame);
      if (e.kind === 'd' && e.state === 'lock') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, e.y + e.h, 0, e.y + e.h + 220); g.addColorStop(0, 'rgba(255,77,109,.35)'); g.addColorStop(1, 'rgba(255,77,109,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(e.x + e.w / 2 - 4, e.y + e.h); ctx.lineTo(e.x + e.w / 2 + 4, e.y + e.h); ctx.lineTo(e.x + e.w / 2 + 34, e.y + e.h + 220); ctx.lineTo(e.x + e.w / 2 - 34, e.y + e.h + 220); ctx.closePath(); ctx.fill(); ctx.restore(); }
      if (e.boss && e.state === 'sleep') { ctx.font = `800 12px ${FD}`; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .7 + Math.sin(t * 2) * .3; ctx.fillText('z', e.x + e.w + 4, e.y - 6 + Math.sin(t * 2) * 3); ctx.fillText('z', e.x + e.w + 14, e.y - 20 + Math.sin(t * 2 + 1) * 3); ctx.globalAlpha = 1; }
      if (e.hp < e.max && !e.boss) { ctx.fillStyle = 'rgba(10,26,36,.8)'; ctx.beginPath(); rr(ctx, e.x, e.y - 8, e.w, 4, 2); ctx.fill(); ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); rr(ctx, e.x, e.y - 8, Math.max(4, e.w * e.hp / e.max), 4, 2); ctx.fill(); }
      if (e.burn > 0 && G.frame % 6 === 0) burst(e.x + rnd(0, e.w), e.y + e.h * .4, 1, ['#ff7b2e', '#ffd166'], 1.2, 16, { add: true, g: -.12 });
    }
  }
  for (const c of corpses) { ctx.save(); ctx.globalAlpha = Math.min(1, c.life / 10); drawEnemy(ctx, c, G.frame); ctx.restore(); }
  for (const p of projs) drawProj(ctx, p);
  drawParticles(false);
  for (const p of players) drawPlayerOne(p, t);
  drawParticles(true);
  drawWaterFront(t);
  drawOffscreen();
  drawTexts();
}
