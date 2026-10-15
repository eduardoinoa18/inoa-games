// Tide Lines headless test.
// 1) Sunny Pier · Cover Up: title → intro countdown → full 2:30 match with the player on autopilot → final 10 s → judge sweep → results.
// 2) Rooftop Garden + Island Market · Tide Pools: 70 s of autopilot each (pools must change hands, bots must not get stuck or fall in the canal),
//    a knockout finish on the market, stars, Spanish title.
// TL_QUICK=1 skips the full pier match (faster iteration).
module.exports = async (p, shot) => {
  const pre = Number(process.env.H || 560) > Number(process.env.W || 1000) ? 'p_' : '';
  // own screenshot wrapper with a long timeout: SwiftShader is slow when the machine is shared
  const S = n => p.screenshot({ path: require('path').join(__dirname, 'out', `tidelines_${pre}${n}.png`), timeout: 180000 });
  const quick = !!process.env.TL_QUICK;
  // fresh save: the kid-friendly defaults must apply
  await p.evaluate(() => { localStorage.removeItem('inoa.tidelines'); });
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 60000 }); await p.waitForTimeout(400);
  const def = await p.evaluate(() => ({ skill: window.__GAME.S.skill, map: window.__GAME.map, mode: window.__GAME.S.mode, maps: window.__GAME.maps.join(',') }));
  console.log('defaults', JSON.stringify(def)); if (def.skill !== 'chill') throw new Error('default bots should be Chill (kid-friendly)'); if (def.maps.split(',').length < 3) throw new Error('need 3 arenas');
  await S('title');
  const plays = () => p.evaluate(() => { try { return (JSON.parse(localStorage.getItem('inoa.profile')) || {}).games?.tidelines?.plays || 0; } catch (e) { return -1; } });
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; window.__HOLD = true; const f = until ? new Function('G', 'g', 'return ' + until) : null; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (f && f(g.G, g)) { window.__HOLD = false; return i; } if (i % 15 === 0) await new Promise(r => setTimeout(r, 0)); } window.__HOLD = false; return -1; }, { sec, until });
  const stat = () => p.evaluate(() => { const g = window.__GAME, G = g.G; return { time: G.time.toFixed(1), pct: g.pct().map(v => v.toFixed(1)), pts: G.pts.map(Math.round), me: { ink: Math.round(G.me.ink), splats: G.me.splats, painted: G.me.painted, alive: G.me.alive }, units: g.units.map(u => `${u.name}:${u.bot.state}:${u.x.toFixed(0)},${u.z.toFixed(0)}:${u.splats}/${u.deaths}:u${u.bot.unstuck}`).join(' ') }; });
  // stuck watch: sample every unit every 2 s; a bot that stays within 0.6 m for 6 s while alive (and not refilling on its own colour) is stuck.
  // Also: nobody may stand in water, and coral bots must not camp the teal base.
  const watch = (sec) => p.evaluate(async (sec) => {
    const g = window.__GAME; window.__HOLD = true; const hist = new Map(); let stuck = [], wet = 0, camp = 0, maxStill = 0;
    for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 4 === 0) g.updateCamera(4 / 60);
      if (i % 120 === 0) for (const u of g.units) { if (!u.alive) { hist.delete(u); continue; } const h = hist.get(u) || []; h.push([u.x, u.z]); if (h.length > 4) h.shift(); hist.set(u, h); if (h.length === 4) { const d = Math.max(...h.map(q => Math.hypot(q[0] - h[0][0], q[1] - h[0][1]))); const refilling = u.bot.state === 'refill'; if (d < .6 && !refilling && !u.isPlayer) { stuck.push(`${u.name}@${u.x.toFixed(1)},${u.z.toFixed(1)}:${u.bot.state}`); hist.set(u, []); } } }
      if (i % 30 === 0) for (const u of g.units) { if (!u.alive) continue; if (g.solidAt(u.x, u.z) > 50) wet++; if (u.team === 1 && Math.hypot(u.x, u.z - 16.8) < 3) camp++; }
      if (i % 15 === 0) await new Promise(r => setTimeout(r, 0)); if (g.G.state !== 'play') break; }
    window.__HOLD = false; return { stuck, wet, camp, unstuck: g.units.reduce((a, u) => a + u.bot.unstuck, 0) };
  }, sec);
  const plays0 = await plays();

  if (!quick) {
    await p.evaluate(() => { window.__GAME.setSkill('normal'); document.querySelector('.ig-title [data-a=play]').click(); });
    await sim(1.6); await p.waitForTimeout(300); await S('intro');
    await p.evaluate(() => { window.__GAME.auto = true; });
    await sim(2.2); const w1 = await watch(12); console.log('pier watch 12s', JSON.stringify(w1)); await p.waitForTimeout(300); await S('play');
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
    const w2 = await watch(60); console.log('pier watch 60s', JSON.stringify(w2)); if (w2.camp > 6) throw new Error('coral bots camp the teal base');
    console.log('t+74', JSON.stringify(await stat())); await p.waitForTimeout(300); await S('mid');
    // jump to the final seconds of the full match
    const left = await p.evaluate(() => window.__GAME.G.time);
    await sim(left - 11); console.log('ran to', JSON.stringify(await stat()));
    await sim(1.5); await p.waitForTimeout(250); await S('final10'); console.log('final10 faded occluders', await p.evaluate(() => window.__GAME.occluders()));
    // palm canopy case: park the player right behind the planter palm nearest the camera, check it fades
    await p.evaluate(() => { const g = window.__GAME, u = g.G.me; g.auto = false; u.x = 15.6; u.z = 12.2; u.vx = u.vz = 0; g.G.camPos.set(14, 13.4, 12.2 + 9); });
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
  }

  // ---- new arenas in Tide Pools mode: pick them on the title card like a player would
  for (const [map, idx] of [['roof', 1], ['market', 2]]) {
    await p.evaluate(() => window.__GAME.title());
    await p.evaluate(({ map }) => { document.querySelector(`.ig-title #pO [data-o=pools]`).click(); document.querySelector(`.ig-title #pM [data-m=${map}]`).click(); }, { map });
    await sim(.2); await p.waitForTimeout(300); await S(`title_${map}`);
    const info = await p.evaluate(() => ({ map: window.__GAME.map, zones: window.__GAME.zones(), paintable: window.__GAME.paintable() }));
    console.log(map, 'layout', JSON.stringify(info)); if (info.map !== map) throw new Error('map picker did not switch arena'); if (info.zones.some(z => z.cells < 30)) throw new Error('a pool has too few paintable cells');
    await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
    await sim(3.6); await p.evaluate(() => { window.__GAME.auto = true; });
    const w = await watch(35); console.log(map, 'watch 35s', JSON.stringify(w), JSON.stringify(await p.evaluate(() => window.__GAME.zones())));
    await p.waitForTimeout(250); await S(`play_${map}`);
    const w2 = await watch(35); const st = await stat(); console.log(map, 'watch 70s', JSON.stringify(w2), JSON.stringify(st), 'flips', await p.evaluate(() => window.__GAME.G.flips));
    if (w.wet + w2.wet) throw new Error('a painter walked into water');
    if (w.stuck.length + w2.stuck.length > 2) throw new Error('bots stuck: ' + w.stuck.concat(w2.stuck).join(' '));
    const fl = await p.evaluate(() => window.__GAME.G.flips); if (fl < 3) throw new Error('pools never changed hands');
    if (st.pts[0] + st.pts[1] < 30) throw new Error('no pool points scored');
    // overview shot of the arena
    await p.evaluate(() => { window.__GAME.G.paused = true; window.__CAM = { pos: [0, 30, 26], look: [0, 0, -1], fov: innerHeight > innerWidth ? 70 : 50, free: true }; });
    await p.evaluate(() => { for (let i = 0; i < 4; i++) window.__GAME.updateCamera(1 / 20); }); await p.waitForTimeout(250); await S(`over_${map}`);
    await p.evaluate(() => { window.__CAM = null; window.__GAME.G.paused = false; });
    if (map === 'market') {
      // knockout: teal reaches the goal → the match ends early, judge shows points, a star is earned on a win
      await p.evaluate(() => { const G = window.__GAME.G; G.pts[0] = 180; G.pts[1] = Math.min(G.pts[1], 120); });
      await sim(2, 'G.knockout'); const ko = await p.evaluate(() => ({ ko: !!window.__GAME.G.knockout, state: window.__GAME.G.state })); console.log('knockout', JSON.stringify(ko)); if (!ko.ko) throw new Error('no knockout at the pool goal');
      await sim(6, "G.state === 'done' && G.doneT > .6"); await p.waitForTimeout(250); await S('judge_pools');
      const pl = await plays(); await sim(4, 'G.resultsShown'); await p.waitForTimeout(800); await S('results_pools');
      if (await plays() !== pl + 1) throw new Error('pools results() must grant once');
      const star = await p.evaluate(() => window.__GAME.S.stars['market:pools']); console.log('stars market:pools', star); if (!(star >= 1)) throw new Error('win did not award a star');
    } else { await p.evaluate(() => { window.__GAME.G.time = .05; }); await sim(9, 'G.resultsShown'); await p.waitForTimeout(500); await S(`results_${map}`); }
  }

  // EN/ES: switch language from the title screen's settings panel → title text re-renders in Spanish
  await p.evaluate(() => window.__GAME.title());
  await p.evaluate(() => document.querySelector('.ig-title [data-a=settings]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-k=lang] [data-v=es]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-a=done]').click());
  const es = await p.evaluate(() => document.querySelector('.ig-title').innerText); console.log('ES title ok', /cañón/.test(es) && /Tu pintor/.test(es) && /Pozas de Marea/.test(es) && /Mercado de la Isla/.test(es));
  if (!/cañón/.test(es) || !/Pozas de Marea/.test(es) || !/Azotea/.test(es)) throw new Error('title not localized to Spanish');
  await S('title_es');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=settings]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-k=lang] [data-v=en]').click());
  await p.evaluate(() => document.querySelector('.ig-settings [data-a=done]').click());
  // leave the pier selected for the next run / party tests
  await p.evaluate(() => { window.__GAME.S.map = 'pier'; window.__GAME.S.mode = 'turf'; });
};
