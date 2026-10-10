import {selectWildsHandTarget} from '../wilds-player-actions';
import type {WildsWorldProjection} from '../wilds-world-state';
import {compileWorldCreationSource} from './world-source';
import {creationWorldActorHead,resolveWorldCreationAction,type WildsCreationActionCommand} from './world-action';
import {currentCreationEquipment,creationEquipmentProfile} from './equipment';
import {creationAimNodeDistance,creationEquipmentAimOrigin,validCreationAim,type CreationAim} from './equipment-aim';
import {creationNodePoses} from './projection';
import {heldCreationGearAssembly} from './equipment-profiles';
import {canAccessCreation} from './access';
import type {CreationPoint} from './types';

/** Action-time qualification from held current sources, never a frame scan or local adoption. */
export function prepareCreationHandAction(input:Readonly<{world:WildsWorldProjection;actorId:string;position:CreationPoint;spaceId:string;heading:number;kaiUPulse:number;operationId:string;intent:'grab'|'strike'|'shoot'|'use';aim?:CreationAim;excludedInstanceIds?:ReadonlySet<string>}>):WildsCreationActionCommand|null{
 const {world,actorId,position,spaceId,heading,kaiUPulse,operationId,intent}=input;
 const held=Object.values(world.creations??{}).find(source=>!input.excludedInstanceIds?.has(source.instance.instanceId)&&currentCreationEquipment(source.instance,actorId));
 const equipment=held&&currentCreationEquipment(held.instance,actorId);
 const profile=equipment&&creationEquipmentProfile(equipment.actionProfileId);
 if(intent==='shoot'||intent==='use'){
  if(!held||!equipment||!profile?.mode||intent==='shoot'&&(!['bow','rifle'].includes(profile.mode)||!validCreationAim(input.aim))||intent==='use'&&profile.kind!=='tool')return null;
  const expectedHeads={[held.instance.instanceId]:held.instance.head,[`actor:${actorId}`]:creationWorldActorHead(world,actorId)};
  const common={operationId,actorId,instanceId:held.instance.instanceId,nodeId:equipment.nodeId,expectedHeads,kaiUPulse};
  const command:WildsCreationActionCommand={type:'creation.action',commandId:operationId,actorPosition:position,spaceId,actionRequest:{...common,action:intent==='shoot'?'discharge':'work',equipment:{actionId:operationId,actorId,expectedHead:held.instance.head,targetId:held.instance.instanceId,targetHead:held.instance.head,spaceId,position,targetPosition:position,kaiUPulse,...(input.aim?{aim:input.aim}:{})}}};
  if(intent==='shoot'){
   let nearest=Infinity,target:WildsCreationActionCommand|null=null;
   for(const source of Object.values(world.creations??{})){
    const instance=source.instance;if(input.excludedInstanceIds?.has(instance.instanceId)||instance.instanceId===held.instance.instanceId||instance.spaceId!==spaceId||instance.stage==='destroyed'||heldCreationGearAssembly(instance))continue;
    const poses=creationNodePoses(source.command.definition,instance.pose);
    for(const node of Object.values(instance.nodeStates)){
     if(node.condition<=0||node.kind==='equipment'&&node.equippedBy)continue;
     const distance=creationAimNodeDistance(source.command.definition,instance.pose,node.nodeId,creationEquipmentAimOrigin(position),input.aim!,profile.range);
     if(distance===null||distance>=nearest)continue;
     nearest=distance;target=null;
     if(!canAccessCreation(instance,actorId,'demolish',kaiUPulse))continue;
     const nodePosition=poses.get(node.nodeId)!.position;
     const origin=creationEquipmentAimOrigin(position),direction=input.aim!.direction;
     const hit:WildsCreationActionCommand={type:'creation.action',commandId:operationId,actorPosition:position,spaceId,actionRequest:{...common,instanceId:instance.instanceId,nodeId:node.nodeId,expectedHeads:{...expectedHeads,[instance.instanceId]:instance.head},action:'damage',equipmentId:held.instance.instanceId,equipment:{actionId:operationId,actorId,expectedHead:held.instance.head,targetId:instance.instanceId,targetHead:instance.head,spaceId,position,targetPosition:nodePosition,kaiUPulse,aim:input.aim,hitPosition:{x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance}}}};
     try{resolveWorldCreationAction(world,hit,actorId,kaiUPulse);target=hit;}catch{/* Occluding invalid targets remain blocking geometry. */}
    }
   }
   if(target)return target;
  }
  try{resolveWorldCreationAction(world,command,actorId,kaiUPulse);return command;}catch{return null;}
 }
 if(intent==='strike'&&(!held||!equipment||profile?.kind!=='weapon'))return null;
 const candidates:Array<{id:string;x:number;y:number;z:number;spaceId:string;qualified:boolean;command:WildsCreationActionCommand}>=[];
 for(const source of Object.values(world.creations??{})){
  const instance=source.instance;
  if(input.excludedInstanceIds?.has(instance.instanceId)||instance.spaceId!==spaceId||instance.stage==='destroyed'||heldCreationGearAssembly(instance))continue;
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
