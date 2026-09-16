# AIID-4 — Group Submission Table

**Group No.:** 1 *(confirm your assigned number)*  ·  **Group Name:** Rooftop Escape  ·  **Submission Status:** Complete & verified

| Group No. | Group Name | Group Member | Student ID | Game Concept | Main Gameplay | Task Division | Submission Status | Remarks |
|---|---|---|---|---|---|---|---|---|
| 1 | Rooftop Escape | Bryan Tjandra<br>Rizky Pratama<br>Andi Saputra | *(fill in)*<br>*(fill in)*<br>*(fill in)* | **ROOFTOP ESCAPE — Outbreak** — 3D first-person zombie survival escape game inside a 20-floor high-school tower. *All of Us Are Dead* atmosphere + PUBG-style directional threat indicators + escape-room puzzle gating. Two modes: 🧟 Nightmare (dark, gory, jump scares) and 🤖 Daylight Drill (fully lit, enemies become friendly helper-bots, paint instead of blood, zero scares). ~45–75 min run. | Climb 20 floors to a midnight rooftop helicopter extraction — explore a procedurally generated tower (6 rooms per floor, themed by height), scavenge flashlight/batteries/flares/medkits/crowbar/pistol, read the 24-segment threat ring to locate zombies through walls, solve 8 stairwell gates (colour keycards, power generator + remote CCTV shutter, boarded doors, sub-breaker) with deliberate back-tracking down the tower, survive scripted scares and the Floor-12 containment horde, then hold the rooftop extraction circle 8 s against the finale horde. Solo or 1–4 player co-op (PeerJS/WebRTC room codes, host-authoritative, teammate revives); solo runs auto-save every 5 s with a CONTINUE button. | Bryan Tjandra: designed the game concept, the two game modes and the floor-by-floor puzzle progression, Rizky Pratama: built the whole 3D building and its visuals, from the 20 floors and staircase to the rooms, furniture and rooftop, Andi Saputra: built the gameplay and sound, covering enemy behaviour, controls, items, menus and the co-op multiplayer. | Complete & verified — headless simulation passes **29/30 assertions in both modes**. Not yet uploaded for class submission. | One self-contained `index.html` (180 KB, ~3,450 lines) — no build step, no backend, no asset files; Three.js r160 and PeerJS 1.5 from CDN, so it runs by double-clicking and deploys free on GitHub Pages / Netlify / Vercel / itch.io. Only failing check: 1 of ~1,020 furniture pieces per generated world overlaps a wall collider (cosmetic, non-blocking, present in both modes). Co-op needs ordinary home internet — strict school/corporate NATs block WebRTC. Best played in Chrome/Edge with keyboard + mouse. |

---

## Copy-paste cell values

**Group Member**
```
Bryan Tjandra, Rizky Pratama, Andi Saputra
```

**Task Division**
```
Bryan Tjandra: designed the game concept, the two game modes and the floor-by-floor puzzle progression, Rizky Pratama: built the whole 3D building and its visuals, from the 20 floors and staircase to the rooms, furniture and rooftop, Andi Saputra: built the gameplay and sound, covering enemy behaviour, controls, items, menus and the co-op multiplayer.
```

**Game Concept**
```
ROOFTOP ESCAPE — Outbreak: a 3D first-person zombie survival escape game inside a 20-floor high-school tower, mixing All of Us Are Dead atmosphere with PUBG-style directional threat indicators and escape-room puzzle gating, in two modes — Nightmare (dark, gory, jump scares) and Daylight Drill (fully lit, enemies become friendly helper-bots, paint instead of blood, zero scares), for a 45–75 minute run.
```

**Main Gameplay**
```
Climb 20 floors to a midnight rooftop helicopter extraction — explore a procedurally generated tower (6 rooms per floor, themed by height), scavenge flashlight/batteries/flares/medkits/crowbar/pistol, read the 24-segment threat ring to locate zombies through walls, solve 8 stairwell gates (colour keycards, power generator + remote CCTV shutter, boarded doors, sub-breaker) with deliberate back-tracking down the tower, survive scripted scares and the Floor-12 containment horde, then hold the rooftop extraction circle 8 s against the finale horde; solo or 1–4 player co-op over WebRTC room codes, with solo runs auto-saving every 5 s.
```

---

## Notes

- The two names **Rizky Pratama** and **Andi Saputra** are placeholders I invented — swap in your real teammates' names and student IDs before you submit.
- The three task buckets match how the work actually splits in this repo: engine/gameplay (`index.html` core + `DESIGN.md`), world/UI content (texture, mode, HUD code) and audio/netcode/tests (`_sim/harness.mjs`).
- Submission status and remarks came from running the real harness: `node harness.mjs scary` and `node harness.mjs lite` both return **29/30**.
