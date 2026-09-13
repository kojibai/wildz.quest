import { createWildsCrewSourceRuntime, type WildsCrewMaterialCapabilityAuthorization } from "./wilds-crew-source-runtime";
import { settleWildsBuild } from "./wilds-steward-build-settlement";
import { wildsWorldSourceEmission } from "./wilds-world-genesis";
import { reverifyWildsCreatureMandate, type WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import { WILDS_COMMAND_LAW } from "./wilds-world-constitution";
import { completeWildsConstructionSite, verifyWildsConstructionSite } from "./wilds-construction-site";
import { WILDS_EMISSION_REGION_SIZE } from "./wilds-grove-genesis";
import type { WildsWorldCommand } from "./wilds-world-service";
import { digestReceizCanonicalV122 } from "@receiz/sdk";
import type { validateWildsCrewMandateCommand, WildsCrewCommand } from "../../lib/receiz/wilds-crew-mandate";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { constitutionalDigest } from "./wilds-constitution";
import { createWildsCrewJournal, type WildsCrewStoredSourceCommand, type WildsCrewAnyStoredSourceCommand } from "./wilds-crew-journal";
import type { WildsCrewJob } from "./wilds-crew-jobs";
import { prepareWildsCrewDisposition } from "./wilds-crew-policy";
import { canWildsCrewTravel } from "./wilds-crew-physical-navigation";
import type { AdventureCardCondition } from "./adventure/card-condition";
import { verifyKaiTemporalRoot, type KaiTemporalRoot } from "./kai-temporal-root";
import { canonicalPortableCardJson, sha256PortableBasis, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import { createWildsStewardStructureOperation, verifyWildsStructure, verifyWildsMaterialLot } from "./wilds-steward-construction";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type { WildsCrewNavigationPoint } from "./wilds-crew-navigation";

type BuildingSource=WildsCrewStoredSourceCommand<Extract<WildsWorldCommand,{type:"construction.site.work"}>>;
export type WildsCrewBuildingBinding=Omit<BuildingSource,"command"|"expectedLotId"|"arrival"|"lotHeads"|"expectedSiteHead"|"expectedStructure"|"regionId">;
export type WildsCrewPreparedBuilding=Readonly<{
  jobId:string;workerId:string;expectedJobHead:string;commandDigest:string;
  source:BuildingSource;card:PortableCardAsset;authorizationCommand:WildsCrewCommand;
  /** An expected successor identity only. Inventory changes exclusively on admission. */
  lotIds:readonly string[];
}>;
const buildingSource=(value:WildsCrewAnyStoredSourceCommand|undefined):value is BuildingSource=>value?.command.type==="construction.site.work";
const fail=(code:string):never=>{throw new Error(`crew_building_${code}`);};
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
function freeze<T>(value:T):T{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

/** Prepares the existing source build settlement. The application mandate geometry
 * convention counts completed structure objects: this command creates exactly one.
 * Expected lots/structure remain proposals until exact source admission. */
export async function prepareWildsCrewBuilding(input:Readonly<{
 job:WildsCrewJob;binding:WildsCrewBuildingBinding;card:PortableCardAsset;condition:AdventureCardCondition;
 siteId:string;siteHead:string;sourceMandate:WildsCreatureMandateV1;revokedSourceMandateIds?:readonly string[];projection:WildsWorldProjection;
 actualWorkerPosition:Readonly<WildsCrewNavigationPoint>;spaceId:string;kai:KaiTemporalRoot;
}>):Promise<WildsCrewPreparedBuilding>{
 const request=structuredClone(input),{job,binding,card,condition,projection}=request;
 const {head,...body}=job;
 if(await digestReceizCanonicalV122(body)!==head||job.kind!=="build"||job.phase!=="working"||job.recallRequested||job.pending||job.committedWorldEventIds.length) return fail("job_not_working");
 if(binding.assetId!==job.assetId||card.id!==job.assetId||!verifyAnyWildsCard(card).ok||binding.cardProofDigest!==card.proof.digest
 ||!sameWildzPlayerCoordinate(card.manifest.ownerReceizId,binding.ownerReceizId)||binding.ownerSubjectId!==job.ownerSubjectId
 ||binding.workerSubjectId!==job.workerId||binding.worldId!==job.worldId||projection.worldId!==job.worldId
 ||binding.ownerHead!==job.expectedOwnerSubjectHead||binding.workerHead!==job.expectedWorkerSubjectHead
 ||binding.ownerProofDigest!==job.ownerProofDigest||binding.workerProofDigest!==job.workerProofDigest||binding.mandateDigest!==job.mandateDigest) return fail("binding_invalid");
 const disposition=prepareWildsCrewDisposition(card);
 if(!disposition||condition.assetId!==card.id||!canWildsCrewTravel(condition)||condition.fatigue>=disposition.restAtFatigue)return fail("condition_unwilling");
 const site=projection.constructionSites[request.siteId],p=request.actualWorkerPosition;
 if(!site||!verifyWildsConstructionSite(site)||site.head!==request.siteHead)return fail("site_head_stale");
 if(request.spaceId!=="wildz.space.outer.v1"||![p.x,p.y,p.z].every(Number.isFinite)||Math.hypot(p.x-site.position.x,p.y-site.position.y,p.z-site.position.z)>6
 ||Math.hypot(job.target.x-site.position.x,job.target.y-site.position.y,job.target.z-site.position.z)>6)return fail("physical_arrival_required");
 const regionId=`region:${Math.floor(site.position.x/WILDS_EMISSION_REGION_SIZE)}:${Math.floor(site.position.z/WILDS_EMISSION_REGION_SIZE)}`;
 if(regionId!==job.regionId)return fail("region_binding_invalid");
 const lotIds=site.contributedLots.map(lot=>lot.lotId).sort();
 if(!lotIds.length||lotIds.length>6||new Set(lotIds).size!==lotIds.length)return fail("lots_invalid");
 const lots=lotIds.map(id=>projection.materialLots[id]);
 if(lots.some(lot=>!lot||!verifyWildsMaterialLot(lot)
 ||projection.consumedMaterialLots[lot.lotId]||projection.storedMaterialLots[lot.lotId]||projection.reservedMaterialLots[lot.lotId]!==site.siteId))return fail("lots_unavailable");
 const kai=verifyKaiTemporalRoot(request.kai);
 const sourceWorkerId=`creature:${sha256PortableBasis(card.id).slice(0,32)}`,sourceWorkerHead=sha256PortableBasis(card.proof.digest),mandate=request.sourceMandate;
 if(!reverifyWildsCreatureMandate(mandate,{creatureHead:sourceWorkerHead,kaiUPulse:kai.uPulse,revokedMandateIds:request.revokedSourceMandateIds??[]}).ok
 ||mandate.creatureSubjectId!==sourceWorkerId||!mandate.professions.includes("build")||mandate.region.x!==Math.floor(site.position.x/WILDS_EMISSION_REGION_SIZE)
 ||mandate.region.z!==Math.floor(site.position.z/WILDS_EMISSION_REGION_SIZE)||mandate.maxActions<1)return fail("source_mandate_invalid");
 const completed=completeWildsConstructionSite({site,expectedSiteHead:site.head,lots,workerReceizId:binding.ownerReceizId,
 creature:{subjectId:sourceWorkerId,head:sourceWorkerHead},existingStructures:Object.values(projection.structures),kaiUPulse:kai.uPulse});
 const operation=createWildsStewardStructureOperation({structure:completed.structure,lots,ownerReceizId:completed.structure.ownerReceizId,actorReceizId:binding.ownerReceizId,playerHead:sha256PortableBasis(binding.ownerReceizId)});
 const settlement=settleWildsBuild({operation,currentEmission:wildsWorldSourceEmission(projection),actorId:binding.ownerReceizId});
 const command:BuildingSource["command"]={type:"construction.site.work",siteId:site.siteId,siteHead:site.head,actorPosition:{x:p.x,z:p.z},mandate,...settlement,
 cardProofDigest:card.proof.digest,kai,commandId:`crew:build:${sha256PortableBasis(job.head).slice(7)}`};
 const source:BuildingSource={...binding,command,regionId,lotHeads:lots.map(lot=>({lotId:lot.lotId,head:lot.head})),expectedSiteHead:completed.site.head,
 expectedStructure:{structureId:completed.structure.structureId,head:completed.structure.head},arrival:{position:p,spaceId:request.spaceId,kaiUPulse:kai.uPulse}};
 const commandDigest=await digestReceizCanonicalV122(source);
 return freeze({jobId:job.jobId,workerId:job.workerId,expectedJobHead:job.head,source,card,commandDigest,lotIds,
 authorizationCommand:{commandKind:WILDS_COMMAND_LAW[command.type],worldId:job.worldId,regionId,resourcePhiMicro:settlement.amountPhiMicro,geometryUnits:"1",commandDigest}});
}

type Journal=ReturnType<typeof createWildsCrewJournal>;
type Authorization=Awaited<ReturnType<typeof validateWildsCrewMandateCommand>>;
export type WildsCrewBuildingAdmission=Readonly<{projection:WildsWorldProjection}>;
function admitted(source:BuildingSource,projection:WildsWorldProjection){
 const command=source.command,receipt=projection.constitutionalCommandReceipts?.[command.commandId];
 if(!receipt||receipt.actorId!==source.ownerReceizId||receipt.type!==command.type||receipt.digest!==constitutionalDigest(command)||!receipt.eventIds.length||receipt.eventIds.length>256)return null;
 const site=projection.constructionSites[command.siteId],expected=source.expectedStructure;
 if(!site||!verifyWildsConstructionSite(site)||site.head!==source.expectedSiteHead||site.stage!=="complete"||!expected||!source.lotHeads?.length)return null;
 const structure=projection.structures[expected.structureId];
 if(!structure||!verifyWildsStructure(structure)||structure.head!==expected.head||site.terminalStructureId!==expected.structureId||site.terminalStructureHead!==expected.head)return null;
 if(!same([...structure.consumedLotIds].sort(),source.lotHeads.map(lot=>lot.lotId).sort()))return null;
 for(const lot of source.lotHeads){
 const index=structure.consumedLotIds.indexOf(lot.lotId);
 if(index<0||structure.consumedLotHeads[index]!==lot.head||projection.consumedMaterialLots[lot.lotId]!==structure.structureId||projection.reservedMaterialLots[lot.lotId])return null;
 }

 return {eventIds:receipt.eventIds,site};
}

/** Actual source-command transport, with the SAME durable journal/job-head fence used
 * for SDK transactions. authorize must freshly verify current126 proof objects,
 * exact consent and source-worker↔SDK-worker linkage using the mandate verifier.
 * admit must be the exact source queue port; it MUST invoke beforeAdmit after all
 * preparation awaits and before its first durable source write. Missing/ambiguous
 * completion is lookup-only; no retry may silently redispatch the source command. */
export function createWildsCrewBuilding(input:Readonly<{
  authorizeCapability(request:WildsCrewPreparedBuilding):Promise<WildsCrewMaterialCapabilityAuthorization>;
  journal:Journal;authorize(request:WildsCrewPreparedBuilding):Promise<Authorization>;
  admit(command:BuildingSource["command"],card:PortableCardAsset,beforeAdmit:(entry:WildsWorldOutboxEntry)=>Promise<void>):Promise<WildsCrewBuildingAdmission>;
  lookup(source:BuildingSource):Promise<WildsWorldProjection|null>;
  observeKaiUPulse:()=>number;
}>){
  return createWildsCrewSourceRuntime({...input,capability:"build",isSource:buildingSource,admitted,
    reservations:request=>[request.source.command.siteId,...request.lotIds],
    validate:request=>!(request.authorizationCommand.commandKind!==WILDS_COMMAND_LAW[request.source.command.type]||request.authorizationCommand.commandDigest!==request.commandDigest
          ||request.authorizationCommand.worldId!==request.source.worldId||request.authorizationCommand.regionId!==request.source.regionId
          ||request.authorizationCommand.resourcePhiMicro!==request.source.command.amountPhiMicro||request.authorizationCommand.geometryUnits!=="1"||!same(request.lotIds,request.source.lotHeads?.map(lot=>lot.lotId).sort()))});
}
