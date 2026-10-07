import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planCreation, CreationPlannerBlockedError } from '../src/features/play/creation/planner';
import { creationDefinitionFixture,creationContextFixture } from './support/creation-fixtures';
const request=()=>({requestId:'request',actorId:'owner',message:'Build a room with an open door',selected:creationDefinitionFixture(),workers:[{assetId:'card',subjectId:'creature',head:`sha256:${'a'.repeat(64)}`,proofDigest:`sha256:${'b'.repeat(64)}`,techniques:['assembly'],ready:true,reasons:[]}],context:creationContextFixture()});
test('preserves a draft when generation is unavailable',async()=>{const input=request(),before=structuredClone(input.selected);const result=await planCreation(input,{propose:async()=>{throw Error('offline');}},new AbortController().signal);assert.equal(result.status,'unavailable');assert.deepEqual(input.selected,before);});
test('a supported proposal refusal keeps its useful explanation through the client port',async()=>{
 const input=request(),before=structuredClone(input.selected);
 const reason='Select a creature with cultivation to make a garden.';
 assert.deepEqual(await planCreation(input,{propose:async()=>{throw new CreationPlannerBlockedError(reason);}},new AbortController().signal),{status:'blocked',reason});
 assert.deepEqual(input.selected,before);
 const cancelled=new AbortController();cancelled.abort();
 assert.equal((await planCreation(input,{propose:async()=>{throw new CreationPlannerBlockedError(reason);}},cancelled.signal)).status,'unavailable');
});
test('validates generated graph identity and stale replies',async()=>{const input=request();const good={requestId:input.requestId,reply:'A timber room with a doorway.',definition:input.selected};assert.equal((await planCreation(input,{propose:async()=>good},new AbortController().signal)).status,'proposed');for(const output of ['{partial', {...good,requestId:'old'},{...good,definition:{...input.selected,creatorId:'other'}},{...good,definition:{...input.selected,nodes:[{...input.selected.nodes[0],behaviors:[{id:'infinite-money',version:1,parameters:{}}]}]}}])assert.equal((await planCreation(input,{propose:async()=>output},new AbortController().signal)).status,'blocked');});
test('binds patches to selected object and aborts a hung provider',async()=>{const input=request();const stale={requestId:'request',reply:'Edit',patch:{baseDigest:'old',operations:[]}};assert.equal((await planCreation(input,{propose:async()=>stale},new AbortController().signal)).status,'blocked');const abort=new AbortController();const pending=planCreation(input,{propose:async()=>new Promise(()=>{})},abort.signal);abort.abort();assert.equal((await pending).status,'unavailable');});
test('rejects invalid budget before asking provider',async()=>{let calls=0;const input=request();const result=await planCreation({...input,context:{...input.context,budget:{timber:-1}}},{propose:async()=>{calls++;return {}; }},new AbortController().signal);assert.equal(result.status,'blocked');assert.equal(calls,0);});

test('zero-write refinement of a transferred object retains the original creator',async()=>{
 const input={...request(),actorId:'recipient'},before=structuredClone(input.selected);
 const result=await planCreation(input,{propose:async()=>({requestId:input.requestId,reply:'Updated door',patch:{baseDigest:input.selected.digest,operations:[{op:'update',id:input.selected.nodes[0].id,changes:{pose:{position:{x:1,y:0,z:0},yaw:0}}}]}})},new AbortController().signal);
 assert.equal(result.status,'proposed');assert.deepEqual(input.selected,before);
 if(result.status==='proposed'&&'patch' in result.proposal)assert.equal(result.proposal.patch.baseDigest,before.digest);
});

test('proposal ports never receive unused world physical evidence while the compiler context stays intact', async () => {
 const input=request();
 const physical=[{chunkId:'large-world',head:`sha256:${'a'.repeat(64)}`,terrain:[],solids:[],walkable:[],portals:[]}];
 input.context={...input.context,physical};
 let forwarded:unknown;
 const result=await planCreation(input,{propose:async req=>{forwarded=req.context.physical;return {requestId:input.requestId,reply:'Draft only',definition:input.selected};}},new AbortController().signal);
 assert.equal(result.status,'proposed');assert.deepEqual(forwarded,[]);
 assert.equal(input.context.physical,physical,'live compiler still receives original physical authority');
});
