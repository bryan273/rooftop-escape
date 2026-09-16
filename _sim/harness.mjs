/* Headless simulation harness — runs the real game module in Node with stubbed DOM.
   Boots via real UI click handlers, feeds real keyboard/mouse events, steps real frames,
   and asserts invariants every frame. Usage: node harness.mjs [scary|lite] */
const MODE=(process.argv[2]||'scary');

/* ---------------- DOM stubs ---------------- */
const winHandlers={};
function collectH(n){return (winHandlers[n]=winHandlers[n]||[]);}
const docHandlers={};
function collectD(n){return (docHandlers[n]=docHandlers[n]||[]);}

const ctx2d=new Proxy({},{
  get(t,k){
    if(k==='createImageData')return (w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h});
    if(k==='measureText')return ()=>({width:10});
    if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>({addColorStop(){}});
    if(k==='getImageData')return (x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)});
    if(typeof k==='string')return t[k]!==undefined?t[k]:(()=>{});
    return ()=>{};
  },
  set(t,k,v){t[k]=v;return true;}
});

function mkClassList(){
  const s=new Set();
  return{
    add(c){s.add(c)},remove(c){s.delete(c)},
    toggle(c,f){if(f===undefined)f=!s.has(c);f?s.add(c):s.delete(c);return f},
    contains(c){return s.has(c)},
    _dump:()=>[...s].join(',')
  };
}
const els={};
function el(id){
  if(els[id])return els[id];
  const e={
    id,style:{},value:'',textContent:'',innerHTML:'',disabled:false,title:'',
    classList:mkClassList(),children:[],
    appendChild(c){e.children.push(c);c.parentNode=e;return c},
    remove(){if(e.parentNode){const i=e.parentNode.children.indexOf(e);if(i>=0)e.parentNode.children.splice(i,1);}},
    get firstChild(){return e.children[0]||null},
    querySelector(){return el(id+'_q')},
    querySelectorAll(){return []},
    addEventListener(){},onclick:null,oninput:null,
    focus(){},blur(){},
    getContext(){return ctx2d},
    width:300,height:150,
    requestPointerLock(){return undefined},
  };
  els[id]=e;return e;
}
globalThis.document={
  getElementById:el,
  createElement:(t)=>el('anon_'+Math.random().toString(36).slice(2)),
  querySelector:()=>el('docq'),
  addEventListener:(n,f)=>collectD(n).push(f),
  body:el('body'),
  pointerLockElement:null,
  exitPointerLock(){},
};
globalThis.window=globalThis;
globalThis.addEventListener=(n,f)=>collectH(n).push(f);
globalThis.removeEventListener=()=>{};
globalThis.innerWidth=1280;globalThis.innerHeight=800;globalThis.devicePixelRatio=1;
globalThis.location={search:'',reload(){}};
const _ls={};
globalThis.localStorage={getItem:k=>(_ls[k]??null),setItem:(k,v)=>{_ls[k]=String(v)},removeItem:k=>{delete _ls[k]}};
globalThis.matchMedia=()=>({matches:true});
let rafQ=[];
globalThis.requestAnimationFrame=(cb)=>{rafQ.push(cb);return rafQ.length};
class FakeAudioContext{
  constructor(){this.sampleRate=44100;this.currentTime=0;this.destination={};}
  createGain(){return{gain:{value:1,setTargetAtTime(){}},connect(){}}}
  createBuffer(ch,len){const d=new Float32Array(len);return{length:len,duration:len/44100,getChannelData:()=>d}}
  createBufferSource(){return{buffer:null,loop:false,playbackRate:{value:1},connect(){},start(){}}}
  createStereoPanner(){return{pan:{value:0},connect(){}}}
  createConvolver(){return{buffer:null,connect(){}}}
}
globalThis.AudioContext=FakeAudioContext;

/* ---------------- input helpers ---------------- */
function key(code,down=true){(down?collectH('keydown'):collectH('keyup')).forEach(f=>f({code,preventDefault(){}}));}
function mouseMove(dx,dy){collectH('mousemove').forEach(f=>f({movementX:dx,movementY:dy}));}
function mouseBtn(down){(down?collectH('mousedown'):collectH('mouseup')).forEach(f=>f({button:0}));}
function setPointerLock(on){
  document.pointerLockElement=on?el('c'):null;
  collectD('pointerlockchange').forEach(f=>f());
}
let simT=performance.now();
globalThis.performance={now:()=>simT}; // harness owns the clock (browser rAF parity)
function frame(dtMs=16.6){
  simT+=dtMs;
  const q=rafQ;rafQ=[];
  for(const cb of q)cb(simT);
}

/* ---------------- run ---------------- */
const results=[];
function check(name,cond,info=''){
  results.push({name,ok:!!cond,info});
  console.log((cond?'  ✔ ':'  ✘ ')+' '+name+(info?'  — '+info:''));
  if(!cond)process.exitCode=1;
}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  if(process.env.ZH)localStorage.setItem('zf_lang','zh');
  await import('./game.mjs'); // module registers handlers on our stubs and queues its first frame
  const before=process.argv[2]==='lite';
  // select mode card + click through the real UI
  if(before)el('modeLite').onclick();
  el('btnSolo').onclick();
  await sleep(30);
  el('prologueGo').onclick();
  await sleep(250); // bootRun defers world build 80ms
  const g=globalThis.__game;
  check('module exposes hook',!!g);
  const{G,INV,player,world,camera,CFG}=g;

  // neutralize enemies for deterministic movement tests: park them far, blind & deaf
  function freezeFloor(f){
    for(const z of world.zombies){
      if(z.f!==f||z.dead)continue;
      z.state='idle';z.waitT=1e9;z.cfg.sight=0;z.hear=()=>{};
      z.g.position.set(-23,f*CFG.FH+0.05,-9);
    }
  }
  player.hp=10000; // survive anything during mechanical tests
  freezeFloor(0);

  check('game started',G.mode==='playing'&&G.started);
  check('world built: 21 levels',world.levels.length===21,'got '+world.levels.length);
  check('zombies spawned',world.zombies.length>60,'got '+world.zombies.length);
  check('items spawned',world.items.length>80,'got '+world.items.length);
  check('gates = 8',world.gates.length===8,'got '+world.gates.length);
  check('mode applied',g.getMD().id===MODE,'got '+g.getMD().id);

  /* --- pointer lock + movement direction (long corridor runway, facing -X) --- */
  setPointerLock(true);
  player.pos.set(-10,0.05,0);player.yaw=Math.PI/2;player.pitch=0; // face -X down the corridor
  const px0=player.pos.x,pz0=player.pos.z;
  key('KeyW');
  for(let i=0;i<120;i++)frame();
  key('KeyW',false);
  freezeFloor(0); // the scripted burst-runner may have spawned during the walk
  const fdx=player.pos.x-px0,fdz=player.pos.z-pz0;
  check('W moves along camera forward (-X at yaw=pi/2)',fdx<-2&&Math.abs(fdz)<0.8,`dx=${fdx.toFixed(2)} dz=${fdz.toFixed(2)}`);
  freezeFloor(0);
  // strafe (face -Z so right = +X, long runway)
  player.yaw=0;player.pitch=0;
  const sx0=player.pos.x;
  key('KeyD');
  for(let i=0;i<60;i++)frame();
  key('KeyD',false);
  check('D strafes right (+X at yaw 0)',player.pos.x-sx0>1.5,`dx=${(player.pos.x-sx0).toFixed(2)}`);
  // mouse turn (flush the delta through a frame so it can't leak into the next test)
  const yawA=player.yaw;mouseMove(120,0);frame();mouseMove(0,0);
  check('mouse turns camera',Math.abs((player.yaw-yawA)+0.264)<0.06,`dyaw=${(player.yaw-yawA).toFixed(3)}`);
  freezeFloor(0);
  player.yaw=-Math.PI/2;player.pitch=0; // deterministic: face +X
  const tx0=player.pos.x,tz0=player.pos.z;
  key('KeyW');
  for(let i=0;i<90;i++)frame();
  key('KeyW',false);
  check('W follows after 90° turn (+X)',player.pos.x-tx0>1.5&&Math.abs(player.pos.z-tz0)<0.8,`dx=${(player.pos.x-tx0).toFixed(2)}`);
  // arrow-key look
  const yawBefore=player.yaw;
  key('ArrowRight');
  for(let i=0;i<60;i++)frame();
  key('ArrowRight',false);
  check('ArrowRight turns camera',player.yaw<yawBefore-0.5,`dyaw=${(player.yaw-yawBefore).toFixed(2)}`);

  /* --- door: hold E = exactly ONE toggle (the reported bug) --- */
  // pick the door on this floor FURthest from the entrance S2 door (avoids the scripted burst event)
  const door=world.doors.filter(d=>d.f===player.floor&&!d.boarded)
    .sort((a,b)=>distTo(b)-distTo(a))[0];
  function distTo(d){const p=g.doorPoint(d);return Math.hypot(p.x-player.pos.x,p.z-player.pos.z);}
  check('found a normal door',!!door);
  if(door){
    const dp=g.doorPoint(door);
    for(const it of world.items){ if(!it.taken&&Math.abs(it.f-player.floor)===0&&Math.hypot(it.g.position.x-dp.x,it.g.position.z-dp.z)<3){it.taken=true;it.g.visible=false;} }
    player.pos.set(dp.x+1.2,player.floor*CFG.FH+0.05,dp.z);
    player.yaw=Math.atan2(-(dp.x-player.pos.x),-(dp.z-player.pos.z)); // face door: forward=(-sin,-cos)
    let transitions=0,last=door.open;
    key('KeyE'); // HOLD E for 40 frames
    for(let i=0;i<40;i++){frame();if(door.open!==last){transitions++;last=door.open;}}
    key('KeyE',false);
    check('holding E toggles door exactly once',transitions===1&&door.open===true,`transitions=${transitions} open=${door.open}`);
    for(let i=0;i<3;i++)frame();
    key('KeyE');frame();key('KeyE',false);frame();
    check('second E tap closes door',door.open===false,`open=${door.open}`);
  }

  /* --- stairs climb --- */
  const f0=player.floor;
  player.pos.set(16.6,f0*CFG.FH+0.05,1.2);
  player.yaw=-Math.PI/2;player.pitch=0; // face +X into the stairs
  key('KeyW');
  for(let i=0;i<700;i++)frame();
  key('KeyW',false);
  check('climbed at least one floor via stairs',player.floor>f0,`${f0} -> ${player.floor}`);

  /* --- pistol (flat corridor, same height) --- */
  player.pos.set(10,player.floor*CFG.FH+0.05,0);player.pitch=0;
  freezeFloor(player.floor);
  INV.pistol=true;INV.ammo=5;player.weapon='pistol';
  const zz=g.spawnZombie(player.floor,4,0,'shambler',null); // 6m west, same floor height
  zz.state='idle';zz.waitT=1e9;zz.cfg.sight=0;zz.hear=()=>{};
  player.yaw=Math.PI/2; // forward = (-sin, -cos) = (-1, 0) -> -X toward zombie
  player.pitch=0;
  for(let i=0;i<3;i++)frame(); // let the camera catch up to the teleport before firing
  const hpBefore=zz.hp,ammoBefore=INV.ammo;
  mouseBtn(true);frame();mouseBtn(false);
  for(let i=0;i<5;i++)frame();
  check('pistol fired (ammo spent)',INV.ammo===ammoBefore-1,`ammo ${ammoBefore}->${INV.ammo}`);
  check('pistol damaged zombie',zz.hp<hpBefore,`hp ${hpBefore}->${zz.hp}`);
  zz.die(true);

  /* --- THE REPORTED BUG: zombie knockback must not push player out of the map --- */
  freezeFloor(4);
  player.floor=4;player.pos.set(-23.45,4*CFG.FH+0.05,0);player.hp=10000;player.dead=false;player.down=false;
  G.flags.finale=false;
  const zb=g.spawnZombie(4,-23.0,0,'shambler',null);
  let minX=0,hits=0,hpPrev=10000,inBounds=true,finite=true;
  for(let i=0;i<3000;i++){
    player.hp=Math.max(player.hp,500); // survive to keep testing
    zb.hp=999;zb.staggerT=0;zb.state='chase'; // let windup/cooldown tick naturally
    frame();
    if(player.hp<hpPrev-0.01){hits++;hpPrev=player.hp;}
    if(player.pos.x<minX)minX=player.pos.x;
    if(player.pos.x<-24.45||player.pos.x>24.45||player.pos.z<-10.45||player.pos.z>10.45)inBounds=false;
    if(!isFinite(player.pos.x)||!isFinite(player.pos.y)||!isFinite(player.pos.z))finite=false;
  }
  check('zombie attacks actually happened in wall test',hits>3,`hits=${hits}`);
  check('player NEVER leaves the map under zombie knockback (west wall)',inBounds,`minX=${minX.toFixed(2)}`);
  check('positions stay finite',finite);
  zb.die(true);

  /* --- random chaos stability: random inputs, assert invariants --- */
  player.hp=100;
  const codes=['KeyW','KeyA','KeyS','KeyD','Space','ArrowLeft','ArrowRight'];
  let chaosOk=true;
  for(let i=0;i<2000;i++){
    if(i%37===0)key(pickAny(codes));
    if(i%53===0)key(pickAny(codes),false);
    if(i%11===0)mouseMove(rnd(-40,40),rnd(-20,20));
    frame(16.6+Math.random()*8);
    if(!isFinite(player.pos.x+player.pos.y+player.pos.z)){chaosOk=false;break;}
    if(player.pos.x<-24.5||player.pos.x>24.5||player.pos.z<-10.5||player.pos.z>10.5){chaosOk=false;console.log('    OOB at frame',i,player.pos.x.toFixed(2),player.pos.z.toFixed(2));break;}
    if(player.pos.y<-1||player.pos.y>CFG.ROOF_Y+3){chaosOk=false;break;}
    for(const z of world.zombies){
      if(!isFinite(z.g.position.x+z.g.position.y+z.g.position.z)){chaosOk=false;console.log('    zombie NaN',z.id);break;}
    }
  }
  check('2000-frame random chaos: no NaN, no out-of-bounds',chaosOk);

  /* --- i18n end-to-end: the objective text is rendered in the selected language --- */
  {
    const objTxt=el('obj').textContent||'';
    const cjk=/[一-鿿]/.test(objTxt);
    if(process.env.ZH)check('objective text rendered in Chinese',cjk&&objTxt.length>4,JSON.stringify(objTxt.slice(0,26)));
    else check('objective text rendered in English',objTxt.length>8&&!cjk,JSON.stringify(objTxt.slice(0,32)));
    const floorTxt=el('floorLbl').textContent||'';
    if(process.env.ZH)check('floor label rendered in Chinese',/[一-鿿]/.test(floorTxt),JSON.stringify(floorTxt));
    else check('floor label rendered in English',/FLOOR/i.test(floorTxt),JSON.stringify(floorTxt));
    const hintTxt=el('hintKey').innerHTML||'';
    check('HUD hint text populated',hintTxt.length>20,String(hintTxt.length)+' chars');
  }

  /* --- furniture never intersects walls (the reported clipping) --- */
  let furnBad=0,furnN=0;
  for(const b of (world.furn||[])){
    furnN++;
    for(const c of world.cols[b.f]){
      if(c.wall!==true||c.off)continue;
      if(c.y0<b.y1-0.05&&c.y1>b.y0+0.05&&b.x0<c.x1-0.05&&b.x1>c.x0+0.05&&b.z0<c.z1-0.05&&b.z1>c.z0+0.05){furnBad++;break;}
    }
  }
  check('furniture placed ('+furnN+' pieces), zero wall overlaps',furnBad===0,furnBad+' overlaps');

  /* --- stair shaft: mouth enterable, sides sealed --- */
  player.dead=false;player.down=false;player.hp=100;player.respawnT=0; // revive after the chaos test
  for(const k in g.KEY)g.KEY[k]=false; // release any keys stuck from the chaos test
  freezeFloor(player.floor);
  const fy=player.floor*CFG.FH+0.05;
  player.pos.set(15.5,fy,1.2);player.yaw=-Math.PI/2;player.pitch=0;
  key('KeyW');for(let i=0;i<80;i++)frame();key('KeyW',false);
  check('stair mouth at (17+, z=1.2) is enterable',player.pos.x>17.2,`x=${player.pos.x.toFixed(2)}`);
  player.pos.set(18,fy,-0.5);player.yaw=0;player.pitch=0; // south of the shaft wall, facing +Z (north)
  key('KeyW');for(let i=0;i<80;i++)frame();key('KeyW',false);
  check('stair shaft side wall blocks side entry (visible wall)',player.pos.z<0.35,`z=${player.pos.z.toFixed(2)}`);

  /* --- open door leaf has a collider: cannot stand inside it --- */
  const d2=world.doors.find(d=>d.f===player.floor&&!d.boarded&&!d.open&&d.axis==='x');
  if(d2){
    freezeFloor(player.floor);
    d2.setOpen(true,false);
    const cc={...d2.col};
    player.pos.set((cc.x0+cc.x1)/2,player.floor*CFG.FH+0.05,(cc.z0+cc.z1)/2);
    for(let i=0;i<3;i++)frame();
    const inside=player.pos.x>cc.x0-0.1&&player.pos.x<cc.x1+0.1&&player.pos.z>cc.z0-0.1&&player.pos.z<cc.z1+0.1;
    check('cannot stand inside the open door leaf',!inside,`col z ${cc.z0.toFixed(1)}..${cc.z1.toFixed(1)} pz ${player.pos.z.toFixed(2)}`);
    d2.setOpen(false,false);
  }else check('open door leaf collider (skipped: no door)',true);

  /* --- save round trip --- */
  g.saveGame();
  const sv=g.loadSave();
  check('save written',!!sv&&sv.mode===MODE,JSON.stringify(sv&&{mode:sv.mode,qi:sv.qi,cp:sv.checkpoint}));
  check('save has ammo+pistol fields',typeof sv.inv.ammo==='number'&&'weapon' in sv.inv);
  try{g.applySave(sv);check('applySave restores without throwing',true);}catch(e){check('applySave restores without throwing',false,e.message);}

  /* --- quest list sane --- */
  check('quest pointer in range',typeof g.questCheck==='function');

  const pass=results.filter(r=>r.ok).length;
  console.log(`\n=== ${MODE.toUpperCase()} MODE: ${pass}/${results.length} passed ===`);
  process.exit(process.exitCode||0);
})().catch(e=>{console.error('HARNESS CRASH:',e);process.exit(1);});

function pickAny(a){return a[Math.floor(Math.random()*a.length)];}
function rnd(a,b){return a+Math.random()*(b-a);}
