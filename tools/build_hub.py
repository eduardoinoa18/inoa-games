#!/usr/bin/env python3
"""Builds index.html (the Inoa Games front page) from hub-src/. Run from repo root: python3 tools/build_hub.py
Tiles link to games/<file>.html in the same artifact; a game is LIVE if its page exists;
tile art uses thumbs/<file>.jpg screenshots when present; a hero panel reads the shared
profile (localStorage 'inoa.profile') that every game writes through results()."""
import os, re, json
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); HUB = os.path.join(HERE, 'hub-src')
FILES = {'pact': 'pixelpact', 'match': 'pixelpact', 'tide': 'tidelines'}
head = open(f'{HUB}/head.html').read()
head = head.replace('/*BASE*/', open(f'{HUB}/base.css').read().replace('<style>', '').replace('</style>', ''))
head = head.replace('/*RIG*/', open(f'{HUB}/rig.js').read() + '\n' + open(f'{HUB}/bg.js').read())
js = open(f'{HUB}/hub.js').read()

live = {}
for gid in re.findall(r"\{ id: '([a-z]+)'", js):
    f = FILES.get(gid, gid)
    live[gid] = {'file': f, 'live': os.path.exists(f'{HERE}/games/{f}.html'), 'thumb': os.path.exists(f'{HERE}/thumbs/{f}.jpg')}

# rewrite the GAMES array entries: href, status, thumbs
def fix(m):
    gid = m.group(1); info = live[gid]; entry = m.group(0)
    entry = re.sub(r", href: '[^']*'", '', entry)
    entry = re.sub(r", st: '[^']*'", '', entry); entry = re.sub(r", live: true", '', entry)
    extra = f", href: 'games/{info['file']}.html', st: '{'PLAY' if info['live'] else 'SOON'}'" + (", live: true" if info['live'] else '') + (f", thumb: 'thumbs/{info['file']}.jpg'" if info['thumb'] else '')
    return entry[:-2] + extra + ' },'
js = re.sub(r"  \{ id: '([a-z]+)'.*? \},", fix, js)
js = js.replace("'Playable now'", "'Play now'")
# same-tab navigation, thumbnail images
js = js.replace("d.href = g.href; d.target = '_blank'; d.rel = 'noopener';", "d.href = g.live ? g.href : '#shelf';")
js = js.replace("const cn = document.createElement('canvas'); d.appendChild(cn);",
                "const cn = document.createElement('canvas'); if (g.thumb) { const im = document.createElement('img'); im.src = g.thumb; im.alt = g.name + ' screenshot'; im.loading = 'lazy'; im.className = 'thumb'; d.appendChild(im); } else d.appendChild(cn);")
js = js.replace("(ILLO[tl.g.id] || ILLO.pact)(c, W / dp, H / dp, frame + i * 31); c.restore(); });",
                "(ILLO[tl.g.id] || ILLO.pact)(c, W / dp, H / dp, frame + i * 31); c.restore(); });")
js = js.replace("const r = tl.cn.getBoundingClientRect();", "if (tl.g.thumb) return; const r = tl.cn.getBoundingClientRect();")
# hero creator writes the shared profile; hero panel reads it
js = js.replace("/* ---------- Hero maker", """/* ---------- Shared hero profile (every game adds XP/coins) ---------- */
function readProfile() { try { return Object.assign({ name: '', xp: 0, coins: 0, games: {} }, JSON.parse(localStorage.getItem('inoa.profile') || '{}')); } catch (e) { return { name: '', xp: 0, coins: 0, games: {} }; } }
function writeProfile(p) { try { localStorage.setItem('inoa.profile', JSON.stringify(p)); } catch (e) { } }
function heroLv(xp) { let lv = 1, need = 100, x = xp; while (x >= need && lv < 50) { x -= need; lv++; need = Math.round(need * 1.12); } return { lv, into: x, need }; }
function renderProfile() { const p = readProfile(), L = heroLv(p.xp); const el = document.getElementById('heroStats'); if (!el) return; const played = Object.keys(p.games || {}).length; el.innerHTML = `<div class="hp-lv"><b>${L.lv}</b><small>Hero level</small></div><div class="hp-main"><div class="hp-name">${p.name || 'New hero'}</div><div class="bar"><i style="width:${Math.round(L.into / L.need * 100)}%"></i></div><div class="hp-row"><span>${L.into}/${L.need} XP</span><span>🪙 ${p.coins}</span><span>🎮 ${played} game${played === 1 ? '' : 's'} played</span></div></div>`; }
renderProfile(); addEventListener('focus', renderProfile); document.addEventListener('visibilitychange', () => { if (!document.hidden) renderProfile(); });
/* ---------- Hero maker""")
js = js.replace("const say = () => { mkName.textContent = maker.name; };", "const say = () => { mkName.textContent = maker.name; const p = readProfile(); p.name = maker.name; writeProfile(p); renderProfile(); };")

# markup: hero panel under the band, nav + copy tweaks
head = head.replace('<div class="band">', '''<section class="heropanel"><div class="wrap"><div class="hp" id="heroStats"></div></div></section>
<div class="band">''')
head = head.replace('</style>', '''.heropanel{padding-block:18px 0;background:var(--ink-2)}
.hp{display:flex;gap:16px;align-items:center;background:var(--glass);border:1px solid var(--line);padding:14px 18px;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.hp-lv{display:grid;place-items:center;min-width:72px;height:72px;background:var(--sun);color:var(--coral-ink)}
.hp-lv b{font-family:var(--f-display);font-size:30px;line-height:1}.hp-lv small{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.hp-main{flex:1;display:grid;gap:6px;min-width:0}.hp-name{font-family:var(--f-display);font-weight:800;font-size:18px}
.hp-row{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;font-weight:800;color:var(--mist);letter-spacing:.04em;text-transform:uppercase}
.game img.thumb{width:100%;height:150px;object-fit:cover;display:block;background:#0b2a3a}
.game.flag img.thumb{height:180px}
.game .st.live{background:var(--lagoon);color:var(--coral-ink)}
</style>''', 1)
head = head.replace('href="https://claude.ai/artifact/R39Es5YCcbYnxRhuoDboVg" target="_blank" rel="noopener"', 'href="games/pixelpact.html"')
head = head.replace('<!--', '<!--')
out = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + head.replace('<nav>', '</head><body>\n<nav>', 1) + js + '\n</body></html>\n'
open(f'{HERE}/index.html', 'w').write(out)
print('index.html', len(out), 'bytes;', ', '.join(f"{k}:{'LIVE' if v['live'] else 'soon'}{'+thumb' if v['thumb'] else ''}" for k, v in live.items()))
