// Tide Runner headless test: title (Play visible, tabs, shop, Spanish) → save migration → run (swipe + buffer checks, autopilot,
// jump/slide/power/wave frames) → every zone (warp) + checkpoint refill → missions → crash out → results → ghost → daily seed.
// RUNNER_QUICK=1 skips the long autopilot stretch. RUNNER_THUMB=1 writes test/out/runner_thumb.png (tile art source).
module.exports = async (p, shot) => {
  const portrait = Number(process.env.H || 560) > Number(process.env.W || 1000), pre = portrait ? 'p_' : '';
  const S = n => p.screenshot({ path: require('path').join(__dirname, 'out', `runner_${pre}${n}.png`), timeout: 180000 });
  const fails = []; const check = (ok, msg) => { console.log((ok ? 'OK   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; window.__HOLD = true; const f = until ? new Function('G', 'return ' + until) : null; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (f && f(g.G)) { window.__HOLD = false; return i; } if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } window.__HOLD = false; return -1; }, { sec, until });

  const solid = () => p.evaluate(() => { const g = window.__GAME; g.G.invT = 0; g.update(1 / 60); g.updateCamera(1 / 60); }); // no invulnerability blink in shots
  // ---- title ----
  await S('title');
  const vis = await p.evaluate(() => { const b = document.querySelector('.ig-title [data-a=play]').getBoundingClientRect(); return { bottom: Math.round(b.bottom), h: innerHeight }; });
  check(vis.bottom <= vis.h + 1, `title: Play button visible without scrolling (${vis.bottom} <= ${vis.h})`);
  const mis = await p.evaluate(() => document.querySelectorAll('.ig-title .rn-m').length); check(mis === 3, `title: 3 missions listed (${mis})`);
  await p.evaluate(() => window.__GAME.E.setSetting('lang', 'es')); await p.waitForTimeout(200);
  const es = await p.evaluate(() => document.querySelector('.ig-title [data-tab=run]').textContent); check(/Correr/.test(es), `title: Spanish re-render (${es})`);
  await S('title_es'); await p.evaluate(() => window.__GAME.E.setSetting('lang', 'en')); await p.waitForTimeout(150);

  // ---- save migration (v1 → v2) and garbage saves ----
  const mig = await p.evaluate(() => { const keep = localStorage.getItem('inoa.runner'); const g = window.__GAME; const fr = [[0, 0, 0, 0], [3, 0, 0, 0], [6, 0, .5, 0], [9, 2.3, 0, 0], [12, 2.3, 0, 1], [15, 0, 0, 0]];
    localStorage.setItem('inoa.runner', JSON.stringify({ runner: 2, picked: true, mode: 'daily', diff: 'classic', best: { endless: 812, daily: { date: '2026-10-15', d: 300 } }, ghost: { endless: { best: 812, runner: 2, s: fr, date: '2026-10-14' }, daily: null } }));
    const a = g.loadSave(); localStorage.setItem('inoa.runner', '{"best":"x","ghost":5,"runner":99,"diff":"evil","owned":"all","jar":-50}'); const b = g.loadSave(); localStorage.setItem('inoa.runner', '"oops"'); const c = g.loadSave();
    if (keep == null) localStorage.removeItem('inoa.runner'); else localStorage.setItem('inoa.runner', keep);
    return { a: [a.v, a.runner, a.mode, a.diff, a.best.endless, a.best.daily.d, a.ghost.endless && a.ghost.endless.s.length, a.jar, a.trail].join(','), b: [b.runner, b.diff, b.best.endless, b.ghost.endless, b.jar, b.owned.length].join(','), c: c.diff }; });
  check(mig.a === '2,2,daily,classic,812,300,6,0,foam', `migration v1 → v2 keeps runner/mode/style/bests/ghost (${mig.a})`);
  check(mig.b === '0,friendly,0,,0,3' && mig.c === 'friendly', `garbage saves fall back to defaults (${mig.b} / ${mig.c})`);

  // ---- start ----
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await sim(.6); await p.waitForTimeout(250); await S('ready');
  await sim(1.0);
  // swipe fires mid-gesture (before the finger lifts), a long drag is one lane, a diagonal picks its main axis
  const vw = portrait ? 390 : 1000, vh = portrait ? 844 : 560, cx = vw / 2, cy = vh * .45;
  const lane0 = await p.evaluate(() => window.__GAME.G.lane);
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 24, cy, { steps: 3 });
  const lane1 = await p.evaluate(() => { const g = window.__GAME; g.update(1 / 60); return g.G.lane; });
  check(lane1 === lane0 + 1, `swipe: 24 px drag changes lane before release (${lane0} → ${lane1})`);
  await p.mouse.move(cx + 200, cy, { steps: 8 }); await p.mouse.up();
  const lane2 = await p.evaluate(() => { const g = window.__GAME; g.update(1 / 60); g.update(1 / 60); return g.G.lane; });
  check(lane2 === lane1 + 1 || lane2 === 2, `swipe: one long drag = at most one more lane (${lane1} → ${lane2})`);
  await p.evaluate(() => { const G = window.__GAME.G; G.lane = 1; G.x = 0; G.invT = 3; });
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 14, cy - 26, { steps: 3 });
  const j0 = await p.evaluate(() => { const g = window.__GAME; g.update(1 / 60); return { vy: g.G.vy, lane: g.G.lane }; }); await p.mouse.up();
  check(j0.vy > 0 && j0.lane === 1, `swipe: up-right diagonal = jump, no lane change (vy ${j0.vy.toFixed(1)}, lane ${j0.lane})`);
  await sim(1);
  // input buffer: jump pressed just before landing still happens
  const buf = await p.evaluate(() => { const g = window.__GAME, G = g.G; G.y = .12; G.vy = -4; const n0 = G.st.jump; g.act('jump'); for (let i = 0; i < 8; i++) g.update(1 / 60); return { jumped: G.st.jump - n0, y: G.y }; });
  check(buf.jumped === 1 && buf.y > 0, `buffer: jump pressed 0.03 s before landing fires on landing (${JSON.stringify(buf)})`);

  await p.evaluate(() => { window.__GAME.auto = true; });
  await sim(4); await p.waitForTimeout(300); await S('run');
  const j = await sim(20, 'G.y > 1.0 && G.vy < 2'); console.log('jump frame', j); await p.waitForTimeout(250); await S('jump');
  const s = await sim(80, 'G.slideT > 0 && G.slideT < .55'); console.log('slide frame', s); await p.waitForTimeout(250); await S('slide');

  // ---- zones: warp to each, check dressing + obstacle sets, screenshot ----
  for (let i = 1; i <= 4; i++) {
    const r = await p.evaluate((i) => { const g = window.__GAME, G = g.G; g.warp(i * g.ZL + 26); G.invT = 99; return { zone: g.ZONES[i].id }; }, i);
    await sim(1.2);
    const info = await p.evaluate((i) => { const g = window.__GAME, G = g.G, Z = g.ZONES[i]; const allowed = new Set([...Z.jump, ...Z.block, ...Z.slide, Z.allJump, Z.allSlide]); const near = G.obs.filter(o => o.d0 > G.d && o.d0 < G.d + 150); const bad = near.filter(o => !allowed.has(o.type)).map(o => o.type); const ch = g.chunks.filter(c => c.k * 36 >= G.d - 10 && c.k * 36 < G.d + 150).map(c => c.z); return { n: near.length, bad, chunksOk: ch.every(z => z === i), types: [...new Set(near.map(o => o.type))].join(' ') }; }, i);
    check(info.n > 3 && !info.bad.length && info.chunksOk, `zone ${r.zone}: ${info.n} obstacles of its own set (${info.types})${info.bad.length ? ' BAD ' + info.bad : ''}, dressing ok ${info.chunksOk}`);
    await p.evaluate(() => { const g = window.__GAME; g.G.invT = 0; g.update(1 / 60); g.updateCamera(1 / 60); }); await p.waitForTimeout(300); await S('zone_' + r.zone);
  }
  // reef close-up of a jellyfish row (slide)
  await p.evaluate(() => { const G = window.__GAME.G; G.invT = 99; });
  const jf = await sim(25, "G.obs.some(o => (o.type === 'jelly' || o.type === 'jellies') && o.d0 - G.d < 9 && o.d0 > G.d + 4)"); console.log('jelly frame', jf); await solid(); await p.waitForTimeout(250); await S('reef_jelly');
  // checkpoint: friendly refills hearts when crossing a gate; the zone, music and look change
  const cp = await p.evaluate(async () => { const g = window.__GAME, G = g.G; g.warp(5 * g.ZL - 40); G.hearts = 1; G.invT = 99; const z0 = G.zoneN; for (let i = 0; i < 60 * 6 && G.zoneN === z0; i++) { g.update(1 / 60); if (i % 30 === 0) await new Promise(r => setTimeout(r, 0)); } return { hearts: G.hearts, zone: G.zoneN, fog: Math.round(g.E && document && 0), song: G.song }; });
  check(cp.hearts === 3 && cp.zone === 5 && cp.song === 'bright', `checkpoint at lap 2: hearts refilled to ${cp.hearts}, zone ${cp.zone}, song ${cp.song}`);
  await sim(.4); await solid(); await p.waitForTimeout(200); await S('lap2');

  // ---- missions ----
  const m = await p.evaluate(() => { const g = window.__GAME, G = g.G, S = g.S; S.missions = [{ k: 'jump', n: 3, base: 0, tier: 0, done: false }, { k: 'coinsT', n: 999999, base: S.tot.coins, tier: 0, done: false }, { k: 'dist', n: 999999, base: 0, tier: 0, done: false }]; const jar0 = S.jar, xp0 = G.mxp; G.st.jump = 3; g.checkMissions(); return { done: S.missions[0].done, jar: S.jar - jar0, xp: G.mxp - xp0, banner: document.querySelector('#rnMis').classList.contains('show') }; });
  check(m.done && m.jar === 50 && m.xp === 30 && m.banner, `missions: completing one pays +${m.xp} XP and +${m.jar} coins with a banner`);

  // ---- power-ups: wave ride smashes through obstacles without costing hearts ----
  const wv = await p.evaluate(async () => { const g = window.__GAME, G = g.G; g.auto = false; G.invT = 0; G.hearts = 3; G.pw.wave = 6; G.smashN = 0; for (let i = 0; i < 60 * 8 && G.pw.wave; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (i % 30 === 0) await new Promise(r => setTimeout(r, 0)); } return { hearts: G.hearts, smashed: G.smashN, inv: G.invT > 0 }; });
  check(wv.hearts === 3 && wv.smashed > 0, `wave ride: ${wv.smashed} obstacles smashed, hearts kept (${wv.hearts}), grace after (${wv.inv})`);
  await p.evaluate(() => { const G = window.__GAME.G; G.pw.wave = 6; G.invT = 99; window.__GAME.auto = true; }); await sim(.7); await p.waitForTimeout(250); await S('wave');
  await p.evaluate(() => { const G = window.__GAME.G; delete G.pw.wave; G.pw.shield = 14; G.pw.magnet = 9; G.pw.double = 10; window.__GAME.showShield(); }); await sim(.8); await p.waitForTimeout(250); await S('power');

  // ---- long autopilot stretch from the start (collision fairness log) ----
  if (!process.env.RUNNER_QUICK && !portrait) {
    await p.evaluate(() => { const g = window.__GAME; g.startRun(); g.auto = true; });
    const r = await p.evaluate(async () => { const g = window.__GAME, G = g.G; for (let i = 0; i < 60 * 70 && G.state !== 'over'; i++) { g.update(1 / 60); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return { d: Math.round(G.d), coins: G.coinsN, hearts: G.hearts, state: G.state, zone: G.zoneN, close: G.st.close, jumps: G.st.jump, slides: G.st.slide }; });
    console.log('autopilot 70s', JSON.stringify(r), await p.evaluate(() => JSON.stringify(window.__GAME.G.log)));
    check(r.state === 'run' && r.d > 700, `autopilot survives 70 s in Friendly (${r.d} m, zone ${r.zone})`);
  }

  // ---- crash out → results ----
  await p.evaluate(() => { const G = window.__GAME.G; window.__GAME.auto = false; G.invT = 0; for (const k in G.pw) delete G.pw[k]; });
  const st = await sim(14, 'G.stumbleT > .5'); console.log('stumble frame', st); await sim(.12); await p.waitForTimeout(200); await S('stumble');
  const e = await p.evaluate(async () => { const g = window.__GAME, G = g.G; for (let i = 0; i < 60 * 150 && !G.resultsShown; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (G.state === 'run' && G.y <= 0 && i % 50 === 0) g.act(Math.random() < .5 ? 'left' : 'right'); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return { d: Math.round(G.d), state: G.state, shown: !!G.resultsShown }; });
  check(e.shown, `run ends with results (${JSON.stringify(e)})`);
  await p.waitForTimeout(800); await S('results');
  const store = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('inoa.runner')); return { v: s.v, best: s.best.endless, ghost: s.ghost.endless && s.ghost.endless.s.length, jar: s.jar, runs: s.tot.runs }; });
  check(store.v === 2 && store.best > 0 && store.ghost > 4 && store.jar > 0 && store.runs >= 1, `save: ${JSON.stringify(store)}`);

  // ---- play again → ghost racing ----
  await p.evaluate(() => document.querySelector('.ig-results [data-a=again]').click());
  await p.evaluate(() => { window.__GAME.auto = true; });
  await sim(4.5); await p.waitForTimeout(300); await S('ghost');
  const gs = await p.evaluate(() => ({ ghostD: window.__GAME.G.ghostD, d: window.__GAME.G.d, vis: !document.querySelector('#rnGhost').hidden }));
  check(gs.ghostD > 5 && gs.vis, `ghost replays your best (${JSON.stringify(gs)})`);
  if (portrait) { const row = await p.evaluate(() => [...document.querySelectorAll('.ig-hud .ig-chip')].map(c => c.offsetTop)); check(new Set(row).size === 1, `portrait HUD chips on one row (${row})`); }

  // ---- daily run: same date → same course on every start ----
  const daily = await p.evaluate(() => { const g = window.__GAME; g.auto = false; g.S.mode = 'daily'; const sig = () => g.G.obs.slice(0, 14).map(o => o.type + Math.round(o.d0) + o.lanes.join('')).join(','); g.startRun(); const a = sig(); g.startRun(); const b = sig(); g.S.mode = 'endless'; g.startRun(); const c = sig(); return { same: a === b, differsFromEndless: a !== c, a: a.slice(0, 80) }; });
  check(daily.same && daily.differsFromEndless, `daily seed deterministic (${daily.a})`);
  // kids style: slower start, 5 hearts
  const kids = await p.evaluate(() => { const g = window.__GAME; g.S.diff = 'kids'; g.startRun(); for (let i = 0; i < 100; i++) g.update(1 / 60); const r = { hearts: g.G.hearts, speed: +g.G.speed.toFixed(1) }; g.S.diff = 'friendly'; return r; });
  check(kids.hearts === 5 && kids.speed < 8.6, `kids style: ${kids.hearts} hearts, start speed ${kids.speed} m/s`);
  // rainbow trail
  await p.evaluate(() => { const g = window.__GAME; g.S.trail = 'rainbow'; g.startRun(); g.auto = true; }); await sim(3.2); await p.waitForTimeout(250); await S('trail');

  // ---- shop: buy a trail with the coin jar ----
  await p.evaluate(() => { const g = window.__GAME; g.S.jar = 5000; g.S.trail = 'foam'; g.S.owned = g.S.owned.filter(x => x !== 'stars'); g.title(); });
  await p.evaluate(() => document.querySelector('.ig-title [data-tab=shop]').click());
  await p.evaluate(() => document.querySelector('#pT [data-id=stars]').click());
  const half = await p.evaluate(() => ({ owned: window.__GAME.S.owned.includes('stars'), label: document.querySelector('#pT [data-id=stars] small').textContent }));
  await p.evaluate(() => document.querySelector('#pT [data-id=stars]').click());
  const shop = await p.evaluate(() => ({ owned: window.__GAME.S.owned.includes('stars'), trail: window.__GAME.S.trail, jar: window.__GAME.S.jar }));
  check(!half.owned && /Buy/.test(half.label) && shop.owned && shop.trail === 'stars' && shop.jar === 3000, `shop: confirm then buy Stardust (${half.label} → ${JSON.stringify(shop)})`);
  await p.waitForTimeout(200); await S('shop');

  if (process.env.RUNNER_THUMB) { await p.evaluate(() => { const g = window.__GAME; document.querySelectorAll('.ig-screen').forEach(d => d.remove()); g.S.trail = 'rainbow'; g.startRun(); g.auto = true; }); await sim(1.5); await p.evaluate(() => { const g = window.__GAME; g.warp(3 * g.ZL + 60); g.G.invT = 0; g.G.pw.magnet = 9; }); await sim(2.4); await p.evaluate(() => { document.querySelectorAll('.ig-top,.ig-pad,.rn-pw,.rn-ghost,.ig-toast,.ig-big,.rn-hint,.rn-mis,.inoa-pw,.ig-party').forEach(e => e.style.visibility = 'hidden'); }); await p.waitForTimeout(300); await S('thumb'); }

  console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS PASSED');
};
