# 🧟 ROOFTOP ESCAPE — Outbreak

> **▶ PLAY IT LIVE: https://bryan273.github.io/rooftop-escape/**

A 3D first-person zombie survival escape game in **one single HTML file**. Inspired by *All of Us Are Dead* + PUBG-style audio indicators + escape-room puzzles.

## 🎭 Two game modes

| | 🧟 **NIGHTMARE** | 🤖 **DAYLIGHT DRILL** |
|---|---|---|
| Vibe | Dark, tense, gory | Bright, silly, zero scares |
| Enemies | Zombies (red glowing eyes) | Helper-bots with screen faces & antennae (4 color tints) |
| Lighting | Pitch black + flashlight, flickering fluorescents, red emergencies | Fully lit, daylight through windows, blue sky |
| Blood | Bloodstains & pools | Colorful paint splats |
| Sounds | Growls, screams, jump-scare stingers, reverb | Servos, beeps, boings, happy alarm |
| Events | Blackouts, door bursts, containment horde, thunder | Harmless light blinks, "bot parades" |
| Balance | Full damage/speed | −50% damage, −15% enemy speed, slower battery drain, +70% loot |
| Death text | "YOU DIED" | "YOU GOT BONKED" |

Pick a mode on the main menu (remembered for next time). In co-op, **the host's mode applies to the whole squad**. Both modes share the same 20-floor escape puzzles, threat ring, CCTV, co-op, and rooftop finale.

## ✨ Features

- **20 floors + rooftop finale** (with heavy brutes joining the last stand), ~45–75 min playthrough
- **Auto-save & Continue** — solo runs checkpoint to your browser every 5 seconds; the menu shows a **CONTINUE** button so a refresh never loses your climb
- **First-person** camera with a **third-person toggle** (V) — visible player body in 3rd person
- **First-person view-model**: your arm holds the crowbar/flashlight, swings on attack, sways as you walk
- **PUBG-style directional threat ring** — segments around your crosshair light up when enemies walk/run near you, even through walls (red = chasing in Nightmare, blue = chasing in Daylight)
- **Smart enemies**: they hear sprinting and creaking doors, chase up the real staircase, **force closed doors open** (you'll hear the bang first), and **wounded ones drip blood/paint trails** you can track (or be tracked by)
- **Escape-room progression**: keycards, power generators, CCTV terminal, boarded doors, back-tracking down and up the tower
- **Flashlight with battery drain**, flares, medkits, crowbar; melee sparks/blood particle bursts
- **Environmental detail**: room windows (night glow / daylight), ceiling pipes, vending machines, water coolers, elevator (permanently out of order… but it dings), posters, scattered papers, dust motes floating in your flashlight beam (Nightmare)
- **[Tab] objectives overlay** — hold Tab any time to see the full escape plan with your progress
- **Co-op multiplayer for up to 4 players** (PeerJS — no server needed, room codes)
- **All sound synthesized live** (Web Audio API): growls/servos, footsteps, stingers, heartbeat, alarms, elevator ding, helicopter — plus spooky reverb in Nightmare
- Zero assets, zero build step, zero backend. Free to deploy anywhere that serves static files.

---

## ▶ Run it

**Just double-click `index.html`** (needs internet once, to load Three.js from CDN).

Or serve it locally (identical result):

```bash
# any ONE of these
python -m http.server 8080     # then open http://localhost:8080
npx serve .
```

Tip: add `?nolock=1` to the URL for a debug/trackpad mode that doesn't pause when the mouse pointer isn't captured.

## 🎮 Controls

| Key | Action |
|---|---|
| **W A S D** | Move |
| **Mouse** / **Arrow keys** | Look (click the game once to capture the mouse) |
| **Shift** | Sprint — loud, attracts enemies |
| **Space** | Jump |
| **C** | Crouch (sneak — enemies notice you later) |
| **E** | Interact / hold for boards, breakers, revives |
| **F** | Flashlight on/off (drains battery) |
| **G** | Throw flare (distracts enemies for ~15 s) |
| **H** | Use medkit (+60 HP) |
| **1 / 2** | Weapon: crowbar / pistol |
| **LMB** | Attack with the equipped weapon |
| **V** | Toggle 1st / 3rd person |
| **Q** | Ping a marker for teammates |
| **Tab** (hold) | Objectives overlay |
| **Enter** | Chat (co-op) |
| **Esc** | Pause / settings (sensitivity, volume, FOV) |

## 🧠 How to survive

0. **Weapons:** find the **PISTOL** on the CCTV desk (Floor 2) — press **[2]** to draw, **LMB** to fire (one-shots shamblers, loud!). **[1]** = crowbar (2.3 m reach, backstab = double). Before either, LMB is a shove. Watch the windup: zombies telegraph for ~0.5 s before biting — sidestep, and after any hit you get 0.8 s of invulnerability.
1. **Read the ring.** The circle around your crosshair lights orange/blue = an enemy is walking nearby, **red (Nightmare) / bright blue (Daylight) = it's chasing you**. The direction of the segment = the direction of the threat.
2. **Read the floor.** Bloodstains (or paint splats) pooled around a door mean something is nesting inside. Boarded doors hide loot — pry them with the crowbar (loud!). Chasing enemies **bang doors open** — a closed door buys ~2 seconds, boards buy safety.
3. **Manage the flashlight.** It eats battery (~6 min per full charge in Nightmare, ~13 in Daylight). Batteries are scattered everywhere. Below 20 % it flickers and dims.
4. **The stairwell is life.** Gates between floors are locked — the objective tracker (top-left) always tells you what unlocks the next one. You *will* have to go back down.
5. **Flares > fights.** Throw one (G) down a corridor and walk the other way. Gunshots attract everything within 15 m.

### Progression (spoiler-light)
Entrance → find flashlight & crowbar → Floor 2 CCTV room (red keycard + generator) → Floor 6 security shutter (release it remotely from the CCTV terminal — yes, you go back down) → dark floors 8–9 (flares) → Floor 12 containment-breach horde → Floor 11 breaker backtrack → Floor 20 → **rooftop extraction hold** under the helicopter.

## 👥 Co-op multiplayer

1. One player clicks **Host Co-op** — a 5-letter room code appears (e.g. `VRVTX`).
2. Friends click **Join Co-op**, type the code, connect, and wait in the lobby.
3. Host presses **Start** — everyone wakes up together (late joiners spawn at the host's checkpoint floor).
- The **host's browser runs the world** (zombies, puzzles). If the host leaves, the room closes.
- Works peer-to-peer via WebRTC (PeerJS's free cloud broker). Works across the internet in most home networks; a few very strict corporate/school NATs may block it — a phone hotspot fixes that.
- Downed friends can be revived: walk to them and **hold E** for 3 s. Dead players respawn after 25 s at the tower.

## 🌍 Deploy it free

The whole game is one static file — pick any:

**GitHub Pages** (this folder is already a repo candidate)
```bash
git init && git add index.html && git commit -m "Rooftop Escape"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
# GitHub.com → Settings → Pages → Source: main branch → Save
# live at https://<you>.github.io/<repo>/
```

**Netlify Drop** — go to https://app.netlify.com/drop and drag `index.html` in. Done, instant https link.

**Vercel** — `npx vercel` in this folder, accept defaults.

**itch.io** — zip `index.html`, upload at https://itch.io/game-new as "HTML — playable in browser", check "this file will be played in the browser".

## 🛠 Troubleshooting

| Symptom | Fix |
|---|---|
| Black screen after menu | No internet — Three.js comes from a CDN. Load once online. |
| No sound | Browsers start audio only after a click — click "wake up". |
| Mouse doesn't turn | Click the game once to capture the pointer (or use `?nolock=1`). |
| Low FPS | The game auto-drops resolution once. Close other tabs; Chrome is fastest. |
| Friend can't join | Both sides need normal home internet; strict school/office NATs block WebRTC — try a hotspot. |

---
Made with Three.js + Web Audio + PeerJS. Fan-made, non-commercial.
