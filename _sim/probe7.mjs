import './harness-stubs.mjs';
const el=globalThis.__el;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let simT=performance.now();globalThis.performance={now:()=>simT};
function frame(dt=16.6){simT+=dt;const q=globalThis.__rafGet().splice(0);for(const cb of q)cb(simT);}
(async()=>{
  await import('./game.mjs');
  const g=globalThis.__game;
  // call applyLang indirectly by toggling language and look for thrown errors
  try{ el('langZh').onclick(); }catch(e){ console.log('THROWN:',e.message); }
  console.log('hintKey after switch:',JSON.stringify((el('hintKey').innerHTML||'').slice(0,40)));
  try{ el('langEn').onclick(); }catch(e){ console.log('THROWN2:',e.message); }
  console.log('hintKey EN:',JSON.stringify((el('hintKey').innerHTML||'').slice(0,40)));
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
