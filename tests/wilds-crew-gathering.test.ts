import assert from "node:assert/strict";
import { it } from "node:test";
import { prepareWildsCrewGathering, createWildsCrewGathering, type WildsCrewPreparedGathering } from "../src/features/play/wilds-crew-gathering";
import { sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card";
import { createWildsCrewJobStore } from "../src/features/play/wilds-crew-jobs";
import { createWildsCrewJournal } from "../src/features/play/wilds-crew-journal";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { createWildsSourceAuthorityProjection } from "../src/features/play/wilds-source-work-authority";
import { initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { createWildsWorldEdgeAdmissionQueue, prepareWildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
async function fixture(){
 const owner="crew_test",card=sealCollectedCard({capturedAt:"2026-07-15T00:00:00.000Z",encounterId:"crew-source",formId:"mintcub-1",ownerReceizId:owner});
 const source=projectWildsResourceRegion(0,0).find(s=>s.kind==="timber")!;assert.ok(source);
 const db=createMemoryWildzContinuityDatabase(),jobs=createWildsCrewJobStore("sdk-owner",db),journal=createWildsCrewJournal("sdk-owner",db);
 const binding={ownerReceizId:owner,ownerSubjectId:"sdk-owner",workerSubjectId:"sdk-worker",ownerHead:"1".repeat(64),workerHead:"2".repeat(64),ownerProofDigest:"3".repeat(64),workerProofDigest:"4".repeat(64),mandateDigest:"5".repeat(64),worldId:"wilds:global:v3",assetId:card.id,cardProofDigest:card.proof.digest};
 let job=await jobs.assign({jobId:"gather",workerId:"sdk-worker",assetId:card.id,ownerProofDigest:binding.ownerProofDigest,workerProofDigest:binding.workerProofDigest,expectedOwnerSubjectHead:binding.ownerHead,expectedWorkerSubjectHead:binding.workerHead,genomeProofDigest:card.proof.digest,mandateDigest:binding.mandateDigest,worldId:binding.worldId,regionId:"region:0:0",kind:"gather",target:source.position,home:source.position,observedKaiUPulse:1000000});
 job=await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"depart",observedKaiUPulse:1000000,action:{type:"depart"}});
 job=await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"arrive",observedKaiUPulse:1000000,action:{type:"arrive",observationId:"physical",position:source.position}});
 const creatureSubjectId=`creature:${sha256PortableBasis(card.id).slice(0,32)}`,creatureHead=sha256PortableBasis(card.proof.digest);
 const consent=evaluateWildsCreatureConsent({creatureSubjectId,creatureHead,condition:{energy:100,fatigue:0,injury:0,stress:0},bond:80,preferences:{professions:["lumber"],avoidHazards:[]},capabilities:{professions:["lumber"]},safety:{risk:0,hazards:[],supportAvailable:true},requested:{professions:["lumber"],maxActions:1},kaiUPulse:1000000});
 const sourceMandate=createWildsCreatureMandate({consent,creatureSubjectId,creatureHead,region:{x:0,z:0},professions:["lumber"],allowedResourceIds:[source.sourceId],maxActions:1,issuedAtKaiUPulse:1000000,expiresAtKaiUPulse:2000000});
 const request={job,binding,card,condition:emptyAdventureCondition(card.id),source,sourceHead:initialWildsHarvestedSourceState(source).head,projection:createWildsSourceAuthorityProjection(),actualWorkerPosition:source.position,spaceId:"wildz.space.outer.v1",kai:createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:1000000,authority:"local"})),sourceMandate};
 return {db,jobs,journal,request};
}
it("prepares the actual typed harvest command without mutating a source or material inventory",async()=>{
 const f=await fixture();const prepared=await prepareWildsCrewGathering(f.request);
 assert.equal(prepared.source.command.type,"resource.material.harvest");assert.equal(prepared.authorizationCommand.commandKind,"commons.harvest");
 assert.equal(prepared.source.command.actorPosition.x,f.request.actualWorkerPosition.x);assert.equal(Object.keys(f.request.projection.materialLots).length,0);
 await assert.rejects(prepareWildsCrewGathering({...f.request,actualWorkerPosition:{...f.request.actualWorkerPosition,y:f.request.actualWorkerPosition.y+20}}),/arrival/);
 await assert.rejects(prepareWildsCrewGathering({...f.request,condition:{...f.request.condition,fatigue:99}}),/condition/);
});
it("dispatches through real source admission and records the admitted lot, never a synthetic SDK receipt",async()=>{
 const f=await fixture();const prepared=await prepareWildsCrewGathering(f.request);let saves=0;
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:f.request.projection,persist:async()=>{saves++;}});
 const runtime=createWildsCrewGathering({journal:f.journal,observeKaiUPulse:()=>1000000,
   authorize:async request=>({ok:true,mandateDigest:request.source.mandateDigest,confirmationDigest:"6".repeat(64),ownerHead:request.source.ownerHead,workerHead:request.source.workerHead,worldId:request.source.worldId,regionId:request.authorizationCommand.regionId,commandDigest:request.commandDigest,nextUsage:{resourcePhiMicro:"0",geometryUnits:"0",actions:"1"}}),
   admit:async(command,card,beforeAdmit)=>{const events:unknown[]=[];const projection=await queue.admit({schema:"receiz.wilds_world_outbox_entry.v1",actorId:f.request.binding.ownerReceizId,guestId:"crew",command,card,queuedAt:"2026-07-15T00:00:00.000Z"},{beforeAdmit,onAdmitted:(_p,e)=>events.push(...e)});return {projection};},lookup:async()=>queue.current()});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,true);assert.equal(saves,1);
 assert.equal(Object.keys(queue.current().materialLots).length,1);assert.equal((await f.journal.command(prepared.commandDigest))?.phase,"admitted");
 await runtime.execute(prepared,null);assert.equal(saves,1);assert.equal((await runtime.recover(prepared.commandDigest)).ok,true);
});

const authorize=async(request:WildsCrewPreparedGathering)=>({ok:true as const,mandateDigest:request.source.mandateDigest,confirmationDigest:"6".repeat(64),ownerHead:request.source.ownerHead,workerHead:request.source.workerHead,worldId:request.source.worldId,regionId:request.authorizationCommand.regionId,commandDigest:request.commandDigest,nextUsage:{resourcePhiMicro:"0",geometryUnits:"0",actions:"1"}});
it("recall during asynchronous source preparation cancels admission before any material write",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewGathering(f.request);let saves=0;
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:f.request.projection,persist:async()=>{saves++;},prepare:async(base,entry,anchor)=>{
   await f.jobs.transition({jobId:f.request.job.jobId,expectedHead:f.request.job.head,requestId:"recall",observedKaiUPulse:1000000,action:{type:"recall"}});
   return prepareWildsWorldOutboxEntry(base,entry,anchor);
 }});
 const runtime=createWildsCrewGathering({journal:f.journal,authorize,observeKaiUPulse:()=>1000000,lookup:async()=>queue.current(),admit:async(command,card,beforeAdmit)=>({projection:await queue.admit({schema:"receiz.wilds_world_outbox_entry.v1",actorId:f.request.binding.ownerReceizId,guestId:"crew",command,card,queuedAt:"2026-07-15T00:00:00.000Z"},{beforeAdmit})})});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.writes,0);
 assert.equal(saves,0);assert.equal(Object.keys(queue.current().materialLots).length,0);assert.equal(await f.journal.reservation(f.request.source.sourceId),null);
});
it("recovers the exact material admission after journal completion fails without harvesting again",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewGathering(f.request);let saves=0;
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:f.request.projection,persist:async()=>{saves++;}});
 const runtime=createWildsCrewGathering({journal:f.journal,authorize,observeKaiUPulse:()=>1000000,lookup:async()=>queue.current(),admit:async(command,card,beforeAdmit)=>{
   const projection=await queue.admit({schema:"receiz.wilds_world_outbox_entry.v1",actorId:f.request.binding.ownerReceizId,guestId:"crew",command,card,queuedAt:"2026-07-15T00:00:00.000Z"},{beforeAdmit});
   f.db.failNextTransactionAfterPuts(1);return {projection};
 }});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,false);assert.equal(saves,1);assert.ok(await f.journal.reservation(f.request.source.sourceId));
 const recovered=await runtime.recover(prepared.commandDigest);assert.equal(recovered.ok,true);assert.equal(saves,1);assert.equal(await f.journal.reservation(f.request.source.sourceId),null);
 if(recovered.ok)assert.equal(recovered.lot.lotId,prepared.expectedLotId);
});
it("missing verified mandate authorization blocks even a valid willing worker at its source",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewGathering(f.request);let calls=0;
 const runtime=createWildsCrewGathering({journal:f.journal,authorize:async()=>({ok:false,code:"not_verified",writesOnFailure:0}),observeKaiUPulse:()=>1000000,lookup:async()=>null,admit:async()=>{calls++;return {projection:f.request.projection};}});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,false);assert.equal(calls,0);assert.equal(await f.journal.command(prepared.commandDigest),null);
});

it("cannot substitute an allowed observation kind for actual harvest mandate authorization",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewGathering(f.request);let calls=0;
 const runtime=createWildsCrewGathering({journal:f.journal,authorize:async request=>{calls++;return authorize(request);},observeKaiUPulse:()=>1000000,lookup:async()=>null,admit:async()=>({projection:f.request.projection})});
 const result=await runtime.execute({...prepared,authorizationCommand:{...prepared.authorizationCommand,commandKind:"commons.observe"}},null);
 assert.equal(result.ok,false);assert.equal(calls,0);assert.equal(await f.journal.command(prepared.commandDigest),null);
});
