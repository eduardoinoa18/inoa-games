// Tide Lines headless test: title → intro countdown → full 2:30 match with the player on autopilot → final 10 s → judge sweep → results.
module.exports = async (p, shot) => {
  const pre = Number(process.env.H || 560) > Number(process.env.W || 1000) ? 'p_' : '';
  // own screenshot wrapper with a long timeout: SwiftShader is slow when the machine is shared
  const S = n => p.screenshot({ path: require('path').join(__dirname, 'out', `tidelines_${pre}${n}.png`), timeout: 180000 });
  await S('title');
  const plays = () => p.evaluate(() => { try { return (JSON.parse(localStorage.getItem('inoa.profile')) || {}).games?.tidelines?.plays || 0; } catch (e) { return -1; } });
  const plays0 = await plays();
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; window.__HOLD = true; const f = until ? new Function('G', 'return ' + until) : null; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (f && f(g.G)) { window.__HOLD = false; return i; } if (i % 15 === 0) await new Promise(r => setTimeout(r, 0)); } window.__HOLD = false; return -1; }, { sec, until });
  await sim(1.6); await p.waitForTimeout(300); await S('intro');
  await p.evaluate(() => { window.__GAME.auto = true; });
  await sim(2.2); await sim(12); await p.waitForTimeout(300); await S('play');
  const stat = () => p.evaluate(() => { const g = window.__GAME, G = g.G; return { time: G.time.toFixed(1), pct: g.pct().map(v => v.toFixed(1)), me: { ink: Math.round(G.me.ink), splats: G.me.splats, painted: G.me.painted, alive: G.me.alive }, units: g.units.map(u => `${u.name}:${u.bot.state}:${u.x.toFixed(0)},${u.z.toFixed(0)}:${u.splats}/${u.deaths}`).join(' ') }; });
  console.log('t+14', JSON.stringify(await stat()));
  // close-up of the player's character to check hat / tank / gun attachment (wait for a respawn if the player was just splatted)
  await sim(6, 'G.me.alive && G.me.spawnPop >= 1');
  await p.evaluate(() => { const G = window.__GAME.G, u = G.me; G.paused = true; window.__CAM = { pos: [u.x + Math.sin(u.h + .7) * 4.2, u.y + 2.1, u.z + Math.cos(u.h + .7) * 4.2], look: [u.x, u.y + 1, u.z], fov: innerHeight > innerWidth ? 58 : 42 }; });
  const camN = n => p.evaluate(n => { for (let i = 0; i < n; i++) window.__GAME.updateCamera(1 / 20); }, 12);
  await camN(); await p.waitForTimeout(300); await S('closeup');
  const camInfo = () => p.evaluate(() => { const G = window.__GAME.G, u = G.me, c = window.__GAME.camera; return { dist: +Math.hypot(c.position.x - u.x, c.position.y - u.y - 1.2, c.position.z - u.z).toFixed(2), camY: +c.position.y.toFixed(2), faded: window.__GAME.occluders(), tagsShown: window.__GAME.units.filter(x => x.tag.visible).length }; });
  console.log('closeup (test __CAM, now safe)', JSON.stringify(await camInfo()));
  // worst case: ask for a camera right inside the player and inside a stacked crate → safeCam pushes it out + up
  await p.evaluate(() => { const u = window.__GAME.G.me; window.__CAM = { pos: [u.x + .3, u.y + 1.2, u.z + .2], look: [u.x, u.y + 1, u.z], fov: 42 }; });
  await camN(); const inside = await camInfo(); console.log('cam inside player →', JSON.stringify(inside)); if (inside.dist < 3.1) throw new Error('camera still too close to the player');
  await p.evaluate(() => { window.__CAM = { pos: [9.6, 1.5, 8], look: [9.6, 0, 4], fov: 42 }; });
  await camN(); const crate = await p.evaluate(() => +window.__GAME.camera.position.y.toFixed(2)); console.log('cam inside crate → y', crate); if (crate < 3.2) throw new Error('camera still inside the crate stack');
  await p.evaluate(() => { window.__CAM = null; window.__GAME.closeup(true); });
  await camN(); await p.waitForTimeout(300); await S('closeup2'); console.log('closeup (game hook)', JSON.stringify(await camInfo()));
  await p.evaluate(() => { window.__GAME.closeup(false); window.__GAME.G.paused = false; });
  await sim(60); console.log('t+74', JSON.stringify(await stat())); await p.waitForTimeout(300); await S('mid');
  // jump to the final seconds of the full match
  const left = await p.evaluate(() => window.__GAME.G.time);
  const r = await sim(left - 11); console.log('ran to', JSON.stringify(await stat()));
  await sim(1.5); await p.waitForTimeout(250); await S('final10'); console.log('final10 faded occluders', await p.evaluate(() => window.__GAME.occluders()));
  // palm canopy case: park the player right behind the planter palm nearest the camera, check it fades
  await p.evaluate(() => { const g = window.__GAME, u = g.G.me; g.auto = false; u.x = 15.6; u.z = 12.2; u.vx = u.vz = 0; g.G.camPos.set(15.6 > 14 ? 14 : 15.6, 13.4, 12.2 + 9); });
  await sim(.6); const pf = await p.evaluate(() => window.__GAME.occluders()); console.log('behind palm faded occluders', pf); await p.waitForTimeout(250); await S('palm');
  if (pf < 1) throw new Error('palm in front of the player did not fade');
  await p.evaluate(() => { window.__GAME.auto = true; });
  await sim(12, "G.state === 'judge' && G.judgeT > 1.6"); await p.waitForTimeout(250); await S('judge');
  await sim(4, "G.state === 'done' && G.doneT > 1"); await p.waitForTimeout(250); await S('winner');
  const e = await sim(6, 'G.resultsShown'); console.log('results frame', e, JSON.stringify(await stat()));
  await p.waitForTimeout(800); await S('results');
  const plays1 = await plays(); console.log('plays', plays0, '→', plays1); if (plays1 !== plays0 + 1) throw new Error('results() must grant exactly once');
  await sim(3); if (await plays() !== plays1) throw new Error('results() granted twice');
  // play again works
  await p.evaluate(() => document.querySelector('.ig-results [data-a=again]').click());
  await sim(1); console.log('again', await p.evaluate(() => window.__GAME.G.state));
  // EN/ES: switch language from the title screen's settings panel → title text re-renders in Spanish
  await p.evaluate(() => window.__GAME.title());
  await p.evaluate(() => document.querySelector('.ig-title [data-a=settings]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-k=lang] [data-v=es]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-a=done]').click());
  const es = await p.evaluate(() => document.querySelector('.ig-title').innerText); console.log('ES title ok', /cañón/.test(es) && /Tu pintor/.test(es));
  if (!/cañón/.test(es)) throw new Error('title not localized to Spanish');
  await S('title_es');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=settings]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-k=lang] [data-v=en]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-a=done]').click());
};
