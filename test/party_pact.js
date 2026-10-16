// Pixel Pact 2D: phone A navigates the menu (Continue) and then joins the lobby as its own player.
module.exports = async ({ open, shot, wait, log }) => {
  const host = await open('games/pixelpact.html', { label: 'pact' }); await host.waitForTimeout(2500);
  await host.click('.inoa-party button'); await wait(host, () => document.querySelector('.inoa-pp .code'));
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); await host.click('.inoa-pp [data-x]');
  const pad = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'pad' }); await wait(pad, () => window.__PAD.net.me);
  log('pad buttons', await pad.evaluate(() => ['bA', 'bB', 'bC', 'bD'].map(id => document.getElementById(id).textContent).join(' ')));
  await host.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Match/.test(b.textContent.trim())).click());
  await host.waitForTimeout(800);
  const joined = () => host.evaluate(() => [...document.querySelectorAll('.slot .src')].some(e => e.textContent.includes('📱')));
  for (let i = 0; i < 8 && !(await joined()); i++) {
    await pad.locator('#bA').dispatchEvent('pointerdown'); await host.waitForTimeout(1200); await pad.locator('#bA').dispatchEvent('pointerup'); await host.waitForTimeout(1200);
    log('try', i, await host.evaluate(() => JSON.stringify(window.__PPDBG())));
  }
  const slots = await host.evaluate(() => [...document.querySelectorAll('.slot .src')].map(e => e.textContent));
  await shot(host, 'lobby'); log('lobby sources', JSON.stringify(slots)); if (!slots.some(t => t.includes('📱'))) throw new Error('phone did not join lobby');
  // P1 readies on the host; the phone presses A to ready up, then A again to start the match
  await host.evaluate(() => { const s = window.__GAME.lobby.slots[0]; if (!s.ready) document.querySelector('.slot .ready').click(); });
  const tap = async () => { await pad.locator('#bA').dispatchEvent('pointerdown'); await host.waitForTimeout(700); await pad.locator('#bA').dispatchEvent('pointerup'); await host.waitForTimeout(700); };
  for (let i = 0; i < 6 && (await host.evaluate(() => window.__GAME.G.scene)) !== 'play'; i++) await tap();
  const st = await host.evaluate(() => ({ scene: window.__GAME.G.scene, srcs: window.__GAME.players.map(p => p.src).join(',') }));
  log('match start', JSON.stringify(st)); if (st.scene !== 'play' || !/net\d/.test(st.srcs)) throw new Error('phone could not ready up and start');
};
