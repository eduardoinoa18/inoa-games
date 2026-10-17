# Testing

Everything runs headless in Playwright with Chromium (pre-installed in the cloud sandbox). No test touches production services: platform tests use a local Postgres plus a mock Supabase, and party tests use a mock Realtime server.

## Commands
| What | Command | Notes |
| --- | --- | --- |
| One game | `node test/run.js <game> test/<game>.js` | Screenshots go to `test/out/<game>_*.png`. Ends with `NO_ERRORS` when the page threw nothing |
| Portrait | `W=390 H=844 node test/run.js <game> test/<game>.js` | Screenshots get a `_p` suffix |
| All games + hub | `npm run test:all` | ~60–80 min in the sandbox (software WebGL). Run in the background |
| Parallel runs | `PORT=89xx node test/run.js …` | Give each concurrent run its own port |
| Engine contract | `node test/run.js junk test/engine.js` | |
| Hub | `node test/run.js index test/index.js` | Tiles, daily challenge, EN/ES, hero card, hero picker, **shelf categories + search** |
| Offline / PWA | `SW=1 node test/run.js index test/pwa.js` | |
| Multiplayer | `npm run test:party` | 9 suites: pad, hub, drift, trivia, games, pact, approve, relay, runner (mock Realtime) |
| Platform | `node test/run.js junk test/platform.js`, `test/beta.js`, `test/admin.js` | Need the local Postgres (`test/db/README.md`). Restart it after a container restart: `su pgt -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgt/data -o '-p 55432 -k /tmp/pgt' -l /tmp/pgt/log start"` |
| Database (RLS, rewards, referrals) | `bash test/db/run.sh` | Plain SQL tests against the local Postgres |
| Page error stacks | `STACK=1 node test/run.js …` | |

## How game tests work
Each game exposes `window.__READY` and `window.__GAME`. Tests advance the simulation with `__GAME.update(1/60)` loops instead of waiting in real time, because software rendering is slow. They drive menus with real clicks and keys, assert on game state and take screenshots at key moments. **Always look at the screenshots** after a visual change, in landscape (1000×560) and portrait (390×844).

## What headless tests cannot tell you
- Frame rate and feel on a real phone (software WebGL is 10–50× slower and has no GPU).
- Touch latency, haptics, speech voices and audio timing on real devices.
- Phone-as-controller over the live Supabase Realtime service and real Wi-Fi/carrier NAT. The sandbox cannot reach supabase.co.
These are covered by the real-device pass (`docs/ROADMAP.md` R1).

## Known gaps
- No automated EN/ES completeness check (roadmap R4).
- No accessibility scanner in CI (roadmap R5).
- No CI service runs these tests on push. They are run by hand before every merge to `main`.
