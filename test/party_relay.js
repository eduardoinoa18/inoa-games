// Relay fallback: when no direct WebRTC link can form (strict network / mobile data), the phone still controls the game
// through the Supabase Realtime relay. Simulated by removing RTCPeerConnection on the phone.
module.exports = async ({ open, wait, ready, log }) => {
  const host = await open('games/runner.html', { label: 'host' }); await ready(host);
  await host.click('[data-a=phones]'); await wait(host, () => document.querySelector('.inoa-pp .code'));
  const code = await host.$eval('.inoa-pp .code', e => e.textContent.trim());
  const pad = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'pad', init: () => { window.RTCPeerConnection = undefined; } });
  await wait(pad, () => window.__PAD && window.__PAD.net.status === 'ready' && window.__PAD.net.me, null, 60000);
  log('phone without WebRTC link:', await pad.evaluate(() => window.__PAD.net.link));
  await pad.evaluate(() => window.__PAD.press ? window.__PAD.press('a', true) : (async () => { const m = await import('/engine/net.js'); m.sendInput({ x: 0.5, y: 0, a: true, b: false, c: false, d: false, pause: false }); })());
  await wait(host, async () => { const E = await import('/engine/inoa3d.js'); const p = E.net.pads()[0]; return p && p.input.a === true; }, null, 30000);
  log('host received A press over the relay');
  // a normal phone upgrades to the direct link
  const pad2 = await open('pad.html?r=' + code, { w: 390, h: 844, label: 'pad2' });
  await wait(pad2, () => window.__PAD && window.__PAD.net.status === 'ready' && window.__PAD.net.link === 'direct', null, 60000);
  log('normal phone link:', await pad2.evaluate(() => window.__PAD.net.link));
};
