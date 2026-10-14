module.exports = async (p, shot) => {
  await p.evaluate(() => document.querySelector('.ig-title [data-a=play]').click());
  await p.waitForTimeout(300);
  const r = await p.evaluate(async () => { const g = window.__GAME, G = g.G; const log = []; for (let i = 0; i < 60 * 40; i++) { g.update(1 / 60); if (i % 300 === 0) log.push(G.karts.map(k => `${k.idx}/${k.v.toFixed(0)}/${k.lap}`).join(' ')); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); } return log; });
  console.log(r.join('\n'));
  await p.evaluate(() => { const G = window.__GAME.G; const k = G.karts[2]; G.me.x = k.x; G.me.z = k.z; G.me.h = k.h; G.me.idx = k.idx; G.camPos.set(k.x, k.y + 30, k.z + 30); });
  await p.waitForTimeout(800); await shot('ai');
};
