// Hub beta strip: "free beta" note, optional account chip (signed-in name + level, or Sign in), feedback button.
// Loads engine/platform.js (no three.js). Shows nothing when neither accounts nor feedback are configured.
import P from './engine/platform.js';
const L = {
  en: { beta: '🧪 Free beta — every game unlocked. Tell us what you think!', fb: '💬 Feedback', share: '📣 Share', copied: 'Link copied!', shareInv: '📣 Invite & earn', guide: '🧪 How to test', signin: 'Sign in (optional)', acct: 'Account', lv: 'Lv', owner: 'Owner' },
  es: { beta: '🧪 Beta gratis: todos los juegos desbloqueados. ¡Cuéntanos qué piensas!', fb: '💬 Opinión', share: '📣 Compartir', copied: '¡Enlace copiado!', shareInv: '📣 Invita y gana', guide: '🧪 Cómo probar', signin: 'Entrar (opcional)', acct: 'Cuenta', lv: 'Nv', owner: 'Dueño' }
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
(async () => {
  await P.init().catch(() => null);
  // (the strip always shows now: Share works without accounts)
  const bar = document.createElement('div'); bar.id = 'betaBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Beta');
  const st = document.createElement('style'); st.textContent = `#betaBar{background:var(--sun,#ffd166);color:var(--coral-ink,#132a36);font-weight:800;font-size:14px}
#betaBar .wrap{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-block:8px}
#betaBar .bb-act{display:flex;gap:8px;flex-wrap:wrap}#betaBar a,#betaBar button{font:inherit;font-weight:800;color:inherit;background:rgba(255,255,255,.55);border:2px solid rgba(19,42,54,.2);border-radius:12px;min-height:40px;padding:0 12px;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}`;
  document.head.appendChild(st);
  const nav = document.querySelector('nav'); nav.insertAdjacentElement('afterend', bar);
  let status = null;
  const draw = () => {
    const T = L[document.documentElement.lang === 'es' ? 'es' : 'en'], s = P.state();
    const who = !P.enabled ? '' : s.signedIn
      ? `<a href="account.html" id="bbAcct">${esc(status ? status.display_name : T.acct)}${status ? ` · ${status.is_admin ? T.owner : T.lv + ' ' + status.level}` : ''}</a>`
      : `<a href="account.html?next=index.html" id="bbAcct">${T.signin}</a>`;
    bar.innerHTML = `<div class="wrap"><span>${P.mode === 'beta' ? T.beta : ''}</span><div class="bb-act"><button type="button" id="bbShare">${s.signedIn ? T.shareInv : T.share}</button>${P.feedbackAvailable ? `<button type="button" id="bbFb">${T.fb}</button>` : ''}${P.mode === 'beta' ? `<a href="testers.html" id="bbGuide">${T.guide}</a>` : ''}${who}</div></div>`;
    bar.querySelector('#bbShare').onclick = async e => { let code = null; if (P.enabled && P.state().signedIn) { try { code = (await P.referrals()).code; } catch (x) { } } const out = await P.share({ code }); if (out === 'copied') { const b = e.target; const t0 = b.textContent; b.textContent = T.copied; setTimeout(() => { b.textContent = t0; }, 1800); } };
    const fb = bar.querySelector('#bbFb'); if (fb) fb.onclick = async () => { const { openFeedback } = await import('./engine/feedback.js'); openFeedback({ lang: document.documentElement.lang === 'es' ? 'es' : 'en' }); };
  };
  draw();
  document.getElementById('langToggle')?.addEventListener('click', () => setTimeout(draw, 0));
  if (P.enabled && P.state().signedIn) { status = await P.refreshStatus().catch(() => null); draw(); }
  window.__HUB_ACCOUNT = { draw, get status() { return status; } };
})();
