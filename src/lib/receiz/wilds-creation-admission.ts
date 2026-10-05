import {canonicalizeReceizV122,validateReceizExecutionReceiptV122,type ReceizWorldTransactionV122,type ReceizExecutionOutcomeV122} from '@receiz/sdk';
import {executeWildsV122Transaction} from './wilds-v122-world';
import {createCreationAdmissionPort,createUnavailableCreationAdmissionPort,type CreationAdmissionOutcome,type CreationOperation,type CreationOperationJournal} from '../../features/play/creation/operation';
import {constructionProofDigest,freezeConstructionProof} from '../../features/play/wilds-construction-project';
type Execution=Parameters<typeof executeWildsV122Transaction>[0];
/** A registered runtime/source reducer is required in addition to SDK method availability. */
export type WildsCreationRuntime=Readonly<{
 rail:Execution['rail'];transactionJournal:Execution['journal'];operationJournal:CreationOperationJournal;
 prepare(operation:CreationOperation):Promise<Readonly<{transaction:ReceizWorldTransactionV122;authority:Execution['authority']}>>;
 readTransaction(operationId:string):Promise<ReceizWorldTransactionV122|null>;
 authenticateReceipt:Execution['authenticateReceipt'];
 projectCommittedOutcome(operation:CreationOperation,outcome:Extract<ReceizExecutionOutcomeV122,{status:'committed'}>):Promise<CreationAdmissionOutcome|null>;
 authenticateSources(operation:CreationOperation,outcome:CreationAdmissionOutcome):Promise<boolean>;
}>;
export function verifyWildsCreationTransactionBinding(transaction:ReceizWorldTransactionV122,operation:CreationOperation){
 const expected=Object.fromEntries(Object.entries(operation.expectedHeads).filter((entry):entry is [string,string]=>entry[1]!==null));
 return transaction.idempotencyKey===operation.idempotencyKey&&transaction.worldId===operation.command.instance.worldId&&transaction.expectedWorldHead===operation.expectedHeads[`space:${operation.command.instance.spaceId}`]&&canonicalizeReceizV122(transaction.participantHeads)===canonicalizeReceizV122(expected)&&transaction.commands.length===1&&canonicalizeReceizV122(transaction.commands[0].command)===canonicalizeReceizV122(operation);
}
export function createWildsCreationAdmission(runtime?:WildsCreationRuntime,dispatchFence?:()=>Promise<boolean>){
 if(!runtime)return createUnavailableCreationAdmissionPort('creation_runtime_reducer_and_mandate_unqualified');
 const authenticated=new Map<string,string>();
 const remember=(operation:CreationOperation,result:CreationAdmissionOutcome)=>{authenticated.set(constructionProofDigest(result),operation.digest);if(authenticated.size>128)authenticated.delete(authenticated.keys().next().value!);};
 async function project(operation:CreationOperation,outcome:Extract<ReceizExecutionOutcomeV122,{status:'committed'}>){
  const source=await runtime!.projectCommittedOutcome(operation,outcome);
  const result=source?freezeConstructionProof(JSON.parse(JSON.stringify(source))) as CreationAdmissionOutcome:null;
  if(!result||result.status!=='admitted'||!await runtime!.authenticateSources(operation,result))return {status:'unknown' as const,operationId:operation.operationId,reason:'creation_source_successors_unverified'};
  remember(operation,result);return result;
 }
 const verifiedZero=(operation:CreationOperation,reason:string,receipt:unknown)=>{const result={status:'rejected' as const,operationId:operation.operationId,operationDigest:operation.digest,reason,writes:0 as const,receipt};remember(operation,result);return result;};
 return createCreationAdmissionPort({
  operationForLookup:async id=>(await runtime.operationJournal.read(id))?.operation||null,
  authenticate:async(operation,result)=>!!result&&typeof result==='object'&&authenticated.get(constructionProofDigest(result))===operation.digest,
  async executeRaw(operation){
   let prepared:Awaited<ReturnType<WildsCreationRuntime['prepare']>>;
   try{prepared=await runtime.prepare(operation);}catch{return verifiedZero(operation,'creation_authorization_unavailable_before_dispatch',{kind:'local-pre-dispatch'});}
   if(!verifyWildsCreationTransactionBinding(prepared.transaction,operation))return verifiedZero(operation,'creation_transaction_binding_invalid',{kind:'local-pre-dispatch'});
   let declined=false;
   const rail=dispatchFence?{...runtime.rail,
    worldExecutionV122:request=>declined?Promise.resolve({status:'unknown' as const}):runtime.rail.worldExecutionV122(request),
    worldExecutionByIdempotencyKeyV122:request=>declined?Promise.resolve({status:'unknown' as const}):runtime.rail.worldExecutionByIdempotencyKeyV122(request),
    executeWorldTransactionV122:async exact=>{
     try{if(!await dispatchFence())throw Error('creation_crew_final_fence_rejected');}catch{declined=true;throw Error('creation_crew_final_fence_rejected');}
     // Invoke the rail directly; no callback/await is inserted after the successful fence.
     return runtime.rail.executeWorldTransactionV122(exact);
    }
   } satisfies Execution['rail']:runtime.rail;
   const result=await executeWildsV122Transaction({...prepared,rail,
    // Retain exact signed bytes until operation completion also persists; recovery cannot regenerate them.
    journal:{stage:runtime.transactionJournal.stage,clear:async()=>{}},authenticateReceipt:runtime.authenticateReceipt});
   if(declined)return verifiedZero(operation,'creation_crew_final_fence_rejected',{kind:'local-pre-dispatch'});
   if(!result.ok)return result.writes===0?verifiedZero(operation,result.code,'outcome'in result?result.outcome:{kind:'local-pre-dispatch'}):{status:'unknown' as const,operationId:operation.operationId,reason:result.code};
   return project(operation,result.outcome);
  },
  async lookupRaw(operationId){
   const operation=(await runtime.operationJournal.read(operationId))?.operation,transaction=await runtime.readTransaction(operationId);
   if(!operation||!transaction||!verifyWildsCreationTransactionBinding(transaction,operation))return {status:'unknown' as const,operationId,reason:'creation_exact_transaction_unavailable'};
   let outcome=await runtime.rail.worldExecutionV122({worldId:transaction.worldId,transactionId:transaction.transactionId});
   if(outcome.status==='unknown')outcome=await runtime.rail.worldExecutionByIdempotencyKeyV122({worldId:transaction.worldId,idempotencyKey:transaction.idempotencyKey});
   if(outcome.status==='unknown')return {status:'unknown' as const,operationId};
   if(outcome.status==='zero-write'){
    const failure=outcome.failure as {writes?:unknown;writesOnFailure?:unknown;transactionId?:unknown;idempotencyKey?:unknown}|null;
    if(!failure||(failure.writes!==0&&failure.writesOnFailure!==0)||failure.transactionId!==transaction.transactionId||failure.idempotencyKey!==transaction.idempotencyKey)return {status:'unknown' as const,operationId,reason:'creation_zero_write_unverified'};
    return verifiedZero(operation,'creation_atomic_zero_write',outcome);
   }
   if(canonicalizeReceizV122(outcome.transaction)!==canonicalizeReceizV122(transaction)||(await validateReceizExecutionReceiptV122({outcome,expectedTransactionDigest:transaction.transactionDigest,authenticateReceipt:runtime.authenticateReceipt})).ok!==true)return {status:'unknown' as const,operationId,reason:'creation_receipt_unverified'};
   return project(operation,outcome);
  }
 });
}
