import './harness-stubs.mjs';
const el=globalThis.__el;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let simT=performance.now();globalThis.performance={now:()=>simT};
function frame(dt=16.6){simT+=dt;const q=globalThis.__rafGet().splice(0);for(const cb of q)cb(simT);}
(async()=>{
  await import('./game.mjs');
  el('btnSolo').onclick();await sleep(30);
  el('prologueGo').onclick();await sleep(250);
  const g=globalThis.__game,{world,CFG}=g;
  const target=world.layout[0].rooms.find(r=>r.x0===3);
  console.log('room rect', JSON.stringify(target));
  const frontZ=target.z0>0?target.z0:target.z1;
  console.log('front wall z =',frontZ,'| room doors on floor 0 near this room:');
  for(const d of world.doors){
    if(d.f!==0)continue;
    const gx=d.g.position.x, gz=d.g.position.z;
    if(gx<target.x0-1||gx>target.x1+1)continue;
    if(Math.abs(gz-frontZ)>0.3)continue;
    console.log(`  door id=${d.id} hinge x=${gx.toFixed(2)} z=${gz.toFixed(2)} len? axis=${d.axis} boarded=${d.boarded} open=${d.open} col=${JSON.stringify({x0:+d.col.x0.toFixed(2),x1:+d.col.x1.toFixed(2),z0:+d.col.z0.toFixed(2),z1:+d.col.z1.toFixed(2)})}`);
  }
  // which colliders sit in the doorway band (z near frontZ, x inside the room)?
  const y=0.05;
  console.log('colliders inside the room within 2.2m of the front wall:');
  for(const c of world.cols[0]){
    if(c.off)continue;
    const cx=(c.x0+c.x1)/2, cz=(c.z0+c.z1)/2;
    if(cx<target.x0||cx>target.x1)continue;
    const dz=Math.abs(cz-frontZ);
    if(dz>2.2)continue;
    console.log(`  [${c.x0.toFixed(2)},${c.x1.toFixed(2)}]x[${c.z0.toFixed(2)},${c.z1.toFixed(2)}] y[${c.y0.toFixed(1)},${c.y1.toFixed(1)}] los=${c.los} wall=${!!c.wall}`);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
