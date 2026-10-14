// Junkyard to Jewel headless test: real mouse scrubbing (raycast -> voxel mask), turntable spin, all 4 stages, reveal, slider, results, gallery.
module.exports = async (p, _shot) => {
  const OUT = require('path').join(__dirname, 'out');
  const shot = n => p.screenshot({ path: require('path').join(OUT, 'junk_' + n + '.png'), timeout: 180000 });
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const st = () => p.evaluate(() => { const G = window.__GAME.G; return { vi: G.vi, stage: G.stage, phase: G.phase, prog: G.prog.map(v => +v.toFixed(3)), yaw: +G.yaw.toFixed(2), auto: G.auto }; });
  const log = async (k) => console.log(k, JSON.stringify(await st()));
  const SKIP = process.env.QUICK;
  if (!SKIP) await shot('title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await p.waitForTimeout(300); await sim(.4); await shot('start'); await log('start');
  // spin the turntable by dragging empty floor (top-left corner)
  await p.mouse.move(120, 150); await p.mouse.down(); for (let k = 1; k <= 6; k++) { await p.mouse.move(120 + k * 25, 150); await sim(.03); } await p.mouse.up(); await sim(.3); await log('afterSpin');
  // real pointer scrubbing across the car body
  const scrub = async (passes, holdShot) => {
    const c = await p.evaluate(() => window.__GAME.carScreen());
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await sim(.05);
    for (let pass = 0; pass < passes; pass++) for (let k = 0; k <= 10; k++) { const t = k / 10, dir = pass % 2 ? 1 - t : t; await p.mouse.move(c.x - 110 + dir * 220, c.y - 30 + pass * 14); await sim(.05); }
    if (holdShot) { await p.waitForTimeout(150); await shot(holdShot); }
    await p.mouse.up(); await sim(.2);
  };
  await scrub(4, 'wash'); await log('afterWashDrag');
  // keyboard: hold Space to brush along the sweeping reticle, arrows spin
  await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' })); }); await sim(1.2); await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' })); }); await sim(.2); await log('afterKeyboard');
  const finishStage = async (name) => { for (let i = 0; i < 12; i++) { const s0 = await st(); await p.evaluate(() => window.__GAME.autoScrub(1)); await sim(.3); const s1 = await st(); if (s1.stage !== s0.stage || s1.phase !== 'play') break; } await sim(1); await log('after ' + name); };
  await finishStage('wash');
  await scrub(3, 'sand'); await log('afterSandDrag');
  await finishStage('sand');
  await p.evaluate(() => window.__GAME.setColor(5)); await sim(.2);
  await scrub(3, 'paint'); await log('afterPaintDrag');
  await finishStage('paint');
  await scrub(3, 'polish'); await log('afterPolishDrag');
  await finishStage('polish');
  await sim(2.2); await shot('reveal');
  for (let i = 0; i < 30; i++) { const s = await st(); if (s.phase === 'slider') break; await sim(.2); }
  await sim(.7); await shot('slider'); await log('slider');
  await sim(2.5);
  await p.evaluate(() => document.querySelector('.jk-cta [data-a=go]').click()); await p.waitForTimeout(400); await sim(.3); await shot('results');
  await p.evaluate(() => { document.querySelectorAll('.ig-screen').forEach(e => e.remove()); window.__GAME.gallery(0); }); await sim(1); await shot('gallery');
  await p.evaluate(() => { document.querySelector('.jk-cta [data-a=cmp]').click(); }); await sim(.3); await p.evaluate(() => window.__GAME.G.setSplit(.45)); await p.evaluate(() => { window.__GAME.G.sliderAnim = -1; }); await sim(.2); await shot('gallery_cmp');
  // every vehicle in its junk state
  if (!SKIP) for (let vi = 1; vi < 8; vi++) { await p.evaluate(vi => { document.querySelectorAll('.ig-screen,.jk-cta,.jk-slider,.jk-day').forEach(e => e.remove()); window.__GAME.startVehicle(vi); }, vi); await sim(.4); await shot('v' + vi); }
};
