// Kids World shell (docs/DECISIONS/0005-kids-world-shell.md): only what a second young-kids game would reuse.
//  - big targets: bigButton(), minTargetPx()           (every kid-facing control ≥ 64 px)
//  - voice first: instruct() / repeat() / repeatButton() / numberWord() (EN/ES through E.say, a repeat button)
//  - gentle feedback: success() / gentle() / chime() / praise() / tryAgain() / rewardOverlay() (never punitive, no timers)
//  - parent gate: parentGate() + guardLinks()          (press-and-hold 1.5 s, then a grown-up sum; guards settings + links out)
// Additive: imports the engine, changes nothing in it. Pair with engine/kids.css.
// Rules for kids' games built on this: no countdowns or lives by default, no chat, no links out without the gate, no data beyond the local save.
import * as E from './inoa3d.js';

const L = E.L;
const S = {
  repeat: { en: 'Hear it again', es: 'Escúchalo otra vez' },
  grownups: { en: 'For grown-ups', es: 'Para adultos' },
  hold: { en: 'Press and hold the button', es: 'Mantén presionado el botón' },
  holdBtn: { en: 'Hold', es: 'Mantén' },
  keep: { en: 'Keep holding…', es: 'Sigue presionando…' },
  sum: { en: 'What is {a} + {b}?', es: '¿Cuánto es {a} + {b}?' },
  nope: { en: 'Not quite. Here is a new one.', es: 'No exactamente. Aquí va otra.' },
  close: { en: 'Close', es: 'Cerrar' },
  why: { en: 'Settings and links that leave the game are for grown-ups.', es: 'Los ajustes y los enlaces que salen del juego son para adultos.' }
};

/* ---------------- numbers in words (spoken counting) ---------------- */
const NUM = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte']
};
// numberWord(1, 'es', 'f') → 'una' (Spanish feminine for "una burbuja"); counting aloud uses the plain form ("uno, dos, tres").
export function numberWord(n, lang = E.lang(), gender = 'm') { const w = (NUM[lang] || NUM.en)[n]; if (w == null) return String(n); if (lang === 'es' && gender === 'f') { if (n === 1) return 'una'; if (n === 21) return 'veintiuna'; } return w; }

/* ---------------- voice-first instructions ---------------- */
// A line is {en, es}, a plain string, or a function returning either (re-evaluated on repeat, so a language switch is honoured).
let _last = null; const _repeatBtns = new Set();
const lineText = line => { const v = typeof line === 'function' ? line() : line; return typeof v === 'string' ? v : L(v || ''); };
export function speak(line, { interrupt = true } = {}) { const txt = lineText(line); if (txt) E.say(txt, { interrupt }); return txt; }
// instruct(): speak the main instruction and remember it for the repeat button (which pulses to show it can be pressed).
export function instruct(line, opts = {}) { _last = line; for (const b of _repeatBtns) { b.classList.remove('kd-pulse'); void b.offsetWidth; b.classList.add('kd-pulse'); } return speak(line, opts); }
export function repeat() { return _last ? speak(_last) : ''; }
export function lastLine() { return _last ? lineText(_last) : ''; }
export function repeatButton({ cls = '' } = {}) {
  const b = bigButton({ icon: '🔊', label: L(S.repeat), cls: 'kd-repeat ' + cls, onClick: () => { E.audio(); E.SFX.click(); repeat(); } });
  _repeatBtns.add(b); return b;
}

/* ---------------- big targets ---------------- */
export function bigButton({ icon = '', text = '', label = '', cls = '', onClick } = {}) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'kd-big ' + cls;
  b.innerHTML = `${icon ? `<span class="kd-ico" aria-hidden="true">${icon}</span>` : ''}${text ? `<span class="kd-txt">${text}</span>` : ''}`;
  if (label || !text) b.setAttribute('aria-label', label || text || icon);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
// Smallest visible kid-facing target on the page (px), for tests: every .kd-big must be ≥ 64 × 64.
export function minTargetPx(root = document) { let m = Infinity; root.querySelectorAll('.kd-big').forEach(b => { const r = b.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(b).visibility !== 'hidden') m = Math.min(m, r.width, r.height); }); return m === Infinity ? 0 : Math.round(m); }

/* ---------------- gentle feedback ---------------- */
const PRAISE = [{ en: 'Great job!', es: '¡Muy bien!' }, { en: 'You did it!', es: '¡Lo lograste!' }, { en: 'Wonderful!', es: '¡Maravilloso!' }, { en: 'Super!', es: '¡Súper!' }, { en: 'Hooray!', es: '¡Bravo!' }, { en: 'Nice one!', es: '¡Qué bien!' }];
const TRY = [{ en: "Oops, that's okay!", es: '¡Uy, no pasa nada!' }, { en: 'Almost!', es: '¡Casi!' }, { en: 'Good try!', es: '¡Buen intento!' }, { en: "Let's look again.", es: 'Miremos otra vez.' }];
let _pi = 0, _ti = 0;
export const praise = () => PRAISE[(_pi++) % PRAISE.length];
export const tryAgain = () => TRY[(_ti++) % TRY.length];
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760, 2093];
// chime(i): a soft rising note (counting pops, party mode); never harsh.
export function chime(i = 0) { const f = PENTA[Math.max(0, i) % PENTA.length]; E.tone(f, .22, 'sine', .11); E.tone(f * 2, .12, 'triangle', .03, 0, .02); }
const bump = (el, cls) => { if (!el || E.reducedMotion()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
// success(): bright little arpeggio + a bounce on el. Returns a praise line to speak if the game wants one.
export function success({ el } = {}) { [659.25, 783.99, 1046.5].forEach((f, i) => E.tone(f, .2, 'triangle', .09, 0, i * .07)); bump(el, 'kd-yay'); return praise(); }
// gentle(): the "not that one" cue. A soft low boop and a wobble — no buzzer, no red, no lost lives.
export function gentle({ el } = {}) { E.tone(330, .18, 'sine', .08, -60); E.tone(262, .22, 'sine', .06, -30, .1); bump(el, 'kd-wobble'); return tryAgain(); }
// Celebration card (stars + a sticker). The game decides when to remove it; nothing here runs on a clock the child can lose to.
export function rewardOverlay({ stars = 3, max = 3, sticker = '', title = '' } = {}) {
  const d = document.createElement('div'); d.className = 'kd-reward'; d.setAttribute('role', 'status');
  d.innerHTML = `<div class="kd-reward-in">${title ? `<div class="kd-reward-t">${title}</div>` : ''}<div class="kd-stars">${Array.from({ length: max }, (_, i) => `<span class="${i < stars ? 'on' : 'off'}" style="animation-delay:${.15 + i * .22}s">⭐</span>`).join('')}</div>${sticker ? `<div class="kd-sticker" style="animation-delay:${.2 + max * .22}s">${sticker}</div>` : ''}</div>`;
  document.body.appendChild(d); [0, 1, 2].slice(0, stars).forEach(i => setTimeout(() => E.tone(784 + i * 196, .25, 'triangle', .08), 150 + i * 220));
  return d;
}

/* ---------------- parent gate ---------------- */
// parentGate({onPass, onCancel}): a hold-to-open button (1.5 s; pointer, keyboard Space/Enter or gamepad A) and then a grown-up sum
// with three answers (e.g. "What is 17 + 6?"). A pre-reader cannot get through, a quick tap does nothing, nothing is stored or sent.
let _gateOpen = null;
export const gateOpen = () => !!_gateOpen;
export function parentGate({ onPass, onCancel, holdMs = 1500 } = {}) {
  if (_gateOpen) return _gateOpen;
  const d = document.createElement('div'); d.className = 'ig-screen kd-gate'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', L(S.grownups));
  let step = 'hold', prog = 0, t0 = 0, padHold = false, iv = 0, last = 0, wrong = 0, q = null, kbd = false;
  const close = (passed) => { clearInterval(iv); removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true); d.remove(); _gateOpen = null; if (passed) onPass && onPass(); else onCancel && onCancel(); };
  const newQ = () => { const a = 11 + Math.floor(Math.random() * 18), b = 3 + Math.floor(Math.random() * 7), s = a + b; const opts = new Set([s]); while (opts.size < 3) { const o = s + [-10, 10, -2, 2, -1, 1, 9, -9][Math.floor(Math.random() * 8)]; if (o > 0) opts.add(o); } q = { a, b, s, opts: [...opts].sort(() => Math.random() - .5) }; };
  const draw = (msg = '') => {
    d.innerHTML = `<div class="ig-card kd-gate-card"><button type="button" class="kd-x" data-g="x" aria-label="${L(S.close)}">✕</button><div class="kd-gate-ico" aria-hidden="true">🔒</div><h2>${L(S.grownups)}</h2>${step === 'hold'
      ? `<p class="ig-sub">${L(S.hold)}</p><button type="button" class="kd-hold" data-g="hold" style="--p:${prog}"><span>${L(S.holdBtn)}</span></button><p class="kd-gate-msg" aria-live="polite">${msg}</p>`
      : `<p class="kd-gate-q">${L(S.sum).replace('{a}', q.a).replace('{b}', q.b)}</p><div class="kd-gate-opts">${q.opts.map(o => `<button type="button" class="ig-btn ghost" data-g="opt" data-v="${o}">${o}</button>`).join('')}</div><p class="kd-gate-msg" aria-live="polite">${msg}</p>`}<p class="kd-gate-why">${L(S.why)}</p></div>`;
    d.querySelector('[data-g=x]').onclick = () => close(false);
    const h = d.querySelector('[data-g=hold]');
    if (h) { const on = e => { e.preventDefault(); press(); }, off = () => release();
      h.addEventListener('pointerdown', on); h.addEventListener('pointerup', off); h.addEventListener('pointerleave', off); h.addEventListener('pointercancel', off); h.addEventListener('contextmenu', e => e.preventDefault()); setTimeout(() => h.focus({ preventScroll: true }), 30); }
    d.querySelectorAll('[data-g=opt]').forEach(b => b.onclick = () => { if (+b.dataset.v === q.s) { E.SFX.good(); close(true); return; } wrong++; E.tone(300, .15, 'sine', .07); if (wrong >= 3) { close(false); return; } newQ(); draw(L(S.nope)); });
  };
  // the hold is timed from the press itself (event timestamps, not frames), so a slow device still opens after holdMs
  const press = () => { if (step === 'hold' && !t0) t0 = performance.now(); };
  const advance = () => { t0 = 0; kbd = false; padHold = false; step = 'sum'; newQ(); E.SFX.click(); draw(); };
  const release = () => { if (step !== 'hold' || !t0) return; if (performance.now() - t0 >= holdMs) { advance(); return; } if (performance.now() - t0 > 120) { const m = d.querySelector('.kd-gate-msg'); if (m) m.textContent = L(S.keep); } t0 = 0; };
  const kd = e => { if (step === 'hold' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); e.stopPropagation(); if (!kbd) { kbd = true; press(); } } else if (e.code === 'Escape') { e.stopPropagation(); close(false); } };
  const ku = e => { if (e.code === 'Space' || e.code === 'Enter') { if (kbd) { kbd = false; release(); } e.preventDefault(); } };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  const tick = () => {
    if (step !== 'hold') return; const now = performance.now(), dt = Math.min(.2, (now - last) / 1000); last = now;
    let pad = false; try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.buttons && p.buttons[0] && p.buttons[0].pressed) pad = true; } catch (e) { }
    if (pad && !padHold) { padHold = true; press(); } else if (!pad && padHold) { padHold = false; release(); if (step !== 'hold') return; }
    prog = t0 ? Math.min(1, (now - t0) / holdMs) : Math.max(0, prog - dt * 2.5);
    const h = d.querySelector('[data-g=hold]'); if (h) h.style.setProperty('--p', prog.toFixed(3));
    if (t0 && prog >= 1) advance();
  };
  draw(); document.body.appendChild(d); last = performance.now(); iv = setInterval(tick, 40);
  _gateOpen = { el: d, close }; return _gateOpen;
}

// guardLinks(): every click on a matching element (Hub links, ⌂, settings, phones, feedback, install, share, any <a href>) first
// opens the parent gate; after the grown-up passes, the original click goes through. Works for menus the engine builds later
// (title, pause, results, settings) because it listens on the document in the capture phase. Elements inside a container
// marked [data-kids-unlocked] (a grown-ups panel that was itself opened through the gate) are not gated twice.
export const GATED = '.ig-home, a[href], [data-a=hub], [data-a=settings], [data-a=phones], [data-a=feedback], [data-a=install], [data-a=share], .ig-setbtn, .ig-phones, .ig-fbchip, [data-kids-gate]';
let _guard = null, _passing = false;
// enabled:false (or setGuard(false)) pauses the gate in a game that only gates part of itself (Memory Match: the Little ones mode).
export function guardLinks({ selector = GATED, enabled = true } = {}) {
  if (_guard) { _guard.selector = selector; _guard.enabled = enabled; return _guard; }
  _guard = { selector, enabled, passes: 0, blocks: 0 };
  document.addEventListener('click', e => {
    if (_passing || !_guard.enabled || !e.target || !e.target.closest) return;
    const el = e.target.closest(_guard.selector); if (!el || el.closest('.kd-gate') || el.closest('[data-kids-unlocked]')) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); _guard.blocks++;
    parentGate({ onPass: () => { _guard.passes++; _passing = true; try { el.click(); } finally { _passing = false; } } });
  }, true);
  return _guard;
}
export const guardStats = () => _guard ? { passes: _guard.passes, blocks: _guard.blocks, enabled: _guard.enabled } : null;
export function setGuard(on) { if (_guard) _guard.enabled = !!on; return !!(_guard && _guard.enabled); }
