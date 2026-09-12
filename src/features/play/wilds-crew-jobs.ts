import { canonicalizeReceizV122, digestReceizCanonicalV122 } from "@receiz/sdk";
import { createWildzContinuityDatabase, type WildzContinuityDatabase } from "../../lib/storage/wildz-indexed-db";
import { verifyWildsCrewCausalEvent, type WildsCrewCausalEvent } from "./wilds-crew-causality";
import type { WildsCrewStoredCommand } from "./wilds-crew-journal";

export type WildsCrewJobKind = "gather" | "deliver" | "build" | "explore" | "recall";
export type WildsCrewJobPhase = "assigned" | "travelling" | "working" | "pending" | "returning" | "completed" | "blocked" | "cancelled";
export type WildsCrewJobPosition = Readonly<{x:number;y:number;z:number}>;
export type WildsCrewJobAssignment = Readonly<{
  jobId:string;workerId:string;assetId:string;ownerProofDigest:string;workerProofDigest:string;
  genomeProofDigest:string;mandateDigest:string;worldId:string;regionId:string;kind:WildsCrewJobKind;
  target:WildsCrewJobPosition;home:WildsCrewJobPosition;observedKaiUPulse:number;
  dependencyJobIds?:readonly string[];
}>;
export type WildsCrewJob = WildsCrewJobAssignment & Readonly<{
  schema:"wildz.crew.job.v1";ownerSubjectId:string;head:string;previousHead:string|null;revision:number;
  causalKaiUPulse:number;phase:WildsCrewJobPhase;recallRequested:boolean;blocker:string|null;
  pending:Readonly<{commandDigest:string;eventId:string;lotIds:readonly string[]}>|null;
  /** Exact admitted citations only, never inferred inventory or fabricated cargo. */
  committedWorldEventIds:readonly string[];lastObservationId:string|null;lastCommandEventId:string|null;
}>;
export type WildsCrewJobAction =
  | Readonly<{type:"depart"|"recall"|"cancel"|"return"|"resume"}>
  | Readonly<{type:"arrive";observationId:string;position:WildsCrewJobPosition}>
  | Readonly<{type:"block";reason:string}>
  | Readonly<{type:"command-pending"|"command-resolved";eventId:string}>;
export type WildsCrewJobTransition = Readonly<{jobId:string;expectedHead:string;requestId:string;observedKaiUPulse:number;action:WildsCrewJobAction}>;
type Evidence = Readonly<{event:WildsCrewCausalEvent;command:WildsCrewStoredCommand}>;
const id=(s:string)=>typeof s==="string"&&s.length>0&&s.length<=512;
const pulse=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const position=(p:WildsCrewJobPosition)=>!!p&&[p.x,p.y,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e9);
const terminal=(job:WildsCrewJob)=>job.phase==="completed"||job.phase==="cancelled";
const same=(a:unknown,b:unknown)=>canonicalizeReceizV122(a)===canonicalizeReceizV122(b);
const fail=(reason:string):never=>{throw new Error(`crew_job_${reason}`);};

/** Pure local scheduling transition. Evidence must be loaded from the execution journal;
 * use the store API to enforce that trust boundary. Navigation observations are local
 * position evidence, not world admission. This reducer never moves inventory or terrain. */
export function reduceWildsCrewJob(job:WildsCrewJob,action:WildsCrewJobAction,evidence?:Evidence):WildsCrewJob {
  if(terminal(job))return fail("terminal");
  const next={...job};
  if(job.pending && !["recall","command-resolved"].includes(action.type))return fail("pending_recovery_required");
  switch(action.type){
    case "recall":next.recallRequested=true;next.blocker=null;if(!job.pending)next.phase="returning";break;
    case "cancel":
      if(job.committedWorldEventIds.length||!["assigned","blocked"].includes(job.phase))return fail("recall_required");
      next.phase="cancelled";break;
    case "depart":if(job.phase!=="assigned")return fail("transition_invalid");next.phase=job.kind==="recall"?"returning":"travelling";break;
    case "arrive":
      if(!id(action.observationId)||!position(action.position)||!["travelling","returning"].includes(job.phase))return fail("navigation_evidence_invalid");
      if(!same(action.position,job.phase==="returning"?job.home:job.target))return fail("destination_mismatch");
      next.lastObservationId=action.observationId;
      next.phase=job.phase==="returning"?(job.recallRequested?"cancelled":"completed"):"working";break;
    case "return":
      if(job.phase!=="working"||(job.kind!=="explore"&&!job.committedWorldEventIds.length))return fail("work_evidence_required");
      next.phase="returning";break;
    case "block":if(!id(action.reason))return fail("blocker_invalid");next.phase="blocked";next.blocker=action.reason;break;
    case "resume":if(job.phase!=="blocked")return fail("transition_invalid");next.phase=job.recallRequested?"returning":"assigned";next.blocker=null;break;
    case "command-pending":
    case "command-resolved":{
      if(!evidence||evidence.event.eventId!==action.eventId||evidence.event.jobId!==job.jobId||evidence.event.workerId!==job.workerId
        ||evidence.command.jobId!==job.jobId||evidence.command.workerId!==job.workerId
        ||evidence.command.commandDigest!==evidence.event.commandDigest)return fail("command_evidence_invalid");
      const {event,command}=evidence;
      if(action.type==="command-pending"){
        if(job.phase!=="working"||job.recallRequested||job.committedWorldEventIds.length||command.head===job.lastCommandEventId||event.phase!=="pending")return fail("transition_invalid");
        next.pending={commandDigest:event.commandDigest,eventId:event.eventId,lotIds:[...command.lotIds]};next.phase="pending";
      }else{
        if(!job.pending||event.commandDigest!==job.pending.commandDigest||event.previousWorkerEventId!==job.pending.eventId
          ||!["admitted","rejected"].includes(event.phase)||!same(command.lotIds,job.pending.lotIds))return fail("resolution_evidence_invalid");
        next.pending=null;next.lastCommandEventId=event.eventId;
        next.committedWorldEventIds=[...new Set([...job.committedWorldEventIds,...event.admittedWorldEventIds])];
        if(next.committedWorldEventIds.length>256)return fail("effect_budget_exceeded");
        next.phase=job.recallRequested?"returning":event.phase==="admitted"?"working":"blocked";
        next.blocker=event.phase==="rejected"&&!job.recallRequested?"command_rejected":null;
      }
      break;
    }
    default:return fail("action_invalid");
  }
  return next;
}

/** Persistent owner-scoped scheduling, never an authority or cross-device lock. Each
 * revision and worker pointer are committed atomically in the existing IndexedDB.
 * No hashing, clocks or network awaits run inside an IndexedDB transaction. A production
 * scheduler must freshly authorize exact proofs/mandate before executing any command. */
export function createWildsCrewJobStore(ownerSubjectId:string,database:WildzContinuityDatabase=createWildzContinuityDatabase()){
  if(!id(ownerSubjectId))fail("owner_required");
  const key=(kind:string,value:string)=>JSON.stringify(["wildz.crew.jobs.v1",ownerSubjectId,kind,value]);
  const journalKey=(kind:string,value:string)=>JSON.stringify(["wildz.crew.v1",ownerSubjectId,kind,value]);
  const verify=async(job:WildsCrewJob)=>{
    const {head,...body}=job;
    if(job.ownerSubjectId!==ownerSubjectId||job.schema!=="wildz.crew.job.v1"||await digestReceizCanonicalV122(body)!==head)fail("corrupt");
    return job;
  };
  const read=async(jobId:string)=>{
    const job=await database.read<WildsCrewJob>("meta",key("job",jobId));
    if(job&&job.jobId!==jobId)fail("corrupt");return job?verify(job):null;
  };
  const current=async(workerId:string)=>{
    const jobId=await database.read<string>("meta",key("worker",workerId));return jobId?read(jobId):null;
  };
  const seal=async(body:Omit<WildsCrewJob,"head">):Promise<WildsCrewJob>=>({...body,head:await digestReceizCanonicalV122(body)});
  return Object.freeze({ownerSubjectId,read,current,
    async assign(input:WildsCrewJobAssignment):Promise<WildsCrewJob>{
      const request={...structuredClone(input),dependencyJobIds:[...(input.dependencyJobIds??[])]};
      if(request.dependencyJobIds.length>64 || request.dependencyJobIds.some(dependency=>!id(dependency)||dependency===request.jobId) || new Set(request.dependencyJobIds).size!==request.dependencyJobIds.length)fail("dependencies_invalid");
      if(![request.jobId,request.workerId,request.assetId,request.ownerProofDigest,request.workerProofDigest,request.genomeProofDigest,request.mandateDigest,request.worldId,request.regionId].every(id)
        ||!pulse(request.observedKaiUPulse)||!position(request.target)||!position(request.home)||!["gather","deliver","build","explore","recall"].includes(request.kind))fail("assignment_invalid");
      const dependencies=await Promise.all(request.dependencyJobIds.map(read));
      if(dependencies.some(dependency=>!dependency || dependency.phase!=="completed"))fail("dependency_incomplete");
      const job=await seal({...request,schema:"wildz.crew.job.v1",ownerSubjectId,previousHead:null,revision:1,causalKaiUPulse:Math.max(request.observedKaiUPulse,...dependencies.map(dependency=>dependency!.causalKaiUPulse)),phase:"assigned",recallRequested:false,blocker:null,pending:null,committedWorldEventIds:[],lastObservationId:null,lastCommandEventId:null});
      return database.transaction(["meta"],"readwrite",async tx=>{
        const original=await tx.get<WildsCrewJob>("meta",key("revision",job.head));
        if(original){if(!same(original,job))fail("replay_conflict");return original;}
        if(await tx.get("meta",key("job",job.jobId)))fail("job_id_reused");
        if(await tx.get("meta",key("worker",job.workerId)))fail("worker_busy");
        const workerJournalHead=await tx.get<string>("meta",journalKey("worker",job.workerId));
        const workerJournalEvent=workerJournalHead?await tx.get<WildsCrewCausalEvent>("meta",journalKey("event",workerJournalHead)):null;
        if(workerJournalEvent && ["proposed","pending"].includes(workerJournalEvent.phase))fail("worker_pending");
        for(const expectedDependency of dependencies){
          const dependency=await tx.get<WildsCrewJob>("meta",key("job",expectedDependency!.jobId));
          if(!same(dependency,expectedDependency))fail("dependency_incomplete");
        }
        const previous=await tx.get<string>("meta",key("list","head"));
        await tx.put("meta",{jobId:job.jobId,previous},key("list-item",job.jobId));
        await tx.put("meta",job.jobId,key("list","head"));
        await tx.put("meta",job,key("job",job.jobId));await tx.put("meta",job,key("revision",job.head));
        await tx.put("meta",job.jobId,key("worker",job.workerId));return job;
      });
    },
    async transition(input:WildsCrewJobTransition):Promise<WildsCrewJob>{
      const request=structuredClone(input);
      if(![request.jobId,request.expectedHead,request.requestId].every(id)||!pulse(request.observedKaiUPulse))fail("input_invalid");
      const requestDigest=await digestReceizCanonicalV122(request);
      const replayKey=key("request",JSON.stringify([request.jobId,request.requestId]));
      const replay=await database.read<{digest:string;job:WildsCrewJob}>("meta",replayKey);
      if(replay){if(replay.digest!==requestDigest)fail("replay_conflict");return verify(replay.job);}
      const previous=await read(request.jobId);if(!previous||previous.head!==request.expectedHead)return fail("head_conflict");
      // Reconcile a dispatch persisted immediately before a crash or recall. Never treat
      // the gap between execution-journal and job projection writes as zero writes.
      const journalHead=await database.read<string>("meta",journalKey("worker",previous.workerId));
      const journalEvent=journalHead?await database.read<WildsCrewCausalEvent>("meta",journalKey("event",journalHead)):null;
      let base=previous;
      if(journalEvent && ["proposed","pending"].includes(journalEvent.phase)){
        if(journalEvent.jobId!==previous.jobId || journalEvent.workerId!==previous.workerId || !await verifyWildsCrewCausalEvent(journalEvent))return fail("command_evidence_conflict");
        if(journalEvent.phase==="proposed" && !previous.pending)return fail("proposal_requires_cancellation_or_dispatch");
        if(journalEvent.phase==="pending" && !previous.pending && request.action.type!=="command-pending"){
          const stored=await database.read<WildsCrewStoredCommand>("meta",journalKey("command",journalEvent.commandDigest));
          if(!stored)return fail("command_evidence_missing");
          base=reduceWildsCrewJob(previous,{type:"command-pending",eventId:journalEvent.eventId},{event:journalEvent,command:stored});
        }
      }
      if(journalEvent && journalEvent.jobId===previous.jobId && ["admitted","rejected"].includes(journalEvent.phase)
        && !previous.pending && previous.lastCommandEventId!==journalEvent.eventId && !previous.committedWorldEventIds.length && journalEvent.previousWorkerEventId){
        const parent=await database.read<WildsCrewCausalEvent>("meta",journalKey("event",journalEvent.previousWorkerEventId));
        if(parent?.phase==="pending"){
          const stored=await database.read<WildsCrewStoredCommand>("meta",journalKey("command",journalEvent.commandDigest));
          if(!stored || !await verifyWildsCrewCausalEvent(parent) || !await verifyWildsCrewCausalEvent(journalEvent))return fail("command_evidence_missing");
          base=reduceWildsCrewJob(previous,{type:"command-pending",eventId:parent.eventId},{event:parent,command:stored});
          if(request.action.type!=="command-resolved")base=reduceWildsCrewJob(base,{type:"command-resolved",eventId:journalEvent.eventId},{event:journalEvent,command:stored});
        }
      }
      let evidence:Evidence|undefined;
      if(request.action.type==="command-pending"||request.action.type==="command-resolved"){
        const event=await database.read<WildsCrewCausalEvent>("meta",journalKey("event",request.action.eventId));
        if(!event||event.eventId!==request.action.eventId||!await verifyWildsCrewCausalEvent(event))return fail("command_evidence_missing");
        const command=await database.read<WildsCrewStoredCommand>("meta",journalKey("command",event.commandDigest));
        if(!command)return fail("command_evidence_missing");evidence={event,command};
      }
      const reduced=reduceWildsCrewJob(base,request.action,evidence);
      const {head:oldHead,...body}=reduced;void oldHead;
      const revision=previous.revision+1;if(!Number.isSafeInteger(revision))fail("revision_overflow");
      const job=await seal({...body,previousHead:previous.head,revision,observedKaiUPulse:request.observedKaiUPulse,causalKaiUPulse:Math.max(previous.causalKaiUPulse,request.observedKaiUPulse,evidence?.event.causalKaiUPulse??0,journalEvent?.causalKaiUPulse??0)});
      return database.transaction(["meta"],"readwrite",async tx=>{
        const duplicate=await tx.get<{digest:string;job:WildsCrewJob}>("meta",replayKey);
        if(duplicate){if(duplicate.digest!==requestDigest)fail("replay_conflict");return duplicate.job;}
        const actual=await tx.get<WildsCrewJob>("meta",key("job",job.jobId));
        if(actual?.head!==previous.head||!same(actual,previous)||await tx.get<string>("meta",key("worker",job.workerId))!==job.jobId)fail("head_conflict");
        if(await tx.get<string>("meta",journalKey("worker",job.workerId))!==journalHead)fail("command_evidence_conflict");
        if(evidence){
          if(!same(await tx.get("meta",journalKey("event",evidence.event.eventId)),evidence.event)
            ||!same(await tx.get("meta",journalKey("command",evidence.command.commandDigest)),evidence.command))fail("command_evidence_conflict");
        }
        await tx.put("meta",job,key("job",job.jobId));await tx.put("meta",job,key("revision",job.head));
        await tx.put("meta",{digest:requestDigest,job},replayKey);
        if(terminal(job))await tx.delete("meta",key("worker",job.workerId));
        return job;
      });
    },
    /** Bounded newest-first jobs, including terminal history; filter only after paging. */
    async list(beforeJobId?:string,limit=32){
      if(!Number.isInteger(limit)||limit<1||limit>128)fail("window_invalid");
      let cursor=beforeJobId??await database.read<string>("meta",key("list","head"));const jobs:WildsCrewJob[]=[];
      while(cursor&&jobs.length<limit){const row=await database.read<{jobId:string;previous:string|null}>("meta",key("list-item",cursor));const job=await read(cursor);
        if(!row||!job||row.jobId!==cursor)return fail("history_incomplete");jobs.push(job);cursor=row.previous;}
      return {jobs,nextCursor:cursor};
    },
    async history(jobId:string,beforeHead?:string,limit=32){
      if(!Number.isInteger(limit)||limit<1||limit>128)fail("window_invalid");
      let cursor=beforeHead??(await read(jobId))?.head??null;const jobs:WildsCrewJob[]=[];
      while(cursor&&jobs.length<limit){const job=await database.read<WildsCrewJob>("meta",key("revision",cursor));
        if(!job||job.jobId!==jobId||job.head!==cursor)return fail("history_incomplete");jobs.push(await verify(job));cursor=job.previousHead;}
      return {jobs,nextCursor:cursor};
    }
  });
}
