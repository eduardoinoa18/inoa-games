// Accessibility scan (roadmap R5): axe-core on the hub, the account/legal pages, the phone pad and every game's title screen.
// Reports serious + critical violations (WCAG 2.1 A/AA rules). Canvas/WebGL content is outside what axe can judge.
// usage: node test/run.js index test/a11y.js   (A11Y_PAGES=index.html,games/fit.html to limit)
const fs = require('fs'), path = require('path');
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const PAGES = (process.env.A11Y_PAGES || 'index.html,account.html,privacy.html,terms.html,pricing.html,pad.html,' + 'pixelpact,depths,drift,safari,bubbles,runner,tidelines,fit,junk,brew,builders,tray,trivia,draw'.split(',').map(g => `games/${g}.html`).join(',')).split(',');
module.exports = async (p, shot) => {
  const base = p.url().replace(/[^/]*$/, '').replace(/games\/$/, ''); let total = 0; const all = {};
  for (const pg of PAGES) {
    await p.goto(base + pg);
    await p.waitForFunction(() => window.__READY === true || !document.querySelector('script[type=module]'), null, { timeout: 120000 }).catch(() => { });
    await p.waitForTimeout(800);
    await p.addScriptTag({ content: AXE });
    const res = await p.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }); return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 3).map(n => n.target.join(' ').slice(0, 90) + (n.any[0] && n.any[0].data && n.any[0].data.fgColor ? ` ${n.any[0].data.fgColor}/${n.any[0].data.bgColor} ${n.any[0].data.contrastRatio}:1 ${n.any[0].data.fontSize}` : '')) })); });
    all[pg] = res; total += res.length;
    console.log(res.length ? 'a11y ISSUES' : 'a11y ok', pg, res.length ? JSON.stringify(res) : '');
  }
  console.log(total ? `A11Y_SERIOUS ${total}` : 'A11Y_CLEAN');
  fs.writeFileSync(path.join(__dirname, 'out', 'a11y.json'), JSON.stringify(all, null, 1));
};
