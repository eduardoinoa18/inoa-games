// Tide Runner headless test: title → run (autopilot) → jump/slide/power-up frames → crash out → results → ghost replay.
module.exports = async (p, shot) => {
  const pre = Number(process.env.H || 560) > Number(process.env.W || 1000) ? 'p_' : '';
  // own screenshot wrapper with a long timeout: SwiftShader is slow when other builders share the machine
  const S = n => p.screenshot({ path: require('path').join(__dirname, 'out', `runner_${pre}${n}.png`), timeout: 180000 });
  await S('title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  // sim: step the game; optional stop condition evaluated each frame
  const sim = (sec, until) => p.evaluate(async ({ sec, until }) => { const g = window.__GAME; window.__HOLD = true; const f = until ? new Function('G', 'return ' + until) : null; for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (f && f(g.G)) { window.__HOLD = false; return i; } if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } window.__HOLD = false; return -1; }, { sec, until });
  await sim(.6); await p.waitForTimeout(300); await S('ready');
  await p.evaluate(() => { window.__GAME.auto = true; });
  await sim(5); await p.waitForTimeout(300); await S('run');
  const j = await sim(20, 'G.y > 1.0 && G.vy < 2'); console.log('jump frame', j); await p.waitForTimeout(250); await S('jump');
  const s = await sim(80, 'G.slideT > 0 && G.slideT < .55'); console.log('slide frame', s); await p.waitForTimeout(250); await S('slide');
  const r = await p.evaluate(async () => { const g = window.__GAME, G = g.G; for (let i = 0; i < 60 * 70 && G.state === 'run'; i++) { g.update(1 / 60); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return { d: Math.round(G.d), coins: G.coinsN, hearts: G.hearts, state: G.state, mult: G.mult, obs: G.obs.length }; });
  console.log("autopilot 70s", JSON.stringify(r), await p.evaluate(() => JSON.stringify(window.__GAME.G.log)));
  // give a power-up for a screenshot
  await p.evaluate(() => { const G = window.__GAME.G; G.pw.shield = 14; G.pw.magnet = 9; window.__GAME.showShield(); });
  await sim(.8); await p.waitForTimeout(300); await S('power');
  // stop the autopilot: the runner should stumble until the run ends
  await p.evaluate(() => { window.__GAME.auto = false; });
  const st = await sim(12, 'G.stumbleT > .5'); console.log('stumble frame', st); await sim(.12); await p.waitForTimeout(200); await S('stumble');
  const e = await p.evaluate(async () => { const g = window.__GAME, G = g.G; for (let i = 0; i < 60 * 120 && !G.resultsShown; i++) { g.update(1 / 60); g.updateCamera(1 / 60); if (G.state === 'run' && G.y <= 0 && i % 50 === 0) window.__GAME.act(Math.random() < .5 ? 'left' : 'right'); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return { d: Math.round(G.d), state: G.state, shown: !!G.resultsShown }; });
  console.log('end', JSON.stringify(e));
  await p.waitForTimeout(800); await S('results');
  const store = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('inoa.runner')); return { best: s.best, ghost: s.ghost.endless && s.ghost.endless.s.length }; });
  console.log('store', JSON.stringify(store));
  // play again → ghost should be racing
  await p.evaluate(() => document.querySelector('.ig-results [data-a=again]').click());
  await p.evaluate(() => { window.__GAME.auto = true; });
  await sim(4.5); await p.waitForTimeout(300); await S('ghost');
  const gs = await p.evaluate(() => ({ ghostD: window.__GAME.G.ghostD, d: window.__GAME.G.d }));
  console.log('ghost', JSON.stringify(gs));
  // daily run: same date → same course on every start
  const daily = await p.evaluate(() => { const g = window.__GAME; g.auto = false; g.S.mode = 'daily'; const sig = () => g.G.obs.slice(0, 12).map(o => o.type + Math.round(o.d0) + o.lanes.join('')).join(','); g.startRun(); const a = sig(); g.startRun(); const b = sig(); g.S.mode = 'endless'; g.startRun(); const c = sig(); return { same: a === b, differsFromEndless: a !== c, a: a.slice(0, 80) }; });
  console.log('daily', JSON.stringify(daily));
};
