/* Builds _sim/game.mjs — a Node-runnable copy of js/game.js for the headless harness:
   three.js is imported from a local file and the WebGL renderer is replaced by a stub.
   Usage: node _sim/build.mjs   (downloads three.module.js r160 once if it is missing) */
import fs from 'node:fs';

const here = new URL('.', import.meta.url);
const threePath = new URL('three.module.js', here);
if (!fs.existsSync(threePath)) {
  const url = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  console.log('fetching', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('three.js download failed: ' + res.status);
  fs.writeFileSync(threePath, await res.text());
}

let src = fs.readFileSync(new URL('../js/game.js', here), 'utf8');
const IMPORT = "import * as THREE from 'three';";
const RENDERER = /const renderer=new THREE\.WebGLRenderer\(\{[^}]*\}\);/;
if (!src.includes(IMPORT)) throw new Error('three import not found');
if (!RENDERER.test(src)) throw new Error('renderer construction not found');
src = src.replace(IMPORT,
  "import * as THREE from './three.module.js';\n" +
  'function _FR(){return {domElement:null,shadowMap:{},setSize(){},setPixelRatio(){},render(){},compile(){},' +
  'outputColorSpace:0,toneMapping:0,toneMappingExposure:1}}');
src = src.replace(RENDERER, 'const renderer=_FR();');
fs.writeFileSync(new URL('game.mjs', here), src);
console.log('built _sim/game.mjs (' + src.length + ' bytes)');
