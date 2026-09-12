import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsCrewJobStore } from "../src/features/play/wilds-crew-jobs";
import { createWildsCrewJournal } from "../src/features/play/wilds-crew-journal";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
const assignment = { jobId:"job",workerId:"worker",assetId:"asset",ownerProofDigest:"owner-proof",workerProofDigest:"worker-proof",genomeProofDigest:"genome-proof",mandateDigest:"mandate",worldId:"world",regionId:"region",kind:"gather" as const,target:{x:1,y:0,z:2},home:{x:0,y:0,z:0},observedKaiUPulse:100 };
const navigation = {observationId:"position-observation",position:assignment.target};
it("atomically allows one current job per exact owner/worker and persists across reload",async()=>{
 const db=createMemoryWildzContinuityDatabase(), a=createWildsCrewJobStore("owner",db), b=createWildsCrewJobStore("owner",db);
 const results=await Promise.allSettled([a.assign(assignment),b.assign({...assignment,jobId:"other"})]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal((await b.current("worker"))?.jobId,results.find(r=>r.status==="fulfilled")?.value.jobId);
 assert.equal((await createWildsCrewJobStore("different",db).current("worker")),null);
 assert.equal((await b.list()).jobs.length,1);
});
it("CAS revisions, exact retries, regressed Kai observations and history survive reload",async()=>{
 const db=createMemoryWildzContinuityDatabase(), store=createWildsCrewJobStore("owner",db);
 const first=await store.assign(assignment);
 assert.deepEqual(await store.assign(assignment),first);
 const request={jobId:"job",expectedHead:first.head,requestId:"depart",observedKaiUPulse:99,action:{type:"depart" as const}};
 const next=await store.transition(request);
 assert.deepEqual(await store.transition(request),next);
 assert.equal(next.observedKaiUPulse,99);assert.equal(next.causalKaiUPulse,100);
 await assert.rejects(store.transition({...request,requestId:"race"}),/head_conflict/);
 const restored=createWildsCrewJobStore("owner",db);
 const page=await restored.history("job",undefined,1);assert.equal(page.jobs[0].phase,"travelling");
 assert.equal((await restored.history("job",page.nextCursor!,1)).jobs[0].phase,"assigned");
});
it("pending recall holds exact journal reservations until recovery and retains admitted effects",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewJobStore("owner",db),journal=createWildsCrewJournal("owner",db);
 let job=await store.assign(assignment);let seq=0;
 const step=async(action:Parameters<typeof store.transition>[0]["action"])=>job=await store.transition({jobId:"job",expectedHead:job.head,requestId:`r${++seq}`,observedKaiUPulse:100,action});
 await step({type:"depart"});await step({type:"arrive",...navigation});
 const base={workerId:"worker",jobId:"job",commandDigest:"command",lotIds:["lot"],observedKaiUPulse:100};
 const proposed=await journal.append({...base,expectedWorkerHead:null,phase:"proposed"});
 const pending=await journal.append({...base,expectedWorkerHead:proposed.event.eventId,phase:"pending"});
 await step({type:"command-pending",eventId:pending.event.eventId});
 await step({type:"recall"});assert.equal(job.phase,"pending");assert.equal(job.recallRequested,true);
 await assert.rejects(step({type:"cancel"}),/pending/);assert.ok(await journal.reservation("lot"));
 const admitted=await journal.append({...base,expectedWorkerHead:pending.event.eventId,phase:"admitted",admittedWorldEventIds:["world-effect"]});
 await step({type:"command-resolved",eventId:admitted.event.eventId});
 assert.equal(job.phase,"returning");assert.deepEqual(job.committedWorldEventIds,["world-effect"]);
 await step({type:"arrive",observationId:"home-observation",position:assignment.home});
 assert.equal(job.phase,"cancelled");assert.deepEqual(job.committedWorldEventIds,["world-effect"]);assert.equal(await store.current("worker"),null);
});
it("rejects fabricated outcome references and rolls back all job writes on storage failure",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewJobStore("owner",db);
 db.failNextTransactionAfterPuts(2);await assert.rejects(store.assign(assignment));assert.equal(await store.read("job"),null);assert.equal(await store.current("worker"),null);
 const job=await store.assign(assignment);
 await assert.rejects(store.transition({jobId:"job",expectedHead:job.head,requestId:"fake",observedKaiUPulse:100,action:{type:"command-resolved",eventId:"made-up"}}),/evidence/);
 assert.equal((await store.read("job"))?.head,job.head);
});
it("recall reconciles a pending dispatch persisted before the job projection",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewJobStore("owner",db),journal=createWildsCrewJournal("owner",db);
 let job=await store.assign(assignment);
 for(const [requestId,action] of [["depart",{type:"depart" as const}],["arrive",{type:"arrive" as const,...navigation}]] as const)
   job=await store.transition({jobId:"job",expectedHead:job.head,requestId,observedKaiUPulse:100,action});
 const base={workerId:"worker",jobId:"job",commandDigest:"command",lotIds:["lot"],observedKaiUPulse:100};
 const proposed=await journal.append({...base,expectedWorkerHead:null,phase:"proposed"});
 await journal.append({...base,expectedWorkerHead:proposed.event.eventId,phase:"pending"});
 job=await store.transition({jobId:"job",expectedHead:job.head,requestId:"recall",observedKaiUPulse:100,action:{type:"recall"}});
 assert.equal(job.phase,"pending");assert.equal(job.pending?.commandDigest,"command");assert.ok(await journal.reservation("lot"));
});
it("verified zero-write recovery unblocks pending recall without fabricating effects",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewJobStore("owner",db),journal=createWildsCrewJournal("owner",db);
 let job=await store.assign(assignment);let n=0;
 const step=async(action:Parameters<typeof store.transition>[0]["action"])=>job=await store.transition({jobId:"job",expectedHead:job.head,requestId:`s${++n}`,observedKaiUPulse:100,action});
 await step({type:"depart"});await step({type:"arrive",...navigation});
 const base={workerId:"worker",jobId:"job",commandDigest:"command",lotIds:["lot"],observedKaiUPulse:100};
 const proposed=await journal.append({...base,expectedWorkerHead:null,phase:"proposed"});const pending=await journal.append({...base,expectedWorkerHead:proposed.event.eventId,phase:"pending"});
 await step({type:"command-pending",eventId:pending.event.eventId});await step({type:"recall"});
 const rejected=await journal.append({...base,expectedWorkerHead:pending.event.eventId,phase:"rejected"});await step({type:"command-resolved",eventId:rejected.event.eventId});
 assert.equal(job.phase,"returning");assert.deepEqual(job.committedWorldEventIds,[]);assert.equal(await journal.reservation("lot"),null);
});
it("bounds dependency assignment and never treats pending work as a completed dependency",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewJobStore("owner",db);
 await store.assign(assignment);
 await assert.rejects(store.assign({...assignment,jobId:"dependent",workerId:"second",dependencyJobIds:["job"]}),/dependency_incomplete/);
 await assert.rejects(store.assign({...assignment,jobId:"cycle",workerId:"second",dependencyJobIds:["cycle"]}),/dependencies_invalid/);
 assert.equal(await store.current("second"),null);
});
it("paginated restore never scans the complete store and rejects conflicting request retries",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewJobStore("owner",db);
 const first=await store.assign(assignment);await store.assign({...assignment,jobId:"second",workerId:"second"});
 const page=await store.list(undefined,1);assert.equal(page.jobs[0].jobId,"second");assert.equal((await store.list(page.nextCursor!,1)).jobs[0].jobId,"job");
 const request={jobId:"job",expectedHead:first.head,requestId:"same",observedKaiUPulse:100,action:{type:"depart" as const}};
 await store.transition(request);await assert.rejects(store.transition({...request,observedKaiUPulse:101}),/replay_conflict/);
});
it("recall restores admitted effects when both execution projection writes were interrupted",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewJobStore("owner",db),journal=createWildsCrewJournal("owner",db);
 let job=await store.assign(assignment);
 for(const [requestId,action] of [["depart",{type:"depart" as const}],["arrive",{type:"arrive" as const,...navigation}]] as const)
   job=await store.transition({jobId:"job",expectedHead:job.head,requestId,observedKaiUPulse:100,action});
 const base={workerId:"worker",jobId:"job",commandDigest:"command",lotIds:["lot"],observedKaiUPulse:100};
 const proposed=await journal.append({...base,expectedWorkerHead:null,phase:"proposed"});const pending=await journal.append({...base,expectedWorkerHead:proposed.event.eventId,phase:"pending"});
 await journal.append({...base,expectedWorkerHead:pending.event.eventId,phase:"admitted",admittedWorldEventIds:["actual-cargo-event"]});
 job=await store.transition({jobId:"job",expectedHead:job.head,requestId:"recall",observedKaiUPulse:100,action:{type:"recall"}});
 assert.equal(job.phase,"returning");assert.deepEqual(job.committedWorldEventIds,["actual-cargo-event"]);
});
