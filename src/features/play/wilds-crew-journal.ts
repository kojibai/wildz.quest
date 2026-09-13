import { canonicalizeReceizV122, digestReceizCanonicalV122, type ReceizWorldTransactionV122 } from "@receiz/sdk";
import { createWildzContinuityDatabase, type WildzContinuityDatabase } from "../../lib/storage/wildz-indexed-db";
import { createWildsCrewCausalEvent, verifyWildsCrewCausalEvent, type WildsCrewCausalEvent } from "./wilds-crew-causality";

import { wildsCrewJobStorageKey, type WildsCrewJob } from "./wilds-crew-jobs";

import type { WildsWorldCommand } from "./wilds-world-service";
export type WildsCrewStoredSourceCommand = Readonly<{
  command:Extract<WildsWorldCommand,{type:"resource.material.harvest"}>;
  ownerReceizId:string;ownerSubjectId:string;workerSubjectId:string;ownerHead:string;workerHead:string;
  ownerProofDigest:string;workerProofDigest:string;mandateDigest:string;worldId:string;assetId:string;cardProofDigest:string;expectedLotId?:string;
  arrival?:Readonly<{position:Readonly<{x:number;y:number;z:number}>;spaceId:string;kaiUPulse:number}>;
}>;
export type WildsCrewStoredCommand = Readonly<{
  workerId: string; jobId: string; commandDigest: string; head: string;
  lotIds: readonly string[]; phase: WildsCrewCausalEvent["phase"];
  transaction: ReceizWorldTransactionV122 | null;
  /** Exact working job head whose final CAS committed this dispatch intent. */
  expectedJobHead?: string;
  sourceCommand?:WildsCrewStoredSourceCommand;
}>;
type Reservation = Readonly<{ workerId: string; commandDigest: string }>;
const validId = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 512;

/** Owner-scoped, append-only LOCAL scheduling journal. It does not grant world authority.
 * Exact world outcomes must be admitted before recording 'admitted' or 'rejected'.
 * History is stored as individual rows, never rewritten/truncated with every tick.
 * IndexedDB transactions serialize competing tabs; cross-device admission remains the
 * world's responsibility. No hashing/network awaits occur inside the IDB transaction. */
export function createWildsCrewJournal(ownerSubjectId: string, database: WildzContinuityDatabase = createWildzContinuityDatabase()) {
  if (!validId(ownerSubjectId)) throw new Error("crew_journal_owner_required");
  const key = (kind: string, id: string): IDBValidKey => JSON.stringify(["wildz.crew.v1", ownerSubjectId, kind, id]);
  const readEvent = async (eventId: string) => {
    const event = await database.read<WildsCrewCausalEvent>("meta", key("event", eventId));
    if (event && (event.eventId !== eventId || !await verifyWildsCrewCausalEvent(event))) throw new Error("crew_journal_event_corrupt");
    return event;
  };
  const workerHead = (workerId: string) => database.read<string>("meta", key("worker", workerId));
  const command = (commandDigest: string) => database.read<WildsCrewStoredCommand>("meta", key("command", commandDigest));

  const append = async (input: Readonly<{
    workerId: string; jobId: string; commandDigest: string; observedKaiUPulse: number;
    expectedWorkerHead: string | null; dependencyEventIds?: readonly string[];
    phase: WildsCrewCausalEvent["phase"]; lotIds?: readonly string[];
    admittedWorldEventIds?: readonly string[];
    transaction?: ReceizWorldTransactionV122;
    expectedJobHead?: string;
    sourceCommand?:WildsCrewStoredSourceCommand;
  }>) => {
    const request = structuredClone(input);
    const lotIds = [...(request.lotIds ?? [])];
    const dependencyIds = [...(request.dependencyEventIds ?? [])];
    if (![request.workerId, request.jobId, request.commandDigest].every(validId)
      || lotIds.length > 64 || lotIds.some(id => !validId(id)) || new Set(lotIds).size !== lotIds.length
      || dependencyIds.length > 64 || dependencyIds.some(id => !validId(id)) || new Set(dependencyIds).size !== dependencyIds.length)
      throw new Error("crew_journal_input_invalid");
    if (request.transaction && (request.phase !== "proposed" || request.transaction.transactionDigest !== request.commandDigest)) throw new Error("crew_journal_transaction_invalid");
    if(request.sourceCommand && (request.phase!=="proposed"||request.transaction||await digestReceizCanonicalV122(request.sourceCommand)!==request.commandDigest))throw new Error("crew_journal_source_command_invalid");
    const storedBefore = await command(request.commandDigest);
    const expectedJobHead = request.expectedJobHead ?? storedBefore?.expectedJobHead;
    if(request.expectedJobHead!==undefined&&!validId(request.expectedJobHead))throw new Error("crew_journal_job_fence_invalid");
    if(storedBefore?.expectedJobHead && expectedJobHead!==storedBefore.expectedJobHead)throw new Error("crew_journal_job_fence_changed");
    let jobSnapshot:WildsCrewJob|null=null;
    if(expectedJobHead && (request.phase==="proposed"||request.phase==="pending")){
      jobSnapshot=await database.read<WildsCrewJob>("meta",wildsCrewJobStorageKey(ownerSubjectId,"job",request.jobId));
      if(!jobSnapshot||jobSnapshot.head!==expectedJobHead||jobSnapshot.ownerSubjectId!==ownerSubjectId||jobSnapshot.workerId!==request.workerId
        ||jobSnapshot.jobId!==request.jobId||jobSnapshot.phase!=="working"||jobSnapshot.recallRequested||jobSnapshot.pending||jobSnapshot.committedWorldEventIds.length)
        throw new Error("crew_journal_job_fence_conflict");
      const {head,...body}=jobSnapshot;
      if(await digestReceizCanonicalV122(body)!==head)throw new Error("crew_journal_job_fence_corrupt");
      const transaction=request.transaction??storedBefore?.transaction;
      if(transaction && (transaction.worldId!==jobSnapshot.worldId
        ||transaction.participantHeads[ownerSubjectId]!==jobSnapshot.expectedOwnerSubjectHead||transaction.participantHeads[request.workerId]!==jobSnapshot.expectedWorkerSubjectHead
        ||transaction.commands.some(command=>command.actorSubjectId!==request.workerId||command.mandateDigest!==jobSnapshot!.mandateDigest)))throw new Error("crew_journal_job_transaction_mismatch");
      if(!transaction){
        const source=request.sourceCommand??storedBefore?.sourceCommand;
        if(!source||source.ownerSubjectId!==ownerSubjectId||source.workerSubjectId!==request.workerId
          ||source.ownerHead!==jobSnapshot.expectedOwnerSubjectHead||source.workerHead!==jobSnapshot.expectedWorkerSubjectHead
          ||source.ownerProofDigest!==jobSnapshot.ownerProofDigest||source.workerProofDigest!==jobSnapshot.workerProofDigest
          ||source.mandateDigest!==jobSnapshot.mandateDigest||source.worldId!==jobSnapshot.worldId||source.assetId!==jobSnapshot.assetId
          ||source.command.type!=="resource.material.harvest"||source.cardProofDigest!==source.command.cardProofDigest
          ||await digestReceizCanonicalV122(source)!==request.commandDigest)throw new Error("crew_journal_job_source_mismatch");
      }
    }
    const previous = request.expectedWorkerHead === null ? null : await readEvent(request.expectedWorkerHead);
    if (request.expectedWorkerHead && !previous) throw new Error("crew_journal_parent_missing");
    const dependencies = await Promise.all(dependencyIds.map(readEvent));
    if (dependencies.some(event => !event)) throw new Error("crew_journal_dependency_missing");
    const event = await createWildsCrewCausalEvent({ ...request, previous,
      dependencies: dependencies as WildsCrewCausalEvent[] });
    const parentSnapshots = new Map<string, string>();
    for (const parent of [...dependencies, previous]) if (parent) parentSnapshots.set(parent.eventId, canonicalizeReceizV122(parent));
    const terminal = event.phase === "admitted" || event.phase === "rejected";
    return database.transaction(["meta"], "readwrite", async tx => {
      const existing = await tx.get<WildsCrewCausalEvent>("meta", key("event", event.eventId));
      if (existing) {
        if (canonicalizeReceizV122(existing) !== canonicalizeReceizV122(event)) throw new Error("crew_journal_event_conflict");
        const storedCommand = await tx.get<WildsCrewStoredCommand>("meta", key("command", request.commandDigest));
        if (!storedCommand || canonicalizeReceizV122(storedCommand.lotIds) !== canonicalizeReceizV122(lotIds)
          || (request.transaction && canonicalizeReceizV122(storedCommand.transaction) !== canonicalizeReceizV122(request.transaction))
          ||(request.sourceCommand&&canonicalizeReceizV122(storedCommand.sourceCommand)!==canonicalizeReceizV122(request.sourceCommand)))
          throw new Error("crew_journal_replay_conflict");
        return { event, replay: true };
      }
      if(jobSnapshot){
        const currentJob=await tx.get<WildsCrewJob>("meta",wildsCrewJobStorageKey(ownerSubjectId,"job",request.jobId));
        if(canonicalizeReceizV122(currentJob)!==canonicalizeReceizV122(jobSnapshot)
          ||await tx.get<string>("meta",wildsCrewJobStorageKey(ownerSubjectId,"worker",request.workerId))!==request.jobId)throw new Error("crew_journal_job_fence_conflict");
      }
      if (await tx.get<string>("meta", key("worker", request.workerId)) !== request.expectedWorkerHead) throw new Error("crew_journal_head_conflict");
      for (const [parentId, snapshot] of parentSnapshots) {
        const stored = await tx.get<WildsCrewCausalEvent>("meta", key("event", parentId));
        if (!stored || canonicalizeReceizV122(stored) !== snapshot) throw new Error("crew_journal_parent_conflict");
      }
      const priorCommand = await tx.get<WildsCrewStoredCommand>("meta", key("command", request.commandDigest));
      if (event.phase === "proposed") {
        if (priorCommand) throw new Error("crew_journal_command_replayed");
      } else if (!priorCommand || priorCommand.head !== request.expectedWorkerHead
        || priorCommand.workerId !== request.workerId || priorCommand.jobId !== request.jobId) throw new Error("crew_journal_command_conflict");
      // A transition cannot silently change its reserved lots.
      if (priorCommand && canonicalizeReceizV122(priorCommand.lotIds) !== canonicalizeReceizV122(lotIds)) throw new Error("crew_journal_lots_changed");
      for (const lotId of lotIds) {
        const held = await tx.get<Reservation>("meta", key("lot", lotId));
        if (held && (held.commandDigest !== request.commandDigest || held.workerId !== request.workerId)) throw new Error("crew_journal_lot_reserved");
        if (priorCommand && !held) throw new Error("crew_journal_reservation_missing");
      }
      await tx.put("meta", event, key("event", event.eventId));
      await tx.put("meta", event.eventId, key("worker", event.workerId));
      await tx.put<WildsCrewStoredCommand>("meta", {workerId:event.workerId,jobId:event.jobId,commandDigest:event.commandDigest,head:event.eventId,lotIds,phase:event.phase,transaction:priorCommand?.transaction ?? request.transaction ?? null,...(expectedJobHead?{expectedJobHead}:{}),...((priorCommand?.sourceCommand??request.sourceCommand)?{sourceCommand:priorCommand?.sourceCommand??request.sourceCommand}:{})}, key("command", event.commandDigest));
      for (const lotId of lotIds) {
        if (terminal) await tx.delete("meta", key("lot", lotId));
        else await tx.put<Reservation>("meta", {workerId:event.workerId,commandDigest:event.commandDigest}, key("lot", lotId));
      }
      return { event, replay: false };
    });
  };

  return Object.freeze({
    ownerSubjectId, append, readEvent, workerHead, command,
    async cancelProposed(commandDigest: string, observedKaiUPulse: number) {
      const stored = await command(commandDigest);
      if (!stored || stored.phase !== "proposed") return {cancelled:false as const};
      // CAS rejects cancellation if another tab moves the proposal to pending first.
      const result = await append({workerId:stored.workerId,jobId:stored.jobId,commandDigest,
        expectedWorkerHead:stored.head,lotIds:stored.lotIds,phase:"rejected",observedKaiUPulse});
      return {cancelled:true as const,event:result.event};
    },
    reservation: (lotId: string) => database.read<Reservation>("meta", key("lot", lotId)),
    /** Bounded display window; all older events remain available by their causal IDs. */
    async history(workerId: string, beforeEventId?: string, limit = 32) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 128) throw new Error("crew_journal_window_invalid");
      let cursor = beforeEventId ?? await workerHead(workerId);
      const events: WildsCrewCausalEvent[] = [];
      const visited = new Set<string>();
      while (cursor && events.length < limit) {
        if (visited.has(cursor)) throw new Error("crew_journal_cycle");
        visited.add(cursor);
        const event = await readEvent(cursor);
        if (!event || event.workerId !== workerId) throw new Error("crew_journal_history_incomplete");
        events.push(event);
        cursor = event.previousWorkerEventId;
      }
      return {events, nextCursor: cursor};
    }
  });
}
