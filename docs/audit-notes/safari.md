# Snack Squad Safari — engine migration notes (`games/safari.html`)

## Step 0 — feature inventory (taken from the ORIGINAL embedded-engine build, before any change)

| # | Feature | Where (original code) | How it works |
| --- | --- | --- | --- |
| 1 | Loading screen | `#loading`, boot IIFE | Own look: egg emoji cycles 🥚🐣🍎🥦🧃, progress bar, "Packing the cart… / Waking up the buddy… / Ready!" |
| 2 | Title screen | `#scrTitle` | Kicker, title, lead, Let's play / How it works, Español toggle, "habits, not medicine" disclaimer |
| 3 | How it works | `#scrHow` | 7 explainer rows (buddy, catching, labels, Scanner, Buddy Rescue, Mystery Snack, controls) |
| 4 | Setup | `#scrSetup` | Optional name (14 chars), 9 allergen chips (min 1 selected, default peanut + milk), Read-aloud on/off, Mode solo / duo |
| 5 | Level picker | `#scrLevels`, `buildLevels()` | 5 levels, stars per level, a level unlocks when the previous one has ≥1 star |
| 6 | 5 levels + weather | `LEVELS` | 1 Dawn trail (clear), 2 Sunset boardwalk (sunset, offers), 3 Lantern night party (night: stars, moon, lantern point lights, bloom .45), 4 Rainy market day (**rain** particles, fog), 5 Snow cabin trail (**snow** particles, snowy trees, tinted ground). Per level: goal, speed, pack ratio, hidden-name ratio, may-contain ratio, offers count, sky/fog/sun/water colours |
| 7 | World | `buildWorld()` | Gradient sky dome, clouds (day) / stars + moon (night), vertex-coloured bumpy trail, lane stones, animated water shader (left), recycled scenery (palms, rocks, trees, benches, houses, barrels/chests, lantern posts), instanced grass tufts + flowers, drifting boat |
| 8 | Cart + kid + grown-up | `buildCart()` | Wooden cart with spinning wheels, kid (skater-female) riding with rig pose `ride` (cheers on catch), grown-up (skater-male, blue tint) walking behind in duo mode (`walk`, raises an arm while scanning) |
| 9 | Buddy pet | `buildCart()`, `update()` | Egg (spotted) hatches into a critter after 4 safe snacks; buddy level = 1 + got/5; grows, bounces, chomp squash on catch; HUD shows 🥚/🐣 Buddy lv N and mood face 😊😐🥺 |
| 10 | Lanes + catching | `move()`, `update()` | 3 lanes; catch safe food (+10 + combo bonus, sparkle burst, chomp, food name read aloud every 3rd combo); unsafe food → `hurt()`; missed unsafe food counts as dodged (+3) |
| 11 | Packaged products + label reading | `spawn()`, `labelFor()`, `nearestPack()`, `tryRead()`, `openLabel()`, `answerLabel()` | Packs show a **?**; Read label (button / Space / E / centre tap) opens ingredients with highlighted allergens (hidden names in pink), CONTAINS line, "May contain" line; read aloud; Safe / Not safe → +30 "label pro" or explanation; "Read it to me" button |
| 12 | Hidden names + may-contain + decoys | `ALLERGENS[].hidden`, `labelFor()` | Allergen inserted by plain or hidden name depending on level; "may contain"; decoy allergens not on the player's list |
| 13 | Scanner role (grown-up) | `#scan`, Shift key, `G.scan` | Duo only: hold purple button or Shift → purple beam, packs within range get a red/green ring; label modal shows a Scanner hint (`#lblLens`) in duo mode or for scanned packs |
| 14 | Duo mode | `S.duo` | Grown-up visible pushing the cart, Scanner button visible, Scanner hints on labels |
| 15 | Friend offers | `OFFERS`, `startOffer()` | From level 2 (2–3 per level): social scenario with 3 shuffled choices, read aloud, good choice +40 and a lesson, bad choice → `hurt()` |
| 16 | Mystery snacks | `TREATS`, `mystery()` | Every 10 safe snacks: earned (never bought) treat with rarity Common/Rare/Legendary (EN/ES), saved to collection |
| 17 | Hurt + first-time drill | `hurt()`, `startDrill()` | Mood drops, screen shake, "let's look again"; first mistake per level starts the Buddy Rescue drill, later mistakes show a tip only |
| 18 | 3D rescue cutscene | `startRescue()`, `rescueStep()`, `rescueUpdate()`, `rescueCamera()`, `endRescue()` | Kid + grown-up move into the world. Phases: **symptoms** (hives grow, sweat drops, "I feel itchy and sick" bubble) → **help** (kid raises arms, grown-up walks over and kneels) → **pen** (epinephrine auto-injector: blue cap snaps off, travels to outer thigh, progress ring fills while the player holds 3 s, tick each second) → **call** (phone in the grown-up's hand, keypad screen updates 9-1-1, "Calling 911…") → **lie** (kid lies down, hives fade, ambulance drives in with flashing red/blue lights + siren, "Help is here!" bubble). Drill card (bottom-right, `#scrDrill`) mirrors the 3 steps, "Read this step" button, hold button, on-screen dial pad, Call 911 button, "Lie down, legs up, wait together" button. Completing it: +50, lesson learned, mood restored |
| 19 | Read-aloud EN/ES | `say()`, `STR`, `UI_ES`, `applyLang()` | speechSynthesis (en-US / es-US), toggled in setup + pause; text strings EN/ES; title/setup/buttons translated |
| 20 | Pause | `#scrPause`, ⏸, Esc, tab hidden | Keep going / Back to levels; toggles: Sound, Camera sway (reduced motion), Read aloud |
| 21 | Results | `endLevel()`, `#scrResults` | Stars (3 = no oops, 2 = ≤2, 1 otherwise, best saved per level), title Perfect/Clear, snacks fed / labels read / allergens dodged, up to 5 "Things you learned", collection line, Play again / Next level, Share my run. Reward via inline `window.__inoaReward('safari', 40 + got*3, 10 + got)` shim |
| 22 | Settings persistence | `localStorage['snacksquad']` | name, allergens, duo, sound, motion, stars[5], collection, lang, voice |
| 23 | Controls | keydown handlers, `#btnL/#btnR/#btnRead`, canvas taps/swipes | Keyboard A/D/←/→, Space/E read, Shift scanner, Esc pause; touch buttons; swipe left/right; tap left/right third to move, centre to read. **No gamepad.** |
| 24 | Camera | `render()` | Behind-cart chase with gentle sway (optional), screen shake on mistakes, portrait raises/pulls back camera, FOV 62 in portrait |
| 25 | Test hook | `window.__AA` | `{G, S, startLevel, spawn, answerLabel, LEVELS, endLevel, move, tryRead, openLabel, nearestPack, ASSETS, buildCart, update, say, rig, grig, THREE, scene, camera, R}` |

Before screenshots: `test/out/safari_before_*.png` (landscape) and `safari_before_*_p.png` (portrait), produced by the expanded `test/safari.js` on the original file (`PFX=before_`).

## For allergist review (safety-relevant strings, copied verbatim, NOT changed)

None of this wording was rewritten in the migration. It must be reviewed by a board-certified allergist before families use the game.

### Rescue drill card (`#scrDrill`) — EN only in the original (no ES translation exists for these)
- Title: "Buddy Rescue!"
- Sub: "Itchy mouth, hives, a swollen lip, trouble breathing: those are the signs. Stay calm and follow the plan, in order."
- Step 1: "Tell a grown-up right away" / "Say: \"I ate something and I feel sick.\""
- Step 2: "Use the epinephrine auto-injector" / "Outer thigh, hold it there and count."
- Step 3: "Call 911" / "Even if you feel better. Then lie down and wait."
- Hold button: "Hold on the thigh: 3… 2… 1…", then "Hold… 3/2/1", "Done!"
- Final button: "🛏️ Lie down, legs up, wait together"
- Footer: "Practice only. Your real plan comes from your doctor or allergist; grown-ups, keep two auto-injectors nearby."
- Phone screen (3D canvas): "Calling 911…"
- Lesson added: "Reaction plan: tell a grown-up, auto-injector, call 911, lie down and wait"

### Rescue strings with EN / ES
| Key | EN | ES |
| --- | --- | --- |
| drillA button | 🗣️ "I need help!" | 🗣️ "¡Necesito ayuda!" |
| drillC button | 📞 Call 911 | 📞 Llamar al 911 |
| kidHelp | I feel itchy and sick | Me pica y me siento mal |
| gotYou | I am here. Let me see you. | Aquí estoy. Déjame verte. |
| penTip | Blue cap off, orange to the outer thigh, hold | Tapa azul fuera, naranja al muslo, sostén |
| penDone | Done! Now rub the spot for 10 seconds. | ¡Listo! Ahora frota el lugar 10 segundos. |
| dialTip | Press 9, then 1, then 1 | Marca 9, luego 1, luego 1 |
| tryKey | Not that one. Press | Ese no. Marca el |
| nowCall | Now press the green call button. | Ahora presiona el botón verde de llamar. |
| callScript | Say: my friend had an allergic reaction. We used the epinephrine. Please come to the Dawn Trail picnic area. | Di: mi amigo tuvo una reacción alérgica. Usamos la epinefrina. Vengan al área de picnic del sendero. |
| lieTip | Lie down, legs up, stay together until help comes | Acuéstate, piernas arriba, juntos hasta que llegue la ayuda |
| helpHere | Help is here! You did everything right. | ¡Llegó la ayuda! Hiciste todo bien. |
| drillDone | Perfect. That is exactly the plan. Your buddy feels better. | Perfecto. Ese es el plan. Tu amiguito ya se siente mejor. |

### Other safety-relevant strings
| Where | EN | ES |
| --- | --- | --- |
| Title disclaimer | Snack Squad Safari teaches habits, not medicine. Always follow the action plan from your own doctor or allergist. | Snack Squad Safari enseña hábitos, no medicina. Sigue siempre el plan de acción de tu médico o alergólogo. |
| How it works (EN only) | 🚨 Buddy Rescue: if an allergen slips through, your buddy needs you. Practice the 3-step plan: tell a grown-up, auto-injector, call 911. Calm and clear. | — |
| Label footer (EN only) | When you are not sure, the safe move is to skip it and ask a grown-up. | — |
| noRead | You grabbed a package without reading the label, and it had your allergen in it. | Tomaste un paquete sin leer la etiqueta y tenía tu alérgeno. |
| alwaysRead | Always read the label on packaged food | Siempre lee la etiqueta de los empaques |
| lucky | Lucky! That one was fine, but read the label next time. | ¡Suerte! Ese estaba bien, pero lee la etiqueta la próxima vez. |
| skipSafe | That one was actually safe. Skipping when unsure is still a good habit. | Ese sí era seguro. Saltarlo cuando dudas sigue siendo un buen hábito. |
| Scanner hints (EN only) | "<hidden> is another name for <allergen>." · "\"May contain\" means the factory also handles it. Treat it as not safe." · "<decoy> is not on your list. Is anything from your list in there?" · "read the CONTAINS line first, then the full list." | — |
| Mistake explanations (EN only) | "\"<hidden>\" means <allergen>." · "\"May contain\" is a warning. Skip it." · "Your allergen was on the list." · "<Food> has <allergens> in it." · lesson "\"May contain\" counts as not safe" | — |

### Friend-offer scenarios (`OFFERS`, EN only): lessons shown after each choice
- Cookie: "Asking is always the right first move." · "Homemade treats can hide allergens. Always ask first." · "Saying no politely is a superpower."
- Grandma's dessert: "A new recipe means new ingredients. Check first." · "Even a tiny bite can cause a reaction. Never test with your mouth." · "Reading together makes everyone safer."
- Trail mix: "Trail mix often has nuts, and hands spread crumbs. Skip shared bags." · "Your own snack is the safest snack." · "Teachers can check labels with you."
- Shared knife: "A shared knife carries traces. That is cross-contact." · "Clean tools and fresh jars stop cross-contact." · "Good call: a grown-up can make it safely."

### Factual data to verify
- Hidden ingredient names (`ALLERGENS[].hidden`): peanut: arachis oil, groundnut, mandelonas · tree nuts: marzipan, praline, almond paste, pesto · milk: whey, casein, lactose, ghee · egg: albumin, lysozyme, meringue, mayonnaise · wheat: semolina, durum, spelt, farina · soy: edamame, tofu, soy lecithin, miso · fish: anchovy, worcestershire sauce, surimi · shellfish: prawn, scampi, krill · sesame: tahini, benne seed, halva.
- Food → allergen tags in `FOODS` (e.g. Donut = wheat, egg, milk, soy; Chocolate = milk, soy; Hummus = sesame).
- Reviewer notes (observations only, nothing changed): the drill steps, symptoms line, hold-button text and footer have no Spanish version, so a Spanish-speaking family sees English in the most important screen; the call script always names "the Dawn Trail picnic area" regardless of level.

## Steps 1–3 — what changed (migration onto `engine/inoa3d.js`)

| Area | Before (embedded copy) | After |
| --- | --- | --- |
| Imports | three + 9 addons imported directly | `import * as E from '../engine/inoa3d.js'` only; `ui.css` linked; import map moved into `<head>` |
| Renderer / post | own WebGLRenderer, composer, bloom, vignette, SMAA, resize, fps drop | `E.createRenderer` (fov 50 / portrait 62, far 400) + `ENG.render()` auto quality; vignette .28 and the long -z shadow box kept |
| Sky + light balance | own sky dome shader + manual exposure/fog/sun/hemi/bloom | `ENG.setLook()` with the same per-level values (day bloom .14, night .45) + `ENG.setEnv(hdri)`; Safari's own clouds, stars, moon stay as scenery |
| Assets | own fetch + base64 + GLTF/RGBE parse | `E.loadPack('../packs/safari.json', ENG, …)` (gets the lead's manifest/.glb path automatically); `E.instance`, `E.addOutline`, `E.mat`, `E.grainTex`, `E.tagMaterial` |
| Rigs | own `findBones` + per-bone setters | `E.bones` + `E.pose` with the same angles (ride, walk, sick, arms-up, sit, lie, kneel) |
| Particles | own spark list | `E.Particles` (same speed/up/life/gravity) |
| Audio | own AudioContext + oscillators | `E.SFX` (good, bad, pop, win, tick) + `E.tone` for Safari-only snap / scan / siren |
| Speech | own speechSynthesis | `E.say` (wrapper strips markdown chars, passes language) |
| Settings | sound / voice / lang only in `snacksquad` | shared with the hero profile (`E.setProfile`), one-time migration of old choices; name, allergens, duo, motion, stars, collection still in `snacksquad` via `E.store` |
| Input | raw key handlers, no gamepad | `E.createInput` polled every frame: keyboard as before (+J/Enter read, K scanner, P pause) and **gamepad** (stick/d-pad lanes, A/X/Y read, B/R2 scanner, Start pause/resume). Space / gamepad A also hold the auto-injector step. Gamepad menu navigation (d-pad moves a focus ring, A presses; A with no focus presses the main button, which on the label card is "Not safe for me"). Touch buttons, swipes and canvas taps unchanged |
| Results | inline `window.__inoaReward` shim + own results screen | `E.results({gameId:'safari', …})` called exactly once per level end (xp 40+3·got, coins 10+got as before, best = score); the shared card carries Safari's stars, snacks/labels/dodged/score stats, "Things you learned", collection line, Play again / **Next level** / Share; ES labels for the card |
| Hub link | inline-styled anchor | ui.css `ig-chip ig-home`, still centred top |
| Hooks | `window.__AA` | `__AA` unchanged (+`engine`), new `window.__GAME` {update(dt) = one full frame, step, start(level, {duo}), startLevel, endLevel, spawn, tryRead, openLabel, answerLabel, nearestPack, pause, state()}, `window.__READY = true` after boot |

Safety wording: untouched (byte-identical strings; diff the `STR`, drill markup and `OFFERS` blocks against git to confirm).

## Tests
- `PORT=8830 node test/run.js safari test/safari.js` → `NO_ERRORS`
- `W=390 H=844 PORT=8830 node test/run.js safari test/safari.js` → `NO_ERRORS`
- The expanded test covers title (EN + ES), setup, level picker, all 5 levels (rain/snow particle systems counted), duo + Shift scanner, label read + answer, friend offer, mystery snack, pause, unsafe catch → every rescue step (symptoms, help, auto-injector hold, 9-1-1 dial, call, ambulance, lie down, done) → level end → results, and checks exactly one profile reward (`plays 0→1, xp 0→76`).
- Before/after comparison: `test/out/safari_before_*.png` vs `test/out/safari_*.png` (+`_p` portrait). Every feature screen is present after the migration; the scene, HUD, drill card and cutscene match. Differences: results now use the shared card (adds XP/coins/hero level, best score, Hub button); emoji/web fonts render differently headless (expected).

## Known issues (not changed)
- Rescue drill steps, symptoms, hold text and footer have no Spanish version (safety wording, left for allergist + translator review).
- Portrait duo: the Scanner button is a little tight at the right edge (same as before).
- No background music (the original had none either).
- The "Copied!" share fallback toast comes from the engine in English.

## Engine requests
1. Gamepad menu navigation (focus ring + A to press) for all cards — implemented locally in `padMenu()`.
2. `createInput` calls `preventDefault()` on Space for every keydown on `window`, which blocks typing spaces in text inputs; Safari stops propagation on its name field. Engine could skip events whose target is an input/textarea.
3. `results()` options for localized labels (kicker, Play again, Hub, Copied toast) and a hook to add extra content/buttons (Safari patches the returned DOM).
4. `setLook()` sky dome radius is fixed at 300 (needs `far` ≥ ~320).
