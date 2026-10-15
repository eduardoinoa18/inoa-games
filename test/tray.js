// Fail Tray headless test: title → solo run (with a forced collapse) → slow-mo replay → results → hot-seat board → party final.
module.exports = async (p, rawShot) => {
  const shot = async (n) => { await p.evaluate(() => { window.__HOLD = true; window.__GAME.warm(); }); await p.screenshot({ path: __dirname + '/out/tray_' + n + (p.viewportSize().width < p.viewportSize().height ? '_p' : '') + '.png', timeout: 0 }); await p.evaluate(() => { window.__HOLD = false; }); };
  const sim = (sec, opts = {}) => p.evaluate(async ({ sec, opts }) => { const g = window.__GAME; window.__AUTO = !!opts.auto; window.__INPUT = opts.input || null; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (opts.until && g.G && g.G.mode === opts.until) break; if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } return g.G ? { mode: g.G.mode, s: +g.G.s.toFixed(1), stack: g.G.stack.length, items: g.G.items.length } : null; }, { sec, opts });
  await shot('title');
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
  await sim(2.2); console.log('rep', JSON.stringify(await p.evaluate(() => window.__GAME.repInfo())), await p.evaluate(() => { const s = document.querySelector('.ft-rep .stamp'); return s ? s.className + ' ' + getComputedStyle(s).opacity + ' ' + getComputedStyle(s).transform : 'none'; })); await shot('replay2');
  console.log('after', JSON.stringify(await sim(12)));
  await p.waitForTimeout(800); await shot('results');
  const hasRes = await p.evaluate(() => !!document.querySelector('.ig-results'));
  console.log('results shown', hasRes);
  // hot-seat: 2 players on course 5 (beams)
  await p.evaluate(() => { document.querySelector('.ig-results [data-a=again]').click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.begin({ players: 2, level: 4, cup: 'one' }); });
  console.log('p1', JSON.stringify(await sim(9, { auto: true })));
  await p.waitForTimeout(200); await shot('beam');
  console.log('p1 end', JSON.stringify(await sim(60, { auto: true, until: 'replay' })));
  await p.evaluate(() => window.__GAME.endReplay());
  await sim(.2); await p.waitForTimeout(500); await shot('board');
  await p.evaluate(() => document.querySelector('.ig-screen [data-a=go]').click());
  console.log('p2 end', JSON.stringify(await sim(60, { auto: true, until: 'replay' })));
  await p.evaluate(() => window.__GAME.endReplay()); await sim(.2);
  await p.waitForTimeout(800); await shot('final');
  // portrait phone
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => { document.querySelectorAll('.ig-results,.ig-screen').forEach(e => e.remove()); window.__GAME.title(); });
  await p.waitForTimeout(400); await shot('p_title');
  await p.evaluate(() => { document.querySelector('.ig-title')?.remove(); window.__GAME.begin({ players: 1, level: 6 }); });
  console.log('portrait', JSON.stringify(await sim(9, { auto: true })));
  await shot('p_play');
};
