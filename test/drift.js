// Island Drift: title → Grand Prix (full race to results) → time trial (ghost saved, then raced) → Island Cup (4 races, standings, results)
// plus a look at every track, the snowy bridge and a drift. Run: node test/run.js drift test/drift.js  (W=390 H=844 for portrait)
module.exports = async (p, shot) => {
  const sim = async (sec, keys = {}) => p.evaluate(async ({ sec, keys }) => { const g = window.__GAME; for (const k in keys) dispatchEvent(new KeyboardEvent(keys[k] ? 'keydown' : 'keyup', { code: k })); for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, { sec, keys });
  const settle = async () => { await p.evaluate(() => { for (let i = 0; i < 90; i++) window.__GAME.updateCamera(1 / 60); }); await p.waitForTimeout(500); };
  const click = sel => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) throw new Error('missing ' + sel); b.click(); }, sel);
  const auto = async (maxSec) => p.evaluate(async (maxSec) => { const g = window.__GAME; window.__AUTOPILOT = true; for (let i = 0; i < 60 * maxSec && !g.G.done; i++) { g.update(1 / 60); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } window.__AUTOPILOT = false; const G = g.G; return { done: G.done, lap: G.me.lap, place: G.place, t: G.raceT.toFixed(1), laps: G.karts.map(k => k.lap), stuck: G.karts.filter(k => Math.abs(k.v) < 3).length }; }, maxSec);
  // put every kart on its last lap just before the line so a cup race finishes fast (the race logic itself still runs)
  const lastLap = () => p.evaluate(() => { const G = window.__GAME.G; G.karts.forEach((k, i) => { k.lap = 2; k.half = true; const idx = 780 - i * 6; const pt = window.__GAME.pts[idx]; k.idx = idx; k.x = pt.x; k.z = pt.z; k.y = pt.y; k.v = 30; }); });

  await shot('title');
  const fits = await p.evaluate(() => { const c = document.querySelector('.ig-title .ig-card').getBoundingClientRect(); return { top: Math.round(c.top), bottom: Math.round(c.bottom), h: innerHeight, scroll: document.querySelector('.ig-title').scrollHeight > innerHeight + 1 }; });
  console.log('title card', JSON.stringify(fits));

  // ---- Grand Prix on Sunset Coast (Easy, the default) ----
  await click('#pM [data-m=gp]'); await click('#pT [data-i="0"]'); await click('.ig-title [data-a=play]'); await p.waitForTimeout(400);
  await sim(1); await settle(); await shot('grid');
  await sim(6); await settle(); await shot('race');
  await sim(1.5, { ShiftLeft: true, KeyA: true }); await p.evaluate(() => { for (let i = 0; i < 20; i++) window.__GAME.updateCamera(1 / 60); }); await p.waitForTimeout(400); await shot('drift');
  const inFrame = await p.evaluate(() => { const { G, R } = window.__GAME; const v = new window.__GAME.THREE.Vector3(G.me.x, G.me.y + 1, G.me.z).project(R.camera); return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), drifting: !!G.me.drift }; });
  console.log('kart on screen while drifting (NDC)', JSON.stringify(inFrame));
  await sim(.1, { ShiftLeft: false, KeyA: false });
  console.log('gp', JSON.stringify(await auto(240)));
  await p.waitForTimeout(2500); await shot('results');

  // ---- Time trial on Frosty Peaks: first run saves a ghost, second run races it ----
  await click('.ig-results [data-a=again]'); await p.waitForTimeout(300);
  await click('#pM [data-m=tt]'); await click('#pT [data-i="3"]'); await click('.ig-title [data-a=play]'); await p.waitForTimeout(300);
  console.log('tt', JSON.stringify(await auto(240)));
  const ghost = await p.evaluate(() => { try { const g = JSON.parse(localStorage.getItem('inoa.drift.ghost.frost')); return g ? { t: g.t, samples: g.s.length } : null; } catch (e) { return 'ERR'; } });
  console.log('ghost saved', JSON.stringify(ghost));
  await p.waitForTimeout(2200); await shot('tt_results');
  await click('.ig-results [data-a=again]'); await p.waitForTimeout(300); await click('.ig-title [data-a=play]'); await p.waitForTimeout(300);
  await p.evaluate(async () => { const g = window.__GAME; window.__AUTOPILOT = true; for (let i = 0; i < 60 * 300 && !(g.G.me.lap >= 1 && g.G.raceT - g.G.me.lapStart > 6); i++) { g.update(1 / 60); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } window.__AUTOPILOT = false; });
  const gv = await p.evaluate(() => { const G = window.__GAME.G; return { hasGhost: !!G.ghost, visible: !!(G.ghost && G.ghost.m.visible), dist: G.ghost ? +Math.hypot(G.ghost.m.position.x - G.me.x, G.ghost.m.position.z - G.me.z).toFixed(1) : null }; });
  console.log('ghost race', JSON.stringify(gv)); await settle(); await shot('ghost');
  // the bridge: park the camera beside the overpass
  await p.evaluate(() => { const g = window.__GAME, G = g.G; const i = g.bridge.findIndex(x => x) + 18; const pt = g.pts[i]; const k = G.me; k.x = pt.x; k.z = pt.z; k.y = pt.y; k.idx = i; const t = g.pts[(i + 1) % 800]; k.h = Math.atan2(t.x - pt.x, t.z - pt.z); k.v = 0; k.g.position.set(pt.x, pt.y, pt.z); k.g.rotation.y = k.h; G.paused = true;
    window.__CAMHOLD = true; const tx = t.x - pt.x, tz = t.z - pt.z, tl = Math.hypot(tx, tz); g.R.camera.position.set(pt.x - tz / tl * 42 + tx / tl * 12, 4, pt.z + tx / tl * 42 + tz / tl * 12); g.R.camera.lookAt(pt.x, pt.y * .45, pt.z); g.R.camera.updateMatrixWorld(); g.R.render(0); });
  await p.waitForTimeout(800); await p.evaluate(() => window.__GAME.R.render(0)); await shot('bridge');
  await p.evaluate(() => { window.__CAMHOLD = false; window.__GAME.G.paused = false; });

  // ---- every track at the start grid ----
  for (const ti of [1, 2]) { await p.evaluate(ti => { const g = window.__GAME; document.querySelectorAll('.ig-screen').forEach(e => e.remove()); g.S.mode = 'gp'; g.S.track = ti; g.startRace(); }, ti); await sim(5); await settle(); await shot('track' + ti); }

  // ---- Island Cup: 4 races, standings after each, results at the end ----
  await p.evaluate(() => { const g = window.__GAME; document.querySelectorAll('.ig-screen,.ig-results').forEach(e => e.remove()); g.title(); });
  await click('#pM [data-m=cup]'); await click('.ig-title [data-a=play]'); await p.waitForTimeout(300);
  for (let r = 0; r < 4; r++) {
    await sim(4); await lastLap(); const res = await auto(40);
    const tr = await p.evaluate(() => window.__GAME.G.T.id);
    await p.waitForTimeout(2000);
    const st = await p.evaluate(() => [...document.querySelectorAll('.dr-cup tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')).join(' | '));
    console.log('cup race', r + 1, tr, JSON.stringify(res), '::', st);
    if (r === 0 || r === 3) await shot('cup' + (r + 1));
    await click('.ig-cup [data-a=next]'); await p.waitForTimeout(300);
  }
  await p.waitForTimeout(600); await shot('cup_results');
  console.log('cup results', await p.evaluate(() => document.querySelector('.ig-results h2')?.textContent + ' / ' + [...document.querySelectorAll('.ig-results .ig-stats div')].map(d => d.innerText.replace(/\s+/g, ' ')).join(', ')));
  console.log('profile drift', await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('inoa.profile')).games.drift)));
};
