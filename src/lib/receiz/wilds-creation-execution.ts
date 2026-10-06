import {commitCreation,type CreationOperation,type CreationOperationJournal} from '../../features/play/creation/operation';
import {createWildsCreationAdmission,type WildsCreationRuntime} from './wilds-creation-admission';
/** Separate aggregate creation path; legacy one-worker crew execution stays unchanged. */
export function createWildsCreationExecution(input:Readonly<{journal:CreationOperationJournal;runtime?:WildsCreationRuntime}>){
 const admission=createWildsCreationAdmission(input.runtime);
 return Object.freeze({execute:(operation:CreationOperation)=>commitCreation(operation,admission,input.journal),recover:async(operationId:string)=>{const row=await input.journal.read(operationId);if(!row)return {status:'unknown' as const,operationId};return commitCreation(row.operation,admission,input.journal);}});
}
