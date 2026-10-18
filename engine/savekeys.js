// Which localStorage keys are per-player game saves (shared by engine/inoa3d.js, engine/platform.js and Pixel Pact 2D).
// SCOPED keys live under `<key>.u.<userId>` while someone is signed in; SYNCED keys also follow the player to other devices
// (ig_saves, ≤ 64 KB each). Big or device-only data (Drift ghosts, Draw galleries, Trivia seen-lists) stays scoped but local.
export const SAVE_SCOPED = /^(inoa\.(drift|runner|tidelines|fit|junk|brew|builders|tray|trivia|draw|depths|bubbles|dominoes|golf)(\.|$)|snacksquad$|pixelpact3\.progress$)/;
// Not synced on purpose (data minimisation): Safari's 'snacksquad' (children's names + allergen lists: health data about kids
// stays on the device), and the Draw / Trivia settings ('inoa.draw', 'inoa.trivia'), which hold typed player names.
export const SAVE_SYNCED = ['inoa.drift', 'inoa.runner', 'inoa.tidelines', 'inoa.fit', 'inoa.junk', 'inoa.brew', 'inoa.builders', 'inoa.tray', 'inoa.trivia.daily', 'inoa.trivia.stats', 'inoa.depths', 'inoa.bubbles', 'inoa.dominoes', 'inoa.golf', 'pixelpact3.progress'];
// the save keys a game page holds in memory (a newer cloud copy of these is offered, not written underneath the game)
export const GAME_SAVES = { safari: ['snacksquad'], pixelpact: ['pixelpact3.progress'] };
export const gameSaveKeys = g => GAME_SAVES[g] || SAVE_SYNCED.filter(k => k === 'inoa.' + g || k.startsWith('inoa.' + g + '.'));
export function activeUid() { try { const k = JSON.parse(localStorage.getItem('inoa.activeProfile') || 'null'); return typeof k === 'string' && k.startsWith('inoa.profile.u.') ? k.slice(15) : null; } catch (e) { return null; } }
export const saveKey = (k, uid = activeUid()) => uid && SAVE_SCOPED.test(k) ? `${k}.u.${uid}` : k;
