import {creationCrewEvidenceMatches,type CreationCrewBatch,type CreationCrewEvidence} from './crew';
import {commitCreation} from './operation';
import type {CreationAdmissionPort,CreationOperationJournal} from './operation';
export type CreationCrewAuthorize=(batch:CreationCrewBatch)=>Promise<CreationCrewEvidence|null>;
export type CreationCrewJournal=CreationOperationJournal & Readonly<{stageBatch(batch:CreationCrewBatch):Promise<CreationCrewBatch>;readBatch(batchId:string):Promise<CreationCrewBatch|null>;recallBatch(batchId:string):Promise<CreationCrewBatch>;fenceBatch(batch:CreationCrewBatch,evidence:CreationCrewEvidence):Promise<CreationCrewBatch>;finishBatch(batch:CreationCrewBatch,phase:'admitted'|'cancelled'|'recovering'):Promise<CreationCrewBatch>}>;
/** The trusted runtime factory must call fence in its final rail callback, after all awaits. */
export function createCreationScheduler(input:Readonly<{journal:CreationCrewJournal;createAdmission:(fence:()=>Promise<boolean>)=>CreationAdmissionPort;authorize:CreationCrewAuthorize}>):Readonly<{run:(batch:CreationCrewBatch)=>Promise<CreationCrewBatch>}>{
 const journal=input.journal;
 return Object.freeze({async run(candidate){
  let batch=await journal.stageBatch(candidate);
  if(batch.phase==='admitted'||batch.phase==='cancelled')return batch;
  const admission=input.createAdmission(async()=>{
   // Fresh authority immediately before one atomic local fence. No rail dispatch precedes it.
   const evidence=await input.authorize(batch);
   if(!evidence||!creationCrewEvidenceMatches(evidence,batch.expected))return false;
   try{batch=await journal.fenceBatch(batch,evidence);return true;}catch{return false;}
  });
  if(batch.phase==='prepared'){
   let evidence:CreationCrewEvidence|null;
   try{evidence=await input.authorize(batch);}catch{return journal.recallBatch(batch.batchId);}
   if(!evidence||!creationCrewEvidenceMatches(evidence,batch.expected))return journal.recallBatch(batch.batchId);
  }
  const result=await commitCreation(batch.operation,admission,journal);
  const current=await journal.readBatch(batch.batchId);if(!current)throw Error('creation_crew_batch_missing');
  if(current.phase==='cancelled'||current.phase==='admitted')return current;
  return journal.finishBatch(current,result.status==='admitted'?'admitted':result.status==='rejected'?'cancelled':'recovering');
 }});
}
