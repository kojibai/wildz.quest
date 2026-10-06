import {createCreationScheduler,type CreationCrewAuthorize,type CreationCrewJournal} from '../../features/play/creation/scheduler';
import {createWildsCreationAdmission,type WildsCreationRuntime} from './wilds-creation-admission';
/** Separately versioned multi-worker path. The legacy single-worker executor is unchanged. */
export function createWildsCreationCrewExecution(input:Readonly<{journal:CreationCrewJournal;runtime?:WildsCreationRuntime;authorize:CreationCrewAuthorize}>){
 if(input.runtime&&input.runtime.operationJournal!==input.journal)throw Error('creation_crew_operation_journal_mismatch');
 return createCreationScheduler({journal:input.journal,authorize:input.authorize,
  createAdmission:fence=>createWildsCreationAdmission(input.runtime,fence)});
}
