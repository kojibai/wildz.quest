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
import { isCanonicalWildsResourceSource, type WildsResourceSource } from "./wilds-resource-authority";
import { reverifyWildsCreatureMandate, type WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import { planWildsMaterialHarvest } from "./wilds-source-work-authority";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState, verifyWildsMaterialLot, type WildsMaterialLotV1 } from "./wilds-steward-construction";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type { WildsCrewNavigationPoint } from "./wilds-crew-navigation";

export type WildsCrewGatheringBinding=Omit<WildsCrewStoredSourceCommand,"command"|"expectedLotId"|"arrival"|"lotHeads"|"expectedSiteHead"|"expectedStructure">;
export type WildsCrewPreparedGathering=Readonly<{
  jobId:string;workerId:string;expectedJobHead:string;commandDigest:string;
  source:WildsCrewStoredSourceCommand;card:PortableCardAsset;authorizationCommand:WildsCrewCommand;
  /** An expected successor identity only. Inventory changes exclusively on admission. */
  expectedLotId:string;
}>;
const gatheringSource=(value:WildsCrewAnyStoredSourceCommand|undefined):value is WildsCrewStoredSourceCommand=>value?.command.type==="resource.material.harvest";
const fail=(code:string):never=>{throw new Error(`crew_gather_${code}`);};
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
function freeze<T>(value:T):T{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

/** Prepares the existing resource.material.harvest / commons.harvest transition.
 * A source worker coordinate and a current SDK subject coordinate are DISTINCT: only
 * the production authorization port may establish their exact proof-object linkage.
 * No generic world registry, SDK execution receipt or inventory successor is invented. */
export async function prepareWildsCrewGathering(input:Readonly<{
  job:WildsCrewJob;binding:WildsCrewGatheringBinding;card:PortableCardAsset;condition:AdventureCardCondition;
  source:WildsResourceSource;sourceHead:string;projection:WildsWorldProjection;
  actualWorkerPosition:Readonly<WildsCrewNavigationPoint>;spaceId:string;kai:KaiTemporalRoot;
  sourceMandate:WildsCreatureMandateV1;revokedSourceMandateIds?:readonly string[];
}>):Promise<WildsCrewPreparedGathering>{
  const request=structuredClone(input),{job,binding,card,source,condition}=request;
  const {head,...body}=job;
  if(await digestReceizCanonicalV122(body)!==head||job.kind!=="gather"||job.phase!=="working"||job.recallRequested||job.pending||job.committedWorldEventIds.length)return fail("job_not_working");
  if(binding.assetId!==job.assetId||card.id!==job.assetId||!verifyAnyWildsCard(card).ok||binding.cardProofDigest!==card.proof.digest
    ||!sameWildzPlayerCoordinate(card.manifest.ownerReceizId,binding.ownerReceizId)
    ||binding.ownerSubjectId!==job.ownerSubjectId||binding.workerSubjectId!==job.workerId||binding.worldId!==job.worldId
    ||binding.ownerHead!==job.expectedOwnerSubjectHead||binding.workerHead!==job.expectedWorkerSubjectHead
    ||binding.ownerProofDigest!==job.ownerProofDigest||binding.workerProofDigest!==job.workerProofDigest||binding.mandateDigest!==job.mandateDigest)return fail("binding_invalid");
  const disposition=prepareWildsCrewDisposition(card);
  if(!disposition||condition.assetId!==card.id||!canWildsCrewTravel(condition)||condition.fatigue>=disposition.restAtFatigue)return fail("condition_unwilling");
  if(!isCanonicalWildsResourceSource(source)||!disposition.workFamilies.includes(source.requirements.creature)||!["hay","timber","stone"].includes(source.kind))return fail("source_unqualified");
  const p=request.actualWorkerPosition;
  if(request.spaceId!=="wildz.space.outer.v1"||![p.x,p.y,p.z].every(Number.isFinite)
    ||Math.hypot(p.x-source.position.x,p.y-source.position.y,p.z-source.position.z)>5.5
    ||Math.hypot(job.target.x-source.position.x,job.target.y-source.position.y,job.target.z-source.position.z)>5.5)return fail("physical_arrival_required");
  const kai=verifyKaiTemporalRoot(request.kai),current=request.projection.harvestedSources[source.sourceId]??initialWildsHarvestedSourceState(source);
  if(request.projection.worldId!==job.worldId||current.head!==request.sourceHead)return fail("source_head_stale");
  // These are the CURRENT source reducer's established coordinates, not aliases for
  // the SDK subject/head in binding. Both are retained and separately authorized.
  const sourceWorkerId=`creature:${sha256PortableBasis(card.id).slice(0,32)}`,sourceWorkerHead=sha256PortableBasis(card.proof.digest);
  const mandate=request.sourceMandate;
  if(!reverifyWildsCreatureMandate(mandate,{creatureHead:sourceWorkerHead,kaiUPulse:kai.uPulse,revokedMandateIds:request.revokedSourceMandateIds??[]}).ok
    ||mandate.creatureSubjectId!==sourceWorkerId||!mandate.professions.includes(source.requirements.creature)||!mandate.allowedResourceIds.includes(source.sourceId)
    ||mandate.region.x!==source.regionX||mandate.region.z!==source.regionZ||mandate.maxActions<1)return fail("source_mandate_invalid");
  const commandId=`crew:harvest:${sha256PortableBasis(job.head).slice(7)}`;
  // An independently travelling worker cannot borrow a tool still equipped by its
  // distant owner. This planning view selects the creature's own current capability.
  const workerProjection={...request.projection,equippedStewardTools:{...request.projection.equippedStewardTools,[binding.ownerReceizId]:""}};
  const command=planWildsMaterialHarvest({projection:workerProjection,source,actorId:binding.ownerReceizId,actorPosition:{x:p.x,z:p.z},kaiUPulse:kai.uPulse,commandId,card,mandate,kai});
  if(command.operation?.intention.regionId!==job.regionId)return fail("region_binding_invalid");
  const tool=command.toolId?request.projection.stewardTools[command.toolId]:null;
  const expected=createWildsMaterialHarvest({source,current,ownerReceizId:binding.ownerReceizId,actorPosition:command.actorPosition,
    creature:{subjectId:sourceWorkerId,head:sourceWorkerHead,workFamilies:disposition.workFamilies,willing:true},tool,kaiUPulse:kai.uPulse});
  const storedSource={...binding,command,expectedLotId:expected.lot.lotId,arrival:{position:p,spaceId:request.spaceId,kaiUPulse:kai.uPulse}};const commandDigest=await digestReceizCanonicalV122(storedSource);
  return freeze({jobId:job.jobId,workerId:job.workerId,expectedJobHead:job.head,source:storedSource,card,commandDigest,expectedLotId:expected.lot.lotId,
    authorizationCommand:{commandKind:"commons.harvest",worldId:job.worldId,regionId:job.regionId,resourcePhiMicro:"0",geometryUnits:"0",commandDigest}});
}

type Journal=ReturnType<typeof createWildsCrewJournal>;
type Authorization=Awaited<ReturnType<typeof validateWildsCrewMandateCommand>>;
export type WildsCrewGatherAdmission=Readonly<{projection:WildsWorldProjection}>;
function admitted(source:WildsCrewStoredSourceCommand,projection:WildsWorldProjection,expectedLotId?:string):Readonly<{eventIds:readonly string[];lot:WildsMaterialLotV1}>|null{
  const command=source.command,receipt=projection.constitutionalCommandReceipts?.[command.commandId];
  if(!receipt||receipt.actorId!==source.ownerReceizId||receipt.type!==command.type||receipt.digest!==constitutionalDigest(command)||!receipt.eventIds.length||receipt.eventIds.length>256)return null;
  const outputHead=command.operation?.intention.outputLotHead;
  const lotId=expectedLotId??source.expectedLotId;
  const lot=lotId?projection.materialLots[lotId]:undefined;
  if(!lot||!verifyWildsMaterialLot(lot)||lot.head!==outputHead||lot.ownerReceizId!==source.ownerReceizId||lot.source.sourceId!==command.source.sourceId
    ||lot.source.sourceHead!==command.sourceHead||lot.contributors.creatureSubjectId!==command.mandate?.creatureSubjectId||lot.contributors.creatureHead!==command.mandate?.creatureHead)return null;
  return {eventIds:receipt.eventIds,lot};
}

/** Actual source-command transport, with the SAME durable journal/job-head fence used
 * for SDK transactions. authorize must freshly verify current126 proof objects,
 * exact consent and source-worker↔SDK-worker linkage using the mandate verifier.
 * admit must be the exact source queue port; it MUST invoke beforeAdmit after all
 * preparation awaits and before its first durable source write. Missing/ambiguous
 * completion is lookup-only; no retry may silently redispatch the source command. */
export function createWildsCrewGathering(input:Readonly<{
  journal:Journal;authorize(request:WildsCrewPreparedGathering):Promise<Authorization>;
  admit(command:WildsCrewStoredSourceCommand["command"],card:PortableCardAsset,beforeAdmit:(entry:WildsWorldOutboxEntry)=>Promise<void>):Promise<WildsCrewGatherAdmission>;
  lookup(source:WildsCrewStoredSourceCommand):Promise<WildsWorldProjection|null>;
  observeKaiUPulse:()=>number;
}>){
  const pending=(code:string)=>({ok:false as const,code,writes:"unknown" as const,recoveryRequired:true as const});
  const authorized=async(request:WildsCrewPreparedGathering)=>{
    const result=await input.authorize(request);
    return result.ok&&result.commandDigest===request.commandDigest&&result.mandateDigest===request.source.mandateDigest
      &&result.ownerHead===request.source.ownerHead&&result.workerHead===request.source.workerHead
      &&result.worldId===request.source.worldId&&result.regionId===request.authorizationCommand.regionId;
  };
  const settle=async(commandDigest:string,projection:WildsWorldProjection,expectedLotId?:string)=>{
    const stored=await input.journal.command(commandDigest);if(!stored||!gatheringSource(stored.sourceCommand))return pending("crew_gather_recovery_command_missing");
    const result=admitted(stored.sourceCommand,projection,expectedLotId);if(!result)return pending("crew_gather_admission_unverified");
    if(stored.phase==="admitted"){
      const event=await input.journal.readEvent(stored.head);if(!event||!same(event.admittedWorldEventIds,result.eventIds))return pending("crew_gather_recovery_conflict");
    }else{
      if(stored.phase!=="pending")return pending("crew_gather_recovery_conflict");
      await input.journal.append({workerId:stored.workerId,jobId:stored.jobId,commandDigest,expectedWorkerHead:stored.head,
        lotIds:stored.lotIds,phase:"admitted",admittedWorldEventIds:result.eventIds,observedKaiUPulse:input.observeKaiUPulse()});
    }
    return {ok:true as const,projection,lot:result.lot,eventIds:result.eventIds};
  };
  return Object.freeze({
    async execute(value:WildsCrewPreparedGathering,expectedWorkerHead:string|null){
      const request=freeze(structuredClone(value));let dispatchIntent=false;
      try{
        if(request.source.ownerSubjectId!==input.journal.ownerSubjectId||await digestReceizCanonicalV122(request.source)!==request.commandDigest
          ||request.authorizationCommand.commandKind!=="commons.harvest"||request.authorizationCommand.commandDigest!==request.commandDigest
          ||request.authorizationCommand.worldId!==request.source.worldId||request.authorizationCommand.regionId!==request.source.command.operation?.intention.regionId
          ||request.authorizationCommand.resourcePhiMicro!=="0"||request.authorizationCommand.geometryUnits!=="0"||request.expectedLotId!==request.source.expectedLotId)return {ok:false as const,code:"crew_gather_request_invalid",writes:0 as const};
        if(await input.journal.command(request.commandDigest))return pending("crew_gather_exact_recovery_required");
        if(!await authorized(request))return {ok:false as const,code:"crew_gather_authority_unavailable",writes:0 as const};
        const proposed=await input.journal.append({workerId:request.workerId,jobId:request.jobId,commandDigest:request.commandDigest,expectedWorkerHead,
          expectedJobHead:request.expectedJobHead,sourceCommand:request.source,lotIds:[request.source.command.source.sourceId],phase:"proposed",observedKaiUPulse:input.observeKaiUPulse()});
        if(proposed.replay)return pending("crew_gather_exact_recovery_required");
        const result=await input.admit(request.source.command,request.card,async entry=>{
          if((entry.crewCommandDigest!==undefined&&entry.crewCommandDigest!==constitutionalDigest(request.source.command))||entry.actorId!==request.source.ownerReceizId||!same(entry.command,request.source.command)||!same(entry.card,request.card))return fail("source_command_changed");
          if(!await authorized(request))return fail("authority_unavailable");
          const committed=await input.journal.append({workerId:request.workerId,jobId:request.jobId,commandDigest:request.commandDigest,expectedWorkerHead:proposed.event.eventId,
            expectedJobHead:request.expectedJobHead,lotIds:[request.source.command.source.sourceId],phase:"pending",observedKaiUPulse:input.observeKaiUPulse()});
          if(committed.replay)return fail("exact_recovery_required");dispatchIntent=true;
        });
        // A previously admitted exact source receipt can be looked up, but a port that
        // skipped the fence may not use this call to manufacture journal completion.
        if(!dispatchIntent)return pending("crew_gather_dispatch_fence_not_observed");
        return await settle(request.commandDigest,result.projection,request.expectedLotId);
      }catch{
        if(dispatchIntent)return pending("crew_gather_exact_recovery_required");
        try{
          await input.journal.cancelProposed(request.commandDigest,input.observeKaiUPulse());
          const stored=await input.journal.command(request.commandDigest);
          if(!stored||stored.phase==="rejected")return {ok:false as const,code:"crew_gather_pre_dispatch_rejected",writes:0 as const};
        }catch{/* Retain reservations/history for exact lookup on local storage failures. */}
        return pending("crew_gather_exact_recovery_required");
      }
    },
    async recover(commandDigest:string){
      try{
        const stored=await input.journal.command(commandDigest);if(!stored||!gatheringSource(stored.sourceCommand))return pending("crew_gather_recovery_command_missing");
        if(stored.phase==="rejected")return {ok:false as const,code:"crew_gather_cancelled",writes:0 as const};
        const projection=await input.lookup(stored.sourceCommand);if(!projection)return pending("crew_gather_admission_unavailable");
        return await settle(commandDigest,projection);
      }catch{return pending("crew_gather_exact_recovery_required");}
    }
  });
}
