import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate";
import { createWildsConstructionSite, contributeWildsConstructionSite } from "../src/features/play/wilds-construction-site";
import assert from "node:assert/strict";
import { it } from "node:test";
import { prepareWildsCrewBuilding, createWildsCrewBuilding, type WildsCrewPreparedBuilding } from "../src/features/play/wilds-crew-building";
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
import { createWildsWorldEdgeAdmissionQueue } from "../src/features/play/wilds-world-outbox";
async function fixture(){
 const owner="crew_test",card=sealCollectedCard({capturedAt:"2026-07-15T00:00:00.000Z",encounterId:"crew-source",formId:"mintcub-1",ownerReceizId:owner});
 const source=projectWildsResourceRegion(0,0).find(s=>s.kind==="timber")!;assert.ok(source);
 const db=createMemoryWildzContinuityDatabase(),jobs=createWildsCrewJobStore("sdk-owner",db),journal=createWildsCrewJournal("sdk-owner",db);
 const binding={ownerReceizId:owner,ownerSubjectId:"sdk-owner",workerSubjectId:"sdk-worker",ownerHead:"1".repeat(64),workerHead:"2".repeat(64),ownerProofDigest:"3".repeat(64),workerProofDigest:"4".repeat(64),mandateDigest:"5".repeat(64),worldId:"wilds:global:v3",assetId:card.id,cardProofDigest:card.proof.digest};
 const site=createWildsConstructionSite({blueprint:"trail-shelter",placedByReceizId:owner,actorPosition:{x:10,z:10},position:{x:12,z:11},rotationQuarterTurns:0,existingStructures:[],existingSites:[],kaiUPulse:999999});
 let job=await jobs.assign({jobId:"gather",workerId:"sdk-worker",assetId:card.id,ownerProofDigest:binding.ownerProofDigest,workerProofDigest:binding.workerProofDigest,expectedOwnerSubjectHead:binding.ownerHead,expectedWorkerSubjectHead:binding.workerHead,genomeProofDigest:card.proof.digest,mandateDigest:binding.mandateDigest,worldId:binding.worldId,regionId:"region:0:0",kind:"build",target:site.position,home:site.position,observedKaiUPulse:1000000});
 job=await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"depart",observedKaiUPulse:1000000,action:{type:"depart"}});
 job=await jobs.transition({jobId:job.jobId,expectedHead:job.head,requestId:"arrive",observedKaiUPulse:1000000,action:{type:"arrive",observationId:"physical",position:site.position}});

 const sources=Array.from({length:9},(_,i)=>projectWildsResourceRegion(i-4,0)).flat();
 const chosen=[...sources.filter(s=>s.kind==="timber").slice(0,2),sources.find(s=>s.kind==="stone")!];
 const lots=chosen.map(source=>createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:owner,actorPosition:source.position,kaiUPulse:999999}).lot);
 const ready=contributeWildsConstructionSite({site,expectedSiteHead:site.head,contributorReceizId:owner,lots,kaiUPulse:999999});
 const projection={...createWildsSourceAuthorityProjection(),constructionSites:{[ready.siteId]:ready},materialLots:Object.fromEntries(lots.map(lot=>[lot.lotId,lot])),reservedMaterialLots:Object.fromEntries(lots.map(lot=>[lot.lotId,ready.siteId]))};
 const creatureSubjectId=`creature:${sha256PortableBasis(card.id).slice(0,32)}`,creatureHead=sha256PortableBasis(card.proof.digest);
 const consent=evaluateWildsCreatureConsent({creatureSubjectId,creatureHead,condition:{energy:100,fatigue:0,injury:0,stress:0},bond:80,preferences:{professions:["build"],avoidHazards:[]},capabilities:{professions:["build"]},safety:{risk:0,hazards:[],supportAvailable:true},requested:{professions:["build"],maxActions:1},kaiUPulse:1000000});
 const sourceMandate=createWildsCreatureMandate({consent,creatureSubjectId,creatureHead,region:{x:0,z:0},professions:["build"],allowedResourceIds:[site.siteId],maxActions:1,issuedAtKaiUPulse:1000000,expiresAtKaiUPulse:2000000});
 const request={job,binding,card,condition:emptyAdventureCondition(card.id),siteId:ready.siteId,siteHead:ready.head,sourceMandate,projection,actualWorkerPosition:site.position,spaceId:"wildz.space.outer.v1",kai:createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:1000000,authority:"local"}))};
 return {db,jobs,journal,request};
}


const authorizeCapability=async(request:WildsCrewPreparedBuilding)=>({ok:true as const,commandDigest:request.commandDigest,workerSubjectId:request.source.workerSubjectId,workerHead:request.source.workerHead,cardProofDigest:request.source.cardProofDigest,capability:"build" as const,maximumMaterialLots:6});
const authorize=async(request:WildsCrewPreparedBuilding)=>({ok:true as const,mandateDigest:request.source.mandateDigest,confirmationDigest:"6".repeat(64),ownerHead:request.source.ownerHead,workerHead:request.source.workerHead,worldId:request.source.worldId,regionId:request.authorizationCommand.regionId,commandDigest:request.commandDigest,nextUsage:{resourcePhiMicro:request.authorizationCommand.resourcePhiMicro,geometryUnits:"1",actions:"1"}});
it("build consumes exact reserved lots and attributes the real worker through source admission",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewBuilding(f.request);let saves=0;
 assert.equal(prepared.authorizationCommand.commandKind,"materials.create");assert.equal(prepared.authorizationCommand.geometryUnits,"1");
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:f.request.projection,persist:async()=>{saves++;}});
 const runtime=createWildsCrewBuilding({authorizeCapability,journal:f.journal,authorize,observeKaiUPulse:()=>1000000,lookup:async()=>queue.current(),admit:async(command,card,beforeAdmit)=>({projection:await queue.admit({schema:"receiz.wilds_world_outbox_entry.v1",actorId:f.request.binding.ownerReceizId,guestId:"crew",command,card,queuedAt:"2026-07-15T00:00:00.000Z"},{beforeAdmit})})});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,true);assert.equal(saves,1);
 const structure=queue.current().structures[prepared.source.expectedStructure!.structureId]!;
 assert.deepEqual(structure.builder,{creatureSubjectId:f.request.sourceMandate.creatureSubjectId,creatureHead:f.request.sourceMandate.creatureHead});
 assert.deepEqual(structure.materialContributorReceizIds,[f.request.binding.ownerReceizId]);
 for(const id of prepared.lotIds)assert.equal(queue.current().consumedMaterialLots[id],prepared.source.expectedStructure!.structureId);
 assert.equal((await runtime.recover(prepared.commandDigest)).ok,true);await runtime.execute(prepared,null);assert.equal(saves,1);
});
it("build refuses an omitted worker mandate and changed material reservation",async()=>{
 const f=await fixture();await assert.rejects(prepareWildsCrewBuilding({...f.request,sourceMandate:{...f.request.sourceMandate,creatureHead:"wrong"}}),/mandate/);
 const first=Object.keys(f.request.projection.reservedMaterialLots)[0]!;
 await assert.rejects(prepareWildsCrewBuilding({...f.request,projection:{...f.request.projection,reservedMaterialLots:{...f.request.projection.reservedMaterialLots,[first]:"other"}}}),/unavailable/);
});

it("a hashed build consent cannot replace verified capability authority",async()=>{
 const f=await fixture(),prepared=await prepareWildsCrewBuilding(f.request);let calls=0;
 const runtime=createWildsCrewBuilding({authorizeCapability:async()=>({ok:false}),journal:f.journal,authorize:async request=>{calls++;return authorize(request);},observeKaiUPulse:()=>1000000,lookup:async()=>null,admit:async()=>{calls++;throw new Error("unexpected admission");}});
 const result=await runtime.execute(prepared,null);assert.equal(result.ok,false);assert.equal(calls,0);assert.equal(await f.journal.command(prepared.commandDigest),null);
});
