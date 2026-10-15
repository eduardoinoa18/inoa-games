// Perfect Fit headless test: real mouse drags, touch-style pointer drags, precision (pointer == drop point) incl. screen edges,
// fast flicks, pointercancel mid-drag, drag after a resize, a wrong drop, keyboard + gamepad placing, EN/ES text, E.say,
// auto-solve, before/after reveal, results exactly once, every level.
// Screenshots: test/out/fit_<name>.png (landscape) / fit_<name>_p.png (portrait), so the two orientations never overwrite each other.
const path = require('path');
module.exports = async (p, _shot) => {
  const vp = p.viewportSize(); const SUF = vp.height > vp.width ? '_p' : '';
  const shot = n => p.screenshot({ path: path.join(__dirname, 'out', 'fit_' + n + SUF + '.png'), timeout: 180000 });
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const st = () => p.evaluate(() => { const G = window.__GAME.G; return { li: G.li, placed: G.placed, wrong: G.wrong, done: G.done, states: G.items.map(i => i.state), seq: G.seq && G.seq.phase }; });
  const log = (k, v) => console.log(k, JSON.stringify(v));
  const fails = []; const check = (ok, msg) => { if (!ok) { fails.push(msg); console.log('FAIL', msg); } };
  // record what is read aloud
  await p.evaluate(() => { window.__said = []; try { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.voice = true; pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); } catch (e) { } if (window.speechSynthesis) speechSynthesis.speak = u => window.__said.push(u.text); });
  const plays = () => p.evaluate(() => { try { const g = JSON.parse(localStorage.getItem('inoa.profile')).games.fit; return g ? g.plays : 0; } catch (e) { return 0; } });
  await shot('title');
  await p.evaluate(() => { window.__GAME.S.oneWrong = false; window.__GAME.S.zen = false; document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForTimeout(300); await sim(.6); await p.waitForTimeout(300); await shot('start');
  log('saidStart', await p.evaluate(() => window.__said.slice()));
  check((await p.evaluate(() => window.__said.some(t => /Drag each thing/.test(t)))), 'start instruction read aloud');
  // target sizes on screen (thumb-friendly: slots and items should be comfortably large)
  log('sizes', await p.evaluate(() => { const g = window.__GAME; return { slot0: g.slotRectPx(0), item0: g.itemPx(0), vw: innerWidth }; }));

  // touch-style pointer events dispatched on the canvas (pointerType 'touch')
  const touch = async (type, x, y, id = 7) => p.evaluate(({ type, x, y, id }) => { const cv = document.getElementById('gl'); cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 })); }, { type, x, y, id });
  const itemAt = i => p.evaluate(i => window.__GAME.itemScreen(i), i), slotAt = s => p.evaluate(s => window.__GAME.slotScreen(s), s);
  const slotItem = s => p.evaluate(s => { const sl = window.__GAME.G.cont.slots[s]; return sl.item ? sl.item.idx : -1; }, s);

  // 1) real mouse drag of item 0 into its slot (+ precision: the drop point under the pointer == pointer)
  const drag = async (i, slot, midShot) => {
    const a = await itemAt(i), b = await slotAt(slot);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await sim(.15);
    for (let k = 1; k <= 12; k++) { await p.mouse.move(a.x + (b.x - a.x) * k / 12, a.y + (b.y - a.y) * k / 12); await sim(.04); }
    await sim(.5); const di = await p.evaluate(() => window.__GAME.dragInfo());
    if (midShot) { await p.waitForTimeout(200); await shot(midShot); }
    await p.mouse.up(); await sim(.8); return { di, b };
  };
  const s0 = await p.evaluate(() => window.__GAME.slotFor(0)); const r0 = await drag(0, s0, 'drag');
  log('dragInfo', r0); check(r0.di && Math.hypot(r0.di.fp.x - r0.b.x, r0.di.fp.y - r0.b.y) < 2, 'mouse drop point == pointer');
  check(r0.di && r0.di.near === s0, 'slot under the pointer highlighted');
  check(await slotItem(s0) === 0, 'mouse drag placed item 0 in the slot under the pointer');
  log('afterDrag', await st());
  // 2) wrong drop of item 1 -> floats back, wrong++
  const w1 = await p.evaluate(() => window.__GAME.wrongSlotFor(1)); await drag(1, w1);
  const aw = await st(); log('afterWrong', aw); check(aw.wrong === 1 && aw.states[1] === 'loose', 'wrong drop floats back');
  // 3) screen edges: the drop point tracks the pointer right to the edge; the item stays on the table; release off-box = no penalty
  {
    const a = await itemAt(1); await p.mouse.move(a.x, a.y); await p.mouse.down(); await sim(.1);
    const edges = [[3, vp.height / 2], [vp.width - 3, vp.height * .6], [vp.width / 2, vp.height - 3], [vp.width * .3, 60]]; const errs = [];
    for (const [x, y] of edges) { await p.mouse.move(x, y, { steps: 3 }); await sim(.3); const di = await p.evaluate(() => window.__GAME.dragInfo()); errs.push(di && di.fp ? Math.round(Math.hypot(di.fp.x - x, di.fp.y - y) * 10) / 10 : -1); }
    const pos = await p.evaluate(() => { const it = window.__GAME.G.items[1]; return it.g.position.toArray().map(v => +v.toFixed(2)); });
    await p.mouse.up(); await sim(.9); const s = await st(); log('edges', { errs, pos, s });
    check(errs.every(e => e >= 0 && e < 2), 'drop point tracks pointer at screen edges'); check(s.wrong === 1 && s.states[1] === 'loose', 'off-box release returns home without penalty');
  }
  // 4) fast flick: down on item, one jump to its slot, up with no frames in between -> lands in that slot
  {
    const sl = await p.evaluate(() => window.__GAME.slotFor(1)); const a = await itemAt(1), b = await slotAt(sl);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y); await p.mouse.up(); await sim(.9);
    log('flick', await st()); check(await slotItem(sl) === 1, 'fast flick lands in the slot under the pointer');
  }
  // 5) touch: pointercancel mid-drag over the right slot -> no drop, no penalty, item floats home
  const freeItem = () => p.evaluate(() => window.__GAME.G.items.findIndex(i => i.state === 'loose'));
  {
    const i = await freeItem(); const sl = await p.evaluate(i => window.__GAME.slotFor(i), i); const a = await itemAt(i), b = await slotAt(sl);
    await touch('pointerdown', a.x, a.y); await sim(.1); for (let k = 1; k <= 6; k++) { await touch('pointermove', a.x + (b.x - a.x) * k / 6, a.y + (b.y - a.y) * k / 6); await sim(.05); }
    const di = await p.evaluate(() => window.__GAME.dragInfo()); await touch('pointercancel', b.x, b.y); await sim(1);
    const s = await st(); log('cancel', { di, s }); check(di && di.touch, 'touch drag started');
    check(s.states[i] === 'loose' && s.wrong === 1 && await slotItem(sl) === -1, 'pointercancel mid-drag puts the item back, no penalty');
  }
  // 6) resize (same orientation) then a touch drag: still lands exactly under the finger
  {
    await p.setViewportSize({ width: vp.width + 24, height: vp.height + 16 }); await p.waitForTimeout(200); await sim(.3);
    const i = await freeItem(); const sl = await p.evaluate(i => window.__GAME.slotFor(i), i); const a = await itemAt(i), b = await slotAt(sl);
    await touch('pointerdown', a.x, a.y); await sim(.1); for (let k = 1; k <= 8; k++) { await touch('pointermove', a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8); await sim(.04); }
    await sim(.3); const di = await p.evaluate(() => window.__GAME.dragInfo()); await touch('pointerup', b.x, b.y); await sim(.9);
    log('resizeTouch', { di, b }); check(di && di.fp && Math.hypot(di.fp.x - b.x, di.fp.y - b.y) < 2, 'touch drop point == finger after resize');
    check(await slotItem(sl) === i, 'touch drag after resize placed the item');
    await p.setViewportSize(vp); await p.waitForTimeout(200); await sim(.3);
  }
  log('afterTouch', await st());
  // 7) the rest of level 1 by keyboard / auto: start level 2 for keyboard + gamepad (level 1 may be nearly solved by now)
  await p.evaluate(() => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.startLevel(1); }); await sim(.5);
  // keyboard: Tab to pick an item, Space, Tab through slots until the matching one, Space
  await p.keyboard.press('Tab'); await sim(.1);
  const kbRes = await p.evaluate(async () => { const g = window.__GAME, G = g.G; const it = G.items[G.focus]; dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); for (let i = 0; i < 20; i++) g.update(1 / 60); for (let k = 0; k < 12 && G.cont.slots[G.kbSlot].name !== it.name; k++) dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })); for (let i = 0; i < 30; i++) g.update(1 / 60); return { name: it.name, slot: G.cont.slots[G.kbSlot].name, hint: document.getElementById('keyHint').textContent }; });
  await p.waitForTimeout(200); await shot('keyboard');
  await p.keyboard.press('Space'); await sim(.8);
  const ak = await st(); log('kb', kbRes); log('afterKb', ak); check(ak.placed === 1, 'keyboard placed an item');
  check(await p.evaluate(() => window.__said.some(t => /Tab or the arrows/.test(t))), 'keyboard controls read aloud');
  // gamepad: fake pad, D-pad right to move, A to pick up / place (cycle slots until the matching one)
  const padRes = await p.evaluate(async () => {
    const g = window.__GAME, G = g.G; const pad = { id: 'test pad', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; navigator.getGamepads = () => [pad];
    const press = (b) => { pad.buttons[b].pressed = true; g.update(1 / 60); g.update(1 / 60); pad.buttons[b].pressed = false; g.update(1 / 60); g.update(1 / 60); };
    G.kb = false; press(15); press(0); const it = G.drag && G.drag.it; if (!it) return { err: 'no pick' };
    for (let k = 0; k < 14 && G.cont.slots[G.kbSlot].name !== it.name; k++) press(15); press(0); for (let i = 0; i < 60; i++) g.update(1 / 60);
    return { name: it.name, state: it.state, placed: G.placed, hint: document.getElementById('keyHint').textContent };
  });
  log('pad', padRes); check(padRes.placed === 2 && padRes.state === 'placed', 'gamepad placed an item');
  await p.evaluate(() => { navigator.getGamepads = () => []; });
  // 8) Spanish: menu + HUD + level names via E.L
  const es = await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile')); pr.lang = 'es'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); window.__GAME.title(); const t = document.querySelector('.ig-title').innerText; return { menu: /Elige una caja/i.test(t) && /Lonchera/.test(t), hud: document.getElementById('igHud').innerText }; });
  await p.waitForTimeout(200); await shot('title_es'); log('es', es); check(es.menu, 'Spanish menu text');
  await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile')); pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); });
  // 9) full round: auto-solve; capture wipe + reveal + results; results exactly once
  const plays0 = await plays();
  await p.evaluate(() => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.startLevel(0); window.__GAME.autoSolve(2); });
  for (let i = 0; i < 80; i++) { const s = await st(); if (s.seq === 1) break; await sim(.1); }
  log('solved', await st());
  await sim(.7); await shot('wipe');
  for (let i = 0; i < 40; i++) { const s = await st(); if (s.seq === 2) break; await sim(.1); }
  await sim(1.3); await p.waitForTimeout(300); await shot('reveal');
  await sim(4); await p.waitForTimeout(500); await shot('results'); await sim(3);
  const nRes = await p.evaluate(() => document.querySelectorAll('.ig-results').length); const plays1 = await plays();
  log('results', { nRes, plays0, plays1 }); check(nRes === 1 && plays1 - plays0 === 1, 'E.results exactly once per round');
  log('code', await p.evaluate(() => window.__GAME.shareCode()));
  // 10) every level: start state + solved state (with One-wrong on the last)
  for (let li = 1; li < 9; li++) {
    await p.evaluate(li => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.S.oneWrong = li === 8; window.__GAME.startLevel(li); }, li);
    await sim(.5); await p.waitForTimeout(250); await shot('lv' + li);
    if (li === 3 || li === 7 || li === 8) { await p.evaluate(() => window.__GAME.autoSolve(4)); await sim(9); await p.waitForTimeout(300); await shot('lv' + li + '_done'); }
  }
  await p.evaluate(() => { window.__GAME.S.oneWrong = false; });
  // 11) share-code replay round trip
  const ok = await p.evaluate(() => { const c = window.__GAME.parseCode('PF-003-3210-12'); return c; }); log('parse', ok);
  console.log(fails.length ? 'CHECKS FAILED: ' + fails.join(' | ') : 'ALL CHECKS PASSED');
  if (fails.length) throw new Error('fit checks failed: ' + fails.join(' | '));
};
