// Perfect Fit headless test: real mouse drags, a wrong drop, keyboard placing, auto-solve, before/after reveal, results, every level.
module.exports = async (p, _shot) => {
  const shot = n => p.screenshot({ path: require('path').join(require('path').join(__dirname, 'out'), 'fit_' + n + '.png'), timeout: 180000 });
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const st = () => p.evaluate(() => { const G = window.__GAME.G; return { li: G.li, placed: G.placed, wrong: G.wrong, done: G.done, states: G.items.map(i => i.state), seq: G.seq && G.seq.phase }; });
  const log = (k, v) => console.log(k, JSON.stringify(v));
  await shot('title');
  await p.evaluate(() => { window.__GAME.S.oneWrong = false; document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForTimeout(300); await sim(.6); await p.waitForTimeout(300); await shot('start');
  // 1) real mouse drag of item 0 into its slot
  const drag = async (i, slot, midShot) => {
    const a = await p.evaluate(i => window.__GAME.itemScreen(i), i); const b = await p.evaluate(s => window.__GAME.slotScreen(s), slot);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await sim(.15);
    for (let k = 1; k <= 12; k++) { await p.mouse.move(a.x + (b.x - a.x) * k / 12, a.y + (b.y - a.y) * k / 12); await sim(.04); }
    await sim(.5); if (midShot) { await p.waitForTimeout(200); await shot(midShot); }
    await p.mouse.up(); await sim(.8);
  };
  const s0 = await p.evaluate(() => window.__GAME.slotFor(0)); await drag(0, s0, 'drag');
  log('afterDrag', await st());
  // 2) wrong drop of item 1 -> floats back, wrong++
  const w1 = await p.evaluate(() => window.__GAME.wrongSlotFor(1)); await drag(1, w1);
  log('afterWrong', await st());
  // 3) keyboard: Tab to pick an item, Space, Tab through slots until the matching one, Space
  await p.keyboard.press('Tab'); await sim(.1);
  const kbRes = await p.evaluate(async () => { const g = window.__GAME, G = g.G; const it = G.items[G.focus]; dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); for (let i = 0; i < 20; i++) g.update(1 / 60); for (let k = 0; k < 12 && G.cont.slots[G.kbSlot].name !== it.name; k++) dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })); for (let i = 0; i < 30; i++) g.update(1 / 60); return { name: it.name, slot: G.cont.slots[G.kbSlot].name }; });
  await p.waitForTimeout(200); await shot('keyboard');
  await p.keyboard.press('Space'); await sim(.8);
  log('kb', kbRes); log('afterKb', await st());
  // 4) auto-solve the rest; capture wipe + reveal + results
  await p.evaluate(() => window.__GAME.autoSolve(2));
  for (let i = 0; i < 80; i++) { const s = await st(); if (s.seq === 1) break; await sim(.1); }
  log('solved', await st());
  await sim(.7); await shot('wipe');
  for (let i = 0; i < 40; i++) { const s = await st(); if (s.seq === 2) break; await sim(.1); }
  await sim(1.3); await p.waitForTimeout(300); await shot('reveal');
  await sim(4); await p.waitForTimeout(500); await shot('results');
  log('code', await p.evaluate(() => window.__GAME.shareCode()));
  // 5) every level: start state + solved state (with One-wrong on the last)
  for (let li = 1; li < 9; li++) {
    await p.evaluate(li => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.S.oneWrong = li === 8; window.__GAME.startLevel(li); }, li);
    await sim(.5); await p.waitForTimeout(250); await shot('lv' + li);
    if (li === 3 || li === 8) { await p.evaluate(() => window.__GAME.autoSolve(4)); await sim(9); await p.waitForTimeout(300); await shot('lv' + li + '_done'); }
  }
  // 6) share-code replay round trip
  const ok = await p.evaluate(() => { const c = window.__GAME.parseCode('PF-003-3210-12'); return c; }); log('parse', ok);
};
