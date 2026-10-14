const fs = require('fs'), path = require('path'), http = require('http');
// Generic headless test for an arcade game page.
// usage (from repo root): node test/run.js <game> [test/<game>.js]  (serves the repo on :8766, routes three.js CDN imports to node_modules)
// script.js exports async (page, shot) => {...}; shot(name) saves <game>_<name>.png into test/out/
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), NM = path.join(path.dirname(require.resolve('three/package.json')), '/');
const game = process.argv[2], scriptPath = process.argv[3];
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const PORT = Number(process.env.PORT || 8766);
const server = http.createServer((req, res) => { let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } let body = fs.readFileSync(f); if (f.endsWith('.html') && !body.toString().startsWith('<!doctype')) body = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + body + '</body></html>'; res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-length': Buffer.byteLength(body) }); res.end(body); });
server.listen(PORT, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const errs = []; const W = Number(process.env.W || 1000), H = Number(process.env.H || 560);
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/(.*)/, r => { const rel = r.request().url().split('three@0.170.0/')[1].split('?')[0]; r.fulfill({ body: fs.readFileSync(NM + rel), contentType: 'application/javascript' }); });
  const outDir = path.join(ROOT, 'test/out'); fs.mkdirSync(outDir, { recursive: true });
  const shot = async (name) => { await p.screenshot({ path: path.join(outDir, `${game}_${name}.png`) }); };
  try {
    await p.goto(`http://localhost:${PORT}/${game === 'index' ? 'index.html' : 'games/' + game + '.html'}`);
    for (let i = 0; i < 60; i++) { await p.waitForTimeout(500); const ready = await p.evaluate(() => window.__READY === true || (document.getElementById('loading') ? document.getElementById('loading').hidden : !document.querySelector('.ig-loading'))); if (ready) break; }
    await p.waitForTimeout(600);
    if (scriptPath) { const fn = require(path.resolve(scriptPath)); await fn(p, shot); } else await shot('default');
  } catch (e) { errs.push('HARNESS ' + e.message.split('\n')[0]); }
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 15).join('\n') : 'NO_ERRORS');
  await b.close(); server.close();
});
