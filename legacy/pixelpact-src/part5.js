/* =========================================================
   HUD & overlays (screen space)
   ========================================================= */
function textStroke(txt, x, y, fill, stroke, lw) { ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y); }
function drawPlayerCard(p, x, y, u, compact) {
  const h = p.hero, R = (compact ? 17 : 25) * u, cx = x + R + 4 * u, cy = y + R + 4 * u, frac = clamp(p.hp / p.max, 0, 1);
  ctx.fillStyle = 'rgba(6,24,33,.78)'; ctx.beginPath(); ctx.arc(cx, cy, R + 6 * u, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R - 3 * u, 0, TAU); ctx.clip();
  const bg = ctx.createLinearGradient(0, cy - R, 0, cy + R); bg.addColorStop(0, '#2c7a8e'); bg.addColorStop(1, '#f2977a'); ctx.fillStyle = bg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  const hs = R / 25 * u * 1.45; drawHero(ctx, h, { anim: p.downed || p.dead ? 'dead' : p.hurtT > 0 ? 'hurt' : 'idle', t: G.frame }, cx - 1 * u, cy + 3 * u + 41 * hs, 1, hs);
  ctx.restore();
  ctx.lineCap = 'round'; ctx.lineWidth = 5 * u * (R / 25 / u); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(cx, cy, R + 1 * u, 0, TAU); ctx.stroke();
  const col = p.downed ? '#ff4d6d' : frac > .5 ? '#2de2c3' : frac > .25 ? '#ffc65c' : '#ff4d6d';
  if (frac > 0 && !p.downed) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R + 1 * u, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke(); }
  if (p.downed) { ctx.strokeStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(cx, cy, R + 1 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (p.downT / 900)); ctx.stroke(); }
  ctx.strokeStyle = rgba(p.col, 1); ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(cx, cy, R + 5.5 * u, 0, TAU); ctx.stroke();
  const bx = cx + R + (compact ? 10 : 16) * u; let by = y + (compact ? 8 : 10) * u;
  ctx.font = `800 ${(compact ? 9 : 11) * u}px ${FD}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const label = (players.length > 1 ? (p.bot ? 'BOT ' : 'P' + (p.idx + 1) + ' ') : '') + h.short.toUpperCase();
  textStroke(label, bx, by, p.downed ? '#ff4d6d' : '#effaf6', 'rgba(6,24,33,.85)', 3 * u);
  const nw = ctx.measureText(label).width; ctx.font = `800 ${(compact ? 9 : 10) * u}px ${FB}`; textStroke(p.downed ? 'DOWN' : `${Math.ceil(p.hp)} / ${p.max}`, bx + nw + 8 * u, by + 1 * u, col, 'rgba(6,24,33,.85)', 3 * u);
  by += (compact ? 12 : 14) * u; const bw = (compact ? 86 : 124) * u, bh = (compact ? 6 : 8) * u, m = p.meter / 100;
  ctx.fillStyle = 'rgba(6,24,33,.8)'; ctx.beginPath(); rr(ctx, bx - 2 * u, by - 2 * u, bw + 4 * u, bh + 4 * u, 5 * u); ctx.fill();
  if (m > 0) { const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#2de2c3'); g.addColorStop(1, '#ffc65c'); ctx.fillStyle = g; ctx.beginPath(); rr(ctx, bx, by, Math.max(bh, bw * m), bh, 4 * u); ctx.fill(); }
  if (m >= 1) { glow(ctx, bx + bw / 2, by + bh / 2, bw * .7, '#ffc65c', .3 + Math.sin(G.t * 8) * .15); ctx.font = `800 ${8 * u}px ${FD}`; const key = p.src === 'touch' ? 'ULT' : p.src.startsWith('pad') ? 'Y' : p.src === 'k2' ? '.' : 'U'; textStroke(`ULT · ${key}`, bx + bw + 8 * u, by + bh / 2, '#ffc65c', 'rgba(6,24,33,.85)', 3 * u); }
  ctx.textBaseline = 'alphabetic';
  return (compact ? 48 : 68) * u;
}
function drawHUD() {
  const u = G.ui, d = G.dpr, s = G.safe, W = cv.width, H = cv.height;
  const L = s.l * d + 14 * u, T = s.t * d + 12 * u;
  ctx.save();
  if (G.mode === 'match') {
    // Smash-style damage panels along the bottom
    const n = players.length, pw = Math.min(150 * u, (W - s.l * d - s.r * d - 40 * u) / n), total = pw * n, x0 = (W - total) / 2, by = H - s.b * d - 70 * u;
    players.forEach((p, i) => {
      const x = x0 + i * pw + 6 * u, w = pw - 12 * u;
      ctx.fillStyle = p.out ? 'rgba(6,24,33,.4)' : 'rgba(6,24,33,.78)'; ctx.beginPath(); rr(ctx, x, by, w, 58 * u, 8 * u); ctx.fill();
      ctx.fillStyle = p.col; ctx.fillRect(x, by, w, 3 * u);
      const R = 16 * u, cx = x + R + 8 * u, cy = by + 29 * u;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip(); ctx.fillStyle = rgba(p.col, .25); ctx.fillRect(cx - R, cy - R, R * 2, R * 2); drawHero(ctx, p.hero, { anim: p.out ? 'dead' : 'idle', t: G.frame }, cx, cy + 2 * u + 41 * u * .9, 1, u * .9); ctx.restore();
      ctx.strokeStyle = p.col; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.font = `800 ${8 * u}px ${FD}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; textStroke((p.bot ? 'BOT' : 'P' + (p.idx + 1)) + ' · ' + p.hero.short.toUpperCase(), cx + R + 8 * u, by + 12 * u, p.col, 'rgba(6,24,33,.9)', 3 * u);
      const dmgCol = p.dmg < 40 ? '#ffffff' : p.dmg < 90 ? '#ffc65c' : p.dmg < 140 ? '#ff6b4a' : '#ff4d6d', pop = p.hurtT > 8 ? 1.2 : 1;
      ctx.save(); ctx.translate(cx + R + 8 * u, by + 36 * u); ctx.scale(pop, pop); ctx.font = `900 ${22 * u}px ${FD}`; textStroke(p.out ? 'OUT' : Math.round(p.dmg) + '%', 0, 0, p.out ? '#94b9c2' : dmgCol, 'rgba(6,24,33,.9)', 4 * u); ctx.restore();
      for (let k2 = 0; k2 < settings.stocks; k2++) { const on = k2 < p.stocks; ctx.fillStyle = on ? p.col : 'rgba(239,250,246,.15)'; ctx.beginPath(); ctx.arc(x + w - 10 * u - k2 * 11 * u, by + 14 * u, 4 * u, 0, TAU); ctx.fill(); }
      if (p.meter >= 100 && !p.out) glow(ctx, x + w / 2, by + 29 * u, w * .5, '#ffc65c', .25 + Math.sin(G.t * 8) * .1);
      ctx.fillStyle = 'rgba(239,250,246,.12)'; ctx.fillRect(x + w - 10 * u - 48 * u, by + 46 * u, 48 * u, 4 * u); const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#2de2c3'); g.addColorStop(1, '#ffc65c'); ctx.fillStyle = g; ctx.fillRect(x + w - 10 * u - 48 * u, by + 46 * u, 48 * u * p.meter / 100, 4 * u);
    });
    // timer
    const tm = Math.floor(stats.time / 60), ts = Math.floor(stats.time % 60), tstr = tm + ':' + (ts < 10 ? '0' : '') + ts;
    ctx.font = `${10 * u}px ${FP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; const tw2 = ctx.measureText(tstr).width;
    ctx.fillStyle = 'rgba(6,24,33,.7)'; ctx.beginPath(); rr(ctx, W / 2 - tw2 / 2 - 12 * u, T + 4 * u, tw2 + 24 * u, 24 * u, 12 * u); ctx.fill(); ctx.fillStyle = '#effaf6'; ctx.fillText(tstr, W / 2, T + 20 * u);
    ctx.font = `800 ${8 * u}px ${FD}`; ctx.fillStyle = '#94b9c2'; ctx.fillText(STAGE.name.toUpperCase() + (settings.hazards ? ' · HAZARDS ON' : ''), W / 2, T + 40 * u);
    if (G.hazardWarn > 0) { G.hazardWarn--; ctx.font = `900 ${14 * u}px ${FD}`; textStroke('WAVE INCOMING', W / 2, T + 70 * u, (G.frame >> 3) % 2 ? '#5be7ff' : '#ffffff', 'rgba(6,24,33,.9)', 4 * u); }
  } else {
    const compact = players.length > 1; let y = T;
    const xs = compact && players.length > 2 ? [L, L + 180 * u] : [L];
    players.forEach((p, i) => { const col = compact && players.length > 2 ? i % 2 : 0, row = compact && players.length > 2 ? Math.floor(i / 2) : i; drawPlayerCard(p, xs[col], T + row * (compact ? 50 : 70) * u, u, compact); });
    y = T + Math.ceil(players.length / (players.length > 2 ? 2 : 1)) * (compact ? 50 : 70) * u + 4 * u;
    let x = L + 6 * u; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(x + 6 * u, y, 7 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffc65c'; ctx.beginPath(); ctx.arc(x + 6 * u, y, 5.6 * u, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff3c0'; ctx.fillRect(x + 5 * u, y - 3 * u, 2 * u, 3 * u);
    ctx.font = `800 ${12 * u}px ${FD}`; textStroke(String(stats.coins), x + 17 * u, y + 1 * u, '#ffffff', 'rgba(6,24,33,.85)', 3 * u); x += 17 * u + ctx.measureText(String(stats.coins)).width + 14 * u;
    for (let k2 = 0; k2 < 3; k2++) { const on = k2 < stats.shells, sx2 = x + k2 * 15 * u; ctx.fillStyle = on ? '#2de2c3' : 'rgba(239,250,246,.2)'; ctx.beginPath(); ctx.moveTo(sx2 + 6 * u, y - 7 * u); ctx.quadraticCurveTo(sx2 + 13 * u, y - 3 * u, sx2 + 11 * u, y + 5 * u); ctx.lineTo(sx2 + 1 * u, y + 5 * u); ctx.quadraticCurveTo(sx2 - 1 * u, y - 3 * u, sx2 + 6 * u, y - 7 * u); ctx.fill(); if (on) glow(ctx, sx2 + 6 * u, y, 10 * u, '#2de2c3', .5); }
    x += 3 * 15 * u + 10 * u;
    const hy = y + 1 * u, hr2 = 6 * u; ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(x + hr2, hy + hr2 * .9); ctx.bezierCurveTo(x - hr2 * .4, hy - hr2 * .1, x + hr2 * .3, hy - hr2 * 1.1, x + hr2, hy - hr2 * .35); ctx.bezierCurveTo(x + hr2 * 1.7, hy - hr2 * 1.1, x + hr2 * 2.4, hy - hr2 * .1, x + hr2, hy + hr2 * .9); ctx.fill();
    ctx.font = `800 ${11 * u}px ${FD}`; textStroke(stats.lives > 50 ? '∞' : '×' + stats.lives, x + 15 * u, y + 1 * u, '#ffffff', 'rgba(6,24,33,.85)', 3 * u);
    const tm = Math.floor(stats.time / 60), ts = Math.floor(stats.time % 60), tstr = tm + ':' + (ts < 10 ? '0' : '') + ts;
    ctx.font = `${10 * u}px ${FP}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; const tx = W - s.r * d - 68 * d, tw2 = ctx.measureText(tstr).width;
    ctx.fillStyle = 'rgba(6,24,33,.7)'; ctx.beginPath(); rr(ctx, tx - tw2 - 12 * u, T + 4 * u, tw2 + 24 * u, 24 * u, 12 * u); ctx.fill(); ctx.fillStyle = '#effaf6'; ctx.fillText(tstr, tx, T + 17 * u);
    const cp = players.reduce((a, p) => p.combo > (a ? a.combo : 0) ? p : a, null);
    if (cp && cp.combo >= 2) {
      const ranks = [[25, 'S', '#ffc65c'], [15, 'A', '#ff6b4a'], [10, 'B', '#ffc65c'], [5, 'C', '#2de2c3'], [2, 'D', '#94b9c2']];
      const rk = ranks.find(r => cp.combo >= r[0]), cyy = T + 64 * u, pop = cp.comboT > 92 ? 1.25 : 1, rxx = W - s.r * d - 18 * u;
      ctx.save(); ctx.translate(rxx, cyy); ctx.scale(pop, pop);
      ctx.font = `900 ${34 * u}px ${FD}`; ctx.textAlign = 'right'; textStroke(String(cp.combo), -40 * u, 0, '#ffffff', 'rgba(6,24,33,.9)', 5 * u);
      ctx.font = `800 ${9 * u}px ${FD}`; textStroke('HITS' + (players.length > 1 ? ' · P' + (cp.idx + 1) : ''), -40 * u, 18 * u, cp.col, 'rgba(6,24,33,.9)', 3 * u);
      ctx.font = `900 ${30 * u}px ${FD}`; textStroke(rk[1], 0, 2 * u, rk[2], 'rgba(6,24,33,.9)', 5 * u);
      ctx.restore();
      ctx.fillStyle = 'rgba(6,24,33,.7)'; ctx.fillRect(rxx - 96 * u, cyy + 28 * u, 96 * u, 3 * u); ctx.fillStyle = rk[2]; ctx.fillRect(rxx - 96 * u * cp.comboT / 100, cyy + 28 * u, 96 * u * cp.comboT / 100, 3 * u);
    }
    if (boss && arena && arena.active && !boss.dead && G.cine < 30) {
      const bw2 = Math.min(W * .44, 440 * u), bx2 = (W - bw2) / 2, by2 = G.portrait ? T + 92 * u : T + 22 * u;
      ctx.textAlign = 'center'; ctx.font = `900 ${12 * u}px ${FD}`; textStroke('BIG CLAW', W / 2, by2 - 12 * u, boss.enraged ? '#ff4d6d' : '#ffffff', 'rgba(6,24,33,.9)', 4 * u);
      ctx.fillStyle = 'rgba(6,24,33,.85)'; ctx.beginPath(); rr(ctx, bx2 - 3 * u, by2 - 3 * u, bw2 + 6 * u, 14 * u, 4 * u); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(bx2, by2, bw2 * Math.max(0, boss.hpLag) / boss.max, 8 * u);
      const g = ctx.createLinearGradient(bx2, 0, bx2 + bw2, 0); g.addColorStop(0, '#ff6b4a'); g.addColorStop(1, boss.enraged ? '#ff4d6d' : '#ffc65c'); ctx.fillStyle = g; ctx.fillRect(bx2, by2, bw2 * Math.max(0, boss.hp) / boss.max, 8 * u);
      ctx.fillStyle = 'rgba(6,24,33,.9)'; ctx.fillRect(bx2 + bw2 * .5, by2, 2 * u, 8 * u); ctx.fillRect(bx2 + bw2 * .3, by2, 2 * u, 8 * u);
    }
  }
  if (settings.fps) { ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 ${10 * u}px ${FB}`; ctx.fillStyle = '#effaf6'; ctx.fillText(`${G.fps} FPS · ${Math.round(G.res * 100)}%`, L, H - s.b * d - 10 * u); }
  ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawOverlays() {
  const W = cv.width, H = cv.height, u = G.ui;
  if (vignette) ctx.drawImage(vignette, 0, 0, W, H);
  const lowP = players.find(p => !p.bot && p.hp > 0 && p.hp < p.max * .25 && !p.dead && G.mode !== 'match');
  const low = lowP ? .3 + Math.sin(G.t * 6) * .12 : 0, red = Math.max(low, G.hurtFlash * .7);
  if (red > .01) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, `rgba(255,40,70,${red})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (G.flash > 0 && motionOK()) { ctx.fillStyle = `rgba(255,248,230,${G.flash * .55})`; ctx.fillRect(0, 0, W, H); }
  ctx.textAlign = 'left';
  if (G.cine > 0) {
    const k2 = Math.min(1, Math.min(G.cine, 120 - G.cine) / 18), bar = H * .11 * k2;
    ctx.fillStyle = '#02080c'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    const slide = easeOut((110 - G.cine) / 30), x = lerp(-W * .5, W * .08 + G.safe.l * G.dpr, slide), y = H * .62;
    ctx.save(); ctx.globalAlpha = k2; ctx.fillStyle = '#ff6b4a'; ctx.fillRect(x - 12 * u, y - 44 * u, 6 * u, 72 * u);
    ctx.font = `${9 * u}px ${FP}`; ctx.fillStyle = '#ffc65c'; ctx.fillText('BOSS · TIDE TYRANT MK II', x, y - 30 * u);
    ctx.font = `900 ${Math.min(46 * u, W * .09)}px ${FD}`; textStroke('BIG CLAW', x, y + 14 * u, '#effaf6', '#02080c', 6 * u);
    ctx.restore();
  }
  if (G.bannerT < 220 && LEVEL) {
    const k2 = G.bannerT < 30 ? easeOut(G.bannerT / 30) : G.bannerT > 180 ? 1 - (G.bannerT - 180) / 40 : 1, y = H * .34;
    ctx.save(); ctx.globalAlpha = clamp(k2, 0, 1);
    const bx = lerp(-W * .3, 0, k2), bw = Math.min(W * .86, 640 * u);
    ctx.fillStyle = 'rgba(6,24,33,.8)'; ctx.beginPath(); ctx.moveTo(bx, y - 46 * u); ctx.lineTo(bx + bw, y - 46 * u); ctx.lineTo(bx + bw - 30 * u, y + 44 * u); ctx.lineTo(bx, y + 44 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6b4a'; ctx.fillRect(bx, y - 46 * u, 80 * u, 4 * u);
    const lx = bx + G.safe.l * G.dpr + 26 * u;
    ctx.font = `${10 * u}px ${FP}`; ctx.fillStyle = '#ff6b4a'; ctx.fillText(LEVEL.id, lx, y - 20 * u);
    ctx.font = `900 ${Math.min(34 * u, W * .06)}px ${FD}`; textStroke(LEVEL.name.toUpperCase(), lx, y + 12 * u, '#effaf6', 'rgba(2,8,12,.8)', 4 * u);
    ctx.font = `700 ${Math.min(11 * u, W * .022)}px ${FB}`; ctx.fillStyle = '#94b9c2'; ctx.fillText(players.length > 1 ? 'Stick together. Stand by a downed friend to revive them.' : 'Find 3 Pact Shells and reach the exit', lx, y + 32 * u);
    ctx.restore();
  }
  if (G.countdown > 0) {
    const c = G.countdown, n = Math.ceil(c / 60), txt = c > 180 ? 'READY' : n > 0 ? String(n) : 'GO', k2 = (c % 60) / 60;
    ctx.save(); ctx.textAlign = 'center'; ctx.translate(W / 2, H * .42); ctx.scale(1 + (1 - k2) * .2, 1 + (1 - k2) * .2); ctx.globalAlpha = .4 + k2 * .6;
    ctx.font = `900 ${Math.min(90 * u, W * .16)}px ${FD}`; textStroke(txt, 0, 0, txt === 'GO' ? '#2de2c3' : '#ffc65c', '#02080c', 8 * u); ctx.restore();
    if (c > 180) { ctx.textAlign = 'center'; ctx.font = `800 ${11 * u}px ${FD}`; ctx.fillStyle = '#effaf6'; ctx.fillText(STAGE.name.toUpperCase() + ' · ' + settings.stocks + ' STOCKS', W / 2, H * .42 + 50 * u); }
  }
  if (G.matchOver && G.matchT > 10) {
    const w = players.find(p => p.winner), k2 = easeOut((G.matchT - 10) / 25); ctx.save(); ctx.globalAlpha = k2; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2,8,12,.45)'; ctx.fillRect(0, H * .3, W, H * .26);
    ctx.font = `900 ${Math.min(52 * u, W * .09)}px ${FD}`; textStroke(w ? (w.bot ? 'BOT ' + (w.idx + 1) : 'PLAYER ' + (w.idx + 1)) + ' WINS' : 'DRAW', W / 2, H * .44, w ? w.col : '#effaf6', '#02080c', 7 * u);
    if (w) { ctx.font = `800 ${12 * u}px ${FD}`; ctx.fillStyle = '#ffc65c'; ctx.fillText(w.hero.name.toUpperCase(), W / 2, H * .44 + 28 * u); }
    ctx.restore();
  }
  if (G.levelDone && G.levelT > 20) {
    const k2 = easeOut((G.levelT - 20) / 25); ctx.save(); ctx.globalAlpha = k2; ctx.textAlign = 'center';
    ctx.font = `900 ${Math.min(64 * u, W * .1)}px ${FD}`; const g = ctx.createLinearGradient(0, H * .3, 0, H * .42); g.addColorStop(0, '#fff6d8'); g.addColorStop(.5, '#ffc65c'); g.addColorStop(1, '#ff6b4a');
    ctx.lineWidth = 8 * u; ctx.strokeStyle = 'rgba(2,8,12,.85)'; ctx.lineJoin = 'round'; ctx.strokeText('STAGE CLEAR', W / 2, H * .4); ctx.fillStyle = g; ctx.fillText('STAGE CLEAR', W / 2, H * .4);
    ctx.restore();
  }
  if (G.gameOver) { ctx.fillStyle = `rgba(2,8,12,${Math.min(.7, G.gameOverT / 60)})`; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.font = `900 ${Math.min(48 * u, W * .08)}px ${FD}`; textStroke('OUT OF LIVES', W / 2, H * .45, '#ff4d6d', '#02080c', 6 * u); }
  ctx.textAlign = 'left';
  if (G.fade > 0) { ctx.fillStyle = `rgba(6,24,33,${G.fade})`; ctx.fillRect(0, 0, W, H); }
}
function drawPlay() {
  const z = G.Z * G.punch, vw = cv.width / z, vh = cv.height / z;
  const sh = motionOK() ? G.trauma * G.trauma * 16 : 0, sx = sh * (Math.sin(G.frame * 1.7) + Math.sin(G.frame * 3.1) * .5) / 1.5, sy = sh * (Math.cos(G.frame * 1.3) + Math.sin(G.frame * 2.7) * .5) / 1.5;
  const left = G.cam.cx - vw / 2 + sx, top = G.cam.cy - vh / 2 + sy;
  view = { l: left, t: top, r: left + vw, b: top + vh };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackdrop(left, top, z, G.t);
  drawWorld(left, top, z, G.t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawOverlays();
  if (G.scene === 'play' || G.scene === 'pause') drawHUD();
}
function drawTitle() {
  G.theme = THEMES.beach;
  const z = G.Zbase, vw = cv.width / z, vh = cv.height / z, cx = 600 + G.t * 26, cy = G.portrait ? 330 : 300, left = cx - vw / 2, top = cy - vh / 2, t = G.t;
  view = { l: left, t: top, r: left + vw, b: top + vh };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const savedMode = G.mode; G.mode = 'adventure'; drawBackdrop(left, top, z, t); G.mode = savedMode;
  ctx.setTransform(z, 0, 0, z, -left * z, -top * z);
  const gy = 416, SAND = THEMES.beach.sand;
  const sg = ctx.createLinearGradient(0, gy, 0, gy + 300); sg.addColorStop(0, '#f2c176'); sg.addColorStop(1, '#a86f3c'); ctx.fillStyle = sg; ctx.fillRect(left - 10, gy, vw + 20, vh + 200);
  ctx.fillStyle = SAND[0]; ctx.fillRect(left - 10, gy, vw + 20, 7); ctx.fillStyle = 'rgba(90,50,20,.22)'; ctx.fillRect(left - 10, gy + 7, vw + 20, 2);
  ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
  for (let k2 = Math.floor(left / TS); k2 <= Math.floor((left + vw) / TS); k2++) if (hash(k2, 7) > .3) { const bx = k2 * TS + 5 + hash(k2, 3) * 22, sw = Math.sin(t * 2 + k2) * 1.6; ctx.strokeStyle = '#3fae7a'; ctx.beginPath(); ctx.moveTo(bx, gy + 3); ctx.quadraticCurveTo(bx + sw, gy - 4, bx + sw * 1.6 + 2, gy - 9); ctx.stroke(); }
  for (let k2 = Math.floor(left / 340) - 1; k2 <= Math.floor((left + vw) / 340) + 1; k2++) drawPalm(ctx, { x: k2 * 340 + hash(k2, 3) * 140, y: gy, hgt: 110 + hash(k2, 5) * 80, lean: hash(k2, 7) > .5 ? 1 : -1 }, t);
  const baseX = G.portrait ? cx : cx + vw * .16, sc = G.portrait ? 1.35 : 1.5;
  HEROES.forEach((h, i) => {
    const hx = baseX + (i - 1.5) * 52 * sc, f = i < 2 ? 1 : -1, fr = G.frame + i * 37, cyc = fr % 600;
    const S = cyc > 520 && cyc < 560 ? { anim: 'win', t: fr } : { anim: 'idle', t: fr };
    ctx.fillStyle = 'rgba(10,20,30,.22)'; ctx.beginPath(); ctx.ellipse(hx, gy, 16 * sc, 4 * sc, 0, 0, TAU); ctx.fill();
    drawHero(ctx, h, S, hx, gy, f, sc);
  });
  const crabX = ((t * 40) % (vw + 120)) + left - 60; ctx.save(); ctx.translate(crabX, gy - 20); drawCrab(ctx, { w: 32, h: 20, state: 'walk' }, G.frame); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (vignette) ctx.drawImage(vignette, 0, 0, cv.width, cv.height);
  if (G.fade > 0) { ctx.fillStyle = `rgba(6,24,33,${G.fade})`; ctx.fillRect(0, 0, cv.width, cv.height); }
}

/* =========================================================
   Lobby (slots, showcase) & pickers
   ========================================================= */
const scCanvas = $('showcase'), scCtx = scCanvas.getContext('2d');
const lobby = { slots: [], focus: 0 };
function freeSources() { const used = new Set(lobby.slots.map(s => s.src)); return ALL_SRC.filter(s => !used.has(s)); }
function primarySource() { return matchMedia('(pointer:coarse)').matches || inputKind === 'touch' ? 'touch' : inputKind === 'pad' ? 'pad0' : 'k1'; }
function openLobby() {
  G.scene = 'lobby'; G.world = false; show('scrLobby'); setPlayUI(false);
  const adv = G.mode === 'adventure';
  $('lobbyEyebrow').textContent = adv ? `Adventure · ${LEVELS[G.level].id} ${LEVELS[G.level].name}` : `Match · ${STAGES[G.stage].name} · ${settings.stocks} stocks`;
  $('lobbyTitle').textContent = adv ? 'Pick your heroes' : 'Fighters, ready up';
  $('btnAddBot').hidden = false; $('btnAddBot').textContent = adv ? 'Add bot ally' : 'Add bot';
  if (!lobby.slots.length) lobby.slots.push({ idx: 0, src: primarySource(), hero: settings.heroes[0], ready: false });
  for (const s of lobby.slots) if (s.src !== 'bot') s.ready = false;
  lobby.src = {}; for (const s of ALL_SRC) { lobby.src[s] = { cur: BLANK(), prev: {}, just: {} }; }
  buildSlots();
}
function buildSlots() {
  const wrapEl = $('slots'); wrapEl.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const s = lobby.slots[i], d = document.createElement('div'); d.className = 'slot' + (s ? '' : ' empty'); d.style.setProperty('--pc', PCOL[i]);
    if (!s) {
      d.innerHTML = `<div class="pn">P${i + 1}</div><div>Press <b>Jump</b> on a free controller<br>or</div>`;
      const j = document.createElement('button'); j.className = 'join'; j.textContent = i === 0 ? 'Join' : (G.mode === 'match' ? 'Add bot' : 'Add bot ally');
      j.addEventListener('click', () => { if (i === 0) joinSlot(primarySource()); else addBot(); }); d.appendChild(j);
    } else {
      const h = HEROES[s.hero];
      d.innerHTML = `<div class="pn">${s.src === 'bot' ? 'BOT' : 'P' + (i + 1)}</div>`;
      const cn = document.createElement('canvas'); d.appendChild(cn); s.cn = cn;
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = h.short; d.appendChild(nm);
      const src = document.createElement('div'); src.className = 'src'; src.textContent = SRC_NAMES[s.src]; d.appendChild(src);
      const pick = document.createElement('div'); pick.className = 'pick';
      const l = document.createElement('button'); l.textContent = '◀'; l.setAttribute('aria-label', 'Previous hero'); l.addEventListener('click', () => cycleHero(s, -1));
      const r = document.createElement('button'); r.textContent = '▶'; r.setAttribute('aria-label', 'Next hero'); r.addEventListener('click', () => cycleHero(s, 1));
      const rd = document.createElement('button'); rd.className = 'ready' + (s.ready ? ' on' : ''); rd.textContent = s.ready ? 'READY' : 'Ready?'; rd.addEventListener('click', () => toggleReady(s));
      pick.appendChild(l); pick.appendChild(rd); pick.appendChild(r); d.appendChild(pick);
      if (i > 0 || s.src === 'bot') { const x = document.createElement('button'); x.className = 'ready'; x.style.fontSize = '9px'; x.textContent = 'Leave'; x.addEventListener('click', () => leaveSlot(s)); d.appendChild(x); }
      d.addEventListener('click', e => { if (e.target === d || e.target === cn || e.target === nm) lobby.focus = i; });
    }
    wrapEl.appendChild(d);
  }
  updateLobbyInfo();
}
function updateLobbyInfo() {
  const s = lobby.slots[lobby.focus] || lobby.slots[0]; if (!s) return;
  const h = HEROES[s.hero];
  $('scWho').textContent = (s.src === 'bot' ? 'BOT' : 'P' + (s.idx + 1)) + ' · ' + h.name.toUpperCase();
  $('selAbil').innerHTML = `<div class="ab"><span class="t">SPECIAL</span><div><b>${h.sig}</b> <span>${h.sigDesc}</span></div></div><div class="ab"><span class="t">ULTIMATE</span><div><b>${h.ult}</b> <span>${h.ultDesc}</span></div></div><div class="ab"><span class="t">PERK</span><div><span>${h.perk}</span></div></div>`;
  const n = lobby.slots.length, allReady = lobby.slots.every(q => q.ready || q.src === 'bot'), minN = G.mode === 'match' ? 2 : 1;
  $('btnStart').disabled = !(n >= minN && allReady);
  $('lobbyHint').textContent = G.mode === 'match' ? (n < 2 ? 'Add a bot or press Jump on another controller to add a fighter.' : allReady ? 'Everyone is ready.' : 'Each player presses Attack or taps Ready.') : (allReady ? 'Ready. Up to 4 can join with keyboards, gamepads or bots.' : 'Press Attack or tap Ready when your hero is chosen.');
}
function joinSlot(src) {
  if (lobby.slots.length >= 4 || lobby.slots.some(s => s.src === src)) return;
  const idx = lobby.slots.length; lobby.slots.push({ idx, src, hero: settings.heroes[idx] ?? idx % 4, ready: false }); Sound.sfx.join(); lobby.focus = idx; buildSlots();
}
function addBot() { if (lobby.slots.length >= 4) return; const idx = lobby.slots.length, used = lobby.slots.map(s => s.hero); let hero = [0, 1, 2, 3].find(h => !used.includes(h)); if (hero === undefined) hero = idx % 4; lobby.slots.push({ idx, src: 'bot', hero, ready: true }); Sound.sfx.join(); buildSlots(); }
function leaveSlot(s) { lobby.slots = lobby.slots.filter(q => q !== s); lobby.slots.forEach((q, i) => q.idx = i); lobby.focus = 0; Sound.sfx.back(); buildSlots(); }
function cycleHero(s, d) { s.hero = (s.hero + d + 4) % 4; s.ready = s.src === 'bot'; Sound.sfx.select(); lobby.focus = s.idx; settings.heroes[s.idx] = s.hero; saveSettings(); buildSlots(); }
function toggleReady(s) { s.ready = !s.ready; (s.ready ? Sound.sfx.ready : Sound.sfx.back)(); buildSlots(); }
function pollLobby() {
  for (const src of ALL_SRC) {
    const st = lobby.src[src]; readSrc(src, st.cur); edge(st.cur, st.prev, st.just);
    const s = lobby.slots.find(q => q.src === src);
    if (!s) { if ((st.just.jump || st.just.atk) && src !== 'touch' || (src === 'touch' && st.just.jump)) joinSlot(src); continue; }
    if (st.just.l || (st.cur.x < -.5 && !st.prevX)) cycleHero(s, -1);
    if (st.just.r || (st.cur.x > .5 && !st.prevX)) cycleHero(s, 1);
    st.prevX = Math.abs(st.cur.x) > .5;
    if (st.just.atk || st.just.jump) toggleReady(s);
    if (st.just.ok && !$('btnStart').disabled) $('btnStart').click();
    if (st.just.back && s.idx > 0) leaveSlot(s);
  }
}
function previewState(f) {
  const c = f % 330, S = { t: f, anim: 'idle', phase: 0, lift: 0 };
  if (c < 80) S.anim = 'idle'; else if (c < 140) { S.anim = 'run'; S.phase = (c - 80) * .32; }
  else if (c < 156) { S.anim = 'light'; S.n = 1; S.k = (c - 140) / 16; } else if (c < 172) { S.anim = 'light'; S.n = 2; S.k = (c - 156) / 16; }
  else if (c < 194) { S.anim = 'light'; S.n = 3; S.k = (c - 172) / 22; } else if (c < 220) { S.anim = 'heavy'; S.k = (c - 194) / 26; }
  else if (c < 260) { S.anim = c < 240 ? 'jump' : 'fall'; S.lift = Math.sin((c - 220) / 40 * Math.PI) * 34; } else if (c < 290) S.anim = 'win';
  return S;
}
function drawShowcase() {
  const r = scCanvas.getBoundingClientRect(), dp = Math.min(devicePixelRatio || 1, 2), W = Math.max(1, Math.round(r.width * dp)), H = Math.max(1, Math.round(r.height * dp));
  if (scCanvas.width !== W || scCanvas.height !== H) { scCanvas.width = W; scCanvas.height = H; }
  const s = lobby.slots[lobby.focus] || lobby.slots[0]; if (!s) return;
  const c = scCtx, h = HEROES[s.hero], f = G.frame; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const sc = Math.min(H * .46 / 52, W * .4 / 30), fx = W / 2, fy = H * .82;
  c.save(); c.translate(fx, fy); c.scale(1, .28);
  c.strokeStyle = rgba(h.c.glow, .6); c.lineWidth = 3 * dp; c.beginPath(); c.arc(0, 0, 40 * sc, 0, TAU); c.stroke();
  c.setLineDash([10 * dp, 12 * dp]); c.lineDashOffset = -f * dp; c.strokeStyle = rgba(PCOL[s.idx], .5); c.beginPath(); c.arc(0, 0, 52 * sc, 0, TAU); c.stroke(); c.setLineDash([]);
  c.restore();
  glow(c, fx, fy, 70 * sc, h.c.glow, .35);
  const S = previewState(f), tag = { idle: 'IDLE', run: 'RUN', light: 'ATTACK COMBO', heavy: h.sig.toUpperCase(), jump: 'JUMP', fall: 'JUMP', win: 'VICTORY' }[S.anim] || '';
  if (drawShowcase._tag !== tag) { $('scTag').textContent = tag; drawShowcase._tag = tag; }
  if (S.anim === 'heavy' && h.id === 'marisol') { c.save(); c.translate(fx + (S.k * 30 + 10) * sc, fy - 36 * sc); c.scale(sc, sc); c.globalAlpha = Math.max(0, 1 - S.k); drawProj(c, { kind: 'wave', x: -18, y: 0, w: 36, h: 36, t: f, facing: 1 }); c.restore(); }
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(fx, fy, 16 * sc, 4 * sc, 0, 0, TAU); c.fill();
  drawHero(c, h, S, fx, fy - S.lift * sc / 2, 1, sc);
  for (const sl of lobby.slots) {
    if (!sl.cn) continue; const rr2 = sl.cn.getBoundingClientRect(), W2 = Math.max(1, Math.round(rr2.width * dp)), H2 = Math.max(1, Math.round(rr2.height * dp));
    if (sl.cn.width !== W2 || sl.cn.height !== H2) { sl.cn.width = W2; sl.cn.height = H2; }
    const cc = sl.cn.getContext('2d'); cc.setTransform(1, 0, 0, 1, 0, 0); cc.clearRect(0, 0, W2, H2);
    const sc2 = H2 * .8 / 52; glow(cc, W2 / 2, H2 * .9, H2 * .6, PCOL[sl.idx], sl.ready ? .5 : .2);
    drawHero(cc, HEROES[sl.hero], { anim: sl.ready ? 'win' : 'idle', t: G.frame + sl.idx * 20, phase: 0 }, W2 / 2, H2 * .94, 1, sc2);
  }
}
function buildPicks() {
  const wrapEl = $('picks'); wrapEl.innerHTML = '';
  const adv = G.mode === 'adventure', list = adv ? LEVELS : STAGES;
  $('pickEyebrow').textContent = adv ? 'Adventure · World 1' : 'Match · Stage'; $('pickTitle').textContent = adv ? 'Choose a level' : 'Choose a stage';
  $('pickNote').textContent = adv ? 'Co-op: up to 4 heroes share one screen, one pool of lives and one exit.' : `Last fighter standing wins. ${settings.stocks} stocks each. Hazards ${settings.hazards ? 'on' : 'off'} (change in Settings).`;
  list.forEach((it, i) => {
    const d = document.createElement('button'); d.className = 'pickcard' + ((adv ? G.level : G.stage) === i ? ' sel' : '');
    const pr = adv ? (progress.levels[it.id] || {}) : null;
    d.innerHTML = `<b>${adv ? it.id + ' · ' : ''}${it.name}</b><span>${it.desc}</span>` + (adv ? `<div class="stars"><i class="${pr.stars >= 1 ? 'on' : ''}"></i><i class="${pr.stars >= 2 ? 'on' : ''}"></i><i class="${pr.stars >= 3 ? 'on' : ''}"></i>${pr.bestTime ? `<span style="margin-left:6px">${fmt(pr.bestTime)} · ${pr.rank || ''}</span>` : ''}</div>` : `<span>Hazard: ${it.hazard}</span>`);
    d.addEventListener('click', () => { if (adv) G.level = i; else G.stage = i; Sound.sfx.select(); buildPicks(); });
    wrapEl.appendChild(d);
  });
}

/* =========================================================
   Screen sizing & loop
   ========================================================= */
function resize() {
  const cssW = Math.max(1, innerWidth), cssH = Math.max(1, innerHeight);
  const cap = settings.quality === 'battery' ? 1 : settings.quality === 'high' ? 2.5 : 2;
  G.dpr = Math.max(.6, Math.min(devicePixelRatio || 1, cap) * G.res);
  cv.width = Math.round(cssW * G.dpr); cv.height = Math.round(cssH * G.dpr);
  G.cssW = cssW; G.cssH = cssH; G.portrait = cssH > cssW * 1.05;
  let zc = G.portrait ? cssW / (13.5 * TS) : cssH / (12.5 * TS);
  zc = Math.max(zc, cssW / (36 * TS));
  G.Zbase = zc * G.dpr; G.Z = G.Zbase * (G.cam.z || 1); G.viewW = cv.width / G.Z; G.viewH = cv.height / G.Z;
  G.ui = clamp(Math.min(cssW, cssH) / 420, .8, 1.45) * G.dpr;
  const cs = getComputedStyle($('safe'));
  G.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  buildVignette();
  document.documentElement.style.setProperty('--b', settings.btn + 'px');
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, slowStreak = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now; if (dt > .1) dt = .1; if (dt < 0) dt = 0;
  fpsN++; fpsT += dt;
  if (fpsT >= 1) { G.fps = fpsN; fpsN = 0; fpsT = 0; if (settings.quality === 'auto' && G.scene === 'play') { if (G.fps < 46) slowStreak++; else slowStreak = 0; if (slowStreak >= 2 && G.res > .6) { G.res = Math.max(.6, G.res - .15); slowStreak = 0; resize(); } } }
  if (G.slowT > 0) { G.slowT -= dt; G.timeScale = .3; } else G.timeScale = lerp(G.timeScale, 1, .08);
  acc += dt * G.timeScale;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 4) {
    if (G.scene === 'play') { pollPlayers(); pollMenu(); if (menuJust.pause) pauseGame(); }
    else { pollMenu(); if (G.scene === 'lobby') pollLobby(); menuNav(); }
    step(); acc -= 1 / 60; steps++;
  }
  if (steps === 4) acc = 0;
  Sound.tick();
  if (G.world && (G.scene === 'play' || G.scene === 'pause' || G.scene === 'results' || G.scene === 'settings')) drawPlay(); else drawTitle();
  if (G.scene === 'lobby') drawShowcase();
}

/* =========================================================
   Screens & menus
   ========================================================= */
const SCREENS = ['scrTitle', 'scrLevels', 'scrLobby', 'scrHow', 'scrSettings', 'scrPause', 'scrResults'];
let settingsReturn = 'scrTitle', curScreen = 'scrTitle';
function show(id) {
  curScreen = id; for (const s of SCREENS) $(s).hidden = s !== id;
  if (id) { const f = $(id).querySelector('.btn:not([disabled]), .mode, .pickcard'); if (f && inputKind !== 'touch') setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30); }
}
function setPlayUI(on) {
  const hasTouch = players.some(p => p.src === 'touch'), coarse = matchMedia('(pointer:coarse)').matches;
  const showTouch = on && (settings.touch === 'on' || (settings.touch === 'auto' && (hasTouch || (coarse && players.length === 0))));
  $('touch').classList.toggle('on', !!showTouch); $('btnPause').classList.toggle('on', !!on);
  document.documentElement.style.setProperty('--b', settings.btn + 'px');
}
function fmt(s) { const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + (x < 10 ? '0' : '') + x; }
function goTitle() {
  G.scene = 'title'; G.world = false; show('scrTitle'); setPlayUI(false); Sound.play('title');
  const best = Object.values(progress.levels || {}).filter(l => l.bestTime);
  $('bestLine').innerHTML = best.length ? `${best.length} of ${LEVELS.length} levels cleared · <b>${best.reduce((a, l) => a + (l.stars || 0), 0)}</b> of ${LEVELS.length * 3} stars · ${progress.matches || 0} matches played · ${DIFF[settings.diff].name}` : `Up to 4 players on one screen · keyboard, gamepads or touch · ${DIFF[settings.diff].name} difficulty`;
}
function openPicks(mode) { G.mode = mode; G.scene = 'picks'; G.world = false; buildPicks(); show('scrLevels'); setPlayUI(false); }
function startPlay() {
  players = lobby.slots.map(s => makePlayer(s, 0, 0));
  show(null); G.scene = 'play'; setPlayUI(true); Sound.init();
  if (G.mode === 'match') startMatch(); else startLevel(false);
  try { if (matchMedia('(pointer:coarse)').matches && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
  setTimeout(resize, 250);
  if (G.portrait && matchMedia('(pointer:coarse)').matches) setTimeout(() => toast('Turn your phone sideways for the widest view'), 600);
}
function pauseGame() {
  if (G.scene !== 'play' || G.levelDone || G.gameOver || G.matchOver) return;
  G.scene = 'pause'; setPlayUI(false);
  $('pauseEyebrow').textContent = G.mode === 'match' ? STAGE.name : LEVEL.id + ' · ' + LEVEL.name;
  $('pauseStats').textContent = G.mode === 'match' ? `${fmt(stats.time)} · ${players.map(p => (p.bot ? 'Bot' : 'P' + (p.idx + 1)) + ' ' + Math.round(p.dmg) + '% ×' + p.stocks).join(' · ')}` : `${fmt(stats.time)} · ${stats.coins} coins · ${stats.shells}/3 Pact Shells · ${stats.lives > 50 ? 'unlimited' : stats.lives} lives left`;
  $('btnRestartCp').hidden = G.mode === 'match';
  show('scrPause'); Sound.sfx.back();
}
function resumeGame() { show(null); G.scene = 'play'; setPlayUI(true); Sound.init(); for (const key in tch) tch[key] = 0; }
const STAR = '<svg viewBox="0 0 24 24"><path fill="#ffc65c" stroke="#2b0a02" stroke-width="1.2" stroke-linejoin="round" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
let shareText = '';
function showResults(won) {
  G.scene = 'results'; setPlayUI(false); Sound.stop();
  const match = G.mode === 'match';
  $('resRankWrap').hidden = match; $('resGrid').hidden = match; $('resBoard').hidden = !match; $('btnResNext').hidden = match || !won || G.level >= LEVELS.length - 1;
  if (match) {
    const w = players.find(p => p.winner), order = players.slice().sort((a, b) => (b.winner ? 1 : 0) - (a.winner ? 1 : 0) || b.stocks - a.stocks || b.kos - a.kos || a.dmg - b.dmg);
    $('resEyebrow').textContent = STAGE.name + ' · ' + fmt(stats.time); $('resTitle').textContent = w ? (w.bot ? 'Bot ' + (w.idx + 1) : 'Player ' + (w.idx + 1)) + ' wins' : 'Draw';
    $('resBoard').innerHTML = order.map((p, i) => `<div class="${p.winner ? 'win' : ''}" style="--pc:${p.col}"><i>${i + 1}</i><b>${p.bot ? 'Bot ' : 'P'}${p.idx + 1} · ${p.hero.short}</b><i>${p.kos} KO</i><i>${Math.round(p.dealt)} dmg</i></div>`).join('');
    $('resTip').textContent = w && w.bot ? 'Tip: dodge right as a bot swings, then punish with a 3-hit combo into a Special.' : 'Rematch with the same fighters, or change the lineup from the lobby.';
    shareText = `Pixel Pact · ${STAGE.name}: ${w ? (w.bot ? 'Bot' : 'Player ' + (w.idx + 1)) + ' (' + w.hero.short + ') won' : 'draw'} in ${fmt(stats.time)} with ${w ? w.kos : 0} KOs.`;
    Sound.sfx.win();
  } else {
    const par = LEVEL.par, s1 = won, s2 = won && stats.shells === 3, s3 = won && stats.deaths === 0 && stats.time < par, stars = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
    const rank = !won ? 'C' : stars === 3 && stats.combo >= 15 ? 'S' : stars >= 2 ? 'A' : 'B';
    $('resEyebrow').textContent = won ? 'Stage clear · ' + LEVEL.id : 'Out of lives'; $('resTitle').textContent = won ? LEVEL.name : 'So close. Try again?'; $('resRank').textContent = rank;
    $('resStars').innerHTML = STAR + STAR + STAR;
    const st = [...$('resStars').children]; [s1, s2, s3].forEach((on, i) => { if (on) setTimeout(() => { st[i].classList.add('on'); Sound.sfx.star(); buzz(15); }, 450 + i * 320); });
    const rows = { rTime: [stats.time, v => fmt(v)], rCoins: [stats.coins, v => Math.round(v)], rShells: [stats.shells, v => Math.round(v) + '/3'], rKos: [stats.kos, v => Math.round(v)], rCombo: [stats.combo, v => Math.round(v)], rDeaths: [stats.deaths, v => Math.round(v)] };
    const t0 = performance.now(); (function count() { const k2 = Math.min(1, (performance.now() - t0) / 900); for (const id in rows) $(id).textContent = rows[id][1](rows[id][0] * easeOut(k2)); if (k2 < 1) requestAnimationFrame(count); })();
    $('resTip').textContent = won ? (s3 ? 'Perfect run. Nothing on this island could touch you.' : s2 ? `Third star: finish with no falls in under ${fmt(par)}.` : 'Second star: find all 3 Pact Shells. They glow teal and are often above or under the main path.') : 'Tip: dodge through attacks (you are invincible mid-dodge), and stand next to a fallen friend to revive them.';
    let isNew = false;
    if (won) { const pr = progress.levels[LEVEL.id] || { stars: 0, bestTime: 0, rank: '' }; if (!pr.bestTime || stats.time < pr.bestTime) { pr.bestTime = stats.time; isNew = true; } pr.stars = Math.max(pr.stars || 0, stars); if (!pr.rank || 'SABC'.indexOf(rank) < 'SABC'.indexOf(pr.rank)) { pr.rank = rank; isNew = true; } progress.levels[LEVEL.id] = pr; saveProgress(); }
    $('resNew').hidden = !isNew;
    const names = players.map(p => p.hero.short).join(' + ');
    shareText = won ? `I cleared Pixel Pact ${LEVEL.id} ${LEVEL.name} with ${names} in ${fmt(stats.time)} · rank ${rank} · ${stars}/3 stars${stats.combo >= 10 ? ' · ' + stats.combo + '-hit combo' : ''}.` : `Pixel Pact ${LEVEL.id} got me at ${fmt(stats.time)} with ${names}. Round two.`;
  }
  $('btnShare').textContent = 'Share my run';
  show('scrResults');
}
function menuNav() {
  const scr = curScreen && $(curScreen); if (!scr || scr.hidden) return;
  if (menuJust.back && curScreen !== 'scrTitle' && curScreen !== 'scrLobby') { const b = { scrLevels: 'btnPickBack', scrHow: 'btnHowBack', scrSettings: 'btnSettingsBack', scrPause: 'btnResume', scrResults: 'btnResLobby' }[curScreen]; if (b) $(b).click(); return; }
  if (inputKind !== 'pad' || curScreen === 'scrLobby') return;
  const items = [...scr.querySelectorAll('.btn, .mode, .pickcard, input[type=range], .seg button')].filter(el => el.offsetParent !== null && !el.disabled);
  if (!items.length) return;
  let i = items.indexOf(document.activeElement);
  const moveV = menuJust.d ? 1 : menuJust.u ? -1 : 0, moveH = menuJust.r ? 1 : menuJust.l ? -1 : 0, act = document.activeElement;
  menuJust.d = menuIn.y > .5 && !menuPrev.dd; menuJust.u = menuIn.y < -.5 && !menuPrev.uu; menuJust.r = menuIn.x > .5 && !menuPrev.rr; menuJust.l = menuIn.x < -.5 && !menuPrev.ll;
  menuPrev.dd = menuIn.y > .5; menuPrev.uu = menuIn.y < -.5; menuPrev.rr = menuIn.x > .5; menuPrev.ll = menuIn.x < -.5;
  const mv = menuJust.d ? 1 : menuJust.u ? -1 : 0, mh = menuJust.r ? 1 : menuJust.l ? -1 : 0;
  if (mh && act && act.type === 'range') { act.value = +act.value + mh * 5; act.dispatchEvent(new Event('input')); return; }
  if (mv || mh) { i = i < 0 ? 0 : (i + (mv || mh) + items.length) % items.length; items[i].focus(); Sound.sfx.select(); return; }
  if (menuJust.ok && act && items.includes(act)) act.click();
}
const on = (id, fn) => $(id).addEventListener('click', fn);
on('btnAdventure', () => { Sound.init(); Sound.sfx.select(); openPicks('adventure'); });
on('btnMatch', () => { Sound.init(); Sound.sfx.select(); openPicks('match'); });
on('btnPickGo', () => { Sound.sfx.select(); openLobby(); });
on('btnPickBack', () => { Sound.sfx.back(); goTitle(); });
on('btnHow', () => { Sound.init(); Sound.sfx.select(); show('scrHow'); });
on('btnHowBack', () => { Sound.sfx.back(); goTitle(); });
on('btnSettings', () => { Sound.init(); Sound.sfx.select(); settingsReturn = 'scrTitle'; show('scrSettings'); });
on('btnSettingsBack', () => { saveSettings(); Sound.vol(); Sound.sfx.back(); resize(); if (settingsReturn === 'scrPause') { G.scene = 'pause'; show('scrPause'); } else goTitle(); });
on('btnLobbyBack', () => { Sound.sfx.back(); openPicks(G.mode); });
on('btnStart', () => { if ($('btnStart').disabled) return; Sound.init(); Sound.sfx.go(); startPlay(); });
on('btnAddBot', addBot);
on('btnResume', resumeGame);
on('btnRestartCp', () => { show(null); G.scene = 'play'; setPlayUI(true); startLevel(true); });
on('btnRestart', () => { show(null); G.scene = 'play'; setPlayUI(true); players = lobby.slots.map(s => makePlayer(s, 0, 0)); if (G.mode === 'match') startMatch(); else startLevel(false); });
on('btnPauseSettings', () => { settingsReturn = 'scrPause'; G.scene = 'settings'; show('scrSettings'); });
on('btnQuit', goTitle);
on('btnAgain', () => { Sound.init(); startPlay(); });
on('btnResNext', () => { Sound.init(); G.level = Math.min(LEVELS.length - 1, G.level + 1); startPlay(); });
on('btnResLobby', () => { Sound.sfx.select(); openLobby(); });
on('btnPause', () => { if (G.scene === 'play') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.scene === 'play') pauseGame(); });
$('sSfx').value = settings.sfx; $('sMusic').value = settings.music; $('sBtn').value = settings.btn;
$('sSfx').addEventListener('input', e => { settings.sfx = +e.target.value; Sound.vol(); });
$('sSfx').addEventListener('change', () => Sound.sfx.coin());
$('sMusic').addEventListener('input', e => { settings.music = +e.target.value; Sound.vol(); });
$('sBtn').addEventListener('input', e => { settings.btn = +e.target.value; document.documentElement.style.setProperty('--b', settings.btn + 'px'); });
function seg(id, key, num) {
  const el = $(id), sync = () => { for (const b of el.children) b.classList.toggle('on', String(b.dataset.v) === String(settings[key])); };
  sync(); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; settings[key] = num ? Number(b.dataset.v) : b.dataset.v; sync(); saveSettings(); Sound.sfx.select(); if (key === 'quality') { G.res = 1; resize(); } if (key === 'haptics' && settings.haptics) buzz(30); });
}
seg('sDiff', 'diff', true); seg('sStocks', 'stocks', true); seg('sHazards', 'hazards', true); seg('sQuality', 'quality', false); seg('sDepth', 'depth', true); seg('sTouch', 'touch', false); seg('sHaptics', 'haptics', true); seg('sMotion', 'motion', true); seg('sFps', 'fps', true);
// share button on results
(() => { const b = document.createElement('button'); b.className = 'btn glass'; b.id = 'btnShare'; b.textContent = 'Share my run'; $('btnAgain').parentNode.insertBefore(b, $('btnAgain'));
  b.addEventListener('click', () => { const txt = shareText + ' Play free: ' + location.href.split('#')[0]; const done = () => { b.textContent = 'Copied!'; toast('Run summary copied. Paste it anywhere.'); setTimeout(() => b.textContent = 'Share my run', 2000); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => { toast(txt, 6000); }); else toast(txt, 6000); } catch (e) { toast(txt, 6000); } }); })();

/* =========================================================
   Boot
   ========================================================= */
function boot() {
  buildSprites(); resize(); goTitle();
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ heroes: settings.heroes })); } catch (e) {}
  requestAnimationFrame(t => { last = t; loop(t); });
}
const fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('900 20px "Unbounded"'), document.fonts.load('800 12px "Manrope"'), document.fonts.load('10px "Press Start 2P"')]).catch(() => {}) : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => { if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot(); });
})();
</script>
