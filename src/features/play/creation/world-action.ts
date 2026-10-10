import {constructionProofDigest,validConstructionId} from '../wilds-construction-project';
import type {WildsWorldProjection} from '../wilds-world-state';
import {creationWorldSourceHead,compileWorldCreationSource,type WildsCreationSourceRecord} from './world-source';
import {emptyCreationState,type CreationAuthorityContext} from './state';
import {equipCreation,creationEquipmentRule,dischargeCreationEquipment,CREATION_EQUIPMENT_RULE_HEAD,type CreationEquipCommand,type CreationDischargeCommand} from './equipment';
import {currentCreationEquipment} from './equipment';
import {resolveCreationDamage,creationDamageRule,CREATION_DAMAGE_RULE_HEAD,type CreationAttack} from './damage';
import {creationEquipmentProfile,CREATION_GEAR_PROFILE_HEAD} from './equipment-profiles';
import {creationAimNodeDistance,creationEquipmentAimOrigin,validCreationAim,validCreationPoint} from './equipment-aim';
import type {CreationInstance} from './instance';
import type {CreationDefinition,CreationPoint} from './types';
import {creationNodePoses} from './projection';
import {assertCreationRangedHitUnoccluded,CREATION_RANGED_OCCLUSION_RULE_HEAD} from './ranged-occlusion';

export type WildsCreationActionCommand=Readonly<{type:'creation.action';commandId:string;actionRequest:CreationEquipCommand|CreationAttack|CreationDischargeCommand;actorPosition:CreationPoint;spaceId:string}>;
export type WildsCreationActionRecord=Readonly<{command:WildsCreationActionCommand;actorId:string;actorHead:string;ruleHead:string;kaiUPulse:number;definitions:Readonly<Record<string,CreationDefinition>>;predecessors:Readonly<Record<string,CreationInstance>>;successors:Readonly<Record<string,CreationInstance>>}>;
export const CREATION_WORLD_ACTION_RULE_HEAD=constructionProofDigest({id:'creation.world.action.v1',equipment:CREATION_EQUIPMENT_RULE_HEAD,damage:CREATION_DAMAGE_RULE_HEAD,reach:3,equipmentPickup:'independent-component',atomic:'weapon-and-target',maximumHistory:64});
export const CREATION_WORLD_GEAR_ACTION_RULE_HEAD=constructionProofDigest({id:'creation.world.action.v2',previous:CREATION_WORLD_ACTION_RULE_HEAD,gear:CREATION_GEAR_PROFILE_HEAD,occlusion:CREATION_RANGED_OCCLUSION_RULE_HEAD,maximumHistory:256,ranged:'exact-action-pose-ray-and-target-shape',miss:'wear-only',work:'wear-only-no-resource-authority',atomic:'gear-and-permitted-target'});
export const creationWorldActorHead=(world:WildsWorldProjection,actorId:string)=>constructionProofDigest({worldId:world.worldId,actorId,sourceHead:creationWorldSourceHead(world)});
function actionRules(command:WildsCreationActionCommand,instances:Readonly<Record<string,CreationInstance>>){
 const request=command.actionRequest,damage=request.action==='damage',use=request.action==='discharge'||request.action==='work';
 const equipment=damage&&'equipmentId'in request&&request.equipmentId?instances[request.equipmentId]:instances[request.instanceId];
 const node=equipment&&(damage?currentCreationEquipment(equipment,request.actorId):equipment.nodeStates[request.nodeId]);
 const profileId=node?.kind==='equipment'?node.actionProfileId:undefined,profile=profileId?creationEquipmentProfile(profileId):undefined;
 return {damage,use,profile,rule:damage?creationDamageRule(profileId):creationEquipmentRule(profileId),worldRule:profile?.mode?CREATION_WORLD_GEAR_ACTION_RULE_HEAD:CREATION_WORLD_ACTION_RULE_HEAD};
}
const actionTransition=(state:ReturnType<typeof emptyCreationState>,command:WildsCreationActionCommand,context:CreationAuthorityContext)=>command.actionRequest.action==='damage'?resolveCreationDamage(state,command.actionRequest as CreationAttack,context):['discharge','work'].includes(command.actionRequest.action)?dischargeCreationEquipment(state,command.actionRequest as CreationDischargeCommand,context):equipCreation(state,command.actionRequest as CreationEquipCommand,context);

/** Pure domain replay. The enclosing admitted world event authenticates these sources. */
export function verifyWorldCreationActionRecord(record:WildsCreationActionRecord){
 const {command,actorId,actorHead,kaiUPulse,predecessors,definitions}=record,request=command.actionRequest;
 const {damage,use,profile,rule,worldRule}=actionRules(command,predecessors);
 if(record.ruleHead!==worldRule)throw Error('creation_action_rule_binding_invalid');
 if(request.actorId!==actorId||request.operationId!==command.commandId||request.kaiUPulse!==kaiUPulse||request.expectedHeads[`actor:${actorId}`]!==actorHead||!validConstructionId(command.commandId))throw Error('creation_action_actor_binding_invalid');
 const target=predecessors[request.instanceId],definition=target&&definitions[target.definitionDigest],node=definition&&creationNodePoses(definition,target.pose).get(request.nodeId);
 if(!target||!node||target.spaceId!==command.spaceId||!command.actorPosition||Object.keys(command.actorPosition).sort().join(',')!=='x,y,z'||!Object.values(command.actorPosition).every(Number.isFinite)||!use&&!(damage&&profile?.mode)&&Math.hypot(node.position.x-command.actorPosition.x,node.position.y-command.actorPosition.y,node.position.z-command.actorPosition.z)>3)throw Error('creation_action_out_of_reach');
 const {id:ruleId,head:ruleHead}=rule;
 if(!damage&&!use&&!['equip','unequip'].includes(request.action))throw Error('creation_action_unsupported');
 if(request.action==='equip'){
  const fixed=definition.nodes.find(node=>node.id===request.nodeId)!;
  if(!profile?.mode&&(fixed.parentId||fixed.supports.length||definition.nodes.some(node=>node.parentId===fixed.id||node.supports.includes(fixed.id))))throw Error('creation_attached_equipment_pickup_unavailable');
 }
 if(damage){const attack=request as CreationAttack;if(!attack.equipment||attack.equipment.spaceId!==command.spaceId||constructionProofDigest(attack.equipment.position)!==constructionProofDigest(command.actorPosition)||constructionProofDigest(attack.equipment.targetPosition)!==constructionProofDigest(node.position))throw Error('creation_action_target_binding_invalid');}
 if(damage&&profile?.mode){
  const attack=request as CreationAttack,aim=attack.equipment?.aim;
  if(!['bow','rifle'].includes(profile.mode)||!validCreationAim(aim))throw Error('creation_action_aim_binding_invalid');
  const origin=creationEquipmentAimOrigin(command.actorPosition),distance=creationAimNodeDistance(definition,target.pose,request.nodeId,origin,aim,profile.range),point=attack.equipment?.hitPosition;
  if(distance===null||!validCreationPoint(point)||Math.hypot(point.x-origin.x-aim.direction.x*distance,point.y-origin.y-aim.direction.y*distance,point.z-origin.z-aim.direction.z*distance)>.00001)throw Error('creation_action_aim_binding_invalid');
 }
 if(use){const action=request as CreationDischargeCommand;if(action.equipment.spaceId!==command.spaceId||constructionProofDigest(action.equipment.position)!==constructionProofDigest(command.actorPosition)||constructionProofDigest(action.equipment.targetPosition)!==constructionProofDigest(command.actorPosition))throw Error('creation_action_target_binding_invalid');}
 const state={...emptyCreationState(),instances:predecessors,definitions,custody:Object.fromEntries(Object.values(predecessors).map(instance=>[instance.instanceId,instance.ownerId]))};
 const sources=[{id:`actor:${actorId}`,head:actorHead,kind:'actor'},{id:`rule:${ruleId}`,head:ruleHead,kind:'rule'},...Object.values(predecessors).map(instance=>({id:instance.instanceId,head:instance.head,kind:'creation'}))];
 const context:CreationAuthorityContext={actorId,rules:{[ruleId]:ruleHead},sources,mandates:[],verifySource:source=>sources.some(actual=>actual.id===source.id&&actual.head===source.head&&actual.kind===source.kind)};
 const transition=actionTransition(state,command,context);
 if(transition.status!=='proposed'||!transition.successorSources.length)throw Error(transition.status==='rejected'?transition.reason:'creation_action_no_effect');
 const successors=Object.fromEntries(Object.values(transition.state.instances).filter(instance=>instance.head!==predecessors[instance.instanceId]?.head).map(instance=>[instance.instanceId,instance]));
 if(constructionProofDigest(successors)!==constructionProofDigest(record.successors))throw Error('creation_action_successor_invalid');
 return successors;
}
export function resolveWorldCreationAction(world:WildsWorldProjection,command:WildsCreationActionCommand,actorId:string,kaiUPulse:number){
  const request=command.actionRequest,ids=[request.instanceId,...(request.action==='damage'&&'equipmentId' in request&&request.equipmentId?[request.equipmentId]:[])];
 if(request.action==='equip'&&Object.values(world.creations??{}).some(source=>source.instance.instanceId!==request.instanceId&&currentCreationEquipment(source.instance,actorId)))throw Error('creation_other_equipment_already_held');
 const sources=ids.map(id=>world.creations?.[id]);if(sources.some(source=>!source))throw Error('creation_action_current_source_unavailable');
 for(const source of sources)compileWorldCreationSource(source!);
 const predecessors=Object.fromEntries(sources.map(source=>[source!.instance.instanceId,source!.instance])),definitions=Object.fromEntries(sources.map(source=>[source!.command.definition.digest,source!.command.definition]));
 const actorHead=creationWorldActorHead(world,actorId);
 // Generate the proposal with current authenticated source heads, then verify the exact effect again.
 const {rule,worldRule}=actionRules(command,predecessors);
 for(const source of sources){const limit=worldRule===CREATION_WORLD_GEAR_ACTION_RULE_HEAD||source!.actions?.some(action=>action.record.ruleHead===CREATION_WORLD_GEAR_ACTION_RULE_HEAD)?256:64;if((source!.actions?.length??0)>=limit)throw Error('creation_action_history_limit');}
 assertCreationRangedHitUnoccluded(world,command);
 const provisional={command,actorId,actorHead,ruleHead:worldRule,kaiUPulse,predecessors,definitions,successors:{}};
 const {id:ruleId,head:ruleHead}=rule;
 const refs=[{id:`actor:${actorId}`,head:actorHead,kind:'actor'},{id:`rule:${ruleId}`,head:ruleHead,kind:'rule'},...Object.values(predecessors).map(instance=>({id:instance.instanceId,head:instance.head,kind:'creation'}))];
 const state={...emptyCreationState(),instances:predecessors,definitions,custody:Object.fromEntries(Object.values(predecessors).map(instance=>[instance.instanceId,instance.ownerId]))},context={actorId,rules:{[ruleId]:ruleHead},sources:refs,mandates:[],verifySource:(source:{id:string;head:string;kind:string})=>refs.some(ref=>constructionProofDigest(ref)===constructionProofDigest(source))};
 const transition=actionTransition(state,command,context);
 if(transition.status!=='proposed')throw Error(transition.reason);
 const successors=Object.fromEntries(Object.values(transition.state.instances).filter(instance=>instance.head!==predecessors[instance.instanceId]?.head).map(instance=>[instance.instanceId,instance]));
 const record={...provisional,successors};verifyWorldCreationActionRecord(record);
 const records:Record<string,WildsCreationSourceRecord>={};
 for(const [id,instance]of Object.entries(successors)){const before=world.creations![id],priorEvent=world.creationEvents?.[id];if(!priorEvent)throw Error('creation_action_event_source_unavailable');records[id]={...before,constructionInstance:before.constructionInstance??before.instance,instance,actions:[...(before.actions??[]),{record,priorEventId:priorEvent.eventId}]};}
 return {record,records};
}
