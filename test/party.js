// Multiplayer test harness: serves the repo, runs a local Supabase-Realtime look-alike (test/party/mock-realtime.js), and lets a
// scenario open several pages (a host screen + phone pads / online players) in one browser.
// usage: node test/party.js test/party_<scenario>.js
// scenario exports async ({ open, shot, wait, log }) => {...}
//   open(path, {w,h}) -> Playwright page with window.INOA_NET pointing at the local signaling server
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const mockRealtime = require('./party/mock-realtime.js');
const ROOT = path.join(__dirname, '..'), NM = path.join(ROOT, 'node_modules');
const PORT = Number(process.env.PORT || 8767), SIG = Number(process.env.SIG || 9017);
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => { let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } const body = fs.readFileSync(f); res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(body); });
const scenario = require(path.resolve(process.argv[2]));
const name = path.basename(process.argv[2], '.js');
const peerServer = mockRealtime(SIG); // local Supabase Realtime look-alike (signaling + relay)
server.listen(PORT, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const errs = []; const outDir = path.join(ROOT, 'test/out'); fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  const open = async (url, { w = 1000, h = 560, label, init } = {}) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 700, serviceWorkers: 'block' }); // SW requests bypass page.route (three.js → node_modules); offline is covered by test/pwa.js
    const p = await ctx.newPage(); const tag = label || `p${++n}`;
    if (init) await p.addInitScript(init);
    await p.addInitScript(sig => { window.INOA_NET = { realtimeUrl: 'ws://127.0.0.1:' + sig + '/realtime/v1/websocket', apikey: 'test-anon-key', config: { iceServers: [] }, get autoApprove() { return !window.__NO_AUTO_APPROVE; } }; }, SIG);
    p.on('pageerror', e => errs.push(`[${tag}] PAGEERROR ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|favicon|Could not load|net::/.test(m.text())) errs.push(`[${tag}] console: ${m.text().slice(0, 300)}`); });
    await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/(.*)/, r => { const rel = r.request().url().split('three@0.170.0/')[1].split('?')[0]; r.fulfill({ body: fs.readFileSync(path.join(NM, 'three', rel)), contentType: 'application/javascript' }); });
    await p.route(/cdn\.jsdelivr\.net\/npm\/peerjs@[^/]+\/dist\/peerjs\.min\.js/, r => r.fulfill({ body: fs.readFileSync(path.join(NM, 'peerjs/dist/peerjs.min.js')), contentType: 'application/javascript' }));
    await p.route(/cdn\.jsdelivr\.net\/npm\/qrcode-generator@[^/]+\/qrcode\.js/, r => r.fulfill({ body: fs.readFileSync(path.join(NM, 'qrcode-generator/qrcode.js')), contentType: 'application/javascript' }));
    await p.goto(`http://localhost:${PORT}/${url}`);
    return p;
  };
  const shot = (p, nm) => p.screenshot({ path: path.join(outDir, `${name}_${nm}.png`) });
  const wait = async (p, fn, arg, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await p.waitForTimeout(250); } throw new Error('timeout waiting for ' + fn.toString().slice(0, 90)); };
  const ready = p => wait(p, () => window.__READY === true || !document.querySelector('.ig-loading'), null, 60000);
  try { await scenario({ open, shot, wait, ready, log: (...a) => console.log(...a) }); }
  catch (e) { errs.push('HARNESS ' + e.message.split('\n')[0]); }
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 20).join('\n') : 'NO_ERRORS');
  await b.close(); server.close(); try { peerServer.close?.(); } catch (e) { } process.exit(0);
});
