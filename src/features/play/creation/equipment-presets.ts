import {createCreationDefinition} from './definition';
import type {CreationNode,CreationShape} from './types';
export type CreationGearPreset='bow'|'trail-rifle'|'axe'|'pickaxe'|'hoe';
export const CREATION_GEAR_PRESETS:readonly Readonly<{id:CreationGearPreset;label:string;description:string}>[]=[
 {id:'bow',label:'Trail bow',description:'Hold to draw · release to shoot'},
 {id:'trail-rifle',label:'Trail rifle',description:'Aim · tap or hold to fire'},
 {id:'axe',label:'Wood axe',description:'Work timber with your crew'},
 {id:'pickaxe',label:'Stone pick',description:'Work stone with your crew'},
 {id:'hoe',label:'Garden hoe',description:'Gather and tend with your crew'}
];
/** A draft only: the normal quote, crew, finite material and build admission still apply. */
export function createGearDefinition(input:{creatorId:string;seed:string;kind:CreationGearPreset}){
 const tool=!['bow','trail-rifle'].includes(input.kind);
 const node=(id:string,shape:CreationShape,position:{x:number;y:number;z:number},material='timber',equipment=false):CreationNode=>({id,parentId:null,pose:{position,yaw:0},shape,material,attachments:[],supports:[],behaviors:equipment?[{id:tool?'tool':'weapon',version:1,parameters:{equipment:input.kind}}]:[]});
 let nodes:CreationNode[];
 if(input.kind==='bow')nodes=[node('bow',{kind:'arch',width:.65,height:1.15,depth:.08,thickness:.035},{x:0,y:0,z:0},'timber',true)];
 else if(input.kind==='trail-rifle')nodes=[node('body',{kind:'box',width:.13,height:.16,depth:.65},{x:0,y:.25,z:0},'timber',true),node('stock',{kind:'box',width:.12,height:.25,depth:.24},{x:0,y:.15,z:.42}),node('barrel',{kind:'box',width:.07,height:.07,depth:.6},{x:0,y:.3,z:-.56},'stone'),node('sight',{kind:'box',width:.03,height:.07,depth:.08},{x:0,y:.42,z:-.38},'stone')];
 else nodes=[node('handle',{kind:'cylinder',width:.065,height:.8,depth:.065},{x:0,y:0,z:0}),node('head',{kind:'box',width:input.kind==='pickaxe'?.52:.28,height:.15,depth:input.kind==='hoe'?.3:.09},{x:0,y:.73,z:input.kind==='hoe'?-.1:0},'stone',true)];
 return createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,creatorId:input.creatorId,seed:input.seed,assets:[],nodes});
}
