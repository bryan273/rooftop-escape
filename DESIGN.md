# ROOFTOP ESCAPE — Game Design Document

> 3D first/third-person zombie survival escape · browser game (static files) · co-op multiplayer · free static hosting.
> Concept: *All of Us Are Dead* atmosphere + PUBG-style spatial-audio indicators + escape-room puzzle gates.

---

## 1. High concept

A study night at **Seowon High School**. At 23:12 the outbreak starts in the **biology lab on Floor 5**; at 23:36 the school **shuts down**: gates lock and the elevators and power are cut. You wake in the entrance hall. A military helicopter reaches the **rooftop at midnight**, but it will only land where it sees a **signal flare**. Climb **6 floors**, solve the locks in order, and survive the roof.

**Two modes** (chosen on the menu; in co-op the host's choice applies):

| System | 🧟 NIGHTMARE | 🤖 DAYLIGHT DRILL |
|---|---|---|
| Lighting | Battery emergency lighting on Ground–3, **no power on 4–6** (Floor 5 keeps its alarm strobes); room signs dark where there is no power; exit signs stay lit | Fully lit + hemisphere light |
| Enemies | Zombies (red eyes) | Helper-bots (screen face, antenna) |
| Tuning | 100 % speed/damage | ×0.85 speed, ×0.5 damage, ×1.7 loot |
| Audio | Recorded SFX + zombie voices + reverb | Sounds remapped to servo/beep/boing |
| Death | "YOU DIED" | "YOU GOT BONKED" |

- **Session:** ~30–45 minutes · **Players:** solo or 2–4 co-op
- **Death model:** 3 retries per run (respawn at the stairwell of the highest floor reached); co-op players get downed and can be revived first.

## 2. Core loop

```
enter floor → read the mission panel (what · where · which key) → scout (ring, blood, sounds)
   → do the step → the next step unlocks → climb → … → ROOFTOP: flare → hold the circle 30 s
```

Two deliberate **back-tracks**: the Floor 3 shutter is released from the Floor 2 terminal, and the Floor 5 gate is powered by the breaker on Floor 4.

## 3. The building

Levels: 0 = Ground, 1–6 = Floors, 7 = Roof. Identical footprint per floor: 40 m corridor, 6 rooms (3 north, 3 south), stair tower at the east end with a gate per floor, roof with a helipad, parapet and the landing circle.

Room themes: classrooms (Ground–1), offices (2), labs (3–4), dorms (5–6). Ammo rooms: STORAGE (Floor 3 N1), ARMORY (Floor 5 N3), plus a crate on the roof.

Special rooms: janitor closet (Ground, boarded, **kick** it in) · CCTV & POWER (Floor 2: terminal, generator, red card, SMG) · boarded prep room + ELECTRICAL (Floor 4) · **Ji-eun's hiding room** (Floor 5, south-west; no zombie spawns there or can walk in).

## 4. The mission chain (strict order)

| # | Step | Where | Key |
|---|---|---|---|
| 1 | Flashlight | Reception, Ground | E |
| 2 | Crowbar | Janitor closet (kick 3× first) | Q ×3, E |
| 3 | Pry the Floor 1 gate boards | Stairwell, Floor 1 | hold Q |
| 4 | Find the security room | Floor 2 | — |
| 5 | Watch the CCTV archive (counts only when it plays to the end) | Terminal | E |
| 6 | Red keycard | Security desk | E |
| 7 | Start the generator | Same room | hold Q |
| 8 | Open the Floor 2 gate (red; reader needs power) | Stairwell | E |
| 9 | Check on the man in the hall | Floor 3, right outside the stairwell | — |
| 10 | Talk to Mr. Park (bitten, lying on the floor) | Floor 3 | E ×3 |
| 11 | Take his blue card; he says "RUN" and **turns** 4 s later | Beside his hand | E |
| 12 | Put Mr. Park down (6 HP zombie, name tag) | Floor 3 | LMB |
| 13 | Release the Floor 3 shutter | Floor 2 terminal | E, then Q |
| 14 | Go through the shutter to Floor 4 | Stairwell | — |
| 15 | Reset the utility breaker | Floor 4 ELECTRICAL | hold Q |
| 16 | Open the Floor 4 gate (blue) | Stairwell | E |
| 17 | **Find Ji-eun** (no marker; her noises are spatial) | Floor 5, safe room | — |
| 18 | Talk to Ji-eun → **the choice** (7 s): trust or kill | Safe room | E ×4, then 1 / 2 |
| 19 | Rooftop key (yellow) | At her feet | E |
| 20 | Open the Floor 5 gate (breaker released it) | Stairwell | E |
| 21 | Open the rooftop gate (yellow) | Floor 6 | E |
| 22 | Reach the roof | — | — |
| 23 | Light the signal flare | Landing circle | hold Q |
| 24 | Stay in the circle 30 s (outside = the clock runs back) | Landing circle | — |

**Skip protection:** a step only completes while it is the current step ("get to floor X" steps latch only while current), and every story item, gate, terminal, breaker and survivor refuses before its step with *"Not yet — first: …"*. The objective updates the moment a gate opens.

## 5. Interaction model

- **[E] tap:** take, open/close, read, use the terminal, swipe a card, talk (next line), respawn. When a survivor and an object are both in reach, the one you look at wins (the current objective gets priority).
- **[Q]:** physical work. **Tap** to kick (one kick per tap, screen shake, 3 kicks). **Hold** to pry, pull a breaker, light the flare or revive; letting go keeps the progress. Inside the terminal Q releases the shutter.
- **[Space]** only jumps. **[Z]** pings (co-op), **[T]** chats.
- Prompts can show several rows at once (for example "E Open door" and "HOLD Q Pry the boards off"). Targets need line of sight, the one you **look at** wins, and the item your current objective needs gets priority.
- Work is animated: planks shudder and creak while prying (the crowbar levers in first person), then fall off as physical planks that land on the floor. Breaker handles travel.

## 6. Threat system

- **Threat ring:** 24 segments around the crosshair; orange = moving nearby, red = chasing.
- **Line of sight** only tests walls at the eye level of that floor.
- **Senses:** forward cone; crouch halves sight, flashlight extends it. Hearing: sprint 13 m, walk 5 m, crouch 2 m, doors 5–9 m, kicks 9 m, gunshots 15 m.
- Chasing zombies force closed doors after ~1.6 s (never Ji-eun's door). Wounded zombies leave trails.

## 7. Enemies

| Type | Notes | HP / dmg |
|---|---|---|
| Shambler | slow patrol | 3 / 14 |
| Runner | fresh student, fast | 2 / 18 |
| Crawler | ankle lunges (Floor 4+) | 2 / 12 |
| Screamer | alerts the floor (Floor 3+) | 2 / 10 |
| Brute | tank (Floor 5+) | 8 / 30 |
| Mr. Park | rises from the floor after turning | 6 / 16 |
| The Watcher | scripted lurker/pursuer (Floors 5–6, roof) | 14 / 26 |

**Rooftop:** zombies always know where you are but are slower than downstairs (×0.85 speed, ×0.95 after the flare) and slower to swing (wind-up ×1.1, 1.6 s cooldown, ×0.85 damage). First wave after 5 s, then 2 every 11 s from the roof door and over the parapet (mostly shamblers, max 7 alive, **at most 30 in total**), a brute at 14 s and the Watcher at 21 s. An ammo crate waits by the roof door. A **fresh flare pulls roof zombies off you for 4.5 s** (not brutes). Balance check: a simulated fighting bot with 100 HP, 3 medkits and human-like aim survives.

## 8. Weapons & items

| Item | Effect |
|---|---|
| Flashlight | Camera spotlight with shadows; ~6 min per charge |
| Battery | +40 % (HUD updates live) |
| SMG | Full-auto (0.11 s), 1 dmg per bullet, head shot 2, small spread + recoil climb; 30 rounds on pickup, **+20 per ammo box**; walls stop bullets; point-blank shots land |
| Crowbar | Melee; double damage from behind; wide arc at point-blank; pries boards |
| Flare | Thrown light; lures zombies |
| Medkit | +60 HP |
| Keycards | Red / Blue / Yellow |
| Notes ×10 | Lore; always on open floor at their own floor height |

Supplies spawn only on open floor, never inside walls, desks, beds or lockers.

## 9. Survivors

- **Mr. Park** (biology teacher): bitten, lying in the Floor 3 hall; never moves. After the talk his blue card and a medkit lie beside him. Taking the card makes him convulse, say "RUN", and rise as a zombie.
- **Ji-eun:** hides sitting behind a shelf in the Floor 5 safe room; occasional spatial sounds lead you to her. She is written as a **threat, not a rescue**: blood on her sleeve, a bandaged forearm she keeps hiding, four evasive lines. Nothing before the choice says whether she is bitten.
  - **The choice** (`startJieunChoice`): after her last line the game locks input, frees the mouse and shows two buttons with a **7-second bar** — *[1] trust* / *[2] kill* — over a flashing red warning, one alert beep per second (faster under 3 s) and frightened breathing.
  - **Trust:** she joins at 45/160 HP — slower, shoots about half as often, bent over. She only self-heals to 60 %; a **medkit** ([E] beside her, or the on-screen button) puts her back on her feet (+80).
  - **Kill:** she drops instantly, and only then do you see her arm: a cut from a door, no bite. The yellow card drops either way.
  - **Timeout:** the safe room stops being safe (`safeBreached`), the door opens and four infected come in on both of you; she grabs her gun and joins anyway.
  - Flags `jieunTrusted` / `jieunKilled` / `jieunTimeout` are saved and broadcast in co-op.

## 10. Audio

- Recorded SFX in `assets/sfx/` (Mixkit free license, from the `fix/heartbeat-sound` branch) plus a real helicopter loop and thunder; CC0 zombie voice clips in `js/vox.js`. For voices, `play()` alternates between recordings and samples. Everything falls back to synthesized buffers.
- Heartbeat: louder, and the tempo races with threat. `?heartonly=1` debug mode.
- **Alert:** a short two-tone beep (0.35 s) fires automatically on any warning text (⚠ or "RUN"), throttled to once per 0.9 s, and once a second during Ji-eun's countdown.
- **Intro:** the prologue has its own soundscape — a low drone under thunder, alarms, a distant scream, a roar, radio static and a heartbeat, one cue per panel (silly equivalents in Daylight).
- Spatial: stereo panning + distance attenuation relative to the camera.

## 11. Visuals & performance

**Characters** are built in code (`buildHumanoid`): capsule torso on a waist pivot, sphere head, tapered limbs with elbow/knee joints, hands and shoes. The infected wear the school's **green uniform** (three blood-soaked variants, girls get a plaid skirt and long hair), have a painted dead face on the front of the head sphere, glowing sunken eyes, a slack jaw, and **2–4 randomly placed wounds** (bite at the neck, chest, side, forehead, shoulder, forearm with bone showing, thigh) that keep dripping blood onto the floor. Mr. Park keeps his suit and tie; Ji-eun wears a cardigan, plaid skirt and knee socks with blood on the sleeve.

**Movement** (`animateBody`): every body is broken in its own way — a warped stride phase (hurry on the good leg, stall on the bad), a locked knee and a turned-in dragging foot, the body dipping and rolling onto the bad leg, a twisting spine, a head lolling to one side, sudden neck/spine jerks, and often one arm hanging dead. Runners flail, brutes are heavy and slow, crawlers drag a leg behind them.

Three.js r160 (CDN importmap), ACES tonemapping, fog, canvas textures, view-model (crowbar / SMG / flashlight), particle bursts, falling planks, flare smoke. **Fixed light inventory per floor** (lights are dimmed, never removed) so shaders never recompile on stairs. Only the current floor ±1 renders and simulates. Resolution drops automatically at low FPS.

## 12. UI

Menu (solo / host / join, language, mode, continue) · lobby · intro comic + mission brief · HUD (bars, inventory, objective line + "HOW" panel with keys, threat ring, waypoint or "search the rooms" hint, multi-row prompt with colored key badges) · [Tab] plan · pause · CCTV · notes · chapter comics · death/respawn · victory.

**Saves (solo):** every 5 s to localStorage, format v3 (step key, flags, inventory, gates, boards, items). The roof is replayed from its start after a continue.

## 13. Co-op

PeerJS/WebRTC, host-authoritative. Progress is shared: the step index (`qi`) and story flags (`flag`) are broadcast. Guests' crowbar hits are sent to the host (`zhit`). Late joiners get the snapshot after their world is built. Ji-eun's position is synced in snapshots. Saves are solo only.

## 14. Tech & deployment

`index.html` + `css/style.css` + `js/game.js` (one ES module) + `js/vox.js` + `assets/`. No build step, no backend. GitHub Pages (with `.nojekyll`), Netlify, Vercel or itch.io. Tests: `npm test` (`_sim/build.mjs` builds a Node copy of the game with a stub renderer; `_sim/harness.mjs` runs it).
