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
  globalThis.__setLock(true);
  for(const gt of world.gates){gt.locked=false;gt.open=true;gt.col.off=true;}
  const STEP=0.35, X0=-23.8, X1=23.8, Z0=-9.8, Z1=9.8;
  const NX=Math.floor((X1-X0)/STEP)+1, NZ=Math.floor((Z1-Z0)/STEP)+1;
  const idx=(ix,iz)=>iz*NX+ix;
  for(const f of [0,1,2,3]){
    const y=f*CFG.FH;
    const free=new Uint8Array(NX*NZ);
    for(let iz=0;iz<NZ;iz++)for(let ix=0;ix<NX;ix++){
      const x=X0+ix*STEP, z=Z0+iz*STEP;
      const gy=g.groundAt(x,z,y+0.4);
      if(!(gy>y-0.3&&gy<y+CFG.FH+0.2))continue;          // must be on this floor's walkable surface
      const c=g.collideCircle(x,z,y+0.05,f,CFG.R);
      if(Math.hypot(c[0]-x,c[1]-z)>0.02)continue;         // inside a collider
      free[idx(ix,iz)]=1;
    }
    // BFS from the corridor
    const startIx=Math.round((10-X0)/STEP), startIz=Math.round((0-Z0)/STEP);
    if(!free[idx(startIx,startIz)]){ console.log(`floor ${f}: corridor seed not free!`); continue; }
    const seen=new Uint8Array(NX*NZ); const q=[[startIx,startIz]]; seen[idx(startIx,startIz)]=1;
    let count=0;
    while(q.length){
      const [ix,iz]=q.pop(); count++;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=ix+dx,nz=iz+dz;
        if(nx<0||nz<0||nx>=NX||nz>=NZ)continue;
        const k=idx(nx,nz);
        if(seen[k]||!free[k])continue;
        seen[k]=1;q.push([nx,nz]);
      }
    }
    const at=(x,z)=>{const ix=Math.round((x-X0)/STEP),iz=Math.round((z-Z0)/STEP);
      return (ix>=0&&iz>=0&&ix<NX&&iz<NZ)?!!seen[idx(ix,iz)]:false;};
    const reach=(x,z)=>at(x,z)?'reachable':'UNREACHABLE';
    let totalFree=0;for(let i=0;i<free.length;i++)totalFree+=free[i];
    console.log(`floor ${f}: walkable cells ${count}/${totalFree} | corridor(0,0)=${reach(0,0)} | laneMouth(17.4,1.2)=${reach(17.4,1.2)} | laneTop(22.4,1.2)=${reach(22.4,1.2)} | towerStrip(20,-1)=${reach(20,-1)} | F${f} room N1(-20,5)=${reach(-20,5)} | westCorr(-22,0)=${reach(-22,0)}`);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
