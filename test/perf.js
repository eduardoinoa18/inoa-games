// Load + frame-time probe (software GL in a container: numbers are RELATIVE only, not real-device FPS).
// usage: node test/run.js <game> test/perf.js   → prints PERF {...}
module.exports = async (p) => {
  const t = await p.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0]; const res = performance.getEntriesByType('resource');
    const bytes = res.reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) + (nav ? nav.transferSize || 0 : 0);
    const big = res.filter(r => /packs\//.test(r.name)).reduce((a, r) => a + (r.encodedBodySize || 0), 0);
    // real-time frames for 3 s on whatever screen the game shows first (title over a live scene)
    const ft = []; let last = performance.now(); await new Promise(done => { const t0 = last; (function f(now) { ft.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); else done(); })(last); });
    ft.shift(); ft.sort((a, b) => a - b); const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    return { readyMs: Math.round(window.__T_READY || performance.now()), requests: res.length, kb: Math.round(bytes / 1024), packKb: Math.round(big / 1024), fps: +(1000 / avg).toFixed(1), p95ms: Math.round(ft[Math.floor(ft.length * .95)] || 0) };
  });
  console.log('PERF', JSON.stringify(t));
};
