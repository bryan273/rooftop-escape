# Master Prompt for z.ai (copy everything below the line)

> Paste this whole prompt into z.ai (or Cursor / Claude / GLM) to regenerate the full game.
> It describes exactly what `index.html` in this folder implements — 20 floors, co-op multiplayer, synthesized audio, free hosting.

---

You are an expert Three.js, WebGL, Web Audio API and PeerJS engineer. Build a complete, atmospheric 3D **first-person zombie survival escape game with co-op multiplayer**, delivered as **ONE standalone HTML file** that runs by double-clicking and deploys free on any static host.

## 1 · CONCEPT
An overnight study camp at "Seowon High School" goes wrong. A military helicopter extracts survivors from the **rooftop at midnight**. The player climbs **20 floors** of a dark school tower, solving stairwell locks while zombie infestations thicken. ~1 hour playthrough. Inspired by *All of Us Are Dead* (school outbreak mood, story radio from a friend named Ji-woo) with PUBG-style threat indicators and escape-room gating.

**TWO MODES selectable on the menu (remembered in localStorage, host's choice rules co-op):**
- 🧟 **NIGHTMARE** — pitch-dark school, zombies with glowing red eyes, blood decals, blackouts, jump-scare stingers, heartbeat + tension music, reverb.
- 🤖 **DAYLIGHT DRILL** — same building fully lit with daylight through windows, enemies become silly **helper-bots** (screen faces, cyan eyes, antennae, 4 color tints), blood becomes colorful paint splats, growls become servos/beeps/boings, blackouts become harmless light blinks, the horde becomes a "bot parade", damage −50%, enemy speed −15%, battery drain halved, loot +70%, threat ring blue instead of red, death screen says "YOU GOT BONKED". Zero scares — kid-friendly.

## 2 · ENGINE & TECH
- Three.js r160 via importmap from unpkg; PeerJS 1.5 UMD from unpkg. **No other dependencies, no assets, no backend.**
- All textures generated at runtime on `<canvas>` (concrete walls, floor tiles, grime, wood doors, metal, blood splat decals, posters, text signage, floor labels).
- All sound synthesized at load with Web Audio (buffer-synth): zombie growls ×3, screams, zombie footsteps, player steps, door creaks, board clangs, breaker clunks, gate rumbles, flare fizz, radio blips, alarm, thunder, heartbeat, jump-scare stinger, ambient drone, chase-tension layer, helicopter rotor, victory chord. Spatialize with StereoPanner: pan & attenuate by camera-relative direction/distance.
- Renderer: ACES tonemapping, FogExp2, sRGB, PCFSoft shadows only on the flashlight spotlight (1024 map). requestAnimationFrame loop with clamped delta-time.

## 3 · PLAYER & CONTROLS
- Pointer-lock mouse look; `WASD`/arrows move, `Shift` sprint (drains stamina, makes 13 m noise), `Space` jump, `C` crouch (quiet, harder to spot), `E` interact (hold-to-progress for boards/breakers/revives), `F` flashlight, `G` throw flare, `H` medkit, `LMB` crowbar swing / shove, `V` toggle first/third person (third person: camera boom with wall clamping + visible player body), `Q` ping marker, `Enter` chat, `Esc` pause (sensitivity/volume/FOV sliders, persisted in localStorage).
- HP 100 (no regen, medkits +60), stamina, flashlight battery draining 100 % ≈ 6 min (flicker under 18 %), head-bob, sprint FOV kick, damage vignette + camera shake, downed → bleed-out → respawn states.

## 4 · BUILDING (the core trick)
One tower, identical footprint every floor, floors 3.4 m apart, **all 20 floors generated procedurally**:
- 40 m central corridor with fluorescent fixtures (randomly flickering/broken, plus rare red emergency lights).
- 6 rooms per floor (3 north, 3 south) with hinged doors, room-name signs, theme by height band: school (floors 1–5), offices (6–11), labs/infirmary (12–16), dorms (17–20). Furniture = collidable boxes (desks, lockers, benches, beds, blackboards), posters, debris, blood decals.
- **Stair tower** at the east end: open archway from the corridor, per-floor portcullis-style **gate** in the stairwell, and a REAL walkable staircase — implement as an analytic ground-height function (stepped ramp inside a "lane" hole cut through every floor plate, stacked diagonally floor by floor, with railings and a bypass gap at the gate so descending is always possible).
- **Rooftop** (level 21): helipad with painted "H", parapets, green extraction circle with light beam, helicopter model with spinning rotors + searchlight + rotor audio, moonlight.

## 5 · ESCAPE-ROOM GATES (objectives drive a 1-hour run)
Gate *i* = stairwell gate between floor *i* and *i+1*:
- G3: RED keycard (CCTV office desk, Floor 2)
- G6: security shutter → restore main power (generator, Floor 2 CCTV room), then release remotely from the **CCTV terminal** → forces back-tracking down
- G7: boarded → crowbar (hold-E 2.6 s, loud)
- G8: BLUE keycard (boarded server rack room, Floor 6)
- G11: GREEN keycard (records office, Floor 9, guarded)
- G15: magnetic lock → reset sub-breaker (Electrical room, Floor 11) — reached *after* the Floor 12 horde, so the player descends again
- G17: YELLOW keycard (infirmary, Floor 15) · G19: boarded → roof access
- Rooftop: hold the extraction circle 8 s while a finale horde spawns.
Top-left objective tracker always states the current step; radio subtitles narrate each floor's first visit; 8 readable lore notes; an objective-complete chime.

## 6 · ZOMBIES
- Types: shambler (slow, 3 hits), runner (floor 6+, fast, 2 hits), brute (floor 12+, tank, 8 hits). ~4–14 per floor, density rising with height. Low-poly procedural humanoids (boxes) with glow-in-the-dark eyes, procedural walk/chase/windup/corpse animations.
- Senses: raycast line-of-sight + forward cone; crouch shrinks sight, flashlight expands it; hearing radii per event (sprint 13 m, walk 5 m, crouch 2 m, creak 9 m, boards 16 m, flare 22 m). States: idle/patrol (room ↔ door ↔ corridor), investigate, chase, attack windup with cooldown; **they can climb the real staircase after you**; backstab deals double damage; touching hits drain HP with knockback.
- Scripted scares: Floor 1 classroom door bursts open (first chase), blackouts with a spawn-behind on floors 4/9/17, **Floor 12 containment-breach horde** with alarm, rooftop finale horde. Random ambient director every 25–50 s: distant clangs, whispers, thunder, flickers.
- **PUBG-style threat indicator:** a 24-segment ring around the crosshair; zombies on the floor within 17 m light segments directionally — dim orange idle/walking, orange investigating, red chasing — visible through walls. Plus positional growl/step audio and a proximity heartbeat with tempo scaling.

## 7 · CCTV & TOOLS
- Flashlight spotlight with shadows, battery pickups; flares = thrown red lights that lure zombies 15 s; medkits; crowbar pries boards and swings; 4 colored keycards.
- **CCTV terminal (Floor 2, after power):** full-screen green-phosphor monitor with per-floor top-down schematic (rooms, corridor, stair tower), live red zombie blips and green teammate blips, scanlines/static, floor switching with ◀/▶; used to release the Floor 6 shutter remotely.

## 8 · CO-OP MULTIPLAYER (PeerJS, serverless)
- Menu: name entry, **Solo / Host Co-op / Join Co-op**; host gets a 5-letter room code (Peer `zfesc-<code>`), lobby UI lists survivors, host starts; late joiners spawn at the host's checkpoint floor with a full world-state snapshot (gates, cards, power, taken items).
- **Host-authoritative:** host simulates zombies/gates/items/events, broadcasts quantized snapshots at 8 Hz (players + all zombies with state/type); clients send their position/flags at 12 Hz and discrete requests (door, pickup, board-break, breaker, shutter, revive, chat, ping, flare) which the host validates and relays to everyone.
- Keycards/gates/power/pickups are shared world state; consumables are personal. Remote players render as humanoids with name tags and downed/dead poses. Downed players (60 s bleed-out) are revived by teammates holding E 3 s; death respawns after 25 s at the tower. Victory requires the whole squad in the extraction circle. Text chat + ping markers included.

## 9 · UI/UX & ROBUSTNESS
Title menu (tabs: Play / How-to-play, mode cards, **Continue-run button when a solo save exists**) · survivors lobby with click-to-copy code · story prologue card ("CLICK TO WAKE UP" — also unlocks audio) · HUD: HP/stamina/battery bars, inventory slots, keycard icons, floor label, objective, toasts, radio subtitles, interact prompt + hold bar, threat ring · **[Tab] escape-plan overlay** (done/current/upcoming objectives) · pause menu with sliders · CCTV overlay · note reader · downed/death/respawn/victory screens · film grain + vignette overlays · live on-page error banner. Auto-drop pixel ratio below 38 FPS; **only render/simulate current floor ±1** (everything is grouped per floor).
**Save system:** solo runs autosave to localStorage every 5 s (mode, quest index, cards, power flags, inventory, battery, checkpoint floor, opened gates, broken boards, taken items, seen floors); menu CONTINUE rebuilds the world in the saved mode and restores silently at the stairwell checkpoint; victory clears the save; co-op doesn't save. Warn "keyboard + mouse required" on touch-only devices.
**Enemy depth:** chasing zombies **force closed doors open** (bang knock first, ~1.6 s) so rooms aren't safe forever (boarded doors still are); **wounded enemies drip blood/paint trail decals** (capped pool). Rooftop finale = horde of 8 + heavy brutes (2 Nightmare / 1 Daylight). Dead elevator doors on every floor that occasionally *ding* in the distance.

## 10 · ACCEPTANCE CHECKLIST
- [ ] Double-clicking the file runs the game (only internet need: CDN imports)
- [ ] Menu → prologue → gameplay with zero console errors
- [ ] You can walk a full staircase up, gate animations, locked-gate messaging
- [ ] Flashlight dims/dies; battery pickup restores; flares lure zombies
- [ ] The threat ring lights toward nearby zombies through walls
- [ ] CCTV shows live blips and releases the Floor 6 shutter
- [ ] Two browser windows can play co-op via room code (host drives zombies)
- [ ] Death → respawn at checkpoint; rooftop hold → victory screen with stats
- [ ] Solo run autosaves; after a refresh the CONTINUE button resumes at the saved floor/mode
- [ ] Chasing zombies bang-open closed doors; wounded ones leave drip trails
- [ ] File deploys unchanged to GitHub Pages / Netlify Drop

## 11 · FREE DEPLOYMENT (also ship these instructions)
GitHub Pages (`git push`, Settings → Pages → main branch), Netlify Drop (drag the file), Vercel (`npx vercel`), itch.io (zip → HTML game). No server component exists — co-op is pure WebRTC via PeerJS's free broker.
