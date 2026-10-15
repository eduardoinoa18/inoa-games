# Pixel Pact: Depths: Phase 1 audit notes

## Changes (games/depths.html, test/depths.js)
- **Portrait framing:** the portrait camera now sits higher and steeper (pitch 1.12, distance 19.5 plus a spread term) and keeps the party in the lower-middle of the screen. A darker "south apron" floor with rubble now continues past the low front wall in every room, so tall views and the bottom edge in landscape no longer end in black. The boss close-up pulls back further in portrait (13 instead of 9.5) so the boss fits the narrow screen. With touch controls on, the heroes stay above the pad. Landscape framing is unchanged.
- **Banners:** a new queue (`bigText` → `BIG`) shows one banner at a time. It runs on game time, so it pauses with the game and stays in sync with headless stepping. It drops duplicates, keeps at most 2 waiting, and clears on room change. VICTORY and FALLEN jump the queue. The queue is held during the boss intro. Ultimates used by AI allies now show a small floating label instead of a full-screen banner. The text size is clamp(30px, 9.5vw, 80px) with a 92vw max width, so it fits at 390 px.
- **Damage numbers:** hits on the same target within 0.28 s are merged into one number (gold "!" if any hit was a crit). Hits dealt only by AI allies show smaller and dimmer. The global cap went from 26 to 14. "dodged" now shows only for human players. Hero damage numbers are merged the same way.
- **Boss intro:** daytime-style bloom is now 0.2 (was 0.32) with threshold 0.88. During the close-up, bloom, exposure and the party light are lowered so the pale boss reads clearly. The intro title sits above the touch pad in portrait.
- **Results:** shows "Rooms cleared 8/8" and "Boss beaten Yes/No", and the best line reads "8/8 rooms + boss". The title screen best line and the pause line are also fixed. `E.results` is called once per run (guarded by `G.ended`; the test checks there is exactly 1 results card).
- **Story allies:** each ally gets a reaction delay per telegraph (0.3–0.65 s), misses about 22% of telegraphs entirely, rolls only 12% of the time, and has a 1.2–2.2 s roll cooldown. Normal and Hard, and the autopilot player, keep the original sharp behaviour. Enemies are unchanged.
- **EN/ES** via `E.L` for: the title lead, how-to list and section labels, room toasts, door toasts, banners, boon picker, downed toast, results, and the spoken lines. The title re-renders on `inoa:settings`. Spoken instructions that repeat use `once: true`, and the touch version speaks touch instructions.
- **Test:** samples the number of visible banners (must be ≤ 1) and floating numbers during the simulation. It also checks for exactly one results card and errors if any stat still says "/9". Portrait shots keep the `_p` suffix (run.js).

## Results
- Landscape: `PORT=8812 node test/run.js depths test/depths.js`, NO_ERRORS (checks: big 1, results 1, "8/8 Rooms cleared | Yes Boss beaten").
- Portrait: `W=390 H=844 ...`, NO_ERRORS (same checks).
- Quick and touch, portrait: `DEPTHS_MODE=quick SUFFIX=_qp W=390 H=844 ...`, NO_ERRORS.
- Screenshots: test/out/depths_{room1,room3,room5,room7,bossintro,bossfight,results}{,_p}.png and depths_touch_qp.png.

## Known issues
- In portrait at the very start of a room (party at the south door), the front ~30% of the screen is apron floor. That is inherent to a 17-deep room on a tall screen, and on phones it sits mostly behind the touch pad.
- One of 5 runs reported "results shown 0 times" (the autopilot run did not reach results inside the test window). It did not happen again; watch for it.
- ~~Class, boon and meta names and descriptions are still English only.~~ Fixed in the elevation pass (all EN/ES).
- The local limb aiming and `orientTo` were kept (not switched to `E.aimLimbs` / `E.orientTo`).

## Engine requests
- `E.floatText` could return its element (or support a merge key) so games can update a number instead of spawning a new one.
- An optional `E.bigText` queue in the engine (game-time driven, one at a time), since several games hand-roll this.

## Elevation pass (2026-10-15)
Act II (Glowroot Hollow: 4 room themes, Sporecap / Burrower / Crystal Sentry, boss Grumblestone with phase gates), 5 new boons, boss flash and banner fixes, full EN/ES, bot unstick, perfect dodge. Details, test commands and open items: `docs/AUDIT.md` → "Depths elevation pass".
