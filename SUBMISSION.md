# AIID-4 — Group Submission Table

**Group No.:** 01  ·  **Group Name:** Rooftop Escape  ·  **Submission Status:** Complete & verified

| Group No. | Group Name | Group Member | Student ID | Game Concept | Main Gameplay | Task Division | Submission Status | Remarks |
|---|---|---|---|---|---|---|---|---|
| 01 | Rooftop Escape | 侯嘉琪<br>Phan Ngoc Anh<br>Bryan Tjandra | 2026214164<br>2026280645<br>2026280195 | **ROOFTOP ESCAPE — Outbreak** — 3D first-person zombie survival escape game inside a 6-floor high school. *All of Us Are Dead* atmosphere + PUBG-style directional threat indicators + escape-room puzzle gating. Two modes: 🧟 Nightmare (dark, gory, jump scares) and 🤖 Daylight Drill (fully lit, enemies become friendly helper-bots, paint instead of blood, zero scares). ~30–45 minute run. | Climb 6 floors to a midnight rooftop helicopter extraction through a strict 24-step mission chain (no step can be skipped) — scavenge flashlight/batteries/flares/medkits/crowbar/SMG, read the 24-segment threat ring, kick and pry boarded doors, restore power, use the CCTV terminal, find the bitten Mr. Park and put him down when he turns, find Ji-eun and decide in 7 seconds whether to trust or kill her, open 6 stairwell gates with deliberate back-tracking, then light a signal flare on the roof and hold the landing circle for 30 s against a 34-zombie siege and a boss. Bare fists always work (about four punches per zombie), and hurt enemies show a health bar. Solo or 1–4 player co-op (PeerJS/WebRTC room codes with an automatic relay fallback for VPNs and strict networks; host-authoritative shared world; voice chat, item giving, 3 revives, turned players become spectators); English, Chinese, Vietnamese and Indonesian; solo runs auto-save every 5 s with a CONTINUE button. | Bryan Tjandra: core gameplay and systems — engine, building, stairs, mission chain, combat, companions, co-op, tests, landing page and docs; Phan Ngoc Anh: experience, UI and story — survival-horror overhaul, six-floor story, chapter comics, mission window, respawn flow; 侯嘉琪: audio — recorded sound effects, heartbeat and tension system, helicopter and thunder. | Complete & verified — headless simulation plays the full 24-step mission chain and passes **64/64 (Nightmare), 66/66 (Daylight), 64/64 (Chinese) and 61/61 (co-op)** checks. Not yet uploaded for class submission. | Static site (`index.html` landing + `play.html` game + `css/` + `js/` + `assets/`) — no build step, no backend; Three.js r160 and PeerJS 1.5 from CDN; serve with any static web server and deploy free on GitHub Pages / Netlify / Vercel / itch.io. Co-op connects directly when possible and otherwise through a public MQTT relay, so it also works behind VPNs and strict networks. Best played in Chrome/Edge with keyboard + mouse. |

---

## Copy-paste cell values

**Group Member**
```
侯嘉琪 (2026214164), Phan Ngoc Anh (2026280645), Bryan Tjandra (2026280195)
```

**Task Division**
```
Bryan Tjandra: core gameplay and systems — engine, building, stairs, mission chain, combat, companions, co-op, tests, landing page and docs; Phan Ngoc Anh: experience, UI and story — survival-horror overhaul, six-floor story, chapter comics, mission window, respawn flow; 侯嘉琪: audio — recorded sound effects, heartbeat and tension system, helicopter and thunder.
```

**Game Concept**
```
ROOFTOP ESCAPE — Outbreak: a 3D first-person zombie survival escape game inside a 6-floor high school, mixing All of Us Are Dead atmosphere with PUBG-style directional threat indicators and escape-room puzzle gating, in two modes — Nightmare (dark, gory, jump scares) and Daylight Drill (fully lit, enemies become friendly helper-bots, paint instead of blood, zero scares), for a 30–45 minute run.
```

**Main Gameplay**
```
Climb 6 floors to a midnight rooftop helicopter extraction through a strict 24-step mission chain (no step can be skipped) — scavenge flashlight/batteries/flares/medkits/crowbar/SMG, read the 24-segment threat ring, kick and pry boarded doors, restore power, use the CCTV terminal, find the bitten Mr. Park and put him down when he turns, find Ji-eun and decide in 7 seconds whether to trust or kill her, open 6 stairwell gates with deliberate back-tracking, then light a signal flare on the roof and hold the landing circle for 30 s against the rooftop horde; solo or 1–4 player co-op over WebRTC room codes, with solo runs auto-saving every 5 s.
```

---

## Notes

- Team **Rooftop Escape** (Group 01): 侯嘉琪 — 2026214164 (GitHub `hallucinate`) · Phan Ngoc Anh — 2026280645 (GitHub `saltymiaaaa`) · Bryan Tjandra — 2026280195 (GitHub `bryan273`).
- Deliverables: landing page `index.html`, game `play.html`, project document `docs/PROJECT.md`, poster `poster.png` (source `poster.html`).
- The three task buckets match how the work actually splits in this repo: engine/gameplay (`js/game.js` core + `DESIGN.md`), world/UI content (texture, mode, HUD code) and audio/netcode/tests (`_sim/harness.mjs`).
- Submission status and remarks came from running the real harness: `npm test` (Nightmare 52/52, Daylight 54/54), plus Chinese and co-op runs.
