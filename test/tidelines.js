// Tide Lines headless test: title → intro countdown → full 2:30 match with the player on autopilot → final 10 s → judge sweep → results.
module.exports = async (p, shot) => {
  const pre = Number(process.env.H || 560) > Number(process.env.W || 1000) ? 'p_' : '';
  // own screenshot wrapper with a long timeout: SwiftShader is slow when the machine is shared
  const S = n => p.screenshot({ path: require('path').join(__dirname, 'out', `tidelines_${pre}${n}.png`), timeout: 180000 });
  await S('title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; window.__HOLD = true; const f = until ? new Function('G', 'return ' + until) : null; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (f && f(g.G)) { window.__HOLD = false; return i; } if (i % 15 === 0) await new Promise(r => setTimeout(r, 0)); } window.__HOLD = false; return -1; }, { sec, until });
  await sim(1.6); await p.waitForTimeout(300); await S('intro');
  await p.evaluate(() => { window.__GAME.auto = true; });
  await sim(2.2); await sim(12); await p.waitForTimeout(300); await S('play');
  const stat = () => p.evaluate(() => { const g = window.__GAME, G = g.G; return { time: G.time.toFixed(1), pct: g.pct().map(v => v.toFixed(1)), me: { ink: Math.round(G.me.ink), splats: G.me.splats, painted: G.me.painted, alive: G.me.alive }, units: g.units.map(u => `${u.name}:${u.bot.state}:${u.x.toFixed(0)},${u.z.toFixed(0)}:${u.splats}/${u.deaths}`).join(' ') }; });
  console.log('t+14', JSON.stringify(await stat()));
  // close-up of the player's character to check hat / tank / gun attachment
  await p.evaluate(() => { const G = window.__GAME.G, u = G.me; G.paused = true; window.__CAM = { pos: [u.x + Math.sin(u.h + .7) * 4.2, u.y + 2.1, u.z + Math.cos(u.h + .7) * 4.2], look: [u.x, u.y + 1, u.z], fov: 42 }; });
  await p.waitForTimeout(500); await S('closeup');
  await p.evaluate(() => { window.__GAME.G.paused = false; window.__CAM = null; });
  await sim(60); console.log('t+74', JSON.stringify(await stat())); await p.waitForTimeout(300); await S('mid');
  // jump to the final seconds of the full match
  const left = await p.evaluate(() => window.__GAME.G.time);
  const r = await sim(left - 11); console.log('ran to', JSON.stringify(await stat()));
  await sim(1.5); await p.waitForTimeout(250); await S('final10');
  await sim(12, "G.state === 'judge' && G.judgeT > 1.6"); await p.waitForTimeout(250); await S('judge');
  await sim(4, "G.state === 'done' && G.doneT > 1"); await p.waitForTimeout(250); await S('winner');
  const e = await sim(6, 'G.resultsShown'); console.log('results frame', e, JSON.stringify(await stat()));
  await p.waitForTimeout(800); await S('results');
  // play again works
  await p.evaluate(() => document.querySelector('.ig-results [data-a=again]').click());
  await sim(1); console.log('again', await p.evaluate(() => window.__GAME.G.state));
};
