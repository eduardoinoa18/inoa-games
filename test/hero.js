// Hero-everywhere check: a hero picked on the hub (profile.hero) becomes the default character in the game.
// usage: node test/run.js <drift|runner|tidelines|builders> test/hero.js
module.exports = async (p, shot) => {
  await p.evaluate(() => { localStorage.setItem('inoa.profile', JSON.stringify({ v: 2, name: 'Zoe', hero: { model: 'cyborg-female', color: '#2fbf8a' } })); ['inoa.drift', 'inoa.runner', 'inoa.tidelines', 'inoa.builders'].forEach(k => localStorage.removeItem(k)); });
  await p.reload(); await p.waitForFunction(() => window.__READY === true, null, { timeout: 180000 });
  const r = await p.evaluate(() => { const S = window.__GAME && (window.__GAME.S || window.__GAME.G?.S); const on = document.querySelector('.ig-title button.on[data-i], .ig-title #pR button.on, .ig-title #pC button.on'); return { sel: S && (S.racer ?? S.runner ?? S.char ?? S.player), onText: on && on.textContent.trim() }; });
  console.log('hero default', JSON.stringify(r)); await shot('hero_title');
};
