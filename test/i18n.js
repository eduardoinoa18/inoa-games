// Spanish leak check (roadmap R4): every game's title screen (and the shared settings panel) opened with the profile in
// Spanish; visible text is scanned for common English words. Game titles and brand-like names are allowed.
// usage: node test/run.js index test/i18n.js   (I18N_GAMES=drift,fit to limit)
const GAMES = (process.env.I18N_GAMES || 'pixelpact,depths,drift,safari,bubbles,runner,tidelines,fit,junk,brew,builders,tray,trivia,draw,dominoes,golf').split(',');
const EN = ['the', 'and', 'your', 'you', 'play', 'with', 'to', 'of', 'score', 'level', 'levels', 'best', 'start', 'settings', 'back', 'next', 'tap', 'press', 'choose', 'pick', 'players', 'round', 'rounds', 'time', 'win', 'easy', 'hard', 'sound', 'music', 'language', 'quality', 'controls', 'how', 'move', 'jump', 'friends', 'phones', 'phone', 'connected', 'done', 'close', 'continue', 'new', 'locked', 'unlocked', 'stars', 'coins', 'daily', 'challenge', 'mode', 'modes', 'ready', 'help', 'hub', 'home', 'reset', 'save', 'saved', 'feedback', 'send', 'off', 'on', 'auto', 'high', 'low', 'is', 'are', 'for', 'from', 'this', 'that', 'it', 'in', 'a', 'an'];
// names that are the same in both languages (titles, characters, places, units) — removed before scanning
const ALLOW = ['Bubble Pop Counting', 'Bubble Pop', 'Pixel Pact', 'Depths', 'Island Drift', 'Snack Squad Safari', 'Snack Squad', 'Tide Runner', 'Tide Lines', 'Perfect Fit', 'Junkyard to Jewel', 'Brew and Bloom', 'Driftwood Builders', 'Fail Tray', 'Pact Trivia', 'Draw the Pact', 'Inoa Games', 'INOA GAMES', 'Inoa', 'Zen', 'OK', 'XP', 'Wi-Fi', 'QR', 'A', 'B', 'X', 'Y', 'Esc', 'Enter', 'Space', 'Shift', 'WASD', 'EN', 'ES', 'FPS'];
module.exports = async (p, shot) => {
  const base = p.url().replace(/[^/]*$/, ''); let leaks = 0; const report = {};
  for (const g of GAMES) {
    await p.goto(base + 'index.html');
    await p.evaluate(() => { const k = 'inoa.profile'; const pr = JSON.parse(localStorage.getItem(k) || '{}'); pr.lang = 'es'; localStorage.setItem(k, JSON.stringify(pr)); try { const s = JSON.parse(localStorage.getItem('pixelpact3.settings') || '{}'); delete s.lang; localStorage.setItem('pixelpact3.settings', JSON.stringify(s)); } catch (e) { } });
    await p.goto(base + `games/${g}.html`);
    await p.waitForFunction(() => window.__READY === true, null, { timeout: 120000 }).catch(() => { });
    await p.waitForTimeout(600);
    const texts = [await p.evaluate(() => document.body.innerText)];
    // shared settings panel (engine games)
    const hasSettings = await p.evaluate(() => { const b = document.querySelector('.ig-title [data-a=settings]'); if (b) { b.click(); return true; } return false; });
    if (hasSettings) { await p.waitForTimeout(300); texts.push(await p.evaluate(() => (document.querySelector('.ig-settings') || {}).innerText || '')); await p.evaluate(() => document.querySelector('.ig-settings [data-a=done]')?.click()); }
    let all = texts.join('\n'); for (const a of ALLOW.sort((x, y) => y.length - x.length)) all = all.split(a).join(' ');
    const found = {};
    for (const line of all.split('\n')) for (const w of line.split(/[^A-Za-zÀ-ÿ'’]+/)) { const lw = w.toLowerCase(); if (lw.length < 2 && lw !== 'a') continue; if (EN.includes(lw) && !(lw === 'a' || lw === 'on' || lw === 'no' || lw === 'en' || lw === 'es')) (found[lw] ||= []).push(line.trim().slice(0, 80)); }
    // "a" alone is Spanish too; "on"/"off" only count as leaks next to other English words
    const words = Object.keys(found).filter(w => !(['off', 'auto'].includes(w) && Object.keys(found).length === 1));
    report[g] = words.map(w => `${w}: "${[...new Set(found[w])][0]}"`);
    if (words.length) { leaks += words.length; console.log('i18n LEAK', g, JSON.stringify(report[g].slice(0, 12))); } else console.log('i18n ok', g);
    await shot(`es_${g}`);
  }
  console.log(leaks ? `I18N_LEAKS ${leaks}` : 'I18N_CLEAN');
};
