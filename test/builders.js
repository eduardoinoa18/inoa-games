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
};
