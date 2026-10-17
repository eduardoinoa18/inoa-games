# 0004 — Card Room (Hold'em, Blackjack, Bingo, Six-Card Golf, Liar's Dice, Dominoes)

**Status:** DECIDED (direction: share infrastructure). **Recommendation:** share infrastructure, keep rules separate, build one game first, and **treat the casino-style games as a separate owner decision**.

## Shared vs per-game
- **Shared** (`engine/cardroom.js`, new): seats and turn order; the match lifecycle (lobby → deal → turns → round end → results); a bot interface (`chooseAction(state, seat)`); hidden-information views per seat; phone hands through `net.js` (each phone sees only its own cards); preset reactions; reconnect; `E.results()`.
- **Per game:** state, legal moves, scoring and bot strategy, written as pure functions with unit tests. That suits a host-authoritative design (the host validates every move, as in Drift).

## Risk the plan underrates: simulated gambling
Texas Hold'em, Blackjack and (to a lesser degree) Bingo with chips are **simulated gambling** under app-store age-rating questionnaires, even with play money. Apple's and Google's ratings and Google Play's Families policy treat simulated gambling strictly. It would likely raise the rating of the *whole app* above the family rating the hub targets, and could block "designed for families" programs. **Verify against the current official store documentation before building.** Options:
1. Build the non-casino games first (Dominoes, Six-Card Golf, Liar's Dice with dice only, Bingo without chips).
2. Ship the casino games web-only, behind an age gate, and leave them out of the store builds.
3. Skip them.

## First game
**Dominoes** (Draw and Block): popular with the owner's Dominican and Latino audience, 2–4 players, perfect for phones as private hands, simple and well-documented rules, no gambling questions. Its acceptance test: a full match against 3 bots completes in both languages, illegal moves are rejected by the host, and a phone hand stays private.
