# Tide Lines — Phase 1 audit notes

Files touched: `games/tidelines.html`, `test/tidelines.js` (only).

## Changes
- **Near-camera handling (P1)**: new `safeCam(pos, target, minD)` keeps the camera at least a minimum distance from the player (3.2 m for close-ups, 4 m in play) and lifts it until it's out of crates/platforms/walls/fountain and the player is in clear view. It checks against the arena's own collision volumes (`propH`), with no raycasts. Used for the play/intro camera, the new close-up mode and the test `window.__CAM` hook.
- **Occluder fade (P2)**: palms (planters + pier corners), crate stacks and lantern posts are registered as occluders (`occluder()`, per-object cloned materials). Each frame 3 rays (feet/chest/head) go from the camera to the player. Anything they hit, or anything the camera is inside, fades to 20% opacity and its outline is hidden, then fades back. The palm canopy no longer hides the player in the last 10 s.
- **Close-up mode**: `window.__GAME.closeup(true)` gives an over-the-shoulder orbit (5.4 m / FOV 52 on a tall phone, 4.4 m / 42 in landscape). In close-ups, other painters standing between the lens and the player are hidden.
- **Name tags**: bot tags are slightly larger (width 1.85, content-sized by the engine). To cut clutter, tags hide when the camera is within 6 m of them (no screen-filling pills in close-ups) and, during play, for bots more than 15 m from you.
- **EN/ES**: all player-facing text now goes through `E.L`: title, how-to lines, picker labels, bot skills, the 4v4 line, INK meter, countdown/GO/10 SECONDS/TIME, Splatted overlay, toasts, SPLAT float, judge card (TURF COUNT, X WINS, DRAW), results headline, stats, best label, share text, pause button, touch aria labels and every spoken line. Changing language in the settings panel re-renders the title screen live (`inoa:settings`).
- `E.say` for key instructions (intro, set to `once`), 10 s warning, splat, low-ink toast and winner. `E.results` now passes `won` (PWA install offer after a win). Results stat "m²" uses a non-breaking space so it no longer wraps in portrait.
- Fixed nothing in the match loop: the 2:30 match, bots, judge sweep and results flow are unchanged.

## Verified
- Touch: stick, 💦 (hold + drag to aim), 💣. Keyboard: WASD/arrows, Space/J or mouse to spray, mouse aim, E/L for a bomb, Esc/P to pause. Gamepad: left stick, right stick aims and sprays, A/RT/RB spray, X/Y bomb.
- `E.results` runs exactly once per round. The test checks the `plays` count goes 0 → 1 and doesn't move afterwards.

## Tests
- Landscape: `PORT=8860 node test/run.js tidelines test/tidelines.js` → `NO_ERRORS`
- Portrait: `W=390 H=844 PORT=8860 node test/run.js tidelines test/tidelines.js` → `NO_ERRORS`
- New test checks: camera requested inside the player ends up ≥ 3.2 m away, and camera requested inside a crate stack is lifted to y ≥ 3.2. Player parked behind a planter palm makes it fade (else error). Results grant exactly once. Spanish title after switching language in settings.
- Screenshots: `tidelines_closeup`, `_closeup2`, `_palm`, `_final10`, `_results`, `_title_es` (and the `_p_` portrait versions).

## Known issues
- One map only (content backlog).
- The held blaster points along the aim heading rather than following the forearm exactly. It looks fine at play distance but is visible in close-ups. Could move to `E.aimLimbs`/`E.attach` later.
- Faded props still cast their full shadow (intentional, keeps the ground readable).

## Engine requests
- An optional engine `fadeOccluders(camera, target, list)` helper. Builders, Drift and Depths have the same occluder problem. The local version here (`occluder()` + `fadeOccluders()`) could be lifted as-is.
