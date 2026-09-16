# ROOFTOP ESCAPE — Full Game Design Document

> 3D first/third-person zombie survival escape · single HTML file · co-op multiplayer · free static hosting.
> Concept: *All of Us Are Dead* atmosphere + PUBG-style spatial-audio indicators + escape-room puzzle gates.

---

## 1. High concept

You fell asleep during a study camp at **Seowon High School**. The outbreak started on the third floor. A military helicopter extracts survivors from the **rooftop at midnight**. Climb **20 floors**, scavenge tools, solve the building's locks, and don't stop moving.

**Two modes** (chosen on the menu, persisted; the host's choice syncs to co-op clients via the `start` message — the whole world is built *after* mode selection):

| System | 🧟 NIGHTMARE | 🤖 DAYLIGHT DRILL |
|---|---|---|
| Fog / sky | Near-black, exp fog 0.052, starfield + moon | Light blue fog 0.026, blue sky, sun sprite, drifting clouds |
| Light rig | ~55 % of fluorescents on (some flickering), red emergencies, no ambient | 100 % fluorescents + hemisphere light |
| Textures | Grim concrete, grime, dark tiles | Bright warm palette, no grunge overlays |
| Decals | Blood splats/pools | Random-hue paint splats |
| Posters | SPORTS FESTIVAL / MISSING… | SCIENCE FAIR! / ROBOT CLUB 🤖 |
| Enemies | Zombies, red glowing eyes | Helper-bots: screen face, cyan eyes, antenna + bulb, chest panel, 4 tints |
| Enemy tuning | 100 % speed/damage | ×0.85 speed, ×0.5 damage |
| Economy | Base loot, 6-min battery | ×1.7 loot, ~13-min battery |
| Audio | Growl set + reverb (generated impulse convolver) | Sound-map layer swaps growls→servo/whir/beep, scream→boing, alarm→happy arpeggio; no tension layer |
| Events | Blackouts + spawn-behind, thunder, stingers | Light blink (no spawn), beeps |
| HUD | Red threat ring | Blue threat ring |
| Death | "YOU DIED — the building keeps your bones" | "YOU GOT BONKED — bots politely wait" |

Implementation: a `MODES` table + `MD` (active mode params) global consulted at texture build, world build, audio init, AI construction, event and UI time; the sound remap (`LMAP`) resolves buffer names at play time so every existing call site switches automatically.

- **Perspective:** first person (default), third person toggle `[V]`
- **Session length:** ~45–75 minutes (20 floors + finale)
- **Players:** 1 solo, or 2–4 co-op
- **Death model:** downed (60 s bleed-out, revivable) → timed respawn at the highest checkpoint floor; the run itself never fully resets

## 2. Core loop

```
enter floor → scout (listen to ring / read bloodstains) → scavenge (batteries, flares, medkits)
   → solve floor gate (keycard / power / CCTV / boards) → climb → repeat → ROOFTOP FINALE
```

Deliberate **back-tracking**: twice per run the fix for a gate lives 4–6 floors *below* you, forcing re-descents through territory you already cleared — the building is never "done with you".

## 3. The building

One consistent tower. Identical footprint per floor (so you learn it):

| Zone | Geometry |
|---|---|
| Corridor | 40 m central hallway, flickering fluorescent fixtures (some broken) |
| Rooms | 6 rooms/floor (3 north, 3 south) with hinged doors; theme changes with height |
| Stair tower | East end. Open archway from corridor, visible portcullis-style **gate** per floor, a real walkable staircase (analytic ramp + step meshes), railings, per-floor signage |
| Rooftop | Helipad, parapet, green **extraction circle**, helicopter with searchlight, finale horde |

**Themes by band:** Floors 1–5 school (desks, blackboards, lockers, posters) → 6–11 offices (cubicles, shelves) → 12–16 labs/infirmary (benches, racks, beds) → 17–20 dorms/maintenance.

Environmental storytelling: blood decals pooled at "nest" doors, readable notes (8 lore notes), posters, "MISSING" flyers, sealed main entrance, out-of-order elevator (occasionally dings…).

## 4. Gate plan (the escape-room spine)

Gate *i* blocks the stairwell between floor *i* and *i+1*.

| Gate | Type | Solution |
|---|---|---|
| 3 | Keycard | **RED** card — CCTV office desk, Floor 2 |
| 6 | Security shutter | Restore **power** (generator, Floor 2) then **release remotely from the CCTV terminal** (Floor 2) → forces a full backtrack |
| 7 | Boarded | **Crowbar** (hold E 2.6 s, very loud) |
| 8 | Keycard | **BLUE** card — boarded server rack room, Floor 6 |
| 11 | Keycard | **GREEN** card — records office, Floor 9 (guarded) |
| 15 | Magnetic lock | Reset **sub-breaker**, Electrical room Floor 11 — reached *after* the Floor 12 horde, i.e. go back DOWN |
| 17 | Keycard | **YELLOW** card — infirmary, Floor 15 |
| 19 | Boarded | Crowbar again → roof access |
| Rooftop | Finale | Hold the extraction circle 8 s while the horde climbs out of the stairwell |

The objective tracker (top-left) always states the current goal; radio subtitles narrate every floor's first visit.

## 5. Threat system — the PUBG indicator

- **Threat ring:** 24 segments around the crosshair. Zombies on your floor within 17 m paint segments: **dim orange** = idle/walk (only when close), **orange** = investigating, **red** = chasing. Segment position = direction (left/right/behind). Works through walls — it represents *sound*.
- **Diegetic audio:** positional growls and shuffling steps (Web Audio, stereo-panned + distance-attenuated). Chase growls are on a shorter loop.
- **Heartbeat:** tempo scales with proximity of the nearest hunter; tension music layer fades in within 12 m.
- **Visual clues:** bloodstain pools mark nest rooms; blood trails on stairs; glowing eyes in darkness.

## 6. Zombies

| Type | Behaviour | Stats |
|---|---|---|
| Shambler | Slow patrol, room-bound | 3 hits, 14 dmg |
| Runner | Appears floor 6+, faster senses | 2 hits, 18 dmg |
| Brute | Floors 12+, tank | 8 hits, 30 dmg |

**Senses:** raycast line-of-sight (raycast against wall colliders) + ~100° forward cone; sight range shrinks if you crouch, grows if your flashlight is on. **Hearing:** sprint = 13 m noise, walk = 5 m, crouch = 2 m, door creak = 9 m, board-breaking = 16 m, thrown flare = 22 m pull. **Door forcing:** a chasing/investigating enemy that reaches a closed (unboarded) door knocks (bang cue) and forces it open after ~1.6 s — closed doors delay, not stop, the hunt; boarded doors remain player-safe. **Wound trails:** enemies below max HP drip small blood/paint decals as they move (capped pool of 140, recycled) — trackable both ways. Backstab (attacking an unaware zombie from behind) deals double damage. Off-screen floors freeze for performance.

**Navigation:** patrol between room centre ↔ doorway ↔ corridor stretch; investigate last noise; chase with wall-sliding steering; can climb the actual staircase after you if you cross floors (the horde finale uses this). Backstab (attacking an unaware zombie from behind) deals double damage. Off-screen floors freeze for performance.

**Scare direction:** scripted beats (a door bursting open on Floor 1, total blackouts with a spawn-behind on floors 4/9/17, the Floor 12 alarm horde, rooftop finale) + a random ambient director (distant clangs, whispers, thunder, light flickers) every 25–50 s.

## 7. Items & economy

| Item | Effect |
|---|---|
| Flashlight | SpotLight attached to camera, casts real shadows. 100 % ≈ 6 min. Flickers < 18 %. |
| Battery | +40 % flashlight |
| Flare | Thrown (G): red light source, burns ~15 s, attracts zombies |
| Medkit | +60 HP (H) |
| Crowbar | Pry boards + melee weapon |
| Keycards ×4 | Unlock colour-matched gates |
| Notes ×8 | Lore reading |

Health does not regen; stamina regens out of combat. Sprint is a *luxury and a liability*.

## 8. CCTV terminal (Floor 2)

After main power: a full-screen green-phosphor monitor. Top-down schematic of **any floor**: rooms, corridor, stair tower, live zombie blips (red = chasing, orange = idle), teammate blips (green). Used to release the Floor 6 shutter remotely and to plan routes ("is the corridor ahead clear?"). CRT scanlines + static.

## 9. Multiplayer (co-op, up to 4)

- **Transport:** PeerJS WebRTC, free public broker. Host creates a 5-letter room code; friends join by code. **No server, no cost.**
- **Model:** host-authoritative. Host simulates zombies, gates, items, events; broadcasts world snapshots (8 Hz, quantized). Clients send position/flags at 12 Hz and request discrete actions (doors, pickups, revives) which the host validates and relays.
- **Shared world state:** keycards, gates, power, boards, and item pickups are world-global (one player's pickup feeds the team); consumables (batteries/medkits/flares) are personal.
- **Remote avatars:** humanoid models with name tags, walk animation, downed/dead poses.
- **Co-op revival:** downed → 60 s bleed-out → teammate hold-E revive. Death → 25 s respawn at checkpoint. Extraction requires the whole squad in the circle.
- Chat (Enter) + ping markers (Q).
- World state snapshot sent on join so latecomers inherit progress; they spawn at the host's checkpoint floor.

## 10. Audio (100 % synthesized, no files)

Buffer-synthesized at load: zombie growls (3 pitch variants), screams, shuffling steps, player footsteps, door creaks, board clangs, breaker clunks, gate/shutter rumbles, flare fizz, radio blips, alarm siren, thunder, heartbeat, jump-scare stinger (detuned saw cluster + noise burst), ambient drone, chase-tension pulse, helicopter rotor loop, victory chords. Stereo-panned and distance-attenuated relative to camera = the "PUBG ear" effect for free.

## 11. Visuals & performance

- Three.js (CDN ES module), ACES tonemapping, exponential fog, canvas-generated textures (concrete, tiles, grime, blood/paint, posters, signage).
- **First-person view-model:** arm + crowbar (or flashlight with glowing lens) parented to the camera; bob/sway while walking, arc swing animation on attack, hidden in third person.
- **Particles:** sprite pool for hit bursts (blood in Nightmare / yellow-blue sparks in Daylight / wood chips when prying boards); 220 additive dust motes drifting around the player and catching the flashlight (Nightmare only).
- **Set dressing:** room windows with mode-tinted emissive glow + frames, ceiling pipe runs along corridors, vending machines with glowing fronts + DRINKS signs, water coolers, scattered papers (Nightmare).
- Lighting: sparse per-floor point lights (some flickering), red emergency lights (Nightmare), flashlight spotlight with 1024px shadow map, emissive screen/exit-sign accents, hemisphere fill (Daylight).
- **Floor culling:** only current floor ±1 is visible/simulated → hundreds of rooms and ~200 zombies stay smooth. Auto resolution drop if FPS < 38.
- Procedural animation: walk-cycle limb swings, chase poses, windup lunge, corpse falls, per-zombie hit-flash (cloned materials). Player body appears in third person / to teammates.

## 12. UI

Title menu (solo / host / join, name, how-to-play, **Continue-run button when a solo save exists**) · survivors lobby with copyable room code · prologue story card (per mode) · HUD (HP/stamina/battery bars, inventory slots, keycard icons, floor label, objective tracker, toasts, radio subtitles, interact prompt with hold-progress bar, threat ring) · **[Tab] escape-plan overlay** (completed / current / upcoming objectives) · pause menu with sensitivity/volume/FOV · CCTV overlay · note reader · downed/death/respawn screens · victory screen with run stats · live error banner for support.

**Save/Continue:** solo runs auto-save to localStorage every 5 s (mode, quest index, cards, flags, inventory, battery, HP, checkpoint floor, runtime, kills/deaths, opened gates, broken boards, taken items, seen floors). The menu shows CONTINUE with floor + mode; continuing rebuilds the world in the saved mode, restores state silently, and spawns at the stairwell checkpoint. Winning clears the save. Co-op runs don't save.

**Rooftop finale:** horde of 8 plus heavy brutes (2 in Nightmare / 1 friendly chunky bot in Daylight) converging on the extraction circle while the helicopter descends.

**Ambient director extras:** distant clangs, whispers, thunder (Nightmare), and the dead elevator occasionally *ding*ing somewhere on your floor.

## 13. Tech & deployment

Single `index.html` (≈2,700 lines): HTML + CSS + JS module. Imports: `three@0.160` via importmap (unpkg), `peerjs@1.5` UMD. No build step, no backend, no assets. Deploys free on GitHub Pages / Netlify Drop / Vercel / itch.io.
