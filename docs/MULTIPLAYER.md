# Multiplayer: phones as controllers + online play

Everything runs on the static site. There is no game server: devices talk to each other directly over
**WebRTC data channels** using **PeerJS** (loaded from jsDelivr). The free PeerJS cloud signaling server
(`0.peerjs.com`) only introduces the devices; after that, game data flows device to device.

## How players use it
| Who | What they do |
| --- | --- |
| Host (TV, laptop, tablet) | Hub → **Party** section → **📱 Start a party**, or any game's title screen → **📱 Use phones as controllers**. A QR code + 4-letter code appear. The room follows the host from game to game (it is kept in `sessionStorage` and the host re-claims the same peer id on every page). |
| Phone nearby | Scan the QR (opens `pad.html?r=CODE`) or open the site → Party → type the code. The phone becomes a controller (stick + A/B/C/D, vibration, wake lock), a buzzer, or a private answer screen, depending on the game. Reconnects by itself when the host switches games. |
| Friend far away | Host shares the **online link** from the party panel. Island Drift: `games/drift.html?join=CODE` = their own 3D race on their own screen. Trivia/Draw: `pad.html?join=CODE` = questions + answers on their phone. |

## What each game does with phones
| Game | Phones |
| --- | --- |
| Every 3D game (engine) | Any phone drives player 1 (`createInput` merges it). Phone A/stick also navigate menus (focus ring), ⏸ pauses. |
| Island Drift | Phone 1 steers P1 on the big screen. **Online race**: up to 5 friends race on their own screens (`?join=CODE`). Host-authoritative: guests send inputs, the host simulates every kart and broadcasts 20 Hz snapshots; guests interpolate + dead-reckon. Each guest gets their own results/XP. |
| Pact Trivia | Each phone is a player (up to 4): question + choices shown on the phone, BUZZ button, private answers, wagers and secret final answers. Works for remote friends too. |
| Pixel Pact: Depths | Phone 1 = P1, phones 2–4 take over AI allies as P2–P4 (custom button icons pushed to the phone). |
| Tide Lines | Phone 1 = you, phones 2–4 join your team, phones 5–8 the other team (4v4). |
| Draw the Pact (Party mode) | Each phone is a player: the drawer gets the secret word on their phone, everyone else guesses from 4 options on theirs (first right answer scores). |
| Pixel Pact (2D) | Each phone is its own input source (`net1`…`net8`): press A in the lobby to join. A jump · B attack · C special · D dodge · C+D ultimate. |
| Fail Tray, Tide Runner, Perfect Fit, Junkyard, Brew, Builders | Phone acts as player 1's controller (hot-seat friendly in Fail Tray). |
| Snack Squad Safari | Not wired yet (own embedded engine; migrate to `engine/` first). |

## Code
- `engine/net.js` — rooms, slots, layouts, QR, party widget/panel. Imported by `engine/inoa3d.js` (re-exported as `E.NET` and `E.net`), by `pad.html`, by the hub (`hub-src/party.js`) and by `games/pixelpact.html`.
  - Host: `host(code?)`, `resume()`, `endParty()`, `broadcast(msg, kind?)`, `send(slot, msg)`, `setLayout(layout, slot?)`, `setOnline({page,label})`, `rumble(slot, ms)`.
  - Guest: `join(code, {kind:'pad'|'player', name})` (resolves after the host's welcome, auto-reconnects), `sendInput(state)`, `sendMsg(msg)`.
  - State: `net.role`, `net.code`, `net.status`, `net.players[{slot,id,kind,name,color,connected,input}]`, `net.pads(kind?)`, `net.pad(slot)` (input zeroed if the phone goes quiet > 1.5 s), `net.joinUrl`, `net.onlineUrl(page)`.
  - Events (`net.on`): `status, change, join, leave, input, msg, welcome, layout, online, error`.
  - UI: `partyWidget({hint, online})` (floating 📱 chip; `E.shell()` adds it automatically, pass `party:false` to hide), `partyPanel({hint, online})`, `qrSvg(text)`.
- Phone layouts (`setLayout`): `{type:'gamepad', labels:{A..D}, buttons:['A','B','C','D']}`, `{type:'buzzer', label, question, choices}`, `{type:'choices', question, choices, out, locked}`, `{type:'text', text}`. Phones send `{t:'in', s:{x,y,a,b,c,d,pause}}` (on change + 200 ms heartbeat), `{t:'buzz'}`, `{t:'choice', i}`.
- Engine input: `E.createInput({pads:'any'|'first'|'separate'})`; `input.pad(slot)` returns `{x,y,a,b,c,d,pause,aPressed…}` once per frame per slot.
- Self-hosting signaling or adding TURN: set `window.INOA_NET = {host, port, path, secure, config:{iceServers:[…]}}` before the engine loads, or `localStorage['inoa.net']` (same JSON).

## Tests
`npm run test:party` runs `test/party.js` with a local PeerServer (`peer` package) and several browser
pages (host + phones + online guest): `party_pad` (QR join, menu nav, P1 input, pause, room survives
navigation), `party_drift` (online race to the finish), `party_trivia`, `party_games` (Depths, Tide
Lines, Draw), `party_pact`.

## Limits and upgrade path
- No TURN relay is configured: on a few strict networks (some schools/offices, symmetric NAT) devices
  cannot connect directly. Home Wi-Fi + mobile data generally work. Fix: add a TURN service (e.g. a paid
  TURN provider or a self-hosted coturn) via `INOA_NET.config.iceServers`.
- The PeerJS cloud signaling server is free and shared; for launch, self-host `peer` (any Node host)
  or move rooms to a Cloudflare Worker + Durable Object (also enables room browsing, reconnect tokens,
  server-side validation).
- Host tab must stay in front: browsers slow down hidden tabs, which pauses the host's simulation.
- All ages: there is no chat; names are 14 characters max and only shown inside the room.
