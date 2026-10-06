import type { CreationDefinition } from './types';
import type {CreationOccupancyGrant} from './occupancy';
import type {CreationMetabolismSource} from './consumption';
import {createCreationInstance,sealCreationInstance,verifyCreationInstance,type CreationInstance} from './instance';
import {assertCreationData,parseCreationDefinition} from './definition';
import {constructionProofDigest,freezeConstructionProof,validConstructionHead,validConstructionId,validConstructionKai} from '../wilds-construction-project';
import {CREATION_ACTIONS,CREATION_STATE_RULE_ID,CREATION_STATE_RULE_HEAD} from './actions';
export type CreationSourceRef=Readonly<{id:string;head:string;kind:string}>;
export type CreationResourceSource=CreationSourceRef & Readonly<{ownerId:string;quantity:number;spent:boolean}>;
export type CreationState=Readonly<{metabolism?:Readonly<Record<string,CreationMetabolismSource>>;occupancyGrants?:Readonly<Record<string,CreationOccupancyGrant>>;contributions?:Readonly<Record<string,Readonly<{operationId:string;instanceId:string;actorId:string;workerIds:readonly string[];resourceRefs:readonly {id:string;head:string;quantity:number}[];nodeIds:readonly string[];head:string}>>>;definitions:Readonly<Record<string,CreationDefinition>>;instances:Readonly<Record<string,CreationInstance>>;resources:Readonly<Record<string,CreationResourceSource>>;custody:Readonly<Record<string,string>>;reservations:Readonly<Record<string,string>>;receipts:Readonly<Record<string,Readonly<{operationId:string;commandDigest:string;instanceId:string;successorHead:string}>>>;events:readonly Readonly<{eventId:string;operationId:string;instanceId:string;action:string;kaiUPulse:number}>[]}>;
export type CreationCommand=Readonly<{operationId:string;actorId:string;instanceId:string;expectedHeads:Readonly<Record<string,string|null>>;kaiUPulse:number}> & (
 {action:'create';definitionDigest:string;worldId:string;spaceId:string;pose:CreationInstance['pose']}|
 {action:'advance';stage:'building'|'functional'|'finished'}|
 {action:'use';nodeId:string});
export type CreationAuthorityContext=Readonly<{actorId:string;rules:Readonly<Record<string,string>>;sources:readonly CreationSourceRef[];verifySource:(source:CreationSourceRef)=>boolean;mandates:readonly Readonly<{id:string;head:string;actorId:string;ownerId:string;instanceId:string;actions:readonly string[];expiresKaiUPulse:number;revoked:boolean}>[]}>;
export type CreationTransition={status:'rejected';state:CreationState;reason:string;writes:0}|{status:'proposed';state:CreationState;successorSources:readonly (CreationInstance|CreationResourceSource)[];consequences:CreationState['events']};
export function emptyCreationState():CreationState{return Object.freeze({definitions:{},instances:{},resources:{},custody:{},reservations:{},receipts:{},events:[]});}
export function reduceCreationOperation(state:CreationState,command:CreationCommand,context:CreationAuthorityContext):CreationTransition{
 const reject=(reason:string):CreationTransition=>({status:'rejected',state,reason,writes:0});
 try{
  assertCreationData(command);
  if(!validConstructionId(command.operationId)||!validConstructionId(command.actorId)||!validConstructionId(command.instanceId)||!validConstructionKai(command.kaiUPulse)||context.actorId!==command.actorId||!CREATION_ACTIONS[command.action])return reject('creation_command_invalid');
  const commandDigest=constructionProofDigest(command),prior=state.receipts[command.operationId];
  if(prior){if(prior.commandDigest!==commandDigest)return reject('creation_operation_collision');const current=state.instances[prior.instanceId];if(!current||!verifyCreationInstance(current))return reject('creation_replay_source_invalid');return {status:'proposed',state,successorSources:[],consequences:[]};}
  if(context.rules[CREATION_STATE_RULE_ID]!==CREATION_STATE_RULE_HEAD||!context.sources.some(source=>source.id===`rule:${CREATION_STATE_RULE_ID}`&&source.head===CREATION_STATE_RULE_HEAD&&source.kind==='rule'&&context.verifySource(source)))return reject('creation_rule_unavailable');
  if(new Set(context.sources.map(source=>source.id)).size!==context.sources.length)return reject('creation_source_duplicate');
  if(!validConstructionHead(command.expectedHeads[`actor:${command.actorId}`]))return reject('creation_actor_head_required');
  for(const [id,head] of Object.entries(command.expectedHeads)){if(head===null)continue;if(!validConstructionHead(head)||!context.sources.some(source=>source.id===id&&source.head===head&&context.verifySource(source)))return reject('creation_source_unverified');}
  let next:CreationInstance;const current=state.instances[command.instanceId];
  if(command.action==='create'){
   if(current||command.expectedHeads[command.instanceId]!==null)return reject('creation_instance_exists');
   const spaceId=`space:${command.spaceId}`;if(!validConstructionHead(command.expectedHeads[spaceId])||!context.sources.some(s=>s.id===spaceId&&s.kind==='space'&&s.head===command.expectedHeads[spaceId]))return reject('creation_space_head_required');
   const definition=parseCreationDefinition(state.definitions[command.definitionDigest]);if(definition.creatorId!==command.actorId)return reject('creation_creator_mismatch');
   next=createCreationInstance({instanceId:command.instanceId,definition,ownerId:command.actorId,worldId:command.worldId,spaceId:command.spaceId,pose:command.pose,kaiUPulse:command.kaiUPulse});
  }else{
   if(!current||!verifyCreationInstance(current)||command.expectedHeads[current.instanceId]!==current.head||!context.sources.some(s=>s.id===current.instanceId&&s.kind==='creation'&&s.head===current.head))return reject('creation_instance_stale');
   const definition=parseCreationDefinition(state.definitions[current.definitionDigest]);if(definition.nodes.some(n=>!Object.hasOwn(current.nodeStates,n.id)))return reject('creation_definition_state_mismatch');
   if(state.custody[current.instanceId]!==current.ownerId||command.kaiUPulse<current.kaiUPulse)return reject('creation_custody_or_time_stale');
   if(current.stage==='destroyed')return reject('creation_instance_destroyed');
   const access=current.access[command.action==='use'?'use':'edit'];
   const permitted=command.actorId===current.ownerId||(command.action==='use'&&(access.mode==='public'||access.mode==='invited'&&access.subjects.includes(command.actorId)))||context.mandates.some(m=>!m.revoked&&m.actorId===command.actorId&&m.ownerId===current.ownerId&&m.instanceId===current.instanceId&&m.actions.includes(command.action)&&m.expiresKaiUPulse>=command.kaiUPulse&&command.expectedHeads[m.id]===m.head&&context.sources.some(s=>s.id===m.id&&s.head===m.head&&s.kind==='mandate'&&context.verifySource(s)));
   if(!permitted)return reject('creation_access_denied');
   const {head,...basis}=current;
   if(command.action==='advance'){
    if(current.stage!=='planned'||command.stage!=='building')return reject('creation_work_admission_required');
    next=sealCreationInstance({...basis,stage:'building',revision:current.revision+1,parentHead:head,kaiUPulse:command.kaiUPulse});
   }else{
    if(!['functional','finished'].includes(current.stage)||!CREATION_ACTIONS.use.verify(current.nodeStates[command.nodeId]||null))return reject('creation_action_unavailable');
    next=sealCreationInstance({...basis,revision:current.revision+1,parentHead:head,kaiUPulse:command.kaiUPulse});
   }
  }
  const event={eventId:constructionProofDigest({operationId:command.operationId,commandDigest}),operationId:command.operationId,instanceId:next.instanceId,action:command.action,kaiUPulse:command.kaiUPulse};
  const copy=JSON.parse(JSON.stringify(state)) as CreationState;
  const proposed=freezeConstructionProof({...copy,instances:{...copy.instances,[next.instanceId]:next},custody:{...copy.custody,[next.instanceId]:next.ownerId},receipts:{...copy.receipts,[command.operationId]:{operationId:command.operationId,commandDigest,instanceId:next.instanceId,successorHead:next.head}},events:[...copy.events,event]});
  return {status:'proposed',state:proposed,successorSources:[next],consequences:[event]};
 }catch(error){return reject(error instanceof Error?error.message:'creation_operation_invalid');}
}
