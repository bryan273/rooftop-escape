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

globalThis.__el=el;
globalThis.__rafGet=()=>rafQ;
globalThis.__keyDown=(c)=>collectH('keydown').forEach(f=>f({code:c,preventDefault(){}}));
globalThis.__setLock=(on)=>{document.pointerLockElement=on?el('c'):null;collectD('pointerlockchange').forEach(f=>f());};
globalThis.__handlers=()=>({keydown:collectH('keydown'),keyup:collectH('keyup')});
