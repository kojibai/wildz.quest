import { createWildsCrewSourceRuntime, type WildsCrewMaterialCapabilityAuthorization } from "./wilds-crew-source-runtime";
import { WILDS_COMMAND_LAW } from "./wilds-world-constitution";
import { contributeWildsConstructionSite, verifyWildsConstructionSite } from "./wilds-construction-site";
import { wildsMaterialCustodian } from "./wilds-world-state";
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
import { verifyWildsMaterialLot } from "./wilds-steward-construction";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type { WildsCrewNavigationPoint } from "./wilds-crew-navigation";

type DeliverySource=WildsCrewStoredSourceCommand<Extract<WildsWorldCommand,{type:"construction.site.contribute"}>>;
export type WildsCrewDeliveryBinding=Omit<DeliverySource,"command"|"expectedLotId"|"arrival"|"lotHeads"|"expectedSiteHead"|"expectedStructure"|"regionId">;
export type WildsCrewPreparedDelivery=Readonly<{
  jobId:string;workerId:string;expectedJobHead:string;commandDigest:string;
  source:DeliverySource;card:PortableCardAsset;authorizationCommand:WildsCrewCommand;
  /** An expected successor identity only. Inventory changes exclusively on admission. */
  lotIds:readonly string[];
}>;
const deliverySource=(value:WildsCrewAnyStoredSourceCommand|undefined):value is DeliverySource=>value?.command.type==="construction.site.contribute";
const fail=(code:string):never=>{throw new Error(`crew_delivery_${code}`);};
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
function freeze<T>(value:T):T{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

/** Prepares actual owner-held material reservation at an existing site. This does
 * not invent worker cargo custody; only source admission changes reservation. */
export async function prepareWildsCrewDelivery(input:Readonly<{
 job:WildsCrewJob;binding:WildsCrewDeliveryBinding;card:PortableCardAsset;condition:AdventureCardCondition;
 siteId:string;siteHead:string;lotIds:readonly string[];projection:WildsWorldProjection;
 actualWorkerPosition:Readonly<WildsCrewNavigationPoint>;spaceId:string;kai:KaiTemporalRoot;
}>):Promise<WildsCrewPreparedDelivery>{
 const request=structuredClone(input),{job,binding,card,condition,projection}=request;
 const {head,...body}=job;
 if(await digestReceizCanonicalV122(body)!==head||job.kind!=="deliver"||job.phase!=="working"||job.recallRequested||job.pending||job.committedWorldEventIds.length) return fail("job_not_working");
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
 const lotIds=[...request.lotIds].sort();
 if(!lotIds.length||lotIds.length>6||new Set(lotIds).size!==lotIds.length)return fail("lots_invalid");
 const lots=lotIds.map(id=>projection.materialLots[id]);
 if(lots.some(lot=>!lot||!verifyWildsMaterialLot(lot)||wildsMaterialCustodian(projection,lot)!==binding.ownerReceizId
 ||projection.consumedMaterialLots[lot.lotId]||projection.storedMaterialLots[lot.lotId]||projection.reservedMaterialLots[lot.lotId]))return fail("lots_unavailable");
 const kai=verifyKaiTemporalRoot(request.kai);
 const next=contributeWildsConstructionSite({site,expectedSiteHead:site.head,contributorReceizId:binding.ownerReceizId,lots,
 lotCustodians:Object.fromEntries(lots.map(lot=>[lot.lotId,wildsMaterialCustodian(projection,lot)])),kaiUPulse:kai.uPulse});
 const command:DeliverySource["command"]={type:"construction.site.contribute",siteId:site.siteId,siteHead:site.head,lotIds,actorPosition:{x:p.x,z:p.z},
 cardProofDigest:card.proof.digest,kai,commandId:`crew:deliver:${sha256PortableBasis(job.head).slice(7)}`};
 const source:DeliverySource={...binding,command,regionId,lotHeads:lots.map(lot=>({lotId:lot.lotId,head:lot.head})),expectedSiteHead:next.head,arrival:{position:p,spaceId:request.spaceId,kaiUPulse:kai.uPulse}};
 const commandDigest=await digestReceizCanonicalV122(source);
 return freeze({jobId:job.jobId,workerId:job.workerId,expectedJobHead:job.head,source,card,commandDigest,lotIds,
 authorizationCommand:{commandKind:WILDS_COMMAND_LAW[command.type],worldId:job.worldId,regionId,resourcePhiMicro:"0",geometryUnits:"0",commandDigest}});
}

type Journal=ReturnType<typeof createWildsCrewJournal>;
type Authorization=Awaited<ReturnType<typeof validateWildsCrewMandateCommand>>;
export type WildsCrewDeliveryAdmission=Readonly<{projection:WildsWorldProjection}>;
function admitted(source:DeliverySource,projection:WildsWorldProjection){
 const command=source.command,receipt=projection.constitutionalCommandReceipts?.[command.commandId];
 if(!receipt||receipt.actorId!==source.ownerReceizId||receipt.type!==command.type||receipt.digest!==constitutionalDigest(command)||!receipt.eventIds.length||receipt.eventIds.length>256)return null;
 const site=projection.constructionSites[command.siteId];
 if(!site||!verifyWildsConstructionSite(site)||!source.lotHeads?.length)return null;
 for(const expected of source.lotHeads){
 const lot=projection.materialLots[expected.lotId],contribution=site.contributedLots.find(value=>value.lotId===expected.lotId);
 if(!lot||!verifyWildsMaterialLot(lot)||lot.head!==expected.head||!contribution||contribution.lotHead!==expected.head
 ||contribution.ownerReceizId!==source.ownerReceizId||contribution.contributedAtKaiUPulse!==command.kai?.uPulse)return null;
 }
 return {eventIds:receipt.eventIds,site};
}

/** Actual source-command transport, with the SAME durable journal/job-head fence used
 * for SDK transactions. authorize must freshly verify current126 proof objects,
 * exact consent and source-worker↔SDK-worker linkage using the mandate verifier.
 * admit must be the exact source queue port; it MUST invoke beforeAdmit after all
 * preparation awaits and before its first durable source write. Missing/ambiguous
 * completion is lookup-only; no retry may silently redispatch the source command. */
export function createWildsCrewDelivery(input:Readonly<{
  authorizeCapability(request:WildsCrewPreparedDelivery):Promise<WildsCrewMaterialCapabilityAuthorization>;
  journal:Journal;authorize(request:WildsCrewPreparedDelivery):Promise<Authorization>;
  admit(command:DeliverySource["command"],card:PortableCardAsset,beforeAdmit:(entry:WildsWorldOutboxEntry)=>Promise<void>):Promise<WildsCrewDeliveryAdmission>;
  lookup(source:DeliverySource):Promise<WildsWorldProjection|null>;
  observeKaiUPulse:()=>number;
}>){
  return createWildsCrewSourceRuntime({...input,capability:"haul",isSource:deliverySource,admitted,
    reservations:request=>[request.source.command.siteId,...request.lotIds],
    validate:request=>!(request.authorizationCommand.commandKind!==WILDS_COMMAND_LAW[request.source.command.type]||request.authorizationCommand.commandDigest!==request.commandDigest
          ||request.authorizationCommand.worldId!==request.source.worldId||request.authorizationCommand.regionId!==request.source.regionId
          ||request.authorizationCommand.resourcePhiMicro!=="0"||request.authorizationCommand.geometryUnits!=="0"||!same(request.lotIds,request.source.command.lotIds))});
}
