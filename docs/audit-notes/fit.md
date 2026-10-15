# Perfect Fit — audit notes (Phase 1)

## Changes
- **Pointer feel**: the drop spot is now the point on the slot floor right under the pointer (it used to be the lifted item's x/z, about 1 unit behind the slot on screen). Slots are hit-tested by their rectangle first, then by the nearest slot within reach. The lifted item eases onto the pointer (the grab offset fades out). On touch it floats about 44 px above the fingertip so the thumb doesn't hide it, but the drop is still judged under the finger. Rays use the canvas rect. `pointercancel`, `lostpointercapture` and window blur send the item home with no "wrong". A fast flick uses the pointerup position. Drag targets are clamped to the table near the screen edges.
- **Portrait 390x844**: margins come from the real HUD (2-row chip bar, hint button). The placemat shape is chosen so that box + mat fit the tall screen (widest first), so mats are about 95% of the width and slots are about 110 px. Lids stand upright on phones and are framed separately (they may tuck under the HUD's 2nd row), so the Picnic Basket lid no longer crowds the slots. Landscape layout is unchanged (lid top margin 56 px).
- **EN/ES via E.L**: level names, item names (hint speech), title/lead/how/options, toasts, HUD, BEFORE/AFTER, the "Perfect fit!" banner, results title/stats/buttons, replay buttons, pause line and key hint. Listens to `inoa:settings` to re-render.
- **Keyboard/gamepad**: the key hint shows keyboard or pad wording and is read aloud once (`E.say(.., {once:true})`). The title "how" line mentions the pad.
- **Test** (`test/fit.js`) checks:
  - real mouse drag, with drop point = pointer (< 2 px)
  - drop point at all 4 screen edges, and an off-box release costs no penalty
  - fast flick
  - touch PointerEvents, `pointercancel` mid-drag
  - touch drag after a resize
  - keyboard and fake-gamepad placing
  - Spanish menu
  - read-aloud text
  - `E.results` exactly once (profile plays +1, one results card)
  - all levels
  - Shots use a `_p` suffix in portrait.

## Results
- Landscape: `ALL CHECKS PASSED` / `NO_ERRORS`
- Portrait: `ALL CHECKS PASSED` / `NO_ERRORS`
- Screenshots: `fit_start(_p)`, `fit_drag(_p)`, `fit_lv2_p`, `fit_lv7(_p)`, `fit_lv7_done_p`, `fit_title_es(_p)`, `fit_results(_p)`

## Known issues
- In portrait, some levels leave about 80–100 px of empty table above the hint button (width-limited now). It could be used for a deeper mat.
- Drag feel still needs a check on a real phone (synthetic touch only here).

## Engine requests
- none
