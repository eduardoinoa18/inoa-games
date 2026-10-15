// Beta feedback form (rating + kind + short note). Light module (no three.js) shared by the engine (games) and the hub.
// Sends through engine/platform.js → ig_submit_feedback (guest or signed in; server rate-limits and strips context).
import P from './platform.js';

export const FB_STRINGS = {
  en: { fbOpen: 'Send feedback', fbTitle: 'Tell us what you think', fbLead: 'Inoa Games is in a free beta. Your feedback shapes what we build next.', fbRate: 'How fun was it?', fbKind: 'What kind of feedback', fbBug: 'Bug', fbIdea: 'Idea', fbPraise: 'Love it', fbNote: 'What happened? What should we change? (optional)', fbSend: 'Send', fbCancel: 'Not now', fbEmpty: 'Pick a face or write a note first.', fbSending: 'Sending…', fbThanks: 'Thanks! Feedback sent.', fbOffline: 'No connection — try again when you are online.', fbLimit: 'Thanks — that is a lot of feedback for today! Try again tomorrow.', fbError: 'Could not send right now. Please try again.' },
  es: { fbOpen: 'Enviar opinión', fbTitle: 'Cuéntanos qué piensas', fbLead: 'Inoa Games está en beta gratis. Tu opinión decide lo que hacemos después.', fbRate: '¿Qué tan divertido fue?', fbKind: 'Tipo de comentario', fbBug: 'Error', fbIdea: 'Idea', fbPraise: 'Me encanta', fbNote: '¿Qué pasó? ¿Qué cambiarías? (opcional)', fbSend: 'Enviar', fbCancel: 'Ahora no', fbEmpty: 'Elige una carita o escribe una nota primero.', fbSending: 'Enviando…', fbThanks: '¡Gracias! Opinión enviada.', fbOffline: 'Sin conexión: inténtalo cuando tengas internet.', fbLimit: '¡Gracias! Ya enviaste mucho hoy. Inténtalo mañana.', fbError: 'No se pudo enviar ahora. Inténtalo otra vez.' }
};
const CSS = `.igfb{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(6,20,28,.55);font-family:inherit}
.igfb-card{width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;background:#fffaf0;color:#132a36;border-radius:24px;padding:20px;display:grid;gap:10px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
.igfb-card h2{margin:0;font-size:22px}.igfb-card p{margin:0;font-size:15px;opacity:.85}.igfb-k{font-size:12px;font-weight:800;letter-spacing:.12em;opacity:.6}
.igfb-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.igfb-row button{font:inherit;font-weight:700;border-radius:14px;border:2px solid rgba(19,42,54,.18);background:#fff;color:inherit;min-height:44px;padding:6px 12px;cursor:pointer}
.igfb-row button.on{background:#132a36;color:#fff;border-color:#132a36}.igfb-rate button{font-size:26px;min-width:52px;padding:4px}
.igfb textarea{width:100%;box-sizing:border-box;border-radius:14px;border:2px solid rgba(19,42,54,.18);padding:10px 12px;font:inherit;font-size:16px;resize:vertical;min-height:90px;background:#fff;color:inherit}
.igfb-act{display:flex;gap:8px;justify-content:flex-end}.igfb-act button{font:inherit;font-weight:800;border-radius:16px;min-height:48px;padding:0 18px;border:0;cursor:pointer;background:#ffd166;color:#132a36}.igfb-act .ghost{background:transparent;border:2px solid rgba(19,42,54,.25)}
.igfb-msg:empty{display:none}`;

export const feedbackAvailable = async () => { await P.init(); return P.feedbackAvailable; };

// hooks: { lang: 'en'|'es', game, onClose, click(), done(text) } — the engine passes its sound/voice/toast helpers.
export function openFeedback({ lang = document.documentElement.lang === 'es' ? 'es' : 'en', game = null, onClose, click = () => { }, done } = {}) {
  const T = k => (FB_STRINGS[lang] || FB_STRINGS.en)[k] || FB_STRINGS.en[k];
  if (!document.getElementById('igfb-css')) { const st = document.createElement('style'); st.id = 'igfb-css'; st.textContent = CSS; document.head.appendChild(st); }
  const prevFocus = document.activeElement;
  const d = document.createElement('div'); d.className = 'igfb'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', T('fbTitle'));
  let rating = 0, kind = 'general';
  d.innerHTML = `<div class="igfb-card"><div class="igfb-k">BETA</div><h2>💬 ${T('fbTitle')}</h2><p>${T('fbLead')}</p>
    <div class="igfb-row igfb-rate" role="group" aria-label="${T('fbRate')}">${['😞', '😕', '🙂', '😀', '🤩'].map((e, i) => `<button type="button" data-r="${i + 1}" aria-pressed="false" aria-label="${i + 1} / 5">${e}</button>`).join('')}</div>
    <div class="igfb-row" role="group" aria-label="${T('fbKind')}">${[['bug', '🐞 ' + T('fbBug')], ['idea', '💡 ' + T('fbIdea')], ['praise', '❤️ ' + T('fbPraise')]].map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
    <textarea maxlength="1000" rows="4" aria-label="${T('fbNote')}" placeholder="${T('fbNote')}"></textarea>
    <p class="igfb-msg" aria-live="polite"></p>
    <div class="igfb-act"><button type="button" class="ghost" data-a="close">${T('fbCancel')}</button><button type="button" data-a="send">${T('fbSend')}</button></div></div>`;
  document.body.appendChild(d);
  const msg = d.querySelector('.igfb-msg');
  const close = () => { d.remove(); removeEventListener('keydown', onKey, true); try { prevFocus && prevFocus.focus({ preventScroll: true }); } catch (e) { } onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }; addEventListener('keydown', onKey, true);
  d.addEventListener('click', e => { if (e.target === d) close(); });
  d.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { rating = +b.dataset.r; d.querySelectorAll('[data-r]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); click(); });
  d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kind = kind === b.dataset.k ? 'general' : b.dataset.k; d.querySelectorAll('[data-k]').forEach(x => { const on = x.dataset.k === kind; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); click(); });
  d.addEventListener('click', e => { if (e.target.closest('[data-r],[data-k]')) msg.textContent = ''; }); d.querySelector('textarea').oninput = () => { msg.textContent = ''; };
  d.querySelector('[data-a=close]').onclick = close;
  d.querySelector('[data-a=send]').onclick = async e => {
    const btn = e.currentTarget, body = d.querySelector('textarea').value.trim(); if (!rating && !body) { msg.textContent = T('fbEmpty'); return; }
    btn.disabled = true; msg.textContent = T('fbSending');
    try { const r = await P.sendFeedback({ rating: rating || null, body, game, kind }); if (!r || !r.ok) throw Object.assign(new Error((r && r.reason) || 'error'), { code: r && r.reason }); close(); (done || (txt => alert(txt)))(T('fbThanks')); }
    catch (err) { msg.textContent = T(err.code === 'offline' ? 'fbOffline' : err.code === 'rate_limited' ? 'fbLimit' : 'fbError'); btn.disabled = false; }
  };
  setTimeout(() => d.querySelector('[data-r="4"]')?.focus({ preventScroll: true }), 30);
  return d;
}
