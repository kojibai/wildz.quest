import {selectWildsHandTarget} from '../wilds-player-actions';
import type {WildsWorldProjection} from '../wilds-world-state';
import {compileWorldCreationSource} from './world-source';
import {creationWorldActorHead,resolveWorldCreationAction,type WildsCreationActionCommand} from './world-action';
import {currentCreationEquipment,CREATION_EQUIPMENT_PROFILES} from './equipment';
import {creationNodePoses} from './projection';
import {canAccessCreation} from './access';
import type {CreationPoint} from './types';

/** Action-time qualification from held current sources, never a frame scan or local adoption. */
export function prepareCreationHandAction(input:Readonly<{world:WildsWorldProjection;actorId:string;position:CreationPoint;spaceId:string;heading:number;kaiUPulse:number;operationId:string;intent:'grab'|'strike';excludedInstanceIds?:ReadonlySet<string>}>):WildsCreationActionCommand|null{
 const {world,actorId,position,spaceId,heading,kaiUPulse,operationId,intent}=input;
 const held=Object.values(world.creations??{}).find(source=>!input.excludedInstanceIds?.has(source.instance.instanceId)&&currentCreationEquipment(source.instance,actorId));
 const equipment=held&&currentCreationEquipment(held.instance,actorId);
 const profile=equipment&&CREATION_EQUIPMENT_PROFILES[equipment.actionProfileId as keyof typeof CREATION_EQUIPMENT_PROFILES];
 if(intent==='strike'&&(!held||!equipment||profile?.kind!=='weapon'))return null;
 const candidates:Array<{id:string;x:number;y:number;z:number;spaceId:string;qualified:boolean;command:WildsCreationActionCommand}>=[];
 for(const source of Object.values(world.creations??{})){
  const instance=source.instance;
  if(input.excludedInstanceIds?.has(instance.instanceId)||instance.spaceId!==spaceId||instance.stage==='destroyed')continue;
  const poses=creationNodePoses(source.command.definition,instance.pose);
  let checked=false;
  for(const node of Object.values(instance.nodeStates)){
   if(node.condition<=0)continue;
   if(intent==='grab'&&(held||instance.ownerId!==actorId||node.kind!=='equipment'||node.equippedBy||node.durability<=0))continue;
   if(intent==='strike'&&(instance.instanceId===held!.instance.instanceId||!canAccessCreation(instance,actorId,'demolish',kaiUPulse)))continue;
   const targetPosition=poses.get(node.nodeId)?.position;if(!targetPosition)continue;
   if(!selectWildsHandTarget({...position,spaceId,heading},[{...targetPosition,id:node.nodeId,spaceId,qualified:true}],intent==='strike'?profile!.range:3))continue;
   if(!checked){try{compileWorldCreationSource(source);checked=true;}catch{break;}}
   const expectedHeads={[instance.instanceId]:instance.head,[`actor:${actorId}`]:creationWorldActorHead(world,actorId),...(intent==='strike'?{[held!.instance.instanceId]:held!.instance.head}:{})};
   const common={operationId,actorId,instanceId:instance.instanceId,nodeId:node.nodeId,expectedHeads,kaiUPulse};
   const command:WildsCreationActionCommand={type:'creation.action',commandId:operationId,actorPosition:position,spaceId,actionRequest:intent==='grab'?{...common,action:'equip',slot:'hand'}:{...common,action:'damage',equipmentId:held!.instance.instanceId,equipment:{actionId:operationId,actorId,expectedHead:held!.instance.head,targetId:instance.instanceId,targetHead:instance.head,spaceId,position,targetPosition,kaiUPulse}}};
   // Recovery, wear, access, exact source heads and collapse participants are law checks.
   try{resolveWorldCreationAction(world,command,actorId,kaiUPulse);candidates.push({...targetPosition,id:`${instance.instanceId}:${node.nodeId}`,spaceId,qualified:true,command});}catch{/* No actionable candidate. */}
  }
 }
 return selectWildsHandTarget({...position,spaceId,heading},candidates,intent==='strike'?profile!.range:3)?.command??null;
}
