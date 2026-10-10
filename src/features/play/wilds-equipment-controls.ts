import type {CreationPoint} from './creation/types';
import type {WildsPlayerHand} from './WildsPlayerActionPad';
export type WildsEquipmentControls=Readonly<{id:string;mode:'bow'|'rifle'|'tool'|'melee';toolMode?:'axe'|'pickaxe'|'hoe';hand:WildsPlayerHand;label:string;durability:number;capacity:number}>;
export type WildsEquipmentControlState={aiming:boolean;drawingAt:number|null;shotAt:number;shotRange:number;shotKind:'bow'|'rifle';shotOrigin:CreationPoint;shotDirection:CreationPoint;aimDirection:{x:number;y:number;z:number};viewOrigin:{x:number;y:number;z:number}};
export function createWildsEquipmentControlState():WildsEquipmentControlState{return {aiming:false,drawingAt:null,shotAt:-Infinity,shotRange:0,shotKind:'rifle',shotOrigin:{x:0,y:0,z:0},shotDirection:{x:0,y:0,z:-1},aimDirection:{x:0,y:0,z:-1},viewOrigin:{x:0,y:1.25,z:0}};}
export function clearWildsEquipmentControlState(state:WildsEquipmentControlState){state.aiming=false;state.drawingAt=null;state.shotAt=-Infinity;}
export function wildsEquipmentHandLabel(hand:WildsPlayerHand,gear?:WildsEquipmentControls){
 if(gear?.mode==='rifle'||gear?.mode==='bow')return hand==='left'?'Aim':gear.mode==='bow'?'Draw bow':'Fire';
 return gear?.mode==='tool'&&gear.hand===hand?'Use tool':`${hand==='left'?'Left':'Right'} hand. Tap to strike; hold to grab`;
}
