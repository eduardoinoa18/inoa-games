# Inoa Games arcade — builder guide

Every game is one page at `games/<id>.html` that imports the shared engine `engine/inoa3d.js` and loads its assets with `E.loadPack('../packs/<id>.json')` (which reads `packs/<id>/manifest.json` + real `.glb/.hdr` files first and falls back to the base64 JSON). The site is static: `index.html` (the hub, generated from `hub-src/`) links to `games/<id>.html`; Vercel serves the repo root. **Read `games/drift.html` first — it is the reference implementation and the quality bar.**

## Hard constraints
- Scripts only from `cdn.jsdelivr.net` (three@0.170.0 via the import map in drift.html). No other CDNs, no network APIs, no WebSockets, no servers. Fonts only from Google Fonts (link tags as in drift.html).
- Assets come only from packs built with `python3 tools/build_pack.py <id> --models a b c --hdri dawn`, then `node tools/build_packs.mjs <id>` (writes the manifest + shared meshopt `.glb` files in `packs/assets/`). Model names = files in `assets/models/*.glb` (list in `docs/models.txt`). HDRIs: dawn, sunset, studio, interior, forest, city. Keep a pack under ~8 MB (check heavy models with `ls -la assets/models`). All models are CC0 (Kenney etc.).
- Never use real brands, franchises or real people. Everything original.
- Must work on a phone (touch), a laptop (keyboard) and with a gamepad. Text readable at phone size. No horizontal scroll.
- `localStorage` only via `E.store` (it can throw).
- Engine changes must be additive (13 games depend on it) and are made by the lead; game agents write local helpers and list engine requests in their report. Re-run `npm run test:all` and `node test/run.js junk test/engine.js` after any engine change.

## Page skeleton
Copy the `<head>` of drift.html (fonts, `../engine/ui.css`, the import map) and start the module with:
```js
import * as E from '../engine/inoa3d.js';
const { THREE, clamp, lerp, rnd, pick, hash, damp, SFX, $ } = E;
const ld = E.loading('Game Name', 'Loading…');
const R = E.createRenderer($('gl'), { fov: 55, portraitFov: 70, shadowSize: 30 });
await E.loadPack('../packs/<id>.json', R, p => ld.set(p));
// build scene, title screen...
ld.done(); window.__READY = true;
E.loop((dt) => { update(dt); R.render(dt); });
window.__GAME = { /* hooks for tests: state, update, start... */ };
```

## Engine API (engine/inoa3d.js)
- `createRenderer(canvas, opts)` → `{renderer, scene, camera, sun, hemi, composer, bloom, resize, render(dt), setLook(L), setEnv(tex)}`. ACES tone mapping, soft shadows, bloom (subtle by default), SMAA, vignette, auto quality drop under 40 fps. Move `sun.position`/`sun.target` with the action so shadows stay sharp.
- `setLook({skyTop, skyHor, skyGlow, sunDir, fog, fogNear, fogFar, sun, sunColor, hemi, ground, exposure, env, bloom, bloomThreshold, stars, clouds, background})` — gradient sky dome + clouds/stars, fog, light balance. Use `background: 0x...` for indoor scenes (no sky). Keep bloom ≤ .2 by day; lights must never be overwhelming.
- `setEnv(E.ASSETS.hdri.dawn)` — HDRI for reflections/fill (env intensity in setLook, keep .1–.25).
- `loadPack(url, R, onProgress, {manifest})` → tries `packs/<game>/manifest.json` (`{v, base, models:{name:url}, hdri:{name:url}, lazy:[names]}`), falls back to the JSON pack. `ensureModels([names])` loads lazy models later. `E.ASSETS.models[name]`.
- `instance(name, {scale, tint, outline=true, shadow=true, fit:'max'|'height'})` → Group normalized: feet on y=0, centred, size = scale. `detail(root, kind, strength)` adds micro surface normal/roughness.
- `pbr(kind, color, [rx, ry], {bump, rough})` → procedural PBR material (asphalt, sand, grass, wood, metal, rust, tile, fabric, stone, snow, paint, plastic). Use these instead of flat colors for floors, walls, roads, tables.
- `mat(color, extra)` cached MeshStandardMaterial. `addOutline(root)` toon outline.
- Humanoids (rigged, Kenney T-pose rig): skater-female, skater-male, survivor-female, survivor-male, cyborg-female, male, zombie-1, zombie-2. `const rig = E.bones(model)`, then `E.pose(rig, E.POSES.run(t))` each frame. POSES: run, walk, idle, jump, sit, cheer, punch(k 0..1), swing(k), hit. Pose values are `{BoneName: [x, y, z]}` radians; arms hang with z ≈ ∓1.25 (Left −, Right +). Bones: Hips, Spine, Chest, UpperChest, Neck, Head, Left/RightShoulder, Left/RightArm, Left/RightForeArm, Left/RightHand, Left/RightUpLeg, Left/RightLeg, Left/RightFoot. Non-rigged characters (pirate-captain, pirate-officer, pirate-crew) can only be moved/bobbed whole.
- `tag(emoji, text, {width, bg, fg})` sprite label; `tagMaterial(...)`.
- `new E.Particles(scene, {capacity})` → `.burst(vec3, {color, n, speed, up, size, life, gravity, additive})`, `.update(dt)`, `.clear()`, `.dispose()`. Pooled: one Points mesh per blend mode, no per-burst allocation; `.list.length` = active bursts; low quality halves counts.
- Audio: `SFX.good|bad|pop|click|snap|coin|win|lose|whoosh|crash|splash|tick|boost|hit|scrub|level()`, `tone(f, dur, wave, gain, slide, delay)`, `noise(dur, gain, freq, q)`, `music(E.SONGS.bright|chill|race|tense)` → `{stop()}`.
- `say(text, {lang, interrupt, once})` — speech (EN/ES from profile; respects the read-aloud setting). `once: true` speaks a line only once per page. Read important instructions aloud for young players.
- Language: `E.lang()` → 'en'|'es'; `E.L('Hi', 'Hola')` or `E.L({en, es})` picks the current language; `E.t(key)` engine UI strings; `E.addStrings({en:{...}, es:{...}})` to extend. Listen for `inoa:settings` on window to re-render when the player changes language.
- Settings (shared by every game + the hub, stored in the profile): `E.settings()` → `{sound, music, voice, lang, motion, quality}`, `E.setSetting(k, v)`, `E.settingsPanel({onClose})` (also on the pause menu and title screen), `E.reducedMotion()` (respect it: cap shake, skip camera swoops).
- Limbs + held items: `E.aimLimbs(rig, root, {ru, rf, lu, lf, rt, rs, lt, ls})` (unit vectors in the root's local frame), `E.aimBone(bone, child, dirW)`, `E.orientTo(obj, bone, dirW, hintW)`, `E.weaponPivot(model, len, grip, rot)` (+Y = blade, origin = grip), `E.attach(rig, obj, 'RightHand')` (cancels the rig's bone scale). Missing bones are skipped.
- Rendering extras: `R.invalidate()` + `createRenderer(c, {onDemand: true})` / `R.setOnDemand(v)` render only when something changed; `window.__NORENDER = true` skips rendering (tests). `setLook({fogScale: true, fogNear: .8, fogFar: 4})` scales fog with the camera → `R.focus` distance. Quality setting 'low' = DPR 1, 1024 shadows, no bloom; 'high' disables the auto drop.
- `E.occluders([props])` → `.add(obj)`, `.update(camera, targetVec3, dt, radius)` fades props between camera and player (materials cloned per prop, outlines hidden while faded). `E.menuNav({root, selector, escBack})` → `{stop()}`: d-pad/stick/arrow focus ring over the top card's buttons, A clicks, B presses Back/Hub. `E.floatText()` returns its element; `E.toScreen()` updates the camera matrix first; `createInput` ignores keys typed into text fields.
- PWA: the engine adds the web manifest + registers `sw.js`; `results({..., won: true})` offers install after a win (`E.installAvailable()`, `E.promptInstall()`).
- `createInput({surface})` → `{poll() → state {x, y, a, b, c, pause, aPressed, bPressed, cPressed, swipe}, consumeSwipe(), bindButton(el, 'a'|'b'|'c'), bindStick(zone, knob), touch, keys}`. Keyboard: WASD/arrows, Space/J = a, Shift/K = b, L/E = c, Esc/P = pause. Gamepads automatic.
- UI: `loading(title)`, `titleScreen({title, kicker, lead, how:[[icon, text]], extra (html), onPlay})`, `shell({onPause, buttons:[{id, icon, label, cls}], stick})` → `{hud}` (top bar with home + pause; put chips in `hud.innerHTML`), `pauseMenu({onResume, onRestart})`, `toast(text, ms, speak)`, `floatText(text, x, y, cls)`, `results({gameId, title, stats:[[label, value]], xp, coins, best, bestLower, bestLabel, onAgain, share})` — **always end a round with results()**: it grants XP/coins to the shared hero profile the hub shows.
- `profile()` (v2, migrates old saves; `games[id] = {plays, best, last}`, `recent`, `hero`), `heroLevel(xp)`, `reward()` (a repeat call for the same game within 3 s does not pay twice), `store.get/set`, `toScreen(vec3, camera)`, `loop(fn)`.
- Multiplayer (`engine/net.js`, re-exported as `E.NET` / `E.net`): `titleScreen({party})` and `shell({party})` add the 📱 phones button/widget (`party:false` hides, `{label, hint, online:{page,text}}` customizes); `createInput({pads:'any'|'first'|'separate'})`; `input.pad(slot)`; `E.net.pads()`; `E.NET.setLayout(layout, slot)`. Full guide: `docs/MULTIPLAYER.md`.
- Card Room table games (`engine/cardroom.js`, a separate pure module; import it next to the engine): `createMatch(game, {seats, opts, seed})` → `{deal(), turn(), legal(seat), view(seat), act(seat, move, from) → {ok, reason}, botAct(seat, skill), scores, phase: lobby|turns|roundEnd|matchEnd}` with events `move`, `round`, `reject`; `makeSeats({players, locals, phones, botNames, skill})`; `phoneHands(E.NET, {seats, layout(i), onMsg(i, msg)})` sends each phone its own `hand` layout; `makeRng(seed)`, `shuffle`, `botDelay(skill)`. A game supplies pure rules (`newRound, turnOf, legalMoves, moveKey, applyMove, view, botMove, roundOver, sides`) — see `games/dominoes-rules.js` and its Node test `test/dominoes_rules.js`. Bots receive only `view(seat)` (their own hand + public table).
- Draw-call budget: `bakeStatic(group, {shadow})` merges every non-skinned mesh under `group` into one mesh per material look (world transforms applied) and returns the baked group. Use it for static scenery built from many multi-part CC0 models (town square: 399 → 103 calls). Skinned rigs and instanced meshes are skipped.
- Saves: `store.get/set` scope game keys to the signed-in player and sync them (`engine/savekeys.js`, `docs/PLATFORM_ARCHITECTURE.md` §15). A new game adds its key to `SAVE_SCOPED`/`SAVE_SYNCED`.
- Card Room table games (`engine/cardroom.js`, a separate pure module; import it next to the engine): `createMatch(game, {seats, opts, seed})` → `{deal(), turn(), legal(seat), view(seat), act(seat, move, from) → {ok, reason}, botAct(seat, skill), scores, phase: lobby|turns|roundEnd|matchEnd}` with events `move`, `round`, `reject`; `makeSeats({players, locals, phones, botNames, skill})`; `phoneHands(E.NET, {seats, layout(i), onMsg(i, msg)})` sends each phone its own `hand` layout; `makeRng(seed)`, `shuffle`, `botDelay(skill)`. A game supplies pure rules (`newRound, turnOf, legalMoves, moveKey, applyMove, view, botMove, roundOver, sides`) — see `games/dominoes-rules.js` and its Node test `test/dominoes_rules.js`, and `games/golf-rules.js` (per-seat round `scores` + optional `matchOver(scores, rounds, opts)` for lowest-total-after-N-rounds games). Playing cards: `engine/cards.js` (`cardSvg`, `backSvg`, `drawCard(ctx)`, `cardName`) — original faces, four-colour suits with shapes; pad layout `cards` shows them on phones. Bots receive only `view(seat)` (their own hand + public table).
- CSS classes in ui.css: `.ig-card .ig-btn(.ghost/.sun/.coral) .ig-chip .ig-chipbtn(.on) .ig-row .ig-stats .ig-big .ig-tbtn(.big) .ig-stick .ig-knob`. Palette vars: --mint-ink, --sun, --coral, --berry, --paper, --ink.

## Quality bar (what "done" means)
1. Real 3D scene with packed models, procedural PBR floors/walls, sky or indoor backdrop, soft shadows, a camera that frames the action on landscape AND portrait phones.
2. A complete loop: title screen (how to play, options) → play with HUD → clear win/finish → `results()` → play again. Pause works. Back to hub (⌂) works.
3. Friendly by default (forgiving, no harsh fail states for kids' games; optional harder mode for adults where it fits), juicy feedback (particles, SFX, screen shake capped, floating text), music.
4. Controls: keyboard + touch buttons/stick + gamepad. Read key instructions aloud with `say()` where a child might not read.
5. No console errors. 60 fps target: instancing for repeated meshes, reuse geometries/materials, cap particles.

## Testing (mandatory)
- Harness: `PORT=<your port> node test/run.js <id> test/<id>.js` (from the repo root). It serves the repo, routes three.js to local node_modules, waits for `window.__READY`, then runs your script `module.exports = async (page, shot) => {...}`; `shot(name)` saves `test/out/<id>_<name>.png` (portrait runs get a `_p` suffix). It prints `NO_ERRORS` or the page errors.
- Drive the game from the test through `window.__GAME` hooks (call `update(1/60)` in loops inside `page.evaluate`, yield with `await new Promise(r=>setTimeout(r,0))` every ~20 steps). See `test/drift.js`. Add an autopilot/bot hook if needed so a full round can complete headlessly.
- Look at your screenshots (Read the PNGs; combine several into one sheet with PIL to save effort) and fix what looks wrong: bad framing, clipping, invisible meshes (check face winding / DoubleSide), overexposure, unreadable text, characters facing backwards, things floating.
- Test at 1000×560 (landscape) and `W=390 H=844` (portrait phone).
- Rendering in the harness is software (SwiftShader) and slow — simulate with `update()` rather than waiting in real time.

- Offline/PWA: `SW=1 node test/run.js index test/pwa.js` (registers the service worker, opens a game, shuts the server down, reloads offline).
- Engine contract: `node test/run.js junk test/engine.js`.
