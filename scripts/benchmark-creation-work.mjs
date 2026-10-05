/** CPU benchmark only; does not establish browser frame time or network latency. Run after pnpm test. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { creationDefinitionFixture,creationContextFixture } from '../.test-build/tests/support/creation-fixtures.js';
import { createCreationWorkerClient } from '../.test-build/src/features/play/creation/worker-client.js';
import { compileCreation } from '../.test-build/src/features/play/creation/compiler.js';
const n=creationDefinitionFixture().nodes[0];
const definitions=[1,32,128].map(count=>creationDefinitionFixture({nodes:Array.from({length:count},(_,i)=>({...n,id:`node:${i}`,pose:{position:{x:i*10,y:0,z:0},yaw:0}}))}));
const context=creationContextFixture();
const sample=fn=>{const times=[];for(let i=0;i<22;i++){const start=performance.now();fn();if(i>1)times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {p50:times[10],p95:times[18],p99:times[19]};};
const rows=definitions.map(d=>{const compiled=compileCreation(d,context);assert.equal(compiled.status,'ready');return {nodes:d.nodes.length,compilerMs:sample(()=>compileCreation(d,context)),serializationMs:sample(()=>JSON.stringify(d)),pages:compiled.plan.chunks.length,vertices:compiled.plan.chunks.reduce((n,c)=>n+c.positions.length/3,0)};});
const cancellation=[];for(let i=0;i<22;i++){const client=createCreationWorkerClient(()=>({onmessage:null,onerror:null,postMessage(){},terminate(){}}));const start=performance.now();const pending=client.compile(`cancel:${i}`,definitions[0],context);client.cancel(`cancel:${i}`);assert.equal((await pending).status,'blocked');client.close();if(i>1)cancellation.push(performance.now()-start);}cancellation.sort((a,b)=>a-b);
console.log(JSON.stringify({cancellationBookkeepingMs:{p50:cancellation[10],p95:cancellation[18],p99:cancellation[19],scope:'Explicit in-process fake worker port; not actual browser worker cancellation latency.'},scope:'CPU only; compiler runs in a worker in the browser. Not frame/network/device qualification.',node:process.version,rows},null,2));
