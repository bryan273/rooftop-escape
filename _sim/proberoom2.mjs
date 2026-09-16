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
  for(const dd of world.doors){ if(dd.f<=2) dd.setOpen(true,false); }
  const room=world.layout[0].rooms.find(r=>r.x0===3);
  console.log('doors after opening (room x0=3):');
  for(const d of world.doors){ if(d.f!==0)continue;
    if(Math.abs(d.g.position.z-1.6)>0.3||d.g.position.x<room.x0-1||d.g.position.x>room.x1+1)continue;
    console.log(`  ${d.id} x=${d.g.position.x.toFixed(2)} open=${d.open} colOpen=${JSON.stringify({x0:+d.colOpen.x0.toFixed(2),x1:+d.colOpen.x1.toFixed(2),z0:+d.colOpen.z0.toFixed(2),z1:+d.colOpen.z1.toFixed(2)})} colNow=${JSON.stringify({x0:+d.col.x0.toFixed(2),x1:+d.col.x1.toFixed(2),z0:+d.col.z0.toFixed(2),z1:+d.col.z1.toFixed(2)})}`);
  }
  const y=0.05;
  const free=(x,z)=>{
    const gy=g.groundAt(x,z,y+0.4);
    if(!(gy>-0.3&&gy<CFG.FH+0.2))return 'nofloor';
    const c=g.collideCircle(x,z,y,0,CFG.R);
    const moved=Math.hypot(c[0]-x,c[1]-z);
    return moved>0.02?('blocked('+moved.toFixed(2)+')'):'FREE';
  };
  console.log('cells near the doorways (x, z=depth from corridor into room):');
  for(const dx of [7.0,7.5,8.0,13.6,14.0,14.5]){
    let row=` x=${dx.toFixed(1)}:`;
    for(const dz of [-0.5,0.0,0.4,0.8,1.2,1.6,2.0,2.4,2.8]){
      row+=' '+free(dx,1.6+dz).replace('blocked','B').replace('nofloor','N').replace('FREE','.').replace(/B\([\d.]+\)/,'B');
    }
    console.log(row+'   (corridor → room)');
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
