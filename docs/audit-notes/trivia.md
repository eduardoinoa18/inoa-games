# Pact Trivia: Phase 1 audit notes

Files changed: `games/trivia.html`, `test/trivia.js`.

## What changed
- **Camera framing (P1 portrait fix).** A new shot-fitting helper (`frameShot` / `uiBox`) moves the camera back along each shot's direction until all 4 board corners and the contestants that matter fit inside the part of the screen the HTML UI leaves free. That area is measured from the DOM: the HUD and portrait score chips at the top, and the answer panel or landscape score chips at the bottom. It then re-centres the shot. Portrait uses this for every shot. Focus shots (buzz/answer, correct/wrong, final reveal, winner) use it in both orientations, leaning toward the focused contestant. Before, the landscape answer and winner shots also cut off the board. The landscape wide shot is unchanged. Camera sway is smaller in portrait. Results are cached per layout key, so the DOM is measured only when the layout changes.
- **Portrait UI.** Score chips now span the full width. Before, `left:50%` plus translate limited them to half the screen, so they stacked one per row. Toasts now sit low on the stage floor and no longer cover the question board (both orientations). In short landscape screens the answer panel is more compact, so contestants stay visible.
- **EN/ES sync.** The shared profile owns the language (`E.lang()`). The title language buttons and `start({lang})` call `E.setSetting('lang')`, so engine cards (pause, results, settings) match. A language change from any source (settings panel, the `inoa:settings` event, or the hub in another tab via `storage`) re-localises the title, the current and remaining questions (the shuffle order is kept), the board banner, the buzzers and the open answer panel. Translated the leftover English strings: best-score label, share text, "Space", input aria-label.
- **Results once.** `G.resultsShown` guard plus a `__GAME.resultsCount` hook. Also passes `won`.
- **Kids mode.** A wrong final answer no longer subtracts the wager ("no minus points" was being broken).
- **Input.** Wager card now works with keys 1–5 (the 75% option was missing), arrows + Enter, and gamepad (d-pad + A). The "I'm ready" and "Locked/OK" cards accept gamepad A.
- Leftover confetti is cleared when a new game starts. Bloom lowered from .22 to .2.

## Tests
Both orientations print **NO_ERRORS**. The test now covers:
- Solo vs bots, with steal and auto-play through to results (count 1, plays +1).
- 4 local players in ES kids mode: profile/doc language checks, P2 keyboard buzz + digit answer, P3 touch buzzer + tapped choice (steal), P4 gamepad buzz (mocked `getGamepads`), a mid-game EN↔ES switch, keyboard wager.
- Second results (count 2, one card, Spanish title).
- Portrait shots get a `_p` suffix.

Screenshots worth reviewing: `test/out/trivia_{answer,winner,es_answer,es_correct}.png` and `trivia_{answer,steal,winner,es_correct,es_results,p_correct}_p.png`.

## Known issues
- On the results card, the engine shows "Best solo score" in multiplayer games too, because it shows `r.best` whenever the profile has one.
- The big "Steal!" banner briefly covers the board text (it lasts 1.3 s, on purpose).
- Text inside the pause menu does not change language until it is reopened (engine).

## Question bank (not fact-checked; Phase 5)
I saw no clearly wrong answers while testing. Wording to look at:
- ES "¿Cuál de estos es un vegetal?" would read better as "una verdura".
- Croissant → France: the question says "most associated", so it is OK, but the pastry's origin is Austrian.
- "Hat trick": the term comes from cricket. The question says "goals", so Soccer is OK.
- Mixed regional Spanish (banana / plátano, frijoles / porotos) is acceptable.

## Engine requests
- `results({showBest:false})` (or show best only when `best != null` is passed), so multiplayer rounds don't show a solo best.
- `pauseMenu` should re-render on `inoa:settings`.
