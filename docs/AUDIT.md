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
| Pixel Pact (2D) | Tested | `__GAME`/`__READY` hooks + `test/pixelpact.js`; best level recorded; results de-duped | Not on the engine (Phase 5 rebuild) |
| Tide Runner, Fail Tray | Tested (baseline) | — | P3 polish (hearts chip wrap; sign clipping) deferred to Phase 5 |

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
