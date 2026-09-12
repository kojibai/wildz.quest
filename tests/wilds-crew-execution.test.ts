import assert from "node:assert/strict";
import { it } from "node:test";
import { planReceizWorldCommandV122, planReceizWorldTransactionV122, type ReceizExecutionOutcomeV122 } from "@receiz/sdk";
import { createWildsCrewExecution } from "../src/lib/receiz/wilds-crew-execution";
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
  return {transaction,database,journal,input,request:{workerId:"worker",jobId:"gather",transaction,expectedWorkerHead:null,dependencyEventIds:[],lotIds:["stone"]},
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
