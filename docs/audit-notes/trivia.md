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

---

# Pact Trivia: elevation pass (2026-10-16)

Files: `games/trivia.html`, new `games/trivia-questions.js` (question bank module), `test/trivia.js`, `pad.html` (one-line fix, see below), hub copy in `hub-src/`.

## Fact-check of the existing bank
All 173 existing multiple-choice questions (the handout said ~160) were checked one by one: EN and ES say the same thing, exactly one correct answer, no outdated or regional-only facts, kid-appropriate. None were factually wrong; none removed. Changes:
- **Hat trick** (sport, hard): "In which sport is scoring three goals called a hat trick?" was not unique (the term comes from cricket and is used in hockey). Rewritten as "In soccer, scoring three goals in one game is called a…" (Hat trick / Home run / Slam dunk / Hole in one).
- **Bollywood** (film): Bollywood is the Hindi-language industry, not "India's film industry". Now "The Hindi-language film industry nicknamed 'Bollywood' is in which country?".
- **Gold symbol** (sci): ES distractors (Ag, Or, Go) did not match EN (Ag, Go, Gd); aligned.
- **Chrysalis** (animals): ES distractors (Madriguera, Concha, Colmena) did not match EN (Nest, Shell, Burrow); aligned.
- **Vegetable** (food): ES "un vegetal" → "una verdura" (the earlier note).
- **Slam dunk** (sport): ES "clavada" is regional (Mexico); now "'clavada' (o 'mate')".
- Difficulty re-tags (too easy for "hard"): light vs sound 3→2, nocturnal 3→2, capital of Egypt 3→2.
- **Egypt's continent** (geo, kids): Asia was a distractor, but Egypt's Sinai is in Asia; replaced by Australia (found while reviewing the daily screenshot).
- Kept on purpose: croissant → France ("most associated" wording), regional food words (banana/plátano, papas) where both are widely understood.

## New questions (all original, checked the same way)
- **169 new multiple choice** → **342** (121 kids, 139 everyone, 82 hard). Three new categories: History (ancient world to 1950, 29), Math & puzzles (30), Words & languages (29; written so the fact is the same in both languages, e.g. "How do you say 'hello' in Spanish?" ↔ "¿Qué significa 'hello' en inglés?"). +7–12 per existing category, weighted to kids questions.
- **99 true/false statements** (40 kids / 38 everyone / 21 hard; 51 true, 48 false; the deck balances true/false per round).
- **32 closest-number questions** (9 kids), each with a range and step for the dial.
- Total **473**, 11 categories. Avoided on purpose: "how many continents" (5, 6 or 7 depending on the school system), "longest river" (Nile vs Amazon is disputed), "most populous country" (changed in 2023), any living person, brand or media franchise. The only post-1950 fact is the first Moon walk (1969), with no person named.
- Cross-checked for give-aways: no true/false statement answers a multiple-choice question in the same bank (about 25 candidates were rewritten), and no fact appears in two formats (e.g. Columbus's year is only a number question, the 88 piano keys only multiple choice).
- Numbers with a rounding rule: Everest 8,848.86 m → 8,800 (nearest hundred), Pico Duarte 3,098 m → 3,100, Great Pyramid c. 2560 BC → 4,600 years ago, sound 343 m/s (20 °C air), Spanish alphabet 27 letters (RAE 2010).

## Game changes
- **Show picker** on the title: **Full show** (default: Buzz-in ×4 → Lightning true/false ×5 → Your pick ×3 → Closest number ×2 → All In final), **Classic** (8 buzz-ins + final, the old game) and **Daily 10**.
- **Lightning true/false**: big ✓/✗ tiles, keys 1/2, 50 points, faster timers, no steal (one wrong answer gives the other away).
- **Your pick**: the player in last place (humans win ties) picks one of three categories (keys 1–3, tap, gamepad A/B/X, or their phone).
- **Closest number**: open guesses, last place first; number dial with type-in digits, ←/→ (±step), ↑/↓ (±10 steps), slider, hold-to-repeat ± buttons, gamepad d-pad + A, phone ± buttons + Lock. Closest gets +200, exact +300, ties share, nobody loses points.
- **Daily 10**: seeded by the local date (same 10 questions and choice order for everyone that day: 3 kids, 4 everyone, 3 hard, spread over categories), solo, 100 + up to 50 speed bonus per right answer. First run of the day is saved with a streak; replays are marked practice. Share line: `Pact Trivia · Daily 2026-10-16 / 🟩🟩🟥… 8/10 · 1130 / link`.
- **Per-category stats** (`inoa.trivia.stats`, human answers on this device) on the title; best category of the round shown after results.
- **No repeats**: stable question ids (hash of the English text, so edits/reordering do not break history). Each kind keeps its ask order; new decks take never-asked questions first, then the ones asked longest ago (`inoa.trivia.seen2`). Test: 0 repeats in the next show.
- **Bot skill** picker (Easy / Normal / Hard, Kids mode switches to Easy). Measured accuracy per difficulty (2000 trials, Profe Pip · Lucky Lalo): Easy 67/60/51 · 44/35/26, Normal 96/85/70 · 62/47/37, Hard 98/96/79 · 71/55/43.

## Bugs fixed
- **Buzz fairness**: bots could buzz 0.9 s after the buzzers opened, before a child heard the question. Bots now wait until the question text has been read (≈16 characters a second, 0.8–5 s) before their reaction time starts. Steals are not gated.
- Kids mode made bots *stronger* (accuracy ×1.05). Removed; Kids mode now sets Easy bots.
- Phone wager card showed `undefined` on the 5th button (`pad.html` labelled choices with `'ABCD'[i]`). Fixed to `'ABCDEF'[i] || i + 1` (one line; also needed for the 5-button number dial on phones).
- Portrait: the faded buzzer showed through the answer panel; buzzers and score chips now hide while any panel is open.
- The camera cache key ignored which panel was open, so the taller number dial could cover the board. The panel type is now in the key.
- XP could be fractional (score/10 with 25-point steps) and grew without limit; now rounded and capped (40 + ≤120 + 40 for a win).
- Share link no longer includes query strings (`?online=1`).

## Still open
- Phone buzzes travel over the network, so a local keyboard player has a small edge (no timestamp arbitration).
- A native Spanish speaker should read the 300 new ES lines once (regional words were kept neutral where possible).
- Daily 10 is solo on the big screen (phones get a "watch the big screen" message).
