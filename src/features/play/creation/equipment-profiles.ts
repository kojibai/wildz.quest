import {constructionProofDigest} from '../wilds-construction-project';
import type {CreationInstance} from './instance';
import type {CreationDefinition} from './types';

export type CreationEquipmentProfile=Readonly<{kind:'tool'|'weapon';damage:number;range:number;recoveryKaiUPulse:number;wear:number;work:number;mode?:'bow'|'rifle'|'axe'|'pickaxe'|'hoe';label?:string}>;
/** Frozen legacy law. Its digest must continue to replay old admitted gear. */
export const CREATION_EQUIPMENT_PROFILES=Object.freeze({
 'creation.timber.tool.v1':{kind:'tool',damage:0,range:2.5,recoveryKaiUPulse:1000000,wear:1,work:1},
 'creation.stone.tool.v1':{kind:'tool',damage:0,range:2.5,recoveryKaiUPulse:1000000,wear:1,work:2},
 'creation.timber.weapon.v1':{kind:'weapon',damage:4,range:2.5,recoveryKaiUPulse:1000000,wear:1,work:0},
 'creation.stone.weapon.v1':{kind:'weapon',damage:8,range:2,recoveryKaiUPulse:1500000,wear:2,work:0}
});
export const CREATION_GEAR_PROFILES:Readonly<Record<string,CreationEquipmentProfile>>=Object.freeze({
 'creation.bow.weapon.v2':Object.freeze({kind:'weapon',mode:'bow',label:'Trail bow',damage:12,range:32,recoveryKaiUPulse:140000,wear:2,work:0}),
 'creation.trail-rifle.weapon.v2':Object.freeze({kind:'weapon',mode:'rifle',label:'Trail rifle',damage:16,range:56,recoveryKaiUPulse:65000,wear:3,work:0}),
 'creation.axe.tool.v2':Object.freeze({kind:'tool',mode:'axe',label:'Wood axe',damage:0,range:2.5,recoveryKaiUPulse:160000,wear:1,work:2}),
 'creation.pickaxe.tool.v2':Object.freeze({kind:'tool',mode:'pickaxe',label:'Stone pick',damage:0,range:2.5,recoveryKaiUPulse:230000,wear:1,work:2}),
 'creation.hoe.tool.v2':Object.freeze({kind:'tool',mode:'hoe',label:'Garden hoe',damage:0,range:2.5,recoveryKaiUPulse:160000,wear:1,work:1})
});
export function creationEquipmentProfile(id:string):CreationEquipmentProfile|undefined {
 return CREATION_GEAR_PROFILES[id]??(CREATION_EQUIPMENT_PROFILES as Readonly<Record<string,CreationEquipmentProfile>>)[id];
}
export function creationEquipmentProfileId(kind:'tool'|'weapon',material:string,variant:unknown):string {
 if(variant===undefined)return `creation.${material}.${kind}.v1`;
 const id=`creation.${variant}.${kind}.v2`,profile=CREATION_GEAR_PROFILES[id];
 if(typeof variant!=='string'||!profile||profile.kind!==kind)throw Error('creation_equipment_profile_unavailable');
 return id;
}
export function hasCreationGearProfile(definition:CreationDefinition){return definition.nodes.some(n=>n.behaviors.some(b=>['tool','weapon'].includes(b.id)&&b.parameters.equipment!==undefined));}
export const CREATION_GEAR_PROFILE_HEAD=constructionProofDigest({id:'creation.gear.profiles.v2',profiles:CREATION_GEAR_PROFILES,parameters:'registered-equipment-choice-only'});

/** Mirrors portable assembly visibility; carried decorative nodes never remain at the pickup pose. */
export function heldCreationGearAssembly(instance:CreationInstance){return Object.values(instance.nodeStates).some(node=>node.kind==='equipment'&&Boolean(node.equippedBy)&&Boolean(CREATION_GEAR_PROFILES[node.actionProfileId]));}
