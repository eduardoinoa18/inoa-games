# 0002 — Merge Driftwood Builders into the flagship homestead?

**Status:** PROPOSED. **Recommendation:** defer. Builders stays a complete standalone game. When the flagship reaches its homestead phase, extract a **shared build module** from Builders rather than merging the two games.

## Why not merge now
- The flagship does not exist yet (0003). A merge has nothing to merge into.
- Builders was just elevated (21 quests, 3 islands, islanders, postcards, share codes, v1→v2 save migration). It is finished and enjoyable on its own.
- The pacing differs: Builders is a calm, free-form sandbox (10–30 min); Depths is combat runs (10–15 min). Putting free building inside a combat game changes both.
- Builders' save (`inoa.builders`) and share codes would need a migration and a support story. That is real risk with no player benefit yet.

## What to reuse later
The grid placement, piece catalogue, snapping and ghost preview, quest chain format and share-code encoder in `games/builders.html`. Extract them into an engine module, e.g. `engine/build.js`, behind a small documented interface, then use the module in **both** Builders and the flagship homestead. Copying code between the two is the option to avoid.

## Gate before any merge or redirect
- The homestead covers Builders' essential mechanics and quests.
- A tested migration exists for `inoa.builders` saves and old share codes.
- The owner approves.
- Rollback: the standalone page remains deployable from git.
