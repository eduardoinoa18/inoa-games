// Fail Tray headless test: title + course map → solo run (forced collapse) → slow-mo replay + commentary → results →
// every course driven by the bot (18 courses, 5 venues) with obstacle screenshots → physics checks (still stack, frame rates) →
// save migration → hot-seat board + party final → portrait phone. TRAY_QUICK=1 skips the 18-course tour.
module.exports = async (p, rawShot) => {
  const portrait = () => p.viewportSize().width < p.viewportSize().height;
  const shot = async (n) => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.warm(); }); await p.screenshot({ path: __dirname + '/out/tray_' + n + (portrait() ? '_p' : '') + '.png', timeout: 0 }); await p.evaluate(() => { window.__HOLD = false; }); };
  const sim = (sec, opts = {}) => p.evaluate(async ({ sec, opts }) => { const g = window.__GAME; window.__AUTO = !!opts.auto; window.__INPUT = opts.input || null; const dt = opts.dt || 1 / 60; let bad = 0;
    for (let i = 0; i < sec / dt; i++) { try { g.update(dt); } catch (e) { return { err: String(e.stack).slice(0, 600) }; } const G = g.G; if (G) { for (const it of G.stack) if (!Number.isFinite(it.r + it.p + it.sx)) bad++; if (opts.until && G.mode === opts.until) break; if (opts.untilS && G.s >= opts.untilS) break; if (opts.untilTally && G.tallied) break; } if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); }
    const G = g.G; return G ? { mode: G.mode, s: +G.s.toFixed(1), stack: G.stack.length, items: G.items.length, bad, hits: G.hits } : null; }, { sec, opts });
  const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
  const fails = [];
  const clean = () => p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); });

  await shot('title');
  const map = await p.evaluate(() => ({ venues: document.querySelectorAll('.vrow').length, nodes: document.querySelectorAll('.nodes button').length, locked: document.querySelectorAll('.nodes button.lock').length, info: document.querySelector('#lvInfo').textContent.slice(0, 60) }));
  console.log('map', JSON.stringify(map)); check(map.venues === 5 && map.nodes >= 16, 'course map shows 5 venues and 16+ courses');
  const L = await p.evaluate(() => window.__GAME.LEVELS.length); check(L >= 16, `courses: ${L}`);
  // pick a locked course: friendly toast, nothing changes
  const lockMsg = await p.evaluate(() => { const b = document.querySelector('.nodes button.lock'); if (!b) return 'none'; b.click(); return document.querySelector('.ig-toast')?.textContent || ''; });
  console.log('lock toast', lockMsg);
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await p.waitForTimeout(300);
  console.log('count', JSON.stringify(await sim(2.6)));
  await p.waitForTimeout(300); await shot('play');
  // run fast with no lean into the first turn so the stack collapses
  console.log('fast', JSON.stringify(await sim(3.2, { input: { x: 0, y: -1 } })));
  await p.waitForTimeout(250); await shot('fall');
  console.log('auto', JSON.stringify(await sim(40, { auto: true, until: 'replay' })));
  console.log('replaying', JSON.stringify(await sim(3.4)));
  await p.waitForTimeout(250); await shot('replay');
  const rep = await p.evaluate(() => window.__GAME.repInfo()); console.log('rep', JSON.stringify(rep));
  check(rep && rep.line && rep.line.length > 5, 'replay has a commentary line: ' + (rep && rep.line));
  const cap = await p.evaluate(() => document.querySelector('.ft-rep .cap')?.textContent || ''); check(cap.length > 5, 'commentary caption shown');
  await sim(2.2); await shot('replay2');
  console.log('after', JSON.stringify(await sim(12)));
  await p.waitForTimeout(800); await shot('results');
  const res = await p.evaluate(() => ({ shown: !!document.querySelector('.ig-results'), goals: document.querySelector('.ig-results .goals')?.textContent || '' }));
  check(res.shown, 'results shown'); check(/Arrive/.test(res.goals), 'results list the star goals: ' + res.goals);
  await p.evaluate(() => { document.querySelector('.ig-results [data-a=again]').click(); });
  await p.waitForTimeout(300);

  // physics: a still tray stays put (no jitter, no drift) and results agree across frame rates
  await p.evaluate(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.begin({ players: 1, level: 0 }); });
  await sim(2.6); const still = await sim(5, { input: { x: 0, y: 1 } });
  const rest = await p.evaluate(() => { const G = window.__GAME.G; return { v: +G.v.toFixed(3), maxR: Math.max(...G.stack.map(i => Math.abs(i.r))), maxS: Math.max(...G.stack.map(i => Math.hypot(i.sx, i.sz))) }; });
  console.log('still', JSON.stringify(still), JSON.stringify(rest)); check(still.stack === 4 && rest.maxR < .02 && rest.maxS < .01, 'standing still: tower settles (no jitter)');
  const fr = {};
  for (const [nm, dt] of [['30fps', 1 / 30], ['60fps', 1 / 60], ['144fps', 1 / 144]]) {
    await p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); window.__GAME.S.diff = 'normal'; window.__GAME.begin({ players: 1, level: 1 }); });
    await sim(2.6, { dt }); const r = await sim(60, { auto: true, until: 'deliver', dt }); fr[nm] = r; await p.evaluate(() => { const G = window.__GAME.G; G.mode = 'done'; });
  }
  console.log('framerates', JSON.stringify(fr)); check(Object.values(fr).every(r => r.bad === 0 && r.mode === 'deliver'), 'no NaN and every frame rate reaches the table');
  check(Math.max(...Object.values(fr).map(r => r.stack)) - Math.min(...Object.values(fr).map(r => r.stack)) <= 2, 'delivered count consistent across 30/60/144 fps');

  // save migration (v1 → v2) and garbage saves
  const mig = await p.evaluate(() => { const g = window.__GAME; localStorage.setItem('inoa.tray', JSON.stringify({ stars: { 0: 3, 1: 2, 7: 1, 99: 3 }, best: { 0: 640, 1: 'x' }, players: 2, names: ['Zoe', '<b>Max</b>', '', 5], level: 7, cup: 'cup', chaos: true })); const a = g.loadSave(); localStorage.setItem('inoa.tray', '"oops"'); const b = g.loadSave(); localStorage.setItem('inoa.tray', JSON.stringify({ level: 999, stars: [], diff: 'nope' })); const c = g.loadSave(); localStorage.removeItem('inoa.tray'); return { a, b: { level: b.level, diff: b.diff }, c: { level: c.level, diff: c.diff } }; });
  console.log('migrate', JSON.stringify(mig));
  check(mig.a.v === 2 && mig.a.stars[0] === 3 && !mig.a.stars[99] && mig.a.best[0] === 640 && mig.a.best[1] === undefined && mig.a.diff === 'wild' && mig.a.names[1] === 'bMax/b' && mig.a.level === 7, 'v1 save migrates (stars, best, names sanitised, chaos → wild)');
  check(mig.b.level === 0 && mig.b.diff === 'chill' && mig.c.level === mig.c.level && mig.c.diff === 'chill', 'garbage saves fall back to defaults (new players start on Chill)');

  // the 18-course tour with the bot: every course reaches the table; screenshots at the new obstacles
  if (!process.env.TRAY_QUICK) {
    const SHOTS = { 8: ['doors', 'doors'], 9: ['pets', 'pets'], 10: ['ice', 'mop'], 11: ['stairs', 'stairs'], 12: ['revolve', 'revolve'], 13: ['beam', 'wedding'], 14: ['walk', 'walk'], 15: ['wind', 'rough'], 16: ['ice', 'ski'], 17: ['stairs', 'summit'] };
    const tour = [];
    for (let i = 0; i < L; i++) {
      await clean(); await p.evaluate(i => { window.__GAME.S.diff = 'normal'; window.__GAME.begin({ players: 1, level: i }); }, i);
      await sim(2.6);
      if (SHOTS[i]) { const s0 = await p.evaluate(t => { const s = window.__GAME.C.segs.find(s => s.t === t); return s ? s.s0 - (t === 'doors' || t === 'revolve' || t === 'pets' ? 1.6 : -.6) : 0; }, SHOTS[i][0]); await sim(30, { auto: true, untilS: s0 }); await shot('c' + (i + 1) + '_' + SHOTS[i][1]); }
      const r = await sim(80, { auto: true, until: 'deliver' }); const info = await p.evaluate(() => { const G = window.__GAME.G; return { why: (G.why || []).slice(0, 4), par: window.__GAME.parTime(G.L), t: +(G.time - G.playStart).toFixed(1) }; });
      tour.push({ c: i + 1, ...r, ...info });
      await p.evaluate(() => { window.__GAME.G.mode = 'done'; });
    }
    for (const t of tour) console.log('tour', JSON.stringify(t));
    check(tour.every(t => t.mode === 'deliver' && t.bad === 0), 'bot reaches the table on every course, no NaN');
    check(tour.filter(t => t.stack > 0).length >= L - 2, 'bot delivers something on (almost) every course');
  }

  // hot-seat: 2 players on course 5 (beams)
  await clean();
  await p.evaluate(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.begin({ players: 2, level: 4, cup: 'one' }); });
  console.log('p1', JSON.stringify(await sim(9, { auto: true })));
  await p.waitForTimeout(200); await shot('beam');
  console.log('p1 end', JSON.stringify(await sim(60, { auto: true, until: 'replay' })));
  await p.evaluate(() => window.__GAME.endReplay());
  await sim(.2); await p.waitForTimeout(500); await shot('board');
  const brd = await p.evaluate(() => document.querySelector('.ig-screen .ig-sub')?.textContent || ''); check(/\+\d+ = \d+ food/.test(brd), 'board explains the points: ' + brd);
  await p.evaluate(() => document.querySelector('.ig-screen [data-a=go]').click());
  console.log('p2 end', JSON.stringify(await sim(60, { auto: true, until: 'replay' })));
  await p.evaluate(() => window.__GAME.endReplay()); await sim(.2);
  await p.waitForTimeout(800); await shot('final');
  const fin = await p.evaluate(() => document.querySelector('.ig-results h2, .ig-results h1')?.textContent || ''); console.log('final', fin);

  // a perfect delivery on Chill: celebration (confetti, cheering customer, hops)
  await clean();
  await p.evaluate(() => { window.__GAME.S.diff = 'chill'; window.__GAME.begin({ players: 1, level: 0 }); });
  await sim(2.6); const perf = await sim(60, { auto: true, untilTally: true });
  await sim(1.5); const pr = await p.evaluate(() => window.__GAME.G.result); console.log('perfect?', JSON.stringify(perf), JSON.stringify(pr));
  await shot('deliver'); check(pr && pr.n === pr.tot && pr.stars >= 2, 'Chill course 1: bot delivers the whole order');
  await sim(4);

  // Spanish
  await clean();
  await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.lang = 'es'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); window.dispatchEvent(new Event('inoa:settings')); window.__GAME.title(); });
  await p.waitForTimeout(300);
  const es = await p.evaluate(() => document.querySelector('.ig-title')?.textContent.includes('Mapa de pistas')); check(es, 'title in Spanish');
  await shot('title_es');
  await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); });

  // portrait phone
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); window.__GAME.title(); });
  await p.waitForTimeout(400); await shot('p_title');
  const playVis = await p.evaluate(() => { const b = document.querySelector('.ig-title [data-a=play]').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; }); check(playVis, 'portrait title: Play button visible without scrolling');
  await p.evaluate(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.begin({ players: 1, level: 14 }); });
  console.log('portrait', JSON.stringify(await sim(7, { auto: true })));
  await shot('p_play');
  const hudRows = await p.evaluate(() => { const ch = [...document.querySelectorAll('.ig-top .ig-chip')].map(c => c.getBoundingClientRect().top); return new Set(ch.map(Math.round)).size; }); check(hudRows === 1, 'portrait HUD chips fit on one row');
  console.log(fails.length ? 'CHECKS FAILED: ' + fails.length : 'ALL CHECKS PASSED');
};
