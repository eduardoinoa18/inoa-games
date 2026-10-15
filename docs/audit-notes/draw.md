# Draw the Pact — audit notes (Phase 1)

Files touched: `games/draw.html`, `test/draw.js` (this file is new).

## Changes by feature
- **Gamepad (new).** Polled with `navigator.getGamepads()` every frame (`padPoll`).
  - Menus and cards (title, pass, peek, who-guessed, reveal, results, pause, settings, slides): the D-pad or stick moves a yellow focus ring between the top card's buttons, **A** presses the focused button (with nothing focused it presses the card's main button), **B** = back/resume, **Start** = pause/resume. On a telephone slide, A moves to the next slide.
  - Drawing: a cursor that the stick or D-pad moves over the paper. **Hold A** to draw, **B** undo, **X** eraser, **LB/RB** colour, **LT/RT** size, **hold Y** to peek at the word (party), **Select** = the green action (Done / Someone guessed it), **L3** slows the cursor. Once a pad has been used, a hint line shows under the prompt.
- **Keyboard.** Arrow keys and Enter/Space work on every card (Tab still works). While drawing: Enter = Done or "guessed", Z / Ctrl+Z undo, E eraser, 1–3 size, `[` `]` colour, hold Q or Space to peek. The title "how to play" lists the keys and pad buttons in EN and ES.
- **Drawing robustness.**
  - `setPointerCapture` is now guarded, so a synthetic or stale pointer can't throw.
  - `lostpointercapture` ends the stroke, as `pointercancel` already did.
  - A new pointer first finishes any stroke left hanging.
  - Undo during a stroke ends that stroke first.
  - When a stroke ends, the canvas is redrawn from the stroke list, so undo gives back the same state as before.
  - Pen pressure is kept. A pen reporting pressure 0, and every mouse or touch stroke, draws at the normal width.
- **Language.** The profile language (the shared settings) is the source of truth.
  - The in-game EN/ES toggle and `start({lang})` write it with `E.setSetting('lang')`, so the engine's title, pause, results and settings cards match.
  - The game listens to `inoa:settings` to follow changes made in the settings panel.
  - These were English in Spanish games and are now translated: "Speed Sketch", the colour/brush/player/description aria-labels, the best label, share texts, the copied toast, the loading line, the GALLERY/GALERÍA wall sign, `<html lang>`, and the hub and pause aria-labels.
  - `locScreen()` still translates engine cards if an older engine without `E.t` is ever loaded.
- **Results exactly once.** All three modes end through `finish()`, which has a `G.ended` guard. `partyEnd`, `sketchEnd` and `phoneEnd` also guard. Every mode passes a localised `bestLabel` and `won`.
- **Test.**
  - Screenshots get a `_p` suffix in portrait runs.
  - New checks, about 60 `ok`/`FAIL` lines ending in `DRAW_CHECKS_PASSED`:
    - plays counter +1 per mode
    - real mouse strokes: position, thickness, colour
    - undo by key, button and Ctrl+Z
    - clear and undo
    - eraser
    - pen pressure 1 / 0.2 / 0, and touch, using dispatched `PointerEvent`s
    - pointercancel and stray moves
    - resize, and rotation to the other orientation
    - a full gamepad and keyboard party in Spanish
    - pause with Start
    - no English UI text on any ES screen

## Test results
- Landscape `PORT=8840 node test/run.js draw test/draw.js` → `DRAW_CHECKS_PASSED`, `NO_ERRORS`.
- Portrait `W=390 H=844 PORT=8840 node test/run.js draw test/draw.js` → `DRAW_CHECKS_PASSED`, `NO_ERRORS`.
- Screenshots worth reviewing (portrait adds `_p`): `draw_es_title`, `draw_gp_draw`, `draw_es_results`, `draw_es_pause`, `draw_pointer_tools`, `draw_rotated_draw`, `draw_phone_slide1`, `draw_gallery`.
- `test/out/draw_p_*.png` are stale files from the old test, which hard-coded the portrait shot names.

## Known issues / notes
- Stylus pressure is checked with synthetic `PointerEvent(pointerType:'pen', pressure)`. It still needs a check on real hardware (iPad + Pencil, Android stylus).
- Undo restores the exact stroke list. Pixels match within anti-aliasing noise (about 16 px), because Chrome may move a canvas that is read back from GPU to CPU raster.
- Telephone "describe" still needs typed text, so a gamepad-only player can't fill it in (no on-screen keyboard).
- In the headless runs only, the "Saved to the gallery wall!" toast can overlap the next prompt: toasts use real-time timers while the test speeds up game time.

## Engine requests
- An optional `focusNav` helper in the engine (the D-pad/arrow focus ring used here), so every game's cards are gamepad-navigable the same way.
- `createInput` could expose the raw button edges (LB/RB/LT/RT/Select/L3) that this game polls itself.
