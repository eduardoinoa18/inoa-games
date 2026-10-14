module.exports = async (p, shot) => {
  await p.evaluate(() => { const g = window.__GAME; g.S.track = 1; g.startRace(); document.querySelectorAll('.ig-screen').forEach(e => e.remove()); });
  await p.evaluate(async () => { const g = window.__GAME; window.__AUTOPILOT = true; for (let i = 0; i < 60 * 12; i++) { g.update(1 / 60); if (i % 30 === 0) await new Promise(r => setTimeout(r, 0)); } });
  console.log(await p.evaluate(() => { const G = window.__GAME.G, k = G.me; return JSON.stringify({ x: k.x.toFixed(1), y: k.y.toFixed(2), z: k.z.toFixed(1), v: k.v.toFixed(1), idx: k.idx, vis: k.g.visible, inScene: !!k.g.parent, cam: G.camPos.toArray().map(v => v.toFixed(1)) }); })); await p.evaluate(() => { for (let i = 0; i < 240; i++) window.__GAME.updateCamera(1 / 60); }); await p.waitForTimeout(900); await shot(process.env.W ? 'night_p' : 'night');
};
