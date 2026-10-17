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
| Platform | `node test/run.js account.html test/platform.js`, `node test/run.js junk test/beta.js`, `node test/run.js admin.html test/admin.js`, `node test/run.js fit test/cloudsave.js` | Need the local Postgres (`test/db/README.md`). Restart it after a container restart: `su pgt -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgt/data -o '-p 55432 -k /tmp/pgt' -l /tmp/pgt/log start"` |
| Database (RLS, rewards, referrals) | `bash test/db/run.sh` | Plain SQL tests against the local Postgres |
| Spanish leaks | `node test/run.js index test/i18n.js` | Every title screen + settings in ES → `I18N_CLEAN` |
| Accessibility | `node test/run.js index test/a11y.js` | axe-core WCAG 2.1 A/AA serious+critical on 19 pages → `A11Y_CLEAN` |
| Pixel Pact feel budget | `node test/run.js pixelpact test/pixelpact_perf.js` | Fails if Match spends >8% frozen or >5% slowed |
| Page error stacks | `STACK=1 node test/run.js …` | |

## How game tests work
Each game exposes `window.__READY` and `window.__GAME`. Tests advance the simulation with `__GAME.update(1/60)` loops instead of waiting in real time, because software rendering is slow. They drive menus with real clicks and keys, assert on game state and take screenshots at key moments. **Always look at the screenshots** after a visual change, in landscape (1000×560) and portrait (390×844).

## What headless tests cannot tell you
- Frame rate and feel on a real phone (software WebGL is 10–50× slower and has no GPU).
- Touch latency, haptics, speech voices and audio timing on real devices.
- Phone-as-controller over the live Supabase Realtime service and real Wi-Fi/carrier NAT. The sandbox cannot reach supabase.co.
These are covered by the real-device pass (`docs/ROADMAP.md` R1).

## Known gaps
- The ES check covers title screens and settings, not every in-game string; native-speaker review is still needed.
- axe can't judge canvas/WebGL content.
- No CI service runs these tests on push. They are run by hand before every merge to `main`.
