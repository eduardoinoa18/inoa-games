# Decision records

One file per significant product or architecture decision. Status values: **DECIDED** (approved by the owner), **PROPOSED** (needs validation or approval), **RECOMMENDED** (our best-supported option, waiting on the owner), **FUTURE**, **BLOCKED**. Nothing destructive happens until a record says DECIDED and has a rollback plan.

| # | Decision | Status | Recommendation | Reversible? | Owner action needed |
| --- | --- | --- | --- | --- | --- |
| [0001](0001-island-drift-retirement.md) | Retire Island Drift (racing) | PROPOSED | **Do not retire.** Keep it; its online-race code is the template for every future online mode | Yes, retirement would be reversible (staged) | Confirm: keep |
| [0002](0002-builders-homestead-merge.md) | Merge Driftwood Builders into the flagship homestead | PROPOSED | **Defer.** Keep Builders standalone; extract a shared build module only when the flagship needs one | Yes | None now |
| [0003](0003-flagship-from-depths.md) | Flagship "Hometown & the Depths" grows out of Depths | DECIDED (direction) | Stay on the current web stack (three.js + `inoa3d.js`), no Unity. Start with a feasibility spike, then a town MVP | Yes: Depths stays playable throughout | Approve the spike |
| [0004](0004-card-room.md) | Shared Card Room for 6 games | DECIDED (direction) | Share the lobby, seats, bots, lifecycle and UI; keep each game's rules separate. **Poker and Blackjack carry app-store age-rating and kids-policy risk**: start with Dominoes or Six-Card Golf | Yes | Choose the first game. Decide on the play-money casino games |
| [0005](0005-kids-world-shell.md) | Shared Kids World shell | DECIDED (direction) | Shared presentation, navigation, voice, safety and parent gate; each game keeps its own mechanic. Build it alongside the first new kids' game, not before | Yes | None now |
| [0006](0006-monetization-direction.md) | Monetization: Premium subscription vs cosmetics-only | **Needs owner decision** | The two plans conflict (see the file). Nothing changes during the free beta either way | Yes: billing is off | Pick a direction before paid plans start |
| [0007](0007-hub-categories.md) | Category-based hub | DECIDED (direction) | 6 visible categories now ("Open World" appears once the flagship exists); rename "Action & Fighting" to "Action & Racing" | Yes | Confirm the rename |
