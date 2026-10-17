// Flagship spike measurements (docs/DECISIONS/0003). usage: node test/run.js labs/hometown.html test/spike_hometown.js
module.exports = async (p, shot) => {
  await p.waitForFunction(() => window.__READY === true, null, { timeout: 180000 });
  await p.waitForTimeout(500);
  const town = await p.evaluate(() => window.__SPIKE.town()); console.log('spike town', JSON.stringify(town));
  const baked = await p.evaluate(() => window.__SPIKE.bake()); console.log('spike town baked', JSON.stringify(baked));
  const cyc = await p.evaluate(() => window.__SPIKE.cycle(20)); console.log('spike cycles', JSON.stringify(cyc));
  const ms = await p.evaluate(() => window.__SPIKE.frameMs(20)); console.log('spike frameMs (software GL, not a phone number)', ms);
  const split = await p.evaluate(() => { const S = window.__SPIKE; return S.split ? S.split() : null; }); if (split) console.log('spike split', JSON.stringify(split));
  await shot('spike_town');
  // GPU geometry count must not grow from cycle to cycle (the first cycle uploads the shared prop models once)
  const g = cyc.geometriesDuringCycles, growth = g[g.length - 1] - g[1];
  console.log(growth <= 0 ? 'SPIKE_NO_LEAK' : 'SPIKE_LEAK ' + growth);
  console.log(baked.calls <= 150 ? 'SPIKE_CALLS_OK' : 'SPIKE_CALLS_HIGH ' + baked.calls);
};
