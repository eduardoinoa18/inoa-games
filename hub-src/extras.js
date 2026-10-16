/* ---------- Hub extras: per-game stats on tiles, Continue row, daily challenge, EN/ES, hero card share ---------- */
// Profile data comes from engine results() (localStorage 'inoa.profile', v2): games[id] = {plays, best, last}, recent: [ids], lang.
const GID = { pact: 'pixelpact', match: 'pixelpact', tide: 'tidelines' }; // tile id -> results gameId
const gid = g => GID[g.id] || g.id;
const STAT = {
  pact: ['Best level', 'Mejor nivel', '', false], match: null, safari: ['Best score', 'Mejor puntuación', '', false], depths: null,
  builders: ['Biggest island', 'Isla más grande', ' pcs', false], tide: ['Best turf', 'Mejor territorio', '%', false], drift: ['Best lap', 'Mejor vuelta', ' s', true],
  fit: ['Fastest tidy', 'Orden más rápido', ' s', true], tray: ['Best score', 'Mejor puntuación', '', false], junk: ['Fastest restore', 'Restauración más rápida', ' s', true],
  brew: ['Café hearts', 'Corazones', '', false], trivia: ['Best solo', 'Mejor en solitario', '', false], draw: ['Most sketches', 'Más bocetos', '', false], runner: ['Best run', 'Mejor carrera', ' m', false]
};
// Daily challenge goal per game (deterministic: the same game for everyone on a given local date)
const DAILY = {
  pact: ['Clear a level of Pixel Pact', 'Supera un nivel de Pixel Pact'], safari: ['Finish a safari level', 'Termina un nivel del safari'], depths: ['Dive into the Depths', 'Explora las Profundidades'],
  builders: ['Build and sleep one island day', 'Construye y duerme un día en la isla'], tide: ['Play a Tide Lines match', 'Juega una partida de Tide Lines'], drift: ['Race a Grand Prix', 'Corre un Gran Premio'],
  fit: ['Tidy one box perfectly', 'Ordena una caja a la perfección'], tray: ['Deliver a tray course', 'Lleva una bandeja hasta el final'], junk: ['Restore a junker', 'Restaura un cacharro'],
  brew: ['Serve a cozy shift', 'Sirve un turno acogedor'], trivia: ['Play a round of trivia', 'Juega una ronda de trivia'], draw: ['Finish a Speed Sketch round', 'Termina una ronda de Boceto Rápido'], runner: ['Run today’s daily course', 'Corre la ruta del día']
};
const ES_GAMES = {
  pact: ['Cuatro héroes, una salida. Recorran juntos las islas Emberwood, revivan a sus amigos y venzan a Big Claw.', ['1–4 jugadores', '3–5 min', 'Jugar']],
  match: ['Daño, empujones y fuera del ring. Gana el último héroe en pie. Los bots llenan los huecos.', ['1–4 jugadores', '2–3 min', 'Jugar']],
  safari: ['Un safari 3D donde alimentas a tu mascota solo con lo que es seguro para ti. Etiquetas leídas en voz alta, rol de Escáner para adultos y práctica de rescate paso a paso.', ['1–2 jugadores', '5 niveles', 'Jugar']],
  depths: ['Bajo las islas con aliados IA, un segundo jugador o teléfonos. Dos actos de ocho salas, 19 dones distintos en cada partida, un capitán ahogado y un coloso de cristal.', ['1–4 jugadores', '10–15 min', '10+ años']],
  builders: ['Construye un hogar en tu isla, navega a dos islas nuevas, recibe vecinos en casitas, cumple sus deseos y completa tus postales. 21 misiones, compártela con un código.', ['Solo', '10–30 min', '8+ años']],
  tide: ['Batallas de pintura con cañones de agua en tres arenas: un muelle soleado, un jardín en la azotea y un mercado isleño. Cubre más suelo o domina las tres pozas de marea. Bots o hasta 8 teléfonos.', ['1–8 jugadores', '2,5 min', '8+ años']],
  drift: ['Derrapa para turbos, usa objetos y compite contra cinco rivales en cuatro pistas, gana la Copa Isla o corre contra el fantasma de tu mejor vuelta.', ['Solo vs 5 bots', '3 min']],
  fit: ['20 cajas en 4 cuartos acogedores: loncheras, cajas de herramientas, costureros y maletas. Cada cosa tiene su hueco perfecto y su propio clic. Modo Zen para relajarte.', ['Solo', '1–2 min']],
  tray: ['Lleva una torre tambaleante de comida por una pista de obstáculos. Caerse es lo divertido. Turnos con amigos.', ['1–4 jugadores', '45 s']],
  junk: ['Lava, lija, pinta y pule 16 coches y barcos oxidados con el dedo. Añade rayas, estrellas y ruedas brillantes, cumple pedidos y saca tarjetas con foto.', ['Solo', '2–4 min']],
  brew: ['Cultiva hierbas en tiempo real, incluso cuando no estás, prepara 16 tés para clientes con pequeñas historias y sube tu café hasta el nivel 10: plantas de temporada, un pianito y un perrito. Aquí nadie se enoja.', ['Solo', 'Visitas cortas']],
  trivia: ['Un plató de concurso en 3D con pulsadores para hasta cuatro jugadores en un dispositivo, o juega contra bots. Inglés y español.', ['1–4 jugadores', '5 min']],
  draw: ['Pasa el dispositivo, dibuja la palabra secreta y que los demás adivinen. También Boceto Rápido y Teléfono.', ['2–8 jugadores', '5 min']],
  runner: ['Un corredor por el paseo con una ruta diaria igual para todos. Compite contra el fantasma de tu mejor carrera.', ['Solo', '1–2 min']]
};
const HUB_ES = { // static page text: English source → Spanish (applied by setLang)
  'Games': 'Juegos', 'Your hero': 'Tu héroe', 'Party': 'En grupo', 'FAQ': 'Preguntas', 'Play': 'Jugar',
  'One link · no download · free to play': 'Un enlace · sin descargas · gratis',
  'A hub of quick, friendly browser games for one player or a whole couch. Build a hero once and grow it in every game, from the Pixel Pact islands to a 60-second drawer restock.': 'Juegos rápidos y amables en el navegador para una persona o todo el sofá. Crea un héroe y hazlo crecer en cada juego.',
  'Play Pixel Pact': 'Jugar Pixel Pact', 'See the games': 'Ver los juegos',
  'All ages': 'Todas las edades', 'no stranger chat': 'sin chat con extraños', 'Phone · laptop': 'Móvil · portátil', 'touch, keys, gamepad': 'táctil, teclado, mando', 'from day one': 'desde el primer día', 'Free': 'Gratis', 'while in preview': 'durante la vista previa',
  'The shelf': 'La estantería', 'Thirteen games, one couch, one hero': 'Trece juegos, un sofá, un héroe',
  'Co-op adventure and a brawler for game night, four signature 3D titles with real depth for adults, a kids’ allergy safari for families, and cozy one-minute games for the bus. Every one of them pays XP and coins into the same hero.': 'Aventura cooperativa y lucha para la noche de juegos, títulos 3D con profundidad, un safari sobre alergias para familias y juegos cortos y tranquilos. Todos dan XP y monedas al mismo héroe.',
  'Create your hero': 'Crea tu héroe', 'Make one hero. Grow it everywhere.': 'Un héroe. Crece en todas partes.',
  'Pick a class, shape the look, name it. Every game on the shelf adds XP and coins to the same hero, saved on this device.': 'Elige una clase, su aspecto y su nombre. Cada juego suma XP y monedas al mismo héroe, guardado en este dispositivo.',
  'New colors': 'Nuevos colores', 'New name': 'Nuevo nombre', 'Surprise me': 'Sorpréndeme',
  'Play together': 'Jugar juntos', 'One screen, a few friends, no setup.': 'Una pantalla, unos amigos, sin configurar nada.',
  'What is here, what is next': 'Lo que hay y lo que viene', 'Questions people ask': 'Preguntas frecuentes',
  'games on the shelf': 'juegos en la estantería', 'hero everywhere': 'héroe en todos', 'players on one screen': 'jugadores en una pantalla', 'downloads ·': 'descargas ·', 'forced ads': 'anuncios',
  'Your hero in the 3D games': 'Tu héroe en los juegos 3D', 'Name': 'Nombre',
  'Continue playing': 'Seguir jugando', 'Daily challenge': 'Reto del día', 'Share hero card': 'Compartir tarjeta de héroe'
};
const isES = () => readProfile().lang === 'es';
const T2 = (en, es) => isES() ? es : en;
const fmtBest = (g, v) => { const s = STAT[g.id]; if (!s || v == null) return ''; const n = typeof v === 'number' ? (Math.round(v * 100) / 100) : v; return `${T2(s[0], s[1])}: ${n}${s[2]}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const dayNum = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const liveGames = () => GAMES.filter(g => g.live && g.id !== 'match');
const sameDay = (ts) => { if (!ts) return false; const a = new Date(ts), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* tile stats: best + plays from the profile */
function renderTileStats() {
  const P = readProfile();
  tiles.forEach(tl => { const g = tl.g, el = tl.el || (tl.el = tl.cn.parentNode); if (!el) return; let s = el.querySelector('.stats'); if (!s) { s = document.createElement('div'); s.className = 'stats'; el.querySelector('.body').appendChild(s); }
    const rec = P.games[gid(g)]; if (!rec || !rec.plays) { s.textContent = g.live ? T2('New to you', 'Nuevo para ti') : ''; s.classList.add('new'); return; }
    s.classList.remove('new'); const b = fmtBest(g, rec.best); s.textContent = `${T2('Played', 'Jugado')} ${rec.plays}×${b ? ' · ' + b : ''}`; });
}
/* continue row: recent games, most recent first */
function renderContinue() {
  const P = readProfile(), box = document.getElementById('continueRow'); if (!box) return;
  let ids = (P.recent || []).slice(); if (!ids.length) ids = Object.entries(P.games || {}).filter(([, r]) => r && r.last).sort((a, b) => b[1].last - a[1].last).map(([k]) => k);
  const list = ids.map(id => GAMES.find(g => gid(g) === id && g.live)).filter(Boolean).filter((g, i, a) => a.indexOf(g) === i).slice(0, 4);
  box.parentNode.hidden = !list.length; if (!list.length) return;
  box.innerHTML = list.map(g => { const r = P.games[gid(g)] || {}; const b = fmtBest(g, r.best); return `<a class="cont" href="${g.href}">${g.thumb ? `<img src="${g.thumb}" alt="" loading="lazy">` : '<span class="ph"></span>'}<span><b>${esc(g.name)}</b><small>${b || T2('Played', 'Jugado') + ' ' + (r.plays || 0) + '×'}</small></span><i>▶</i></a>`; }).join('');
}
/* daily challenge: deterministic per local date, completion = any finished round of that game today; +40 coins once */
function renderDaily() {
  const box = document.getElementById('dailyCard'); if (!box) return; const L = liveGames(); if (!L.length) return;
  const g = L[dayNum() % L.length], P = readProfile(), rec = P.games[gid(g)], key = today();
  let st = {}; try { st = JSON.parse(localStorage.getItem('inoa.daily') || '{}'); } catch (e) { }
  if (st.date !== key) st = { date: key, id: g.id, done: false, paid: false };
  if (rec && sameDay(rec.last)) st.done = true;
  if (st.done && !st.paid) { P.coins = (P.coins || 0) + 40; writeProfile(P); st.paid = true; }
  try { localStorage.setItem('inoa.daily', JSON.stringify(st)); } catch (e) { }
  const goal = DAILY[g.id] || ['Play today', 'Juega hoy'];
  box.innerHTML = `<div class="dc-k">${T2('Daily challenge', 'Reto del día')} · ${new Date().toLocaleDateString(isES() ? 'es' : 'en', { weekday: 'long', month: 'short', day: 'numeric' })}</div><div class="dc-main">${g.thumb ? `<img src="${g.thumb}" alt="">` : ''}<div><b>${T2(goal[0], goal[1])}</b><p>${esc(g.name)} · ${st.done ? T2('Done! +40 coins added to your hero', '¡Hecho! +40 monedas para tu héroe') : T2('Finish it today for +40 coins', 'Termínalo hoy y gana 40 monedas')}</p></div>${st.done ? '<span class="dc-ok">✓</span>' : `<a class="btn" href="${g.href}">${T2('Play', 'Jugar')}</a>`}</div><small class="dc-note">${T2('Same game for everyone today. Saved on this device only, so it is for fun, not a leaderboard.', 'El mismo juego para todos hoy. Se guarda solo en este dispositivo: es para divertirse, no un ranking.')}</small>`;
  box.classList.toggle('done', !!st.done);
}
/* EN/ES for the whole hub (shared with every game through the profile) */
function setLang(l) { const P = readProfile(); P.lang = l; writeProfile(P); applyLang(); }
function applyLang() {
  const es = isES(); document.documentElement.lang = es ? 'es' : 'en';
  document.querySelectorAll('nav a, nav .btn, header .eyebrow, header .lead, header .cta a, .band span, .proof span, .sec-head .eyebrow, .sec-head h2, .sec-head p, .stage .row .chip, #contHead, #heroShare, #h3Head, #h3NameL').forEach(el => {
    if (el.children.length && !el.matches('.band span, .proof span')) return;
    if (el.matches('.proof span')) { [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(tn => { tn.en ??= tn.textContent; const k = tn.en.trim(); tn.textContent = es && HUB_ES[k] ? tn.en.replace(k, HUB_ES[k]) : tn.en; }); return; }
    if (el.matches('.band span')) { const b = el.querySelector('b'); const tn = [...el.childNodes].find(n => n.nodeType === 3); if (b) { b.dataset.en ??= b.textContent; b.textContent = es ? (HUB_ES[b.dataset.en] || b.dataset.en) : b.dataset.en; } if (tn) { tn.en ??= tn.textContent; tn.textContent = es ? (HUB_ES[tn.en] || tn.en) : tn.en; } return; }
    el.dataset.en ??= el.textContent.trim(); const tr = HUB_ES[el.dataset.en]; el.textContent = es && tr ? tr : el.dataset.en; });
  tiles.forEach(tl => { const g = tl.g, el = tl.cn.parentNode, e2 = ES_GAMES[g.id]; if (!el || !e2) return; const p = el.querySelector('.body p'), m = el.querySelector('.meta'); p.dataset.en ??= p.textContent; m.dataset.en ??= m.innerHTML; p.textContent = es ? e2[0] : p.dataset.en; m.innerHTML = es ? e2[1].map(x => `<span>${x}</span>`).join('') : m.dataset.en; });
  document.querySelectorAll('#langToggle button').forEach(b => b.classList.toggle('on', b.dataset.l === (es ? 'es' : 'en')));
  renderTileStats(); renderContinue(); renderDaily(); renderHero3d(); if (typeof renderProfile === 'function') renderProfile();
}
/* hero card share image (1080x1350 PNG drawn locally; no server) */
async function heroCard() {
  const P = readProfile(), L = heroLv(P.xp), c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 1350); gr.addColorStop(0, '#0b2a3a'); gr.addColorStop(.55, '#1f5b6e'); gr.addColorStop(1, '#f2977a'); x.fillStyle = gr; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = 'rgba(255,198,92,.9)'; x.beginPath(); x.arc(540, 820, 300, Math.PI, 0); x.fill(); x.fillStyle = '#0f5c6e'; x.fillRect(0, 820, 1080, 530);
  for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(255,198,92,.55)'; x.fillRect(540 - 260 + i * 40, 860 + i * 34, 520 - i * 80, 10); }
  x.save(); drawHero(x, heroOf(), { anim: 'win', t: 30 }, 540, 820, 1, 9); x.restore();
  x.textAlign = 'center'; x.fillStyle = '#effaf6'; x.font = '900 46px Unbounded, Manrope, sans-serif'; x.fillText('INOA GAMES', 540, 110);
  x.font = '900 84px Unbounded, Manrope, sans-serif'; x.fillText((P.name || maker.name || 'Hero').slice(0, 22), 540, 230);
  x.font = '800 40px Manrope, sans-serif'; x.fillStyle = '#ffc65c'; x.fillText(`${T2('Hero level', 'Nivel de héroe')} ${L.lv}  ·  🪙 ${P.coins}  ·  🎮 ${Object.keys(P.games || {}).length}`, 540, 300);
  const best = Object.entries(P.games || {}).filter(([, r]) => r && r.plays).sort((a, b) => b[1].plays - a[1].plays).slice(0, 3);
  x.font = '800 36px Manrope, sans-serif'; x.fillStyle = '#effaf6'; best.forEach(([id, r], i) => { const g = GAMES.find(q => gid(q) === id); x.fillText(`${g ? g.name : id} · ${r.plays}×`, 540, 1080 + i * 56); });
  x.font = '700 30px Manrope, sans-serif'; x.fillStyle = 'rgba(239,250,246,.8)'; x.fillText(location.host || 'Inoa Games', 540, 1300);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return;
  const file = new File([blob], 'inoa-hero.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Inoa Games' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inoa-hero.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* 3D hero picker: one of the six friendly rigged models + an accent colour + a name, stored in the profile (profile.hero / profile.name).
   3D games read it through E.hero() to pick the player's character. */
const HERO_MODELS = [['skater-female', 'Isla'], ['skater-male', 'Rafa'], ['survivor-female', 'Yara'], ['survivor-male', 'Mateo'], ['cyborg-female', 'Nova'], ['male', 'Dante']];
const HERO_COLORS = ['#ff6b6b', '#ffd166', '#2fbf8a', '#5bb8ff', '#c9b8ff', '#ff9a3c', '#ff8ad8', '#e8eef4'];
function renderHero3d() {
  const P = readProfile(), H = Object.assign({ model: 'skater-female', color: '#5bb8ff' }, P.hero || {});
  const mb = document.getElementById('h3Models'), cb = document.getElementById('h3Colors'), nm = document.getElementById('h3Name'); if (!mb) return;
  mb.innerHTML = HERO_MODELS.map(([m, n]) => `<button role="radio" aria-checked="${m === H.model}" class="${m === H.model ? 'on' : ''}" data-m="${m}" aria-label="${n}" title="${n}"><img src="thumbs/heroes/${m}.png" alt=""></button>`).join('');
  cb.innerHTML = HERO_COLORS.map(c => `<button role="radio" aria-checked="${c === H.color}" class="${c === H.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
  if (document.activeElement !== nm) nm.value = P.name || '';
}
function saveHero(patch) { const P = readProfile(); P.hero = Object.assign({ model: 'skater-female', color: '#5bb8ff' }, P.hero || {}, patch); writeProfile(P); renderHero3d(); }
(function initHero3d() {
  const mb = document.getElementById('h3Models'); if (!mb) return;
  mb.addEventListener('click', e => { const b = e.target.closest('button'); if (b) saveHero({ model: b.dataset.m }); });
  document.getElementById('h3Colors').addEventListener('click', e => { const b = e.target.closest('button'); if (b) saveHero({ color: b.dataset.c }); });
  const nm = document.getElementById('h3Name'); nm.addEventListener('input', () => { const P = readProfile(); P.name = nm.value.replace(/[<>]/g, '').slice(0, 18); writeProfile(P); maker.name = P.name || maker.name; mkName.textContent = maker.name; if (typeof renderProfile === 'function') renderProfile(); });
  nm.addEventListener('keydown', e => e.stopPropagation());
  renderHero3d();
})();
(function initExtras() {
  const nav = document.querySelector('nav .wrap'); if (nav && !document.getElementById('langToggle')) { const t = document.createElement('div'); t.id = 'langToggle'; t.setAttribute('role', 'group'); t.setAttribute('aria-label', 'Language / Idioma'); t.innerHTML = '<button data-l="en" aria-label="English">EN</button><button data-l="es" aria-label="Español">ES</button>'; nav.insertBefore(t, nav.querySelector('.btn')); t.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLang(b.dataset.l); }); }
  const hs = document.getElementById('heroShare'); if (hs) hs.addEventListener('click', heroCard);
  applyLang();
  addEventListener('focus', applyLang); document.addEventListener('visibilitychange', () => { if (!document.hidden) applyLang(); });
  window.__HUB = { renderDaily, renderContinue, renderTileStats, setLang, heroCard, dayNum, liveGames };
})();
