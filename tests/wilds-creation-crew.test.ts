import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prepareCreationOperation} from '../src/features/play/creation/operation';
import {compileCreation} from '../src/features/play/creation/compiler';
import {planCreationTasks,prepareCreationCrewBatch,type CreationCrewEvidence,type CreationCrewBatch} from '../src/features/play/creation/crew';
import {createCreationScheduler,type CreationCrewJournal} from '../src/features/play/creation/scheduler';
import {creationOperationContextFixture,creationOperationFixture,creationJournalFixture} from './support/creation-operation-fixtures';
function evidence():CreationCrewEvidence{return {ownerHead:`sha256:${'a'.repeat(64)}`,workerHeads:{'creature:fixture':`sha256:${'a'.repeat(64)}`},jobHeads:{'creature:fixture':`sha256:${'b'.repeat(64)}`},readyWorkerIds:['creature:fixture'],consentingWorkerIds:['creature:fixture'],arrivedWorkerIds:['creature:fixture'],revokedWorkerIds:[]};}
async function batchFixture(batchId='batch:fixture'){const context=creationOperationContextFixture(),compiled=compileCreation(context.definition,context.compileContext);if(compiled.status!=='ready')throw Error('compile');const tasks=planCreationTasks(compiled.plan,context.workers),current=evidence();return prepareCreationCrewBatch(tasks,{batchId,operation:prepareCreationOperation(compiled.plan,{...context,operationId:`operation:${batchId}`,instanceId:`instance:${batchId}`}),evidence:current,readEvidence:async()=>current});}
function journalFixture(){const operations=creationJournalFixture();let batch:CreationCrewBatch|null=null;const journal:CreationCrewJournal={...operations.journal,async stageBatch(value){if(batch&&batch.head!==value.head)throw Error('collision');batch=value;return value;},async readBatch(){return batch;},async recallBatch(){if(!batch)throw Error('missing');batch={...batch,phase:batch.phase==='prepared'?'cancelled':'recovering',revision:batch.revision+1};return batch;},async fenceBatch(value,current){if(!batch||batch.phase!=='prepared'||batch.head!==value.head||JSON.stringify(current)!==JSON.stringify(batch.expected))throw Error('fence_conflict');batch={...batch,phase:'pending',revision:batch.revision+1};return batch;},async finishBatch(value,phase){if(!batch||batch.revision!==value.revision)throw Error('conflict');batch={...batch,phase,revision:batch.revision+1};return batch;}};return {journal,get batch(){return batch;}};}
test('recall wins before the final batch dispatch fence',async()=>{const batch=await batchFixture(),store=journalFixture();let dispatchCalls=0,started!:()=>void,released!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;}),wait=new Promise<void>(resolve=>{released=resolve;});const scheduler=createCreationScheduler({journal:store.journal,createAdmission:fence=>({async execute(op){if(await fence())dispatchCalls++;return {status:'unknown',operationId:op.operationId};},async lookup(id){return {status:'unknown',operationId:id};}}),authorize:async()=>{started();await wait;return batch.expected;}});const running=scheduler.run(batch);await entered;await store.journal.recallBatch(batch.batchId);released();const result=await running;assert.equal(dispatchCalls,0);assert.equal(result.phase,'cancelled');});
test('task planning is deterministic and rejects an unready or missing technique',()=>{const context=creationOperationContextFixture(),compiled=compileCreation(context.definition,context.compileContext);if(compiled.status!=='ready')throw Error('compile');const a=planCreationTasks(compiled.plan,context.workers);assert.deepEqual(a,planCreationTasks(compiled.plan,context.workers));assert.equal(a.reduce((n,t)=>n+t.work,0),compiled.plan.requiredWork);assert.throws(()=>planCreationTasks(compiled.plan,context.workers.map(w=>({...w,ready:false}))));assert.throws(()=>planCreationTasks({...compiled.plan,requiredTechniques:['forging']},context.workers));});

test('the durable batch journal arbitrates two tabs and rolls back a partial reservation write',async()=>{
 const {createCreationCrewJournal}=await import('../src/features/play/creation/crew-journal');
 const {createMemoryWildzContinuityDatabase}=await import('./support/memory-wildz-continuity-database');
 const db=createMemoryWildzContinuityDatabase(),a=createCreationCrewJournal('owner',db),b=createCreationCrewJournal('owner',db);
 const batch=await batchFixture();
 await a.observeEvidence(null,batch.expected);
 const results=await Promise.allSettled([a.stageBatch(batch),b.stageBatch({...batch,batchId:'competing'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await a.readBatch(batch.batchId))?.phase,'prepared');
 const db2=createMemoryWildzContinuityDatabase(),failed=createCreationCrewJournal('owner',db2);
 await failed.observeEvidence(null,batch.expected);const before=db2.dump();
 db2.failNextTransactionAfterPuts(2);await assert.rejects(failed.stageBatch(batch));
 assert.deepEqual(db2.dump(),before);
});

test('the SDK final fence observes recall after validation and durable transaction staging await',async()=>{
 const {createCreationCrewJournal}=await import('../src/features/play/creation/crew-journal');
 const {createWildsCreationCrewExecution}=await import('../src/lib/receiz/wilds-creation-crew-execution');
 const {createMemoryWildzContinuityDatabase}=await import('./support/memory-wildz-continuity-database');
 const batch=await batchFixture(),journal=createCreationCrewJournal('owner',createMemoryWildzContinuityDatabase());
 await journal.observeEvidence(null,batch.expected);
 const operation=batch.operation,head=`sha256:${'a'.repeat(64)}`;
 const transaction={schema:'receiz.world.transaction.v122' as const,transactionId:'tx:crew',worldId:operation.command.instance.worldId,expectedWorldHead:head,participantHeads:Object.fromEntries(Object.entries(operation.expectedHeads).filter((entry):entry is [string,string]=>entry[1]!==null)),commands:[{commandId:'command:crew',worldId:operation.command.instance.worldId,expectedWorldHead:head,actorSubjectId:'actor:owner',participantSubjectIds:Object.keys(operation.expectedHeads).filter(id=>operation.expectedHeads[id]!==null),causalParents:[],command:operation,exactCommandBytesB64u:'fixture-only',commandDigest:head,planDigest:head,authorityDigest:head,mandateDigest:head}],registryDigest:head,reducerDigest:head,idempotencyKey:operation.idempotencyKey,transactionDigest:head};
 let entered!:()=>void,resume!:()=>void,dispatchCalls=0;
 const staged=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{resume=resolve;});
 const execution=createWildsCreationCrewExecution({journal,authorize:async()=>batch.expected,runtime:{operationJournal:journal,prepare:async()=>({transaction,authority:{fixture:true}}),readTransaction:async()=>transaction,transactionJournal:{stage:async()=>{entered();await gate;},clear:async()=>{}},authenticateReceipt:()=>false,authenticateSources:async()=>false,projectCommittedOutcome:async()=>null,rail:{validateWorldTransactionV122:async()=>({ok:true,transaction}),executeWorldTransactionV122:async()=>{dispatchCalls++;return {status:'unknown'};},worldExecutionV122:async()=>({status:'unknown'}),worldExecutionByIdempotencyKeyV122:async()=>({status:'unknown'})}}});
 const running=execution.run(batch);await staged;await journal.recallBatch(batch.batchId);resume();
 const result=await running;assert.equal(dispatchCalls,0);assert.equal(result.phase,'cancelled');assert.equal((await journal.read(operation.operationId))?.phase,'rejected');
});

test('pending recall retains the exact reservations and recovery performs lookup only',async()=>{
 const {createCreationCrewJournal}=await import('../src/features/play/creation/crew-journal');
 const {createCreationAdmissionPort}=await import('../src/features/play/creation/operation');
 const {createMemoryWildzContinuityDatabase}=await import('./support/memory-wildz-continuity-database');
 const {createWildsCrewJournal}=await import('../src/features/play/wilds-crew-journal');
 const db=createMemoryWildzContinuityDatabase(),journal=createCreationCrewJournal('owner',db),legacy=createWildsCrewJournal('owner',db),batch=await batchFixture();
 await journal.observeEvidence(null,batch.expected);let dispatchCalls=0,lookupCalls=0;
 const scheduler=createCreationScheduler({journal,authorize:async()=>batch.expected,createAdmission:fence=>createCreationAdmissionPort({operationForLookup:async id=>(await journal.read(id))?.operation??null,authenticate:async()=>false,executeRaw:async op=>{assert.equal(await fence(),true);dispatchCalls++;return {status:'unknown',operationId:op.operationId};},lookupRaw:async id=>{lookupCalls++;return {status:'unknown',operationId:id};}})});
 assert.equal((await scheduler.run(batch)).phase,'recovering');
 await journal.recallBatch(batch.batchId);assert.ok(await legacy.reservation(batch.operation.resources[0].id));
 assert.equal((await scheduler.run(batch)).phase,'recovering');assert.equal(dispatchCalls,1);assert.equal(lookupCalls,1);
 assert.deepEqual((await journal.read(batch.operation.operationId))?.reservationRefs,batch.operation.resources.map(r=>r.id));
});

test('creation and legacy crews share worker and material exclusions',async()=>{
 const {createCreationCrewJournal}=await import('../src/features/play/creation/crew-journal');
 const {createWildsCrewJournal}=await import('../src/features/play/wilds-crew-journal');
 const {createMemoryWildzContinuityDatabase}=await import('./support/memory-wildz-continuity-database');
 const db=createMemoryWildzContinuityDatabase(),journal=createCreationCrewJournal('owner',db),legacy=createWildsCrewJournal('owner',db),batch=await batchFixture();
 await journal.observeEvidence(null,batch.expected);await journal.stageBatch(batch);
 await assert.rejects(legacy.append({workerId:'creature:fixture',jobId:'legacy',commandDigest:'legacy',observedKaiUPulse:2,expectedWorkerHead:null,phase:'proposed'}),/creation_worker_reserved/);
 await assert.rejects(legacy.append({workerId:'other-worker',jobId:'legacy',commandDigest:'legacy',observedKaiUPulse:2,expectedWorkerHead:null,phase:'proposed',lotIds:[batch.operation.resources[0].id]}),/lot_reserved/);
 await journal.recallBatch(batch.batchId);
 await legacy.append({workerId:'other-worker',jobId:'legacy',commandDigest:'legacy',observedKaiUPulse:2,expectedWorkerHead:null,phase:'proposed',lotIds:[batch.operation.resources[0].id]});
 await assert.rejects(journal.stageBatch(await batchFixture('batch:new')),/lot_reserved/);
});

test('source changes, missing arrival, missing consent and revocation block preparation',async()=>{
 const context=creationOperationContextFixture(),compiled=compileCreation(context.definition,context.compileContext);if(compiled.status!=='ready')throw Error('compile');
 const tasks=planCreationTasks(compiled.plan,context.workers),base=evidence();
 for(const change of [{ownerHead:`sha256:${'f'.repeat(64)}`},{arrivedWorkerIds:[]},{consentingWorkerIds:[]},{revokedWorkerIds:['creature:fixture']},{workerHeads:{'creature:fixture':`sha256:${'f'.repeat(64)}`}}]){
  const changed={...base,...change};await assert.rejects(prepareCreationCrewBatch(tasks,{batchId:'invalid',operation:creationOperationFixture(),evidence:changed,readEvidence:async()=>changed}));
 }
 await assert.rejects(prepareCreationCrewBatch(tasks,{batchId:'changed',operation:creationOperationFixture(),evidence:base,readEvidence:async()=>({...base,jobHeads:{'creature:fixture':`sha256:${'f'.repeat(64)}`}})}),/sources_changed/);
});

test('worker order remains deterministic across real support dependencies',async()=>{
 const {createCreationDefinition}=await import('../src/features/play/creation/definition');
 const context=creationOperationContextFixture(),{digest,...basis}=context.definition;void digest;
 const definition=createCreationDefinition({...basis,nodes:[...basis.nodes,{...basis.nodes[0],id:'upper',pose:{position:{x:10,y:0,z:0},yaw:0},supports:['room']}]});
 const compiled=compileCreation(definition,{...context.compileContext,budget:{timber:40}});if(compiled.status!=='ready')throw Error('compile');
 const workers=[context.workers[0],{...context.workers[0],subjectId:'second-builder'}];
 const tasks=planCreationTasks(compiled.plan,workers);assert.deepEqual(tasks,planCreationTasks(compiled.plan,[...workers].reverse()));
 assert.equal(tasks.reduce((n,t)=>n+t.work,0),compiled.plan.requiredWork);assert.equal(tasks[2].dependencyTaskIds.length,2);
});

test('a technique task includes only nodes that require that technique',async()=>{
 const {createCreationDefinition}=await import('../src/features/play/creation/definition');
 const context=creationOperationContextFixture(),{digest,...basis}=context.definition;void digest;
 const definition=createCreationDefinition({...basis,nodes:[...basis.nodes,{id:'stone',parentId:null,pose:{position:{x:10,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},material:'stone',supports:['room'],attachments:[],behaviors:[]}]});
 const compiled=compileCreation(definition,{...context.compileContext,budget:{timber:20,stone:20},techniques:['assembly','masonry']});if(compiled.status!=='ready')throw Error('compile');
 const workers=[context.workers[0],{...context.workers[0],subjectId:'mason',techniques:['masonry']}],tasks=planCreationTasks(compiled.plan,workers);
 assert.equal(tasks.filter(t=>t.technique==='assembly').some(t=>t.nodeIds.includes('stone')),false);
 assert.equal(tasks.filter(t=>t.technique==='masonry').some(t=>t.nodeIds.includes('room')),false);
 assert.equal(tasks.reduce((n,t)=>n+t.work,0),compiled.plan.requiredWork);
});
