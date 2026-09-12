/** Run after pnpm test. Synthetic CPU and serialization measurements, not browser frame timings. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { serialize } from 'node:v8';
import { createWildsProximityIndex } from '../.test-build/src/features/play/wilds-proximity-index.js';
import { createWildsWorldEdgeAdmissionQueue, prepareWildsWorldOutboxEntry } from '../.test-build/src/features/play/wilds-world-outbox.js';
import { initialWildsWorldProjection } from '../.test-build/src/features/play/wilds-world-state.js';
const points = Array.from({length:10000}, (_, i) => ({id:`point:${i}`,position:{x:(i%100-50)*32,z:(Math.floor(i/100)-50)*32}}));
const collection = Object.fromEntries(points.map(p => [p.id,p]));
const start = performance.now();
const index = createWildsProximityIndex(points, p=>p.id);
const buildMs = performance.now()-start;
const positions = Array.from({length:500},(_,i)=>({x:10+i/100,z:10+i/100}));
const scan = p=>Object.values(collection).filter(v=>Math.hypot(v.position.x-p.x,v.position.z-p.z)<=110).sort((a,b)=>a.id.localeCompare(b.id));
for(const p of positions) assert.deepEqual(index.near(p),scan(p));
function median(action) {
  const times=[];
  for(let i=0;i<21;i++){const t=performance.now();action();times.push(performance.now()-t);}
  return times.sort((a,b)=>a-b)[10];
}
const spatial={objects:points.length,buildMs,fullScanPerMoveMs:median(()=>positions.forEach(scan))/positions.length,indexedPerMoveMs:median(()=>positions.forEach(p=>index.near(p)))/positions.length,...index.stats()};
const makeEntry = i=>({schema:'receiz.wilds_world_outbox_entry.v1',actorId:'benchmark',guestId:'guest-benchmark',command:{type:'construction.project.create',name:`Project ${i}`,region:{x:i,z:0},commandId:`command:benchmark:${i}`},queuedAt:'2026-09-12T00:00:00.000Z'});
const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:initialWildsWorldProjection(),persist:async()=>{}});
for(let i=0;i<100;i++) await queue.admit(makeEntry(i));
const full=prepareWildsWorldOutboxEntry(queue.current(),makeEntry(100));
const compact=prepareWildsWorldOutboxEntry(queue.current(),makeEntry(100),'command:benchmark:0');
assert.deepEqual(compact.projection,full.projection);
assert.deepEqual(compact.events,full.events);
const payload={projects:100,fullEntryJsonBytes:Buffer.byteLength(JSON.stringify(full.entry)),compactEntryJsonBytes:Buffer.byteLength(JSON.stringify(compact.entry)),fullResultV8Bytes:serialize(full).byteLength,compactResultV8Bytes:serialize(compact).byteLength,fullResultCloneMs:median(()=>structuredClone(full)),compactResultCloneMs:median(()=>structuredClone(compact))};
console.log(JSON.stringify({spatial,payload},null,2));
