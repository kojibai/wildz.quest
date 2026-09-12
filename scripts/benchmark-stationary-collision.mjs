/** pnpm test first. Synthetic CPU benchmark; no browser FPS claim. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createWildsAerialCollisionSample, createWildsAerialCollisionSampler, createWildsAerialNeighborhoodDiagnostics, writeWildsAerialCollisionSample } from '../.test-build/src/features/play/wilds-grounded-movement.js';
const obstacles = Array.from({length:10000},(_,i)=>({id:`tree:${i}`,kind:'tree',material:'solid',position:{x:(i%100)*4,y:0,z:Math.floor(i/100)*4},radius:1,shape:{kind:'cylinder',radius:1,height:3},visualScale:1}));
const point={x:1,z:1}, output=createWildsAerialCollisionSample(), terrain=[];
const sample=createWildsAerialCollisionSampler();
const expected={...writeWildsAerialCollisionSample(point,0,obstacles,output,1.55,.3,terrain)};
assert.deepEqual(sample(point,0,obstacles,output,1.55,.3,terrain),expected);
function median(fn){ const times=[]; for(let i=0;i<21;i++){const t=performance.now();for(let j=0;j<300;j++) fn();times.push((performance.now()-t)/300);}return times.sort((a,b)=>a-b)[10]; }
const beforeMs=median(()=>writeWildsAerialCollisionSample(point,0,obstacles,output,1.55,.3,terrain));
const afterMs=median(()=>sample(point,0,obstacles,output,1.55,.3,terrain));
const diagnostics=createWildsAerialNeighborhoodDiagnostics(), counted=createWildsAerialCollisionSampler();
for(let i=0;i<300;i++) counted(point,0,obstacles,output,1.55,.3,terrain,diagnostics);
console.log(JSON.stringify({obstacles:obstacles.length,stationaryFrames:300,actualScans:diagnostics.frameWriterCalls,beforeMs,afterMs},null,2));
