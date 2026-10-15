// Splits the base64 JSON packs (packs/<game>.json) into real files the browser can cache and stream:
//   packs/assets/models/<name>.glb   meshopt-compressed (only kept when smaller), shared by every game
//   packs/assets/hdri/<name>.hdr     downsampled RGBE (env maps are only used for soft reflections)
//   packs/<game>/manifest.json       { v, game, models: {name: url}, hdri: {name: url}, lazy: [...], bytes }
// The JSON packs stay in place as the fallback. Run from repo root:  node tools/build_packs.mjs [game ...]
// Options: --hdr-width 512   --no-meshopt   --lazy <game>:<model>,<model>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const h8 = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 8); // cache-busting query: the SW caches assets forever
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PACKS = path.join(ROOT, 'packs'), OUT = path.join(PACKS, 'assets');
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const HDR_W = Number(opt('--hdr-width', 512)), MESHOPT = !args.includes('--no-meshopt');
const LAZY = {}; for (let i = 0; i < args.length; i++) if (args[i] === '--lazy') { const [g, list] = args[i + 1].split(':'); LAZY[g] = list.split(','); }
const games = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
fs.mkdirSync(path.join(OUT, 'models'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'hdri'), { recursive: true });

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/* ---------- RGBE (.hdr) read / downsample / write ---------- */
function readHDR(buf) {
  let p = 0; const line = () => { let s = ''; while (buf[p] !== 10) s += String.fromCharCode(buf[p++]); p++; return s; };
  let l; while ((l = line()) !== '') { /* header */ }
  const m = line().match(/-Y (\d+) \+X (\d+)/); const H = +m[1], W = +m[2]; const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    if (buf[p] === 2 && buf[p + 1] === 2 && !(buf[p + 2] & 0x80)) { p += 4; const row = new Uint8Array(W * 4);
      for (let c = 0; c < 4; c++) { let x = 0; while (x < W) { let n = buf[p++]; if (n > 128) { n -= 128; const v = buf[p++]; while (n--) row[(x++) * 4 + c] = v; } else while (n--) row[(x++) * 4 + c] = buf[p++]; } }
      px.set(row, y * W * 4);
    } else { px.set(buf.subarray(p, p + W * 4), y * W * 4); p += W * 4; }
  }
  return { W, H, px };
}
const toF = (r, g, b, e) => { if (!e) return [0, 0, 0]; const f = Math.pow(2, e - 136); return [r * f, g * f, b * f]; };
function toRGBE(r, g, b) { const v = Math.max(r, g, b); if (v < 1e-32) return [0, 0, 0, 0]; const e = Math.ceil(Math.log2(v) + 1e-9); const f = 256 / Math.pow(2, e); return [Math.min(255, Math.floor(r * f)), Math.min(255, Math.floor(g * f)), Math.min(255, Math.floor(b * f)), e + 128]; }
function downsample({ W, H, px }, w) { if (W <= w) return { W, H, px }; const h = Math.round(H * w / W), k = W / w, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let R = 0, G = 0, B = 0, n = 0;
    for (let yy = Math.floor(y * k); yy < Math.floor((y + 1) * k); yy++) for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) { const i = (yy * W + xx) * 4; const [r, g, b] = toF(px[i], px[i + 1], px[i + 2], px[i + 3]); R += r; G += g; B += b; n++; }
    out.set(toRGBE(R / n, G / n, B / n), (y * w + x) * 4); }
  return { W: w, H: h, px: out };
}
function writeHDR({ W, H, px }) { const parts = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'latin1')];
  for (let y = 0; y < H; y++) { const out = [2, 2, W >> 8, W & 255];
    for (let c = 0; c < 4; c++) { const ch = []; for (let x = 0; x < W; x++) ch.push(px[(y * W + x) * 4 + c]); let x = 0;
      while (x < W) { let run = 1; while (x + run < W && run < 127 && ch[x + run] === ch[x]) run++;
        if (run >= 3) { out.push(128 + run, ch[x]); x += run; } else { let n = 0; const st = x; while (x < W && n < 128 && !(x + 2 < W && ch[x] === ch[x + 1] && ch[x] === ch[x + 2])) { x++; n++; } out.push(n, ...ch.slice(st, st + n)); } } }
    parts.push(Buffer.from(out)); }
  return Buffer.concat(parts);
}

/* ---------- models ---------- */
const doneModels = new Map(), doneHdri = new Map();
async function writeModel(name, bytes) {
  if (doneModels.has(name)) return doneModels.get(name);
  const file = path.join(OUT, 'models', name + '.glb'); let out = bytes, how = 'raw';
  if (MESHOPT) { try { const doc = await io.readBinary(new Uint8Array(bytes)); await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' })); const c = Buffer.from(await io.writeBinary(doc)); if (c.length < bytes.length * .9) { out = c; how = 'meshopt'; } } catch (e) { console.warn('  meshopt failed for', name, e.message); } }
  fs.writeFileSync(file, out); const r = { url: 'models/' + name + '.glb?h=' + h8(out), bytes: out.length, raw: bytes.length, how }; doneModels.set(name, r); return r;
}
function writeHdri(name, bytes) {
  if (doneHdri.has(name)) return doneHdri.get(name);
  const img = downsample(readHDR(bytes), HDR_W); const out = writeHDR(img); fs.writeFileSync(path.join(OUT, 'hdri', name + '.hdr'), out);
  const r = { url: 'hdri/' + name + '.hdr?h=' + h8(out), bytes: out.length, raw: bytes.length, size: `${img.W}x${img.H}` }; doneHdri.set(name, r); return r;
}

const list = games.length ? games : fs.readdirSync(PACKS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
let totRaw = 0, totNew = 0;
for (const game of list) {
  const pack = JSON.parse(fs.readFileSync(path.join(PACKS, game + '.json'), 'utf8'));
  const man = { v: 1, game, base: '../assets/', models: {}, hdri: {}, lazy: LAZY[game] || [], bytes: 0 };
  for (const [name, b64] of Object.entries(pack.models || {})) { const r = await writeModel(name, Buffer.from(b64, 'base64')); man.models[name] = r.url; man.bytes += r.bytes; }
  for (const [name, b64] of Object.entries(pack.hdri || {})) { const r = writeHdri(name, Buffer.from(b64, 'base64')); man.hdri[name] = r.url; man.bytes += r.bytes; }
  fs.mkdirSync(path.join(PACKS, game), { recursive: true }); fs.writeFileSync(path.join(PACKS, game, 'manifest.json'), JSON.stringify(man, null, 1));
  const json = fs.statSync(path.join(PACKS, game + '.json')).size; totRaw += json; totNew += man.bytes;
  console.log(`${game.padEnd(10)} json ${(json / 1e6).toFixed(2)} MB  ->  files ${(man.bytes / 1e6).toFixed(2)} MB  (${Object.keys(man.models).length} models, ${Object.keys(man.hdri).length} hdri)`);
}
let sm = 0, sr = 0; for (const r of doneModels.values()) { sm += r.bytes; sr += r.raw; } let hm = 0, hr = 0; for (const r of doneHdri.values()) { hm += r.bytes; hr += r.raw; }
console.log(`unique models: ${doneModels.size}  ${(sr / 1e6).toFixed(2)} MB raw -> ${(sm / 1e6).toFixed(2)} MB (${[...doneModels.values()].filter(r => r.how === 'meshopt').length} meshopt)`);
console.log(`unique hdri: ${doneHdri.size}  ${(hr / 1e6).toFixed(2)} MB -> ${(hm / 1e6).toFixed(2)} MB`);
console.log(`per-game download total: ${(totRaw / 1e6).toFixed(1)} MB json -> ${(totNew / 1e6).toFixed(1)} MB files (before HTTP compression and cross-game cache sharing)`);
