module.exports = async (p, shot) => {
  await shot('title');
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await p.waitForTimeout(500);
  const sim = async (sec, keys = {}) => p.evaluate(async ({ sec, keys }) => { const g = window.__GAME; for (const k in keys) dispatchEvent(new KeyboardEvent(keys[k] ? 'keydown' : 'keyup', { code: k })); for (let i = 0; i < sec * 60; i++) { g.update(1 / 60); if (i % 20 === 0) await new Promise(r => setTimeout(r, 0)); } }, { sec, keys });
  await sim(1); await p.waitForTimeout(400); await shot('grid');
  await sim(6); await p.waitForTimeout(600); await shot('race');
  await sim(1.5, { ShiftLeft: true, KeyA: true }); await p.waitForTimeout(500); await shot('drift');
  await sim(.1, { ShiftLeft: false, KeyA: false });
  // let AI drive the player too: steer toward track like AI by simulating long race with assist
  const r = await p.evaluate(async () => { const g = window.__GAME, G = g.G; const me = G.me; for (let i = 0; i < 60 * 240 && !G.done; i++) { window.__AUTOPILOT = true; g.update(1 / 60); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return { done: G.done, lap: me.lap, place: G.place, t: G.raceT.toFixed(1), karts: G.karts.map(k => k.lap) }; });
  console.log('race', JSON.stringify(r));
  await p.waitForTimeout(2500); await shot('results');
};
