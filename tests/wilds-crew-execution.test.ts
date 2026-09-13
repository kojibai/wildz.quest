import assert from "node:assert/strict";
import { it } from "node:test";
import { planReceizWorldCommandV122, planReceizWorldTransactionV122, type ReceizExecutionOutcomeV122 } from "@receiz/sdk";
import { createWildsCrewExecution } from "../src/lib/receiz/wilds-crew-execution";
import { createWildsCrewJobStore } from "../src/features/play/wilds-crew-jobs";
import { createWildsCrewJournal } from "../src/features/play/wilds-crew-journal";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

// Explicit runtime/authority test doubles. These do not demonstrate a live mandate.
async function fixture() {
  const authority = {owner:"owner"};
  const command = await planReceizWorldCommandV122({commandId:"gather",worldId:"world",expectedWorldHead:"1".repeat(64),
    actorSubjectId:"worker",participantSubjectIds:["owner","worker"],causalParents:[],command:{kind:"gather"},authority,mandateDigest:"4".repeat(64)});
  const transaction = await planReceizWorldTransactionV122({worldId:"world",expectedWorldHead:"1".repeat(64),participantHeads:{owner:"2".repeat(64),worker:"3".repeat(64)},commands:[command],registryDigest:"5".repeat(64),reducerDigest:"6".repeat(64),idempotencyKey:"gather-once"});
  const database = createMemoryWildzContinuityDatabase();
  const journal = createWildsCrewJournal("owner",database);
  const jobs = createWildsCrewJobStore("owner",database);
  let job = await jobs.assign({jobId:"gather",workerId:"worker",assetId:"asset",ownerProofDigest:"8".repeat(64),workerProofDigest:"9".repeat(64),expectedOwnerSubjectHead:"2".repeat(64),expectedWorkerSubjectHead:"3".repeat(64),genomeProofDigest:"7".repeat(64),mandateDigest:"4".repeat(64),worldId:"world",regionId:"region",kind:"gather",target:{x:1,y:0,z:0},home:{x:0,y:0,z:0},observedKaiUPulse:90});
  job = await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"depart",observedKaiUPulse:91,action:{type:"depart"}});
  job = await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"arrive",observedKaiUPulse:92,action:{type:"arrive",observationId:"position",position:job.target}});
  let outcome: ReceizExecutionOutcomeV122 = {status:"unknown"};
  let executes = 0, clears = 0, allowed = true;
  const input = {
    journal,
    rail:{validateWorldTransactionV122:async()=>({ok:true,transaction}),executeWorldTransactionV122:async()=>{executes++;return outcome;},worldExecutionV122:async()=>outcome,worldExecutionByIdempotencyKeyV122:async()=>outcome},
    transactionJournal:{stage:async()=>undefined,clear:async()=>{clears++;}},
    authorize:async()=>allowed?authority:null,
    authenticateReceipt:()=>true,
    admitOutcome:async()=>["world:harvest"],
    observeKaiUPulse:()=>100
  };
  return {transaction,database,journal,jobs,job,input,request:{expectedJobHead:job.head,workerId:"worker",jobId:"gather",transaction,expectedWorkerHead:null,dependencyEventIds:[],lotIds:["stone"]},
    commit:()=>{outcome={status:"committed",transaction,receipt:{authenticated:true},events:[{id:"world:harvest"}]};},
    deny:()=>{allowed=false;}, counts:()=>({executes,clears})};
}

it("persists pending work, recovers exact commitment after reload and never dispatches twice", async()=>{
  const f=await fixture();
  const first=createWildsCrewExecution(f.input);
  const pending=await first.execute(f.request);
  assert.equal(pending.ok,false);
  assert.ok(await f.journal.reservation("stone"));
  assert.equal((await f.journal.command(f.transaction.transactionDigest))?.transaction?.transactionId,f.transaction.transactionId);
  const restored=createWildsCrewExecution({...f.input,journal:createWildsCrewJournal("owner",f.database)});
  await restored.execute(f.request);
  await restored.recover(f.transaction.transactionDigest);
  assert.deepEqual(f.counts(),{executes:1,clears:0});
  f.commit();
  assert.equal((await restored.recover(f.transaction.transactionDigest)).ok,true);
  assert.equal(await f.journal.reservation("stone"),null);
  const history=await f.journal.history("worker");
  assert.deepEqual(history.events.map(e=>e.phase),["admitted","pending","proposed"]);
  assert.deepEqual(history.events[0].admittedWorldEventIds,["world:harvest"]);
  assert.deepEqual(f.counts(),{executes:1,clears:1});
});

it("does not reserve, dispatch or invent history when current authority is unavailable",async()=>{
  const f=await fixture();f.deny();
  const result=await createWildsCrewExecution(f.input).execute(f.request);
  assert.equal(result.ok,false);
  assert.deepEqual(f.counts(),{executes:0,clears:0});
  assert.equal(await f.journal.workerHead("worker"),null);
  assert.equal(await f.journal.reservation("stone"),null);
});

it("keeps recovery data if the causal completion write fails after actual commitment",async()=>{
  const f=await fixture();f.commit();
  const runtime=createWildsCrewExecution({...f.input,admitOutcome:async()=>{f.database.failNextTransactionAfterPuts(1);return ["world:harvest"];}});
  const result=await runtime.execute(f.request);
  assert.equal(result.ok,false);
  assert.ok(await f.journal.reservation("stone"));
  assert.deepEqual(f.counts(),{executes:1,clears:0});
  const recovered=await createWildsCrewExecution(f.input).recover(f.transaction.transactionDigest);
  assert.equal(recovered.ok,true);
  assert.equal(await f.journal.reservation("stone"),null);
  assert.deepEqual(f.counts(),{executes:1,clears:1});
});

it("requires admitted local dependencies to be bound into the exact SDK transaction",async()=>{
 const f=await fixture();
 const proposed=await f.journal.append({workerId:"gatherer",jobId:"source",commandDigest:"source",expectedWorkerHead:null,phase:"proposed",observedKaiUPulse:90});
 const admitted=await f.journal.append({workerId:"gatherer",jobId:"source",commandDigest:"source",expectedWorkerHead:proposed.event.eventId,phase:"admitted",observedKaiUPulse:91,admittedWorldEventIds:["world:source"]});
 const result=await createWildsCrewExecution(f.input).execute({...f.request,dependencyEventIds:[admitted.event.eventId]});
 assert.equal(result.ok,false);
 if(!result.ok) assert.equal(result.code,"crew_transaction_causal_dependency_missing");
 assert.deepEqual(f.counts(),{executes:0,clears:0});
 assert.equal(await f.journal.workerHead("worker"),null);
});
for(const boundary of ["authorize","validate","stage"] as const)it(`recall at ${boundary} await prevents dispatch and releases an undispatched proposal`,async()=>{
 const f=await fixture();
 const recall=()=>f.jobs.transition({jobId:"gather",expectedHead:f.job.head,requestId:"recall",observedKaiUPulse:100,action:{type:"recall"}});
 const runtime=createWildsCrewExecution({...f.input,
   authorize:async()=>{if(boundary==="authorize")await recall();return f.input.authorize();},
   rail:{...f.input.rail,validateWorldTransactionV122:async tx=>{if(boundary==="validate")await recall();return {ok:true,transaction:tx};}},
   transactionJournal:{...f.input.transactionJournal,stage:async()=>{if(boundary==="stage")await recall();}}
 });
 const result=await runtime.execute(f.request);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.writes,0);
 assert.equal(f.counts().executes,0);assert.equal(await f.journal.reservation("stone"),null);
 assert.equal((await f.jobs.read("gather"))?.phase,"returning");
 if(boundary!=="authorize"){
   const restored=createWildsCrewExecution({...f.input,rail:{...f.input.rail,worldExecutionV122:async()=>{throw new Error("cancelled proposals need no world lookup");}}});
   const recovery=await restored.recover(f.transaction.transactionDigest);assert.equal(recovery.ok,false);if(!recovery.ok)assert.equal(recovery.writes,0);
 }
});
it("a pending dispatch which wins the CAS stays recoverable when recall arrives",async()=>{
 const f=await fixture();
 const runtime=createWildsCrewExecution({...f.input,rail:{...f.input.rail,executeWorldTransactionV122:async()=>{
   const recalled=await f.jobs.transition({jobId:"gather",expectedHead:f.job.head,requestId:"recall",observedKaiUPulse:100,action:{type:"recall"}});
   assert.equal(recalled.phase,"pending");assert.equal(recalled.recallRequested,true);
   return f.input.rail.executeWorldTransactionV122();
 }}});
 await runtime.execute(f.request);assert.equal(f.counts().executes,1);assert.ok(await f.journal.reservation("stone"));
 f.commit();assert.equal((await runtime.recover(f.transaction.transactionDigest)).ok,true);assert.equal(f.counts().executes,1);
});
it("rejects stale jobs after recall, return and worker reassignment during authorization",async()=>{
 const f=await fixture();
 const runtime=createWildsCrewExecution({...f.input,authorize:async()=>{
   const recalled=await f.jobs.transition({jobId:"gather",expectedHead:f.job.head,requestId:"recall",observedKaiUPulse:100,action:{type:"recall"}});
   await f.jobs.transition({jobId:"gather",expectedHead:recalled.head,requestId:"home",observedKaiUPulse:101,action:{type:"arrive",observationId:"home",position:f.job.home}});
   await f.jobs.assign({...f.job,jobId:"replacement",observedKaiUPulse:102});return f.input.authorize();
 }});
 const result=await runtime.execute(f.request);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.writes,0);
 assert.equal((await f.jobs.current("worker"))?.jobId,"replacement");assert.equal(f.counts().executes,0);assert.equal(await f.journal.reservation("stone"),null);
});
it("recall rolls back proposal rejection, reservation release and job state as one transaction",async()=>{
 const f=await fixture();const proposed=await f.journal.append({workerId:"worker",jobId:"gather",commandDigest:f.transaction.transactionDigest,
   expectedWorkerHead:null,expectedJobHead:f.job.head,lotIds:["stone"],phase:"proposed",observedKaiUPulse:100,transaction:f.transaction});
 f.database.failNextTransactionAfterPuts(2);
 await assert.rejects(f.jobs.transition({jobId:"gather",expectedHead:f.job.head,requestId:"recall",observedKaiUPulse:101,action:{type:"recall"}}));
 assert.equal((await f.jobs.read("gather"))?.head,f.job.head);assert.equal((await f.journal.command(f.transaction.transactionDigest))?.phase,"proposed");assert.ok(await f.journal.reservation("stone"));
 // Omitting the fence cannot downgrade an already bound command.
 const pending=await f.journal.append({workerId:"worker",jobId:"gather",commandDigest:f.transaction.transactionDigest,
   expectedWorkerHead:proposed.event.eventId,lotIds:["stone"],phase:"pending",observedKaiUPulse:102});assert.equal(pending.event.phase,"pending");
});
it("a recalled proposal cannot bypass its persisted fence by omitting expectedJobHead",async()=>{
 const f=await fixture();const proposed=await f.journal.append({workerId:"worker",jobId:"gather",commandDigest:f.transaction.transactionDigest,
   expectedWorkerHead:null,expectedJobHead:f.job.head,lotIds:["stone"],phase:"proposed",observedKaiUPulse:100,transaction:f.transaction});
 await f.jobs.transition({jobId:"gather",expectedHead:f.job.head,requestId:"recall",observedKaiUPulse:101,action:{type:"recall"}});
 await assert.rejects(f.journal.append({workerId:"worker",jobId:"gather",commandDigest:f.transaction.transactionDigest,
   expectedWorkerHead:proposed.event.eventId,lotIds:["stone"],phase:"pending",observedKaiUPulse:102}),/job_fence_conflict/);
 assert.equal((await f.journal.command(f.transaction.transactionDigest))?.phase,"rejected");assert.equal(await f.journal.reservation("stone"),null);
});
it("binds execution subject heads independently from proof digests",async()=>{
 const f=await fixture();assert.notEqual(f.job.ownerProofDigest,f.job.expectedOwnerSubjectHead);assert.notEqual(f.job.workerProofDigest,f.job.expectedWorkerSubjectHead);
 const changed={...f.transaction,participantHeads:{...f.transaction.participantHeads,worker:f.job.workerProofDigest}};
 await assert.rejects(f.journal.append({workerId:"worker",jobId:"gather",commandDigest:changed.transactionDigest,
   expectedWorkerHead:null,expectedJobHead:f.job.head,lotIds:["stone"],phase:"proposed",observedKaiUPulse:100,transaction:changed}),/job_transaction_mismatch/);
 assert.equal(await f.journal.command(f.transaction.transactionDigest),null);
});
