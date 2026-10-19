# Inoa Games — living audit

Severity: **P0** broken/blocker · **P1** major (game-breaking, progression, severe mobile) · **P2** polish/usability/content · **P3** minor.
Status words used below mean exactly: *implemented* (code exists), *tested* (headless test passed), *visually verified* (screenshots inspected at 1000×560 and 390×844), *deployed*, *production verified*.

## Baseline — 2026-10-15 (commit b9397b9)

### Executive summary
- **13 games** confirmed in `games/` (12 on the shared engine + `pixelpact.html` 2D, and `safari.html` which embeds its own older engine copy). 12 have headless tests; Pixel Pact has none.
- **The test harness was broken on a clean install (P0, fixed):** `require.resolve('three/package.json')` fails because three@0.170 restricts `exports`. Nobody could run `npm run test:all` from a fresh clone. Fixed in `test/run.js`; portrait screenshots now get a `_p` suffix so they no longer overwrite landscape ones (several tests still write fixed names — see per-game notes).
- After the fix: **all 24 runs (12 games × landscape + portrait) print `NO_ERRORS`**. Pixel Pact loads without errors in both orientations.
- **The committed hub was stale (P0, fixed by rebuild):** `index.html` marked 8 live games as SOON / PHASE 1 and linked them to `#shelf`, so Builders, Tide Lines, Fit, Tray, Junk, Trivia, Draw and Runner were unreachable from the front page. `python3 tools/build_hub.py` now regenerates it correctly.
- **No Vercel project exists for this repo** on the connected Vercel team (projects: eduardoinoa, viventa, the-story-vault). Nothing is auto-deploying. Needs the owner to import the GitHub repo into Vercel (or run `npx vercel --prod` logged in).
- **Hub makes claims the product does not implement (P1, honesty):** pricing ($4.99 / $9.99 Pact Pass), "every phone is a controller", host rooms with 4-letter codes + QR, "notify me at launch", "10 s link to lobby", "14 games". Online play does not exist (static site). These must be reworded as roadmap or removed.
- Shared engine is small (264 lines), coherent and used consistently. Main gaps: no settings panel / language toggle UI, particles allocate per burst, no manifest/file asset loading, no lifecycle/visibility pause, profile has no versioning or per-game de-dupe guard.
- Biggest visual problems: Brew and Bloom portrait (duplicated brew panel, clipped greenhouse), Driftwood Builders (palm trunks occluding camera, palette clipped on phones, toasts overlapping quest card), Depths portrait (bottom 40% of screen empty, overlapping banner texts), Trivia portrait (question board cut off), Tide Lines portrait close-up (camera inside the player).

### Shared engine (`engine/inoa3d.js`, `engine/ui.css`)
| Sev | Finding | Fix |
| --- | --- | --- |
| P1 | `reward()` has no idempotency: a game calling `results()` twice grants twice. Profile has no `v` field / migration. | Add `roundId` de-dupe + versioned profile (Phase 3). |
| P1 | Packs are base64 JSON (3.4–6.7 MB each, ~33% larger than the binaries, must be fully downloaded + parsed before anything shows). | Manifest + real `.glb/.hdr` files, keep JSON fallback (Phase 2). |
| P2 | `Particles.burst` allocates a geometry + material per burst and disposes on expiry → GC churn. | Pooled Points per effect type (Phase 3). |
| P2 | No shared settings UI: pause menu only toggles sound + read-aloud; no music, language, reduced-motion or quality controls; `lang` exists in profile but nothing in the shell sets it. | Shared settings panel (Phase 3). |
| P2 | `loop()` keeps rendering when the tab is hidden (rAF pauses, but music `setTimeout` sequencer keeps scheduling notes). | Pause music on `visibilitychange`. |
| P2 | `say()` cancels any speech each call; no de-dupe of repeated lines. | Additive option `once`. |
| P2 | Engine UI strings (Paused, Hub, Resume, Play again, ROUND OVER, Hero lv…) are English only. | Localise engine UI (Phase 3). |
| P3 | Fog is fixed near/far per look; huge maps (Drift ×2.1) get flat fog. | Camera-distance fog helper (Phase 3). |
| P3 | `tag()` sprites with no emoji leave a wide empty pill (Drift/Tide Lines name tags look like blank white boxes). | Size the pill to the text. |

### Hub (`index.html` ← `hub-src/`)
| Sev | Finding |
| --- | --- |
| P0 | Stale build: 8 live games unreachable (fixed by rebuild; CI-like check needed so it can't regress). |
| P1 | Misleading marketing: pricing, online rooms/QR, phone-as-controller, "notify me", app-store roadmap presented as product. |
| P1 | Only 4 tile thumbnails (`thumbs/`): 9 games show procedural canvas art or blank tiles. |
| P2 | Hero maker is 2D-only and only stores `name`; no model/colour choice reaches games. |
| P2 | No per-game best / play count on tiles, no Continue row, no daily challenge, no EN/ES toggle. |
| P2 | Tile/hero canvases draw only when on screen (fine in use; blank in full-page captures). |
| P3 | Copy says "Fourteen games" (Pixel Pact and Match are one page → 13 pages, 14 entries). |

### Per game
Tests: L = 1000×560, P = 390×844. Time = wall-clock on a 4-core box with software GL.

#### Island Drift — `games/drift.html` (reference) · L/P NO_ERRORS (284 s / 146 s)
- Works: full 3-lap GP vs 5 AI to results, time trial, 2 tracks, items, drift turbos, minimap.
- P2 Title card overflows a 560 px tall landscape screen (heading scrolled off; card scrolls).
- P2 AI name tags are blank-looking white pills; item slot shows a lone "·" when empty.
- P2 During a drift the chase camera lets the kart slide almost off frame (both orientations).
- P2 Content: only 2 tracks, no ghost, no cup, AI identical in personality.

#### Tide Runner — `games/runner.html` · NO_ERRORS (173 / 130)
- Works: lanes/jump/slide, power-ups, daily seed, ghost, friendly vs classic.
- P3 Portrait: hearts chip wraps to a second HUD row over a cloud. Otherwise clean.

#### Tide Lines — `games/tidelines.html` · NO_ERRORS (296 / 146)
- Works: 4v4 bots, live %, bombs, judge sweep, results.
- P1 Portrait close-up shot: camera clips inside the player model (no near-camera occlusion handling).
- P2 Palm tree canopy occludes the player in the final 10 s shot; name tags blank pills.
- P2 One map only.

#### Perfect Fit — `games/fit.html` · NO_ERRORS (375 / 113)
- Works: real mouse drags, wrong-drop feedback, keyboard placing, 8 levels, auto-solve, before/after, results.
- P2 Portrait: box + mat are small (≈50% width); lv7 (Picnic Basket) lid art overlaps the slots in portrait.
- Note: test writes fixed names, portrait overwrote landscape; landscape re-run needed.

#### Junkyard to Jewel — `games/junk.html` · NO_ERRORS (566 / 124)
- Works: real mouse scrubbing on voxel mask, 4 stages, reveal, Day 1 vs Day 30 slider, gallery, 8 vehicles.
- P2 Portrait: vehicle occupies ~40% width; could frame tighter. P3 paint stage shows the underlying rust texture through sprayed colour until polish.

#### Brew and Bloom — `games/brew.html` · NO_ERRORS (394 / 143) — builder was interrupted
- Works: planting, real-time growth, offline summary, guests, brew drag, decor, time of day, results.
- P1 Portrait: brew panel rendered twice side by side (overflows width); `p_results` shot shows the brew screen instead of results (portrait test path never reaches results).
- P1 Barista at the counter (brew view) is a huge dark-red blocky figure filling the top half — model too close / wrong tint.
- P2 Portrait greenhouse view clipped on the left; floating name/timer labels overlap and run off-screen.
- P2 Guest name tags overlap each other near the counter.

#### Driftwood Builders — `games/builders.html` · NO_ERRORS (208 / 133) — builder was interrupted
- Works: gather, quests, build palette + ghost, dock + boat, day/night, sleep → results, photo mode, share/visit.
- P1 Camera occlusion: palm trunks fill the foreground (swing shot) — no occluder fade.
- P1 Portrait build palette is clipped (first item cut off at the left edge, needs horizontal scroll affordance).
- P2 "Quest complete" toast overlaps the quest card (both orientations); visiting banner overlaps toast.
- P2 Tree tints inconsistent (some near-black), trees placed with visible base offsets; dark ghost shape under the boat in water.

#### Fail Tray — `games/tray.html` · NO_ERRORS (248 / 165)
- Works: 8 courses, wobble physics, slow-mo replay, hot-seat, party final.
- P3 "TABLE 7" sign clips into a tree; tie result wording fine. Test writes fixed names (landscape overwritten).

#### Pact Trivia — `games/trivia.html` · NO_ERRORS (404 / 223)
- Works: solo vs bots, 4 local buzzers, steal, wager, secret answers, EN/ES, kids mode.
- P1 Portrait: the question board is cut off on answer/correct/winner camera shots (camera too close for portrait FOV).
- P2 Question bank (~160) needs fact-check (Phase 5).

#### Draw the Pact — `games/draw.html` · NO_ERRORS (260 / 150) — final test was running when builder stopped; re-run passes
- Works: party (pass, peek, reveal, scores), Speed Sketch to gallery wall, Telephone chain + slideshow, undo, eraser, sizes, colours, EN/ES.
- P1 **No gamepad support** (no `createInput`/`getGamepads`).
- P2 Stylus pressure is read from `PointerEvent.pressure` but cannot be verified headlessly.

#### Pixel Pact: Depths — `games/depths.html` · NO_ERRORS (61 / 40 — DEPTHS_MODE full, autopilot wins)
- Works: 4 classes, AI allies, P2 drop-in, 8 rooms + boss, boons, camp.
- P1 Portrait: room occupies the top ~55%; bottom of the screen is empty black (camera not framed for portrait).
- P2 Big banner texts overlap ("ROOM CLEAR" over boss title, "THOUSAND CUTS" over "ROOM CLEAR"); damage numbers clutter; boss intro blown out (bloom on white boss).
- P2 Results say "9/9 rooms" for 8 rooms + boss. Story bots dodge too perfectly (known).

#### Snack Squad Safari — `games/safari.html` · NO_ERRORS (42 / 32)
- Works (per code + 2 shots): title, level 1 play.
- P1 Not on the shared engine (embeds its own renderer/loader/audio copy); awards XP through an inline `__inoaReward` shim instead of `E.results` (no best score, no shared results card).
- P1 **No gamepad support.** Test covers only title + 1 second of play (no rescue, no levels 2–5, no portrait check of labels).
- P1 Action-plan / rescue wording (epinephrine auto-injector, 911) **must be reviewed by a board-certified allergist before families use it.** Not medically reviewed. Do not change it on assumptions.

#### Pixel Pact (2D) — `games/pixelpact.html` · loads NO_ERRORS L/P (no test)
- Works: adventure + match, 1–4 local players, gamepads.
- P1 No `window.__GAME` hooks or test; rewards through inline shim (no best score); not on the engine.

### Load sizes (baseline, measured from repo files)
| Pack | MB (base64 JSON) |
| --- | --- |
| drift 6.7 · draw 6.0 · fit 5.7 · safari 5.7 · trivia 5.0 · depths 4.9 · builders 4.7 · brew 4.5 · runner 4.4 · tray 4.0 · tidelines 3.5 · junk 3.4 | three.js (jsDelivr, ~700 KB module graph) on top |
FPS on real devices: **not measured** (headless is software GL; numbers there are not representative).

### Execution order (from this audit)
1. Phase 1: Builders, Brew, Draw (gamepad), Fit/Junk portrait framing, Depths/Trivia/Tide Lines portrait cameras, Safari engine migration + gamepad + fuller test, Pixel Pact hooks; hub honesty pass.
2. Phase 2: file packs + manifest, PWA.
3. Phase 3+: as in CLAUDE.md.

---

## Phase 1 status — finish and fix all games (2026-10-15)

Each game below was changed by one game agent and then **re-tested by the lead** at 1000×560 and 390×844 (both `NO_ERRORS`), with screenshots reviewed. Agent write-ups: `docs/audit-notes/<game>.md`. "Real device" checks (touch feel on a phone, stylus pressure on hardware) are **not** done — headless synthetic events only.

| Game | Result | Fixed | Still open |
| --- | --- | --- | --- |
| Driftwood Builders | Tested + visually verified | Occluders fade (trees/rocks/walls/roofs, player visible inside house), camera pull-in on hills; trees grounded + untinted; phone palette with ‹ › + centred selection; toasts below quest card; boats face travel direction, sit in water, no ghost shadow; results once; EN/ES; gamepad | Palm fronds at screen edge (not blocking); real-phone touch feel |
| Brew and Bloom | Tested + visually verified | Barista re-cast + reframed; portrait ingredient tray; labels kept on screen + de-overlapped; save sanitising; offline summary capped/once (test reloads twice); results once; EN/ES; gamepad. (Audit's "panel drawn twice" was a misread of a 2-up contact sheet.) | Barista head touches HUD in landscape brew view; guests slightly large vs chairs |
| Draw the Pact | Tested + visually verified | All 3 modes both orientations; real pointer accuracy ≤1 px, undo/eraser/sizes/pressure fallbacks, pointercancel + resize; **gamepad added** (menus + cursor drawing); language consistent with profile; results once per mode | Gamepad-only players cannot type Telephone descriptions; real stylus untested |
| Perfect Fit | Tested + visually verified | Drop judged under the pointer (<2 px, also at edges); touch lift offset; cancel/blur safe; portrait mats ~95% width, upright lids; EN/ES; results once | ~80–100 px unused table on some portrait levels |
| Junkyard to Jewel | Tested + visually verified | Fast strokes re-traced (no gaps), no paint across air, cancel ends stroke; portrait car fills ~92% width; reveal/slider framing; EN/ES; gamepad pause; results once. Rust under paint = intended primer | Palette covers lower turntable in landscape |
| Snack Squad Safari | Tested + visually verified against `safari_before_*` | **Migrated onto engine/inoa3d.js** (all 25 inventoried features kept), **gamepad added**, `E.results` (best recorded), `__GAME` hooks; safety text unchanged | Rescue steps have no Spanish (needs allergist + translator); 911 script always names "Dawn Trail picnic area"; rescue speech bubble clipped at 390 px |
| Pixel Pact: Depths | Tested + visually verified | Portrait camera; banner queue (1 at a time); merged damage numbers; boss intro bloom .2; honest "8/8 rooms + boss"; Story allies react late / miss / roll less; EN/ES | Dark floor strip under the room in portrait (behind touch pad on phones); class/boon names EN only |
| Pact Trivia | Tested + visually verified | Every camera shot fits the board in portrait; score chips full width; toasts off the board; kids mode never subtracts; wager keys/gamepad; language follows profile; results once | Pause menu text refreshes on reopen only |
| Tide Lines | Tested + visually verified | Camera keeps ≥3.2 m from player and lifts out of props; props fade when blocking; close-up mode; name-tag clutter cut; EN/ES; results once with `won` | One map; blaster follows aim not forearm |
| Island Drift | Tested + visually verified | Chase camera keeps the kart in frame while drifting; compact name tags; hero default + kart tint | Kart sits right of centre in portrait drifts |
| Pixel Pact (2D) | Tested + visually verified (elevation pass 2026-10-16, below) | 10 islands, world map, 6 heroes, 3 match modes × 5 arenas, EN/ES, read-aloud, drop-in | Not on the engine (Phase 5 rebuild); real-phone feel/FPS |
| Tide Runner | Tested (baseline) | — | P3 polish (hearts chip wrap) deferred to Phase 5 |
| Fail Tray | Tested + visually verified (elevation pass 2026-10-16, below) | Sign clipping fixed; portrait Play button; 18 courses | Real-phone feel/FPS |

### Allergist review required (Snack Squad Safari)
Every safety-relevant string (EN + ES) is listed verbatim in `docs/audit-notes/safari.md` → "For allergist review": the drill card, rescue steps (tell a grown-up, epinephrine auto-injector "blue cap off, orange to the outer thigh", hold and count, call 9-1-1, lie down and wait), symptom lists, disclaimers and friend-offer lessons. **None of it has been medically reviewed.** The game states it "teaches habits, not medicine" and to follow one's own action plan. Do not market it to families until a board-certified allergist signs off; the missing Spanish rescue steps must be translated and reviewed together.

### Cross-cutting fixes made during Phase 1
- Test harness fixed for clean installs; portrait screenshots suffixed; service workers blocked in tests.
- Hub rebuilt (8 games were unreachable) and honest copy (no pricing / online rooms / QR claims).
- Survivor character textures cleaned for all ages (dirt/torn splotches, red skin) at the asset level (`tools/clean_textures.mjs`), so every game gets the clean version.
- Engine: compact name tags, scrollable title cards, results best only when passed.

### Phase 1 regression (final)
`/tmp` run of all 13 games × 2 orientations on the current engine: **26/26 `NO_ERRORS`** (drift, runner, tidelines, fit, junk, brew, builders, tray, trivia, draw, depths, safari, pixelpact). Engine contract (`test/engine.js`), hub (`test/index.js`), offline (`test/pwa.js`) and hero default (`test/hero.js`) also pass. One-shot-per-game contact sheet reviewed; no regressions from the engine or texture changes.

## Phase 2 measurements — load size and time (2026-10-15)
Measured with `node test/run.js <game> test/perf.js` in a 4-core container with **software WebGL (SwiftShader)** and a local server. Ready time = navigation → `__READY` (500 ms polling granularity). FPS here is **not** device performance (every 3D game shows ~2 fps under software GL); it is only useful to compare games relative to each other. Real-device numbers (2021 mid-range phone) are still **not measured**.

| Game | Pack before (base64 JSON) | Pack now (manifest files) | Requests | Ready (ms) | Relative fps (SW GL) |
| --- | --- | --- | --- | --- | --- |
| drift | 6.7 MB | 1.87 MB | 50 | 1516 | 1.9 |
| runner | 4.4 MB | 1.37 MB | 46 | 2449 | 2.6 |
| tidelines | 3.5 MB | 1.04 MB | 37 | 3784 | 2.0 |
| fit | 5.7 MB | 1.33 MB | 63 | 1132 | 0.3 (title scene heavy under SW GL — check on device) |
| junk | 3.4 MB | 0.81 MB | 33 | 1470 | 1.8 |
| brew | 4.5 MB | 1.29 MB | 49 | 2401 | 1.1 |
| builders | 4.7 MB | 1.74 MB | 51 | 3519 | 2.3 |
| tray | 4.0 MB | 1.16 MB | 52 | 1658 | 1.9 |
| trivia | 5.0 MB | 1.37 MB | 31 | 2866 | 2.2 |
| draw | 6.0 MB | 2.21 MB | 36 | 1992 | 2.1 |
| depths | 4.9 MB | 1.93 MB | 50 | 2398 | 2.3 |
| safari | 5.7 MB | 1.38 MB | 77 | 1516 | 2.1 |
| pixelpact (2D) | — | — | 1 | 511 | 13.8 |

Not included: three.js (~700 KB of modules from jsDelivr, cached by the service worker after the first game) and fonts. Models are shared between games, so the second game a player opens downloads far less. Vercel will also gzip/brotli the `.hdr`/`.json`.

## Drift elevation pass (2026-10-15)
Island Drift (`games/drift.html`) re-audited and extended by one game agent. Tested with `test/drift.js` at 1000×560 and 390×844 (both `NO_ERRORS`, screenshots reviewed), `test/party_drift.js` (online race to guest results, `NO_ERRORS`), hub `test/index.js` (`NO_ERRORS`), plus a Spanish-language pass.

**Bugs fixed**
- AI karts parked at sharp corners: the corner speed cap `skill × band × (1 − corner × 1.6)` went negative on hairpins, so karts reversed and stalled (baseline race ended with AI laps `[2,0,0,1,0]`). Cap is now clamped to ≥ 0.5; every AI now finishes 2+ laps when the player wins (`laps [3,2,2,2,2,2]`, `stuck 0`).
- Road sank under the grass just after the start line (spline overshoot: −0.20 m on Sunset Coast, −0.52 m on Lantern Harbor), so karts looked like they drove on grass (visible in the old tile art). Heights are clamped to ≥ 0.
- Raised road floated in the air: embankments now slope from the road edge to the ground; lamps and tire walls stand on the slope; karts off the road follow the slope height.
- Reversing over the finish line took a lap back but never re-armed the half-way flag, so the next real crossing was not counted (a whole lap lost).
- Drift camera: it chased the kart's heading while the kart travels along heading + slip, so drifts slid the kart to the frame edge. The camera now follows the travel direction; the kart stays centred (projected x −0.10 landscape / −0.25 portrait mid-drift, NDC; was near the edge) and portrait pulls back a little.
- Title card overflowed 560 px landscape: two-column layout on short landscape screens (card 44–516 px of 560, no scroll); portrait keeps Hub/Play in a sticky bar.
- Empty item slot showed a lone "·" → faded 🎁 slot; AI name tags carry a personality emoji on a tinted pill.
- No rescue for a stuck player (only AI recovered): player/phone karts are put back on the road after 2.5 s stuck or a few seconds off-road (3.5 s on Easy). "Wrong way!" banner + read-aloud.
- Lap 1 time now starts at the line (it included the grid run-up), so the time-trial ghost lines up.
- Particles froze during the finish sequence (updated only while racing).

**Added**
- 2 new tracks (4 total): **Harvest Hills** (rolling farm hills, pumpkins, tractors, hay bales) and **Frosty Peaks** (figure-eight with a snowy bridge over the lower road: pillars, rails, karts on different levels never collide; instanced pines + snowmen, falling snow). New models in the pack: `low-poly-tree`, `tractor`, `pumpkin`, `formation-stone` (pack 1.87 → 2.10 MB; all already in `packs/assets`).
- **Time-trial ghost**: best lap per track recorded at 12 Hz, stored on the device (`inoa.drift.ghost.<track>`), replayed as a translucent kart with a 👻 tag and on the minimap; lap toast shows ± vs the ghost.
- **Island Cup**: the 4 tracks back to back, points 10/8/6/5/4/3, standings card after each race (EN/ES, read aloud, gamepad focus), `E.results` at the end (XP scaled to races run; quitting early still pays).
- **AI personalities**: Bold (🔥 faster, chases the kart ahead, drifts and fires items quickly), Careful (🌿 clean centre line, slows for corners, saves shields/boosts), Item lover (🎁 uses items at once), All-rounder (⭐).
- **Difficulty**: Easy (default; front row, rivals wait for you, gentle off-road/coconut penalties), Normal (mid-pack), Hard (back of the grid, faster rivals). Autopilot check: Easy wins by most of a lap, Normal close, Hard 2nd–6th.
- Juice: mini-turbo bursts, boost exhaust, coconut/shield/bump/wall sparks, confetti + fireworks at the finish, orbit camera after the finish (off with reduced motion). Full EN/ES for every string; read-aloud for start, final lap, finish, wrong way, cup standings.
- Hub tile copy (EN/ES) and `thumbs/drift.jpg` refreshed.

**Still open**
- Real-device feel/FPS (headless only). Snow (700 points) and the new instanced scenery should be cheap, but unmeasured on a 2021 phone.
- Ghost/cup are offline only; online races stay single Grand Prix (guests get no ghost).
- Bridge ends are plain slab abutments; no jump/air physics (height simply follows the road).
- Autopilot is a weak stand-in for a human; difficulty numbers need a real play test with kids and adults.
- Engine: none changed. `tag()` with an emoji is still drawn at 96 px serif, so on systems without a colour-emoji font the tag shows text only.

## Depths elevation pass (2026-10-15)
Pixel Pact: Depths (`games/depths.html`) re-audited and extended by one game agent. Tested with `test/depths.js` (now plays Act I and Act II end to end) at 1000×560 and 390×844 (both `NO_ERRORS`, screenshots reviewed), `DEPTHS_DIFF=hard DEPTHS_ACT=2` (`NO_ERRORS`), `DEPTHS_MODE=quick` portrait/touch (camp, cards, P2 drop-in, touch pad, fail path, `NO_ERRORS`), `test/party.js test/party_games.js` (phone 2 takes over an ally, custom buttons, `NO_ERRORS`) and hub `test/index.js` (`NO_ERRORS`).

**Bugs fixed**
- Boss blew out to white during the fight (`depths_bossfight.png` before): constant ally hits kept the hit-flash emissive at 1.0 under bloom. Bosses now flash at 0.28 and their wind-up flicker is damped; the colossus' rock body no longer floods red while winding up.
- Phase toasts collided with banners ("The captain is enraged!" under "BLADE STORM"): banners now carry a subtitle line (`bigText(t, {sub})`), phase hints moved into it and are read aloud. Banner moved to 42 % and capped at 64 px, so it clears the toast row on phones.
- Bosses melted in ~20 s and burst damage skipped phases: phase gates (damage stops at the 66 %/33 % thresholds, the boss roars into the next phase), AI allies deal 60 % to bosses, captain HP 4400 → 6500. Autopilot boss fights are now 45–55 s on Story, ~105 s on Hard; every run reaches phase 3 (test-checked).
- "dodged" text precedence bug (`a && !b || c`) showed it for bots too; replaced by human-only **Perfect dodge!** feedback.
- Floating damage numbers carried over into the next room (seen in the boss intro); cleared on room change. Ally-only hits under 15 are hidden (less clutter).
- AI allies could stall on obstacles: they sidestep after 0.8 s without progress and regroup next to the leader after repeated stalls (`unstuck` counter in `state()`; 0–1 per full run).
- English-only text: classes, boons, camp/meta upgrades, difficulty, party picker, room names, ultimates, toasts (P2/phone join/leave, phoenix, lucky deck, revive), HUD labels and pause line now EN/ES (`loc()` + `E.L`). The test switches the shared setting to Spanish and checks the title has no English leaks.

**Added**
- **Act II: The Glowroot Hollow** (unlocks after beating Captain Brinehollow; `?act2` opens it for previews): Glowroot Grove (giant trees, glowing caps, fireflies), Coral Grotto (tide pools, coral, mussels, a circling school of fish, rising bubbles), Old Crystal Mine (timber supports, rail line with ore carts, lanterns), Amethyst Halls (crystal pillars), Colossus Hollow. Title has an Expedition picker (EN/ES, lock reason shown, NEW badge); results show the act; best depth tracked per act. Pack adds `tree-big`, `fish`, `mussel` (all CC0, already in `packs/assets`; pack 2.04 MB).
- New foes with readable, distinct attacks: **Sporecap** (swells inside a red circle, bursts, leaves a purple cloud that slows), **Burrower** (digs in, a dirt trail chases you, a red circle marks where it pops out, then it is dizzy and open), **Crystal Sentry** (shows three red lanes, fires three shards).
- **Boss 2: Grumblestone, the crystal colossus** (built from CC0 rocks + a glowing core, arms animate separately). Phase 1: fist smash (fist gets stuck → "Weak spot!", +60 % damage on the glowing core) and boulder toss. Phase 2: crystal spike lanes toward each hero + summons sentries/burrowers. Phase 3: shock rings that roll outward; a dodge roll passes through (Hard: double rings). Intro is read aloud with the weak-spot tip.
- 5 new boons (19 total, all EN/ES): Frost Touch, Field Medic, Rally Cry, Finishing Blow, Bubble Guard (visible bubble while ready).
- Juice: perfect-dodge chime + brief slow-mo (skipped with reduced motion) + ult charge; boon pick bursts a golden ring on every hero; spike eruptions; shock rings. Gate nudge if nobody walks through after 12 s.
- Test: both acts, new foe types must spawn, boss phase 3, shock rings, results once per act, Spanish title, Hard run, fail path (`wipe()` hook → "Fallen in the Depths", one results card), act II close-up (`depths_a2_lab.png`). New tile art `thumbs/depths.jpg`; hub copy EN/ES (two acts, 19 boons, 1–4 players).

**Still open**
- Real-device feel/FPS: the grove/reef add ~10 tree and 12 mussel instances plus 9 animated fish per room (cheap, but unmeasured on a 2021 phone).
- Portrait: at the start of a room the bottom ~30 % is apron floor (inherent to a 17-deep room on a tall screen; mostly behind the touch pad).
- The autopilot is a sharp stand-in; Story balance (boss HP, Act II foe density) needs a play test with kids.
- Online (separate-screen) play is still Drift-only; Depths phones are controllers for the big screen.
- Engine: none changed. Requests: an engine `bigText` queue with subtitles (several games hand-roll it).

## Tide Lines elevation pass (2026-10-15)
Tide Lines (`games/tidelines.html`) re-audited and extended by one game agent. Tested with `test/tidelines.js` (full Sunny Pier match + Rooftop Garden and Island Market in Tide Pools) at 1000×560 and 390×844 (both `NO_ERRORS`, screenshots reviewed), `TL_QUICK=1` re-runs after each fix, `test/party.js test/party_games.js` (phone 2 joins your team, `NO_ERRORS`) and hub `test/index.js` (`NO_ERRORS`).

**Bugs fixed**
- Bots picked the rival base as a paint target: it is pre-painted in the rival colour (so it scores as "worth flipping") but can never be painted, so bots stood there spraying. Targets near the rival base are now skipped.
- Spawn camping: baseline runs had coral bots fighting at z ≈ 16 (inside the teal spawn, e.g. `Zuri:fight:-10,16`). Bots no longer chase rivals who are on their own base, and each base is a safe zone (no damage on your own pad). The test counts camping samples (0 on every arena).
- Bots stalled at the foot of a ramp (they walked to the waypoint and stopped) and against ramp sides in fights (`Luna@7.4,-0.0`, `Mateo@-1.5,3.1` in the stuck watch). Ramps now give generic low/high waypoints, reaching the foot continues up, and fight movement sidesteps when blocked. Long standoffs (6 s without a splat) break off into painting; in the last 30 s bots fight less and paint more. Teammates spread out instead of piling onto the same patch.
- Team colour relied on hue only. Teal ink now carries light dots and coral ink diagonal stripes (canvas patterns), teal rings are circles and coral rings triangles, and ● / ▲ appear on name tags, the % bar, the minimap, the judge card and the base flags.
- Ink bomb had no aim feedback: a landing ring shows where a bomb would land whenever one is ready, the 💣 button dims when ink is short, impacts show a splash ring and "+N m²".
- Phone join/leave toasts were English only; title cards could stack when the title was reopened; camera shake ignored reduced motion.
- Default bots were "Normal"; the kid-friendly "Chill" tier is now the default for new saves.

**Added**
- **3 arenas** (same 40 × 40 m paint field, different layouts/themes, all existing CC0 models): Sunny Pier (original), **Rooftop Garden** (sunset roof deck over an instanced city skyline, central deck with two ramps, flower beds, skylights, tree tubs, hedges, water tanks, string lights, neutral pavers so unpainted floor never reads as coral), **Island Market** (canal across the middle with three bridges, ink flies over water but painters can't walk in it, striped fruit stalls with produce, two fish-dock decks, ferris wheel and town backdrop). Title picker with a live preview; pack adds `plant`, `low-poly-tree`, `bench`, `watermelon`, `banana`, `fish`, `cabbage`, `wind-turbine`, `ferris-wheel`, `chest`, `house-3`, `house-6`, `coconut` + the `sunset` HDRI (pack 1.09 → 1.90 MB; every file already in `packs/assets`).
- **Tide Pools mode** (original name; generic hold-the-zones idea): three glowing pools per arena; half the pool painted takes a neutral pool, 58 % takes a held one (hysteresis: an early build flipped the market centre pool 100 times in 70 s); 1 point per pool per second; first to 180 is a KNOCKOUT, else most points at 2:30 (turf breaks a tie). Pool chips in the HUD, rings on the minimap, points bar with a goal line, toasts + read-aloud (rate-limited) on every change of hands. Pool bots go for the pool their team is losing.
- **Star ladder**: a win on Chill / Normal / Fierce earns ★ / ★★ / ★★★ per arena + mode, shown on the arena buttons and the results card (+25 XP, +10 coins for a new star).
- Drama: 30 s "final push" call, 5-4-3-2-1 big countdown, drum-roll judge (ticks speed up), winning bar pulses, margin line ("by a hair: 0.7%"), "KNOCKOUT!" banner. Hit vignette when hurt, "Splatted by Kai, back in 2…".
- Test: fresh-save defaults (Chill, 3 arenas), stuck/water/base-camp watch on all arenas, pools must change hands and score, knockout, stars, Spanish title (arena + mode names).

**Still open**
- Real-device feel/FPS (headless only). The rooftop adds 40 instanced towers, ~60 bulb instances and a few lines; the market ~20 small produce models. Cheap, but unmeasured on a 2021 phone.
- Touch aiming is unchanged in design (spray where you walk, drag 💦 to aim, soft snap to a rival in front); it needs a real-phone play test, as does Tide Pools balance on Chill (bots sometimes win the pools 120–40).
- The held blaster still follows the aim heading, not the forearm (visible in close-ups only).
- Phones: 8-player mapping is unchanged (phone 1 = you, 2–4 your team, 5–8 the other team); the party test drives 2 phones. Online (separate-screen) Tide Lines is still not built.
- Engine: none changed. `tag()` draws its emoji slot in the pill colour for plain text glyphs (● ▲ vanish), so shapes are put in the text instead.

## Brew and Bloom elevation pass (2026-10-15)
Brew and Bloom (`games/brew.html`) re-audited and extended by one game agent. Tested with `test/brew.js` at 1000×560 and 390×844 (both `NO_ERRORS`, every screenshot reviewed), hub `test/index.js` (`NO_ERRORS`), plus Spanish, seasonal and old-save passes inside the brew test.

**Bugs fixed**
- Camera framing was a width/height guess per mode, so some orbit angles still clipped the diorama (portrait golden/night shots cut the café wall on the left) while landscape wasted space. Every view (café, decor, brew) now projects the diorama's key points and binary-searches the distance, then pans to centre them in the free screen area (HUD, touch buttons, recipe card and decor panel subtracted). No clipping at any angle or aspect; results are cached per angle/size.
- Labels ran under the touch buttons (bottom-right "Honey Mint" tag behind 🫖 in `brew_morning_close`). Label layout now treats the buttons as obstacles. Labels also got a larger invisible tap area.
- Guests and barista were ~2.5 m tall (`instance(fit:'height')` measures the unposed mesh). Each rig is now measured once from its skinned bounding box and scaled to 1.6 m (`male`/`skater-*` ×0.61). The barista no longer fills the top of the landscape brew close-up (he steps out of shot; portrait keeps him small at the back).
- Grown plants were tiny sprigs from the diorama camera: plants now 30% bigger. A plant that finishes while you watch gets a chime, a sparkle and a read-aloud hint (once).
- Results card: the favourite tea name was cut off (5 stat tiles); the café level moved into the "best" line.
- Round-table bases rendered as black holes; the generic pbr wood made the floor and furniture look like noisy orange carpet. Soft plank texture for the floor and light wood.
- Landscape decor shop covered the bottom 45% of the screen, so the café floor was tiny: it is a side panel in landscape (tools on top), bottom sheet in portrait.
- HUD wrapped to two lines at 390 px once hearts reached two digits: compact chips at ≤430 px.
- Tall decor placed in front of the counter (e.g. the flower arch) blocked the brew close-up: it is hidden while brewing (found in `brew_es_brew` / `brew_p_es_brew`).
- Save loading: a non-object save (string/array) is ignored instead of being spread into the state; new fields (book, friends, requests, level) are sanitised like the old ones.

**Added**
- **Café levels 1–10** from lifetime hearts (3-ingredient teas give 2 hearts). Each level unlocks something: lavender, rose, milk, the season's plant, moon orchid; 9 new teas (16 total: Rose Petal, Rosy Lemonade, Cozy Milk Tea, Blossom Latte, Strawberry Cooler, Pumpkin Cloud, Clementine Glow, Moon Milk, Garden Party); 8 new decor items (fruit crate, pastry case, little piano that plays a tune, garden fountain, café pup that hops when tapped, flower arch, mint and starry wallpapers); golden teapot (level 9) and a gold star on the sign (level 10). Level-up card once per level, read aloud, gamepad A.
- **Regulars' requests + stories**: 6 regulars (Mila 📚, Theo 🎸, Kenji 🌻, Lucía 🎨, Finn ⚽, Ada 🔬) leave 3 requests a day (same all day, nothing lost if left). Requested regulars visit more often and order their tea. Finishing a request pays coins + 2 hearts and unlocks the next of their 3 story chapters as a non-blocking note (read aloud). All three: +25 coin bouquet.
- **Café journal** (📖 HUD chip, B key, gamepad LB/Back; Esc/B closes; engine menu focus works): Today (level bar + next unlocks, season special, visitor of the day, requests), Teas, Plants (collection book with counts, locked "???" entries, "back in spring"), Friends (story chapters).
- **Seasons** (northern-hemisphere months): one special seed + tea per season (cherry blossom, strawberry, pumpkin, clementine), only plantable in its season (harvest keeps). Island trees recolour per season (autumn now). The chalkboard menu lists the teas you can make.
- Brew counter shows only ingredients you have unlocked or have in stock (up to 12; portrait tray wraps to 2 rows; digits 1–9).
- Juice: pour stream from the spout, steam over the cup and over guests' cups, colour splash per ingredient, coin chip bump, confetti on level-up, fountain spray, piano notes.
- Pack: `apple`, `orange`, `pie` (1.35 → 1.37 MB; all files already in `packs/assets`). Hub tile copy (EN/ES) and `thumbs/brew.jpg` refreshed.
- Save v2 migration: a v1 save that was played keeps everything the first release gave it (lavender, moon orchid, every old tea and decor item) via a `legacy` flag, starts at its current level with no level-up flood. Covered by the test (v1 save with a bogus decor id and junk book/requests).

**Tests** (`test/brew.js`, PORT 8821/8822): existing loop (plant, grow, drag-brew, 5 serves → exactly one `E.results`, decor, offline once, timestamp sanitising, Spanish) plus level acknowledged after the shift, a request finished → story chapter + note, level-up card exactly once with Pumpkin + Milk listed, seasonal planting rules (spring blocks pumpkin, allows blossom; seed sheet shows only the in-season special; moon orchid locked), journal opens with B / 4 tabs / closes with Esc, all 6 new decor items placed, Spanish brew + journal, v1 → v2 migration.

**Still open**
- Real-device feel/FPS not measured (headless SwiftShader only). New per-frame work is small (cached camera fit, cached button rects, pooled particles).
- Portrait café view is width-limited (12 m diorama): no clipping, but the diorama uses the middle ~40% of the screen; pinch-zoom works.
- Seasons follow northern-hemisphere months; no hemisphere setting.
- Story text is EN/ES only by the agent; a native Spanish read-through is recommended.
- Landscape title card still scrolls at 560 px (5 how-to rows + time/lang options; engine card layout).
- Engine: none changed. Engine requests stand: `instance(fit:'height')` should measure skinned meshes (the game now works around it locally).

## Builders elevation pass (2026-10-15)
Driftwood Builders (`games/builders.html`) re-audited and extended by one game agent. Tested with `test/builders.js` (now plays the full 21-quest chain: chapter 1 house/crops/dock/boat/sleep, then chapter 2 islands, islanders, trades, bridge, crystals, lighthouse, postcards, wrap-up, save/share robustness, Spanish) at 1000×560 and 390×844 (both `NO_ERRORS`, screenshots reviewed) and hub `test/index.js` (`NO_ERRORS`).

**Bugs fixed**
- Boat lost from the save if the page closed mid-sail (boarding removed its `S.pieces` entry; disembarking then rewrote the *first* boat entry, wrong with two boats). The boat keeps its own entry while sailing and hopping off moves that entry. A save made at sea (or a corrupt `pos`) used to leave the player stuck in water on reload: `start()` now puts you back on the beach.
- Visiting twice stacked two visit banners; resetting the island while visiting left the banner up; resetting while sailing left the player parented to a deleted boat; opening Share/Visit while sailing broke the boat. All fixed (test: `banners 1`, `bannersHome 0`).
- Share codes: pasted codes broken over lines by chat apps were rejected; garbage like `hello world!` was half-parsed. Whitespace is ignored, codes are validated (seed digits, piece index, rotation `& 3`, cells within ±80), unknown future pieces are dropped (test `wrappedOK`, `garbage`, `odd`).
- Saves: `loadSave()` migrates v1 (4 resources, 10 quests) to v2 and sanitises every field (bad numbers, junk pieces, wrapped `dayT`); old depletion indexes stay valid because new nodes are appended after the home island's.
- Touch building: taps went through walls/objects to the ground behind them. Taps now hit what you see; on a wall/object the point is nudged toward the camera (through the wall when placing a roof). Test: tap → `side 2` edge, second tap places the wall, roof tap on that wall targets the cell behind it.
- Photo mode showed the Phones widget under "Exit photo" and kept toasts; both hidden (hint read aloud once). Pause/reset/share sheets and the photo button were English only; language now switches live (`inoa:settings`).
- Known Phase 1 items re-checked in screenshots: quest/toast/visit overlaps clean in both orientations (`layout … clean`), trees grounded, no ghost under the boat.

**Added**
- **Chapter 2 quest chain** (10 → 21 quests, EN/ES, next quest read aloud) unlocking build sets: Flowers + Tree (garden), Market stall, Cottage, Bridge, Glow lamp, Lighthouse. Palette shows unlocked pieces in set order with NEW badges; 1–9 pick from it.
- **Two new islands** reachable by boat or a long bridge: **Shell Cay** (sandy, shells 🐚, palms) and **Glowmoss Isle** (teal moss, glow crystals 💎 that light up at dusk, mushrooms). Own terrain patches/biomes, water shading per island, floating island signs and a light beacon on the island the current quest points to. Arrival celebration + read aloud.
- **Fishing** 🐟: bubbling rings off every shore; ✋ from the beach, a dock or the boat; the fish arcs into your hands.
- **Islanders**: each cottage invites one of six original islanders (Nori, Pip, Bo, Tavi, Wren, Luma) who wander near home, go to their door with 💤 at night, and ask small wishes (bring 2 🐟, plant 2 flowers…). Build wishes complete themselves, bring wishes on ✋; hearts, coins and a gift.
- **Market stall** trade sheet (6 swaps, gamepad focus ring), **Postcards** (4 stamps per island, +20 🪙 when complete, 📮 button), **Wrap up** in the pause menu (results + XP without waiting for night; the day results show Islanders and Stamps).
- Feel: place = drop + squash + dust ring + a chime that climbs for quick runs; remove/undo shrink away with refund float text. Ambient: gulls circling each island, hopping bunnies that flee, surf hush near the shore, chimney smoke, rotating lighthouse beam at night.
- Pack adds `male`, `cyborg-female`, `bunny`, `fish`, `mussel` (all already in `packs/assets`; manifest 33 models, 2.07 MB). New tile art `thumbs/builders.jpg`, hub copy EN/ES.

**Still open**
- Real-device feel/FPS (headless only). New cost: two 46×46 terrain patches, ~40 nodes, up to 6 skinned islanders (frozen beyond 70 m), 7 gulls, 5 bunnies.
- Islanders walk without pathfinding (they slide along walls and re-pick a target when stuck); they never leave if their cottage is removed (cozy by design).
- Headless Chromium has no colour-emoji font, so some emoji (🐚, 🌷) render blank in screenshots only.
- Visiting shows a friend's pieces but not their islanders/postcards (codes carry pieces only).
- Engine: none changed.

## Junkyard to Jewel elevation pass (2026-10-15)
One game agent re-audited and extended Junkyard to Jewel (`games/junk.html`). Tested with `test/junk.js` at 1000×560 and 390×844 (both `NO_ERRORS`, `ALL CHECKS PASSED`, every screenshot reviewed). Also run: the engine contract (`node test/run.js junk test/engine.js`) and the hub (`test/index.js`).

**Bugs fixed**
- **Portrait framing shrank when the vehicle turned.** The fit used the footprint diagonal, so a nose-on or 3/4 vehicle covered only about 45–60% of a phone's width.
  - Fix: `fitCam()` now runs every frame. It projects the 8 corners of the vehicle box at the current turntable angle (±0.1 rad, so spinning doesn't pump) and bisects the closest distance where every corner fits sideways. The vertical span must fit the free band left by the HUD, step chip, palette, spin and garage buttons, and the span is centred in that band.
  - Phones: 0.69–0.87 of the width over a full turn (`junk_start_p` 0.85).
  - Landscape: no longer uses the loose bounding sphere. Height fill went from 0.46 to 0.57 at the start, width is 0.35–0.71 by angle, and the palette and garage buttons no longer cover the vehicle.
  - The reveal orbit eases out slightly instead of pushing in, so the tight fit never clips.
- **Progress could stall below the 92% auto-finish.** It counted voxels the brush can never reach: wheel wells, the cab floor, gaps behind the wheels, under the sail ship's deck.
  - Fix: at build time each exterior voxel is tested for a line of sight along 36 orbit directions through the voxel grid, and hidden voxels weigh 0 in every stage.
  - Test: rays swept from 8 angles × 2 tilts reach ≥ 92% wash on the hatchback, the fire engine and the sail ship.
- **Fast curved strokes were drawn as one straight segment per frame.** Every coalesced pointer sample now joins the stroke path. The path is re-cast at about 10 px steps, up to 80 rays a frame. Rays that miss the vehicle paint nothing, so paint still never bridges across air.
- **Spinning on a phone needed empty floor**, and there is almost none once the vehicle fills the screen. A second finger anywhere now turns the gesture into a two-finger spin/tilt and ends the stroke. Test: `twoFinger` with `mode spin2`, yaw changes, not brushing.
- **Brush size was invisible.** A surface-aligned ring in the tool's colour now shows where the tool works and how big it is. It also follows the mouse on hover, before you click. Test: `brush ring visible while working`.
- **Restarting from the pause menu dropped a shop order.** The order is now kept on restart.
- **Rust showing through the paint (known item):** re-checked in `junk_paint_done(_p)`. The orange patches in the portrait shot are the hatchback's tail and side lamps, not rust. Sanded rust is fully cleared before painting, so no change was needed.

**Added**
- **16 vehicles (was 8)**, all CC0 Kenney models already in `assets/models`:
  - Rowboat and Little Sail Ship: boats, with wood words for stage 2 ("Sand old varnish").
  - Trail Wagon, Track Racer, Box Truck, Rescue Van, Fire Engine, Rocket Racer.
  - Every vehicle has an EN/ES name and story.
  - Pack: 10 → 18 models, 0.85 → 1.20 MB, every manifest file present in `packs/assets`.
  - No scooter, plane or train: no CC0 model exists for them. `bike.glb` is 4.7 MB. `citroen-old-van` is skipped (brand name).
- **Paint customisation.** Tabs under the palette: Colour, Accent, Design, Wheels.
  - Designs are original simple shapes: Solid, Two-tone, Stripes, Band, Wave, Dots, Stars.
  - The grime shader draws them in the vehicle's own space, so no UVs are needed. They appear exactly where you spray.
  - The accent colour also paints the secondary paint material on two-colour models (racers, box truck, rescue van, fire engine, sail ship).
  - Wheels: Steel, Chrome, Gold, Black, White.
  - Keyboard/pad: Shift/B = next swatch, E/X = next tab.
  - The design tip is read aloud once.
- **Shop orders.** Three friendly customer wishes a day, from a date seed, using unlocked vehicles only.
  - Each wish has a vehicle, a colour and, for two of the three, a design with an accent colour.
  - Starting one loads the wish into the spray gun at the paint stage. You can still change it: the customer is happy either way.
  - A match pays a ⭐ plus bonus coins and XP. Any result still pays something, and nothing can fail.
  - Shown on the title (`junk_title_orders`), in the HUD (🧾) and in the results ("⭐ Perfect match" / "😊 Happy"). The wish is read aloud.
- **Garage photo card** (📷 in the garage; Y on a gamepad). A 1200×800 PNG with:
  - the restored vehicle, rendered live
  - a Day 1 inset, the same camera with the junk mask
  - the name, paint and design, plus "Restored by <hero name>"
  - Save (download) and Share (Web Share with the file when supported) buttons.
  - The garage also shows a counter (n/total), and LB/RB browse.
- **Feedback:**
  - suds that cling and slide when washing
  - a paint-mist hiss
  - a polish glow
  - the brush ring in the tool's colour
- **Gamepad:** the engine's `menuNav()` focus ring covers the title (orders, junkers), results and photo card.
- **Save v2 with migration.** Garage entries keep `{colorIdx, accent, style, rim}`, and there are orders and stars. Every field is sanitised.
  - A v1 player who finished the old last vehicle unlocks the new ones; old colour names map back to palette indexes.
  - Garbage saves (a string, an array, null) are ignored.
- Hub tile copy (EN/ES) updated. `thumbs/junk.jpg` refreshed.

**Tests** (`test/junk.js`). Everything from Phase 1, plus:
- two-finger spin
- brush ring
- paint tabs (design, accent, wheels by tap; tab and swatch by keyboard)
- the garage keeps the look
- photo card PNG and save link
- three orders, wish preloaded, a match pays a star and is ticked off
- v1 → v2 migration and garbage saves
- reachability on 3 vehicles
- 16 vehicles, with junk-state shots `v1`–`v15`

**Still open**
- Real-phone feel and FPS are not measured (headless only). A vehicle builds in 80–600 ms headless, mostly voxelising plus the reach pass, and only when a vehicle is picked.
- A design edge is about 6 cm soft on the 5 m vehicles: the voxel grid has 76 cells on the long axis.
- Dots and stars stretch slightly where the box projection switches faces on curved panels.
- On some Kenney models `_defaultMat` covers a small grille part as well as the hubs, so the wheel finish tints that part too.
- Orders use local midnight. There is no streak or weekly order yet.
- Engine: unchanged.

## Perfect Fit elevation pass (2026-10-15)
Perfect Fit (`games/fit.html`) re-audited and extended by one game agent. Tested with `test/fit.js` (now covers all 20 boxes) at 1000×560 and 390×844 (both `ALL CHECKS PASSED` / `NO_ERRORS`, screenshots reviewed), plus a before/after framing measurement against the pre-pass build.

**Bugs fixed**
- **Phones as controllers did nothing in-game**: the game read `navigator.getGamepads()` directly and never polled the engine input, so a phone joined from the party panel could not choose, pick up or place. `pollPad()` now merges physical pads with `input.pad(slot)` for every phone (stick chooses, A picks/places, B puts back, C/D hint, ⏸ pauses). Test: a fake phone in `E.net.players` places an item and pauses the game.
- **Pause menu over the title**: hiding the tab (or ⏸) while the menu box was showing opened the pause menu on top of the title card and restarted the music. The menu box is now flagged and never pauses.
- **Box too small on phones** (open P2 since Phase 1): the layout now tries both quarter turns of the box and 17 placemat shapes and keeps the one with the closest camera (largest on screen). Wide drawers stand tall on phones (desk, cutlery, fridge, café, fruit, veggie, toys turn in portrait); the leftover table under a width-limited mat is filled by deepening the mat. Mean item width on screen, portrait 390×844, before → after: lunch 68→75 px, spice 53→58, desk 70→87, cutlery 116→141, fridge 43→54, café 49→66, fruit 37→49, picnic 42→50, bakery 47→51. An orientation change mid-level rebuilds the turned box and keeps placed items in their slots (test-checked).
- **Rectangular items could settle 90° off their outline**: the "round item" regex matched `can` inside `candy-bar` and included the cheese wedge, so those snapped by the shortest quarter turn instead of to the slot angle. Replaced by an explicit four-way-symmetric list.
- **Mess piled up** on boxes with long items (toy cars, cutlery overlapped): scatter now packs rotated footprints instead of circles (first clear spot wins, else the widest gap).
- **Phone toast covered the box** at the start of every level in portrait ("Spice Drawer · 5 items" over the top row): the toast is landscape-only (the HUD and the voice already name the box).
- **Results card**: the share code was a cramped 4th stat tile that wrapped in portrait; it moved under the 3 stats with the next-star goal. "Next box" followed the array order (would have jumped from Bakery to the new Veggie box); it follows the room order now. Share text is EN/ES.
- Silhouette opacity was set by traversing every slot's meshes each frame; one material per slot now.
- **Wrong item picked up when pick boxes overlapped**: the enlarged invisible pick boxes of neighbours overlap, and the ray took the nearest box, so a press on one item could lift the one in front (also hidden in tests because item matrices were stale between frames). Now the item whose real shape is under the pointer wins, else the one whose middle is closest; matrices are refreshed before picking.
- **Late rotation events were missed**: the orientation was compared with a page-load snapshot and only on `resize`; some browsers deliver rotation late (and headless runs not at all), so the box kept the old layout. The frame loop now also compares the screen with the level's layout orientation.
- **Crash when the phone was turned during the finale**: a resize cleared the push-in camera target mid-animation (`Cannot read properties of null (reading 'pos')`). The push-in is recomputed instead (found by the new orientation test).
- Menu A-button handling duplicated (and fought) the engine's focus ring; the game's own `menuPad()` was removed so pads and phones navigate the room/box grid with the engine ring.

**Added**
- **20 boxes in 4 themed rooms** (was 9 in one list): 🍳 Kitchen (Lunchbox, Spice Drawer, *Veggie Crisper*, Cutlery Drawer, Fridge Shelf, Bakery Box), 🧺 Picnic & Treats (Fruit Crate, *Breakfast Tray*, Café Tray, *Sweet Shop Box*, *Sushi Bento*, Picnic Basket), 🎨 Study & Play (Desk Organizer, *Pencil Case*, *Toy Garage*, *Art Caddy*, *Bookshelf*), 🧳 Workshop & Travel (*Toolbox*, *Sewing Basket*, *Suitcase*). Item counts climb gently inside each room (4 → 10). Title shows room tabs (★ per room) and the boxes of the selected room with the 3-star goal and best time.
- **Original procedural items** (no new assets needed): crayons, pencils, eraser, ruler, glue stick, scissors, paint jars, brushes, paint tubes, palette, 8 books, hammer, screwdrivers, wrench, tape measure, spirit level, thread spools, pincushion, thimble, buttons, shirts, socks, toothbrush, sunglasses, cap, notebook, rice ball, chopsticks — built from primitives at load, registered as models so silhouettes, picking and snapping are unchanged.
- **Colour matching** in later boxes: colour-coded items (crayons, paint, spools, books, screwdrivers, buttons, shirts, socks) have outlines tinted in their colour plus a matching shape sticker on the item and in the slot (colour-blind aid); a same-shape wrong colour says "other colour". Announced on the start toast and read aloud.
- **Star goals per box** (par per box, higher for colour boxes), shown on the title and on the results card; still no fail state (1 star for finishing).
- **ASMR pass**: each item has a material (wood, plastic, metal, glass, fabric, paper, food) with its own lift sound and landing "thock"; the box style answers (hollow wood knock, basket rustle, padded fabric, metal tick); a soft pentatonic chime climbs while you keep placing things quickly. Light haptics on touch only (lift 6 ms, snap 12 ms, wrong 18-40-18, finish pattern), never for mouse/keyboard.
- **Tidy-up celebration**: every item hops in slot order on a rising scale before the before/after wipe (smaller with reduced motion); completing a whole room shows "Kitchen: all tidy!" on the results card, reads it aloud and pays +10 XP / +15 coins once.
- **Generous picking**: a touch within 46 px (mouse 30 px) of an item's middle picks it even off its box.
- Pack: 17 more CC0 Kenney models (veggies, breakfast, sweets, sushi, soy) + 7 toy vehicles loaded lazily (`E.ensureModels` when a Toy Garage starts; "Unpacking…" toast). Manifest 1.71 MB (all files in `packs/assets`, 7 new `.glb`). Save v2 migration keeps every box a v1 player had open and all stars (old saves only knew a linear unlock count); junk saves start fresh.
- Hub tile copy (EN/ES) and `thumbs/fit.jpg` refreshed.

**Tests** (`test/fit.js`, PORT 8851/8852): previous checks (mouse/touch precision incl. edges, flick, pointercancel, resize, wrong drop, keyboard, gamepad, Spanish, read-aloud, results once) plus: title rooms/unlocks on a fresh save, no pause over the title, haptics on touch only, generous pick, phone controller placing + pausing, tidy wave, room-complete bonus + voice, share code under 3 stat tiles, next room opens, every box auto-solves, six sound materials in use, box turning on orientation change with placed items kept, v1 save migration and a junk save.

**Still open**
- Real-phone drag feel and haptics are verified only with synthetic touch events; frame rate unmeasured on a 2021 phone (procedural items are a few dozen small meshes per box; geometry is built per item instance, not shared).
- Keyboard/pad slot choice cycles through free slots in screen order; on 10-item boxes that is a lot of presses (no 2-D cursor yet).
- Colour-blind aid is a shape sticker per colour (● ▲ ★ ■ ◆ ✚ ♥ ⬢) on the item and in its slot; not yet checked with colour-blind players.
- Spanish item names are agent-written; a native read-through is recommended.
- Engine: none changed.

## Fail Tray elevation pass (2026-10-16)
One game agent re-audited and extended Fail Tray (`games/tray.html`). Tested with `test/tray.js` at 1000×560 and 390×844 (both `NO_ERRORS`, `ALL CHECKS PASSED`, every screenshot reviewed) and the hub (`test/index.js`, `NO_ERRORS`). Engine unchanged.

**Bugs fixed**
- **Portrait title hid the Play button** below the fold: the sticky-row selector (`.ig-row:last-child`) stopped matching once the engine added the ⚙️ settings button after the row. Fixed, and the portrait title now lists the course map first. Test: `portrait title: Play button visible without scrolling`.
- **"TABLE 7" sign clipped into a tree** (known P3): scenery keeps 5.5–6 m clear of the finish arch, table and start mat, and big trees reserve room for their canopy. Checked in `tray_fall`, `tray_play` and the tile art.
- **Bonks were teleports**: hits that cut your speed (and walkway edges) produced near-infinite longitudinal acceleration, so one hit slid every plate off. Longitudinal load is now clamped to ±7 m/s², so a hit is a jolt and the pitch kick does the comedy.
- **Frame-rate checks**: a still tray settles (max tilt 2e-7 rad, no drift); course 2 driven by the bot at 30/60/144 fps reaches the table every time and delivers 5/4/4 items (within 1); no NaN across the 18-course tour.
- **Hot-seat**: the Party Cup drew from 8 hard-coded courses, locked ones included; it now draws from unlocked courses. Ties now break on points, then items delivered, then total time. The board explains each run's points (`+345 = 300 food + 45 time`).
- **Leaks**: switching courses never freed course geometry; every splat and shard made a new geometry and material. Course and run meshes are disposed (pack models skipped) and splats and shards share cached geometry.
- **Wrong-arm cache**: the customer's mirrored-arm solve shared one cache key across different character models. It is now keyed per model.
- **Kids**: the carried mug showed a 🍺 emoji; it is now ☕ (hot cocoa).
- **Language**: the game read the language once and most text was English only. All UI, signs, results, the board and commentary are EN/ES, and the title re-renders when the language changes in settings.

**Added**
- **18 courses in 5 venues (was 8)**, unlocked in order, on a **course map** (venue rows with star counts, a 🔒 on locked courses, a course card with items, star goals and best score). The venues:
  - **Garden Party**: the original 8 courses.
  - **Seaside Café** (beach boardwalk, parasols): Morning Rush, Soup of the Day, Kitchen Chaos.
  - **Wedding Garden** (carpet aisle, flower arches): Aisle Style, Glass Pyramid, Grand Reception.
  - **Cruise Deck** (a ship's hull over the sea, railings, deck chairs, lifebuoys, a distant liner): Captain's Table, Rough Seas.
  - **Ski Lodge** (snow ground, snowfall): Cocoa Run, Summit Supper.
- Each venue has its own sky, ground, path surface, trim, props, finish sign, table cloth and music.
- **New obstacles**:
  - **Swinging kitchen doors**: walk in while they are shut and you BONK, then they hold open for you.
  - **Revolving door**: walks you round its post. Push faster than the door turns and you bonk the glass.
  - **Slippery floor**: mopped in the café, icy at the lodge. Weak grip and slow braking, you drift, and the rail bounces you back.
  - **Stairs** up and down: each riser kicks the tower.
  - **Moving walkways**: a fast lane, plus a "wrong way" belt that runs backwards. Stepping on and off is a jolt.
  - **Pet crossings**: a puppy or a bunny dashes across; bump into it and you trip.
  - **Rolling ship deck**: the whole tower leans with the swell and the horizon rocks.
  - Every obstacle has an EN/ES sign.
- **New carry items with their own physics**:
  - **Soup bowl** and **iced drink**: slow, heavily damped wobble, and they slosh droplets over the rim when tipped.
  - **Three-tier wedding cake**: tall and heavy, with a big lever arm.
  - **Glass pyramid**: six glasses on a board that shatter spectacularly and rattle louder.
  - Croissant, waffle, muffin, cookies, sushi.
- **Stars**, explained on the course card and in the results: ★ arrive · ★ deliver 70%+ · ★ everything under par. Par accounts for the new obstacles and the difficulty.
- **Difficulty**: Chill (new players' default; gentler wobble, relaxed par), Normal, and Wild (tippier, tighter par, and a fall takes everything above it; this replaces the old Chaos toggle).
- **Optional phone tilt** to lean (touch devices; iOS permission asked on tap). "Level" is wherever you hold the phone during the countdown.
- **Comedy and juice**:
  - squash and stretch on every item
  - a cartoon "whoa!" stagger on hits and drops
  - a "Phew!" chime when you save a near-fall
  - EN/ES crash words
  - **slow-motion commentary**: a caption read aloud, picked by what knocked the tower over ("The door won that round.", "Not the soup! Anything but the soup!").
- **Perfect delivery celebration**:
  - the runner cheers and hops
  - the customer waves both arms and bounces
  - confetti volleys and a fanfare
  - a random perfect line read aloud
  - a side-on camera that frames the runner, table and customer (the finish banner hides for that shot).
- **Hub hero**: player 1 carries as the hub hero (model, plus their colour on the tray).
- Gamepad focus ring on the title and the party board (`E.menuNav`).
- **Save v2** with migration: v1 stars and best scores are kept, Chaos becomes Wild, names are sanitised, garbage saves fall back to defaults.
- **Performance**:
  - far scenery and houses are baked into one mesh per material, without outlines or shadow casting
  - string-light wires are one line set
  - the ski venue avoids the 9k-triangle tree
  - Garden course 1 went from 815 to ~360 draw calls (374k to 271k triangles); Ski 930 to ~290.
- Pack: +16 CC0 models already in `assets/models`: bowl-soup, glass, frappe, croissant, waffle, muffin, cookie, sushi-salmon, dogue, bunny, ship-light, palm-long, house-4/6/7, house1, plus skater-female and survivor-male for heroes. The manifest has 47 models (1.73 MB) and every file is present in `packs/assets`.
- New tile art (`thumbs/tray.jpg`, wedding steps). Hub tile copy updated in EN/ES.

**Tests** (`test/tray.js`; `TRAY_QUICK=1` skips the tour, `TRAY_THUMB=1` writes the tile shot)
- course map
- locked-course toast
- forced collapse, replay and commentary caption
- results star goals
- still-tower jitter
- frame-rate agreement (30/60/144 fps)
- v1 migration and garbage saves
- all 18 courses driven by the bot, with obstacle screenshots (`tray_c9_doors` … `tray_c18_summit`)
- hot-seat board breakdown and party final
- Chill perfect delivery (`tray_deliver`)
- Spanish title
- portrait: Play button visible, HUD on one row

**Still open**
- Real-phone feel and FPS, and the device-tilt control, are unverified: headless has no sensors and software rendering.
- Near scenery still costs ~200–360 draw calls with shadows.
- The carried mug model is 23k triangles.
- Pets hop but have no walk animation (non-rigged models).
- The revolving door's panels follow the runner, but a very fast player can visually clip a panel during a bonk.
- The bot is deterministic, so the hot-seat test ends in a tie (the tie-break is shown).
- No separate-screen online mode (phones as controllers work as before).


## Pact Trivia elevation pass (2026-10-16)
Pact Trivia (`games/trivia.html`) re-audited and extended by one game agent. The question bank moved to `games/trivia-questions.js` (ES module). Full fact-check log and per-question changes: `docs/audit-notes/trivia.md`. Tested with `test/trivia.js` at 1000×560 and 390×844 and `test/party.js test/party_trivia.js` (phones).

**Fact-check**: all 173 existing questions checked (EN = ES, exactly one answer, timeless, kid-safe). 0 removed, 3 fixed for ambiguity (Egypt had Asia as a wrong choice, hat trick was not unique to one sport; "Bollywood" means the Hindi industry), 3 ES distractor/wording fixes, 1 regional ES term, 3 difficulty re-tags.

**Bank**: 473 questions in 11 categories (new: History to 1950, Math, Words). 342 multiple choice (121 kids / 139 everyone / 82 hard), 99 true/false (balanced per round), 32 closest-number. No living people, brands, franchises or school-system-dependent facts; no fact repeated across formats.

**Bugs fixed**
- Bots could buzz before the question had been read (0.9 s after the buzzers opened): bots now wait for the read time (≈16 chars/s) before reacting.
- Kids mode raised bot accuracy (×1.05); now Kids mode sets Easy bots.
- Phone wager card showed `undefined` on its 5th button (`pad.html` choice labels); fixed in one line.
- Portrait: faded buzzer showed through the answer panel; camera shot cache ignored the panel type (taller panels could cover the board).
- XP fractional/unbounded; share link carried query strings.

**Added**
- Show picker: Full show (Buzz-in → Lightning true/false → Your pick (last place picks the category) → Closest number (open guesses, last place first, number dial with keys/slider/gamepad/phone) → All In), Classic (old 8 + final), **Daily 10** (date-seeded, same for everyone, speed bonus, streak, saved once, emoji share line).
- Bot skill Easy/Normal/Hard (measured accuracy in the test), per-category stats on the title + best category after results, no-repeat history with stable ids (0 repeats in the next show).
- Hub tile copy (EN/ES) updated.

**Still open**: no timestamp arbitration for phone vs local buzzes; native ES read-through of the new lines; Daily 10 is big-screen solo only.

## Draw the Pact elevation pass (2026-10-16)
Files: `games/draw.html`, new `games/draw-words.js`, `test/draw.js`, `thumbs/draw.jpg`, hub copy (`hub-src/hub.js`, `hub-src/extras.js`). Engine unchanged.
Tests: `PORT=8891 node test/run.js draw test/draw.js` (120 checks) and `W=390 H=844 PORT=8892 …` both end `DRAW_CHECKS_PASSED`, `NO_ERRORS`. `PORT=8893 SIG=9893 node test/party.js test/party_games.js` passes (the drawer's phone shows the word, the other phone guesses, scores update). The test now skips rendering between screenshots (`window.__NORENDER`), so it runs well under the 10-minute tool limit (it used to take 7.5 minutes with fewer checks).

**Words**
- **704 family-friendly EN/ES pairs** (was 366), moved to `games/draw-words.js`. Each word has a difficulty (218 easy, 264 medium, 222 hard) and one of 15 categories: animals 80, food 70, objects 72, actions 62, nature 61, places 56, ideas 56, home 48, jobs 38, vehicles 34, fantasy 34, sports 27, clothes 25, body 22, music 19. Easy words are concrete things a child can draw.
- No brands. Dropped: "wifi", "password", "fish (verb)", "spring (season)". "Popsicle" became "ice pop". Every English word and every Spanish word is unique, so two answer options never read the same; the test checks this.
- **No repeats**: words used this game are excluded. The last 400 words drawn on this device (`inoa.draw.recent`) are skipped too. When a pool runs out, the least recently used words come back first.
- **Category picker** on the title (🎲 all, or one of 15), on top of the difficulty choice.
- Phone guess options are the answer plus 2 words from the same category and 1 from another, so the drawing has to decide.

**Bugs fixed**
- **Stale HUD**: Speed Sketch showed the previous mode's chips (party scores, "📞 4/4"). Every mode now sets its own HUD. Test: `sketch: HUD shows the sketch counter`.
- **Undo noise**: undo matched the old canvas only within ~16 px of anti-aliasing noise. The paper is now a CPU canvas (`willReadFrequently`), and the "everything but the last op" snapshot is cached, so undo restores exactly: 0 px differ (`pixels off after undo: 0`). A fill also costs at most one replay.
- **Gamepad focus could land under the title's sticky Play row**: D-pad left from Play jumped to a hidden "1×" button. Buttons covered by another element are now skipped.
- **Palm rejection** (new):
  - a touch within 1.5 s of the pen is ignored
  - a contact patch larger than 50×50 px is ignored
  - a palm line that started just before the pen lands is dropped
  - a second finger never draws a stray line
  - Tests use synthetic `PointerEvent`s.
- **Time-based points were unfair with other round lengths**: the old 40 s / 20 s thresholds assumed 60 s rounds. Points now use the share of time left (more than ⅔ left = 3, more than ⅓ = 2, else 1).
- A tap with a shape tool no longer adds an empty op. `autoDraw` (demo/tests) no longer changes the player's colour and size.
- The hub tile doodle listed a real person's name as a guess; it now says "a hat!".

**Added**
- **Drawing tools**:
  - fill bucket: scanline flood, grown 1 px so no pale halo is left; undo/redo are exact
  - shapes: tap the shapes tool again to cycle line → rectangle → oval
  - 6 stickers drawn from simple original shapes (star, heart, smiley, flower, cloud, bolt): tap to stamp, drag to size, in the current colour
  - redo (↷, Y, Ctrl+Y / Ctrl+Shift+Z)
  - two-finger tap = undo
  - keys: D pencil, F fill, S shapes, T stickers; R3 on a gamepad cycles the tool
- **Teams mode** (4–8 players, alternating Team Sun / Team Wave):
  - the drawer's team guesses ("✓ Our team got it!")
  - when time runs out, the other team gets one guess to steal +1
  - team board and results show the best drawer
- **Hints** (on by default): the guessers see the category icon and letter blanks. One letter shows at half time, up to a third of the letters at ¾ time, with a soft chime.
- **Round options**: 45 / 60 / 90 s, 1–3 rounds.
- **Daily doodle**:
  - one prompt per calendar day, the same on every device (date hash over easy/medium nouns)
  - 120 s, relaxed
  - saved to a local daily gallery (last 30 days) with a 🔥 streak; drawing again the same day replaces that day's doodle
- **Guess the doodle** (solo or a couch shouting together; 35 original line-art doodles generated in code):
  - the pencil draws by itself
  - pick from 4 answers before it finishes: 3 / 2 / 1 points by speed, 1 after a wrong try
  - wrong answers are crossed out (forgiving)
  - 8 per round, with a best-streak count
  - answer with touch, keys 1–4, arrows + Enter, or D-pad + A
- **Gallery viewer** (title → 🖼️ Gallery):
  - Speed Sketch and Daily tabs, view and remove items
  - **share card**: a 1080×1350 PNG with a framed drawing, the word and the date, handed to the system share sheet, or downloaded where sharing is not available
  - nothing leaves the device unless the player shares it
  - daily doodles also hang on the 3D gallery wall
- **Celebration**: on a correct guess, DOM confetti (off with reduced motion), 3D confetti, a 🎉 name banner, an arpeggio, and the name and word read aloud. The timer ring pulses in the last 10 s.
- **Title**:
  - 6 modes, each with a one-line description; choosing a mode says its name aloud
  - Round and Words rows show only for the modes that use them
  - the title backdrop shows a finished picture made with the new tools
- **Easel art** is lit slightly (emissive map) so drawings read clearly in the 3D room.
- New tile art (`thumbs/draw.jpg`); hub copy updated in EN/ES.

**Screenshots reviewed** (portrait adds `_p`):
- landscape and portrait: `draw_title`, `draw_peek`, `draw_drawing` (hint blanks), `draw_reveal`, `draw_team_draw`, `draw_team_steal`, `draw_team_results`, `draw_sketch`, `draw_daily`, `draw_gallery_view`, `draw_gallery_item`, `draw_sharecard`, `draw_doodle`, `draw_doodle_right`, `draw_tools`, `draw_pointer_tools`, `draw_rotated_draw`, `draw_es_title`, `draw_es_doodle`, `draw_gp_draw`
- all 35 doodles on one contact sheet (the apple, cat mouth, tree trunk and flower leaf were redrawn after review)

**Still open**
- Real stylus hardware (iPad + Pencil, Android pen) and real palm contact sizes are unverified; the tests use synthetic events.
- Telephone descriptions still need typing, so a gamepad-only player can't fill them in.
- Teams and Guess the doodle don't use phones: Party is still the only phone mode, unchanged.
- The ES word list should get a native read-through for regional variants (carro/coche, papa/patata, maní/cacahuate).
- At 844×390 landscape the tools panel scrolls a little when a mode has two action buttons.
- The daily prompt sequence follows the word list order, so editing `draw-words.js` reshuffles future days.


## Tide Runner elevation pass (2026-10-16)
One game agent re-audited and extended Tide Runner (`games/runner.html`). Tested with `test/runner.js` at 1000×560 and 390×844 (both `NO_ERRORS`, `ALL CHECKS PASSED`, every screenshot reviewed), `test/party.js test/party_runner.js` (phone controller) and the hub (`test/index.js`). Engine unchanged.

**Bugs fixed**
- **Portrait hearts chip wrapped to a second HUD row** (known P3): compact chips under 520 px, and 5-heart styles show `♥ 5`. Test: `portrait HUD chips on one row`.
- **Landscape title hid the Play button** below a 560 px screen: the card is now two columns with a sticky Play row. Tested in both orientations.
- **Swipes only counted when the finger lifted** (engine `pointerup`, 34 px). Swipes now fire mid-gesture after about 14–28 px (3.5% of the short side). One long drag is still one lane, and a diagonal picks its main axis. The engine swipe is used only when ours did not fire. Tests: `swipe: 24 px drag changes lane before release`, `one long drag`, `up-right diagonal = jump`.
- **A hover after a lost `pointerup`** (finger or mouse released outside the window) could fire a phantom lane change. Fixed with pointer capture, `lostpointercapture`, and mouse moves now need a pressed button.
- **A jump pressed just before landing was dropped.** Actions are now buffered for 0.2 s, and a slide in mid-air drops you fast into the slide. Test: `buffer: jump pressed 0.03 s before landing`.
- **Collision fairness**:
  - Hitboxes are a little smaller than the art for each style: lateral margin 0.10 / 0.14 / 0.22 m, depth ±0.22 m (Classic ±0.32 m).
  - Jump clearance forgives 0.42 / 0.34 / 0.24 m.
  - Rows are at least 0.62 s apart even at top Classic speed (the old gap shrank to 11.5 m whatever the speed).
- `knock()` had an operator-precedence bug (`!o.lanes.length === 3`). Bumped vans no longer fly away; only hurdles do.
- XP was fractional. The power-up HUD was rebuilt with `innerHTML` every frame and is now rebuilt only when it changes. The ghost recording was unbounded and is now capped at 6000 frames (20 min).
- The keyboard and swipe hint text is chosen from the input you last used (touch, keys or pad), not from the screen width.

**Added**
- **Five zones that rotate every 432 m**: Sunset Boardwalk → Harbor Docks → Beach Market → Night Pier → Coral Reef Tunnel → lap 2… Each zone has its own:
  - set dressing:
    - **Docks**: quay, warehouses, container stacks, a crane carrying a container, moored boats, a dark ship.
    - **Market**: tiled plaza, fruit stalls with awnings, bunting high above the lanes.
    - **Night Pier**: stars, a ferris wheel, ticket booths, string lights.
    - **Reef Tunnel**: a glass tube with ribs, coral, kelp, brain corals, swimming fish, light shafts, a wreck.
  - obstacle set:
    - **Docks**: fish crates, rope coils, containers, trucks, a crane beam, a hawser rope, a girder.
    - **Market**: watermelons, fruit crates, coconut piles, pineapples, fruit stalls, bunting, a rolled rug, an awning.
    - **Night Pier**: prize boxes, ticket booths, light strings, a neon bar, a lantern arch.
    - **Reef Tunnel**: clams, coral, rock pillars, a sunken crate stack, jellyfish to slide under (they bob and pulse), a coral ridge.
  - sky, fog, light and water, which cross-fade over the last 45 m before each gate.
  - music and a spoken tip ("Slide under the jellyfish!").
  - The daily course stays deterministic.
- **Checkpoint gates** at every zone change (EN/ES banner): Friendly and Little ones styles refill your hearts there.
- **Three styles**:
  - 🐣 Little ones: 8 → 15 m/s, 5 hearts, more shields.
  - ♥ Friendly: the default. 10 → 21 m/s, 3 hearts.
  - ⚡ Classic: 12 → 26 m/s, one hit.
  - Speed now follows a smooth exponential curve instead of a linear ramp.
- **Missions**: 3 at a time from 11 kinds, for example jumps, slides, coins per run and in total, distance, reaching a zone, power-ups, close calls, lane changes, a clean stretch, and finished runs. Tiers rise as you complete them. Each pays +30–60 XP (added to the round's `results`) and 50–100 coins to the jar. In-run banner and voice line, a list in the pause menu, and completions shown on the results card.
- **Coin jar + shop**: every coin you collect is saved. Spend it on 8 trails (sea foam, sunset, mint, bubbles, rainbow, stardust, comet; particle trails plus a subtle ribbon) and 4 surfboards. A purchase needs a second tap to confirm.
- **New power-up 🌊 Wave ride**: you surf your shop board on a swell for 6 s, smash through anything for bonus coins, magnet coins, and get 1.2 s of grace afterwards. All power-ups have an aura (magnet ring, double-coin halo + sparkles, shield bubble, board + spray). The HUD chip blinks during the last 2 s.
- **Juice**:
  - "CLOSE!" near-miss calls (whoosh, FOV kick, +coins) for a late lane change, a low jump or a late slide.
  - The coin streak pitch rises over an octave, with streak pops at 10/25/50/100.
  - A zone banner and lap callouts.
  - The ghost cheers once it has finished.
- **Full EN/ES**: title, tabs, missions, shop, HUD, toasts, banners, results, share text and speech. The title re-renders when the language changes.
- **Reduced motion**: no camera sway or roll, a smaller FOV kick, and capped shake.
- **Save v2** with migration: v1 runner, mode, style, bests and ghosts are kept, and garbage saves fall back to defaults. Tests: `migration v1 → v2`, `garbage saves`.
- **Performance**:
  - Static models are merged into one mesh per material plus a single outline shell.
  - Palms, lanterns, stalls, booths and umbrellas are instanced.
  - Procedural obstacles are baked.
  - Chunks and obstacles hidden in the fog are not drawn.
  - Obstacle pools, zone dressings and shaders are warmed up on the title screen.
  - Boardwalk went from ~1520 to ~660 draw calls (main + shadow pass, `renderer.info`). The other zones measure 250–650.
- Pack: +16 CC0 models (delivery-truck, truck, fish, ship-wreck, ship-dark, watermelon, pineapple, coconut, banana, orange, lollypop, mussel, formation-large-rock/stone, ferris-wheel, ice-cream-cone). The manifest has 39 models (1.9 MB) and every file is present in `packs/assets`.
- New tile art (`thumbs/runner.jpg`, Night Pier). Hub tile copy updated in EN/ES.

**Tests** (`test/runner.js`; `RUNNER_QUICK=1` skips the 70 s autopilot stretch, `RUNNER_THUMB=1` writes the tile shot)
- title: Play visible, 3 missions, Spanish re-render
- migration
- swipe and buffer checks
- each zone warped to: own obstacle set + dressing, screenshot `runner_zone_<id>`
- jellyfish close-up
- lap-2 checkpoint refill + music change
- mission payout
- wave ride: smashes, keeps hearts, grace after
- autopilot 70 s in Friendly
- results + save
- ghost replay
- portrait HUD row
- daily seed determinism
- kids style
- shop confirm-then-buy

`test/party_runner.js`: the phone stick moves exactly one lane, and phone A jumps and B slides.

**Still open**
- Real-phone feel and FPS are unverified: headless uses software rendering, and the draw-call numbers are the proxy.
- The market zone is still the heaviest, at ~450 calls.
- The reef seabed and path read slightly green under the teal fog.
- Ghosts record position only (no obstacle smashes or power-up auras).
- No online race against friends: ghost and daily only. Phones work as controllers.

## Snack Squad Safari elevation pass (2026-10-16)
Files: `games/safari.html`, `test/safari.js`, `packs/safari.json` + `packs/safari/manifest.json` (+3 new shared models in `packs/assets/models/`), `thumbs/safari.jpg`, hub copy (`hub-src/hub.js`, `hub-src/extras.js` → `index.html`), `docs/audit-notes/safari.md`, `docs/MULTIPLAYER.md` (Safari row). Engine unchanged.
Tests: `PORT=8911 node test/run.js safari test/safari.js` and `W=390 H=844 PORT=8912 …` both end `SAFARI_CHECKS_PASSED`, `NO_ERRORS` (60+ checks). Hub test (`test/index.js`) `NO_ERRORS`.

**Health-content rule.** No medical guidance was invented or changed: the English rescue lines are byte-identical. New Spanish translations of the existing medical lines, the new "ask a grown-up" lessons, the allergen tags of new foods and dishes, and a list of observations are in `docs/audit-notes/safari.md` → "Elevation pass — allergist review list". **Allergist review is still required before families use the game.**

**Bugs fixed**
- **Friend-offer icons gave the answer away.** Good choices showed 💬 and bad ones 🍪. Choices are now labelled A/B/C. Test: `offer icons do not reveal the answer`.
- **The rescue card covered the scene.**
  - The camera now frames the kid and the grown-up beside the card: to its left in landscape, above it in portrait.
  - Lane buttons hide during the rescue.
  - Each step shows its details only while it is the current step.
  - In the symptoms phase the grown-up no longer walks into the camera.
  - The ambulance stops where you can see it.
- **Speech bubbles were tiny or cut off on phones.** Long lines shrank to a tiny font, and bubbles were clipped at 390 px. Bubbles now wrap onto 2–3 lines on a sized canvas.
- **The Hub chip covered the HUD pills in portrait.** It is hidden while playing; ⌂ Hub moved into the pause menu.
- **Tall cards cut off their heading.** With flex centering, the setup and How-it-works titles were unreachable under the hub chip. Cards now scroll from the top, and long cards keep a sticky button row.
- **The 911 call script always named "the Dawn Trail picnic area".** Each level now names its own place. The EN/ES wording is unchanged on level 1.
- **Spanish players saw English** in the rescue card, How it works, setup, pause, labels (ingredients and hidden names were English words read by a Spanish voice), food tags, products, offers, scanner hints, mistakes and "Things you learned". Everything is EN/ES now. The language can also change from the shared settings panel (`inoa:settings`). The new ES medical lines are pending review.
- **Performance:**
  - The night level had a point light on every lantern; that is now capped at 6 real lights, and the rest glow.
  - Wheel spin no longer walks the whole cart tree every frame.
  - Lane stones and props share one geometry each.
- **Store level:** aisle signs used to fly through the camera in portrait. They now hide before they reach it, and the ceiling lights sit above the lens.

**Added**
- **5 new levels (10 in total), with themed scenery** built from CC0 models (26 added to the pack) and simple shapes:
  - 6 School lunch day: library, houses, lunch tables, a field and fence. Has lunch-line menus.
  - 7 Birthday party garden: balloons that sway, presents, party tables with cake, a Ferris wheel.
  - 8 Grocery store aisles: indoors, with a tiled floor, shelves of instanced product boxes, ceiling lights and aisle signs. About 68% of items are packages.
  - 9 Picnic in the park: checkered blankets, baskets, a dog, a lake.
  - 10 Restaurant night out: dusk street, café tables with dishes, lanterns, the harbor. Has restaurant menus.
- **Menu moments**: three dishes, each with its ingredients listed, and at least one fits the player's list. A fourth choice, "Ask a grown-up / the lunch helper", is always right.
- **"Ask a grown-up / check the label" moments**: 9 new themed ones (trading lunches, class cupcakes, birthday cake, goodie bags, a free sample, a new package, unlabeled cookies, a shared snack bowl, a free dessert). Each level draws from its own theme, with no repeats in a level.
- **More food**:
  - 15 new plain foods
  - 19 new fictional packaged products, weighted by theme
  - every name has an EN/ES version
- **Player profiles**, so each child in a family has their own list:
  - up to 6 players, each with their own name, allergens, avatar, rider model, stars, stickers, collection and label count
  - add, switch and remove (remove takes two taps)
  - save v3; v1/v2 saves become player 1. Test: `v2 save migrates to player 1`.
- **Sticker book** (31 stickers, one book per player):
  - stickers for every level, first label, 25 labels, "may contain", hidden-name hunter, one per allergen's hidden names, ask first, menu reader, rescue practice, buddy hatched, mystery snack, team scanner, perfect run, champion
  - a toast when you earn one; the results card lists new ones
  - tap a sticker to hear what it means
  - open it from the title, the level picker or the results card
- **Accessibility**:
  - Big text and High contrast toggles (setup and pause)
  - Label highlights on/off ("detective mode" for older players)
  - tap a label to zoom its text
  - read-aloud on How it works, level choices, allergen chips, menus, sticker facts and setup
  - reduced motion respected for camera sway and shake
- **Practice-game note** on the title and in How it works (EN/ES): "Practice game — not medical advice. Follow your doctor's allergy action plan."
- **Phones as controllers**, through the engine's standard party widget: stick = lanes, A = read a label, B = hold the Scanner. Phone and gamepad A/stick also move through the cards.
- **Soft music** while rolling. It stops for the rescue so the speech is clear.
- New tile art (party garden) and hub copy in EN/ES (10 levels, profiles, sticker book).

**Screenshots reviewed** (landscape 1000×560 and portrait 390×844):
- `safari_title`, `title_es`, `how_es`, `setup`, `setup_profiles`, `levels`, `lv1`–`lv10`, `duo_scanner`
- `label`, `label_zoom`, `label_es`, `offer`, `menu`, `mystery`, `pause_a11y`
- `rescue1`–`rescue5` (EN), `rescue*_es`, `after_rescue`, `results`, `book`

**Still open**
- **Allergist + native-speaker review** of every line in the review list (new ES translations, new lessons, food and dish tags, observations such as mystery treats not being checked against the player's list).
- Real-phone feel and FPS are unverified (headless uses software GL).
- Phone controllers are wired through the engine path but were not run in `test/party*`.
- The grown-up and Rider 2 use the CC0 `skater-male` rig, whose shirt shows a small skull print. A texture clean-up like `tools/clean_textures.mjs` would suit this game.
- Food name tags can overlap when two items arrive close together in neighbouring lanes.
- The engine's results card still shows "Copied!" and a few labels in English (engine request 3 in the audit notes).
## Pixel Pact elevation pass (2026-10-16)
One game agent re-audited and extended Pixel Pact 2D (`games/pixelpact.html`). **Source of truth:** `games/pixelpact.html` was edited directly. `legacy/pixelpact-src/` had already drifted (it has no phone input, test hooks, platform gate or reward shim) and has no build step, so it is a frozen snapshot of the first build.

Tested with:
- `test/pixelpact.js` at 1000×560 (full tour) and 390×844 (`PP_QUICK=1`). Both `NO_ERRORS`, and every screenshot was reviewed.
- `test/party.js test/party_pact.js` (`PORT=8923 SIG=9923`, `NO_ERRORS`). The test now also readies the phone and starts the match from the phone.
- The hub test, `test/index.js` (`NO_ERRORS`).

Engine and `net.js` unchanged.

**Bugs fixed**
- **Rewards skipped the shared profile rules.** The inline `__inoaReward` wrote the guest key only, never updated `recent` (so Pixel Pact never showed in the hub Continue row), had no v2 fields and no de-dupe. It now matches `engine/inoa3d.js reward()`:
  - signed-in profile key
  - `recent`
  - v2 fields
  - 3 s de-dupe
  - clamps
  
  XP now scales with stars and level, with +20 for a new Sun Gem. The results card shows +XP · +coins · hero level. Test: `adventure results … recent:["pixelpact"]`.
- **Play-screen chrome overlaps.** The Phones pill covered the adventure timer, and the Hub pill covered the match timer and the portrait HP bar. Both pills are now hidden during play and come back on pause and menus.
- **Lobby:** one A press on a gamepad or phone readied *and* started the game instantly. Now:
  - The first Jump or Attack readies you.
  - Jump, Enter or Start starts once everyone is ready.
  - Attack or Back un-readies you.
  - Back leaves the lobby for P1, or leaves the slot for P2–P4.
  
  Gamepads can now go back from the lobby.
- **Results tip** said "Perfect run" when the shells star was missing. It now names the star you missed.
- **Portrait framing.** In adventure the hero sat behind the touch pad (78% down the screen); it is now ~60%. In landscape with the touch pad on, the camera lifts the action above the buttons. The title heroes overlapped the logo in portrait. The portrait match HUD squeezed 4 panels into one row and the text overlapped; it is now a 2×2 grid.
- **Reduced motion.** The zoom "punch" ignored the setting; it is now gated like shake and flashes.
- **Water holes.** Coins, shells and jellies placed in a pool left dry holes. They now keep the water around them.
- **Jelly Queen arena** clamped heroes inside the entry wall (found while adding the arena), and her hover was hidden behind the HUD. Both fixed, and the camera tracks her.

**Added**
- **World 1 grows from 3 to 10 islands.** New mechanics come in one at a time, each with its own EN/ES signs:
  - **1-4 Springtide Shoals**: spring clams and the first secret wall.
  - **1-5 Jellyglow Lagoon**: swimming in calm water that never hurts (jump to stroke, hop out at the surface) and the **Jelly Queen mid-boss**. She rains drops, zaps a telegraphed ring and dives; when she dives she lands stunned, and that is your opening.
  - **1-6 Lever Ruins**: levers open stone gates in the same area.
  - **1-7 Ferry Falls**: wide sliding ferries over the tide and a tall lift.
  - **1-8 Neon Night Pier**: new night theme with moon, stars and neon towers; lasers, drones, a lever and ferries.
  - **1-9 Ember Steps**: steam vents launch you up (no damage), plus lava pools and crumbling planks.
  - **1-10 Molten Crown Keep**: a gauntlet, then the **Magma Claw finale**. It is Big Claw rebuilt in lava, and its slams raise telegraphed lava pillars under the heroes.
  
  `test/pixelpact.js` runs a conservative reachability check on every level before the game tests: start → 3 Pact Shells → Sun Gem → levers → boss gate → exit, with no wall jumps or glides. It fails the run if a new island (1-4 to 1-10) breaks. The three original islands only report: the check is stricter than real play, and their long running double jumps are flagged but have been played through.
- **Sun Gems**: one per island, usually behind a hidden wall that fades as you walk in ("SECRET!", hinted by a faint glint). The three original islands got a gem in a high, out-of-the-way spot. Secrets and gems survive checkpoint restarts.
- **World map**: islands on a sea map (16:9, or a vertical zigzag on phones) with a dotted path. Each node shows its stars and gem, a lock until the island before it is cleared, and a boss badge. A detail line shows best time, rank, total stars and total gems. Tap the selected island again to play. Gamepad/keyboard navigation works.
- **Match**: 2 new arenas and 2 new modes.
  - **Neon Rooftops**: two roofs, a sliding ferry over the gap and recovery lifts.
  - **Crystal Grotto**: wall-jump pillars and falling crystals.
  - **Coin Rush**: 90 s. Coins spawn on platforms, and a KO spills 3 of yours.
  - **King of the Hill**: a zone that moves every 15 s, shown with a "moving soon" hint. Score while you stand in it alone. First to 30 points wins.
  - Bots chase coins and the hill.
  - There is a mode picker, and the HUD, results board and countdown are mode-aware.
- **Two new original heroes**:
  - **Pip Lumen** (support): her Lantern Lob bursts in a ring that hurts enemies and heals friends. Her Sunrise ult heals everyone, revives downed friends instantly and dazzles enemies. She revives twice as fast, and hearts heal her more.
  - **Bo Bramble** (grappler): his Vine Lash is a 110 px whip that pulls enemies in. His Thornquake ult hits every grounded enemy 3 times. He clings to walls (slow slide, higher wall jump).
  - Both are drawn procedurally like the original four (head, gear, body and poses). Lobby, bots and title support 6 heroes.
- **Drop-in co-op**: a new gamepad or phone presses Jump mid-level and joins next to the leader, with +1 shared life. Keyboards still join in the lobby, so a stray arrow key never spawns a P2.
- **Full EN/ES**: menus, map, every level, stage, sign, hero ability, boss, HUD and canvas text, results, pause and toasts. It follows the hub language, and there is a toggle in Settings that writes back to the shared profile.
- **Read-aloud** (Web Speech, EN/ES, follows the profile voice switch, toggle in Settings). It reads the level goal, each sign the first time you reach it, boss names, ultimates, drop-ins and results.
- **New sounds**: secret, gem, lever, door, vent and zap. New tile art (`thumbs/pixelpact.jpg`, four heroes vs the Jelly Queen). Hub tile copy updated in EN/ES, and the hub was rebuilt.
- **Saves**: `pixelpact3.settings` and `pixelpact3.progress` are unchanged in shape. Only additive fields (`mmode`, `lang`, `voice`, per-level `gem`), so old saves load as-is, and anyone who cleared 1-3 starts with 1-4 unlocked.

**Tests** (`test/pixelpact.js`, `PP_QUICK=1` skips the chunk tour)
- reachability of all 10 levels
- content counts: 10 levels, 5 stages, 6 heroes
- world map screenshot
- every level started and toured every 600 px
- lever opens its gate; swimming in 1-5
- touch layout
- gamepad drop-in + revive
- each boss woken and its states listed (all three reach `stunned`)
- every hero's special + ultimate
- results → profile (`recent`, reward)
- every stage with a different mode, and Coin Rush to the end
- Spanish title, map and level

**Still open**
- Real-phone feel and FPS are unverified (headless canvas is not representative). Nothing heavy was added; auto-resolution drop is unchanged.
- No online (separate-screen) mode; phones are local controllers only.
- Still not on the 3D engine (Phase 5 "Pixel Pact 3D" keeps this as Classic).
- A native speaker should read the Spanish.
- The original 1-1 to 1-3 rely on running double jumps of 6–7 tiles, the edge of what Rook can do. Play-test them with Rook on Normal.


## Phase 0 — reconciliation and decision validation (2026-10-17)
Triggered by the v4 master plan. Inventory, architecture, roadmap and decision records were written from the repository, not from the plan. See `docs/PRODUCT_INVENTORY.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/DECISIONS/` and `docs/TESTING.md`.

### Baseline
Commit 3f1737d, plus this pass's page tags and hub shelf. 1000×560, `npm run test:all` suites run one after another in the sandbox:

| Suite | Result | Time |
| --- | --- | --- |
| drift | NO_ERRORS (re-run after the tag change: NO_ERRORS) | 264 s |
| runner | NO_ERRORS | 149 s |
| tidelines | NO_ERRORS | 188 s |
| fit | NO_ERRORS | 313 s |
| junk | NO_ERRORS | 360 s |
| brew | NO_ERRORS | 237 s |
| builders | NO_ERRORS | 174 s |
| tray | NO_ERRORS | 152 s |
| trivia | NO_ERRORS | 368 s |
| draw | NO_ERRORS | 213 s |
| depths | NO_ERRORS (autopilot plays Act I + Act II to the final boss) | 43 s |
| safari | NO_ERRORS | 218 s |
| pixelpact | NO_ERRORS | 130 s |
| index (hub, incl. new shelf checks) | NO_ERRORS, also at 390×844 | — |
| pwa (`SW=1`) | NO_ERRORS | — |

Portrait (390×844) runs and `npm run test:party` (9/9) were last run on 2026-10-16 with the Pixel Pact merge. Nothing in this pass touches the engine, `net.js` or game logic.

### Plan vs repository: corrections
- **Already built**, though the plan lists them as future work: accounts + cloud profile (Supabase), server-capped rewards, admin, feedback, invites, PWA/offline, phones as controllers, Drift online races, Capacitor apps. Billing is built and switched off.
- **Counts:** 13 game products, 13 game pages and 14 hub tiles (Pixel Pact Adventure and Match share one page). No game has been merged or retired.
- **Monetization conflict:** the approved Premium subscription and the referral credit "toward the monthly subscription" conflict with v4's "cosmetics only, no paywalls". Recorded as `DECISIONS/0006` for the owner. Nothing is charged today.
- **Racing retirement:** Island Drift is the engine's reference game and the only online-race implementation. Recommend keeping it (`DECISIONS/0001`).
- **Card Room:** play-money Poker and Blackjack would likely raise app-store age ratings and conflict with kids/family programs. Recorded in `DECISIONS/0004` (verify against current store docs); Dominoes recommended first.

### New findings
| ID | Sev. | Finding | Evidence | Plan |
| --- | --- | --- | --- | --- |
| F1 | P2 | Game-specific saves (`inoa.brew`, `inoa.builders`, `snacksquad`, `pixelpact3.progress`, …) are **device-wide and local only**: they don't follow a signed-in player to another device, and two players on one device share them. The shared profile (XP/coins/best) *is* account-scoped and synced | `docs/PRODUCT_INVENTORY.md` §4; `grep localStorage games/*.html` | Roadmap R3: `E.save()/E.load()` scoped to the active profile + `ig_save_*` RPC |
| F2 | P2 → **fixed** | No page had a meta description or Open Graph tags, so shared invite and game links showed as bare URLs | `grep -c og:title` → 0 on all 14 pages | `tools/meta_tags.mjs` writes them from the hub tile copy; hub share image `thumbs/og-hub.jpg` |
| F3 | P2 → **fixed** | The hub was a flat shelf of 14 tiles with no way to filter | — | Category chips + search (`DECISIONS/0007`), checked in `test/index.js` at both sizes |
| F4 | P3 | Pixel Pact 2D carries its own copy of the reward/profile rules (`results(` count 0; it writes the profile directly). It matches the engine today but can drift | `games/pixelpact.html` | Keep in sync until the Phase 5 3D rebuild. A shared `engine/profile.js` without three.js would remove the copy |
| F5 | P3 | `hub-src/hub.js` still holds stale per-tile labels (`PHASE 2`) and claude.ai preview links, though `tools/build_hub.py` rewrites them at build time | `hub-src/hub.js` lines 4–17 | Clean up the next time the hub source is edited |
| F6 | P1 (risk) | **No real-device measurement exists** for any game or for phone-as-controller rooms over the live Realtime service | `docs/TESTING.md` "What headless tests cannot tell you" | Roadmap R1, needs the owner's and testers' phones |
| F7 | P3 | No CI: tests are run by hand before each merge | — | Optional: a GitHub Action running `test:all` on push (~70 min of software WebGL; consider a nightly schedule) |

No P0 found: no secret in the repo or the client bundle, user data isolated by RLS (DB tests), and no unsafe child-facing behaviour.

## Pixel Pact Match — "effects make it laggy" (owner report, 2026-10-17)
**Measured** with the new `test/pixelpact_perf.js`: a 4-fighter bot match, 60 simulated seconds on each of the 5 arenas, with wall-clock time emulated at 60 Hz. The lag was not a frame-rate problem: particles peaked at about 200 and drawing took about 3 ms in headless. Effects were **stopping the game clock**:

| Per minute of Match | Before | After |
| --- | --- | --- |
| Wall time frozen by hit-stop | **15.6%** (≈130 freezes, up to 12 frames each) | **4.2%** |
| Wall time in slow-motion (0.3×) | **13.5%** (≈38 slow-downs: every KO, every big launch) | **1.9%** (≈5) |
| Frames with a screen flash | ≈770 | ≈140 |
| Frames with a zoom punch | ≈1,450 | ≈390 |

**Fixes** (`games/pixelpact.html`):
- **Who it affects:** freezes, shake and punch now apply in full only when a human is the attacker or the victim. Bot-vs-bot hits get at most 1 frame of freeze and a third of the shake.
- **Freeze cooldown:** `hitStop()` gives 16 frames of cooldown after each freeze, during which a follow-up freezes for 1 frame at most.
- **Slow-motion in Match:** only on knockouts involving a human, with a 4 s cooldown, and always at match end. Big launches no longer slow the game. Ultimates freeze for 8 frames (3 for bots), down from 12.
- **Cheaper particles:** in-place particle compaction (the old per-particle `splice` was O(n²)), a cached `rgba()` prefix, and a lower particle cap (520; 260 on battery or after the auto-quality drop).
- Adventure keeps its feel: the same rationing applies, so co-op bursts no longer chain freezes, and boss and level-end slow-motion is unchanged.

**Guard:** `test/pixelpact_perf.js` fails if any arena goes above 8% frozen or 5% slowed (`PP_FEEL_BUDGET_OK`).
**Tests:** `test/pixelpact.js` passes at 1000×560 (full) and 390×844 (`PP_QUICK=1`); `test/party.js test/party_pact.js` passes; all `NO_ERRORS`.
**Still open:** confirm on a real phone. Reduced motion (Settings) still switches off shake and slow-motion entirely.

## Roadmap R3–R5 + owner requests (2026-10-17)
- **R3 cloud game saves (F1 fixed).** `engine/savekeys.js` scopes every game save to the signed-in player, and `ig_saves` syncs game progress across devices. Conflicts are resolved by revision, and a newer copy found while that game is open is offered with "Load it / Keep this one" instead of being written underneath it. Signing out on a shared device removes the player's synced saves from it. **Safari child profiles (names + allergens) and typed player names are never uploaded.** The migration is applied to the shared Supabase project; the security advisor shows only the expected RPC-only pattern. Tests: `test/db/tests.sql` (revisions, conflicts, limits, isolation) and `test/cloudsave.js` (guest claim → upload → new device → shared device → live offer → Pixel Pact): `CLOUD_E2E_PASSED`.
- **R4 Spanish leak check.** `test/i18n.js` opens every game's title screen and settings in Spanish and scans for English. It found 17 leaks: 7 English loading lines, the "Hub" and "Phones" chips (Pixel Pact, Safari, `net.js` party widget), and Depths' boss-intro placeholder. All are fixed: `I18N_CLEAN` (13/13).
- **R5 accessibility scan.** `test/a11y.js` runs axe-core (WCAG 2.1 A/AA, serious + critical) on the hub, account and legal pages, the pad and 13 title screens. It found:
  - a pinch-zoom lock on the pad;
  - low-contrast text in Depths (locked classes), Tide Lines (team names), Fit (room stars) and Tray (venue stars, locked course nodes).
  All are fixed: `A11Y_CLEAN` (19 pages).
- **Tide Lines bots camping the rival base** (an intermittent test failure: camp 8 of a limit of 6). Bots now have a keep-out ring that stops fights or refills pulling them into the enemy spawn. Camping measured 0 in 3 runs.
- **Phone controller orientation** (owner request): the gamepad goes sideways, with a true landscape lock on Android and a turned UI on iPhone or with rotation lock on. Buzzer, choices and text stay upright, and ↻ flips. See `docs/MULTIPLAYER.md`; tested in `test/party_pad.js`.

## Bubble Pop Counting — new kids' game + Kids World shell v1 (2026-10-17)
**Built:** `games/bubbles.html` (game #15, ages 3–6) and the shared shell `engine/kids.js` + `engine/kids.css` (decision 0005; `engine/inoa3d.js` unchanged).
- **Loop:** bubbles rise from a pastel pond; a voice asks "Pop three bubbles!", "Find the number five!", "Pop the bubble with four stars!", "How many apples? Pop the number!" or "Four ducks, and one more. How many now?". Correct pops are counted aloud ("One!", "Two!", "Three! You popped three!"). A wrong pick wobbles and floats away with a soft boop and an encouraging line plus a hint ("Oops, that's okay! Look for the number three."). No lives, no timer, no game over.
- **Stages:** Count to 3, Count to 5 (+ star groups), Number + group (both directions, 1–6), One more (sums up to 10), 5 prompts each, then a stars + sticker reward (12 stickers) and `E.results()`. **Pop party** is free play: every pop counted aloud 1–10, "All done" ends it with results.
- **Gentle adaptation:** two misses on one prompt make the game easier (fewer, slower bubbles) and the matching bubbles glow; first-try answers slowly bring back the normal pace. The right answer is always on screen (the spawner guarantees it and drifts a wrong bubble off to make room). Grown-ups can also turn on **Calm bubbles** and **High contrast**.
- **Scene:** procedural only (no models): pond, lily pads, cartoon trees, hills, Bloop the whale (hops on success, tilts on a miss), RoomEnvironment reflections, bloom .12. 12 pooled bubble meshes whose canvas faces are redrawn only on spawn, 5 pooled pop rings, particles capped at 320, no per-frame allocations in the update loop. Reduced motion cuts wobble, rings and bursts.
- **Controls:** tap (hit radius 115% of the bubble), keyboard arrows + Space or gamepad stick + A move a soft cursor that "holds" the nearest bubble and rides along with it; phones as controllers use the same input path. Bubbles are 88–150 px on screen (88 px at 390×844, 123 px at 1000×560); every kid-facing button is ≥ 64 px.
- **Parent gate:** ⌂, the title Hub link, settings, phones, the results/pause Hub buttons, feedback and install all open the gate (press and hold 1.5 s, then a two-digit sum with three answers). A Grown-ups panel behind the gate holds the options, settings, phones and the hub link.
- **Save:** `inoa.bubbles` = `{v, stars, stickers, sets, pops, hc, calm}`: no names, no personal data; scoped + synced in `engine/savekeys.js`. Catalog row: `supabase/migrations/20261017000010_bubbles_catalog.sql`.
- **Hub:** tile (category Kids, search tags, ES copy, daily-challenge line, canvas illustration, `thumbs/bubbles.jpg`); hub copy now says **15 games** in EN and ES (Dominoes, #14, is being built in parallel). `tools/meta_tags.mjs` takes `GAME_COUNT=15` for the share text until both games are merged.

**Tests:** `test/bubbles.js` (title targets; gate blocks a quick tap and opens after hold + sum; Hub link, settings, ⌂, pause Hub and results Hub gated; stage 1 by real taps incl. a miss; stages 2–4 by hooks; adaptive ease + hint; results pay XP once; save content; keyboard cursor + Space; gamepad stick + A; Esc pause; Pop party; Spanish title + spoken Spanish numbers) → `BUBBLES_OK`, `NO_ERRORS` at 1000×560 and 390×844. `I18N_GAMES=bubbles test/i18n.js` → `I18N_CLEAN`; `A11Y_PAGES=games/bubbles.html test/a11y.js` → `A11Y_CLEAN`; `test/engine.js` and `test/index.js` → `NO_ERRORS`. Screenshots reviewed in both orientations (title, gate, grown-ups, every stage, high contrast, miss, reward, results, keyboard cursor, party, Spanish).

**Open:**
- **Play test with real 3–6-year-olds** (the R9 acceptance: a 4-year-old finishes a set without help). Watch: bubble speed, whether the hold-to-open gate is ever passed by a child, whether the miss line is too chatty.
- Native Spanish voice check of the spoken lines (number gender: "una burbuja", "cuántas manzanas").
- Real-phone feel/FPS (the physical bubble material uses iridescence + clearcoat; drop to a standard material if a 2021 mid-range phone struggles).
- Speech needs a first tap on some browsers, so the very first title line is not read aloud before any interaction; everything after the first tap is.
- Shell v1 does not include the per-child profile picker or recorded-voice overrides (see 0005).
## Dominoes — first Card Room game (2026-10-17, roadmap R8 local part)
**Built.** `games/dominoes.html` (game 14) on the shared engine, plus `engine/cardroom.js` (the reusable table-game core from decision 0004) and `games/dominoes-rules.js` (pure rules).
- **Card Room core** (`engine/cardroom.js`, no DOM/three.js, Node-testable): seats + turn order, match lifecycle (lobby → deal → turns → round end → match end), `createMatch(game).act(seat, move, from)` is the single host-authoritative entry (rejects out-of-turn and non-legal moves, emits `reject`), `botAct` hands the bot only `view(seat)`, `makeSeats` (locals → phones → bots), `phoneHands(E.NET, …)` (per-phone private layouts, re-sent on reconnect), seeded RNG. Six-Card Golf / Liar's Dice / Bingo can reuse it with their own rules object.
- **Rules** (documented at the top of `games/dominoes-rules.js`): double-six; **Block** (7 each, pass when stuck) and **Draw** (7 each with 2 players, 5 each with 3–4; draw until you can play, pass when the boneyard is empty); teams of 2 for 4 players (partners across, seats 0+2 vs 1+3); first round opens with the highest double (heaviest tile if nobody has one), later rounds the previous winner leads with any tile. Domino = the side scores the pips in the losers' hands (option `countAll` adds the partner's, a Dominican house rule; not exposed in the UI). Blocked ("tranque") = fewest pips wins (teams compare combined pips) and scores the losers' pips; **a tie for fewest scores nothing** and the lead passes to the next seat. Optional **capicúa +25** (off by default): the domino tile could go on either end and the ends showed different numbers; a double never counts. Targets 50/100/150/200.
- **Bots** Chill (mostly random legal tile), Normal (heaviest tile, doubles first), Sharp (keeps numbers it holds on the ends, plays numbers the next opponent passed on, avoids numbers its partner passed on, counts unseen tiles). They only receive `view(seat)`: own hand, the line, tile counts, boneyard count, the public pass log.
- **Players**: 1 vs bots; pass-and-play for 2–4 people with a "Hand the device to …" privacy screen (tray shows "Tiles hidden" between people; bot turns hide it too); phones as private hands via a new generic `hand` layout in `pad.html` (own tiles only, ◀/▶ when a tile fits both ends, Draw/Pass, warnings + vibration on a rejected move; a phone away > 12 s on its turn gets a bot stand-in). 📺 "phones only" mode when phones are connected.
- **Presentation**: procedural 3D (rounded ivory tiles with canvas pip faces, optional colour pips per number, wood table + felt, patio floor, string lights; RoomEnvironment reflections, bloom .12, no pack/models). The line snakes at the table edge, doubles crosswise, tiles fly in from the player's seat. Camera frames the line between the HUD and the hand on landscape and portrait (view offset). Playable ends glow (always after picking a tile; with hints in Chill or the 💡 Hints option); tapping a tile that fits both ends asks which end (or tap the glowing end). Keys: ◀ ▶ select, Space/A play, B draw/pass; gamepad the same. Speech for turns, draw/pass prompts, domino/tranque, round scores. EN/ES everywhere (title "Dominó").
- **Save** `inoa.dominoes` (< 1 KB: settings, wins, played, best round, dominoes) — scoped + synced in `engine/savekeys.js`. Results → `E.results` at match end (XP 30 + 6/round + 50 for a win + points/3, coins 25/10, best = matches won). Supabase: `20261017000009_dominoes.sql` adds the game to `ig_game_catalog` (otherwise signed-in players get `unknown_game`); `test/db/tests.sql` expects 14 (DB suite not run in this pass: no local Postgres cluster).
- **Hub**: tile (PARTY · CARD ROOM, canvas illustration, `thumbs/dominoes.jpg`), ES copy, Party category, search tags, daily line, "Fourteen games"/"Catorce juegos", link-preview tags.

**Tests (all green)**
- `node test/dominoes_rules.js` → 581 assertions, RULES_OK: deal sizes, forced opener, legal moves (both ends, equal ends, draw vs pass), rejection of out-of-turn / not-held / pass-while-able / draw-in-block / wrong-end tiles, domino scoring (solo, teams, countAll, capicúa on/off, doubles), blocked games (winner, tie = 0, teams), team match to target, **500 simulated bot rounds across 2–4 players × Draw/Block × teams: 0 illegal moves, 0 hidden-hand peeks**, tile conservation; Sharp beats Chill ~56% heads-up.
- `node test/run.js dominoes test/dominoes.js` (1000×560 and 390×844) → NO_ERRORS: real taps on tiles, an illegal tap rejected with the table unchanged, the both-ends picker, keyboard play, full team match to results (profile XP + plays + save), Spanish Draw game to results, pass-and-play privacy (3 hand-offs, tray never shows tiles behind the card, out-of-turn move rejected).
- `test/party_dominoes.js` → NO_ERRORS: two phones each show exactly their own hand, a move out of turn and an illegal tile are rejected (phone shows the reason), a legal tile is accepted.
- `test/index.js` (15 tiles, each in one category), `I18N_GAMES=dominoes test/i18n.js` → I18N_CLEAN, `A11Y_PAGES=games/dominoes.html,pad.html test/a11y.js` → A11Y_CLEAN.

**Open items**
- Real-phone feel/FPS; native ES read-through.
- Online play on separate screens (needs R7's room helper). Reconnect is "bot stands in while the phone is away"; no seat hand-back UI.
- Optional rules not in the UI: `countAll` (partner's pips), "keep 2 in the boneyard" variants, re-deal when no double is dealt.
- Opponents are name plates + standing tiles, not characters; seat 0 is always at the bottom in pass-and-play (the view does not rotate to the current player).
- Sharp bots are good but not expert (no end-locking or tranque-forcing strategy).

## Depths: freeze rationing (2026-10-17, same issue as the Pixel Pact Match report)
Measured over 90 s of an autopilot run (3,800 fight frames): **8.9% of fight time frozen** by hit-stop, because 3 AI allies chained freezes. Now: after a real freeze (≥ 0.03 s), follow-ups for 0.25 s are capped at ~1 frame; AI allies' hits freeze 0 (heavy/crit: 1 frame); the player's own hits keep their punch. Result: **5.8%**. `test/depths.js` still plays both acts to the final boss, `NO_ERRORS`.
## Memory Match — quick-play pairs + EN/ES vocabulary (2026-10-17, roadmap R12)
**Built:** `games/memory.html` (game #17; #16 lands from a parallel branch, so the hub copy says 17). Engine scene + DOM cards; Little ones runs on the Kids World shell (`engine/kids.js`).
- **Core:** flip two cards, pairs stay face up (gold rim + sparkles + a rising chime; matches in a row build a combo with a float "Combo ×N"). A miss turns back after 0.95 s (1.6 s for Little ones); in grown-up modes a third tap turns the two back at once. Soft paper-flip sounds, chill music. Reduced motion: no 3D flip (quick fade), no pop/nudge, fewer sparkles.
- **Little ones (3–6):** a picture menu (6 big theme buttons, 4/6/8 cards), cards ≥ 96 px (144–210 px measured), picture-only, each flipped picture is named aloud in the current language ("Dog!" / "¡Perro!"), praise on a match, an occasional "Let's look again" on a miss, no timer, no moves, no score, then a stars + sticker reward (16 stickers) and `E.results()`. Parent gate (hold 1.5 s + sum) on ⌂, pause/results Hub, settings, phones and the Grown-ups panel (high contrast, All modes, settings, phones, hub link). The page reopens on the kids menu until a grown-up leaves it. `kids.js` gained `guardLinks({enabled})` + `setGuard(on)` (additive) so the other modes are not gated.
- **Words:** themes animals, food, home, school, nature, colors (12–14 items each; colours are procedural paint swatches, the rest system emoji, no copyrighted art). Pairs are picture ↔ word (words in English or Spanish, chosen on the title) or English word ↔ Spanish word (EN/ES tags; Spanish cards show the article: "la vaca"). Every flipped word is spoken in its own language (EN voice / ES voice); a match shows "cow = la vaca" in the caption and reads both. 12 or 16 cards. Results list the pairs learned.
- **Classic:** Easy 12 / Medium 20 / Hard 30 cards from the whole picture pool (70), moves + a timer that starts on the first flip, stars by efficiency, best (fewest moves, then time) per grid on the title and results.
- **Daily board:** 20 cards seeded from the local date (FNV-1a → mulberry32), identical for everyone and across reloads. The first attempt counts and is saved as you play, so a reload resumes it; replays that day are practice. Streak (consecutive days) + best streak, share line, history of the last 21 days. Profile best for the hub tile = best daily streak.
- **Two players:** hot-seat, P1 coral / P2 blue chips, matched cards wear the finder's colour and number, a match keeps the turn, a miss shows and speaks "Player 2's turn". With two phones connected, phone 1 only acts on P1's turn and phone 2 on P2's.
- **Input:** tap/click; keyboard arrows (or WASD) move a selection ring, Space/Enter flip (native button clicks are suppressed so one key = one flip); gamepad stick/D-pad (with repeat) + A; phones via the engine (stick + A); menus use the engine's gamepad focus ring. Cards are real `<button>`s with roving tabindex and labels ("Card 3: dog · matched").
- **Layout:** the grid size is chosen per screen to maximise card size (search over column counts, last row centred), measured under the HUD (re-laid out if the HUD wraps) and above the Words caption; capped at 170 px (210 px Little ones). Measured smallest cards: 1000×560 → 102 px (30 cards, 8×4); 390×844 → 73 px (30 cards, 4×8). No page scroll at any grid size in either orientation.
- **Scene:** light 3D table (pbr wood, a felt mat that the board sits on, re-sized to the board each layout, tinted per mode), procedural teacup, plant, pencil, card box and stray cards at the screen edges, RoomEnvironment reflections, bloom .08, **render on demand** (the scene only re-renders on layout/mode changes), so play costs DOM card transforms only.
- **Save:** `inoa.memory` = `{v, mode, hc, kidsHome, best{e,m,h}, words{theme,dir,lang,n}, classic{g}, duo{n}, kids{n,stickers,boards}, daily{last,streak,bestStreak,hist,cur}, boards}`: no names; scoped + synced (`engine/savekeys.js`). Catalog row `supabase/migrations/20261017000013_memory_catalog.sql`; `test/db/tests.sql` expects 16 active games (DB suite run on a local Postgres 16: DB_TESTS_PASSED).
- **Hub:** tile (LEARN · PAIRS + WORDS, Learn & Teach, search tags EN/ES, ES copy, daily line "Clear today’s Memory Match daily board", stat "Best daily streak", flipping-cards canvas illustration, `thumbs/memory.jpg`), "Seventeen games" / "Diecisiete juegos" / "17 games in the browser", meta tags via `GAME_COUNT=17`.

**Tests:** `test/memory.js` → `MEMORY_OK` + `NO_ERRORS` at 1000×560 and 390×844: title; Little ones (menu, ⌂ gated, quick tap blocked, hold + sum opens Grown-ups, 4/6/8 cards ≥ 96 px, pictures named aloud, real-tap board incl. a miss, reward → results with 64 px buttons, XP once, results Hub gated, reopen on the kids menu, gate off in other modes); Words picture ↔ Spanish word (ES voice) and EN ↔ ES (each card in its own voice), caption, results; Classic Easy by real taps (miss = 1 move, clock, third-tap rule, combo) + Medium/Hard via hooks, bests saved; Daily determinism across two page loads, a different date differs, resume, counted result + streak 1, practice does not overwrite, next day streak 2; Two players (match keeps the turn, miss passes it, spoken turn, winner); keyboard (ring, Space, Enter) and gamepad (stick, A, D-pad); Esc pause stops the clock; save has no names; Spanish title, Spanish picture names, Spanish results. Every grid (4, 6, 8, 12, 16, 20, 30 cards) checked inside the viewport, below the HUD, no scroll, ≥ 64 px. `test/index.js` NO_ERRORS (17 tiles), `I18N_GAMES=memory` → I18N_CLEAN, `A11Y_PAGES=games/memory.html` → A11Y_CLEAN. `test/bubbles.js`: every check passes except "gamepad: stick steers, A pops", which fails the same way with the unchanged HEAD `kids.js` (a timing flake in this sandbox, not caused by the `setGuard` change). Screenshots reviewed for every grid in both orientations.

**Open:**
- Real-phone feel/FPS (30 CSS-3D cards; headless Chromium's software compositor is slow to advance the flip transitions, real GPUs are not).
- Native Spanish read-through of the word lists (regional choices: plátano/banana, computadora, hongo, bombilla, anaranjado, rosado).
- Emoji pictures depend on the device's emoji font (all are Emoji 13 or older); procedural pictures for the oldest phones would remove that dependency.
- Play test of Little ones with 3–6-year-olds (miss delay, whether the voice is too chatty).
## Six-Card Golf — second Card Room game (2026-10-18, roadmap R12)
**Built.** `games/golf.html` (game 16) on the shared engine and `engine/cardroom.js`, rules in `games/golf-rules.js`, original card faces in `engine/cards.js`.
- **Rules** (documented at the top of `games/golf-rules.js`, checked against standard Six-Card Golf): 52 cards (option: 2 jokers, −2 each), 2–4 players; 6 cards face down in a 2×3 grid, each player turns 2 up (in turn order); a turn = draw from the stock or take the top discard, then swap it for any of your 6 cards (the old card goes face up on the discard) or — stock card only — discard it and turn a face-down card up; stock reshuffles from the discard when empty; when someone has all 6 up, everyone else gets exactly one more turn, then all cards are revealed. A=1, 2=−2, 3–10 face, J/Q=10, K=0; a column pair of equal rank scores 0 (pairs of 2s/jokers too, the classic rule). Lowest hole wins; 3/6/9 holes, lowest total wins; first player rotates. Friendly guard (not classic): a hole ends after 30 turns each (never triggered in 500 simulated holes).
- **Card Room core (additive):** a round result may carry per-seat `scores` (each column adds its own), and a game may define `matchOver(scores, rounds, opts)`; Dominoes is untouched (581 assertions still pass).
- **Bots** Chill (random/noisy, hints on for you), Normal (expected-score swaps, careful about going out while behind), Sharp (counts unseen cards, column-pair odds, avoids gifting the next player a pair). They decide from `view(seat)` only: face-up cards, the discard pile, the stock count, their own held card — never face-down cards (their own included) or the stock order. Sim: Sharp averages 8.0, Normal 8.7, Chill 16.9 per hole.
- **Play:** procedural 3D table (wood + felt, string lights, flag cup); cards are thin rounded bodies with canvas faces that flip; opponents' grids line up on the far side with seat chips (visible score), piles in the middle; your six cards + stock/discard/held card in a tray (bottom on portrait, right panel on landscape) with big touch targets; keyboard/gamepad focus ring (arrows/stick, A/Space press, B back); hints show the score change on each card ("−7") and a line like "swap it for your 9: your score goes down 7"; optional point badges on cards; colour-blind friendly four-colour suits with shapes.
- **Modes:** vs bots, pass-and-play (hand-off card; face-down cards are never rendered with values anywhere), phones as private hands via a new generic pad `cards` layout (grid + piles + held card + actions; the stock draw shows only on the drawer's phone); host rejects out-of-turn and illegal moves with a reason on the phone; a phone away 12 s on its turn gets a bot stand-in.
- **Save** `inoa.golf` (< 1 KB: settings, wins, played, best hole, pairs) — scoped + synced in `engine/savekeys.js`. `E.results` at match end (XP 30 + 5/hole + 50 for a win + pairs/hole wins, coins 25/10, best = matches won). Catalog row `supabase/migrations/20261017000012_golf_catalog.sql` (active-count assertion → 16).
- **Hub:** tile (PARTY · CARD ROOM, canvas illustration, `thumbs/golf.jpg`), ES copy, Party category, search tags, stat + daily line, count "Seventeen"/"Diecisiete" (a 17th game is in progress in parallel), link-preview tags.
**Verified**
- `node test/golf_rules.js` → 1145 assertions, RULES_OK: values, column pairs (incl. 2s, jokers, J≠Q), deal/setup, draw/swap/discard+flip, reshuffle, host rejection through cardroom, the one-more-turn ending (incl. a second player going out), turn guard, 3- and 9-hole matches (totals, lowest wins, ties), view hiding, 500 random bot holes with 0 illegal moves and 0 hidden-information peeks, Sharp beats Chill.
- `node test/run.js golf test/golf.js` (1000×560 and 390×844) → NO_ERRORS: real taps for setup flips, a repeat flip and a swap-before-draw rejected with the table unchanged, draw + swap, draw + discard + flip, keyboard play, 3D face-down cards lie back up, full 3-hole match to results (profile XP/plays, save), Spanish 2-player match to results, pass-and-play hand-offs (no cards behind the hand-off card, out-of-turn move rejected).
- `test/party_golf.js` → NO_ERRORS: two phones each show exactly what their player may see, out-of-turn / repeat flip / swap-before-draw rejected, stock draw visible on the drawer's phone only, discard + flip and discard-swap accepted.
- `test/index.js`, `I18N_GAMES=golf test/i18n.js` → I18N_CLEAN, `A11Y_PAGES=games/golf.html,pad.html test/a11y.js` → A11Y_CLEAN; Dominoes rules + party test unchanged.
**Open:** real-phone feel/FPS, native ES read-through, online on separate screens (R7), optional "doubling for going out while not lowest" house rule not offered.

## Online play on separate screens — roadmap R7 (2026-10-19)
- **`engine/room.js`** (new, `E.ROOM`): the host-authoritative pattern from Island Drift's online race, made generic. Host: guests' inputs/moves in, snapshots or per-guest views out, own-screen offer to phones, back-to-menu message. Guest: join by `?join=CODE`, waiting screen (joining / you're in / reconnecting / host went back / party ended, EN/ES), routing of the host's messages. Every new device still needs **Allow** on the big screen; no chat.
- **Island Drift** moved onto it with no behaviour change: same message names (`dr-start`, `dr`, `dr-fin`, `dr-lobby`), same 20 Hz snapshots, same lobby text; `party_drift` green.
- **Dominoes + Six-Card Golf online**: up to 3 friends play at the host's table on their own screens (`cardroom.onlineHost` / `mirrorMatch`). Privacy by construction: the host sends each guest a *redacted* state (`redact()` in each rules file), so a guest page never holds another hand, the boneyard, the stock order, a face-down card (its own included) or another player's stock draw; at the end of a Dominoes round all hands are shown, as at a real table. Guests see the table from their own seat (Dominoes rotates the seats; Golf lines up the others). Moves are checked twice: on the guest for instant feedback, and by the host's `act()`, which refuses forged moves and tells that guest why. Away 12 s → bot stand-in; reconnect → table resent. Each guest gets its own results/XP.
- Tests: rules tests simulate 60 Dominoes rounds + 40 Golf holes with two mirror guests through a fake room (no leaks, same legal moves as the host, matches finish); `party_dominoes_online` and `party_golf_online` (host + 2 guest pages + a bot, landscape + portrait). `test/party.js` page-load timeout raised to 120 s: on a 4-core runner a third WebGL page can take ~50 s to load while others render.
- **Engine fix found on the way (all engine games):** `E.loop` could hand the game a *negative* first frame step when a page loads slowly (the first rAF timestamp can be older than the start time). Smoothing written as `1 - k^dt` then explodes; a Dominoes guest's camera flew off to ~1e35 and the table went black. `dt` is now clamped to 0…0.05 s.
- Open: real-network check over live Realtime (two homes), online Tide Lines/Depths (same helper), a "rejoin your seat" banner after a long drop.
