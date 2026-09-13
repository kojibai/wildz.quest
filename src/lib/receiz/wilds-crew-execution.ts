import { canonicalizeReceizV122, validateReceizExecutionReceiptV122, type ReceizExecutionOutcomeV122, type ReceizWorldTransactionV122 } from "@receiz/sdk";
import { createWildsCrewJournal } from "../../features/play/wilds-crew-journal";
import { observeWildsKaiUPulse } from "../../features/play/wilds-kai-runtime";
import { executeWildsV122Transaction, pendingWildsV122Outcome } from "./wilds-v122-world";

type ExecutionInput = Parameters<typeof executeWildsV122Transaction>[0];
type Journal = ReturnType<typeof createWildsCrewJournal>;

/** Records the exact dispatch boundary around an already planned and authorized SDK
 * transaction. This is NOT a mandate verifier: authorize must perform fresh proof,
 * head, capability, consent, geometry, reach and budget checks on the exact bytes.
 * Its runtime must enforce the same checks atomically when admitting the transaction. */
export function createWildsCrewExecution(input: Readonly<{
  journal: Journal;
  rail: ExecutionInput["rail"];
  transactionJournal: ExecutionInput["journal"];
  authorize(transaction: ReceizWorldTransactionV122): Promise<Readonly<Record<string, unknown>> | null>;
  authenticateReceipt: ExecutionInput["authenticateReceipt"];
  admitOutcome(outcome: Extract<ReceizExecutionOutcomeV122,{status:"committed"}>): Promise<readonly string[] | null>;
  observeKaiUPulse?: () => number;
}>) {
  const now = input.observeKaiUPulse ?? observeWildsKaiUPulse;
  return Object.freeze({
    async execute(request: Readonly<{
      workerId:string; jobId:string; transaction:ReceizWorldTransactionV122;
      expectedJobHead:string; expectedWorkerHead:string|null; dependencyEventIds:readonly string[]; lotIds:readonly string[];
    }>) {
      const candidate = structuredClone(request);
      const transaction = candidate.transaction;
      if(typeof candidate.expectedJobHead!=="string"||!candidate.expectedJobHead||candidate.expectedJobHead.length>512)
        return {ok:false as const,code:"crew_transaction_job_fence_required",writes:0 as const};
      // One worker per atomic crew task; all involved subjects remain SDK participants.
      if (transaction.commands.length === 0 || transaction.commands.length > 64 || candidate.dependencyEventIds.length > 64 || transaction.commands.some(command => command.actorSubjectId !== candidate.workerId || !command.mandateDigest)
        || !Object.hasOwn(transaction.participantHeads, candidate.workerId)
        || !Object.hasOwn(transaction.participantHeads, input.journal.ownerSubjectId)) {
        return {ok:false as const,code:"crew_transaction_worker_binding_invalid",writes:0 as const};
      }
      const causalParents = new Set(transaction.commands.flatMap(command => command.causalParents));
      for (const eventId of candidate.dependencyEventIds) {
        const dependency = await input.journal.readEvent(eventId);
        if (!dependency || dependency.phase !== "admitted" || dependency.admittedWorldEventIds.some(id => !causalParents.has(id)))
          return {ok:false as const,code:"crew_transaction_causal_dependency_missing",writes:0 as const};
      }
      const prior = await input.journal.command(transaction.transactionDigest);
      if (prior) return pendingWildsV122Outcome("crew_exact_transaction_recovery_required");
      // Immutable-by-copy boundary: verifier cannot replace transaction bytes after approval.
      const basis = canonicalizeReceizV122(transaction);
      const authority = await input.authorize(structuredClone(transaction));
      if (!authority || canonicalizeReceizV122(transaction) !== basis) return {ok:false as const,code:"crew_transaction_authority_unavailable",writes:0 as const};
      const capturedAuthority = structuredClone(authority);
      let proposed:Awaited<ReturnType<Journal["append"]>>;
      try {
        proposed = await input.journal.append({workerId:candidate.workerId,jobId:candidate.jobId,
          commandDigest:transaction.transactionDigest,expectedWorkerHead:candidate.expectedWorkerHead,expectedJobHead:candidate.expectedJobHead,
          dependencyEventIds:candidate.dependencyEventIds,lotIds:candidate.lotIds,phase:"proposed",observedKaiUPulse:now(),transaction});
      } catch {
        const existing=await input.journal.command(transaction.transactionDigest);
        if(existing&&existing.phase!=="rejected")return pendingWildsV122Outcome("crew_exact_transaction_recovery_required");
        return {ok:false as const,code:"crew_transaction_job_fence_rejected",writes:0 as const};
      }
      if (proposed.replay) return pendingWildsV122Outcome("crew_exact_transaction_recovery_required");
      // Validation and local runtime staging may await. Commit the pending intent only
      // in the final rail callback, so recall can atomically cancel a proposal meanwhile.
      let pending:Awaited<ReturnType<Journal["append"]>>|null=null;
      let dispatchDeclined=false, stageEntered=false;
      const cancelUndispatched=async()=>{
        await input.journal.cancelProposed(transaction.transactionDigest,now());
        const stored=await input.journal.command(transaction.transactionDigest);
        if(stored?.phase!=="rejected")return false;
        if(stageEntered)await input.transactionJournal.clear(transaction.worldId,transaction.transactionId);
        return true;
      };
      let admittedIds: readonly string[] | null = null;
      let clearRequested = false;
      let result: Awaited<ReturnType<typeof executeWildsV122Transaction>>;
      try {
        result = await executeWildsV122Transaction({transaction,authority:capturedAuthority,rail:{...input.rail,
          worldExecutionV122:request=>dispatchDeclined?Promise.resolve({status:"unknown"}):input.rail.worldExecutionV122(request),
          worldExecutionByIdempotencyKeyV122:request=>dispatchDeclined?Promise.resolve({status:"unknown"}):input.rail.worldExecutionByIdempotencyKeyV122(request),
          executeWorldTransactionV122:async exact=>{
            try {
              pending=await input.journal.append({workerId:candidate.workerId,jobId:candidate.jobId,
                commandDigest:transaction.transactionDigest,expectedWorkerHead:proposed.event.eventId,expectedJobHead:candidate.expectedJobHead,
                lotIds:candidate.lotIds,phase:"pending",observedKaiUPulse:now()});
              if(pending.replay)return {status:"unknown"};
            }catch{
              dispatchDeclined=true;
              const stored=await input.journal.command(transaction.transactionDigest);
              if(!stored||stored.phase==="pending"||stored.phase==="admitted")return {status:"unknown"};
              // Decline locally without inventing an SDK receipt, world head or outcome.
              throw new Error("crew_transaction_job_fence_rejected");
            }
            // No user callback or additional await between the successful fence and rail.
            return input.rail.executeWorldTransactionV122(exact);
          }},
          // Keep the exact transaction until BOTH runtime admission and local causal append persist.
          journal:{stage:async value=>{stageEntered=true;await input.transactionJournal.stage(value);},clear:async()=>{clearRequested=true;}},
          authenticateReceipt:input.authenticateReceipt,
          admitCommittedOutcome:async outcome=>{
            if (canonicalizeReceizV122(outcome.transaction) !== basis) return false;
            admittedIds = structuredClone(await input.admitOutcome(outcome));
            return Array.isArray(admittedIds) && admittedIds.length > 0;
          }});
      } catch {
        if(!pending){
          try {if(await cancelUndispatched())return {ok:false as const,code:"crew_transaction_pre_dispatch_failed",writes:0 as const};}catch{/* Keep recovery rows when local cancellation fails. */}
        }
        return pendingWildsV122Outcome("crew_transaction_execution_unavailable");
      }
      if(!pending||dispatchDeclined){
        try {
          if(await cancelUndispatched())return !result.ok&&result.writes===0?result:{ok:false as const,code:"crew_transaction_job_fence_rejected",writes:0 as const};
        }catch{/* Preserve local rows for recovery. */}
        return pendingWildsV122Outcome("crew_causal_cancellation_recovery_required");
      }
      if (!result.ok && result.writes !== 0) return result;
      try {
        await input.journal.append({workerId:candidate.workerId,jobId:candidate.jobId,commandDigest:transaction.transactionDigest,
          expectedWorkerHead:(pending as Awaited<ReturnType<Journal["append"]>>).event.eventId,lotIds:candidate.lotIds,phase:result.ok?"admitted":"rejected",observedKaiUPulse:now(),
          ...(result.ok ? {admittedWorldEventIds:admittedIds!} : {})});
        if (clearRequested) await input.transactionJournal.clear(transaction.worldId,transaction.transactionId);
      } catch { return pendingWildsV122Outcome("crew_causal_completion_recovery_required"); }
      return result;
    },
    /** Lookup only. No reauthorization, replanning or redispatch of uncertain work. */
    async recover(commandDigest:string) {
      try {
        const stored = await input.journal.command(commandDigest);
        if (!stored?.transaction) return pendingWildsV122Outcome("crew_recovery_transaction_missing");
        const transaction = stored.transaction;
        if (transaction.transactionDigest !== commandDigest) return pendingWildsV122Outcome("crew_recovery_transaction_changed");
        if(stored.phase==="rejected"){
          const rejection=await input.journal.readEvent(stored.head);
          const parent=rejection?.previousWorkerEventId?await input.journal.readEvent(rejection.previousWorkerEventId):null;
          if(rejection?.phase==="rejected"&&parent?.phase==="proposed"&&parent.commandDigest===commandDigest
            &&parent.workerId===stored.workerId&&parent.jobId===stored.jobId){
            await input.transactionJournal.clear(transaction.worldId,transaction.transactionId);
            return {ok:false as const,code:"crew_transaction_cancelled_before_dispatch",writes:0 as const};
          }
        }
        let outcome = await input.rail.worldExecutionV122({worldId:transaction.worldId,transactionId:transaction.transactionId});
        if (outcome.status === "unknown") outcome = await input.rail.worldExecutionByIdempotencyKeyV122({worldId:transaction.worldId,idempotencyKey:transaction.idempotencyKey});
        let effects: readonly string[] = [];
        if (outcome.status === "committed") {
          if (canonicalizeReceizV122(outcome.transaction) !== canonicalizeReceizV122(transaction)) return pendingWildsV122Outcome("crew_recovery_transaction_changed");
          const receipt = await validateReceizExecutionReceiptV122({outcome,expectedTransactionDigest:commandDigest,authenticateReceipt:input.authenticateReceipt});
          if (!receipt.ok) return pendingWildsV122Outcome(receipt.code);
          const admitted = await input.admitOutcome(outcome);
          if (!admitted?.length) return pendingWildsV122Outcome("crew_recovery_outcome_unadmitted");
          effects = structuredClone(admitted);
        } else if (outcome.status === "zero-write") {
          const failure = outcome.failure as {writes?:unknown;writesOnFailure?:unknown;transactionId?:unknown;idempotencyKey?:unknown}|null;
          if (!failure || (failure.writes !== 0 && failure.writesOnFailure !== 0) || failure.transactionId !== transaction.transactionId || failure.idempotencyKey !== transaction.idempotencyKey)
            return pendingWildsV122Outcome("crew_recovery_zero_write_unverified");
        } else return pendingWildsV122Outcome("crew_recovery_outcome_unknown");
        const phase = outcome.status === "committed" ? "admitted" : "rejected";
        if (stored.phase === "admitted" || stored.phase === "rejected") {
          const event = await input.journal.readEvent(stored.head);
          if (!event || event.phase !== phase || canonicalizeReceizV122(event.admittedWorldEventIds) !== canonicalizeReceizV122(effects))
            return pendingWildsV122Outcome("crew_recovery_outcome_conflict");
        } else {
          await input.journal.append({workerId:stored.workerId,jobId:stored.jobId,commandDigest,expectedWorkerHead:stored.head,
            lotIds:stored.lotIds,phase,observedKaiUPulse:now(),...(phase === "admitted"?{admittedWorldEventIds:effects}:{})});
        }
        await input.transactionJournal.clear(transaction.worldId,transaction.transactionId);
        return outcome.status === "committed" ? {ok:true as const,outcome} : {ok:false as const,code:"receiz_v122_zero_write",writes:0 as const,outcome};
      } catch { return pendingWildsV122Outcome("crew_recovery_unavailable"); }
    }
  });
}
