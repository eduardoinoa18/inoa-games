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
