# Multiplayer: phones as controllers + online play

Everything runs on the static site plus the project's **Supabase Realtime** (`engine/rtc.js`, since 2026-10-15; before
that the free PeerJS cloud server, which phones often could not reach). Realtime introduces the devices (room = channel,
presence = who is in it) and a connection opens over the Realtime **relay** at once; it then upgrades to a direct
**WebRTC data channel** when the network allows (same Wi-Fi: a few ms; `net.link === 'direct'`, ⚡ on the phone). If a
direct link never forms (mobile data, isolating Wi-Fi), play continues over the relay (☁, ~50–150 ms, stick input capped
at ~16 Hz to stay inside the free plan's message rate). Config comes from `platform.json` (`supabaseUrl`, `realtimeKey`).

## How players use it
| Who | What they do |
| --- | --- |
| Host (TV, laptop, tablet) | Hub → **Party** section → **📱 Start a party**, or any game's title screen → **📱 Use phones as controllers**. A QR code + 4-letter code appear. The room follows the host from game to game (it is kept in `sessionStorage` and the host re-claims the same peer id on every page). |
| Phone nearby | Scan the QR (opens `pad.html?r=CODE`) or open the site → Party → type the code. The phone becomes a controller (stick + A/B/C/D, vibration, wake lock), a buzzer, or a private answer screen, depending on the game. Reconnects by itself when the host switches games. |
| Friend far away | Host shares the **online link** from the party panel. Island Drift: `games/drift.html?join=CODE` = their own 3D race on their own screen. Dominoes / Six-Card Golf: `games/dominoes.html?join=CODE` / `games/golf.html?join=CODE` = a seat at the host's table on their own screen. Trivia/Draw: `pad.html?join=CODE` = questions + answers on their phone. |

## What each game does with phones
| Game | Phones |
| --- | --- |
| Every 3D game (engine) | Any phone drives player 1 (`createInput` merges it). Phone A/stick also navigate menus (focus ring), ⏸ pauses. |
| Island Drift | Phone 1 steers P1 on the big screen. **Online race**: up to 5 friends race on their own screens (`?join=CODE`). Host-authoritative: guests send inputs, the host simulates every kart and broadcasts 20 Hz snapshots; guests interpolate + dead-reckon. Each guest gets their own results/XP. |
| Pact Trivia | Each phone is a player (up to 4): question + choices shown on the phone, BUZZ button, private answers, wagers and secret final answers. Works for remote friends too. |
| Pixel Pact: Depths | Phone 1 = P1, phones 2–4 take over AI allies as P2–P4 (custom button icons pushed to the phone). |
| Tide Lines | Phone 1 = you, phones 2–4 join your team, phones 5–8 the other team (4v4). |
| Dominoes | Each phone is a seat with a **private hand** (`hand` layout): only its own tiles, tap a tile to play it (◀/▶ when it fits both ends), Draw/Pass buttons. The host checks every move and rejects tiles that don't fit or moves out of turn (the phone vibrates and shows why). A phone that drops for 12 s on its turn gets a bot stand-in. Covered by `test/party_dominoes.js` |
| Dominoes / Six-Card Golf online | Friends far away open the online link and play at the host's table on their own screen (up to 3, seated after local players and phones; bots fill the rest). The host's match is the only real one: after every deal/move/round it sends each online seat its own copy of the state with everything that seat may not see removed (`redact` in the rules files: other hands, the boneyard, the stock order, face-down cards, another player's stock draw). The guest page runs the same table code on that copy, sees the table from its own seat, refuses moves out of turn on the spot, and the host re-checks every move with `act()` (a forged move is refused and the guest is told why). Away 12 s on their turn → bot stand-in; a guest that reconnects gets the table again. Each guest gets its own results/XP. Covered by `test/party_dominoes_online.js`, `test/party_golf_online.js` and the rules tests (60 + 40 simulated online rounds with leak checks) |
| Six-Card Golf | Each phone is a seat with its **own six cards** (`cards` layout): face-down cards as backs, the stock + top discard, the card you drew (only on your phone), Discard it / Back buttons, hint deltas when hints are on. The host checks every move (out of turn, flipping a face-up card, swapping before drawing are rejected with the reason on the phone). Away 12 s on your turn → a bot stand-in. Covered by `test/party_golf.js` |
| Draw the Pact (Party mode) | Each phone is a player: the drawer gets the secret word on their phone, everyone else guesses from 4 options on theirs (first right answer scores). |
| Pixel Pact (2D) | Each phone is its own input source (`net1`…`net8`): press A in the lobby to join. A jump · B attack · C special · D dodge · C+D ultimate. |
| Fail Tray, Tide Runner, Perfect Fit, Junkyard, Brew, Builders | Phone acts as player 1's controller (hot-seat friendly in Fail Tray). |
| Snack Squad Safari | Phone acts as player 1's controller (stick = lanes, A = read label, B = hold the Scanner; A/stick also move through the cards). Party chip on landscape screens. |

## Code
- `engine/net.js` — rooms, slots, layouts, QR, party widget/panel. Imported by `engine/inoa3d.js` (re-exported as `E.NET` and `E.net`), by `pad.html`, by the hub (`hub-src/party.js`) and by `games/pixelpact.html`.
  - Host: `host(code?)`, `resume()`, `endParty()`, `broadcast(msg, kind?)`, `send(slot, msg)`, `setLayout(layout, slot?)`, `setOnline({page,label})`, `rumble(slot, ms)`.
  - Guest: `join(code, {kind:'pad'|'player', name})` (resolves after the host's welcome, auto-reconnects), `sendInput(state)`, `sendMsg(msg)`.
  - State: `net.role`, `net.code`, `net.status`, `net.players[{slot,id,kind,name,color,connected,input}]`, `net.pads(kind?)`, `net.pad(slot)` (input zeroed if the phone goes quiet > 1.5 s), `net.joinUrl`, `net.onlineUrl(page)`.
  - Events (`net.on`): `status, change, join, leave, input, msg, welcome, layout, online, error`.
  - UI: `partyWidget({hint, online})` (floating 📱 chip; `E.shell()` adds it automatically, pass `party:false` to hide), `partyPanel({hint, online})`, `qrSvg(text)`.
- Phone layouts (`setLayout`): `{type:'gamepad', labels:{A..D}, buttons:['A','B','C','D']}`, `{type:'buzzer', label, question, choices}`, `{type:'choices', question, choices, out, locked}`, `{type:'text', text}`, `{type:'hand', title, note, warn, tiles:[[a,b]…] | labels:[…], ok:[bool]|null, picked, actions:[label…]}` (Card Room private hand; dominoes draw pips), `{type:'cards', title, note, warn, cards:[{r,s}|{back:true}], badges, ok, picked, piles:[{label, card, ok, empty}], held:{label, card}, actions, lang}` (Card Room card grid; faces from `engine/cards.js`). Phones send `{t:'in', s:{x,y,a,b,c,d,pause}}` (on change + 200 ms heartbeat), `{t:'buzz'}`, `{t:'choice', i}` (also a tile/card in a `hand` layout), `{t:'act', i}` (a `hand`/`cards` action button), `{t:'pile', i}` (a `cards` pile).
- Engine input: `E.createInput({pads:'any'|'first'|'separate'})`; `input.pad(slot)` returns `{x,y,a,b,c,d,pause,aPressed…}` once per frame per slot.
- Override (tests / another project): `window.INOA_NET = {realtimeUrl, apikey, config:{iceServers:[…]}}` before the engine loads, or `localStorage['inoa.net']` (same JSON).

## Online rooms on separate screens (`engine/room.js`, roadmap R7, 2026-10-19)
One helper for every host-authoritative online mode, built from Island Drift's race code (Drift now runs on it with the same
messages). Messages carry a per-game prefix: `<p>-start`, `<p>` (snapshots), `<p>-lobby`, `<p>-<kind>`.
- Host: `E.ROOM.hostRoom({prefix, online:{page,label}, rate})` → `players`, `input(slot)`, `start(data)`, `snapshot(dt, build)` (real-time games, `rate` Hz), `send(slot, kind, data)`, `broadcast(kind, data)`, `lobby()`, `on(kind, (player, msg) => …)`, `onJoin`, `onLeave`, `stop()`. It also advertises the own-screen page to phones (`setOnline`).
- Guest: `E.ROOM.guestRoom({prefix, code, L, game, help, words, name, on:{start, snap, lobby, busy, <kind>}, onEnd})` → `join()`, `sendInput(state)`, `act(kind, data)`, `wait(html)` (the waiting screen: joining, waiting for the host, reconnecting, host went back to the menu, party ended), `close()`.
- Turn-based tables: `engine/cardroom.js` `onlineHost(room, match)` (host: sends redacted views, routes `act` to `match.act(seat, move, 'online')`, answers refusals with `rej`) and `mirrorMatch(game, {seats, opts, seat, send})` (guest: same surface as `createMatch`, so the table code runs unchanged). A rules module needs `redact(state, seat)`.
- Prefixes in use: `dr` (Island Drift), `dm` (Dominoes), `gf` (Six-Card Golf), `tl` (Tide Lines: guests take a painter on the host's team first; the host replays every paint stroke to guests in order and sends the whole floor every 2 s, so the turf count matches).

## Tests
`npm run test:party` runs `test/party.js` with a local Realtime look-alike (`test/party/mock-realtime.js`) and several browser
pages (host + phones + online guest): `party_pad` (QR join, menu nav, P1 input, pause, room survives
navigation), `party_drift` (online race to the finish), `party_trivia`, `party_games` (Depths, Tide
Lines, Draw), `party_pact`, `party_dominoes` (private hands, illegal/out-of-turn moves rejected), `party_golf` (card grids per phone, drawn card private, illegal/out-of-turn moves rejected), `party_dominoes_online` + `party_golf_online` (two guests on their own screens + a bot: no hidden cards on a guest page, out-of-turn refused on the guest, forged move refused by the host, match to the end with results on every guest).

## Limits and upgrade path
- TURN: PeerJS's free relay (`turn:eu-0/us-0.turn.peerjs.com`) is configured (2026-10-15; before that only STUN was set, so phones on mobile data or isolating Wi-Fi could not join). It is shared and best-effort; for launch use a dedicated TURN service. Previously: no TURN relay was configured: on a few strict networks (some schools/offices, symmetric NAT) devices
  cannot connect directly. Home Wi-Fi + mobile data generally work. Fix: add a TURN service (e.g. a paid
  TURN provider or a self-hosted coturn) via `INOA_NET.config.iceServers`.
- The PeerJS cloud signaling server is free and shared; for launch, self-host `peer` (any Node host)
  or move rooms to a Cloudflare Worker + Durable Object (also enables room browsing, reconnect tokens,
  server-side validation).
- Host tab must stay in front: browsers slow down hidden tabs, which pauses the host's simulation.
- All ages: every new phone must be approved on the big screen (Allow/Deny; approved phones rejoin silently when the host changes games; a denied phone stops trying). There is no chat; names are 14 characters max and only shown inside the room.

## Joining
Phones join by scanning the QR with the camera app, by **📷 Scan QR code** on `pad.html` (in-app scanner: the phone's
BarcodeDetector, else jsQR), from the hub's Party section (📷 Scan), or by typing the 4 letters. Every new phone needs
**Allow** on the big screen.

## Controller orientation (2026-10-17)
- **Gamepad layout: sideways.** On Android Chrome the pad enters fullscreen on the first tap and locks to landscape. When the page is still upright (iPhone, which can't lock, or rotation lock on), the play screen turns 90° (`body.rot`) so the phone is simply held sideways. The stick maps the turned axes (screen-down = stick-right).
- **Buzzer / choices / text: upright.**
- **↻ in the pad's top bar** flips between sideways and upright. The choice is remembered per phone (`inoa.pad.orient`).
- **A game can ask** with `layout.orient: 'sideways' | 'upright'` in the layout it sends. Otherwise the layout type decides.
- Covered by `test/party_pad.js` (turned on an upright phone, stick direction, buzzer upright, ↻ flips).
