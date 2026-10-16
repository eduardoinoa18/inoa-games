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

## Known issues (migration pass; see the elevation pass below for what changed since)
- ~~Rescue drill steps, symptoms, hold text and footer have no Spanish version~~ → translated in the elevation pass (pending review, list below).
- Portrait duo: the Scanner button is a little tight at the right edge (same as before).
- ~~No background music~~ → soft music while rolling (stops during the rescue).
- The "Copied!" share fallback toast comes from the engine in English.

## Elevation pass (2026-10-16) — allergist review list

**Rule followed:** no medical guidance was invented or changed. The English rescue wording (drill card, bubbles, steps, hold
text, footer, lessons) is byte-identical to the migration pass. What is new: (a) Spanish translations of existing English
medical lines, (b) new non-rescue content (allergen tags of new foods/dishes, new "ask a grown-up / check the label" moments),
(c) a practice-game disclaimer. **Everything below needs review before families use the game.**

### A. ES translation — needs allergist + native review (existing EN medical lines, translated faithfully)
| Where | EN (unchanged) | ES (new) |
| --- | --- | --- |
| Drill title | Buddy Rescue! | ¡Rescate del amiguito! |
| Drill symptoms line | Itchy mouth, hives, a swollen lip, trouble breathing: those are the signs. Stay calm and follow the plan, in order. | Picazón en la boca, ronchas, un labio hinchado, dificultad para respirar: esas son las señales. Mantén la calma y sigue el plan, en orden. |
| Step 1 | Tell a grown-up right away / Say: "I ate something and I feel sick." | Avísale a un adulto enseguida / Di: "Comí algo y me siento mal." |
| Step 2 | Use the epinephrine auto-injector / Outer thigh, hold it there and count. | Usa el autoinyector de epinefrina / En la parte externa del muslo, sostenlo ahí y cuenta. |
| Step 3 | Call 911 / Even if you feel better. Then lie down and wait. | Llama al 911 / Aunque te sientas mejor. Luego acuéstate y espera. |
| Hold button | Hold on the thigh: 3… 2… 1… · Hold… 3/2/1 · Done! | Sostén en el muslo: 3… 2… 1… · Sostén… 3/2/1 · ¡Listo! |
| Final button | 🛏️ Lie down, legs up, wait together | 🛏️ Acuéstate, piernas arriba, esperen juntos |
| Drill footer | Practice only. Your real plan comes from your doctor or allergist; grown-ups, keep two auto-injectors nearby. | Solo es práctica. Tu plan real viene de tu médico o alergólogo; adultos, tengan dos autoinyectores cerca. |
| 3D phone screen | Calling 911… | Llamando al 911… |
| Lesson | Reaction plan: tell a grown-up, auto-injector, call 911, lie down and wait | Plan de reacción: avisar a un adulto, autoinyector, llamar al 911, acostarse y esperar |
| How it works (rescue row) | 🚨 Buddy Rescue: if an allergen slips through, your buddy needs you. Practice the 3-step plan: tell a grown-up, auto-injector, call 911. Calm and clear. | 🚨 Rescate del amiguito: si se cuela un alérgeno, tu amiguito te necesita. Practica el plan de 3 pasos: avisar a un adulto, autoinyector, llamar al 911. Con calma y claridad. |
| Label footer | When you are not sure, the safe move is to skip it and ask a grown-up. | Cuando no estés seguro, lo más seguro es no comerlo y preguntarle a un adulto. |
| Scanner hint (hidden) | <hidden> is another name for <allergen>. | <hidden> es otro nombre de <alérgeno>. |
| Scanner hint (may) | "May contain" means the factory also handles it. Treat it as not safe. | "Puede contener" significa que la fábrica también lo usa. Tómalo como no seguro. |
| Scanner hint (decoy) | <decoy> is not on your list. Is anything from your list in there? | <decoy> no está en tu lista. ¿Hay algo de tu lista ahí? |
| Scanner hint (default) | read the CONTAINS line first, then the full list. | lee primero la línea CONTIENE y luego toda la lista. |
| Mistake (hidden) | "<hidden>" means <allergen>. | "<hidden>" significa <alérgeno>. |
| Mistake (may) | "May contain" is a warning. Skip it. | "Puede contener" es una advertencia. No lo comas. |
| Mistake (plain) | Your allergen was on the list. | Tu alérgeno estaba en la lista. |
| Mistake (food) | <Food> has <allergens> in it. | <Comida> tiene <alérgenos>. |
| Lessons | "May contain" counts as not safe · "<hidden>" is a hidden name for <allergen> · <Food> contains <allergens> | "Puede contener" cuenta como no seguro · "<hidden>" es un nombre escondido de <alérgeno> · <Comida> contiene <alérgenos> |
| Original 4 friend offers | choices + lessons as listed above under "Friend-offer scenarios" | translated one-to-one in `OFFERS` (`c[i][3]` choice, `c[i][4]` lesson), e.g. "Even a tiny bite can cause a reaction. Never test with your mouth." → "Hasta un pedacito puede causar una reacción. Nunca pruebes con la boca."; "A shared knife carries traces. That is cross-contact." → "Un cuchillo compartido lleva restos. Eso es contacto cruzado." |
| Allergen names | Peanut, Tree nuts, Milk, Egg, Wheat, Soy, Fish, Shellfish, Sesame | Cacahuate (maní), Nueces de árbol, Leche, Huevo, Trigo, Soya, Pescado, Mariscos, Ajonjolí (sésamo) |
| Hidden names (index-aligned) | arachis oil, groundnut, mandelonas · marzipan, praline, almond paste, pesto · whey, casein, lactose, ghee · albumin, lysozyme, meringue, mayonnaise · semolina, durum, spelt, farina · edamame, tofu, soy lecithin, miso · anchovy, worcestershire sauce, surimi · prawn, scampi, krill · tahini, benne seed, halva | aceite de arachis, cacahuete, mandelonas · mazapán, praliné, pasta de almendra, pesto · suero de leche, caseína, lactosa, ghee · albúmina, lisozima, merengue, mayonesa · sémola, durum, espelta, farina · edamame, tofu, lecitina de soya, miso · anchoa, salsa inglesa, surimi · langostino, scampi, kril · tahini, semilla de benne, halva |

Unchanged ES lines that already existed (kidHelp, gotYou, penTip, penDone, dialTip, nowCall, lieTip, helpHere, drillDone, noRead, alwaysRead, lucky, skipSafe, title disclaimer) are still pending the same review.

### B. Call script: only the place name changes per level (non-medical)
EN stays "Say: my friend had an allergic reaction. We used the epinephrine. Please come to **the Dawn Trail picnic area**." on level 1;
other levels name their own fictional place (the Sunset Boardwalk, the Lantern Night Party, the Rainy Day Market, the Snow Cabin Trail,
Sunny Hill School, the birthday garden on Maple Street, the Corner Market on Pine Road, the Willow Park picnic lawn, the Harbor Lights restaurant).
ES: "Di: mi amigo tuvo una reacción alérgica. Usamos la epinefrina. Vengan **al área de picnic del sendero**." (level 1 unchanged) and the matching places. This fixes the reviewer note that the script always named the Dawn Trail.

### C. New content written in this pass (EN + ES) — needs review
- **Disclaimer** (title + How it works): "⚕️ Practice game — not medical advice. Follow your doctor's allergy action plan." / "⚕️ Juego de práctica — no es consejo médico. Sigue el plan de acción para alergias de tu médico."
- **Setup note**: "Grown-ups: pick the same allergens as your child's allergy action plan." / "Adultos: elijan los mismos alérgenos del plan de acción para alergias de su hijo."
- **9 new moments** (`OFFERS` with `th` school / party / store / picnic / rest). Lessons only restate habits already in the game (ask first, read the label every time, skip when you cannot check, your own snack is safest, shared bowls spread crumbs, tell the server):
  - Trade lunches: "Your own lunch is the safest lunch." · "Trading food can bring allergens you cannot see. Keep your own lunch." · "Grown-ups at school can help you check."
  - Class cupcakes: "Asking first keeps the party fun and safe." · "Treats can hide allergens. Always ask first." · "Bringing your own treat means you never miss out."
  - Birthday cake: "A grown-up can check the recipe or the box." · "Cake can hide allergens. Check first." · "A packed treat lets you join the fun safely."
  - Goodie bags: "Candy can have allergens too. Read the label." · "No wrapper means no label. When you cannot check, skip it." · "It is okay to wait until a grown-up can check."
  - Free sample: "Samples come from packages with labels. Read it first." · "Samples can hide allergens. Check before you taste." · "Saying no politely is a superpower."
  - New package: "Recipes can change. Read the label every time." · "A new package can have new ingredients. Read every time." · "Reading together makes everyone safer."
  - Unlabeled cookies: "When you cannot check, skip it." · "Plain-looking food can still hide allergens. Ask first." · "Asking is always the right first move."
  - Shared snack bowl: "Your own snack is the safest snack." · "Many hands in one bowl spread crumbs. Skip shared bowls." · "Grown-ups can read the label with you."
  - Free dessert: "Telling the server about your allergy is a great habit." · "Free food can still hide allergens. Ask first." · "A grown-up can talk to the kitchen for you."
- **Menu moments** (school lunch line, restaurant): pick a dish or "Ask the lunch helper what is safe for me" / "Ask my grown-up to tell the server about my allergy" (always correct). Lessons: "Good pick! A grown-up should still tell the server about your allergy." · "Good pick! The lunch helper can double-check with you." · "Telling the server about your allergy is a great habit." · "Grown-ups at school can help you check." · on a wrong pick "<Dish> has <allergens> in it."
- **Dish allergen tags** (`DISHES`; ingredients are shown to the player): Garden rice bowl (none) · Peanut noodle bowl (peanut, soy, wheat — "soy sauce (soy, wheat)") · Cheesy pasta bake (wheat, milk) · Grilled fish tacos (fish) · Shrimp fried rice (shellfish, egg, soy, wheat) · Sesame chicken (sesame, soy, wheat) · Pesto pasta (wheat, tree nut via pine nuts, milk) · Baked potato (none) · Grilled salmon plate (fish) · Fruit salad (none) · Pizza day tray (wheat, milk) · Rice and beans tray (none) · Turkey sandwich tray (wheat, egg via mayonnaise) · Fish nuggets tray (fish, wheat, egg) · PB and jelly tray (peanut, wheat) · Veggies and hummus tray (sesame) · Chicken and rice tray (none) · Yogurt and fruit tray (milk, wheat via granola). Question for the reviewer: are "none" dishes acceptable in a kids' game, given that real kitchens can add hidden ingredients? The game always lets the player choose "ask a grown-up" instead.
- **New plain-food tags** (`FOODS`, game treats them as fact): Lemon, Tomato, Cherries, Avocado, Pineapple, Cabbage, Eggplant, Fruit ice pop (none) · Pancakes (wheat, egg, milk) · Waffle (wheat, egg, milk) · Pizza slice (wheat, milk) · Croissant (wheat, milk, egg) · Apple pie (wheat, milk, egg) · Ice cream cone (milk, wheat). Prepared foods vary by recipe; the reviewer may prefer to tag them more broadly or turn them into labelled packages.
- **New packaged products** (fictional names; base ingredients carry no top-9 allergen, `labelFor()` inserts allergens/"may contain" as before): Lunchbox Crackers (rice flour, sunflower oil, salt), Apple Sauce Cups, Raisin Snack Box, Party Sprinkles, Rainbow Frosting (sugar, palm oil, water, vanilla), Fizzy Fruit Punch, Party Popcorn, Moon Oat Rings (oats, sugar, salt), Starfish Crackers (corn flour), Garden Veggie Soup, Sunrise Pancake Mix (rice flour), Crispy Rice Bites, Berry Jam, Picnic Potato Chips, Lemon Fizz, Sunny Salsa, Fruit Leather, Crunchy Croutons (corn flour), Kids Menu Juice, Dipping Sauce.
- **Sticker facts** reuse existing lessons ("Always read the label on packaged food", "\"May contain\" counts as not safe", the reaction-plan lesson, "Asking is always the right first move.") plus neutral ones ("Allergens can hide under other names on a label.").

### D. Observations for the reviewer (existing content, NOT changed)
- "Done! Now rub the spot for 10 seconds." — device-specific; some auto-injector instructions differ.
- "Lie down, legs up" — positioning advice may differ (e.g. sitting up when breathing is hard); the reviewer should confirm wording.
- "Call 911 even if you feel better" and "keep two auto-injectors nearby" — confirm.
- Symptom list in the drill sub-line is short (mouth itch, hives, swollen lip, trouble breathing): confirm it is acceptable as "examples".
- Oats (Granola bar, Moon Oat Rings) are shown as safe for wheat-allergic players unless the game inserts wheat; real oats often carry wheat cross-contact.
- Mystery treats are awarded without checking the player's list: Coconut Cloud (coconut is labelled a tree nut in some places), Sunflower Butter Cup, Oat Moon Cookie (would usually contain wheat), Honey Pear Chips (honey is not for babies under 1). Options: tag treats and only award ones that fit, or rename them.
- When a hidden name is used, the label still shows the CONTAINS line (realistic; teaches "read CONTAINS first").
- Label highlights are on by default (yellow = allergen word, pink = hidden name); "Detective mode" (highlights off) is an option for older players and grown-ups.

## Elevation pass — what changed (gameplay, UI, content)
See `docs/AUDIT.md` → "Snack Squad Safari elevation pass (2026-10-16)" for the full list with test evidence.

## Engine requests
1. Gamepad menu navigation (focus ring + A to press) for all cards — implemented locally in `padMenu()`.
2. `createInput` calls `preventDefault()` on Space for every keydown on `window`, which blocks typing spaces in text inputs; Safari stops propagation on its name field. Engine could skip events whose target is an input/textarea.
3. `results()` options for localized labels (kicker, Play again, Hub, Copied toast) and a hook to add extra content/buttons (Safari patches the returned DOM).
4. `setLook()` sky dome radius is fixed at 300 (needs `far` ≥ ~320).
