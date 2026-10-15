// Pixel Pact: Depths — headless test. Autopilot plays full runs: title → rooms → boons → boss → results,
// first Act I (Captain Brinehollow), then Act II (Glowroot Hollow → Grumblestone the colossus).
// DEPTHS_MODE=quick stops after the first room. DEPTHS_ACT=1|2 runs only that act (default: both). DEPTHS_DIFF=hard etc.
// Rendering is held (window.__HOLD) and done once per screenshot, because SwiftShader frames are slow; the simulation is stepped with __GAME.update().
const MODE = process.env.DEPTHS_MODE || 'full';
const ACTS = process.env.DEPTHS_ACT ? [+process.env.DEPTHS_ACT] : [1, 2];
const DIFF = process.env.DEPTHS_DIFF || 'story'; // story | normal | hard
module.exports = async (p, shot0) => {
  await p.evaluate(() => addEventListener('error', e => console.error('STACK ' + String(e.error && e.error.stack).replace(/http:..localhost:[0-9]+/g, '').slice(0, 300))));
  const shot = async n => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.render(); }); await shot0(n); };
  const T0 = Date.now(); const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0) + 's', ...a);
  await p.evaluate(() => { window.__HOLD = true; for (let i = 0; i < 30; i++) window.__GAME.update(1 / 60); window.__GAME.render(); });
  await shot0('title');
  if (MODE === 'quick') { await p.evaluate(() => { window.__GAME.S.gold = 260; document.querySelector('.ig-title [data-a=camp]').click(); }); await shot0('camp'); await p.evaluate(() => { document.querySelector('[data-a=back]').click(); }); }
  // while simulating, sample how many big banners are visible at once (must stay <= 1), how many damage numbers exist,
  // and which foe types / boss phases / shock rings appear
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; g.autopilot = true; const M = window.__M || (window.__M = { big: 0, flt: 0, types: {}, phase: 0, rings: 0, zones: 0, weak: 0 }); for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) { M.big = Math.max(M.big, [...document.querySelectorAll('.ig-big')].filter(e => +getComputedStyle(e).opacity > .05).length); M.flt = Math.max(M.flt, document.querySelectorAll('.ig-float').length); const G = g.G; if (G && G.foes) { for (const f of G.foes) { M.types[f.type] = 1; if (f.type === 'boss') { M.phase = Math.max(M.phase, f.phase || 0); if (f.weak) M.weak = 1; } } M.rings = Math.max(M.rings, (G.rings || []).length); M.zones = Math.max(M.zones, (G.zones || []).length); } } if (until && eval(until)) break; if (i % 600 === 599) await new Promise(r => setTimeout(r, 0)); } return g.state(); }, { sec, until });
  for (const act of ACTS) {
    const P = act === 2 ? 'a2_' : '';
    await p.evaluate(({ act, diff }) => { const g = window.__GAME; window.__M = null; if (act === 2) { g.S.wins = Math.max(1, g.S.wins); } g.S.act = act; g.S.allies = 2; g.S.diff = diff; g.S.cls = act === 2 ? 'mage' : 'knight'; g.title(); document.querySelector('.ig-title [data-a=play]').click(); window.__HOLD = true; }, { act, diff: DIFF });
    let s = await sim(2.2); log(P + 'room1', JSON.stringify(s)); await shot(P + 'room1');
    if (s.act !== act) console.error(`expected act ${act}, got ${s.act}`);
    s = await sim(1.5); await p.evaluate(() => { window.__GAME.zoom = 8; for (let i = 0; i < 45; i++) window.__GAME.update(1 / 60); }); await shot(P + 'close'); await p.evaluate(() => { window.__GAME.zoom = null; });
    if (MODE === 'quick') {
      s = await sim(20, 'window.__GAME.G.cardsOpen'); await shot('cards');
      await p.evaluate(() => { const g = window.__GAME; g.pickCard(0); g.joinP2(); }); s = await sim(1.2); log('p2', JSON.stringify(s)); await shot('p2');
      // touch layout check
      await p.goto(p.url().split('?')[0] + '?touch=1'); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
      await p.evaluate(() => { const g = window.__GAME; g.S.allies = 1; document.querySelector('.ig-title [data-a=play]').click(); window.__HOLD = true; });
      s = await sim(2.5); await shot('touch');
      // the fail path: the whole party goes down (no feathers left) → FALLEN → exactly one results card, gold kept
      await p.evaluate(() => window.__GAME.wipe()); s = await sim(5, 'window.__GAME.G && window.__GAME.G.ended'); await p.waitForTimeout(400); await shot('fallen');
      const fall = await p.evaluate(() => ({ ended: !!window.__GAME.G?.ended, over: !!window.__GAME.G?.over, results: document.querySelectorAll('.ig-results').length, title: document.querySelector('.ig-results h2, .ig-results .ig-title, .ig-results h1')?.innerText }));
      log('fallen', JSON.stringify(fall)); if (!fall.ended || fall.results !== 1) console.error('fail path broken: ' + JSON.stringify(fall));
      return;
    }
    const seen = {}; let bossT0 = null;
    for (let k = 0; k < 400; k++) {
      s = await sim(4, 'window.__GAME.G && (window.__GAME.G.cardsOpen || window.__GAME.G.over || window.__GAME.G.ended || window.__GAME.G.cine)');
      const cards = await p.evaluate(() => !!window.__GAME.G?.cardsOpen);
      if (cards && !seen.cards) { seen.cards = 1; await shot(P + 'cards'); }
      if (cards) await sim(1);
      if (s.phase === 'fight' && [2, 4, 6].includes(s.room) && !seen['r' + s.room] && s.foes >= 3) { seen['r' + s.room] = 1; log(P + 'room', JSON.stringify(s)); await shot(P + 'room' + (s.room + 1)); }
      if (s.boss != null && !seen.cine) { seen.cine = 1; log(P + 'boss room'); await sim(1.6); await shot(P + 'bossintro'); bossT0 = null; }
      if (s.boss != null && s.phase === 'fight' && bossT0 == null) bossT0 = s.t;
      if (s.boss != null && s.phase === 'fight' && !seen.bf && s.bossPhase >= 2) { seen.bf = 1; log(P + 'bossfight', JSON.stringify(s)); await shot(P + 'bossfight'); }
      if (s.boss != null && s.phase === 'fight' && !seen.bf3 && s.bossPhase >= 3) { seen.bf3 = 1; await sim(1.2); await shot(P + 'bossfight3'); }
      if (k % 10 === 0) log(P + 'progress', JSON.stringify(s));
      if (s.over || s.ended || s.won) break;
    }
    log(P + 'end', JSON.stringify(s), 'boss fight seconds', bossT0 != null ? (s.t - bossT0).toFixed(1) : '?');
    s = await sim(8, 'window.__GAME.G && window.__GAME.G.ended'); log(P + 'final', JSON.stringify(s));
    await p.waitForTimeout(600); await shot(P + 'results');
    const chk = await p.evaluate(() => ({ M: window.__M, results: document.querySelectorAll('.ig-results').length, stats: [...document.querySelectorAll('.ig-results .ig-stats div')].map(d => d.innerText.replace(/\s+/g, ' ')).join(' | '), best: document.querySelector('.ig-results p.ig-sub')?.innerText }));
    log(P + 'checks', JSON.stringify(chk));
    if (chk.M.big > 1) console.error('banner overlap: ' + chk.M.big + ' visible at once');
    if (chk.results !== 1) console.error('results shown ' + chk.results + ' times');
    if (/\/9/.test(chk.stats)) console.error('dishonest rooms stat: ' + chk.stats);
    if (s.won) { if (chk.M.phase < 3) console.error(`act ${act}: boss never reached phase 3 (${chk.M.phase})`); }
    if (act === 2) { for (const t of ['mole', 'spore', 'shard']) if (!chk.M.types[t]) console.error('act II foe never spawned: ' + t); if (s.won && !chk.M.rings) console.error('act II: no shock rings in the final phase'); }
    // back to the camp/title for the next act
    await p.evaluate(() => { document.querySelectorAll('.ig-results').forEach(e => e.closest('.ig-screen')?.remove()); window.__GAME.title(); });
  }
  // close-up "lab" of the act II cast: sporecap swelling, burrower popping out dizzy, crystal sentry aiming, the colossus with its fist stuck
  if (ACTS.includes(2)) {
    await p.evaluate(() => { const g = window.__GAME; g.S.act = 2; g.newRun({ act: 2 }); window.__HOLD = true; for (let i = 0; i < 70; i++) g.update(1 / 60);
      g.lab([['knight', 'attack', 2, .2, -3.2, 3.2, 2.4], ['mage', 'special', 0, .2, 3.4, 3.4, -2.6]], [['spore', 'wind', -4.2, .6, .6, .7], ['mole', 'recover', -1.6, 2.3, .3, .25, 'erupt'], ['shard', 'wind', 1.8, 2.4, -.4, .5], ['boss', 'stuck', 4.5, -2.6, -.5, .3]], 15); });
    await p.evaluate(() => { const g = window.__GAME; const b = g.G.foes.find(f => f.type === 'boss'); b.side = 1; b.weak = true; for (const f of g.G.foes) for (let k = 0; k < 30; k++) { f.animT += 1 / 60; } });
    await shot('a2_lab');
    await p.evaluate(() => window.__GAME.title());
  }
  // Spanish: switch the shared setting, the title re-renders (classes, acts, party, difficulty must all be translated)
  const es = await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); E.setSetting('lang', 'es'); await new Promise(r => setTimeout(r, 50)); const t = document.querySelector('.ig-title')?.innerText || ''; return { ok: ['Expedición', 'Caballero', 'Luchador', 'Historia', 'Difícil', 'aliados', 'Campamento'].filter(w => !t.includes(w)), leaks: ['Knight', 'Brawler', 'Hard', 'allies', 'The Sunken Deep'].filter(w => t.includes(w)) }; });
  await shot0('title_es'); log('ES title', JSON.stringify(es));
  if (es.ok.length || es.leaks.length) console.error('ES title not fully translated: missing ' + es.ok.join(',') + ' / english ' + es.leaks.join(','));
  await p.evaluate(async () => { const E = await import('/engine/inoa3d.js'); E.setSetting('lang', 'en'); });
};
