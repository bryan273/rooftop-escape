# Source code — what is in the ZIP and how to run it

`Rooftop_Escape_Source_Code.zip` is a snapshot of the full project (60 files, 3.1 MB).
Live repository (with complete commit history): **https://github.com/bryan273/rooftop-escape**
Playable build: **https://bryan273.github.io/rooftop-escape/**

## Run it locally

No build step, no backend — it is a static site.

```bash
unzip Rooftop_Escape_Source_Code.zip -d rooftop
cd rooftop
python -m http.server 8080      # or any static server
# open http://localhost:8080/          → landing page
# open http://localhost:8080/play.html → the game
```

Laptop/desktop only (keyboard + mouse), best in Chrome or Edge. Three.js r160 and PeerJS 1.5 load from a CDN, so the first run needs internet.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Landing page (story, features, gallery, how to play, team) |
| `play.html` | The game shell: menu, lobby, HUD, all overlays |
| `css/landing.css`, `css/style.css` | Landing page styles · game UI styles |
| `js/game.js` | The game — one ES module (~7 500 lines): world generation, AI, missions, combat, co-op, audio, main loop |
| `js/i18n-extra.js` | Vietnamese + Indonesian dictionaries (English and Chinese live inside `game.js`) |
| `js/vox.js` | Embedded CC0 zombie voice clips |
| `assets/` | Recorded sound effects, promo images, QR code |
| `docs/PROJECT.md` | Standalone project document |
| `DESIGN.md` | Game design document (systems, tuning tables, co-op model) |
| `_sim/` | Headless test harness: `build.mjs` makes a Node copy of the game with a stub renderer, `harness.mjs` plays the full 24-step mission chain and asserts invariants |
| `poster.html`, `poster.png` | Poster source and export |

## Tests

```bash
node _sim/build.mjs
node _sim/harness.mjs scary              # Nightmare  — 64 checks
node _sim/harness.mjs lite timeout       # Daylight   — 66 checks
node _sim/harness.mjs scary zh kill      # Chinese    — 64 checks
node _sim/harness.mjs scary coop         # co-op      — 61 checks
node _sim/harness.mjs lite coop kill     # co-op      — 61 checks
```

All five suites pass on the submitted commit. They cover world generation (no sealed rooms, no furniture inside walls), the full mission chain in order, combat maths (fists / crowbar / SMG vs. enemy health), zombie pathfinding (a zombie shut in a room finds the door), "nothing attacks or is visible through a wall", the rooftop siege and boss, saves, i18n key coverage, and the co-op world.

## Code map (`js/game.js`, in order)

1. Config + i18n tables (`CFG`, `ROOF`, `GUN`, `MELEE`, `ZTYPES`, `I18N`)
2. Rendering, materials, procedural textures
3. World generation — floors, rooms, doors, stairs, furniture, loot
4. Physics queries — `groundAt`, `collideCircle`, `losClear` (sight), `reachClear` (touch), `NAV` grid + BFS flow field
5. Characters — `buildHumanoid()`, `Zombie` (senses, state machine, pathing, health bar), `SurvivorNPC` (Mr. Park, Ji-eun)
6. Missions — the 24-step `QUEST` chain, `questCheck()`, the Ji-eun choice
7. Interaction — `interactTargets()`, hold/kick jobs
8. UI, saves, networking (PeerJS + MQTT relay fallback), main loop
