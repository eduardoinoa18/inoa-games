// Pixel Pact Match "feel + cost" benchmark: a 4-fighter bot match for N simulated seconds per stage.
// Reports how much game time is frozen (hit-stop) or slowed (slow-mo), particle peaks, and sim/draw cost per frame.
// usage: node test/run.js pixelpact test/pixelpact_perf.js   (PP_SECS=60 PP_STAGES=0,1,2,3,4)
module.exports = async (p, shot) => {
  await p.waitForFunction(() => window.__READY === true, null, { timeout: 60000 });
  const secs = +(process.env.PP_SECS || 60), stages = (process.env.PP_STAGES || '0,1,2,3,4').split(',').map(Number);
  const out = [];
  for (const stage of stages) {
    const r = await p.evaluate(async ([stage, secs]) => {
      const API = window.__GAME, G = API.G;
      API.start('match', 0, { stage, mode: 'stocks', bots: 3 });
      for (let i = 0; i < 260 && G.countdown > 0; i++) API.loopStep(1); // skip the countdown
      const N = secs * 60; let frozen = 0, slowFrames = 0, peak = 0, sumParts = 0, sim = 0, draw = 0, draws = 0, hitstops = 0, prevHs = 0, slowTriggers = 0, prevSlow = 0, punchFrames = 0, flashFrames = 0;
      for (let f = 0; f < N && G.scene === 'play' && !G.matchOver; f++) {
        if (G.hitstop > 0) frozen++;
        if (G.slowT > 0) slowFrames++;
        if (G.slowT > prevSlow + 1e-6) slowTriggers++; prevSlow = G.slowT;
        if (G.hitstop > prevHs) hitstops++; prevHs = G.hitstop;
        if (G.punch > 1.005) punchFrames++; if (G.flash > .05) flashFrames++;
        const t0 = performance.now(); API.loopStep(1); sim += performance.now() - t0;
        // the real loop drains slowT by wall-clock dt: emulate 60 Hz frames (slow-mo stretches game time by 1/0.3)
        if (G.slowT > 0) G.slowT = Math.max(0, G.slowT - 1 / 60 / .3);
        const n = API.parts.length; peak = Math.max(peak, n); sumParts += n;
        if (f % 30 === 0) { const t1 = performance.now(); API.update(0); draw += performance.now() - t1; draws++; }
      }
      const simFrames = Math.max(1, Math.round(N));
      const realSlow = slowFrames / .3, realFrozen = frozen, realTotal = simFrames - slowFrames + realSlow;
      return { stage, wallFrozenPct: +(realFrozen / realTotal * 100).toFixed(1), wallSlowPct: +(realSlow / realTotal * 100).toFixed(1), frozenPct: +(frozen / simFrames * 100).toFixed(1), slowPct: +(slowFrames / simFrames * 100).toFixed(1), hitstops, slowTriggers, punchFrames, flashFrames, partPeak: peak, partAvg: Math.round(sumParts / simFrames), simMsPerFrame: +(sim / simFrames).toFixed(3), drawMs: +(draw / Math.max(1, draws)).toFixed(1) };
    }, [stage, secs]);
    out.push(r); console.log('perf', JSON.stringify(r));
    await shot('perf_stage' + stage);
  }
  const avg = k => +(out.reduce((a, r) => a + r[k], 0) / out.length).toFixed(2);
  console.log('perf avg', JSON.stringify({ wallFrozenPct: avg('wallFrozenPct'), wallSlowPct: avg('wallSlowPct'), frozenPct: avg('frozenPct'), slowPct: avg('slowPct'), partPeak: Math.max(...out.map(r => r.partPeak)), drawMs: avg('drawMs'), simMsPerFrame: avg('simMsPerFrame') }));
  // guard (2026-10-17 tuning): before it, ~16% of a 4-fighter match was hit-stop and ~14% slow-mo, which players felt as lag
  // budget: average over arenas ≤ 6% frozen / ≤ 4% slowed, and no single arena above 10% / 6% (bots are random: one spiky arena alone is not a regression)
  const bad = out.filter(r => r.wallFrozenPct > 10 || r.wallSlowPct > 6); if (avg('wallFrozenPct') > 6 || avg('wallSlowPct') > 4) bad.push({ stage: 'avg' });
  if (bad.length) { console.log('PP_FEEL_BUDGET_FAILED', JSON.stringify(bad.map(r => r.stage))); process.exitCode = 1; } else console.log('PP_FEEL_BUDGET_OK');
};
