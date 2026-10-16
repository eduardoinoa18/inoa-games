// Perfect Fit headless test: real mouse drags, touch-style pointer drags, precision (pointer == drop point) incl. screen edges,
// fast flicks, pointercancel mid-drag, drag after a resize, generous pick radius, haptics, a wrong drop, keyboard + gamepad +
// phone-controller placing, EN/ES text, E.say, rooms/unlocks, auto-solve, before/after reveal, room-complete bonus, results exactly once,
// every box (20) solvable, the quarter-turned box surviving an orientation change, and the v1 → v2 save migration.
// Screenshots: test/out/fit_<name>.png (landscape) / fit_<name>_p.png (portrait), so the two orientations never overwrite each other.
const path = require('path');
module.exports = async (p, _shot) => {
  const vp = p.viewportSize(); const SUF = vp.height > vp.width ? '_p' : ''; const PORT = !!SUF;
  const shot = n => p.screenshot({ path: path.join(__dirname, 'out', 'fit_' + n + SUF + '.png'), timeout: 180000 });
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const st = () => p.evaluate(() => { const G = window.__GAME.G; return { li: G.li, placed: G.placed, wrong: G.wrong, done: G.done, states: G.items.map(i => i.state), seq: G.seq && G.seq.phase }; });
  const log = (k, v) => console.log(k, JSON.stringify(v));
  const fails = []; const check = (ok, msg) => { if (!ok) { fails.push(msg); console.log('FAIL', msg); } };
  const hooks = () => p.evaluate(() => { window.__said = []; window.__buzz = []; try { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.voice = true; pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); } catch (e) { } if (window.speechSynthesis) speechSynthesis.speak = u => window.__said.push(u.text); navigator.vibrate = pat => { window.__buzz.push(pat); return true; }; });
  await hooks();
  const plays = () => p.evaluate(() => { try { const g = JSON.parse(localStorage.getItem('inoa.profile')).games.fit; return g ? g.plays : 0; } catch (e) { return 0; } });
  // title: 4 rooms, the first box open, the rest of a fresh save locked
  const t0 = await p.evaluate(() => ({ rooms: document.querySelectorAll('#pRooms button').length, roomsOpen: document.querySelectorAll('#pRooms button:not([disabled])').length, boxes: document.querySelectorAll('#pLv button').length, open: document.querySelectorAll('#pLv button:not([disabled])').length, n: window.__GAME.LEVELS.length, goal: document.getElementById('pGoal').innerText }));
  log('title', t0); check(t0.rooms === 4 && t0.roomsOpen === 1 && t0.boxes === 6 && t0.open === 1 && t0.n >= 16, 'title: 4 rooms, 16+ boxes, fresh save opens only the first');
  await shot('title');
  // the menu box is not a game: pause there must not open the pause menu
  await p.evaluate(() => window.__GAME.pause()); check(!(await p.evaluate(() => [...document.querySelectorAll('.ig-screen h2')].some(h => /Paused|Pausa/.test(h.textContent)))), 'no pause menu over the title');
  await p.evaluate(() => { window.__GAME.S.oneWrong = false; window.__GAME.S.zen = false; document.querySelector('.ig-title [data-a=play]').click(); });
  await p.waitForTimeout(300); await sim(.6); await p.waitForTimeout(300); await shot('start');
  log('saidStart', await p.evaluate(() => window.__said.slice()));
  check((await p.evaluate(() => window.__said.some(t => /Drag each thing/.test(t)))), 'start instruction read aloud');
  // target sizes on screen (thumb-friendly: slots and items should be comfortably large)
  log('sizes', await p.evaluate(() => { const g = window.__GAME; return { slot0: g.slotRectPx(0), item0: g.itemPx(0), minSlot: Math.round(g.minSlotPx()), vw: innerWidth }; }));

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
  check((await p.evaluate(() => window.__buzz.length)) === 0, 'no vibration for mouse play');
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
  // 6) resize (same orientation) then a touch drag: still lands exactly under the finger; light haptics on the snap
  {
    await p.setViewportSize({ width: vp.width + 24, height: vp.height + 16 }); await p.waitForTimeout(200); await sim(.3);
    await p.evaluate(() => { window.__buzz = []; });
    const i = await freeItem(); const sl = await p.evaluate(i => window.__GAME.slotFor(i), i); const a = await itemAt(i), b = await slotAt(sl);
    await touch('pointerdown', a.x, a.y); await sim(.1); for (let k = 1; k <= 8; k++) { await touch('pointermove', a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8); await sim(.04); }
    await sim(.3); const di = await p.evaluate(() => window.__GAME.dragInfo()); await touch('pointerup', b.x, b.y); await sim(.9);
    log('resizeTouch', { di, b }); check(di && di.fp && Math.hypot(di.fp.x - b.x, di.fp.y - b.y) < 2, 'touch drop point == finger after resize');
    check(await slotItem(sl) === i, 'touch drag after resize placed the item');
    const bz = await p.evaluate(() => window.__buzz.slice()); log('buzz', bz); check(bz.length >= 2, 'touch play gives light haptics (lift + snap)');
    await p.setViewportSize(vp); await p.waitForTimeout(200); await sim(.3);
  }
  log('afterTouch', await st());
  // 6b) generous pick: a finger just outside the item's box still picks it up (nearest item within reach)
  {
    await p.evaluate(async () => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); await window.__GAME.startLevel(9); }); await sim(.4);
    // the item whose pick box ends closest to its middle; a touch just past that edge must still pick it (the ray alone would miss)
    const res = await p.evaluate(() => { const g = window.__GAME; let best = null; for (let i = 0; i < g.G.items.length; i++) { const c = g.itemScreen(i); for (let dx = 2; dx < 120; dx += 2) if (!g.rayHit(c.x + dx, c.y)) { if (!best || dx < best.dx) best = { i, dx, x: c.x + dx, y: c.y }; break; } } if (!best) return null; return { ...best, touch: best.dx <= 44 ? g.pickAt(best.x, best.y, true) : best.i }; });
    log('pick', res); check(res && res.touch === res.i, 'touch just outside an item still picks it');
  }
  // 7) keyboard + gamepad + phone controller on the Spice Drawer
  await p.evaluate(async () => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); await window.__GAME.startLevel(1); }); await sim(.5);
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
  // phone controller (engine/net.js player in the room): stick right chooses, A picks up & places
  const phoneRes = await p.evaluate(async () => {
    const E = await import('/engine/inoa3d.js'); const net = E.net; const g = window.__GAME, G = g.G;
    const role = net.role; net.role = 'host'; const pl = { slot: 2, id: 'test-phone', kind: 'pad', name: 'Phone', connected: true, input: { x: 0, y: 0, a: false, b: false, c: false, d: false, pause: false } }; net.players.push(pl);
    const step = () => { for (let i = 0; i < 3; i++) g.update(1 / 60); };
    const press = k => { pl.input[k] = true; step(); pl.input[k] = false; step(); };
    const nudge = () => { pl.input.x = 1; step(); pl.input.x = 0; step(); };
    try {
      nudge(); press('a'); const it = G.drag && G.drag.it; if (!it) return { err: 'no pick' };
      for (let k = 0; k < 14 && G.cont.slots[G.kbSlot].name !== it.name; k++) nudge(); press('a'); for (let i = 0; i < 60; i++) g.update(1 / 60);
      press('pause'); const paused = [...document.querySelectorAll('.ig-screen h2')].some(h => /Paused|Pausa/.test(h.textContent));
      document.querySelector('.ig-screen [data-a=resume]')?.click();
      return { name: it.name, state: it.state, placed: G.placed, paused };
    } finally { net.players.splice(net.players.indexOf(pl), 1); net.role = role; }
  });
  log('phone', phoneRes); check(phoneRes.placed === 3 && phoneRes.state === 'placed', 'phone controller placed an item'); check(phoneRes.paused, 'phone ⏸ pauses');
  // 8) Spanish: menu + HUD + room/box names via E.L
  const es = await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile')); pr.lang = 'es'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); window.__GAME.title(); const t = document.querySelector('.ig-title').innerText; return { menu: /Elige un cuarto/i.test(t) && /Cocina/.test(t) && /Lonchera/.test(t) && !/Kitchen|Choose a room/.test(t), hud: document.getElementById('igHud').innerText }; });
  await p.waitForTimeout(200); await shot('title_es'); log('es', es); check(es.menu, 'Spanish menu text (rooms + boxes)');
  await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile')); pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); });
  // 9) full round: the last open Kitchen box completes the room: tidy wave, wipe, reveal, results exactly once, room bonus
  const plays0 = await plays();
  await p.evaluate(() => { const g = window.__GAME; for (const id of ['spice', 'veggie', 'cutlery', 'fridge', 'bakery']) g.S.stars[id] = 1; delete g.S.stars.lunch; g.S.rooms = {}; document.querySelectorAll('.ig-screen').forEach(e => e.remove()); g.startLevel(0); g.autoSolve(2); });
  for (let i = 0; i < 80; i++) { const s = await st(); if (s.seq === 0) break; await sim(.1); }
  await sim(.35); const hops = await p.evaluate(() => window.__GAME.G.items.filter(i => i.hop > 0).length); log('hops', hops); check(hops > 0, 'tidy-up wave hops the items');
  for (let i = 0; i < 80; i++) { const s = await st(); if (s.seq === 1) break; await sim(.1); }
  log('solved', await st());
  await sim(.7); await shot('wipe');
  for (let i = 0; i < 40; i++) { const s = await st(); if (s.seq === 2) break; await sim(.1); }
  await sim(1.3); await p.waitForTimeout(300); await shot('reveal');
  await sim(4); await p.waitForTimeout(500); await shot('results'); await sim(3);
  const res = await p.evaluate(() => ({ n: document.querySelectorAll('.ig-results').length, room: document.querySelector('.pf-roomdone')?.innerText || '', info: document.querySelector('.pf-info')?.innerText || '', next: document.querySelector('.ig-results [data-a=again]')?.textContent, stats: document.querySelectorAll('.ig-results .ig-stats > div').length, rooms: window.__GAME.S.rooms }));
  const plays1 = await plays();
  log('results', { res, plays0, plays1 }); check(res.n === 1 && plays1 - plays0 === 1, 'E.results exactly once per round');
  check(/Kitchen/.test(res.room) && res.rooms.kitchen === 1, 'room-complete celebration + bonus'); check(/PF-/.test(res.info) && res.stats === 3, 'share code moved under the 3 stat tiles');
  check(/Next box/.test(res.next), 'results offer the next box');
  check(await p.evaluate(() => window.__said.some(t => /whole Kitchen is tidy/.test(t))), 'room complete read aloud');
  log('code', await p.evaluate(() => window.__GAME.shareCode()));
  // unlocks follow the room order: Kitchen done opens the first Picnic & Treats box
  check(await p.evaluate(() => window.__GAME.isOpen(window.__GAME.LEVELS.findIndex(L => L.id === 'fruit'))), 'finishing a room opens the next room');
  // 10) every box: start state + auto-solved; materials classified; colour-coded boxes tint their outlines
  const n = await p.evaluate(() => window.__GAME.LEVELS.length); const solved = [], sizes = {};
  const doneShots = new Set([7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  for (let li = 1; li < n; li++) {
    await p.evaluate(async li => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.S.oneWrong = li === 8; await window.__GAME.startLevel(li); }, li);
    await sim(.5); sizes[li] = await p.evaluate(() => { const G = window.__GAME.G; return { id: G.L.id, turn: G.cont.turn, minSlot: Math.round(window.__GAME.minSlotPx()), item: Math.round(G.items.reduce((a, _, i) => a + window.__GAME.itemPx(i), 0) / G.items.length) }; });
    await p.waitForTimeout(250); await shot('lv' + li);
    await p.evaluate(() => window.__GAME.autoSolve(6)); await sim(9);
    solved.push(await p.evaluate(() => window.__GAME.G.done));
    if (doneShots.has(li)) { await p.waitForTimeout(300); await shot('lv' + li + '_done'); }
  }
  log('boxes', sizes); check(solved.every(Boolean), 'every box can be completed (auto-solve)');
  const mats = await p.evaluate(() => { const g = window.__GAME, c = {}; for (const L of g.LEVELS) for (const s of L.rows.flat()) { const m = g.MATERIAL(s.split('@')[0]); c[m] = (c[m] || 0) + 1; } return c; }); log('materials', mats);
  check(Object.keys(mats).length >= 6, 'six sound materials in use');
  await p.evaluate(() => { window.__GAME.S.oneWrong = false; });
  // 11) quarter-turned box survives an orientation change mid-level (e.g. a wide drawer stands tall on a phone)
  {
    const other = PORT ? { width: 1000, height: 560 } : { width: 390, height: 844 };
    // pick a box whose best turn differs between the two orientations
    const tA = await p.evaluate(() => window.__GAME.turns()); await p.setViewportSize(other); await p.waitForTimeout(200);
    const tB = await p.evaluate(() => window.__GAME.turns()); await p.setViewportSize(vp); await p.waitForTimeout(200);
    const cands = tA.map((t, i) => t !== tB[i] && i > 0 ? i : -1).filter(i => i >= 0); log('turnPick', { cands });
    let turn0, mid, done;
    for (const tli of cands) {
      await p.evaluate(async li => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); await window.__GAME.startLevel(li); }, tli); await sim(.4);
      turn0 = await p.evaluate(() => window.__GAME.G.cont.turn);
      await p.evaluate(() => { const g = window.__GAME, G = g.G; g.autoSolve(6); G.auto.list = G.auto.list.slice(0, 3); }); await sim(3);
      await p.setViewportSize(other); await p.waitForTimeout(250); await sim(.5);
      mid = await p.evaluate(() => { const G = window.__GAME.G; const off = G.items.filter(i => i.state === 'placed').map(it => { const s = it.slot, q = it.g.position; return Math.hypot(q.x - (s.x + G.cont.g.position.x), q.z - (s.z + G.cont.g.position.z)); }); return { li: G.li, turn: G.cont.turn, placed: G.placed, maxOff: Math.max(...off) }; });
      if (turn0 !== mid.turn) { await p.waitForTimeout(200); await shot('turned'); }
      await p.evaluate(() => window.__GAME.autoSolve(6)); await sim(7); done = await p.evaluate(() => window.__GAME.G.done);
      await p.setViewportSize(vp); await p.waitForTimeout(250); await sim(.3);
      if (turn0 !== mid.turn) break;
    }
    log('turn', { turn0, mid, done }); check(turn0 !== mid.turn && mid.placed === 3 && mid.maxOff < .01 && done, 'box turns with the screen, placed items stay in their slots');
  }
  // 12) share-code replay round trip
  const ok = await p.evaluate(() => window.__GAME.parseCode('PF-003-3210-12')); log('parse', ok); check(ok && ok.li === 0 && ok.order.length === 4, 'share code parses');
  // 13) v1 save migration: old linear unlock (5 boxes open, stars on 4) keeps every box open + stars; junk saves don't crash
  await p.evaluate(() => { localStorage.setItem('inoa.fit', JSON.stringify({ unlocked: 5, stars: { lunch: 3, spice: 2, desk: 1, cutlery: 2, bogus: 3 }, best: { lunch: 9.5, spice: 'x' }, zen: true, oneWrong: false, sel: 3 })); });
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 }); await hooks();
  const mig = await p.evaluate(() => { const g = window.__GAME, open = id => g.isOpen(g.LEVELS.findIndex(L => L.id === id)); return { stars: g.S.stars, best: g.S.best, zen: g.S.zen, open: ['lunch', 'spice', 'desk', 'cutlery', 'fridge', 'veggie', 'pencil'].map(open), closed: ['bakery', 'cafe', 'toys'].map(open), sel: g.S.sel }; });
  log('migration', mig); check(mig.open.every(Boolean) && !mig.closed.some(Boolean) && mig.stars.lunch === 3 && !mig.stars.bogus && mig.best.lunch === 9.5 && mig.best.spice == null && mig.zen, 'v1 save keeps progress, opens new boxes after starred ones');
  await p.evaluate(() => localStorage.setItem('inoa.fit', '"junk"')); await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  check(await p.evaluate(() => Object.keys(window.__GAME.S.stars).length === 0 && !!document.querySelector('.ig-title')), 'junk save starts fresh');
  console.log(fails.length ? 'CHECKS FAILED: ' + fails.join(' | ') : 'ALL CHECKS PASSED');
  if (fails.length) throw new Error('fit checks failed: ' + fails.join(' | '));
};
