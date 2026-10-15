// Driftwood Builders: full loop headless — gather, quests, build a shelter, campfire, crops, dock + boat sail, night, sleep → end-of-day results, photo mode, share/visit.
module.exports = async (p, _shot) => {
  const W = p.viewportSize().width, H = p.viewportSize().height, tag = W < H ? 'p_' : '';
  const shot = async (name) => { await p.addStyleTag({ content: '*{animation-duration:0s!important;transition-duration:0s!important}' }).catch(() => { }); await p.evaluate(() => { window.__GAME?.frame?.(); window.__NORENDER = false; }); await p.waitForTimeout(250); await p.screenshot({ path: `${require('path').join(__dirname,'out')}/builders_${name}.png`, timeout: 300000 }); await p.evaluate(() => { window.__NORENDER = true; }); };
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const ov = (a, b) => !!(a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]);
  const layout = async (label) => { const r = await ev(() => window.__GAME.rects()); const bad = [['toast', 'quest'], ['toast', 'day'], ['toast', 'visit'], ['pal', 'quest'], ['tip', 'pal']].filter(([x, y]) => ov(r[x], r[y])).map(x => x.join('/')); console.log('layout', label, JSON.stringify(r), bad.length ? 'OVERLAP ' + bad.join(',') : 'clean'); };
  await ev(() => { localStorage.removeItem('inoa.builders'); localStorage.setItem('inoa.builders', JSON.stringify({ seed: 4242 })); });
  await p.reload({ timeout: 300000 }); for (let i = 0; i < 400; i++) { await p.waitForTimeout(500); if (await ev(() => window.__READY === true)) break; }
  await ev(() => { window.__NORENDER = true; });
  await shot(tag + 'title');
  await ev(() => document.querySelector('.ig-title [data-a=play]').click());
  await sim(1); await shot(tag + 'start');
  // walk forward a bit with the keyboard
  await ev(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))); await sim(1.2); await ev(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))); await sim(.3);
  // gather: swing at a palm and capture mid-swing with the axe in hand
  await ev(() => { const g = window.__GAME; const n = g.NODES.filter(n => n.alive && n.type === 'palm').sort((a, b) => Math.hypot(a.x - g.player.pos.x, a.z - g.player.pos.z) - Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z))[0]; const a = Math.atan2(g.player.pos.z - n.z, g.player.pos.x - n.x); g.teleport(n.x + Math.cos(a) * (n.r + .7), n.z + Math.sin(a) * (n.r + .7), Math.atan2(n.x - (n.x + Math.cos(a)), n.z - (n.z + Math.sin(a)))); g.cam.yaw = Math.atan2(Math.cos(a), Math.sin(a)) + 1.2; g.cam.dist = 6; g.interact(); });
  await sim(.18); await shot(tag + 'swing');
  // occlusion sweep: orbit the camera around the player at two zooms; occluders between camera and player must fade
  const occ = [];
  for (const dist of [5, 11]) for (let k = 0; k < 4; k++) { occ.push(await ev(([dist, k]) => { const g = window.__GAME; g.cam.dist = dist; g.cam.yaw = k * Math.PI / 2 + .4; g.cam.pitch = .3; g.frame(); return g.faded(); }, [dist, k])); if (k === 1) await shot(tag + 'occ_' + dist); }
  console.log('occlusion faded per angle', JSON.stringify(occ));
  await sim(1);
  const log1 = await ev(() => { const g = window.__GAME; const r = []; r.push(g.autoGather('palm'), g.autoGather('tree'), g.autoGather('rock'), g.autoGather('rock'), g.autoGather('bush'), g.autoGather('bush'), g.autoGather('food')); return { r, inv: g.S.inv, q: g.S.q }; });
  console.log('gathered', JSON.stringify(log1));
  await sim(2.5);
  // build a shelter on flat ground near the player
  await ev(() => { const g = window.__GAME; g.give({ wood: 120, stone: 60, fibre: 60, food: 10 }); });
  const house = await ev(() => { const g = window.__GAME; const f = g.findFlat(3); if (!f) return 'no flat'; const [i, j] = f; const out = []; out.push(g.build('floor', i, j), g.build('floor', i + 1, j), g.build('wall', i, j, 0), g.build('wall', i, j, 3), g.build('window', i + 1, j, 0), g.build('wall', i + 1, j, 1), g.build('door', i, j, 2), g.build('window', i + 1, j, 2), g.build('roof', i, j), g.build('roof', i + 1, j), g.build('campfire', i + 1, j + 2), g.build('lamp', i - 1, j + 1), g.build('lamp', i + 2, j + 2), g.build('path', i, j + 1), g.build('path', i, j + 2), g.build('plot', i - 1, j + 3), g.build('plot', i, j + 3), g.build('plot', i + 1, j + 3), g.build('fence', i - 1, j + 3, 3), g.build('chest', i + 1, j), g.build('bed', i, j), g.build('barrel', i - 1, j), g.build('bench', i + 2, j + 1)); const c = g.cellC(i, j); const sp = g.cellC(i + 1, j + 4); g.teleport(sp.x, sp.z, Math.atan2(c.x - sp.x, c.z - sp.z)); g.cam.yaw = Math.atan2(sp.x - c.x, sp.z - c.z) + .35; g.cam.dist = 11; g.cam.pitch = .5; return { i, j, out, shelters: g.shelterCount(), q: g.S.q }; });
  console.log('house', JSON.stringify(house));
  await sim(2); await shot(tag + 'house');
  await layout('house');
  await ev(() => { const g = window.__GAME; const f = g.PLIST.find(p => p.t === 'floor'); const c = g.cellC(f.i, f.j); g.teleport(c.x, c.z, 0); g.cam.dist = 8; g.cam.pitch = .55; g.cam.yaw = .6; }); await sim(.4); await ev(() => window.__GAME.frame());
  console.log('inside house faded', await ev(() => window.__GAME.faded())); await shot(tag + 'inside');
  // plant crops through the interact action
  const crops = await ev(() => { const g = window.__GAME; const plots = g.PLIST.filter(p => p.t === 'plot'); for (const pl of plots) { const c = g.cellC(pl.i, pl.j); g.teleport(c.x, c.z + 1.3, Math.PI); g.interact(); } return g.S.crops.map(c => c.seed); });
  console.log('crops', JSON.stringify(crops));
  await sim(1); await ev(() => window.__GAME.ff(80)); await sim(.5);
  // build mode ghost preview
  await ev(() => { const g = window.__GAME; const pl = g.PLIST.find(p => p.t === 'plot'); const c = g.cellC(pl.i, pl.j); g.teleport(c.x + 1, c.z + 4.5, Math.PI); g.cam.yaw = 0; g.cam.dist = 9; g.toggleBuild(true); g.G.sel = 'wall'; });
  await sim(.5); await shot(tag + 'build');
  await ev(() => { const g = window.__GAME; g.G.sel = 'lamp'; g.player.yaw = Math.PI / 2; }); await sim(.3); await shot(tag + 'build_lamp');
  // palette: first piece selected must be fully on screen; keyboard Q/C and gamepad LB/RB cycle pieces
  await ev(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }))); await sim(.2);
  const pal0 = await ev(() => { const b = document.querySelector('.db-pc.on').getBoundingClientRect(); const row = document.querySelector('.db-pal .row').getBoundingClientRect(); return { sel: window.__GAME.G.sel, left: Math.round(b.left), right: Math.round(b.right), rowL: Math.round(row.left), rowR: Math.round(row.right), vw: innerWidth }; });
  console.log('palette first', JSON.stringify(pal0), pal0.left >= pal0.rowL - 1 && pal0.right <= pal0.rowR + 1 ? 'visible' : 'CLIPPED');
  await layout('build'); await shot(tag + 'build_pal');
  const cyc = await ev(async () => { const g = window.__GAME; const out = [g.G.sel]; dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })); out.push(g.G.sel); dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })); out.push(g.G.sel); dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); out.push(g.G.sel);
    const pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }; const orig = navigator.getGamepads; navigator.getGamepads = () => [pad];
    const press = (b) => { pad.buttons[b].pressed = true; g.update(1 / 60); pad.buttons[b].pressed = false; g.update(1 / 60); };
    press(5); out.push(g.G.sel); press(5); out.push(g.G.sel); press(4); out.push(g.G.sel); press(9); out.push('paused:' + !!document.querySelector('.ig-screen [data-a=resume]')); press(0); out.push('resumed:' + !document.querySelector('.ig-screen [data-a=resume]'));
    navigator.getGamepads = orig; return out; });
  console.log('cycle pieces (key C,C,Q then pad RB,RB,LB, Start, A)', JSON.stringify(cyc));
  await ev(() => { const g = window.__GAME; g.G.sel = 'bench'; g.cyclePiece(1); g.cyclePiece(-1); }); await sim(.2); await shot(tag + 'build_pal_end');
  await ev(() => window.__GAME.toggleBuild(false));
  // dock + boat + sail
  const dock = await ev(() => { const g = window.__GAME; const s = g.findShore(); if (!s) return 'no shore'; const [i, j] = s; const r = [g.build('dock', i, j)]; const c0 = g.cellC(i, j); const ox = Math.abs(c0.x) > Math.abs(c0.z) ? Math.sign(c0.x) : 0, oz = ox ? 0 : Math.sign(c0.z); r.push(g.build('dock', i + ox, j + oz), g.build('dock', i + 2 * ox, j + 2 * oz)); const b = g.findBoatSpot(); if (b) r.push(g.build('boat', b[0], b[1])); const c = g.cellC(i + 2 * ox, j + 2 * oz); g.teleport(c.x, c.z); g.interact(); return { s, b, r, boat: !!g.G.boat }; });
  console.log('dock', JSON.stringify(dock));
  await ev(() => { const g = window.__GAME; const b = g.PLIST.find(p => p.t === 'boat'); if (!b) return; g.teleport(b.g.position.x, b.g.position.z); g.cam.dist = 9; g.cam.pitch = .7; }); 
  const bpos = await ev(() => { const b = window.__GAME.G.boat; if (!b) return null; b.yaw = Math.atan2(b.pos.x, b.pos.z); return [b.pos.x, b.pos.z]; });
  await ev(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))); await sim(4); await ev(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })));
  await ev(() => { const g = window.__GAME; g.cam.dist = 10; }); await sim(.5); await shot(tag + 'sail');
  console.log('sailed', await ev(() => window.__GAME.S.sailed), 'quest', await ev(() => window.__GAME.S.q));
  console.log('disembarked', await ev((bp) => { const g = window.__GAME; if (g.G.boat && bp) { g.G.boat.pos.set(bp[0], 0, bp[1]); g.interact(); } return !g.G.boat; }, bpos));
  console.log('boat moored', JSON.stringify(await ev(() => { const g = window.__GAME; const b = g.PLIST.find(p => p.t === 'boat'); return b ? { r: b.r, y: +b.g.position.y.toFixed(2), castShadow: (() => { let c = false; b.g.traverse(o => { if (o.isMesh && o.castShadow) c = true; }); return c; })() } : null; })));
  // golden hour + night at the house
  await ev(() => { const g = window.__GAME; const f = g.PLIST.find(p => p.t === 'floor'); const c = g.cellC(f.i, f.j); const sp = g.cellC(f.i + 1, f.j + 4); g.teleport(sp.x, sp.z, Math.atan2(c.x - sp.x, c.z - sp.z)); g.cam.yaw = Math.atan2(sp.x - c.x, sp.z - c.z) - .3; g.cam.dist = 12; g.cam.pitch = .45; g.setDayT(.56); });
  await sim(1); await shot(tag + 'golden');
  await ev(() => window.__GAME.setDayT(.78)); await sim(1.5); await shot(tag + 'night');
  // sleep → end-of-day results
  await ev(() => { const g = window.__GAME; const b = g.PLIST.find(p => p.t === 'bed'); const c = g.cellC(b.i, b.j); g.teleport(c.x, c.z + 1.2); g.trySleep(); });
  await p.waitForTimeout(1600); await sim(.2); await shot(tag + 'results');
  console.log('after sleep', JSON.stringify(await ev(() => ({ day: window.__GAME.S.day, slept: window.__GAME.S.slept, q: window.__GAME.S.q, results: !!document.querySelector('.ig-results') }))));
  console.log('results once', JSON.stringify(await ev(() => { const g = window.__GAME; const n0 = g.G.results; g.trySleep(); g.endOfDay(); return { granted: n0, after: g.G.results, cards: document.querySelectorAll('.ig-results').length }; })));
  await ev(() => document.querySelector('.ig-results [data-a=again]')?.click()); await sim(.5);
  // photo mode
  await ev(() => { const g = window.__GAME; g.setDayT(.2); g.photo(true); }); await sim(1); await shot(tag + 'photo'); await ev(() => window.__GAME.photo(false));
  // share + visit
  const code = await ev(() => window.__GAME.exportCode()); console.log('code length', code.length, code.slice(0, 40));
  await ev((c) => { localStorage.setItem('x', 1); return window.__GAME.visitCode(c); }, code); await sim(.5);
  const vis = await ev(() => ({ visit: window.__GAME.G.visit, pieces: window.__GAME.PLIST.length })); console.log('visit', JSON.stringify(vis));
  await ev(() => window.__GAME.update(1 / 60)); await layout('visit'); await shot(tag + 'visit');
  await ev(() => window.__GAME.goHome()); await sim(.3);
  // undo works
  const und = await ev(() => { const g = window.__GAME; const n0 = g.PLIST.length; g.toggleBuild(true); g.G.sel = 'floor'; const f = g.findFlat(1); g.G.plan = null; const r = g.build('floor', f[0], f[1]); g.G.undo.push({ op: 'add', p: g.PLIST[g.PLIST.length - 1] }); const n1 = g.PLIST.length; g.undo(); g.toggleBuild(false); return [n0, n1, g.PLIST.length]; });
  console.log('undo', JSON.stringify(und));

  // ================= chapter 2: islands, islanders, trades, postcards =================
  const nodes = await ev(() => { const g = window.__GAME; const c = {}; for (const n of g.NODES) c[n.type] = (c[n.type] || 0) + 1; return { c, isles: g.ISLES.map(I => [I.id, !!g.isleSpot(I.id)]) }; });
  console.log('ch2 nodes', JSON.stringify(nodes));
  // gamepad A places in build mode; touch taps pick the cell + edge under the finger
  const padPlace = await ev(() => { const g = window.__GAME; g.give({ wood: 400, stone: 200, fibre: 200, food: 60 }); const f = g.findFlat(3); const c = g.cellC(f[0], f[1]); g.teleport(c.x, c.z + 3.2, Math.PI); g.cam.yaw = 0; g.cam.dist = 9; g.cam.pitch = .6; g.frame(); g.toggleBuild(true); g.G.sel = 'floor'; g.update(1 / 60);
    const pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }; const orig = navigator.getGamepads; navigator.getGamepads = () => [pad]; const n0 = g.PLIST.length; pad.buttons[0].pressed = true; g.update(1 / 60); pad.buttons[0].pressed = false; g.update(1 / 60); navigator.getGamepads = orig; return { n0, n1: g.PLIST.length, f }; });
  console.log('gamepad A places', JSON.stringify(padPlace), padPlace.n1 === padPlace.n0 + 1 ? 'ok' : 'FAIL');
  const tapRes = await ev(() => { const g = window.__GAME; const [i, j] = g.findFlat(2); const c = g.cellC(i, j); g.teleport(c.x, c.z + 4, Math.PI); g.cam.yaw = 0; g.cam.dist = 9; g.cam.pitch = .7; g.frame(); g.G.sel = 'wall'; g.G.target = null; const y = g.H(c.x, c.z + .8); const s1 = g.tapWorld(c.x, y, c.z + .85); const t1 = g.target && { i: g.target.i, j: g.target.j, side: g.target.side }; g.update(1 / 60); g.tapWorld(c.x, y, c.z + .85); const placed = g.PLIST.find(p => p.t === 'wall' && p.i === i && p.j === j && p.r === 2);
    // tap the top of that wall with Roof selected: the target must be the cell behind the wall (where a roof would go), not the ground in front
    for (let k = 0; k < 30; k++) g.update(1 / 60); g.frame(); g.G.sel = 'roof'; g.G.target = null; g.tapWorld(c.x, y + 1.6, c.z + 1.06); const t2 = g.target && { i: g.target.i, j: g.target.j }; g.toggleBuild(false); return { cell: [i, j], s1, t1, placed: !!placed, roofTarget: t2 }; });
  console.log('touch tap', JSON.stringify(tapRes), tapRes.placed && tapRes.t1 && tapRes.t1.side === 2 && tapRes.roofTarget && tapRes.roofTarget.j === tapRes.cell[1] ? 'ok' : 'FAIL');
  // quest 11: flowers (the garden set unlocks at quest index 10)
  const q10 = await ev(() => { const g = window.__GAME; g.setQ(10); const pal = g.palKeys(); const f = g.findFlat(3); const out = []; for (let k = 0; k < 4; k++) out.push(g.build('flowers', f[0] + (k % 2), f[1] + (k >> 1))); out.push(g.build('sapling', f[0] + 2, f[1])); return { pal: pal.includes('flowers') && pal.includes('sapling') && !pal.includes('cottage'), out, q: g.S.q }; });
  console.log('flowers', JSON.stringify(q10));
  // quest 12: sail to Shell Cay — board the boat, put it just off the island's beach, hop off
  const sail2 = await ev(() => { const g = window.__GAME; const b = g.PLIST.find(p => p.t === 'boat'); g.teleport(b.g.position.x, b.g.position.z); g.interact(); const I = g.ISLES[1]; let wp = null; const a = Math.atan2(-I.z, -I.x); for (let r = I.r - 4; r < I.r + 14; r += .5) { const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r; if (g.H(x, z) < -.6) { wp = [x, z, a]; break; } } g.G.boat.pos.set(wp[0], 0, wp[1]); g.G.boat.yaw = wp[2] + Math.PI / 2; g.cam.dist = 14; g.cam.pitch = .4; g.cam.yaw = wp[2] + .5; return { boat: !!g.G.boat, wp }; });
  await sim(1); await shot(tag + 'shell_sail');
  const land = await ev(() => { const g = window.__GAME; g.interact(); return { off: !g.G.boat, at: g.isleAt(g.player.pos.x, g.player.pos.z), visited: g.S.visited, q: g.S.q }; });
  console.log('shell cay', JSON.stringify(sail2), JSON.stringify(land));
  // quest 13: shells; quest 14: fish from the beach through the real ✋ action
  const shells = await ev(() => { const g = window.__GAME; let n = 0; for (let k = 0; k < 4; k++) n += g.autoGather('shell'); return { n, shell: g.S.inv.shell, q: g.S.q }; });
  console.log('shells', JSON.stringify(shells));
  const fishing = await ev(() => { const g = window.__GAME; const spots = g.NODES.filter(n => n.type === 'fish' && n.alive); let best = null; for (const n of spots) { for (let a = 0; a < 24 && !best; a++) for (let r = 1.8; r < 3.8; r += .25) { const x = n.x + Math.cos(a / 24 * 6.283) * r, z = n.z + Math.sin(a / 24 * 6.283) * r; if (g.H(x, z) > .08 && g.walkable(x, z)) { best = { n, x, z }; break; } } if (best) break; } if (!best) return 'no shore spot'; g.teleport(best.x, best.z, Math.atan2(best.n.x - best.x, best.n.z - best.z)); g.cam.yaw = Math.atan2(best.x - best.n.x, best.z - best.n.z) + .6; g.cam.dist = 7; g.cam.pitch = .4; const f0 = g.S.stat.fish; g.interact(); return { f0, swing: !!g.G.swing, spot: [+best.n.x.toFixed(1), +best.n.z.toFixed(1)] }; });
  await sim(.45); await shot(tag + 'fish');
  const fished = await ev(() => { const g = window.__GAME; const f1 = g.S.stat.fish; let k = 0; while (g.S.stat.fish < 3 && k++ < 6) g.autoGather('fish'); return { f1, fish: g.S.stat.fish, q: g.S.q }; });
  console.log('fishing', JSON.stringify(fishing), JSON.stringify(fished), fished.f1 > fishing.f0 ? 'real ✋ catch ok' : 'FAIL no catch');
  // quest 15: market stall on Shell Cay + a trade through the sheet
  const stall = await ev(() => { const g = window.__GAME; const sp = g.isleSpot('shell', 3); g.teleport(sp[0], sp[1]); const f = g.findFlat(1); const r = g.build('stall', f[0], f[1]); const c = g.cellC(f[0], f[1]); g.teleport(c.x, c.z + 1.6, Math.PI); g.cam.yaw = .3; g.cam.dist = 7; g.cam.pitch = .4; g.interact(); return { r, sheet: !!document.querySelector('.db-multi .db-trades'), on: g.isleAt(c.x, c.z) }; });
  await sim(.3); await shot(tag + 'trade');
  const traded = await ev(() => { const b = [...document.querySelectorAll('.db-trades button')].find(b => !b.disabled); b.click(); const g = window.__GAME; const r = { trades: g.S.trades, q: g.S.q }; document.querySelector('.db-multi [data-a=close]').click(); r.closed = !document.querySelector('.db-multi'); r.modal = g.G.modal; return r; });
  console.log('stall', JSON.stringify(stall), JSON.stringify(traded));
  // quest 16: cottage → an islander moves in
  const cot = await ev(() => { const g = window.__GAME; const fl = g.PLIST.find(p => p.t === 'floor'); const c0 = g.cellC(fl.i, fl.j); g.teleport(c0.x, c0.z + 6); const f = g.findFlat(2); const r = g.build('cottage', f[0], f[1], 2); const c = g.cellC(f[0], f[1]); g.teleport(c.x + 1.5, c.z - 4.5, 0); g.cam.yaw = Math.PI + .5; g.cam.dist = 8; g.cam.pitch = .38; return { r, folk: g.S.folk.length, q: g.S.q }; });
  await sim(2.5); await shot(tag + 'folk');
  console.log('cottage', JSON.stringify(cot));
  // quest 17: a wish (force the first one now)
  const wish = await ev(() => { const g = window.__GAME; const f = g.S.folk[0]; f.next = 0; g.update(1 / 60); return { wish: f.wish, bubble: g.FOLKM[0].bub.visible }; });
  await sim(.3); await shot(tag + 'wish');
  const granted = await ev(() => { const g = window.__GAME; const fm = g.FOLKM[0]; const f = fm.s; const W = f.wish; g.give({ shell: 5, fish: 5, crystal: 2, food: 10, wood: 10 }); g.teleport(fm.pos.x + 1, fm.pos.z); g.interact(); return { W, wishes: g.S.wishes, hearts: f.hearts, q: g.S.q }; });
  if (!granted.wishes) { const res = await ev(() => { const g = window.__GAME; const tgt = { 0: 'flowers', 2: 'bench', 4: 'lamp', 6: 'sapling', 8: 'path' }[g.S.folk[0].wish]; const out = []; for (let k = 0; k < 3 && !g.S.wishes; k++) { const ff = g.findFlat(1); out.push(g.build(tgt, ff[0], ff[1])); g.update(1 / 60); } return { tgt, out, wishes: g.S.wishes, q: g.S.q }; }); console.log('build wish', JSON.stringify(res)); }
  console.log('wish', JSON.stringify(wish), JSON.stringify(granted));
  // quest 18: four bridge pieces out from the dock
  const bridge = await ev(() => { const g = window.__GAME; const docks = g.PLIST.filter(p => p.t === 'dock'); const end = docks[docks.length - 1], prev = docks[docks.length - 2]; const di = end.i - prev.i, dj = end.j - prev.j; const out = []; let cur = [end.i, end.j]; for (let k = 0; k < 8 && g.countOf('bridge') < 4; k++) { const ni = cur[0] + di, nj = cur[1] + dj; const r = g.build('bridge', ni, nj); out.push(r); cur = [ni, nj]; } const c = g.cellC(cur[0], cur[1]); const e = g.cellC(end.i, end.j); g.teleport(e.x, e.z); g.cam.dist = 11; g.cam.pitch = .55; g.cam.yaw = Math.atan2(-di, -dj) + .9; return { out, n: g.countOf('bridge'), q: g.S.q, walk: g.walkable(c.x, c.z), y: +g.groundAt(c.x, c.z).toFixed(2) }; });
  await sim(.6); await shot(tag + 'bridge');
  console.log('bridge', JSON.stringify(bridge));
  // quest 19: Glowmoss crystals (walking onto the island counts as arriving), at dusk so they glow
  await ev(() => { const g = window.__GAME; const sp = g.isleSpot('moss', 4); g.teleport(sp[0], sp[1]); });
  await sim(.7);
  const crystals = await ev(() => { const g = window.__GAME; const v = g.S.visited.moss; let n = 0; for (let k = 0; k < 3; k++) n += g.autoGather('crystal'); g.setDayT(.45); g.cam.dist = 9; g.cam.pitch = .35; return { v, n, crystal: g.S.stat.crystal, q: g.S.q, glowPal: g.palKeys().includes('glowlamp') }; });
  await sim(1); await shot(tag + 'moss');
  console.log('glowmoss', JSON.stringify(crystals));
  // quest 20: lighthouse on Shell Cay, seen at night; quest 21: three islanders (cottages on Glowmoss + home)
  const lh = await ev(() => { const g = window.__GAME; const ff = g.findFlat(1); const camp = g.build('campfire', ff[0], ff[1]); const f2 = g.findFlat(1); const cm = g.build('cottage', f2[0], f2[1]); const sp = g.isleSpot('shell', 4); g.teleport(sp[0], sp[1]); const f = g.findFlat(1); const r = g.build('lighthouse', f[0], f[1]); const c = g.cellC(f[0], f[1]); g.teleport(c.x + 3, c.z + 6); g.cam.yaw = Math.atan2(3, 6); g.cam.dist = 13; g.cam.pitch = .22; g.setDayT(.8); return { camp, cm, r, q: g.S.q }; });
  await sim(1.5); await shot(tag + 'lighthouse');
  const three = await ev(() => { const g = window.__GAME; const sp = g.isleSpot('home', 6); g.teleport(sp[0], sp[1]); const f = g.findFlat(1); const r = g.build('cottage', f[0], f[1]); g.setDayT(.3); return { r, folk: g.S.folk.length, q: g.S.q, total: 21, stamps: g.stampTotal() }; });
  console.log('lighthouse', JSON.stringify(lh), 'three islanders', JSON.stringify(three));
  await sim(.5); await layout('ch2');
  await ev(() => window.__GAME.openPostcards()); await sim(.2); await shot(tag + 'postcards');
  console.log('postcards', JSON.stringify(await ev(() => { const g = window.__GAME; const r = g.ISLES.map(I => I.id + ':' + g.stampsDone(I.id)); document.querySelector('.db-multi [data-a=close]').click(); return r; })));
  // wrap up = results without waiting for night (XP reaches the profile)
  const wrap = await ev(() => { const g = window.__GAME; const n0 = g.G.results; g.wrapUp(); return { n0, n1: g.G.results, card: !!document.querySelector('.ig-results'), xp: document.querySelector('.ig-results .ig-reward span')?.textContent }; });
  await sim(.2); await shot(tag + 'wrap'); console.log('wrap up', JSON.stringify(wrap));
  await ev(() => document.querySelector('.ig-results [data-a=again]')?.click()); await sim(.3);
  // robustness: v1 save migration, tolerant + strict share codes, visiting twice keeps one banner
  const rob = await ev(() => { const g = window.__GAME; const m = g.loadSave({ v: 1, q: 10, seed: 77, inv: { wood: 5, stone: 'x' }, stat: { wood: 9 }, pieces: [[0, 1, 1, 0], [99, 0, 0, 0], 'junk', [1, 2, 2, 1]], dayT: 3.25 });
    const code = g.exportCode(); const wrapped = code.replace(/(.{20})/g, '$1\n '); const a = g.parseCode(wrapped), b = g.parseCode(code);
    const odd = g.parseCode('DWB1.' + btoa('12|0,1,1,9;77,0,0,0;0,999,0,0;2,3,3,1'));
    const r = { mig: { v: m.v, q: m.q, inv: m.inv, pieces: m.pieces.length, folk: m.folk.length, dayT: m.dayT }, wrappedOK: !!a && a.pieces.length === b.pieces.length, garbage: g.parseCode('hello world!') === null, empty: g.parseCode('') === null, odd: odd && odd.pieces };
    g.visitCode(code); g.visitCode(code); r.banners = document.querySelectorAll('.db-visit').length; r.folkVisiting = g.FOLKM.length; g.goHome(); r.folkHome = g.FOLKM.length; r.bannersHome = document.querySelectorAll('.db-visit').length; return r; });
  console.log('robustness', JSON.stringify(rob));
  // Spanish: switching the shared language setting re-labels the quest card live
  const es = await ev(() => { const p = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); p.lang = 'es'; localStorage.setItem('inoa.profile', JSON.stringify(p)); dispatchEvent(new CustomEvent('inoa:settings', { detail: { key: 'lang', value: 'es' } })); const q = document.querySelector('.db-quest').textContent; p.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(p)); return q.slice(0, 90); });
  console.log('spanish quest card', es);
  await ev(() => dispatchEvent(new CustomEvent('inoa:settings', { detail: { key: 'lang', value: 'en' } })));
};
