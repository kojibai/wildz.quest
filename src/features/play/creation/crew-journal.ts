import {createWildzContinuityDatabase,type WildzContinuityDatabase,type WildzContinuityTransaction} from '../../../lib/storage/wildz-indexed-db';
import {wildsCrewJobStorageKey} from '../wilds-crew-jobs';
import {constructionProofDigest,sealConstructionProof,validConstructionId} from '../wilds-construction-project';
import {creationCrewEvidenceMatches,verifyCreationCrewBatch,type CreationCrewBatch,type CreationCrewEvidence} from './crew';
import type {CreationCrewJournal} from './scheduler';
import type {CreationOperationJournalRow} from './operation';
import type {WildsCrewCausalEvent} from '../wilds-crew-causality';

type BatchRow=Readonly<{batch:CreationCrewBatch;candidateHead:string;legacyWorkerHeads:Readonly<Record<string,string|null>>;legacyJobIds:Readonly<Record<string,string|null>>}>;
/** A local observation and reservation never grant source or mandate authority. */
export function createCreationCrewJournal(ownerId:string,database:WildzContinuityDatabase=createWildzContinuityDatabase()) {
 if(!validConstructionId(ownerId))throw Error('creation_crew_owner_required');
 const key=(kind:string,id:string)=>JSON.stringify(['wildz.creation-crew.v1',ownerId,kind,id]);
 const legacyKey=(kind:string,id:string)=>JSON.stringify(['wildz.crew.v1',ownerId,kind,id]);
 const workers=(batch:CreationCrewBatch)=>batch.operation.workerAllocations.map(w=>w.workerId);
 const readRow=(id:string)=>database.read<BatchRow>('meta',key('batch',id));
 const nextBatch=(batch:CreationCrewBatch,phase:CreationCrewBatch['phase'])=>{
  const {head,...basis}=batch;void head;
  return sealConstructionProof({...basis,phase,revision:batch.revision+1});
 };
 async function held(tx:WildzContinuityTransaction,batch:CreationCrewBatch) {
  for(const worker of workers(batch))if(await tx.get<string>('meta',legacyKey('creation-lease',worker))!==batch.batchId)throw Error('creation_crew_worker_lease_changed');
  for(const lot of batch.operation.resources){const reservation=await tx.get<{commandDigest:string}>('meta',legacyKey('lot',lot.id));if(reservation?.commandDigest!==batch.operation.digest)throw Error('creation_crew_lot_lease_changed');}
 }
 async function release(tx:WildzContinuityTransaction,batch:CreationCrewBatch) {
  await held(tx,batch);
  for(const worker of workers(batch))await tx.delete('meta',legacyKey('creation-lease',worker));
  for(const lot of batch.operation.resources)await tx.delete('meta',legacyKey('lot',lot.id));
 }
 async function currentRow(tx:WildzContinuityTransaction,batch:CreationCrewBatch){
  const row=await tx.get<BatchRow>('meta',key('batch',batch.batchId));
  if(!row||!verifyCreationCrewBatch(row.batch)||row.batch.head!==batch.head)throw Error('creation_crew_batch_fence_conflict');
  return row;
 }
 const journal:CreationCrewJournal={
  read:id=>database.read<CreationOperationJournalRow>('meta',key('operation',id)),
  compareAndSet:async(id,revision,next)=>{
   const copy=structuredClone(next);
   if(copy.operation.operationId!==id)throw Error('creation_crew_operation_binding_invalid');
   return database.transaction(['meta'],'readwrite',async tx=>{
    const before=await tx.get<CreationOperationJournalRow>('meta',key('operation',id));
    if((before?.revision??null)!==revision)return false;
    if(before&&before.operation.digest!==copy.operation.digest)return false;
    await tx.put('meta',copy,key('operation',id));return true;
   });
  },
  async stageBatch(candidate){
   const batch=structuredClone(candidate);
   if(!verifyCreationCrewBatch(batch)||batch.phase!=='prepared'||batch.revision!==0||batch.operation.resources.length>256||batch.operation.workerAllocations.length>32||batch.operation.actorId!==ownerId)throw Error('creation_crew_batch_invalid');
   return database.transaction(['meta'],'readwrite',async tx=>{
    const prior=await tx.get<BatchRow>('meta',key('batch',batch.batchId));
    if(prior){if(prior.candidateHead!==batch.head)throw Error('creation_crew_batch_identity_collision');return prior.batch;}
    const assigned=await tx.get<string>('meta',key('operation-batch',batch.operation.operationId));
    if(assigned&&assigned!==batch.batchId)throw Error('creation_crew_operation_already_assigned');
    const observed=await tx.get<CreationCrewEvidence>('meta',key('evidence','current'));
    if(!observed||!creationCrewEvidenceMatches(observed,batch.expected))throw Error('creation_crew_observation_changed');
    const legacyWorkerHeads:Record<string,string|null>={},legacyJobIds:Record<string,string|null>={};
    for(const worker of workers(batch)){
     if(await tx.get('meta',legacyKey('creation-lease',worker)))throw Error('creation_crew_worker_reserved');
     const localHead=await tx.get<string>('meta',legacyKey('worker',worker));
     if(localHead){const event=await tx.get<WildsCrewCausalEvent>('meta',legacyKey('event',localHead));if(!event||event.phase==='proposed'||event.phase==='pending')throw Error('creation_crew_legacy_worker_busy');}
     const jobId=await tx.get<string>('meta',wildsCrewJobStorageKey(ownerId,'worker',worker));
     if(jobId)throw Error('creation_crew_legacy_job_busy');
     legacyWorkerHeads[worker]=localHead;legacyJobIds[worker]=jobId;
    }
    for(const lot of batch.operation.resources)if(await tx.get('meta',legacyKey('lot',lot.id)))throw Error('creation_crew_lot_reserved');
    // Every check precedes every write; the IDB transaction rolls all writes back together.
    await tx.put('meta',{batch,candidateHead:batch.head,legacyWorkerHeads,legacyJobIds} satisfies BatchRow,key('batch',batch.batchId));
    await tx.put('meta',batch.batchId,key('operation-batch',batch.operation.operationId));
    for(const worker of workers(batch))await tx.put('meta',batch.batchId,legacyKey('creation-lease',worker));
    for(const lot of batch.operation.resources)await tx.put('meta',{workerId:`creation:batch:${batch.batchId}`,commandDigest:batch.operation.digest},legacyKey('lot',lot.id));
    return batch;
   });
  },
  async readBatch(id){return (await readRow(id))?.batch??null;},
  async recallBatch(id){
   return database.transaction(['meta'],'readwrite',async tx=>{
    const row=await tx.get<BatchRow>('meta',key('batch',id));if(!row||!verifyCreationCrewBatch(row.batch))throw Error('creation_crew_batch_missing');
    if(['admitted','cancelled'].includes(row.batch.phase))return row.batch;
    const next=nextBatch(row.batch,row.batch.phase==='prepared'?'cancelled':'recovering');
    if(next.phase==='cancelled')await release(tx,row.batch);
    await tx.put('meta',{...row,batch:next},key('batch',id));return next;
   });
  },
  async fenceBatch(batch,evidence){
   const captured=structuredClone(evidence);
   return database.transaction(['meta'],'readwrite',async tx=>{
    const row=await currentRow(tx,batch);
    const observed=await tx.get<CreationCrewEvidence>('meta',key('evidence','current'));
    if(row.batch.phase!=='prepared'||!observed||!creationCrewEvidenceMatches(captured,batch.expected)||!creationCrewEvidenceMatches(observed,batch.expected))throw Error('creation_crew_final_evidence_changed');
    await held(tx,batch);
    for(const worker of workers(batch)){
     if(await tx.get<string>('meta',legacyKey('worker',worker))!==row.legacyWorkerHeads[worker]||await tx.get<string>('meta',wildsCrewJobStorageKey(ownerId,'worker',worker))!==row.legacyJobIds[worker])throw Error('creation_crew_final_job_changed');
    }
    const next=nextBatch(batch,'pending');await tx.put('meta',{...row,batch:next},key('batch',batch.batchId));return next;
   });
  },
  async finishBatch(batch,phase){
   return database.transaction(['meta'],'readwrite',async tx=>{
    const row=await currentRow(tx,batch);
    if(['admitted','cancelled'].includes(row.batch.phase))return row.batch;
    if(phase!=='recovering'){
     const operation=await tx.get<CreationOperationJournalRow>('meta',key('operation',batch.operation.operationId));
     if(operation?.operation.digest!==batch.operation.digest||operation.phase!==(phase==='admitted'?'complete':'rejected'))throw Error('creation_crew_completion_not_durable');
     await release(tx,batch);
    }
    const next=nextBatch(batch,phase);await tx.put('meta',{...row,batch:next},key('batch',batch.batchId));return next;
   });
  }
 };
 return Object.freeze({...journal,
  /** CAS local observations from real job/navigation/source adapters; reauthorization is still mandatory. */
  async observeEvidence(previousDigest:string|null,evidence:CreationCrewEvidence){
   const copy=structuredClone(evidence);
   // The expected digest fences stale tabs. These records are scheduling evidence only.
   return database.transaction(['meta'],'readwrite',async tx=>{
    const current=await tx.get<CreationCrewEvidence>('meta',key('evidence','current'));
    if((current?constructionProofDigest(current):null)!==previousDigest)return false;
    await tx.put('meta',copy,key('evidence','current'));return true;
   });
  }
 });
}
