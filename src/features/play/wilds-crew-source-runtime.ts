import { constitutionalDigest } from "./wilds-constitution";
import { digestReceizCanonicalV122 } from "@receiz/sdk";
import { createWildsCrewJournal, type WildsCrewAnyStoredSourceCommand } from "./wilds-crew-journal";
import type { validateWildsCrewMandateCommand, WildsCrewCommand } from "../../lib/receiz/wilds-crew-mandate";
import { canonicalPortableCardJson, type PortableCardAsset } from "./portable-card";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldOutboxEntry } from "./wilds-world-outbox";
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
const fail=(code:string):never=>{throw new Error(`crew_source_${code}`);};
function freeze<T>(value:T):T{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
/** Supplied only by a verifier of an established card/subject capability source.
 * Current cards have no canonical haul/build mapping, so production must fail closed. */
export type WildsCrewMaterialCapabilityAuthorization=Readonly<{ok:false}>|Readonly<{ok:true;commandDigest:string;workerSubjectId:string;workerHead:string;cardProofDigest:string;capability:"haul"|"build";maximumMaterialLots:number}>;
/** One exact source admission fence for delivery and building. Domain planners must
 * bind their budgets and verify actual admitted effects. No retry redispatches. */
export function createWildsCrewSourceRuntime<Source extends WildsCrewAnyStoredSourceCommand,Request extends {jobId:string;workerId:string;expectedJobHead:string;commandDigest:string;source:Source;card:PortableCardAsset;authorizationCommand:WildsCrewCommand},Outcome extends {eventIds:readonly string[]}>(input:Readonly<{
 journal:ReturnType<typeof createWildsCrewJournal>;authorize(request:Request):Promise<Awaited<ReturnType<typeof validateWildsCrewMandateCommand>>>;
 admit(command:Source["command"],card:PortableCardAsset,beforeAdmit:(entry:WildsWorldOutboxEntry)=>Promise<void>):Promise<{projection:WildsWorldProjection}>;
 lookup(source:Source):Promise<WildsWorldProjection|null>;observeKaiUPulse:()=>number;
 authorizeCapability(request:Request):Promise<WildsCrewMaterialCapabilityAuthorization>;capability:"haul"|"build";
 isSource(source:WildsCrewAnyStoredSourceCommand|undefined):source is Source;
 admitted(source:Source,projection:WildsWorldProjection):Outcome|null;validate(request:Request):boolean;reservations(request:Request):readonly string[];
}>){
  const pending=(code:string)=>({ok:false as const,code,writes:"unknown" as const,recoveryRequired:true as const});
  const authorized=async(request:Request)=>{
    const capability=await input.authorizeCapability(request);
    if(!capability.ok||capability.commandDigest!==request.commandDigest||capability.workerSubjectId!==request.source.workerSubjectId
      ||capability.workerHead!==request.source.workerHead||capability.cardProofDigest!==request.source.cardProofDigest
      ||capability.capability!==input.capability||!Number.isSafeInteger(capability.maximumMaterialLots)
      ||capability.maximumMaterialLots<(request.source.lotHeads?.length??1)||capability.maximumMaterialLots>64)return false;
    const result=await input.authorize(request);
    return result.ok&&result.commandDigest===request.commandDigest&&result.mandateDigest===request.source.mandateDigest
      &&result.ownerHead===request.source.ownerHead&&result.workerHead===request.source.workerHead
      &&result.worldId===request.source.worldId&&result.regionId===request.authorizationCommand.regionId;
  };
  const settle=async(commandDigest:string,projection:WildsWorldProjection)=>{
    const stored=await input.journal.command(commandDigest);if(!stored||!input.isSource(stored.sourceCommand))return pending("crew_source_recovery_command_missing");
    const result=input.admitted(stored.sourceCommand,projection);if(!result)return pending("crew_source_admission_unverified");
    if(stored.phase==="admitted"){
      const event=await input.journal.readEvent(stored.head);if(!event||!same(event.admittedWorldEventIds,result.eventIds))return pending("crew_source_recovery_conflict");
    }else{
      if(stored.phase!=="pending")return pending("crew_source_recovery_conflict");
      await input.journal.append({workerId:stored.workerId,jobId:stored.jobId,commandDigest,expectedWorkerHead:stored.head,
        lotIds:stored.lotIds,phase:"admitted",admittedWorldEventIds:result.eventIds,observedKaiUPulse:input.observeKaiUPulse()});
    }
    return {ok:true as const,projection,...result};
  };
  return Object.freeze({
    async execute(value:Request,expectedWorkerHead:string|null){
      const request=freeze(structuredClone(value));let dispatchIntent=false;
      try{
        if(request.source.ownerSubjectId!==input.journal.ownerSubjectId||await digestReceizCanonicalV122(request.source)!==request.commandDigest||!input.validate(request))return {ok:false as const,code:"crew_source_request_invalid",writes:0 as const};
        if(await input.journal.command(request.commandDigest))return pending("crew_source_exact_recovery_required");
        if(!await authorized(request))return {ok:false as const,code:"crew_source_authority_unavailable",writes:0 as const};
        const proposed=await input.journal.append({workerId:request.workerId,jobId:request.jobId,commandDigest:request.commandDigest,expectedWorkerHead,
          expectedJobHead:request.expectedJobHead,sourceCommand:request.source,lotIds:input.reservations(request),phase:"proposed",observedKaiUPulse:input.observeKaiUPulse()});
        if(proposed.replay)return pending("crew_source_exact_recovery_required");
        const result=await input.admit(request.source.command,request.card,async entry=>{
          if((entry.crewCommandDigest!==undefined&&entry.crewCommandDigest!==constitutionalDigest(request.source.command))||entry.actorId!==request.source.ownerReceizId||!same(entry.command,request.source.command)||!same(entry.card,request.card))return fail("source_command_changed");
          if(!await authorized(request))return fail("authority_unavailable");
          const committed=await input.journal.append({workerId:request.workerId,jobId:request.jobId,commandDigest:request.commandDigest,expectedWorkerHead:proposed.event.eventId,
            expectedJobHead:request.expectedJobHead,lotIds:input.reservations(request),phase:"pending",observedKaiUPulse:input.observeKaiUPulse()});
          if(committed.replay)return fail("exact_recovery_required");dispatchIntent=true;
        });
        // A previously admitted exact source receipt can be looked up, but a port that
        // skipped the fence may not use this call to manufacture journal completion.
        if(!dispatchIntent)return pending("crew_source_dispatch_fence_not_observed");
        return await settle(request.commandDigest,result.projection);
      }catch{
        if(dispatchIntent)return pending("crew_source_exact_recovery_required");
        try{
          await input.journal.cancelProposed(request.commandDigest,input.observeKaiUPulse());
          const stored=await input.journal.command(request.commandDigest);
          if(!stored||stored.phase==="rejected")return {ok:false as const,code:"crew_source_pre_dispatch_rejected",writes:0 as const};
        }catch{/* Retain reservations/history for exact lookup on local storage failures. */}
        return pending("crew_source_exact_recovery_required");
      }
    },
    async recover(commandDigest:string){
      try{
        const stored=await input.journal.command(commandDigest);if(!stored||!input.isSource(stored.sourceCommand))return pending("crew_source_recovery_command_missing");
        if(stored.phase==="rejected")return {ok:false as const,code:"crew_source_cancelled",writes:0 as const};
        const projection=await input.lookup(stored.sourceCommand);if(!projection)return pending("crew_source_admission_unavailable");
        return await settle(commandDigest,projection);
      }catch{return pending("crew_source_exact_recovery_required");}
    }
  });
}
