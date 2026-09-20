/* Headless simulation harness — runs the real game module in Node with a stubbed DOM.
   Boots through the real UI click handlers, feeds real keyboard/mouse events, steps real frames
   and asserts invariants. Includes a FULL scripted playthrough of the mission chain.
   Usage:  node _sim/build.mjs && node _sim/harness.mjs [scary|lite] [zh] [coop] */
const MODE=(process.argv[2]||'scary');
if(process.argv.includes('zh'))process.env.ZH='1';      // cross-platform flags: node _sim/harness.mjs scary zh coop
if(process.argv.includes('coop'))process.env.MP='1';
// Ji-eun's choice in the playthrough: trust (default) | kill | timeout
const CHOICE=process.argv.includes('kill')?'kill':(process.argv.includes('timeout')?'timeout':'trust');

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
  return{add(c){s.add(c)},remove(c){s.delete(c)},
    toggle(c,f){if(f===undefined)f=!s.has(c);f?s.add(c):s.delete(c);return f},
    contains(c){return s.has(c)},_dump:()=>[...s].join(',')};
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
  createElement:()=>el('anon_'+Math.random().toString(36).slice(2)),
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
const param=()=>({value:1,setTargetAtTime(){}});
class FakeAudioContext{
  constructor(){this.sampleRate=44100;this.currentTime=0;this.destination={};this.state='running';}
  createGain(){return{gain:param(),connect(){}}}
  createDynamicsCompressor(){return{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){}}}
  createBuffer(ch,len){const d=new Float32Array(len);return{length:len,duration:len/44100,getChannelData:()=>d}}
  createBufferSource(){return{buffer:null,loop:false,playbackRate:{value:1},connect(){},start(){}}}
  createStereoPanner(){return{pan:{value:0},connect(){}}}
  createConvolver(){return{buffer:null,connect(){}}}
  decodeAudioData(){return Promise.resolve(this.createBuffer(1,10));}
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
// Sample each room front wall at waist and head height: every point outside a doorway must be inside a
// wall box, and every doorway must have a lintel above it.
export function wallHoles(world,CFG){
  const out=[];
  for(const w of world.frontWalls||[]){
    const y=w.f*CFG.FH,cols=world.cols[w.f].filter(c=>c.wall);
    const solid=(x,yy)=>cols.some(c=>x>=c.x0-1e-3&&x<=c.x1+1e-3&&w.z>=c.z0-1e-3&&w.z<=c.z1+1e-3&&yy>=c.y0&&yy<=c.y1);
    for(let x=w.x0+0.15;x<w.x1-0.15;x+=0.1){
      const inDoor=w.doors.some(d=>Math.abs(x-d)<0.9);
      if(inDoor){if(!solid(x,y+2.6)){out.push(`F${w.f}${w.key}:no-lintel@${x.toFixed(1)}`);break;}}
      else if(!solid(x,y+1)||!solid(x,y+2.6)){out.push(`F${w.f}${w.key}:hole@${x.toFixed(1)}`);break;}
    }
  }
  return out;
}
function check(name,cond,info=''){
  results.push({name,ok:!!cond,info});
  console.log((cond?'  ✔ ':'  ✘ ')+' '+name+(info?'  — '+info:''));
  if(!cond)process.exitCode=1;
}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  if(process.env.ZH)localStorage.setItem('zf_lang','zh');
  await import('./game.mjs');
  const g0=()=>globalThis.__game;
  if(MODE==='lite')el('modeLite').onclick();
  el('btnSolo').onclick();
  await sleep(30);
  if(process.env.MP){g0().G.mp=true;g0().G.host=true;}  // co-op world build
  el('prologueGo').onclick();
  await sleep(250); // bootRun defers world build 80ms
  const g=g0();
  check('module exposes hook',!!g);
  const{G,INV,player,world,camera,CFG,QUEST,QI,T}=g;
  const F=CFG.FLOORS;

  /* ======== i18n: every key the code uses exists in BOTH languages ======== */
  {
    const fs=await import('node:fs');
    const src=fs.readFileSync(new URL('../js/game.js',import.meta.url),'utf8');
    const used=new Set([...src.matchAll(/\bT\('([a-zA-Z0-9_]+)'[,)]/g)].map(m=>m[1]));
    for(const m of src.matchAll(/T\(([a-z]+)\?'([a-zA-Z0-9_]+)':'([a-zA-Z0-9_]+)'/g)){used.add(m[2]);used.add(m[3]);}
    for(const q of QUEST){used.add(q.k);if(q.kl)used.add(q.kl);used.add('qh_'+q.k.slice(2));}
    for(const c of ['red','blue','yellow'])used.add('col_'+c),used.add('gw_'+c);
    for(const k of ['e','hold','enter','space'])used.add('k_'+k);
    for(let f=0;f<F;f++){used.add('s'+f);used.add('sl'+f);}
    for(const k of ['npc1_1','npc1_2','npc1_3','npc1l_1','npc1l_2','npc1l_3','npc2_1','npc2_2','npc2_3','npc2_4','npc2l_1','npc2l_2','npc2l_3','npc2l_4','br1','br2','br3'])used.add(k);
    const probe=(lang)=>{localStorage.setItem('zf_lang',lang);};
    const missing={en:[],zh:[]};
    // T() falls back to English; test the raw tables through a tiny eval of the module source
    const m=src.match(/const I18N=\{[\s\S]*?\n\}\};/);
    const I18N=(new Function(m[0]+';return I18N;'))();
    for(const k of used){if(I18N.en[k]===undefined)missing.en.push(k);if(I18N.zh[k]===undefined)missing.zh.push(k);}
    check('i18n: every used key exists in English',missing.en.length===0,missing.en.join(' '));
    check('i18n: every used key exists in Chinese',missing.zh.length===0,missing.zh.join(' '));
    const stale=[];
    for(const lang of ['en','zh'])for(const [k,v] of Object.entries(I18N[lang])){
      if(/Floor\s*(1[0-9]|[7-9])\b|Twenty|20 floors|二十层|(1[0-9]|[7-9])层/.test(v))stale.push(lang+':'+k);
    }
    check('story text only mentions floors that exist (no "Floor 12", "Twenty floors")',stale.length===0,stale.join(' '));
    probe(process.env.ZH?'zh':'en');
  }

  /* ---------------- world sanity ---------------- */
  function freezeFloor(f){
    for(const z of world.zombies){
      if(z.f!==f||z.dead)continue;
      z.state='idle';z.waitT=1e9;z.cfg.sight=0;z.hear=()=>{};
      z.g.position.set(-23,f*CFG.FH+0.05,8.5);
    }
  }
  function calmAll(){ for(const z of world.zombies){ if(z.dead)continue; z.state='idle';z.waitT=1e9;z.cfg.sight=0;z.hear=()=>{}; z.g.position.set(-23,z.f*CFG.FH+0.05,8.5);} }
  player.hp=10000;
  freezeFloor(0);

  check('game started',G.mode==='playing'&&G.started);
  check('world built: 6 floors + ground + roof = 8 levels',world.levels.length===F+1,'got '+world.levels.length);
  check('zombies spawned',world.zombies.length>=15,'got '+world.zombies.length);
  check('items spawned',world.items.length>=40,'got '+world.items.length);
  {const inR=(f,x0,x1,z0,z1)=>world.items.filter(it=>it.type==='ammo'&&it.f===f&&it.g.position.x>x0&&it.g.position.x<x1&&it.g.position.z>z0&&it.g.position.z<z1).length;
   const a3=inR(3,-24,-9,1.6,10),a5=inR(5,3,16,1.6,10),aR=inR(F,10,15,-5,-2.5);
   check('ammo rooms stocked (Floor 3 storage, Floor 5 armory, roof crate)',a3>=5&&a5>=6&&aR>=5,`F3=${a3} F5=${a5} roof=${aR}`);}
  check('gates = 6',world.gates.length===6,'got '+world.gates.length);
  check('mode applied',g.getMD().id===MODE,'got '+g.getMD().id);
  check('two survivors placed (Park on 3, Ji-eun on 5)',g.npcByKey('park')?.f===3&&g.npcByKey('jieun')?.f===5);
  check('objective 1 is the flashlight',QUEST[g.getQuest()].k==='q_torch',QUEST[g.getQuest()].k);
  {
    const inSafe=world.zombies.filter(z=>!z.dead&&g.inSafeRoom(z.f,z.g.position.x,z.g.position.z));
    check('no zombie spawned inside Ji-eun\'s hiding room',inSafe.length===0,inSafe.length+' inside');
    // every pickup sits on open floor (not inside a wall / desk / bed / locker)
    const bad=[];
    for(const it of world.items){
      const onDesk=['story-card-red','story-pistol','n2'].some(p=>it.id.startsWith(p))||it.id.startsWith('story-ammo')||it.id.startsWith('story-flashlight');
      if(onDesk)continue;
      const y=it.f*CFG.FH;
      if(it.g.position.y<y-0.01||it.g.position.y>y+0.2)bad.push(it.id+':y');
      else if(!g.freeSpot(it.f,it.g.position.x,it.g.position.z,0.05))bad.push(it.id+'@F'+it.f);
    }
    check('every item rests on open floor at its own floor height (notes included)',bad.length===0,bad.slice(0,8).join(' '));
    const floating=world.items.filter(i=>i.type==='note'&&Math.abs(i.g.position.y-(i.f*CFG.FH+0.03))>0.9);
    check('notes are on their own floor (not at ground-floor height)',floating.length===0,floating.map(n=>n.id).join(' '));
  }

  /* ---------------- movement ---------------- */
  setPointerLock(true);
  player.pos.set(-10,0.05,0);player.yaw=Math.PI/2;player.pitch=0;
  const px0=player.pos.x,pz0=player.pos.z;
  key('KeyW');for(let i=0;i<120;i++)frame();key('KeyW',false);
  freezeFloor(0);
  const fdx=player.pos.x-px0,fdz=player.pos.z-pz0;
  check('W moves along camera forward (-X at yaw=pi/2)',fdx<-2&&Math.abs(fdz)<0.8,`dx=${fdx.toFixed(2)} dz=${fdz.toFixed(2)}`);
  player.yaw=0;player.pitch=0;
  const sx0=player.pos.x;
  key('KeyD');for(let i=0;i<60;i++)frame();key('KeyD',false);
  check('D strafes right (+X at yaw 0)',player.pos.x-sx0>1.5,`dx=${(player.pos.x-sx0).toFixed(2)}`);
  const yawA=player.yaw;mouseMove(120,0);frame();mouseMove(0,0);
  check('mouse turns camera',Math.abs((player.yaw-yawA)+0.264)<0.06,`dyaw=${(player.yaw-yawA).toFixed(3)}`);
  {
    const y0=player.pos.y;player.pos.set(-10,0.05,0);
    key('Space');let top=0;for(let i=0;i<30;i++){frame();top=Math.max(top,player.pos.y);}key('Space',false);
    for(let i=0;i<40;i++)frame();
    check('Space jumps',top>0.3,`peak=${top.toFixed(2)}`);
  }

  /* --- door: hold E = exactly ONE toggle --- */
  const distTo=d=>{const p=g.doorPoint(d);return Math.hypot(p.x-player.pos.x,p.z-player.pos.z);};
  const door=world.doors.filter(d=>d.f===player.floor&&!d.boarded).sort((a,b)=>distTo(b)-distTo(a))[0];
  if(door){
    const dp=g.doorPoint(door);
    for(const it of world.items){ if(!it.taken&&it.f===player.floor&&Math.hypot(it.g.position.x-dp.x,it.g.position.z-dp.z)<3){it.taken=true;it.g.visible=false;} }
    player.pos.set(dp.x,player.floor*CFG.FH+0.05,dp.z-Math.sign(dp.z)*1.2);   // in the corridor, facing the doorway
    player.yaw=Math.atan2(-(dp.x-player.pos.x),-(dp.z-player.pos.z));
    let transitions=0,last=door.open;
    key('KeyE');for(let i=0;i<40;i++){frame();if(door.open!==last){transitions++;last=door.open;}}key('KeyE',false);
    check('holding E toggles door exactly once',transitions===1&&door.open===true,`transitions=${transitions} open=${door.open}`);
    for(let i=0;i<3;i++)frame();
    key('KeyE');frame();key('KeyE',false);frame();
    check('second E tap closes door',door.open===false,`open=${door.open}`);
  }

  /* --- stairs: climb AND leave the shaft, every flight including the roof --- */
  {
    const saved=world.gates.map(gt=>({gt,locked:gt.locked,open:gt.open,off:gt.col.off}));
    for(const gt of world.gates){gt.col.off=true;}
    let fail=[];
    for(let target=1;target<=F;target++){
      freezeFloor(target);
      player.pos.set(16.5,(target-1)*CFG.FH+0.05,1.2);player.yaw=-Math.PI/2;player.pitch=0;player.vy=0;
      for(const k in g.KEY)g.KEY[k]=false;
      const runF=n=>{for(let i=0;i<n;i++){if(G.uiLock==='chapter')el('chSkip').onclick();if(target===F)freezeFloor(F);player.hp=Math.max(player.hp,5000);frame();}};
      key('KeyW');runF(700);key('KeyW',false);
      const climbed=player.floor;
      player.yaw=0;key('KeyW');runF(260);key('KeyW',false);
      const exitA=player.pos.z<0.42&&player.floor===target;
      if(!(climbed>=target&&exitA))fail.push(`F${target}: climbed=${climbed} z=${player.pos.z.toFixed(2)}`);
      for(let i=0;i<5;i++){if(G.uiLock==='chapter')el('chSkip').onclick();frame();}
    }
    for(const s of saved){s.gt.col.off=s.off;}
    check('every flight (1..roof) is climbable and you can step off it',fail.length===0,fail.join(' | '));
  }

  /* --- zombie knockback must not push the player out of the map --- */
  {
    freezeFloor(4);
    player.floor=4;player.pos.set(-23.45,4*CFG.FH+0.05,0);player.hp=10000;player.dead=false;player.down=false;
    const zb=g.spawnZombie(4,-23.0,0,'shambler',null);
    let hits=0,hpPrev=10000,inBounds=true;
    for(let i=0;i<2000;i++){
      player.hp=Math.max(player.hp,500);
      zb.hp=999;zb.staggerT=0;zb.state='chase';
      frame();
      if(player.hp<hpPrev-0.01){hits++;hpPrev=player.hp;}
      if(Math.abs(player.pos.x)>24.45||Math.abs(player.pos.z)>10.45)inBounds=false;
    }
    check('zombie attacks happened in wall test',hits>3,`hits=${hits}`);
    check('player never leaves the map under zombie knockback',inBounds);
    zb.die(true);
  }

  /* --- flood-fill: corridor/lane/tower connected and no room sealed off --- */
  {
    for(const dd of world.doors){ if(dd.f<F&&!dd.boarded){ dd.setOpen(true,false); } }
    const STEP=0.5,X0=-23.5,X1=23.5,Z0=-9.5,Z1=9.5;
    const NX=Math.floor((X1-X0)/STEP)+1,NZ=Math.floor((Z1-Z0)/STEP)+1;
    const idx=(ix,iz)=>iz*NX+ix;
    const problems=[];
    for(let f=0;f<F;f++){
      const y=f*CFG.FH,free=new Uint8Array(NX*NZ);
      for(let iz=0;iz<NZ;iz++)for(let ix=0;ix<NX;ix++){
        const x=X0+ix*STEP,z=Z0+iz*STEP;
        const gy=g.groundAt(x,z,y+0.4);
        if(!(gy>y-0.3&&gy<y+CFG.FH+0.2))continue;
        const c=g.collideCircle(x,z,y+0.05,f,CFG.R);
        if(Math.hypot(c[0]-x,c[1]-z)>0.02)continue;
        free[idx(ix,iz)]=1;
      }
      const si=Math.round((10-X0)/STEP),sj=Math.round((0-Z0)/STEP);
      if(!free[idx(si,sj)]){problems.push(`F${f}:corridor-seed`);continue;}
      const seen=new Uint8Array(NX*NZ),q=[[si,sj]];seen[idx(si,sj)]=1;
      while(q.length){const [ix,iz]=q.pop();
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=ix+dx,nz=iz+dz;if(nx<0||nz<0||nx>=NX||nz>=NZ)continue;
          const k=idx(nx,nz);if(seen[k]||!free[k])continue;seen[k]=1;q.push([nx,nz]);}}
      const at=(x,z)=>{const ix=Math.round((x-X0)/STEP),iz=Math.round((z-Z0)/STEP);return ix>=0&&iz>=0&&ix<NX&&iz<NZ&&!!seen[idx(ix,iz)];};
      for(const [n,x,z] of [['laneMouth',17.1,1.2],['towerStrip',19,-1.2],...(f>0?[['landing',23.4,1.2]]:[])])if(!at(x,z))problems.push(`F${f}:${n}`);
      for(const r of world.layout[f].rooms){
        let any=false;
        for(let iz=0;iz<NZ&&!any;iz++)for(let ix=0;ix<NX;ix++){
          const x=X0+ix*STEP,z=Z0+iz*STEP;
          if(x<r.x0+0.7||x>r.x1-0.7||z<Math.min(r.z0,r.z1)+0.7||z>Math.max(r.z0,r.z1)-0.7)continue;
          if(at(x,z)){any=true;break;}
        }
        if(!any){
          // a boarded (still closed) deco door legitimately seals its room
          const sealed=world.doors.some(d=>d.f===f&&d.boarded&&d.g.position.x>r.x0-1&&d.g.position.x<r.x1+1);
          if(!sealed)problems.push(`F${f}:room@${r.x0}`);
        }
      }
      // mission spots must be reachable
      const spots={2:[[0.8,-7.4],[-5,-3.1]],4:[[9,-8.0]],5:[[-21.2,-8.2]],3:[[12.3,0.2]]}[f]||[];
      const near=(x,z)=>{for(let dx=-1;dx<=1;dx+=0.5)for(let dz=-1;dz<=1;dz+=0.5)if(at(x+dx,z+dz))return true;return false;};
      for(const [x,z] of spots)if(!near(x,z))problems.push(`F${f}:spot(${x},${z})`);
    }
    for(const dd of world.doors){ if(dd.open)dd.setOpen(false,false); }
    check('flood fill: every floor connected, no room sealed, mission spots reachable',problems.length===0,problems.slice(0,8).join(' '));
  }

  /* --- every room's front wall is solid except its doorways (the "open room" bug) --- */
  {
    const holes=wallHoles(world,CFG);
    check('room front walls solid (only doorways open)',world.frontWalls.length===F*6&&holes.length===0,holes.slice(0,6).join(' ')||`walls=${world.frontWalls.length}`);
  }
  if(process.argv.includes('walls')){ // stress: rebuild many random buildings and re-check the walls
    const bad=[];
    for(let i=0;i<40;i++){
      g.resetWorld();g.startWorld(MODE);
      const h=wallHoles(world,CFG);
      if(h.length||world.frontWalls.length!==F*6)bad.push(`#${i}: ${h[0]||'walls='+world.frontWalls.length}`);
    }
    check('40 random buildings: every room front wall solid',bad.length===0,bad.slice(0,4).join(' '));
    process.exit(process.exitCode||0);
  }

  /* --- random chaos: random inputs, no NaN, never out of the map --- */
  {
    player.hp=100000;player.dead=false;player.down=false;
    const codes=['KeyW','KeyA','KeyS','KeyD','Space','ArrowLeft','ArrowRight','KeyE','KeyQ','Enter','KeyC','KeyF'];
    let ok=true,why='';
    for(let i=0;i<2000;i++){
      if(i%37===0)key(codes[Math.floor(Math.random()*codes.length)]);
      if(i%53===0)key(codes[Math.floor(Math.random()*codes.length)],false);
      if(i%11===0)mouseMove(Math.random()*80-40,Math.random()*40-20);
      if(G.uiLock==='note'||G.uiLock==='cctv'){key('Escape');key('Escape',false);}
      if(G.uiLock==='chapter')el('chSkip').onclick();
      frame(16.6+Math.random()*8);
      const p=player.pos;
      if(!isFinite(p.x+p.y+p.z)){ok=false;why='NaN';break;}
      if(Math.abs(p.x)>24.5||Math.abs(p.z)>10.5){ok=false;why=`out of map ${p.x.toFixed(1)},${p.z.toFixed(1)}`;break;}
      if(world.zombies.some(z=>!isFinite(z.g.position.x+z.g.position.y+z.g.position.z))){ok=false;why='zombie NaN';break;}
    }
    for(const k in g.KEY)g.KEY[k]=false;
    player.crouch=false;player.third=false;player.on=false;
    check('2000 frames of random input: no NaN, never out of the map',ok,why);
  }
  /* --- pause policy: solo pauses when the mouse is released, co-op keeps running --- */
  {
    const lockEvt=()=>collectD('pointerlockchange').forEach(f=>f());
    G.mp=false;G.paused=false;G.uiLock=null;document.pointerLockElement=null;lockEvt();
    const soloPaused=G.paused;
    G.paused=false;el('pause').style.display='none';
    const wasMp=G.mp;G.mp=true;G.host=true;document.pointerLockElement=null;lockEvt();
    const coopPaused=G.paused;
    G.mp=!!process.env.MP;G.paused=false;setPointerLock(true);
    check('solo pauses on mouse release, co-op keeps the world running',soloPaused===true&&coopPaused===false,`solo=${soloPaused} coop=${coopPaused}`);
  }

  /* --- furniture never intersects walls --- */
  {
    let furnBad=0,furnN=0;
    for(const b of (world.furn||[])){
      furnN++;
      for(const c of world.cols[b.f]){
        if(c.wall!==true||c.off)continue;
        if(c.y0<b.y1-0.05&&c.y1>b.y0+0.05&&b.x0<c.x1-0.05&&b.x1>c.x0+0.05&&b.z0<c.z1-0.05&&b.z1>c.z0+0.05){furnBad++;break;}
      }
    }
    check('furniture placed ('+furnN+' pieces), zero wall overlaps',furnBad===0,furnBad+' overlaps');
  }

  /* --- point-blank combat: a zombie in your face can be shot AND hit --- */
  {
    freezeFloor(1);
    const fy=1*CFG.FH+0.05;
    const hold={pistol:INV.pistol,ammo:INV.ammo,crowbar:INV.crowbar,weapon:player.weapon};
    INV.pistol=true;INV.ammo=10;INV.crowbar=true;
    const put=(dist,ang)=>{
      player.pos.set(0,fy,0);player.yaw=0;player.pitch=0;player.attackT=0;
      const z=g.spawnZombie(1,-Math.sin(ang)*dist,-Math.cos(ang)*dist,'shambler',null);
      z.state='idle';z.waitT=1e9;z.cfg.sight=0;z.hear=()=>{};z.update=()=>{};
      frame();frame();
      return z;
    };
    player.weapon='pistol';
    let z=put(0.65,0.25);const h0=z.hp;
    mouseBtn(true);frame();mouseBtn(false);frame();
    check('pistol hits a zombie 0.65 m away (point blank)',z.hp<h0,`hp ${h0}->${z.hp}`);
    z.die(true);
    const spread=g.GUN.SPREAD;g.GUN.SPREAD=0;
    z=put(6,0);z.g.position.set(-6,fy,0);player.yaw=Math.PI/2;const h1=z.hp;player.pitch=Math.atan2(1.7-CFG.EYE,6);frame();frame();
    mouseBtn(true);frame();mouseBtn(false);frame();
    check('head shot at 6 m does head damage',h1-z.hp===g.GUN.HEAD,`hp ${h1}->${z.hp} (head=${g.GUN.HEAD})`);
    g.GUN.SPREAD=spread;
    z.die(true);
    // full-auto: holding the button empties rounds continuously
    player.pos.set(0,fy,0);player.yaw=0;player.pitch=0.3;player.attackT=0;INV.ammo=30;
    mouseBtn(true);for(let i=0;i<60;i++)frame();mouseBtn(false);frame();
    check('SMG is full-auto (1 s held fires 8+ rounds)',30-INV.ammo>=8,`${30-INV.ammo} rounds`);
    player.weapon='melee';
    z=put(0.6,1.2);const h2=z.hp;   // 70° off to the side, right up against you
    mouseBtn(true);frame();mouseBtn(false);frame();
    check('crowbar hits a zombie pressed against you, even off-centre',z.hp<h2,`hp ${h2}->${z.hp}`);
    z.die(true);
    // ---- bare fists: always available, and a shambler takes about four of them ----
    INV.crowbar=false;player.weapon='melee';
    z=put(1.0,0.1);const hF=z.hp;
    mouseBtn(true);frame();mouseBtn(false);frame();
    check('bare fists damage a zombie (no crowbar needed)',z.hp<hF,`hp ${hF}->${z.hp}`);
    let punches=1;
    for(let i=0;i<10&&z.hp>0;i++){player.attackT=0;mouseBtn(true);frame();mouseBtn(false);frame();punches++;}
    {const hp=z.cfg.hp,lo=Math.ceil(hp/(g.MELEE.FIST*g.MELEE.BACK)),hi=Math.ceil(hp/g.MELEE.FIST);
     check('a shambler goes down in '+lo+'-'+hi+' punches',punches>=lo&&punches<=hi&&z.hp<=0,`${punches} punches, hp ${z.hp} of ${hp}`);}
    z.die(true);
    // ---- crowbar: 2-3 swings for the same zombie ----
    INV.crowbar=true;
    z=put(1.0,0.1);let swings=0;
    for(let i=0;i<8&&z.hp>0;i++){player.attackT=0;mouseBtn(true);frame();mouseBtn(false);frame();swings++;}
    {const hp=z.cfg.hp,lo=Math.ceil(hp/(g.MELEE.CROWBAR*g.MELEE.BACK)),hi=Math.ceil(hp/g.MELEE.CROWBAR);
     check('a shambler goes down in '+lo+'-'+hi+' crowbar swings',swings>=lo&&swings<=hi&&z.hp<=0,`${swings} swings, hp ${z.hp} of ${hp}`);}
    check('a hurt zombie shows a health bar over its head',!!z.bar);
    z.die(true);
    // ---- the rooftop boss: big, and it takes a magazine ----
    {
      const b=g.spawnZombie(1,-3,0,'boss',null);
      b.state='idle';b.waitT=1e9;b.update=()=>{};
      const full=b.hp;let hits=0;
      while(b.hp>0&&hits<40){b.hit(g.GUN.DMG,true,'bullet');hits++;}
      check('the boss needs 10-15 bullets and always shows its bar',hits>=10&&hits<=15&&!!b.bar,`${hits} hits of ${g.GUN.DMG} (hp ${full})`);
      b.die(true);
    }
    // bullets do not pass through walls
    let wx=-20;while(wx<12&&g.losClear(wx,-0.9,wx,-5,1))wx+=0.5;
    player.pos.set(wx,fy,-0.9);player.yaw=0;player.pitch=0;player.weapon='pistol';player.attackT=0;
    z=g.spawnZombie(1,wx,-5,'shambler',null);z.update=()=>{};frame();frame();
    const h3=z.hp;mouseBtn(true);frame();mouseBtn(false);frame();
    const wallBetween=!g.losClear(wx,-0.9,wx,-5,1);
    check('a wall stops the bullet',wallBetween&&z.hp===h3,`wall=${wallBetween} hp ${h3}->${z.hp}`);
    z.die(true);
    Object.assign(INV,{pistol:hold.pistol,ammo:hold.ammo,crowbar:hold.crowbar});player.weapon=hold.weapon;
  }

  /* ======================================================================
     FULL PLAYTHROUGH — every mission step through real key presses
     ====================================================================== */
  calmAll();
  const cur=()=>QUEST[g.getQuest()].k;
  const run=(n)=>{for(let i=0;i<n;i++){if(G.uiLock==='chapter')el('chSkip').onclick();frame();}};
  const tp=(x,z,f,lookX,lookZ)=>{
    player.dead=false;player.down=false;player.hp=Math.max(player.hp,5000);player.vy=0;
    player.pos.set(x,f*CFG.FH+0.05,z);
    if(lookX!==undefined)player.yaw=Math.atan2(-(lookX-x),-(lookZ-z));
    player.pitch=0;
    run(4);
  };
  const tap=(code)=>{key(code);run(2);key(code,false);run(2);};
  const holdKey=(code,frames)=>{key(code);run(frames);key(code,false);run(2);};
  const log=[];
  const step=(name,ok,info='')=>{log.push((ok?'✔ ':'✘ ')+name+(info?' ('+info+')':''));if(!ok)console.log('     ✘ step failed: '+name+' '+info+' | current='+cur());return ok;};
  let chain=true;
  const need=(k)=>{if(cur()!==k){chain=false;console.log('     expected step '+k+' but current is '+cur());}return cur()===k;};

  // skipping is impossible: kick the closet open, try to take the crowbar BEFORE the flashlight
  tp(11.2,-8.6,0,12.2,-8.6);
  let t0=g.interactTargets();
  step('closet shows a KICK prompt (tap Q)',t0.hold&&t0.hold.kind==='kick',t0.hold&&t0.hold.kind);
  const jan=world.doors.find(d=>d.id==='jan-door');
  for(let i=0;i<3;i++){tap('KeyQ');run(30);}
  step('3 kicks break the closet boards',jan&&!jan.boarded,'boarded='+(jan&&jan.boarded));
  step('broken boards fall as planks',g.debris.length>=4,'debris='+g.debris.length);
  run(90);
  step('planks come to rest on the floor',g.debris.every(d=>d.rest&&Math.abs(d.m.position.y-d.floorY)<0.01));
  tp(13.4,-8.6,0,14.05,-8.6);
  tap('KeyE');
  check('mission chain: crowbar refused while the flashlight step is current',!INV.crowbar&&cur()==='q_torch',`crowbar=${INV.crowbar} step=${cur()}`);

  // 1 flashlight
  tp(-22.9,0.15,0,-23.05,1.15);
  const ftT=g.interactTargets();
  tap('KeyE');
  if(!INV.flashlight)console.log('     DIAG flashlight: e='+(ftT.e&&ftT.e.label)+' lock='+G.uiLock+' paused='+G.paused+' dead='+player.dead+' pos='+player.pos.x.toFixed(2)+','+player.pos.y.toFixed(2)+','+player.pos.z.toFixed(2)+' items='+JSON.stringify(world.items.filter(i=>!i.taken&&i.f===0&&Math.hypot(i.g.position.x+23,i.g.position.z-1)<3).map(i=>i.id+'@'+i.g.position.x.toFixed(1)+','+i.g.position.z.toFixed(1))));
  need('q_crowbar')&&step('flashlight taken',INV.flashlight);
  // 2 crowbar
  tp(13.4,-8.6,0,14.05,-8.6);tap('KeyE');
  need('q_boards')&&step('crowbar taken',INV.crowbar);
  // gates above refuse early: the Floor 2 card gate
  // 3 pry the Floor 1 gate (hold Q), including letting go halfway (progress kept)
  tp(16.95,1.2,1,18,1.2);
  const gate1=world.gates.find(x=>x.f===1);
  holdKey('KeyQ',60);
  const kept=g.workProg['gate1']||0;
  step('letting go of a pry keeps the progress',kept>0.8,'kept='+kept.toFixed(2));
  holdKey('KeyQ',120);
  need('q_sec')&&step('Floor 1 gate pried open',gate1.open&&!gate1.mesh);
  // 4 security room (also: the generator refuses before its step)
  tp(0.8,-7.3,2,0.8,-8.8);holdKey('KeyQ',140);
  check('mission chain: generator refused before the archive step',!G.flags.power,`power=${G.flags.power}`);
  tp(-4,-6,2);
  need('q_arch');
  // 5 CCTV archive (real timers)
  tp(-5,-3.1,2,-5,-4.2);tap('KeyE');tap('KeyE');await sleep(900);run(2);
  check('leaving the CCTV archive early does not count it as watched',!G.flags.cctvSeen&&cur()==='q_arch'&&G.uiLock!=='cctv',`seen=${G.flags.cctvSeen} step=${cur()}`);
  tp(-5,-3.1,2,-5,-4.2);
  const termT=g.interactTargets();
  tap('KeyE');
  step('terminal opened',G.uiLock==='cctv',G.uiLock+' e='+(termT.e&&termT.e.label)+' at '+(termT.e&&termT.e.x.toFixed(1)+','+termT.e.z.toFixed(1))+' player '+player.pos.x.toFixed(2)+','+player.pos.z.toFixed(2)+' f'+player.floor);
  for(let w=0;w<250&&!G.flags.cctvSeen;w++){await sleep(100);if(w%3===2)tap('Space');}   // the archive advances line by line on [SPACE]
  run(2);
  step('archive watched',G.flags.cctvSeen);
  tap('KeyE');
  need('q_red');
  // 6 red card
  tp(-4.4,-3.2,2,-4.4,-4.0);tap('KeyE');
  need('q_power')&&step('red card taken',G.cards.red);
  // the red gate refuses without power
  tp(16.95,1.2,2,18,1.2);tap('KeyE');
  check('red card reader is dead before the generator runs',!world.gates.find(x=>x.f===2).open);
  tp(-4.0,-3.2,2,-4.0,-3.95);
  const ptg=g.interactTargets();const pinfo=(ptg.e&&ptg.e.label)+' @'+player.pos.x.toFixed(2)+','+player.pos.z.toFixed(2)+' f'+player.floor;
  for(let k=0;k<4&&!INV.pistol;k++){tap('KeyE');tp(-4.0,-3.2,2,-4.0,-3.95);}   // the SMG (a supply lying closer gets picked first)
  step('SMG taken',INV.pistol,pinfo);
  // 7 generator
  tp(0.8,-7.3,2,0.8,-8.8);holdKey('KeyQ',140);
  need('q_gate2')&&step('main power on',G.flags.power);
  // 8 gate 2
  tp(16.95,1.2,2,18,1.2);tap('KeyE');
  need('q_park')&&step('Floor 2 gate open',G.gatesOpen.has(2));
  // 9 Park — seen right outside the stairwell
  tp(15.2,0.4,3,11,0.9);run(10);
  need('q_parktalk');
  const park=g.npcByKey('park');
  step('Mr. Park is visible and not moving',park.parts.g.visible&&Math.abs(park.parts.g.position.x-10.9)<0.01);
  // 10 talk: ENTER x3 (E does nothing to him)
  tp(12.4,0.1,3,11.85,0.95);
  t0=g.interactTargets();
  step('Park prompt uses ENTER',t0.enter&&!t0.e||t0.enter&&t0.e.label!==t0.enter.label);
  for(let i=0;i<3;i++){tap('KeyE');run(10);}
  need('q_blue')&&step('talked to Park, card dropped',!!world.items.find(i=>i.id==='story-card-blue'));
  run(300);
  step('Park stays where he lies after talking',Math.abs(park.parts.g.position.x-10.9)<0.01&&!park.gone);
  // 11 blue card -> he turns
  tp(12.4,0.0,3,11.8,0.33);
  const btg=g.interactTargets();const binfo=JSON.stringify({e:btg.e&&btg.e.label,hold:btg.hold&&btg.hold.label,enter:btg.enter&&btg.enter.label,items:world.items.filter(i=>!i.taken&&i.f===3&&Math.hypot(i.g.position.x-12.4,i.g.position.z)<3).map(i=>i.id+'@'+i.g.position.x.toFixed(1)+','+i.g.position.z.toFixed(1))});
  for(let k=0;k<3&&!G.cards.blue;k++){tap('KeyE');if(!G.cards.blue)tp(12.4,0.0,3,11.8,0.33);}
  step('blue card taken',G.cards.blue,binfo);
  await sleep(4600);run(20);
  need('q_killpark');
  const pz=world.parkZ||{dead:true,g:{position:{x:0,z:0}}};
  step('Mr. Park turned into a zombie',!!world.parkZ&&pz.type==='park'&&park.gone);
  run(120);
  // 12 kill him with the pistol
  INV.ammo=Math.max(INV.ammo,12);player.weapon='pistol';
  for(let i=0;i<40&&!pz.dead;i++){
    player.pos.set(pz.g.position.x+4,3*CFG.FH+0.05,pz.g.position.z);
    player.yaw=Math.PI/2;player.pitch=Math.atan2(0.95-1.62,4);  // aim at his chest
    run(2);mouseBtn(true);run(1);mouseBtn(false);run(30);
  }
  need('q_shutter')&&step('Mr. Park put down',pz.dead&&G.flags.parkDead);
  // 13 shutter from the terminal ([Q] inside the terminal)
  tp(-5,-3.1,2,-5,-4.2);tap('KeyE');
  step('terminal reopened',G.uiLock==='cctv');
  tap('KeyQ');
  step('shutter released, Floor 3 gate opens',G.flags.shutter&&world.gates.find(x=>x.f===3).open);
  tap('KeyE');
  need('q_gate3');
  // 14 up to Floor 4
  tp(15,0.4,4);run(4);
  need('q_breaker');
  // 15 breaker
  tp(9,-8.0,4,9,-8.9);holdKey('KeyQ',140);
  need('q_gate4')&&step('utility breaker reset',G.flags.power2);
  // 16 gate 4
  tp(16.95,1.2,4,18,1.2);tap('KeyE');
  need('q_jieun')&&step('Floor 4 gate open',G.gatesOpen.has(4));
  // 17 Floor 5: the power gate refuses before Ji-eun is found
  tp(16.95,1.2,5,18,1.2);tap('KeyE');
  check('mission chain: Floor 5 gate refused before finding Ji-eun',!world.gates.find(x=>x.f===5).open);
  run(600);
  const zIn=world.zombies.filter(z=>!z.dead&&g.inSafeRoom(z.f,z.g.position.x,z.g.position.z));
  check('no zombie inside Ji-eun\'s room after the breach',zIn.length===0,zIn.length+' inside');
  calmAll();
  const jd=world.doors.find(d=>d.safe);
  let doorInfo='';
  for(let k=0;k<4&&jd&&!jd.open;k++){const p=g.doorPoint(jd);tp(p.x,p.z+1.0,5,p.x,p.z);const tt=g.interactTargets();doorInfo=tt.e?tt.e.label:'no target';tap('KeyE');}   // a supply by the door may be picked first
  step('her door opens',jd&&jd.open,doorInfo);
  tp(-21.0,-8.3,5,-22.95,-8.95);run(4);
  need('q_jtalk');
  // 18 talk x4
  const je=g.npcByKey('jieun');
  check('Ji-eun is not called a "survivor" before the choice (no spoiler)',!/survivor|幸存/i.test(je.name),je.name);
  for(let i=0;i<4;i++){tap('KeyE');run(10);}
  step('the choice appears after the talk (7 s, two buttons)',G.uiLock==='choice'&&el('choice').style.display==='flex',G.uiLock);
  check('no key before the choice is made',!world.items.find(i=>i.id==='story-card-yellow')&&cur()==='q_jtalk',cur());
  if(CHOICE==='trust')tap('Digit1');
  else if(CHOICE==='kill')tap('Digit2');
  else{
    const zBefore=world.zombies.filter(z=>!z.dead&&z.f===5).length;
    run(60*4);check('the choice is still open after 4 s',G.uiLock==='choice');
    run(60*3.3);
    check('time runs out: zombies break in on both of you',G.uiLock!=='choice'&&G.flags.jieunTimeout&&world.zombies.filter(z=>!z.dead&&z.f===5).length>=zBefore+4&&G.flags.safeBreached,
      `lock=${G.uiLock} timeout=${G.flags.jieunTimeout}`);
    for(const z of world.zombies)if(!z.dead&&z.f===5)z.die(true);
  }
  need('q_yellow')&&step('choice made ('+CHOICE+'), key dropped',!!world.items.find(i=>i.id==='story-card-yellow')&&G.uiLock!=='choice');
  run(3);
  if(CHOICE==='kill'){
    step('KILL: Ji-eun dies at once, no zombie rises',je.corpse&&G.flags.jieunDead&&!je.follow&&!world.zombies.some(z=>z.type==='jieun'));
    {   // the price of killing a human: the floor comes for the room
      const before=world.zombies.filter(z=>!z.dead&&z.f===5).length;
      for(let w=0;w<90&&world.zombies.filter(z=>!z.dead&&z.f===5).length<before+10;w++){await sleep(100);run(6);}
      const now=world.zombies.filter(z=>!z.dead&&z.f===5).length;
      check('KILL has a price: ten of them come through the door',now>=before+10&&G.flags.safeBreached,`${before} -> ${now}`);
      for(const z of world.zombies)if(!z.dead&&z.f===5)z.die(true);
    }
  }else{
    step('Ji-eun joins you ('+CHOICE+'), weak',je.follow&&je.hp<=50,`follow=${je.follow} hp=${je.hp}`);
    // give her a medkit
    INV.medkit=Math.max(INV.medkit,1);
    // she walks around now (and may stand next to loot): meet her in a clear stretch of the corridor
    const jp=je.parts.g.position;
    const spot=[[-12,0],[-6,0],[4,0],[-18,0]].find(([x,z])=>!world.items.some(i=>!i.taken&&i.f===5&&Math.hypot(i.g.position.x-x,i.g.position.z-z)<3))||[-12,0];
    jp.set(spot[0],5*CFG.FH,spot[1]);je.goal={x:spot[0],z:spot[1]};je.goalT=30;
    tp(spot[0]-1.0,spot[1],5,spot[0],spot[1]);
    const mk0=INV.medkit,hp0=je.hp;
    const lbl=(g.interactTargets().e||{}).label;
    tap('KeyE');
    step('[E] next to her gives Ji-eun a medkit',INV.medkit===mk0-1&&je.hp>hp0+60,`label=${lbl} hp ${Math.round(hp0)}->${Math.round(je.hp)}`);
  }
  // 19 yellow card
  const yc=world.items.find(i=>i.id==='story-card-yellow');
  tp(yc.g.position.x+0.9,yc.g.position.z+0.2,5,yc.g.position.x,yc.g.position.z);tap('KeyE');
  need('q_gate5')&&step('yellow card taken',G.cards.yellow);
  // 20 gate 5
  tp(16.95,1.2,5,18,1.2);tap('KeyE');
  need('q_gate6')&&step('Floor 5 gate open',G.gatesOpen.has(5));
  // 21 gate 6 — Ji-eun comes along to Floor 6 and fights
  tp(16.95,1.2,6,18,1.2);run(30);
  if(CHOICE!=='kill'){
  step('Ji-eun followed you up to Floor 6',je.f===6&&Math.hypot(je.parts.g.position.x-player.pos.x,je.parts.g.position.z-player.pos.z)<3.5,`f=${je.f}`);
  {const tz=g.spawnZombie(6,12,0.5,'shambler',null);tz.update=()=>{};tz.state='chase';player.pos.set(14.5,6*CFG.FH+0.05,0.2);run(420);
   step('Ji-eun shoots a zombie near you',tz.hp<tz.hpMax||tz.dead,`hp ${tz.hp}`);if(!tz.dead)tz.die(true);}
  }
  tp(16.95,1.2,6,18,1.2);tap('KeyE');
  need('q_roof')&&step('rooftop gate open',G.gatesOpen.has(6));
  // save mid-run and restore it into the same world (round trip)
  if(!process.env.MP){   // saves are a solo feature
    g.saveGame();
    const sv=g.loadSave();
    check('save v3 written with the step key',!!sv&&sv.v===3&&sv.qk==='q_roof',JSON.stringify(sv&&{v:sv.v,qk:sv.qk}));
    try{g.applySave(sv);check('applySave restores without throwing',true);}catch(e){check('applySave restores without throwing',false,e.message);}
    check('restored step is still the roof',cur()==='q_roof',cur());
  }
  // 22 climb to the roof for real
  calmAll();
  player.pos.set(16.5,6*CFG.FH+0.05,1.2);player.yaw=-Math.PI/2;player.pitch=0;player.vy=0;
  key('KeyW');run(700);key('KeyW',false);
  player.yaw=0;key('KeyW');run(200);key('KeyW',false);
  run(10);
  need('q_flare')&&step('reached the roof',player.floor===F&&G.flags.finale);
  const roofZ=()=>world.zombies.filter(z=>!z.dead&&z.f===F);
  step('roof pack was waiting and hunts at once',world.zombies.filter(z=>z.f===F).length>=3&&roofZ().every(z=>z.state==='chase'),roofZ().map(z=>z.state).join(','));
  // extraction does NOT start before the flare
  tp(2,3.5,F);run(120);
  check('no countdown before the flare is lit',g.getExtract()===0&&!G.flags.flareLit);
  // 23 light the flare (hold Q)
  holdKey('KeyQ',130);
  need('q_hold')&&step('signal flare lit',G.flags.flareLit);
  // 24 hold the circle: stepping out rewinds, staying in wins
  const pin=(x,z,n)=>{for(let i=0;i<n;i++){player.pos.x=x;player.pos.z=z;player.hp=Math.max(player.hp,3000);run(1);}};
  pin(2,3.5,240);
  const p1=g.getExtract();
  pin(8,3.5,90);
  const p2=g.getExtract();
  check('leaving the circle rewinds the countdown',p1>0.1&&p2<p1,`${p1.toFixed(2)} -> ${p2.toFixed(2)}`);
  // a FIGHTING bot with normal health holds the circle: aims at the nearest zombie, crowbar up close,
  // pistol further out, medkits under 45 HP. It is an evaluation of the rooftop difficulty.
  pin(2,3.5,1);
  player.hp=100;INV.medkit=3;INV.ammo=90;INV.pistol=true;INV.flare=2;let flaresUsed=0;
  let peak=0,dmg=0,prev=player.hp,diedAt=-1,medsUsed=0,shots=0,swings=0;
  const t0f=G.flareT||0;
  for(let i=0;i<60*45&&!G.flags.victory;i++){
    player.pos.x=2;player.pos.z=3.5;
    let near=null,nd=1e9;
    for(const z of roofZ()){const d=Math.hypot(z.g.position.x-2,z.g.position.z-3.5);if(d<nd){nd=d;near=z;}}
    if(near&&i%3===0){
      const dx=near.g.position.x-2,dz=near.g.position.z-3.5;
      player.yaw=Math.atan2(-dx,-dz)+(Math.random()-0.5)*0.4;   // a stressed human does not aim perfectly
      player.pitch=Math.atan2((near.type==='crawler'?0.35:1.2)*near.cfg.scale-CFG.EYE,Math.max(0.4,nd))+(Math.random()-0.5)*0.2;
      const close=roofZ().filter(z=>Math.hypot(z.g.position.x-2,z.g.position.z-3.5)<6).length;
      if(close>=4&&INV.flare>0&&i%60===0){key('KeyG');key('KeyG',false);flaresUsed++;}
      const melee=nd<1.3||INV.ammo<=0;
      player.weapon=melee?'melee':'pistol';
      if((melee&&nd<2.3)||(!melee&&nd<14)){mouseBtn(true);run(1);mouseBtn(false);if(melee)swings++;else shots++;}
    }
    if(player.hp<45&&INV.medkit>0&&!player.dead){key('KeyH');key('KeyH',false);medsUsed++;}
    run(1);
    if(player.hp<prev)dmg+=prev-player.hp;prev=player.hp;
    peak=Math.max(peak,roofZ().length);
    if(player.dead||player.down){diedAt=(G.flareT||0)-t0f;break;}
  }
  const botWon=G.flags.victory;
  console.log(`     ROOF EVALUATION (fighting bot, 100 HP, 3 medkits, 90 SMG rounds, Ji-eun alongside): ${botWon?'SURVIVED':'DIED after '+diedAt.toFixed(1)+' s'} · `+
    `${Math.round(dmg)} damage taken · ${medsUsed} medkits · ${flaresUsed} flares · ${shots} shots · ${swings} swings · up to ${peak} zombies at once`);
  if(!botWon){ // finish the run standing still with lots of health, and measure the raw pressure
    player.dead=false;player.down=false;G.respawnPending=false;player.hp=5000;prev=player.hp;dmg=0;
    for(let i=0;i<60*40&&!G.flags.victory;i++){player.pos.x=2;player.pos.z=3.5;run(1);if(player.hp<prev)dmg+=prev-player.hp;prev=player.hp;}
    console.log(`     roof pressure: ${Math.round(dmg)} damage while standing still for the rest of the countdown`);
  }
  step('helicopter extraction completes',G.flags.victory);
  check('FULL PLAYTHROUGH: all 24 steps completed strictly in order',chain&&G.flags.victory,log.filter(l=>l[0]==='✘').join(' | '));
  check('rooftop is winnable by a fighting player (bot survived)',botWon,botWon?Math.round(dmg)+' damage taken':'died');
  if(CHOICE!=='kill'){const je=g.npcByKey('jieun');
   const hpOk=je&&je.hpMax===160;
   if(je&&!je.follow)je.startFollow();
   const zb=g.spawnZombie(player.floor,je.parts.g.position.x+0.8,je.parts.g.position.z,'shambler',null);zb.die(true);
   je.damage(40);const hurt=je.hp<160;
   je.damage(500);const dead=G.flags.jieunDead;
   await sleep(4300);
   const turned=g.getMD().id==='lite'?je.gone:world.zombies.some(z=>z.type==='jieun'&&!z.dead);
   check('Ji-eun: 160 HP, takes damage, dies and '+(g.getMD().id==='lite'?'leaves':'turns'),hpOk&&hurt&&dead&&turned,`hp=${je&&je.hpMax} hurt=${hurt} dead=${dead} turned=${turned}`);}
  check('rooftop sends at most '+g.ROOF.TOTAL+' zombies',(G.roofSpawned||0)<=g.ROOF.TOTAL,'spawned='+G.roofSpawned);
  {
    const roofAll=world.zombies.filter(z=>z.f===F);
    const kinds=new Set(roofAll.map(z=>z.type));
    check('the roof siege is big and mixed',(G.roofSpawned||0)>=25&&kinds.size>=4,`spawned=${G.roofSpawned} kinds=${[...kinds].join('/')}`);
    check('a boss climbs onto the roof',roofAll.some(z=>z.type==='boss'),`boss flag=${!!G.flags.roofBoss}`);
  }
  console.log('\n   playthrough log:\n     '+log.join('\n     '));

  const pass=results.filter(r=>r.ok).length;
  console.log(`\n=== ${MODE.toUpperCase()} MODE${process.env.ZH?' (ZH)':''}: ${pass}/${results.length} passed ===`);
  process.exit(process.exitCode||0);
})().catch(e=>{console.error('HARNESS CRASH:',e);process.exit(1);});
