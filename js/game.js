import * as THREE from 'three';

/* =====================================================================
   SECTION A — CONFIG · STATE · UTILS · DOM · INPUT
===================================================================== */
window.addEventListener('error', e=>{
  const el=document.getElementById('err');
  el.style.display='block';
  el.textContent+='[ERR] '+(e.message||e.error)+'\n  at '+(e.filename||'')+':'+(e.lineno||'')+'\n';
});
const $=id=>document.getElementById(id);
const NOLOCK=new URLSearchParams(location.search).has('nolock'); // debug/trackpad mode: no pointer-lock pause
const CFG={
  FLOORS:7, FH:3.4,                       // levels: 0 = GROUND, 1..6 = FLOORS 1..6, 7 = ROOF
  PLATE:{x0:-24,x1:24,z0:-11,z1:11},
  TOWER:{x0:16,x1:24,z0:-2.5,z1:2.5},
  LANE:{x0:17,x1:23,z0:0.6,z1:1.8},      // stair lane footprint (hole in plates)
  STEP:0.25,                              // visual step depth
  CORR:{x0:-24,x1:16,z0:-1.6,z1:1.6},
  GRAV:-16, JUMP:5.0,
  WALK:3.7, SPRINT:6.2, CROUCH:1.7,
  EYE:1.62, EYE_CROUCH:1.0, R:0.35,
  BAT_DRAIN:100/360,                      // % per second while flashlight on
  ROOF_Y:0,                               // computed below
};
CFG.ROOF_Y=CFG.FLOORS*CFG.FH;
/* rooftop finale tuning: everything up there is faster and angrier */
const ROOF={
  SPEED:0.85, SPEED_FLARE:0.95,  // chase-speed multipliers (before / after the flare is lit)
  WINDUP:1.1, COOLDOWN:1.6,      // attack wind-up multiplier (>1 = slower), seconds between swings
  DMG:0.85,
  HOLD:30,                       // seconds the circle must be held
  WAVE_EVERY:11, WAVE_N:2, MAX_ALIVE:7,
  FIRST_WAVE:5,                  // seconds before the first wave
  TOTAL:30,                      // hard cap: zombies the roof sends in one run (waves + brute)
  RADIUS:2.0,
};

/* ---------------- game modes ---------------- */
const MODES={
  scary:{id:'scary',label:'NIGHTMARE',fog:0x040406,fogD:0.052,bg:0x020204,hemi:false,
    zSpeed:1,zDmg:1,batDrain:1,loot:1,blood:true,jumpscares:true,reverb:true,sky:'night',
    ringC:'255,45,35',ringW:'255,150,50',
    winE:0x141f33,winI:0.9},
  lite:{id:'lite',label:'DAYLIGHT DRILL',fog:0x9db4c8,fogD:0.026,bg:0x8fb3d4,hemi:true,
    zSpeed:0.85,zDmg:0.5,batDrain:0.45,loot:1.7,blood:false,jumpscares:false,reverb:false,sky:'day',
    ringC:'60,150,255',ringW:'255,175,60',
    winE:0xdfeeff,winI:1.5},
};
let MD=MODES.scary;   // active mode params — set before world build
/* scary sound name -> friendly replacement (used only when MD is lite) */
const LMAP={growl1:'servo',growl2:'whir',growl3:'beep',scream:'boing',screech:'boing',zstep:'rstep',
  stinger:'boing',alarm:'happyAlarm',hurt:'pop',whisper:'whir',creak:'servo',clang:'pop',
  snarl:'servo',zbreath:'whir',breath:'whir',pstepRun:'rstep',pstepWalk:'rstep',pstepSneak:'rstep',buzz:'whir',
  zroar:'boing',eat:'pop',zmouth:'servo',hitMelee:'pop',hitBullet:'pop',pscream:'boing',alert:'beep'};

/* ---------------- i18n (EN / 简体中文 / Tiếng Việt / Bahasa Indonesia) ---------------- */
const LANGS=['en','zh','vi','id'];
let LANG='en';
try{const l=localStorage.getItem('zf_lang');LANG=LANGS.includes(l)?l:'en';}catch(e){}
const I18N={
en:{
 /* ---- menu / lobby ---- */
 sub_scary:'Seowon High School · The Last Night',sub_lite:'Seowon High School · Helper-Bot Mischief Day',
 m_modelabel:'GAME MODE',m_namelabel:'YOUR NAME',lbl_lang:'Language',m_solo:'Solo Escape',m_host:'Host Co-op',m_join:'Join Co-op',m_connect:'Connect',
 m_roomcode:'ROOM CODE',tab_play:'Play',tab_how:'How to play',wake:'— CLICK TO WAKE UP —',
 footer:'A fan-made zombie escape · Three.js + WebAudio · free to deploy',
 mode_scary:'NIGHTMARE',mode_lite:'DAYLIGHT DRILL',
 mode_scary_d:'Dark halls · zombies · blood · jump scares · heartbeat',
 mode_lite_d:'Bright & friendly · silly helper-bots · paint splats · zero scares',
 howto:'<div class="hl"><b>What makes it special:</b> 🔀 <b>Branching story</b> — your 7-second choice about Ji-eun changes what happens next · 🧠 <b>AI companion</b> who fights, retreats and talks · 🔗 <b>24-step mission chain</b> · 🎧 <b>Heartbeat tension system</b> · 🚁 <b>Last stand</b> + cinematic ending.</div>'+
  '<b>Goal:</b> climb from the entrance hall to the <b>rooftop</b> — 6 floors — light the <b>signal flare</b> and survive <b>30 seconds</b> in the landing circle until the helicopter picks you up.<br>'+
  '<b>Missions are a chain.</b> Every step must be finished in order before the next one unlocks — the panel top-left always shows the current step and which key to use. Hold <b>[Tab]</b> for the whole plan.<br>'+
  '<b>Controls:</b> <b>[E]</b> take items · open doors · read notes · use terminals · swipe keycards · <b>talk</b> to survivors (again for the next line). '+
  '<b>[Q]</b> for physical work: <b>tap</b> it to kick boards in, <b>hold</b> it to pry boards, pull breakers, light the flare or revive a friend (you can let go and come back — progress is kept). <b>[Space]</b> only jumps.<br>'+
  '<b>Stairwell gates</b> are locked — keycards, power, the CCTV terminal (Floor 2) and a crowbar open them. You will have to go back down.<br>'+
  '<b>Listen.</b> The ring around your crosshair lights up when something moves near you. <b>Look.</b> Blood around a door means something inside. The upper floors have <b>no power</b> — flashlight [F] eats battery, grab batteries.<br>'+
  '<b>Flares [G]</b> pull enemies away. <b>Medkits [H]</b> heal. <b>Crouch [C]</b> to sneak. <b>Sprint [Shift]</b> is loud. <b>SMG [2]</b> (hold the mouse button for full-auto) is in the Floor 2 security room.<br>'+
  '<b>Two modes:</b> 🧟 NIGHTMARE — dark, zombies, blood. 🤖 DAYLIGHT DRILL — bright, friendly robots, zero scares. <b>Co-op:</b> host a room and share the code (up to 4, the host\'s mode applies; [T] chat, [Z] ping).<br>Keyboard + mouse. Click the game once to lock the mouse.',
 cont:'CONTINUE — {f} · {m}',
 lb_title:'SURVIVORS LOBBY',lb_share:'SHARE THIS ROOM CODE WITH YOUR FRIENDS',lb_copy:'click the code to copy · friends press “Join Co-op” and type it',
 lb_startn:'Start escape ({n} survivors)',lb_start0:'Start solo anyway',lb_wait:'Waiting for host…',lb_leave:'Leave',lb_copied:'COPIED!',
 lb_hostnote:'Host: keep this tab open and in front — the whole building runs on your computer.',
 msg_creating:'Creating room…',t_midjoin:'Joining an escape in progress…',t_midkit:'Starter kit: flashlight, crowbar and a few 9mm rounds.',lb_squad:'SURVIVORS',
 msg_connecting:'Connecting to {c}…',msg_connected:'Connected! Waiting for host…',msg_entercode:'Enter the room code your friend shared.',
 msg_slow:'Still connecting… some networks take up to 15 seconds.',msg_retry:'No answer yet — trying again…',msg_relay:'No direct route (VPN, proxy or network rules) — connecting through the relay…',msg_noroom:'Room {c} not found. Check the code, and keep the host\'s lobby open.',msg_p2pfail:'Couldn\'t reach the room, directly or through the relay. Check the code, make sure the host\'s lobby is still open, and that the internet works.',msg_neterr:'Network error: {e} — check your connection.',msg_hostclosed:'Host closed the room.',msg_kbm:'⚠ This game needs a keyboard and mouse.',
 /* ---- HUD ---- */
 hud_hp:'HEALTH',hud_st:'STAMINA',hud_bt:'FLASHLIGHT',hud_crowbar:'CROWBAR [1]',hud_flare:'FLARE [G]',hud_med:'MEDKIT [H]',hud_cards:'KEYCARDS',hud_ammo:'SMG [2]',
 floor:'FLOOR {n}',floor0:'GROUND — ENTRANCE',roof:'ROOFTOP — EXTRACTION',fl_ground:'GROUND',fl_roof:'ROOF',fl_floor:'F{n}',
 wp_roof:'⬆ STAIRWELL — up to the ROOFTOP',wp_up:'⬆ STAIRWELL — east end of the hall · up to {f}',wp_down:'⬇ STAIRWELL — east end of the hall · back down to {f}',
 wp_here:'OBJECTIVE · {d} m',wp_search:'NO MARKER — SEARCH THE ROOMS ON {f}',
 hint:'[E] take / open / use / talk · [Q] kick · [HOLD Q] pry / breaker / flare<br>[F] light · [G] flare · [H] medkit · [C] sneak · [1]/[2] weapon · [LMB] attack · [V] camera · [Tab] goals · [I] help · [Esc] pause',
 hint_mp:'<br>[T] chat · [Z] ping · HOLD [Q] on a downed friend to revive',
 k_e:'E',k_hold:'HOLD Q',k_enter:'E',k_space:'Q',mw_how:'HOW',help_show:'<b>[I]</b> Stuck? Show the way',help_hide:'<b>[I]</b> Hide help',
 col_red:'RED',col_blue:'BLUE',col_yellow:'YELLOW',col_green:'GREEN',
 pause_title:'PAUSED',opt_sens:'Mouse sensitivity',opt_vol:'Volume',opt_fov:'Field of view',btn_resume:'Resume',btn_quit:'Quit to menu',
 ctrl:'<div><b>WASD</b> move</div><div><b>Mouse</b> look</div><div><b>Shift</b> sprint (loud)</div><div><b>Space</b> jump</div><div><b>E</b> take · open · use · talk</div><div><b>Q (tap)</b> kick boards</div><div><b>Hold Q</b> pry · breaker · flare · revive</div><div><b>E / Enter</b> respawn</div><div><b>C</b> crouch (sneak)</div><div><b>F</b> flashlight</div><div><b>G</b> throw flare</div><div><b>H</b> use medkit</div><div><b>LMB</b> attack</div><div><b>1 / 2</b> crowbar / SMG</div><div><b>V</b> 1st / 3rd person</div><div><b>I</b> mission help</div><div><b>Tab</b> objectives</div><div><b>T / Z</b> chat / ping (co-op)</div><div><b>Esc</b> pause</div>',
 goals_title:'ESCAPE PLAN',
 cctv_hint:'◀ ▶ / A D — switch camera · [Q] — release the shutter (when it is time) · [E] / [Esc] — leave',cctv_cam:'CAM {n} — {m}',cl_next:'[SPACE] ▸ next',cc_you:'YOU',
 shutter_btn:'RELEASE FLOOR 3 SHUTTER',note_close:'[E] / [ESC] — put it down',
 death_h:'YOU DIED',death_l:'YOU GOT BONKED',death_p:'The building keeps your bones.',death_pl:'The bots gently roll you to a safe corner.',
 down_h:'YOU ARE DOWN',down_hl:'TACKLED!',
 down_mp:'A friend can revive you — hold on!',down_mp_l:'A friend can un-bonk you — hold on!',down_sp:'Nobody left to help you…',down_sp_l:'The bots are politely waiting. Ow.',
 down_help:'No retries left — a friend can HOLD [Q] next to you to help you up. Nobody coming? The run ends here.',
 death_restart:'The run is over. You will start again from the beginning.',
 lives_lbl:'RETRIES',btn_respawn:'RESPAWN NOW — [E]',death_left:'Respawning. Retries left after this: {n}',death_last:'This was your last retry — you get ONE more life. Die again and the run ends.',death_out:'No retries left. The tower keeps you.',skip:'SKIP ▶',
 /* ---- Ji-eun: suspicion, verdict, her voice ---- */
 sus_h:"⚠ SUSPICIOUS SURVIVOR",sus_hl:"🤔 SUSPICIOUS?",
 sus_who:"JI-EUN · alone on the infected floor",sus_whol:"JI-EUN · alone on the bot floor",
 sus_tell:"She might be <b>INFECTED</b>. Watch her closely while you talk <b>[E]</b>. When the talk ends you have <b>7 seconds</b> to decide: <b>TRUST</b> her or <b>KILL</b> her.",
 sus_telll:"Is she secretly a <b>bot</b>? Talk to her <b>[E]</b> and look for clues. Then you have <b>7 seconds</b> to decide.",
 sus_meter:"SUSPICION",
 sus_c0:"🩸 Blood on her sleeve, her hands, her cardigan",sus_c1:"😰 Shaking and sweating — won’t let you near",
 sus_c2:"🩹 Hides a bandage on her left arm",sus_c3:"🔥 Says the wound “burns” — like the bitten ones did",
 sus_c4:"👁 …but her eyes are clear, and she still sounds like herself",
 sus_c0l:"🎨 Paint splats on her sleeve",sus_c1l:"🙈 Won’t let you come close",sus_c2l:"💡 Something on her arm… blinking?",
 sus_c3l:"🤖 Says “beep” by accident",sus_c4l:"👁 …but she laughs like a real person",
 vd_trust_h:"YOU WERE RIGHT",vd_trust:"Ji-eun is <b>HUMAN</b>. The blood was Min-ho’s. The wound is a cut from a door.",
 vd_kill_h:"WRONG CHOICE",vd_kill:"Ji-eun was <b>HUMAN</b>. You killed your friend.<br>The wound was only a cut from a door.",
 vd_time_h:"TOO LATE",vd_time:"Ji-eun is <b>HUMAN</b> — but you hesitated, and they heard you. <b>Fight!</b>",
 vd_trust_l:"Ji-eun is a <b>real person</b>! Team-up time.",vd_kill_hl:"WRONG CALL",vd_kill_l:"Ji-eun was a <b>real person</b>. She walks home, a bit sad.",
 vd_card:"The <b style=\"color:#ffd23f\">YELLOW KEYCARD</b> is on the floor beside her — take it <b>[E]</b>.",
 jb_1:"“…Thank you for not leaving me in there.”",jb_2:"“I keep thinking about Min-ho. I held the door shut. I just… held it.”",
 jb_3:"“If I start acting weird… you do it. Okay? Promise me.”",jb_4:"“My hands won’t stop shaking. Keep going — I’m right behind you.”",
 jb_5:"“We’re really going to make it to the roof, right? Say yes.”",jb_see:"“Behind you— no, THERE!”",
 jb_hurt:"“I’m okay… I’m okay. Keep moving.”",jb_med:"“…Thank you. Really. I thought you’d let me die.”",
 jbl_1:"“Thanks for teaming up!”",jbl_2:"“These bots are SO clingy.”",jbl_3:"“If I start beeping, that’s a joke. Probably.”",
 jbl_4:"“Onward! Roof or bust!”",jbl_5:"“Snacks after this. Big snacks.”",jbl_see:"“Bot incoming!”",jbl_hurt:"“Oof. Still fine!”",jbl_med:"“Thanks! Good as new.”",
 sg_elev:"ELEVATOR",
 /* ---- the ending ---- */
 end_1:"The helicopter drops out of the dark, rotors screaming. A rope ladder hits the roof.",
 end_2:"Hands grab your wrists and haul you up. The roof falls away beneath your feet.",
 end_3j:"Ji-eun climbs in after you. She doesn’t let go of your sleeve.",
 end_3k:"The seat next to you stays empty. You keep seeing Ji-eun’s face.",
 end_3n:"Below you, Seowon High keeps screaming. Smaller. Smaller.",
 end_4:"The rotor hum is the safest sound in the world. You haven’t slept since… you can’t remember.",
 end_5:"Your eyes close.",
 end_1l:"The rescue drone-copter whirs down out of the sky. A friendly rope ladder unrolls.",
 end_2l:"Up you go! The bots below wave their little arms.",
 end_4l:"The seat is soft. The hum is cozy. What a night.",end_5l:"Zzz…",
 end_skip:"[Space] skip",
 vic_h:"CONGRATULATIONS",vic_sub:"YOU SURVIVED THE LAST NIGHT AT SEOWON HIGH",vic_subl:"YOU ESCAPED THE BOT-POCALYPSE",
 st_je:"Ji-eun: ",je_saved:"saved — she escaped with you",je_killed:"killed by you (she was human)",je_turned:"lost — she turned",je_left:"left behind",je_out:"went home safe",
 vic:'EXTRACTED',vic_p:'The helicopter lifts away from Seowon High. You made it.',vic_pl:'The rescue drone whisks you away from Seowon High. The bots wave goodbye. 🤖',
 st_time:'Time: ',st_kills:'Zombies put down: ',st_killsl:'Bots bounced: ',st_down:'Times down: ',st_squad:'Squad: {n} survivors',st_solo:'Solo escape',
 ring_a:'🟠 A faint arc — something is moving on that side. Listen. Guess.',
 ring_al:'🔵 A faint arc — a bot is active on that side',
 ring_b:'🔴 RED arc = it is CHASING you from that side! RUN.',ring_bl:'🔵 BRIGHT BLUE arc = the bot is coming straight for you!',
 p_wait:'Waiting for your squad in the circle ({i}/{t})',
 p_circle:'Light the flare first — HOLD [Q] in the circle',
 p_extract:'HELICOPTER IN {n}s — STAY IN THE CIRCLE',
 p_out:'OUT OF THE CIRCLE — the clock is rewinding ({n}s)',
 lock_hint:'🖱️ CLICK THE GAME TO CAPTURE THE MOUSE',
 chat_ph:'say something… (Enter to send)',
 /* ---- prologue ---- */
 pro_ss:'It was supposed to be one all-nighter at <em>Seowon High</em>. Study camp. Phones collected at the door. Main doors locked at 22:00.<br><br>At 23:12 a scream came from the <em>biology lab on Floor 5</em>. By 23:20 the corridors were <em>running</em>.<br><br>At 23:36 the school was <em>shut down</em>: gates locked, elevators and power cut. Only a few emergency lights stayed on.<br><br>Then the teachers stopped answering.<br><br>You wake on the entrance-hall floor. <em>Six floors</em> between you and the roof. You are not alone.',
 pro_sm:'It was supposed to be one all-nighter at <em>Seowon High</em>. Study camp. Phones collected at the door. Main doors locked at 22:00.<br><br>At 23:12 a scream came from the <em>biology lab on Floor 5</em>. By 23:20 the corridors were <em>running</em>.<br><br>At 23:36 the school was <em>shut down</em>: gates locked, elevators and power cut.<br><br>You and your friends wake on the entrance-hall floor, split in the dark. <em>Six floors</em> to the roof. You are not alone.',
 pro_ls:'It was <em>Science Fair prep night</em> at Seowon High — until somebody spilled a soda on the charging dock in the <em>Floor 5 robotics lab</em>.<br><br>Now every <em>helper-bot</em> in the building wants to hug you at 15 km/h. The school powered itself down to stop them. It did not work.<br><br>Ji-woo is on the radio: the <em>rescue drone-copter</em> lands on the <em>rooftop</em> at midnight. <em>Six floors</em> of overly enthusiastic robots. Say excuse me.',
 pro_lm:'It was <em>Science Fair prep night</em> at Seowon High — until somebody spilled a soda on the charging dock in the <em>Floor 5 robotics lab</em>.<br><br>Now every <em>helper-bot</em> in the building wants to hug you at 15 km/h. The school powered itself down to stop them. It did not work.<br><br>Ji-woo is on the radio: the <em>rescue drone-copter</em> lands on the <em>rooftop</em> at midnight. <em>Six floors</em>. Find your friends. Say excuse me.',
 br_h:'DAY 1 — 23:47 · SEOWON HIGH SCHOOL',
 br1:'Study camp. Phones collected. Doors locked at 22:00. Then the screaming started — and the school shut itself down.',
 br2:'Ji-woo, a student who made it upstairs, is on the radio: a military helicopter reaches the ROOFTOP at MIDNIGHT. It needs a signal flare to land.',
 br3:'Six floors. No elevator. No power above Floor 3. And something is moving in the dark between you and the roof.',
 br_m:'MAIN OBJECTIVE: ESCAPE — REACH THE ROOFTOP',
 /* ---- radio / story lines ---- */
 radio_name:'Ji-woo (radio)',
 radio_intro:'The stairwell tower is the only way up. Watch the blood on the floors — it marks where they nest.',
 radio_intro_l:'The stairwell is the only way up. The bots left paint footprints everywhere — cute, but watch the ring.',
 radio_cont:'Back in the tower. The stairwell remembers you.',radio_cont_l:'Back in the tower! The bots saved your spot in the queue.',
 radio_stairs:'The stairwell is the tower at the EAST end of the hall — follow the green arrows on the floor, through the glowing arch.',
 hint_stairtop:'Top of the stairs — step out SIDEWAYS onto the landing, then follow the signs.',
 phone_buzz:'Your phone buzzes. 3%.',phone_msg:'If you\'re alive, don\'t use your phone.',phone_die:'The phone dies.',
 s0:'Can you hear me? I\'m Ji-woo — I made it upstairs. A helicopter reaches the rooftop at midnight. Six floors. The only way out is up.',
 s1:'Floor 1. Classrooms. The stairwell gate up is boarded — you\'ll need that crowbar.',
 s2:'Floor 2. The security room still has backup power. Check the cameras — find out what happened.',
 s3:'Floor 3. Someone is on that floor with you. I can hear him on the intercom — breathing hard.',
 s4:'Floor 4. The dark floor. The power has been off since the shutdown. Don\'t run — running wakes them.',
 s5:'Floor 5. The lab. The whole floor is a quarantine that failed. Ji-eun is up there somewhere.',
 s6:'Floor 6. Administration. No power, no sound. It should not be this quiet.',
 sl0:'Ground floor! The bots are charging… and hugging. The flashlight is on the front desk.',
 sl1:'Floor 1. Classrooms. The stair gate up is boarded — crowbar time.',
 sl2:'Floor 2. The security room has the camera terminal. Let\'s see what the bots did.',
 sl3:'Floor 3. Someone is on this floor — I heard an "ow" on the intercom.',
 sl4:'Floor 4. The bots unplugged everything up here. Flashlight on!',
 sl5:'Floor 5. The robotics lab. Ji-eun is hiding somewhere on this floor.',
 sl6:'Floor 6. Very quiet. Suspiciously quiet.',
 radio_horde:'GET THROUGH FLOOR 5 — QUIETLY! Find Ji-eun, then climb!',radio_horde_l:'The bots arranged a surprise parade on Floor 5. Find Ji-eun!',
 radio_finale:'Pilot: we can\'t land blind! Light a signal flare in the landing circle!',
 radio_powerfail:'Wait — even your exit lights just died. That wasn\'t me.',
 radio_wait:'It stopped hiding. It\'s coming for you — RUN for the roof!',
 knock_sub:'<i>Knock. Knock. Knock.</i>',
 w_seen:'<i>At the end of the corridor — something tall. Standing very still. Watching.</i>',
 w_gone:'<i>You blink. It\'s gone.</i>',
 w_chase:'<b style="color:#ff6b6b">IT STOPPED HIDING. RUN.</b>',
 w_roof:'<i>It is here too. It looks at the helicopter. Then at you.</i>',
 w_roofgone:'<i>The spotlight sweeps past. It is gone into the smoke.</i>',
 w_door:'<i>The roof door slams shut behind you.</i>',
 sub_scream:'<i style="color:#ff8080">A scream — the whole floor heard it.</i>',sub_scream_l:'<i>A bot squealed for its friends.</i>',
 sub_notbefore:'<i>That was not here before… was it?</i>',
 sub_behind:'<i>Something moved in the dark behind you.</i>',sub_blink:'<i>The lights blinked. Phew.</i>',
 sub_steps:'<i>Footsteps… then nothing.</i>',sub_thump:'<i>THUMP. Something in the hall.</i>',
 sub_farend:'<i>At the far end of the hallway — something is standing there.</i>',
 sub_card:'<i>The card reader beeped. Something answered it.</i>',
 sub_saw:'<b style="color:#ff6b6b">IT SAW YOU. RUN.</b>',
 sub_flare:'<i>Red light floods the roof. Every head on the rooftop turns toward you.</i>',
 /* ---- missions (a strict chain) ---- */
 mis:'MISSION: ESCAPE THE BUILDING',obj_upd:'NEW OBJECTIVE',objective_n:'OBJECTIVE {n}/{t}',t_objdone:'Objective complete',
 t_notyet:'Not yet — first: {o}',
 q_torch:'Find a flashlight — reception desk, Ground floor.',
 q_crowbar:'Get the crowbar from the janitor closet (Ground, south-east).',
 q_boards:'Floor 1: pry the boards off the stairwell gate.',
 q_sec:'Floor 2: find the security room (CCTV & POWER).',
 q_arch:'Use the CCTV terminal — watch the evacuation record.',
 q_red:'Take the RED keycard from the security desk.',
 q_power:'Start the generator — restore main power.',
 q_gate2:'Floor 2: unlock the stairwell gate with the RED card.',
 q_park:'Floor 3: someone is lying in the hall — check on him.',
 q_parktalk:'Talk to Mr. Park.',
 q_blue:'Take the BLUE keycard beside Mr. Park.',
 q_killpark:'Mr. Park has turned. Put him down.',q_killpark_l:'Mr. Park got reprogrammed! Bonk him to reboot him.',
 q_shutter:'Back to the Floor 2 terminal — release the Floor 3 shutter.',
 q_gate3:'Floor 3: go through the open shutter up to Floor 4.',
 q_breaker:'Floor 4: reset the utility breaker (ELECTRICAL room).',
 q_gate4:'Floor 4: unlock the stairwell gate with the BLUE card.',
 q_jieun:'Floor 5: find Ji-eun in one of the rooms.',
 q_jtalk:'Talk to Ji-eun — then decide what to do about her.',
 q_yellow:'Take the ROOFTOP key (YELLOW card) Ji-eun put down.',
 q_gate5:'Floor 5: open the stairwell gate.',
 q_gate6:'Floor 6: unlock the rooftop gate with the YELLOW card.',
 q_roof:'Climb to the rooftop.',
 q_flare:'Light the signal flare in the landing circle.',
 q_hold:'Stay in the circle for 30 seconds until the helicopter lands.',
 qh_torch:'Desk by the sealed entrance · [E] take it · [F] toggles the light.',
 qh_crowbar:'The closet door is boarded · tap [Q] 3× to kick it in · [E] take the crowbar.',
 qh_boards:'Stairwell = green arrows, east end of the hall · HOLD [Q] at the gate to pry.',
 qh_sec:'South side of Floor 2, sign “CCTV & POWER” · [E] opens doors.',
 qh_arch:'Stand at the monitors · [E] uses the terminal.',
 qh_red:'Same desk as the monitors · [E] take it.',
 qh_power:'Generator at the back of the room · HOLD [Q] on the red handle.',
 qh_gate2:'Stairwell gate on Floor 2 · [E] swipes the card.',
 qh_park:'He is in the hall right outside the Floor 3 stairwell.',
 qh_parktalk:'Stand next to him · [E] to talk, [E] again for the next line.',
 qh_blue:'The card fell beside his hand · [E] take it.',
 qh_killpark:'Crowbar [1] or pistol [2] · [LMB] attack · hits from behind do double damage.',
 qh_shutter:'Floor 2 security room · [E] at the terminal · [Q] (or click the button) releases the Floor 3 shutter.',
 qh_gate3:'The shutter on Floor 3 is up · take the stairs to Floor 4.',
 qh_breaker:'South-east room of Floor 4 · HOLD [Q] on the green handle.',
 qh_gate4:'Stairwell gate on Floor 4 · [E] swipes the card.',
 qh_jieun:'No marker — open doors [E] and search. Listen: she makes small noises.',
 qh_jtalk:'Careful. Stand next to her · [E] to talk. When the choice appears you have 7 s: [1] or [2].',
 qh_yellow:'She left it on the floor for you · [E] take it.',
 qh_gate5:'Stairwell gate on Floor 5 · the lamp is green now · [E] opens it.',
 qh_gate6:'Stairwell gate on Floor 6 · [E] swipes the card.',
 qh_roof:'The stairwell goes all the way up.',
 qh_flare:'Green circle on the helipad · HOLD [Q] inside it to light the flare.',
 qh_hold:'Stay inside the circle — stepping out rewinds the clock · [H] medkit · [G] flare lures them away.',
 r_crowbar:'Good, a light. Keep the beam low. The janitor closet on the Ground floor has a crowbar — kick the boards in.',
 r_boards:'Crowbar? Good. The stairwell is the tower at the east end. The Floor 1 gate is boarded — pry it.',
 r_sec:'Floor 2 is security. The terminal there still has backup power.',
 r_arch:'That\'s the security room. The terminal archive recorded everything. Watch it.',
 r_red:'You saw it. The gate keys are on that desk. Take the red one.',
 r_power:'Red card. But the card readers are dead without power — the generator is in that room.',
 r_gate2:'MAIN POWER. The Floor 2 gate will take the red card now. Go up.',
 r_park:'Wait — I hear someone on Floor 3. Groaning. Right by the stairwell.',
 r_parktalk:'That\'s Mr. Park — the biology teacher. He\'s hurt. Talk to him. Carefully.',
 r_blue:'He wants you to take his card. Do it. Quickly.',
 r_killpark:'He\'s turning! Don\'t hesitate — that isn\'t Mr. Park anymore!',
 r_shutter:'…I\'m sorry. He was a good teacher. The Floor 3 shutter is released from the terminal on Floor 2. Go back down.',
 r_gate3:'The shutter is up. Floor 4 is the dark floor — no power at all up there. Batteries.',
 r_breaker:'The electrical room on Floor 4 has a utility breaker. It powers the lock on the Floor 5 gate.',
 r_gate4:'Breaker on. Now the blue card — the Floor 4 gate.',
 r_jieun:'Floor 5. Ji-eun was hiding there — she stopped answering an hour ago. Find her. Check every room.',
 r_jtalk:'You found her? Thank god. Talk to her.',
 r_yellow:'She has the rooftop key — and she\'s coming with you. Good. Take the key.',
 r_gate5:'The breaker you pulled released the Floor 5 gate. Open it and climb.',
 r_gate6:'Floor 6. No power, not a sound. The rooftop gate takes the yellow card.',
 r_roof:'The last gate is open. The roof — go!',
 r_flare:'THE ROOF! Light the signal flare in the circle so the pilot can see you!',
 r_hold:'The pilot sees the flare! Thirty seconds — HOLD THE CIRCLE!',
 /* ---- survivors ---- */
 l_talk:'Talk to {n}',
 npc1_name:'Mr. Park (bitten)',npc1l_name:'Mr. Park (zapped)',
 npc1_1:'…Don\'t come closer. Stay there. It bit me — my arm. I don\'t have long.',
 npc1_2:'I\'m Park. I teach biology. It started in the Floor 5 lab… then the school shut down. No power above this floor.',
 npc1_3:'My BLUE keycard opens the Floor 4 stairwell gate. It fell by my hand. Take it. Now.',
 npc1l_1:'Ow… a helper-bot zapped me with its "friendship beam". I feel… beepy.',
 npc1l_2:'I teach robotics. The bots got a bad update in the Floor 5 lab… then the school powered itself down.',
 npc1l_3:'My BLUE keycard opens the Floor 4 gate. It\'s right by my hand — take it!',
 park_run:'RUN… I can feel it… I\'m going to turn… RUN!',park_run_l:'Uh oh… beep… I\'m being REPROGRAMMED… get away… BOOP!',
 park_turn:'<i>Mr. Park\'s body jerks. His eyes roll back. He is getting up.</i>',park_turn_l:'<i>Mr. Park\'s eyes glow blue. He wants a hug. A BIG one.</i>',
 park_dead:'<i>Mr. Park is still. It\'s over.</i>',park_dead_l:'<i>Mr. Park sits down and reboots. He\'ll be fine. Probably.</i>',
 park_moan:'<i>A weak voice by the stairwell: “…help… over here…”</i>',
 park_tag:'MR. PARK',
 npc2_name:'Ji-eun',
 npc2_1:'Don\'t— don\'t come any closer. …I\'m fine. I\'m FINE. Stop staring at me.',
 npc2_2:'The blood? It\'s not mine. It\'s Min-ho\'s. My lab partner. I held the door and he— he isn\'t Min-ho anymore. <i>(She pulls her sleeve down over the bandage.)</i>',
 npc2_3:'My arm? I cut it on the door when I ran. It just… burns a little. Everyone who got bitten said it burns. …I know how that sounds.',
 npc2_4:'I\'ve been sitting here an hour, waiting to change. I don\'t feel different. I just feel scared. …I have the ROOFTOP key. Please don\'t leave me here.',
 ch_warn:'⚠ DECIDE NOW',ch_q:'Is Ji-eun infected? Take her with you — or end it before it\'s too late.',
 ch_trust:'[1] TRUST HER',ch_trust_d:'take her with you',ch_kill:'[2] KILL HER',ch_kill_d:'don\'t take the risk',
 ch_q_l:'Is Ji-eun a bot in disguise? Team up — or send her home?',ch_kill_l:'[2] SEND HER HOME',ch_kill_dl:'don\'t take the risk',
 jieun_killed:'<i>She drops without a sound. You check her arm. A cut from a door. No bite. The blood was someone else\'s.</i>',
 jieun_killed_l:'<i>Ji-eun shrugs and walks off to the safe room. She was just a person after all.</i>',
 jieun_trusted:'<b>Ji-eun:</b> “Thank you… I— I can barely stand. If you have a medkit…”',
 jieun_timeout:'⚠ TOO LATE — THEY FOUND YOU BOTH!',
 jieun_timeout_sub:'<b>Ji-eun:</b> “They heard us! Behind you!”',
 t_jieun_weak:'Ji-eun is exhausted and hurt — stand next to her and press [E] to give her a medkit.',
 l_givemed:'Give Ji-eun a medkit (+80)',t_gavemed:'Ji-eun is patched up — she can keep up now.',
 btn_givemed:'💉 GIVE JI-EUN A MEDKIT',t_givemed_far:'Get next to Ji-eun first.',
 t_jieun_join:'Ji-eun joins you — she stays near you, keeps you in sight and shoots anything that gets close. Keep her alive: zombies go for her too.',
 t_jieun_hurt:'Ji-eun is badly hurt — cover her!',t_jmed_by:'{n} patched Ji-eun up with a medkit.',
 jieun_dying:'<b>Ji-eun:</b> “It bit me… I’m sorry… r-run…”',
 jieun_turn:'<i>Ji-eun gets up. Her eyes are wrong.</i> Put her down.',
 jieun_zdead:'<i>It’s over, Ji-eun. You kept her from wandering the halls.</i>',
 jieun_out_l:'Ji-eun got bonked too many times — she heads back to the safe room.',
 npc2l_1:'Shh! Don\'t come closer! …I\'m fine. Totally fine. Beep. I mean — hi.',
 npc2l_2:'The paint on my sleeve? Not mine. A bot hugged me. Hard.',
 npc2l_3:'Why is my arm blinking? It isn\'t. Stop looking at it.',
 npc2l_4:'I have the ROOFTOP key. Take me with you? …You look like you don\'t trust me.',
 jieun_sub:'<i>Somewhere in the south-west rooms — a bottle rolls across the floor.</i>',
 jieun_whisper:'<i>A whisper behind a door: “…is someone there?”</i>',
 jieun_found:'<i>Behind the shelf — a girl, knees pulled up, shaking. Blood on her sleeve. She hides her arm when she sees you. Careful.</i>',
 /* ---- toasts ---- */
 t_need_crowbar:'Boarded shut. You need a crowbar.',
 t_need_crowbar2:'You need a crowbar. (The janitor closet on the Ground floor can be kicked open.)',
 t_batt:'Battery +40%',t_flare:'Flare picked up — [G] to throw.',t_medkit:'Medkit picked up — [H] to use.',
 t_crowbar:'Crowbar — pry boards, swing at heads. [1] to select.',t_pistol:'SMG — HOLD [LMB] for full-auto · [1]/[2] switch weapons.',
 t_ammo:'Ammo +20 rounds.',t_torch:'Flashlight — [F] to toggle.',t_notorch:'No flashlight yet — check the reception desk (Ground floor).',
 t_batdead:'Battery is dead.',t_torchdead:'Flashlight died. Find batteries.',t_noflare:'No flares left.',t_nomedi:'No medkits.',t_medused:'Medkit used (+60 HP)',
 t_empty:'Click — empty. Ammo: STORAGE room (Floor 3, north-west) · ARMORY (Floor 5, north-east) · crate on the roof. [1] = crowbar.',
 sg_storage:'STORAGE · AMMO',sg_armory:'ARMORY · AMMO',t_nopistol:'No gun yet — the security guard left an SMG in the CCTV room (Floor 2).',
 t_w_melee:'Crowbar out.',t_w_pistol:'SMG out — {n} rounds.',t_up:'Back on your feet. Watch yourself.',
 t_respawn:'You wake up by the stairwell. Keep moving.',t_power:'MAIN POWER RESTORED — card readers online',
 t_power2:'BREAKER ON — the Floor 5 gate lock is released',t_shutter:'FLOOR 3 SHUTTER RELEASED',t_boards:'Boards pried off.',
 t_cardtaken:"{n} took the {c} keycard — mission updated.",t_rev_left:"Revived — back at half health. Revives left: {n}. Use a medkit.",t_rev_last:"Last revive used — if you go down again, you turn.",
 down_revleft:"revives left: {n}",turned_tag:"{n} (TURNED)",turned_sub:"{n} has turned into a zombie — put them down!",
 wipe_h:"EVERYONE TURNED",wipe_p:"The whole squad is gone. Seowon High keeps you all.",
 spec_h:"YOU TURNED",spec_watch:"Watching through {n}'s eyes",spec_none:"No one left to watch…",spec_prev:"◀ Prev [A]",spec_next:"Next [D] ▶",spec_quit:"Quit game",
 gv_h:"Give to {n}",gv_medkit:"Medkit",gv_ammo:"Ammo (up to 20)",gv_pistol:"SMG",gv_battery:"Battery (30%)",gv_flare:"Flare",gv_close:"[Esc] close",
 gv_hint:"<b>[B]</b> Give items to {n}",t_give_none:"Stand next to a friend to give items.",t_gave:"You gave {n} a {i}.",t_gotgift:"{n} gave you: {i}",
 v_mic_on:"Mic ON",v_mic_off:"Mic off",v_spk_on:"Voices",v_spk_off:"Muted",t_mic_on:"🎤 Mic on — talk to your squad. [M] to mute.",t_mic_off:"Mic off.",
 t_mic_denied:"Microphone blocked — allow it in the browser's address bar.",t_mic_na:"Voice chat isn't supported in this browser.",t_spk_on:"🔊 Friends' voices on.",t_spk_off:"🔇 Friends' voices muted.",
 t_friendcard:'A friend found the {c} keycard.',t_friendpower2:'A friend reset the breaker — the Floor 5 gate lock is released.',
 t_friendpower:'A friend restored MAIN POWER.',t_friendshutter:'A friend released the Floor 3 shutter.',
 t_revived:'You helped {n} up.',t_horde:'⚠ CONTAINMENT BREACH — FLOOR 5',t_horde_l:'🤖 BOT PARADE — FLOOR 5',
 t_disc:'Disconnected from host.',t_ping:'📡 {n} pinged {f}',t_joined:'{n} joined.',
 t_hostfocus:'Tab hidden — the squad keeps playing without you.',
 t_sneak:'[C] CROUCH to sneak — slow steps, lights off. They only see what is in front of them.',
 t_flarelit:'SIGNAL FLARE LIT — the helicopter is coming down!',
 t_lang:'Language switched: English',t_lang_mp:'Cannot change language mid-co-op — restart the room.',
 /* ---- interaction labels ---- */
 l_open:'Open door',l_close:'Close door',l_pry:'Pry the boards off',l_kick:'Kick the boards in',l_boarded:'Boarded — you need a crowbar',
 l_gpry:'Pry the gate boards off',l_gboarded:'Boarded gate — you need a crowbar',
 l_gate:'Open the gate',l_gswipe:'Swipe the {c} keycard',l_glock:'Locked — {c} keycard',l_shutter:'Security shutter',l_maglock:'Gate — magnetic lock',
 l_cctv:'Use CCTV terminal',l_cctv_bak:'Use CCTV terminal (backup power)',
 l_br1:'Start the generator',l_br2:'Reset the utility breaker',l_revive:'Revive {n}',l_flarelight:'Light the signal flare',
 l_batt:'Take battery',l_flare:'Take flare',l_medkit:'Take medkit',l_crowbar:'Take crowbar',l_torch:'Take flashlight',l_note:'Read note',
 l_pistol:'Take SMG (+30 rounds)',l_ammo:'Take ammo box (+20)',l_card:'Take {c} keycard',l_elev:'Try the elevator',
 g_locked2:'Locked. It takes the {c} keycard — {where}.',g_accept:'{c} keycard accepted.',g_got:'{c} keycard picked up.',
 g_nopower:'The card reader is dead — no power. Start the generator in the Floor 2 security room.',
 g_shutter1:'Security shutter. No power — the generator is in the Floor 2 security room.',g_shutter2:'Powered. Release it from the CCTV terminal (Floor 2).',
 g_power:'Magnetic lock engaged. Reset the utility breaker on Floor 4.',
 gw_red:'security room, Floor 2',gw_blue:'Mr. Park, Floor 3',gw_yellow:'Ji-eun, Floor 5',
 elev_dead:'ELEVATOR — NO POWER. The school shutdown cut it. The stairwell at the end of the hall is the only way up.',
 elev_jam:'ELEVATOR — DEAD. Something is knocking on the other side of the doors. Don\'t.',
 /* ---- signs & rooms ---- */
 sg_stairs:'STAIRWELL',sg_up:'↑ STAIRS',sg_exit:'◀ EXIT THIS WAY',sg_down:'↓ DOWN: {f}',sg_stairs_to:'STAIRS ➜',sg_ooo:'OUT OF ORDER',sg_access:'{c} ACCESS',
 sg_entrance:'MAIN ENTRANCE — SEALED',sg_cctv:'CCTV & POWER',sg_elec:'ELECTRICAL',sg_server:'SERVER ROOM',
 sg_infir:'INFIRMARY',sg_roof:'ROOF ACCESS',sg_allfloors:'STAIRWELL ➜ ALL FLOORS',sg_wentup:'WE WENT UP →',sg_notsame:'THEY ARE NOT ALL THE SAME',
 rn00:'CLASS 1-1',rn01:'CLASS 1-2',rn02:'CLASS 2-1',rn03:'MUSIC ROOM',rn04:'ART ROOM',rn05:'LIBRARY',
 rn10:'STAFF ROOM',rn11:'OFFICE A',rn12:'OFFICE B',rn13:'ARCHIVE',rn14:'MEETING RM',rn15:'COPY ROOM',
 rn20:'LAB 1',rn21:'LAB 2',rn22:'COUNSELING',rn23:'DARKROOM',rn24:'STORAGE A',rn25:'STORAGE B',
 rn30:'DORM A',rn31:'DORM B',rn32:'COMMONS',rn33:'LAUNDRY',rn34:'PANTRY',rn35:'GYM STORE',
 /* ---- notes ---- */
 n1t:'JANITOR\'S LOG',n1b:'Third night shift this week. The bio lab on 5 keeps calling me to mop up "spills". Whatever they are, they smell wrong. Locked the stairwell gate like they asked. Red card is with the CCTV people on 2.',
 n2t:'CCTV OPERATOR NOTE',n2b:'Cameras 4 and up went dark at the shutdown. Before that, the Floor 6 feed showed SOMETHING pacing the east stairwell. It knows where the camera is. It looks BACK. Red keycard is on this desk — take it if you\'re reading this.',
 n3t:'LAB PREP ROOM SIGN-IN',n3b:'Blue access cards issued: ONE — Mr. Park (Biology). Last entry: "Subject 0 moved back to the Floor 5 lab. God forgive us." The door was boarded from the INSIDE.',
 n4t:'NOTE ON A BACKPACK',n4b:'We hid in the gym. Too loud. Too open. WE WENT UP. If anyone reads this — the east stairwell still works, but the dark floors… bring flares. And don\'t answer if something calls your name. — S.M.',
 n5t:'ELECTRICAL WARNING',n5b:'The shutdown cut the main feed. This utility breaker only powers the magnetic lock on the Floor 5 stairwell gate. Flip it and the lock releases. Watch the dark between here and there.',
 n6t:'INFIRMARY INTAKE',n6b:'Bite victims turn fast — minutes, not hours. That\'s what the sheet says now. They took the head nurse down to the Floor 5 lab at her own request. Nobody has written anything since.',
 n7t:'TORN DIARY PAGE',n7b:'The helicopter comes at midnight. They said the roof. They said it can\'t land without a flare. Our class made it to Floor 6 before the shouting started. If anyone reads this — RUN, don\'t count the dead.',
 n8t:'PAINTED ON THE WALL',n8b:'THE ROOF IS THE WAY OUT. LIGHT THE FLARE. HOLD THE CIRCLE. DON\'T LOOK DOWN THE STAIRWELL.',
 ph1t:'A STUDENT\'S PHONE (3%)',ph1b:'One new voice message, 23:29:\n\n"Everyone went to the gym. Someone said the roof was safe."\n\n(static)\n\n"…They were wrong."',
 bc_t:'EMERGENCY BROADCAST',bc_b:'MILITARY RELAY — 23:54\n\n"Extraction remains scheduled. Rooftop. Midnight. Light a signal flare in the landing circle — we will not land blind."\n\n"Do not engage the infected. Do not use elevators. Move between rooms, never along corridors."',
 /* ---- CCTV archive ---- */
 cl_h:'CCTV ARCHIVE — BACKUP POWER',cl_note:'A RED keycard sits on this desk. The generator in this room restores main power.',
 cl1:'23:31 · CAM 03 — STUDENTS MOVING UP. THE STAIRWELL IS THE ONLY ROUTE.',cl2:'23:33 · EMERGENCY LOCKDOWN BEGINS.',
 cl3:'23:34 · FLOOR 5 BIOLOGY LAB SEALED — CONTAINMENT FAILURE.',cl4:'23:35 · ELEVATORS DISABLED. 23:36 · SCHOOL SHUTDOWN — GATES LOCKED, POWER CUT.',
 cl5:'23:37 · SECURITY LEAVES. 23:38 · CAM 04 OFFLINE. 23:41 · CAM 03 — A TEACHER RUNNING. BLEEDING.',
 /* ---- chapter comics ---- */
 ch2_t:'CHAPTER 2 — WHAT THE CAMERAS SAW',ch2_c:'Floor 2. The security room still has power — backup only. Whatever happened in this school tonight, the cameras recorded every minute of it.',
 ch3_t:'CHAPTER 3 — THE DARK FLOORS',ch3_c:'The Floor 3 shutter grinds open. Above it the school is dead: the shutdown cut the power. No lights. No cameras. Only your flashlight.',
 ch4_t:'CHAPTER 4 — THE BREACH',ch4_c:'Floor 5 is the biology lab — where it all began. The alarms say containment failed hours ago. Somewhere on this floor, Ji-eun is still hiding.',
 ch5_t:'CHAPTER 5 — MIDNIGHT',ch5_c:'The roof. Cold air and a helicopter circling in the dark. The pilot cannot land blind — light the signal flare, then hold the circle for thirty seconds.',
},
zh:{
 sub_scary:'书元高中 · 最后一夜',sub_lite:'书元高中 · 助手机器人捣乱日',
 m_modelabel:'游戏模式',m_namelabel:'你的名字',lbl_lang:'语言',m_solo:'单人逃生',m_host:'创建联机',m_join:'加入联机',m_connect:'连接',
 m_roomcode:'房间代码',tab_play:'开始',tab_how:'玩法说明',wake:'— 点击苏醒 —',
 footer:'粉丝自制丧尸逃生游戏 · Three.js + WebAudio · 免费部署',
 mode_scary:'噩梦模式',mode_lite:'日间演习',
 mode_scary_d:'黑暗走廊 · 丧尸 · 血迹 · 惊吓场面 · 心跳音效',
 mode_lite_d:'明亮友好 · 呆萌机器人 · 颜料泼溅 · 零惊吓',
 howto:'<div class="hl"><b>特色：</b>🔀 <b>分支剧情</b>——你对智恩的7秒选择会改变之后的故事 · 🧠 <b>AI同伴</b>会战斗、后撤、说话 · 🔗 <b>24步任务链</b> · 🎧 <b>心跳紧张系统</b> · 🚁 <b>天台死守</b>+电影式结局。</div>'+
  '<b>目标：</b>从大厅爬到<b>天台</b>（共6层），点燃<b>信号照明弹</b>，在降落圈里坚持<b>30秒</b>，等直升机接你。<br>'+
  '<b>任务是一条链。</b>每一步都必须按顺序完成，下一步才会解锁——左上角面板永远显示当前步骤和要按的键。按住 <b>[Tab]</b> 查看完整计划。<br>'+
  '<b>操作：</b><b>[E]</b> 拾取物品 · 开关门 · 阅读纸条 · 使用终端 · 刷门卡 · 与幸存者<b>对话</b>（再按一次看下一句）。'+
  '<b>[Q]</b> 做体力活：<b>连按</b>踹开木板，<b>按住</b>撬木板、拉电闸、点燃照明弹、扶起队友（中途松手也会保留进度）。<b>[空格]</b> 只用来跳跃。<br>'+
  '<b>楼梯间的门</b>都锁着——需要门卡、电力、2层的监控终端和撬棍。你将不得不折返。<br>'+
  '<b>听。</b>准星周围的光弧会指示附近的动静。<b>看。</b>门口的血迹说明里面有东西。高层<b>没有电</b>——手电筒 [F] 很耗电，记得捡电池。<br>'+
  '<b>照明弹 [G]</b> 引开敌人。<b>医疗包 [H]</b> 回血。<b>[C] 蹲下</b>潜行。<b>[Shift] 冲刺</b>很吵。<b>冲锋枪 [2]</b>（按住鼠标连发）在2层保安室。<br>'+
  '<b>两种模式：</b>🧟 噩梦模式——黑暗、丧尸、血迹。🤖 日间演习——明亮、友好的机器人、零惊吓。<b>联机：</b>创建房间并分享代码（最多4人，以房主模式为准；[T] 聊天，[Z] 标记）。<br>需要键盘+鼠标。点击游戏画面锁定鼠标。',
 cont:'继续游戏 — {f} · {m}',
 lb_title:'幸存者大厅',lb_share:'把这个房间代码分享给你的朋友',lb_copy:'点击代码复制 · 朋友点“加入联机”后输入即可',
 lb_startn:'开始逃生（{n} 名幸存者）',lb_start0:'仍要单人开始',lb_wait:'等待房主…',lb_leave:'离开',lb_copied:'已复制！',
 lb_hostnote:'房主：请保持此页面打开并在前台——整栋楼都在你的电脑上运行。',
 msg_creating:'正在创建房间…',t_midjoin:'正在加入进行中的逃生…',t_midkit:'新手装备：手电筒、撬棍和几发9毫米子弹。',lb_squad:'幸存者',
 msg_connecting:'正在连接 {c}…',msg_connected:'已连接！等待房主…',msg_entercode:'请输入朋友分享的房间代码。',
 msg_slow:'仍在连接…部分网络需要最多 15 秒。',msg_retry:'暂无响应——正在重试…',msg_relay:'无法直连（VPN、代理或网络限制）——正在通过中继连接…',msg_noroom:'找不到房间 {c}。请检查代码，并让房主保持大厅打开。',msg_p2pfail:'无论直连还是中继都无法连到房间。请检查代码、确认房主的大厅仍然打开，并确认网络正常。',msg_neterr:'网络错误：{e}——请检查网络。',msg_hostclosed:'房主已关闭房间。',msg_kbm:'⚠ 本游戏需要键盘和鼠标。',
 hud_hp:'生命',hud_st:'体力',hud_bt:'手电筒',hud_crowbar:'撬棍 [1]',hud_flare:'照明弹 [G]',hud_med:'医疗包 [H]',hud_cards:'钥匙卡',hud_ammo:'冲锋枪 [2]',
 floor:'第 {n} 层',floor0:'地面 — 大厅',roof:'天台 — 撤离点',fl_ground:'地面',fl_roof:'天台',fl_floor:'{n}层',
 wp_roof:'⬆ 楼梯间——上到天台',wp_up:'⬆ 楼梯间——走廊东端 · 上到{f}',wp_down:'⬇ 楼梯间——走廊东端 · 下到{f}',
 wp_here:'目标 · {d} 米',wp_search:'没有标记——搜查{f}的房间',
 hint:'[E] 拾取/开门/使用/对话 · [Q] 踹 · [按住Q] 撬/电闸/照明弹<br>[F] 手电 · [G] 照明弹 · [H] 医疗包 · [C] 潜行 · [1]/[2] 武器 · [左键] 攻击 · [V] 视角 · [Tab] 目标 · [I] 帮助 · [Esc] 暂停',
 hint_mp:'<br>[T] 聊天 · [Z] 标记 · 在倒地队友旁按住 [Q] 救起',
 k_e:'E',k_hold:'按住 Q',k_enter:'E',k_space:'Q',mw_how:'怎么做',help_show:'<b>[I]</b> 卡住了？显示路线',help_hide:'<b>[I]</b> 隐藏帮助',
 col_red:'红色',col_blue:'蓝色',col_yellow:'黄色',col_green:'绿色',
 pause_title:'已暂停',opt_sens:'鼠标灵敏度',opt_vol:'音量',opt_fov:'视野',btn_resume:'继续',btn_quit:'退出到菜单',
 ctrl:'<div><b>WASD</b> 移动</div><div><b>鼠标</b> 视角</div><div><b>Shift</b> 冲刺（很吵）</div><div><b>空格</b> 跳跃</div><div><b>E</b> 拾取·开门·使用·对话</div><div><b>Q（连按）</b> 踹木板</div><div><b>按住 Q</b> 撬板·电闸·照明弹·救人</div><div><b>E / 回车</b> 重生</div><div><b>C</b> 蹲下潜行</div><div><b>F</b> 手电筒</div><div><b>G</b> 投掷照明弹</div><div><b>H</b> 医疗包</div><div><b>左键</b> 攻击</div><div><b>1 / 2</b> 撬棍 / 冲锋枪</div><div><b>V</b> 第一/第三人称</div><div><b>I</b> 任务帮助</div><div><b>Tab</b> 目标列表</div><div><b>T / Z</b> 聊天 / 标记（联机）</div><div><b>Esc</b> 暂停</div>',
 goals_title:'逃生计划',
 cctv_hint:'◀ ▶ / A D — 切换摄像头 · [Q] — 解除卷帘门（到时候） · [E] / [Esc] — 离开',cctv_cam:'摄像头 {n} — {m}',cl_next:'[空格] ▸ 下一条',cc_you:'你',
 shutter_btn:'解除3层卷帘门',note_close:'[E] / [ESC] — 放下',
 death_h:'你死了',death_l:'被撞飞了！',death_p:'大楼留下了你的骸骨。',death_pl:'机器人礼貌地把你滚到安全角落。',
 down_h:'你倒下了',down_hl:'被扑倒了！',
 down_mp:'队友可以救你——坚持住！',down_mp_l:'队友可以把你扶起来——坚持住！',down_sp:'没有人能帮你了…',down_sp_l:'机器人正礼貌地围观。哎哟。',
 down_help:'没有重试机会了——队友可以在你身边按住 [Q] 扶起你。没人来？本次逃亡就到此为止。',
 death_restart:'逃亡失败。你将从头开始。',
 lives_lbl:'剩余重生',btn_respawn:'立即重生 — [E]',death_left:'正在重生。之后还剩 {n} 次重生',death_last:'这是你最后一次重生——你只剩这一条命了。再死一次，本次逃亡就结束。',death_out:'重生次数已用完。大楼留下了你。',skip:'跳过 ▶',
 sus_h:"⚠ 可疑的幸存者",sus_hl:"🤔 可疑？",
 sus_who:"智恩 · 独自躲在感染楼层",sus_whol:"智恩 · 独自躲在机器人楼层",
 sus_tell:"她可能已经<b>被感染</b>。交谈时<b>[E]</b>仔细观察她。对话结束后，你只有<b>7秒</b>做决定：<b>相信</b>她，还是<b>杀了</b>她。",
 sus_telll:"她其实是<b>机器人</b>吗？和她交谈<b>[E]</b>，寻找线索。然后你有<b>7秒</b>做决定。",
 sus_meter:"怀疑度",
 sus_c0:"🩸 袖子、双手、开衫上都是血",sus_c1:"😰 发抖、冒冷汗——不让你靠近",
 sus_c2:"🩹 把左臂的绷带藏起来",sus_c3:"🔥 说伤口“烧得慌”——被咬的人也这么说",
 sus_c4:"👁 ……但她眼神清醒，说话还是她自己",
 sus_c0l:"🎨 袖子上有油漆点",sus_c1l:"🙈 不让你靠近",sus_c2l:"💡 她手臂上……有东西在闪？",
 sus_c3l:"🤖 不小心说了一声“哔”",sus_c4l:"👁 ……但她笑起来像个真人",
 vd_trust_h:"你判断对了",vd_trust:"智恩是<b>人类</b>。那血是珉浩的，伤口只是被门划的。",
 vd_kill_h:"错误的选择",vd_kill:"智恩是<b>人类</b>。你杀了你的朋友。<br>那伤口只是被门划的。",
 vd_time_h:"太迟了",vd_time:"智恩是<b>人类</b>——但你犹豫了，它们听见了。<b>战斗！</b>",
 vd_trust_l:"智恩是<b>真人</b>！组队出发。",vd_kill_hl:"判断失误",vd_kill_l:"智恩是<b>真人</b>。她有点难过地回家了。",
 vd_card:"<b style=\"color:#ffd23f\">黄色门禁卡</b>就在她身边的地上——按<b>[E]</b>拿走。",
 jb_1:"“……谢谢你没有把我丢在那里。”",jb_2:"“我一直在想珉浩。我把门抵住了。我就只是……抵住了。”",
 jb_3:"“要是我开始不对劲……你就动手。好吗？答应我。”",jb_4:"“我的手一直在抖。继续走——我就在你后面。”",
 jb_5:"“我们真的能到天台的，对吧？说是。”",jb_see:"“你后面——不，那边！”",
 jb_hurt:"“我没事……我没事。继续走。”",jb_med:"“……谢谢你。真的。我以为你会让我死。”",
 jbl_1:"“谢谢你和我组队！”",jbl_2:"“这些机器人也太黏人了。”",jbl_3:"“如果我开始哔哔叫，那是开玩笑。大概吧。”",
 jbl_4:"“前进！不到天台不罢休！”",jbl_5:"“结束后去吃零食。很多零食。”",jbl_see:"“机器人来了！”",jbl_hurt:"“哎哟。还好！”",jbl_med:"“谢谢！满血复活。”",
 sg_elev:"电梯",
 end_1:"直升机从黑暗中俯冲而下，旋翼轰鸣。一条绳梯落在天台上。",
 end_2:"有人抓住你的手腕把你拉上去。天台在你脚下远去。",
 end_3j:"智恩跟着你爬了进来。她一直抓着你的袖子不放。",
 end_3k:"你身边的座位空着。你总是看见智恩的脸。",
 end_3n:"脚下的书元高中还在尖叫。越来越小。越来越小。",
 end_4:"旋翼的嗡嗡声是世上最安全的声音。你已经不记得上次睡觉是什么时候了……",
 end_5:"你闭上了眼睛。",
 end_1l:"救援无人直升机从天而降，放下一条友好的绳梯。",
 end_2l:"上去吧！下面的机器人挥着小手。",
 end_4l:"座位软软的，嗡嗡声很舒服。真是漫长的一夜。",end_5l:"呼呼……",
 end_skip:"[空格] 跳过",
 vic_h:"恭喜你",vic_sub:"你在书元高中的最后一夜活了下来",vic_subl:"你逃出了机器人大暴走",
 st_je:"智恩：",je_saved:"获救——她和你一起逃了出来",je_killed:"被你杀死（她是人类）",je_turned:"失去了——她变异了",je_left:"被留下了",je_out:"平安回家了",
 vic:'成功撤离',vic_p:'直升机载你飞离书元高中。你活下来了。',vic_pl:'救援无人机带你飞离书元高中。机器人向你挥手告别。🤖',
 st_time:'用时：',st_kills:'消灭丧尸：',st_killsl:'弹开的机器人：',st_down:'倒地次数：',st_squad:'小队：{n} 名幸存者',st_solo:'单人逃生',
 ring_a:'🟠 微弱的光弧——那个方向有东西在动。听。猜。',
 ring_al:'🔵 微弱的光弧——那个方向有机器人活动',
 ring_b:'🔴 红色光弧 = 它正从那边追你！快跑！',ring_bl:'🔵 亮蓝色光弧 = 机器人正朝你冲来！',
 p_wait:'在圈里等待队友（{i}/{t}）',
 p_circle:'先点燃照明弹——在圈内按住 [Q]',
 p_extract:'直升机 {n} 秒后到达——待在圈里',
 p_out:'你离开了圈——倒计时正在倒退（{n} 秒）',
 lock_hint:'🖱️ 点击游戏画面以锁定鼠标',
 chat_ph:'说点什么…（回车发送）',
 pro_ss:'本该只是书元高中的一夜通宵自习。收集手机。晚上十点锁大门。<br><br>23:12，<em>5层的生物实验室</em>里传出一声尖叫。23:20，走廊里已经在<em>奔跑</em>。<br><br>23:36，学校<em>全面封锁</em>：大门上锁，电梯和电源被切断。只剩几盏应急灯还亮着。<br><br>然后，老师们再也没有回应。<br><br>你在门厅的地板上醒来。你和天台之间隔着<em>六层楼</em>。你，不是一个人。',
 pro_sm:'本该只是书元高中的一夜通宵自习。收集手机。晚上十点锁大门。<br><br>23:12，<em>5层的生物实验室</em>里传出一声尖叫。23:20，走廊里已经在<em>奔跑</em>。<br><br>23:36，学校<em>全面封锁</em>：大门上锁，电梯和电源被切断。<br><br>你和朋友们在门厅醒来，散落在黑暗里。离天台还有<em>六层楼</em>。你，不是一个人。',
 pro_ls:'本来是书元高中的<em>科技展准备之夜</em>——直到有人把汽水洒在了<em>5层机器人实验室</em>的充电底座上。<br><br>现在大楼里的每一台<em>助手机器人</em>都想以15公里时速拥抱你。学校自动断电想阻止它们。没用。<br><br>智宇在无线电里说：<em>救援无人机</em>午夜降落<em>天台</em>。<em>六层楼</em>热情过头的机器人。记得说“借过”。',
 pro_lm:'本来是书元高中的<em>科技展准备之夜</em>——直到有人把汽水洒在了<em>5层机器人实验室</em>的充电底座上。<br><br>现在大楼里的每一台<em>助手机器人</em>都想以15公里时速拥抱你。学校自动断电想阻止它们。没用。<br><br>智宇在无线电里说：<em>救援无人机</em>午夜降落<em>天台</em>。<em>六层楼</em>。找到你的朋友。记得说“借过”。',
 br_h:'第一天 — 23:47 · 书元高中',
 br1:'通宵自习。收集手机。晚上十点锁门。然后尖叫声响起——学校自动封锁了。',
 br2:'逃到楼上的学生智宇在无线电里说：军用直升机午夜到达天台。它需要信号照明弹才能降落。',
 br3:'六层楼。没有电梯。3层以上没有电。而在你和天台之间的黑暗里，有什么东西在动。',
 br_m:'主要目标：逃生——登上天台',
 radio_name:'智宇（对讲机）',
 radio_intro:'楼梯塔是唯一的上楼通道。留意地上的血迹——那是它们巢穴的标记。',
 radio_intro_l:'楼梯间是唯一的上楼通道。机器人到处踩了颜料脚印——挺可爱，但盯紧光弧。',
 radio_cont:'回到大楼。楼梯间还记得你。',radio_cont_l:'回到大楼！机器人帮你留了队的位置。',
 radio_stairs:'楼梯间在走廊最东边的塔楼里——跟着地上的绿色箭头，穿过发光的拱门。',
 hint_stairtop:'到楼梯顶了——向侧面走出楼梯间，然后跟着指示牌走。',
 phone_buzz:'你的手机震了一下。电量3%。',phone_msg:'如果你还活着，别用手机。',phone_die:'手机关机了。',
 s0:'能听到吗？我是智宇——我逃到楼上了。直升机午夜到天台。六层楼。唯一的出路：向上。',
 s1:'1层。教室。上楼的楼梯门被木板钉死了——你需要那根撬棍。',
 s2:'2层。保安室还有备用电源。看看摄像头——搞清楚发生了什么。',
 s3:'3层。那层还有别人。我在对讲系统里听到他——喘得很厉害。',
 s4:'4层。黑暗楼层。封锁之后这里就一直没电。别跑——跑动会吵醒它们。',
 s5:'5层。实验室。整层都是失效的隔离区。智恩就在上面某个地方。',
 s6:'6层。行政区。没有电，没有声音。不该这么安静。',
 sl0:'地面层！机器人在充电……还在抱人。手电筒在前台上。',
 sl1:'1层。教室。上楼的门被木板钉住了——该用撬棍了。',
 sl2:'2层。保安室有监控终端。看看机器人干了什么。',
 sl3:'3层。这层有人——我在对讲机里听到一声“哎哟”。',
 sl4:'4层。机器人把这里的电全拔了。打开手电！',
 sl5:'5层。机器人实验室。智恩就躲在这层某处。',
 sl6:'6层。非常安静。安静得可疑。',
 radio_horde:'安静地穿过5层！先找到智恩，再往上爬！',radio_horde_l:'机器人在5层办了场惊喜游行。快找到智恩！',
 radio_finale:'飞行员：我们看不见，没法降落！在降落圈里点燃信号照明弹！',
 radio_powerfail:'等等——连你那边的出口灯都灭了。不是我干的。',
 radio_wait:'它不躲了。它冲你来了——快跑上天台！',
 knock_sub:'<i>咚。咚。咚。</i>',
 w_seen:'<i>走廊尽头——一个高高的影子。站着一动不动。看着。</i>',
 w_gone:'<i>你眨了下眼。它不见了。</i>',
 w_chase:'<b style="color:#ff6b6b">它不躲了。快跑。</b>',
 w_roof:'<i>它也在这里。它看了看直升机。然后看向你。</i>',
 w_roofgone:'<i>探照灯扫过。它消失在烟雾里。</i>',
 w_door:'<i>你身后的天台门砰地关上了。</i>',
 sub_scream:'<i style="color:#ff8080">一声尖叫——整层楼都听到了。</i>',sub_scream_l:'<i>一台机器人尖叫着呼唤同伴。</i>',
 sub_notbefore:'<i>这东西……刚才不在这里吧？</i>',
 sub_behind:'<i>黑暗中，有什么东西在你身后动了一下。</i>',sub_blink:'<i>灯闪了一下。呼。</i>',
 sub_steps:'<i>脚步声……然后什么都没有了。</i>',sub_thump:'<i>咚。走廊里有东西。</i>',
 sub_farend:'<i>走廊的另一头——有什么东西站在那里。</i>',
 sub_card:'<i>读卡器“嘀”了一声。有什么东西回应了它。</i>',
 sub_saw:'<b style="color:#ff6b6b">它看见你了。快跑。</b>',
 sub_flare:'<i>红光照亮了整个天台。天台上所有的脑袋都转向了你。</i>',
 mis:'任务：逃出大楼',obj_upd:'新目标',objective_n:'目标 {n}/{t}',t_objdone:'目标完成',
 t_notyet:'还不行——先完成：{o}',
 q_torch:'找到手电筒——地面层前台。',
 q_crowbar:'从杂物间（地面层东南角）拿到撬棍。',
 q_boards:'1层：撬开楼梯门上的木板。',
 q_sec:'2层：找到保安室（监控配电室）。',
 q_arch:'使用监控终端——查看撤离记录。',
 q_red:'从保安桌上拿走红色钥匙卡。',
 q_power:'启动发电机——恢复主电源。',
 q_gate2:'2层：用红卡打开楼梯门。',
 q_park:'3层：走廊里躺着一个人——去看看他。',
 q_parktalk:'和朴老师交谈。',
 q_blue:'拿走朴老师身边的蓝色钥匙卡。',
 q_killpark:'朴老师已经变异了。结束他的痛苦。',q_killpark_l:'朴老师被重新编程了！敲一下让他重启。',
 q_shutter:'回到2层终端——解除3层卷帘门。',
 q_gate3:'3层：穿过已打开的卷帘门，上到4层。',
 q_breaker:'4层：重置公用断路器（电气室）。',
 q_gate4:'4层：用蓝卡打开楼梯门。',
 q_jieun:'5层：找到智恩——她躲在某个房间里。',
 q_jtalk:'和智恩交谈——然后决定怎么处置她。',
 q_yellow:'从智恩那里拿到天台钥匙（黄卡）。',
 q_gate5:'5层：打开楼梯门——断路器已解除它的锁。',
 q_gate6:'6层：用黄卡打开通往天台的门。',
 q_roof:'登上天台。',
 q_flare:'在降落圈里点燃信号照明弹。',
 q_hold:'在圈里坚持30秒，等直升机降落。',
 qh_torch:'被封死的正门旁边的桌子 · [E] 拾取 · [F] 开关手电。',
 qh_crowbar:'杂物间门被木板封住 · 连按 3 次 [Q] 踹开 · [E] 拿撬棍。',
 qh_boards:'楼梯间 = 绿色箭头，走廊东端 · 在门前按住 [Q] 撬开。',
 qh_sec:'2层南侧，牌子写着“监控配电室” · [E] 开门。',
 qh_arch:'站到显示器前 · [E] 使用终端。',
 qh_red:'就在显示器那张桌上 · [E] 拾取。',
 qh_power:'发电机在房间后部 · 在红色手柄上按住 [Q]。',
 qh_gate2:'2层楼梯门 · [E] 刷卡。',
 qh_park:'他就在3层楼梯间出口外的走廊上。',
 qh_parktalk:'站到他身边 · [E] 对话，再按 [E] 听下一句。',
 qh_blue:'卡掉在他手边 · [E] 拾取。',
 qh_killpark:'撬棍 [1] 或手枪 [2] · [左键] 攻击 · 从背后攻击伤害加倍。',
 qh_shutter:'2层保安室 · 在终端按 [E] · 按 [Q]（或点击按钮）解除3层卷帘门。',
 qh_gate3:'3层的卷帘门已升起 · 走楼梯上4层。',
 qh_breaker:'4层东南角的房间 · 在绿色手柄上按住 [Q]。',
 qh_gate4:'4层楼梯门 · [E] 刷卡。',
 qh_jieun:'没有标记——用 [E] 开门搜查。仔细听：她会发出轻微的声音。',
 qh_jtalk:'小心。站到她身边 · [E] 对话。选项出现后你只有 7 秒：[1] 或 [2]。',
 qh_yellow:'她把卡放在地上了 · [E] 拾取。',
 qh_gate5:'5层楼梯门 · 指示灯已变绿 · [E] 打开。',
 qh_gate6:'6层楼梯门 · [E] 刷卡。',
 qh_roof:'楼梯一直通到顶。',
 qh_flare:'直升机坪上的绿色圆圈 · 站在圈内按住 [Q] 点燃照明弹。',
 qh_hold:'待在圈内——离开会让倒计时倒退 · [H] 医疗包 · [G] 照明弹引开它们。',
 r_crowbar:'有光了？好。光束压低。地面层的杂物间里有撬棍——把木板踹开。',
 r_boards:'拿到撬棍了？好。楼梯间在走廊东端的塔楼。1层的楼梯门被木板封住了——撬开它。',
 r_sec:'2层是保安区。那里的终端还有备用电源。',
 r_arch:'那就是保安室。终端的存档记录了一切。看看吧。',
 r_red:'你看到了。门禁卡就在那张桌上。拿红色的。',
 r_power:'红卡。但没电的话读卡器是死的——发电机就在那个房间。',
 r_gate2:'主电源恢复！2层的门现在认红卡了。上去。',
 r_park:'等等——我听到3层有人。在呻吟。就在楼梯间旁边。',
 r_parktalk:'那是朴老师——生物老师。他受伤了。跟他说话。小心点。',
 r_blue:'他要你拿走他的卡。快拿。',
 r_killpark:'他在变异！别犹豫——那已经不是朴老师了！',
 r_shutter:'……对不起。他是个好老师。3层的卷帘门要在2层的终端解除。回下面去。',
 r_gate3:'卷帘门升起来了。4层是黑暗楼层——那里完全没电。备好电池。',
 r_breaker:'4层的电气室里有公用断路器。它给5层楼梯门的锁供电。',
 r_gate4:'断路器合上了。现在用蓝卡——4层的楼梯门。',
 r_jieun:'5层。智恩一直躲在那里——一个小时前她就不回话了。找到她。每个房间都查一遍。',
 r_jtalk:'你找到她了？谢天谢地。跟她说话。',
 r_yellow:'天台钥匙在她那里——她也要跟你走。很好。拿上钥匙。',
 r_gate5:'你合上的断路器解除了5层楼梯门的锁。打开它，往上爬。',
 r_gate6:'6层。没有电，没有声音。天台的门认黄卡。',
 r_roof:'最后一道门开了。天台——快去！',
 r_flare:'天台！在圈里点燃信号照明弹，让飞行员看到你！',
 r_hold:'飞行员看到照明弹了！三十秒——守住圆圈！',
 l_talk:'和 {n} 交谈',
 npc1_name:'朴老师（被咬伤）',npc1l_name:'朴老师（被电晕）',
 npc1_1:'……别靠近。就站在那儿。它咬了我——胳膊。我撑不了多久了。',
 npc1_2:'我姓朴，教生物。一切是从5层实验室开始的……然后学校就封锁了。这层以上都没有电。',
 npc1_3:'我的蓝色钥匙卡能打开4层的楼梯门。它掉在我手边。拿走。快。',
 npc1l_1:'哎哟……一台助手机器人用“友谊光束”电了我。我感觉……嘀嘀的。',
 npc1l_2:'我教机器人课。5层实验室的机器人更新出错了……然后学校自动断电了。',
 npc1l_3:'我的蓝色钥匙卡能打开4层的门。就在我手边——拿走！',
 park_run:'快跑……我感觉到了……我要变了……快跑！',park_run_l:'糟了……嘀……我正在被重新编程……快走开……哔！',
 park_turn:'<i>朴老师的身体猛地一抽。眼睛翻白。他站了起来。</i>',park_turn_l:'<i>朴老师的眼睛发出蓝光。他想要一个拥抱。一个超大的拥抱。</i>',
 park_dead:'<i>朴老师不动了。结束了。</i>',park_dead_l:'<i>朴老师坐下来重启了。他会没事的。大概吧。</i>',
 park_moan:'<i>楼梯间旁传来微弱的声音：“……救命……这边……”</i>',
 park_tag:'朴老师',
 npc2_name:'智恩',
 npc2_1:'别——别再靠近了。……我没事。我没事！别盯着我看。',
 npc2_2:'血？不是我的。是珉浩的，我的实验搭档。我抵住了门，然后他——他已经不是珉浩了。<i>（她把袖子往下拉，盖住绷带。）</i>',
 npc2_3:'我的手臂？逃跑时被门划的。只是……有点烧。被咬的人都说会烧。……我知道这听起来像什么。',
 npc2_4:'我在这里坐了一个小时，等着自己变异。我没觉得有什么不同，只是很害怕。……我有天台钥匙。求你别把我丢在这里。',
 ch_warn:'⚠ 立刻决定',ch_q:'智恩被感染了吗？带她一起走——还是趁来得及结束这一切？',
 ch_trust:'[1] 相信她',ch_trust_d:'带她一起走',ch_kill:'[2] 杀了她',ch_kill_d:'不冒这个险',
 ch_q_l:'智恩是伪装的机器人吗？组队——还是送她回家？',ch_kill_l:'[2] 送她回家',ch_kill_dl:'不冒这个险',
 jieun_killed:'<i>她无声地倒下。你查看她的手臂。只是门划的伤口。没有咬痕。那血是别人的。</i>',
 jieun_killed_l:'<i>智恩耸耸肩，走回安全屋。原来她只是个普通人。</i>',
 jieun_trusted:'<b>智恩：</b>“谢谢……我——我快站不住了。你要是有医疗包……”',
 jieun_timeout:'⚠ 太迟了——它们找到你们俩了！',
 jieun_timeout_sub:'<b>智恩：</b>“它们听见了！你后面！”',
 t_jieun_weak:'智恩又累又伤——站到她身边按 [E] 给她医疗包。',
 l_givemed:'给智恩医疗包（+80）',t_gavemed:'智恩包扎好了——她能跟上了。',
 btn_givemed:'💉 给智恩医疗包',t_givemed_far:'先走到智恩身边。',
 t_jieun_join:'智恩加入了你——她会待在你附近、不让你离开视线，并射击靠近的丧尸。保护好她：丧尸也会攻击她。',
 t_jieun_hurt:'智恩伤得很重——掩护她！',t_jmed_by:'{n} 用医疗包给智恩包扎了伤口。',
 jieun_dying:'<b>智恩：</b>“它咬到我了……对不起……快、快跑……”',
 jieun_turn:'<i>智恩站了起来。她的眼神不对了。</i>解决她。',
 jieun_zdead:'<i>结束了，智恩。至少她不会在走廊里游荡了。</i>',
 jieun_out_l:'智恩被敲中太多次——她回安全屋去了。',
 npc2l_1:'嘘！别过来！……我没事。完全没事。哔。我是说——你好。',
 npc2l_2:'我袖子上的颜料？不是我的。一个机器人抱了我。很用力。',
 npc2l_3:'我的手臂为什么在闪？没有在闪。别看了。',
 npc2l_4:'我有天台钥匙。带我一起走？……你看起来不太相信我。',
 jieun_sub:'<i>西南边的某个房间里——一个瓶子滚过地板。</i>',
 jieun_whisper:'<i>门后传来一声低语：“……外面有人吗？”</i>',
 jieun_found:'<i>书架后面——一个女孩抱着膝盖，浑身发抖。袖子上有血。看到你，她把手臂藏了起来。小心。</i>',
 t_need_crowbar:'被木板封死了。你需要撬棍。',
 t_need_crowbar2:'你需要撬棍。（地面层的杂物间可以踹开。）',
 t_batt:'电池 +40%',t_flare:'拾取照明弹——按 [G] 投掷。',t_medkit:'拾取医疗包——按 [H] 使用。',
 t_crowbar:'撬棍——可撬木板、攻击头部。按 [1] 选用。',t_pistol:'冲锋枪——按住 [左键] 连发 · [1]/[2] 切换武器。',
 t_ammo:'弹药 +20 发。',t_torch:'手电筒——按 [F] 开关。',t_notorch:'还没有手电筒——去地面层前台看看。',
 t_batdead:'电池耗尽了。',t_torchdead:'手电筒没电了。去找电池。',t_noflare:'没有照明弹了。',t_nomedi:'没有医疗包了。',t_medused:'使用医疗包（+60 生命）',
 t_empty:'咔哒——空仓。弹药：3层西北的储藏室 · 5层东北的军械室 · 天台的弹药箱。按 [1] 换撬棍。',
 sg_storage:'储藏室 · 弹药',sg_armory:'军械室 · 弹药',t_nopistol:'还没有枪——保安把一把冲锋枪落在了2层监控室。',
 t_w_melee:'已切换撬棍。',t_w_pistol:'已切换冲锋枪——{n} 发。',t_up:'重新站了起来。小心点。',
 t_respawn:'你在楼梯间醒来。继续前进。',t_power:'主电源已恢复——读卡器上线',
 t_power2:'断路器已合闸——5层楼梯门的锁已解除',t_shutter:'3层卷帘门已解除',t_boards:'木板被撬开。',
 t_cardtaken:"{n}拿到了{c}钥匙卡——任务已更新。",t_rev_left:"已被救起——只剩一半血量。剩余救援次数：{n}。快用医疗包。",t_rev_last:"最后一次救援已用完——再倒下你就会变异。",
 down_revleft:"剩余救援：{n}",turned_tag:"{n}（已变异）",turned_sub:"{n}变成了丧尸——解决掉他！",
 wipe_h:"全员变异",wipe_p:"整支小队都没了。书元高中留下了你们所有人。",
 spec_h:"你变异了",spec_watch:"正在通过{n}的视角观看",spec_none:"已经没有可观看的人了……",spec_prev:"◀ 上一个 [A]",spec_next:"下一个 [D] ▶",spec_quit:"退出游戏",
 gv_h:"给{n}",gv_medkit:"医疗包",gv_ammo:"弹药（最多20）",gv_pistol:"冲锋枪",gv_battery:"电池（30%）",gv_flare:"照明弹",gv_close:"[Esc] 关闭",
 gv_hint:"<b>[B]</b> 给{n}物品",t_give_none:"站到队友旁边才能给物品。",t_gave:"你给了{n}：{i}。",t_gotgift:"{n}给了你：{i}",
 v_mic_on:"麦克风开",v_mic_off:"麦克风关",v_spk_on:"语音开",v_spk_off:"已静音",t_mic_on:"🎤 麦克风已开——和队友说话。[M] 静音。",t_mic_off:"麦克风已关。",
 t_mic_denied:"麦克风被阻止——请在浏览器地址栏允许。",t_mic_na:"此浏览器不支持语音聊天。",t_spk_on:"🔊 已开启队友语音。",t_spk_off:"🔇 已静音队友语音。",
 t_friendcard:'队友找到了{c}钥匙卡。',t_friendpower2:'队友重置了断路器——5层楼梯门的锁已解除。',
 t_friendpower:'队友恢复了主电源。',t_friendshutter:'队友解除了3层卷帘门。',
 t_revived:'你把 {n} 扶了起来。',t_horde:'⚠ 收容失效 — 5层',t_horde_l:'🤖 机器人大游行 — 5层',
 t_disc:'与房主断开连接。',t_ping:'📡 {n} 标记了{f}',t_joined:'{n} 加入了。',
 t_hostfocus:'页面已隐藏——小队会在没有你的情况下继续。',
 t_sneak:'[C] 蹲下潜行——脚步放轻，关掉手电。它们只看得见正前方。',
 t_flarelit:'信号照明弹已点燃——直升机正在下降！',
 t_lang:'语言已切换：中文',t_lang_mp:'联机中无法切换语言（请重开房间）',
 l_open:'开门',l_close:'关门',l_pry:'撬开木板',l_kick:'踹开木板',l_boarded:'被木板封住——需要撬棍',
 l_gpry:'撬开门上的木板',l_gboarded:'门被木板封住——需要撬棍',
 l_gate:'打开楼梯门',l_gswipe:'刷{c}钥匙卡',l_glock:'已上锁——需要{c}钥匙卡',l_shutter:'安全卷帘门',l_maglock:'楼梯门——电磁锁',
 l_cctv:'使用监控终端',l_cctv_bak:'使用监控终端（备用电源）',
 l_br1:'启动发电机',l_br2:'重置公用断路器',l_revive:'救起 {n}',l_flarelight:'点燃信号照明弹',
 l_batt:'拾取电池',l_flare:'拾取照明弹',l_medkit:'拾取医疗包',l_crowbar:'拾取撬棍',l_torch:'拾取手电筒',l_note:'阅读纸条',
 l_pistol:'拾取冲锋枪（+30发）',l_ammo:'拾取弹药箱（+20）',l_card:'拾取{c}钥匙卡',l_elev:'试试电梯',
 g_locked2:'已上锁。需要{c}钥匙卡——{where}。',g_accept:'{c}钥匙卡已验证。',g_got:'已拾取{c}钥匙卡。',
 g_nopower:'读卡器没反应——没有电。先启动2层保安室的发电机。',
 g_shutter1:'安全卷帘门。没有电力——发电机在2层保安室。',g_shutter2:'已通电。请在2层监控终端解除。',
 g_power:'电磁锁锁定。请重置4层的公用断路器。',
 gw_red:'2层保安室',gw_blue:'3层的朴老师',gw_yellow:'5层的智恩',
 elev_dead:'电梯——没有电。学校封锁时被切断了。走廊尽头的楼梯间是唯一上楼的路。',
 elev_jam:'电梯——已失灵。有东西在门的另一侧敲。别开。',
 sg_stairs:'楼梯间',sg_up:'↑ 楼梯',sg_exit:'◀ 从这边出去',sg_down:'↓ 下楼：{f}',sg_stairs_to:'楼梯 ➜',sg_ooo:'暂停使用',sg_access:'{c} 通行',
 sg_entrance:'正门 — 已封闭',sg_cctv:'监控配电室',sg_elec:'电气室',sg_server:'服务器室',
 sg_infir:'医务室',sg_roof:'天台通道',sg_allfloors:'楼梯间 ➜ 通往所有楼层',sg_wentup:'我们上楼了 →',sg_notsame:'它们不全一样',
 rn00:'1-1教室',rn01:'1-2教室',rn02:'2-1教室',rn03:'音乐教室',rn04:'美术教室',rn05:'图书馆',
 rn10:'教师办公室',rn11:'办公室A',rn12:'办公室B',rn13:'档案间',rn14:'会议室',rn15:'文印室',
 rn20:'实验室1',rn21:'实验室2',rn22:'心理室',rn23:'暗房',rn24:'储藏室A',rn25:'储藏室B',
 rn30:'宿舍A',rn31:'宿舍B',rn32:'公共区',rn33:'洗衣房',rn34:'配餐室',rn35:'器材室',
 n1t:'保洁员日志',n1b:'这周第三次夜班了。5层的生物实验室总让我去拖“洒出来的东西”。不管那是什么，气味都不对劲。按他们的要求锁了楼梯间的门。红卡在2层保安室的人手里。',
 n2t:'监控员留言',n2b:'学校封锁后，4层往上的摄像头全黑了。在那之前，6层的画面里有东西在东楼梯间踱步。它知道摄像头在哪。它会往回看。红钥匙卡就在这张桌上——看到这张纸条就拿走吧。',
 n3t:'实验室准备室签到表',n3b:'已发放的蓝色门禁卡：一张——朴老师（生物）。最后一条记录：“0号样本已送回5层实验室。上帝原谅我们。”这扇门是从里面封住的。',
 n4t:'书包上的便签',n4b:'我们躲在体育馆。太吵。太空旷。我们上去了。如果有人看到这张纸——东侧楼梯间还能走，但黑暗的楼层……带上照明弹。还有，如果有东西喊你的名字，别回答。—— S.M.',
 n5t:'电气警告',n5b:'封锁切断了主电源。这个公用断路器只给5层楼梯门的电磁锁供电。合上它，锁就会解除。小心这一路的黑暗。',
 n6t:'医务室登记',n6b:'被咬的人变异得很快——几分钟，不是几小时。登记表现在是这么写的。他们应护士长自己的要求，把她送去了5层实验室。从那以后，再没人写过任何东西。',
 n7t:'撕下的日记',n7b:'直升机午夜会来。他们说去天台。他们说没有照明弹它就没法降落。我们班爬到6层时喊声响起。如果有人读到这张纸——跑，别去数死者。',
 n8t:'墙上的涂写',n8b:'天台是出路。点燃照明弹。守住圆圈。别朝楼梯间下面看。',
 ph1t:'学生的手机（3%）',ph1b:'一条新语音留言，23:29：\n\n“大家都去体育馆了。有人说天台是安全的。”\n\n（杂音）\n\n“……他们错了。”',
 bc_t:'紧急广播',bc_b:'军方中继 — 23:54\n\n“撤离计划不变。天台。午夜。在降落圈里点燃信号照明弹——我们不会盲降。”\n\n“不要与感染者交战。不要使用电梯。在房间之间移动，不要沿走廊走。”',
 cl_h:'监控存档 — 备用电源',cl_note:'这张桌上有一张红色钥匙卡。这个房间里的发电机可以恢复主电源。',
 cl1:'23:31 · 03号镜头——学生正在向上撤离。楼梯间是唯一的路线。',cl2:'23:33 · 紧急封锁开始。',
 cl3:'23:34 · 5层生物实验室封闭——收容失败。',cl4:'23:35 · 电梯停用。23:36 · 学校封锁——大门锁闭，电源切断。',
 cl5:'23:37 · 保安撤离。23:38 · 04号镜头离线。23:41 · 03号镜头——一位老师在奔跑。在流血。',
 ch2_t:'第二章 — 摄像头看到了什么',ch2_c:'2层。保安室还有电——只是备用电源。今晚学校里发生的一切，摄像头都记录了下来。',
 ch3_t:'第三章 — 黑暗楼层',ch3_c:'3层的卷帘门嘎嘎升起。再往上，学校已经死了：封锁切断了电源。没有灯，没有摄像头。只有你的手电筒。',
 ch4_t:'第四章 — 收容失效',ch4_c:'5层是生物实验室——一切开始的地方。警报说收容几小时前就失败了。智恩还躲在这层的某个地方。',
 ch5_t:'第五章 — 午夜',ch5_c:'天台。冷风，直升机在黑暗中盘旋。飞行员没法盲降——点燃信号照明弹，然后在圈里坚持三十秒。',
}};
if(typeof window!=='undefined'&&window.ROOFTOP_I18N)Object.assign(I18N,window.ROOFTOP_I18N);   // + Vietnamese, Indonesian
function T(k,vars){
  let d=(I18N[LANG]&&I18N[LANG][k]!==undefined)?I18N[LANG][k]:I18N.en[k];
  if(d===undefined)return k;
  if(vars)return String(d).replace(/\{(\w+)\}/g,(_,n)=>vars[n]!==undefined?vars[n]:'{'+n+'}');
  return d;
}
function hasT(k){return I18N[LANG]&&I18N[LANG][k]!==undefined||I18N.en[k]!==undefined;}
function floorName(f){return f>=CFG.FLOORS?T('fl_roof'):(f===0?T('fl_ground'):T('floor',{n:f}));}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
function applyLang(){
  const set=(id,v)=>{const e=$(id);if(e&&v!==undefined&&v!==null)e.textContent=v;};
  const setP=(id,v)=>{const e=$(id);if(e&&v!==undefined&&v!==null)e.placeholder=v;};
  try{
    set('menuSub',T(G.selMode==='lite'?'sub_lite':'sub_scary'));
    set('lblMode',T('m_modelabel'));
    set('lblName',T('m_namelabel'));
    set('tabPlay',T('tab_play'));set('tabHow',T('tab_how'));
    set('btnSolo',T('m_solo'));set('btnHost',T('m_host'));set('btnJoin',T('m_join'));
    set('btnConnect',T('m_connect'));set('btnLobbyLeave',T('lb_leave'));
    setP('codeIn',T('m_roomcode'));setP('nameIn',{zh:'幸存者',vi:'Người sống sót',id:'Penyintas'}[LANG]||'Survivor');
    set('prologueGo',T('wake'));
    set('modeTitleScary',T('mode_scary'));set('modeDescScary',T('mode_scary_d'));
    set('modeTitleLite',T('mode_lite'));set('modeDescLite',T('mode_lite_d'));
    const mh=$('menuHow');if(mh)mh.innerHTML=T('howto');
    set('menuFooter',T('footer'));
    set('icoHp',T('hud_hp'));set('icoSt',T('hud_st'));set('icoBt',T('hud_bt'));
    set('slotCrowbarL',T('hud_crowbar'));set('slotFlareL',T('hud_flare'));
    set('slotMedL',T('hud_med'));set('slotCardsL',T('hud_cards'));set('slotAmmoL',T('hud_ammo'));
    set('pauseTitle',T('pause_title'));
    set('optSensL',T('opt_sens'));set('optVolL',T('opt_vol'));set('optFovL',T('opt_fov'));
    set('btnResume',T('btn_resume'));set('btnQuit',T('btn_quit'));
    const cl=$('ctrlList');if(cl)cl.innerHTML=T('ctrl');
    set('goalsTitle',T('goals_title'));
    set('missionTag',T('mis'));
    set('cctvHint',T('cctv_hint'));set('shutterBtn',T('shutter_btn'));
    set('noteClose',T('note_close'));setP('chatIn',T('chat_ph'));
    set('lockHint',T('lock_hint'));
    set('lbTitle',T('lb_title'));set('lbHint1',T('lb_share'));set('lbHint2',T('lb_copy'));
    set('lbHostNote',T('lb_hostnote'));
    const hk=$('hintKey');if(hk)hk.innerHTML=T('hint')+(G.mp?T('hint_mp'):'');
    set('lblLang',T('lbl_lang'));
    const he=$('langEn'),hz=$('langZh');
    if(he)he.classList.toggle('on',LANG==='en');
    if(hz)hz.classList.toggle('on',LANG==='zh');
    for(const [bid,l] of [['langVi','vi'],['langId','id']]){const b=$(bid);if(b)b.classList.toggle('on',LANG===l);}
    if(document.body)document.body.classList.toggle('zh',LANG==='zh');
    hudInv();
  }catch(e){if(typeof console!=='undefined')console.warn('applyLang:',e&&e.message);}
}

const G={
  mode:'menu',            // menu | lobby | playing
  mp:false, host:true, started:false, paused:false,
  time:0, dt:0,
  flags:{power:false,power2:false,shutter:false,finale:false,victory:false,cctvSeen:false,secFound:false,
    parkFound:false,parkTalked:false,parkTurned:false,parkDead:false,jieunDead:false,
    jieunTrusted:false,jieunKilled:false,jieunTimeout:false,safeBreached:false,
    jieunFound:false,jieunTalked:false,flareLit:false},
  cards:{red:false,blue:false,green:false,yellow:false},
  gatesOpen:new Set(), boardsBroken:new Set(), taken:new Set(), notesRead:new Set(),
  floorsSeen:new Set(), chaptersSeen:new Set(), mwDismissed:false,
  dangerFloor:-1,
  stats:{kills:0,deaths:0,start:0},
  chatOpen:false, uiLock:null,   // 'cctv' | 'note' | 'chapter' | null
  holdNear:false,                // a HOLD-[Q] job is in reach (Space always jumps)
};
const INV={flashlight:false,crowbar:false,flare:0,medkit:0,battery:70,pistol:false,ammo:0};

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b+1));
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
const dist2=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;};
const TAU=Math.PI*2;
function angDiff(a,b){let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;}
function fmtTime(s){s=Math.floor(s);const m=Math.floor(s/60);return m+'m '+(s%60)+'s';}

/* ---------------- settings (persisted) ---------------- */
const SET={sens:1.0,vol:0.8,fov:72};
try{Object.assign(SET,JSON.parse(localStorage.getItem('zf_set')||'{}'));}catch(e){}
function saveSet(){try{localStorage.setItem('zf_set',JSON.stringify(SET));}catch(e){}}
$('sensR').value=SET.sens*100; $('volR').value=SET.vol*100; $('fovR').value=SET.fov;

/* ---------------- input ---------------- */
const KEY={};
const mouse={dx:0,dy:0,lmb:false};
let pointerLocked=false;
addEventListener('keydown',e=>{
  if(e.code==='Tab'){e.preventDefault();}
  if(G.chatOpen){
    if(e.code==='Enter'){sendChat();}
    if(e.code==='Escape'){toggleChat(false);}
    return;
  }
  const code=e.code==='NumpadEnter'?'Enter':e.code;
  KEY[code]=true;
  if(!e.repeat)onKey(code);   // held keys must not re-toggle the flashlight, crouch, camera…
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyZ','Enter'].includes(code))e.preventDefault();
});
addEventListener('keyup',e=>{const code=e.code==='NumpadEnter'?'Enter':e.code;KEY[code]=false;if(code==='Tab')toggleGoals(false);});
addEventListener('mousemove',e=>{
  // Pointer lock is preferred but never required: if the browser refused it we still rotate
  // from raw mouse deltas, so a player can never be stuck unable to look around.
  if(G.mode!=='playing'||G.paused||G.uiLock||G.chatOpen)return;
  mouse.dx+=e.movementX||0;mouse.dy+=e.movementY||0;
});
addEventListener('mousedown',e=>{if(e.button===0)mouse.lmb=true;});
addEventListener('mouseup',e=>{if(e.button===0)mouse.lmb=false;});
addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{
  pointerLocked=(document.pointerLockElement===$('c'));
  // In co-op the world keeps running: pausing the host would freeze every teammate.
  if(!pointerLocked&&G.mode==='playing'&&!G.uiLock&&G.started&&!player.dead&&!G.flags.victory&&!NOLOCK&&!G.mp)showPause(true);
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&G.mp&&G.mode==='playing')toast(T('t_hostfocus'));
});
function lockPointer(){
  try{
    const p=$('c').requestPointerLock&&$('c').requestPointerLock();
    if(p&&p.catch)p.catch(()=>{}); // silent if browser refuses — hint will show instead
  }catch(e){}
}

/* grain overlay */
const grainC=$('grain'),grainCtx=grainC.getContext('2d');
function sizeGrain(){grainC.width=Math.ceil(innerWidth/4);grainC.height=Math.ceil(innerHeight/4);}
sizeGrain();
setInterval(()=>{
  if(G.mode!=='playing')return;
  const w=grainC.width,h=grainC.height,img=grainCtx.createImageData(w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=26;}
  grainCtx.putImageData(img,0,0);
},120);

/* =====================================================================
   SECTION B — PROCEDURAL TEXTURES + AUDIO ENGINE
===================================================================== */
function makeCanvas(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');fn(x,w,h);return c;}
function grunge(x,w,h,n,alpha){for(let i=0;i<n;i++){x.fillStyle=`rgba(${irand(0,40)},${irand(0,35)},${irand(0,30)},${rand(0.02,alpha)})`;const r=rand(2,26);x.beginPath();x.arc(rand(0,w),rand(0,h),r,0,TAU);x.fill();}}
function texOf(canvas,rx,ry){const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.colorSpace=THREE.SRGBColorSpace;return t;}

const TEX={};
function buildTextures(){
  const LITE=MD.id==='lite';
  const soften=(x,w,h,a)=>{if(LITE){x.fillStyle='rgba(255,250,238,'+a+')';x.fillRect(0,0,w,h);}};
  // concrete wall (512) + bump
  TEX.wall=makeCanvas(512,512,(x,w,h)=>{
    x.fillStyle=LITE?'#c8c2b4':'#6f6d66';x.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){x.fillStyle=`rgba(${irand(85,150)},${irand(84,145)},${irand(78,135)},.1)`;x.fillRect(rand(0,w),rand(0,h),rand(1,4),rand(1,4));}
    // panel seams + skirting
    x.strokeStyle='rgba(30,28,26,.4)';x.lineWidth=2;
    for(let px=128;px<w;px+=128){x.beginPath();x.moveTo(px,0);x.lineTo(px,h);x.stroke();}
    x.fillStyle=LITE?'#b8b2a2':'#57544d';x.fillRect(0,h-38,w,38);
    x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,h-40,w,3);
    if(!LITE){
      grunge(x,w,h,40,.12);
      x.strokeStyle='rgba(40,38,34,.35)';for(let i=0;i<5;i++){x.beginPath();let px=rand(0,w),py=0;x.moveTo(px,py);while(py<h){px+=rand(-14,14);py+=rand(10,40);x.lineTo(px,py);}x.stroke();}
    }
    soften(x,w,h,.08);
  });
  TEX.wallB=makeCanvas(256,256,(x,w,h)=>{
    x.fillStyle='#808080';x.fillRect(0,0,w,h);
    for(let i=0;i<3000;i++){const v=irand(96,160);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(rand(0,w),rand(0,h),rand(1,3),rand(1,6));}
    x.fillStyle='#5a5a5a';for(let px=64;px<w;px+=64)x.fillRect(px,0,2,h);
  });
  // floor tiles (512, 8x8 with grout) + bump
  TEX.floor=makeCanvas(512,512,(x,w,h)=>{
    x.fillStyle=LITE?'#b4aea2':'#5c5a53';x.fillRect(0,0,w,h);
    const n=8,s=w/n;
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const b=LITE?58:0;
      x.fillStyle=`rgb(${irand(92,116)+b},${irand(90,110)+b},${irand(82,100)+b})`;x.fillRect(i*s+2,j*s+2,s-4,s-4);
      for(let k=0;k<40;k++){x.fillStyle=`rgba(${irand(60,120)+b},${irand(60,115)+b},${irand(55,105)+b},.15)`;x.fillRect(i*s+rand(3,s-3),j*s+rand(3,s-3),rand(1,3),rand(1,3));}
    }
    x.fillStyle='rgba(20,18,16,.55)';
    for(let i=0;i<=n;i++){x.fillRect(i*s-1,0,3,h);x.fillRect(0,i*s-1,w,3);}
    if(!LITE)grunge(x,w,h,26,.1);
  });
  TEX.floorB=makeCanvas(256,256,(x,w,h)=>{
    x.fillStyle='#b4b4b4';x.fillRect(0,0,w,h);
    const n=8,s=w/n;
    x.fillStyle='#4a4a4a';
    for(let i=0;i<=n;i++){x.fillRect(i*s-1,0,3,h);x.fillRect(0,i*s-1,w,3);}
    for(let i=0;i<1200;i++){const v=irand(150,200);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(rand(0,w),rand(0,h),2,2);}
  });
  // ceiling panels
  TEX.ceil=makeCanvas(256,256,(x,w,h)=>{
    x.fillStyle=LITE?'#d8d4ca':'#45443f';x.fillRect(0,0,w,h);
    x.strokeStyle='rgba(18,18,16,.7)';x.lineWidth=3;
    for(let i=0;i<=2;i++){x.beginPath();x.moveTo(i*w/2,0);x.lineTo(i*w/2,h);x.stroke();x.beginPath();x.moveTo(0,i*h/2);x.lineTo(w,i*h/2);x.stroke();}
    if(!LITE)grunge(x,w,h,10,.2);
  });
  // wooden door (256x512): grain + recessed panels with bevel shading
  TEX.door=makeCanvas(256,512,(x,w,h)=>{
    x.fillStyle=LITE?'#8a6a42':'#54401f';x.fillRect(0,0,w,h);
    for(let i=0;i<140;i++){
      const y0=rand(0,h);
      x.strokeStyle=`rgba(${irand(60,110)},${irand(44,80)},${irand(22,44)},${rand(.25,.5)})`;
      x.lineWidth=rand(1,3);x.beginPath();
      for(let px=0;px<=w;px+=16)x.lineTo(px,y0+Math.sin(px*0.03+i)*3);
      x.stroke();
    }
    const panel=(py,ph)=>{
      x.strokeStyle='rgba(20,12,4,.8)';x.lineWidth=5;x.strokeRect(16,py,w-32,ph);
      x.strokeStyle='rgba(255,220,160,.18)';x.lineWidth=2;x.strokeRect(20,py+4,w-40,ph-8);
      x.fillStyle='rgba(0,0,0,.14)';x.fillRect(24,py+8,w-48,ph-16);
    };
    panel(26,h*0.36);panel(h*0.5,h*0.4);
    // kick plate
    x.fillStyle='rgba(200,200,200,.12)';x.fillRect(24,h-44,w-48,26);
    if(!LITE)grunge(x,w,h,10,.15);
  });
  TEX.doorB=makeCanvas(128,256,(x,w,h)=>{
    x.fillStyle='#8c8c8c';x.fillRect(0,0,w,h);
    for(let i=0;i<400;i++){const v=irand(90,150);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(rand(0,w),rand(0,h),rand(2,8),1);}
    x.strokeStyle='#404040';x.lineWidth=4;x.strokeRect(8,12,w-16,h*0.36);x.strokeRect(8,h*0.5,w-16,h*0.4);
  });
  // brushed metal
  TEX.metal=makeCanvas(256,256,(x,w,h)=>{
    x.fillStyle=LITE?'#a8adb4':'#565a60';x.fillRect(0,0,w,h);
    for(let i=0;i<h;i+=2){x.fillStyle=`rgba(255,255,255,${rand(0.015,0.06)})`;x.fillRect(0,i,w,1);}
    x.fillStyle='rgba(20,20,20,.5)';
    [[10,10],[w-14,10],[10,h-14],[w-14,h-14]].forEach(p=>{x.beginPath();x.arc(p[0]+2,p[1]+2,3,0,TAU);x.fill();});
    if(!LITE)grunge(x,w,h,8,.18);
  });
  // stairs concrete with nosing highlight
  TEX.stair=makeCanvas(256,256,(x,w,h)=>{
    x.fillStyle=LITE?'#b0aca2':'#64625c';x.fillRect(0,0,w,h);
    for(let i=0;i<2000;i++){const v=irand(70,130);x.fillStyle=`rgba(${v},${v},${v-4},.2)`;x.fillRect(rand(0,w),rand(0,h),rand(1,3),rand(1,3));}
    x.fillStyle='rgba(255,255,255,.16)';x.fillRect(0,4,w,5);
    x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,h-16,w,5);
    if(!LITE)grunge(x,w,h,20,.16);
  });
  // blood splats -> colorful paint splats in lite
  TEX.blood=[];
  for(let v=0;v<3;v++){
    TEX.blood.push(makeCanvas(128,128,(x,w,h)=>{
      x.clearRect(0,0,w,h);
      const blobs=irand(4,7);
      for(let i=0;i<blobs;i++){
        const bx=rand(20,108),by=rand(20,108),br=rand(6,26);
        x.fillStyle=LITE?`hsla(${irand(0,360)},75%,55%,${rand(.5,.8)})`:`rgba(${irand(90,130)},8,10,${rand(.55,.9)})`;
        x.beginPath();x.arc(bx,by,br,0,TAU);x.fill();
        for(let k=0;k<8;k++){const a=rand(0,TAU),d=br+rand(2,20);x.beginPath();x.arc(bx+Math.cos(a)*d,by+Math.sin(a)*d,rand(1,4),0,TAU);x.fill();}
      }
    }));
  }
  // posters (cheerful in lite)
  TEX.posters=LITE?[
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#ffd9a8';x.fillRect(0,0,w,h);x.fillStyle='#e05555';x.font='bold 26px Arial';x.textAlign='center';x.fillText('SCIENCE',w/2,54);x.fillText('FAIR!',w/2,84);x.fillStyle='#333';x.font='12px Arial';x.fillText('EVERYONE WELCOME',w/2,130);}),
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#a8e0ff';x.fillRect(0,0,w,h);x.fillStyle='#1a5c8a';x.font='bold 22px Arial';x.textAlign='center';x.fillText('ROBOT',w/2,60);x.fillText('CLUB',w/2,88);x.fillStyle='#333';x.font='12px Arial';x.fillText('BEEP BOOP ✨',w/2,132);}),
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#c8f0c0';x.fillRect(0,0,w,h);x.fillStyle='#207030';x.font='bold 22px Arial';x.textAlign='center';x.fillText('SPORTS',w/2,60);x.fillText('DAY',w/2,88);x.fillStyle='#333';x.font='12px Arial';x.fillText('GO TEAM GO!',w/2,132);}),
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#ffe8f0';x.fillRect(0,0,w,h);x.fillStyle='#a04868';x.font='bold 20px Arial';x.textAlign='center';x.fillText('FIELD',w/2,60);x.fillText('TRIP',w/2,86);x.fillStyle='#333';x.font='12px Arial';x.fillText('FRIDAY 🎒',w/2,130);}),
  ]:[
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#c9b98a';x.fillRect(0,0,w,h);x.fillStyle='#7a1c1c';x.font='bold 26px Arial';x.textAlign='center';x.fillText('SPORTS',w/2,54);x.fillText('FESTIVAL',w/2,84);x.fillStyle='#333';x.font='12px Arial';x.fillText('SEOWON HIGH',w/2,130);grunge(x,w,h,8,.15);}),
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#9fb3a0';x.fillRect(0,0,w,h);x.fillStyle='#22301f';x.font='bold 20px Arial';x.textAlign='center';x.fillText('STUDY',w/2,60);x.fillText('HARD',w/2,88);x.fillStyle='#333';x.font='12px Arial';x.fillText('EXAM WEEK',w/2,132);grunge(x,w,h,8,.15);}),
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#b3a08e';x.fillRect(0,0,w,h);x.fillStyle='#402218';x.font='bold 18px Arial';x.textAlign='center';x.fillText('SCIENCE',w/2,56);x.fillText('CLUB',w/2,82);x.fillStyle='#333';x.font='11px Arial';x.fillText('ROOM 3-1',w/2,128);grunge(x,w,h,8,.15);}),
    makeCanvas(128,180,(x,w,h)=>{x.fillStyle='#c7c3b4';x.fillRect(0,0,w,h);x.fillStyle='#7a1c1c';x.font='bold 22px Arial';x.textAlign='center';x.fillText('MISSING',w/2,50);x.fillStyle='#333';x.font='11px Arial';x.fillText('HAVE YOU SEEN',w/2,100);x.fillText('THIS STUDENT?',w/2,116);grunge(x,w,h,8,.15);}),
  ];
  // signs
  TEX.sign=(txt,bg='#1c1c1e',fg='#ffd34d')=>makeCanvas(512,96,(x,w,h)=>{
    x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle=fg;x.lineWidth=5;x.strokeRect(6,6,w-12,h-12);
    x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';
    let fs=44;
    do{x.font='bold '+fs+'px Consolas,"Microsoft YaHei",monospace';fs-=2;}while(fs>14&&x.measureText(txt).width>w-36);
    x.fillText(txt,w/2,h/2+1);
  });
  TEX.destLabel=f=>makeCanvas(256,128,(x,w,h)=>{   // the level you reach at the top of this flight
    const dest=f+1;
    x.fillStyle='#0d2010';x.fillRect(0,0,w,h);x.strokeStyle='#59ff7a';x.lineWidth=5;x.strokeRect(6,6,w-12,h-12);
    x.fillStyle='#a8ffb8';x.font='bold 44px Consolas,monospace';x.textAlign='center';x.textBaseline='middle';
    x.fillText(dest>=CFG.FLOORS?T('fl_roof'):(dest===0?T('fl_ground'):T('fl_floor',{n:dest})),w/2,h/2);
  });
  TEX.floorLabel=f=>makeCanvas(256,128,(x,w,h)=>{
    x.fillStyle='#3a3a3c';x.fillRect(0,0,w,h);x.strokeStyle='#8a8a8a';x.lineWidth=4;x.strokeRect(5,5,w-10,h-10);
    x.fillStyle='#ffd9a0';x.font='bold 44px Consolas,monospace';x.textAlign='center';x.textBaseline='middle';
    x.fillText(f>=CFG.FLOORS?T('fl_roof'):(f===0?T('fl_ground'):T('fl_floor',{n:f})),w/2,h/2);
  });
  TEX.board=makeCanvas(128,128,(x,w,h)=>{
    x.clearRect(0,0,w,h);
    for(let i=0;i<4;i++){x.save();x.translate(64,20+i*30);x.rotate(rand(-.08,.08));x.fillStyle=`rgb(${irand(110,140)},${irand(80,105)},${irand(50,66)})`;x.fillRect(-70,-11,140,22);x.fillStyle='rgba(40,25,10,.8)';for(let k=-50;k<60;k+=25)x.fillRect(k,-11,4,22);x.restore();}
  });
  // bookshelf spines
  TEX.books=makeCanvas(256,256,(x,w,h)=>{
    x.fillStyle='#241c12';x.fillRect(0,0,w,h);
    const cols=['#7a2020','#20507a','#3a6a30','#7a5a20','#5a2a6a','#8a6a3a','#3a3a3a','#803030','#2a5a55'];
    for(let row=0;row<4;row++){
      const ry=row*64;
      let bx=6;
      while(bx<w-8){
        const bw=irand(10,20),bh=irand(46,56);
        x.fillStyle=pick(cols);
        x.fillRect(bx,ry+64-bh-4,bw,bh);
        x.fillStyle='rgba(255,255,255,.15)';x.fillRect(bx+2,ry+64-bh,2,bh-6);
        bx+=bw+irand(1,4);
      }
      x.fillStyle='#0e0a06';x.fillRect(0,ry+60,w,5);
    }
  });
  /* ---- zombie flesh & cloth (procedural gore, shared across zombies) ---- */
  const splatter=(x,w,h,n,rmin,rmax,a0,a1)=>{for(let i=0;i<n;i++){
    x.fillStyle=`rgba(${irand(rmin,rmax)},8,10,${rand(a0,a1).toFixed(2)})`;
    const r=rand(3,16),bx=rand(0,w),by=rand(0,h);x.beginPath();x.arc(bx,by,r,0,TAU);x.fill();
    for(let k=0;k<5;k++){const a=rand(0,TAU),d=r+rand(2,14);x.beginPath();x.arc(bx+Math.cos(a)*d,by+Math.sin(a)*d,rand(1,4),0,TAU);x.fill();}}};
  TEX.zskin=makeCanvas(128,128,(x,w,h)=>{
    x.fillStyle='#7d786a';x.fillRect(0,0,w,h);   // dead grey-brown, not cartoon green
    for(let i=0;i<400;i++){const v=irand(90,140);x.fillStyle=`rgba(${v},${v-8},${v-22},.25)`;x.fillRect(rand(0,w),rand(0,h),rand(1,4),rand(1,4));}
    // dark veins
    x.strokeStyle='rgba(70,60,80,.4)';x.lineWidth=1;
    for(let i=0;i<10;i++){x.beginPath();let px=rand(0,w),py=rand(0,h);x.moveTo(px,py);for(let k=0;k<5;k++){px+=rand(-14,14);py+=rand(-14,14);x.lineTo(px,py);}x.stroke();}
    splatter(x,w,h,5,80,120,0.25,0.6);
    // bruises
    for(let i=0;i<6;i++){x.fillStyle=`rgba(${irand(40,70)},${irand(50,80)},${irand(35,55)},${rand(.15,.3)})`;
      x.beginPath();x.arc(rand(0,w),rand(0,h),rand(6,18),0,TAU);x.fill();}
  });
  TEX.zclothA=makeCanvas(128,128,(x,w,h)=>{ // teacher clothes: dark suit + loose red tie
    x.fillStyle='#2c2f36';x.fillRect(0,0,w,h);
    for(let i=0;i<200;i++){x.fillStyle=`rgba(${irand(20,45)},${irand(22,48)},${irand(26,55)},.4)`;x.fillRect(rand(0,w),rand(0,h),rand(1,5),rand(1,5));}
    x.fillStyle='#fff';x.fillRect(w/2-9,0,18,h*0.5); // shirt strip
    x.fillStyle='#7a1418';x.fillRect(w/2-4,4,8,h*0.44); // the tie, pulled loose
    x.fillStyle='#7a1418';x.fillRect(w/2-7,0,14,8); // knot
    x.strokeStyle='rgba(5,5,6,.9)';x.lineWidth=2;
    for(let i=0;i<6;i++){x.beginPath();const px=rand(0,w);x.moveTo(px,rand(0,h*0.4));x.lineTo(px+rand(-10,10),rand(h*0.5,h));x.stroke();}
    splatter(x,w,h,7,90,130,0.3,0.7);
  });
  TEX.zclothB=makeCanvas(128,128,(x,w,h)=>{ // brute rags with exposed-rib shading
    x.fillStyle='#23281e';x.fillRect(0,0,w,h);
    for(let i=0;i<160;i++){x.fillStyle=`rgba(${irand(15,35)},${irand(20,40)},${irand(12,28)},.5)`;x.fillRect(rand(0,w),rand(0,h),rand(2,6),rand(1,4));}
    x.fillStyle='rgba(190,180,160,.5)'; // ribs showing through the tear
    for(let i=0;i<4;i++)x.fillRect(w*0.3+i*10,h*0.3,5,h*0.34);
    x.fillStyle='rgba(0,0,0,.8)';x.fillRect(w*0.3-3,h*0.26,w*0.42,4);
    splatter(x,w,h,9,80,110,0.35,0.75);
  });
  TEX.zuniform=makeCanvas(128,128,(x,w,h)=>{ // school uniform: white shirt + GREEN VEST (freshly turned student)
    x.fillStyle='#e2ddd0';x.fillRect(0,0,w,h); // white shirt
    for(let i=0;i<80;i++){x.fillStyle=`rgba(${irand(190,222)},${irand(185,215)},${irand(170,200)},.3)`;x.fillRect(rand(0,w),rand(0,h),rand(1,4),rand(1,4));}
    // green vest panels with a white V down the chest
    x.fillStyle='#3f7a44';
    x.fillRect(4,6,30,h-10);x.fillRect(w-34,6,30,h-10);
    x.beginPath();x.moveTo(4,4);x.lineTo(w/2-14,4);x.lineTo(w/2,h*0.34);x.lineTo(w/2+14,4);x.lineTo(w-4,4);x.lineTo(w-4,16);x.lineTo(w/2+20,h*0.3);x.lineTo(w/2,h*0.5);x.lineTo(w/2-20,h*0.3);x.lineTo(4,16);x.closePath();x.fill();
    x.fillStyle='#d8d3c6';x.fillRect(w/2-5,6,10,h-10); // shirt placket over the vest
    x.strokeStyle='#1c2a4a';x.lineWidth=2;x.beginPath();x.moveTo(w/2-14,4);x.lineTo(w/2,h*0.34);x.lineTo(w/2+14,4);x.stroke(); // collar
    splatter(x,w,h,7,110,150,0.45,0.85); // fresh blood across the uniform
  });
  TEX.zface=makeCanvas(128,128,(x,w,h)=>{ // a dead face: sunken sockets, dried blood, grey skin — no cartoon eyes
    x.fillStyle='#7a736a';x.fillRect(0,0,w,h);
    for(let i=0;i<300;i++){const v=irand(95,140);x.fillStyle=`rgba(${v},${v-6},${v-16},.16)`;x.fillRect(rand(0,w),rand(0,h),rand(1,4),rand(1,3));}
    // cheekbones / temples: soft dark shading
    const shade=(cx,cy,r,al)=>{const gr=x.createRadialGradient(cx,cy,1,cx,cy,r);gr.addColorStop(0,`rgba(28,20,18,${al})`);gr.addColorStop(1,'rgba(28,20,18,0)');x.fillStyle=gr;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();};
    shade(20,60,26,.35);shade(108,60,26,.35);shade(64,96,22,.28);
    for(const ex of [42,86]){                       // sunken sockets, hollow — the glow comes from the eye meshes
      shade(ex,52,17,.85);shade(ex,50,9,.9);
      x.strokeStyle='rgba(50,30,28,.5)';x.lineWidth=1.5;x.beginPath();x.moveTo(ex-13,62);x.quadraticCurveTo(ex,68,ex+13,62);x.stroke();
    }
    x.strokeStyle='rgba(60,40,38,.45)';x.lineWidth=2;x.beginPath();x.moveTo(64,58);x.lineTo(60,84);x.stroke();  // nose shadow
    x.fillStyle='rgba(30,10,12,.75)';x.beginPath();x.ellipse(64,100,15,5,0,0,TAU);x.fill();                     // thin dead lips
    // veins under the skin
    x.strokeStyle='rgba(58,48,70,.35)';x.lineWidth=1;
    for(let i=0;i<10;i++){x.beginPath();let px=rand(10,118),py=rand(20,110);x.moveTo(px,py);for(let k=0;k<4;k++){px+=rand(-10,10);py+=rand(-9,9);x.lineTo(px,py);}x.stroke();}
    // dried blood from the mouth and one eye, plus grime
    for(let i=0;i<5;i++){const bx=52+i*5+rand(-3,3);x.fillStyle=`rgba(${irand(60,95)},6,8,${rand(.4,.75).toFixed(2)})`;x.fillRect(bx,102,rand(1.5,3),rand(8,24));}
    x.fillStyle='rgba(75,6,8,.6)';x.beginPath();x.moveTo(86,58);x.quadraticCurveTo(92,80,88,104);x.quadraticCurveTo(82,80,80,60);x.closePath();x.fill();
    for(let i=0;i<30;i++){x.fillStyle='rgba(38,30,24,.3)';x.fillRect(rand(0,w),rand(0,h),rand(1,3),rand(1,3));}
  });
  // the school's GREEN uniform shirt (every infected student wears it) — front is the texture centre
  const greenShirt=(x,w,h,blood,base)=>{
    x.fillStyle=base;x.fillRect(0,0,w,h);
    for(let i=0;i<260;i++){const g2=irand(80,120);x.fillStyle=`rgba(${g2-50},${g2},${g2-40},.16)`;x.fillRect(rand(0,w),rand(0,h),rand(1,5),rand(1,3));}
    x.strokeStyle='rgba(15,35,22,.35)';x.lineWidth=2;                          // fabric folds
    for(let i=0;i<8;i++){x.beginPath();const px=rand(0,w);x.moveTo(px,rand(0,h*.3));x.quadraticCurveTo(px+rand(-12,12),h*.5,px+rand(-8,8),h);x.stroke();}
    x.fillStyle='rgba(20,45,30,.9)';x.beginPath();x.moveTo(w/2-24,0);x.lineTo(w/2,18);x.lineTo(w/2+24,0);x.closePath();x.fill(); // open collar
    x.fillStyle='rgba(255,255,255,.08)';x.fillRect(w/2-3,14,6,h-14);           // placket
    x.fillStyle='#d8d2c0';for(let i=0;i<4;i++){x.beginPath();x.arc(w/2,26+i*22,1.8,0,TAU);x.fill();}
    x.strokeStyle='rgba(15,35,22,.7)';x.lineWidth=1.5;x.strokeRect(w/2+10,32,16,14); // chest pocket
    x.fillStyle='#e8e4d8';x.fillRect(w/2-28,32,14,5);                           // name tag
    if(!blood)return;
    x.fillStyle='rgba(70,5,7,.8)';                                              // collar soaked from the bite
    x.beginPath();x.ellipse(w/2+rand(-14,14),6,16+blood*4,8+blood*2,0,0,TAU);x.fill();
    for(let i=0;i<3+blood*2;i++){                                               // a few runs of blood down the front
      const bx=w/2+rand(-30,30),y0=rand(4,20),len=rand(12,40+blood*6);
      x.fillStyle=`rgba(${irand(60,90)},5,7,${rand(.45,.75).toFixed(2)})`;
      x.fillRect(bx,y0,rand(1.2,2.4),len);x.beginPath();x.arc(bx+1.5,y0+len,rand(1.5,3),0,TAU);x.fill();
    }
    splatter(x,w,h,3+blood*2,70,105,0.35,0.7);
    for(let i=0;i<3;i++){x.fillStyle='rgba(38,4,6,.55)';x.beginPath();x.ellipse(rand(0,w),rand(h*.4,h),rand(6,14),rand(4,9),rand(0,3),0,TAU);x.fill();} // old stains
    x.fillStyle='rgba(8,10,8,.9)';                                              // rips
    for(let i=0;i<1+blood;i++){const tx=rand(0,w),ty=rand(h*.3,h);x.beginPath();x.moveTo(tx,ty);x.lineTo(tx+rand(6,14),ty+rand(-3,3));x.lineTo(tx+rand(2,8),ty+rand(5,12));x.closePath();x.fill();}
  };
  for(let v=0;v<3;v++)TEX['zgreen'+v]=makeCanvas(128,128,(x,w,h)=>greenShirt(x,w,h,v+1,['#3d6a4c','#37634a','#436f50'][v]));
  TEX.ztrousers=makeCanvas(64,64,(x,w,h)=>{ // dark uniform trousers, blood run down one leg
    x.fillStyle='#2a302d';x.fillRect(0,0,w,h);
    for(let i=0;i<90;i++){x.fillStyle='rgba(15,18,16,.35)';x.fillRect(rand(0,w),rand(0,h),rand(1,3),rand(2,6));}
    for(let i=0;i<5;i++){const bx=rand(0,w);x.fillStyle=`rgba(${irand(70,100)},6,8,.75)`;x.fillRect(bx,0,rand(2,5),rand(20,64));}
    splatter(x,w,h,4,70,100,0.4,0.7);
  });
  // Ji-eun: green knit cardigan over a white blouse — a smear of someone else's blood on the sleeve side
  const cardigan=(x,w,h,heavy)=>{
    x.fillStyle='#2f5c48';x.fillRect(0,0,w,h);
    for(let yy=0;yy<h;yy+=3)for(let xx=0;xx<w;xx+=3){x.fillStyle=`rgba(${irand(30,60)},${irand(80,110)},${irand(60,85)},.25)`;x.fillRect(xx,yy,2,2);} // knit
    x.fillStyle='#e6e2d8';x.beginPath();x.moveTo(w/2-16,0);x.lineTo(w/2,h*0.42);x.lineTo(w/2+16,0);x.closePath();x.fill();  // blouse V
    x.fillStyle='#f2efe8';x.fillRect(w/2-22,0,14,8);x.fillRect(w/2+8,0,14,8);   // collar points
    x.fillStyle='#1c3a2c';x.fillRect(w/2-2,h*0.42,4,h);                          // button line
    x.fillStyle='#d8d2c0';for(let i=0;i<4;i++){x.beginPath();x.arc(w/2,h*0.48+i*16,2.2,0,TAU);x.fill();}
    x.fillStyle='rgba(95,8,10,.8)';x.beginPath();x.ellipse(w*0.12,h*0.55,10,22,0.2,0,TAU);x.fill(); // smear on the side
    splatter(x,w,h,heavy?10:3,80,120,heavy?0.5:0.35,heavy?0.9:0.6);
    if(heavy)for(let i=0;i<10;i++){const bx=w/2+rand(-30,30),len=rand(20,70);x.fillStyle='rgba(90,6,8,.8)';x.fillRect(bx,rand(0,20),rand(2,4),len);}
  };
  TEX.zcardigan=makeCanvas(128,128,(x,w,h)=>cardigan(x,w,h,true));
  TEX.cardigan=makeCanvas(128,128,(x,w,h)=>cardigan(x,w,h,false));
  TEX.plaid=makeCanvas(64,64,(x,w,h)=>{
    x.fillStyle='#6d7176';x.fillRect(0,0,w,h);
    x.fillStyle='rgba(40,44,50,.55)';for(let i=0;i<w;i+=16){x.fillRect(i,0,6,h);x.fillRect(0,i,w,6);}
    x.fillStyle='rgba(230,230,230,.35)';for(let i=8;i<w;i+=16){x.fillRect(i,0,1,h);x.fillRect(0,i,w,1);}
    x.fillStyle='rgba(90,8,10,.45)';x.beginPath();x.ellipse(w*0.3,h*0.7,6,9,0,0,TAU);x.fill();
  });
  TEX.sock=makeCanvas(32,64,(x,w,h)=>{ // white knee sock, two dark stripes at the top (uv.y=1 is the top)
    x.fillStyle='#e9e7e2';x.fillRect(0,0,w,h);
    x.fillStyle='#1d2a24';x.fillRect(0,4,w,3);x.fillRect(0,10,w,3);
    x.fillStyle='rgba(120,110,100,.25)';x.fillRect(0,h-10,w,10);
  });
  TEX.zgown=makeCanvas(128,128,(x,w,h)=>{ // hospital gown — patient that never checked out
    x.fillStyle='#b8bcb0';x.fillRect(0,0,w,h);
    x.strokeStyle='rgba(120,124,116,.7)';x.lineWidth=1;
    for(let i=0;i<6;i++){x.beginPath();x.moveTo(0,i*h/6);x.lineTo(w,i*h/6);x.stroke();}
    splatter(x,w,h,5,90,125,0.25,0.6);
  });
}

/* ================= AUDIO ================= */
const HEART_ONLY=new URLSearchParams(location.search).has('heartonly'); // debug: mute everything except the heartbeat
/* AUD.B = synthesized buffers (always there) · AUD.V = zombie voice recordings (js/vox.js)
   AUD.R = recorded SFX (assets/sfx/*.wav, Mixkit free license) — play() prefers R/V and falls back to B */
const AUD={ctx:null,master:null,loops:{},B:{},V:{},R:{},ready:false,heartT:0,breathT:0.9,threat:0};
const SFX_FILES=['alarm','breath','buzz','clang','click','clunk','creak','eat','flare','growl1','growl2','growl3','heart','hurt',
  'paper','pickup','pstepRun','pstepSneak','pstepWalk','radio','rumble','scream','shot','snarl','stinger','swing','win',
  'zbreath','zmouth','zroar','zstep'];
function loadSample(url,cb){
  if(typeof fetch!=='function')return;
  try{
    fetch(url).then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status))
      .then(ab=>AUD.ctx.decodeAudioData(ab)).then(cb).catch(()=>{});
  }catch(e){}
}
function ensureAudio(){
  if(AUD.ready)return;
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  if(ctx.state==='suspended'&&ctx.resume)ctx.resume();
  AUD.ctx=ctx;
  AUD.master=ctx.createGain();AUD.master.gain.value=SET.vol;
  // gentle master compression: tames clipping crackle that made everything sound "like a radio"
  AUD.comp=ctx.createDynamicsCompressor();
  AUD.comp.threshold.value=-16;AUD.comp.knee.value=20;AUD.comp.ratio.value=4;
  AUD.comp.attack.value=0.004;AUD.comp.release.value=0.22;
  AUD.master.connect(AUD.comp);AUD.comp.connect(ctx.destination);
  // "monster throat" bus for zombie voices: grit + muffled top, so no clip ever reads as a person
  if(ctx.createWaveShaper&&ctx.createBiquadFilter){
    const sh=ctx.createWaveShaper(),n=1024,curve=new Float32Array(n);
    for(let i=0;i<n;i++){const x=i/(n-1)*2-1;curve[i]=Math.tanh(x*3.2)/Math.tanh(3.2);}
    sh.curve=curve;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2300;lp.Q.value=0.6;
    const low=ctx.createBiquadFilter();low.type='lowshelf';low.frequency.value=180;low.gain.value=5;
    const out=ctx.createGain();out.gain.value=0.8;
    sh.connect(lp);lp.connect(low);low.connect(out);out.connect(AUD.master);
    AUD.zbus=sh;
  }
  const SR=ctx.sampleRate;
  const mk=(dur,fn)=>{const b=ctx.createBuffer(1,Math.max(1,Math.floor(dur*SR)),SR),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=fn(i/SR,i/d.length);return b;};
  const noiseBuf=mk(2,()=>Math.random()*2-1);
  const ND=noiseBuf.getChannelData(0);
  const R=Math.random;
  function growl(dur,f0,f1){let ph=0,ph2=0,ph3=0;return mk(dur,(t,p)=>{
    const vib=Math.sin(t*2*Math.PI*(5.5+R()*2))*7;
    const f=lerp(f0,f1,p)+vib;ph+=f/SR;ph2+=f*1.98/SR;ph3+=f*2.98/SR;
    const n=ND[Math.floor((t*SR*0.5)%ND.length)]*0.22; // less hiss, more throat
    const wob=0.6+0.4*Math.sin(p*Math.PI*(2+R()*0.5));
    const env=Math.min(1,p*10)*(1-p)*(1-p*0.3);
    return (Math.sin(ph*Math.PI*2)*0.5+Math.sin(ph2*Math.PI*2)*0.28+Math.sin(ph3*Math.PI*2)*0.12+n)*env*1.25;
  });}
  const B=AUD.B={
    growl1:growl(1.0,85,55), growl2:growl(0.8,120,70), growl3:growl(1.3,65,40),
    scream:mk(1.1,(t,p)=>{const f=lerp(900,1400,p)+(R()*80);return (Math.sin(t*f*Math.PI*2)*0.5+Math.sin(t*f*1.5*Math.PI*2)*0.3)*(1-p)*0.8+ (R()*2-1)*0.25*(1-p);}),
    /* player footsteps: heel-then-toe double transient, weight matches the gait */
    pstepRun:mk(0.2,(t,p)=>{const heel=p<0.3?Math.sin(t*88*Math.PI*2)*Math.pow(1-p/0.3,2)*0.8:0;
      const toe=(p>0.42&&p<0.85)?Math.sin(t*70*Math.PI*2)*Math.pow(1-(p-0.42)/0.43,2)*0.55:0;
      const sc=ND[Math.floor(t*SR*1.3)%ND.length]*0.28*Math.pow(1-p,2);return heel+toe+sc;}),
    pstepWalk:mk(0.18,(t,p)=>{const heel=p<0.3?Math.sin(t*80*Math.PI*2)*Math.pow(1-p/0.3,2)*0.5:0;
      const toe=(p>0.42&&p<0.85)?Math.sin(t*66*Math.PI*2)*Math.pow(1-(p-0.42)/0.43,2)*0.34:0;
      const sc=ND[Math.floor(t*SR*1.1)%ND.length]*0.18*Math.pow(1-p,2);return heel+toe+sc;}),
    pstepSneak:mk(0.13,(t,p)=>{const sc=ND[Math.floor(t*SR*0.9)%ND.length]*0.14*Math.pow(1-p,2.5);
      return sc*Math.sin(p*Math.PI)+Math.sin(t*70*Math.PI*2)*Math.pow(1-p,3)*0.1;}),
    /* infected footsteps: deep dragging thud with a wet shuffle tail */
    zstep:mk(0.24,(t,p)=>{const th=Math.sin(t*52*Math.PI*2)*Math.pow(1-p,2.4)*0.85;
      const dr=ND[Math.floor(t*SR*0.6)%ND.length]*0.3*Math.pow(1-p,1.3)*Math.sin(p*Math.PI);
      return th+dr;}),
    pstep:mk(0.09,(t,p)=>(R()*2-1)*Math.pow(1-p,3)*0.5),
    heart:mk(0.66,(t,p)=>{ // lub-dub, deep and close — the reference "you hear your own heart" feel
      const a=p<0.16?Math.sin(t*46*Math.PI*2)*Math.pow(1-p/0.16,1.4):0;
      const b=(p>0.27&&p<0.44)?Math.sin(t*40*Math.PI*2)*0.66*Math.pow(1-(p-0.27)/0.17,1.4):0;
      return (a+b)*Math.pow(1-p,0.55);
    }),
    stinger:mk(1.4,(t,p)=>{const e=Math.pow(1-p,1.2);const s=Math.sin(t*220*Math.PI*2*(1+p*1.5))+Math.sin(t*227*Math.PI*2*(1+p*1.5))+Math.sin(t*110*Math.PI*2);return (s*0.4+(R()*2-1)*0.5*p*3)*e;}),
    creak:mk(1.7,(t,p)=>{ // slow stick-slip door hinge: pitch sag + irregular catch
      const sag=1-p*0.45;
      const f=(150+Math.sin(t*9.3)*26+Math.sin(t*3.7)*18)*sag;
      const slip=Math.pow(Math.abs(Math.sin(t*5.1+Math.sin(t*1.7)*1.2)),0.6);
      return Math.sin(t*f*Math.PI*2)*0.3*slip*Math.sin(p*Math.PI)+(R()*2-1)*0.045*slip*Math.sin(p*Math.PI);
    }),
    clang:mk(1.6,(t,p)=>{const e=Math.pow(1-p,3);let s=0;[523,677,911,1244].forEach((f,i)=>s+=Math.sin(t*f*Math.PI*2)*Math.pow(1-p,1+i*0.7));return s*0.12*e+(R()*2-1)*0.2*e;}),
    whisper:mk(1.5,(t,p)=>{const bp=Math.abs(Math.sin(t*3.1))*600+900;const n=ND[Math.floor(t*SR)%noiseBuf.length];return n*Math.sin(p*Math.PI)*0.16;}),
    pickup:mk(0.22,(t,p)=>{const f=p<0.5?880:1320;return Math.sin(t*f*Math.PI*2)*Math.pow(1-p,2)*0.3;}),
    click:mk(0.04,(t,p)=>(R()*2-1)*(1-p)*0.4),
    paper:mk(0.35,(t,p)=>(R()*2-1)*Math.sin(p*Math.PI)*0.25),
    clunk:mk(0.3,(t,p)=>Math.sin(t*75*Math.PI*2)*Math.pow(1-p,2)*0.8+(R()*2-1)*Math.pow(1-p,3)*0.5),
    rumble:mk(1.6,(t,p)=>{let s=0;for(let i=0;i<4;i++)s+=Math.sin(t*(38+i*7)*Math.PI*2+R());return (s*0.2+(R()*2-1)*0.5)*Math.pow(1-p,0.8)*0.7;}),
    alarm:mk(2.0,(t,p)=>{ // low mournful siren whoop (was a 620/840 Hz beeper — read as "bee" beeps)
      const f=lerp(196,262,0.5+0.5*Math.sin(t*0.9*Math.PI*2));
      const w=Math.min(1,p*5)*Math.sin(Math.min(1,(1-p)*5)*Math.PI);
      return (Math.sin(t*f*Math.PI*2)*0.4+Math.sin(t*f*1.5*Math.PI*2)*0.18)*w*0.7;}),
    thunder:mk(2.8,(t,p)=>{const n=ND[Math.floor((t*0.6)*SR)%noiseBuf.length];return n*Math.pow(1-p,1.6)*0.8;}),
    flare:mk(1.2,(t,p)=>(R()*2-1)*Math.pow(1-p,1.5)*0.35),
    hurt:mk(0.35,(t,p)=>{return (Math.sin(t*lerp(150,85,p)*Math.PI*2)*0.5+(R()*2-1)*0.3)*Math.pow(1-p,1.2);}),
    swing:mk(0.18,(t,p)=>(R()*2-1)*Math.sin(p*Math.PI)*0.3),
    /* short warning alert: two sharp tones, ~0.35 s — for "RUN" / ⚠ moments, never a long siren */
    alert:mk(0.36,(t,p)=>{
      const tone=(f0,t0,t1)=>t>=t0&&t<t1?Math.sign(Math.sin((t-t0)*f0*Math.PI*2))*0.35*Math.min(1,(t-t0)*200)*Math.min(1,(t1-t)*60):0;
      return tone(1046,0,0.13)+tone(784,0.18,0.33);}),
    /* zombie impacts — body hits, never a voice: crowbar = heavy blunt crunch, bullet = wet slap */
    hitMelee:mk(0.26,(t,p)=>{
      const body=Math.sin(t*lerp(95,48,p)*Math.PI*2)*Math.pow(1-p,2.2)*0.95;           // meat thump
      const crack=t<0.018?ND[Math.floor(t*SR*3)%ND.length]*(1-t/0.018)*0.9:0;           // bone crack
      const crunch=(t>0.012&&t<0.09)?ND[Math.floor(t*SR*1.7)%ND.length]*Math.pow(1-(t-0.012)/0.078,2)*0.35:0;
      return body+crack+crunch;}),
    hitBullet:mk(0.16,(t,p)=>{
      const slap=t<0.01?ND[Math.floor(t*SR*4)%ND.length]*(1-t/0.01):0;                  // entry snap
      const thud=Math.sin(t*lerp(140,70,p)*Math.PI*2)*Math.pow(1-p,3)*0.7;
      const wet=ND[Math.floor(t*SR*0.8)%ND.length]*Math.pow(1-p,4)*0.25;
      return slap*0.8+thud+wet;}),
    radio:mk(0.25,(t,p)=>{const n=ND[Math.floor(t*SR)%noiseBuf.length];return n*0.12*(p<0.15||p>0.85?1:0.4);}),
    win:mk(2.5,(t,p)=>{const ch=p<0.5?[262,330,392]:[330,392,523];let s=0;ch.forEach(f=>s+=Math.sin(t*f*Math.PI*2)*0.12);return s*Math.sin(Math.min(1,p*3)*Math.PI);}),
    /* --- friendly (lite mode) extras --- */
    servo:mk(0.34,(t,p)=>{const f=lerp(620,240,p);return (Math.sin(t*f*Math.PI*2)*0.5+ND[Math.floor(t*SR)%ND.length]*0.08)*Math.sin(p*Math.PI)*0.6;}),
    whir:mk(0.7,(t,p)=>{const f=lerp(90,150,p);const am=0.5+0.5*Math.sin(t*44*TAU);return Math.sin(t*f*Math.PI*2)*am*Math.sin(p*Math.PI)*0.4;}),
    beep:mk(0.16,(t,p)=>Math.sin(t*880*Math.PI*2)*(p<0.5?1:0.6)*(1-p)*0.4),
    boing:mk(0.6,(t,p)=>{const f=lerp(420,110,Math.pow(p,0.6))*(1+Math.sin(p*18)*0.18);return Math.sin(t*f*Math.PI*2)*Math.pow(1-p,1.3)*0.7;}),
    pop:mk(0.12,(t,p)=>Math.sin(t*lerp(300,90,p)*Math.PI*2)*Math.pow(1-p,2)*0.8),
    rstep:mk(0.11,(t,p)=>(ND[Math.floor(t*SR*2)%ND.length])*Math.pow(1-p,2.5)*0.35*Math.sin(p*Math.PI)),
    happyAlarm:mk(1.8,(t,p)=>{const notes=[523,659,784];const n=notes[Math.floor(t*3)%3];const on=(t*3%1)<0.55;return Math.sin(t*n*Math.PI*2)*on*0.28*Math.min(1,p*8)*(1-Math.pow(p,6)*0.7);}),
    ding:mk(0.9,(t,p)=>(Math.sin(t*1318*Math.PI*2)*0.4+Math.sin(t*2637*Math.PI*2)*0.15)*Math.pow(1-p,2.2)*0.5),
    shot:mk(0.3,(t,p)=>{const n=ND[Math.floor(t*SR*4)%ND.length];return (n*0.85+Math.sin(t*120*Math.PI*2)*0.5)*Math.pow(1-p,3)*0.9;}),
    /* --- horror extras: zombie snarl, zombie breath, player breath --- */
    snarl:mk(0.5,(t,p)=>{const f=lerp(190,80,p);const s=Math.sin(t*f*Math.PI*2)*0.5+Math.sin(t*f*2.7*Math.PI*2)*0.3+(R()*2-1)*0.3;
      return s*Math.pow(1-p,1.4)*(0.3+0.7*Math.min(1,p*12));}),
    zbreath:mk(1.1,(t,p)=>{const n=ND[Math.floor(t*SR*0.7)%ND.length];
      return n*Math.sin(p*Math.PI)*0.22*(0.6+0.4*Math.sin(t*31*TAU));}),
    breath:mk(1.5,(t,p)=>{const n=ND[Math.floor(t*SR*0.5)%ND.length];
      const inh=p<0.42?Math.sin(p/0.42*Math.PI):0;
      const exh=p>=0.5?Math.sin((p-0.5)/0.5*Math.PI):0;
      const rasp=1+0.3*Math.sin(t*92)*Math.sin(t*37); // throat rasp
      return n*0.34*(inh*0.75+exh)*rasp*(1+0.2*Math.sin(t*26*TAU));}),
    /* close-range zombie roar: sub-bass + raspy harmonics + breath — INTENSE (near only) */
    zroar:(()=>{let ph=0,ph2=0,ph3=0;return mk(1.8,(t,p)=>{
      const f=lerp(58,34,p)+Math.sin(t*11)*4;
      ph+=f/SR;ph2+=f*1.5/SR;ph3+=f*2.94/SR;
      const n=ND[Math.floor(t*SR*0.7)%ND.length]*0.4;
      const am=0.55+0.45*Math.sin(t*20.5+Math.sin(t*3.1)*2); // irregular roar pulse
      const env=Math.min(1,p*6)*(1-p*p);
      return (Math.sin(ph*TAU)*0.55+Math.sin(ph2*TAU)*0.3+Math.sin(ph3*TAU)*0.18+n*0.5)*am*env*1.3;
    });})(),
    /* wet feeding: irregular smacks + squelch (heard when they hunch over a body) */
    eat:mk(1.6,(t,p)=>{let out=0;
      const smacks=[[0.08,0.1],[0.24,0.08],[0.45,0.12],[0.62,0.07],[0.85,0.1],[1.1,0.09],[1.32,0.13]];
      for(const[st,d]of smacks){
        if(t>=st&&t<st+d){const q=(t-st)/d;
          out+=(ND[Math.floor(t*SR*2)%ND.length]*0.5+Math.sin(t*lerp(220,90,q)*TAU)*0.3)*Math.sin(q*Math.PI)*0.5;}
      }
      return out;}),
    /* mouth: dry clicks and lip smacks — they are always working their jaws */
    zmouth:mk(1.3,(t,p)=>{let out=0;
      const clicks=[[0.05,0.04],[0.3,0.05],[0.55,0.04],[0.8,0.06],[1.05,0.04]];
      for(const[st,d]of clicks){
        if(t>=st&&t<st+d){const q=(t-st)/d;
          out+=(Math.sin(t*lerp(700,300,q)*TAU)*0.2+ND[Math.floor(t*SR*3)%ND.length]*0.25)*Math.sin(q*Math.PI);}
      }
      return out;}),
  };
  AUD.noise=noiseBuf;
  /* === real zombie voice recordings (CC0, OpenGameArt) — embedded, decoded async, replaces synth === */
  const VOX_B64=window.VOX_B64||{};
  for(const k in VOX_B64){const bin=atob(VOX_B64[k].split(',')[1]),u=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    ctx.decodeAudioData(u.buffer).then(ab=>{AUD.V[k]=ab;(window.__voxOk=window.__voxOk||[]).push(k);})
      .catch(e=>{console.warn('vox decode failed:',k,e);(window.__voxFail=window.__voxFail||[]).push(String(e&&e.message||e));});}
  /* === end voice recordings === */
  // spooky reverb (scary mode only)
  if(MD.reverb){
    const ir=ctx.createBuffer(2,Math.floor(SR*1.1),SR);
    for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(R()*2-1)*Math.pow(1-i/d.length,2.6)*0.5;}
    const conv=ctx.createConvolver();conv.buffer=ir;
    const wet=ctx.createGain();wet.gain.value=0.3;
    AUD.master.connect(conv);conv.connect(wet);wet.connect(ctx.destination);
  }
  // loops — the world is SILENT by design now: no music, no drone bed.
  // The helicopter rotor is kept because it is diegetic (you can really hear it on the roof).
  function loop(name,buf,vol){const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;
    const g=ctx.createGain();g.gain.value=vol;s.connect(g);g.connect(AUD.master);s.start();g._src=s;AUD.loops[name]=g;return g;}
  const chop=mk(1.0,(t,p)=>{const rot=(Math.sin(t*13*TAU)*0.5+0.5);const n=ND[Math.floor(t*SR)%noiseBuf.length];
    return (n*rot*0.5+Math.sin(t*41*Math.PI*2)*0.15)*0.8;});
    if(!HEART_ONLY)loop('chopper',chop,0.0);
  // calm horror bed: a slow tonal sub-drone. Pure tones only (integer # of cycles over the
  // loop) so the wrap is seamless — a noise bed would click on every loop point.
  if(MD.jumpscares){
    const drone=mk(16,(t,p)=>{
      const sw=(0.7+0.3*Math.sin(TAU*t/16+1.3)*Math.sin(TAU*t/8));
      return (Math.sin(TAU*40*t)*0.30+Math.sin(TAU*40.5*t)*0.30+
              Math.sin(TAU*60.5*t)*0.11+Math.sin(TAU*80*t)*0.05)*sw;
    });
    loop('drone',drone,0.0);
    // tension layer: a barely-audible detuned shimmer that swells only while something is hunting you
    const tens=mk(8,(t,p)=>{
      const tr=0.6+0.4*Math.sin(TAU*4.75*t);
      return (Math.sin(TAU*220*t)*0.4+Math.sin(TAU*233.25*t)*0.4+Math.sin(TAU*466.5*t)*0.12)*tr;
    });
    loop('tension',tens,0.0);
  }
  // subtle room tone: the building breathes too (ventilation far above)
  if(MD.jumpscares){
    const vent=mk(4,(t,p)=>{const n=ND[Math.floor(t*SR*0.22)%ND.length];
      const lfo=0.55+0.45*Math.sin(t*0.45+Math.sin(t*0.13)*2);
      return n*lfo*0.5+Math.sin(t*63*Math.PI*2)*0.014;});
    loop('vent',vent,0.06);
  }
  // recorded SFX + the real helicopter / thunder (assets/): swapped in as soon as they decode
  for(const n of SFX_FILES)loadSample('assets/sfx/'+n+'.wav',b=>{AUD.R[n]=b;});
  loadSample('assets/chopper.wav',b=>{AUD.R.chopper=b;swapLoop('chopper',b);});
  loadSample('assets/thunder.wav',b=>{AUD.R.thunder=b;});
  AUD.ready=true;
}
function setLoop(name,v){if(!AUD.ready)return;const g=AUD.loops[name];if(g)g.gain.setTargetAtTime(v,AUD.ctx.currentTime,0.4);}
function swapLoop(name,buf){
  const old=AUD.loops[name];if(!old||!AUD.ctx)return;
  const s=AUD.ctx.createBufferSource();s.buffer=buf;s.loop=true;
  const g=AUD.ctx.createGain();g.gain.value=old.gain.value;s.connect(g);g.connect(AUD.master);s.start();
  try{old._src.stop();}catch(e){}
  g._src=s;AUD.loops[name]=g;
}
/* zombie voices exist twice (recordings + samples): alternate for variety */
const VOICES=new Set(['growl1','growl2','growl3','scream','snarl','zbreath','zmouth','eat','zroar','hurt']);
/* zombie vocal calls: always through the monster bus, pitched down. 'hurt' is NOT here — zombies take
   hits with impact sounds (hitMelee/hitBullet); 'hurt' and 'pscream' are the player's own voice. */
const ZVOX=new Set(['growl1','growl2','growl3','scream','snarl','zbreath','zmouth','eat','zroar']);
function pickBuffer(key){
  if(key==='pscream')return AUD.R.scream||AUD.V.scream||AUD.B.scream||AUD.noise;
  if(key==='scream')return AUD.V.scream||AUD.V.screech||AUD.B.scream||AUD.noise; // the zombie pack's scream, never the human one
  const r=AUD.R[key],v=AUD.V[key];
  if(r&&v&&VOICES.has(key))return Math.random()<0.5?r:v;
  return r||v||AUD.B[key]||AUD.noise;
}
function setVolume(v){SET.vol=v;saveSet();if(AUD.master)AUD.master.gain.value=v;}

/* spatial play: pan+attenuate by camera-relative position */
const _sv=new THREE.Vector3();
function play(name,opts={}){
  if(HEART_ONLY&&name!=='heart')return;
  if(!AUD.ready||G.mode!=='playing'&&!opts.force)return;
  const ctx=AUD.ctx;let vol=opts.vol??1,pan=0;
  if(opts.pan!==undefined){pan=clamp(opts.pan,-1,1);}          // fixed pan (L/R footfalls)
  else if(opts.pos&&camera){
    _sv.copy(opts.pos).sub(camera.position);
    const d=_sv.length();
    vol*=clamp(1/(1+d*d*0.012),0.02,1)*(opts.ref??30);
    const fwd=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw)).multiplyScalar(-1);
    const right=new THREE.Vector3(-fwd.z,0,fwd.x);
    pan=clamp(_sv.normalize().dot(right),-1,1)*0.85;
  }
  if(vol<0.015)return;
  const src=ctx.createBufferSource();
  const key=(MD.id==='lite'&&LMAP[name]&&AUD.B[LMAP[name]])?LMAP[name]:name;
  src.buffer=pickBuffer(key);
  const zv=MD.id!=='lite'&&ZVOX.has(key)&&AUD.zbus;
  src.playbackRate.value=(opts.rate||1)*rand(0.94,1.06)*(zv?0.84:1);
  const g=ctx.createGain();g.gain.value=vol;
  const bus=zv?AUD.zbus:AUD.master;
  const p=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(p){p.pan.value=pan;g.connect(p);p.connect(bus);}else g.connect(bus);
  src.connect(g);src.start();
}
function emitNoise(x,z,f,radius){ // gameplay noise event (attracts zombies)
  for(const z2 of world.zombies){
    if(z2.f!==f||z2.dead)continue;
    if(dist2(z2.g.position.x,z2.g.position.z,x,z)<radius*radius)z2.hear(x,z);
  }
}

/* =====================================================================
   SECTION C — WORLD GENERATION + PHYSICS
===================================================================== */
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x020204);
scene.fog=new THREE.FogExp2(0x040406,0.052);
const camera=new THREE.PerspectiveCamera(SET.fov,innerWidth/innerHeight,0.08,120);
const renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);sizeGrain();});

const world={cols:Array.from({length:CFG.FLOORS+1},()=>[]),levels:[],layout:[],items:[],doors:[],gates:[],zombies:[],npcs:[],
  terminal:null,breakers:{},extract:null,heli:null,roofGroup:null,burstDoor:null,moon:null,
  roomDoor:{}};
let MAT={};

function buildMaterials(){
  MAT={
    wall:new THREE.MeshStandardMaterial({map:texOf(TEX.wall,6,2),bumpMap:texOf(TEX.wallB,6,2),bumpScale:0.6,roughness:.95}),
    wallDark:new THREE.MeshStandardMaterial({map:texOf(TEX.wall,6,2),bumpMap:texOf(TEX.wallB,6,2),bumpScale:0.6,color:0x8a8a8a,roughness:1}),
    floor:new THREE.MeshStandardMaterial({map:texOf(TEX.floor,20,8),bumpMap:texOf(TEX.floorB,20,8),bumpScale:0.5,roughness:.9}),
    ceil:new THREE.MeshStandardMaterial({map:texOf(TEX.ceil,14,6),roughness:1}),
    door:new THREE.MeshStandardMaterial({map:texOf(TEX.door,1,1),bumpMap:texOf(TEX.doorB,1,1),bumpScale:0.8,roughness:.8}),
    metal:new THREE.MeshStandardMaterial({map:texOf(TEX.metal,2,1),roughness:.55,metalness:.6}),
    rail:new THREE.MeshStandardMaterial({color:0x3c4046,roughness:.5,metalness:.7}),
    stair:new THREE.MeshStandardMaterial({map:texOf(TEX.stair,1,1),roughness:.95}),
    desk:new THREE.MeshStandardMaterial({map:texOf(TEX.door,2,1),color:0xb08a5a,roughness:.85}),
    locker:new THREE.MeshStandardMaterial({map:texOf(TEX.metal,1,2),color:0x6a7f6a,roughness:.6,metalness:.4}),
    bed:new THREE.MeshStandardMaterial({color:0x7a7466,roughness:1}),
    dark:new THREE.MeshStandardMaterial({color:0x17181c,roughness:.9}),
    glass:new THREE.MeshStandardMaterial({color:0x0a1018,roughness:.15,metalness:.8,emissive:0x0a1420,emissiveIntensity:.6}),
    board:new THREE.MeshStandardMaterial({map:texOf(TEX.board,1,1),transparent:true,alphaTest:0.3,side:THREE.DoubleSide,roughness:.9}),
    plank:new THREE.MeshStandardMaterial({color:0x7a5a38,roughness:.95}),
    arrow:new THREE.MeshBasicMaterial({color:0x2fbf5f,transparent:true,opacity:0.5,map:new THREE.CanvasTexture(makeCanvas(64,128,(x,w,h)=>{
      x.clearRect(0,0,w,h);x.fillStyle='#fff';
      x.beginPath();x.moveTo(w/2,4);x.lineTo(w-8,h*0.55);x.lineTo(w*0.68,h*0.55);x.lineTo(w*0.68,h-4);
      x.lineTo(w*0.32,h-4);x.lineTo(w*0.32,h*0.55);x.lineTo(8,h*0.55);x.closePath();x.fill();
    })),depthWrite:false}),
    blood:TEX.blood.map(c=>new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),transparent:true,roughness:.4,color:0xffffff,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})),
    posters:TEX.posters.map(c=>new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),roughness:.9})),
    lamp:new THREE.MeshStandardMaterial({color:0x222222,emissive:0xfff2cc,emissiveIntensity:MD.id==='lite'?2.4:1.6}),
    lampOff:new THREE.MeshStandardMaterial({color:0x1a1a1a,emissive:0x000000}),
    lampRed:new THREE.MeshStandardMaterial({color:0x220000,emissive:0xff2211,emissiveIntensity:2.2}),
    screen:new THREE.MeshStandardMaterial({color:0x020a04,emissive:0x1fdd6a,emissiveIntensity:1.4}),
    gen:new THREE.MeshStandardMaterial({color:0x3a4046,roughness:.6,metalness:.5}),
    bloodPool:new THREE.MeshStandardMaterial({color:0x4a0508,roughness:.35}),
    flare:new THREE.MeshStandardMaterial({color:0x881100,emissive:0xff3300,emissiveIntensity:3}),
    card:{
      red:new THREE.MeshStandardMaterial({color:0x881111,emissive:0xff3333,emissiveIntensity:.7}),
      blue:new THREE.MeshStandardMaterial({color:0x114488,emissive:0x3388ff,emissiveIntensity:.7}),
      green:new THREE.MeshStandardMaterial({color:0x118844,emissive:0x33ff88,emissiveIntensity:.7}),
      yellow:new THREE.MeshStandardMaterial({color:0x887711,emissive:0xffdd33,emissiveIntensity:.7}),
    },
    heli:new THREE.MeshStandardMaterial({color:0x2e3a2e,roughness:.6,metalness:.4}),
  };
}

/* ---------- primitive helpers ---------- */
function addBox(f,x,y,z,sx,sy,sz,mat,opts={}){
  const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);
  m.position.set(x,y,z);
  if(opts.ry)m.rotation.y=opts.ry;
  m.castShadow=opts.cast===true;   // only explicit casters (perf)
  m.receiveShadow=true;
  world.levels[f].add(m);
  if(opts.col!==false){
    world.cols[f].push({x0:x-sx/2,x1:x+sx/2,z0:z-sz/2,z1:z+sz/2,y0:y-sy/2,y1:y+sy/2,los:!!opts.los,off:false});
  }
  return m;
}
function addWall(f,x0,z0,x1,z1,opts={}){
  const h=opts.h??CFG.FH,y=opts.y??f*CFG.FH;
  if(Math.abs(x1-x0)<0.06){x0-=0.12;x1+=0.12;}      // wall runs along Z
  if(Math.abs(z1-z0)<0.06){z0-=0.12;z1+=0.12;}      // wall runs along X
  const m=addBox(f,(x0+x1)/2,y+h/2,(z0+z1)/2,Math.abs(x1-x0),h,Math.abs(z1-z0),opts.mat||MAT.wall,{los:opts.los!==false,cast:opts.cast});
  world.cols[f][world.cols[f].length-1].wall=true;  // tag real walls (furniture placement checks)
  return m;
}
function decal(f,x,z,r,mat,ry=rand(0,TAU)){
  if(!world.levels[f])return null;
  const m=new THREE.Mesh(new THREE.CircleGeometry(r,12),mat);
  m.rotation.x=-Math.PI/2;m.rotation.z=ry;m.position.set(x,f*CFG.FH+0.012,z);
  world.levels[f].add(m);return m;
}
function posterOn(f,x,y,z,ry,i){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(0.85,1.2),MAT.posters[i%MAT.posters.length]);
  m.position.set(x,y,z);m.rotation.y=ry;world.levels[f].add(m);
}
let SIGN_GLOW=0.35;   // set per floor while building: room signs only glow where there is power
const EXIT_GLOW=0.4;  // stairwell / exit signs run on their own emergency batteries
function signOn(f,x,y,z,ry,canvas,w=1.6,h=0.4,glow=SIGN_GLOW){
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:glow}));
  m.position.set(x,y,z);m.rotation.y=ry;world.levels[f].add(m);return m;
}

/* ---------- doors ---------- */
class DoorC{
  constructor(f,hx,hz,len,axis,opts={}){
    // axis 'x': wall runs along X, door gap in it (corridor walls). hinge at (hx,hz), leaf extends +len along axis
    this.f=f;this.axis=axis;this.open=false;this.boarded=!!opts.boarded;this.kick=!!opts.kick;this.swing=opts.swing??1;this.creaky=opts.creaky??(Math.random()<.4);
    this.id=opts.id||('d'+world.doors.length);
    const y=f*CFG.FH;
    this.g=new THREE.Group();this.g.position.set(hx,y,hz);
    const leaf=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?len-0.06:0.09,2.16,axis==='x'?0.09:len-0.06),MAT.door);
    leaf.position.set(axis==='x'?(len-0.06)/2+0.03:0,1.08,axis==='x'?0:(len-0.06)/2+0.03);
    leaf.castShadow=true;leaf.receiveShadow=true;
    const knob=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8),MAT.rail);
    knob.position.set(axis==='x'?len-0.16:0.08,1.0,axis==='x'?0.08:len-0.16);
    this.g.add(leaf,knob);world.levels[f].add(this.g);
    this.leaf=leaf;
    if(this.boarded){
      const side=opts.boardSide??1;   // which face of the leaf the planks are nailed to (the approach side)
      const b=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2.1),MAT.board);
      b.position.set(axis==='x'?(len)/2:0.1*side,1.1,axis==='x'?0.1*side:(len)/2);
      if(axis==='z')b.rotation.y=Math.PI/2;
      b.userData.ry=axis==='z'?Math.PI/2:0;
      this.g.add(b);this.boardMesh=b;
    }
    // collider: closed = doorway strip; open = thin strip where the leaf rests (never walk through the open leaf)
    const off=0.07,s=this.swing,l=len;
    this.colClosed={x0:hx-(axis==='x'?0:off),x1:hx+(axis==='x'?l:off),z0:hz-(axis==='x'?off:0),z1:hz+(axis==='x'?off:l),y0:y,y1:y+2.2,los:false,off:false};
    this.colOpen=axis==='x'
      ?{x0:hx-0.3,x1:hx+0.2,z0:Math.min(hz,hz+s*l),z1:Math.max(hz,hz+s*l),y0:y,y1:y+2.2,los:false,off:false}
      :{x0:Math.min(hx,hx+s*l),x1:Math.max(hx,hx+s*l),z0:hz-0.3,z1:hz+0.2,y0:y,y1:y+2.2,los:false,off:false};
    this.col={...this.colClosed};
    world.cols[f].push(this.col);
    // keep the doorway and its approach clear for the whole leaf swing
    if(axis==='x')addKeepClear(f,hx+len/2,hz,len+1.4,4.2);
    else addKeepClear(f,hx,hz+len/2,4.2,len+1.4);
    this.label=opts.label||'Open door';
    world.doors.push(this);
  }
  use(){
    if(this.boarded){
      if(!INV.crowbar){toast(T('t_need_crowbar'));return'boarded';}
      return'board-break'; // handled by hold-interaction
    }
    this.setOpen(!this.open,true);
    if(G.mp&&!G.host)netSend({t:'ev',k:'door',id:this.id,open:this.open});
    return'done';
  }
  setOpen(o,sound){
    this.open=o;
    Object.assign(this.col,o?this.colOpen:this.colClosed);
    this.col.off=false;
    const target=o?(this.axis==='x'?-this.swing*1.85:this.swing*1.85):0;
    this.targetRy=target;
    if(sound){
      play('creak',{pos:this.g.position,vol:.8,ref:14});
      const lx=this.g.position.x,lz=this.g.position.z;
      emitNoise(lx,lz,this.f,this.creaky?9:5);
      if(G.host&&G.mp)netBroadcast({t:'ev',k:'door',id:this.id,open:o});
    }
  }
  update(dt){
    if(this.targetRy===undefined)return;
    const cur=this.g.rotation.y;
    this.g.rotation.y=lerp(cur,this.targetRy,Math.min(1,dt*6));
  }
  breakBoards(quiet){
    this.boarded=false;
    if(this.boardMesh){
      if(!quiet)plankBurst(this.f,this.boardMesh.getWorldPosition(new THREE.Vector3()),this.boardMesh.userData.ry||0);
      if(this.boardMesh.parent)this.boardMesh.parent.remove(this.boardMesh);this.boardMesh=null;
    }
    G.boardsBroken.add(this.id);
    if(quiet)return;
    play('clang',{pos:this.g.position,vol:1,ref:18});
    emitNoise(this.g.position.x,this.g.position.z,this.f,16);
    toast(T('t_boards'));
    if(G.mp&&!G.host)netSend({t:'ev',k:'boards',id:this.id});
    if(G.host&&G.mp)netBroadcast({t:'ev',k:'boards',id:this.id});
  }
}

/* ---------- stairwell gates ---------- */
class GateC{
  constructor(f,type){
    this.f=f;this.type=type;this.open=false;this.anim=0;
    const y=f*CFG.FH,gx=(CFG.LANE.x0+0.6),z0=CFG.LANE.z0,z1=CFG.LANE.z1,zc=(z0+z1)/2;
    this.g=new THREE.Group();this.g.position.set(gx,y,zc);
    world.levels[f].add(this.g);
    const base=f*CFG.FH+(gx-CFG.LANE.x0)/(CFG.LANE.x1-CFG.LANE.x0)*CFG.FH;
    const H=CFG.FH-(base-f*CFG.FH)+0.4;
    if(type==='board'){
      const b=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2.2),MAT.board);
      b.rotation.y=Math.PI/2;b.position.set(-0.08,1.15,0);this.g.add(b);
      b.userData.ry=Math.PI/2;
      this.mesh=b;
    }else if(type==='shutter'){
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.14,2.4,z1-z0),MAT.metal);
      m.position.set(0,1.2,0);this.g.add(m);this.mesh=m;
    }else{
      const bars=new THREE.Group();
      for(let i=0;i<7;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(0.05,2.3,0.05),MAT.rail);b.position.set(0,1.15,-0.55+i*0.185);bars.add(b);}
      const top=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.06,z1-z0),MAT.rail);top.position.set(0,2.28,0);bars.add(top);
      const bot=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.06,z1-z0),MAT.rail);bot.position.set(0,0.06,0);bars.add(bot);
      this.g.add(bars);this.mesh=bars;
      if(type.startsWith('card')){
        const col=type.split('-')[1];
        const reader=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.28,0.18),MAT.card[col]||MAT.card.red);
        reader.position.set(0.1,1.25,z1-zc-0.05);this.g.add(reader);
        signOn(f,gx+0.12,y+base-f*CFG.FH+1.75,zc+0.97,-Math.PI/2,TEX.sign(T('sg_access',{c:colName(col)}),'#101020','#9fd0ff'),0.9,0.24,EXIT_GLOW);
      }
    }
    if(type!=='board'){   // roller housing: an opened gate rolls up into this
      const hs=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.2,z1-z0+0.1),MAT.dark);
      hs.position.set(0,(base-f*CFG.FH)+2.55,0);this.g.add(hs);
    }
    this.col={x0:gx-0.13,x1:gx+0.13,z0:z0,z1:z1,y0:y,y1:y+2.5,los:false,off:false};
    world.cols[f].push(this.col);
    // lock status lamp: RED = sealed, GREEN = open. Readable from across the hall.
    this.lampMat=new THREE.MeshStandardMaterial({color:0x220000,emissive:0xff2211,emissiveIntensity:1.8});
    if(type!=='board'){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1),this.lampMat);
      lamp.position.set(0.16,2.44,0);this.g.add(lamp);
    }
    this.baseY=base;
    this.locked=true;
    world.gates.push(this);
  }
  /* [E] at a gate. Every gate belongs to one step of the mission chain and refuses to open early. */
  tryOpen(){
    const g=this;
    if(g.open||g.type==='board')return;
    if(g.type.startsWith('card')){
      const col=g.type.split('-')[1];
      if(!G.cards[col]){toast(T('g_locked2',{c:colName(col),where:T('gw_'+col)}));play('click',{vol:.5});return;}
      if(col==='red'&&!G.flags.power){toast(T('g_nopower'));play('click',{vol:.5});return;}
      if(!questAt(GATE_QUEST[g.f])){notYet();return;}
      play('beep',{pos:g.g.position,vol:.6,ref:10});
      g.unlock();toast(T('g_accept',{c:colName(col)}));
      return;
    }
    if(g.type==='shutter'){
      if(G.flags.shutter)g.unlock();
      else toast(T(G.flags.power?'g_shutter2':'g_shutter1'));
      return;
    }
    if(g.type==='power'){
      if(!G.flags.power2){toast(T('g_power'));play('click',{vol:.5});return;}
      if(!questAt(GATE_QUEST[g.f])){notYet();return;}
      g.unlock();
    }
  }
  unlock(){
    this.locked=false;this.setOpen(true);
    if(G.mp&&!G.host)netSend({t:'ev',k:'gate',f:this.f});
  }
  refreshLamp(){
    if(!this.lampMat)return;
    const ready=this.open||(this.type==='power'&&G.flags.power2)||(this.type==='shutter'&&G.flags.shutter);
    this.lampMat.emissive.setHex(ready?0x22ff66:0xff2211);
  }
  /* restore an already-opened gate without sound, noise or broadcast (saves / late joins) */
  openQuiet(){
    this.locked=false;this.open=true;this.col.off=true;G.gatesOpen.add(this.f);
    if(this.type==='board'){if(this.mesh){this.g.remove(this.mesh);this.mesh=null;}}
    else if(this.mesh){this.roll=1;this.update(0);}
    this.refreshLamp();
  }
  setOpen(o){
    this.open=o;this.col.off=o;this.locked=!o&&this.type!=='board';
    this.refreshLamp();
    if(o){G.gatesOpen.add(this.f);play('rumble',{pos:this.g.position,vol:.9,ref:20});emitNoise(this.g.position.x,this.g.position.z,this.f,10);
      // the tower notices: nearby zombies drift toward the opening gate
      for(const z of world.zombies){if(z.dead)continue;if(z.f===this.f||z.f===this.f-1)z.hear(this.g.position.x,this.g.position.z);}
      if(G.host&&G.mp)netBroadcast({t:'ev',k:'gate',f:this.f});
      questCheck();}   // the objective updates the moment the gate opens
  }
  breakBoards(){
    if(this.mesh){
      plankBurst(this.f,this.mesh.getWorldPosition(new THREE.Vector3()),this.mesh.userData.ry||0);
      this.g.remove(this.mesh);this.mesh=null;
    }
    play('clang',{pos:this.g.position,vol:1,ref:18});
    toast(T('t_boards'));
    this.locked=false;this.setOpen(true);
    G.boardsBroken.add('gate'+this.f);
    if(G.mp&&!G.host)netSend({t:'ev',k:'gate',f:this.f});
  }
  update(dt){
    if(!this.mesh||this.type==='board')return;
    // roll up: the bars/shutter shrink into the housing at the top — an open gate leaves the stairs clear
    this.roll=lerp(this.roll??(this.open?1:0),this.open?1:0,Math.min(1,dt*1.6));
    const top=(this.baseY-this.f*CFG.FH)+2.45,s=1-0.93*this.roll;
    this.mesh.scale.y=s;
    this.mesh.position.y=this.type==='shutter'?top-1.2*s:top-2.3*s;
  }
}

/* gate plan: gate i blocks ascent from level i to i+1 (levels: 0=GROUND,1..6=FLOORS,7=ROOF) */
const GATE_PLAN={
  1:'board',2:'card-red',3:'shutter',4:'card-blue',5:'power',6:'card-yellow'
};
/* the mission step each gate belongs to (a gate refuses to open before its step) */
const GATE_QUEST={1:'q_boards',2:'q_gate2',3:'q_shutter',4:'q_gate4',5:'q_gate5',6:'q_gate6'};
function colName(c){return T('col_'+c);}

/* ---------- falling planks (pried / kicked boards) ---------- */
const debris=[];
function plankBurst(f,pos,ry){
  if(!world.levels[f])return;
  const dx=player.pos.x-pos.x,dz=player.pos.z-pos.z,dl=Math.hypot(dx,dz)||1;
  for(let i=0;i<4;i++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.17,0.035),MAT.plank);
    m.rotation.order='YXZ';
    m.position.set(pos.x+rand(-0.08,0.08),pos.y-0.75+i*0.45,pos.z+rand(-0.08,0.08));
    m.rotation.set(0,ry,rand(-0.15,0.15));
    m.castShadow=true;
    world.levels[f].add(m);
    debris.push({m,f,vx:dx/dl*rand(0.6,1.6)+rand(-0.4,0.4),vy:rand(0.4,1.4),vz:dz/dl*rand(0.6,1.6)+rand(-0.4,0.4),
      spin:rand(-5,5),floorY:f*CFG.FH+0.02+i*0.036,tip:rand(1.2,1.57),rest:false});
  }
  burst(pos,0x8a6a3a,16,2.8,0.07);
}
function updateDebris(dt){
  for(const d of debris){
    if(d.rest)continue;
    d.vy+=CFG.GRAV*dt;
    const m=d.m;
    m.position.x+=d.vx*dt;m.position.y+=d.vy*dt;m.position.z+=d.vz*dt;
    m.rotation.z+=d.spin*dt;
    m.rotation.x=Math.min(Math.PI/2,m.rotation.x+dt*3.2);   // tips over as it falls
    if(m.position.y<=d.floorY){
      m.position.y=d.floorY;m.rotation.x=Math.PI/2;m.rotation.z=0;d.rest=true;
      play('clunk',{pos:m.position,vol:.35,ref:10,rate:rand(1.3,1.8)});
    }
  }
}

/* ---------- items ---------- */
let ITEM_N=0;
class Pickup{
  constructor(type,f,x,y,z,opts={}){
    this.id=opts.id||('it'+(ITEM_N++));
    this.type=type;this.f=f;this.taken=false;this.baseY=y;
    const g=new THREE.Group();g.position.set(x,y,z);
    let mesh,glow=0xffcc66;
    if(type==='battery'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.16,10),new THREE.MeshStandardMaterial({color:0x225522,emissive:0x33ff66,emissiveIntensity:.5,metalness:.5}));mesh.rotation.z=Math.PI/2;}
    else if(type==='flare'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.035,0.26,8),MAT.flare);}
    else if(type==='medkit'){mesh=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.14,0.22),new THREE.MeshStandardMaterial({color:0xcfcfcf,emissive:0xff2222,emissiveIntensity:.25}));}
    else if(type==='crowbar'){
      const cg=new THREE.Group();
      const bm=new THREE.MeshStandardMaterial({color:0x7d1f22,emissive:0x551515,emissiveIntensity:.3,metalness:.75,roughness:.32});
      const bar=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.03,0.03),bm);
      const bend=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.028,0.028),bm);
      bend.position.set(0.35,0.006,0.02);bend.rotation.y=0.65;
      cg.add(bar,bend);cg.rotation.z=0.12;mesh=cg;
    }
    else if(type==='flashlight'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.3,10),new THREE.MeshStandardMaterial({color:0x333333,emissive:0xffdd88,emissiveIntensity:.4,metalness:.6}));mesh.rotation.z=Math.PI/2;}
    else if(type.startsWith('card')){mesh=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.02,0.14),MAT.card[type.split('-')[1]]);}
    else if(type==='pistol'){
      const pg=new THREE.Group();
      const gm=new THREE.MeshStandardMaterial({color:0x23262b,metalness:.8,roughness:.3});
      const slide=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.07,0.2),gm);
      const grip=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.11,0.06),gm);
      grip.position.set(0,-0.07,0.07);grip.rotation.x=0.25;
      pg.add(slide,grip);pg.rotation.z=Math.PI/2*0.9;pg.rotation.y=0.3;mesh=pg;
    }
    else if(type==='ammo'){
      const ag=new THREE.Group();
      const bx=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.09,0.11),new THREE.MeshStandardMaterial({color:0x6b5a2a,roughness:.8}));
      const tip=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.02,0.11),new THREE.MeshStandardMaterial({color:0xc9a227,metalness:.8,roughness:.3,emissive:0x6b4e10,emissiveIntensity:.4}));
      tip.position.y=0.055;ag.add(bx,tip);mesh=ag;
    }
    else if(type==='note'){mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.4),new THREE.MeshStandardMaterial({color:0xd8d2b8,emissive:0x8a8870,emissiveIntensity:.45,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.rotation.z=rand(-0.6,0.6);}
    g.add(mesh);world.levels[f].add(g);
    mesh.scale.setScalar(type==='battery'?1.6:1.3);
    this.g=g;
    world.items.push(this);
  }
  update(t){
    if(this.taken)return;
    // rest on the surface; gentle pulse so it catches the eye (no floating/spinning)
    this.g.scale.setScalar((this.type==='battery'?1.6:1.3)*(1+Math.sin(t*2.2+this.f)*0.06));
  }
  take(){
    if(this.taken)return;
    this.taken=true;this.g.visible=false;
    G.taken.add(this.id);
    play('pickup',{vol:.7});
    // co-op: only keycards are shared (the mission moves on for everyone). Crowbars, guns, ammo,
    // medkits, batteries… stay in the world for each friend to take their own.
    if(!this.type.startsWith('card'))return;
    if(G.mp&&!G.host)netSend({t:'ev',k:'take',id:this.id});
    if(G.host&&G.mp)netBroadcast({t:'ev',k:'take',id:this.id});
  }
}
function notesList(){return [
  {id:'n1',f:0,x:-21.5,z:-1.1,y:0.03,title:T('n1t'),body:T('n1b')},
  {id:'n2',f:2,x:-5.95,z:-3.95,y:0.83,fixed:true,title:T('n2t'),body:T('n2b')},   // on the security desk
  {id:'phone',f:2,x:-8.6,z:-8.8,y:0.03,title:T('ph1t'),body:T('ph1b')},
  {id:'n4',f:3,x:-6,z:6,y:0.03,title:T('n4t'),body:T('n4b')},
  {id:'n3',f:4,x:-22.6,z:-7.0,y:0.03,fixed:true,title:T('n3t'),body:T('n3b')},  // inside the boarded prep room
  {id:'n5',f:4,x:7.9,z:-8.2,y:0.03,fixed:true,title:T('n5t'),body:T('n5b')},    // at the utility breaker
  {id:'n6',f:5,x:12,z:5,y:0.03,title:T('n6t'),body:T('n6b')},
  {id:'n7',f:6,x:-6,z:-5,y:0.03,title:T('n7t'),body:T('n7b')},
  {id:'bcast',f:6,x:2,z:-8.2,y:0.03,title:T('bc_t'),body:T('bc_b')},
  {id:'n8',f:7,x:12,z:-3.5,y:0.03,fixed:true,title:T('n8t'),body:T('n8b')},     // roof, on the way to the helipad
];}
/* is (x,z) open floor on level f? (no wall, furniture, door or stair lane within r) */
function freeSpot(f,x,z,r=0.35){
  if(x<-23.5||x>23.5||z<-9.5||z>9.5||inLane(x,z))return false;
  const y=f*CFG.FH;
  for(const c of world.cols[f]){
    if(c.off||c.y1<y+0.05||c.y0>y+1.4)continue;
    if(x>c.x0-r&&x<c.x1+r&&z>c.z0-r&&z<c.z1+r)return false;
  }
  return true;
}
/* a random open spot inside a box — never inside a desk, bed, locker or wall */
function randSpot(f,x0,x1,z0,z1,tries=40){
  for(let i=0;i<tries;i++){const x=rand(x0,x1),z=rand(z0,z1);if(freeSpot(f,x,z))return [x,z];}
  return null;
}
/* the nearest open spot to (x,z), searched in rings (same side of the corridor) */
function nearFree(f,x,z){
  if(freeSpot(f,x,z))return [x,z];
  for(let r=0.3;r<=3;r+=0.3)for(let a=0;a<12;a++){
    const px=x+Math.cos(a/12*TAU)*r,pz=z+Math.sin(a/12*TAU)*r;
    if(Math.sign(pz-1.6*Math.sign(z))!==Math.sign(z)&&Math.abs(z)>1.6)continue;
    if(freeSpot(f,px,pz))return [px,pz];
  }
  return [x,z];
}
function spawnSupply(type,f,x0,x1,z0,z1,opts){
  const s=randSpot(f,x0,x1,z0,z1);
  if(!s)return null;
  return new Pickup(type,f,s[0],f*CFG.FH+0.09,s[1],opts);
}
/* Ji-eun's hiding room: nothing hostile ever gets inside */
function inSafeRoom(f,x,z){const s=world.safe;return !!s&&!G.flags.safeBreached&&s.f===f&&x>s.x0&&x<s.x1&&z>s.z0&&z<s.z1;}

/* ---------- room themes ---------- */
const ROOM_NAMES=()=>[
  [T('rn00'),T('rn01'),T('rn02'),T('rn03'),T('rn04'),T('rn05')],
  [T('rn10'),T('rn11'),T('rn12'),T('rn13'),T('rn14'),T('rn15')],
  [T('rn20'),T('rn21'),T('rn22'),T('rn23'),T('rn24'),T('rn25')],
  [T('rn30'),T('rn31'),T('rn32'),T('rn33'),T('rn34'),T('rn35')],
];
function themeOf(f){return f<2?0:(f<3?1:(f<5?2:3));} // classrooms G-1, offices 2, labs 3-4, dorms 5-6

/* ---------- furniture ---------- */
/* Every door gets a keep-clear box (corridor side + room side) so random furniture
   placement or a parked door leaf can never seal a room off. */
function addKeepClear(f,x,z,sx,sz){
  world.keep=world.keep||[];
  world.keep.push({f,x0:x-sx/2,x1:x+sx/2,z0:z-sz/2,z1:z+sz/2});
}
function boxHitsKeepClear(f,x,z,sx,sz){
  if(!world.keep)return false;
  for(const k of world.keep){
    if(k.f!==f)continue;
    if(x+sx/2>k.x0&&x-sx/2<k.x1&&z+sz/2>k.z0&&z-sz/2<k.z1)return true;
  }
  return false;
}
/* Corridor/room dressing is built before some doors exist, so sweep at the end of each floor:
   anything that crowds a doorway approach is evicted (it would seal the room off). */
function pruneDoorBlockers(f){
  if(!world.keep)return;
  let removed=0;
  for(const c of world.cols[f]){
    if(!c.deco||c.off)continue;
    for(const k of world.keep){
      if(k.f!==f)continue;
      if(c.x1>k.x0-0.45&&c.x0<k.x1+0.45&&c.z1>k.z0-0.45&&c.z0<k.z1+0.45){
        c.off=true;removed++;
        if(c.mesh&&c.mesh.parent)c.mesh.parent.remove(c.mesh);
        break;
      }
    }
  }
  return removed;
}
/* remove any furniture that ended up intersecting a wall (special rooms add walls late) */
function pruneFurniture(){
  if(!world.furn)return;
  world.furn=world.furn.filter(b=>{
    let bad=false;
    for(const c of world.cols[b.f]){
      if(c.off||c===b.col)continue;
      if(c.y1<b.y0+0.05||c.y0>b.y1-0.05)continue;
      if(b.x0<c.x1-0.05&&b.x1>c.x0+0.05&&b.z0<c.z1-0.05&&b.z1>c.z0+0.05){bad=true;break;}
    }
    if(bad){
      if(b.mesh&&b.mesh.parent)b.mesh.parent.remove(b.mesh);
      if(b.col)b.col.off=true;
      return false;
    }
    return true;
  });
}
/* carve out a small furniture-free spot (for NPC placements in already-furnished rooms) */
function clearArea(f,x,z,r){
  if(!world.furn)return;
  const hit=[];
  for(const b of world.furn){
    if(b.f!==f)continue;
    const cx=clamp(x,b.x0,b.x1),cz=clamp(z,b.z0,b.z1);
    if(dist2(cx,cz,x,z)<r*r){
      if(b.mesh&&b.mesh.parent)b.mesh.parent.remove(b.mesh);
      if(b.col)b.col.off=true;
      hit.push(b);
    }
  }
  world.furn=world.furn.filter(b=>!hit.includes(b));
}
function boxHitsWall(f,x,z,sx,sz){ // does a furniture footprint overlap any wall/partition?
  for(const c of world.cols[f]){
    if(!c.los||c.off)continue;
    if(x+sx/2>c.x0+0.04&&x-sx/2<c.x1-0.04&&z+sz/2>c.z0+0.04&&z-sz/2<c.z1-0.04)return true;
  }
  return false;
}
function furnishRoom(f,r,name){
  const th=themeOf(f);
  const cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2;
  const y=f*CFG.FH;
  const w=r.x1-r.x0-1.6,d=r.z1-r.z0-1.6;
  const put=(x,z,sx,sy,sz,mat,opts)=>{
    if(boxHitsKeepClear(f,x,z,sx,sz))return null;
    world.furn=world.furn||[];
    const m=addBox(f,x,y+sy/2,z,sx,sy,sz,mat,opts);
    const col=world.cols[f][world.cols[f].length-1];
    world.furn.push({f,x0:x-sx/2,x1:x+sx/2,z0:z-sz/2,z1:z+sz/2,y0:y,y1:y+sy,mesh:m,col});
    return m;
  };
  if(th===0){ // classroom
    const rows=Math.max(2,Math.floor(d/2.2)),cols=Math.max(2,Math.floor(w/2.0));
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      if(Math.random()<0.14)continue;
      const x=r.x0+1.4+j*(w-0.6)/Math.max(1,cols-1||1),z=r.z0+1.6+i*(d-0.8)/Math.max(1,rows-1||1);
      if(boxHitsWall(f,x,z,1.1,1.5)||boxHitsKeepClear(f,x,z,1.1,1.5))continue; // never block a door
      put(x,z,1.05,0.72,0.55,MAT.desk);put(x,z+0.45,0.4,0.45,0.4,MAT.dark,{col:false});
      // chair
      addBox(f,x,y+0.23,z-0.5,0.4,0.045,0.4,MAT.dark,{col:false});
      addBox(f,x,y+0.55,z-0.68,0.4,0.5,0.045,MAT.dark,{col:false});
    }
    if(!boxHitsWall(f,cx,r.z0+1.1,1.9,0.8)&&!boxHitsKeepClear(f,cx,r.z0+1.1,1.9,0.8)){
      put(cx,r.z0+1.1,1.8,0.85,0.7,MAT.desk); // teacher desk
      addBox(f,cx,y+0.28,r.z0+1.1,0.42,0.05,0.42,MAT.dark,{col:false});
    }
    addBox(f,r.x0+1.2,y+1.4,r.z1-0.12,2.6,1.1,0.1,MAT.dark,{col:false}); // blackboard
  }else if(th===1){ // office
    const n=irand(3,5);
    for(let i=0;i<n;i++){
      const x=rand(r.x0+1.4,r.x1-1.4),z=rand(r.z0+1.6,r.z1-1.2);
      if(boxHitsWall(f,x,z,1.35,0.7)||boxHitsKeepClear(f,x,z,1.35,0.7))continue;
      put(x,z,1.3,0.75,0.65,MAT.desk);
      if(Math.random()<0.5)addBox(f,x,y+0.95,z,1.4,0.4,0.1,MAT.wallDark,{col:false,ry:rand(0,TAU)});
    }
    for(let i=0;i<irand(1,3);i++){
      for(let t=0;t<4;t++){
        const x=rand(r.x0+1.2,r.x1-1.2);
        if(!boxHitsWall(f,x,r.z0+0.8,0.55,1.15)&&!boxHitsKeepClear(f,x,r.z0+0.8,0.55,1.15)){put(x,r.z0+0.8,0.5,1.9,1.1,MAT.locker,{los:true});break;}
      }
    }
    // bookshelf with books
    for(let t=0;t<4;t++){
      const bx=rand(r.x0+1.5,r.x1-1.5);
      if(boxHitsWall(f,bx,r.z1-0.35,1.25,0.4)||boxHitsKeepClear(f,bx,r.z1-0.35,1.25,0.4))continue;
      put(bx,r.z1-0.35,1.2,1.9,0.35,MAT.wallDark,{los:true});
      const bt=new THREE.CanvasTexture(TEX.books);bt.colorSpace=THREE.SRGBColorSpace;
      const bp=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.7),new THREE.MeshStandardMaterial({map:bt,roughness:.9}));
      bp.position.set(bx,y+0.95,r.z1-0.53);world.levels[f].add(bp);
      break;
    }
  }else if(th===2){ // lab
    for(let i=0;i<irand(2,4);i++){
      const z=r.z0+1.6+i*1.9;
      if(z>r.z1-0.8)break;
      if(boxHitsWall(f,cx,clamp(z,r.z0+1,r.z1-1),w*0.7+0.2,0.85)||boxHitsKeepClear(f,cx,clamp(z,r.z0+1,r.z1-1),w*0.7+0.2,0.85))continue;
      put(cx,clamp(z,r.z0+1,r.z1-1),w*0.7,0.9,0.8,MAT.dark,{});
    }
    if(!boxHitsWall(f,r.x0+1,r.z1-1,0.65,0.95)&&!boxHitsKeepClear(f,r.x0+1,r.z1-1,0.65,0.95))put(r.x0+1,r.z1-1,0.6,1.9,0.9,MAT.locker,{los:true});
    if(!boxHitsWall(f,r.x1-1,r.z0+1,0.65,0.95)&&!boxHitsKeepClear(f,r.x1-1,r.z0+1,0.65,0.95))put(r.x1-1,r.z0+1,0.6,1.9,0.9,MAT.locker,{los:true});
  }else{ // dorm
    for(let i=0;i<irand(2,4);i++){
      for(let t=0;t<4;t++){
        const x=rand(r.x0+1.8,r.x1-1.8),z=rand(r.z0+1.4,r.z1-1.2);
        if(!boxHitsWall(f,x,z,2.05,1.0)&&!boxHitsKeepClear(f,x,z,2.05,1.0)){put(x,z,2.0,0.55,0.95,MAT.bed);break;}
      }
    }
    for(let i=0;i<irand(1,3);i++){
      for(let t=0;t<4;t++){
        const x=rand(r.x0+1.2,r.x1-1.2);
        if(!boxHitsWall(f,x,r.z1-0.7,0.55,1.15)&&!boxHitsKeepClear(f,x,r.z1-0.7,0.55,1.15)){put(x,r.z1-0.7,0.5,1.9,1.1,MAT.locker,{los:true});break;}
      }
    }
  }
  // scattered debris + blood
  for(let i=0;i<3;i++)if(Math.random()<0.5)addBox(f,rand(r.x0+1,r.x1-1),y+0.06,rand(r.z0+1,r.z1-1),rand(0.2,0.5),0.12,rand(0.2,0.5),MAT.dark,{col:false,ry:rand(0,TAU)});
  if(Math.random()<0.6)decal(f,rand(r.x0+1.5,r.x1-1.5),rand(r.z0+1.5,r.z1-1.5),rand(0.4,0.9),pick(MAT.blood));
  if(Math.random()<0.5)posterOn(f,Math.random()<0.5?r.x0+0.13:r.x1-0.13,y+1.6,rand(r.z0+1.5,r.z1-1.5),Math.random()<0.5?Math.PI/2:-Math.PI/2,irand(0,3));
}

/* ---------- per-floor power ----------
   The school was shut down at 23:36: only battery emergency lighting survives on the lower
   floors, and nothing at all above Floor 3 (Floor 5 keeps its battery alarm strobes). */
function floorPower(f){
  if(MD.id==='lite')return {lamps:1,white:9.5,red:0,flicker:0,win:1,signs:0.35,exit:1};
  if(f===0)return {lamps:0.45,white:5.2,red:3,flicker:0.3,win:1,signs:0.25,exit:1};
  if(f===1)return {lamps:0.4,white:4.8,red:0,flicker:0.55,win:1,signs:0.2,exit:1};
  if(f===2)return {lamps:0.35,white:4.4,red:3,flicker:0.35,win:1,signs:0.2,exit:1};
  if(f===3)return {lamps:0.25,white:3.8,red:2.5,flicker:0.6,win:0.9,signs:0.12,exit:0.9};
  if(f===5)return {lamps:0,white:0,red:4.5,flicker:0,win:0.55,signs:0,exit:0.7,alarm:true};
  return {lamps:0,white:0,red:0,flicker:0,win:f>=6?0.4:0.55,signs:0,exit:0.6};   // 4 = the dark floor, 6 = dead
}
/* ---------- one floor ---------- */
function buildFloor(f){
  const L=new THREE.Group();world.levels.push(L);scene.add(L);
  const y=f*CFG.FH;
  const FH=CFG.FH,TOW=CFG.TOWER,LA=CFG.LANE;
  const PW=floorPower(f);
  SIGN_GLOW=PW.signs;
  // plate (4 boxes, leaving lane hole) — the hole is cut WIDER than the stairs so the
  // slab above can never read like a "roof" blocking the climb
  const SHAFT={x0:LA.x0-0.12,x1:LA.x1+0.16,z0:LA.z0-0.16,z1:LA.z1+0.16};
  const pf=(x0,z0,x1,z1)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,0.22,z1-z0),MAT.floor);m.position.set((x0+x1)/2,y-0.11,(z0+z1)/2);m.receiveShadow=true;L.add(m);};
  pf(-24,-10,SHAFT.x0,10);pf(SHAFT.x0,-10,SHAFT.x1,SHAFT.z0);pf(SHAFT.x0,SHAFT.z1,SHAFT.x1,10);pf(SHAFT.x1,-10,24,10);
  // glowing rim around the shaft opening + a light inside the stairwell
  const rimM=new THREE.MeshStandardMaterial({color:0x0d2010,emissive:0x2fbf5f,emissiveIntensity:1.1});
  const rim=(x,z,sx,sz)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,0.05,sz),rimM);m.position.set(x,y+0.03,z);L.add(m);};
  rim((SHAFT.x0+SHAFT.x1)/2,SHAFT.z0-0.07,SHAFT.x1-SHAFT.x0+0.26,0.14);
  rim((SHAFT.x0+SHAFT.x1)/2,SHAFT.z1+0.07,SHAFT.x1-SHAFT.x0+0.26,0.14);
  const shaftL=new THREE.PointLight(0xbfe8b0,5*PW.exit,9,1.8);shaftL.position.set(20.5,y+FH-0.5,1.2);L.add(shaftL);
  // ---- outer walls
  addWall(f,-24,-10,-24,10);            // west
  addWall(f,-24,10,16,10);              // north
  addWall(f,-24,-10,16,-10);            // south
  addWall(f,16,-10,16,TOW.z0);            // east main lower
  addWall(f,16,TOW.z1,16,10);             // east main upper
  addWall(f,TOW.x0,TOW.z0,24,TOW.z0);         // tower south
  addWall(f,TOW.x0,TOW.z1,24,TOW.z1);         // tower north
  addWall(f,24,TOW.z0,24,TOW.z1);           // tower east
  // tower west wall with arch gap z[-1.4,1.8]
  addWall(f,16,TOW.z0,16,-1.4);
  addWall(f,16,1.8,16,TOW.z1);
  addWall(f,16,-1.4,16,1.8,{y:y+2.3,h:FH-2.3});
  // stairs (steps + analytic ground). Steps are THIN TREADS (0.22 slabs at walking height):
  // full-height boxes from the flight above used to wedge down to zero headroom over the
  // flight below — the "invisible rooftop" that blocked the way to the next floor.
  const nSteps=Math.round((LA.x1-LA.x0)/CFG.STEP);
  for(let i=0;i<nSteps;i++){
    const h=(i+1)*FH/nSteps;
    const m=new THREE.Mesh(new THREE.BoxGeometry(CFG.STEP+0.01,0.22,LA.z1-LA.z0),MAT.stair);
    m.position.set(LA.x0+i*CFG.STEP+CFG.STEP/2,y+h-0.11,(LA.z0+LA.z1)/2);
    m.receiveShadow=true;L.add(m);
  }
  // stair shaft: visible full-height side walls.
  // They stop at x=22.25, leaving a 1.6 m opening at the top so the landing is easy to walk out of.
  for(const zEdge of [SHAFT.z0,SHAFT.z1]){
    addWall(f,17,zEdge-0.06,22.25,zEdge+0.06,{mat:MAT.wall,los:false});
    // Ground only: close the gap under the top of the first flight. On higher floors this gap IS the
    // landing of the flight below (the way down); at Ground there is no flight below, it was a void.
    if(f===0)addWall(f,22.25,zEdge-0.06,SHAFT.x1,zEdge+0.06,{mat:MAT.wall,los:false,h:FH-0.06});
  }
  if(f===0)addWall(f,SHAFT.x1,SHAFT.z0,SHAFT.x1,SHAFT.z1,{mat:MAT.wall,los:false,h:FH-0.06});
  // the way DOWN, painted on the shaft wall end at each landing (the top of the flight below)
  if(f>0)signOn(f,22.31,y+2.55,SHAFT.z0,Math.PI/2,TEX.sign(T('sg_down',{f:floorName(f-1)}),'#06180a','#59ff7a'),0.9,0.22,EXIT_GLOW);
  // EXIT signs on the shaft-wall end faces — visible while you climb; the landing is sideways
  const exitSign=(zz)=>signOn(f,22.31,y+2.0,zz,Math.PI/2,TEX.sign(T('sg_exit'),'#06180a','#59ff7a'),0.9,0.26,EXIT_GLOW);
  exitSign(SHAFT.z0);exitSign(SHAFT.z1);
  // glowing arrow on the landing plate pointing out of the shaft
  const landArrow=new THREE.Mesh(new THREE.PlaneGeometry(0.8,1.2),MAT.arrow);
  landArrow.rotation.x=-Math.PI/2;landArrow.rotation.z=0; // point north, out of the shaft
  landArrow.position.set(22.7,y+CFG.FH+0.02,1.2);L.add(landArrow);
  // bottom: "up" arrow. Top landing: which floor you reached + which way to walk out.
  signOn(f,17.02,y+2.05,1.2,-Math.PI/2,TEX.sign(T('sg_up'),'#06180a','#59ff7a'),1.1,0.3,EXIT_GLOW);
  signOn(f,22.75,y+CFG.FH+2.15,2.35,Math.PI,TEX.destLabel(f),1.25,0.6,EXIT_GLOW);
  signOn(f,22.75,y+CFG.FH+1.55,2.35,Math.PI,TEX.sign(T('sg_exit'),'#06180a','#59ff7a'),1.25,0.32,EXIT_GLOW);
  // floor label + stairwell sign
  signOn(f,16.13,y+1.9,0.2,-Math.PI/2,TEX.floorLabel(f),1.1,0.55,EXIT_GLOW);
  signOn(f,15.84,y+2.55,0.2,-Math.PI/2,TEX.sign(T('sg_stairs'),'#06180a','#59ff7a'),1.5,0.38,EXIT_GLOW);
  // ---- corridor lights — FIXED INVENTORY. three.js bakes the visible light counts into every
  // material's shader program: a floor with a different light count than its neighbours forces a
  // full program recompile on each stairwell crossing (multi-second stalls). So every floor
  // carries the SAME slots — a light that is "off" is intensity 0, never omitted.
  const LITE=MD.id==='lite';
  for(let lx=-21,lidx=0;lx<16;lx+=6,lidx++){
    const slot=(lidx===1||lidx===3||lidx===5);   // the 3 real-light slots among the 7 lamp fixtures
    const lit=Math.random()<(slot?Math.min(1,PW.lamps*1.6):PW.lamps);
    const li=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.07,0.24),lit?MAT.lamp:MAT.lampOff);
    li.position.set(lx,y+FH-0.16,0);L.add(li);
    if(slot){
      const pl=new THREE.PointLight(0xffe6b8,lit?PW.white:0,12,1.9);
      pl.position.set(lx,y+FH-0.5,0);L.add(pl);
      if(lit&&Math.random()<PW.flicker){pl.userData.flicker=true;pl.userData.base=pl.intensity;world.flicker=world.flicker||[];world.flicker.push(pl);}
    }
  }
  // red emergency slot — always present (a fixed light inventory), lit by the power profile
  const er=new THREE.PointLight(0xff2211,PW.red,PW.alarm?11:8,2);
  er.position.set(PW.alarm?-4:rand(-20,10),y+FH-0.7,PW.alarm?0:rand(-1,1));L.add(er);
  if(PW.alarm){er.userData.base=PW.red;(world.alarms=world.alarms||[]).push(er);}
  // room slot (green): the CCTV terminal on F2 claims it; extraction beacon on the roof; 0 elsewhere
  const room=new THREE.PointLight(0x59ff7a,f===2?3:0,7,2);room.position.set(-5,y+2.2,-4.2);L.add(room);
  // spot + directional slots: the roof's helicopter beam and moon/sun claim them; 0 elsewhere
  const slotSpot=new THREE.SpotLight(0xfff2cc,0,60,0.32,0.5,1.2);
  slotSpot.position.set(20,y+FH-0.3,1.2);L.add(slotSpot,slotSpot.target);slotSpot.target.position.set(0,y,0);
  const slotDir=new THREE.DirectionalLight(0x8fa8ff,0);
  slotDir.position.set(-40,y+60,-60);L.add(slotDir,slotDir.target);slotDir.target.position.set(0,y,0);
  (world.slotLights=world.slotLights||[]).push({floor:f,room,spot:slotSpot,dir:slotDir});
  // ---- corridor dressing: ceiling pipes, scattered papers
  for(const pz of [-1.02,1.02]){
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,39,8),MAT.metal);
    pipe.rotation.z=Math.PI/2;pipe.position.set(-4,y+FH-0.34,pz);L.add(pipe);
  }
  if(!LITE)for(let i=0;i<irand(3,6);i++){
    const pp=new THREE.Mesh(new THREE.PlaneGeometry(0.24,0.34),new THREE.MeshStandardMaterial({color:0xcfcabb,roughness:1}));
    pp.rotation.x=-Math.PI/2;pp.rotation.z=rand(0,TAU);
    pp.position.set(rand(-22,14),y+0.015,rand(-1.4,1.4));L.add(pp);
  }
  // wayfinding: a BRIGHT painted arrow trail leading to the stairwell arch
  for(const ax of [-21,-16,-11,-6,-1,4,9,13]){
    const ar=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.6),MAT.arrow);
    ar.rotation.x=-Math.PI/2;ar.rotation.z=-Math.PI/2;   // tip (+Y of the texture) turned to point EAST (+x), toward the stairwell
    ar.position.set(ax,y+0.02,0);L.add(ar);
  }
  // glowing portal frame around the tower archway — the way up is impossible to miss
  const archM=new THREE.MeshStandardMaterial({color:0x0d2010,emissive:0x2fbf5f,emissiveIntensity:1.3*PW.exit});
  const archTop=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.16,3.6),archM);archTop.position.set(16.06,y+2.32,0.2);L.add(archTop);
  const archSide1=new THREE.Mesh(new THREE.BoxGeometry(0.14,2.3,0.16),archM);archSide1.position.set(16.06,y+1.15,-1.45);L.add(archSide1);
  const archSide2=new THREE.Mesh(new THREE.BoxGeometry(0.14,2.3,0.16),archM);archSide2.position.set(16.06,y+1.15,1.85);L.add(archSide2);
  const archL=new THREE.PointLight(0x59ff7a,6*PW.exit,8,1.8);archL.position.set(15.4,y+2.1,0.2);L.add(archL);
  signOn(f,16.13,y+2.85,0.2,-Math.PI/2,TEX.sign(T('sg_allfloors'),'#06180a','#59ff7a'),2.4,0.5,EXIT_GLOW);
  for(const sx of [-20,-12,-4,4,11]){
    signOn(f,sx,y+2.15,1.46,Math.PI,TEX.sign(T('sg_stairs_to'),'#06180a','#59ff7a'),1.7,0.34,EXIT_GLOW);
  }
  // the elevator: in the stair tower, on its south wall, facing you as you come through the arch
  {
    const EX=ELEV.x,EZ=TOW.z0+0.12;   // the wall's inner face (walls are 0.24 m thick)
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.9,2.45,0.1),MAT.dark);frame.position.set(EX,y+1.22,EZ+0.05);L.add(frame);
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.6,2.2),MAT.metal);panel.position.set(EX,y+1.1,EZ+0.13);L.add(panel);
    const seam=new THREE.Mesh(new THREE.PlaneGeometry(0.04,2.2),MAT.dark);seam.position.set(EX,y+1.1,EZ+0.16);L.add(seam);
    const btn=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.26,0.06),MAT.dark);btn.position.set(EX+1.15,y+1.2,EZ+0.03);L.add(btn);
    signOn(f,EX,y+2.68,EZ+0.04,0,TEX.sign(T('sg_elev'),'#200','#ff5050'),1.5,0.28);
    signOn(f,EX,y+2.3,EZ+0.19,0,TEX.sign(T('sg_ooo'),'#200','#ff5050'),1.15,0.22);
  }
  // ---- rooms
  const dN=8.4,dS=8.4;
  const rooms=[
    {key:'N1',x0:-24,x1:-9,z0:1.6,z1:1.6+dN},
    {key:'N2',x0:-9,x1:3,z0:1.6,z1:1.6+dN},
    {key:'N3',x0:3,x1:16,z0:1.6,z1:1.6+dN},
    {key:'S1',x0:-24,x1:-10,z0:-1.6-dS,z1:-1.6},
    {key:'S2',x0:-10,x1:2,z0:-1.6-dS,z1:-1.6},
    {key:'S3',x0:2,x1:16,z0:-1.6-dS,z1:-1.6},
  ];
  const names=[...ROOM_NAMES()[themeOf(f)]];
  const layout={rooms:[],corridor:{x0:-24,z0:-1.6,x1:16,z1:1.6},tower:{x0:TOW.x0,z0:TOW.z0,x1:TOW.x1,z1:TOW.z1}};
  for(const r of rooms){
    // front wall with 1-2 doors
    const frontZ=r.z0>0?r.z0:r.z1;
    const dx1=rand(r.x0+2.5,r.x1-2.5);
    const doorXs=[dx1];
    if(r.x1-r.x0>11&&Math.random()<0.7){
      const dx2=dx1>=(r.x0+r.x1)/2?rand(r.x0+2,r.x0+4.5):rand(r.x1-4.5,r.x1-2);
      if(Math.abs(dx2-dx1)>2.2)doorXs.push(dx2);
    }
    // front wall: always built — full-height pieces between the doorways + a lintel over each gap.
    // (Before, a second door rolled too close to the first skipped the WHOLE wall: an open room.)
    doorXs.sort((p,q)=>p-q);
    let wx=r.x0;
    for(const dx of doorXs){
      if(dx-0.85-wx>0.05)addWall(f,wx,frontZ,dx-0.85,frontZ);
      addWall(f,dx-0.85,frontZ,dx+0.85,frontZ,{y:y+2.25,h:FH-2.25});
      wx=dx+0.85;
    }
    if(r.x1-wx>0.05)addWall(f,wx,frontZ,r.x1,frontZ);
    (world.frontWalls=world.frontWalls||[]).push({f,key:r.key,x0:r.x0,x1:r.x1,z:frontZ,doors:doorXs.slice()});
    // side divider walls between rooms
    addWall(f,r.x0,frontZ,r.x0,r.z0>0?r.z1:r.z0);
    // doors (1.6m leaf in a 1.7m gap — comfortable to walk through; swing into the room)
    for(const dx of doorXs){
      const d=new DoorC(f,dx-0.8,frontZ,1.6,'x',{label:'Open door',swing:r.z0>0?1:-1});
      d.room=r.key;
      if(f===5&&r.key==='S1')d.safe=true;
      r.door=d;
      const sz=r.z0>0?frontZ-0.14:frontZ+0.14;
      signOn(f,dx,y+2.5,sz,r.z0>0?Math.PI:0,TEX.sign(names[layout.rooms.length%names.length],'#15151a','#b9b1a4'),1.7,0.34);
    }
    if(r.x1-r.x0>10&&Math.random()<0.5){ // internal partition for maze feel
      // never let the partition land in a doorway (it would split the gap and seal the room)
      const zBack=r.z0>0?r.z1:r.z0;
      let px=null;
      for(let t=0;t<12;t++){
        const cand=rand(r.x0+4,r.x1-4);
        if(doorXs.every(dx=>Math.abs(cand-dx)>1.5)){px=cand;break;}
      }
      if(px!==null){
        const zEnd=(r.z0+zBack)/2+(r.z0>0?rand(0,2):-rand(0,2));
        addWall(f,px,r.z0,px,zEnd);
      }
    }
    // windows on the outer wall (night glow / daylight)
    const outerZ=r.z0>0?10:-10;
    const winM=new THREE.MeshStandardMaterial({color:0x0c1420,emissive:MD.winE,emissiveIntensity:MD.winI*PW.win});
    for(let wx of [lerp(r.x0,r.x1,0.3),lerp(r.x0,r.x1,0.7)]){
      const win=new THREE.Mesh(new THREE.PlaneGeometry(2.0,1.3),winM);
      win.position.set(wx,y+1.9,outerZ+(r.z0>0?-0.22:0.22));
      win.rotation.y=r.z0>0?Math.PI:0;
      L.add(win);
      const frame=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.5,0.06),MAT.rail);
      frame.position.set(wx,y+1.9,outerZ+(r.z0>0?-0.17:0.17));
      L.add(frame);
    }
    furnishRoom(f,r,names[0]);
    layout.rooms.push({x0:r.x0,z0:r.z0,x1:r.x1,z1:r.z1,name:names[layout.rooms.length%names.length]});
    world.roomDoor[f+':'+r.key]=r.door;
  }
  world.layout.push(layout);
  if(f===5){const s=rooms.find(r=>r.key==='S1');world.safe={f,x0:s.x0,x1:s.x1,z0:s.z0,z1:s.z1};}
  // special rooms go in BEFORE loot, so nothing spawns inside their desks and machines
  if(f===0)specialEntrance(L,y);
  if(f===2)specialCCTV(L,y);
  if(f===4){specialServer(L,y);specialElectrical(L,y);}
  if(f===5)specialHideout(L,y);
  if(f===3)supplyRoom(f,rooms.find(r=>r.key==='N1'),'sg_storage',5);
  if(f===5)supplyRoom(f,rooms.find(r=>r.key==='N3'),'sg_armory',6);
  if(f===3)signOn(3,-9,y+2.5,1.46,Math.PI,TEX.sign(T('sg_wentup'),'#0a1a0d','#59ff7a'),2.2,0.5);
  if(f===4)signOn(4,-9,y+2.5,1.46,Math.PI,TEX.sign(T('sg_notsame'),'#200','#ff5050'),2.6,0.42);
  if(f===5)signOn(5,12,y+2.5,1.46,Math.PI,TEX.sign(T('sg_infir'),'#101020','#59ff7a'),2,0.44);
  if(f===CFG.FLOORS-1)specialTop(L,y);
  pruneFurniture();
  // boarded deco doors (loot inside) — never on a mission room
  const questRoom=r=>(f===2&&r.key==='S2')||(f===4&&r.key==='S3')||(f===5&&r.key==='S1')||(f===3&&r.key==='N1')||(f===5&&r.key==='N3');
  let boardedN=0;
  for(const r of rooms){
    if(boardedN>=2)break;
    if(r.door&&!r.door.boarded&&!questRoom(r)&&Math.random()<0.25&&f>0){r.door.boarded=true;
      const b=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.1),MAT.board);
      b.position.set(r.door.g.position.x+0.8,y+1.1,r.door.g.position.z+(r.z0>0?-0.1:0.1));
      b.rotation.y=r.z0>0?Math.PI:0;b.userData.ry=0;
      L.add(b);r.door.boardMesh=b;boardedN++;
      // guaranteed loot behind some boarded doors
      if(Math.random()<0.6)spawnSupply(pick(['battery','flare']),f,r.x0+1,r.x1-1,Math.min(r.z0,r.z1)+1,Math.max(r.z0,r.z1)-1);
    }
  }
  // ---- regular pickups (more supplies in lite) — resting on open floor
  const X0=-22.5,X1=14.5,Z0=-9,Z1=9;
  const nB=Math.max(2,Math.round(irand(2,4)*MD.loot));
  for(let i=0;i<nB;i++)spawnSupply('battery',f,X0,X1,Z0,Z1);
  spawnSupply('medkit',f,X0,X1,Z0,Z1);
  if(Math.random()<MD.loot-0.9)spawnSupply('medkit',f,X0,X1,Z0,Z1);
  if(f>=3)for(let i=0;i<Math.round(irand(1,2)*MD.loot);i++)spawnSupply('flare',f,X0,X1,Z0,Z1);
  if(f>=2)for(let i=0;i<irand(1,2);i++)spawnSupply('ammo',f,X0,X1,Z0,Z1);
  // ---- zombies — encounter escalation: floors 1-2 keep a lone drifter each (plus the
  // scripted first contact), then density climbs with height. Ji-eun's room stays empty.
  let zCount;
  if(MD.jumpscares){
    if(f<=1)zCount=1;
    else if(f<=3)zCount=irand(2,3)+Math.floor(f*0.4);
    else if(f===6)zCount=irand(1,2);            // Floor 6: unnaturally quiet. On purpose.
    else zCount=irand(3,4)+Math.floor(f*0.6);
  }else zCount=irand(3,4)+Math.floor(f*0.55);
  const zRooms=rooms.filter(r=>!(f===5&&r.key==='S1'));
  for(let i=0;i<zCount;i++){
    const r=pick(zRooms);
    let type='shambler';
    const roll=Math.random();
    if(f>=2&&roll<0.22)type='runner';
    else if(f>=5&&roll<0.38)type='brute';
    else if(f>=4&&roll<0.54)type='crawler';
    else if(f>=3&&roll<0.66)type='screamer';
    const s=randSpot(f,r.x0+1.3,r.x1-1.3,Math.min(r.z0,r.z1)+1.3,Math.max(r.z0,r.z1)-1.3,20)||[(r.x0+r.x1)/2,(r.z0+r.z1)/2];
    spawnZombie(f,s[0],s[1],type,r);
  }
  pruneDoorBlockers(f);
}

/* ---------- special rooms ---------- */
/* an ammo room: steel shelving on the back wall, a green sign, ammo boxes (+ a medkit) on the floor */
function supplyRoom(f,r,signKey,nAmmo){
  if(!r)return;
  const y=f*CFG.FH,north=r.z0>0;
  const backZ=north?r.z1:r.z0,frontZ=north?r.z0:r.z1;
  const cx=(r.x0+r.x1)/2;
  clearArea(f,cx,backZ+(north?-0.8:0.8),2.2);
  addBox(f,cx,y+0.9,backZ+(north?-0.32:0.32),3.2,1.8,0.45,MAT.locker,{los:true});   // shelving
  for(const d of world.doors){
    if(d.f!==f||d.room!==r.key)continue;
    const dx=d.g.position.x+0.8;
    signOn(f,dx,y+2.5,north?frontZ-0.16:frontZ+0.16,north?Math.PI:0,TEX.sign(T(signKey),'#0a1a0d','#59ff7a'),1.8,0.36,EXIT_GLOW);
  }
  const zA=Math.min(r.z0,r.z1)+1,zB=Math.max(r.z0,r.z1)-1;
  for(let i=0;i<nAmmo;i++)spawnSupply('ammo',f,r.x0+1,r.x1-1,zA,zB);
  spawnSupply('medkit',f,r.x0+1,r.x1-1,zA,zB);
  spawnSupply('battery',f,r.x0+1,r.x1-1,zA,zB);
}
function specialEntrance(L,y){
  // sealed main entrance + reception + janitor closet in S3
  signOn(0,-23.84,2.2,0,Math.PI/2,TEX.sign(T('sg_entrance'),'#200','#ff5050'),2.2,0.55);
  addBox(0,-22.6,y+0.45,1.15,1.6,0.9,0.7,MAT.desk); // reception desk
  // co-op: one flashlight per survivor, so nobody is left in the dark
  const copies=G.mp?4:1;
  for(let i=0;i<copies;i++)new Pickup('flashlight',0,-23.05+i*0.42,y+0.95,1.15,{id:i===0?'story-flashlight':'story-flashlight'+(i+1)});
  // janitor closet: x[12.2,16] z[-10,-6.8], doorway in the west wall, boarded from the hall side
  addWall(0,12.2,-10,12.2,-9.3);
  addWall(0,12.2,-7.9,12.2,-6.8);
  addWall(0,12.2,-9.3,12.2,-7.9,{y:y+2.25,h:CFG.FH-2.25});
  addWall(0,12.2,-6.8,16,-6.8);   // north wall: the closet used to be open from the room behind it
  new DoorC(0,12.2,-9.35,1.5,'z',{boarded:true,kick:true,swing:1,boardSide:-1,id:'jan-door'});
  clearArea(0,14.1,-8.4,2.4);   // classroom desks must not end up inside the closet
  for(let i=0;i<(G.mp?4:1);i++)new Pickup('crowbar',0,14.05+i*0.45,y+0.12,-8.6,{id:i===0?'story-crowbar':'story-crowbar'+(i+1)});
  addBox(0,15.4,y+0.9,-9.4,0.6,1.8,0.5,MAT.locker,{los:true});
  decal(0,14,-8,0.8,pick(MAT.blood));
  world.f0door=world.roomDoor['0:S2'];
}
function specialCCTV(L,y){
  // S2 = CCTV & POWER (x[-10,2] z[-10,-1.6]) — FLOOR 2
  world.roomDoor['2:S2'].label='CCTV & POWER';
  // generator
  const gen=addBox(2,0.8,y+0.8,-8.8,1.4,1.6,1.0,MAT.gen,{los:true});
  const handle=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.34,0.1),new THREE.MeshStandardMaterial({color:0xaa1111,emissive:0xff2222,emissiveIntensity:1.6}));
  handle.position.set(0,1.0,0.55);gen.add(handle);
  world.breakers.main={mesh:handle,f:2,x:0.8,z:-8.25};
  clearArea(2,0.8,-7.2,1.4);clearArea(2,-5,-3.0,1.7);   // keep the generator and the terminal reachable
  // terminal desk with monitors
  addBox(2,-5,y+0.4,-4.2,2.4,0.8,1.0,MAT.desk);
  for(let i=0;i<3;i++){
    const mon=addBox(2,-5.8+i*0.8,y+1.25,-4.45,0.62,0.5,0.08,MAT.screen,{col:false});
    world.termMons=world.termMons||[];world.termMons.push(mon);
  }
  world.terminal={f:2,x:-5,z:-4.2};
  // (CCTV green light = the per-floor "room" light slot, lit in the corridor block above)
  new Pickup('card-red',2,-4.4,y+0.84,-4.0,{id:'story-card-red'});
  // co-op: a sidearm + spare rounds for each survivor (all on the desk, in front of the monitors)
  const side=G.mp?[[-3.95,-3.9],[-4.2,-3.9],[-3.95,-4.15],[-4.2,-4.15]]:[[-4.0,-3.95]];
  side.forEach((pp,i)=>new Pickup('pistol',2,pp[0],y+0.85,pp[1],{id:i===0?'story-pistol':'story-pistol'+(i+1)}));
  const ammoSpots=G.mp?[[-5.3,-3.9],[-5.55,-3.9],[-5.3,-4.15],[-5.55,-4.15]]:[[-5.4,-3.95]];
  ammoSpots.forEach((pp,i)=>new Pickup('ammo',2,pp[0],y+0.86,pp[1],{id:'story-ammo'+(i+1)}));
  signOn(2,-5,y+2.6,-1.44,0,TEX.sign(T('sg_cctv'),'#101020','#59ff7a'),2.4,0.5,EXIT_GLOW);
}
function specialElectrical(L,y){
  // S3 = ELECTRICAL (x[2,16] z[-10,-1.6]) — utility breaker, FLOOR 4
  const box=addBox(4,9,y+0.8,-9.2,1.2,1.6,0.6,MAT.gen,{los:true});
  const handle=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.34,0.1),new THREE.MeshStandardMaterial({color:0x117711,emissive:0x33ff66,emissiveIntensity:1.6}));
  handle.position.set(0,0,0.36);box.add(handle);
  world.breakers.sub={mesh:handle,f:4,x:9,z:-8.9};
  clearArea(4,9,-8.0,1.5);
  signOn(4,9,y+2.5,-1.44,0,TEX.sign(T('sg_elec'),'#101020','#59ff7a'),2,0.44);
}
function specialServer(L,y){
  // S1 inner boarded rack room x[-24,-19] z[-10,-6], doorway in z=-6 wall — FLOOR 4
  addWall(4,-19,-10,-19,-6);
  addWall(4,-24,-6,-21.3,-6);
  addWall(4,-19.9,-6,-19,-6);
  addWall(4,-21.3,-6,-19.9,-6,{y:y+2.25,h:CFG.FH-2.25});
  clearArea(4,-21.5,-8,2.9);
  new DoorC(4,-21.3,-6,1.4,'x',{boarded:true,swing:-1,id:'rack-door'});
  for(let i=0;i<3;i++)addBox(4,-23+i*1.3,y+1.1,-9,0.8,2.2,0.8,MAT.dark,{los:true});
  new Pickup('ammo',4,-21.2,y+0.09,-7.2,{id:'prep-ammo'});   // the blue card itself comes from Mr. Park
  new Pickup('medkit',4,-20.2,y+0.09,-7.3,{id:'prep-med'});
  signOn(4,-17,y+2.5,-1.44,0,TEX.sign(T('sg_server'),'#101020','#59ff7a'),2,0.44);
}
/* Floor 5, room S1: Ji-eun's hiding place — a shelf screens her corner from the doorway */
function specialHideout(L,y){
  clearArea(5,-22.6,-8.4,2.4);
  addBox(5,-22.35,y+0.95,-7.35,1.5,1.9,0.4,MAT.wallDark,{los:true});
  const bt=new THREE.CanvasTexture(TEX.books);bt.colorSpace=THREE.SRGBColorSpace;
  const bp=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.7),new THREE.MeshStandardMaterial({map:bt,roughness:.9}));
  bp.position.set(-22.35,y+0.95,-7.14);L.add(bp);
  addBox(5,-19.6,y+0.95,-9.5,0.5,1.9,0.9,MAT.locker,{los:true});
}
function specialTop(L,y){
  const topF=CFG.FLOORS-1;
  signOn(topF,15.84,y+2.4,0.2,-Math.PI/2,TEX.sign(T('sg_roof'),'#06180a','#59ff7a'),1.8,0.45,EXIT_GLOW);
}

/* ---------- rooftop ---------- */
function buildRoof(){
  const L=new THREE.Group();world.levels.push(L);world.roofGroup=L;scene.add(L);
  const y=CFG.ROOF_Y,LA=CFG.LANE;
  // same fixed light slots as every other floor (see buildFloor) — the roof's extraction
  // beacon, helicopter beam and moon/sun sunlight CLAIM the room/spot/dir slots instead of
  // adding extra lights, so the renderer's light counts never change at the top of the tower
  const roomSlot=new THREE.PointLight(0xff3a22,0,12,1.8);roomSlot.position.set(2,y+0.8,3.5);L.add(roomSlot);
  world.roofLight=roomSlot;
  const spotSlot=new THREE.SpotLight(0xfff2cc,0,60,0.32,0.5,1.2);
  spotSlot.position.set(20,y+CFG.FH-0.3,1.2);L.add(spotSlot,spotSlot.target);spotSlot.target.position.set(0,y,0);
  const dirSlot=new THREE.DirectionalLight(MD.sky==='night'?0x8fa8ff:0xfff0d8,0);
  dirSlot.position.set(-40,y+60,-60);L.add(dirSlot,dirSlot.target);dirSlot.target.position.set(0,y,0);
  (world.slotLights=world.slotLights||[]).push({floor:CFG.FLOORS,room:roomSlot,spot:spotSlot,dir:dirSlot});
  const pf=(x0,z0,x1,z1)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,0.3,z1-z0),MAT.dark);m.position.set((x0+x1)/2,y-0.15,(z0+z1)/2);m.receiveShadow=true;L.add(m);};
  pf(-24,-10,LA.x0,10);pf(LA.x0,-10,LA.x1,LA.z0);pf(LA.x0,LA.z1,LA.x1,10);pf(LA.x1,-10,24,10);
  // parapet
  addWall(CFG.FLOORS,-24,-10,-24,10,{h:1.05,mat:MAT.wallDark});
  addWall(CFG.FLOORS,-24,10,24,10,{h:1.05,mat:MAT.wallDark});
  addWall(CFG.FLOORS,-24,-10,24,-10,{h:1.05,mat:MAT.wallDark});
  addWall(CFG.FLOORS,24,-10,24,10,{h:1.05,mat:MAT.wallDark});
  // lane guard walls on roof
  addWall(CFG.FLOORS,LA.x0,LA.z0-0.05,22.25,LA.z0+0.05,{h:1.0,mat:MAT.rail,los:false});
  addWall(CFG.FLOORS,LA.x0,LA.z1-0.05,22.25,LA.z1+0.05,{h:1.0,mat:MAT.rail,los:false});
  // helipad
  const padC=makeCanvas(256,256,(x,w,h)=>{x.fillStyle='#2b2b2e';x.fillRect(0,0,w,h);x.strokeStyle='#e8e4da';x.lineWidth=10;x.beginPath();x.arc(w/2,h/2,100,0,TAU);x.stroke();x.fillStyle='#e8e4da';x.font='bold 150px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('H',w/2,h/2+8);});
  const padT=new THREE.CanvasTexture(padC);padT.colorSpace=THREE.SRGBColorSpace;
  const pad=new THREE.Mesh(new THREE.CircleGeometry(4.4,40),new THREE.MeshStandardMaterial({map:padT,roughness:.9}));
  pad.rotation.x=-Math.PI/2;pad.position.set(2,y+0.02,0);L.add(pad);
  // extraction zone
  const ring=new THREE.Mesh(new THREE.TorusGeometry(ROOF.RADIUS-0.2,0.07,8,40),new THREE.MeshStandardMaterial({color:0x113311,emissive:0x33ff66,emissiveIntensity:0.7}));
  ring.rotation.x=Math.PI/2;ring.position.set(2,y+0.1,3.5);L.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(ROOF.RADIUS-0.3,ROOF.RADIUS-0.3,9,24,1,true),new THREE.MeshBasicMaterial({color:0xff5533,transparent:true,opacity:0.0,side:THREE.DoubleSide,depthWrite:false}));
  beam.position.set(2,y+4.5,3.5);L.add(beam);
  // the signal flare stand in the middle of the circle (unlit until you light it)
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.34,8),new THREE.MeshStandardMaterial({color:0x5a1a10,emissive:0xff3300,emissiveIntensity:0.0}));
  stand.position.set(2,y+0.17,3.5);L.add(stand);
  world.extract={x:2,z:3.5,y:y,ring,beam,stand,smoke:[],smokeT:0};
  // a military drop by the roof door: ammo for the last stand
  addBox(CFG.FLOORS,12.6,y+0.3,-5.2,1.2,0.6,0.7,MAT.gen,{los:true});
  for(let i=0;i<5;i++)spawnSupply('ammo',CFG.FLOORS,10.5,14.5,-4.3,-2.8);
  // moon + city glow
  const moon=new THREE.Mesh(new THREE.CircleGeometry(3.4,24),new THREE.MeshBasicMaterial({color:0xd8dcff,fog:false}));
  moon.position.set(-60,y+42,-90);moon.lookAt(2,y,-8);L.add(moon);world.moon=moon;
  // moonlight (night) / sunlight (day) = the roof's directional slot
  dirSlot.intensity=MD.sky==='night'?0.5:1.0;
  dirSlot.position.set(MD.sky==='night'?-40:-30,MD.sky==='night'?60:40,MD.sky==='night'?-60:-40);
  // helicopter
  const heli=new THREE.Group();heli.position.set(2,y+9,3.5);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(1.5,2.6,6,12),MAT.heli);body.rotation.z=Math.PI/2;body.position.y=-1;heli.add(body);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,10),new THREE.MeshStandardMaterial({color:0x182028,roughness:.2,metalness:.6}));nose.position.set(2.4,-1.1,0);heli.add(nose);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(4.4,0.5,0.4),MAT.heli);tail.position.set(-3.6,-0.8,0);heli.add(tail);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.4,0.12),MAT.heli);fin.position.set(-5.6,-0.4,0);heli.add(fin);
  const rotor=new THREE.Mesh(new THREE.BoxGeometry(11,0.06,0.4),MAT.dark);rotor.position.y=0.7;heli.add(rotor);
  const rotor2=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.06,11),MAT.dark);rotor2.position.y=0.7;heli.add(rotor2);
  const skid1=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.1,0.14),MAT.rail);skid1.position.set(0,-2.35,0.9);heli.add(skid1);
  const skid2=skid1.clone();skid2.position.z=-0.9;heli.add(skid2);
  // helicopter spotlight = the roof's spot slot (re-parented into the heli, same light count)
  const spot=spotSlot;spot.intensity=900;
  spot.position.set(0,-2,0);heli.add(spot);heli.add(spot.target);spot.target.position.set(0,-11,0);
  L.add(heli);
  world.heli={g:heli,rotor,rotor2};
  // ---- sky per mode
  if(MD.sky==='night'){
    const starGeo=new THREE.BufferGeometry();
    const sp=new Float32Array(600*3);
    for(let i=0;i<600;i++){
      const a=rand(0,TAU),e=rand(0.12,1.4),rr=85;
      sp[i*3]=Math.cos(a)*Math.cos(e)*rr;sp[i*3+1]=Math.sin(e)*rr;sp[i*3+2]=Math.sin(a)*Math.cos(e)*rr;
    }
    starGeo.setAttribute('position',new THREE.BufferAttribute(sp,3));
    const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xcfd8ff,size:0.55,fog:false,transparent:true,opacity:0.9,map:dotTex(),depthWrite:false}));
    stars.position.set(0,y,0);L.add(stars);
  }else{
    const sun=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex(),color:0xfff0c8,fog:false,transparent:true}));
    sun.scale.setScalar(16);sun.position.set(-38,y+32,-55);L.add(sun);
    // sunlight = the roof's directional slot (lit in the moon/sun section above)
    world.clouds=[];
    for(let i=0;i<6;i++){
      const cl=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex(),color:0xffffff,fog:false,transparent:true,opacity:0.85}));
      cl.scale.set(rand(14,26),rand(6,10),1);
      cl.position.set(rand(-60,60),y+rand(16,30),rand(-70,-30));
      L.add(cl);world.clouds.push(cl);
    }
    // rooftop AC units for the sunny look
    for(let i=0;i<3;i++)addBox(CFG.FLOORS,rand(-16,-4),y+0.7,rand(-6,-3),1.6,1.2,1.4,MAT.metal,{los:true});
    addBox(CFG.FLOORS,-10,y+0.55,6,0.9,1.0,0.9,MAT.metal,{los:true});
  }
  // rooftop zombies (finale wave, spawned later)
  signOn(CFG.FLOORS,16.1,y+1.9,0.2,-Math.PI/2,TEX.floorLabel(CFG.FLOORS),1.1,0.55,EXIT_GLOW);
}

/* ---------- build all ---------- */
function buildWorld(){
  buildMaterials();
  buildTextures();
  for(let f=0;f<CFG.FLOORS;f++)buildFloor(f);
  buildRoof();
  // gates
  for(const[k,type]of Object.entries(GATE_PLAN))new GateC(+k,type);
  // notes — always on open floor (never inside a desk, bed or locker)
  for(const n of notesList()){
    const p=n.fixed?[n.x,n.z]:nearFree(n.f,n.x,n.z);
    new Pickup('note',n.f,p[0],n.f*CFG.FH+n.y,p[1],{id:n.id});
  }
  // MR. PARK — already bitten, lying in the Floor 3 hall right outside the stairwell arch:
  // the first thing you see on that floor. Talk, take his card… then he turns.
  new SurvivorNPC('park',3,10.9,0.95,{pose:'lying',yaw:Math.PI/2,skin:0xa89684,cloth:0x2c2f36,pants:0x2c2f36,hair:0x8e8a84,
    nameKey:'npc1_name',nameKeyL:'npc1l_name',
    lines:['npc1_1','npc1_2','npc1_3'],linesL:['npc1l_1','npc1l_2','npc1l_3'],
    talkQuest:'q_parktalk',onDone:()=>{G.flags.parkTalked=true;netFlag('parkTalked');spawnParkItems();questCheck();}});
  decal(3,11.9,0.95,0.75,MAT.bloodPool);
  // JI-EUN — hiding on Floor 5, in the south-west room, behind a shelf. She stays there.
  new SurvivorNPC('jieun',5,-22.95,-8.95,{pose:'sit',yaw:-Math.PI*0.8,skin:0xc9a88e,cloth:0x2e3a5a,hair:0x120e0c,hp:160,
    nameKey:'npc2_name',lines:['npc2_1','npc2_2','npc2_3','npc2_4'],linesL:['npc2l_1','npc2l_2','npc2l_3','npc2l_4'],
    talkQuest:'q_jtalk',onDone:()=>startJieunChoice()});
}

/* ---------- physics queries ---------- */
function inLane(x,z){const LA=CFG.LANE;return x>LA.x0&&x<LA.x1&&z>LA.z0&&z<LA.z1;}
function stairH(x,z,f){
  const LA=CFG.LANE;
  const t=clamp((x-LA.x0)/(LA.x1-LA.x0),0,1);
  const nSteps=Math.round((LA.x1-LA.x0)/CFG.STEP);
  const step=Math.min(nSteps-0.001,Math.floor((x-LA.x0)/CFG.STEP));
  return f*CFG.FH+(Math.floor(step)+1)*CFG.FH/nSteps;
}
function groundAt(x,z,yRef){
  let g=-Infinity;
  const band=6;
  for(let f=Math.max(0,Math.floor(yRef/CFG.FH)-1);f<=Math.min(CFG.FLOORS,Math.ceil(yRef/CFG.FH)+1);f++){
    const y=f*CFG.FH;
    if(y>yRef+0.7)continue;
    if(x>=-24&&x<=24&&z>=-10&&z<=10&&!inLane(x,z))g=Math.max(g,y);
  }
  if(inLane(x,z)){
    if(yRef>-0.5)g=Math.max(g,0);   // the Ground slab under the first flight: never a bottomless shaft
    const f=Math.max(0,Math.floor((yRef+0.7)/CFG.FH));
    const cand=stairH(x,z,f);
    if(cand<=yRef+0.7)g=Math.max(g,cand);
    const f2=f-1;
    if(f2>=0){const c2=stairH(x,z,f2);if(c2<=yRef+0.7)g=Math.max(g,c2);}
  }
  return g;
}
function collideCircle(px,pz,py,f,r=CFG.R){
  for(let ff=Math.max(0,f-1);ff<=Math.min(CFG.FLOORS,f+1);ff++){
    const arr=world.cols[ff];
    for(let i=0;i<arr.length;i++){
      const c=arr[i];
      if(c.off)continue;
      if(c.y1<py+0.35||c.y0>py+1.5)continue;
      const nx=clamp(px,c.x0,c.x1),nz=clamp(pz,c.z0,c.z1);
      let dx=px-nx,dz=pz-nz;const d2=dx*dx+dz*dz;
      if(d2<r*r){
        if(d2>1e-9){const d=Math.sqrt(d2);px=nx+dx/d*r;pz=nz+dz/d*r;}
        else{
          const l=px-c.x0,rt=c.x1-px,b=pz-c.z0,t=c.z1-pz;
          const m=Math.min(l,rt,b,t);
          if(m===l)px=c.x0-r;else if(m===rt)px=c.x1+r;else if(m===b)pz=c.z0-r;else pz=c.z1+r;
        }
      }
    }
  }
  return [px,pz];
}
function losClear(x0,z0,x1,z1,f){
  const dx=x1-x0,dz=z1-z0,ey=f*CFG.FH;
  for(let ff=Math.max(0,f-1);ff<=Math.min(CFG.FLOORS,f+1);ff++){
    const arr=world.cols[ff];
    for(let i=0;i<arr.length;i++){
      const c=arr[i];if(!c.los||c.off)continue;
      if(c.y1<ey+0.5||c.y0>ey+1.6)continue;   // a wall on the floor above/below does not block this floor
      // slab test
      let tmin=0,tmax=1;
      if(Math.abs(dx)<1e-9){if(x0<c.x0||x0>c.x1)continue;}
      else{
        let t1=(c.x0-x0)/dx,t2=(c.x1-x0)/dx;if(t1>t2){const tt=t1;t1=t2;t2=tt;}
        tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)continue;
      }
      if(Math.abs(dz)<1e-9){if(z0<c.z0||z0>c.z1)continue;}
      else{
        let t1=(c.z0-z0)/dz,t2=(c.z1-z0)/dz;if(t1>t2){const tt=t1;t1=t2;t2=tt;}
        tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)continue;
      }
      return false;
    }
  }
  return true;
}

/* =====================================================================
   SECTION D — PLAYER · ZOMBIES · COMBAT · FLARES
===================================================================== */
const player={
  pos:new THREE.Vector3(-21.5,0.1,0),vy:0,yaw:Math.PI/2,pitch:0,
  hp:100,st:100,battery:70,flash:false,on:false,crouch:false,third:false,weapon:'melee',
  floor:0,grounded:true,down:false,dead:false,respawnT:0,bleedT:0,invulnT:0,
  bob:0,bobT:0,stepAcc:0,attackT:0,swingT:0,shakeT:0,dmgFlash:0,speed:0,
};
const CHECK={floor:0};
let spot,camFill,camShake=0,muzzle=null,muzzleT=0;

function setupCameraRig(){
  spot=new THREE.SpotLight(0xfff1d0,0,30,0.5,0.5,1.4);
  spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.camera.near=0.2;spot.shadow.camera.far=30;spot.shadow.bias=-0.004;
  spot.position.set(0.16,-0.12,0);
  camera.add(spot);
  spot.target.position.set(0.16,-0.12,-1);camera.add(spot.target);
  camFill=new THREE.PointLight(0xffe8c0,0,4,1.8);camera.add(camFill);
  muzzle=new THREE.PointLight(0xffc888,0,9,1.8);scene.add(muzzle);
  scene.add(camera);
}

/* ---------- humanoid builder (zombies, players, remote players) ---------- */
/* Rounded, proportioned people (and infected).
   Conventions the animation code relies on:
   - the model faces -Z; legs hang from the hips on the root group (rotation.x > 0 swings a leg forward)
   - the TORSO pivots at the waist and is turned 180° (order YXZ), so torso.rotation.x > 0 leans FORWARD;
     head and arms are children of the torso: arm.rotation.x < 0 raises an arm forward, head.rotation.x > 0 nods
   - torso and head are single-material meshes (zombies clone them for the hit flash) */
const _HGEO={};
const hgeo=(k,f)=>_HGEO[k]||(_HGEO[k]=f());
const _HMAT={};
const hmat=(k,f)=>_HMAT[k]||(_HMAT[k]=f());
function buildHumanoid(opts={}){
  const g=new THREE.Group();
  const Z=!!opts.zombie,RB=!!opts.robot;
  const ztype=opts.ztype||'shambler';
  const look=opts.look||(Z?ztype:(RB?'robot':'player'));
  const lkBase=Z?(ZLOOK[ztype]||ZLOOK.shambler):null;
  const lk=Z?{...lkBase,cloth:lkBase.cloth==='zgreen'?'zgreen'+(opts.variant??irand(0,2)):lkBase.cloth}:null;
  const zm=Z&&TEX.zskin?zMats(lk):null;
  // infected students: some are girls (skirt, long hair); Park and the big ones are not
  const girl=Z&&!RB&&(ztype==='jieun'||(opts.girl&&!['brute','watcher','park'].includes(ztype)));
  const std=(c,r=.9,extra={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...extra});
  const shared=(k,c,r,extra)=>hmat(k,()=>std(c,r,extra));
  // ---- materials
  const skin=Z?(zm?zm.skin:shared('zsk',0x8a9078,.92)):(RB?std(opts.skin||0xd8dde2,.35,{metalness:.4}):std(opts.skin||0xb08a6a,.72));
  const top=Z?(zm?zm.cloth:shared('zcl',0x3a3a3a,1)):(RB?std(opts.cloth||0x3a86ff,.45,{metalness:.25}):std(opts.cloth||0x35404e,.95));
  let pants=RB?top:shared('pants'+(opts.pants??(Z?0x22242a:0x26282e)),opts.pants??(Z?0x22242a:0x26282e),1);
  const shoe=shared('shoe',0x18150f,.6);
  const dark=shared('dark',0x0b0808,1);
  const blood=shared('blood',0x4a0306,.35);
  const hairM=shared('hair'+(Z?lk.hair:(opts.hair??0x1b1612)),Z?lk.hair:(opts.hair??0x1b1612),.95);
  const texMat=(k,rough=1,rep)=>hmat('tex_'+k+(rep||''),()=>{const t=new THREE.CanvasTexture(TEX[k]);t.colorSpace=THREE.SRGBColorSpace;
    if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep,1);}return new THREE.MeshStandardMaterial({map:t,color:0xb0b0b0,roughness:rough});});
  if(Z&&!RB&&ztype!=='park'&&TEX.ztrousers)pants=texMat('ztrousers',1,2);
  let thighM=pants,shinM=pants,armTop=top,foreM=RB?top:(Z?skin:top);
  const sockM=TEX.sock?texMat('sock',1,3):shared('sock',0xe8e6e0,1);
  if(look==='jieun'||girl){thighM=skin;shinM=sockM;}
  // Ji-eun (alive): knit cardigan with a bloody smear, rolled sleeves
  let topM=top;
  if(look==='jieun'&&TEX.cardigan){topM=hmat('cardiganM',()=>{const t=new THREE.CanvasTexture(TEX.cardigan);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map:t,roughness:1});});armTop=topM;foreM=topM;}
  const skirtM=TEX.plaid?texMat('plaid',1,3):shared('skirt',0x5a5e64,1);
  // ---- geometry (shared across every body)
  const cap=(r,l)=>hgeo('cap'+r+'_'+l,()=>new THREE.CapsuleGeometry(r,l,4,12));
  const cyl=(a,b,h,s=10)=>hgeo('cyl'+a+'_'+b+'_'+h+'_'+s,()=>new THREE.CylinderGeometry(a,b,h,s));
  const sph=(r,w=12,hh=9)=>hgeo('sph'+r+'_'+w+'_'+hh,()=>new THREE.SphereGeometry(r,w,hh));
  const box=(w,h,d)=>hgeo('box'+w+'_'+h+'_'+d,()=>new THREE.BoxGeometry(w,h,d));
  const put=(geo,mat,x,y,z,parent,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(sx!==1||sy!==1||sz!==1)m.scale.set(sx,sy,sz);(parent||g).add(m);return m;};
  const parts={};
  const brute=Z&&ztype==='brute';
  // ---- torso: pivots at the waist, faces +Z locally (turned 180°)
  const torsoGeo=RB?hgeo('torsoR',()=>{const q=new THREE.BoxGeometry(0.44,0.6,0.26);q.translate(0,0.32,0);return q;})
    :hgeo(brute?'torsoB':'torso',()=>{const q=new THREE.CapsuleGeometry(0.17,0.28,5,16);q.rotateY(Math.PI);q.scale(brute?1.42:1.16,1,brute?0.82:0.66);q.translate(0,0.33,0);return q;});
  parts.torso=new THREE.Mesh(torsoGeo,topM);
  parts.torso.position.set(0,0.94,0);
  parts.torso.rotation.order='YXZ';parts.torso.rotation.y=Math.PI;
  g.add(parts.torso);
  const T0=parts.torso;
  // pelvis (on the root, so the legs stay attached)
  if(!RB)put(cap(0.14,0.08),pants,0,0.93,0,g,brute?1.4:1.18,0.85,brute?1.0:0.8);
  else put(box(0.36,0.18,0.24),pants,0,0.9,0);
  // neck + head
  put(cyl(0.048,0.056,0.14),skin,0,0.69,0.005,T0);
  const headGeo=RB?box(0.26,0.26,0.26):sph(0.112,20,16);
  parts.head=new THREE.Mesh(headGeo,Z&&zm&&zm.face?zm.face:skin);
  parts.head.position.set(0,0.83,0.01);
  if(!RB)parts.head.scale.set(0.9,1.08,1);
  T0.add(parts.head);
  const H=parts.head;
  if(RB){
    put(box(0.22,0.16,0.02),shared('rbface',0x101418,.3),0,0.01,0.135,H);
    const em=std(0x081018,.5,{emissive:0x19c8ff,emissiveIntensity:2.8});
    parts.eyeL=put(sph(0.028),em,0.055,0.03,0.145,H);
    parts.eyeR=put(sph(0.028),em,-0.055,0.03,0.145,H);
    put(cyl(0.01,0.01,0.18),shared('rail',0x666a70,.5),0,0.22,0,H);
    put(sph(0.035),std(0x112233,.5,{emissive:0xffd23f,emissiveIntensity:2.2}),0,0.32,0,H);
    put(box(0.2,0.12,0.02),std(0x0a0e12,.4,{emissive:0x19c8ff,emissiveIntensity:.9}),0,0.38,0.135,T0);
  }else if(Z){
    // sunken sockets, ember pupils, a slack jaw, teeth and blood
    for(const sx of [1,-1]){
      put(sph(0.022,8,6),shared('ear',0x6a6a58,.9),0.104*sx,0,0,H,0.45,1,0.8);
    }
    const em=hmat('zeye'+lk.eye,()=>std(0x220000,.5,{emissive:lk.eye,emissiveIntensity:2.8}));
    parts.eyeL=put(sph(0.011,8,6),em,0.041,0.018,0.104,H);
    parts.eyeR=put(sph(0.011,8,6),em,-0.041,0.018,0.104,H);
    put(box(0.045,0.024,0.025),shared('zmouth',0x140002,1),0,-0.052,0.097,H);  // open mouth
    const tooth=shared('tooth',0xa89d80,.6);
    for(let i=0;i<4;i++)put(box(0.008,0.011,0.006),tooth,-0.017+i*0.011,-0.046,0.1,H);   // teeth inside the mouth, not a white grid
    put(sph(0.03,8,6),blood,0.062,-0.018,0.08,H,0.6,1,0.4);                 // torn cheek
    if(ztype!=='screamer'){                                                  // matted, patchy hair
      put(hgeo('hairZ',()=>new THREE.SphereGeometry(0.118,14,8,0,Math.PI*2,0,Math.PI*0.42)),hairM,0,0.012,-0.006,H);
    }
    if(ztype==='park'){                                                      // his glasses, cracked
      const rim=shared('rim',0x202020,.4,{metalness:.6});
      for(const sx of [1,-1])put(hgeo('lens',()=>new THREE.TorusGeometry(0.02,0.004,6,14)),rim,0.041*sx,0.018,0.112,H);
    }
    // wounds / stains on the clothes
    put(sph(0.03,8,6),blood,0.07,0.26,0.112*(brute?1.23:1),T0,1,1.3,0.12);

    if(brute){ // ribs through the rags
      const rib=shared('rib',0xcfc4a8,.8);
      for(let i=0;i<4;i++)put(box(0.22,0.022,0.02),rib,-0.02,0.2+i*0.06,0.15,T0);
    }
    if(ztype==='park'){
      put(box(0.1,0.22,0.01),shared('shirt',0xcfcac0,1),0,0.47,0.111,T0);
      put(box(0.03,0.2,0.012),shared('ptie',0x5a1a1a,.8),0,0.45,0.118,T0);
    }
    if(girl){
      put(box(0.21,0.28,0.06),hairM,0,-0.07,-0.095,H);                       // long, matted hair
      put(box(0.035,0.22,0.05),hairM,0.1,-0.06,0.02,H);put(box(0.035,0.22,0.05),hairM,-0.1,-0.06,0.02,H);
      put(cyl(0.17,0.25,0.3,14),skirtM,0,0.8,0);
    }
    // ---- wounds: a few, different on every body, still wet and running
    const raw=shared('woundRaw',0x3a0507,.55),crater=shared('woundDark',0x120102,.8),drip=shared('drip',0x5a0407,.18,{metalness:.15});
    const bone=shared('bone',0xd9d0b4,.6);
    parts.wounds=[];
    const wound=(parent,x,y,z,size,dripLen,dirZ=1)=>{
      const w=new THREE.Group();w.position.set(x,y,z);parent.add(w);
      put(sph(size*1.15,10,8),raw,0,0,-0.006*dirZ,w,1,0.8,0.18);          // wet torn edge, flush with the skin
      put(sph(size*0.7,8,6),crater,size*0.1,0,0.002*dirZ,w,1,0.75,0.15);   // the dark hole
      if(dripLen>0)put(box(0.007,dripLen,0.003),drip,size*0.25,-dripLen/2-size*0.5,0.004*dirZ,w);
      parts.wounds.push(w);return w;
    };
    const pool=['neck','shoulder','arm','chest','thigh','scalp','side'];
    for(let i=pool.length-1;i>0;i--){const j=irand(0,i);[pool[i],pool[j]]=[pool[j],pool[i]];}
    const nW=ztype==='brute'||ztype==='watcher'?4:irand(2,3);
    parts._woundKinds=pool.slice(0,nW);
    parts._needLimbWounds=[];
    for(const k of parts._woundKinds){
      if(k==='neck'){wound(T0,rand(0.03,0.05)*(Math.random()<0.5?1:-1),0.68,0.05,0.03,0.18);}   // THE bite
      else if(k==='chest')wound(T0,rand(-0.1,0.1),rand(0.3,0.45),0.113*(brute?1.23:1),0.035,rand(0.1,0.2));
      else if(k==='side')wound(T0,0.09*(brute?1.3:1),rand(0.12,0.25),0.105*(brute?1.23:1),0.03,0.12);
      else if(k==='scalp')wound(H,rand(-0.03,0.03),0.06,0.108,0.018,0.06);   // forehead gash
      else parts._needLimbWounds.push(k);                                     // limbs exist further down
    }
    parts._woundMats={raw,crater,drip,bone};parts._wound=wound;
  }else{
    // ---- a person: eyes, brows, nose, mouth, ears, hair
    const white=shared('eyew',0xeeeae4,.4),iris=shared('iris',0x2a1c14,.3);
    for(const sx of [1,-1]){
      put(sph(0.016,10,8),white,0.04*sx,0.014,0.097,H,1,0.8,0.6);
      put(sph(0.008,8,6),iris,0.04*sx,0.014,0.106,H);
      put(box(0.036,0.007,0.008),hairM,0.04*sx,0.042,0.104,H);
      put(sph(0.022,8,6),skin,0.104*sx,0,0,H,0.45,1,0.8);
    }
    put(box(0.02,0.04,0.028),skin,0,-0.008,0.112,H);
    parts.face=put(box(0.04,0.008,0.008),shared('lip',0x7a4a44,.7),0,-0.05,0.104,H);
    const bald=look==='park';
    put(hgeo(bald?'hairP':'hairT',()=>new THREE.SphereGeometry(0.119,16,9,0,Math.PI*2,bald?Math.PI*0.28:0,bald?Math.PI*0.3:Math.PI*0.48)),hairM,0,0.01,-0.008,H);
    if(!bald)put(box(0.19,0.05,0.04),hairM,0,0.07,0.085,H);                 // fringe
    if(look==='jieun'){
      put(box(0.21,0.26,0.06),hairM,0,-0.06,-0.095,H);                       // long hair down the back
      put(box(0.035,0.2,0.05),hairM,0.1,-0.05,0.02,H);put(box(0.035,0.2,0.05),hairM,-0.1,-0.05,0.02,H);
      put(box(0.16,0.05,0.02),shared('collar',0xd8d4c8,1),0,0.6,0.1,T0);    // uniform collar + ribbon
      put(box(0.06,0.04,0.012),shared('ribbon',0x8a1a24,.8),0,0.56,0.115,T0);
      put(cyl(0.17,0.25,0.3,14),skirtM,0,0.8,0);                                // plaid skirt
    }
    if(look==='park'){
      const rim=shared('rim',0x202020,.4,{metalness:.6});
      for(const sx of [1,-1])put(hgeo('lens',()=>new THREE.TorusGeometry(0.02,0.004,6,14)),rim,0.041*sx,0.014,0.112,H);
      put(box(0.1,0.24,0.01),shared('shirt',0xe8e4dc,1),0,0.46,0.111,T0);    // shirt + tie under the jacket
      put(box(0.03,0.22,0.012),shared('ptie',0x5a1a1a,.8),0,0.44,0.118,T0);
    }
    if(look==='player'){                                                     // hoodie + backpack
      put(sph(0.12,12,8),top,0,0.72,-0.06,T0,1.1,0.55,0.9);
      put(box(0.3,0.36,0.14),shared('pack',0x4a3d2e,1),0,0.36,-0.17,T0);
      for(const sx of [1,-1])put(box(0.03,0.36,0.02),shared('strap',0x2a2218,1),0.1*sx,0.4,0.115,T0);
    }
  }
  // ---- arms: children of the torso, shoulder pivots (local +x is the body's LEFT after the 180° turn)
  parts.armL=new THREE.Group();parts.armL.position.set(brute?0.3:0.235,0.52,0);T0.add(parts.armL);
  parts.armR=new THREE.Group();parts.armR.position.set(brute?-0.3:-0.235,0.52,0);T0.add(parts.armR);
  for(const [side,arm] of [['L',parts.armL],['R',parts.armR]]){
    const torn=Z&&side==='L';                                               // one sleeve ripped away
    put(sph(0.064,10,8),torn?skin:armTop,0,0,0,arm);
    put(cyl(0.052,0.043,0.28),torn?skin:armTop,0,-0.15,0,arm);
    const elbow=new THREE.Group();elbow.position.set(0,-0.29,0);elbow.rotation.x=-0.22;arm.add(elbow);
    put(sph(0.043,8,6),torn?skin:foreM,0,0,0,elbow);
    put(cyl(0.043,0.034,0.26),foreM,0,-0.13,0,elbow);
    const hand=new THREE.Group();hand.position.set(0,-0.29,0);elbow.add(hand);
    put(sph(0.04,10,8),RB?top:skin,0,0,0,hand,0.72,1.15,0.5);
    put(cap(0.012,0.03),RB?top:skin,side==='L'?-0.028:0.028,0.012,0.018,hand).rotation.z=side==='L'?0.5:-0.5;
    if(Z){for(let i=0;i<3;i++)put(box(0.008,0.05,0.008),skin,-0.016+i*0.016,-0.05,0.004,hand).rotation.x=0.3;} // clawed fingers
    parts['elbow'+side]=elbow;parts['hand'+side]=hand;
  }
  // ---- legs: root children, hip pivots (face -Z)
  parts.legL=new THREE.Group();parts.legL.position.set(-(brute?0.13:0.098),0.9,0);g.add(parts.legL);
  parts.legR=new THREE.Group();parts.legR.position.set(brute?0.13:0.098,0.9,0);g.add(parts.legR);
  for(const [side,leg] of [['L',parts.legL],['R',parts.legR]]){
    const rip=Z&&side==='R';                                                // a torn trouser leg
    put(cyl(0.074,0.057,0.44),thighM,0,-0.22,0,leg);
    const knee=new THREE.Group();knee.position.set(0,-0.44,0);leg.add(knee);
    put(sph(0.056,8,6),rip?skin:shinM,0,0,0,knee);
    put(cyl(0.056,0.042,0.4),rip?skin:shinM,0,-0.2,0,knee);
    const sh=put(cap(0.046,0.13),RB?top:shoe,0,-0.43,-0.045,knee,1,0.72,1);sh.rotation.x=Math.PI/2;
    parts['knee'+side]=knee;
  }
  if(opts.look==='player'||(!Z&&!RB&&!opts.look)){
    const lightM=put(box(0.05,0.05,0.16),std(0x333333,.5,{metalness:.6,emissive:0xffdd88,emissiveIntensity:.4}),0,-0.02,0.07,parts.handR);
    parts.light=lightM;
  }
  if(parts._needLimbWounds){
    for(const k of parts._needLimbWounds){
      if(k==='shoulder')parts._wound(Math.random()<0.5?parts.armL:parts.armR,0,-0.02,0.058,0.028,0.1);
      else if(k==='arm'){const el=Math.random()<0.5?parts.elbowL:parts.elbowR;parts._wound(el,0,-0.12,0.04,0.024,0.1);
        if(Math.random()<0.5)put(box(0.012,0.09,0.012),parts._woundMats.bone,0.01,-0.13,0.045,el);}  // bone showing
      else if(k==='thigh')parts._wound(Math.random()<0.5?parts.legL:parts.legR,0,-0.22,-0.066,0.028,0.25,-1);
    }
    delete parts._needLimbWounds;delete parts._wound;delete parts._woundMats;
  }
  if(look==='jieun'){ // a torn strip of blouse tied round her left forearm, soaked through. Hers? Someone else's?
    put(cyl(0.047,0.047,0.07,10),shared('bandage',0xd8cfc4,1),0,-0.14,0,parts.elbowL);
    put(sph(0.03,8,6),shared('bandBlood2',0x4a0306,.85),0,-0.14,0.043,parts.elbowL,1,1.5,0.3);
    const jb=shared('jBlood',0x3a0305,.9);
    put(sph(0.05,10,8),jb,0.06,0.42,0.095,parts.torso,1,1.5,0.14);        // soaked patches down the front
    put(sph(0.035,10,8),jb,-0.08,0.22,0.095,parts.torso,1,1.8,0.14);
    put(sph(0.03,8,6),jb,0.1,0.52,0.08,parts.torso,1,1,0.18);
    const sc=shared('jScratch',0x5a0507,.8);                            // fresh scratches down the right forearm
    for(let i=0;i<3;i++){const m=put(box(0.009,0.11,0.008),sc,-0.02+i*0.017,-0.13,0.046,parts.elbowR);m.rotation.z=0.25;}
    if(parts.handL)put(sph(0.024,8,6),jb,0,-0.02,0.02,parts.handL,1,1,0.4);   // blood on her hands
    if(parts.handR)put(sph(0.024,8,6),jb,0,-0.02,0.02,parts.handR,1,1,0.4);
  }
  parts.g=g;
  parts.torso.castShadow=true;   // only torso/head cast shadows (perf)
  parts.head.castShadow=true;
  return parts;
}
function nameSprite(txt,color='#8fd0ff'){
  const c=makeCanvas(256,64,(x,w,h)=>{x.fillStyle='rgba(0,0,0,0)';x.clearRect(0,0,w,h);x.font='bold 30px Segoe UI,Arial';x.textAlign='center';x.fillStyle=color;x.strokeStyle='rgba(0,0,0,.9)';x.lineWidth=6;x.strokeText(txt,w/2,42);x.fillText(txt,w/2,42);});
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));
  s.scale.set(1.5,0.38,1);return s;
}

/* ---------- blood drops falling from wounds ---------- */
const drips=[],_dripV=new THREE.Vector3();
let _dripMat=null;
function spawnDrip(pos,f){
  if(drips.length>40||!MD.blood)return;
  _dripMat=_dripMat||new THREE.SpriteMaterial({map:dotTex(),color:0x6a0508,transparent:true,depthWrite:false});
  const sp=new THREE.Sprite(_dripMat);sp.scale.set(0.025,0.04,1);
  sp.position.copy(pos);scene.add(sp);
  drips.push({sp,vy:0,floorY:f*CFG.FH+0.02,f});
}
const dripDecals=[];
function updateDrips(dt){
  for(let i=drips.length-1;i>=0;i--){
    const d=drips[i];
    d.vy-=9.8*dt;d.sp.position.y+=d.vy*dt;
    if(d.sp.position.y<=d.floorY){
      scene.remove(d.sp);drips.splice(i,1);
      if(Math.random()<0.35&&world.levels[d.f]){ // a small spot stays behind
        const m=decal(d.f,d.sp.position.x,d.sp.position.z,rand(0.03,0.07),pick(MAT.blood));
        if(m){dripDecals.push(m);if(dripDecals.length>80){const o=dripDecals.shift();if(o.parent)o.parent.remove(o);}}
      }
    }
  }
}
/* ---------- particles: hit bursts (blood / sparks / wood chips) ---------- */
const bursts=[];
let _dotTex=null;
function dotTex(){
  if(_dotTex)return _dotTex;
  _dotTex=new THREE.CanvasTexture(makeCanvas(32,32,(x,w,h)=>{
    const g2=x.createRadialGradient(16,16,1,16,16,15);
    g2.addColorStop(0,'rgba(255,255,255,1)');g2.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g2;x.fillRect(0,0,w,h);
  }));
  return _dotTex;
}
function burst(pos,colorHex,n=10,spd=2.4,size=0.07){
  for(let i=0;i<n;i++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex(),color:colorHex,transparent:true,depthWrite:false}));
    sp.scale.setScalar(size*rand(0.6,1.4));
    sp.position.copy(pos).add(new THREE.Vector3(rand(-.12,.12),rand(-.06,.12),rand(-.12,.12)));
    const v=new THREE.Vector3(rand(-1,1),rand(0.3,1.4),rand(-1,1)).normalize().multiplyScalar(spd*rand(0.5,1.2));
    scene.add(sp);
    bursts.push({sp,v,life:rand(0.3,0.6)});
  }
}
function updateBursts(dt){
  for(let i=bursts.length-1;i>=0;i--){
    const b=bursts[i];
    b.life-=dt;
    if(b.life<=0){scene.remove(b.sp);bursts.splice(i,1);continue;}
    b.v.y-=6.5*dt;
    b.sp.position.addScaledVector(b.v,dt);
    b.sp.material.opacity=clamp(b.life*2.4,0,1);
  }
}

/* ---------- first-person view model (arms + crowbar / flashlight) ---------- */
let vm=null;
function setupViewModel(){
  vm=new THREE.Group();
  const skinM=new THREE.MeshStandardMaterial({color:0xb08a6a,roughness:.9});
  const sleeve=new THREE.MeshStandardMaterial({color:0x35404e,roughness:1});
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.36),sleeve);arm.position.set(0.01,0,0.16);
  const hand=new THREE.Mesh(new THREE.BoxGeometry(0.085,0.08,0.11),skinM);hand.position.set(0,0,-0.06);
  vm.add(arm,hand);
  // crowbar — shaft + bent steel claw, looks like the real thing
  vm.crowbar=new THREE.Group();
  const cbMat=new THREE.MeshStandardMaterial({color:0x7d1f22,metalness:.75,roughness:.32});
  const cbSteel=new THREE.MeshStandardMaterial({color:0x9aa2ad,metalness:.85,roughness:.28});
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.017,0.46,8),cbMat);
  shaft.rotation.x=Math.PI/2;
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.014,0.1,8),cbMat);
  neck.rotation.x=Math.PI/2;neck.rotation.z=0.45;neck.position.set(0.012,-0.004,-0.26);
  const claw=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.02,0.05),cbSteel);
  claw.position.set(0.03,0.012,-0.3);claw.rotation.y=0.35;
  const tip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.018,0.02),cbSteel);
  tip.position.set(0.055,0.012,-0.315);tip.rotation.y=0.6;
  const butt=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.02,0.045),cbSteel);
  butt.position.set(0.012,-0.006,0.235);butt.rotation.y=-0.3;
  vm.crowbar.add(shaft,neck,claw,tip,butt);
  vm.crowbar.rotation.set(0.22,0.14,0.18);
  // pistol
  vm.pistol=new THREE.Group();   // compact SMG: receiver, barrel, magazine, grip, folding stock
  const pgm=new THREE.MeshStandardMaterial({color:0x23262b,metalness:.8,roughness:.35});
  const pdark=new THREE.MeshStandardMaterial({color:0x121416,metalness:.5,roughness:.6});
  const precv=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.08,0.3),pgm);precv.position.z=-0.08;
  const pbarrel=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.14,8),pdark);pbarrel.rotation.x=Math.PI/2;pbarrel.position.set(0,0.012,-0.29);
  const pmag=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.15,0.05),pdark);pmag.position.set(0,-0.1,-0.13);pmag.rotation.x=-0.15;
  const pgrip=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.12,0.06),pgm);pgrip.position.set(0,-0.09,0.04);pgrip.rotation.x=0.28;
  const pstock=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.05,0.18),pdark);pstock.position.set(0,-0.005,0.16);
  const psight=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.025,0.02),pgm);psight.position.set(0,0.052,-0.2);
  vm.pistol.add(precv,pbarrel,pmag,pgrip,pstock,psight);
  vm.pistol.rotation.set(0.06,0,0);
  // flashlight
  vm.torch=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.033,0.22,10),new THREE.MeshStandardMaterial({color:0x2c2c30,metalness:.6,roughness:.4}));
  body.rotation.x=Math.PI/2;
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.027,0.027,0.02,10),new THREE.MeshStandardMaterial({color:0xfff1c0,emissive:0xffe9a8,emissiveIntensity:2}));
  lens.rotation.x=Math.PI/2;lens.position.z=-0.115;
  vm.torch.add(body,lens);
  vm.torch.rotation.set(0.1,0,0);
  vm.lens=lens;
  vm.add(vm.crowbar,vm.torch,vm.pistol);
  vm.position.set(0.3,-0.29,-0.5);
  vm.rotation.y=-0.14;
  camera.add(vm);
}
function updateViewModel(dt,t){
  if(!vm)return;
  vm.visible=!player.third&&!player.dead&&!player.down;
  const usePistol=player.weapon==='pistol'&&INV.pistol;
  vm.crowbar.visible=!usePistol&&INV.crowbar;
  vm.pistol.visible=usePistol;
  vm.torch.visible=!INV.crowbar&&!usePistol;
  vm.lens.material.emissiveIntensity=player.on?2.6:0.15;
  const bob=player.speed>0.5&&player.grounded?Math.sin(player.bobT)*0.012:0;
  const sway=Math.sin(t*1.3)*0.004;
  vm.position.y=-0.29+bob+sway+(usePistol?0.012:0);
  player.fireKick=Math.max(0,(player.fireKick||0)-dt*14);
  const kick=usePistol?player.fireKick:0;
  vm.rotation.z=lerp(vm.rotation.z,0,Math.min(1,dt*8));
  if(holdAct&&!usePistol){
    const ht=holdAct.t;
    if(holdAct.kind==='pry'){           // levering the planks: short hard pulls
      vm.rotation.x=-0.5+Math.sin(ht*9)*0.35;vm.rotation.z=Math.sin(ht*4.5)*0.14;
      vm.position.z=-0.6+Math.sin(ht*9)*0.05;vm.position.y-=0.04;
    }else if(holdAct.kind==='lever'){   // hauling a breaker handle down
      const k2=Math.min(1,ht/holdAct.dur);
      vm.rotation.x=-0.2-k2*0.9;vm.position.y-=k2*0.12;vm.position.z=-0.55;
    }else{                               // striking the flare / helping a friend
      vm.rotation.x=-0.45+Math.sin(ht*18)*0.06;vm.position.z=-0.56;
    }
    return;
  }
  if(camKick>0){vm.position.y-=Math.sin(camKick/0.28*Math.PI)*0.08;vm.rotation.x=-0.3*Math.sin(camKick/0.28*Math.PI);return;}
  if(player.swingT>0){
    const k=player.swingT/0.3;
    vm.rotation.x=-Math.sin(k*Math.PI)*1.15;
    vm.position.z=-0.5-Math.sin(k*Math.PI)*0.14;
  }else if(usePistol){
    vm.rotation.x=kick*0.12;
    vm.position.z=-0.5+kick*0.035;
    vm.position.x=0.3+(kick>0?rand(-0.004,0.004):0);
  }else{
    vm.rotation.x=lerp(vm.rotation.x,0,Math.min(1,dt*10));
    vm.position.z=lerp(vm.position.z,-0.5,Math.min(1,dt*10));
  }
}

/* ---------- floating dust motes (scary mode, near player) ---------- */
let dust=null,dustPos=null,dustPh=null;
function setupDust(){
  if(MD.id!=='scary')return;
  const N=220;
  dustPos=new Float32Array(N*3);dustPh=new Float32Array(N);
  for(let i=0;i<N;i++){dustPos[i*3]=rand(-5,5);dustPos[i*3+1]=rand(0.1,3.1);dustPos[i*3+2]=rand(-5,5);dustPh[i]=rand(0,TAU);}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
  const mat=new THREE.PointsMaterial({color:0xffe8c0,size:0.028,transparent:true,opacity:0.5,map:dotTex(),depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
  dust=new THREE.Points(geo,mat);
  scene.add(dust);
}
function updateDust(dt,t){
  if(!dust)return;
  dust.position.set(player.pos.x,player.floor*CFG.FH,player.pos.z);
  for(let i=0;i<dustPh.length;i++){
    dustPos[i*3+1]-=dt*0.05;
    dustPos[i*3]+=Math.sin(t*0.6+dustPh[i])*dt*0.04;
    if(dustPos[i*3+1]<0.05)dustPos[i*3+1]=3.1;
    if(dustPos[i*3]>5)dustPos[i*3]=-5;if(dustPos[i*3]<-5)dustPos[i*3]=5;
  }
  dust.geometry.attributes.position.needsUpdate=true;
}

/* ---------- player body (3rd person) ---------- */
let playerBody=null;
function setupPlayerBody(){
  playerBody=buildHumanoid({skin:0xb08a6a,cloth:0x35404e});
  playerBody.name=nameSprite(G.myName||'You');
  playerBody.name.position.y=2.2;
  playerBody.g.add(playerBody.name);
  playerBody.g.visible=false;
  scene.add(playerBody.g);
}

/* ---------- zombies ---------- */
const ELEV={x:19.8};   // the dead elevator, in the stair tower
const ZTYPES={
  shambler:{speed:1.0,chase:2.8,hp:3,dmg:14,scale:1.0,sight:7,aimH:1.15},
  runner:{speed:2.0,chase:4.3,hp:2,dmg:18,scale:0.95,sight:8,aimH:1.1},   // freshly turned — still wears the school uniform
  brute:{speed:0.85,chase:2.4,hp:8,dmg:30,scale:1.28,sight:7,aimH:1.4},
  screamer:{speed:1.2,chase:3.0,hp:2,dmg:10,scale:0.98,sight:9,aimH:1.15}, // screams in the whole floor
  crawler:{speed:0.8,chase:1.9,hp:2,dmg:12,scale:0.92,sight:6,aimH:0.35},  // drags itself on its belly, lunges at your ankles
  watcher:{speed:2.6,chase:5.1,hp:14,dmg:26,scale:1.14,sight:14,aimH:1.25},// THE WATCHER — predator; scripted states
  park:{speed:1.4,chase:3.8,hp:6,dmg:16,scale:1.0,sight:16,aimH:1.15},     // Mr. Park, freshly turned
  jieun:{speed:1.5,chase:3.9,hp:5,dmg:14,scale:0.94,sight:16,aimH:1.1},    // Ji-eun, if she dies
  turned:{speed:1.3,chase:3.4,hp:5,dmg:16,scale:1.0,sight:14,aimH:1.15},   // co-op: a friend who didn't make it
};
/* per-type look: flesh/cloth textures + eye + hair colour */
const ZLOOK={
  shambler:{cloth:'zgreen',eye:0xff2a1a,hair:0x1a1814},
  runner:{cloth:'zgreen',eye:0xff6a3a,hair:0x241c14},
  brute:{cloth:'zgreen',eye:0xff1a10,hair:0x111008},
  screamer:{cloth:'zgreen',eye:0xcfe8ff,hair:0x201808},
  crawler:{cloth:'zgreen',eye:0xff2a1a,hair:0x141210},
  watcher:{cloth:'zgreen',eye:0xd8d8d8,hair:0x060606}, // pale cold eyes. it watches.
  park:{cloth:'zclothA',eye:0xff3a1a,hair:0x8e8a84},    // the biology teacher: suit and tie, not a uniform
  jieun:{cloth:'zcardigan',eye:0xff3a1a,hair:0x151010}, // her cardigan, soaked now
  turned:{cloth:'zgreen',eye:0xff2a1a,hair:0x1a1410},
};
const ZTYPE_LIST=['shambler','runner','brute','screamer','crawler','watcher','park','jieun','turned'];
const _ZMAT={};
function zMats(lk){
  if(_ZMAT[lk.cloth])return _ZMAT[lk.cloth];
  if(!TEX[lk.cloth])return zMats({...lk,cloth:'zgreen0'});
  const mkTex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;};
  _ZMAT[lk.cloth]={
    skin:new THREE.MeshStandardMaterial({map:mkTex(TEX.zskin),color:0x8f897e,roughness:.95}),   // tinted down: no glowing-white skin under the flashlight
    cloth:new THREE.MeshStandardMaterial({map:mkTex(TEX[lk.cloth]),color:0x9a9a9a,roughness:1}),
    // the painted face covers the FRONT of the head sphere only (clamped: the rest is plain skin tone)
    face:TEX.zface?new THREE.MeshStandardMaterial({map:(()=>{const t=mkTex(TEX.zface);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.repeat.set(2.78,2);t.offset.set(-0.194,-0.56);return t;})(),color:0x7a756c,roughness:.95}):null,
  };
  return _ZMAT[lk.cloth];
}
let ZID=0;
class Zombie{
  constructor(f,x,z,type,room){
    this.id=ZID++;this.f=f;this.type=type;
    this.robot=MD.id==='lite';
    this.cfg={...ZTYPES[type],speed:ZTYPES[type].speed*MD.zSpeed,chase:ZTYPES[type].chase*MD.zSpeed};
    // no two move alike: most drag themselves along, some keep pace, a few are fast
    this.pace=1;
    if(!['watcher','park','jieun','brute','turned'].includes(type)){const r=Math.random();this.pace=r<0.4?0.8:(r<0.83?1:1.18);}
    this.cfg.speed*=this.pace;this.cfg.chase*=this.pace;
    this.hp=this.cfg.hp;this.dead=false;this.state='idle';
    if(this.robot){
      const tints=[{skin:0xd8dde2,cloth:0x3a86ff},{skin:0xe2e0d8,cloth:0xff8a3a},{skin:0xd4dce4,cloth:0x3ad488},{skin:0xe4e4dc,cloth:0xb43ad4}];
      const tint=tints[this.id%tints.length];
      this.body=buildHumanoid({robot:true,skin:tint.skin,cloth:tint.cloth});
    }else{
      this.body=buildHumanoid({zombie:true,ztype:type,skin:this.cfg.skin,cloth:this.cfg.cloth,variant:irand(0,2),girl:Math.random()<0.35});
    }
    // clone torso/head materials so hit-flash is per-zombie (head uses a material ARRAY)
    const cl=m=>Array.isArray(m)?m.map(x=>x.clone()):m.clone();
    this.body.torso.material=cl(this.body.torso.material);
    this.body.head.material=cl(this.body.head.material);
    this.g=this.body.g;this.g.scale.setScalar(this.cfg.scale);
    // a crawler lies on its belly: the whole body sits low inside its group (the group stays on the floor,
    // so hit tests, stairs and collisions keep working and nothing sinks into the ground)
    if(type==='crawler'&&!this.robot)for(const ch of this.g.children)ch.position.y-=0.6;
    this.g.rotation.order='YXZ';   // lie down / get up / fall along the facing direction
    // the tower gets meaner the higher you climb
    const diff=1+Math.max(0,Math.min(f,CFG.FLOORS-1)-2)*0.05;
    this.cfg.speed*=diff;this.cfg.chase*=Math.min(diff,1.05);   // meaner = more of them, not faster ones
    if(type==='park'){
      const tag=nameSprite(T('park_tag'),'#ff6b6b');tag.position.y=2.2;this.g.add(tag);
    }
    this.g.position.set(x,f*CFG.FH,z);
    this.home=room?{x0:room.x0,x1:room.x1,z0:room.z0,z1:room.z1}:{x0:x-4,x1:x+4,z0:z-4,z1:z+4};
    this.wp=[{x:(this.home.x0+this.home.x1)/2,z:(this.home.z0+this.home.z1)/2}];
    if(room&&room.door){this.doorRef=room.door;this.wp.push({x:room.door.g.position.x+0.7,z:0});}
    this.wpI=0;this.waitT=rand(0,3);
    this.yaw=rand(0,TAU);this.phase=rand(0,TAU);
    this.growlT=rand(3,10);this.stepT=0;this.attackCd=0;this.windup=-1;
    this.invest=null;this.investT=0;this.loseT=0;this.staggerT=0;this.stuckT=0;this.lastX=x;this.lastZ=z;
    this.hurtT=0;this.corpseT=0;this.doorT=0;this.trailAcc=0;this.hpMax=this.cfg.hp;
    this.headTilt=rand(-0.3,0.3);this.twitchT=0;this.screamed=false;
    // a ruined body: every one limps on a different side, some have an arm that no longer works
    this.gait={limp:type==='watcher'?0:rand(0.35,0.85),side:Math.random()<0.5?1:-1,
      deadArm:(type!=='watcher'&&Math.random()<0.55)?(Math.random()<0.5?'L':'R'):null,
      loll:type==='watcher'?0.35:rand(0.12,0.5),twist:rand(-0.28,0.28),lean:rand(-0.14,0.14),
      armOff:{L:rand(-0.3,0.2),R:rand(-0.3,0.2)},jerkT:rand(1,4),jd:0,jx:0,jz:0,jy:0};
    this.dripT=rand(0.5,2);
    this.lungeT=0;this.lungeCd=0;this.aggroCd=0;this.breathT=rand(0.5,2);
    this.riseT=0;this.riseDur=1;
    world.zombies.push(this);world.levels[f].add(this.g);this.lvF=f;
  }
  syncLevel(){   // keep the mesh in its CURRENT floor's group (floor groups far from you are hidden)
    if(this.lvF!==this.f&&world.levels[this.f]){world.levels[this.f].add(this.g);this.lvF=this.f;}
  }
  hear(x,z){if(this.dead)return;if(this.state!=='chase'){this.state='investigate';this.invest={x,z};this.investT=8;
    if(Math.random()<0.5)play('snarl',{pos:this.g.position,vol:.6,ref:14});}}
  hit(dmg,byRemote,kind='melee'){
    if(this.dead)return;
    this.hp-=dmg;this.hurtT=0.25;
    play(kind==='bullet'?'hitBullet':'hitMelee',{pos:this.g.position,vol:kind==='bullet'?.75:.95,ref:16});
    burst(this.g.position.clone().add(new THREE.Vector3(0,1.25*this.cfg.scale,0)),this.robot?0xffd23f:0x8a0a0f,8,2.2,0.06);
    if(this.hp<=0){this.die(byRemote);return;}
    this.state='chase';this.loseT=0;this.staggerT=0.35;
  }
  die(byRemote){
    this.dead=true;this.state='dead';this.corpseT=0;
    play('scream',{pos:this.g.position,vol:.9,ref:22});
    const p=this.g.position;
    burst(p.clone().add(new THREE.Vector3(0,1.3*this.cfg.scale,0)),this.robot?0x59d7ff:0x8a0a0f,this.robot?18:14,3.2,0.08);
    decal(this.f,p.x,p.z,rand(0.6,1.0),pick(MAT.blood));
    if(!byRemote){G.stats.kills++;hudStats();}
    if(G.host&&G.mp)netBroadcast({t:'ev',k:'zdie',id:this.id});
    if(this.type==='jieun'){showSub(T('jieun_zdead'),4,true);}
    if(this.type==='park'&&!G.flags.parkDead){
      G.flags.parkDead=true;netFlag('parkDead');
      showSub(T(MD.id==='lite'?'park_dead_l':'park_dead'),4,true);
      questCheck();
    }
  }
  nearestHuman(){
    // returns {p, d2, floor} for nearest alive, non-downed human
    let best=null,bd=1e9;
    const consider=(px,pz,pfloor,pref)=>{
      const d=dist2(this.g.position.x,this.g.position.z,px,pz);
      if(d<bd){bd=d;best={x:px,z:pz,floor:pfloor,p:pref};}
    };
    if(!player.dead&&!player.down&&G.started)consider(player.pos.x,player.pos.z,player.floor,'local');
    const je=companion();
    if(je){const q=je.parts.g.position;consider(q.x,q.z,je.f,'jieun');}
    if(G.mp)for(const r of net.remotes.values()){
      if(r.down||r.dead)continue;
      if(r.spec)continue;
      consider(r.x,r.z,r.f||0,'r'+r.id);
    }
    return best?{...best,d2:bd}:null;
  }
  update(dt,t){
    const g=this.g;
    this.syncLevel();
    if(this.dead){
      if(this.type==='crawler'&&!this.robot){g.rotation.z=0;return;}
      if(this.corpseT<1){
        this.corpseT+=dt*2.4;
        g.rotation.x=-Math.PI/2*Math.min(1,this.corpseT);
        g.position.y=this.f*CFG.FH+Math.min(0.25,this.corpseT*0.3);
      }
      return;
    }
    if(G.mp&&!G.host){this.applyNet(dt);return;}
    if(this.riseT>0){ // getting up off the floor (Mr. Park)
      this.riseT-=dt;
      const k=Math.max(0,this.riseT/this.riseDur);
      g.rotation.x=k*Math.PI/2;g.rotation.y=this.yaw;
      g.position.y=this.f*CFG.FH+k*0.16;
      this.body.armL.rotation.x=-1.4*(1-k)+Math.sin(G.time*30)*0.2*k;
      this.body.armR.rotation.x=-1.4*(1-k)-Math.sin(G.time*27)*0.2*k;
      if(this.riseT<=0){g.rotation.x=0;this.state='chase';this.loseT=0;}
      return;
    }
    const pf=player.floor;
    const active=Math.abs(this.f-pf)<=1;
    const roof=this.f===CFG.FLOORS&&G.flags.finale&&this.type!=='watcher'; // rooftop rage
    if(!active&&this.state!=='chase')return; // frozen offscreen
    this.hurtT=Math.max(0,this.hurtT-dt);
    this.staggerT=Math.max(0,this.staggerT-dt);
    this.attackCd=Math.max(0,this.attackCd-dt);
    this.aggroCd=Math.max(0,this.aggroCd-dt);
    const hum=this.nearestHuman();
    const sameFloor=hum&&hum.floor===this.f;
    const d=sameFloor?Math.sqrt(hum.d2):1e9;
    this.lureT=Math.max(0,(this.lureT||0)-dt);
    if(roof&&sameFloor&&this.lureT<=0){this.state='chase';this.loseT=0;this.lastPX=hum.x;this.lastPZ=hum.z;} // they have your scent up here
    // ---- senses (CONE VISION: they only see what their light covers)
    if(sameFloor&&d<40){
      const sight=this.cfg.sight*(player.crouch&&hum.p==='local'?0.55:1)+(player.on?4:0);
      const inv=1/Math.max(0.001,Math.sqrt(hum.d2));
      const tox=(hum.x-g.position.x)*inv,toz=(hum.z-g.position.z)*inv;
      const facing=(-Math.sin(this.yaw))*tox+(-Math.cos(this.yaw))*toz;
      const inCone=facing>0.55||d<1.6; // inside their facing wedge — or practically touching you
      const seen=this.lureT>0?d<1.2:((d<sight&&inCone&&losClear(g.position.x,g.position.z,hum.x,hum.z,this.f))||d<1.9);
      if(seen){
        this.state='chase';this.loseT=0;this.lastPX=hum.x;this.lastPZ=hum.z;
        if(this.aggroCd<=0){ // aggro shriek when it first locks on
          this.aggroCd=5;
          const sc=this.type==='screamer';
          play(Math.random()<0.65?'scream':'screech',{pos:g.position,vol:sc?1.25:0.7,ref:sc?46:26,rate:sc?1.2:0.82});
        }
        if(this.type==='screamer'&&!this.screamed){ // the screamer summons the whole floor
          this.screamed=true;
          for(const z2 of world.zombies){
            if(z2===this||z2.dead||z2.f!==this.f)continue;
            if(dist2(z2.g.position.x,z2.g.position.z,g.position.x,g.position.z)<30*30)z2.hear(hum.x,hum.z);
          }
          if(d<12)player.shakeT=Math.max(player.shakeT,0.4);
          showSub(T(MD.jumpscares?'sub_scream':'sub_scream_l'),3);
        }
      }
      else if(this.state==='chase'){this.loseT=(this.loseT||0)+dt;if(this.loseT>5){this.state='investigate';this.invest={x:this.lastPX,z:this.lastPZ};this.investT=6;}}
    }
    // flare attraction — on the roof a FRESH flare even pulls a hunting zombie off you for a few seconds
    for(const fl of flares){
      if(fl.life<=0||fl.f!==this.f)continue;
      const d2f=dist2(g.position.x,g.position.z,fl.x,fl.z);
      if(this.state!=='chase'&&d2f<22*22){this.state='investigate';this.invest={x:fl.x,z:fl.z};this.investT=Math.max(this.investT,1.5);}
      else if(roof&&this.type!=='brute'&&fl.life>10&&d2f<11*11){
        fl.lured=fl.lured||new Set();
        if(!fl.lured.has(this.id)){fl.lured.add(this.id);this.lureT=4.5;this.state='investigate';this.invest={x:fl.x,z:fl.z};this.investT=4.5;}
      }
    }
    // ---- growls, wet breathing & twitches (audible even when it hasn't seen you)
    if(active){
      this.growlT-=dt;
      if(this.growlT<=0){
        const voiceRate=this.type==='brute'?0.75:(this.type==='runner'?1.15:1);
        if(this.state==='chase'){
          this.growlT=rand(1.3,2.8);
          if(d<7&&Math.random()<0.6)play('zroar',{pos:g.position,vol:1.25,ref:30,rate:voiceRate}); // close: full roar
          else play(pick(['growl3','snarl','screech']),{pos:g.position,vol:1.0,ref:30,rate:voiceRate});
        }else{
          // idle: RARE and deliberate — one call in the dark, then nothing. Where is it?
          this.growlT=rand(9,19);
          if(d<18&&Math.random()<0.7)play(pick(['growl1','growl2','growl3']),{pos:g.position,vol:0.55,ref:24,rate:voiceRate});
        }
      }
      // wet jaw-work: clicks, smacks, feeding — only when it is RIGHT there
      this.mouthT=(this.mouthT??rand(3,8))-dt;
      if(this.mouthT<=0){
        this.mouthT=rand(6,13);
        if(d<4.5)play(Math.random()<0.5?'zmouth':'eat',{pos:g.position,vol:clamp(1.15-d/5,0.3,1),ref:11,rate:this.type==='brute'?0.8:1});
      }
      this.breathT-=dt;
      if(this.breathT<=0){
        this.breathT=rand(1.4,2.6);
        if(sameFloor&&d<8)play('zbreath',{pos:g.position,vol:clamp(1-d/8,0.15,1)*0.85,ref:12,rate:this.type==='brute'?0.7:1});
      }
      if(Math.random()<dt*0.3)this.twitchT=0.16;
    }
    this.twitchT=Math.max(0,this.twitchT-dt);
    // ---- movement
    let tx=null,tz=null,spd=0;
    if(this.state==='chase'&&hum){
      tx=hum.x;tz=hum.z;spd=this.cfg.chase*(roof?(G.flags.flareLit?ROOF.SPEED_FLARE:ROOF.SPEED):1);
      if(hum.floor!==this.f){ // navigate via stairwell
        if(g.position.x<15.8){tx=16;tz=0.2;}
        else if(inLane(g.position.x,g.position.z)||g.position.x<23.5){tx=21.5;tz=1.2;}
        spd=this.cfg.chase*0.8;
      }
      if(this.type==='crawler'){ // lunges at ankles when close
        this.lungeCd=Math.max(0,this.lungeCd-dt);this.lungeT=Math.max(0,this.lungeT-dt);
        if(sameFloor&&d<3&&this.lungeCd<=0){this.lungeT=0.5;this.lungeCd=3.6;play('snarl',{pos:g.position,vol:.9,ref:16,rate:1.2});}
        if(this.lungeT>0)spd*=1.7;
      }
      if(d<1.25*this.cfg.scale&&sameFloor&&this.attackCd<=0&&this.windup<0){this.windup=(this.type==='crawler'?0.28:0.5)*(roof?ROOF.WINDUP:1);}
    }else if(this.state==='investigate'&&this.invest){
      tx=this.invest.x;tz=this.invest.z;spd=this.cfg.speed*1.4;this.investT-=dt;
      if(dist2(g.position.x,g.position.z,tx,tz)<1||this.investT<=0){this.state='idle';this.waitT=rand(1,4);this.invest=null;}
    }else{ // idle/patrol
      if(this.waitT>0){this.waitT-=dt;
        if(this.type==='runner'&&Math.random()<dt*0.1)play('whisper',{pos:g.position,vol:.4,ref:10,rate:0.72}); // fresh ones still make sad human sounds
      }
      else{
        if(this.wpI>0&&this.doorRef&&!this.doorRef.open){this.wpI=0;this.waitT=rand(2,5);}   // the door is shut: stay in the room
        const w=this.wp[this.wpI];tx=w.x;tz=w.z;spd=this.cfg.speed;
        if(dist2(g.position.x,g.position.z,tx,tz)<1.2){this.wpI=(this.wpI+1)%this.wp.length;this.waitT=rand(0.5,3.5);}
      }
    }
    if(this.staggerT>0){tx=null;}
    if(this.windup>=0){
      this.windup-=dt;
      spd=0;
      if(this.windup<=0){
        this.windup=-1;this.attackCd=roof?ROOF.COOLDOWN:1.5;
        if(hum&&sameFloor&&Math.sqrt(hum.d2)<1.45*this.cfg.scale){
          dealZombieDamage(this);
        }else play('swing',{pos:g.position,vol:.5,ref:10});
      }
    }
    if(tx!==null){
      const ox0=g.position.x,oz0=g.position.z;
      let dx=tx-g.position.x,dz=tz-g.position.z;
      const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;
      let nx=g.position.x+dx*spd*dt,nz=g.position.z+dz*spd*dt;
      [nx,nz]=collideCircle(nx,nz,g.position.y,this.f,0.38*this.cfg.scale);
      // keep zombies off the stair lane unless chasing across floors
      if(this.state!=='chase'&&inLane(nx,nz)){nx=g.position.x;nz=g.position.z;}
      // Ji-eun's hiding room is a refuge: they stop at the doorway
      if(inSafeRoom(this.f,nx,nz)&&!inSafeRoom(this.f,g.position.x,g.position.z)){nx=g.position.x;nz=g.position.z;}
      const gy=groundAt(nx,nz,g.position.y);
      if(gy>-1e6&&gy<=g.position.y+0.75){
        g.position.x=nx;g.position.z=nz;g.position.y=lerp(g.position.y,gy,Math.min(1,dt*10));this.f=clamp(Math.round(g.position.y/CFG.FH),0,CFG.FLOORS);
      }
      // never press into a CLOSED door: stay a body's width back (arms and heads used to poke through into the hall)
      for(const dd of world.doors){
        if(dd.f!==this.f||dd.open)continue;
        const c=dd.colClosed;
        if(dd.axis==='x'){
          if(g.position.x>c.x0-0.3&&g.position.x<c.x1+0.3){const hz=(c.z0+c.z1)/2,e=g.position.z-hz;if(Math.abs(e)<0.72)g.position.z=hz+(e>=0?0.72:-0.72);}
        }else if(g.position.z>c.z0-0.3&&g.position.z<c.z1+0.3){const hx=(c.x0+c.x1)/2,e=g.position.x-hx;if(Math.abs(e)<0.72)g.position.x=hx+(e>=0?0.72:-0.72);}
      }
      // hunted enemies force closed doors open (knock first — scary!)
      if(this.state==='chase'||this.state==='investigate'){
        let nearDoor=null;
        for(const dd of world.doors){
          if(dd.f!==this.f||dd.open||dd.boarded||dd.safe)continue;
          const pp=doorPoint(dd);
          if(dist2(g.position.x,g.position.z,pp.x,pp.z)<1.25*1.25){nearDoor=dd;break;}
        }
        if(nearDoor){
          this.doorT+=dt;
          if(this.doorT>0.8&&this.doorT-dt<=0.8)play('clang',{pos:g.position,vol:.55,ref:10,rate:1.5});
          if(this.doorT>1.6){nearDoor.setOpen(true,true);this.doorT=0;}
        }else this.doorT=0;
      }
      // wounded enemies drip (blood / paint)
      if(this.hp<this.hpMax){
        this.trailAcc+=spd*dt;
        if(this.trailAcc>0.85){
          this.trailAcc=0;
          world.trails=world.trails||[];
          const dm=decal(this.f,g.position.x+rand(-.15,.15),g.position.z+rand(-.15,.15),rand(0.14,0.3),pick(MAT.blood));
          world.trails.push(dm);
          if(world.trails.length>140){const old=world.trails.shift();if(old.parent)old.parent.remove(old);}
        }
      }
      // stuck detection
      this.stuckT+=dt;
      if(this.stuckT>1.4){
        if(dist2(g.position.x,g.position.z,this.lastX,this.lastZ)<0.09){
          let ux=g.position.x+(Math.random()-0.5)*0.6,uz=g.position.z+(Math.random()-0.5)*0.6;
          [ux,uz]=collideCircle(ux,uz,g.position.y,this.f,0.38*this.cfg.scale); // never teleport through walls
          if(!inSafeRoom(this.f,ux,uz)||inSafeRoom(this.f,g.position.x,g.position.z)){g.position.x=ux;g.position.z=uz;}
          if(this.state==='investigate'){this.state='idle';this.waitT=1;}
        }
        this.lastX=g.position.x;this.lastZ=g.position.z;this.stuckT=0;
      }
      const targetYaw=Math.atan2(dx,dz)+Math.PI;
      this.yaw+=angDiff(this.yaw,targetYaw)*Math.min(1,dt*7);
      this.stepFx(Math.hypot(g.position.x-ox0,g.position.z-oz0),active&&sameFloor?d:1e9);
    }
    g.rotation.y=this.yaw;
    this.animateBody(dt,tx!==null&&spd>0.05,this.state==='chase'||this.windup>=0,sameFloor&&d<3);
    this.bleed(dt,sameFloor?d:1e9);
    const hurt=this.hurtT>0?1:0;
    const flashMats=[].concat(this.body.torso.material).concat(this.body.head.material);
    for(const mm of flashMats){
      if(hurt){mm.emissive.setHex(this.robot?0x5a4400:0x551111);mm.emissiveIntensity=0.9;}
      else mm.emissiveIntensity=0;
    }
    g.position.y+=hurt*0; // (kept simple)
  }
  /* legs move with the ground actually covered and a footstep sounds when a foot lands —
     nothing while it is blocked, knocking on a door or winding up a swing */
  stepFx(moved,d){
    const crawl=this.type==='crawler';
    const stride=(crawl?0.5:(this.type==='runner'?0.9:(this.type==='brute'?0.8:0.68)))*this.cfg.scale;
    const before=Math.floor(this.phase/Math.PI-0.5);
    this.phase+=Math.min(moved,0.3)/stride*Math.PI;
    if(Math.floor(this.phase/Math.PI-0.5)!==before&&d<22){
      play('zstep',{pos:this.g.position,vol:crawl?0.45:(this.state==='chase'?1:0.7),ref:crawl?14:26,
        rate:(crawl?0.62:(this.type==='runner'?1.2:(this.type==='brute'?0.7:0.9)))*rand(0.94,1.06)});
    }
  }
  applyNet(dt){
    if(this.netX===undefined)return;
    const g=this.g;
    const ox=g.position.x,oz=g.position.z;
    g.position.x=lerp(g.position.x,this.netX,Math.min(1,dt*10));
    g.position.y=lerp(g.position.y,this.netY,Math.min(1,dt*10));
    g.position.z=lerp(g.position.z,this.netZ,Math.min(1,dt*10));
    if(this.netYaw!==undefined)g.rotation.y=this.netYaw;
    this.f=this.netF??this.f;
    if(this.netDead&&!this.dead){this.die(true);return;}
    const chase=this.netState===2;
    this.stepFx(Math.hypot(g.position.x-ox,g.position.z-oz),this.f===player.floor?Math.hypot(g.position.x-player.pos.x,g.position.z-player.pos.z):1e9);
    this.animateBody(dt,true,chase,false);
  }
  /* ---- how a ruined body moves: uneven stride, a dragging pigeon-toed leg, a dead arm,
     a lolling head, and sudden snaps of the spine and neck ---- */
  animateBody(dt,moving,chase,reach){
    const b=this.body,gt=this.gait,t=G.time,g=this.g;
    if(!b.kneeL){ // (robots in Daylight mode keep the simple walk)
      const sw=moving?Math.sin(this.phase):0;
      b.legL.rotation.x=sw*0.55;b.legR.rotation.x=-sw*0.55;
      b.armL.rotation.x=chase?-1.3+sw*0.2:sw*0.3;b.armR.rotation.x=chase?-1.3-sw*0.2:-sw*0.3;
      return;
    }
    const type=this.type,runner=type==='runner',brute=type==='brute',watcher=type==='watcher';
    const wph=this.phase+gt.limp*0.65*Math.sin(this.phase);        // warped phase: hurry on the good leg, stall on the bad
    const sw=moving?Math.sin(wph):0;
    const bad=gt.side>0?'R':'L',good=bad==='R'?'L':'R';
    const sgn=bad==='R'?1:-1;
    // sudden jerks
    gt.jerkT-=dt;
    if(gt.jerkT<=0){gt.jerkT=chase?rand(0.7,2.2):rand(1.8,5.5);gt.jd=rand(0.08,0.2)*(brute?0.6:1);gt.jx=rand(-0.35,0.35);gt.jz=rand(-0.45,0.45);gt.jy=rand(-0.5,0.5);}
    const jk=gt.jd>0?1:0;gt.jd=Math.max(0,gt.jd-dt);
    const tw=this.twitchT>0?1:0;
    if(type==='crawler'){ // flat on its belly, hauling itself forward on its forearms, legs trailing
      const pull=moving?sw:Math.sin(t*0.9+this.id)*0.15;
      b.torso.rotation.x=1.5+jk*gt.jx*0.12;b.torso.rotation.y=Math.PI+pull*0.12;b.torso.rotation.z=pull*0.07;
      b.head.rotation.x=-1.2+jk*gt.jx*0.5+tw*0.3;b.head.rotation.z=gt.loll*0.4+jk*gt.jz*0.6;b.head.rotation.y=0;
      b.armL.rotation.x=-2.95+pull*0.3;b.armR.rotation.x=-2.95-pull*0.3;
      b.armL.rotation.z=0.22;b.armR.rotation.z=-0.22;
      b.elbowL.rotation.x=-0.2-Math.max(0,pull)*0.5;b.elbowR.rotation.x=-0.2-Math.max(0,-pull)*0.5;
      b['leg'+good].rotation.x=-1.45+Math.max(0,sw)*0.1;b['knee'+good].rotation.x=-0.2-Math.max(0,-sw)*0.35;
      b['leg'+bad].rotation.x=-1.52;b['knee'+bad].rotation.x=-0.02;b['leg'+bad].rotation.y=0.35*sgn;b['leg'+bad].rotation.z=0;   // a dead leg dragged behind
      g.rotation.z=0;
      return;
    }
    // ---- legs
    const amp=runner?0.85:(brute?0.4:0.58);
    const gS=good==='L'?1:-1;                                            // legL swings with +sw
    b['leg'+good].rotation.x=gS*sw*amp;
    b['knee'+good].rotation.x=-(0.12+0.6*Math.max(0,gS*sw))*(moving?1:0.3);
    b['leg'+bad].rotation.x=-gS*sw*amp*(1-gt.limp*0.7);
    b['knee'+bad].rotation.x=-0.04;                                     // locked knee
    b['leg'+bad].rotation.y=0.38*sgn*gt.limp;                           // turned-in, broken ankle
    b['leg'+bad].rotation.z=0.06*sgn;
    // ---- body: dips onto the bad leg, rolls, twists
    const plant=Math.max(0,-gS*sw);                                     // weight on the bad leg
    b.torso.position.y=0.94-(moving?gt.limp*0.07*plant:0);
    g.rotation.z=(moving?gt.limp*0.13*sgn*plant:0)+gt.lean*0.4+jk*gt.jz*0.15;
    const hunch=watcher?0.06:(runner?0.55:(chase?0.4:0.24))+(brute?0.1:0);
    const idle=Math.sin(t*1.2+this.id)*(moving?0:1);
    b.torso.rotation.x=hunch+0.05*Math.sin(2*wph)+jk*gt.jx+tw*0.2+(this.windup>=0?-0.18:0);
    b.torso.rotation.z=gt.lean+0.08*sw+idle*0.05+jk*gt.jz*0.5;
    b.torso.rotation.y=Math.PI+gt.twist+0.14*sw+jk*gt.jy*0.3;
    // ---- head: lolls to one side, drifts, snaps
    b.head.rotation.z=gt.side*gt.loll+this.headTilt*0.5+0.1*Math.sin(wph*0.5)+jk*gt.jz+tw*0.3;
    b.head.rotation.x=-hunch*0.55+0.14*Math.sin(t*0.7+this.id)+jk*gt.jx+tw*0.4;
    b.head.rotation.y=(chase?0.12:0.35)*Math.sin(t*0.8+this.id*2)+jk*gt.jy;
    // ---- arms
    const tremble=Math.sin(t*23+this.id)*0.04;
    for(const s2 of ['L','R']){
      const arm=b['arm'+s2],el=b['elbow'+s2],off=gt.armOff[s2],sd=s2==='L'?1:-1;
      if(gt.deadArm===s2){                                              // limp: swings like a pendulum
        arm.rotation.x=0.12+(moving?-sw*0.3*sd:Math.sin(t*1.1+this.id)*0.05);
        arm.rotation.z=0.05*sd;el.rotation.x=-0.04;
        continue;
      }
      if(this.windup>=0){arm.rotation.x=-2.25+off*0.3;arm.rotation.z=0.25*sd;el.rotation.x=-0.5;continue;}
      if(runner&&!reach){                                               // flailing
        arm.rotation.x=-0.9+Math.sin(wph*(s2==='L'?1:-1))*0.9+off;arm.rotation.z=0.35*sd;el.rotation.x=-0.7;continue;
      }
      if(chase){
        arm.rotation.x=(reach?-1.65:-1.3)+off*0.5+sw*0.15*sd+tremble;
        arm.rotation.z=(reach?0.28:0.12)*sd;
        el.rotation.x=reach?-0.08:-0.3+off*0.3;
      }else{
        arm.rotation.x=-0.18+off*0.4+(moving?sw*0.22*sd:idle*0.04);
        arm.rotation.z=0.08*sd;
        el.rotation.x=-0.35+off*0.5;                                    // stiff, half-bent
      }
    }
  }
  /* open wounds keep running: drops fall to the floor near you */
  bleed(dt,d){
    if(!this.body.wounds||!this.body.wounds.length||d>14||this.robot)return;
    this.dripT-=dt;
    if(this.dripT>0)return;
    this.dripT=rand(0.5,1.6);
    const w=this.body.wounds[irand(0,this.body.wounds.length-1)];
    w.getWorldPosition(_dripV);
    spawnDrip(_dripV,this.f);
  }
}
let NET_SPAWN=false;   // true while a guest builds its (seeded) world or mirrors a host zombie
function spawnZombie(f,x,zz,type,room){
  if(G.mp&&!G.host&&!NET_SPAWN&&world.built){
    // a local-only zombie would be a statue nobody else sees: ask the host, who spawns the real one for everybody
    const stub={g:{position:new THREE.Vector3(x,f*CFG.FH,zz),rotation:new THREE.Euler()},f,type,state:'idle',dead:false,hit(){},die(){}};
    const r=room?{x0:room.x0,x1:room.x1,z0:room.z0,z1:room.z1}:null;
    setTimeout(()=>netSend({t:'ev',k:'zspawn',f,x:+x.toFixed(2),z:+zz.toFixed(2),ty:type,r,st:stub.state,
      ix:stub.invest?+stub.invest.x.toFixed(2):null,iz:stub.invest?+stub.invest.z.toFixed(2):null,iT:stub.investT||0}),0);
    return stub;
  }
  if(inSafeRoom(f,x,zz)){x=clamp(x,-8,14);zz=rand(-1,1);room=null;} // nothing ever appears in Ji-eun's room
  const z=new Zombie(f,x,zz,type,room||{x0:x-5,x1:x+5,z0:zz-5,z1:zz+5,door:null});
  world.zmap=world.zmap||new Map();
  world.zmap.set(z.id,z);
  return z;
}

/* ---------- survivors you find and talk to ([E]) ----------
   They never wander after you: Mr. Park lies where he fell, Ji-eun stays hidden. */
class SurvivorNPC{
  constructor(key,f,x,z,opts={}){
    this.key=key;this.f=f;this.opts=opts;
    this.lines=opts.lines;this.linesL=opts.linesL||opts.lines;
    this.talkQuest=opts.talkQuest;this.onDone=opts.onDone||null;
    this.pose=opts.pose||'stand';
    this.li=-1;this.gone=false;this.convulse=false;
    this.follow=false;this.fireT=1;this.stuckT=0;this.walkPh=0;
    this.hpMax=opts.hp||100;this.hp=this.hpMax;this.hurtT=0;this.warned=false;
    this.name=T(MD.id==='lite'?(opts.nameKeyL||opts.nameKey):opts.nameKey);
    this.parts=buildHumanoid({skin:opts.skin||0xb59a86,cloth:opts.cloth||0x3a4a5c,look:key,hair:opts.hair,pants:opts.pants});
    const g=this.parts.g;
    g.rotation.order='YXZ';
    this.yaw=opts.yaw||0;this.ph=rand(0,TAU);
    this.baseY=f*CFG.FH;
    if(this.pose==='lying'){g.rotation.x=Math.PI/2;this.baseY+=0.16;}           // on his back, head toward the arch
    if(this.pose==='sit'){                                                      // on the floor, knees up
      this.baseY-=0.72;
      this.parts.legL.rotation.x=this.parts.legR.rotation.x=1.35;
      this.parts.armL.rotation.x=this.parts.armR.rotation.x=-1.05;
      this.parts.torso.rotation.x=0.18;
    }
    if(this.parts.light)this.parts.light.visible=false;
    g.position.set(x,this.baseY,z);g.rotation.y=this.yaw;
    world.levels[f].add(g);
    // the name tag lives in the level (not the rotated body) so it always floats upright
    this.label=nameSprite(this.name,'#ffd9a0');
    world.levels[f].add(this.label);
    this.placeLabel();
    if(this.pose!=='lying')clearArea(f,x,z,1.0); // never let a desk overlap a survivor
    world.npcs.push(this);
  }
  /* the point you talk to / look at (the chest), in world space */
  center(){
    const p=this.parts.g.position;
    if(this.pose==='lying')return {x:p.x+Math.sin(this.yaw)*0.95,z:p.z+Math.cos(this.yaw)*0.95};
    return {x:p.x,z:p.z};
  }
  placeLabel(){
    const c=this.center();
    this.label.position.set(c.x,this.parts.g.position.y+(this.pose==='stand'?2.25:1.25)-(this.pose==='sit'?-0.72:0),c.z);
    if(this.bar){this.bar.position.set(c.x,this.label.position.y-0.2,c.z);this.bar.visible=this.follow&&!this.gone;}
  }
  update(dt,t){
    const g=this.parts.g;
    g.visible=this.label.visible=!this.gone;
    if(this.bar)this.bar.visible=this.follow&&!this.gone;
    if(this.gone)return;
    if(this.corpse){this.label.visible=false;return;}
    if(this.follow){
      if(!G.mp||G.host)this.followUpdate(dt,t);
      else this.placeLabel();
      return;
    }
    const br=Math.sin(t*1.6+this.ph)*0.03; // breathing
    if(this.pose==='lying'){
      g.position.y=this.baseY+(this.convulse?Math.abs(Math.sin(t*38))*0.06:0);
      this.parts.torso.scale.z=1+br*0.8;
      this.parts.head.rotation.y=this.convulse?Math.sin(t*31)*0.5:Math.sin(t*0.6)*0.25;
      this.parts.armL.rotation.x=this.convulse?Math.sin(t*25)*0.6:-0.15+br;
      this.parts.armR.rotation.x=this.convulse?Math.cos(t*23)*0.6:-0.3-br;
    }else if(this.pose==='sit'){
      this.parts.torso.rotation.x=0.18+Math.sin(t*1.1+this.ph)*0.04;   // rocking, arms around the knees
      this.parts.head.rotation.x=0.25+br;
      if(player.floor===this.f&&dist2(g.position.x,g.position.z,player.pos.x,player.pos.z)<6*6){
        const ty=Math.atan2(g.position.x-player.pos.x,g.position.z-player.pos.z);
        this.yaw+=angDiff(this.yaw,ty)*Math.min(1,dt*1.5);   // turns toward you (faces -Z at yaw 0)
        g.rotation.y=this.yaw;
      }
    }else{
      this.parts.torso.rotation.x=0.05+br*0.5;
      this.parts.armL.rotation.x=br;this.parts.armR.rotation.x=-br;
    }
  }
  canTalk(){return !this.gone&&questAt(this.talkQuest);}
  /* ---- companion health: zombies hit her; at 0 she dies (and, in Nightmare, turns) ---- */
  damage(dmg){
    if(this.gone||!this.follow||this.hp<=0)return;
    this.hp=Math.max(0,this.hp-dmg);this.hurtT=0.3;this.regenWait=4;
    play('hitMelee',{pos:this.parts.g.position,vol:.8,ref:16});
    burst(this.parts.g.position.clone().add(new THREE.Vector3(0,1.2,0)),MD.blood?0x8a0a0f:0xffd23f,8,2.2,0.06);
    this.drawBar();
    if(this.hp<this.hpMax*0.35&&!this.warned){this.warned=true;toast(T('t_jieun_hurt'));jieunBark('hurt');}
    if(this.hp<=0)jieunDies(false);
  }
  drawBar(){
    if(!this.bar){
      const c=document.createElement('canvas');c.width=128;c.height=16;
      const t=new THREE.CanvasTexture(c);
      this.bar=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));
      this.bar.scale.set(0.9,0.11,1);this.bar.userData.c=c;
      world.levels[this.f].add(this.bar);
    }
    const c=this.bar.userData.c,x=c.getContext('2d'),k=clamp(this.hp/this.hpMax,0,1);
    if(x&&x.fillRect){
      x.clearRect(0,0,128,16);x.fillStyle='rgba(0,0,0,.75)';x.fillRect(0,0,128,16);
      x.fillStyle=k>0.5?'#5fd35f':(k>0.25?'#e0b030':'#e03030');x.fillRect(2,2,124*k,12);
    }
    this.bar.material.map.needsUpdate=true;
  }
  /* ---- companion (Ji-eun after the talk): follows you floor to floor and shoots what gets close ---- */
  startFollow(){
    if(this.follow)return;
    this.follow=true;this.pose='stand';
    const p=this.parts;
    p.legL.rotation.x=p.legR.rotation.x=0;p.armL.rotation.x=p.armR.rotation.x=0;p.torso.rotation.x=0.05;
    p.g.position.y=this.f*CFG.FH;
    this.drawBar();
    if(!this.gun){ // a security-office pistol in her right hand
      this.gun=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.2,0.07),new THREE.MeshStandardMaterial({color:0x23262b,metalness:.8,roughness:.35}));
      this.gun.position.set(0,-0.1,0.02);(p.handR||p.armR).add(this.gun);   // barrel runs along the forearm
    }
  }
  setFloor(f){
    if(f===this.f)return;
    this.f=f;world.levels[f].add(this.parts.g);world.levels[f].add(this.label);
    if(this.bar)world.levels[f].add(this.bar);
  }
  /* reappear just behind the player (companions never get lost on stairs or behind doors) */
  catchUp(){
    const pf=player.floor,px=player.pos.x,pz=player.pos.z;
    const back=player.yaw;   // facing is (-sin,-cos): behind = (+sin,+cos)
    for(const d of [1.6,1.1,2.3])for(const a of [0,0.7,-0.7,1.5,-1.5]){
      const x=px+Math.sin(back+a)*d,z=pz+Math.cos(back+a)*d;
      if(!freeSpot(pf,x,z,0.3)||!losClear(px,pz,x,z,pf))continue;
      this.setFloor(pf);
      this.parts.g.position.set(x,pf*CFG.FH,z);this.stuckT=0;
      return true;
    }
    this.setFloor(pf);
    this.parts.g.position.set(px,player.pos.y,pz);this.stuckT=0;
    return false;
  }
  /* Ji-eun with you: she is her own person. She picks a spot near you (beside or behind, never in
     your way), waits there looking around, walks or runs to keep up, backs off from anything that gets
     too close while she shoots — and never lets you out of her sight for long. */
  followUpdate(dt,t){
    const g=this.parts.g,p=g.position;
    if(player.dead)return;
    const pf=player.floor;
    const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
    if(this.f!==pf||d>16||this.stuckT>2.5){this.catchUp();this.goal=null;return;}
    const weakNow0=this.hp<this.hpMax*0.6;
    // the closest thing she can see
    let seen=null,sd=9;
    for(const z of world.zombies){
      if(z.dead||z.f!==this.f||z.type==='watcher'&&WATCHER.state==='lurk')continue;
      const zd=Math.hypot(z.g.position.x-p.x,z.g.position.z-p.z);
      if(zd<sd&&(z.state==='chase'||zd<6)&&losClear(p.x,p.z,z.g.position.x,z.g.position.z,this.f)){sd=zd;seen=z;}
    }
    const seesYou=d<1.2||losClear(p.x,p.z,player.pos.x,player.pos.z,this.f);
    this.lostT=seesYou?0:(this.lostT||0)+dt;
    this.goalT=(this.goalT||0)-dt;
    let run=false;
    if(seen&&sd<2.6){                           // too close: back off (toward you) while she fires
      const ax=p.x-seen.g.position.x,az=p.z-seen.g.position.z,al=Math.hypot(ax,az)||1;
      this.goal={x:p.x+ax/al*2+(player.pos.x-p.x)*0.25,z:p.z+az/al*2+(player.pos.z-p.z)*0.25};run=true;this.goalT=0.5;
    }else if(d>7||this.lostT>1.2){              // falling behind, or lost sight of you: hurry back
      this.goal={x:player.pos.x,z:player.pos.z};run=d>4.5;this.goalT=0.3;
    }else if(!this.goal||this.goalT<=0){        // her own spot near you, then wait there
      this.goal=null;
      for(let k=0;k<10;k++){
        const a=player.yaw+rand(-1.9,1.9),r=rand(2.2,4.6);   // behind you = +sin/+cos of your yaw
        const x=player.pos.x+Math.sin(a)*r,z=player.pos.z+Math.cos(a)*r;
        if(freeSpot(pf,x,z,0.35)&&losClear(player.pos.x,player.pos.z,x,z,pf)){this.goal={x,z};break;}
      }
      this.goalT=rand(2.5,5.5);
      this.lookT=0;
    }
    let moving=false,spd=0;
    if(this.goal){
      const gx=this.goal.x-p.x,gz=this.goal.z-p.z,gd=Math.hypot(gx,gz);
      if(gd>0.3){
        spd=(run||gd>4)?(weakNow0?3.1:4.3):(weakNow0?1.5:2.1);
        let nx=p.x+gx/gd*spd*dt,nz=p.z+gz/gd*spd*dt;
        [nx,nz]=collideCircle(nx,nz,p.y,this.f,0.3);
        const moved=Math.hypot(nx-p.x,nz-p.z);
        if(moved<spd*dt*0.3){this.stuckT+=dt;if(this.stuckT>0.8&&!run)this.goal=null;}else this.stuckT=Math.max(0,this.stuckT-dt);
        const gy=groundAt(nx,nz,p.y+0.4);
        if(gy>-1e9&&gy<=p.y+0.75){p.x=nx;p.z=nz;p.y=lerp(p.y,gy,Math.min(1,dt*10));}
        this.yaw+=angDiff(this.yaw,Math.atan2(-gx,-gz))*Math.min(1,dt*8);
        moving=true;
      }else this.stuckT=0;
    }else this.stuckT=0;
    if(!moving&&!seen){                          // standing: she checks the dark around you
      this.lookT=(this.lookT||0)-dt;
      if(this.lookT<=0){this.lookT=rand(1.6,3.2);this.lookYaw=player.yaw+rand(-1.3,1.3)+(Math.random()<0.3?Math.PI:0);}
      if(this.lookYaw!==undefined)this.yaw+=angDiff(this.yaw,this.lookYaw)*Math.min(1,dt*2.5);
    }
    // she talks: short lines, rarely, never over a fight
    this.barkT=(this.barkT??rand(18,26))-dt;this.seeCd=Math.max(0,(this.seeCd||0)-dt);
    if(seen&&seen.state==='chase'&&this.seeCd<=0){this.seeCd=25;jieunBark('see');}
    else if(!seen&&this.barkT<=0){this.barkT=rand(30,48);jieunBark('calm');}
    // she patches herself up when it's quiet
    this.regenWait=Math.max(0,(this.regenWait||0)-dt);
    if(this.regenWait<=0&&this.hp<this.hpMax*0.6&&!(G.mp&&!G.host)){this.hp=Math.min(this.hpMax*0.6,this.hp+1*dt);if(Math.random()<dt*2)this.drawBar();if(this.hp>this.hpMax*0.5)this.warned=false;} // only a medkit gets her past 60 %
    const weak=this.hp<this.hpMax*0.6;
    this.parts.torso.rotation.x=weak?0.28:0.05;   // bent over, holding herself up
    // fight: short bursts at the nearest zombie she can see
    this.fireT-=dt;
    const target=seen&&sd<8?seen:null;
    if(target){
      this.yaw+=angDiff(this.yaw,Math.atan2(p.x-target.g.position.x,p.z-target.g.position.z))*Math.min(1,dt*10);
      this.parts.armR.rotation.x=-1.5;
      if(this.fireT<=0){
        const weakNow=this.hp<this.hpMax*0.6;
        this.fireT=weakNow?rand(1.8,2.6):rand(0.8,1.2);   // a scared student, not a soldier — worse when she can barely stand
        const hand=new THREE.Vector3(p.x-Math.sin(this.yaw)*0.5,p.y+1.35,p.z-Math.cos(this.yaw)*0.5);
        play('shot',{pos:hand,vol:.75,ref:22,rate:rand(1.2,1.35)});
        burst(hand,0xffd27a,4,2.4,0.04);
        emitNoise(p.x,p.z,this.f,10);
        if((!G.mp||G.host)&&Math.random()<(weakNow?0.35:0.55)){
          target.hit(1,true,'bullet');
          burst(target.g.position.clone().add(new THREE.Vector3(0,1.2*target.cfg.scale,0)),MD.blood?0x8a0a0f:0xffd23f,6,2.4,0.05);
        }
      }
    }else this.parts.armR.rotation.x=lerp(this.parts.armR.rotation.x,moving?Math.sin(this.walkPh)*0.5:0,Math.min(1,dt*6));
    g.rotation.y=this.yaw;
    if(moving){this.walkPh+=dt*(spd>3?12:7.5);const sw=Math.sin(this.walkPh)*(spd>3?0.75:0.45);this.parts.legL.rotation.x=sw;this.parts.legR.rotation.x=-sw;this.parts.armL.rotation.x=-sw*0.7;}
    else{this.parts.legL.rotation.x=this.parts.legR.rotation.x=0;}
    this.placeLabel();
  }
  talk(){
    if(this.gone)return;
    if(!questAt(this.talkQuest)){notYet();return;}
    const lines=MD.id==='lite'?this.linesL:this.lines;
    const last=this.li>=lines.length-1;
    if(!last)this.li++;
    showSub('<b>'+esc(this.name)+':</b> '+T(lines[this.li]),7,true); // they speak in person — no radio static
    if(this.key==='jieun'){suspectShow();suspectClue(this.li+1);}
    play('paper',{vol:.25,rate:1.6});
    if(!last&&this.li===lines.length-1&&this.onDone)this.onDone();
  }
}
function npcByKey(k){return world.npcs.find(n=>n.key===k);}
/* ---- the suspicion: a big warning when you find her, then one clue per line she says ---- */
const SUS_LEVEL=[35,50,65,85,70];   // the last clue pulls it DOWN: her eyes are clear
function suspectShow(){
  const el=$('suspect');
  if(!el||G.flags.jieunTalked||jieunResolved||el.style.display==='block')return;
  const lite=MD.id==='lite';
  $('susH').textContent=T(lite?'sus_hl':'sus_h');
  $('susWho').textContent=T(lite?'sus_whol':'sus_who');
  $('susTell').innerHTML=T(lite?'sus_telll':'sus_tell');
  $('susMeterLbl').textContent=T('sus_meter');
  $('susClues').innerHTML='';
  el.style.display='block';el.classList.add('big');
  suspectClue(0);
  warnFx();
  if(MD.jumpscares)play('stinger',{vol:.45,force:true});
  G.jTension=1;
  clearTimeout(suspectShow.t);suspectShow.t=setTimeout(()=>el.classList.remove('big'),4500);
}
function suspectClue(i){
  const el=$('suspect'),ul=$('susClues');
  if(!el||el.style.display!=='block'||i>4||!ul||ul.children.length>i)return;
  const lite=MD.id==='lite';
  while(ul.children.length<=i){
    const k=ul.children.length,li=document.createElement('li');
    li.innerHTML=T('sus_c'+k+(lite?'l':''));if(k===4)li.className='good';
    ul.appendChild(li);
  }
  ul.children[ul.children.length-1].classList.add('new');
  $('susFill').style.width=SUS_LEVEL[i]+'%';
  if(i>0)play('alert',{vol:.28,rate:.9,force:true});
}
function suspectHide(){const el=$('suspect');if(el){el.style.display='none';el.classList.remove('big');}G.jTension=0;}
/* after the choice: the truth, big and in the middle of the screen */
function showVerdict(kind){
  const el=$('verdict');if(!el)return;
  const lite=MD.id==='lite',k={trust:'trust',kill:'kill',timeout:'time'}[kind];
  $('vdH').textContent=T(k==='kill'&&lite?'vd_kill_hl':'vd_'+k+'_h');
  $('vdP').innerHTML=T('vd_'+k+(lite&&k!=='time'?'_l':''));
  $('vdCard').innerHTML=T('vd_card');
  el.className='v-'+k;el.style.display='flex';
  if(k==='trust')play('win',{vol:.4,force:true});else if(k==='kill')play('stinger',{vol:.8,force:true});
  clearTimeout(showVerdict.t);showVerdict.t=setTimeout(()=>{el.style.display='none';},k==='time'?3600:5600);
}
/* Ji-eun speaks while she's with you: fear, guilt, gratitude — a person, not a turret */
const JBARK={calm:['jb_1','jb_2','jb_3','jb_4','jb_5'],see:['jb_see'],hurt:['jb_hurt'],med:['jb_med']};
function jieunBark(kind){
  const je=companion();if(!je)return;
  const lite=MD.id==='lite';
  let key;
  if(kind==='calm'){je.barkI=(je.barkI||0);if(je.barkI>=JBARK.calm.length)return;key=JBARK.calm[je.barkI++];}
  else key=JBARK[kind][0];
  if(lite)key=key.replace('jb_','jbl_');
  if(!I18N.en[key])return;
  showSub('<b>'+esc(je.name)+':</b> '+T(key),4.5);
}
/* Ji-eun while she is with you and alive (zombies can target her) */
/* ---- the choice: 7 seconds, two buttons, the building closing in ---- */
const CHOICE_TIME=7;
let choiceSt=null,jieunResolved=false;
function startJieunChoice(){
  if(G.flags.jieunTalked||choiceSt||jieunResolved)return;
  const lite=MD.id==='lite';
  choiceSt={t:CHOICE_TIME,tick:0,breath:0};
  G.uiLock='choice';
  if(document.exitPointerLock)document.exitPointerLock();   // free the mouse for the buttons
  $('choiceWarn').textContent=T('ch_warn');
  $('choiceQ').textContent=T(lite?'ch_q_l':'ch_q');
  $('choiceTrust').innerHTML='<b>'+esc(T('ch_trust'))+'</b><span>'+esc(T('ch_trust_d'))+'</span>';
  $('choiceKill').innerHTML='<b>'+esc(T(lite?'ch_kill_l':'ch_kill'))+'</b><span>'+esc(T(lite?'ch_kill_dl':'ch_kill_d'))+'</span>';
  $('choice').style.display='flex';
  updateChoiceUI();
  warnFx();
  markDanger(5,14);
  if(MD.jumpscares)play('stinger',{vol:.5,force:true});
}
function updateChoiceUI(){
  if(!choiceSt)return;
  $('choiceTime').textContent=Math.ceil(choiceSt.t)+'s';
  $('choiceFill').style.width=Math.max(0,choiceSt.t/CHOICE_TIME*100).toFixed(1)+'%';
}
function updateChoice(dt){
  if(!choiceSt)return;
  choiceSt.t-=dt;
  // every second: a short alert; underneath it, fast frightened breathing
  const sec=Math.ceil(choiceSt.t);
  if(sec!==choiceSt.tick){choiceSt.tick=sec;play('alert',{vol:sec<=3?.6:.35,rate:sec<=3?1.15:1,force:true});}
  choiceSt.breath-=dt;
  if(choiceSt.breath<=0){choiceSt.breath=0.75;play('breath',{vol:.55,rate:1.35,force:true});}
  choiceSt.heart=(choiceSt.heart||0)-dt;   // the heartbeat speeds up as the clock runs out
  if(choiceSt.heart<=0){choiceSt.heart=lerp(0.3,0.58,choiceSt.t/CHOICE_TIME);play('heart',{vol:1,rate:1.3,force:true});AUD.heartT=1;}
  AUD.threat=Math.max(AUD.threat||0,1);
  updateChoiceUI();
  if(choiceSt.t<=0)resolveJieun('timeout');
}
function resolveJieun(kind,remote){
  if(jieunResolved)return;
  jieunResolved=true;
  const lite=MD.id==='lite';
  choiceSt=null;
  $('choice').style.display='none';
  suspectHide();showVerdict(kind);
  if(G.uiLock==='choice'){G.uiLock=null;ePrev=true;if(!NOLOCK)lockPointer();}
  const flag={trust:'jieunTrusted',kill:'jieunKilled',timeout:'jieunTimeout'}[kind];
  G.flags[flag]=true;G.flags.jieunTalked=true;
  if(!remote){netFlag(flag);netFlag('jieunTalked');}
  const je=npcByKey('jieun');
  spawnJieunCard();
  if(kind==='kill'){
    killJieun(false);
  }else{
    if(je){je.startFollow();je.hp=Math.min(je.hp,45);je.drawBar();}
    if(kind==='timeout'){
      toast(T('jieun_timeout'));
      showSub(T('jieun_timeout_sub'),3.5,true);
      G.flags.safeBreached=true;
      player.shakeT=Math.max(player.shakeT,0.5);
      if(!G.mp||G.host){ // they come through the door
        const d=world.doors.find(dd=>dd.safe);
        if(d&&!d.open)d.setOpen(true,false);
        const dp=d?doorPoint(d):{x:-20,z:-1.6};
        for(let i=0;i<4;i++){
          const z=spawnZombie(5,dp.x+rand(-2.5,2.5),rand(-0.6,0.9),i===0?'runner':'shambler',null);
          z.state='chase';z.loseT=0;
        }
        play('zroar',{vol:1.1,force:true});
      }
    }else{
      showSub(T('jieun_trusted'),4.5,true);
    }
    setTimeout(()=>toast(T(kind==='trust'?'t_jieun_join':'t_jieun_join')),1200);
    setTimeout(()=>toast(T('t_jieun_weak')),3400);
  }
  questCheck();
}
/* you chose to end it: she falls where she sits — and only then do you see the truth */
function killJieun(quiet){
  const je=npcByKey('jieun');
  if(!je)return;
  G.flags.jieunDead=true;
  je.hp=0;je.follow=false;je.corpse=true;
  if(je.bar)je.bar.visible=false;
  if(MD.id==='lite'){je.gone=true;if(!quiet)showSub(T('jieun_killed_l'),5,true);return;}
  const p=je.parts;
  p.g.rotation.order='YXZ';p.g.rotation.x=Math.PI/2;je.baseY=je.f*CFG.FH+0.16;p.g.position.y=je.baseY;
  p.legL.rotation.x=p.legR.rotation.x=0;p.armL.rotation.x=0.2;p.armR.rotation.x=-0.3;p.torso.rotation.x=0;
  je.pose='lying';je.convulse=false;je.label.visible=false;
  if(quiet)return;
  const c=je.center();
  decal(je.f,c.x,c.z,0.7,MAT.bloodPool);
  const armed=player.weapon==='pistol'&&INV.ammo>0;
  if(armed){INV.ammo--;hudInv();play('shot',{vol:1});}else play('hitMelee',{vol:1});
  burst(new THREE.Vector3(c.x,je.f*CFG.FH+0.5,c.z),0x8a0a0f,16,2.6,0.07);
  player.shakeT=Math.max(player.shakeT,0.3);
  setTimeout(()=>showSub(T('jieun_killed'),6,true),1400);
}
/* a medkit for Ji-eun */
function giveJieunMedkit(){
  const je=companion();
  if(!je||INV.medkit<=0)return;
  if(Math.hypot(je.parts.g.position.x-player.pos.x,je.parts.g.position.z-player.pos.z)>2.6||je.f!==player.floor){toast(T('t_givemed_far'));return;}
  INV.medkit--;hudInv();
  netTell({t:'ev',k:'jmed',n:G.myName});   // the host heals her; everyone's bar follows the host's
  je.hp=Math.min(je.hpMax,je.hp+80);je.medAt=performance.now();je.drawBar();
  play('paper',{vol:.8});toast(T('t_gavemed'));
  setTimeout(()=>jieunBark('med'),900);
}
function updateGiveMedBtn(){
  const b=$('giveMed');if(!b)return;
  const je=companion();
  const show=!!je&&je.hp<je.hpMax-10&&INV.medkit>0&&G.mode==='playing'&&!player.dead;
  if(b._show!==show){b._show=show;b.style.display=show?'block':'none';if(show)b.textContent=T('btn_givemed');}
}
function companion(){
  const je=npcByKey('jieun');
  return (je&&je.follow&&!je.gone&&je.hp>0&&!G.flags.jieunDead)?je:null;
}
/* Ji-eun dies: in Nightmare she rises as a zombie a few seconds later; in Daylight she just heads back */
function jieunDies(quiet,remote){
  const je=npcByKey('jieun');
  if(!je||G.flags.jieunDead)return;
  G.flags.jieunDead=true;
  if(!quiet&&!remote)netFlag('jieunDead');
  je.hp=0;je.follow=false;
  if(je.bar)je.bar.visible=false;
  if(MD.id==='lite'){je.gone=true;if(!quiet)toast(T('jieun_out_l'));return;}
  if(quiet){je.gone=true;return;}
  // she drops, twitches, then gets up
  const p=je.parts;
  p.g.rotation.order='YXZ';p.g.rotation.x=Math.PI/2;je.baseY=je.f*CFG.FH+0.16;p.g.position.y=je.baseY;
  je.pose='lying';je.convulse=true;
  showSub(T('jieun_dying'),4,true);
  play('pscream',{pos:p.g.position,vol:.8,ref:20,rate:1.25});
  setTimeout(()=>{
    if(!world.built||je.gone)return;
    je.gone=true;
    if(G.mp&&!G.host)return;
    const q=p.g.position;
    const z=spawnZombie(je.f,q.x,q.z,'jieun',{x0:-23,x1:15.8,z0:-1.6,z1:1.6,door:null});
    z.yaw=je.yaw;z.g.rotation.y=z.yaw;z.riseT=z.riseDur=1.6;z.g.rotation.x=Math.PI/2;
    play('zroar',{pos:z.g.position,vol:1.1,ref:30,rate:1.15});
    player.shakeT=Math.max(player.shakeT,0.4);
    showSub(T('jieun_turn'),3.5,true);
  },4000);
}
/* after the talk: Park's blue card (and his medkit) lie beside his hand */
function spawnParkItems(){
  const npc=npcByKey('park');if(!npc)return;
  const p=npc.parts.g.position,y=3*CFG.FH;
  const mk=(type,x,z,id)=>{
    if(world.items.find(i=>i.id===id))return;
    const it=new Pickup(type,3,x,y+(type==='medkit'?0.08:0.03),z,{id});
    if(G.taken.has(id)){it.taken=true;it.g.visible=false;}
  };
  mk('card-blue',p.x+0.9,p.z-0.62,'story-card-blue');
  mk('medkit',p.x+0.2,p.z-0.75,'park-medkit');
}
function spawnJieunCard(){
  const npc=npcByKey('jieun');if(!npc)return;
  const p=npc.parts.g.position,id='story-card-yellow';
  if(world.items.find(i=>i.id===id))return;
  const it=new Pickup('card-yellow',5,p.x+0.75,5*CFG.FH+0.03,p.z+0.55,{id});
  if(G.taken.has(id)){it.taken=true;it.g.visible=false;}
}
/* taking the card is the last thing Mr. Park waits for */
function parkTurn(){
  if(G.flags.parkTurned)return;
  G.flags.parkTurned=true;netFlag('parkTurned');
  const npc=npcByKey('park');
  if(!npc)return;
  const lite=MD.id==='lite';
  showSub('<b>'+esc(npc.name)+':</b> '+T(lite?'park_run_l':'park_run'),4.2,true);
  npc.convulse=true;
  markDanger(3,40);
  if(MD.jumpscares)play('breath',{vol:.8,rate:0.7});
  setTimeout(()=>{
    if(!G.started||npc.gone)return;
    if(!G.mp||G.host)spawnParkZombie(false);
    else npc.gone=true;          // co-op guests: the host's zombie arrives in the next snapshot
  },4200);
}
function spawnParkZombie(quiet){
  const npc=npcByKey('park');
  if(!npc||world.parkZ&&!world.parkZ.dead)return;
  npc.gone=true;
  const p=npc.parts.g.position;
  const z=spawnZombie(3,p.x,p.z,'park',{x0:3,x1:15.8,z0:-1.6,z1:1.6,door:null});
  z.yaw=npc.yaw;z.g.rotation.y=z.yaw;
  z.riseT=z.riseDur=quiet?0.6:1.6;
  z.g.rotation.x=Math.PI/2;
  world.parkZ=z;
  if(quiet)return;
  play('zroar',{pos:z.g.position,vol:1.2,ref:30});
  player.shakeT=Math.max(player.shakeT,0.5);
  showSub(T(MD.id==='lite'?'park_turn_l':'park_turn'),3.5,true);
  if(MD.jumpscares)play('stinger',{vol:.8});
}
function dealZombieDamage(z){
  // choose damaged human (local player or remotes — host authoritative)
  const dmg=z.cfg.dmg*MD.zDmg*(z.f===CFG.FLOORS&&G.flags.finale?ROOF.DMG:1);
  if(!G.mp||G.host){
    const hum=z.nearestHuman();
    const je=companion();
    if(je&&hum&&hum.p==='jieun'){ // it went for Ji-eun
      if(je.f===z.f&&je.parts.g.position.distanceTo(z.g.position)<1.8*z.cfg.scale)je.damage(dmg);
    }else if(player.pos.distanceTo(z.g.position)<1.8*z.cfg.scale&&!player.dead&&!player.down){
      damagePlayer(dmg,z.g.position);
    }
    if(G.mp)for(const r of net.remotes.values()){
      if(r.down||r.dead||r.spec||(r.f||0)!==z.f)continue;
      if(dist2(r.x,r.z,z.g.position.x,z.g.position.z)<(1.8*z.cfg.scale)**2){
        netBroadcast({t:'ev',k:'hit',id:r.id,dmg});
      }
    }
  }
  play('growl2',{pos:z.g.position,vol:1,ref:16});
}
function damagePlayer(dmg,srcPos){
  if(player.dead||player.down||player.invulnT>0)return;
  player.hp-=dmg;player.dmgFlash=1;player.shakeT=0.35;
  player.invulnT=0.8;   // brief safety window after every hit
  play('hurt',{vol:1});
  if(srcPos){
    const dx=player.pos.x-srcPos.x,dz=player.pos.z-srcPos.z,dl=Math.hypot(dx,dz)||1;
    const bx=player.pos.x,bz=player.pos.z;
    let nx=bx+dx/dl*0.35,nz=bz+dz/dl*0.35;
    [nx,nz]=collideCircle(nx,nz,player.pos.y,player.floor); // knockback respects walls
    if(Math.hypot(nx-bx,nz-bz)>0.5){nx=bx;nz=bz;} // reject through-wall ejections outright
    player.pos.x=nx;player.pos.z=nz;
  }
  if(player.hp<=0){
    player.hp=0;
    if(G.mp){onPlayerDown();} // co-op: downed state, friends can revive
    else{(typeof G.lives==='number'&&G.lives>0)?onPlayerDeath():gameOver();} // solo: no crawl wait — straight to respawn / game over
  }
  hudStats();
}

/* ---------- player down / death / respawn ---------- */
const REVIVES_MAX=3;
/* co-op: out of revives (or nobody came) — you turn. Your friends must put you down; you watch through their eyes. */
function playerTurns(){
  if(player.spec)return;
  player.down=false;player.dead=true;player.spec=true;G.turned=true;player.hp=0;
  $('downedOv').style.display='none';$('death').style.display='none';
  play('pscream',{vol:1});if(MD.jumpscares)play('stinger',{vol:.9});
  const p=player.pos;
  netTell({t:'ev',k:'turned',id:G.myId,n:G.myName,x:+p.x.toFixed(2),z:+p.z.toFixed(2),f:player.floor});
  if(G.host)spawnTurned(G.myId,G.myName,p.x,p.z,player.floor);
  startSpectate();
  checkWipe();
}
function spawnTurned(id,name,x,z,f){
  const zb=spawnZombie(f,x,z,'turned',{x0:x-6,x1:x+6,z0:z-6,z1:z+6,door:null});
  zb.riseT=zb.riseDur=1.8;zb.g.rotation.x=Math.PI/2;
  tagTurned(zb,name);
  (G.ztags=G.ztags||{})[zb.id]=name;
  if(G.mp)netBroadcast({t:'ev',k:'ztag',id:zb.id,n:name});
}
function tagTurned(z,name){
  if(z.tagged)return;z.tagged=true;
  const tag=nameSprite(T('turned_tag',{n:name}),'#ff6b6b');tag.position.y=2.2;z.g.add(tag);
}
function checkWipe(){
  if(!G.mp||!G.host)return;
  const alive=(player.spec?0:1)+[...net.remotes.values()].filter(r=>!r.spec).length;
  if(alive===0){netBroadcast({t:'ev',k:'wipe'});squadWiped();}
}
function squadWiped(){
  stopSpectate();
  player.dead=true;
  $('death').style.display='flex';
  $('death').querySelector('h1').textContent=T('wipe_h');
  $('deathTxt').textContent=T('wipe_p');
  $('respawnTxt').textContent='';
  $('btnRespawn').classList.add('hidden');
  $('btnDeathMenu').classList.remove('hidden');
  document.exitPointerLock&&document.exitPointerLock();
}
/* ---- spectator: watch the game through a living friend's eyes ---- */
function specTargets(){return [...net.remotes.values()].filter(r=>!r.spec&&!r.dead);}
function startSpectate(){
  G.specI=0;
  document.exitPointerLock&&document.exitPointerLock();
  if(vm)vm.visible=false;
  try{document.body.classList.add('spec');}catch(_){}
  $('spectate').style.display='flex';
  $('specH').textContent=T('spec_h');
  $('specPrev').textContent=T('spec_prev');$('specNext').textContent=T('spec_next');$('specQuit').textContent=T('spec_quit');
  specLabel();
}
function stopSpectate(){$('spectate').style.display='none';try{document.body.classList.remove('spec');}catch(_){}}
function specCycle(d){const L=specTargets();if(!L.length)return;G.specI=((G.specI||0)+d+L.length)%L.length;specLabel();play('click',{vol:.4});}
function specLabel(){
  const L=specTargets(),r=L.length?L[(G.specI||0)%L.length]:null;
  G.specId=r?r.id:null;
  $('specWho').textContent=r?T('spec_watch',{n:r.name||'?'}):T('spec_none');
}
function updateSpectate(dt){
  const L=specTargets();
  const r=L.length?L[(G.specI||0)%L.length]:null;
  if(!r){if(G.specId!==null)specLabel();return;}
  if(G.specId!==r.id)specLabel();
  const s=remoteAt(r);
  player.pos.set(s.x,s.y,s.z);                      // (drives which floors render, the flashlight, audio)
  const f=clamp(r.f||0,0,CFG.FLOORS);
  if(player.floor!==f){player.floor=f;for(let i=0;i<world.levels.length;i++)world.levels[i].visible=(Math.abs(i-f)<=1);}
  camera.position.set(s.x,s.y+1.62,s.z);
  camera.rotation.set(r.p||0,s.yaw,0,'YXZ');
  if(spot)spot.intensity=(r.fl&1)?60:0;   // their flashlight, as they see it
}
/* ---- give items to a friend next to you: [B] ---- */
function nearFriend(){
  let best=null,bd=3.2;
  for(const r of net.remotes.values()){
    if(r.spec||r.dead||(r.f||0)!==player.floor)continue;
    const d=Math.hypot(r.x-player.pos.x,r.z-player.pos.z);
    if(d<bd&&losClear(player.pos.x,player.pos.z,r.x,r.z,player.floor)){bd=d;best=r;}
  }
  return best;
}
const GIVE_ITEMS=[
  {k:'medkit',ok:()=>INV.medkit>0,take:()=>{INV.medkit--;},lbl:'gv_medkit'},
  {k:'ammo',ok:()=>INV.ammo>0,take:()=>{const n=Math.min(20,INV.ammo);INV.ammo-=n;return n;},lbl:'gv_ammo'},
  {k:'pistol',ok:()=>INV.pistol,take:()=>{INV.pistol=false;if(player.weapon==='pistol')player.weapon='melee';},lbl:'gv_pistol'},
  {k:'battery',ok:()=>player.battery>=30,take:()=>{player.battery-=30;INV.battery=player.battery;},lbl:'gv_battery'},
  {k:'flare',ok:()=>INV.flare>0,take:()=>{INV.flare--;},lbl:'gv_flare'},
];
function openGive(){
  if(!G.mp||player.dead||player.down)return;
  const r=nearFriend();
  if(!r){toast(T('t_give_none'));return;}
  G.giveTo=r.id;G.uiLock='give';
  document.exitPointerLock&&document.exitPointerLock();
  $('giveH').textContent=T('gv_h',{n:r.name||'?'});
  const box=$('giveBtns');box.innerHTML='';
  GIVE_ITEMS.forEach((it,i)=>{
    const b=document.createElement('button');b.className='gbtn';b.disabled=!it.ok();
    b.innerHTML='<b>['+(i+1)+']</b> '+T(it.lbl);b.onclick=()=>giveItem(i);box.appendChild(b);
  });
  $('giveClose').textContent=T('gv_close');
  $('give').style.display='flex';
}
function closeGive(){$('give').style.display='none';if(G.uiLock==='give'){G.uiLock=null;if(!NOLOCK)lockPointer();}}
function giveItem(i){
  const it=GIVE_ITEMS[i],r=net.remotes.get(G.giveTo);
  if(!it||!r||!it.ok())return;
  const amt=it.take()||0;
  netTell({t:'ev',k:'give',to:r.id,item:it.k,amt,n:G.myName});
  toast(T('t_gave',{i:T(it.lbl),n:esc(r.name||'?')}));play('paper',{vol:.7});
  hudInv();hudStats();closeGive();
}
function receiveGift(d){
  if(d.item==='medkit')INV.medkit++;
  else if(d.item==='ammo')INV.ammo+=d.amt||20;
  else if(d.item==='pistol'){INV.pistol=true;INV.ammo+=4;player.weapon='pistol';}
  else if(d.item==='battery'){player.battery=Math.min(100,player.battery+30);INV.battery=player.battery;INV.flashlight=true;}
  else if(d.item==='flare')INV.flare++;
  toast(T('t_gotgift',{n:esc(d.n||'?'),i:T('gv_'+d.item)}));play('pickup',{vol:.9});
  hudInv();hudStats();
}
/* ---- voice chat: mic → 8 kHz µ-law chunks over the same connection (direct OR relay) ---- */
const VOICE={on:false,spk:true,stream:null,src:null,proc:null,pcm:[],frac:0,hang:0,peers:new Map(),talk:0};
function muEnc(x){const B=0x84,C=32635;let s=Math.max(-1,Math.min(1,x))*32767|0;const sign=(s>>8)&0x80;if(sign)s=-s;if(s>C)s=C;s+=B;let e=7;for(let m=0x4000;(s&m)===0&&e>0;e--,m>>=1);const man=(s>>(e+3))&0x0F;return ~(sign|(e<<4)|man)&0xFF;}
function muDec(u){u=~u&0xFF;const sign=u&0x80,e=(u>>4)&7,man=u&0x0F;let s=((man<<3)+0x84)<<e;s-=0x84;return (sign?-s:s)/32768;}
async function micToggle(){
  if(!G.mp)return;
  if(VOICE.on){
    try{VOICE.stream.getTracks().forEach(t=>t.stop());VOICE.src.disconnect();VOICE.proc.disconnect();}catch(_){}
    VOICE.on=false;voiceUI();toast(T('t_mic_off'));return;
  }
  ensureAudio();const ctx=AUD.ctx;
  if(!ctx||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast(T('t_mic_na'));return;}
  try{VOICE.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
  catch(_){toast(T('t_mic_denied'));return;}
  VOICE.src=ctx.createMediaStreamSource(VOICE.stream);
  VOICE.proc=ctx.createScriptProcessor(2048,1,1);
  const ratio=ctx.sampleRate/8000;
  VOICE.proc.onaudioprocess=e=>{
    const inp=e.inputBuffer.getChannelData(0);
    let s=0;for(let i=0;i<inp.length;i+=4)s+=inp[i]*inp[i];
    const rms=Math.sqrt(s/(inp.length/4));
    VOICE.hang=rms>0.012?0.4:VOICE.hang-inp.length/ctx.sampleRate;   // noise gate with a short tail
    let t=VOICE.frac;
    for(;t<inp.length;t+=ratio){let a=0,n=0;const e2=Math.min(inp.length,Math.floor(t+ratio));for(let k=Math.floor(t);k<e2;k++){a+=inp[k];n++;}VOICE.pcm.push(n?a/n:0);}
    VOICE.frac=t-inp.length;
    while(VOICE.pcm.length>=640){const ch=VOICE.pcm.splice(0,640);if(VOICE.hang>0)sendVoice(ch);}
  };
  const mute=ctx.createGain();mute.gain.value=0;
  VOICE.src.connect(VOICE.proc);VOICE.proc.connect(mute);mute.connect(ctx.destination);
  VOICE.on=true;voiceUI();toast(T('t_mic_on'));
}
function sendVoice(f32){
  const u=new Uint8Array(f32.length);for(let i=0;i<f32.length;i++)u[i]=muEnc(f32[i]*1.6);
  let bin='';for(let i=0;i<u.length;i++)bin+=String.fromCharCode(u[i]);
  const m={t:'vo',id:G.myId,d:btoa(bin)};
  if(G.host)netBroadcast(m);else netSend(m);
  VOICE.talk=performance.now();
}
function playVoice(id,b64){
  const st=VOICE.peers.get(id)||{next:0,last:0};VOICE.peers.set(id,st);st.last=performance.now();
  const ctx=AUD.ctx;if(!VOICE.spk||!ctx)return;
  let bin;try{bin=atob(b64);}catch(_){return;}
  const buf=ctx.createBuffer(1,bin.length,8000),ch=buf.getChannelData(0);
  for(let i=0;i<bin.length;i++)ch[i]=muDec(bin.charCodeAt(i));
  const src=ctx.createBufferSource();src.buffer=buf;
  const g=ctx.createGain();g.gain.value=1.3;src.connect(g);g.connect(ctx.destination);
  const now=ctx.currentTime;
  if(st.next<now+0.05||st.next>now+0.6)st.next=now+0.12;   // keep the delay short: drop what's too late
  src.start(st.next);st.next+=buf.duration;
}
function spkToggle(){VOICE.spk=!VOICE.spk;voiceUI();toast(T(VOICE.spk?'t_spk_on':'t_spk_off'));}
function voiceUI(){
  const el=$('voice');if(!el)return;
  el.style.display=G.mp&&G.started?'flex':'none';
  $('vMic').className='vbtn'+(VOICE.on?' on':'');$('vMic').innerHTML=(VOICE.on?'🎤':'🎙️')+' <b>[M]</b> '+T(VOICE.on?'v_mic_on':'v_mic_off');
  $('vSpk').className='vbtn'+(VOICE.spk?' on':'');$('vSpk').innerHTML=(VOICE.spk?'🔊':'🔇')+' <b>[N]</b> '+T(VOICE.spk?'v_spk_on':'v_spk_off');
}
function voiceTick(){
  const el=$('vWho');if(!el||!G.mp)return;
  const now=performance.now(),names=[];
  if(VOICE.on&&now-VOICE.talk<350)names.push(G.myName);
  for(const [id,st] of VOICE.peers){if(now-st.last<400){const r=net.remotes.get(id);names.push(r?r.name:(id==='H'?'Host':id));}}
  const t=names.length?'🗣 '+names.map(esc).join(', '):'';
  if(el._t!==t){el._t=t;el.innerHTML=t;}
  const gh=$('giveHint');
  if(gh){const r=(!player.spec&&!player.down&&!G.uiLock)?nearFriend():null;const s=r?T('gv_hint',{n:esc(r.name||'?')}):'';if(gh._t!==s){gh._t=s;gh.innerHTML=s;gh.style.display=s?'block':'none';}}
}
function downText(){
  if(G.helpMode)return T('down_help')+' ('+Math.ceil(player.bleedT)+'s)';
  const base=MD.id==='lite'?(G.mp?T('down_mp_l'):T('down_sp_l')):(G.mp?T('down_mp'):T('down_sp'));
  return base+' ('+Math.ceil(player.bleedT)+'s)'+(G.mp?' · '+T('down_revleft',{n:REVIVES_MAX-(G.revUsed||0)}):'');
}
function onPlayerDown(){
  if(G.mp&&(G.revUsed||0)>=REVIVES_MAX){playerTurns();return;}   // no one can bring you back a 4th time
  player.down=true;player.bleedT=60;
  G.stats.deaths++;hudStats();
  $('downedOv').style.display='flex';
  $('downedOv').querySelector('h2').textContent=MD.id==='lite'?T('down_hl'):T('down_h');
  $('downedTxt').textContent=downText();
  play('pscream',{vol:1});
  if(G.mp)netSend({t:'ev',k:'down',id:G.myId});
  if(G.host&&G.mp)netBroadcast({t:'ev',k:'down',id:G.myId});
}
function reviveLocal(){
  player.down=false;player.hp=50;player.bleedT=0;G.helpMode=false;   // back at HALF health: find a medkit
  G.revUsed=(G.revUsed||0)+1;
  $('downedOv').style.display='none';
  toast(T('t_up'));
  if(G.mp)setTimeout(()=>toast(T(G.revUsed>=REVIVES_MAX?'t_rev_last':'t_rev_left',{n:REVIVES_MAX-G.revUsed})),900);
  play('pickup',{vol:1});
  if(G.mp)netSend({t:'ev',k:'revive',id:G.myId});
  if(G.host&&G.mp)netBroadcast({t:'ev',k:'revive',id:G.myId});
}
function onPlayerDeath(){
  player.down=false;
  $('downedOv').style.display='none';
  if(typeof G.lives==='number'&&G.lives>0){
    // retries left: the RESPAWN button is live IMMEDIATELY — no waiting
    G.lives--;
    G.respawnPending=true;
    player.dead=true;
    $('death').style.display='flex';
    $('death').querySelector('h1').textContent=MD.id==='lite'?T('death_l'):T('death_h');
    $('deathTxt').textContent=MD.id==='lite'?T('death_pl'):T('death_p');
    $('respawnTxt').textContent=G.lives>0?T('death_left',{n:G.lives}):T('death_last');
    $('btnRespawn').classList.remove('hidden');
    $('btnRespawn').textContent=T('btn_respawn');
    $('btnDeathMenu').classList.add('hidden');
    // pointer stays locked — one click and you're back in the fight
  }else{
    // out of retries: HELP-TO-RESPAWN mode — only a friend can pick you up now
    player.dead=false;player.down=true;player.bleedT=G.mp?45:12;
    G.helpMode=true;
    $('downedOv').style.display='flex';
    $('downedOv').querySelector('h2').textContent=MD.id==='lite'?T('down_hl'):T('down_h');
    $('downedTxt').textContent=downText();
    play('pscream',{vol:1});
  }
  if(player.dead)play('stinger',{vol:.9});
  if(G.mp)netSend({t:'ev',k:player.dead?'dead':'down',id:G.myId});
  if(G.host&&G.mp)netBroadcast({t:'ev',k:player.dead?'dead':'down',id:G.myId});
}
function gameOver(){
  // nobody came to help: the run ends, restart from the very beginning
  player.down=false;player.dead=true;G.helpMode=false;G.respawnPending=false;
  clearSave();
  $('downedOv').style.display='none';
  $('death').style.display='flex';
  $('death').querySelector('h1').textContent=MD.id==='lite'?T('death_l'):T('death_h');
  $('deathTxt').textContent=T('death_out');
  $('respawnTxt').textContent=T('death_restart');
  $('btnRespawn').classList.add('hidden');
  $('btnDeathMenu').classList.remove('hidden');
  document.exitPointerLock&&document.exitPointerLock();
  play('stinger',{vol:1});
}
function respawnPlayer(){
  player.dead=false;player.hp=60;player.battery=Math.max(25,player.battery*0.7);
  player.invulnT=3;G.respawnPending=false;
  const f=CHECK.floor;
  player.pos.set(15,f*CFG.FH+0.1,0);player.vy=0;
  $('death').style.display='none';
  const fd=$('fade');fd.style.opacity='1';setTimeout(()=>{fd.style.opacity='0';},200);
  toast(T('t_respawn'));
  emitNoise(15,0,f,14);
  lockPointer();
  hudStats();
}

/* ---------- player update ---------- */
const flares=[];
function throwFlare(){
  if(INV.flare<=0){toast(T('t_noflare'));return;}
  INV.flare--;hudInv();
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  const g=new THREE.Group();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.035,0.24,8),MAT.flare);
  g.add(m);
  const li=takeFlareLight(); // pooled: stays in the scene, position follows the flare
  g.position.copy(camera.position).add(dir.clone().multiplyScalar(0.5));
  scene.add(g);
  flares.push({g,li,f:player.floor,vx:dir.x*7.5,vy:dir.y*7.5+2.4,vz:dir.z*7.5,life:16,fizzT:0.4,bounced:false});
  play('click',{vol:.6});
  emitNoise(player.pos.x,player.pos.z,player.floor,4);
  if(G.mp&&!G.host)netSend({t:'ev',k:'flare',x:g.position.x,y:g.position.y,z:g.position.z,f:player.floor});
  if(G.host&&G.mp)netBroadcast({t:'ev',k:'flare',x:g.position.x,y:g.position.y,z:g.position.z,f:player.floor});
}
/* flare lights come from a fixed pool (see startWorld): adding/removing scene lights mid-run
   changes the renderer's light counts and recompiles every material's shader */
function takeFlareLight(){
  if(!world.flareLights||!world.flareLights.length)return null;
  return world.flareLights[world.flareLightI++%world.flareLights.length];
}
function updateFlares(dt,t){
  for(let i=flares.length-1;i>=0;i--){
    const fl=flares[i];
    fl.life-=dt;
    if(fl.life<=0){if(fl.li)fl.li.intensity=0;scene.remove(fl.g);flares.splice(i,1);continue;}
    if(fl.li){fl.li.position.copy(fl.g.position);
      if(fl.life<3&&Math.floor(fl.life*6)%2===0)fl.li.intensity=6;else fl.li.intensity=22+Math.sin(t*30+fl.g.position.x)*8;}
    if(fl.vy!==0||fl.vx!==0){
      fl.vy+=CFG.GRAV*dt*0.7;
      const nx=fl.g.position.x+fl.vx*dt,ny=fl.g.position.y+fl.vy*dt,nz=fl.g.position.z+fl.vz*dt;
      const g=groundAt(nx,nz,ny+0.5);
      if(ny<=g+0.06){
        fl.g.position.y=g+0.06;
        if(!fl.bounced&&Math.abs(fl.vy)>1){fl.bounced=true;fl.vy*=-0.25;fl.vx*=0.3;fl.vz*=0.3;}
        else{fl.vy=0;fl.vx*=0.85;fl.vz*=0.85;if(Math.abs(fl.vx)<0.05)fl.vx=0;if(Math.abs(fl.vz)<0.05)fl.vz=0;}
      }else fl.g.position.y=ny;
      if(fl.vx!==0||fl.vy!==0){fl.g.position.x=nx;fl.g.position.z=nz;}
    }
    fl.f=Math.round(fl.g.position.y/CFG.FH);
    fl.x=fl.g.position.x;fl.z=fl.g.position.z;
    fl.fizzT-=dt;
    if(fl.fizzT<=0){fl.fizzT=rand(0.5,1.1);play('flare',{pos:fl.g.position,vol:.55,ref:12});}
  }
}

let camPitchObj={p:0};

/* ---------- pistol ---------- */
const GUN={RATE:0.11,SPREAD:0.012,RECOIL:0.006,DMG:1,HEAD:2,PICKUP:30,BOX:20};  // SMG, full-auto while LMB is held
function firePistol(){
  INV.ammo--;player.attackT=GUN.RATE;player.shakeT=Math.max(player.shakeT,0.06);player.fireKick=1;
  player.pitch=clamp(player.pitch+GUN.RECOIL,-1.45,1.45); // recoil climbs while you hold the trigger
  player.yaw+=rand(-0.004,0.004);
  play('shot',{vol:.9,rate:rand(1.05,1.2)});
  emitNoise(player.pos.x,player.pos.z,player.floor,15); // gunshots are LOUD
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  dir.x+=rand(-GUN.SPREAD,GUN.SPREAD);dir.y+=rand(-GUN.SPREAD,GUN.SPREAD)*0.6;dir.z+=rand(-GUN.SPREAD,GUN.SPREAD);dir.normalize();
  muzzle.position.copy(camera.position).add(dir.clone().multiplyScalar(0.7));
  muzzle.intensity=50;muzzleT=0.07;
  // gunshots wake the Watcher if it is lurking nearby
  if(WATCHER.state==='lurk'&&WATCHER.z&&Math.abs(WATCHER.z.f-player.floor)<=1)watcherPursue(14);
  burst(camera.position.clone().add(dir.clone().multiplyScalar(0.9)),0xffd27a,6,3,0.05);
  hudInv();
  if(!G.mp||G.host)pistolHit(camera.position,dir,player.floor);
  else netSend({t:'ev',k:'shoot',x:+camera.position.x.toFixed(2),y:+camera.position.y.toFixed(2),z:+camera.position.z.toFixed(2),
    dx:+dir.x.toFixed(3),dy:+dir.y.toFixed(3),dz:+dir.z.toFixed(3),f:player.floor});
}
/* the bullet is a ray tested against each body (legs → head), so point-blank shots land too;
   walls stop it, and a head hit does extra damage */
const BODY_PTS=[[0.35,0.28],[0.75,0.3],[1.15,0.3],[1.5,0.2],[1.7,0.18]];
const CRAWL_PTS=[[0.22,0.26,-0.45],[0.28,0.3,0.05],[0.32,0.28,0.45],[0.36,0.2,0.82]];
function pistolHit(origin,dir,f){
  const fl=f??player.floor;
  let best=null,bt=1e9,head=false;
  for(const z of world.zombies){
    if(z.dead||z.f!==fl||z.riseT>0&&z.g.rotation.x>0.8)continue;
    const s=z.cfg.scale,gp=z.g.position;
    const crawl=z.type==='crawler'&&!z.robot,fx=-Math.sin(z.yaw),fz=-Math.cos(z.yaw);
    for(const [h,r,fo=0] of (crawl?CRAWL_PTS:BODY_PTS)){
      const px=gp.x+fx*fo*s-origin.x,py=gp.y+h*s-origin.y,pz=gp.z+fz*fo*s-origin.z;
      const t=px*dir.x+py*dir.y+pz*dir.z;
      if(t<0||t>24||t>=bt)continue;
      const ex=px-dir.x*t,ey=py-dir.y*t,ez=pz-dir.z*t;
      const rr=r*s+0.05;
      if(ex*ex+ey*ey+ez*ez<rr*rr&&(t<1.2||losClear(origin.x,origin.z,gp.x,gp.z,fl))){bt=t;best=z;head=crawl?fo>0.7:h>=1.45;}
    }
  }
  if(best){
    best.hit(head?GUN.HEAD:GUN.DMG,false,'bullet');
    const hp=origin.clone().add(dir.clone().multiplyScalar(bt));
    burst(hp,MD.blood?0x8a0a0f:0xffd23f,head?16:10,3,0.06);
    return true;
  }
  return false;
}
const _pv=new THREE.Vector3();

function updatePlayer(dt,t){
  // timers
  player.attackT=Math.max(0,player.attackT-dt);
  player.swingT=Math.max(0,player.swingT-dt);
  player.shakeT=Math.max(0,player.shakeT-dt);
  player.invulnT=Math.max(0,player.invulnT-dt);
  player.dmgFlash=Math.max(0,player.dmgFlash-dt*1.6);
  $('dmg').style.opacity=Math.min(1,player.dmgFlash*0.9+(player.hp<30?0.35+Math.sin(t*6)*0.1:0));
  if(player.dead){
    return; // respawn happens only when the player clicks RESPAWN NOW
  }
  if(player.down){
    player.bleedT-=dt;
    $('downedTxt').textContent=downText();
    if(player.bleedT<=0){if(G.mp)playerTurns();else if(G.helpMode)gameOver();else onPlayerDeath();}
    camera.position.set(player.pos.x,player.pos.y+0.45,player.pos.z);
    camera.rotation.set(player.pitch,player.yaw,0.12,'YXZ');
    return;
  }
  // look (frozen while UI is open) — mouse + arrow keys
  if(G.uiLock||G.chatOpen){mouse.dx=0;mouse.dy=0;}
  const sens=SET.sens*0.0022;
  player.yaw-=mouse.dx*sens;player.pitch-=mouse.dy*sens;
  if(!G.uiLock&&!G.chatOpen){
    const turn=2.6*dt*SET.sens;
    if(KEY.ArrowLeft)player.yaw+=turn;
    if(KEY.ArrowRight)player.yaw-=turn;
    if(KEY.ArrowUp)player.pitch=clamp(player.pitch+turn*0.7,-1.45,1.45);
    if(KEY.ArrowDown)player.pitch=clamp(player.pitch-turn*0.7,-1.45,1.45);
  }
  player.pitch=clamp(player.pitch,-1.45,1.45);
  mouse.dx=0;mouse.dy=0;
  // move intent (WASD only — arrows look)
  let ix=0,iz=0;
  if(!G.uiLock&&!G.chatOpen){
    if(KEY.KeyW)iz-=1; if(KEY.KeyS)iz+=1;
    if(KEY.KeyA)ix-=1; if(KEY.KeyD)ix+=1;
  }
  const moving=(ix||iz);
  const sprinting=(KEY.ShiftLeft||KEY.ShiftRight)&&moving&&!player.crouch&&player.st>1;
  if(sprinting)player.st=Math.max(0,player.st-16*dt);
  else player.st=Math.min(100,player.st+11*dt);
  let spd=player.crouch?CFG.CROUCH:(sprinting?CFG.SPRINT:CFG.WALK);
  if(moving){
    const il=Math.hypot(ix,iz);ix/=il;iz/=il;
    const s=Math.sin(player.yaw),c=Math.cos(player.yaw);
    // W (iz=-1) must move along camera forward (-sin(yaw), -cos(yaw))
    const vx=(ix*c + iz*s)*spd, vz=(iz*c - ix*s)*spd;
    player.speed=Math.hypot(vx,vz);
    let nx=player.pos.x+vx*dt,nz=player.pos.z+vz*dt;
    [nx,nz]=collideCircle(nx,nz,player.pos.y,player.floor);
    player.pos.x=nx;player.pos.z=nz;
  }else player.speed=0;
  // resolve wall penetration even while standing still (a knockback may have pushed us in)
  {
    const rr=collideCircle(player.pos.x,player.pos.z,player.pos.y,player.floor);
    player.pos.x=rr[0];player.pos.z=rr[1];
  }
  // vertical
  player.vy+=CFG.GRAV*dt;
  player.pos.y+=player.vy*dt;
  const g=groundAt(player.pos.x,player.pos.z,player.pos.y+0.4);
  if(player.pos.y<=g){
    if(player.vy<-9)play('pstepRun',{vol:.5,rate:0.85});
    player.pos.y=g;player.vy=0;player.grounded=true;
  }else player.grounded=false;
  if(KEY.Space&&player.grounded&&!G.uiLock){player.vy=CFG.JUMP;player.grounded=false;play('pstepWalk',{vol:.4});}
  // floor tracking
  const nf=clamp(Math.round(player.pos.y/CFG.FH),0,CFG.FLOORS);
  if(nf!==player.floor){player.floor=nf;onFloorChange(nf);}
  // safety net: if we ever end up outside the building, snap back to the stairwell
  if(!isFinite(player.pos.x)||!isFinite(player.pos.z)||player.pos.x<-24.4||player.pos.x>24.4||player.pos.z<-10.4||player.pos.z>10.4){
    player.pos.set(14.5,player.floor*CFG.FH+0.1,0);
    player.vy=0;
  }
  // steps + noise — each footfall is its own sound, weighted by gait, alternating L/R
  if(player.speed>0.5&&player.grounded){
    player.stepAcc+=player.speed*dt;
    player.bobT+=dt*player.speed*1.7;
    if(player.stepAcc>(sprinting?2.3:2.0)){
      player.stepAcc=0;
      player.stepSide=!player.stepSide;
      const stepName=sprinting?'pstepRun':(player.crouch?'pstepSneak':'pstepWalk');
      play(stepName,{vol:sprinting?0.9:(player.crouch?0.13:0.5),pan:player.stepSide?0.22:-0.22});
      emitNoise(player.pos.x,player.pos.z,player.floor,sprinting?13:(player.crouch?2:5));
    }
  }
  // flashlight
  if(player.on){
    player.battery-=CFG.BAT_DRAIN*MD.batDrain*dt;
    if(player.battery<=0){player.battery=0;player.on=false;toast(T('t_torchdead'));play('click',{vol:.5});hudInv();}
    INV.battery=player.battery;
  }
  const dim=player.battery<20?(0.35+0.65*player.battery/20):1;
  const flick=(player.battery<18&&Math.random()<0.08)?rand(0.3,0.8):1;
  spot.intensity=player.on?60*dim*flick:0;
  camFill.intensity=player.on?0.45*dim*flick:0;
  muzzleT=Math.max(0,muzzleT-dt);
  if(muzzle)muzzle.intensity=muzzleT>0?50:0;
  // attack: pistol / crowbar / shove
  if(mouse.lmb&&player.attackT<=0&&!G.chatOpen&&!G.uiLock){
    if(player.weapon==='pistol'&&INV.pistol){
      if(INV.ammo<=0){
        player.attackT=0.5;play('click',{vol:.8});
        toast(T('t_empty'));
      }else firePistol();
    }else if(INV.crowbar){
      player.attackT=0.5;player.swingT=0.3;
      play('swing',{vol:.6});
      emitNoise(player.pos.x,player.pos.z,player.floor,6);
      let hitAny=false;
      const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
      let target=null,tScore=-9;
      for(const z of world.zombies){
        if(z.dead||z.f!==player.floor)continue;
        const d2z=dist2(z.g.position.x,z.g.position.z,player.pos.x,player.pos.z);
        if(d2z>2.4*2.4)continue;
        const dl=Math.sqrt(d2z)||0.01;
        const facing=((z.g.position.x-player.pos.x)*fx+(z.g.position.z-player.pos.z)*fz)/dl;
        if(facing<(dl<1.15?-0.35:0.2))continue;               // up close, a wide swing still connects
        if(dl>0.9&&!losClear(player.pos.x,player.pos.z,z.g.position.x,z.g.position.z,player.floor))continue;
        const score=facing-dl*0.25;
        if(score>tScore){tScore=score;target=z;}
      }
      if(target){
        const z=target;
        const back=((-Math.sin(z.yaw))*fx+(-Math.cos(z.yaw))*fz)>0.4;
        if(G.mp&&!G.host){ // co-op guest: the host owns zombie health
          netSend({t:'ev',k:'zhit',id:z.id,dmg:back?2:1});
          z.hurtT=0.25;play('hitMelee',{pos:z.g.position,vol:.95,ref:16});
          burst(z.g.position.clone().add(new THREE.Vector3(0,1.25*z.cfg.scale,0)),z.robot?0xffd23f:0x8a0a0f,8,2.2,0.06);
        }else z.hit(back?2:1);
        let zx2=z.g.position.x+fx*0.4,zz2=z.g.position.z+fz*0.4;
        [zx2,zz2]=collideCircle(zx2,zz2,z.g.position.y,z.f,0.38*z.cfg.scale); // melee knockback respects walls
        z.g.position.x=zx2;z.g.position.z=zz2;
        hitAny=true;
      }
      if(hitAny)player.shakeT=0.12;
    }else{
      player.attackT=0.95;
      player.st=Math.max(0,player.st-10);
      play('swing',{vol:.4});
      emitNoise(player.pos.x,player.pos.z,player.floor,4);
      for(const z of world.zombies){
        if(z.dead||z.f!==player.floor)continue;
        const d2z=dist2(z.g.position.x,z.g.position.z,player.pos.x,player.pos.z);
        if(d2z<1.8*1.8){z.staggerT=0.9;z.windup=-1;z.hear(player.pos.x,player.pos.z);}   // a shove interrupts its lunge
      }
    }
  }
  // soft push away from living zombies
  for(const z of world.zombies){
    if(z.dead||z.f!==player.floor)continue;
    const d2z=dist2(z.g.position.x,z.g.position.z,player.pos.x,player.pos.z);
    const rr=0.62*z.cfg.scale;
    if(d2z<rr*rr&&d2z>1e-6){
      const d=Math.sqrt(d2z);
      const bx=player.pos.x,bz=player.pos.z;
      let px2=bx+(bx-z.g.position.x)/d*(rr-d);
      let pz2=bz+(bz-z.g.position.z)/d*(rr-d);
      [px2,pz2]=collideCircle(px2,pz2,player.pos.y,player.floor); // push respects walls
      if(Math.hypot(px2-bx,pz2-bz)>0.4){px2=bx;pz2=bz;} // never eject through a wall
      player.pos.x=px2;player.pos.z=pz2;
    }
  }
  // camera
  camKick=Math.max(0,camKick-dt);
  const kickDip=camKick>0?Math.sin(camKick/0.28*Math.PI)*0.1:0;   // the whole body lurches into a kick
  const eyeT=(player.crouch?CFG.EYE_CROUCH:CFG.EYE)-kickDip;
  const bobY=player.grounded&&player.speed>0.5?Math.sin(player.bobT)*0.035*(sprinting?1.5:1):0;
  const shakeX=player.shakeT>0?rand(-0.03,0.03):0;
  camera.rotation.order='YXZ';
  camera.rotation.y=player.yaw+shakeX;
  camera.rotation.x=player.pitch+(player.shakeT>0?rand(-0.02,0.02):0);
  camera.rotation.z=player.shakeT>0?rand(-0.01,0.01):0;
  const targetFov=SET.fov+(sprinting?6:0);
  camera.fov=lerp(camera.fov,targetFov,dt*6);camera.updateProjectionMatrix();
  if(!player.third){
    camera.position.set(player.pos.x,player.pos.y+eyeT+bobY+(player.speed<0.5?Math.sin(t*1.4)*0.004:0),player.pos.z);
  }else{
    const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
    let back=3.4;
    for(let k=1;k<=8;k++){
      const sx=player.pos.x+fx*0.45*k,sz=player.pos.z+fz*0.45*k;
      if(pointBlocked(sx,player.pos.y+1.4,sz,player.floor)){back=0.45*(k-1);break;}
    }
    let camY=player.pos.y+eyeT+0.9+bobY;
    // keep the 3rd-person camera under the slab above (never inside the "rooftop")
    if(player.floor<CFG.FLOORS&&!inLane(player.pos.x,player.pos.z)){
      const base=Math.round(player.pos.y/CFG.FH)*CFG.FH;
      camY=Math.min(camY,base+CFG.FH-0.28);
    }
    camera.position.set(player.pos.x+fx*back,camY,player.pos.z+fz*back);
  }
  // body
  playerBody.g.visible=player.third;
  playerBody.g.position.set(player.pos.x,player.pos.y,player.pos.z);
  playerBody.g.rotation.y=player.yaw;
  const sw=Math.sin(player.bobT)* (player.speed>0.5?0.55:0);
  playerBody.legL.rotation.x=sw;playerBody.legR.rotation.x=-sw;
  playerBody.armL.rotation.x=-sw*0.7;
  playerBody.armR.rotation.x=player.on?-1.3:sw*0.7;
  // === TENSION ENGINE ===
  // A single 0..1 threat value drives YOUR body: heartbeat + breathing.
  // Rises fast when danger appears, fades slowly when it passes — like real adrenaline.
  if(MD.jumpscares){
    const vis=nearestVisibleZombieDist();   // you can SEE it
    const threat=nearestThreatDist();       // it is hunting/investigating
    const prox=nearestZombieDist();         // it exists, close by
    let target=0.06;                        // baseline: alive, uneasy
    if(vis>0&&vis<15)target=Math.max(target,0.55+(15-vis)/15*0.35);
    if(threat>=0)target=Math.max(target,threat<6?0.9:0.45+(12-threat)/12*0.4);
    if(prox>0&&prox<5)target=Math.max(target,0.7);
    if(player.hp<40)target=Math.max(target,0.4);
    if(G.dangerFloor===player.floor)target=Math.max(target,0.45);
    if(sprinting)target=Math.max(target,0.25);
    if(G.jTension&&!G.flags.jieunTalked){const je=npcByKey('jieun');target=Math.max(target,0.62+0.08*Math.max(0,(je?je.li:0)+1));}   // talking to her: your heart knows
    target=clamp(target,0,1);
    AUD.threat=lerp(AUD.threat,target,dt*(target>AUD.threat?2.4:0.32));
    const th=AUD.threat;
    // your own heartbeat: slow & quiet at rest, hammering in danger
    AUD.heartT-=dt;
    if(AUD.heartT<=0){
      AUD.heartT=lerp(1.1,0.28,Math.pow(th,0.8)); // panic = the tempo races, not just the volume
      play('heart',{vol:0.4+th*0.6,rate:lerp(0.9,1.35,th)});
    }
    // breathing: varies with fear and exertion — never a flat loop
    AUD.breathT-=dt;
    if(AUD.breathT<=0){
      const f=clamp(th+(sprinting?0.3:0)+(player.st<25?0.2:0),0,1);
      AUD.breathT=lerp(1.1,2.9,1-f)*rand(0.85,1.15);
      play('breath',{vol:0.08+f*0.36,rate:lerp(1.3,0.82,f)});
    }
  }else{
    const threat=nearestThreatDist();
    if((threat<9&&threat>=0)||player.hp<30){
      AUD.heartT-=dt;
      if(AUD.heartT<=0){AUD.heartT=lerp(0.42,1.1,clamp(threat<0?0:threat/9,0,1));play('heart',{vol:0.5});}
    }
  }
  updateViewModel(dt,t);
}
function nearestThreatDist(){
  let best=-1;
  for(const z of world.zombies){
    if(z.dead||z.f!==player.floor)continue;
    if(z.state!=='chase'&&z.state!=='investigate')continue;
    const d=Math.sqrt(dist2(z.g.position.x,z.g.position.z,player.pos.x,player.pos.z));
    if(best<0||d<best)best=d;
  }
  return best;
}
function nearestZombieDist(){ // any living zombie on this floor, any state
  let best=-1;
  for(const z of world.zombies){
    if(z.dead||z.f!==player.floor)continue;
    const d=Math.sqrt(dist2(z.g.position.x,z.g.position.z,player.pos.x,player.pos.z));
    if(best<0||d<best)best=d;
  }
  return best;
}
function nearestVisibleZombieDist(){ // in your field of view AND unobstructed
  let best=-1;
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
  for(const z of world.zombies){
    if(z.dead||z.f!==player.floor)continue;
    const dx=z.g.position.x-player.pos.x,dz=z.g.position.z-player.pos.z;
    const d=Math.hypot(dx,dz);
    if(d<0.4||d>16)continue;
    if((fx*dx+fz*dz)/d<0.35)continue;
    if(!losClear(player.pos.x,player.pos.z,z.g.position.x,z.g.position.z,player.floor))continue;
    if(best<0||d<best)best=d;
  }
  return best;
}
function pointBlocked(x,y,z,f){
  for(let ff=Math.max(0,f-1);ff<=Math.min(CFG.FLOORS,f+1);ff++){
    for(const c of world.cols[ff]){
      if(c.off)continue;
      if(x>c.x0-0.2&&x<c.x1+0.2&&z>c.z0-0.2&&z<c.z1+0.2&&y>c.y0&&y<c.y1)return true;
    }
  }
  return false;
}

/* =====================================================================
   SECTION E — INTERACT · CCTV · QUEST · EVENTS · HUD
===================================================================== */
let holdAct=null;      // a HOLD-[Q] job in progress: {kind,label,t,dur,apply,mesh,base,fx}
let extractProg=0;
const pings=[];
let playerMaxFloor=0;
let ePrev=false,enterPrev=false,spacePrev=false;

let warnT=0;
function warnFx(){ // short alert sound for warning signs (throttled)
  const now=performance.now();
  if(now-warnT<900)return;
  warnT=now;play('alert',{vol:.55,force:true});
}
const WARN_RE=/⚠|\bRUN\b|快跑/;
function toast(txt){
  if(WARN_RE.test(txt))warnFx();
  const box=$('toasts');
  for(const c of box.children)if(c.textContent===txt&&!c._fading)return;   // no duplicate spam
  const d=document.createElement('div');d.className='toast';d.textContent=txt;
  box.appendChild(d);
  setTimeout(()=>{d._fading=true;d.style.opacity='0';d.style.transition='opacity .5s';},3200);
  setTimeout(()=>d.remove(),3800);
}
const subQ=[];let subT=0;
/* now=true: a person speaking in front of you — replaces whatever subtitle is up */
function showSub(html,dur=4.5,now=false){
  if(WARN_RE.test(html))warnFx();
  if(now){subQ.length=0;$('subtitle').innerHTML=html;subT=dur;return;}
  subQ.push({html,dur});
}
function updateSub(dt){
  if(subT>0){subT-=dt;if(subT<=0)$('subtitle').innerHTML='';return;}
  const s=subQ.shift();
  if(s){$('subtitle').innerHTML=s.html;subT=s.dur;}
}
function radio(txt){showSub('<b>'+T('radio_name')+':</b> '+txt,5.5);} // silent now: no static blip, just the message
function hudSquad(){
  const el2=$('squad');if(!el2)return;
  if(!G.mp){el2.style.display='none';return;}
  const n=1+net.remotes.size;
  const ping=net.con?(net.con.open?'🟢':'🟠'):(net.ready?'🟢':'🟠');
  el2.style.display='block';
  el2.style.cssText='display:block;margin-top:5px;font-size:12px;letter-spacing:2px;color:#8fd0ff;text-shadow:0 1px 3px #000';
  el2.textContent=ping+' '+T('lb_squad')+' '+n+'/4';
}
function hudStats(){
  const bar=v=>'scaleX('+clamp(v/100,0,1)+')';
  $('hpFill').style.transform=bar(player.hp);
  $('stFill').style.transform=bar(player.st);
  $('btFill').style.transform=bar(player.battery);
  $('btFill').style.background=player.battery<25?'linear-gradient(90deg,#7a1010,#ff5533)':'linear-gradient(90deg,#8d6e00,#ffd54f)';
  const ll=$('livesLbl');
  if(ll)ll.textContent=G.mode==='playing'?(T('lives_lbl')+'  '+'♥'.repeat(Math.max(0,G.lives||0))):'';
}
function hudInv(){
  $('slotCrowbar').classList.toggle('off',!INV.crowbar);
  $('slotFlare').querySelector('.n').textContent=INV.flare;
  $('slotFlare').classList.toggle('off',INV.flare<=0);
  $('slotMed').querySelector('.n').textContent=INV.medkit;
  $('slotMed').classList.toggle('off',INV.medkit<=0);
  $('ammoN').textContent=INV.ammo;
  $('slotAmmo').classList.toggle('off',!INV.pistol);
  $('slotAmmo').style.borderColor=(INV.pistol&&player.weapon==='pistol')?'#ffd34d':'rgba(255,255,255,.18)';
  $('slotCrowbar').style.borderColor=(player.weapon==='melee')?'#ffd34d':'rgba(255,255,255,.18)';
  const icons=[];
  if(G.cards.red)icons.push('<span class="card" style="background:#e33"></span>');
  if(G.cards.blue)icons.push('<span class="card" style="background:#3a8dff"></span>');
  if(G.cards.green)icons.push('<span class="card" style="background:#3fd47f"></span>');
  if(G.cards.yellow)icons.push('<span class="card" style="background:#ffd23f"></span>');
  $('cardIcons').innerHTML=icons.join('')||'—';
  $('slotCards').classList.toggle('off',icons.length===0);
}

/* ---------------- quest (the mission chain) ----------------
   A strict chain: a step only completes while it is the CURRENT step, and every interaction
   that belongs to a later step refuses (notYet) — nothing can be skipped. */
const takenAny=p=>{for(const id of G.taken)if(id.startsWith(p))return true;return false;};
const QUEST=[
  {k:'q_torch',   done:()=>INV.flashlight||takenAny('story-flashlight'), at:{x:-23.05,z:1.15,f:0}},
  {k:'q_crowbar', done:()=>INV.crowbar||takenAny('story-crowbar'),     at:{item:'story-crowbar',x:14.05,z:-8.6,f:0}},
  {k:'q_boards',  done:()=>G.gatesOpen.has(1),     at:{gate:1}},
  {k:'q_sec',     done:()=>G.flags.secFound,       at:{x:-4,z:-5.8,f:2}},
  {k:'q_arch',    done:()=>G.flags.cctvSeen,       at:{x:-5,z:-3.3,f:2}},
  {k:'q_red',     done:()=>G.cards.red,            at:{item:'story-card-red',x:-4.4,z:-4,f:2}},
  {k:'q_power',   done:()=>G.flags.power,          at:{x:0.8,z:-8.25,f:2}},
  {k:'q_gate2',   done:()=>G.gatesOpen.has(2),     at:{gate:2}},
  {k:'q_park',    done:()=>G.flags.parkFound,      at:{npc:'park',x:11.85,z:0.95,f:3}},
  {k:'q_parktalk',done:()=>G.flags.parkTalked,     at:{npc:'park',x:11.85,z:0.95,f:3}},
  {k:'q_blue',    done:()=>G.cards.blue,           at:{item:'story-card-blue',npc:'park',x:11.8,z:0.33,f:3}},
  {k:'q_killpark',kl:'q_killpark_l',done:()=>G.flags.parkDead, at:{parkZ:true,npc:'park',x:11.85,z:0.95,f:3}},
  {k:'q_shutter', done:()=>G.flags.shutter,        at:{x:-5,z:-3.3,f:2}},
  {k:'q_gate3',   done:()=>G.flags.reach4,         at:{gate:3}},
  {k:'q_breaker', done:()=>G.flags.power2,         at:{x:9,z:-8.3,f:4}},
  {k:'q_gate4',   done:()=>G.gatesOpen.has(4),     at:{gate:4}},
  {k:'q_jieun',   done:()=>G.flags.jieunFound,     at:{search:5,f:5}},
  {k:'q_jtalk',   done:()=>G.flags.jieunTalked,    at:{npc:'jieun',x:-22.95,z:-8.95,f:5}},
  {k:'q_yellow',  done:()=>G.cards.yellow,         at:{item:'story-card-yellow',npc:'jieun',x:-22.2,z:-8.4,f:5}},
  {k:'q_gate5',   done:()=>G.gatesOpen.has(5),     at:{gate:5}},
  {k:'q_gate6',   done:()=>G.gatesOpen.has(6),     at:{gate:6}},
  {k:'q_roof',    done:()=>G.flags.reachRoof,      at:{x:2,z:3.5,f:CFG.FLOORS}},
  {k:'q_flare',   done:()=>G.flags.flareLit,       at:{x:2,z:3.5,f:CFG.FLOORS}},
  {k:'q_hold',    done:()=>G.flags.victory,        at:{x:2,z:3.5,f:CFG.FLOORS}},
];
const QI={};QUEST.forEach((q,i)=>{QI[q.k]=i;});
let qi=0;
function questAt(k){return qi>=(QI[k]??0);}
function questKey(i){const q=QUEST[clamp(i,0,QUEST.length-1)];return (MD.id==='lite'&&q.kl)?q.kl:q.k;}
let notYetT=-9;
function notYet(){
  if(G.time-notYetT<1.2)return;
  notYetT=G.time;
  toast(T('t_notyet',{o:T(questKey(qi))}));
  play('click',{vol:.4});
}
/* where a step lives right now: a live item / survivor / zombie, a stairwell gate, or a search area */
function questPos(q){
  const a=q.at;
  if(a.gate!==undefined)return {x:17.6,z:1.2,f:a.gate};
  if(a.item){const it=world.items.find(i=>i.id===a.item&&!i.taken);if(it)return {x:it.g.position.x,z:it.g.position.z,f:it.f};}
  if(a.parkZ&&world.parkZ&&!world.parkZ.dead){const z=world.parkZ.g.position;return {x:z.x,z:z.z,f:world.parkZ.f};}
  if(a.npc){const n=npcByKey(a.npc);if(n&&!n.gone){const c=n.center();return {x:c.x,z:c.z,f:n.f};}}
  if(a.search!==undefined)return {search:true,f:a.search};
  return a;
}
/* Returns the marker to steer toward: the object itself, or the stairwell when it is on another floor. */
function questTarget(){
  if(G.flags.victory)return null;
  const p=questPos(QUEST[clamp(qi,0,QUEST.length-1)]);
  if(!p||p.f===undefined)return null;
  if(p.f>player.floor)return {x:16.8,z:1.2,up:true,floor:p.f};
  if(p.f<player.floor)return {x:16.8,z:1.2,up:true,down:true,floor:p.f};
  if(p.search)return {search:true,floor:p.f};
  return {x:p.x,z:p.z,up:false,floor:p.f};
}
/* Angle from the player's facing to the current objective (0 = straight ahead, +right). */
function waypointDir(){
  const qt=questTarget();
  if(!qt||qt.search)return null;
  const dx=qt.x-player.pos.x,dz=qt.z-player.pos.z;
  const d=Math.hypot(dx,dz);
  if(d<0.6)return null;
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
  const dot=(fx*dx+fz*dz)/d,cross=fx*dz-fz*dx;
  return {rel:Math.atan2(cross,dot),dist:d,up:!!qt.up,down:!!qt.down,floor:qt.floor};
}
let RESTORING=false; // suppress radio beats while restoring a save / applying a net snapshot
let bannerTO=null;
function questCheck(){
  let advanced=false;
  while(qi<QUEST.length-1&&QUEST[qi].done()){qi++;advanced=true;}
  if(advanced){
    play('pickup',{vol:.9});
    if(!RESTORING){
      const r='r_'+QUEST[qi].k.slice(2);
      if(I18N.en[r])radio(T(r));   // Ji-woo reacts to every new step
      if(G.mp)netQi();
    }
  }
  renderObjective(advanced&&!RESTORING);
}
function renderObjective(banner){
  const cur=clamp(qi,0,QUEST.length-1);
  const tag=T('objective_n',{n:cur+1,t:QUEST.length});
  $('obj').textContent=tag+' — '+T(questKey(cur));
  // the mission is all you see; HOW (where + which key) and the controls only when you ask: [I]
  $('mwTag').textContent=T('mw_how');
  $('mwTxt').textContent=T('qh_'+QUEST[cur].k.slice(2));
  if(banner)G.helpOpen=false;   // a new step starts collapsed again
  showHelp(!!G.helpOpen);
  if(banner&&G.mode==='playing')objectiveBanner();
}
function showHelp(on){
  G.helpOpen=on;
  const mw=$('missionWindow');if(mw)mw.style.display=on?'block':'none';
  const hk=$('hintKey');if(hk)hk.style.display=on?'block':'none';
  const b=$('helpBtn');if(b)b.innerHTML=T(on?'help_hide':'help_show');
}
function objectiveBanner(){
  $('objBannerH').textContent=T('obj_upd');
  $('objBannerTxt').textContent=T(questKey(qi));
  $('objBanner').style.opacity='1';
  clearTimeout(bannerTO);
  bannerTO=setTimeout(()=>{$('objBanner').style.opacity='0';},3800);
}
/* co-op: progress is shared — whoever advances tells everyone */
function netTell(m){if(!G.mp)return;if(G.host)netBroadcast(m);else netSend(m);}
function netQi(){netTell({t:'ev',k:'qi',v:qi});}
function netFlag(n){netTell({t:'ev',k:'flag',n});}
function applyFlag(n){
  if(n==='parkTalked')spawnParkItems();
  else if(n==='parkTurned'){
    const p=npcByKey('park');
    if(p&&!p.gone){p.convulse=true;setTimeout(()=>{if(G.host)spawnParkZombie(false);else p.gone=true;},4200);}
  }
  else if(n==='parkDead'){const p=npcByKey('park');if(p)p.gone=true;}
  else if(n==='jieunTalked')spawnJieunCard();
  else if(n==='jieunTrusted'||n==='jieunKilled'||n==='jieunTimeout')resolveJieun({jieunTrusted:'trust',jieunKilled:'kill',jieunTimeout:'timeout'}[n],true);
  else if(n==='jieunDead'){G.flags.jieunDead=false;jieunDies(false,true);}
  else if(n==='flareLit')lightRoofFlare(true);
}
/* rebuild the visible story state from flags (continue / language switch / late join) */
function restoreStory(){
  const park=npcByKey('park'),je=npcByKey('jieun');
  if(G.flags.parkTalked){spawnParkItems();if(park)park.li=park.lines.length-1;}
  if(G.flags.parkTurned&&park){
    if(!G.flags.parkDead&&(!G.mp||G.host))spawnParkZombie(true);
    park.gone=true;
  }
  if(G.flags.jieunTalked){
    spawnJieunCard();jieunResolved=true;
    if(je){je.li=je.lines.length-1;
      if(G.flags.jieunKilled)killJieun(true);
      else if(G.flags.jieunDead)je.gone=true;
      else je.startFollow();}
  }
  if(G.flags.flareLit)lightRoofFlare(true);
  for(const g of world.gates)g.refreshLamp();
  updateShutterBtn();
}
/* discovery checks: seeing Park, finding Ji-eun, walking into the security room */
function storyProximity(){
  if(player.dead||player.down)return;
  const pf=player.floor,px=player.pos.x,pz=player.pos.z;
  if(pf===3&&!G.flags.parkFound&&questAt('q_park')){
    const n=npcByKey('park');
    if(n&&!n.gone){const c=n.center();
      if(Math.hypot(px-c.x,pz-c.z)<6.5&&losClear(px,pz,c.x,c.z,3)){G.flags.parkFound=true;netFlag('parkFound');questCheck();}}
  }
  if(pf===5&&!G.flags.jieunFound&&questAt('q_jieun')){
    const n=npcByKey('jieun');
    if(n){const c=n.center();
      if(Math.hypot(px-c.x,pz-c.z)<3.6&&losClear(px,pz,c.x,c.z,5)){
        G.flags.jieunFound=true;netFlag('jieunFound');showSub(T('jieun_found'),5,true);suspectShow();questCheck();}}
  }
  if(pf===2&&!G.flags.secFound&&questAt('q_sec')&&px>-10&&px<2&&pz<-1.8){
    G.flags.secFound=true;netFlag('secFound');questCheck();
  }
}
/* the director marks a floor as "hot": the tension engine raises your heartbeat there */
let dangerTO=null;
function markDanger(f,sec){
  G.dangerFloor=f;
  clearTimeout(dangerTO);
  dangerTO=setTimeout(()=>{G.dangerFloor=-1;},sec*1000);
}

/* ---------------- floors / story ---------------- */
function storyLine(f){
  if(MD.id==='lite'&&hasT('sl'+f))return T('sl'+f);
  if(hasT('s'+f))return T('s'+f);
  return null;
}
function onFloorChange(f){
  playerMaxFloor=Math.max(playerMaxFloor,f);
  // "get there" steps only count while they are the current step
  if(f>=4&&qi===QI.q_gate3)G.flags.reach4=true;
  if(f>=CFG.FLOORS&&qi===QI.q_roof)G.flags.reachRoof=true;
  CHECK.floor=Math.max(CHECK.floor,Math.min(f,CFG.FLOORS-1));
  for(let i=0;i<world.levels.length;i++)world.levels[i].visible=(Math.abs(i-f)<=1);
  $('floorLbl').textContent=f>=CFG.FLOORS?T('roof'):(f===0?T('floor0'):T('floor',{n:f}));
  if(!G.floorsSeen.has(f)){
    G.floorsSeen.add(f);
    if(storyLine(f))radio(storyLine(f));
    if(f>=1&&!G.stairTip){G.stairTip=true;setTimeout(()=>showSub(T('hint_stairtop'),5.5),600);}
    if(f===0&&!G.wayTip){G.wayTip=true;setTimeout(()=>radio(T('radio_stairs')),3500);}
    directorBeat(f);
  }else if(MD.jumpscares&&f>0&&f<playerMaxFloor&&f<CFG.FLOORS&&Math.random()<0.35&&!G.flags.victory&&G.started){
    // backtracking is never safe: something new is drifting near the stairwell
    const ff=f;
    setTimeout(()=>{
      if(!G.started||G.mode!=='playing'||player.floor!==ff||G.flags.victory)return;
      const z=spawnZombie(ff,15.6+rand(0,2),rand(-1.2,1.2),Math.random()<0.5?'runner':'shambler',{x0:13,x1:15.8,z0:-1.6,z1:1.8,door:null});
      z.state='investigate';z.invest={x:player.pos.x,z:player.pos.z};z.investT=25;
      play('clang',{pos:new THREE.Vector3(16,ff*CFG.FH,0),vol:.55,ref:16});
      showSub(T('sub_notbefore'),2.6);
    },3500+rand(0,5000));
  }
  // higher = darker: the fog thickens as you climb
  scene.fog.density=f>=CFG.FLOORS?(MD.id==='lite'?0.012:0.018):MD.fogD*(1+f*0.05);
  if(G.host&&G.mp)netBroadcast({t:'ev',k:'floor',f});
  questCheck();
}

/* ---------------- interact ---------------- */
function doorPoint(d){
  const g=d.g.position;
  return d.axis==='x'?{x:g.x+0.8,z:g.z}:{x:g.x,z:g.z+0.8};
}
/* ---------------- interaction: three keys, three kinds of action ----------------
   [E]           tap  — take, open/close, read, use a terminal, swipe a card
   [Q]           tap  — kick boards in (one kick per tap)
   [HOLD Q]      hold — physical work: pry boards, pull a breaker, light the flare, revive
   [E]           also talks to a survivor (again for the next line); the target you look at wins
   Items and survivors must be in plain sight: nothing is usable through a wall. */
const ITEM_LABEL={battery:'l_batt',flare:'l_flare',medkit:'l_medkit',crowbar:'l_crowbar',flashlight:'l_torch',note:'l_note',pistol:'l_pistol',ammo:'l_ammo'};
function itemQuest(it){ // story items belong to one mission step
  if(it.id.startsWith('story-crowbar'))return 'q_crowbar';
  if(it.id.startsWith('story-card-'))return 'q_'+it.id.slice(11);
  return null;
}
function takeItem(it){
  const q=itemQuest(it);
  if(q&&!questAt(q)){notYet();return;}
  it.take();
  if(it.type==='battery'){INV.battery=Math.min(100,player.battery+40);player.battery=INV.battery;toast(T('t_batt'));}
  else if(it.type==='flare'){INV.flare++;toast(T('t_flare'));}
  else if(it.type==='medkit'){INV.medkit++;toast(T('t_medkit'));}
  else if(it.type==='crowbar'){INV.crowbar=true;player.weapon='melee';toast(T('t_crowbar'));}
  else if(it.type==='pistol'){INV.pistol=true;INV.ammo+=GUN.PICKUP;player.weapon='pistol';toast(T('t_pistol'));}
  else if(it.type==='ammo'){INV.ammo+=GUN.BOX;toast(T('t_ammo'));}
  else if(it.type==='flashlight'){INV.flashlight=true;player.on=true;toast(T('t_torch'));}
  else if(it.type.startsWith('card')){
    const c=it.type.split('-')[1];G.cards[c]=true;toast(T('g_got',{c:colName(c)}));
    netTell({t:'ev',k:'card',c,n:G.myName});
    if(c==='blue')parkTurn();else directorChase();
  }
  else if(it.type==='note'){const n=notesList().find(n=>n.id===it.id);if(n)openNote(n);}
  hudInv();hudStats();questCheck();
}
function flipBreaker(isMain){
  if(isMain){G.flags.power=true;toast(T('t_power'));}
  else{G.flags.power2=true;toast(T('t_power2'));for(const g of world.gates)g.refreshLamp();}
  play('clunk',{vol:1});play('rumble',{vol:.8});
  const bk=isMain?world.breakers.main:world.breakers.sub;
  if(bk&&bk.mesh){bk.mesh.material.emissiveIntensity=0.15;bk.mesh.rotation.x=-1.2;}
  netTell({t:'ev',k:'power',sub:!isMain});
  questCheck();
}
function interactTargets(){
  const out={e:null,hold:null,enter:null,info:null};
  if(G.uiLock||player.dead||player.down||G.paused||!world.built)return out;
  const R2=2.3*2.3;
  const best={e:2*R2,hold:2*R2,enter:3*R2,info:2*R2};
  const px=player.pos.x,pz=player.pos.z,pf=player.floor;
  const lx=-Math.sin(player.yaw),lz=-Math.cos(player.yaw);
  const add=(slot,x,z,f,o,los,prio=1)=>{
    if(f!==pf)return;
    const d=dist2(px,pz,x,z);
    if(d>=R2*(slot==='enter'?1.5:1))return;
    // prefer what you are LOOKING at: something behind you counts as twice as far
    const dl=Math.sqrt(d);
    const facing=dl<0.3?1:clamp((lx*(x-px)+lz*(z-pz))/dl,0,1);
    const score=d*(2-facing)*prio;
    if(score>=best[slot])return;
    if(los&&!losClear(px,pz,x,z,pf))return;
    best[slot]=score;out[slot]={x,z,score:slot==='enter'?score/1.5:score,...o};
  };
  for(const it of world.items){
    if(it.taken||it.f!==pf)continue;
    const p=it.g.position;
    const label=it.type.startsWith('card')?T('l_card',{c:colName(it.type.split('-')[1])}):T(ITEM_LABEL[it.type]||'l_batt');
    const q=itemQuest(it);
    add('e',p.x,p.z,it.f,{label,fn:()=>takeItem(it)},true,q&&qi===QI[q]?0.35:1);   // what the objective needs comes first
  }
  for(const d of world.doors){
    if(d.f!==pf)continue;
    const p=doorPoint(d);
    if(d.boarded){
      if(INV.crowbar)add('hold',p.x,p.z,d.f,{label:T('l_pry'),dur:2.2,kind:'pry',id:d.id,mesh:d.boardMesh,apply:()=>d.breakBoards()});
      else if(d.kick)add('hold',p.x,p.z,d.f,{label:T('l_kick'),kind:'kick',kicks:3,id:d.id,mesh:d.boardMesh,apply:()=>d.breakBoards()});
      else add('info',p.x,p.z,d.f,{label:T('l_boarded')});
    }else add('e',p.x,p.z,d.f,{label:d.open?T('l_close'):T('l_open'),fn:()=>d.use()});
  }
  for(const gt of world.gates){
    if(gt.open||gt.f!==pf)continue;
    const p=gt.g.position,gx=p.x-0.45;
    if(gt.type==='board'){
      if(INV.crowbar)add('hold',gx,p.z,gt.f,{label:T('l_gpry'),dur:2.6,kind:'pry',id:'gate'+gt.f,mesh:gt.mesh,quest:'q_boards',apply:()=>gt.breakBoards()});
      else add('info',gx,p.z,gt.f,{label:T('l_gboarded')});
      continue;
    }
    let label;
    if(gt.type.startsWith('card')){const c=gt.type.split('-')[1];label=T(G.cards[c]?'l_gswipe':'l_glock',{c:colName(c)});}
    else if(gt.type==='shutter')label=T('l_shutter');
    else label=T(G.flags.power2?'l_gate':'l_maglock');
    add('e',gx,p.z,gt.f,{label,fn:()=>gt.tryOpen()});
  }
  for(const npc of world.npcs){
    if(npc.gone||npc.corpse||npc.f!==pf)continue;
    const c=npc.center();
    if(npc.follow){ // walking with you: the only thing to do is patch her up
      if(npc.hp<npc.hpMax-10&&INV.medkit>0)add('e',c.x,c.z,npc.f,{label:T('l_givemed'),fn:giveJieunMedkit},true,0.5);
      continue;
    }
    const tq={park:['q_park','q_parktalk'],jieun:['q_jieun','q_jtalk']}[npc.key]||[];
    add('enter',c.x,c.z,npc.f,{label:T('l_talk',{n:npc.name}),fn:()=>npc.talk()},true,tq.some(k=>qi===QI[k])?0.15:1);   // talking is the objective: it beats a battery at your feet
  }
  if(world.terminal&&pf===world.terminal.f){
    add('e',world.terminal.x,world.terminal.z+0.9,pf,{label:T(G.flags.power?'l_cctv':'l_cctv_bak'),fn:()=>{
      if(!G.flags.cctvSeen&&!questAt('q_arch')){notYet();return;}
      openCCTV();   // the archive runs on backup power — the story is always available
    }},false,(qi===QI.q_arch||qi===QI.q_shutter)?0.35:1);
  }
  // the elevator: a dead end with a story
  if(px>16.2&&Math.abs(px-ELEV.x)<1.5&&pz<-0.9&&pz>CFG.TOWER.z0){
    add('e',ELEV.x,CFG.TOWER.z0+0.3,pf,{label:T('l_elev'),fn:()=>{toast(T(pf<4?'elev_dead':'elev_jam'));play('clunk',{vol:.5});}});
  }
  for(const bk of Object.values(world.breakers)){
    const isMain=bk===world.breakers.main;
    if(isMain?G.flags.power:G.flags.power2)continue;
    add('hold',bk.x,bk.z,bk.f,{label:T(isMain?'l_br1':'l_br2'),dur:2.0,kind:'lever',id:isMain?'bk-main':'bk-sub',mesh:bk.mesh,quest:isMain?'q_power':'q_breaker',apply:()=>flipBreaker(isMain)});
  }
  // the roof: light the signal flare in the landing circle
  if(G.flags.finale&&!G.flags.flareLit&&pf===CFG.FLOORS&&world.extract){
    add('hold',world.extract.x,world.extract.z,pf,{label:T('l_flarelight'),dur:1.8,kind:'flare',id:'flare',quest:'q_flare',apply:()=>lightRoofFlare(false)});
  }
  if(G.mp)for(const r of net.remotes.values()){
    if(!r.down||r.dead||r.spec)continue;
    add('hold',r.x,r.z,r.f||0,{label:T('l_revive',{n:r.name||'friend'}),dur:3.0,kind:'revive',id:'rev'+r.id,apply:()=>{
      netTell({t:'ev',k:'revived',id:r.id});r.down=false;
      toast(T('t_revived',{n:r.name||'friend'}));
    }});
  }
  return out;
}
function updateInteract(dt){
  updateAmbientLights();
  const tg=interactTargets();
  G.holdNear=!!tg.hold||!!holdAct;
  const eDown=!!KEY.KeyE&&!ePrev;ePrev=!!KEY.KeyE;          // edge-triggered: holding E never spam-toggles
  const spDown=!!KEY.KeyQ&&!spacePrev;spacePrev=!!KEY.KeyQ;   // [Q] = physical work
  const rows=[];
  let bar=-1;
  const ex=updateExtraction(dt);
  if(ex){rows.push(ex.row);bar=ex.p;}
  if(holdAct){
    if(!KEY.KeyQ||player.dead||player.down||G.uiLock||G.paused)cancelHold();
    else{
      holdAct.t+=dt;animateHold(dt);
      const a=holdAct;
      showPrompt([{key:'hold',label:a.label}]);setBar(a.t/a.dur);
      if(a.t>=a.dur){endHold();a.apply();}
      return;
    }
  }
  kickCd=Math.max(0,kickCd-dt);
  if(tg.hold){
    const h=tg.hold;
    if(h.kind==='kick'){
      rows.push({key:'space',label:h.label+' ('+(workProg[h.id]||0)+'/'+h.kicks+')'});
      if(spDown)doKick(h);
    }else{
      rows.push({key:'hold',label:h.label});
      if(spDown)startHold(h);
      else if(workProg[h.id])bar=workProg[h.id]/h.dur;   // a job you walked away from
    }
  }
  // [E] does both "use" and "talk": the target you look at (or the one the objective needs) wins
  const eT=(tg.e&&tg.enter)?(tg.enter.score<=tg.e.score?tg.enter:tg.e):(tg.e||tg.enter);
  if(eT){rows.push({key:'e',label:eT.label});if(eDown)eT.fn();}
  if(!rows.length&&tg.info){rows.push({key:null,label:tg.info.label});if(eDown||spDown)toast(T('t_need_crowbar2'));}
  showPrompt(rows);setBar(bar);
}
const workProg={};   // jobs you let go of keep their progress (id -> seconds held)
let kickCd=0,camKick=0;
/* one kick per [Q] tap: you can stop between kicks to fight */
function doKick(h){
  if(kickCd>0)return;
  if(h.quest&&!questAt(h.quest)){notYet();return;}
  kickCd=0.45;camKick=0.28;
  const n=(workProg[h.id]||0)+1;workProg[h.id]=n;
  const fx=h.mesh?h.mesh.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(h.x,player.floor*CFG.FH+1,h.z);
  play('clunk',{pos:fx,vol:1.1,ref:12,rate:rand(0.75,0.95)});
  play('creak',{pos:fx,vol:.45,ref:10,rate:2.3});
  player.shakeT=Math.max(player.shakeT,0.32);
  burst(fx,0x8a6a3a,7,2.4,0.05);
  emitNoise(fx.x,fx.z,player.floor,9);
  if(h.mesh)h.mesh.rotation.z+=rand(-0.07,0.07);
  if(n>=h.kicks){delete workProg[h.id];h.apply();}
}
function startHold(h){
  if(h.quest&&!questAt(h.quest)){notYet();return;}
  const m=h.mesh||null;
  holdAct={...h,t:Math.min(workProg[h.id]||0,h.dur*0.95),snd:0.05,
    base:m?{p:m.position.clone(),r:m.rotation.clone()}:null,
    fx:m?m.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(h.x,player.floor*CFG.FH+0.35,h.z)};
}
function restoreHoldMesh(){const a=holdAct;if(a&&a.mesh&&a.base){a.mesh.position.copy(a.base.p);a.mesh.rotation.copy(a.base.r);}}
function cancelHold(){if(holdAct.id)workProg[holdAct.id]=holdAct.t;restoreHoldMesh();holdAct=null;}
function endHold(){if(holdAct.id)delete workProg[holdAct.id];restoreHoldMesh();holdAct=null;}
/* the work is visible and audible: planks shudder and creak, kicks thud, levers travel */
function animateHold(dt){
  const a=holdAct,k=Math.min(1,a.t/a.dur);
  if(a.mesh&&a.base){
    if(a.kind==='pry'){
      const j=0.02*(0.4+k);
      a.mesh.position.set(a.base.p.x+rand(-j,j),a.base.p.y+rand(-j,j)*0.5,a.base.p.z+rand(-j,j));
      a.mesh.rotation.z=a.base.r.z+Math.sin(a.t*22)*0.035*(0.5+k);
    }else if(a.kind==='lever'){
      a.mesh.rotation.x=a.base.r.x-k*1.2;
    }
  }
  a.snd-=dt;
  if(a.snd>0)return;
  if(a.kind==='pry'){
    a.snd=rand(0.32,0.5);
    play('creak',{pos:a.fx,vol:.6,ref:10,rate:rand(1.5,2.2)});
    burst(a.fx,0x8a6a3a,3,1.4,0.035);
    emitNoise(a.fx.x,a.fx.z,player.floor,5);
  }else if(a.kind==='lever'){
    a.snd=0.45;play('click',{vol:.5,rate:0.7});
  }else if(a.kind==='flare'){
    a.snd=0.22;play('flare',{vol:.35,rate:1.4});burst(a.fx,0xff6a33,5,1.6,0.04);
  }
}
let promptSig='';
function showPrompt(rows){
  const el=$('prompt');
  if(!rows||!rows.length){if(promptSig!==''){el.classList.add('hidden');promptSig='';}return;}
  const sig=rows.map(r=>(r.key||'-')+'|'+r.label).join('#');
  if(sig===promptSig)return;
  promptSig=sig;
  el.classList.remove('hidden');
  el.innerHTML=rows.map(r=>'<div class="pr">'+(r.key?'<b class="k-'+r.key+'">'+esc(T('k_'+r.key))+'</b>':'')+'<span>'+esc(r.label)+'</span></div>').join('');
}
function setBar(p){if(p<0)hideBar();else showBar(p);}
function showBar(p){$('promptBar').classList.remove('hidden');$('promptFill').style.width=Math.round(clamp(p,0,1)*100)+'%';}
function hideBar(){$('promptBar').classList.add('hidden');}
/* lights that move on their own: CCTV monitors, flickering tubes, Floor 5 alarm strobes */
function updateAmbientLights(){
  if(world.termMons)for(const m of world.termMons)m.material.emissiveIntensity=G.flags.power?1.2+Math.sin(G.time*7)*0.5:0.35;
  if(world.flicker)for(const pl of world.flicker){
    if(pl.userData.bo)continue;
    pl.intensity=pl.userData.base*(Math.random()<0.05?rand(0.05,0.5):1);
  }
  if(world.alarms)for(const al of world.alarms){
    if(al.userData.bo)continue;
    al.intensity=al.userData.base*(0.15+0.85*Math.max(0,Math.sin(G.time*4.2)));
  }
}
/* every light on a floor dies for a moment (blackouts, scares) */
function lightsOut(f,ms,after){
  const arr=[];
  if(!world.levels[f])return;
  world.levels[f].traverse(o=>{if(o.isPointLight){if(o.userData.base===undefined)o.userData.base=o.intensity;o.userData.bo=true;o.intensity=0;arr.push(o);}});
  setTimeout(()=>{for(const pl of arr){pl.userData.bo=false;pl.intensity=pl.userData.base;}if(after)after();},ms);
}

/* ---------------- rooftop finale: flare → circle → helicopter ---------------- */
const ROOF_AREA={x0:-22,x1:22,z0:-9,z1:9,door:null};
function lightRoofFlare(quiet){
  const ex=world.extract;if(!ex)return;
  const first=!G.flags.flareLit;
  G.flags.flareLit=true;
  ex.stand.material.emissiveIntensity=3;
  ex.beam.material.opacity=0.13;
  ex.ring.material.emissive.setHex(0xff5533);
  if(quiet||!first)return;
  netFlag('flareLit');
  G.flareT=0;G.waveT=ROOF.FIRST_WAVE;extractProg=0;   // roofSpawned keeps counting from the arrival (cap = ROOF.TOTAL)
  toast(T('t_flarelit'));
  play('flare',{vol:1});play('alarm',{vol:.55,force:true});
  setLoop('chopper',0.7);
  showSub(T('sub_flare'),3.5,true);
  emitNoise(ex.x,ex.z,CFG.FLOORS,60);
  questCheck();
}
function updateExtraction(dt){
  const ex=world.extract;
  if(!ex||!G.flags.finale||!G.flags.flareLit||G.flags.victory||player.floor!==CFG.FLOORS)return null;
  const me=!player.spec;
  const inside=me&&!player.dead&&!player.down&&Math.hypot(player.pos.x-ex.x,player.pos.z-ex.z)<ROOF.RADIUS;
  let inRing=inside?1:0,total=me?1:0;
  if(G.mp)for(const r of net.remotes.values()){
    if(r.dead||r.spec)continue;total++;
    if(!r.down&&r.f===CFG.FLOORS&&Math.hypot(r.x-ex.x,r.z-ex.z)<ROOF.RADIUS+0.2)inRing++;
  }
  let row;
  const own=!G.mp||G.host;   // guests show the host's clock (it arrives in every snapshot)
  if((inside||!me)&&total>0&&inRing>=total){
    if(own)extractProg=Math.min(1,extractProg+dt/ROOF.HOLD);
    row={key:null,label:T('p_extract',{n:Math.max(0,Math.ceil(ROOF.HOLD*(1-extractProg)-0.001))})};
  }else if(inside){
    if(own)extractProg=Math.max(0,extractProg-dt/ROOF.HOLD*0.5);
    row={key:null,label:T('p_wait',{i:inRing,t:total})};
  }else{
    if(own)extractProg=Math.max(0,extractProg-dt/ROOF.HOLD);   // outside: the clock runs backwards
    row={key:null,label:T('p_out',{n:Math.ceil(ROOF.HOLD*(1-extractProg))})};
  }
  roofWaves(dt);
  if(extractProg>=1&&own)doVictory();
  return {row,p:extractProg};
}
/* while the flare burns, the whole building comes up — through the roof door and over the parapet */
function roofWaves(dt){
  G.flareT=(G.flareT||0)+dt;
  if(G.mp&&!G.host)return;
  G.waveT=(G.waveT??ROOF.FIRST_WAVE)-dt;
  if(G.waveT<=0){
    G.waveT=ROOF.WAVE_EVERY*(MD.id==='lite'?1.4:1);
    let alive=0;
    for(const z of world.zombies)if(!z.dead&&z.f===CFG.FLOORS)alive++;
    const n=Math.max(0,Math.min(ROOF.MAX_ALIVE-alive,ROOF.WAVE_N,ROOF.TOTAL-(G.roofSpawned||0)));
    G.roofSpawned=(G.roofSpawned||0)+n;
    for(let i=0;i<n;i++){
      let x,z;
      if(Math.random()<0.6){x=rand(15,18.5);z=pick([rand(-3.5,-0.4),rand(2.4,4.5)]);}   // out of the roof door
      else if(Math.random()<0.5){x=rand(-20,12);z=pick([-9.2,9.2]);}                    // over the parapet
      else{x=-23.2;z=rand(-8,8);}
      const r=Math.random();   // mostly shamblers: the roof is a siege, not a sprint
      const type=(G.flareT>12&&r<0.15)?'crawler':(r<0.4?'runner':'shambler');
      const zb=spawnZombie(CFG.FLOORS,x,z,type,ROOF_AREA);
      zb.state='chase';zb.loseT=0;
    }
    if(n>0)play('snarl',{pos:new THREE.Vector3(16,CFG.ROOF_Y,0),vol:.9,ref:40});
  }
  if(G.flareT>14&&!G.flags.roofBrute&&(G.roofSpawned||0)<ROOF.TOTAL){
    G.flags.roofBrute=true;G.roofSpawned=(G.roofSpawned||0)+1;
    const b=spawnZombie(CFG.FLOORS,17.5,-2.2,'brute',ROOF_AREA);b.state='chase';
    play('zroar',{pos:b.g.position,vol:1.2,ref:40,rate:0.8});
  }
  if(G.flareT>21&&!G.flags.roofWatcher&&MD.jumpscares&&!G.mp){
    G.flags.roofWatcher=true;
    if(!WATCHER.z)watcherSpawn(CFG.FLOORS,16.8,-2.6,'pursue');
    watcherPursue(12);
    showSub(T('w_roof'),3.5);
  }
}
/* the helicopter circles high until it sees the flare, then comes down over the circle */
function updateRoof(dt){
  const h=world.heli,ex=world.extract;
  if(!h||!ex)return;
  const t=G.time;
  let tx,ty,tz;
  if(G.flags.victory){tx=ex.x;tz=ex.z;ty=CFG.ROOF_Y+3.2;}
  else if(!G.flags.flareLit){tx=ex.x+Math.cos(t*0.22)*17;tz=ex.z+Math.sin(t*0.22)*12;ty=CFG.ROOF_Y+17;}
  else{tx=ex.x;tz=ex.z;ty=CFG.ROOF_Y+lerp(14,5.4,extractProg);}
  const g=h.g,k=Math.min(1,dt*0.7);
  const ox=g.position.x,oz=g.position.z;
  g.position.x=lerp(g.position.x,tx,k);g.position.z=lerp(g.position.z,tz,k);
  g.position.y=lerp(g.position.y,ty,Math.min(1,dt*0.9))+Math.sin(t*0.8)*0.01;
  const vx=g.position.x-ox,vz=g.position.z-oz;
  if(vx*vx+vz*vz>1e-6)g.rotation.y+=angDiff(g.rotation.y,Math.atan2(-vz,vx))*Math.min(1,dt*1.5);
  h.rotor.rotation.y+=dt*22;h.rotor2.rotation.y+=dt*22;
  if(G.flags.flareLit&&world.roofLight){
    world.roofLight.intensity=12+Math.sin(t*23)*3+Math.random()*2;
    ex.ring.material.emissiveIntensity=2+Math.sin(t*4)*0.6;
    ex.smokeT-=dt;
    if(ex.smokeT<=0&&player.floor>=CFG.FLOORS-1){ex.smokeT=0.14;spawnSmoke();}
  }
  for(let i=ex.smoke.length-1;i>=0;i--){
    const s=ex.smoke[i];s.life-=dt;
    if(s.life<=0){if(s.sp.parent)s.sp.parent.remove(s.sp);ex.smoke.splice(i,1);continue;}
    s.sp.position.x+=s.vx*dt;s.sp.position.y+=dt*1.5;s.sp.position.z+=s.vz*dt;
    s.sp.scale.setScalar(s.sp.scale.x+dt*0.9);
    s.sp.material.opacity=0.32*s.life/3.2;
  }
}
function spawnSmoke(){
  const ex=world.extract;
  if(ex.smoke.length>=36){const o=ex.smoke.shift();if(o.sp.parent)o.sp.parent.remove(o.sp);}
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex(),color:0xc84a3a,transparent:true,opacity:0.32,depthWrite:false}));
  sp.position.set(ex.x+rand(-.08,.08),ex.y+0.4,ex.z+rand(-.08,.08));sp.scale.setScalar(0.45);
  world.roofGroup.add(sp);
  ex.smoke.push({sp,life:3.2,vx:rand(-.35,.35),vz:rand(-.35,.35)});
}
/* ---------------- note / cctv UI ---------------- */
function openNote(n){
  G.uiLock='note';
  $('noteTitle').textContent=n.title;
  $('noteBody').textContent=n.body;
  $('note').style.display='flex';
  play('paper',{vol:.8});
}
function closeNote(){G.uiLock=null;$('note').style.display='none';ePrev=enterPrev=true;lockPointer();}
let camFloor=0;
function openCCTV(){
  G.uiLock='cctv';camFloor=clamp(player.floor,0,CFG.FLOORS-1);
  $('cctv').style.display='flex';
  if(document.exitPointerLock)document.exitPointerLock();   // free the mouse for the RELEASE button
  updateShutterBtn();
  play('click',{vol:.8});
  if(!G.flags.cctvSeen&&!RESTORING&&!archiveRunning)runCctvArchive();
}
function closeCCTV(){if(archiveRunning){archiveRunning=false;archiveNext=null;$('cctvLog').style.display='none';}G.uiLock=null;$('cctv').style.display='none';ePrev=enterPrev=true;lockPointer();questCheck();}
/* the archive: a timestamped evacuation record that explains the whole building */
/* it only counts once it has played to the end — leave early and it starts over next time */
let archiveRunning=false;
function runCctvArchive(){
  archiveRunning=true;
  const box=$('cctvLog'),txt=$('cctvLogTxt');
  box.style.display='flex';txt.textContent='';
  const lines=[T('cl_h'),T('cl1'),T('cl2'),T('cl3'),T('cl4'),T('cl5')];
  let i=0;
  const step=()=>{
    if(G.uiLock!=='cctv'){box.style.display='none';archiveRunning=false;return;}
    if(i>=lines.length){
      txt.textContent+='\n'+T('cl_note');
      play('click',{vol:.3,force:true});
      G.flags.cctvSeen=true;archiveRunning=false;
      setTimeout(()=>{
        box.style.display='none';
        toast(T('t_objdone'));
        questCheck();           // advances the mission (archive watched) + banner + radio
        cctvAftermath();
        if(G.host&&G.mp)netBroadcast({t:'ev',k:'cctv'});
      },2800);
      return;
    }
    txt.textContent+=lines[i]+'\n';i++;
    play('click',{vol:.2,force:true});
    nx.textContent=T('cl_next');   // wait for [SPACE]
    archiveNext=()=>{archiveNext=null;nx.textContent='';step();};
  };
  const nx=$('cctvLogNext');nx.textContent='';
  archiveNext=null;
  setTimeout(step,500);
}
let archiveNext=null;
/* you leave the terminal… THUMP. Something answers. */
function cctvAftermath(){
  if(!MD.jumpscares||!G.started)return;
  markDanger(player.floor,20);
  setTimeout(()=>{
    if(G.mode!=='playing'||player.dead)return;
    play('clunk',{vol:1});
    player.shakeT=Math.max(player.shakeT,0.35);
    showSub(T('sub_thump'),3);
  },1700);
  setTimeout(()=>{
    if(G.mode!=='playing'||player.dead||player.down)return;
    const f=player.floor;
    const sx=player.pos.x>0?-20:12; // the far end of the corridor, wherever you stand
    const z=spawnZombie(f,sx,rand(-1,1),'shambler',{x0:sx-4,x1:sx+4,z0:-1.6,z1:1.6,door:null});
    z.state='investigate';z.invest={x:player.pos.x*0.5,z:0};z.investT=25;
    play('growl3',{pos:z.g.position,vol:.75,ref:36,rate:0.78});
    showSub(T('sub_farend'),3.5);
  },6500);
}
/* keycards beep. something always answers. */
function directorChase(){
  if(!MD.jumpscares||!G.started)return;
  markDanger(player.floor,25);
  setTimeout(()=>{
    if(!G.started||G.mode!=='playing'||player.dead||player.down||G.flags.victory)return;
    const f=player.floor;
    const n=f>=4?2:1;
    for(let i=0;i<n;i++){
      const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
      const sx=clamp(player.pos.x+(i===0?fx:-fx)*9,-22,14);
      const sz=clamp(player.pos.z+(i===0?fz:-fz)*9,-9,9);
      const z=spawnZombie(f,sx,sz,'runner',{x0:sx-4,x1:sx+4,z0:sz-4,z1:sz+4,door:null});
      z.state='investigate';z.invest={x:player.pos.x,z:player.pos.z};z.investT=30;
    }
    play('snarl',{pos:new THREE.Vector3(player.pos.x,f*CFG.FH,player.pos.z),vol:.8,ref:26});
    showSub(T('sub_card'),3);
  },2600+rand(0,2500));
}

/* ---------------- THE WATCHER — a predator on scripted states ----------------
   lurk: stands where it spawned; if you look at it too long (or get close) it vanishes.
   pursue: full chase for a LIMITED time, then it breaks off.
   Introduced in fragments: a sighting (F5) -> following (F6) -> final chase. */
const WATCHER={z:null,state:'off',seenT:0,timer:0,sighted:false};
function watcherSpawn(f,x,zz,mode){
  if(!MD.jumpscares||G.mp||WATCHER.z)return;
  const w=spawnZombie(f,x,zz,'watcher',{x0:x-5,x1:x+5,z0:zz-5,z1:zz+5,door:null});
  w.state='idle';w.waitT=99999;
  WATCHER.z=w;WATCHER.state=mode;WATCHER.seenT=0;WATCHER.timer=0;
}
function watcherDespawn(){
  if(!WATCHER.z)return;
  const i=world.zombies.indexOf(WATCHER.z);
  if(i>=0)world.zombies.splice(i,1);
  if(world.zmap)world.zmap.delete(WATCHER.z.id);
  if(WATCHER.z.g.parent)WATCHER.z.g.parent.remove(WATCHER.z.g);
  WATCHER.z=null;WATCHER.state='off';
}
function watcherPursue(sec){
  if(!MD.jumpscares||G.mp)return;
  if(!WATCHER.z){
    const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw); // behind you
    watcherSpawn(player.floor,clamp(player.pos.x+fx*10,-22,14),clamp(player.pos.z+fz*10,-9,9),'pursue');
  }
  if(!WATCHER.z)return;
  WATCHER.state='pursue';WATCHER.timer=sec;
  WATCHER.z.state='chase';WATCHER.z.loseT=0;
  play('zroar',{pos:WATCHER.z.g.position,vol:1.2,ref:36});
  showSub(T('w_chase'),3);
  markDanger(player.floor,sec+4);
}
function watcherUpdate(dt){
  if(G.mp)return;
  if(!WATCHER.z){WATCHER.state='off';return;}
  const w=WATCHER.z,g=w.g;
  if(w.dead){WATCHER.z=null;WATCHER.state='off';return;} // you actually killed it. respect.
  const dx=g.position.x-player.pos.x,dz=g.position.z-player.pos.z;
  const d=Math.hypot(dx,dz);
  if(WATCHER.state==='lurk'){
    w.state='idle';w.waitT=99999; // it just stands there. watching.
    const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
    const looking=d>0.1&&(fx*dx+fz*dz)/d>0.75&&d<15&&losClear(player.pos.x,player.pos.z,g.position.x,g.position.z,player.floor);
    if(looking)WATCHER.seenT+=dt;else WATCHER.seenT=Math.max(0,WATCHER.seenT-dt*0.5);
    if((looking&&WATCHER.seenT>1.3)||d<5){
      play('whisper',{vol:.9});
      showSub(T('w_gone'),2.5);
      watcherDespawn();
    }else if(d>22)watcherDespawn();
  }else if(WATCHER.state==='pursue'){
    w.state='chase';w.loseT=0;
    WATCHER.timer-=dt;
    if(player.floor>=CFG.FLOORS&&w.f<CFG.FLOORS){ // you slam the roof door on it
      watcherDespawn();
      play('clunk',{vol:1});
      showSub(T('w_door'),3);
      return;
    }
    if(WATCHER.timer<=0)watcherDespawn(); // it breaks off. this time.
  }
}
function updateShutterBtn(){
  const show=G.flags.power&&!G.flags.shutter&&questAt('q_shutter');
  $('shutterBtn').classList.toggle('hidden',!show);
}
function releaseShutter(){
  if(G.flags.shutter||!G.flags.power||!questAt('q_shutter'))return;
  G.flags.shutter=true;
  const g=world.gates.find(g=>g.f===3);   // the shutter blocks the Floor 3 → 4 stairwell
  if(g)g.unlock();
  play('rumble',{vol:1});
  toast(T('t_shutter'));
  updateShutterBtn();
  if(G.mp&&!G.host)netSend({t:'ev',k:'shutter'});
  if(G.host&&G.mp)netBroadcast({t:'ev',k:'shutter'});
  questCheck();
}
$('shutterBtn').onclick=releaseShutter;
$('camPrev').onclick=()=>{camFloor=(camFloor+CFG.FLOORS-1)%CFG.FLOORS;drawCCTV();};
$('camNext').onclick=()=>{camFloor=(camFloor+1)%CFG.FLOORS;drawCCTV();};
function drawCCTV(){
  const cv=$('cctvC'),x=cv.getContext('2d'),W=cv.width,H=cv.height;
  x.fillStyle='#02120a';x.fillRect(0,0,W,H);
  const lay=world.layout[camFloor];
  const s=15.5,ox=W/2,oz=H/2;
  const mx=px=>ox+px*s,mz=pz=>oz+pz*s;
  x.strokeStyle='#1d5c31';x.lineWidth=2;
  x.strokeRect(mx(-24),mz(-10),48*s,20*s);
  x.strokeStyle='#2f8c49';
  x.strokeRect(mx(-24),mz(-1.6),40*s,3.2*s); // corridor
  x.strokeRect(mx(16),mz(-2.5),8*s,5*s);     // tower
  for(const r of lay.rooms){x.strokeRect(mx(r.x0),mz(Math.min(r.z0,r.z1)),(r.x1-r.x0)*s,Math.abs(r.z1-r.z0)*s);}
  x.fillStyle='#3f7a4f';x.font='12px Consolas,monospace';
  lay.rooms.forEach((r,i)=>{x.fillText(r.name||('ROOM '+(i+1)),mx((r.x0+r.x1)/2)-30,mz((r.z0+r.z1)/2)+4);});
  // zombies
  const pulse=1+Math.sin(G.time*5)*0.4;
  for(const z of world.zombies){
    if(z.dead||z.f!==camFloor)continue;
    x.fillStyle=z.state==='chase'?'#ff4a3a':'#ff9a3a';
    x.beginPath();x.arc(mx(z.g.position.x),mz(z.g.position.z),3.4*pulse,0,TAU);x.fill();
  }
  // survivors nobody has named on the feed: a cold blue dot, no label — who is that?
  for(const npc of world.npcs||[]){
    if(npc.gone||npc.corpse||npc.f!==camFloor)continue;
    const q=npc.parts.g.position;
    x.fillStyle='#7ec8ff';x.shadowColor='#7ec8ff';x.shadowBlur=8;
    x.beginPath();x.arc(mx(q.x),mz(q.z),4,0,TAU);x.fill();x.shadowBlur=0;
  }
  // players: you, and every friend with their name
  x.font='bold 12px Consolas,monospace';
  const dot=(px,pz,name,me)=>{
    x.fillStyle=me?'#59ff7a':'#d6ff5a';
    x.beginPath();x.arc(mx(px),mz(pz),4.6,0,TAU);x.fill();
    x.strokeStyle='#02120a';x.lineWidth=1.5;x.stroke();
    x.fillStyle=me?'#9dffb4':'#ecff9a';x.fillText(name,mx(px)+7,mz(pz)-6);
  };
  if(player.floor===camFloor&&!player.spec)dot(player.pos.x,player.pos.z,G.mp?(G.myName||T('cc_you')):T('cc_you'),true);
  if(G.mp)for(const r of net.remotes.values()){
    if((r.f||0)!==camFloor||r.spec||r.dead)continue;
    dot(r.x,r.z,r.name||'?',false);
  }
  // noise + scanlines
  x.fillStyle='rgba(120,255,150,0.05)';
  for(let i=0;i<40;i++)x.fillRect(rand(0,W),rand(0,H),rand(20,90),1);
  x.fillStyle='rgba(0,0,0,0.22)';
  for(let yy=0;yy<H;yy+=4)x.fillRect(0,yy,W,2);
  $('cctvLbl').textContent=T('cctv_cam',{n:String(camFloor).padStart(2,'0'),m:camFloor>=CFG.FLOORS?T('fl_roof'):(camFloor===0?T('fl_ground'):T('floor',{n:camFloor}))});
}

/* ---------------- events (scripted scares) ---------------- */
let hordeDone=false,finaleDone=false;
const blackoutDone=new Set();
const BLACKOUTS=new Set([1,3]);
let jieunHintT=8;
let ambT=20;
let scareT=95;
function updateEvents(dt){
  if(G.paused)return; // a chapter comic is up: the world holds its breath
  storyProximity();
  // blackouts (scary only — lite gets a harmless blink)
  if(BLACKOUTS.has(player.floor)&&!blackoutDone.has(player.floor)&&G.started&&G.time>8){
    blackoutDone.add(player.floor);
    if(MD.jumpscares){
      play('whisper',{vol:1});
      lightsOut(player.floor,4200,()=>play('clang',{vol:.7}));
      const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
      let zx=clamp(player.pos.x-fx*6,-22,14),zz=clamp(player.pos.z-fz*6,-9,9);
      const sp=nearFree(player.floor,zx,zz);zx=sp[0];zz=sp[1];
      spawnZombie(player.floor,zx,zz,'shambler',{x0:zx-4,x1:zx+4,z0:zz-4,z1:zz+4,door:null});
      showSub(T('sub_behind'),3.5);
    }else{
      play('beep',{vol:.5});
      lightsOut(player.floor,900);
      showSub(T('sub_blink'),2);
    }
  }
  // CONTAINMENT BREACH — Floor 5, the lab. Multiple doors, staged.
  if(!hordeDone&&player.floor===5&&G.flags.horde5)hordeDone=true;   // co-op: the breach happens once, for the whole team
  if(!hordeDone&&player.floor===5){
    hordeDone=true;G.flags.horde5=true;netFlag('horde5');
    markDanger(5,60);
    play('alarm',{vol:1,force:true});setTimeout(()=>play('alarm',{vol:.8,force:true}),2100);
    toast(T(MD.jumpscares?'t_horde':'t_horde_l'));
    // first one door… then another… then the corridor
    const waves=[[2600,2],[5200,2],[8400,3]];
    for(const[delay,n]of waves){
      setTimeout(()=>{
        if(!G.started||G.mode!=='playing')return;
        for(let i=0;i<n;i++){
          const z=spawnZombie(5,rand(-20,14),pick([rand(-1,1),rand(3,8),rand(-8,-3)]),'runner',{x0:-22,x1:15,z0:-9,z1:9,door:null});
          z.state='investigate';z.invest={x:player.pos.x,z:player.pos.z};z.investT=40;
        }
        play('stinger',{vol:.6,force:true});
      },delay);
    }
    radio(T(MD.jumpscares?'radio_horde':'radio_horde_l'));
  }
  // JI-EUN — small sounds from her hiding room while you search (spatial: follow your ears)
  if(player.floor===5&&G.started&&!G.flags.jieunFound){
    jieunHintT-=dt;
    if(jieunHintT<=0){
      jieunHintT=rand(15,24);
      const je=npcByKey('jieun');
      if(je){
        const p=je.parts.g.position,at=new THREE.Vector3(p.x,5*CFG.FH+0.6,p.z);
        play(Math.random()<0.5?'clunk':'whisper',{pos:at,vol:.9,ref:22,rate:rand(1.0,1.4)});
        if(!G.jieunSub){G.jieunSub=true;showSub(T('jieun_sub'),4.5);}
        else if(Math.random()<0.45)showSub(T('jieun_whisper'),3.5);
      }
    }
  }
  // finale: the roof — they were already up here
  if(!finaleDone&&player.floor===CFG.FLOORS){
    finaleDone=true;G.flags.finale=true;
    markDanger(CFG.FLOORS,9999);
    questCheck();
    play('alarm',{vol:1,force:true});
    if(MD.jumpscares)setTimeout(()=>play('thunder',{vol:.8}),1200);
    setLoop('chopper',0.35);
    radio(T('radio_finale'));
    G.flareT=0;G.waveT=ROOF.FIRST_WAVE;G.roofSpawned=3;G.flags.roofBrute=G.flags.roofWatcher=false;   // the 3 below count toward ROOF.TOTAL
    if(!G.mp||G.host){
      for(let i=0;i<3;i++){
        const z=spawnZombie(CFG.FLOORS,rand(-21,-10),rand(-8,8),i===2?'shambler':'runner',ROOF_AREA);
        z.state='chase';
      }
    }
  }
  // F5 — THE WATCHER: first true sighting, after Ji-eun's warning
  if(hordeDone&&G.flags.jieunTalked&&!WATCHER.sighted&&WATCHER.state==='off'&&player.floor===5&&G.started){
    WATCHER.sighted=true;
    setTimeout(()=>{
      if(!G.started||G.mode!=='playing'||player.floor!==5)return;
      const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
      watcherSpawn(5,clamp(player.pos.x+fx*13,-22,14),clamp(player.pos.z+fz*13,-9,9),'lurk');
      showSub(T('w_seen'),4.5);
      play('zbreath',{vol:.8,ref:26,rate:0.6});
    },14000);
  }
  // F6 — the Watcher is following now
  if(player.floor===6&&G.started&&MD.jumpscares&&!G.mp){
    if(!G.flags.w6a&&G.time>10){
      G.flags.w6a=true;
      setTimeout(()=>{
        if(!G.started||player.floor!==6)return;
        const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
        watcherSpawn(6,clamp(player.pos.x+fx*12,-22,14),clamp(player.pos.z+fz*12,-9,9),'lurk');
        showSub(T('w_seen'),4.5);
      },24000);
    }
    if(!G.flags.w6b&&G.gatesOpen.has(6)){ // the final gate is open — it stops hiding
      G.flags.w6b=true;
      radio(T('radio_wait'));
      setTimeout(()=>watcherPursue(24),2000);
    }
  }
  // tension layer follows the nearest hunting enemy — swells as it closes, dissolves when you slip away
  if(MD.jumpscares){
    let chD=1e9;
    for(const z of world.zombies)if(!z.dead&&z.state==='chase'&&Math.abs(z.f-player.floor)<=1){
      const dd=dist2(z.g.position.x,z.g.position.z,player.pos.x,player.pos.z);
      if(dd<chD)chD=dd;
    }
    setLoop('tension',chD<1e8?0.07*clamp(1-Math.sqrt(chD)/22,0.12,1):0);
  }
  // strategic ambience: the building talks — distant moans, impacts, settling doors.
  // Quiet and occasional; every sound is a question the player has to answer.
  ambT-=dt;
  if(ambT<=0){
    ambT=rand(18,42);
    const roll=Math.random();
    const farA=rand(0,TAU),farR=rand(16,26);
    const farP=new THREE.Vector3(player.pos.x+Math.cos(farA)*farR,player.floor*CFG.FH,player.pos.z+Math.sin(farA)*farR);
    if(roll<0.38)play(pick(['growl1','growl2']),{pos:farP,vol:.5,ref:60,rate:0.65}); // a long moan, far away… or is it?
    else if(roll<0.56)play('zbreath',{pos:farP,vol:.55,ref:46,rate:0.8});  // something exhales out there
    else if(roll<0.72)play('clang',{pos:farP,vol:.45,ref:34});             // a distant impact
    else if(roll<0.88)play('creak',{pos:farP,vol:.5,ref:26,rate:0.9});     // a door settling somewhere
    else if(roll<0.97)play('scream',{pos:farP,vol:.42,ref:60,rate:0.6});   // a distant scream, drawn out
    // and sometimes: nothing at all. Silence is worse.
  }
  // random ambience — strategic: the building talks
  // director scares: controlled, paced — never a constant drumbeat
  scareT-=dt;
  if(scareT<=0){
    scareT=rand(75,140);
    if(MD.jumpscares&&G.started&&!G.flags.victory&&!player.dead&&!player.down)ambientScare();
  }
}

/* one controlled scare, chosen to keep the player guessing */
function ambientScare(){
  const roll=Math.random();
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
  if(roll<0.3){
    // a figure crosses the hallway far ahead, unhurried, indifferent to you
    const px=clamp(player.pos.x+fx*11,-22,14),pz=clamp(player.pos.z+fz*11,-1.2,1.2);
    const perpX=-fz,perpZ=fx;
    const sx=clamp(px+perpX*6,-22,14),sz=clamp(pz+perpZ*6,-8,8);
    const ex=clamp(px-perpX*6,-22,14),ez=clamp(pz-perpZ*6,-8,8);
    const sp=nearFree(player.floor,sx,sz);
    const z=spawnZombie(player.floor,sp[0],sp[1],'shambler',{x0:sx-3,x1:sx+3,z0:sz-3,z1:sz+3,door:null});
    z.state='investigate';z.invest={x:ex,z:ez};z.investT=12;
    play('zstep',{pos:new THREE.Vector3(sx,player.floor*CFG.FH,sz),vol:.8,ref:24,rate:0.8});
  }else if(roll<0.55){
    // footsteps approach… then nothing. No one is there.
    let dly=400;
    for(let i=1;i<=5;i++){
      const dd=9-i*1.6;
      const sxp=player.pos.x+fx*dd,szp=player.pos.z+fz*dd;
      setTimeout(()=>{if(G.started&&G.mode==='playing')play('zstep',{pos:new THREE.Vector3(sxp,player.floor*CFG.FH,szp),vol:.55+i*0.08,ref:18,rate:0.85});},dly);
      dly+=i<3?520:380;
    }
    setTimeout(()=>{if(G.started)showSub(T('sub_steps'),2.5);},dly+300);
  }else if(roll<0.8){
    // the lights die for a breath
    lightsOut(player.floor,1600);
    play('whisper',{vol:.7});
  }else{
    // a door creaks somewhere near — closed, but not locked
    const cand=world.doors.filter(d=>d.f===player.floor&&!d.open&&!d.boarded);
    if(cand.length){const d=pick(cand);play('creak',{pos:d.g.position,vol:.7,ref:16,rate:0.8});}
    else play('creak',{vol:.5});
  }
}

/* ---------------- director: scripted beats (semi-scripted — never moves the player) ---------------- */
const directorDone=new Set();
function directorBeat(f){
  if(directorDone.has(f)||!G.started)return;
  directorDone.add(f);
  const scary=MD.jumpscares;
  if(f===1){
    // FIRST CONTACT: only after the player has light and has looked around a bit
    if(scary){
      setTimeout(()=>{
        if(!G.started||G.mode!=='playing'||player.floor!==1||player.dead)return;
        const cand=world.doors.filter(d=>d.f===1&&!d.open&&!d.boarded);
        if(cand.length){
          const d=pick(cand);d.setOpen(true,true);
          const p=doorPoint(d);
          const z=spawnZombie(1,p.x+(p.z>0?1:-1)*1.2,p.z+(p.z>0?1.2:-1.2),'runner',{x0:p.x-4,x1:p.x+4,z0:2,z1:9,door:null});
          z.state='investigate';z.invest={x:player.pos.x,z:player.pos.z};z.investT=30;
        }
        play('stinger',{vol:1});
        player.shakeT=0.5;
        markDanger(1,20);
        showSub(T('sub_saw'),3);
      },20000+rand(0,15000));
    }
  }else if(f===3){
    // MR. PARK — a weak voice right by the stairwell as you arrive
    setTimeout(()=>{
      if(!G.started||G.mode!=='playing'||player.floor!==3||G.flags.parkTurned)return;
      const npc=npcByKey('park');if(!npc)return;
      const c=npc.center();
      play('hurt',{pos:new THREE.Vector3(c.x,3*CFG.FH+0.3,c.z),vol:.7,ref:16,rate:0.75});
      showSub(T('park_moan'),4);
    },1400);
  }else if(f===4){
    // the dark floor loses even its battery exit lights for a few seconds
    setTimeout(()=>{
      if(!G.started||G.mode!=='playing'||player.floor!==4)return;
      play('whisper',{vol:1});
      radio(T('radio_powerfail'));
      markDanger(4,30);
      lightsOut(4,5000,()=>play('clunk',{vol:.7}));
    },18000+rand(0,12000));
  }
}

/* ---------------- threat ring ---------------- */
const ringCtx=$('ring').getContext('2d');
function drawRing(){
  const c=ringCtx,S=280,cx=S/2,cy=S/2,R=96;
  ringCtx.clearRect(0,0,S,S);
  if(G.mode!=='playing')return;
  const N=24,seg=TAU/N;
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
  const levels=new Float32Array(N),cols=new Uint8Array(N);
  for(const z of world.zombies){
    if(z.dead||z.f!==player.floor)continue;
    const dx=z.g.position.x-player.pos.x,dz=z.g.position.z-player.pos.z;
    const d=Math.hypot(dx,dz);
    if(d>11||d<0.4)continue; // short "senses" range — the dark hides them, your ears find them
    const dot=(fx*dx+fz*dz)/d,cross=fx*dz-fz*dx;
    const rel=Math.atan2(cross,dot);
    let i=Math.round(((rel+Math.PI)/TAU)*N)%N;
    let inten;
    if(z.state==='chase')inten=0.9;
    else if(z.state==='investigate')inten=0.5;
    else inten=d<6?0.3:0.15;
    if(inten>levels[i]){levels[i]=inten;cols[i]=z.state==='chase'?1:0;}
  }
  // one-time explanations of the ring
  if(!G.ringTipA){for(let i=0;i<N;i++)if(levels[i]>0){G.ringTipA=1;toast(T(MD.id==='lite'?'ring_al':'ring_a'));break;}}
  if(!G.ringTipB){for(let i=0;i<N;i++)if(cols[i]===1){G.ringTipB=1;toast(T(MD.id==='lite'?'ring_bl':'ring_b'));break;}}
  // objective marker (amber chevron) — only nearby, or when pointing at the stairwell
  const qt=questTarget(),wd=waypointDir();
  const showWp=G.helpOpen&&qt&&wd&&(qt.up||qt.down||wd.dist<32); // no GPS: far objectives live on the signs & the radio
  if(!G.helpOpen){const wp=$('wpText');if(wp)wp.style.display='none';}   // the arrow is part of the help: [I]
  else if(qt&&qt.search){
    const wp=$('wpText');
    if(wp){wp.textContent=T('wp_search',{f:floorName(qt.floor)});wp.style.color='#ffcf7a';wp.style.display='block';}
  }else if(showWp){
    const d=wd?wd.dist:0;
    if(wd){
      const ang=wd.rel-Math.PI/2;
      const R2=114,px2=cx+Math.cos(ang)*R2,py2=cy+Math.sin(ang)*R2;
      ringCtx.save();
      ringCtx.translate(px2,py2);ringCtx.rotate(ang+Math.PI/2);
      ringCtx.beginPath();ringCtx.moveTo(0,-11);ringCtx.lineTo(9,7);ringCtx.lineTo(0,3);ringCtx.lineTo(-9,7);ringCtx.closePath();
      ringCtx.fillStyle=qt.up?'rgba(255,210,63,.95)':'rgba(255,180,90,.85)';
      ringCtx.strokeStyle='rgba(0,0,0,.75)';ringCtx.lineWidth=2;
      ringCtx.fill();ringCtx.stroke();
      ringCtx.restore();
    }
    const wp=$('wpText');
    if(wp){
      if(qt.up&&!qt.down&&qt.floor>=CFG.FLOORS){wp.textContent=T('wp_roof');wp.style.color='#9fd0ff';}
      else if(qt.up){
        wp.textContent=T(qt.down?'wp_down':'wp_up',{f:floorName(qt.floor)});
        wp.style.color=qt.down?'#9fd0ff':'#ffd23f';
      }else{
        wp.textContent=T('wp_here',{d:Math.round(d)});
        wp.style.color='#ffcf7a';
      }
      wp.style.display='block';
    }
  }else{const wp=$('wpText');if(wp)wp.style.display='none';}
  for(let i=0;i<N;i++){
    if(levels[i]<=0.01)continue;
    const a0=i*seg-Math.PI/2-seg*0.38,a1=i*seg-Math.PI/2+seg*0.38;
    ringCtx.beginPath();
    ringCtx.arc(cx,cy,R,a0,a1);
    ringCtx.strokeStyle=cols[i]?`rgba(${MD.ringC},${levels[i]})`:`rgba(${MD.ringW},${levels[i]})`;
    ringCtx.lineWidth=9;
    ringCtx.shadowColor=cols[i]?`rgba(${MD.ringC},.9)`:`rgba(${MD.ringW},.7)`;
    ringCtx.shadowBlur=8*levels[i];
    ringCtx.stroke();
    ringCtx.shadowBlur=0;
  }
}

/* ---------------- pings ---------------- */
function addPing(x,z,f,sender){
  const m=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.05,6,24),new THREE.MeshBasicMaterial({color:0x59ff7a}));
  m.rotation.x=Math.PI/2;m.position.set(x,groundAt(x,z,groundApproxFor(f))+0.1,z);
  scene.add(m);
  pings.push({m,t:6,f});
  play('click',{vol:.5});
  if(sender)toast(T('t_ping',{n:sender,f:floorName(f)}));
}
function groundApproxFor(f){return f*CFG.FH;}
function updatePings(dt){
  for(let i=pings.length-1;i>=0;i--){
    const p=pings[i];p.t-=dt;
    p.m.material.opacity=clamp(p.t,0,1);
    p.m.material.transparent=true;
    p.m.scale.setScalar(1+Math.sin(G.time*4)*0.15);
    p.m.visible=Math.abs(p.f-player.floor)<=1;
    if(p.t<=0){scene.remove(p.m);pings.splice(i,1);}
  }
}

/* ---------------- victory: pickup → lift-off → sleep → the winner screen ---------------- */
function doVictory(){
  if(G.flags.victory)return;
  G.flags.victory=true;
  clearSave();
  document.exitPointerLock&&document.exitPointerLock();
  if(G.mp&&!G.host)netSend({t:'ev',k:'vic'});
  if(G.host&&G.mp)netBroadcast({t:'ev',k:'vic'});
  startEnding();
}
let ending=null;
const _eA=new THREE.Vector3(),_eB=new THREE.Vector3();
const smooth01=k=>{k=clamp(k,0,1);return k*k*(3-2*k);};
function startEnding(){
  const ex=world.extract,h=world.heli;
  if(!ex||!h||typeof getComputedStyle!=='function'){showVictory();return;}   // (headless tests: straight to the result)
  camera.getWorldDirection(_eA);
  const je=companion();
  if(je)G.flags.jieunEscaped=true;
  // it comes down a few metres in front of you, so you watch it arrive
  const fwd=new THREE.Vector3(_eA.x,0,_eA.z);if(fwd.lengthSq()<1e-4)fwd.set(0,0,-1);fwd.normalize();
  const eye=camera.position;
  ending={t:0,sub:0,from:eye.clone(),look0:eye.clone().addScaledVector(_eA,6),fwd,
    hover:new THREE.Vector3(eye.x+fwd.x*4.5,CFG.ROOF_Y+5.2,eye.z+fwd.z*4.5),je,
    fly:new THREE.Vector3(-0.55,0,-0.83),lift:null};
  G.uiLock='ending';
  try{document.body.classList.add('cine');}catch(_){}
  const c=$('cine');if(c){c.style.display='block';$('cineFade').style.opacity=0;$('lidT').style.height=$('lidB').style.height='0%';$('cineSkip').textContent=T('end_skip');}
  $('giveMed')&&($('giveMed').style.display='none');
  setLoop('chopper',1);
  // a rope ladder under the helicopter
  if(!h.ladder){
    const lad=new THREE.Group(),rm=new THREE.MeshStandardMaterial({color:0x8a7a5a,roughness:1});
    for(const sx of [-0.22,0.22]){const r=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,3.6,5),rm);r.position.set(sx,-1.8,0);lad.add(r);}
    for(let i=0;i<9;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.04,0.05),rm);s.position.set(0,-0.3-i*0.38,0);lad.add(s);}
    lad.position.set(0,-0.6,0.6);lad.visible=false;h.g.add(lad);h.ladder=lad;
  }
  if(!h.nav){ // nav lights + a visible searchlight beam (meshes only: the light count never changes)
    const nm=c=>new THREE.MeshBasicMaterial({color:c});
    const red=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),nm(0xff2020));red.position.set(0.3,-1.0,1.56);
    const grn=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),nm(0x20ff60));grn.position.set(0.3,-1.0,-1.56);
    const bcn=new THREE.Mesh(new THREE.SphereGeometry(0.2,8,6),nm(0xff3020));bcn.position.set(0,-2.55,0);
    const wht=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,6),nm(0xffffff));wht.position.set(-5.6,0.4,0);
    const winM=nm(0xffd890);   // lit cabin windows on both sides
    for(const sz of [1.47,-1.47]){const w=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.42,0.05),winM);w.position.set(0.7,-0.6,sz);h.g.add(w);}
    const cone=new THREE.Mesh(new THREE.ConeGeometry(2.8,9,24,1,true),new THREE.MeshBasicMaterial({color:0xfff2cc,transparent:true,opacity:0.08,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    cone.position.set(0,-6.5,0);
    h.g.add(red,grn,bcn,wht,cone);h.nav={wht,bcn,cone};
  }
  if(vm)vm.visible=false;   // no gun in your hands on the way out
  if(MAT.heli){MAT.heli.emissive.setHex(0x2a3a2c);MAT.heli.emissiveIntensity=1;}   // readable against the night sky
  if(world.roofGroup)world.roofGroup.visible=true;
}
function endSub(key){showSub('<i>'+T(key+(MD.id==='lite'&&I18N.en[key+'l']?'l':''))+'</i>',4.2,true);}
function updateEnding(dt){
  const E=ending,h=world.heli,ex=world.extract;
  E.t+=dt;const t=E.t;
  h.rotor.rotation.y+=dt*24;h.rotor2.rotation.y+=dt*24;
  h.nav.wht.visible=(t*1.2)%1<0.12;h.nav.bcn.visible=(t*0.9+0.5)%1<0.5;
  h.nav.cone.material.opacity=0.08*clamp(1-(t-8)/2,0,1);
  if(camFill)camFill.intensity=t>3.9&&t<7.6?2.5:0;
  // the story, line by line
  const SUBS=[[0.4,'end_1'],[4.2,'end_2'],[8.4,E.je?'end_3j':(G.flags.jieunKilled?'end_3k':'end_3n')],[13.6,'end_4'],[18.6,'end_5']];
  while(E.sub<SUBS.length&&t>=SUBS[E.sub][0]){endSub(SUBS[E.sub][1]);E.sub++;}
  updateSub(dt);
  // the helicopter: down to the roof, wait, then up and away over the city
  if(t<7.6){h.g.position.lerp(E.hover,Math.min(1,dt*1.4));if(t>2.2)h.ladder.visible=true;}
  else{
    if(!E.lift){E.lift=h.g.position.clone();h.ladder.visible=false;}
    const k=t-7.6;
    h.g.position.set(E.lift.x+E.fly.x*k*k*0.55,E.lift.y+k*1.7+k*k*0.1,E.lift.z+E.fly.z*k*k*0.55);
    h.g.rotation.y+=angDiff(h.g.rotation.y,Math.atan2(-E.fly.z,E.fly.x))*Math.min(1,dt*0.8);
    h.g.rotation.z=Math.sin(t*0.7)*0.04;
  }
  const hp=h.g.position,fade=$('cineFade');
  if(E.je&&t>5.2&&E.je.parts.g.visible){E.je.parts.g.visible=false;E.je.label.visible=false;if(E.je.bar)E.je.bar.visible=false;}   // she climbs up after you
  if(t<3.9){                                   // you look up at it
    _eB.copy(E.look0).lerp(_eA.set(hp.x,hp.y-0.6,hp.z),smooth01(t/2.4));
    camera.position.copy(E.from);camera.position.y+=Math.sin(t*19)*0.012;
    camera.lookAt(_eB);
  }else if(t<7.6){                             // hauled up the ladder, the roof falling away beneath you
    const k=smooth01((t-3.9)/3.5);
    const tx=E.hover.x-E.fwd.x*1.3,ty=E.hover.y-2.4,tz=E.hover.z-E.fwd.z*1.3;   // up the ladder, to the door
    camera.position.set(lerp(E.from.x,tx,k),lerp(E.from.y,ty,Math.pow(k,1.3)),lerp(E.from.z,tz,k));
    camera.position.x+=Math.sin(t*2.3)*0.08*(1-k);
    _eB.set(hp.x,hp.y-1,hp.z).lerp(_eA.set(E.from.x-E.fwd.x*3,CFG.ROOF_Y,E.from.z-E.fwd.z*3),smooth01((t-4.4)/2.2));   // then down: the roof falling away
    camera.lookAt(_eB);
    if(fade)fade.style.opacity=clamp((t-6.8)/0.7,0,1);
  }else if(t<13.4){                            // outside: it climbs away from Seowon High
    camera.position.set(ex.x+7,CFG.ROOF_Y+4.5+(t-7.6)*1.4,ex.z+9);
    camera.lookAt(_eB.set(ex.x,CFG.ROOF_Y,ex.z).lerp(hp,0.88));   // the helicopter, the lit circle below it
    if(fade)fade.style.opacity=clamp(1-(t-7.6)/0.8,0,1);
  }else{                                       // inside: the school behind you, your eyes closing
    camera.position.set(hp.x+E.fly.z*1.9,hp.y-0.5,hp.z-E.fly.x*1.9);   // at the open side door
    camera.lookAt(_eA.set(ex.x,CFG.ROOF_Y,ex.z));   // the red flare on the roof, shrinking
    if(!E.muffled){E.muffled=true;setLoop('chopper',0.4);}
    if(t>17&&!E.quiet){E.quiet=true;setLoop('chopper',0.15);}
    const base=smooth01((t-13.6)/6.2)*50;
    let lid=base*0.85;
    for(const [bt,amp] of [[15.2,22],[17,26],[18.5,30]])lid+=amp*Math.max(0,1-Math.abs(t-bt)/0.35);
    if(t>19.8)lid=50;
    const pct=Math.min(50,lid)+'%';
    $('lidT').style.height=pct;$('lidB').style.height=pct;
    if(!E.beat&&t>16){E.beat=true;play('heart',{vol:.35,rate:.8,force:true});setTimeout(()=>play('heart',{vol:.25,rate:.75,force:true}),1300);}
  }
  if(t>22.2)showVictory();
}
function skipEnding(){if(ending&&ending.t>1)showVictory();}
function showVictory(){
  ending=null;
  G.uiLock=null;
  try{document.body.classList.remove('cine');}catch(_){}
  const c=$('cine');if(c)c.style.display='none';
  setLoop('chopper',0);
  play('win',{vol:1,force:true});
  const lite=MD.id==='lite';
  if($('vicH'))$('vicH').textContent=T('vic_h');
  if($('vicP'))$('vicP').textContent=T(lite?'vic_subl':'vic_sub');
  let je='';
  if(G.flags.jieunFound){
    const k=G.flags.jieunKilled?'je_killed':(G.flags.jieunDead?(lite?'je_out':'je_turned'):((G.flags.jieunEscaped||companion())?'je_saved':'je_left'));
    je=T('st_je')+'<b>'+T(k)+'</b><br>';
  }
  $('vicStats').innerHTML=
    T('st_time')+'<b>'+fmtTime(G.time)+'</b><br>'+
    (lite?T('st_killsl'):T('st_kills'))+'<b>'+G.stats.kills+'</b><br>'+
    T('st_down')+'<b>'+G.stats.deaths+'</b><br>'+je+
    (G.mp?T('st_squad',{n:1+net.remotes.size}):T('st_solo'));
  $('victory').style.display='flex';
}
let hudT=0;
function hudTick(dt){ // bars move on their own (battery drain, stamina) — refresh a few times a second
  updateChoice(dt);
  hudT-=dt;
  if(hudT<=0){hudT=0.12;hudStats();updateGiveMedBtn();if(G.mp)voiceTick();}
}

/* =====================================================================
   SECTION F — NETWORKING · MENUS · MAIN LOOP
===================================================================== */
let NETAPPLY=false;
function netEv(fn){NETAPPLY=true;try{fn();}finally{NETAPPLY=false;}}
function netSend(msg){if(NETAPPLY)return;if(net.con&&net.con.open)net.con.send(msg);}
function netBroadcast(msg){if(NETAPPLY)return;for(const c of net.conns)if(c.open)c.send(msg);}
const net={peer:null,con:null,conns:[],remotes:new Map(),code:null,ready:false,posT:0,snapT:0,cid:1};
// STUN servers reachable both inside and outside China (Google's alone is blocked there, so peers
// on different networks never found a route and the join just hung). PeerJS's TURN kept as a last resort.
const PEER_OPTS={debug:0,config:{iceServers:[
  {urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']},
  {urls:['stun:stun.miwifi.com:3478','stun:stun.chat.bilibili.com:3478']},
  {urls:'turn:eu-0.turn.peerjs.com:3478',username:'peerjs',credential:'peerjsp'},
]}};
const RELAY_AFTER_MS=6000;   // no direct route by then: switch to the relay

/* ---- RELAY: when two computers can't talk directly (VPN / proxy apps in TUN mode, campus Wi-Fi that
   isolates devices, strict NAT), all co-op traffic goes through a free public MQTT broker over secure
   WebSocket instead. That is plain HTTPS-like traffic, so it passes through VPNs and proxies.
   Slower than direct (~0.1–0.3 s), so snapshots are thinned; the game itself does not change.
   Note: public brokers are unauthenticated — only game state travels, keyed by the room code. */
const RELAY_BROKERS=['wss://broker-cn.emqx.io:8084/mqtt','wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt'];
const RELAY_ROOT='rooftop-escape/v1/';
const relayClients=[];
function relayConnect(url){
  return new Promise((res,rej)=>{
    if(typeof mqtt==='undefined'){rej(new Error('no mqtt'));return;}
    let done=false,c;
    try{c=mqtt.connect(url,{connectTimeout:7000,reconnectPeriod:2000,keepalive:20,clean:true,clientId:'re_'+Math.random().toString(16).slice(2,12)});}
    catch(e){rej(e);return;}
    const fin=(ok,v)=>{if(done)return;done=true;if(ok)res(c);else{try{c.end(true);}catch(_){}rej(v);}};
    c.once('connect',()=>fin(true));
    c.once('error',e=>fin(false,e));
    setTimeout(()=>fin(false,new Error('timeout')),8000);
  });
}
/* looks like a PeerJS DataConnection (open · send · on('data'|'close')), so the game code doesn't care */
class RelayConn{
  constructor(client,outTopic,me){
    this.client=client;this.out=outTopic;this.me=me;this.open=true;this.relay=true;this.h={};
    this.last=performance.now();this.snapAt=0;this.posAt=0;
    this.tick=performance.now();
    this.pingT=setInterval(()=>{
      if(!this.open)return;
      const now=performance.now();
      if(now-this.tick>5000)this.last=now;   // WE were frozen (loading the world), not them: don't count it
      this.tick=now;
      this._pub({t:'_ping'},0);
      if(now-this.last>25000)this.close(true);   // nothing heard for 25 s: gone
    },2500);
  }
  on(ev,fn){(this.h[ev]=this.h[ev]||[]).push(fn);return this;}
  emit(ev,a){for(const f of (this.h[ev]||[]))f(a);}
  _pub(msg,qos){this.seq=(this.seq||0)+1;try{this.client.publish(this.out,JSON.stringify({f:this.me,s:this.seq,d:msg}),{qos});}catch(_){}}
  seen(s){if(!s)return false;this.got=this.got||new Set();if(this.got.has(s))return true;this.got.add(s);if(this.got.size>400)this.got.delete(this.got.values().next().value);return false;}
  send(msg){
    if(!this.open)return;
    const now=performance.now();
    if(msg&&msg.t==='snap'){if(now-this.snapAt<160)return;this.snapAt=now;this._pub(msg,0);return;}   // ~6 Hz is plenty
    if(msg&&msg.t==='pos'){if(now-this.posAt<90)return;this.posAt=now;this._pub(msg,0);return;}
    if(msg&&msg.t==='vo'){this._pub(msg,0);return;}
    this._pub(msg,1);   // events, chat, lobby: delivered at least once
  }
  recv(d){
    this.last=performance.now();
    if(!d||d.t==='_ping')return;
    if(d.t==='_bye'){this.close(false);return;}
    this.emit('data',d);
  }
  close(sayBye=true){
    if(!this.open)return;
    if(sayBye)this._pub({t:'_bye'},0);
    this.open=false;clearInterval(this.pingT);
    this.emit('close');
  }
}
/* host: listen on every broker we can reach, so a guest on any of them finds the room */
function relayHost(code){
  const inTopic=RELAY_ROOT+code+'/h';
  for(const url of RELAY_BROKERS){
    relayConnect(url).then(c=>{
      if(!G.host||net.hostCode!==code){try{c.end(true);}catch(_){}return;}
      relayClients.push(c);
      const guests=new Map();
      c.subscribe(inTopic,{qos:1});
      c.on('message',(topic,buf)=>{
        let m;try{m=JSON.parse(buf.toString());}catch(_){return;}
        if(!m||!m.f||!m.d)return;
        let con=guests.get(m.f);
        if(!con||!con.open){
          if(m.d.t!=='hello')return;
          con=new RelayConn(c,RELAY_ROOT+code+'/g/'+m.f,'H');guests.set(m.f,con);
          acceptConn(con);
        }
        if(!con.seen(m.s))con.recv(m.d);
      });
      hostReady(code);   // the lobby opens even if the direct-connection server is unreachable
    }).catch(()=>{});
  }
}
/* guest: try each broker in turn — say hello, wait for the host's welcome */
async function relayJoin(code,tok,onUp){
  const gid=Math.random().toString(36).slice(2,10);
  for(const url of RELAY_BROKERS){
    if(net.joinTok!==tok||net.ready)return;
    let c;try{c=await relayConnect(url);}catch(_){continue;}
    if(net.joinTok!==tok||net.ready){try{c.end(true);}catch(_){}return;}
    const con=new RelayConn(c,RELAY_ROOT+code+'/h',gid);
    const welcomed=await new Promise(res=>{
      c.subscribe(RELAY_ROOT+code+'/g/'+gid,{qos:1},()=>{
        c.on('message',(topic,buf)=>{let m;try{m=JSON.parse(buf.toString());}catch(_){return;}if(m&&m.d&&!con.seen(m.s))con.recv(m.d);});
        con.on('data',d=>{if(d&&d.t==='welcome'){con.welcome=d;res(true);}});
        con.send({t:'hello',name:G.myName});
        setTimeout(()=>res(false),6000);
      });
    });
    if(welcomed&&net.joinTok===tok){relayClients.push(c);onUp(con);return;}
    con.open=false;clearInterval(con.pingT);try{c.end(true);}catch(_){}
  }
  if(net.joinTok===tok&&!net.ready)menuMsg(T('msg_p2pfail'));
}
addEventListener('pagehide',()=>{   // tell the other side at once instead of letting it time out
  for(const c of net.conns)if(c.relay)c.close(true);
  if(net.con&&net.con.relay)net.con.close(true);
});

function genCode(){const cs='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<5;i++)s+=cs[irand(0,cs.length-1)];return s;}
function menuMsg(t){$('menuMsg').textContent=t;}

function hostReady(code){
  if(net.ready||net.hostCode!==code)return;
  net.ready=true;net.code=code;$('lobbyCode').textContent=code;showLobby();
}
function acceptConn(con){
  net.conns.push(con);
  con.on('data',d=>onData(d,con));
  con.on('close',()=>{
    net.conns=net.conns.filter(c=>c!==con);
    if(con.meta){const r=net.remotes.get(con.meta.id);if(r&&r.vis)r.vis.remove();net.remotes.delete(con.meta.id);}
    refreshLobby();netBroadcast({t:'lobby',names:lobbyNames()});
  });
}
function hostRoom(){
  const code=genCode();
  G.mp=true;G.host=true;G.myId='H';G.myName=getName();
  net.hostCode=code;
  menuMsg(T('msg_creating'));
  let peer=null;
  try{peer=net.peer=new Peer('zfesc-'+code,PEER_OPTS);}catch(_){peer=null;}   // direct connections
  relayHost(code);                                                               // + the relay, in parallel
  if(!peer)return;
  peer.on('open',()=>hostReady(code));
  peer.on('error',e=>{
    if(e.type==='unavailable-id'&&!net.ready){try{peer.destroy();}catch(_){ } hostRoom();}
    else if(!net.ready&&G.mode!=='playing'&&e.type!=='unavailable-id')menuMsg(T('msg_neterr',{e:e.type}));
  });
  peer.on('connection',acceptConn);
}
function joinRoom(code){
  if(net.peer){try{net.peer.destroy();}catch(_){}}
  net.peer=null;net.ready=false;net.con=null;
  const tok=net.joinTok={};
  const live=()=>net.joinTok===tok;
  menuMsg(T('msg_connecting',{c:code}));
  const hostGone=()=>{if(G.mode!=='playing'){menuMsg(T('msg_hostclosed'));}else{toast(T('t_disc'));location.reload();}};
  let relayOn=false;
  const goRelay=()=>{   // the direct route failed or is too slow: use the relay instead
    if(relayOn||!live()||net.ready)return;relayOn=true;
    if(net.peer){try{net.peer.destroy();}catch(_){}net.peer=null;}
    menuMsg(T('msg_relay'));
    relayJoin(code,tok,con=>{
      if(!live())return;
      net.con=con;net.viaRelay=true;
      con.on('data',d=>{if(d&&d.t!=='welcome')onData(d,con);});
      con.on('close',()=>{if(live())hostGone();});
      onData(con.welcome,con);
      menuMsg(T('msg_connected'));
    });
  };
  setTimeout(goRelay,RELAY_AFTER_MS);
  let peer;
  try{peer=net.peer=new Peer(PEER_OPTS);}catch(_){goRelay();return;}
  const direct=()=>live()&&!relayOn&&net.peer===peer;
  peer.on('open',()=>{
    if(!direct())return;
    const con=peer.connect('zfesc-'+code,{reliable:true});
    net.con=con;
    con.on('open',()=>{if(!direct())return;con.send({t:'hello',name:G.myName});});
    con.on('data',d=>{if(live()&&net.con===con)onData(d,con);});
    con.on('close',()=>{if(live()&&net.con===con)hostGone();});
  });
  peer.on('error',()=>goRelay());   // blocked, unreachable, or the room lives on the relay only
}
function lobbyNames(){return [G.myName,...[...net.remotes.values()].map(r=>r.name)];}
function onData(d,con){
  if(d.t==='hello'){
    if(con.meta)return;   // already joined on this connection
    const cid='C'+(net.cid++);
    con.meta={id:cid};
    const rec={id:cid,name:d.name||'Friend',x:15,y:CHECK.floor*CFG.FH,z:0,yaw:0,f:CHECK.floor,fl:0,down:false,dead:false};
    rec.vis=new RemotePlayer(cid,rec.name);
    net.remotes.set(cid,rec);
    const snap={flags:{...G.flags,victory:false,finale:false},cards:G.cards,gates:[...G.gatesOpen],taken:[...G.taken].filter(id=>id.startsWith('story-card')),
      boards:[...G.boardsBroken],checkpoint:CHECK.floor,qi};
    con.send({t:'welcome',id:cid,snap,names:lobbyNames()});
    // if the escape is already running, drop the newcomer straight into it
    if(G.started&&G.mode==='playing')con.send({t:'start',mode:MD.id,mid:true,seed:G.seed});
    refreshLobby();netBroadcast({t:'lobby',names:lobbyNames()});
    toast(T('t_joined',{n:d.name||'Friend'}));
    return;
  }
  if(d.t==='welcome'){
    G.myId=d.id;
    refreshLobbyFrom(d.names);
    net.pendingSnap=d.snap;          // applied once the world exists (it is built on 'start')
    if(world.built)applySnapState(d.snap);
    net.ready=true;
    showLobby();                 // guest sees the survivor list too
    return;
  }
  if(d.t==='lobby'){ // client rebuilds host entry
    refreshLobbyFrom(d.names);return;
  }
  if(d.t==='start'){
    if(d.seed)G.seed=d.seed;
    if(d.mid){
      // joined an escape already in progress: skip the prologue
      $('menu').style.display='none';$('lobby').style.display='none';
      $('fade').style.opacity='1';
      setTimeout(()=>{
        startWorld(d.mode||'scary');
        if(net.pendingSnap){applySnapState(net.pendingSnap);net.pendingSnap=null;}
        ensureAudio();
        beginGame(false);
        // starter kit: a late joiner has no chance without light or a weapon
        INV.flashlight=true;player.on=true;
        INV.crowbar=true;
        INV.battery=Math.max(INV.battery,65);
        INV.ammo=Math.max(INV.ammo,6);
        player.weapon=INV.pistol?'pistol':'melee';
        hudInv();hudStats();
        $('fade').style.opacity='0';
        toast(T('t_midjoin'));
        setTimeout(()=>toast(T('t_midkit')),1400);
      },80);
      return;
    }
    if(!world.built){
      $('fade').style.opacity='1';
      setTimeout(()=>{startWorld(d.mode||'scary');if(net.pendingSnap){applySnapState(net.pendingSnap);net.pendingSnap=null;}$('fade').style.opacity='0';showPrologue();},80);
    }else showPrologue();
    return;
  }
  if(d.t==='pos'){
    const r=net.remotes.get(con.meta&&con.meta.id);
    if(!r)return;
    r.x=d.x;r.y=d.y;r.z=d.z;r.yaw=d.yaw;r.p=d.p||0;r.f=d.f;r.fl=d.fl;r.hp=d.hp;
    r.down=!!(d.fl&4);r.dead=!!(d.fl&8);r.spec=!!(d.fl&16);
    remoteSample(r);
    return;
  }
  if(d.t==='snap'){applySnap(d);return;}
  if(d.t==='vo'){
    if(G.host)for(const c of net.conns)if(c!==con&&c.open)c.send(d);
    if(d.id!==G.myId)playVoice(d.id,d.d);
    return;
  }
  if(d.t==='ev'){onEv(d,con);return;}
}
function flagsBits(){
  return (player.on?1:0)|(player.crouch?2:0)|(player.down?4:0)|(player.dead?8:0)|(player.spec?16:0);
}
/* remote movement arrives in bursts (esp. over the relay): keep the last samples and draw each
   friend a little in the past, interpolating between two real positions — no snapping, no jitter */
function remoteSample(r){
  const now=performance.now();
  (r.buf=r.buf||[]).push({t:now,x:r.x,y:r.y||0,z:r.z,yaw:r.yaw||0});
  if(r.buf.length>40)r.buf.shift();
  if(r.lastT)r.gap=lerp(r.gap||100,Math.min(700,now-r.lastT),0.15);
  r.lastT=now;
}
function remoteAt(r){
  const b=r.buf;if(!b||!b.length)return {x:r.x,y:r.y||0,z:r.z,yaw:r.yaw||0};
  const rt=performance.now()-clamp((r.gap||100)*1.8,60,500);
  if(rt<=b[0].t)return b[0];
  for(let i=b.length-1;i>0;i--){
    const a=b[i-1],c=b[i];
    if(a.t<=rt){if(rt>=c.t)return c;const k=(rt-a.t)/Math.max(1,c.t-a.t);
      return {x:lerp(a.x,c.x,k),y:lerp(a.y,c.y,k),z:lerp(a.z,c.z,k),yaw:a.yaw+angDiff(a.yaw,c.yaw)*k};}
  }
  return b[b.length-1];
}
function applySnapState(s){
  if(!s||!world.built)return;
  RESTORING=true;
  try{
    for(const k in s.flags||{})if(s.flags[k]===true)G.flags[k]=true;
    Object.assign(G.cards,s.cards);
    CHECK.floor=s.checkpoint||0;
    for(const f of s.gates||[]){const g=world.gates.find(g=>g.f===f);if(g&&!g.open)g.openQuiet();}
    for(const b of s.boards||[])breakBoardQuiet(b);
    for(const id of s.taken||[]){G.taken.add(id);const it=world.items.find(i=>i.id===id);if(it&&!it.taken){it.taken=true;it.g.visible=false;}}
    restoreBreakers();
    if(typeof s.qi==='number')qi=Math.max(qi,s.qi);
    restoreStory();
    hudInv();questCheck();
  }finally{RESTORING=false;}
}
function breakBoardQuiet(id){
  if(id.startsWith('gate')){const g=world.gates.find(g=>g.f===+id.slice(4));if(g&&!g.open)g.openQuiet();return;}
  const d=world.doors.find(d=>d.id===id);
  if(d&&d.boarded)d.breakBoards(true);
}
function restoreBreakers(){
  for(const bk of Object.values(world.breakers)){
    const on=bk===world.breakers.main?G.flags.power:G.flags.power2;
    if(on&&bk.mesh){bk.mesh.material.emissiveIntensity=0.15;bk.mesh.rotation.x=-1.2;}
  }
}
function applySnap(s){
  if(s.jp){
    const je=npcByKey('jieun');
    if(je){
      if(!je.follow)je.startFollow();
      je.setFloor(s.jp[4]);
      const p=je.parts.g.position;
      p.x=lerp(p.x,s.jp[0],0.5);p.y=lerp(p.y,s.jp[1],0.5);p.z=lerp(p.z,s.jp[2],0.5);
      je.yaw=s.jp[3];je.parts.g.rotation.y=je.yaw;
      if(typeof s.jp[5]==='number'&&Math.abs(s.jp[5]-je.hp)>=1&&!(je.medAt&&performance.now()-je.medAt<1500)){
        je.hp=s.jp[5];je.drawBar();
        if(je.hp<je.hpMax*0.35&&!je.warned){je.warned=true;toast(T('t_jieun_hurt'));}
        if(je.hp>je.hpMax*0.5)je.warned=false;
      }
    }
  }
  const seen=new Set();
  for(const p of s.ps){
    const id=p[0];
    if(id===G.myId)continue;      // never render our own echoed position
    seen.add(id);
    let r=net.remotes.get(id);
    if(!r){r={id,name:p[7]||'Friend',x:p[1],y:p[3],z:p[2],yaw:p[4],f:p[5],fl:p[6],down:!!(p[6]&4),dead:!!(p[6]&8)};r.vis=new RemotePlayer(id,r.name);net.remotes.set(id,r);}
    r.x=p[1];r.z=p[2];r.y=p[3];r.yaw=p[4];r.f=p[5];r.fl=p[6];r.name=p[7]||r.name;r.p=p[8]||0;
    r.down=!!(p[6]&4);r.dead=!!(p[6]&8);r.spec=!!(p[6]&16);
    remoteSample(r);
  }
  for(const[id,r]of net.remotes){if(!seen.has(id)){if(r.vis)r.vis.remove();net.remotes.delete(id);}}
  const zseen=new Set();
  for(const a of s.zb){
    let z=world.zmap&&world.zmap.get(a[0]);
    if(!z){
      NET_SPAWN=true;
      try{z=spawnZombie(clamp(Math.round(a[2]/CFG.FH),0,CFG.FLOORS),a[1],a[3],ZTYPE_LIST[a[7]]||'shambler',null);}finally{NET_SPAWN=false;}
      world.zmap.delete(z.id);   // it was filed under a local number — that number belongs to another host zombie
      z.id=a[0];world.zmap.set(a[0],z);
      z.g.position.set(a[1],a[2],a[3]);
    }
    z.miss=0;zseen.add(z);
    z.netX=a[1];z.netY=a[2];z.netZ=a[3];z.netYaw=a[4];z.netState=a[5];z.netF=Math.round(a[2]/CFG.FH);z.netDead=!!a[6];
    if(G.ztags&&G.ztags[z.id]&&!z.tagged)tagTurned(z,G.ztags[z.id]);
  }
  // anything the host does not have is not real: drop it (after a few snapshots, never on a single hiccup)
  for(let i=world.zombies.length-1;i>=0;i--){
    const z=world.zombies[i];
    if(zseen.has(z))continue;
    if((z.miss=(z.miss||0)+1)<3)continue;
    if(z.g.parent)z.g.parent.remove(z.g);
    world.zombies.splice(i,1);
    if(world.zmap&&world.zmap.get(z.id)===z)world.zmap.delete(z.id);
  }
  // the helicopter clock is the host's: everybody sees the same seconds
  if(typeof s.xp==='number')extractProg=s.xp;
}
function onEv(d,from){
  switch(d.k){
    case 'door':{const dd=world.doors.find(x=>x.id===d.id);if(dd){dd.setOpen(d.open,false);play('creak',{pos:dd.g.position,vol:.7,ref:14});}break;}
    case 'boards':{const dd=world.doors.find(x=>x.id===d.id);if(dd&&dd.boarded)dd.breakBoards();break;}
    case 'gate':{const g=world.gates.find(x=>x.f===d.f);if(g&&!g.open){
      if(g.type==='board'&&g.mesh){plankBurst(g.f,g.mesh.getWorldPosition(new THREE.Vector3()),g.mesh.userData.ry||0);g.g.remove(g.mesh);g.mesh=null;}
      g.locked=false;g.setOpen(true);G.gatesOpen.add(d.f);questCheck();}break;}
    case 'take':{const it=world.items.find(x=>x.id===d.id);if(it&&!it.taken)netEv(()=>it.take());break;}
    case 'card':{
      const had=G.cards[d.c];G.cards[d.c]=true;hudInv();
      if(!had){toast(T('t_cardtaken',{n:esc(d.n||'?'),c:colName(d.c)}));play('pickup',{vol:.6});}
      {const it=world.items.find(x=>x.id==='story-card-'+d.c);if(it&&!it.taken){it.taken=true;it.g.visible=false;G.taken.add(it.id);}}
      if(d.c==='blue')parkTurn();
      questCheck();break;}
    case 'power':{
      if(d.sub){G.flags.power2=true;for(const g of world.gates)g.refreshLamp();toast(T('t_friendpower2'));}
      else{G.flags.power=true;toast(T('t_friendpower'));}
      restoreBreakers();
      play('clunk',{vol:.8});questCheck();break;}
    case 'shutter':{G.flags.shutter=true;const g=world.gates.find(g=>g.f===3);if(g&&!g.open){g.locked=false;g.setOpen(true);}updateShutterBtn();toast(T('t_friendshutter'));questCheck();break;}
    case 'qi':if(d.v>qi){qi=d.v;questCheck();}break;
    case 'flag':if(!G.flags[d.n]){G.flags[d.n]=true;applyFlag(d.n);questCheck();}break;
    case 'jmed':{const je=companion();if(je){
      if(G.host){je.hp=Math.min(je.hpMax,je.hp+80);je.drawBar();}
      if(d.n)toast(T('t_jmed_by',{n:esc(d.n)}));}break;}
    case 'zspawn':{
      if(!G.host)break;
      const zb=spawnZombie(clamp(d.f|0,0,CFG.FLOORS),+d.x||0,+d.z||0,ZTYPES[d.ty]&&d.ty!=='park'&&d.ty!=='jieun'?d.ty:'shambler',d.r||null);
      if(d.st)zb.state=d.st;
      if(d.ix!=null){zb.invest={x:d.ix,z:d.iz};zb.investT=d.iT||20;}
      if(d.st==='chase')zb.loseT=0;
      return;}
    case 'zhit':{const z=world.zmap&&world.zmap.get(d.id);if(z&&!z.dead&&G.host)z.hit(d.dmg||1,true);break;}
    case 'flare':{const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.035,0.24,8),MAT.flare));const li=takeFlareLight();g.position.set(d.x,d.y,d.z);if(li)li.position.copy(g.position);scene.add(g);flares.push({g,li,f:d.f,vx:0,vy:0,vz:0,life:14,fizzT:0.5,x:d.x,z:d.z});break;}
    case 'hit':if(d.id===G.myId)damagePlayer(d.dmg);break;
    case 'give':if(d.to===G.myId)receiveGift(d);break;
    case 'ztag':{(G.ztags=G.ztags||{})[d.id]=d.n;const z=world.zmap&&world.zmap.get(d.id);if(z)tagTurned(z,d.n);break;}
    case 'turned':{
      const r=net.remotes.get(d.id);if(r){r.spec=true;r.down=false;}
      if(d.id!==G.myId){showSub('<b>⚠ '+T('turned_sub',{n:esc(d.n||'?')})+'</b>',5,true);warnFx();player.shakeT=Math.max(player.shakeT,0.4);}
      if(G.host&&d.id!==G.myId){spawnTurned(d.id,d.n||'?',d.x,d.z,d.f);checkWipe();}
      if(player.spec)specLabel();
      break;}
    case 'wipe':squadWiped();break;
    case 'down':{const r=net.remotes.get(d.id);if(r){r.down=true;}break;}
    case 'revive':{const r=net.remotes.get(d.id);if(r)r.down=false;break;}
    case 'revived':{if(d.id===G.myId)reviveLocal();else{const r=net.remotes.get(d.id);if(r)r.down=false;}break;}
    case 'dead':{const r=net.remotes.get(d.id);if(r){r.dead=true;r.down=false;}break;}
    case 'zdie':{const z=world.zmap&&world.zmap.get(d.id);if(z&&!z.dead)z.die(true);break;}
    case 'chat':addChat(d.name,d.msg);break;
    case 'ping':addPing(d.x,d.z,d.f,d.name);break;
    case 'shoot':{
      const o=new THREE.Vector3(d.x,d.y,d.z),dir=new THREE.Vector3(d.dx,d.dy,d.dz).normalize();
      pistolHit(o,dir,d.f);
      play('shot',{pos:o,vol:.8,ref:30});
      break;}
    case 'vic':doVictory(true);break;
    case 'cctv':if(!G.flags.cctvSeen){G.flags.cctvSeen=true;questCheck();}break;
  }
  if(G.host&&from){for(const c of net.conns)if(c!==from&&c.open)c.send(d);}
}

/* ---------------- remote player visuals ---------------- */
class RemotePlayer{
  constructor(id,name){
    this.id=id;
    this.parts=buildHumanoid({skin:0xb08a6a,cloth:0x3a4a5c});
    this.parts.name=nameSprite(name||'Friend','#ffd9a0');
    this.parts.name.position.y=2.25;
    this.parts.g.add(this.parts.name);
    this.parts.g.position.set(15,0,0);
    scene.add(this.parts.g);
    this.phase=0;
  }
  update(dt,r){
    const g=this.parts.g;
    g.visible=!r.spec&&!(player.spec&&G.specId===r.id);   // a turned friend is a zombie now; hide the one you watch through
    const s=remoteAt(r);
    g.position.set(lerp(g.position.x,s.x,Math.min(1,dt*18)),lerp(g.position.y,s.y,Math.min(1,dt*18)),lerp(g.position.z,s.z,Math.min(1,dt*18)));
    g.rotation.y=s.yaw;
    if(r.dead){g.rotation.x=-Math.PI/2;return;}
    if(r.down){g.scale.y=0.55;return;}
    g.scale.y=1;g.rotation.x=0;
    const moved=Math.hypot(g.position.x-this.lx||0,g.position.z-this.lz||0);
    this.phase+=dt*moved*20;
    const sw=Math.sin(this.phase)*(moved>0.001?0.6:0);
    this.parts.legL.rotation.x=sw;this.parts.legR.rotation.x=-sw;
    this.parts.armL.rotation.x=-sw*0.7;
    this.parts.armR.rotation.x=(r.fl&1)?-1.3:sw*0.7;
    this.lx=g.position.x;this.lz=g.position.z;
  }
  remove(){scene.remove(this.parts.g);}
}

/* ---------------- chat ---------------- */
function toggleChat(open){
  G.chatOpen=open;
  $('chatIn').style.display=open?'block':'none';
  if(open){$('chatIn').focus();}
  else{$('chatIn').blur();$('chatIn').value='';}
}
function sendChat(){
  const v=$('chatIn').value.trim();
  toggleChat(false);
  if(!v)return;
  addChat(G.myName,v);
  netBroadcast({t:'ev',k:'chat',name:G.myName,msg:v});
}
function addChat(name,msg){
  const feed=$('chatFeed');
  const d=document.createElement('div');
  d.innerHTML='<b>'+(name||'??')+':</b> '+msg.replace(/</g,'&lt;');
  feed.appendChild(d);
  while(feed.children.length>6)feed.firstChild.remove();
  setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity 1s';},7000);
  setTimeout(()=>d.remove(),8200);
}
function onKey(code){
  if(G.mode!=='playing')return;
  if(G.mp&&code==='KeyM'&&!G.chatOpen){micToggle();return;}
  if(G.mp&&code==='KeyN'&&!G.chatOpen){spkToggle();return;}
  if(player.spec){
    if(code==='KeyA'||code==='ArrowLeft')specCycle(-1);
    if(code==='KeyD'||code==='ArrowRight')specCycle(1);
    return;
  }
  if(G.uiLock==='give'){
    const n=/^(Digit|Numpad)([1-5])$/.exec(code);
    if(n)giveItem(+n[2]-1);else if(code==='Escape'||code==='KeyB')closeGive();
    return;
  }
  if(G.mp&&code==='KeyB'&&!G.uiLock){openGive();return;}
  if(code==='KeyI'&&!G.uiLock){showHelp(!G.helpOpen);return;}
  if(G.uiLock==='ending'){if(code==='Space'||code==='Enter'||code==='Escape')skipEnding();return;}
  if(G.uiLock==='note'&&(code==='KeyE'||code==='Escape'||code==='Enter')){closeNote();return;}
  if(G.uiLock==='choice'){
    if(code==='Digit1'||code==='Numpad1')resolveJieun('trust');
    else if(code==='Digit2'||code==='Numpad2')resolveJieun('kill');
    return;
  }
  if(G.uiLock==='cctv'){
    if(archiveRunning&&code==='Space'){if(archiveNext)archiveNext();return;}
    if(code==='KeyE'||code==='Escape'){closeCCTV();return;}
    if(code==='KeyQ'||code==='Enter'){releaseShutter();return;}
    if(code==='KeyA'||code==='ArrowLeft'){camFloor=(camFloor+CFG.FLOORS-1)%CFG.FLOORS;drawCCTV();play('click',{vol:.4});}
    if(code==='KeyD'||code==='ArrowRight'){camFloor=(camFloor+1)%CFG.FLOORS;drawCCTV();play('click',{vol:.4});}
    return;
  }
  if(player.dead){
    if((code==='KeyE'||code==='Enter')&&G.respawnPending)respawnPlayer(); // [E] = confirm: respawn instantly
    return;
  }
  switch(code){
    case 'KeyF':
      if(!INV.flashlight){toast(T('t_notorch'));break;}
      if(player.battery<=0){toast(T('t_batdead'));break;}
      player.on=!player.on;play('click',{vol:.6});hudStats();break;
    case 'KeyG':throwFlare();break;
    case 'KeyH':
      if(player.down||player.dead)break;
      if(INV.medkit>0&&player.hp<100){INV.medkit--;player.hp=Math.min(100,player.hp+60);play('paper',{vol:.7});toast(T('t_medused'));hudInv();hudStats();}
      else if(INV.medkit<=0)toast(T('t_nomedi'));break;
    case 'KeyC':player.crouch=!player.crouch;if(!G.sneakTip&&player.crouch){G.sneakTip=true;toast(T('t_sneak'));}break;
    case 'KeyV':player.third=!player.third;break;
    case 'Digit1':case 'Numpad1':player.weapon='melee';toast(T('t_w_melee'));break;
    case 'Digit2':case 'Numpad2':
      if(INV.pistol){player.weapon='pistol';toast(T('t_w_pistol',{n:INV.ammo}));}
      else toast(T('t_nopistol'));
      break;
    case 'Tab':toggleGoals(true);break;
    case 'KeyZ':{   // co-op ping (Q is physical work)
      const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
      const px=player.pos.x+fx*4,pz=player.pos.z+fz*4;
      addPing(px,pz,player.floor,G.myName);
      netBroadcast({t:'ev',k:'ping',x:px,z:pz,f:player.floor,name:G.myName});
      break;}
    case 'KeyT':if(G.mp)toggleChat(true);break;
  }
}

/* ---------------- menus ---------------- */
function getName(){
  let v=$('nameIn').value.trim()||'Survivor';
  try{localStorage.setItem('zf_name',v);}catch(e){}
  return v;
}
function showLobby(){
  $('menu').style.display='none';
  $('lobby').style.display='flex';
  refreshLobby();
}
function refreshLobby(){
  if(!G.host)return;
  $('lobbyCode').textContent=net.code||'-----';
  const list=$('lobbyList');list.innerHTML='';
  for(const n of lobbyNames()){const d=document.createElement('div');d.textContent=n;list.appendChild(d);}
  const b=$('btnStart');
  b.disabled=false;
  b.textContent=net.remotes.size?T('lb_startn',{n:net.remotes.size+1}):T('lb_start0');
}
function refreshLobbyFrom(names){
  const list=$('lobbyList');list.innerHTML='';
  for(const n of names||[]){const d=document.createElement('div');d.textContent=n;list.appendChild(d);}
  const b=$('btnStart');
  b.disabled=true;b.textContent=T('lb_wait');
}
/* ---------------- animated, skippable story intro (procedural comic panels) ---------------- */
let introState=null;
function introPanels(){
  const lite=G.gameMode==='lite';
  const pro=lite?(G.mp?T('pro_lm'):T('pro_ls')):(G.mp?T('pro_sm'):T('pro_ss'));
  const caps=pro.split('<br><br>');
  const ps=[{cap:'',draw:'title'}];
  const draws=lite?['schoolDay','bots','drone']:['exterior','corridor','ch4a','hall','eyes'];
  draws.forEach((d,i)=>ps.push({cap:caps[i]||caps[caps.length-1]||'',draw:d}));
  return ps;
}
function drawIntro(cv,kind,alpha,zoom,t){
  const x=cv.getContext('2d'),W=cv.width,H=cv.height;
  x.save();
  x.clearRect(0,0,W,H);
  const z=1+(zoom||0);
  x.translate(W/2,H/2);x.scale(z,z);x.translate(-W/2,-H/2);
  const grain=()=>{x.fillStyle='rgba(255,255,255,0.03)';for(let i=0;i<120;i++)x.fillRect(Math.random()*W,Math.random()*H,2,2);};
  const vign=()=>{const g2=x.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.75);g2.addColorStop(0,'rgba(0,0,0,0)');g2.addColorStop(1,'rgba(0,0,0,0.55)');x.fillStyle=g2;x.fillRect(0,0,W,H);};
  if(kind==='title'){
    x.fillStyle=G.gameMode==='lite'?'#0e1a12':'#000';x.fillRect(0,0,W,H);
    x.textAlign='center';
    x.font='900 54px "Arial Black",Arial';
    x.fillStyle=G.gameMode==='lite'?'#9fd0ff':'#e8e4da';
    x.fillText('ROOFTOP ESCAPE',W/2,H/2-10);
    x.font='16px Consolas,monospace';
    x.fillStyle=G.gameMode==='lite'?'#3ad488':'#c1272d';
    x.fillText(G.gameMode==='lite'?'SCIENCE FAIR NIGHT — SEOWON HIGH':'OUTBREAK NIGHT — SEOWON HIGH SCHOOL',W/2,H/2+30);
    if(G.gameMode!=='lite'&&Math.sin(t*9)>0.6){x.fillStyle='rgba(193,39,45,0.12)';x.fillRect(0,0,W,H);}
  }else if(kind==='exterior'){
    const sky=x.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#05060f');sky.addColorStop(1,'#0d0f1c');x.fillStyle=sky;x.fillRect(0,0,W,H);
    x.fillStyle='rgba(216,220,255,0.12)';x.beginPath();x.arc(W*0.78,H*0.22,60,0,TAU);x.fill();
    x.fillStyle='#d8dcff';x.beginPath();x.arc(W*0.78,H*0.22,34,0,TAU);x.fill();
    x.fillStyle='#05060a';
    x.fillRect(W*0.18,H*0.38,W*0.56,H*0.5);
    x.fillRect(W*0.4,H*0.28,W*0.14,H*0.14);
    for(let i=0;i<6;i++)for(let j=0;j<4;j++){
      x.fillStyle=Math.random()<0.1?'rgba(255,190,90,0.85)':'rgba(30,36,58,0.9)';
      x.fillRect(W*(0.21+i*0.085),H*(0.43+j*0.1),W*0.045,H*0.05);
    }
    x.fillStyle='#020308';x.fillRect(0,H*0.86,W,H*0.14);
    x.fillStyle='rgba(200,205,255,0.35)';
    for(let i=0;i<80;i++)x.fillRect(Math.random()*W,Math.random()*H*0.5,1.5,1.5);
    vign();
  }else if(kind==='corridor'){
    x.fillStyle='#020204';x.fillRect(0,0,W,H);
    x.fillStyle='#0a0a10';
    x.beginPath();x.moveTo(0,0);x.lineTo(W*0.34,H*0.32);x.lineTo(W*0.34,H*0.74);x.lineTo(0,H);x.closePath();x.fill();
    x.beginPath();x.moveTo(W,0);x.lineTo(W*0.66,H*0.32);x.lineTo(W*0.66,H*0.74);x.lineTo(W,H);x.closePath();x.fill();
    x.fillRect(W*0.34,H*0.32,W*0.32,H*0.42);
    x.strokeStyle='rgba(120,120,140,0.25)';x.lineWidth=2;
    for(const px of [0.1,0.2,0.9,0.8]){
      x.beginPath();x.moveTo(W*px,0);x.lineTo(W*(px<0.5?0.34:0.66),H*0.32);x.stroke();
      x.beginPath();x.moveTo(W*px,H);x.lineTo(W*(px<0.5?0.34:0.66),H*0.74);x.stroke();
    }
    const fl=Math.sin(t*13)>-0.3?1:0.2;
    x.fillStyle=`rgba(255,230,180,${0.75*fl})`;x.fillRect(W*0.44,H*0.18,W*0.12,8);
    const cone=x.createLinearGradient(0,H*0.2,0,H*0.85);
    cone.addColorStop(0,`rgba(255,220,160,${0.16*fl})`);cone.addColorStop(1,'rgba(255,220,160,0)');
    x.fillStyle=cone;x.beginPath();x.moveTo(W*0.46,H*0.2);x.lineTo(W*0.54,H*0.2);x.lineTo(W*0.72,H*0.85);x.lineTo(W*0.28,H*0.85);x.closePath();x.fill();
    x.strokeStyle='rgba(140,12,16,0.8)';x.lineWidth=7;x.lineCap='round';
    x.beginPath();x.moveTo(W*0.2,H*0.42);x.quadraticCurveTo(W*0.17,H*0.55,W*0.19,H*0.68);x.stroke();
    x.beginPath();x.moveTo(W*0.2,H*0.42);x.quadraticCurveTo(W*0.24,H*0.5,W*0.23,H*0.58);x.stroke();
    x.fillStyle='#000';x.fillRect(W*0.475,H*0.5,W*0.05,H*0.2);
    x.beginPath();x.arc(W*0.5,H*0.48,H*0.035,0,TAU);x.fill();
    vign();grain();
  }else if(kind==='eyes'){
    x.fillStyle='#000';x.fillRect(0,0,W,H);
    x.fillStyle='#0a0d0a';
    x.beginPath();x.ellipse(W*0.5,H*0.42,W*0.13,H*0.2,0,0,TAU);x.fill();
    x.fillRect(W*0.42,H*0.55,W*0.16,H*0.45);
    const ox=Math.sin(t*0.8)*6;
    for(const sx of [-1,1]){
      x.fillStyle='rgba(255,42,26,0.25)';x.beginPath();x.arc(W*0.5+sx*W*0.045+ox,H*0.4,16,0,TAU);x.fill();
      x.fillStyle='#ff2a1a';x.beginPath();x.arc(W*0.5+sx*W*0.045+ox,H*0.4,6.5,0,TAU);x.fill();
    }
    x.fillStyle='#12100e';
    x.beginPath();x.ellipse(W*0.62,H*0.88,W*0.09,H*0.07,-0.5,0,TAU);x.fill();
    for(let i=0;i<4;i++){x.save();x.translate(W*(0.56+i*0.035),H*(0.84-i*0.012));x.rotate(-0.5+i*0.12);x.fillRect(0,-4,W*0.075,8);x.restore();}
    x.fillStyle='rgba(120,10,14,0.5)';x.beginPath();x.arc(W*0.62,H*0.86,26,0,TAU);x.fill();
    vign();grain();
  }else if(kind==='schoolDay'){
    const sky=x.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#8fd0ff');sky.addColorStop(1,'#d8ecff');x.fillStyle=sky;x.fillRect(0,0,W,H);
    x.fillStyle='#fff3c8';x.beginPath();x.arc(W*0.8,H*0.2,40,0,TAU);x.fill();
    x.fillStyle='#7fbf6f';x.fillRect(0,H*0.84,W,H*0.16);
    x.fillStyle='#e8e0d0';x.fillRect(W*0.2,H*0.4,W*0.52,H*0.44);
    x.fillStyle='#c9605a';x.fillRect(W*0.2,H*0.4,W*0.52,H*0.06);
    for(let i=0;i<5;i++)for(let j=0;j<3;j++){x.fillStyle='#9fd0ff';x.fillRect(W*(0.24+i*0.09),H*(0.52+j*0.1),W*0.05,H*0.055);}
    x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.moveTo(W*0.15,H*0.75);x.quadraticCurveTo(W*0.12,H*0.6,W*0.15,H*0.48);x.stroke();
    x.fillStyle='#ff6b8a';x.beginPath();x.ellipse(W*0.15,H*0.44,14,18,0,0,TAU);x.fill();
  }else if(kind==='bots'){
    x.fillStyle='#eef4f8';x.fillRect(0,0,W,H);
    x.fillStyle='#dce6ec';x.fillRect(0,H*0.8,W,H*0.2);
    const cols=['#3a86ff','#ff8a3a','#3ad488'];
    for(let i=0;i<3;i++){
      const bx=W*(0.3+i*0.2),by=H*(0.55+(i%2)*0.06)+Math.sin(t*3+i)*4;
      x.fillStyle=cols[i];x.beginPath();x.arc(bx,by,46,0,TAU);x.fill();
      x.fillStyle='#fff';x.beginPath();x.arc(bx-14,by-8,8,0,TAU);x.arc(bx+14,by-8,8,0,TAU);x.fill();
      x.fillStyle='#123';x.beginPath();x.arc(bx-14,by-8,4,0,TAU);x.arc(bx+14,by-8,4,0,TAU);x.fill();
      x.strokeStyle='#123';x.lineWidth=3;x.beginPath();x.arc(bx,by+8,12,0.15*Math.PI,0.85*Math.PI);x.stroke();
      x.strokeStyle='#666';x.beginPath();x.moveTo(bx,by-46);x.lineTo(bx,by-64);x.stroke();
      x.fillStyle='#ffd23f';x.beginPath();x.arc(bx,by-68,6,0,TAU);x.fill();
    }
  }else if(kind==='ch2a'){ // Floor 2 corridor, security door ajar, light spilling out
    x.fillStyle='#020204';x.fillRect(0,0,W,H);
    x.fillStyle='#0a0a10';x.fillRect(W*0.3,H*0.25,W*0.4,H*0.55);
    const spill=x.createLinearGradient(W*0.34,H*0.3,W*0.66,H*0.85);spill.addColorStop(0,'rgba(120,255,170,0.32)');spill.addColorStop(1,'rgba(120,255,170,0)');
    x.fillStyle=spill;x.fillRect(W*0.34,H*0.28,W*0.32,H*0.56);
    x.fillStyle='#050508';x.fillRect(W*0.44,H*0.3,W*0.09,H*0.5);
    vign();
  }else if(kind==='ch2b'){ // wall of CCTV monitors, one figure still moving
    x.fillStyle='#010401';x.fillRect(0,0,W,H);
    for(let i=0;i<3;i++)for(let j=0;j<2;j++){
      const mx=W*(0.18+i*0.24),my=H*(0.2+j*0.3);
      x.fillStyle='#081409';x.fillRect(mx,my,W*0.18,H*0.24);
      x.strokeStyle='rgba(89,255,122,0.5)';x.lineWidth=2;x.strokeRect(mx,my,W*0.18,H*0.24);
      x.fillStyle='rgba(89,255,122,0.08)';
      for(let k=0;k<30;k++)x.fillRect(mx+Math.random()*W*0.18,my+Math.random()*H*0.24,rand(4,20),1);
    }
    x.fillStyle='#000';x.fillRect(W*0.44,H*0.31,W*0.055,H*0.15);
    x.beginPath();x.arc(W*0.468,H*0.30,H*0.026,0,TAU);x.fill();
    grain();
  }else if(kind==='ch2c'){ // the red keycard glinting on the security desk
    x.fillStyle='#050505';x.fillRect(0,0,W,H);
    x.fillStyle='#241a10';x.fillRect(W*0.2,H*0.62,W*0.6,H*0.24);
    x.fillStyle='#881418';x.fillRect(W*0.46,H*0.5,W*0.09,H*0.055);
    const gl=x.createRadialGradient(W*0.505,H*0.52,2,W*0.505,H*0.52,70);gl.addColorStop(0,'rgba(255,80,80,0.75)');gl.addColorStop(1,'rgba(255,80,80,0)');
    x.fillStyle=gl;x.fillRect(W*0.38,H*0.38,W*0.24,H*0.26);
    vign();
  }else if(kind==='ch3a'){ // the Floor 6 shutter grinding open, light bleeding under
    x.fillStyle='#020202';x.fillRect(0,0,W,H);
    x.fillStyle='#2a2e33';x.fillRect(W*0.25,H*0.1,W*0.5,H*0.55);
    x.fillStyle='#0c0e10';
    for(let i=0;i<5;i++)x.fillRect(W*0.25,H*(0.14+i*0.1),W*0.5,H*0.03);
    const glow=x.createLinearGradient(0,H*0.6,0,H);glow.addColorStop(0,'rgba(255,220,160,0.28)');glow.addColorStop(1,'rgba(255,220,160,0)');
    x.fillStyle=glow;x.fillRect(W*0.25,H*0.6,W*0.5,H*0.4);
    vign();
  }else if(kind==='ch3b'){ // dead floors: one thin flashlight cone on black stairs
    x.fillStyle='#000';x.fillRect(0,0,W,H);
    const cone=x.createLinearGradient(W*0.5,0,W*0.5,H);cone.addColorStop(0,'rgba(255,235,190,0.5)');cone.addColorStop(1,'rgba(255,235,190,0)');
    x.fillStyle=cone;x.beginPath();x.moveTo(W*0.47,H*0.1);x.lineTo(W*0.53,H*0.1);x.lineTo(W*0.75,H);x.lineTo(W*0.25,H);x.closePath();x.fill();
    x.fillStyle='rgba(200,200,210,0.12)';
    for(let i=0;i<5;i++)x.fillRect(W*0.42,H*(0.45+i*0.1),W*0.16,H*0.015);
    grain();
  }else if(kind==='ch4a'){ // red alarm wash over the lab corridor
    x.fillStyle='#180202';x.fillRect(0,0,W,H);
    const g4=x.createRadialGradient(W*0.5,H*0.4,20,W*0.5,H*0.4,W*0.6);g4.addColorStop(0,'rgba(255,40,30,0.5)');g4.addColorStop(1,'rgba(120,0,0,0.1)');
    x.fillStyle=g4;x.fillRect(0,0,W,H);
    x.fillStyle='#0a0303';x.fillRect(W*0.44,H*0.35,W*0.12,H*0.45);
    if(Math.sin(t*9)>0){x.fillStyle='rgba(255,60,40,0.18)';x.fillRect(0,0,W,H);}
    vign();
  }else if(kind==='ch4b'){ // the lab doors burst: silhouettes with ember eyes
    x.fillStyle='#050202';x.fillRect(0,0,W,H);
    x.fillStyle='#120606';x.fillRect(W*0.3,H*0.25,W*0.4,H*0.55);
    for(let i=0;i<7;i++){
      const hx=W*(0.34+(i%4)*0.11),hh=H*(0.4+((i*37)%20)/100);
      x.fillStyle='rgba(5,2,2,0.95)';
      x.fillRect(hx,hh,W*0.035,H*0.3);x.beginPath();x.arc(hx+W*0.017,hh-H*0.02,H*0.024,0,TAU);x.fill();
      x.fillStyle='rgba(255,42,26,0.8)';x.fillRect(hx+W*0.008,hh-H*0.026,W*0.008,H*0.008);x.fillRect(hx+W*0.02,hh-H*0.026,W*0.008,H*0.008);
    }
    vign();grain();
  }else if(kind==='ch4c'){ // running up, two at a time
    x.fillStyle='#000';x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(200,200,210,0.25)';x.lineWidth=3;
    for(let i=0;i<6;i++){x.beginPath();x.moveTo(W*(0.2+i*0.06),H*0.85-i*H*0.07);x.lineTo(W*(0.38+i*0.06),H*0.85-i*H*0.07);x.stroke();}
    x.fillStyle='#050505';
    x.save();x.translate(W*0.45,H*0.62);x.rotate(-0.35);
    x.fillRect(-W*0.02,-H*0.14,W*0.045,H*0.2);x.beginPath();x.arc(0,-H*0.16,H*0.035,0,TAU);x.fill();
    x.restore();
    vign();
  }else if(kind==='ch5a'){ // the roof door opens under the night sky
    const sky=x.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#0a1526');sky.addColorStop(1,'#1c2a44');x.fillStyle=sky;x.fillRect(0,0,W,H);
    for(let i=0;i<40;i++){x.fillStyle='rgba(255,255,255,0.6)';x.fillRect(Math.random()*W,Math.random()*H*0.4,1.5,1.5);}
    x.fillStyle='#0c0f14';x.fillRect(W*0.38,H*0.3,W*0.24,H*0.5);
    const lt=x.createLinearGradient(0,H*0.32,0,H*0.8);lt.addColorStop(0,'rgba(200,220,255,0.5)');lt.addColorStop(1,'rgba(200,220,255,0.05)');
    x.fillStyle=lt;x.fillRect(W*0.40,H*0.32,W*0.2,H*0.46);
    vign();
  }else if(kind==='ch5c'){ // behind you: the roof door, silhouettes pouring through
    x.fillStyle='#000';x.fillRect(0,0,W,H);
    x.fillStyle='#0e1013';x.fillRect(W*0.4,H*0.25,W*0.2,H*0.6);
    for(let i=0;i<5;i++){
      const hx=W*(0.42+i*0.04),hh=H*(0.42+i*0.02);
      x.fillStyle='rgba(3,3,4,0.98)';x.fillRect(hx,hh,W*0.03,H*0.3);x.beginPath();x.arc(hx+W*0.015,hh-H*0.015,H*0.018,0,TAU);x.fill();
      x.fillStyle='rgba(255,42,26,0.7)';x.fillRect(hx+W*0.006,hh-H*0.02,W*0.006,H*0.006);x.fillRect(hx+W*0.016,hh-H*0.02,W*0.006,H*0.006);
    }
    vign();
  }else if(kind==='hall'){ // empty hallway, red emergency wash — the teachers stopped answering
    x.fillStyle='#020203';x.fillRect(0,0,W,H);
    x.fillStyle='#0b0b0f';x.fillRect(W*0.2,H*0.3,W*0.6,H*0.52);
    x.fillStyle='#13131a';
    for(let i=0;i<4;i++)x.fillRect(W*(0.26+i*0.13),H*0.34,W*0.06,H*0.42);
    x.fillStyle='rgba(255,60,40,0.10)';x.fillRect(0,H*0.18,W,H*0.12);
    x.fillStyle='rgba(255,60,40,0.05)';x.fillRect(0,0,W,H);
    vign();grain();
  }else if(kind==='drone'){
    const sky=x.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#2a3a55');sky.addColorStop(1,'#4a6a8a');x.fillStyle=sky;x.fillRect(0,0,W,H);
    for(let i=0;i<40;i++){x.fillStyle='rgba(255,255,255,0.5)';x.fillRect(Math.random()*W,Math.random()*H*0.5,1.5,1.5);}
    x.fillStyle='#3a5a3a';x.fillRect(0,H*0.82,W,H*0.18);
    const dx=W*0.5,dy=H*0.4+Math.sin(t*2)*6;
    x.fillStyle='#3a4a3a';x.beginPath();x.ellipse(dx,dy,70,26,0,0,TAU);x.fill();
    x.strokeStyle='#222';x.lineWidth=6;
    x.beginPath();x.moveTo(dx-60,dy-14);x.lineTo(dx-90,dy-30);x.moveTo(dx+60,dy-14);x.lineTo(dx+90,dy-30);x.stroke();
    x.strokeStyle='rgba(200,200,220,0.7)';x.lineWidth=3;
    x.beginPath();x.ellipse(dx-90,dy-32,34,6,0,0,TAU);x.stroke();
    x.beginPath();x.ellipse(dx+90,dy-32,34,6,0,0,TAU);x.stroke();
    const beam=x.createLinearGradient(0,dy,0,H);beam.addColorStop(0,'rgba(120,255,160,0.25)');beam.addColorStop(1,'rgba(120,255,160,0)');
    x.fillStyle=beam;x.beginPath();x.moveTo(dx-30,dy+20);x.lineTo(dx+30,dy+20);x.lineTo(dx+90,H);x.lineTo(dx-90,H);x.closePath();x.fill();
    x.strokeStyle='rgba(80,255,140,0.8)';x.lineWidth=4;x.beginPath();x.ellipse(dx,H*0.88,60,16,0,0,TAU);x.stroke();
  }
  x.restore();
  if(alpha!==undefined){x.fillStyle=`rgba(0,0,0,${clamp(1-alpha,0,1)})`;x.fillRect(0,0,W,H);}
}
// Size a comic canvas (16:9) so the canvas + the text under it fit the window without scrolling.
function fitComic(layerId,wrapId){
  const layer=$(layerId),wrap=$(wrapId);
  if(!layer||!wrap||layer.style.display==='none'||typeof getComputedStyle!=='function')return;
  const cs=getComputedStyle(layer);
  let used=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
  for(const el of layer.children){
    if(el===wrap||getComputedStyle(el).display==='none')continue;
    const m=getComputedStyle(el);
    used+=el.offsetHeight+parseFloat(m.marginTop)+parseFloat(m.marginBottom);
  }
  for(const el of wrap.children){ // text inside the wrap (below the canvas)
    if(el.tagName==='CANVAS'||el.tagName==='BUTTON'||getComputedStyle(el).display==='none')continue;
    const m=getComputedStyle(el);
    used+=el.offsetHeight+parseFloat(m.marginTop)+parseFloat(m.marginBottom);
  }
  const availH=Math.max(120,window.innerHeight-used-4);
  const w=Math.max(200,Math.min(900,window.innerWidth*0.92,availH*16/9));
  wrap.style.width=w+'px';
}
function fitComics(){fitComic('prologue','introWrap');fitComic('chapter','chWrap');}
window.addEventListener('resize',fitComics);
function showPrologue(){
  $('menu').style.display='none';$('lobby').style.display='none';
  $('prologue').style.display='flex';
  const cv=$('introCv');
  const panels=introPanels();
  if(introState)clearInterval(introState.timer);
  introState={i:0,t0:performance.now(),timer:null};
  const go=()=>{ // leave the intro → wake up (same flow as before)
    if(introState){clearInterval(introState.timer);introState=null;}
    setLoop('drone',0);
    $('prologue').style.display='none';
    if(!NOLOCK)lockPointer();   // capture the mouse while the click gesture is fresh
    bootRun(G.gameMode,false);
  };
  $('prologueGo').onclick=go;
  $('introSkip').onclick=e=>{e.stopPropagation();ensureAudio();play('click',{vol:.5,force:true});go();};
  const showBrief=()=>{ // final panel becomes the MISSION briefing
    $('briefH').textContent=T('br_h');
    $('briefM').textContent=T('br_m');
    $('introCap').style.display='none';
    $('missionBrief').style.display='block';
    const box=$('briefTxt');box.innerHTML='';
    const ps=[0,1,2].map(k=>{ // lay out all lines now (hidden) so the layout never jumps
      const p=document.createElement('p');p.textContent=T('br'+(k+1));p.style.opacity='0';p.style.transition='opacity .6s';
      box.appendChild(p);return p;
    });
    let i=0;
    const step=()=>{
      if(!introState||i>=3)return;
      ps[i].style.opacity='1';
      i++;setTimeout(step,1300);
    };
    step();
  };
  ensureAudio();
  if(AUD.ctx&&AUD.ctx.state==='suspended'&&AUD.ctx.resume)AUD.ctx.resume();
  const lite=G.gameMode==='lite';
  setLoop('drone',lite?0:0.22);setLoop('vent',0.1);
  const INTRO_SFX=lite
    ?[[['ding',.5]],[['happyAlarm',.25]],[['servo',.5],['beep',.4]],[['whir',.5]],[['boing',.4]],[['ding',.4]]]
    :[[['stinger',.5],['thunder',.35]],[['thunder',.6],['rumble',.4]],[['alarm',.4],['scream',.3,.7]],
      [['zroar',.45,.8],['zstep',.6]],[['radio',.5],['growl1',.4]],[['heart',.7],['zbreath',.5]],[['heart',.6]]];
  const introSfx=i=>{
    if(!AUD.ready)return;
    const list=INTRO_SFX[Math.min(i,INTRO_SFX.length-1)];
    list.forEach(([n,v,r],k)=>setTimeout(()=>{if(introState)play(n,{vol:v,rate:r||1,force:true});},k*450));
  };
  const show=i=>{
    introState.i=i;introState.t0=performance.now();
    introSfx(i);
    $('introDots').textContent=panels.map((_,k)=>k===i?'●':'○').join(' ');
    $('prologueGo').classList.toggle('hidden',i<panels.length-1);
    if(i===panels.length-1){showBrief();}
    else{
      $('introCap').style.display='block';
      $('missionBrief').style.display='none';
      $('introCap').innerHTML=panels[i].cap;
    }
    fitComics();
  };
  cv.onclick=()=>{ // the first click also unlocks the audio context
    ensureAudio();if(AUD.ctx&&AUD.ctx.state==='suspended'&&AUD.ctx.resume)AUD.ctx.resume();
    if(introState.i<panels.length-1)show(introState.i+1);
    else go();
  };
  show(0);
  introState.timer=setInterval(()=>{ // auto-advance panel by panel
    if(!introState)return;
    if((performance.now()-introState.t0)/1000>5.2&&introState.i<panels.length-1)show(introState.i+1);
  },200);
  const render=()=>{
    if(!introState||$('prologue').style.display==='none'){if(introState)requestAnimationFrame(render);return;}
    const el=(performance.now()-introState.t0)/1000;
    drawIntro(cv,panels[introState.i].draw,clamp(el/0.5,0,1),Math.min(0.06,el*0.012),el);
    requestAnimationFrame(render);
  };
  render();
}

/* ---------------- mid-game chapter comics ---------------- */
const CHAPTERS=[
  {id:'c2',when:()=>playerMaxFloor>=2,   paint:['ch2a','ch2b','ch2c'],title:'ch2_t',cap:'ch2_c'},
  {id:'c3',when:()=>G.gatesOpen.has(3),  paint:['ch3a','ch3b','eyes'],title:'ch3_t',cap:'ch3_c'},
  {id:'c4',when:()=>playerMaxFloor>=5,   paint:['ch4a','ch4b','ch4c'],title:'ch4_t',cap:'ch4_c'},
  {id:'c5',when:()=>player.floor>=7,     paint:['ch5a','drone','ch5c'],title:'ch5_t',cap:'ch5_c'},
];
let chapterState=null;
function updateChapters(){
  if(!MD.jumpscares||G.mp||G.paused||G.uiLock||player.dead||player.down||G.flags.victory)return;
  for(const ch of CHAPTERS){
    if(!G.chaptersSeen.has(ch.id)&&ch.when()){showChapter(ch);break;}
  }
}
function showChapter(ch){
  G.chaptersSeen.add(ch.id);
  G.uiLock='chapter';G.paused=true;
  document.exitPointerLock&&document.exitPointerLock();
  const cv=$('chCv');
  chapterState={i:0,t0:performance.now(),ch,timer:null,show:null,finish:null};
  const show=i=>{
    chapterState.i=i;chapterState.t0=performance.now();
    $('chTitle').textContent=T(ch.title);
    $('chCap').textContent=T(ch.cap); // always laid out, shown on the last panel
    $('chCap').style.visibility=i===ch.paint.length-1?'visible':'hidden';
    $('chDots').textContent=ch.paint.map((_,k)=>k===i?'●':'○').join(' ');
  };
  const finish=()=>{
    if(!chapterState)return;
    clearInterval(chapterState.timer);
    chapterState=null;
    $('chapter').style.display='none';
    G.uiLock=null;G.paused=false;
    saveGame();
    if(!NOLOCK)lockPointer();
  };
  chapterState.show=show;chapterState.finish=finish;
  $('chSkip').onclick=()=>{if(chapterState)chapterState.finish();};
  cv.onclick=()=>{ // advance panel by panel; last panel closes the chapter
    ensureAudio();
    if(!chapterState)return;
    play('click',{vol:.4});
    if(chapterState.i<chapterState.ch.paint.length-1)chapterState.show(chapterState.i+1);
    else chapterState.finish();
  };
  $('chapter').style.display='flex';
  fitComics();
  play('stinger',{vol:.6,force:true});
  show(0);
  chapterState.timer=setInterval(()=>{
    if(!chapterState)return;
    if((performance.now()-chapterState.t0)/1000>4.4){
      if(chapterState.i<chapterState.ch.paint.length-1)chapterState.show(chapterState.i+1);
      else chapterState.finish();
    }
  },250);
  const render=()=>{
    if(!chapterState){return;}
    const el=(performance.now()-chapterState.t0)/1000;
    drawIntro(cv,chapterState.ch.paint[chapterState.i],clamp(el/0.5,0,1),Math.min(0.05,el*0.01),el);
    requestAnimationFrame(render);
  };
  render();
}
/* build the world for the chosen mode behind a fade, then start (idempotent) */
function bootRun(mode,cont){
  $('menu').style.display='none';$('lobby').style.display='none';$('prologue').style.display='none';
  $('fade').style.opacity='1';
  setTimeout(()=>{
    startWorld(mode);
    ensureAudio();
    if(cont)applySave(loadSave());
    beginGame(!!cont);
    $('fade').style.opacity='0';
  },80);
}
/* co-op: every player must build the SAME school (rooms, doors, loot, zombies). Without a shared seed
   each machine rolled its own layout — guests saw doors in walls, frozen extra zombies, etc. */
function seededRandom(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function startWorld(mode){
  if(world.built)return;
  MD=MODES[mode]||MODES.scary;
  G.gameMode=MD.id;
  scene.background=new THREE.Color(MD.bg);
  scene.fog=new THREE.FogExp2(MD.fog,MD.fogD);
  if(MD.hemi)scene.add(new THREE.HemisphereLight(0xcfe0ff,0x9a9080,0.78));
  const rnd=Math.random;
  if(G.mp&&G.seed)Math.random=seededRandom(G.seed);
  try{buildTextures();buildWorld();}finally{Math.random=rnd;}
  G.revUsed=0;player.spec=false;G.turned=false;
  setupViewModel();
  setupDust();
  // fixed flare-light pool: thrown flares claim one instead of ADDING a scene light
  // (a changing light count recompiles every material's shader mid-fight)
  world.flareLights=[];
  for(let i=0;i<4;i++){const li=new THREE.PointLight(0xff3300,0,10,1.7);scene.add(li);world.flareLights.push(li);}
  world.flareLightI=0;
  for(let i=0;i<world.levels.length;i++)world.levels[i].visible=(i<=1);
  if(world.roofGroup)world.roofGroup.visible=false;
  // shader warm-up: walk every 3-floor window and let the renderer compile its programs now,
  // behind the fade. Programs are cached across windows (the per-floor light inventory is
  // identical everywhere), so this only compiles each floor's unique material variants once —
  // and no stairwell crossing ever builds a shader again. This used to be a 0.3-4 s stall.
  const _vis=world.levels.map(l=>l.visible);
  for(let w=0;w<world.levels.length;w++){
    for(let i=0;i<world.levels.length;i++)world.levels[i].visible=(i>=w-1&&i<=w+1);
    renderer.compile(scene,camera);
  }
  world.levels.forEach((l,i)=>l.visible=_vis[i]);
  world.built=true;
  for(const g of world.gates)g.refreshLamp();
}
function beginGame(cont){
  G.mode='playing';G.started=true;
  setLoop('drone',MD.jumpscares?0.075:0); // calm horror bed (nightmare only; loops persist between runs)
  if(typeof G.lives!=='number')G.lives=3;
  G.helpMode=false;G.respawnPending=false;G.mwDismissed=false;
  $('menu').style.display='none';$('lobby').style.display='none';$('prologue').style.display='none';
  $('hud').style.display='block';
  $('hintKey').innerHTML=T('hint')+(G.mp?T('hint_mp'):'');
  if(cont||(G.mp&&!G.host))player.pos.set(14.5,CHECK.floor*CFG.FH+0.1,0);
  else player.pos.set(-21.5,0.1,0);
  if(playerBody.name){playerBody.g.remove(playerBody.name);}
  playerBody.name=nameSprite(G.myName||'You');
  playerBody.name.position.y=2.2;
  playerBody.g.add(playerBody.name);
  onFloorChange(clamp(Math.round(player.pos.y/CFG.FH),0,CFG.FLOORS));
  lockPointer();
  hudInv();hudStats();questCheck();
  if(cont){
    setTimeout(()=>radio(T(MD.id==='lite'?'radio_cont_l':'radio_cont')),1500);
  }else{
    // the phone beat: one last message, then the dark
    setTimeout(()=>showSub('<i>'+T('phone_buzz')+'</i>',2.4),1200);
    setTimeout(()=>{showSub('<b>Ji-woo:</b> '+T('phone_msg'),4.5);play('click',{vol:.3,force:true});},4300);
    setTimeout(()=>showSub('<i>'+T('phone_die')+'</i>',2),8300);
    setTimeout(()=>radio(T(MD.id==='lite'?'radio_intro_l':'radio_intro')),11000);
  }
}
function showPause(b){
  G.paused=b;
  $('pause').style.display=b?'flex':'none';
  if(!b)lockPointer();
  if(b)for(const k in KEY)KEY[k]=false;
}

/* ---------------- save / continue (solo runs) ---------------- */
const SAVE_FLAGS=['power','power2','shutter','cctvSeen','secFound','parkFound','parkTalked','parkTurned','parkDead','reach4','jieunFound','jieunTalked','jieunDead','jieunTrusted','jieunKilled','jieunTimeout','safeBreached','reachRoof'];
function saveGame(){
  if(G.mp||!G.started||G.flags.victory)return;
  try{
    const flags={};for(const k of SAVE_FLAGS)flags[k]=!!G.flags[k];
    localStorage.setItem('zf_save',JSON.stringify({
      v:3,mode:MD.id,ts:Date.now(),
      qk:QUEST[qi].k,cards:G.cards,flags,
      inv:{crowbar:INV.crowbar,flare:INV.flare,medkit:INV.medkit,fl:INV.flashlight,pistol:INV.pistol,ammo:INV.ammo,weapon:player.weapon},
      battery:Math.round(player.battery),hp:Math.round(player.hp),
      checkpoint:CHECK.floor,time:Math.round(G.time),
      chapters:[...G.chaptersSeen],
      kills:G.stats.kills,deaths:G.stats.deaths,lives:(typeof G.lives==='number'?G.lives:3),
      gates:[...G.gatesOpen],boards:[...G.boardsBroken],taken:[...G.taken],seen:[...G.floorsSeen],
    }));
  }catch(e){}
}
function loadSave(){
  try{const s=JSON.parse(localStorage.getItem('zf_save')||'null');
    if(!s||s.v!==3)return null; // saves from before the mission-chain rewrite are incompatible
    return s;}
  catch(e){return null;}
}
function clearSave(){try{localStorage.removeItem('zf_save');}catch(e){}}
function applySave(s){
  const wasReady=AUD.ready;AUD.ready=false;RESTORING=true; // stay silent while restoring
  try{
    qi=QI[s.qk]??0;
    Object.assign(G.cards,s.cards||{});
    for(const k of SAVE_FLAGS)G.flags[k]=!!(s.flags&&s.flags[k]);
    G.flags.finale=G.flags.flareLit=false;finaleDone=false;extractProg=0;   // the roof is replayed from its start
    if(s.inv){INV.crowbar=!!s.inv.crowbar;INV.flare=s.inv.flare|0;INV.medkit=s.inv.medkit|0;INV.flashlight=!!s.inv.fl;
      INV.pistol=!!s.inv.pistol;INV.ammo=s.inv.ammo|0;player.weapon=s.inv.weapon==='pistol'&&INV.pistol?'pistol':'melee';}
    player.battery=s.battery??70;player.hp=clamp(s.hp??100,20,100);
    CHECK.floor=clamp(s.checkpoint|0,0,CFG.FLOORS-1);
    playerMaxFloor=CHECK.floor;
    G.time=s.time||0;G.stats.kills=s.kills||0;G.stats.deaths=s.deaths||0;
    G.lives=(typeof s.lives==='number')?s.lives:3;
    for(const c of s.chapters||[])G.chaptersSeen.add(c);
    for(const id of s.taken||[])G.taken.add(id);
    for(const f of s.gates||[]){const g=world.gates.find(g=>g.f===f);if(g&&!g.open)g.openQuiet();}
    for(const b of s.boards||[])breakBoardQuiet(b);
    for(const it of world.items){if(G.taken.has(it.id)&&!it.taken){it.taken=true;it.g.visible=false;}}
    restoreBreakers();
    for(const f of s.seen||[])G.floorsSeen.add(f);
    restoreStory();
  }finally{AUD.ready=wasReady;RESTORING=false;}
}
setInterval(()=>{if(G.mode==='playing'&&!G.mp&&G.started&&!G.flags.victory)saveGame();},5000);

/* ---------------- [Tab] goals overlay ---------------- */
function toggleGoals(show){
  const el=$('goals');
  if(!show){el.style.display='none';return;}
  if(G.mode!=='playing')return;
  let html='';
  QUEST.forEach((q,i)=>{
    const done=i<qi||G.flags.victory;
    const cls=done?'done':(i===qi?'cur':'');
    html+='<div class="q '+cls+'">'+(done?'✔ ':(i===qi?'▶ ':'· '))+(i+1)+'. '+esc(T(questKey(i)))+'</div>';
  });
  $('goalsList').innerHTML=html;
  el.style.display='block';
}

/* menu wiring */
$('tabPlay').onclick=()=>{$('tabPlay').classList.add('on');$('tabHow').classList.remove('on');$('panePlay').classList.remove('hidden');$('paneHow').classList.add('hidden');};
$('tabHow').onclick=()=>{$('tabHow').classList.add('on');$('tabPlay').classList.remove('on');$('paneHow').classList.remove('hidden');$('panePlay').classList.add('hidden');};
$('nameIn').value=(function(){try{return localStorage.getItem('zf_name')||'';}catch(e){return '';}})();
/* mode selection */
G.selMode='scary';
try{if(localStorage.getItem('zf_mode')==='lite')G.selMode='lite';}catch(e){}
function setSelMode(m){
  G.selMode=m;
  try{localStorage.setItem('zf_mode',m);}catch(e){}
  $('modeScary').classList.toggle('on',m==='scary');
  $('modeLite').classList.toggle('on',m==='lite');
  document.querySelector('#menu .sub').textContent=T(m==='lite'?'sub_lite':'sub_scary');
}
$('modeScary').onclick=()=>setSelMode('scary');
$('modeLite').onclick=()=>setSelMode('lite');
setSelMode(G.selMode);
function resetWorld(){
  archiveRunning=false;choiceSt=null;jieunResolved=false;
  {const c=$('choice');if(c)c.style.display='none';}
  for(const d of drips)scene.remove(d.sp);drips.length=0;dripDecals.length=0;
  for(const g of world.levels)if(g.parent)g.parent.remove(g);
  for(const f of flares){if(f.g.parent)f.g.parent.remove(f.g);}
  flares.length=0;
  for(const b of bursts){if(b.sp.parent)b.sp.parent.remove(b.sp);}
  bursts.length=0;
  world.cols=Array.from({length:CFG.FLOORS+1},()=>[]);
  world.levels=[];world.layout=[];world.items=[];world.doors=[];world.gates=[];world.zombies=[];world.npcs=[];
  world.furn=[];world.keep=[];world.zmap=new Map();world.flicker=[];world.termMons=[];world.trails=[];
  world.roomDoor={};world.frontWalls=[];world.breakers={};world.terminal=null;world.roofGroup=null;world.heli=null;
  ending=null;G.jTension=0;
  for(const id of ['suspect','verdict','cine'])if($(id))$(id).style.display='none';
  world.slotLights=[];
  for(const li of (world.flareLights||[]))if(li.parent)li.parent.remove(li); // pooled lights live in the scene — recycle, don't re-add
  world.flareLights=[];
  world.clouds=null;world.built=false;
  world.safe=null;world.parkZ=null;world.alarms=[];world.extract=null;world.roofLight=null;
  debris.length=0;
  for(const k in workProg)delete workProg[k];
  if(holdAct)holdAct=null;
  WATCHER.z=null;WATCHER.state='off';
  ZID=0;ITEM_N=0;
  if(dust){scene.remove(dust);dust=null;}
}
function setLang(l){
  LANG=l;
  try{localStorage.setItem('zf_lang',l);}catch(e){}
  if(G.mode==='playing'&&world.built){
    const y=player.pos.y;
    let sv=null;
    if(!G.mp){saveGame();sv=loadSave();}
    if(G.mp){applyLang();toast(T('t_lang_mp'));return;}
    resetWorld();
    startWorld(MD.id);
    if(sv)applySave(sv);
    player.pos.y=y;player.vy=0;
    player.floor=clamp(Math.round(y/CFG.FH),0,CFG.FLOORS);
    for(let i=0;i<world.levels.length;i++)world.levels[i].visible=(Math.abs(i-player.floor)<=1);
    if(world.roofGroup)world.roofGroup.visible=(player.floor>=CFG.FLOORS-1);
    onFloorChange(player.floor);
    hudInv();hudStats();questCheck();
    toast(T('t_lang'));
  }
  applyLang();
}
$('langEn').onclick=()=>setLang('en');
$('langZh').onclick=()=>setLang('zh');
$('langVi').onclick=()=>setLang('vi');
$('langId').onclick=()=>setLang('id');
applyLang();
/* continue-run button + touch warning */
(function(){
  const s=loadSave();
  const b=$('btnContinue');
  if(s){
    b.classList.remove('hidden');
    b.textContent=T('cont',{f:floorName(s.checkpoint|0),m:T(s.mode==='lite'?'mode_lite':'mode_scary')});
  }
  b.onclick=()=>{
    const sv=loadSave();if(!sv)return;
    G.mp=false;G.host=true;G.myName=getName();
    if(!NOLOCK)lockPointer();
    bootRun(sv.mode||'scary',true);
  };
  if(window.matchMedia&&!window.matchMedia('(pointer:fine)').matches)menuMsg(T('msg_kbm'));
})();
$('btnSolo').onclick=()=>{G.mp=false;G.host=true;G.gameMode=G.selMode;G.myName=getName();showPrologue();};
$('btnHost').onclick=()=>{G.myName=getName();G.gameMode=G.selMode;hostRoom();};
$('btnJoin').onclick=()=>$('joinRow').classList.toggle('hidden');
$('btnConnect').onclick=()=>{
  const c=$('codeIn').value.trim().toUpperCase();
  if(c.length<3){menuMsg(T('msg_entercode'));return;}
  G.myName=getName();G.mp=true;G.host=false;joinRoom(c);
};
$('btnStart').onclick=()=>{
  if(!G.host)return;
  refreshLobby();
  G.seed=G.seed||(1+Math.floor(Math.random()*2e9));
  netBroadcast({t:'start',mode:G.gameMode||G.selMode,seed:G.seed});
  showPrologue();
};
$('btnLobbyLeave').onclick=()=>location.reload();
$('btnResume').onclick=()=>showPause(false);
$('btnQuit').onclick=()=>location.reload();
$('btnDeathMenu').onclick=()=>location.reload();
$('choiceTrust').onclick=()=>resolveJieun('trust');
$('choiceKill').onclick=()=>resolveJieun('kill');
$('giveMed').onclick=e=>{e.stopPropagation();giveJieunMedkit();};
$('btnRespawn').onclick=()=>{if(player.dead&&G.respawnPending)respawnPlayer();};
$('missionX').onclick=()=>showHelp(false);
$('helpBtn').onclick=()=>showHelp(!G.helpOpen);
$('specPrev').onclick=()=>specCycle(-1);$('specNext').onclick=()=>specCycle(1);$('specQuit').onclick=()=>location.reload();
$('giveClose').onclick=()=>closeGive();
$('vMic').onclick=()=>micToggle();$('vSpk').onclick=()=>spkToggle();
$('btnVicMenu').onclick=()=>location.reload();
$('lobbyCode').onclick=()=>{
  const c=$('lobbyCode').textContent;
  if(navigator.clipboard)navigator.clipboard.writeText(c).then(()=>menuMsg&&0);
  $('lobbyCode').textContent=T('lb_copied');
  setTimeout(()=>$('lobbyCode').textContent=net.code,700);
};
$('sensR').oninput=e=>{SET.sens=e.target.value/100;saveSet();};
$('volR').oninput=e=>{setVolume(e.target.value/100);};
$('fovR').oninput=e=>{SET.fov=+e.target.value;saveSet();};
document.body.addEventListener('click',()=>{if(G.mode==='playing'&&G.started&&!G.paused&&!G.uiLock&&!pointerLocked&&!player.dead)lockPointer();});

/* ---------------- init + main loop ---------------- */
function init(){
  setupCameraRig();
  setupPlayerBody();
  loop();
}
let lastT=performance.now(),fpsN=0,fpsT=0,perfTier=0,lockHintShown=false;
function loop(){
  requestAnimationFrame(loop);
  const now=performance.now();
  const dt=Math.min(0.05,(now-lastT)/1000);
  lastT=now;
  G.dt=dt;
  fpsN++;fpsT+=dt;
  if(fpsT>2.5){
    const fps=fpsN/fpsT;
    if(G.mode==='playing'&&G.started){
      if(perfTier<1&&fps<45){perfTier=1;renderer.setPixelRatio(Math.min(devicePixelRatio,1.2));}
      else if(perfTier<2&&fps<34){perfTier=2;renderer.setPixelRatio(1);}
    }
    fpsN=0;fpsT=0;
  }
  if(G.mode==='playing'&&G.started&&!G.paused&&ending){
    updateEnding(dt);
    updateBursts(dt);
  }else if(G.mode==='playing'&&G.started&&!G.paused){
    G.time+=dt;
    if(player.spec)updateSpectate(dt);
    else{updatePlayer(dt,G.time);updateInteract(dt);}
    updateChapters();
    for(const z of world.zombies)z.update(dt,G.time);
    watcherUpdate(dt);
    updateFlares(dt,G.time);
    updateEvents(dt);
    updateSub(dt);
    updatePings(dt);
    for(const it of world.items)it.update(G.time);
    for(const d of world.doors)d.update(dt);
    for(const gt of world.gates)gt.update(dt);
    for(const npc of world.npcs)npc.update(dt,G.time);
    if(G.mp){
      net.posT+=dt;net.snapT+=dt;
      if(!G.host&&net.posT>1/12){
        net.posT=0;
        netSend({t:'pos',x:+player.pos.x.toFixed(2),y:+player.pos.y.toFixed(2),z:+player.pos.z.toFixed(2),p:+player.pitch.toFixed(2),
          yaw:+player.yaw.toFixed(2),f:player.floor,fl:flagsBits(),hp:player.hp|0});
      }
      if(G.host&&net.snapT>1/8){
        net.snapT=0;
        const ps=[['H',+player.pos.x.toFixed(2),+player.pos.z.toFixed(2),+player.pos.y.toFixed(2),+player.yaw.toFixed(2),player.floor,flagsBits(),G.myName,+player.pitch.toFixed(2)]];
        for(const r of net.remotes.values())ps.push([r.id,+r.x.toFixed(2),+r.z.toFixed(2),+ (r.y||0).toFixed(2),+r.yaw.toFixed(2),r.f||0,r.fl||0,r.name,r.p||0]);
        const zb=world.zombies.map(z=>[z.id,+z.g.position.x.toFixed(1),+z.g.position.y.toFixed(1),+z.g.position.z.toFixed(1),+z.yaw.toFixed(1),z.state==='chase'?2:(z.state==='investigate'?1:0),z.dead?1:0,Math.max(0,ZTYPE_LIST.indexOf(z.type))]);
        const je=world.npcs&&npcByKey('jieun');
        const jp=je&&je.follow?[+je.parts.g.position.x.toFixed(2),+je.parts.g.position.y.toFixed(2),+je.parts.g.position.z.toFixed(2),+je.yaw.toFixed(2),je.f,Math.round(je.hp)]:null;
        const snap={t:'snap',ps,zb,jp};
        if(G.flags.flareLit)snap.xp=+extractProg.toFixed(3);
        netBroadcast(snap);
      }
      for(const r of net.remotes.values())if(r.vis)r.vis.update(dt,r);
    }
    updateRoof(dt);
    updateDebris(dt);
    hudTick(dt);
    updateBursts(dt);updateDrips(dt);
    updateDust(dt,G.time);
    if(world.clouds)for(const cl of world.clouds){cl.position.x+=dt*0.4;if(cl.position.x>70)cl.position.x=-70;}
    drawRing();
    hudSquad();
    const wantHint=G.started&&!pointerLocked&&!G.paused&&!G.uiLock&&!player.dead&&!G.flags.victory&&!NOLOCK;
    if(wantHint!==lockHintShown){lockHintShown=wantHint;$('lockHint').style.display=wantHint?'block':'none';}
    if(G.uiLock==='cctv')drawCCTV();
  }else if(G.mode==='playing'&&G.paused){
    // frozen; still render
  }
  renderer.render(scene,camera);
}
init();
/* test hook (harmless in-browser; powers the headless simulation harness) */
window.__game={G,INV,player,world,camera,KEY,mouse,CHECK,CFG,flares,net,scene,renderer,
  getMD:()=>MD,getXP:()=>extractProg,setXP:v=>{extractProg=v;},drawCCTV,openCCTV,giveJieunMedkit,onKey,questTarget,waypointDir,getQuest:()=>qi,setQuest:v=>{qi=v;},startWorld,beginGame,saveGame,loadSave,applySave,questCheck,resetWorld,addKeepClear,boxHitsKeepClear,
  QUEST,QI,questAt,npcByKey,startJieunChoice,resolveJieun,companion,doVictory,getEnding:()=>ending,takeItem,giveItem,openGive,micToggle,VOICE,damagePlayer,reviveLocal,playerTurns,onPlayerDown,GUN,interactTargets,freeSpot,inSafeRoom,lightRoofFlare,parkTurn,debris,ROOF,T,getExtract:()=>extractProg,getHold:()=>holdAct,workProg,
  spawnZombie,collideCircle,groundAt,losClear,doorPoint,noting:null,getAUD:()=>AUD,ensureAudio,
  step:(n=1)=>{ // headless/suspended-tab testing: run the update pipeline without rAF
    const dt=1/60;
    for(let i=0;i<n;i++){
      G.dt=dt;G.time+=dt;
      updatePlayer(dt,G.time);
      updateInteract(dt);
      updateChapters();
      for(const z of world.zombies)z.update(dt,G.time);
      updateFlares(dt,G.time);
      updateEvents(dt);
      updateSub(dt);
      updatePings(dt);
      for(const it of world.items)it.update(G.time);
      for(const d of world.doors)d.update(dt);
      for(const gt of world.gates)gt.update(dt);
      for(const npc of world.npcs)npc.update(dt,G.time);
      if(G.mp){/* net ticks skipped in step mode */}
      updateRoof(dt);
      updateDebris(dt);
      updateBursts(dt);
      updateDrips(dt);
      hudTick(dt);
      updateDust(dt,G.time);
      drawRing();
    }
    return G.time;
  }};
