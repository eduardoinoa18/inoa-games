/* Inoa Games page guard (classic script, loaded first on every page, before any module):
 * - catches errors a player would only see as a frozen or blank game: a script that failed to load (e.g. the 3D library
 *   blocked by the network), uncaught errors, the browser dropping the WebGL context (iPhones do this under memory pressure)
 * - shows a friendly screen with Reload / Hub instead of a stuck page (progress is saved locally, so a reload is safe)
 * - reports what happened (no personal data: page, message, browser, screen) to the project's database so problems on real
 *   devices are visible in the admin page; max 5 reports per page load
 * - small polyfills for older iPhones/iPads (Safari < 16): CanvasRenderingContext2D.roundRect
 * Pages call nothing; a game marks itself started with window.__READY = true (as the tests already expect). */
(function () {
  'use strict';
  var T0 = Date.now(), errs = [], sent = 0, shown = false, burst = [];
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  var isHub = page === 'index' || page === '';
  function es() { try { var k = JSON.parse(localStorage.getItem('inoa.activeProfile') || 'null'); var p = JSON.parse(localStorage.getItem(typeof k === 'string' && k.indexOf('inoa.profile.u.') === 0 ? k : 'inoa.profile') || '{}'); return String(p.lang || navigator.language || '').indexOf('es') === 0; } catch (e) { return false; } }
  function L(en, sp) { return es() ? sp : en; }

  /* ---- polyfills (Safari 15 and older) ---- */
  try {
    var C2 = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (C2 && !C2.roundRect) C2.roundRect = function (x, y, w, h, r) {
      var rr = Array.isArray(r) ? r[0] : r; rr = Math.max(0, Math.min(+rr || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + rr, y); this.arcTo(x + w, y, x + w, y + h, rr); this.arcTo(x + w, y + h, x, y + h, rr); this.arcTo(x, y + h, x, y, rr); this.arcTo(x, y, x + w, y, rr); this.closePath(); return this;
    };
  } catch (e) { }

  /* ---- reporting ---- */
  var cfgP = null;
  function cfg() { if (!cfgP) { var base = location.pathname.indexOf('/games/') >= 0 || location.pathname.indexOf('/labs/') >= 0 ? '../' : ''; cfgP = fetch(base + 'platform.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); } return cfgP; }
  function report(kind, msg, extra) {
    var key = kind + ':' + String(msg).slice(0, 120);
    if (errs.indexOf(key) >= 0) return; errs.push(key);
    if (sent >= 5 || window.__NO_ERROR_REPORTS || /HeadlessChrome/.test(navigator.userAgent)) return; sent++;
    var body = { page: page, kind: kind, message: String(msg || '').slice(0, 300), detail: Object.assign({ ua: navigator.userAgent.slice(0, 200), w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio || 1, ready: !!window.__READY, secs: Math.round((Date.now() - T0) / 1000), online: navigator.onLine, mem: navigator.deviceMemory || null, perf: window.__inoaPerf || null }, extra || {}) };
    cfg().then(function (c) {
      if (!c.supabaseUrl || !c.supabaseAnonKey) return;
      fetch(String(c.supabaseUrl).replace(/\/$/, '') + '/rest/v1/rpc/ig_log_error', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', apikey: c.supabaseAnonKey, authorization: 'Bearer ' + c.supabaseAnonKey }, body: JSON.stringify({ p: body }) }).catch(function () { });
    });
  }
  window.__inoaReport = report;

  /* ---- the friendly screen ---- */
  function screen(title, text, opts) {
    opts = opts || {};
    if (shown && !opts.force) return; shown = true;
    var go = function () {
      var d = document.createElement('div'); d.className = 'inoa-guard'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
      d.innerHTML = '<style>.inoa-guard{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(13,27,38,.72);font-family:Manrope,system-ui,sans-serif}.inoa-guard>div{background:#fff8ee;color:#1b2430;border-radius:22px;padding:22px;max-width:420px;width:100%;box-shadow:0 24px 70px rgba(0,0,0,.4);display:grid;gap:12px;text-align:center}.inoa-guard h2{margin:0;font-size:22px}.inoa-guard p{margin:0;color:#4c5868;font-weight:600;line-height:1.45}.inoa-guard .r{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.inoa-guard button,.inoa-guard a{font:inherit;font-weight:800;min-height:48px;padding:0 20px;border-radius:14px;border:0;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}.inoa-guard .go{background:#0f5c48;color:#fff}.inoa-guard .gh{background:#fff;color:#1b2430;box-shadow:inset 0 0 0 2px rgba(27,36,48,.15)}.inoa-guard small{color:#8a93a0;font-size:11px;word-break:break-word}</style>' +
        '<div><div style="font-size:44px">' + (opts.icon || '🛠️') + '</div><h2></h2><p class="t"></p><div class="r">' + (isHub ? '' : '<a class="gh" href="' + (location.pathname.indexOf('/games/') >= 0 ? '../index.html' : 'index.html') + '">' + L('Back to the hub', 'Volver al inicio') + '</a>') + '<button class="go">' + (opts.button || L('Reload', 'Recargar')) + '</button>' + (opts.dismiss ? '<button class="gh x">' + L('Keep waiting', 'Seguir esperando') + '</button>' : '') + '</div>' + (opts.small ? '<small></small>' : '') + '</div>';
      d.querySelector('h2').textContent = title; d.querySelector('.t').textContent = text; if (opts.small) d.querySelector('small').textContent = opts.small;
      d.querySelector('.go').onclick = function () { location.reload(); };
      var x = d.querySelector('.x'); if (x) x.onclick = function () { d.remove(); shown = false; };
      document.body.appendChild(d); setTimeout(function () { try { d.querySelector('.go').focus(); } catch (e) { } }, 30);
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
  window.__inoaGuardScreen = screen;

  /* ---- errors ---- */
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) { // a script/stylesheet that failed to load
      var src = t.src || t.href || ''; if (t.tagName === 'LINK' && /fonts\./.test(src)) return; // fonts are optional
      report('load', 'Could not load ' + src.replace(/^https?:\/\/[^/]+/, '').slice(0, 200), { src: src.slice(0, 200) });
      return;
    }
    var msg = (e.message || (e.error && e.error.message) || 'error');
    if (/ResizeObserver loop|Script error\.?$/.test(msg)) return;
    report('error', msg, { at: (e.filename || '').replace(/^https?:\/\/[^/]+/, '') + ':' + (e.lineno || 0) + ':' + (e.colno || 0), stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 1500) : null });
    onCrash();
  }, true);
  addEventListener('unhandledrejection', function (e) {
    var r = e.reason, msg = r && r.message ? r.message : String(r);
    if (/AbortError|NotAllowedError|play\(\)|The user aborted|Failed to fetch|NetworkError|Load failed/.test(msg)) return; // audio autoplay / offline fetches are handled where they happen
    report('promise', msg, { stack: r && r.stack ? String(r.stack).slice(0, 1500) : null });
    if (!window.__READY && /import|module|Failed to load|dynamically imported/i.test(msg)) bootFailed(msg);
  });
  // an error that repeats every frame means the game is stuck: offer a restart instead of a frozen picture
  function onCrash() {
    var now = Date.now(); burst.push(now); burst = burst.filter(function (t) { return now - t < 4000; });
    if (!window.__READY && now - T0 > 3000) return; // during boot the watchdog decides
    if (burst.length >= 3) screen(L('Oops, the game got stuck', 'Uy, el juego se trabó'), L('Your progress is saved. Reload to keep playing.', 'Tu progreso está guardado. Recarga para seguir jugando.'), { small: errs[errs.length - 1] || '' });
  }

  /* ---- WebGL context lost (iPhone/iPad memory pressure, GPU reset) ---- */
  addEventListener('webglcontextlost', function (e) {
    report('webgl', 'WebGL context lost', {});
    // give the browser a moment to restore it on its own (three.js re-creates resources when it does)
    var restored = false; var onR = function () { restored = true; removeEventListener('webglcontextrestored', onR, true); };
    addEventListener('webglcontextrestored', onR, true);
    setTimeout(function () { if (!restored) screen(L('The graphics took a break', 'Los gráficos se tomaron un descanso'), L('The device needed memory and paused the 3D view. Your progress is saved. Tap to continue.', 'El aparato necesitó memoria y pausó la vista 3D. Tu progreso está guardado. Toca para continuar.'), { icon: '😴', button: L('Continue', 'Continuar'), force: true }); }, 1500);
  }, true);

  /* ---- boot watchdog: a game that never starts gets an explanation instead of an endless loading bar ---- */
  function bootFailed(why) {
    if (window.__READY) return;
    var net = /jsdelivr|three|Could not load|import|module|fetch/i.test(why || errs.join(' '));
    report('boot', why || 'slow start', { errors: errs.slice(0, 5) });
    screen(navigator.onLine === false ? L("You're offline", 'Estás sin conexión') : L('This game is having trouble starting', 'Este juego tiene problemas para arrancar'),
      navigator.onLine === false ? L('Connect to the internet to load this game the first time. After that it works offline.', 'Conéctate a internet para cargar este juego la primera vez. Después funciona sin conexión.')
        : net ? L('Part of the game could not download. Check the connection (some school or office networks block it) and reload.', 'No se pudo descargar una parte del juego. Revisa la conexión (algunas redes de escuelas u oficinas la bloquean) y recarga.')
          : L('It is taking much longer than usual. Reloading usually fixes it.', 'Está tardando mucho más de lo normal. Recargar suele arreglarlo.'), { dismiss: !net, small: errs[0] || '' });
  }
  if (!isHub && /\/games\//.test(location.pathname)) {
    setTimeout(function () { if (!window.__READY) bootFailed(errs.length ? errs[0] : 'not ready after 45 s'); }, 45000);
    // a module that failed to import never runs: if the loader is gone or never came and a load error was seen, say so early
    setTimeout(function () { if (!window.__READY && errs.some(function (k) { return k.indexOf('load:') === 0; })) bootFailed(errs[0]); }, 8000);
  }
})();
