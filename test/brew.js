// Brew and Bloom: full loop headless — title, plant, fast-forward growth, harvest, guests, brew (drag), serve x5 → results, decor, time of day.
module.exports = async (p, _shot) => {
  // own screenshot helper: generous timeout (software GL on a shared box) and render loop paused between shots
  const shot = async (name) => { await p.addStyleTag({ content: '*{animation-duration:0s!important;transition-duration:0s!important}' }).catch(() => { }); await p.evaluate(() => { window.__GAME?.frame?.(); window.__NORENDER = false; }); await p.waitForTimeout(250); await p.screenshot({ path: `${require('path').join(__dirname,'out')}/brew_${name}.png`, timeout: 300000 }); await p.evaluate(() => { window.__NORENDER = true; }); };
  const sim = async (sec) => p.evaluate(async (sec) => { const g = window.__GAME; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, sec);
  const W = p.viewportSize().width, H = p.viewportSize().height, tag = W < H ? 'p_' : '';
  // fresh save each run
  await p.evaluate(() => { localStorage.removeItem('inoa.brew'); });
  await p.reload({ timeout: 300000 }); for (let i = 0; i < 400; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => window.__READY === true)) break; }
  await p.evaluate(() => window.__GAME.setHour(12.5));
  await p.waitForTimeout(400); await shot(tag + 'title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await sim(.5);
  // plant 3 pots via the real UI (tap label → seed card)
  for (const [i, seed] of [[0, 'mint'], [1, 'cham'], [2, 'mint']]) {
    await p.evaluate(() => window.__GAME.update(1 / 60));
    const ok = await p.evaluate(({ i, seed }) => { const labs = document.querySelectorAll('.bb-lab:not(.ing)'); labs[i].click(); const b = document.querySelector(`.bb-sheet [data-s=${seed}]`); if (!b) return false; b.click(); return true; }, { i, seed });
    console.log('plant', i, seed, ok);
  }
  await sim(1); await p.waitForTimeout(300); await shot(tag + 'planted');
  await p.evaluate(() => window.__GAME.ff(70)); await sim(.3); await p.waitForTimeout(300); await shot(tag + 'growing');
  await p.evaluate(() => window.__GAME.ff(400)); await sim(2);
  await p.evaluate(() => window.__GAME.tend()); await sim(1.5);
  const inv = await p.evaluate(() => JSON.stringify(window.__GAME.S.inv)); console.log('inv after tend', inv);
  // guests arrive
  await sim(14); await p.waitForTimeout(300); await shot(tag + 'guests');
  const st = await p.evaluate(() => window.__GAME.G.custs.map(c => `${c.def.name}:${c.state}:${c.recipe?.name}`).join(', ')); console.log('custs', st);
  // brew with a real drag for the first order
  await p.evaluate(() => window.__GAME.openBrew()); await sim(1.2); await p.waitForTimeout(300); await shot(tag + 'brew');
  const need = await p.evaluate(() => window.__GAME.G.brew && window.__GAME.G.brew.recipe.need);
  console.log('need', need);
  if (need) {
    const pos = await p.evaluate((id) => { const g = window.__GAME.G; return null; }, need[0]);
    // drag first ingredient using screen coords from the label positions
    const xy = await p.evaluate((id) => { const i = ['mint', 'cham', 'lav', 'moon', 'honey', 'lemon'].indexOf(id); const lab = document.querySelectorAll('.bb-lab.ing')[i]; const m = lab.style.transform.match(/translate\(([\d.]+)px,\s*([\d.]+)px\)/); return [+m[1], +m[2] - 25]; }, need[0]);
    const pot = await p.evaluate(() => { const E = window.__GAME; return null; });
    await p.mouse.move(xy[0], xy[1]); await p.mouse.down(); await sim(.05);
    // teapot screen pos: just above the slot row centre
    const tp = await p.evaluate(() => { const l = document.querySelectorAll('.bb-lab.ing'); const a = l[2].style.transform.match(/translate\(([\d.]+)px,\s*([\d.]+)px\)/), b = l[3].style.transform.match(/translate\(([\d.]+)px,\s*([\d.]+)px\)/); return [(+a[1] + +b[1]) / 2, +a[2] - 110]; });
    for (let k = 1; k <= 8; k++) { await p.mouse.move(xy[0] + (tp[0] - xy[0]) * k / 8, xy[1] + (tp[1] - xy[1]) * k / 8); await sim(.03); }
    await shot(tag + 'drag');
    await p.mouse.up(); await sim(.8);
    console.log('added after drag', await p.evaluate(() => window.__GAME.G.brew ? window.__GAME.G.brew.added.join(',') : 'done'));
    for (const id of need.slice(1)) await p.evaluate((id) => window.__GAME.addIngredient(id), id), await sim(.6);
    await sim(.6); await p.waitForTimeout(200); await shot(tag + 'brewed');
    await sim(2.5);
  }
  await p.waitForTimeout(300); await shot(tag + 'served');
  // serve until session results
  const r = await p.evaluate(async () => { const g = window.__GAME; let n = 0; for (let i = 0; i < 60 * 200 && !document.querySelector('.ig-results'); i++) { if (i % 30 === 0 && !g.G.brew && g.G.mode === 'cafe' && !g.G.modal) { if (g.autoServe()) n++; } g.update(1 / 60); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return { n, served: g.S.served, coins: g.S.coins, hearts: g.S.hearts, res: !!document.querySelector('.ig-results') }; });
  console.log('session', JSON.stringify(r));
  await p.waitForTimeout(2200); await shot(tag + 'results');
  await p.evaluate(() => document.querySelector('.ig-results [data-a=again]')?.click()); await sim(.5);
  // decor
  await p.evaluate(() => { window.__GAME.S.coins += 200; });
  const placed = await p.evaluate(() => { const g = window.__GAME; return [g.placeDecor('rug', 1.5, 4), g.placeDecor('lamp', -5.5, 4.5), g.placeDecor('plant', 5.5, .5), g.placeDecor('table', 0, 4.5), g.placeDecor('shelf', -1, .5)]; });
  console.log('decor placed', placed);
  await p.evaluate(() => { const g = window.__GAME; g.openDecor(); document.querySelector('.bb-sheet [data-d=lamp]').click(); }); await sim(1.2); await p.waitForTimeout(300); await shot(tag + 'decor');
  await p.evaluate(() => { document.querySelector('.bb-sheet [data-d="wall-blush"]').click(); window.__GAME.closeDecor(); }); await sim(1.5);
  await p.evaluate(() => window.__GAME.setHour(17)); await sim(4); await p.waitForTimeout(300); await shot(tag + 'golden');
  await p.evaluate(() => window.__GAME.setHour(22.5)); await sim(4); await p.waitForTimeout(300); await shot(tag + 'night');
  await p.evaluate(() => window.__GAME.setHour(8.5)); await sim(2); await p.evaluate(() => { const g = window.__GAME; g.cam.az = -.5; g.cam.zoom = .6; }); await sim(2); await p.waitForTimeout(300); await shot(tag + 'morning_close');
  // offline progress: pretend we left 2 hours ago with a growing pot
  await p.evaluate(() => { const g = window.__GAME; g.plant(0, 'lav'); g.S.lastSeen = Date.now() - 2 * 3600e3; localStorage.setItem('inoa.brew', JSON.stringify(Object.assign({}, g.S, { lastSeen: Date.now() - 2 * 3600e3 }))); });
  await p.reload({ timeout: 300000 }); for (let i = 0; i < 400; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => window.__READY === true)) break; }
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click()); await sim(.3);
  await p.evaluate(() => { document.querySelector('.bb-away [data-a=ok]')?.click(); const g = window.__GAME; g.S.lastSeen = Date.now() - 2 * 3600e3; g.away(); }); await sim(.3); await p.waitForTimeout(400); await shot(tag + 'away');
  console.log('after reload decor', await p.evaluate(() => window.__GAME.S.decor.length), 'wall', await p.evaluate(() => window.__GAME.S.wall));
};
