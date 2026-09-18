# Rooftop Escape — Project Document

**AI + Innovation Design Capstone · Week 1 group hackathon ("Build a Game Together") · Open FIESTA, Tsinghua SIGS**

| | |
|---|---|
| **Play (live)** | https://bryan273.github.io/rooftop-escape/ |
| **Source** | https://github.com/bryan273/rooftop-escape |
| **Landing page** | [`index.html`](../index.html) · **Game** [`play.html`](../play.html) · **Poster** [`poster.png`](../poster.png) ([`poster.html`](../poster.html)) |
| **Deep design reference** | [`DESIGN.md`](../DESIGN.md) (every system, number and tuning value) |
| **Team** | **Rooftop Escape** — 侯嘉琪 · Phan Ngoc Anh · Bryan Tjandra |

---

## 1. Summary

Rooftop Escape is a first-person 3D zombie survival escape game that runs in the browser with no install. You play a student trapped in Seowon High School after an outbreak. A military helicopter will land on the roof at midnight, but only if it sees a signal flare. You climb six floors, solve the stairwell locks in a fixed order, decide whether to trust a survivor who may be infected, and hold the landing circle for 30 seconds against the rooftop horde.

It supports solo play and 2–4 player online co-op, English and Chinese, and two modes: **Nightmare** (dark horror) and **Daylight Drill** (bright and kid-friendly).

## 2. Problem statement and goal

Most browser games made in a one-day hackathon stop at a "60-point game": the loop works, but nothing makes the player *feel* anything. Our goal was to reach a "90-point" experience in a short build by borrowing proven feelings from reference works and making every system serve one emotion: **dread that turns into relief**.

Design questions we set ourselves:

1. How do you make a player afraid in a browser, without jump-scare spam?
2. How do you keep a 30–45 minute escape readable, so players never ask "what now?"
3. How do you give one moral decision real weight in a short game?

## 3. Reference breakdown ("taste")

| Reference | What we took | Where it shows up |
|---|---|---|
| *All of Us Are Dead* (Netflix) | A school outbreak, green uniforms, infected classmates, a teacher who turns, trust between survivors | Setting, zombie look, Mr. Park, Ji-eun |
| PUBG / battle-royale audio UI | Direction-of-sound indicators | The 24-segment threat ring around the crosshair |
| Escape rooms | Locks that must be opened in order, keys found elsewhere, back-tracking | The strict 24-step mission chain |
| *Left 4 Dead* | A final "hold out until rescue" event; revive teammates | The rooftop flare finale; co-op revives |
| *The Walking Dead* (Telltale) | A timed choice with no right answer | Ji-eun's 7-second trust/kill decision |

## 4. Player experience and core loop

**Required hackathon loop:** Landing page → Start → Onboarding/Tutorial → Gameplay → Win/Lose → Restart.

| Loop stage | How it is implemented |
|---|---|
| Landing | `index.html`: key art, one-line pitch, a **Play** button, features, screenshots, controls, feedback link |
| Start | `play.html` menu: mode (Nightmare/Daylight), language, solo / host / join, continue a saved run |
| Onboarding | A skippable intro comic with its own soundscape, then a mission brief. In game, the top-left panel always shows the current step, **where** it is and **which key** to press; `[Tab]` shows the whole plan |
| Gameplay | Explore → find the item/lock → solve it → the next step unlocks → climb (see §5) |
| Win / Lose | Win: helicopter extraction screen. Lose: death screen with 3 retries per run (respawn at the highest floor reached); out of retries = run over |
| Restart | Respawn button, "quit to menu", or continue from the auto-save (solo) |

**Minute-to-minute loop:** read the mission panel → scout (threat ring, blood around doors, sounds) → sneak or fight → take the item / open the lock → climb.

## 5. Core mechanics

- **Strict mission chain (24 steps).** Every story item, gate, terminal, breaker and survivor refuses before its turn with *"Not yet — first: …"*. A step completes only while it is the current step, so nothing can be skipped by luck. Two deliberate back-tracks (the Floor 3 shutter is released from the Floor 2 terminal; the Floor 5 gate is powered from Floor 4).
- **Interaction model with three keys.** `[E]` use/take/talk, `[Q]` physical work (tap to kick, hold to pry / pull a breaker / light the flare, progress is kept if you let go), `[Space]` jump. Prompts appear only for things in line of sight.
- **Threat ring.** 24 segments show where infected are moving; red means one is chasing you.
- **Stealth and senses.** Zombies see in a cone (crouching halves it, a flashlight extends it) and hear sprinting, doors, kicks and gunshots at different ranges.
- **Resources.** Flashlight battery, flares (lure enemies), medkits, a crowbar (double damage from behind), a full-auto SMG with limited ammo and dedicated ammo rooms.
- **Survivors.** Mr. Park is bitten and lying in the hall: talk to him, take his keycard, then he turns and you must put him down. Ji-eun hides in a safe room with blood on her sleeve; after the talk you get **7 seconds** to trust or kill her (see §6).
- **Rooftop finale.** Light the flare, then hold the landing circle for 30 s while zombies climb onto the roof. Leaving the circle makes the clock run backwards.
- **Infected that move like broken bodies.** Each zombie has its own limp side, a locked knee and a dragging foot, a lolling head, sudden neck jerks and sometimes a dead arm. Wounds keep bleeding onto the floor.

## 6. Key design decisions

| Decision | Why | Trade-off |
|---|---|---|
| **Strict order, no skipping** | Early playtests jumped from step 7 to 13 when a later item happened to be found first, which broke the story | Less freedom; we compensate with clear "where + which key" hints |
| **Ji-eun is ambiguous until after the choice** | A choice only matters if you can't read the answer. Her lines are evasive, her name has no "survivor" tag, the truth is revealed only after you kill her | Some players will kill an innocent — that is the point |
| **7-second timer, and not choosing is a choice** | A timer turns a menu into a panic. Timing out lets the horde into the safe room | Needs strong audio/visual urgency (flashing warning, beeps, breathing) |
| **Trusting her costs you** | She joins exhausted (45/160 HP) and needs your medkit, so "trust" is a resource decision, not a free ally | — |
| **One key per verb** | Players asked for consistent controls; `E` for "use", `Q` for "work", `Space` only jumps | Q also lost its old co-op ping role (moved to `Z`) |
| **Audio before visuals for fear** | Spatial footsteps, a heartbeat that races, and a short alert beep on every warning build dread cheaply | Needs recorded samples (added by our audio owner) |
| **Rooftop tuned by simulation** | "Too hard" and "too easy" were both reported; a fighting bot now verifies the finale is winnable | Numbers live in one `ROOF` table |
| **Two modes from one codebase** | Daylight Drill swaps lighting, models, sounds and wording so younger players can play the same puzzle game | Every scary string/sound needs a friendly twin |
| **No build step** | Anyone can open the repo on GitHub Pages; teammates can edit without tooling | One large ES module (`js/game.js`) |

## 7. Technical overview

### Tech stack

| Layer | Choice |
|---|---|
| Rendering | Three.js r160 (ES module via CDN import map), ACES tone mapping, fog, canvas-generated textures |
| Audio | Web Audio API: recorded SFX (`assets/sfx/*.wav`), CC0 zombie voices (`js/vox.js`), synthesized fallbacks, stereo panning + distance attenuation, a "monster throat" filter bus for zombie voices |
| Multiplayer | PeerJS 1.5 (WebRTC), host-authoritative |
| Hosting | GitHub Pages (static, `.nojekyll`), no backend |
| Tests | Node.js headless harness with a stub renderer (`_sim/`), Playwright for real-browser checks |

### Repository layout

```
index.html            landing page (this is what the public URL opens)
play.html             the game page (markup only)
poster.html / .png    promotional poster (HTML source + exported image)
css/landing.css       landing page styles
css/style.css         game styles
js/game.js            the game: one ES module (world, AI, missions, UI, audio, co-op)
js/vox.js             embedded CC0 zombie voice clips
assets/sfx/           recorded sound effects;  assets/promo/  key art + QR code
_sim/                 headless test harness (build.mjs, harness.mjs)
docs/PROJECT.md       this document;  DESIGN.md  full design reference
```

### Architecture of `js/game.js`

The module is organised in sections, top to bottom:

1. **Config + i18n** — `CFG`, `ROOF`, `GUN` tuning tables; `I18N` (English/Chinese) behind `T(key)`.
2. **Audio** — `ensureAudio()` builds synth buffers, loads samples, starts loops; `play(name, {pos})` spatialises one-shots; `warnFx()` plays the short alert on warning text.
3. **World generation** — `buildFloor(f)` builds each floor (rooms with doors, stair tower, fixed light inventory so shaders never recompile), special rooms (security/CCTV, electrical, safe room, ammo rooms), `buildRoof()`.
4. **Physics queries** — `groundAt`, `collideCircle`, `losClear` (walls tested at the eye height of that floor).
5. **Characters** — `buildHumanoid()` (rounded bodies, uniforms, wounds, faces); `Zombie` (senses, state machine, `animateBody()` broken gait, `bleed()`); `SurvivorNPC` (Park, Ji-eun: talk, follow, fight, health).
6. **Missions** — the `QUEST` array (24 steps with `done()` and a location), `questCheck()`, `renderObjective()`, the Ji-eun choice (`startJieunChoice` / `resolveJieun`).
7. **Interaction** — `interactTargets()` picks the best `E` / `Q` target by distance, facing and objective priority; hold/kick jobs with animated planks.
8. **UI, menus, saves, networking, main loop** — HUD, intro comic, chapter comics, pause, CCTV terminal, save v3 (`localStorage`), PeerJS host/guest events, `loop()`.

**Co-op model.** The host simulates zombies, survivors and the mission. Guests send inputs and hits (`zhit`); the host broadcasts snapshots, story flags and the mission index. Late joiners receive a snapshot after their world is built.

### Run, test and deploy

```bash
npm run serve          # python -m http.server 8080 → http://localhost:8080 (landing) · /play.html (game)
npm test               # builds the Node copy and runs Nightmare (trust ending) + Daylight (timeout ending)
npm run test:zh        # Chinese UI, kill ending
npm run test:coop      # co-op world
```

Deploy: push to `main` with GitHub Pages set to *Deploy from branch → main / root*. All paths are relative.

## 8. Quality and testing

The harness boots the real game module in Node, presses real keys and plays the **whole 24-step chain** to the helicopter. It checks, among other things:

- every step completes in order and later items refuse early (skip protection);
- every flight of stairs is climbable and every room reachable (flood fill); every room's front wall is solid (40 random buildings);
- point-blank combat, head shots, walls stopping bullets, full-auto rate;
- all three Ji-eun endings (trust + medkit, kill, timeout horde);
- save → restore round trip; i18n keys exist in both languages;
- the rooftop is winnable by a fighting bot with human-like aim, and never sends more than 30 zombies.

Latest results: Nightmare 52/52 · Daylight (timeout) 54/54 · Chinese (kill) 51/51 · co-op 49/49 in both modes.

## 9. How we worked (AI + Git)

- **Feature ownership instead of roles.** Each member owned a slice end to end: core gameplay and systems; experience, UI and story; audio.
- **Coding agents** wrote most of the code from design prompts; humans set the direction, played, reported bugs with screenshots and decided the taste questions (what is scary, what is unfair, how hard the roof should be).
- **Git workflow.** Feature branches pushed to one repository (e.g. `fix/heartbeat-sound`), merged into `main`. When the branch and `main` had diverged structurally (single HTML file vs. split modules), the audio work was ported by hand and verified by tests instead of forcing a conflicting merge.
- **Testing as the safety net.** Every bug report became a harness check, so agents could not silently reintroduce it.

## 10. Team and credits

| Member | Ownership | Main contributions |
|---|---|---|
| **Bryan Tjandra** | Core gameplay & systems | Original game and engine, building generation, stairs and physics, strict mission chain, combat, companions, co-op netcode, i18n, tests, landing page and docs |
| **Phan Ngoc Anh** | Experience, UI & story | Survival-horror overhaul, the six-floor story restructure, chapter comics, mission window and UI round, respawn flow |
| **侯嘉琪** | Audio | Recorded sound effects, heartbeat and tension system, helicopter and thunder samples |

Assets: zombie voices CC0 via OpenGameArt; sound effects Mixkit (free license); Three.js (MIT); PeerJS (MIT). Fan-made and non-commercial, inspired by *All of Us Are Dead*.

## 11. Known limitations and next steps

- Characters are built from primitives in code; artist-made rigged models (e.g. CC0 Quaternius packs) would be the next big step in realism.
- Co-op needs ordinary internet; strict school/corporate networks block WebRTC.
- Keyboard + mouse only; touch controls would open it to phones.
- Next: collect ≥10 pieces of player feedback (landing page → GitHub Issues, class WeChat group) and tune difficulty, clarity and the Ji-eun scene from it.
