import type {CreationActionRequest} from './action-transition';
import type {CreationDefinition} from './types';
import {compileCreation,type CreationCompileContext} from './compiler';
import type {CreationState,CreationAuthorityContext,CreationTransition} from './state';
import type {CreationWorker} from './capabilities';
import type {CreationWorkerMandate} from './operation';
import {selectCreationResources,type CreationResourceAvailability} from './resources';
import type {WildsMaterialLotV1} from '../wilds-steward-construction';
import {constructionProofDigest,freezeConstructionProof,sealConstructionProof,validConstructionHead,validConstructionId,validConstructionKai} from '../wilds-construction-project';
import {assertCreationData,parseCreationDefinition} from './definition';
import {initializeCreationComponents,CREATION_COMPONENT_RULE_HEAD} from './components';
import {sealCreationInstance,verifyCreationInstance,type CreationNodeState,type CreationInstance} from './instance';
import type {CreationSelectedLot} from './resources';
import {planCreationTasks} from './crew';
export const CREATION_EVOLUTION_RULE_ID='creation.evolve.v1';
export const CREATION_EVOLUTION_RULE_HEAD=constructionProofDigest({id:CREATION_EVOLUTION_RULE_ID,version:1,components:CREATION_COMPONENT_RULE_HEAD,identity:'same-instance-next-head',material:'full-rebuild-changed-node-no-salvage',state:'preserve-components-and-embedded-history',occupied:'unchanged-geometry-required',removal:'separate-relocation-and-salvage-law'});
export type CreationEvolutionCommand=CreationActionRequest&Readonly<{action:'evolve';definition:CreationDefinition;planDigest:string}>;
export type CreationEvolutionContext=Readonly<{authority:CreationAuthorityContext;compileContext:CreationCompileContext;workers:readonly CreationWorker[];mandates:readonly CreationWorkerMandate[];lots:readonly WildsMaterialLotV1[];availability:CreationResourceAvailability;workCeiling:number}>;
function contract(node:CreationNodeState){
 const {condition,supportIds,...body}=node;void condition;void supportIds;
 switch(body.kind){
  case 'storage':return {...body,lotIds:[]};
  case 'bed':case 'habitat':return {...body,occupantIds:[]};
  case 'garden':return {...body,planted:0,waterUnits:0,produce:0,fertility:0,lastGrowthKaiUPulse:0};
  case 'equipment':return {...body,durability:body.capacity,equippedBy:null,lastActionKaiUPulse:0,lastActionId:null};
  case 'joint':case 'actuator':return {...body,position:0};
  case 'sensor':return {...body,signal:false};
  case 'logic':return {...body,counter:0,consumedEventIds:[]};
  default:return body;
 }
}
/** Deterministic component successor shared by aggregate source admission and
 * the Native transaction proposal. Authentication belongs to each host boundary. */
export function reviseCreationInstance(current:CreationInstance,previousInput:CreationDefinition,definitionInput:CreationDefinition,resources:readonly CreationSelectedLot[],kaiUPulse:number):CreationInstance{
 const previous=parseCreationDefinition(previousInput),definition=parseCreationDefinition(definitionInput);
 if(!verifyCreationInstance(current)||!['functional','finished'].includes(current.stage)||previous.digest!==current.definitionDigest||definition.creatorId!==current.creatorId||previous.creatorId!==current.creatorId||previous.seed!==definition.seed||constructionProofDigest(previous.assets)!==constructionProofDigest(definition.assets)||!validConstructionKai(kaiUPulse)||kaiUPulse<current.kaiUPulse)throw Error('creation_evolution_binding_changed');
 if(Object.keys(current.nodeStates).length!==previous.nodes.length||previous.nodes.some(n=>!current.nodeStates[n.id]||constructionProofDigest(current.nodeStates[n.id].supportIds)!==constructionProofDigest(n.supports))||previous.nodes.some(n=>!definition.nodes.some(next=>next.id===n.id)))throw Error('creation_evolution_component_or_removal_unavailable');
 const occupied=Object.values(current.nodeStates).some(n=>(n.kind==='bed'||n.kind==='habitat')&&n.occupantIds.length);
 if(occupied&&previous.nodes.some(n=>constructionProofDigest(n)!==constructionProofDigest(definition.nodes.find(next=>next.id===n.id))))throw Error('creation_evolution_occupied_replacement_required');
 const initialized=initializeCreationComponents(definition,kaiUPulse),nodeStates:Record<string,CreationNodeState>={...initialized};
 for(const node of previous.nodes){const before=current.nodeStates[node.id],after=initialized[node.id];if(constructionProofDigest(contract(before))!==constructionProofDigest(contract(after)))throw Error('creation_evolution_component_conversion_required');if(before.kind==='storage'&&before.lotIds.length&&constructionProofDigest(node)!==constructionProofDigest(definition.nodes.find(n=>n.id===node.id)))throw Error('creation_evolution_contents_replacement_required');nodeStates[node.id]={...before,supportIds:after.supportIds};}
 if(resources.some(r=>current.embeddedResources.some(old=>old.id===r.id)))throw Error('creation_evolution_material_unavailable');
 const {head,...body}=current;
 return sealCreationInstance({...body,definitionDigest:definition.digest,nodeStates,embeddedResources:[...current.embeddedResources,...resources],parentHead:head,revision:current.revision+1,kaiUPulse});
}
/** Pure exact-head proposal. A Native transaction must still authenticate every participant. */
export function prepareCreationEvolution(state:CreationState,command:CreationEvolutionCommand,context:CreationEvolutionContext):CreationTransition{
 const reject=(reason:string):CreationTransition=>({status:'rejected',state,reason,writes:0});
 try{
  assertCreationData(command);
  if(command.action!=='evolve'||![command.operationId,command.actorId,command.instanceId].every(validConstructionId)||!validConstructionKai(command.kaiUPulse)||!validConstructionHead(command.planDigest)||context.authority.actorId!==command.actorId||context.availability.actorId!==command.actorId)return reject('creation_evolution_request_invalid');
  const current=state.instances[command.instanceId],authority=context.authority;
  if(!current||!verifyCreationInstance(current)||state.custody[current.instanceId]!==current.ownerId||!['functional','finished'].includes(current.stage))return reject('creation_evolution_current_source_invalid');
  const authenticated=(id:string,head:string,kind?:string)=>authority.sources.filter(s=>s.id===id&&s.head===head&&(!kind||s.kind===kind)&&authority.verifySource(s)).length===1;
  const commandDigest=constructionProofDigest(command),prior=state.receipts[command.operationId];
  if(prior){if(prior.commandDigest!==commandDigest||prior.instanceId!==current.instanceId)return reject('creation_operation_collision');if(!authenticated(current.instanceId,current.head,'creation'))return reject('creation_evolution_replay_unverified');return {status:'proposed',state,successorSources:[],consequences:[]};}
  if(current.head!==command.expectedHeads[current.instanceId]||command.kaiUPulse<current.kaiUPulse||!authenticated(current.instanceId,current.head,'creation')||new Set(authority.sources.map(s=>s.id)).size!==authority.sources.length)return reject('creation_evolution_source_stale');
  if(authority.rules[CREATION_EVOLUTION_RULE_ID]!==CREATION_EVOLUTION_RULE_HEAD||command.expectedHeads['rule:'+CREATION_EVOLUTION_RULE_ID]!==CREATION_EVOLUTION_RULE_HEAD||!authenticated('rule:'+CREATION_EVOLUTION_RULE_ID,CREATION_EVOLUTION_RULE_HEAD,'rule'))return reject('creation_evolution_rule_unavailable');
  for(const [id,head] of Object.entries(command.expectedHeads))if(!validConstructionId(id)||!validConstructionHead(head)||!authenticated(id,head!))return reject('creation_evolution_participant_unverified');
  if(!validConstructionHead(command.expectedHeads['actor:'+command.actorId])||!authenticated('actor:'+command.actorId,command.expectedHeads['actor:'+command.actorId]!,'actor'))return reject('creation_evolution_actor_unverified');
  const editing=authority.mandates.some(m=>m.actorId===command.actorId&&m.ownerId===current.ownerId&&m.instanceId===current.instanceId&&!m.revoked&&m.expiresKaiUPulse>=command.kaiUPulse&&m.actions.includes('evolve')&&command.expectedHeads[m.id]===m.head&&authenticated(m.id,m.head,'mandate'));
  if(command.actorId!==current.ownerId&&!editing)return reject('creation_evolution_edit_denied');
  const previous=parseCreationDefinition(state.definitions[current.definitionDigest]),definition=parseCreationDefinition(command.definition),basis=context.compileContext.evolution;
  if(previous.creatorId!==current.creatorId||definition.creatorId!==current.creatorId||previous.seed!==definition.seed||constructionProofDigest(previous.assets)!==constructionProofDigest(definition.assets)||!basis||basis.instanceId!==current.instanceId||basis.head!==current.head||parseCreationDefinition(basis.definition).digest!==previous.digest||context.compileContext.worldId!==current.worldId||context.compileContext.spaceId!==current.spaceId||constructionProofDigest(context.compileContext.pose)!==constructionProofDigest(current.pose)||command.expectedHeads['space:'+current.spaceId]!==context.compileContext.sourceHead||!authenticated('space:'+current.spaceId,context.compileContext.sourceHead,'space'))return reject('creation_evolution_binding_changed');
  if(Object.keys(current.nodeStates).length!==previous.nodes.length||previous.nodes.some(n=>!current.nodeStates[n.id]||constructionProofDigest(current.nodeStates[n.id].supportIds)!==constructionProofDigest(n.supports))||previous.nodes.some(n=>!definition.nodes.some(next=>next.id===n.id)))return reject('creation_evolution_component_or_removal_unavailable');
  const occupied=Object.values(current.nodeStates).some(n=>(n.kind==='bed'||n.kind==='habitat')&&n.occupantIds.length);
  if(occupied&&previous.nodes.some(n=>constructionProofDigest(n)!==constructionProofDigest(definition.nodes.find(next=>next.id===n.id))))return reject('creation_evolution_occupied_replacement_required');
  const fresh=compileCreation(definition,context.compileContext);if(fresh.status!=='ready'||fresh.plan.digest!==command.planDigest)return reject('creation_evolution_plan_stale');
  const plan=fresh.plan,initialized=initializeCreationComponents(definition,command.kaiUPulse),nodeStates:Record<string,CreationNodeState>={...initialized};
  for(const node of previous.nodes){const before=current.nodeStates[node.id],after=initialized[node.id];if(constructionProofDigest(contract(before))!==constructionProofDigest(contract(after)))return reject('creation_evolution_component_conversion_required');if(before.kind==='storage'&&before.lotIds.length&&constructionProofDigest(node)!==constructionProofDigest(definition.nodes.find(n=>n.id===node.id)))return reject('creation_evolution_contents_replacement_required');nodeStates[node.id]={...before,supportIds:after.supportIds};}
  if(!Number.isSafeInteger(context.workCeiling)||context.workCeiling<plan.requiredWork||context.workers.length>32||!context.workers.length||context.workers.some(w=>!w.ready)||new Set(context.workers.map(w=>w.subjectId)).size!==context.workers.length)return reject('creation_evolution_crew_unavailable');
  const tasks=planCreationTasks(plan,context.workers);
  for(const worker of context.workers){const work=tasks.filter(t=>t.workerId===worker.subjectId).reduce((n,t)=>n+t.work,0),mandates=context.mandates.filter(m=>m.workerId===worker.subjectId&&m.ownerId===command.actorId&&!m.revoked&&m.expiresKaiUPulse>=command.kaiUPulse&&worker.techniques.every(t=>m.techniques.includes(t))&&Number.isSafeInteger(m.workCeiling)&&m.workCeiling>=work);if(mandates.length!==1||command.expectedHeads[worker.subjectId]!==worker.head||!authenticated(worker.subjectId,worker.head,'creature')||command.expectedHeads[mandates[0].id]!==mandates[0].head||!authenticated(mandates[0].id,mandates[0].head,'mandate'))return reject('creation_evolution_crew_mandate_unavailable');}
  if(new Set(context.lots.map(l=>l.lotId)).size!==context.lots.length)return reject('creation_evolution_duplicate_material');
  const selection=selectCreationResources(context.lots,context.compileContext.budget,plan.requiredResources,context.availability);if(Object.keys(selection.deficits).length)return reject('creation_evolution_resource_shortage');
  const resources={...state.resources},resourceSuccessors=[];
  for(const lot of selection.lots){const source=state.resources[lot.id];if(!source||source.head!==lot.head||source.ownerId!==command.actorId||state.custody[lot.id]!==command.actorId||source.kind!==lot.kind||source.quantity!==lot.quantity||source.spent||state.reservations[lot.id]||current.embeddedResources.some(r=>r.id===lot.id)||command.expectedHeads[lot.id]!==lot.head||!authenticated(lot.id,lot.head,'material'))return reject('creation_evolution_material_unavailable');const {head,...body}=source;const successor=sealConstructionProof({...body,schema:'wildz.creation-material-custody.v1',parentHead:head,spent:true,spentBy:command.operationId,embeddedIn:current.instanceId});resources[lot.id]=successor;resourceSuccessors.push(successor);}
  const {head,...body}=current,instance=sealCreationInstance({...body,definitionDigest:definition.digest,nodeStates,embeddedResources:[...current.embeddedResources,...selection.lots],parentHead:head,revision:current.revision+1,kaiUPulse:command.kaiUPulse});
  const event={eventId:constructionProofDigest({operationId:command.operationId,commandDigest,head:instance.head}),operationId:command.operationId,instanceId:instance.instanceId,action:'evolve',kaiUPulse:command.kaiUPulse};
  return {status:'proposed',state:freezeConstructionProof({...state,definitions:{...state.definitions,[definition.digest]:definition},instances:{...state.instances,[instance.instanceId]:instance},resources,receipts:{...state.receipts,[command.operationId]:{operationId:command.operationId,commandDigest,instanceId:instance.instanceId,successorHead:instance.head}},events:[...state.events,event]}),successorSources:[instance,...resourceSuccessors],consequences:[event]};
 }catch(error){return reject(error instanceof Error?error.message:'creation_evolution_failed');}
}
