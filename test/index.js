// Hub test: profile-driven tiles, Continue row, daily challenge (deterministic, pays once), EN/ES toggle, hero card export.
module.exports = async (p, shot) => {
  const now = Date.now();
  await p.evaluate((now) => localStorage.setItem('inoa.profile', JSON.stringify({ v: 2, name: 'Rook Ironhide', xp: 640, coins: 120, lang: 'en', recent: ['drift', 'fit', 'safari'],
    games: { drift: { plays: 4, best: 30.47, last: now - 3e5 }, fit: { plays: 2, best: 10.2, last: now - 9e6 }, safari: { plays: 1, best: 62, last: now - 2e7 }, runner: { plays: 3, best: 1269, last: now - 5e7 } } })), now);
  await p.reload(); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({ daily: document.getElementById('dailyCard').innerText.split('\n').slice(0, 3), cont: [...document.querySelectorAll('#continueRow .cont b')].map(b => b.textContent), driftTile: [...document.querySelectorAll('.game')].find(g => g.innerText.includes('Island Drift'))?.querySelector('.stats')?.textContent, hidden: document.querySelector('.contwrap').hidden, day: window.__HUB.dayNum(), live: window.__HUB.liveGames().length }));
  console.log('hub', JSON.stringify(r));
  await shot('top');
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.profile')).coins);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('inoa.daily')); const P = JSON.parse(localStorage.getItem('inoa.profile')); const id = { pact: 'pixelpact', tide: 'tidelines' }[d.id] || d.id; P.games[id] = Object.assign(P.games[id] || { plays: 0 }, { plays: (P.games[id]?.plays || 0) + 1, last: Date.now() }); localStorage.setItem('inoa.profile', JSON.stringify(P)); window.__HUB.renderDaily(); window.__HUB.renderDaily(); });
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('inoa.profile')).coins);
  console.log('daily payout once', before, '->', after, JSON.stringify(await p.evaluate(() => localStorage.getItem('inoa.daily'))));
  await p.evaluate(() => document.querySelector('#langToggle [data-l=es]').click()); await p.waitForTimeout(300);
  console.log('es', JSON.stringify(await p.evaluate(() => ({ lang: document.documentElement.lang, h2: document.querySelector('#shelf h2').textContent, prof: JSON.parse(localStorage.getItem('inoa.profile')).lang, daily: document.getElementById('dailyCard').innerText.split('\n')[0] }))));
  await shot('top_es');
  const dl = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await p.evaluate(() => document.getElementById('heroShare').click()); const d = await dl;
  if (d) { const out = require('path').join(__dirname, 'out', 'hero_card.png'); await d.saveAs(out); console.log('hero card saved', out); } else console.log('hero card: no download event');
  await p.evaluate(() => document.querySelector('#langToggle [data-l=en]').click());
  // 3D hero picker → profile.hero, read back through the engine's E.hero()
  await p.evaluate(() => { document.querySelector('#h3Models [data-m=cyborg-female]').click(); document.querySelector('#h3Colors [data-c="#2fbf8a"]').click(); const n = document.getElementById('h3Name'); n.value = '<b>Zoe</b>'; n.dispatchEvent(new Event('input')); });
  const h = await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('inoa.profile')); return { hero: P.hero, name: P.name, panel: document.querySelector('.hp-name')?.innerHTML }; });
  console.log('hero', JSON.stringify(h));
  const box = await p.evaluate(() => { const r = document.getElementById('hero').getBoundingClientRect(); return { x: 0, y: r.top + scrollY, width: innerWidth, height: Math.min(r.height, 1400) }; }); await p.screenshot({ path: require('path').join(__dirname, 'out', 'index_hero' + (p.viewportSize().width < p.viewportSize().height ? '_p' : '') + '.png'), fullPage: true, clip: box });
};
