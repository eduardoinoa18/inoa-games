// Pixel Pact (2D) headless test: title → world map → every adventure level (sim + checkpoints of each chunk) → bosses → results/profile → match modes + arenas.
// PP_QUICK=1 skips the per-chunk tour. Screenshots: test/out/pixelpact_*.png
const sim = (p, n, chunk = 30) => p.evaluate(async ([n, chunk]) => { for (let i = 0; i < n; i += chunk) { window.__GAME.update(Math.min(chunk, n - i)); await new Promise(r => setTimeout(r, 0)); } }, [n, chunk]);
// Conservative reachability check of a level (no wall jumps, no glide): start → 3 Pact Shells, the Sun Gem, every lever and the exit.
// Up to 5 tiles up per double jump (6 tiles across), springs 7 up, vents 9 up, swim anywhere in a pool, levers open the gates of their 40-tile chunk.
// RUN = 1 also allows the 7-tile running double jump (what the original islands 1-1…1-3 expect)
function reach(L, RUN = 0) {
  const H = 17, rows = []; for (let r = 0; r < H; r++) { let row = ''; for (const ch of L.chunks) row += ((ch[r] || '') + '.'.repeat(40)).slice(0, 40); rows.push(row); }
  const W = rows[0].length, T = (x, y) => x < 0 || x >= W ? '#' : y < 0 ? '.' : rows[Math.min(y, H - 1)][x];
  const opened = new Set(), solid = (x, y) => { const c = T(x, y); if (c === 'D' && opened.has(Math.floor(x / 40))) return false; if (c === 'G' && opened.has('boss')) return false; return '#RGD'.includes(c); };
  const plat = new Set(); rows.forEach((r, y) => [...r].forEach((c, x) => { const add = (x0, x1, y0, y1) => { for (let xx = x0; xx <= x1; xx++) for (let yy = y0; yy <= y1; yy++) plat.add(xx + ',' + yy); }; if (c === 'L') add(x - 2, x + 3, y, y); if (c === 'M') add(x - 3, x + 6, y, y); if (c === 'l') add(x - 1, x + 1, y - 5, y); if (c === 'N') add(x - 1, x + 1, y - 8, y); }));
  const stand = (x, y) => { if (solid(x, y) || solid(x, y - 1) || T(x, y) === 'W') return false; if (T(x, y) === 'w' || plat.has(x + ',' + y)) return true; return solid(x, y + 1) || 'PX'.includes(T(x, y + 1)); };
  let start; rows.forEach((r, y) => { const x = r.indexOf('@'); if (x >= 0) start = [x, y]; });
  const find = ch => { const o = []; rows.forEach((r, y) => [...r].forEach((c, x) => { if (ch.includes(c)) o.push([x, y]); })); return o; };
  const levers = find('U'), bosses = find('ZAJ'); let seen;
  for (let pass = 0; pass < 8; pass++) {
    seen = new Set(); const fr = [start];
    while (fr.length) {
      const [x, y] = fr.pop(), k = x + ',' + y; if (seen.has(k)) continue; seen.add(k); const c = T(x, y);
      if (c === 'w') { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, -1], [0, -2], [1, -2], [-1, -2], [2, -2], [-2, -2], [2, -3], [-2, -3], [1, -3], [-1, -3]]) if (stand(x + dx, y + dy)) fr.push([x + dx, y + dy]); continue; }
      const up = c === 'B' ? 7 : c === 'g' ? 9 : 5, rch = c === 'g' ? 4 : 6 + RUN;
      for (let ny = Math.max(0, y - up); ny < H; ny++) { const du = y - ny, lim = du > 0 ? ('Bg'.includes(c) ? rch : rch - Math.max(0, du - 2)) : rch + Math.floor(-du / 2);
        for (let nx = x - lim; nx <= x + lim; nx++) { if (nx < 0 || nx >= W || seen.has(nx + ',' + ny) || !stand(nx, ny)) continue; const top = Math.min(y, ny), st = nx > x ? 1 : -1; let ok = true;
          for (let cx = x + st; cx !== nx && ok; cx += st) if (solid(cx, top) || solid(cx, top - 1)) ok = false; const vx = ny < y ? x : nx;
          for (let cy = Math.min(y, ny); cy <= Math.max(y, ny) && ok; cy++) if (!((vx === x && cy === y) || (vx === nx && cy === ny)) && solid(vx, cy)) ok = false; if (ok) fr.push([nx, ny]); } }
    }
    let changed = false; for (const [sx, sy] of levers) if (seen.has(sx + ',' + sy) && !opened.has(Math.floor(sx / 40))) { opened.add(Math.floor(sx / 40)); changed = true; }
    for (const [bx, by] of bosses) if (!opened.has('boss') && [...seen].some(s => { const [x, y] = s.split(',').map(Number); return Math.abs(bx - x) < 12 && Math.abs(by - y) < 6; })) { opened.add('boss'); changed = true; }
    if (!changed) break;
  }
  const pts = [...seen].map(s => s.split(',').map(Number)), touched = (tx, ty) => pts.some(([x, y]) => (Math.abs(x - tx) <= 2 && y - ty >= 0 && y - ty <= 5) || (T(x, y) === 'w' && Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1));
  return find('KkQEU').filter(([x, y]) => !touched(x, y)).map(([x, y]) => `${T(x, y)}@chunk${Math.floor(x / 40)}:${x % 40},${y}`);
}
module.exports = async (p, shot) => {
  const lv = await p.evaluate(() => window.__GAME.levels.map(L => ({ id: L.id, chunks: L.chunks })));
  for (const [i, L] of lv.entries()) { const miss = reach(L), run = miss.length ? reach(L, 1) : []; console.log('reach', L.id, miss.length ? 'MISSING ' + miss.join(' ') + (run.length ? ' · with running jumps still MISSING ' + run.join(' ') : ' · all reachable with 7-tile running jumps') : 'OK'); if (miss.length && i >= 3) throw new Error('unreachable in ' + L.id + ': ' + miss.join(' ')); }
  await shot('title');
  const info = await p.evaluate(() => ({ levels: window.__GAME.levels.length, stages: window.__GAME.stages.length, heroes: window.__GAME.heroes.length }));
  console.log('content', JSON.stringify(info));
  // world map
  await p.evaluate(() => window.__GAME.openMap());
  await p.waitForTimeout(400); await shot('map');
  // every level: start, run, tour the chunks
  for (let i = 0; i < info.levels; i++) {
    await p.evaluate(i => window.__GAME.start('adventure', i), i);
    await sim(p, 240);
    if (i >= 3 || i === 0) await shot('level' + (i + 1));
    if (!process.env.PP_QUICK) {
      const tour = await p.evaluate(async () => {
        const G = window.__GAME, pl = G.players[0], W = G.mapW, out = [];
        for (let x = 300; x < W - 200; x += 600) { pl.x = x; pl.y = 60; pl.vx = pl.vy = 0; pl.inv = 600; G.update(50); out.push(Number.isFinite(pl.x + pl.y) ? 1 : 0); await new Promise(r => setTimeout(r, 0)); }
        return { ok: out.every(Boolean), n: out.length, scene: G.G.scene };
      });
      console.log('level', i + 1, JSON.stringify(tour));
    }
  }
  // mechanics spot checks on 1-5 (swim) and 1-6 (lever opens gate)
  const mech = await p.evaluate(async () => {
    const G = window.__GAME; G.start('adventure', 5); G.update(200);
    const lever = G.ents.find(e => e.kind === 'switch'), pl = G.players[0]; pl.x = lever.x; pl.y = lever.y - 30; pl.inv = 600; G.update(20);
    const leverOn = lever.on;
    G.start('adventure', 4); G.update(200); const p2 = G.players[0]; p2.x = 46 * 32; p2.y = 11 * 32; p2.vy = 0; G.update(30);
    return { leverOn, swimming: !!p2.wet };
  });
  console.log('mechanics', JSON.stringify(mech));
  // touch controls on a phone-sized screen (forced on: headless has no coarse pointer)
  await p.evaluate(() => { document.querySelector('#sTouch button[data-v="on"]').click(); const G = window.__GAME; G.start('adventure', 3); G.update(90); });
  await shot('touch');
  // gamepad drop-in mid-level: a second pad presses A and joins next to the leader; a revive works
  const drop = await p.evaluate(() => {
    document.querySelector('#sTouch button[data-v="auto"]').click();
    const btn = () => ({ pressed: false, value: 0 }), pad = { id: 'fake', index: 1, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
    navigator.getGamepads = () => [null, pad, null, null];
    const G = window.__GAME; G.start('adventure', 0); G.update(60);
    pad.buttons[0].pressed = true; G.loopStep(3); pad.buttons[0].pressed = false; G.loopStep(3);
    const n = G.players.length, src = G.players[1] && G.players[1].src;
    // down P2 and let P1 stand next to them: revive
    const p1 = G.players[0], p2 = G.players[1]; let revived = false;
    if (p2) { p2.inv = 0; p2.x = p1.x + 10; p2.y = p1.y; G.down(1); for (let i = 0; i < 200 && p2.downed; i++) { p1.x = p2.x; p1.y = p2.y; G.update(1); } revived = !p2.downed && !p2.dead; }
    navigator.getGamepads = () => [null, null, null, null];
    return { players: n, src, revived };
  });
  console.log('drop-in', JSON.stringify(drop));
  // bosses: wake each one, fight with the sim for a while
  for (const [lvl, name] of [[0, 'claw'], [4, 'queen'], [9, 'magma']]) {
    const b = await p.evaluate(async lvl => {
      const G = window.__GAME; G.start('adventure', lvl); G.update(120);
      const boss = G.boss, pl = G.players[0]; pl.x = G.arena.x0 + 200; pl.y = 300; pl.inv = 9999; G.update(160);
      const seen = new Set(); for (let i = 0; i < 40; i++) { pl.inv = 9999; G.update(30); seen.add(boss.state); await new Promise(r => setTimeout(r, 0)); }
      return { name: boss.name, active: G.arena.active, states: [...seen].join(','), hp: boss.hp };
    }, lvl);
    console.log('boss', JSON.stringify(b));
    await shot('boss_' + name);
  }
  // every hero: special + ultimate in a co-op level with a bot ally (exercise Pip's lantern + Sunrise, Bo's vine + Thornquake)
  for (let h = 0; h < info.heroes; h++) {
    const r = await p.evaluate(async h => {
      const G = window.__GAME; G.start('adventure', 0, { hero: h }); G.update(150);
      const pl = G.players[0]; pl.x = 13 * 32; pl.y = 300; G.update(20);
      G.force(0, 'spec'); G.update(12); const mid = G.players[0].anim; G.update(40); G.force(0, 'ult'); G.update(80);
      return { hero: pl.hero.id, anim: mid, hp: pl.hp, ok: Number.isFinite(pl.x) && G.G.scene === 'play' };
    }, h);
    console.log('hero', JSON.stringify(r));
    if (h >= 4) { await p.evaluate(() => { const G = window.__GAME; G.force(0, 'spec'); G.update(9); }); await shot('hero_' + r.hero); }
  }
  const r1 = await p.evaluate(() => { const G = window.__GAME; G.start('adventure', 3); G.update(60); G.results(true); return { scene: G.G.scene, prof: JSON.parse(localStorage.getItem('inoa.profile') || '{}').games?.pixelpact, recent: JSON.parse(localStorage.getItem('inoa.profile') || '{}').recent, reward: G.G.lastReward }; });
  console.log('adventure results', JSON.stringify(r1));
  await p.waitForTimeout(1500); await shot('results');
  // match: every stage once, every mode once
  for (let s = 0; s < info.stages; s++) {
    const mode = ['stock', 'coins', 'hill'][s % 3];
    await p.evaluate(([s, mode]) => window.__GAME.start('match', 0, { stage: s, mode, bots: 3 }), [s, mode]);
    await sim(p, 900);
    const r = await p.evaluate(() => { const G = window.__GAME; return { stage: G.G.stage, mode: G.G.mmode, scene: G.G.scene, players: G.players.length, scores: G.players.map(q => G.G.mmode === 'hill' ? Math.round(q.hill || 0) : G.G.mmode === 'coins' ? q.score : q.stocks).join('/') }; });
    console.log('match', JSON.stringify(r));
    await shot('match' + (s + 1));
  }
  // coin rush to the end → results board
  const end = await p.evaluate(async () => { const G = window.__GAME; G.start('match', 0, { stage: 0, mode: 'coins', bots: 1 }); for (let i = 0; i < 200 && G.G.scene === 'play'; i++) { G.update(60); await new Promise(r => setTimeout(r, 0)); } return { scene: G.G.scene, title: document.getElementById('resTitle').textContent }; });
  console.log('coin rush end', JSON.stringify(end));
  // Spanish: flip the language in Settings, check the title, map, a level banner and the results card
  const es = await p.evaluate(async () => { document.getElementById('btnQuit').click(); document.querySelector('#sLang button[data-v="es"]').click(); await new Promise(r => setTimeout(r, 50)); return { lang: document.documentElement.lang, adv: document.querySelector('#btnAdventure b').textContent, best: document.getElementById('bestLine').textContent.slice(0, 60) }; });
  console.log('spanish', JSON.stringify(es));
  await shot('title_es');
  await p.evaluate(() => window.__GAME.openMap()); await p.waitForTimeout(300); await shot('map_es');
  await p.evaluate(() => { const G = window.__GAME; G.start('adventure', 5); G.update(60); }); await shot('level6_es');
  await p.evaluate(() => { document.querySelector('#sLang button[data-v="en"]').click(); });
};
