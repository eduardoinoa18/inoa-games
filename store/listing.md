# Inoa Games: store listing (free beta)

Copy for App Store Connect and the Google Play Console. Character counts were checked; keep them under the limits if you edit. Items marked **[OWNER]** are decisions or facts only the owner can supply. Items marked **[RE-CHECK]** are store rules that change often: confirm them in the console on the day you submit.

`<site>` means the production domain once Vercel is set up, e.g. `https://games.inoaservices.com`.

| Field | Value |
| --- | --- |
| Support URL | `<site>/` (support e-mail on the page) **[OWNER: support e-mail, also needed in privacy.html]** |
| Marketing URL (optional) | `<site>/` |
| Privacy policy URL (required by both stores) | `<site>/privacy.html` (a draft with `[OWNER TO CONFIRM]` items: finish it before submitting) |
| Terms (optional) | `<site>/terms.html` |
| Account deletion URL (Google Play Data safety requires a web link) | `<site>/account.html` (sign in, then "Delete account") |
| Copyright | `2026 Inoa Services` |
| Bundle ID / package | `com.inoaservices.games` (**[OWNER]** may change it before the first upload; it is permanent after that) |
| Price | Free. No in-app purchases, no ads, no subscriptions in this build |

---

## English (primary: en-US)

**App name (30 max):** `Inoa Games` (10). If the name is taken: `Inoa Games: Play Together` (25).

**Subtitle (iOS, 30 max):** `Play together, one hero` (23)

**Promotional text (iOS, 170 max, can be changed without a review):**
> Free beta: every game is unlocked. Race karts, run the boardwalk, brew tea and paint the plaza, alone or with the whole couch. Tell us what you think in the app!

**Short description (Google Play, 80 max):**
> 13 friendly games for solo play or the whole couch. One hero in every game. (75)

**Full description (4000 max; same text on both stores):**

```
Inoa Games is a shelf of 13 friendly games in one app. Make a hero once, then take them everywhere: every round you finish earns XP and coins for the same hero.

PLAY ALONE OR TOGETHER
• Island Drift: kart racing with drift turbos, items, two tracks and a time trial.
• Tide Runner: a boardwalk runner with a daily course and a ghost of your best run.
• Tide Lines: a 4-vs-4 paint battle. Cover the plaza in your team's colour.
• Pixel Pact: Depths: a co-op dungeon run with four classes, helpful AI allies and a boss.
• Pixel Pact: a 2D co-op adventure and brawler for up to 4 players on one screen.
• Pact Trivia: a 3D game show with 160+ questions in English and Spanish, plus a kids mode that never takes points away.
• Draw the Pact: pass-and-play drawing and guessing, Speed Sketch and Telephone.
• Fail Tray: wobbly physics courses with slow-motion replays and hot-seat turns.

RELAX
• Brew and Bloom: grow herbs in a greenhouse and brew tea for your café guests.
• Perfect Fit: calm organising puzzles with a Zen mode.
• Junkyard to Jewel: wash, sand, paint and polish old cars back to shiny.
• Driftwood Builders: gather, build and sail on your own little island.

LEARN
• Snack Squad Safari: practise reading food labels for allergens with a buddy pet. Labels are read aloud in English and Spanish.

MADE FOR EVERYONE
• Touch, keyboard and game controllers are all supported.
• English and Spanish, with key instructions read aloud.
• Plays offline once installed. No ads and no chat with strangers.
• Gentle by default, with harder modes for experienced players.

FREE BETA
Everything is free while we test with players. There is nothing to buy. Use the Feedback button to tell us what to fix or build next.

An account is optional. Without one, your hero and progress stay on this device. With a free account, your hero follows you to the website and other devices. You can delete the account at any time in the app.

Snack Squad Safari is a practice game, not medical advice. Always follow your doctor's allergy plan.
```

**Keywords (iOS, 100 max, comma separated, no spaces needed):**
`kart,racing,runner,party,trivia,family,cozy,cafe,co-op,couch,offline,puzzle,drawing,arcade,casual` (96)
(Apple 1.3 / 2.3.7: outside the Kids Category, do not use "kids"/"for children" in the metadata, and do not name other apps or brands.)

**What's new (first build):** `First beta build. Thanks for testing! Use the Feedback button to tell us what you think.`

**TestFlight "What to test":** `Play any game for a round or two on your phone or tablet: does it load quickly, run smoothly and feel good with touch? Try a game controller if you have one. Send feedback from the hub.`

---

## Español (es-MX and es-ES; Play: es-419 and es-ES)

**Nombre:** `Inoa Games`

**Subtítulo (30 máx.):** `Juega en familia, un héroe` (26)

**Texto promocional:**
> Beta gratis: todos los juegos desbloqueados. Corre en karts, recorre el malecón, prepara té y pinta la plaza, solo o con toda la familia. ¡Cuéntanos qué piensas desde la app!

**Descripción breve (Play, 80 máx.):**
> 13 juegos amables para jugar solo o en familia. Un héroe en todos los juegos. (77)

**Descripción completa:**

```
Inoa Games es un estante con 13 juegos amables en una sola app. Crea tu héroe una vez y llévalo a todas partes: cada ronda que terminas le da XP y monedas al mismo héroe.

JUEGA SOLO O ACOMPAÑADO
• Island Drift: carreras de karts con derrapes turbo, objetos, dos pistas y contrarreloj.
• Tide Runner: carrera por el malecón con un recorrido diario y el fantasma de tu mejor intento.
• Tide Lines: batalla de pintura de 4 contra 4. Cubre la plaza con el color de tu equipo.
• Pixel Pact: Depths: mazmorra cooperativa con cuatro clases, aliados con IA y un jefe final.
• Pixel Pact: aventura cooperativa en 2D y modo pelea para hasta 4 jugadores en una pantalla.
• Pact Trivia: concurso en 3D con más de 160 preguntas en español e inglés, con un modo infantil que nunca resta puntos.
• Draw the Pact: dibuja y adivina pasando el teléfono, Speed Sketch y Teléfono descompuesto.
• Fail Tray: recorridos con física tambaleante, repeticiones en cámara lenta y turnos por relevos.

RELÁJATE
• Brew and Bloom: cultiva hierbas en el invernadero y prepara té para los clientes de tu café.
• Perfect Fit: rompecabezas tranquilos de organizar, con modo Zen.
• Junkyard to Jewel: lava, lija, pinta y pule autos viejos hasta dejarlos brillantes.
• Driftwood Builders: recolecta, construye y navega en tu propia islita.

APRENDE
• Snack Squad Safari: practica leer etiquetas de alimentos para encontrar alérgenos, con una mascota compañera. Las etiquetas se leen en voz alta en español e inglés.

HECHO PARA TODOS
• Pantalla táctil, teclado y controles de juego.
• Español e inglés, con las instrucciones clave leídas en voz alta.
• Funciona sin conexión una vez instalada. Sin anuncios y sin chat con desconocidos.
• Amable por defecto, con modos más difíciles para jugadores con experiencia.

BETA GRATIS
Todo es gratis mientras probamos con jugadores. No hay nada que comprar. Usa el botón de Opinión para decirnos qué arreglar o qué crear después.

La cuenta es opcional. Sin cuenta, tu héroe y tu progreso se quedan en este dispositivo. Con una cuenta gratis, tu héroe te acompaña en la web y en otros dispositivos. Puedes borrar la cuenta cuando quieras desde la app.

Snack Squad Safari es un juego de práctica, no un consejo médico. Sigue siempre el plan de alergias de tu médico.
```

**Palabras clave (iOS, 100 máx.):**
`carreras,karts,familia,fiesta,trivia,cooperativo,offline,puzzle,dibujo,cafe,casual,arcade,juegos` (96)

**Novedades:** `Primera versión beta. ¡Gracias por probarla! Usa el botón de Opinión para contarnos qué piensas.`

---

## Category

- **Apple:** primary **Games**, subcategory **Family**; second subcategory **Casual**.
- **Google Play:** **Casual** (or Family / Educational is not needed). Tags: Casual, Racing, Party, Trivia.

**Why NOT the Apple Kids Category (or Google "Designed for Families" / child target audience) for the beta:**
1. The Kids Category is permanent for the app's life on the store, and it bans third-party analytics/ads and **requires a parental gate** in front of any link out of the app, any purchase and any request for personal data (Apple 1.3 / 5.1.4). Our sign-up, feedback form and links to the website do not have a parental gate yet.
2. Kids apps cannot send personal data to third parties. Our accounts use Supabase (a processor) and collect e-mail addresses, which needs a COPPA review by counsel first (`docs/PLATFORM_ARCHITECTURE.md` §9b).
3. The shelf mixes all-ages games with adult-depth ones (Depths combat, hard modes). A general-audience **Games › Family** listing with an honest age rating describes it better.
Revisit after the counsel review: a separate kids-only app could be built from the same engine later.

---

## Age rating answers

Apple uses its age-rating questionnaire (the system updated in 2025 has 4+, 9+, 13+, 16+ and 18+ tiers). Google uses the IARC questionnaire, which produces ESRB, PEGI and other ratings. **[RE-CHECK]** the exact wording on the day you submit. Truthful answers for this build:

| Topic | Answer | Where it shows up |
| --- | --- | --- |
| Cartoon or fantasy violence | **Infrequent / mild** | Depths (swords and magic against cartoon monsters, no blood), Pixel Pact brawler, Tide Lines paint "splats" |
| Realistic violence, gore, horror/fear | None | |
| Sexual content, nudity, profanity, crude humour | None | |
| Alcohol, tobacco, drugs | None. The café serves tea | |
| Simulated gambling, real-money gambling, contests | None. Coins are earned in play and cannot be bought | |
| Loot boxes / paid random items | None | |
| Medical / treatment information | Snack Squad Safari teaches reading allergen labels; not diagnosis or treatment. Answer "None" or "Infrequent/mild medical information" to match the current wording, and keep the "not medical advice" line in the description **[RE-CHECK]** | |
| User-generated content shared with others / chat | **No.** Drawing games are local pass-and-play; feedback goes only to the developer and is never shown to other users | |
| Unrestricted web access | **No.** The app links only to its own website pages (account and privacy); no in-app browser | |
| Location sharing | No | |
| Digital purchases | No | |
| Ads | No | |
| Made for kids | No (general audience, see above) | |

Expected result: **Apple 9+** (mild fantasy violence), **ESRB E / E10+, PEGI 7**. Google Play target audience: **13+** for the beta (see `docs/APP_STORES.md` §5).

---

## Apple App Privacy ("nutrition label")

Derived from the code (`engine/platform.js`, `engine/feedback.js`, `supabase/migrations/*.sql`). Accounts are **off** in the current build (`platform.json` `enabled:false`). Answer for the build you actually upload. If accounts are on, use the answers below. If they are off, the only data that leaves the device is the optional feedback form.

**Tracking:** **No.** No data is used to track people across other companies' apps or websites. No ad SDKs, no IDFA/AAID, no third-party analytics.

| Data type (Apple) | Collected? | Linked to user? | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Contact Info › Email Address | Yes (only with an account) | Yes | App Functionality (account, sign-in, verification, password reset) | Supabase Auth |
| Contact Info › Name | **Yes**, as "Other user content" or "Name"; it is a display name/nickname, 1–24 characters, no real name required | Yes | App Functionality | `ig_profiles.display_name` |
| User Content › Other User Content | Yes: hero look (model/colour) and language | Yes | App Functionality | `ig_profiles.hero`, `lang` |
| User Content › Customer Support / Other | Yes: optional feedback text, rating 1–5, kind | Linked **only if signed in** (guests: not linked) | App Functionality / Product improvement ("Other purposes") | `ig_feedback`, ≤1000 chars, context = app version, platform, language, screen size |
| Usage Data › Product Interaction | Yes: game started, round finished, scores, XP/coins, achievements | Yes | Analytics (first-party only), App Functionality (progress, best scores) | `ig_events`, `ig_game_progress`, `ig_session_rounds` |
| Identifiers › User ID | Yes: account UUID | Yes | App Functionality | Supabase user id. No device ID |
| Purchases | **No** (no purchases in the app) | | | Web-only Stripe billing is not in the app |
| Location, Health, Financial, Contacts, Browsing/Search history, Sensitive info, Diagnostics, Photos, Audio | No | | | Speech uses the system text-to-speech, which runs on the device. No microphone or camera use |

Data deletion: in-app (Account → Delete account) calls `api/account-delete`, which deletes the auth user and profile and unlinks events.

## Google Play Data safety

| Question | Answer |
| --- | --- |
| Does the app collect or share user data? | **Collects:** yes (with an account, or when feedback is sent). **Shares** with third parties: **No** (Supabase and Vercel are service providers acting for us, which Google does not count as "sharing") |
| Is all data encrypted in transit? | **Yes** (HTTPS only; `allowMixedContent:false`) |
| Can users request deletion? | **Yes**, in the app and at `<site>/account.html` |
| Personal info › Email address | Collected, required for an account (accounts themselves are optional), purpose: Account management |
| Personal info › Name | Collected (display name), optional, purpose: App functionality, Account management |
| Personal info › User IDs | Collected (account id), purpose: App functionality, Account management |
| App activity › App interactions | Collected (game starts/rounds/scores), purpose: App functionality, Analytics |
| App activity › Other user-generated content | Collected (feedback text), optional, purpose: App functionality / Developer communications |
| App info and performance | Feedback context only (app version, platform, screen size), optional, purpose: Analytics |
| Device or other IDs, Location, Financial, Health, Messages, Photos, Audio, Files, Calendar, Contacts, Web history | Not collected |
| Ads / Advertising ID | No ads. Declare "No" on the Advertising ID form; the app does not request the `AD_ID` permission |
| Independent security review | No |
| Families / target audience | 13+ for the beta (see docs/APP_STORES.md §5) |

> **Pending: party rooms.** `engine/net.js` (WebRTC party rooms/phone-as-controller, added in parallel work) connects through the public PeerJS signaling server, which sees IP addresses, and peers see each other's IPs. If rooms ship in the app build, update the answers above: Apple "Other data / IP address processed by a third party" and Google "Shared: device or other IDs/IP with a service provider" **[RE-CHECK]**, or self-host signaling first. See docs/APP_STORES.md §4.
