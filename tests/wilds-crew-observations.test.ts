import assert from "node:assert/strict";
import {it} from "node:test";
import {createWildsCrewObservations} from "../src/features/play/wilds-crew-observations";
import {createMemoryWildzContinuityDatabase} from "./support/memory-wildz-continuity-database";
const request={ownerReceizId:"owner",assetId:"card",mode:"roam" as const,genomeProofDigest:"a".repeat(64)};
it("preserves rapid explicit control order and regressed Kai observations across restore",async()=>{
 const db=createMemoryWildzContinuityDatabase();let pulse=100;
 const journal=createWildsCrewObservations(db,()=>pulse--);
 await Promise.all([journal.record(request),journal.record({...request,mode:"follow"}),journal.record(request)]);
 const restored=createWildsCrewObservations(db);const history=await restored.history("owner","card");
 assert.deepEqual(history.events.map(e=>e.mode),["roam","follow","roam"]);
 assert.deepEqual(history.events.map(e=>e.observedKaiUPulse),[98,99,100]);
 assert.deepEqual(history.events.map(e=>e.causalKaiUPulse),[100,100,100]);
 assert.deepEqual(history.events.map(e=>e.sequence),[3,2,1]);
 assert.equal(history.events[0].authority,"local-observation");
 assert.equal((await restored.history("other","card")).events.length,0);
});
it("merges concurrent tab observations without overwriting history and rolls back failed writes",async()=>{
 const db=createMemoryWildzContinuityDatabase();const a=createWildsCrewObservations(db,()=>100),b=createWildsCrewObservations(db,()=>100);
 await Promise.all([a.record(request),b.record({...request,mode:"follow"})]);
 assert.equal((await a.history("owner","card")).events.length,2);
 db.failNextTransactionAfterPuts(1);
 await assert.rejects(a.record(request));
 assert.equal((await b.history("owner","card")).events.length,2);
 await a.record(request);
 const page=await b.history("owner","card",undefined,1);
 assert.equal((await b.history("owner","card",page.nextCursor!)).events.length,2);
});
