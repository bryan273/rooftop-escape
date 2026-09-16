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
  const calm=(maxf)=>{for(const z of world.zombies){if(z.f<=maxf&&!z.dead){z.state='idle';z.waitT=1e9;z.cfg.sight=0;z.hear=()=>{};z.g.position.set(-23,0.05,-9);}}};
  calm(2);player.hp=100000;
  for(const gt of world.gates){gt.locked=false;gt.open=true;gt.col.off=true;}
  let fail=0;
  for(let target=1;target<=3;target++){
    // walk east up the stairs from the current floor
    player.pos.set(16.5,(target-1)*CFG.FH+0.05,1.2);player.yaw=-Math.PI/2;player.pitch=0;
    clear();kd('KeyW');for(let i=0;i<900;i++)frame();ku('KeyW');
    const climbed=player.floor;
    // exit the lane to the -Z side (yaw 0 walks toward -Z), then cross to the +Z side
    player.yaw=0;clear();kd('KeyW');for(let i=0;i<300;i++)frame();ku('KeyW');
    const exitA=player.pos.z<0.42;
    player.yaw=Math.PI;clear();kd('KeyW');for(let i=0;i<420;i++)frame();ku('KeyW');
    const exitB=player.pos.z>1.98;
    const ok=climbed>=target&&exitA&&exitB;
    console.log(`floor ${target}: climbed->${climbed} finalZ=${player.pos.z.toFixed(2)} exitNegZ:${exitA} exitPosZ:${exitB} ${ok?'OK':'STUCK'}`);
    if(!ok)fail++;
    calm(target+1);
  }
  console.log(fail?'>>> STAIR TOP STILL BLOCKED':'>>> ALL STAIR TRANSITIONS PASSABLE');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
