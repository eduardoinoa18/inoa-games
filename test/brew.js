// Brew and Bloom: full loop headless — title, plant, fast-forward growth, harvest, guests, brew (real drag + portrait tray tap), serve x5 → results (once),
// decor, time of day, offline summary (reload twice: no duplicate tips), invalid/future timestamps, Spanish UI.
// Elevation pass: café levels (level-up card once), daily requests + regular stories, journal tabs, seasonal seeds, new decor, v1 → v2 save migration.
module.exports = async (p, _shot) => {
  // own screenshot helper: generous timeout (software GL on a shared box) and render loop paused between shots
  const shot = async (name) => { await p.addStyleTag({ content: '*{animation-duration:0s!important;transition-duration:0s!important}' }).catch(() => { }); await p.evaluate(() => { window.__GAME?.frame?.(); window.__NORENDER = false; }); await p.waitForTimeout(250); await p.screenshot({ path: `${require('path').join(__dirname, 'out')}/brew_${name}.png`, timeout: 300000 }); await p.evaluate(() => { window.__NORENDER = true; }); };
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const W = p.viewportSize().width, H = p.viewportSize().height, tag = W < H ? 'p_' : '';
  const fail = (msg) => { throw new Error('ASSERT ' + msg); };
  const reload = async () => { await p.reload({ timeout: 300000 }); for (let i = 0; i < 400; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => window.__READY === true)) break; } await p.evaluate(() => { window.__NORENDER = true; }); };
  const dismiss = () => p.evaluate(() => { for (let k = 0; k < 3; k++) { document.querySelector('.bb-lvl [data-a=ok]')?.click(); window.__GAME.update(1 / 60); } document.querySelector('.bb-note')?.click(); });
  const overlaps = () => p.evaluate(() => { window.__GAME.frame(); const r = window.__GAME.labelRects(); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a[0] < b[2] - 2 && a[2] > b[0] + 2 && a[1] < b[3] - 2 && a[3] > b[1] + 2) n++; } const off = r.filter(a => a[0] < 0 || a[2] > innerWidth || a[1] < 0).length; return { n, off, count: r.length }; });
  // fresh save each run
  await p.evaluate(() => { localStorage.removeItem('inoa.brew'); const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); });
  await reload();
  await p.evaluate(() => window.__GAME.setHour(12.5));
  await p.waitForTimeout(400); await shot(tag + 'title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await sim(.5);
  // plant 3 pots via the real UI (tap label → seed card)
  for (const [i, seed] of [[0, 'mint'], [1, 'cham'], [2, 'mint']]) {
    await p.evaluate(() => window.__GAME.update(1 / 60));
    const ok = await p.evaluate(({ i, seed }) => { const labs = document.querySelectorAll('.bb-lab:not(.ing):not(.bb-order)'); labs[i].click(); const b = document.querySelector(`.bb-sheet [data-s=${seed}]`); if (!b) return false; b.click(); return true; }, { i, seed });
    console.log('plant', i, seed, ok); if (!ok) fail('plant via UI');
  }
  await sim(1); await p.waitForTimeout(300); await shot(tag + 'planted');
  // growth state must match visuals: 70 s into a 120 s mint → partly grown, not ready
  await p.evaluate(() => window.__GAME.ff(70)); await sim(.3);
  const grow = await p.evaluate(() => { const g = window.__GAME; return g.S.pots.slice(0, 3).map(pt => pt && pt.seed); });
  console.log('growing', JSON.stringify(grow), 'overlaps', JSON.stringify(await overlaps()));
  await p.waitForTimeout(300); await shot(tag + 'growing');
  await p.evaluate(() => window.__GAME.ff(400)); await sim(2);
  await p.evaluate(() => window.__GAME.tend()); await sim(1.5);
  const inv = await p.evaluate(() => JSON.stringify(window.__GAME.S.inv)); console.log('inv after tend', inv);
  // guests arrive
  await sim(14); await p.waitForTimeout(300);
  const ov = await overlaps(); console.log('label overlaps at guests', JSON.stringify(ov)); if (ov.off) fail('labels off-screen');
  await shot(tag + 'guests');
  const st = await p.evaluate(() => window.__GAME.G.custs.map(c => `${c.def.name}:${c.state}:${c.recipe?.name}`).join(', ')); console.log('custs', st);
  // brew with a real drag for the first order
  await p.evaluate(() => window.__GAME.openBrew()); await sim(1.2); await p.waitForTimeout(300); await shot(tag + 'brew');
  const need = await p.evaluate(() => window.__GAME.G.brew && window.__GAME.G.brew.recipe.need);
  console.log('need', need);
  if (need) {
    const xy = await p.evaluate((id) => window.__GAME.ingScreen(id), need[0]);
    const tp = await p.evaluate(() => window.__GAME.teapotScreen());
    await p.mouse.move(xy[0], xy[1]); await p.mouse.down(); await sim(.05);
    for (let k = 1; k <= 8; k++) { await p.mouse.move(xy[0] + (tp[0] - xy[0]) * k / 8, xy[1] + (tp[1] - xy[1]) * k / 8); await sim(.03); }
    await shot(tag + 'drag');
    await p.mouse.up(); await sim(.8);
    const added = await p.evaluate(() => window.__GAME.G.brew ? window.__GAME.G.brew.added.join(',') : 'done'); console.log('added after drag', added);
    if (!added || added === '') fail('drag did not add an ingredient');
    for (const id of need.slice(1)) {
      // portrait: tap the big tray button in the recipe card; landscape: keyboard digit (1–6)
      if (tag) await p.evaluate((id) => document.querySelector(`.bb-recipe [data-ing=${id}]`).click(), id);
      else await p.keyboard.press('Digit' + (await p.evaluate((id) => window.__GAME.BI.indexOf(id), id) + 1));
      await sim(.6);
    }
    await sim(.6); await p.waitForTimeout(200); await shot(tag + 'brewed');
    await sim(2.5);
    if (await p.evaluate(() => !!window.__GAME.G.brew)) fail('brew did not complete');
  }
  await p.waitForTimeout(300); await shot(tag + 'served');
  // serve until session results
  const r = await p.evaluate(async () => { const g = window.__GAME; let n = 0; for (let i = 0; i < 60 * 200 && !document.querySelector('.ig-results'); i++) { document.querySelector('.bb-lvl [data-a=ok]')?.click(); if (i % 30 === 0 && !g.G.brew && g.G.mode === 'cafe' && !g.G.modal) { if (g.autoServe()) n++; } g.update(1 / 60); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return { n, served: g.S.served, coins: g.S.coins, hearts: g.S.hearts, res: !!document.querySelector('.ig-results') }; });
  console.log('session', JSON.stringify(r)); if (!r.res) fail('no results screen');
  await sim(4); // cups still in flight / customers still served must not grant a second time
  const rc = await p.evaluate(() => ({ n: window.__GAME.resultsCount, cards: document.querySelectorAll('.ig-results').length })); console.log('results count', JSON.stringify(rc)); if (rc.n !== 1 || rc.cards !== 1) fail('E.results not exactly once');
  await p.waitForTimeout(500); await shot(tag + 'results');
  await p.evaluate(() => document.querySelector('.ig-results [data-a=again]')?.click()); await sim(.5); await dismiss();
  // decor: enter, place (via hooks + real tap), exit; taps in decor mode must not open brew/sheets
  await p.evaluate(() => { window.__GAME.S.coins += 200; });
  const placed = await p.evaluate(() => { const g = window.__GAME; return [g.placeDecor('rug', 1.5, 4), g.placeDecor('lamp', -5.5, 4.5), g.placeDecor('plant', 5.5, .5), g.placeDecor('table', 0, 4.5), g.placeDecor('shelf', -1, .5)]; });
  console.log('decor placed', placed);
  await p.evaluate(() => { const g = window.__GAME; g.openDecor(); document.querySelector('.bb-sheet [data-d=lamp]').click(); }); await sim(1.2);
  await p.mouse.click(Math.round(W * .5), Math.round(H * .3)); await sim(.3);
  const dm = await p.evaluate(() => ({ mode: window.__GAME.G.mode, brew: !!window.__GAME.G.brew }));
  console.log('decor mode after floor tap', JSON.stringify(dm)); if (dm.mode !== 'decor' || dm.brew) fail('decor tap triggered gameplay');
  await p.waitForTimeout(300); await shot(tag + 'decor');
  await p.evaluate(() => { document.querySelector('.bb-sheet [data-d="wall-blush"]').click(); window.__GAME.closeDecor(); }); await sim(1.5);
  if (await p.evaluate(() => window.__GAME.G.mode) !== 'cafe') fail('decor did not exit');
  await p.evaluate(() => window.__GAME.setHour(17)); await sim(4); await p.waitForTimeout(300); await shot(tag + 'golden');
  await p.evaluate(() => window.__GAME.setHour(22.5)); await sim(4); await p.waitForTimeout(300); await shot(tag + 'night');
  await p.evaluate(() => window.__GAME.setHour(8.5)); await sim(2); await p.evaluate(() => { const g = window.__GAME; g.cam.az = -.5; g.cam.zoom = .6; }); await sim(2); await p.waitForTimeout(300); await shot(tag + 'morning_close');

  // ---- progression: café level, requests + stories, journal, seasons, new decor ----
  await dismiss();
  const lv0 = await p.evaluate(() => ({ lv: window.__GAME.level(), lvl: window.__GAME.S.lvl, hearts: window.__GAME.S.hearts, req: window.__GAME.S.req.list.length }));
  console.log('level after first shift', JSON.stringify(lv0)); if (lv0.lvl !== lv0.lv || lv0.req !== 3) fail('level acknowledged / 3 requests');
  const rq = await p.evaluate(async () => { const g = window.__GAME; const L = g.S.req.list; L[0].r = 'hl'; L[0].n = 1; L[0].got = 0; L[0].done = false;
    for (let i = 0; i < 60 * 40 && !g.G.custs.some(c => c.state === 'wait' && !c.brewing); i++) { g.update(1 / 60); if (i % 30 === 0) await new Promise(r => setTimeout(r, 0)); }
    const w = g.G.custs.filter(c => c.state === 'wait' && !c.brewing); if (!w.length) return { err: 'no guest' }; for (const c of w) { c.recipe = g.RBY.hl; c.reserve = []; }
    const coins = g.S.coins, hearts = g.S.hearts, f0 = g.S.friends[L[0].who] || 0; if (!g.autoServe()) return { err: 'serve' }; for (let i = 0; i < 90; i++) g.update(1 / 60);
    return { done: L[0].done, who: L[0].who, friend: (g.S.friends[L[0].who] || 0) - f0, f0, note: !!document.querySelector('.bb-note'), coins: g.S.coins - coins, hearts: g.S.hearts - hearts, book: g.S.book.teas.hl }; });
  console.log('request', JSON.stringify(rq)); if (!rq.done || (rq.f0 < 3 && rq.friend !== 1) || !rq.note || rq.hearts < 3 || !rq.book) fail('request → story chapter');
  await p.waitForTimeout(300); await shot(tag + 'story');
  // level up: card appears once, unlocks are applied (level 4 = milk + the season's seed)
  await p.evaluate(() => { const g = window.__GAME; document.querySelector('.bb-note')?.click(); g.setSeason('autumn'); g.S.hearts = 46; g.G.lvlQueue = true; }); await sim(.4);
  const lu = await p.evaluate(() => ({ cards: document.querySelectorAll('.bb-lvl').length, text: document.querySelector('.bb-lvl')?.textContent || '', lvl: window.__GAME.S.lvl }));
  console.log('level up', JSON.stringify(lu)); if (lu.cards !== 1 || lu.lvl !== 4 || !/Pumpkin/.test(lu.text) || !/Milk/.test(lu.text)) fail('level-up card');
  await p.waitForTimeout(300); await shot(tag + 'levelup');
  await p.evaluate(() => document.querySelector('.bb-lvl [data-a=ok]').click()); await sim(.4);
  if (await p.evaluate(() => document.querySelectorAll('.bb-lvl').length || window.__GAME.G.lvlQueue)) fail('level-up card shown twice');
  // seasonal seeds: only the current season's special can be planted
  const ss = await p.evaluate(() => { const g = window.__GAME; g.S.unlocked = 6; g.S.pots[5] = null; g.S.coins += 50; const out = {}; g.setSeason('spring'); out.springPumpkin = g.plant(5, 'pumpkin'); out.springBlossom = g.plant(5, 'blossom'); g.S.pots[5] = null; g.setSeason('autumn'); out.autumnPumpkin = g.plant(5, 'pumpkin'); g.S.pots[5] = null; g.update(1 / 60);
    document.querySelectorAll('.bb-lab:not(.ing):not(.bb-order)')[5].click(); const sh = document.querySelector('.bb-sheet'); out.sheetPumpkin = !!sh?.querySelector('[data-s=pumpkin]:not([disabled])'); out.sheetBlossom = !!sh?.querySelector('[data-s=blossom]'); out.moonLocked = !!sh?.querySelector('[data-s=moon][disabled]'); return out; });
  console.log('seasonal', JSON.stringify(ss)); if (ss.springPumpkin || !ss.springBlossom || !ss.autumnPumpkin || !ss.sheetPumpkin || ss.sheetBlossom || !ss.moonLocked) fail('seasonal seeds');
  await p.waitForTimeout(300); await shot(tag + 'seeds');
  await p.evaluate(() => document.querySelector('.bb-sheet .bb-x')?.click());
  // journal: B opens it, four tabs, Escape closes
  await p.keyboard.press('KeyB'); await sim(.2); if (!(await p.evaluate(() => !!window.__GAME.book))) fail('journal did not open');
  for (let i = 0; i < 4; i++) { await p.evaluate((i) => document.querySelector(`.bb-book [data-tab="${i}"]`).click(), i); await p.waitForTimeout(250); await shot(tag + 'journal' + i); }
  await p.keyboard.press('Escape'); await sim(.2); const jb = await p.evaluate(() => ({ book: !!window.__GAME.book, modal: window.__GAME.G.modal })); if (jb.book || jb.modal) fail('journal did not close');
  // top level: every new decor item fits in the café and comes alive
  await p.evaluate(() => { const g = window.__GAME; g.S.hearts = 330; g.G.lvlQueue = true; }); await sim(.4); await p.waitForTimeout(250); await shot(tag + 'levelup10');
  await p.evaluate(() => document.querySelector('.bb-lvl [data-a=ok]').click()); await sim(.3);
  const nd = await p.evaluate(() => { const g = window.__GAME; g.S.coins += 600; const out = {}; for (const id of ['piano', 'fountain', 'petbed', 'pastry', 'crate', 'arbor']) { const sp = g.findSpot(id) || g.findSpot(id, 1); out[id] = sp ? g.placeDecor(id, sp[0], sp[1], g.findSpot(id) ? 0 : 1) : 'no spot'; } g.closeDecor(); return out; });
  console.log('new decor', JSON.stringify(nd)); if (Object.values(nd).filter(v => v === true).length < 4) fail('new decor placement');
  await p.evaluate(() => { const g = window.__GAME; for (const d of g.S.decor) if (d.id === 'piano' || d.id === 'petbed') g.decorTap(d); g.cam.az = .3; g.cam.zoom = .75; }); await sim(1.5); await p.waitForTimeout(300); await shot(tag + 'decor_new');
  await p.evaluate(() => { window.__GAME.cam.zoom = 1; });

  // ---- offline progress: we left 2 hours ago with a growing pot ----
  await p.evaluate(() => { const g = window.__GAME; g.tend(); g.G.mode = 'title'; /* unload must not re-save lastSeen */ localStorage.setItem('inoa.brew', JSON.stringify(Object.assign({}, g.S, { lastSeen: Date.now() - 2 * 3600e3 }))); window.__NORENDER = true; });
  await reload();
  const c0 = await p.evaluate(() => window.__GAME.S.coins);
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click()); await sim(.3);
  const a1 = await p.evaluate(() => ({ away: !!document.querySelector('.bb-away'), coins: window.__GAME.S.coins, tips: window.__GAME.G.awayTips }));
  console.log('away #1', JSON.stringify(a1), 'coins before', c0); if (!a1.away || a1.coins - c0 !== a1.tips || a1.tips <= 0 || a1.tips > 60) fail('offline summary #1');
  await p.waitForTimeout(400); await shot(tag + 'away');
  await p.evaluate(() => document.querySelector('.bb-away [data-a=ok]')?.click()); await sim(.3);
  console.log('after reload decor', await p.evaluate(() => window.__GAME.S.decor.length), 'wall', await p.evaluate(() => window.__GAME.S.wall));
  // reload again straight away (twice): no second payout
  for (let k = 2; k <= 3; k++) {
    await reload();
    await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click()); await sim(.3);
    const a = await p.evaluate(() => ({ away: !!document.querySelector('.bb-away'), coins: window.__GAME.S.coins }));
    console.log('away #' + k, JSON.stringify(a)); if (a.coins !== a1.coins) fail('duplicate offline reward on reload ' + k); await p.evaluate(() => document.querySelector('.bb-away [data-a=ok]')?.click());
  }
  // corrupt / future timestamps (clock moved back, hand-edited save) + Spanish UI
  await p.evaluate(() => { window.__GAME.G.mode = 'title'; const s = JSON.parse(localStorage.getItem('inoa.brew')); s.lastSeen = Date.now() + 86400e3; s.pots[4] = { seed: 'mint', t0: Date.now() + 5 * 86400e3 }; s.pots[5] = { seed: 'bogus', t0: 'x' }; s.coins = 'NaN?'; localStorage.setItem('inoa.brew', JSON.stringify(s)); const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.lang = 'es'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); });
  await reload(); await p.waitForTimeout(300); await shot(tag + 'es_title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click()); await sim(.5);
  const fut = await p.evaluate(() => { const g = window.__GAME; return { away: !!document.querySelector('.bb-away'), coins: g.S.coins, mins: g.awayMinutes(), pot4: g.S.pots[4] && g.S.pots[4].t0 <= Date.now(), pot5: g.S.pots[5], lang: g.lang }; });
  console.log('future/invalid', JSON.stringify(fut)); if (fut.away || !Number.isFinite(fut.coins) || !fut.pot4 || fut.pot5 !== null || fut.lang !== 'es') fail('timestamp sanitising');
  await p.evaluate(() => { const g = window.__GAME; g.S.lastSeen = 'garbage'; g.away(); }); await sim(.2);
  if (!Number.isFinite(await p.evaluate(() => window.__GAME.S.coins))) fail('invalid lastSeen produced NaN coins');
  await p.evaluate(async () => { const g = window.__GAME; for (let i = 0; i < 60 * 40 && !g.G.custs.some(c => c.state === 'wait'); i++) { g.update(1 / 60); if (i % 30 === 0) await new Promise(r => setTimeout(r, 0)); } g.openBrew(); }); await sim(1); await p.waitForTimeout(300); await shot(tag + 'es_brew');
  if (!(await p.evaluate(() => !!window.__GAME.G.brew))) fail('Spanish brew did not open');
  await p.evaluate(() => { window.__GAME.closeBrew(true); window.__GAME.openBook(3); }); await sim(.2); await p.waitForTimeout(250); await shot(tag + 'es_journal'); await p.evaluate(() => window.__GAME.closeBook());
  // ---- v1 save from the first release: keeps lavender / moon orchid / old decor, no level-up flood, sanitised new fields ----
  await p.evaluate(() => { window.__GAME.G.mode = 'title'; const now = Date.now(); localStorage.setItem('inoa.brew', JSON.stringify({ v: 1, coins: 50, hearts: 30, served: 20, unlocked: 4, inv: { mint: 1, cham: 1, lav: 2, moon: 1 }, pots: [{ seed: 'lav', t0: now - 1000 }, null, { seed: 'moon', t0: now - 5000 }, null, null, null], decor: [{ id: 'shelf', x: 4, z: .5, r: 0 }, { id: 'nope', x: 1, z: 1 }], walls: ['wall-sage', 'wall-lilac'], wall: 'wall-lilac', lastSeen: now, visDay: '', timeMode: 'clock', book: 'junk', req: { list: [{ who: 'Nobody' }] } }));
    const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); });
  await reload(); await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click()); await sim(.6);
  const mg = await p.evaluate(() => { const g = window.__GAME, S = g.S; return { v: S.v, legacy: S.legacy, lv: g.level(), lvl: S.lvl, card: !!document.querySelector('.bb-lvl'), decor: S.decor.map(d => d.id).join(','), wall: S.wall, lav: S.inv.lav, pots: S.pots.map(p => p && p.seed).join(','), lavOk: g.plant(1, 'lav'), moonOk: (g.S.pots[3] = null, g.plant(3, 'moon')), roseOk: g.plant(4, 'rose'), book: typeof S.book.teas, req: S.req.list.length }; });
  console.log('v1 migration', JSON.stringify(mg)); if (mg.v !== 2 || !mg.legacy || mg.lv !== 3 || mg.lvl !== 3 || mg.card || mg.decor !== 'shelf' || mg.wall !== 'wall-lilac' || mg.lav !== 2 || !mg.lavOk || !mg.moonOk || mg.book !== 'object' || mg.req !== 3) fail('v1 → v2 migration');
  await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); });
};
