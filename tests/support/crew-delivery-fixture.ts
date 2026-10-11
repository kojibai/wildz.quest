import { createWildsConstructionSite } from "../../src/features/play/wilds-construction-site";
import assert from "node:assert/strict";
import { sealCollectedCard, sha256PortableBasis } from "../../src/features/play/portable-card";
import { createWildsCrewJobStore } from "../../src/features/play/wilds-crew-jobs";
import { createWildsCrewJournal } from "../../src/features/play/wilds-crew-journal";
import { createMemoryWildzContinuityDatabase } from "./memory-wildz-continuity-database";
import { projectWildsResourceRegion } from "../../src/features/play/wilds-resource-authority";
import { createWildsSourceAuthorityProjection } from "../../src/features/play/wilds-source-work-authority";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../../src/features/play/wilds-steward-construction";
import { emptyAdventureCondition } from "../../src/features/play/adventure/card-condition";
import { createKaiTemporalRoot } from "../../src/features/play/kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse } from "../../src/features/play/kai-klok-moment";
export async function crewDeliveryFixture(owner="crew_test"){
 const card=sealCollectedCard({capturedAt:"2026-07-15T00:00:00.000Z",encounterId:"crew-source",formId:"mintcub-1",ownerReceizId:owner});
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
