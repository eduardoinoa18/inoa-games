# 0001 — Retire Island Drift?

**Status:** PROPOSED (by the v4 master plan). **Recommendation:** do not retire. Keep and maintain it.

## Evidence (repository, 2026-10-17)
- `games/drift.html` is the engine's **reference game**: `CLAUDE.md` and `docs/ENGINE.md` hold it up as the quality bar other games copy.
- Its elevation pass is finished (`docs/AUDIT.md` → "Drift elevation pass", 2026-10-15). It has 4 tracks including a figure-eight bridge, 5 AI rivals with personalities, items, drift turbos, the Island Cup, time trial with ghost, and Easy/Normal/Hard. Its test passes (see the Phase 0 baseline in `docs/AUDIT.md`).
- It is the **only game with online play on separate screens**: host-authoritative races over `engine/net.js`. That code is the template for online Tide Lines, Depths and Card Room rooms (`docs/MULTIPLAYER.md`).
- It is the only racing game in the hub; Tide Runner is a runner. Retiring it would remove a genre kids ask for.
- Traffic and engagement: **not measurable yet**. The admin KPIs record starts per game for signed-in players only, and the beta has very few users. Revisit with real data after the beta.

## Options
| Option | Cost | Value | Verdict |
| --- | --- | --- | --- |
| 1. Retain + maintain | Low: fix bugs from tester feedback, real-phone tuning | Keeps a polished game, a genre and the online template | **Recommended** |
| 2. Reduce scope | Unnecessary: it is already a small, complete game | — | No |
| 3. Retire | Low engineering cost, but loses the online-race reference and a finished game | Frees almost no effort, since it is not in active development | No |

## If the owner still wants to retire it later (staged, reversible)
1. Remove the tile from `hub-src/hub.js` and rebuild the hub. Leave `games/drift.html` reachable by URL.
2. Leave it hidden for one release and watch for errors and feedback.
3. Replace the page with a friendly "this game is resting" page that links back to the hub. Keep the code in git history and do not delete its pack assets that other games share.
**Rollback:** revert the hub commit (one `git revert`).
