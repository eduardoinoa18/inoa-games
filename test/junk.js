// Junkyard to Jewel headless test: real mouse scrubbing (raycast -> voxel mask), brush precision (paint lands under the pointer),
// fast strokes, touch-style pointer events, pointercancel mid-stroke, brushing after a resize, turntable spin, keyboard + gamepad,
// EN/ES, E.say, all 4 stages, reveal, slider, results exactly once, gallery, every vehicle.
// Screenshots: test/out/junk_<name>.png (landscape) / junk_<name>_p.png (portrait).
const path = require('path');
module.exports = async (p, _shot) => {
  const vp = p.viewportSize(); const SUF = vp.height > vp.width ? '_p' : '';
  const shot = n => p.screenshot({ path: path.join(__dirname, 'out', 'junk_' + n + SUF + '.png'), timeout: 180000 });
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const st = () => p.evaluate(() => { const G = window.__GAME.G; return { vi: G.vi, stage: G.stage, phase: G.phase, prog: G.prog.map(v => +v.toFixed(3)), yaw: +G.yaw.toFixed(2), auto: G.auto, paused: G.paused }; });
  const log = async (k) => console.log(k, JSON.stringify(await st()));
  const out = (k, v) => console.log(k, JSON.stringify(v));
  const fails = []; const check = (ok, msg) => { if (!ok) { fails.push(msg); console.log('FAIL', msg); } };
  const touch = async (type, x, y, id = 9) => p.evaluate(({ type, x, y, id }) => { document.getElementById('gl').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 })); }, { type, x, y, id });
  const maskAt = (x, y, ch = 0) => p.evaluate(({ x, y, ch }) => window.__GAME.maskAt(x, y, ch), { x, y, ch });
  // points on the car body: scan a grid inside the car's screen rect, keep the ones the pointer ray actually hits
  const carPoints = () => p.evaluate(() => { const g = window.__GAME, r = g.carRectPx(); const pts = []; for (let j = 1; j < 8; j++) for (let i = 1; i < 10; i++) { const x = r.x0 + (r.x1 - r.x0) * i / 10, y = r.y0 + (r.y1 - r.y0) * j / 8; if (g.hitScreen(x, y)) pts.push({ x: Math.round(x), y: Math.round(y) }); } return pts; });
  const SKIP = process.env.QUICK;
  await p.evaluate(() => { window.__said = []; try { const pr = JSON.parse(localStorage.getItem('inoa.profile') || '{}'); pr.voice = true; pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); } catch (e) { } if (window.speechSynthesis) speechSynthesis.speak = u => window.__said.push(u.text); });
  const plays = () => p.evaluate(() => { try { const g = JSON.parse(localStorage.getItem('inoa.profile')).games.junk; return g ? g.plays : 0; } catch (e) { return 0; } });
  if (!SKIP) await shot('title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await p.waitForTimeout(500); await sim(.6); await shot('start'); await log('start');
  const rect = await p.evaluate(() => window.__GAME.carRectPx()); out('carRect', { ...rect, wFrac: +((rect.x1 - rect.x0) / rect.vw).toFixed(2), hFrac: +((rect.y1 - rect.y0) / rect.vh).toFixed(2) });
  if (SUF) check((rect.x1 - rect.x0) / rect.vw > .6, 'portrait: car fills most of the width');
  check(await p.evaluate(() => window.__said.some(t => /Spray off all the dirt/.test(t))), 'stage instruction read aloud');
  // spin the turntable by dragging empty floor (top-left corner)
  { const y0 = Math.min(150, rect.y0 - 20); const s0 = await st(); await p.mouse.move(40, y0); await p.mouse.down(); for (let k = 1; k <= 6; k++) { await p.mouse.move(40 + k * 25, y0); await sim(.03); } const br = await p.evaluate(() => window.__GAME.brushing()); await p.mouse.up(); await sim(.6); const s1 = await st(); out('spin', { y0, br, yaw0: s0.yaw, yaw1: s1.yaw }); check(!br && s1.yaw !== s0.yaw, 'dragging the floor spins, never brushes'); await p.evaluate(() => { window.__GAME.G.yawV = 0; }); await sim(.2); }
  // 1) precision: a single dab paints the voxel under the pointer, and not a far-away spot
  {
    const pts = await carPoints(); out('carPoints', pts.length); check(pts.length > 12, 'car hit points found');
    const a = pts[Math.floor(pts.length / 2)]; const far = pts.reduce((b, q) => Math.hypot(q.x - a.x, q.y - a.y) > Math.hypot(b.x - a.x, b.y - a.y) ? q : b, a);
    const before = [await maskAt(a.x, a.y), await maskAt(far.x, far.y)];
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await sim(.25); const hs = await p.evaluate(({ x, y }) => window.__GAME.hitScreen(x, y), a); await p.mouse.up(); await sim(.05);
    const after = [await maskAt(a.x, a.y), await maskAt(far.x, far.y)]; out('dab', { a, far, before, after, hs });
    check(after[0] > before[0] + 40 && after[1] === before[1], 'dab paints exactly under the pointer only');
    check(hs && Math.hypot(hs.x - a.x, hs.y - a.y) < 1.5, 'brush hit point == pointer on screen');
  }
  // 2) fast stroke: one jump between two far points in a single frame still paints the path in between
  {
    const pts = await carPoints(); const row = pts.filter(q => Math.abs(q.y - pts[Math.floor(pts.length / 2)].y) < 2); const L = row[0], Rr = row[row.length - 1]; const mids = row.slice(1, -1);
    const b0 = await Promise.all(mids.map(q => maskAt(q.x, q.y)));
    await p.mouse.move(L.x, L.y); await p.mouse.down(); await sim(1 / 60); await p.mouse.move(Rr.x, Rr.y); await sim(1 / 60); await p.mouse.up(); await sim(.05);
    const b1 = await Promise.all(mids.map(q => maskAt(q.x, q.y))); out('fastStroke', { L, Rr, b0, b1 });
    check(mids.length > 0 && b1.every((v, i) => v > b0[i] || v === 255), 'fast stroke fills the path between frames');
  }
  // 3) touch: pointercancel mid-stroke stops painting immediately (later moves paint nothing)
  {
    const pts = await carPoints(); const a = pts[1], b = pts[pts.length - 2];
    await touch('pointerdown', a.x, a.y); await sim(.1); const brA = await p.evaluate(() => window.__GAME.brushing());
    await touch('pointercancel', a.x, a.y); const vb = await maskAt(b.x, b.y); await touch('pointermove', b.x, b.y); await sim(.3); const va = await maskAt(b.x, b.y); const brB = await p.evaluate(() => window.__GAME.brushing());
    out('cancel', { brA, brB, vb, va }); check(brA && !brB && va === vb, 'pointercancel ends the stroke, nothing painted after');
  }
  // 4) resize mid-game, then a touch scrub: paint still lands under the finger
  {
    await p.setViewportSize({ width: vp.width + 30, height: vp.height + 20 }); await p.waitForTimeout(250); await sim(1.2);
    const pts = await carPoints(); let a = pts[Math.floor(pts.length / 3)]; for (const q of pts) if (await maskAt(q.x, q.y) === 0) { a = q; break; } const v0 = await maskAt(a.x, a.y);
    await touch('pointerdown', a.x, a.y); await sim(.25); await touch('pointerup', a.x, a.y); await sim(.05); const v1 = await maskAt(a.x, a.y);
    out('resizeTouch', { a, v0, v1 }); check(v1 > v0 + 40, 'touch brushing after resize lands under the finger');
    await p.setViewportSize(vp); await p.waitForTimeout(250); await sim(1.2);
  }
  // real pointer scrubbing across the car body
  const scrub = async (passes, holdShot) => {
    const c = await p.evaluate(() => window.__GAME.carScreen()); const r = await p.evaluate(() => window.__GAME.carRectPx()); const half = (r.x1 - r.x0) * .35;
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await sim(.05);
    for (let pass = 0; pass < passes; pass++) for (let k = 0; k <= 10; k++) { const t = k / 10, dir = pass % 2 ? 1 - t : t; await p.mouse.move(c.x - half + dir * half * 2, c.y - 30 + pass * 14); await sim(.05); }
    if (holdShot) { await p.waitForTimeout(150); await shot(holdShot); }
    await p.mouse.up(); await sim(.2);
  };
  await scrub(4, 'wash'); await log('afterWashDrag');
  // keyboard: hold Space to brush along the sweeping reticle, arrows spin
  { const s0 = await st(); await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' })); }); await sim(1.2); await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' })); }); await sim(.2); const s1 = await st(); await log('afterKeyboard');
    check(s1.prog[0] > s0.prog[0] && s1.yaw !== s0.yaw, 'keyboard brushes + spins'); check(await p.evaluate(() => window.__said.some(t => /Keep holding to work/.test(t))), 'keyboard/pad controls read aloud'); }
  // gamepad: A brushes, D-pad right spins, Start pauses
  {
    const r = await p.evaluate(() => { const g = window.__GAME, G = g.G; const pad = { id: 'test pad', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; navigator.getGamepads = () => [pad];
      const p0 = g.progress(0), y0 = G.yaw; pad.buttons[0].pressed = true; pad.buttons[15].pressed = true; for (let i = 0; i < 70; i++) g.update(1 / 60); pad.buttons[0].pressed = false; pad.buttons[15].pressed = false; for (let i = 0; i < 5; i++) g.update(1 / 60);
      const p1 = g.progress(0), y1 = G.yaw; pad.buttons[9].pressed = true; g.update(1 / 60); pad.buttons[9].pressed = false; const paused = G.paused; navigator.getGamepads = () => []; return { p0, p1, y0, y1, paused }; });
    out('pad', r); check(r.p1 > r.p0 && r.y1 !== r.y0 && r.paused, 'gamepad brushes, spins and pauses');
    await p.waitForTimeout(100); await shot('pause'); await p.evaluate(() => document.querySelector('.ig-screen [data-a=resume]').click()); await sim(.2);
  }
  const finishStage = async (name) => { for (let i = 0; i < 12; i++) { const s0 = await st(); await p.evaluate(() => window.__GAME.autoScrub(1)); await sim(.3); const s1 = await st(); if (s1.stage !== s0.stage || s1.phase !== 'play') break; } await sim(1); await log('after ' + name); };
  await finishStage('wash');
  await scrub(3, 'sand'); await log('afterSandDrag');
  await finishStage('sand');
  await p.evaluate(() => window.__GAME.setColor(5)); await sim(.6);
  await scrub(3, 'paint'); await log('afterPaintDrag');
  await finishStage('paint'); await shot('paint_done');
  await scrub(3, 'polish'); await log('afterPolishDrag');
  const plays0 = await plays();
  await finishStage('polish');
  await sim(2.2); await shot('reveal');
  for (let i = 0; i < 30; i++) { const s = await st(); if (s.phase === 'slider') break; await sim(.2); }
  await sim(.7); await shot('slider'); await log('slider');
  await sim(2.5);
  await p.evaluate(() => { const b = document.querySelector('.jk-cta [data-a=go]'); b.click(); b.click(); }); await p.waitForTimeout(400); await sim(.3); await shot('results');
  { const n = await p.evaluate(() => document.querySelectorAll('.ig-results').length), plays1 = await plays(); out('results', { n, plays0, plays1 }); check(n === 1 && plays1 - plays0 === 1, 'E.results exactly once per round'); }
  await p.evaluate(() => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.gallery(0); }); await sim(1); await shot('gallery');
  await p.evaluate(() => { document.querySelector('.jk-cta [data-a=cmp]').click(); }); await sim(.3); await p.evaluate(() => window.__GAME.G.setSplit(.45)); await p.evaluate(() => { window.__GAME.G.sliderAnim = -1; }); await sim(.2); await shot('gallery_cmp');
  // Spanish
  { const es = await p.evaluate(() => { document.querySelectorAll('.jk-cta,.jk-slider,.jk-day').forEach(e => e.remove()); const pr = JSON.parse(localStorage.getItem('inoa.profile')); pr.lang = 'es'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); window.__GAME.title(); return document.querySelector('.ig-title').innerText; });
    await sim(.3); await shot('title_es'); check(/Elige una chatarra/i.test(es) && /Pequeño Hatch/.test(es), 'Spanish menu text');
    await p.evaluate(() => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.startVehicle(0); }); await sim(.5); const hud = await p.evaluate(() => document.getElementById('igHud').innerText + ' | ' + document.getElementById('steps').innerText); out('esHud', hud); check(/Lavado a presión/.test(hud), 'Spanish step names');
    await shot('start_es');
    await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem('inoa.profile')); pr.lang = 'en'; localStorage.setItem('inoa.profile', JSON.stringify(pr)); }); }
  // every vehicle in its junk state
  if (!SKIP) for (let vi = 1; vi < 8; vi++) { await p.evaluate(vi => { document.querySelectorAll('.ig-screen,.jk-cta,.jk-slider,.jk-day').forEach(e => e.remove()); window.__GAME.startVehicle(vi); }, vi); await sim(.6); await shot('v' + vi); }
  console.log(fails.length ? 'CHECKS FAILED: ' + fails.join(' | ') : 'ALL CHECKS PASSED');
  if (fails.length) throw new Error('junk checks failed: ' + fails.join(' | '));
};
