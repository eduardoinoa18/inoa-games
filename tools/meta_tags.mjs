// Writes search + link-preview tags (description, Open Graph, Twitter card) into the hub source and every game page,
// between <!--meta--> … <!--/meta--> markers right after <title>, and renders the hub's 1200×630 share image.
// Descriptions come from the hub tiles (hub-src/hub.js) so there is one source of truth. Run from repo root, then rebuild the hub:
//   node tools/meta_tags.mjs && python3 tools/build_hub.py
import fs from 'node:fs';
import sharp from 'sharp';

const SITE = JSON.parse(fs.readFileSync('platform.json', 'utf8')).siteUrl || 'https://inoa-games.vercel.app';
const FILES = { pact: 'pixelpact', tide: 'tidelines' }; // tile id → page (Match shares pixelpact)
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const block = ({ title, desc, url, img, w, h }) => `<!--meta--><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Inoa Games"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${img}"><meta property="og:image:width" content="${w}"><meta property="og:image:height" content="${h}"><meta name="twitter:card" content="summary_large_image"><!--/meta-->`;
const put = (file, html) => {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/<!--meta-->[\s\S]*?<!--\/meta-->\n?/, '');
  if (!/<\/title>/.test(s)) throw new Error('no <title> in ' + file);
  s = s.replace(/<\/title>/, '</title>\n' + html);
  fs.writeFileSync(file, s);
};

// tiles: { id, name, desc } from hub-src/hub.js (single-quoted JS strings with \' escapes)
const src = fs.readFileSync('hub-src/hub.js', 'utf8'), str = k => `${k}: '((?:[^'\\\\]|\\\\.)*)'`;
const tiles = [...src.matchAll(new RegExp(`\\{ ${str('id')}, ${str('kind')}, ${str('name')}, ${str('desc')}`, 'g'))]
  .map(m => ({ id: m[1], name: m[3].replace(/\\'/g, "'"), desc: m[4].replace(/\\'/g, "'") }));
const seen = new Set();
for (const t of tiles) {
  const f = FILES[t.id] || t.id; if (t.id === 'match' || seen.has(f) || !fs.existsSync(`games/${f}.html`)) continue; seen.add(f);
  const desc = t.desc.length > 200 ? t.desc.slice(0, t.desc.lastIndexOf(' ', 196)) + '…' : t.desc;
  put(`games/${f}.html`, block({ title: `${t.name} · Inoa Games`, desc: desc + ' Free in your browser.', url: `${SITE}/games/${f}.html`, img: `${SITE}/thumbs/${f}.jpg`, w: 640, h: 360 }));
}
// GAME_COUNT=<n> overrides the count in the hub copy (e.g. while a game being built on another branch is already announced)
const COUNT = +process.env.GAME_COUNT || seen.size;
put('hub-src/head.html', block({ title: 'Inoa Games: free games for the whole family', desc: `${COUNT} free browser games for phones, laptops and TVs: co-op adventures, racing, party games, cozy puzzles and a kids' allergy-safety game. English and Spanish. No download.`, url: `${SITE}/`, img: `${SITE}/thumbs/og-hub.jpg`, w: 1200, h: 630 }));

// hub share image: six game thumbnails around a title band
const W = 1200, H = 630, cw = 400, ch = 225, pics = ['pixelpact', 'drift', 'safari', 'brew', 'tidelines', 'trivia'], comps = [];
for (const [i, n] of pics.entries()) comps.push({ input: await sharp(`thumbs/${n}.jpg`).resize(cw, ch).toBuffer(), left: (i % 3) * cw, top: i < 3 ? 0 : H - ch });
comps.push({ input: Buffer.from(`<svg width="${W}" height="${H - 2 * ch}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0b2a3a"/><text x="600" y="92" font-family="DejaVu Sans, sans-serif" font-weight="900" font-size="72" fill="#ffd166" text-anchor="middle">Inoa Games</text><text x="600" y="145" font-family="DejaVu Sans, sans-serif" font-weight="700" font-size="32" fill="#ffffff" text-anchor="middle">${COUNT} free games · phones, laptops, TVs · English + Español</text></svg>`), left: 0, top: ch });
await sharp({ create: { width: W, height: H, channels: 3, background: '#0b2a3a' } }).composite(comps).jpeg({ quality: 82 }).toFile('thumbs/og-hub.jpg');
console.log('meta tags:', seen.size, 'game pages,', COUNT, 'in the hub copy; share image thumbs/og-hub.jpg');
