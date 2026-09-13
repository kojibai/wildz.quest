import { createWildsConstructionSite } from "../src/features/play/wilds-construction-site";
import assert from "node:assert/strict";
import { it } from "node:test";
import { prepareWildsCrewDelivery, createWildsCrewDelivery, type WildsCrewPreparedDelivery } from "../src/features/play/wilds-crew-delivery";
import { sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card";
import { createWildsCrewJobStore } from "../src/features/play/wilds-crew-jobs";
import { createWildsCrewJournal } from "../src/features/play/wilds-crew-journal";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { createWildsSourceAuthorityProjection } from "../src/features/play/wilds-source-work-authority";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { createWildsWorldEdgeAdmissionQueue, prepareWildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
async function fixture(){
 const owner="crew_test",card=sealCollectedCard({capturedAt:"2026-07-15T00:00:00.000Z",encounterId:"crew-source",formId:"mintcub-1",ownerReceizId:owner});
 const source=projectWildsResourceRegion(0,0).find(s=>s.kind==="timber")!;assert.ok(source);
 const db=createMemoryWildzContinuityDatabase(),jobs=createWildsCrewJobStore("sdk-owner",db),journal=createWildsCrewJournal("sdk-owner",db);
 const binding={ownerReceizId:owner,ownerSubjectId:"sdk-owner",workerSubjectId:"sdk-worker",ownerHead:"1".repeat(64),workerHead:"2".repeat(64),ownerProofDigest:"3".repeat(64),workerProofDigest:"4".repeat(64),mandateDigest:"5".repeat(64),worldId:"wilds:global:v3",assetId:card.id,cardProofDigest:card.proof.digest};
 const site=createWildsConstructionSite({blueprint:"trail-shelter",placedByReceizId:owner,actorPosition:{x:10,z:10},position:{x:12,z:11},rotationQuarterTurns:0,existingStructures:[],existingSites:[],kaiUPulse:999999});
 let job=await jobs.assign({jobId:"gather",workerId:"sdk-worker",assetId:card.id,ownerProofDigest:binding.ownerProofDigest,workerProofDigest:binding.workerProofDigest,expectedOwnerSubjectHead:binding.ownerHead,expectedWorkerSubjectHead:binding.workerHead,genomeProofDigest:card.proof.digest,mandateDigest:binding.mandateDigest,worldId:binding.worldId,regionId:"region:0:0",kind:"deliver",target:site.position,home:site.position,observedKaiUPulse:1000000});
 job=await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"depart",observedKaiUPulse:1000000,action:{type:"depart"}});
 job=await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"arrive",observedKaiUPulse:1000000,action:{type:"arrive",observationId:"physical",position:site.position}});

 const harvest=createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:owner,actorPosition:source.position,kaiUPulse:999999});
 const projection={...createWildsSourceAuthorityProjection(),constructionSites:{[site.siteId]:site},materialLots:{[harvest.lot.lotId]:harvest.lot}};
 const request={job,binding,card,condition:emptyAdventureCondition(card.id),siteId:site.siteId,siteHead:site.head,lotIds:[harvest.lot.lotId],projection,actualWorkerPosition:site.position,spaceId:"wildz.space.outer.v1",kai:createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:1000000,authority:"local"}))};
 return {db,jobs,journal,request};
}

const authorizeCapability=async(request:WildsCrewPreparedDelivery)=>({ok:true as const,commandDigest:request.commandDigest,workerSubjectId:request.source.workerSubjectId,workerHead:request.source.workerHead,cardProofDigest:request.source.cardProofDigest,capability:"haul" as const,maximumMaterialLots:6});
const authorize=async(request:WildsCrewPreparedDelivery)=>({ok:true as const,mandateDigest:request.source.mandateDigest,confirmationDigest:"6".repeat(64),ownerHead:request.source.ownerHead,workerHead:request.source.workerHead,worldId:request.source.worldId,regionId:request.authorizationCommand.regionId,commandDigest:request.commandDigest,nextUsage:{resourcePhiMicro:"0",geometryUnits:"0",actions:"1"}});
it("delivery reserves actual owner lots at the site and exact recovery never redispatches",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewDelivery(f.request);let saves=0;
 assert.equal(prepared.authorizationCommand.commandKind,"materials.contribute");
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:f.request.projection,persist:async()=>{saves++;}});
 const runtime=createWildsCrewDelivery({authorizeCapability,journal:f.journal,authorize,observeKaiUPulse:()=>1000000,lookup:async()=>queue.current(),admit:async(command,card,beforeAdmit)=>({projection:await queue.admit({schema:"receiz.wilds_world_outbox_entry.v1",actorId:f.request.binding.ownerReceizId,guestId:"crew",command,card,queuedAt:"2026-07-15T00:00:00.000Z"},{beforeAdmit})})});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,true);assert.equal(saves,1);
 assert.equal(queue.current().reservedMaterialLots[prepared.lotIds[0]!],f.request.siteId);
 assert.equal((await runtime.recover(prepared.commandDigest)).ok,true);await runtime.execute(prepared,null);assert.equal(saves,1);
});
it("delivery recalled during source preparation writes no reservation",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewDelivery(f.request);let saves=0;
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:f.request.projection,persist:async()=>{saves++;},prepare:async(base,entry,anchor)=>{
 await f.jobs.transition({jobId:f.request.job.jobId,expectedHead:f.request.job.head,requestId:"recall",observedKaiUPulse:1000000,action:{type:"recall"}});return prepareWildsWorldOutboxEntry(base,entry,anchor);}});
 const runtime=createWildsCrewDelivery({authorizeCapability,journal:f.journal,authorize,observeKaiUPulse:()=>1000000,lookup:async()=>queue.current(),admit:async(command,card,beforeAdmit)=>({projection:await queue.admit({schema:"receiz.wilds_world_outbox_entry.v1",actorId:f.request.binding.ownerReceizId,guestId:"crew",command,card,queuedAt:"2026-07-15T00:00:00.000Z"},{beforeAdmit})})});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.writes,0);assert.equal(saves,0);assert.equal(await f.journal.reservation(prepared.lotIds[0]!),null);
});
it("delivery rejects distance and unavailable lots before authorization",async()=>{
 const f=await fixture();await assert.rejects(prepareWildsCrewDelivery({...f.request,actualWorkerPosition:{x:12,y:30,z:11}}),/arrival/);
 await assert.rejects(prepareWildsCrewDelivery({...f.request,projection:{...f.request.projection,reservedMaterialLots:{[f.request.lotIds[0]!]:"other"}}}),/unavailable/);
});

it("delivery binds authorization region before any authorizer or source write",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewDelivery(f.request);let calls=0;
 const runtime=createWildsCrewDelivery({authorizeCapability,journal:f.journal,authorize:async request=>{calls++;return authorize(request);},observeKaiUPulse:()=>1000000,lookup:async()=>null,admit:async()=>{calls++;throw new Error("unexpected dispatch");}});
 const result=await runtime.execute({...prepared,authorizationCommand:{...prepared.authorizationCommand,regionId:"region:8:8"}},null);assert.equal(result.ok,false);assert.equal(calls,0);
});
it("delivery retains pending lot reservation after ambiguous completion and recovers without dispatch",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewDelivery(f.request);let saves=0;
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:f.request.projection,persist:async()=>{saves++;}});
 const runtime=createWildsCrewDelivery({authorizeCapability,journal:f.journal,authorize,observeKaiUPulse:()=>1000000,lookup:async()=>queue.current(),admit:async(command,card,beforeAdmit)=>{
 await queue.admit({schema:"receiz.wilds_world_outbox_entry.v1",actorId:f.request.binding.ownerReceizId,guestId:"crew",command,card,queuedAt:"2026-07-15T00:00:00.000Z"},{beforeAdmit});throw new Error("lost completion");}});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,false);assert.ok(await f.journal.reservation(prepared.lotIds[0]!));
 const restored=createWildsCrewDelivery({authorizeCapability,journal:createWildsCrewJournal("sdk-owner",f.db),authorize,observeKaiUPulse:()=>1000000,lookup:async()=>queue.current(),admit:async()=>{throw new Error("must not redispatch");}});
 assert.equal((await restored.recover(prepared.commandDigest)).ok,true);assert.equal(saves,1);assert.equal(await f.journal.reservation(prepared.lotIds[0]!),null);
});
