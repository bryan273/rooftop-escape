import './harness-stubs.mjs';
const el=globalThis.__el;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let simT=performance.now();globalThis.performance={now:()=>simT};
function frame(dt=16.6){simT+=dt;const q=globalThis.__rafGet().splice(0);for(const cb of q)cb(simT);}
const kd=(c)=>globalThis.__handlers().keydown.forEach(f=>f({code:c,preventDefault(){}}));
const ku=(c)=>globalThis.__handlers().keyup.forEach(f=>f({code:c,preventDefault(){}}));
(async()=>{
  await import('./game.mjs');
  el('btnSolo').onclick();await sleep(30);
  el('prologueGo').onclick();await sleep(250);
  const g=globalThis.__game,{player,world,CFG}=g;
  globalThis.__setLock(true);
  const clear=()=>{for(const k in g.KEY)g.KEY[k]=false;};
  const calm=()=>{for(const z of world.zombies){if(!z.dead){z.state='idle';z.waitT=1e9;z.cfg.sight=0;z.hear=()=>{};z.g.position.set(-23,0.05,-9);}}};
  calm();player.hp=100000;
  for(const gt of world.gates){gt.locked=false;gt.open=true;gt.col.off=true;}
  const goto=(tx,tz,frames=700,label='')=>{
    clear();
    const t0=performance.now();
    for(let i=0;i<frames;i++){
      const dx=tx-player.pos.x,dz=tz-player.pos.z;
      const d=Math.hypot(dx,dz);
      if(d<0.45)break;
      player.yaw=Math.atan2(-dx,-dz);       // forward = (-sin,-cos)
      kd('KeyW');frame();ku('KeyW');
    }
    const dist=Math.hypot(tx-player.pos.x,tz-player.pos.z);
    return {ok:dist<0.75,dist:+dist.toFixed(2),pos:[+player.pos.x.toFixed(2),+player.pos.z.toFixed(2)],floor:player.floor};
  };
  const route=[
    ['corridor east',            [15.0,0.0]],
    ['through the arch',         [16.8,1.2]],
    ['lane mouth',               [17.4,1.2]],
    ['climb to top of stair F1', [22.6,1.2]],
    ['landing north strip',      [22.6,-1.0]],
    ['walk west in tower F1',    [16.8,-1.0]],
    ['into F1 corridor',         [15.0,-0.4]],
    ['F1 corridor west',         [5.0,0.0]],
    ['F1 corridor back east',    [15.5,0.4]],
    ['through arch F1',          [16.8,1.2]],
    ['lane mouth F1',            [17.4,1.2]],
    ['climb to top of stair F2', [22.6,1.2]],
    ['F2 landing north',         [22.6,-1.0]],
    ['walk west in tower F2',    [16.8,-1.0]],
    ['into F2 corridor',         [15.0,-0.4]],
  ];
  let blocked=null;
  for(const [label,[tx,tz]] of route){
    const r=goto(tx,tz);
    console.log((r.ok?'  ok   ':'BLOCKED')+' '+label.padEnd(26)+` -> ${JSON.stringify(r.pos)} dist=${r.dist} floor=${r.floor}`);
    if(!r.ok&&!blocked)blocked={label,r};
    calm();
  }
  console.log(blocked?`\n>>> FIRST BLOCK: ${blocked.label} (stuck at ${JSON.stringify(blocked.r.pos)}, ${blocked.r.dist}m away, floor ${blocked.r.floor})`:'\n>>> FULL ROUTE F0 -> F2 WALKABLE');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
