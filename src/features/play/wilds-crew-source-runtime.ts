import { constitutionalDigest } from "./wilds-constitution";
import { digestReceizCanonicalV122 } from "@receiz/sdk";
import { createWildsCrewJournal, type WildsCrewStoredCommand, type WildsCrewAnyStoredSourceCommand } from "./wilds-crew-journal";
import type { validateWildsCrewMandateCommand, WildsCrewCommand } from "../../lib/receiz/wilds-crew-mandate";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type {WildsMaterialAdmissionFence} from "./wilds-material-edge-admission";
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
 admit(command:Source["command"],card:PortableCardAsset,beforeAdmit:WildsMaterialAdmissionFence):Promise<{projection:WildsWorldProjection}>;
 lookup(source:Source):Promise<WildsWorldProjection|null>;observeKaiUPulse:()=>number;
 authorizeCapability(request:Request):Promise<WildsCrewMaterialCapabilityAuthorization>;capability:"haul"|"build";
 restoreRequest(stored:WildsCrewStoredCommand & {sourceCommand:Source},card:PortableCardAsset):Request;
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
  const matchesEntry=(source:Source,card:PortableCardAsset,entry:WildsWorldOutboxEntry)=>
    (entry.crewCommandDigest===undefined||entry.crewCommandDigest===constitutionalDigest(source.command))
    &&entry.actorId===source.ownerReceizId&&same(entry.command,source.command)&&same(entry.card,card);
  const pendingRequest=async(entry:WildsWorldOutboxEntry,expectedDigest?:string)=>{
    if(entry.command.type!=="construction.site.work"&&entry.command.type!=="construction.site.contribute")return fail("source_command_changed");
    const reservation=await input.journal.reservation(entry.command.siteId);
    if(!reservation||(expectedDigest!==undefined&&reservation.commandDigest!==expectedDigest))return fail("source_command_changed");
    const stored=await input.journal.recheckPendingSource(reservation.commandDigest);
    if(!input.isSource(stored.sourceCommand)||!entry.card||!verifyAnyWildsCard(entry.card).ok
      ||entry.card.id!==stored.sourceCommand.assetId||entry.card.proof.digest!==stored.sourceCommand.cardProofDigest
      ||!matchesEntry(stored.sourceCommand,entry.card,entry))return fail("source_command_changed");
    const request=freeze(input.restoreRequest({...stored,sourceCommand:stored.sourceCommand},structuredClone(entry.card)));
    if(request.jobId!==stored.jobId||request.workerId!==stored.workerId||request.expectedJobHead!==stored.expectedJobHead
      ||request.commandDigest!==stored.commandDigest||!same(request.source,stored.sourceCommand)
      ||!same(input.reservations(request),stored.lotIds)||!input.validate(request))return fail("source_command_changed");
    return request;
  };
  const authorizePending=async(entry:WildsWorldOutboxEntry)=>{
    const request=await pendingRequest(entry);
    if(!await authorized(request))return fail("authority_unavailable");
    // Authorization awaits may observe a recall, restore or competing tab.
    await input.journal.recheckPendingSource(request.commandDigest);
  };
  const authorizeExactPending=(request:Request)=>async(actual:WildsWorldOutboxEntry)=>{
    if(!matchesEntry(request.source,request.card,actual))return fail("source_command_changed");
    await authorizePending(actual);
  };
  return Object.freeze({
    /** Explicit live retry fence for a SAVED outbox entry, never a new intent's
     * captured context. Native acceptance is still supplied exclusively by admit. */
    authorizePending:Object.assign((entry:WildsWorldOutboxEntry)=>authorizePending(entry),{beforeApply:authorizePending}),
    async execute(value:Request,expectedWorkerHead:string|null){
      const request=freeze(structuredClone(value));let dispatchIntent=false;
      try{
        if(request.source.ownerSubjectId!==input.journal.ownerSubjectId||await digestReceizCanonicalV122(request.source)!==request.commandDigest||!input.validate(request))return {ok:false as const,code:"crew_source_request_invalid",writes:0 as const};
        if(await input.journal.command(request.commandDigest))return pending("crew_source_exact_recovery_required");
        if(!await authorized(request))return {ok:false as const,code:"crew_source_authority_unavailable",writes:0 as const};
        const proposed=await input.journal.append({workerId:request.workerId,jobId:request.jobId,commandDigest:request.commandDigest,expectedWorkerHead,
          expectedJobHead:request.expectedJobHead,sourceCommand:request.source,lotIds:input.reservations(request),phase:"proposed",observedKaiUPulse:input.observeKaiUPulse()});
        if(proposed.replay)return pending("crew_source_exact_recovery_required");
        const result=await input.admit(request.source.command,request.card,Object.assign(async (entry:WildsWorldOutboxEntry)=>{
          if(!matchesEntry(request.source,request.card,entry))return fail("source_command_changed");
          if((await input.journal.command(request.commandDigest))?.phase==="pending"){
            await authorizePending(entry);dispatchIntent=true;return;
          }
          if(!await authorized(request))return fail("authority_unavailable");
          const committed=await input.journal.append({workerId:request.workerId,jobId:request.jobId,commandDigest:request.commandDigest,expectedWorkerHead:proposed.event.eventId,
            expectedJobHead:request.expectedJobHead,lotIds:input.reservations(request),phase:"pending",observedKaiUPulse:input.observeKaiUPulse()});
          if(committed.replay)return fail("exact_recovery_required");dispatchIntent=true;
        },{beforeApply:authorizeExactPending(request)}));
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
    /** Default remains lookup-only. Supplying the exact saved entry explicitly
     * resumes publication through admit and its live fence, without redispatch. */
    async recover(commandDigest:string,savedEntry?:WildsWorldOutboxEntry){
      try{
        const stored=await input.journal.command(commandDigest);if(!stored||!input.isSource(stored.sourceCommand))return pending("crew_source_recovery_command_missing");
        if(stored.phase==="rejected")return {ok:false as const,code:"crew_source_cancelled",writes:0 as const};
        let projection=await input.lookup(stored.sourceCommand);
        if(!projection&&savedEntry){
          const entry=freeze(structuredClone(savedEntry));
          const request=await pendingRequest(entry,commandDigest);
          let fenced=false;
          const result=await input.admit(request.source.command,request.card,Object.assign(async (actual:WildsWorldOutboxEntry)=>{
            if(!matchesEntry(request.source,request.card,actual))return fail("source_command_changed");
            await authorizePending(actual);fenced=true;
          },{beforeApply:authorizeExactPending(request)}));
          // admit may find exact native acceptance after lookup, without a new
          // publication. Recheck live authority even in that race; the existing
          // pending receipt is the dispatch, never a second scheduling event.
          if(!fenced)await authorizePending(entry);
          projection=result.projection;
        }
        if(!projection)return pending("crew_source_admission_unavailable");
        return await settle(commandDigest,projection);
      }catch{return pending("crew_source_exact_recovery_required");}
    }
  });
}
