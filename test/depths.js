// Pixel Pact: Depths — headless test. Autopilot plays a full run: title → rooms → boons → boss → results.
// DEPTHS_MODE=quick stops after the first room. Rendering is held (window.__HOLD) and done once per screenshot,
// because SwiftShader frames are slow; the simulation is stepped with __GAME.update().
const MODE = process.env.DEPTHS_MODE || 'full';
module.exports = async (p, shot0) => {
  await p.evaluate(() => addEventListener('error', e => console.error('STACK ' + String(e.error && e.error.stack).replace(/http:..localhost:[0-9]+/g, '').slice(0, 300))));
  const shot = async n => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.render(); }); await shot0(n); };
  const T0 = Date.now(); const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0) + 's', ...a);
  await p.evaluate(() => { window.__HOLD = true; for (let i = 0; i < 30; i++) window.__GAME.update(1 / 60); window.__GAME.render(); });
  await shot0('title');
  if (MODE === 'quick') { await p.evaluate(() => { window.__GAME.S.gold = 260; document.querySelector('.ig-title [data-a=camp]').click(); }); await shot0('camp'); await p.evaluate(() => { document.querySelector('[data-a=back]').click(); }); }
  await p.evaluate(() => { const g = window.__GAME; g.S.allies = 2; g.S.diff = 'story'; g.S.cls = 'knight'; document.querySelector('.ig-title [data-a=play]').click(); window.__HOLD = true; });
  // while simulating, sample how many big banners are visible at once (must stay <= 1) and how many damage numbers exist
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; g.autopilot = true; const M = window.__M || (window.__M = { big: 0, flt: 0 }); for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) { M.big = Math.max(M.big, [...document.querySelectorAll('.ig-big')].filter(e => +getComputedStyle(e).opacity > .05).length); M.flt = Math.max(M.flt, document.querySelectorAll('.ig-float').length); } if (until && eval(until)) break; if (i % 600 === 599) await new Promise(r => setTimeout(r, 0)); } return g.state(); }, { sec, until });
  let s = await sim(2.2); log('room1', JSON.stringify(s)); await shot('room1');
  s = await sim(1.5); await p.evaluate(() => { window.__GAME.zoom = 8; for (let i = 0; i < 45; i++) window.__GAME.update(1 / 60); }); await shot('close'); await p.evaluate(() => { window.__GAME.zoom = null; });
  if (MODE === 'quick') {
    s = await sim(20, 'window.__GAME.G.cardsOpen'); await shot('cards');
    await p.evaluate(() => { const g = window.__GAME; g.pickCard(0); g.joinP2(); }); s = await sim(1.2); log('p2', JSON.stringify(s)); await shot('p2');
    // touch layout check
    await p.goto(p.url().split('?')[0] + '?touch=1'); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
    await p.evaluate(() => { const g = window.__GAME; g.S.allies = 1; document.querySelector('.ig-title [data-a=play]').click(); window.__HOLD = true; });
    s = await sim(2.5); await shot('touch');
    return;
  }
  const seen = {};
  for (let k = 0; k < 400; k++) {
    s = await sim(4, 'window.__GAME.G && (window.__GAME.G.cardsOpen || window.__GAME.G.over || window.__GAME.G.ended || window.__GAME.G.cine)');
    const cards = await p.evaluate(() => !!window.__GAME.G?.cardsOpen);
    if (cards && !seen.cards) { seen.cards = 1; await shot('cards'); }
    if (cards) await sim(1);
    if (s.phase === 'fight' && [2, 4, 6].includes(s.room) && !seen['r' + s.room] && s.foes >= 3) { seen['r' + s.room] = 1; log('room', JSON.stringify(s)); await shot('room' + (s.room + 1)); }
    if (s.boss != null && !seen.cine) { seen.cine = 1; log('boss room'); await sim(1.6); await shot('bossintro'); }
    if (s.boss != null && s.phase === 'fight' && !seen.bf && s.boss < 1300) { seen.bf = 1; log('bossfight', JSON.stringify(s)); await shot('bossfight'); }
    if (k % 10 === 0) log('progress', JSON.stringify(s));
    if (s.over || s.ended || s.won) break;
  }
  log('end', JSON.stringify(s));
  s = await sim(8, 'window.__GAME.G && window.__GAME.G.ended'); log('final', JSON.stringify(s));
  await p.waitForTimeout(600); await shot('results');
  const chk = await p.evaluate(() => ({ M: window.__M, results: document.querySelectorAll('.ig-results').length, stats: [...document.querySelectorAll('.ig-results .ig-stats div')].map(d => d.innerText.replace(/\s+/g, ' ')).join(' | '), best: document.querySelector('.ig-results p.ig-sub')?.innerText }));
  log('checks', JSON.stringify(chk));
  if (chk.M.big > 1) console.error('banner overlap: ' + chk.M.big + ' visible at once');
  if (chk.results !== 1) console.error('results shown ' + chk.results + ' times');
  if (/\/9/.test(chk.stats)) console.error('dishonest rooms stat: ' + chk.stats);
};
