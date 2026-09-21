# ROOFTOP ESCAPE — Player Feedback Report

**Project:** Rooftop Escape — Outbreak (3D first-person zombie survival escape, browser)
**Team (Group 01 — Rooftop Escape):** Bryan Tjandra (2026280195) · Phan Ngoc Anh (2026280645) · 侯嘉琪 (2026214164) — AI + Innovative Design, Open FIESTA, Tsinghua University
**Play:** https://bryan273.github.io/rooftop-escape/ · **Code:** https://github.com/bryan273/rooftop-escape
**Collected:** 19–21 September 2026 · **Respondents:** 13 people · **Evidence items:** 16 screenshots in `evidence/`

---

## 1. How the feedback was collected

| Channel | How | Items |
|---|---|---|
| **GitHub Issues** (structured form: mode · how far · best moment · most frustrating moment · bugs) | Link shared with the play link | F03, F04, F10 |
| **WeChat / QQ group chats** (classmates) | Play link posted, free-form replies | F01, F02, F08, F14 |
| **Messenger / WhatsApp / Instagram DM** (friends outside the course) | Play link sent 1-to-1, asked for honest criticism | F05, F06, F07, F09, F11, F12, F13 |

The structured GitHub form asks the same five questions every time, so the answers can be compared; the chat feedback is unfiltered and produced most of the bug reports.

**Languages:** replies arrived in Chinese, Vietnamese, Indonesian and English. Every entry below is quoted in the original and translated.

---

## 2. Summary of what players said

**Liked** (unprompted, repeated by several people): atmosphere and sound design (F01, F02, F12, "晚上不敢一个人玩" — *too scary to play alone at night*), the story and the in-world notes (F04, F07, F10), the colour palette and key hints (F01), graphics (F07, F12), puzzle progression and dynamic audio (F10).

**Main criticisms**, in order of how often they came up:

1. **Too easy / not enough tension** — 3 people (F04, F05, F06, F07, F13). The rooftop finale especially: *"ammo is plentiful, you just stand and empty a magazine, 1 shot 1 kill"*.
2. **Bugs in the zombie AI** — 3 people (F03, F08, F09): zombies aggroing across floors, zombies appearing on floors the player has not visited, a crawler attacking from the floor.
3. **Onboarding / clarity** — 3 people (F10, F13, F11): not always sure what to do next; the HUD teaches 14 keys at once; the "backup generator" instruction is too wordy.
4. **UI bugs** — 2 people (F08, F11): `[Esc]` in a note popup opened the pause menu instead of closing the note.
5. **Polish** — camera occasionally snapping 180° (F13, F14), no tracer/muzzle effect on the gun (F14), footsteps giving away hidden zombies (F11).

---

## 3. Feedback log — every item, and what we did about it

Legend: ✅ **Implemented** · 🟡 **Partly implemented** · 🔭 **Planned (future work)** · 💬 **Praise / no action needed**

### F01 — cp_cp (WeChat, 21 Sep) · `evidence/F01.png`
> 「感觉配色挺好看、然后按键提示也很详细。」 — *"The colour palette looks good, and the key prompts are very detailed."*

💬 Praise. Noted as a reason **not** to strip the on-screen key legend when we simplified the HUD (see F13).

### F02 — Meo (WeChat, 21 Sep) · `evidence/F02.png`
> 「很有氛围感，音乐恰到好处，指示做的也不错，晚上不敢一个人玩。」 — *"Great atmosphere, the music is just right, the instructions are well done — I wouldn't dare play alone at night."*

💬 Praise for 侯嘉琪's audio work (heartbeat/tension system, recorded SFX). No action.

### F03 — Oranger-I (GitHub issue #2, structured form) · `evidence/F03.png`
> Mode: Nightmare · Reached: 14 mins · Best moment: "shoot teacher Pu" (Mr. Park) · **Most frustrating: "A zombie is lying on the ground attacking me"** · Bugs: zero

🟡 **Partly implemented.** The crawler was hard to see and hard to read. It now carries a **health bar above its body** (lowered for the crawling pose) so you can tell how close it is to dying, and **bare fists always work**, so being caught mid-reload no longer means being helpless. Commit `29293e1`.
🔭 Still open: a dedicated "shake it off" animation when a crawler reaches your ankles.

### F04 — phantuanhung1998-coder (GitHub issue #1) · `evidence/F04.png`
> 1. The story is great. 2. I was able to play through the whole game. 3. **You should add difficulty levels.** 4. **The zombies' design should be more terrifying.** 5. **Add more weapons.** 6. Overall really good, you should make a sequel.

🟡 **Partly implemented (3).** Difficulty was raised across the board instead of adding a separate slider: zombie health roughly doubled (shambler 3→7 hp), the rooftop sends up to 34 enemies, and a boss was added. Two modes (Nightmare / Daylight Drill) already exist as the "difficulty levels".
🔭 **(4) Scarier zombie design** and 🔭 **(5) more weapons** — future work. Current roster is fists / crowbar / SMG plus flares; a shotgun and a melee weapon with a wind-up were scoped but not built before the deadline.

### F05 — Nguyễn Phùng Huy (Messenger, 19 Sep) · `evidence/F05.png`
> *"…khi đã lên đến tầng thượng thì cảm giác muốn win game của người chơi rất cao, **kiểu boss ở màn cuối ấy**, nên nếu m tăng thêm chi tiết cho zom … cũng tăng thêm phần kịch tính với cả thú vị cho game."*
> — *"Once you reach the rooftop the player really wants to win — it feels like it should have a boss for the final stage. Adding more detail to the zombies would make it more dramatic and more fun."*

✅ **Implemented.** The rooftop finale now ends with a named boss, **THE BUTCHER**: 1.75× size, 60 hp (≈10 SMG rounds), a permanent health bar, and its own entrance line as it climbs over the parapet ~16 s after the flare. Commit `29293e1`. Screenshot: `../05_Screenshots/06_rooftop_siege_and_boss.png`.

### F06 — Nguyễn Phùng Huy (Messenger, same session) · `evidence/F06.png`
> *"uh thế có khi m phải up cái level ở sân thượng lên, đạn m cho nhiều thì chỉ cần đứng sấy nguyên một băng như thế thì ez quá … uh bắn nó cũng dễ chết, 1 phát 1 … kiểu đứng trong cái vòng đó thì phải kịch tính hơn, vd bno lao từ tứ phía"*
> — *"You should raise the level of the rooftop: with that much ammo you just stand there and empty a magazine, too easy … they also die in one shot. Holding that circle should be more dramatic — for example, have them charge in from all sides."*

✅ **Implemented.** Body shots now take **2 rounds** for a shambler (1 head shot), a brute takes 3; the hold sends up to **34 zombies in 30 seconds**, in waves of 4 every 4 s, entering from **four directions** (roof door, both parapets, the west face). Commit `29293e1`.

### F07 — Nguyễn Phùng Huy (Messenger, same session) · `evidence/F07.png`
> *"Còn về phần đồ họa với cả cốt truyện thì quá ok rồi … nếu m có thời gian thì có thể tăng độ khó lên một tí chẳng hạn: cho mấy con zom **chạy nhanh hơn, sống dai hơn** làm cho người chơi dễ chết hơn để **tăng tính replay**."*
> — *"Graphics and story are already great … if you have time, raise the difficulty a bit: make the zombies faster and tankier so the player dies more easily — it adds replay value."*

🟡 **Partly implemented.** "Tankier" is done (health roughly doubled, boss added). "Faster" was deliberately **not** applied globally: zombies already run at three different paces (0.8× / 1.0× / 1.18×) and playtests showed that uniformly faster enemies removed the stalking tension. 🔭 A "Hard" mode that raises speed on top of the current tuning is the natural next step.

### F08 — 堂前燕 (QQ group, 21 Sep) · `evidence/F08.png`
> 「然后小怪的机制是不是有点问题，疑似会刷除了还没去过的层级的怪」 — *"Is something wrong with the enemy mechanic? It seems to spawn enemies on floors I haven't visited yet."*
> 「然后一直在走来走去有音效」 — *"There is a footstep sound the whole time while walking around."*
> 「另外一个问题是交互物品出二级菜单时，提示可以按e或esc退出，实际按esc的话会跳到暂停页面」 — *"When an item opens a second-level menu, the hint says press E or Esc to exit, but pressing Esc jumps to the pause screen."*

✅ **Implemented (Esc bug).** `[Esc]` inside a note/second-level popup now closes the popup instead of opening the pause menu. Commit `427932d`.
✅ **Implemented (enemies on other floors).** Zombies that changed floor stayed rendered in their *old* floor group, which made them appear and disappear in the wrong places; they now move to their current floor's group. Commit `8bb092d`.
🟡 Footstep audio is already distance-attenuated; see F11 for the "footsteps spoil the surprise" point. 🔭 An option to lower ambient footstep volume is planned.

### F09 — Leonardo Matthew 姚毅海 (chat, Indonesian) · `evidence/F09.png`
> *"aku udah main sampek floor 3 … tapiii ada satu problem ko: **zombie dari floor atas bisa ke agro waktu masih di floor bawah**. trus waktu pindah floor misale dari floor 1 ke floor 2 zombie nya kan ke agro waktu kita naik tapi **zombie ne lari ke arah satunya** … Tapi function e sama guide e jelas seh, lumayan cepet pahame."*
> — *"I played to floor 3 … but there's one problem: zombies on the floor above aggro while you're still on the floor below. And when you move from floor 1 to floor 2 they aggro but then run the other way … the functions and the guide are clear though, easy to pick up."*

✅ **Implemented.** Two root causes: (a) targeting read the player's floor from the wrong field, so a zombie one floor up thought you were next to it; (b) pathing was straight-line, so once it lost the direct line it walked into a wall and looked like it was "running the other way". Zombies now use a **0.5 m walkable grid with a BFS flow field** per floor — they leave the room through the doorway, round partitions and follow the corridor. Commits `8bb092d`, `f255fc9`.

### F10 — bihurin31204 (GitHub issue #3, structured form) · `evidence/F10.png`
> Mode: Daylight · Best moment: *"exploring the environment and figuring out what to do next. The puzzle progression and atmosphere make the game feel engaging, and the dynamic audio adds to the tension."*
> **Most frustrating:** *"Sometimes I wasn't completely sure what I was supposed to do next, especially when there were multiple areas to explore. A slightly clearer objective indicator could make the progression easier to follow."* · Bugs: none

✅ **Implemented.** The HUD now shows the **short mission line** at all times, and pressing **[I]** opens the "HOW" panel **and the objective arrow + distance**. The arrow is hidden until asked for on purpose — exploring first is the intended experience, and the help is one key away when you are stuck. The key legend stays on screen permanently (F01, F13).

### F11 — Hani (chat, Indonesian) · `evidence/F11-a.png`, `evidence/F11-b.png`
> *"GW HRS MAIN YG NIGHT MODE JG NIH — jantungku"* — *"I had to play night mode too — my heart!"*
> *"yg night mode kalo mau lu bikin lebih serem lagi kayaknya **kasih satu lantai gak ada suara zombie jadi tenang gitu, terus nanti tiba-tiba pas buka pintu ada jumpscare** zombienya didepan mukalu"* — *"to make night mode scarier: give one floor with no zombie sounds so it feels calm, then a jumpscare right in your face when you open a door."*
> *"kadang tuh gua **ke-spoiler sama zombienya karena ada suara langkah** mereka"* — *"sometimes the zombies are spoiled for me by their footsteps."*
> *"apa itu item item depan pintu ngalangin"* — *"what are those items blocking the door?"* · *"stairs nunjuk sono tapi jalan buntu"* — *"the stairs arrow points there but it's a dead end"* · *"tombol esc, resume kadang error"* — *"the Esc / resume button sometimes errors."*

✅ **Implemented (Esc/resume).** Same fix as F08 — commit `427932d`.
✅ **Implemented (floor arrows pointing the wrong way).** The painted floor arrows were rotated incorrectly and pointed away from the stairwell; fixed earlier in the sprint (`8065279` series).
✅ **Implemented (items blocking doors).** Doorways now have a keep-clear zone so loot and furniture can no longer spawn in front of a door.
🔭 **Planned: the silent floor + door jumpscare.** Exactly the kind of pacing beat the game lacks — Floor 6 is already "unnaturally quiet" by design, so the door-opening scare is the missing half.
🔭 **Planned: footsteps spoiling the surprise.** Considered a real design tension: the threat ring plus footsteps are what make the game readable, so the fix is a *quiet* stalker variant rather than removing footsteps.

### F12 — Daniel Ferdiansyah (chat, Indonesian) · `evidence/F12.png`
> *"soundnya ngeri juga wokwkw"* · *"anjirr grafisnya oke juga kak"* · *"bikin solo kah"*
> — *"the sound is genuinely scary"* · *"the graphics are good too"* · *"did you make this solo?"*

💬 Praise for audio and visuals. No action.

### F13 — Bryan 'Ilman (chat, Indonesian — longest report, two sessions with video) · `evidence/F13-a.png`, `evidence/F13-b.png`
> *"yg gw notice tuh di level beginner kenapa terang banget jadi fungsi flashlight ga dibutuhkan"* — *"in beginner level it's so bright the flashlight isn't needed."*
> *"**camera kadang gabisa gerak ke arah kanan**, kayak layarnya mentok sampe tengah"* — *"the camera sometimes can't turn right, as if the screen stops halfway."*
> *"gw kesusahan cari backup generator setelah dapet red key, **butuh petunjuk yg clear, singkat/padat** krn yg skrng kerasa terlalu bertele-tele"* — *"I struggled to find the backup generator after the red key; the instructions need to be clear and concise, the current ones are too long-winded."*
> *"mungkin di awal bilang perlu buka-bukain ruangan untuk cari crowbar"* — *"maybe say at the start that you need to open rooms to find the crowbar."*
> *"**resources terlalu banyak** untuk survival game"* — *"too many resources for a survival game."*
> *"**HUDnya langsung nyemplungin 14 tombol** di dua baris atas, plus objective, plus hint, plus subtitle radio … mungkin ajarin 3 tombol dulu (WASD, E, Q), sisanya munculin pas pertama kali dibutuhin"* — *"the HUD drops 14 keys on you at once … maybe teach 3 keys first and reveal the rest when they're first needed."*
> *"**konsekuensi ketika bunuh Ji-eun ga terlalu kerasa ke gameplay**, tapi dari segi cerita oke sih"* — *"killing Ji-eun has no real gameplay consequence, though it works story-wise."*

✅ **Implemented (Ji-eun consequence).** Killing her is no longer free: ~2.6 s after she dies the safe room is breached and **ten zombies (one of them a brute) pour down the corridor**, with a message that says plainly why. Commit `29293e1`.
✅ **Implemented (instructions too long).** The mission text was cut to a one-line objective; the step-by-step "HOW" is behind **[I]** (F10).
🟡 **Partly implemented (too many resources).** Enemies now need 2–4× more hits, which consumes the same loot much faster. Loot counts themselves were not reduced — 🔭 a lower loot multiplier for Nightmare is the follow-up.
🟡 **Partly implemented (HUD overload).** The mission panel and objective arrow are hidden until [I]; the key legend stayed visible because other testers valued it (F01). 🔭 The full idea — teach WASD/E/Q first and reveal each key the first time it is needed — is a planned onboarding pass.
🔭 **Open bug: camera sometimes stops turning right.** Reproduced only on his machine so far; suspected pointer-lock recovery after an overlay closes. See also F14. Highest-priority open bug.
ℹ️ Daylight Drill is intentionally bright (kid-friendly mode); the flashlight matters in Nightmare.

### F14 — FLAME & 一天八十根树枝 (WeChat group, 21 Sep) · `evidence/F14.png`
> 「枪械没有弹道和开火特效」 — *"The gun has no tracer or muzzle-flash effect."*
> 「**转视角的时候有时候会突然转到180度**」 — *"When turning the camera it sometimes suddenly snaps 180°."*

🔭 **Planned (gun VFX).** There is a muzzle light but no tracer or shell effect; a tracer line plus a brighter flash is a small, high-value polish item.
🔭 **Open bug (camera snap), same as F13.** Two independent reports make this the most important remaining defect. Suspected cause: a large accumulated `movementX` delivered in one event after pointer lock is re-acquired. Planned fix: clamp per-event mouse delta and drop the first event after a lock change.

---

## 4. What changed because of this feedback

| # | Change shipped | Feedback that asked for it | Commit |
|---|---|---|---|
| 1 | Rooftop boss **THE BUTCHER** (60 hp, ~10 SMG rounds, permanent health bar) | F05 | `29293e1` |
| 2 | Rooftop siege: up to **34 zombies** in waves of 4 from **4 directions**, mixed types | F06, F07 | `29293e1` |
| 3 | Enemies take 2–4× more killing (shambler 3→7 hp, brute 8→16, head shots still reward aim) | F04, F06, F07, F13 | `29293e1` |
| 4 | **Health bar above hurt enemies** | F03 | `29293e1` |
| 5 | **Bare fists** as a permanent fallback weapon (≈4 punches per shambler) | F03 | `29293e1` |
| 6 | **Killing Ji-eun now has a gameplay consequence** (10 zombies breach the safe room) | F13 | `29293e1` |
| 7 | **Objective arrow + "HOW" panel on [I]**, one-line mission otherwise | F10, F13 | `8065279`, `29293e1` |
| 8 | **Zombie pathfinding** (0.5 m grid + BFS flow field): they leave rooms through doors, round partitions, follow corridors | F09, F08 | `8bb092d`, `f255fc9` |
| 9 | **No attacks through walls or closed doors** (`reachClear` separated from line of sight) | F09 (invisible attacker), F03 | `8bb092d` |
| 10 | **Fully hidden enemies are not drawn** — no more arms poking through thin walls | F11 (getting spoiled), F09 | `f255fc9` |
| 11 | **Zombies on the wrong floor group** fixed (they appeared on floors you had not reached) | F08 | `8bb092d` |
| 12 | **[Esc] closes a note instead of opening the pause menu** | F08, F11 | `427932d` |
| 13 | **Floor arrows and the stairwell sign** pointed the wrong way; overlapping signs fixed; doorways kept clear of loot | F11 | `8065279`, `8330792` |
| 14 | **Laptops with touchscreens** were wrongly blocked as "mobile device" | reported while sharing the link | `98aecf8` |

## 5. Open items / future work

| Priority | Item | From |
|---|---|---|
| **High** | Camera occasionally snaps 180° / stops turning right (clamp per-event mouse delta, drop the first event after a pointer-lock change) | F13, F14 |
| High | Onboarding pass: teach WASD/E/Q first, reveal each key the first time it is needed | F13 |
| Medium | Loot density down in Nightmare ("too many resources for a survival game") | F13 |
| Medium | Scarier enemy design; a "Hard" mode that also raises speed | F04, F07 |
| Medium | More weapons (shotgun, heavier melee) | F04 |
| Medium | Pacing beat: one deliberately silent floor, then a door jumpscare | F11 |
| Low | Gun tracer + stronger muzzle flash | F14 |
| Low | Quiet stalker variant so footsteps do not always give enemies away | F11, F08 |
| Low | Crawler "shake it off" interaction when it grabs your ankles | F03 |

## 6. Honest notes on this report

- Every quote is transcribed from the screenshots in `evidence/`; translations are ours. Nothing here is invented or paraphrased into praise — the criticism section is longer than the praise section on purpose.
- Three respondents (F05–F07 are the same person across one conversation) means **13 distinct people**, 16 evidence images, 14 feedback entries.
- Feedback that we did **not** act on is listed in §5 with the reason, rather than being left out.
