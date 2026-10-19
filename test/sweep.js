// Phone-size sweep: open a game, check for page errors and layout overflow on the title screen, press Play, let it run,
// screenshot both. Use with W/H for the screen size (phone landscape 844×390 is the size players hold a phone sideways).
// usage: W=844 H=390 node test/run.js <game> test/sweep.js
module.exports = async (p, shot) => {
  await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 });
  await p.waitForTimeout(700);
  const lay = () => p.evaluate(() => {
    const W = innerWidth, H = innerHeight, de = document.documentElement, out = [];
    if (de.scrollWidth > W + 2) out.push(`page wider than screen (${de.scrollWidth}>${W})`);
    for (const el of document.querySelectorAll('.ig-card, .ig-row .ig-btn, [data-a=play], .ig-chip, button')) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!r.width || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      if (r.right > W + 2 || r.left < -2) out.push(`${el.className || el.tagName} off-screen x ${Math.round(r.left)}..${Math.round(r.right)}`);
      if (el.matches('[data-a=play]') && (r.bottom > H + 2 || r.top < -2)) { const sc = el.closest('.ig-card, .ig-screen'); const scrollable = sc && sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY + getComputedStyle(sc.parentElement || sc).overflowY); if (!scrollable) out.push(`Play button unreachable (${Math.round(r.top)}..${Math.round(r.bottom)} of ${H})`); }
    }
    return [...new Set(out)].slice(0, 6);
  });
  const t = await lay(); await shot('sweep_title');
  const played = await p.evaluate(() => { const b = document.querySelector('.ig-title [data-a=play], [data-a=play]'); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return true; } return false; });
  await p.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => { const g = window.__GAME; if (g && typeof g.update === 'function') for (let j = 0; j < 10; j++) try { g.update(1 / 30); } catch (e) { window.__sweepErr = String(e); } }); await p.waitForTimeout(200); }
  const g = await lay(); const err = await p.evaluate(() => window.__sweepErr || null);
  await shot('sweep_play');
  console.log('SWEEP', JSON.stringify({ title: t, played, play: g, err }));
};
