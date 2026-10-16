// Pixel Pact (2D) headless test: title → world map → every adventure level (sim + checkpoints of each chunk) → bosses → results/profile → match modes + arenas.
// PP_QUICK=1 skips the per-chunk tour. Screenshots: test/out/pixelpact_*.png
const sim = (p, n, chunk = 30) => p.evaluate(async ([n, chunk]) => { for (let i = 0; i < n; i += chunk) { window.__GAME.update(Math.min(chunk, n - i)); await new Promise(r => setTimeout(r, 0)); } }, [n, chunk]);
module.exports = async (p, shot) => {
  await shot('title');
  const info = await p.evaluate(() => ({ levels: window.__GAME.levels.length, stages: window.__GAME.stages.length, heroes: window.__GAME.heroes.length }));
  console.log('content', JSON.stringify(info));
  // world map
  await p.evaluate(() => window.__GAME.openMap());
  await p.waitForTimeout(400); await shot('map');
  // every level: start, run, tour the chunks
  for (let i = 0; i < info.levels; i++) {
    await p.evaluate(i => window.__GAME.start('adventure', i), i);
    await sim(p, 240);
    if (i >= 3 || i === 0) await shot('level' + (i + 1));
    if (!process.env.PP_QUICK) {
      const tour = await p.evaluate(async () => {
        const G = window.__GAME, pl = G.players[0], W = G.mapW, out = [];
        for (let x = 300; x < W - 200; x += 600) { pl.x = x; pl.y = 60; pl.vx = pl.vy = 0; pl.inv = 600; G.update(50); out.push(Number.isFinite(pl.x + pl.y) ? 1 : 0); await new Promise(r => setTimeout(r, 0)); }
        return { ok: out.every(Boolean), n: out.length, scene: G.G.scene };
      });
      console.log('level', i + 1, JSON.stringify(tour));
    }
  }
  // mechanics spot checks on 1-5 (swim) and 1-6 (lever opens gate)
  const mech = await p.evaluate(async () => {
    const G = window.__GAME; G.start('adventure', 5); G.update(200);
    const lever = G.ents.find(e => e.kind === 'switch'), pl = G.players[0]; pl.x = lever.x; pl.y = lever.y - 30; pl.inv = 600; G.update(20);
    const leverOn = lever.on;
    G.start('adventure', 4); G.update(200); const p2 = G.players[0]; p2.x = 46 * 32; p2.y = 11 * 32; p2.vy = 0; G.update(30);
    return { leverOn, swimming: !!p2.wet };
  });
  console.log('mechanics', JSON.stringify(mech));
  // bosses: wake each one, fight with the sim for a while
  for (const [lvl, name] of [[0, 'claw'], [4, 'queen'], [9, 'magma']]) {
    const b = await p.evaluate(async lvl => {
      const G = window.__GAME; G.start('adventure', lvl); G.update(120);
      const boss = G.boss, pl = G.players[0]; pl.x = G.arena.x0 + 200; pl.y = 300; pl.inv = 9999; G.update(160);
      const seen = new Set(); for (let i = 0; i < 40; i++) { pl.inv = 9999; G.update(30); seen.add(boss.state); await new Promise(r => setTimeout(r, 0)); }
      return { name: boss.name, active: G.arena.active, states: [...seen].join(','), hp: boss.hp };
    }, lvl);
    console.log('boss', JSON.stringify(b));
    await shot('boss_' + name);
  }
  // every hero: special + ultimate in a co-op level with a bot ally (exercise Pip's lantern + Sunrise, Bo's vine + Thornquake)
  for (let h = 0; h < info.heroes; h++) {
    const r = await p.evaluate(async h => {
      const G = window.__GAME; G.start('adventure', 0, { hero: h }); G.update(150);
      const pl = G.players[0]; pl.x = 13 * 32; pl.y = 300; G.update(20);
      G.force(0, 'spec'); G.update(12); const mid = G.players[0].anim; G.update(40); G.force(0, 'ult'); G.update(80);
      return { hero: pl.hero.id, anim: mid, hp: pl.hp, ok: Number.isFinite(pl.x) && G.G.scene === 'play' };
    }, h);
    console.log('hero', JSON.stringify(r));
    if (h >= 4) { await p.evaluate(() => { const G = window.__GAME; G.force(0, 'spec'); G.update(9); }); await shot('hero_' + r.hero); }
  }
  const r1 = await p.evaluate(() => { const G = window.__GAME; G.start('adventure', 3); G.update(60); G.results(true); return { scene: G.G.scene, prof: JSON.parse(localStorage.getItem('inoa.profile') || '{}').games?.pixelpact, recent: JSON.parse(localStorage.getItem('inoa.profile') || '{}').recent, reward: G.G.lastReward }; });
  console.log('adventure results', JSON.stringify(r1));
  await p.waitForTimeout(1500); await shot('results');
  // match: every stage once, every mode once
  for (let s = 0; s < info.stages; s++) {
    const mode = ['stock', 'coins', 'hill'][s % 3];
    await p.evaluate(([s, mode]) => window.__GAME.start('match', 0, { stage: s, mode, bots: 3 }), [s, mode]);
    await sim(p, 900);
    const r = await p.evaluate(() => { const G = window.__GAME; return { stage: G.G.stage, mode: G.G.mmode, scene: G.G.scene, players: G.players.length, scores: G.players.map(q => G.G.mmode === 'hill' ? Math.round(q.hill || 0) : G.G.mmode === 'coins' ? q.score : q.stocks).join('/') }; });
    console.log('match', JSON.stringify(r));
    await shot('match' + (s + 1));
  }
  // coin rush to the end → results board
  const end = await p.evaluate(async () => { const G = window.__GAME; G.start('match', 0, { stage: 0, mode: 'coins', bots: 1 }); for (let i = 0; i < 200 && G.G.scene === 'play'; i++) { G.update(60); await new Promise(r => setTimeout(r, 0)); } return { scene: G.G.scene, title: document.getElementById('resTitle').textContent }; });
  console.log('coin rush end', JSON.stringify(end));
};
