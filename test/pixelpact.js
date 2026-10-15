// Pixel Pact (2D) headless test: title → adventure level 1 (sim) → forced results → match vs bot (sim) → results.
module.exports = async (p, shot) => {
  await shot('title');
  await p.evaluate(() => window.__GAME.start('adventure', 0));
  await p.evaluate(async () => { for (let i = 0; i < 20; i++) { window.__GAME.update(30); await new Promise(r => setTimeout(r, 0)); } });
  await p.waitForTimeout(300); await shot('adventure');
  const r1 = await p.evaluate(() => { window.__GAME.results(true); return { scene: window.__GAME.G.scene, prof: JSON.parse(localStorage.getItem('inoa.profile') || '{}').games?.pixelpact }; });
  console.log('adventure results', JSON.stringify(r1));
  await p.waitForTimeout(1200); await shot('results');
  await p.evaluate(() => window.__GAME.start('match', 0));
  await p.evaluate(async () => { for (let i = 0; i < 30; i++) { window.__GAME.update(30); await new Promise(r => setTimeout(r, 0)); } });
  await p.waitForTimeout(300); await shot('match');
  const r2 = await p.evaluate(() => ({ scene: window.__GAME.G.scene, players: window.__GAME.players.length }));
  console.log('match', JSON.stringify(r2));
};
