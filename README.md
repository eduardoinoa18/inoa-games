# Inoa Games

A hub of browser games by **Inoa Services**: one link, no download, phone + laptop + gamepad, one hero that levels up across every game.

**13 games:** Pixel Pact (2D co-op + brawler) · Pixel Pact: Depths (3D roguelite) · Island Drift (kart racer) · Snack Squad Safari (allergy-safety game for families) · Tide Runner · Tide Lines · Perfect Fit · Junkyard to Jewel · Brew and Bloom · Driftwood Builders · Fail Tray · Pact Trivia · Draw the Pact.

## Play together
- **Phones as controllers:** open the hub on a TV or laptop → Party → Start a party, scan the QR with each phone.
- **Online:** host shares the link from the party panel (Island Drift races on separate screens; Trivia and Draw on phones).
- Details: `docs/MULTIPLAYER.md`.

## Run locally
```bash
npm install
npm start          # http://localhost:5173
```

## Test
```bash
node test/run.js drift test/drift.js   # one game, screenshots in test/out/
npm run test:all
```

## Deploy
Static site on Vercel (`vercel.json`). Push to `main` → auto-deploy when the Vercel project is connected to this repo.

Built with Three.js r170, CC0 models (Kenney via pmndrs/market-assets) and Poly Haven HDRIs. See `CLAUDE.md` for the full project handout and `docs/ENGINE.md` for the engine guide.
