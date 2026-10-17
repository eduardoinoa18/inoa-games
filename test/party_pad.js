// Phone-as-controller: host opens a room from a game's title screen, a phone joins with the code,
// the phone's A button navigates the menu (presses Play) and drives player 1, ⏸ pauses the game,
// and the room survives the host navigating to another game page (pad reconnects by itself).
module.exports = async ({ open, shot, wait, ready, log }) => {
  const host = await open('games/runner.html', { label: 'host' }); await ready(host);
  await host.click('[data-a=phones]');
  await wait(host, () => document.querySelector('.inoa-pp .code'));
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim()); log('room', code);
  const qr = await host.$eval('.inoa-pp .qr svg', e => e.outerHTML.length); log('qr svg bytes', qr);
  await shot(host, 'host_panel');
  const pad = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'pad' });
  await wait(pad, () => window.__PAD && window.__PAD.net.status === 'ready' && window.__PAD.net.me, null, 60000);
  log('pad me', await pad.evaluate(() => JSON.stringify(window.__PAD.net.me)));
  await wait(host, () => document.querySelector('.inoa-pp .list').textContent.includes('P1'));
  await shot(host, 'host_panel_joined'); await shot(pad, 'pad_gamepad');
  // orientation: gamepad turns sideways on an upright phone; the stick follows the turned screen; buzzer stays upright; ↻ flips
  const rot = () => pad.evaluate(() => document.body.classList.contains('rot'));
  await pad.waitForTimeout(200); if (!(await rot())) throw new Error('gamepad should turn sideways on an upright phone'); log('pad sideways', true);
  const zr = await pad.$eval('#stickZone', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pad.locator('#stickZone').dispatchEvent('pointerdown', { pointerId: 7, clientX: zr.x, clientY: zr.y, isPrimary: true });
  await pad.locator('#stickZone').dispatchEvent('pointermove', { pointerId: 7, clientX: zr.x, clientY: zr.y + 60, isPrimary: true });
  const st = await pad.evaluate(() => ({ x: window.__PAD.state.x, y: window.__PAD.state.y }));
  await pad.locator('#stickZone').dispatchEvent('pointerup', { pointerId: 7, clientX: zr.x, clientY: zr.y + 60, isPrimary: true });
  log('sideways stick (screen-down drag)', JSON.stringify(st)); if (!(st.x > .9 && Math.abs(st.y) < .1)) throw new Error('turned stick should read right');
  await shot(pad, 'pad_sideways');
  await pad.evaluate(() => window.__PAD.applyLayout({ type: 'buzzer', label: 'BUZZ' })); await pad.waitForTimeout(100);
  if (await rot()) throw new Error('buzzer should stay upright'); log('buzzer upright', true);
  await pad.evaluate(() => window.__PAD.applyLayout({ type: 'gamepad' })); await pad.waitForTimeout(100);
  await pad.click('#bRot'); await pad.waitForTimeout(100); const flipped = !(await rot()); await pad.click('#bRot'); await pad.waitForTimeout(100);
  if (!flipped || !(await rot())) throw new Error('↻ should flip between upright and sideways'); log('↻ flips', true);
  await host.click('.inoa-pp [data-x]');
  // pad A: first press focuses Play, second press clicks it
  const tapA = async () => { await pad.locator('#bA').dispatchEvent('pointerdown'); await pad.waitForTimeout(250); await pad.locator('#bA').dispatchEvent('pointerup'); await pad.waitForTimeout(250); };
  await tapA(); await tapA();
  await wait(host, () => !document.querySelector('.ig-title'), null, 8000);
  log('title closed by phone A');
  // phone drives P1 input
  await pad.locator('#bA').dispatchEvent('pointerdown'); await pad.waitForTimeout(400);
  const a = await host.evaluate(async () => { const E = await import('/engine/inoa3d.js'); const pads = E.net.pads(); return { pads: pads.length, a: E.net.pad(pads[0].slot).a }; });
  log('host sees', JSON.stringify(a)); if (!a.a) throw new Error('host did not see pad A');
  await pad.locator('#bA').dispatchEvent('pointerup');
  // ⏸ on the phone pauses the game
  await pad.locator('#bPause').dispatchEvent('pointerdown'); await pad.waitForTimeout(300); await pad.locator('#bPause').dispatchEvent('pointerup');
  const paused = await wait(host, () => [...document.querySelectorAll('.ig-screen h2')].some(h => /Paused/.test(h.textContent)), null, 6000).catch(() => false);
  log('paused by phone', paused);
  await shot(host, 'host_paused');
  // host navigates to another game: same room, pad reconnects
  await host.goto(host.url().replace('runner.html', 'fit.html')); await ready(host);
  await wait(host, async () => { const E = await import('/engine/inoa3d.js'); return E.net.status === 'ready' && E.net.pads().length === 1; }, null, 40000);
  log('room resumed on fit.html with pad', await host.evaluate(async () => (await import('/engine/inoa3d.js')).net.code));
  await wait(pad, () => window.__PAD.net.status === 'ready');
  await shot(pad, 'pad_after_nav');
};
