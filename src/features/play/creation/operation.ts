import {compileCreation,type CreationPlan,type CreationCompileContext} from './compiler';
import {assertCreationData,parseCreationDefinition} from './definition';
import {constructionProofDigest,freezeConstructionProof,sealConstructionProof,validConstructionHead,validConstructionId,validConstructionKai} from '../wilds-construction-project';
import {createCreationInstance,sealCreationInstance,verifyCreationInstance} from './instance';
import {selectCreationResources} from './resources';
import {planCreationTasks} from './crew';
import {initializeCreationComponents,creationComponentRuleForDefinition} from './components';
import {CREATION_MATERIALS} from './registry';
import type {CreationDefinition,CreationCommitResult} from './types';
import type {CreationInstance} from './instance';
import type {CreationState,CreationAuthorityContext,CreationResourceSource,CreationSourceRef} from './state';
import type {CreationWorker} from './capabilities';
import type {CreationResourceAvailability} from './resources';
import type {WildsMaterialLotV1} from '../wilds-steward-construction';
export type CreationWorkerMandate=Readonly<{id:string;head:string;workerId:string;ownerId:string;techniques:readonly string[];workCeiling:number;expiresKaiUPulse:number;revoked:boolean}>;
export type CreationOperationContext=Readonly<{operationId:string;actorId:string;instanceId:string;kaiUPulse:number;definition:CreationDefinition;compileContext:CreationCompileContext;state:CreationState;authority:CreationAuthorityContext;workers:readonly CreationWorker[];mandates:readonly CreationWorkerMandate[];lots:readonly WildsMaterialLotV1[];availability:CreationResourceAvailability;workCeiling:number;causalParents:readonly string[]}>;
export type CreationOperation=Readonly<{schema:'wildz.creation-operation.v1';operationId:string;idempotencyKey:string;actorId:string;instanceId:string;definition:CreationDefinition;definitionDigest:string;planDigest:string;ruleDigest:string;expectedHeads:Readonly<Record<string,string|null>>;mandates:readonly CreationWorkerMandate[];resources:readonly Readonly<{id:string;head:string;kind:string;quantity:number}>[];workerAllocations:readonly Readonly<{workerId:string;work:number}>[];bounds:readonly CreationPlan['chunks'][number]['bounds'][];causalParents:readonly string[];kaiUPulse:number;command:Readonly<{action:'construct';instance:CreationInstance;resourceSuccessors:readonly CreationResourceSource[]}>;digest:string}>;
export type CreationAdmissionOutcome={status:'admitted';operationId:string;operationDigest:string;instance:CreationInstance;successorSources:readonly (CreationSourceRef & Readonly<{parentHead:string|null}>)[];eventIds:readonly string[];receipt:unknown}|{status:'rejected';operationId:string;operationDigest:string;reason:string;writes:0;receipt:unknown}|{status:'unknown';operationId:string;reason?:string};
export type CreationAdmissionPort=Readonly<{execute(operation:CreationOperation):Promise<CreationAdmissionOutcome>;lookup(operationId:string):Promise<CreationAdmissionOutcome>}>;
export type CreationOperationJournalRow=Readonly<{schema:'wildz.creation-journal.v1';operation:CreationOperation;revision:number;phase:'staged'|'pending'|'recovering'|'complete'|'rejected';reservationRefs:readonly string[];result:CreationAdmissionOutcome|null}>;
export type CreationOperationJournal=Readonly<{read(operationId:string):Promise<CreationOperationJournalRow|null>;compareAndSet(operationId:string,expectedRevision:number|null,next:CreationOperationJournalRow):Promise<boolean>}>;
export const CREATION_CONSTRUCT_RULE_ID='creation.construct.v1';
export const CREATION_CONSTRUCT_RULE_HEAD=constructionProofDigest({id:CREATION_CONSTRUCT_RULE_ID,version:1,grammarVersion:1,materials:CREATION_MATERIALS,maximumWorkers:32,components:'static-condition-support',custody:'exact-quantity1-lot-consumption-and-embedded-lineage'});
export function creationConstructRuleForDefinition(definition:CreationDefinition){return definition.nodes.some(n=>n.behaviors.length)?creationComponentRuleForDefinition(definition):{id:CREATION_CONSTRUCT_RULE_ID,head:CREATION_CONSTRUCT_RULE_HEAD};}
const authenticatedOutcomes=new WeakMap<object,string>();
const pending=(operationId:string,reason:string):CreationAdmissionOutcome=>({status:'unknown',operationId,reason});
export function verifyCreationOperation(operation:CreationOperation):boolean{
 try{
  assertCreationData(operation);const {digest,...basis}=operation,definition=parseCreationDefinition(operation.definition),instance=operation.command.instance,rule=creationConstructRuleForDefinition(definition);
  if(operation.schema!=='wildz.creation-operation.v1'||definition.digest!==operation.definitionDigest||!validConstructionHead(digest)||digest!==constructionProofDigest(basis)||!validConstructionId(operation.operationId)||!validConstructionId(operation.actorId)||!validConstructionKai(operation.kaiUPulse)||operation.idempotencyKey!==`creation:${constructionProofDigest({actorId:operation.actorId,operationId:operation.operationId}).slice(7)}`||operation.ruleDigest!==rule.head||!validConstructionHead(operation.planDigest)||operation.command.action!=='construct'||!verifyCreationInstance(instance)||instance.instanceId!==operation.instanceId||instance.definitionDigest!==definition.digest||definition.creatorId!==operation.actorId||instance.creatorId!==operation.actorId||instance.ownerId!==operation.actorId||instance.stewardId!==operation.actorId||instance.stage!=='functional'||instance.revision!==0||instance.parentHead!==null||instance.kaiUPulse!==operation.kaiUPulse)return false;
  if(constructionProofDigest(instance.nodeStates)!==constructionProofDigest(initializeCreationComponents(definition,operation.kaiUPulse)))return false;
  if(operation.expectedHeads[operation.instanceId]!==null||operation.expectedHeads[`rule:${rule.id}`]!==rule.head||!validConstructionHead(operation.expectedHeads[`actor:${operation.actorId}`])||!validConstructionHead(operation.expectedHeads[`space:${instance.spaceId}`])||Object.entries(operation.expectedHeads).some(([id,head])=>!validConstructionId(id)||(id!==operation.instanceId&&!validConstructionHead(head))))return false;
  if(!operation.workerAllocations.length||operation.workerAllocations.length>32||new Set(operation.workerAllocations.map(w=>w.workerId)).size!==operation.workerAllocations.length||operation.workerAllocations.some(w=>!validConstructionId(w.workerId)||!validConstructionHead(operation.expectedHeads[w.workerId])||!Number.isSafeInteger(w.work)||w.work<0||w.work>1_000_000)||operation.workerAllocations.reduce((n,w)=>n+w.work,0)<=0||operation.mandates.length!==operation.workerAllocations.length||new Set(operation.mandates.map(m=>m.id)).size!==operation.mandates.length)return false;
  if(operation.workerAllocations.some(w=>{const matches=operation.mandates.filter(m=>m.workerId===w.workerId);return matches.length!==1||matches[0].ownerId!==operation.actorId||matches[0].revoked||matches[0].expiresKaiUPulse<operation.kaiUPulse||!Number.isSafeInteger(matches[0].workCeiling)||matches[0].workCeiling<w.work||operation.expectedHeads[matches[0].id]!==matches[0].head||!validConstructionHead(matches[0].head);}))return false;
  if(!Array.isArray(operation.resources)||operation.resources.length>65536||new Set(operation.resources.map(r=>r.id)).size!==operation.resources.length||operation.resources.some(r=>!validConstructionId(r.id)||!validConstructionHead(r.head)||operation.expectedHeads[r.id]!==r.head||r.quantity!==1||!Object.hasOwn(CREATION_MATERIALS,r.kind))||constructionProofDigest(operation.resources)!==constructionProofDigest(instance.embeddedResources)||operation.command.resourceSuccessors.length!==operation.resources.length)return false;
  if(operation.resources.some(r=>{const matches=operation.command.resourceSuccessors.filter(s=>s.id===r.id);if(matches.length!==1)return true;const successor=matches[0] as CreationResourceSource & {schema?:string;parentHead?:string;spentBy?:string;embeddedIn?:string};const {head,...body}=successor;return successor.schema!=='wildz.creation-material-custody.v1'||successor.parentHead!==r.head||successor.ownerId!==operation.actorId||successor.quantity!==r.quantity||successor.kind!==r.kind||successor.spent!==true||successor.spentBy!==operation.operationId||successor.embeddedIn!==operation.instanceId||!validConstructionHead(head)||constructionProofDigest(body)!==head;}))return false;
  return Array.isArray(operation.causalParents)&&operation.causalParents.length<=128&&new Set(operation.causalParents).size===operation.causalParents.length&&operation.causalParents.every(validConstructionId);
 }catch{return false;}
}
/** Pure candidate preparation. Invoke in a worker/server boundary, never a frame/input callback. */
export function prepareCreationOperation(plan:CreationPlan,context:CreationOperationContext):CreationOperation{
 if(context.compileContext.evolution||plan.evolution)throw Error('creation_evolution_cannot_construct_copy');
 const definition=parseCreationDefinition(context.definition),fresh=compileCreation(definition,context.compileContext);
 if(fresh.status!=='ready'||fresh.plan.digest!==plan.digest||constructionProofDigest(fresh.plan.requiredResources)!==constructionProofDigest(plan.requiredResources)||fresh.plan.requiredWork!==plan.requiredWork||constructionProofDigest(fresh.plan.pose)!==constructionProofDigest(plan.pose)||constructionProofDigest(fresh.plan.chunks.map(c=>c.bounds))!==constructionProofDigest(plan.chunks.map(c=>c.bounds)))throw Error('creation_plan_stale_or_changed');
 plan=fresh.plan;
 if(!validConstructionId(context.operationId)||!validConstructionId(context.instanceId)||!validConstructionKai(context.kaiUPulse)||context.actorId!==context.authority.actorId||context.actorId!==context.availability.actorId||definition.creatorId!==context.actorId||context.state.instances[context.instanceId]||!Number.isSafeInteger(context.workCeiling)||context.workCeiling<plan.requiredWork||context.causalParents.length>128||new Set(context.causalParents).size!==context.causalParents.length||context.causalParents.some(id=>!validConstructionId(id)))throw Error('creation_operation_context_invalid');
 const rule=creationConstructRuleForDefinition(definition);
 if(context.authority.rules[rule.id]!==rule.head)throw Error('creation_rule_unavailable');
 const expectedHeads:Record<string,string|null>={[context.instanceId]:null};
 const source=(id:string,kind:string,head?:string)=>{const matches=context.authority.sources.filter(s=>s.id===id&&s.kind===kind);if(matches.length!==1||head&&matches[0].head!==head||!context.authority.verifySource(matches[0]))throw Error('creation_source_unverified');expectedHeads[id]=matches[0].head;};
 source(`rule:${rule.id}`,'rule',rule.head);source(`actor:${context.actorId}`,'actor');source(`space:${plan.spaceId}`,'space',plan.sourceHead);
 if(new Set(context.lots.map(l=>l.lotId)).size!==context.lots.length)throw Error('creation_resource_duplicate');
 const selection=selectCreationResources(context.lots,context.compileContext.budget,plan.requiredResources,context.availability);if(Object.keys(selection.deficits).length)throw Error('creation_resource_shortage');
 const resourceSuccessors=selection.lots.map(lot=>{source(lot.id,'material',lot.head);const current=context.state.resources[lot.id];if(!current||current.head!==lot.head||current.ownerId!==context.actorId||current.quantity!==lot.quantity||current.kind!==lot.kind||current.spent||context.state.reservations[lot.id])throw Error('creation_resource_stale');const {head,...basis}=current;return sealConstructionProof({...basis,schema:'wildz.creation-material-custody.v1',parentHead:head,spent:true,spentBy:context.operationId,embeddedIn:context.instanceId});});
 if(!context.workers.length||context.workers.length>32||new Set(context.workers.map(w=>w.subjectId)).size!==context.workers.length||context.workers.some(w=>!w.ready)||plan.requiredTechniques.some(t=>!context.workers.some(w=>w.techniques.includes(t))))throw Error('creation_worker_capability_unavailable');
 const tasks=planCreationTasks(plan,context.workers);
 const mandates:CreationWorkerMandate[]=[],workerAllocations:{workerId:string;work:number}[]=[];
 context.workers.forEach(worker=>{source(worker.subjectId,'creature',worker.head);const match=context.mandates.filter(m=>m.workerId===worker.subjectId&&m.ownerId===context.actorId&&!m.revoked&&m.expiresKaiUPulse>=context.kaiUPulse&&worker.techniques.every(t=>m.techniques.includes(t)));if(match.length!==1)throw Error('creation_worker_mandate_unavailable');const mandate=match[0],work=tasks.filter(t=>t.workerId===worker.subjectId).reduce((total,t)=>total+t.work,0);if(!Number.isSafeInteger(mandate.workCeiling)||mandate.workCeiling<work)throw Error('creation_worker_work_ceiling');source(mandate.id,'mandate',mandate.head);mandates.push(mandate);workerAllocations.push({workerId:worker.subjectId,work});});
 // Functional component state must come from a registered deterministic law, never prompt stats.
 const planned=createCreationInstance({instanceId:context.instanceId,definition,ownerId:context.actorId,worldId:plan.worldId,spaceId:plan.spaceId,pose:plan.pose,kaiUPulse:context.kaiUPulse}),{head,...instanceBasis}=planned;
 const instance=sealCreationInstance({...instanceBasis,stage:'functional',nodeStates:initializeCreationComponents(definition,context.kaiUPulse),embeddedResources:selection.lots});
 const basis={schema:'wildz.creation-operation.v1' as const,operationId:context.operationId,idempotencyKey:`creation:${constructionProofDigest({actorId:context.actorId,operationId:context.operationId}).slice(7)}`,actorId:context.actorId,instanceId:context.instanceId,definition,definitionDigest:definition.digest,planDigest:plan.digest,ruleDigest:rule.head,expectedHeads,mandates,resources:selection.lots,workerAllocations,bounds:plan.chunks.map(c=>c.bounds),causalParents:context.causalParents,kaiUPulse:context.kaiUPulse,command:{action:'construct' as const,instance,resourceSuccessors}};
 const copy=JSON.parse(JSON.stringify(basis)) as typeof basis;return freezeConstructionProof({...copy,digest:constructionProofDigest(copy)});
}
function structurallyBound(operation:CreationOperation,outcome:unknown):outcome is Exclude<CreationAdmissionOutcome,{status:'unknown'}>{
 try{assertCreationData(outcome);const result=outcome as Exclude<CreationAdmissionOutcome,{status:'unknown'}>;if(!result||result.operationId!==operation.operationId||result.operationDigest!==operation.digest)return false;
  if(result.status==='rejected')return result.writes===0&&validConstructionId(result.reason);
  if(result.status!=='admitted'||!verifyCreationInstance(result.instance)||result.instance.head!==operation.command.instance.head||!Array.isArray(result.successorSources)||!Array.isArray(result.eventIds)||!result.eventIds.length||new Set(result.eventIds).size!==result.eventIds.length||result.eventIds.some(id=>!validConstructionId(id))||new Set(result.successorSources.map(s=>s.id)).size!==result.successorSources.length)return false;
  const required=[operation.instanceId,...operation.resources.map(r=>r.id),...operation.workerAllocations.filter(w=>w.work>0).map(w=>w.workerId),`space:${operation.command.instance.spaceId}`];
  if(required.some(id=>!result.successorSources.some(s=>s.id===id&&validConstructionHead(s.head)&&s.parentHead===operation.expectedHeads[id])))return false;
  if(!result.successorSources.some(s=>s.id===operation.instanceId&&s.kind==='creation'&&s.head===result.instance.head))return false;
  return operation.command.resourceSuccessors.every(resource=>result.successorSources.some(s=>s.id===resource.id&&s.head===resource.head));
 }catch{return false;}
}
/** Structural matching plus trusted-host authentication; digest text alone never admits. */
export function verifyCreationAdmission(operation:CreationOperation,outcome:unknown):CreationAdmissionOutcome{
 if(!verifyCreationOperation(operation)||!outcome||typeof outcome!=='object'||authenticatedOutcomes.get(outcome)!==operation.digest||!structurallyBound(operation,outcome))return pending(operation.operationId,'creation_admission_unverified');
 return outcome;
}
/** Trusted host injection; transport JSON never supplies the authenticator. */
export function createCreationAdmissionPort(input:Readonly<{executeRaw:(operation:CreationOperation)=>Promise<unknown>;lookupRaw:(operationId:string)=>Promise<unknown>;authenticate:(operation:CreationOperation,outcome:unknown)=>Promise<boolean>;operationForLookup?:(operationId:string)=>Promise<CreationOperation|null>}>):CreationAdmissionPort{
 const operations=new Map<string,CreationOperation>();
 async function admit(operation:CreationOperation,raw:unknown):Promise<CreationAdmissionOutcome>{
  if(!verifyCreationOperation(operation)||!structurallyBound(operation,raw))return pending(operation.operationId,'creation_outcome_unknown');
  const copy=freezeConstructionProof(JSON.parse(JSON.stringify(raw))) as Exclude<CreationAdmissionOutcome,{status:'unknown'}>;
  if(!await input.authenticate(operation,copy))return pending(operation.operationId,'creation_outcome_authentication_failed');
  authenticatedOutcomes.set(copy,operation.digest);return verifyCreationAdmission(operation,copy);
 }
 return Object.freeze({async execute(operation){if(!verifyCreationOperation(operation))return pending(operation.operationId,'creation_operation_invalid');const copy=freezeConstructionProof(JSON.parse(JSON.stringify(operation))) as CreationOperation;operations.set(copy.operationId,copy);return admit(copy,await input.executeRaw(copy));},async lookup(operationId){const operation=operations.get(operationId)||await input.operationForLookup?.(operationId);if(!operation)return pending(operationId,'creation_operation_lookup_binding_unavailable');return admit(operation,await input.lookupRaw(operationId));}});
}
/** No dispatch occurs in this port; the explicit local blocker is a zero-write result. */
export function createUnavailableCreationAdmissionPort(reason:string):CreationAdmissionPort{
 return createCreationAdmissionPort({executeRaw:async operation=>({status:'rejected',operationId:operation.operationId,operationDigest:operation.digest,reason,writes:0,receipt:{kind:'local-pre-dispatch-unavailable'}}),lookupRaw:async operationId=>pending(operationId,reason),authenticate:async(_operation,outcome)=>!!outcome&&typeof outcome==='object'&&(outcome as {receipt?:{kind?:string}}).receipt?.kind==='local-pre-dispatch-unavailable'});
}
export async function commitCreation(operation:CreationOperation,port:CreationAdmissionPort,journal:CreationOperationJournal):Promise<CreationCommitResult>{
 const unknown=():CreationCommitResult=>({status:'unknown',operationId:operation.operationId}),reject=(reason:string):CreationCommitResult=>({status:'rejected',reason,writes:0});
 if(!verifyCreationOperation(operation))return reject('creation_operation_invalid');
 operation=freezeConstructionProof(JSON.parse(JSON.stringify(operation))) as CreationOperation;
 let row:CreationOperationJournalRow|null;
 try{row=await journal.read(operation.operationId);if(row&&row.operation.digest!==operation.digest)return reject('creation_operation_identity_collision');
  if(!row){const staged:CreationOperationJournalRow={schema:'wildz.creation-journal.v1',operation,revision:0,phase:'staged',reservationRefs:operation.resources.map(r=>r.id),result:null};if(!await journal.compareAndSet(operation.operationId,null,staged)){row=await journal.read(operation.operationId);if(!row||row.operation.digest!==operation.digest)return reject('creation_journal_fence_collision');}else row=staged;}
 }catch{return unknown();}
 let raw:CreationAdmissionOutcome;
 if((row.phase==='complete'||row.phase==='rejected')&&row.result){const verified=verifyCreationAdmission(operation,row.result);if(verified.status==='admitted')return {status:'admitted',instance:verified.instance};if(verified.status==='rejected')return reject(verified.reason);}
 if(row.phase==='staged'){
  const pendingRow:CreationOperationJournalRow={...row,phase:'pending',revision:row.revision+1};
  try{if(!await journal.compareAndSet(operation.operationId,row.revision,pendingRow))return unknown();row=pendingRow;}catch{return unknown();}
  try{raw=await port.execute(operation);}catch{return unknown();}
 }else{try{raw=await port.lookup(operation.operationId);}catch{return unknown();}}
 const outcome=verifyCreationAdmission(operation,raw);if(outcome.status==='unknown')return unknown();
 const completed:CreationOperationJournalRow={...row,revision:row.revision+1,phase:outcome.status==='admitted'?'complete':'rejected',reservationRefs:[],result:outcome};
 try{if(!await journal.compareAndSet(operation.operationId,row.revision,completed))return unknown();}catch{return unknown();}
 return outcome.status==='admitted'?{status:'admitted',instance:outcome.instance}:reject(outcome.reason);
}
