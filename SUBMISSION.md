# AIID-4 — Group Submission Table

**Group No.:** 1 *(confirm your assigned number)*  ·  **Group Name:** Rooftop Escape  ·  **Submission Status:** Complete & verified

| Group No. | Group Name | Group Member | Student ID | Game Concept | Main Gameplay | Task Division | Submission Status | Remarks |
|---|---|---|---|---|---|---|---|---|
| 1 | Rooftop Escape | Bryan Tjandra<br>Rizky Pratama<br>Andi Saputra | *(fill in)*<br>*(fill in)*<br>*(fill in)* | **ROOFTOP ESCAPE — Outbreak** — 3D first-person zombie survival escape game inside a 6-floor high school. *All of Us Are Dead* atmosphere + PUBG-style directional threat indicators + escape-room puzzle gating. Two modes: 🧟 Nightmare (dark, gory, jump scares) and 🤖 Daylight Drill (fully lit, enemies become friendly helper-bots, paint instead of blood, zero scares). ~30–45 minute run. | Climb 6 floors to a midnight rooftop helicopter extraction through a strict 24-step mission chain (no step can be skipped) — scavenge flashlight/batteries/flares/medkits/crowbar/SMG, read the 24-segment threat ring, kick and pry boarded doors, restore power, use the CCTV terminal, find the bitten Mr. Park and put him down when he turns, search for Ji-eun (who then fights alongside you), open 6 stairwell gates with deliberate back-tracking, then light a signal flare on the roof and hold the landing circle for 30 s against the rooftop horde. Solo or 1–4 player co-op (PeerJS/WebRTC room codes, host-authoritative, teammate revives); solo runs auto-save every 5 s with a CONTINUE button. | Bryan Tjandra: designed the game concept, the two game modes and the floor-by-floor puzzle progression, Rizky Pratama: built the whole 3D building and its visuals, from the 6 floors and staircase to the rooms, furniture and rooftop, Andi Saputra: built the gameplay and sound, covering enemy behaviour, controls, items, menus and the co-op multiplayer. | Complete & verified — headless simulation plays the full 24-step mission chain and passes **45/45 (Nightmare) and 44/44 (Daylight)** checks. Not yet uploaded for class submission. | Static site (`index.html` + `css/` + `js/` + `assets/`) — no build step, no backend; Three.js r160 and PeerJS 1.5 from CDN; serve with any static web server and deploy free on GitHub Pages / Netlify / Vercel / itch.io. Co-op needs ordinary home internet — strict school/corporate NATs block WebRTC. Best played in Chrome/Edge with keyboard + mouse. |

---

## Copy-paste cell values

**Group Member**
```
Bryan Tjandra, Rizky Pratama, Andi Saputra
```

**Task Division**
```
Bryan Tjandra: designed the game concept, the two game modes and the floor-by-floor puzzle progression, Rizky Pratama: built the whole 3D building and its visuals, from the 6 floors and staircase to the rooms, furniture and rooftop, Andi Saputra: built the gameplay and sound, covering enemy behaviour, controls, items, menus and the co-op multiplayer.
```

**Game Concept**
```
ROOFTOP ESCAPE — Outbreak: a 3D first-person zombie survival escape game inside a 6-floor high school, mixing All of Us Are Dead atmosphere with PUBG-style directional threat indicators and escape-room puzzle gating, in two modes — Nightmare (dark, gory, jump scares) and Daylight Drill (fully lit, enemies become friendly helper-bots, paint instead of blood, zero scares), for a 30–45 minute run.
```

**Main Gameplay**
```
Climb 6 floors to a midnight rooftop helicopter extraction through a strict 24-step mission chain (no step can be skipped) — scavenge flashlight/batteries/flares/medkits/crowbar/SMG, read the 24-segment threat ring, kick and pry boarded doors, restore power, use the CCTV terminal, find the bitten Mr. Park and put him down when he turns, search for Ji-eun (who then fights alongside you), open 6 stairwell gates with deliberate back-tracking, then light a signal flare on the roof and hold the landing circle for 30 s against the rooftop horde; solo or 1–4 player co-op over WebRTC room codes, with solo runs auto-saving every 5 s.
```

---

## Notes

- The two names **Rizky Pratama** and **Andi Saputra** are placeholders I invented — swap in your real teammates' names and student IDs before you submit.
- The three task buckets match how the work actually splits in this repo: engine/gameplay (`js/game.js` core + `DESIGN.md`), world/UI content (texture, mode, HUD code) and audio/netcode/tests (`_sim/harness.mjs`).
- Submission status and remarks came from running the real harness: `npm test` (Nightmare 45/45, Daylight 44/44), plus Chinese and co-op runs.
