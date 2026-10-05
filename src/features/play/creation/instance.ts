import {assertCreationData,parseCreationDefinition} from './definition';
import {constructionProofDigest,sealConstructionProof,validConstructionHead,validConstructionKai} from '../wilds-construction-project';
import type { CreationDefinition, CreationPose } from './types';
export type CreationAccessAction='visit'|'inhabit'|'use'|'harvest'|'edit'|'demolish';
export type CreationAccessPolicy=Readonly<Record<CreationAccessAction,Readonly<{mode:'owner'|'public'|'invited';subjects:readonly string[]}>>>;
type Common=Readonly<{version:1;nodeId:string;condition:number;supportIds:readonly string[]}>;
export type CreationNodeState=Common & (
 {kind:'condition'}|{kind:'storage';capacity:number;lotIds:readonly string[]}|
 {kind:'bed'|'habitat';occupantIds:readonly string[];capacity:number}|
 {kind:'equipment';equipmentKind:'tool'|'weapon';capabilityId:string;durability:number;capacity:number;mass:number;actionProfileId:string;equippedBy:string|null}|
 {kind:'garden';planted:number;waterUnits:number;fertility:number;produce:number;lastGrowthKaiUPulse:number}|
 {kind:'joint'|'actuator';position:number;minimum:number;maximum:number}|
 {kind:'sensor';signal:boolean;targetIds:readonly string[]}|
 {kind:'logic';counter:number;limit:number;targetIds:readonly string[];consumedEventIds:readonly string[]}|
 {kind:'environment'|'space';sourceRefs:readonly string[]});
export type CreationInstance=Readonly<{schema:'wildz.creation-instance.v1';instanceId:string;definitionDigest:string;creatorId:string;ownerId:string;stewardId:string;worldId:string;spaceId:string;pose:CreationPose;revision:number;parentHead:string|null;head:string;nodeStates:Readonly<Record<string,CreationNodeState>>;embeddedResources:readonly Readonly<{id:string;head:string;kind:string;quantity:number}>[];access:CreationAccessPolicy;stage:'planned'|'building'|'functional'|'finished'|'destroyed';kaiUPulse:number}>;
const accessActions:readonly CreationAccessAction[]=['visit','inhabit','use','harvest','edit','demolish'];
function text(value:unknown):value is string{return typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=512;}
function integer(value:unknown,max=1_000_000):value is number{return Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=max;}
function exact(value:object,keys:readonly string[]){return Object.keys(value).sort().join(',')===[...keys].sort().join(',');}
function refs(value:unknown,max=4096):value is readonly string[]{return Array.isArray(value)&&value.length<=max&&value.every(text)&&new Set(value).size===value.length;}
export function validateCreationNodeState(value:CreationNodeState):void{
 assertCreationData(value);
 if(!value||value.version!==1||!text(value.nodeId)||!integer(value.condition,100)||!refs(value.supportIds,128))throw Error('creation_component_invalid');
 const common=['kind','version','nodeId','condition','supportIds'];let fields:string[]=[];let valid=false;
 switch(value.kind){
  case 'condition':valid=true;break;
  case 'storage':fields=['capacity','lotIds'];valid=integer(value.capacity)&&refs(value.lotIds)&&value.lotIds.length<=value.capacity;break;
  case 'bed':case 'habitat':fields=['occupantIds','capacity'];valid=integer(value.capacity,128)&&refs(value.occupantIds,128)&&value.occupantIds.length<=value.capacity;break;
  case 'equipment':fields=['equipmentKind','capabilityId','durability','capacity','mass','actionProfileId','equippedBy'];valid=['tool','weapon'].includes(value.equipmentKind)&&text(value.capabilityId)&&text(value.actionProfileId)&&integer(value.durability)&&integer(value.capacity)&&value.durability<=value.capacity&&Number.isFinite(value.mass)&&value.mass>0&&value.mass<=1_000_000&&(value.equippedBy===null||text(value.equippedBy));break;
  case 'garden':fields=['planted','waterUnits','fertility','produce','lastGrowthKaiUPulse'];valid=[value.planted,value.waterUnits,value.produce].every(n=>integer(n))&&integer(value.fertility,100)&&validConstructionKai(value.lastGrowthKaiUPulse);break;
  case 'joint':case 'actuator':fields=['position','minimum','maximum'];valid=[value.position,value.minimum,value.maximum].every(Number.isFinite)&&value.minimum>=-4096&&value.maximum<=4096&&value.minimum<=value.position&&value.position<=value.maximum;break;
  case 'sensor':fields=['signal','targetIds'];valid=typeof value.signal==='boolean'&&refs(value.targetIds,128);break;
  case 'logic':fields=['counter','limit','targetIds','consumedEventIds'];valid=integer(value.counter)&&integer(value.limit)&&value.counter<=value.limit&&refs(value.targetIds,128)&&refs(value.consumedEventIds,4096);break;
  case 'environment':case 'space':fields=['sourceRefs'];valid=refs(value.sourceRefs,128);break;
 }
 if(!valid||!exact(value,[...common,...fields]))throw Error('creation_component_invalid');
}
function validateBasis(value:Omit<CreationInstance,'head'>):void{
 assertCreationData(value);
 if(!value||!exact(value,['schema','instanceId','definitionDigest','creatorId','ownerId','stewardId','worldId','spaceId','pose','revision','parentHead','nodeStates','embeddedResources','access','stage','kaiUPulse'])||value.schema!=='wildz.creation-instance.v1'||![value.instanceId,value.creatorId,value.ownerId,value.stewardId,value.worldId,value.spaceId].every(text)||!validConstructionHead(value.definitionDigest)||!validConstructionKai(value.kaiUPulse)||!integer(value.revision,Number.MAX_SAFE_INTEGER)||(value.revision===0?value.parentHead!==null:!validConstructionHead(value.parentHead))||!['planned','building','functional','finished','destroyed'].includes(value.stage)||!value.pose||!exact(value.pose,['position','yaw'])||!exact(value.pose.position,['x','y','z'])||![value.pose.position.x,value.pose.position.y,value.pose.position.z,value.pose.yaw].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e9))throw Error('creation_instance_invalid');
 if(!value.nodeStates||Array.isArray(value.nodeStates)||Object.keys(value.nodeStates).length===0||Object.keys(value.nodeStates).length>16384)throw Error('creation_component_invalid');
 const nodeIds=new Set(Object.values(value.nodeStates).map(n=>n.nodeId));
 for(const [id,node] of Object.entries(value.nodeStates)){if(!text(id))throw Error('creation_component_invalid');validateCreationNodeState(node);if(node.supportIds.some(id=>!nodeIds.has(id))||(('targetIds'in node)&&node.targetIds.some(id=>!Object.hasOwn(value.nodeStates,id))))throw Error('creation_component_target_invalid');}
 if(!Array.isArray(value.embeddedResources)||value.embeddedResources.length>65536||new Set(value.embeddedResources.map(r=>r.id)).size!==value.embeddedResources.length||value.embeddedResources.some(r=>!exact(r,['id','head','kind','quantity'])||!text(r.id)||!validConstructionHead(r.head)||!text(r.kind)||!integer(r.quantity)||r.quantity===0))throw Error('creation_resources_invalid');
 if(!value.access||!exact(value.access,accessActions)||accessActions.some(action=>{const policy=value.access[action];return !policy||!exact(policy,['mode','subjects'])||!['owner','public','invited'].includes(policy.mode)||!refs(policy.subjects,128)||(policy.mode!=='invited'&&policy.subjects.length>0);}))throw Error('creation_access_invalid');
}
/** Structural seal only. This does not authenticate a source or admit physical state. */
export function sealCreationInstance(basis:Omit<CreationInstance,'head'>):CreationInstance{validateBasis(basis);return sealConstructionProof(basis);}
export function verifyCreationInstance(value:unknown):value is CreationInstance{try{assertCreationData(value);const instance=value as CreationInstance;if(!instance||!validConstructionHead(instance.head))return false;const {head,...basis}=instance;validateBasis(basis);return head===constructionProofDigest(basis);}catch{return false;}}
export function createCreationInstance(input:Readonly<{instanceId:string;definition:CreationDefinition;ownerId:string;worldId:string;spaceId:string;pose:CreationPose;kaiUPulse:number}>):CreationInstance{
 const definition=parseCreationDefinition(input.definition),nodeStates:Record<string,CreationNodeState>={};
 for(const node of definition.nodes)nodeStates[node.id]={kind:'condition',version:1,nodeId:node.id,condition:100,supportIds:node.supports};
 const owner={mode:'owner' as const,subjects:[]};
 const access:CreationAccessPolicy={visit:{mode:'public',subjects:[]},inhabit:owner,use:owner,harvest:owner,edit:owner,demolish:owner};
 return sealCreationInstance({schema:'wildz.creation-instance.v1',instanceId:input.instanceId,definitionDigest:definition.digest,creatorId:definition.creatorId,ownerId:input.ownerId,stewardId:input.ownerId,worldId:input.worldId,spaceId:input.spaceId,pose:input.pose,revision:0,parentHead:null,nodeStates,embeddedResources:[],access,stage:'planned',kaiUPulse:input.kaiUPulse});
}
