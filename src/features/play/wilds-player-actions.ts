import type {WildsPlayerHand, WildsPlayerHandIntent} from './WildsPlayerActionPad';

export type WildsHandAction = {intent: WildsPlayerHandIntent; startedAt: number; heading?: number};
export type WildsHandActionState = Record<WildsPlayerHand, WildsHandAction | null>;
export const createWildsHandActionState = (): WildsHandActionState => ({left:null,right:null});
/** Presentation preference only; equipped custody still comes from the admitted source. */
export function readWildsEquipmentHand(ownerId:string):WildsPlayerHand{
 try{const hand=globalThis.sessionStorage.getItem(`wildz:equipment-hand:v1:${ownerId}`);return hand==='left'?'left':'right';}catch{return 'right';}
}
export function rememberWildsEquipmentHand(ownerId:string,hand:WildsPlayerHand){
 try{globalThis.sessionStorage.setItem(`wildz:equipment-hand:v1:${ownerId}`,hand);}catch{/* An unavailable view preference never changes custody or admission. */}
}
export function beginWildsHandAction(state:WildsHandActionState, hand:WildsPlayerHand, intent:WildsPlayerHandIntent, now:number) {
 const current=state[hand],duration=current?.intent==='grab'?680:440;
 if (!Number.isFinite(now) || current && now-current.startedAt<duration) return false;
 state[hand]={intent,startedAt:now};return true;
}
export function sampleWildsHandPose(action:WildsHandAction|null,now:number) {
 const duration=action?.intent==='grab'?680:440, t=action?(now-action.startedAt)/duration:1;
 if(t<0||t>=1||!Number.isFinite(t))return {weight:0,shoulderX:0,elbowX:0,wristY:0};
 // Anticipation, extension and recovery are continuous; idle orientation is untouched.
 const weight=Math.sin(Math.PI*t), extension=action?.intent==='grab'?Math.sin(Math.PI*t)**.55:Math.sin(Math.PI*Math.min(1,t*1.3));
 return {weight,shoulderX:1.45*extension,elbowX:action?.intent==='grab'?-.36*weight:-.85*(1-extension)*weight,wristY:action?.intent==='grab'?.4*weight:1.15*weight};
}
export type WildsHandTarget={id:string;x:number;y:number;z:number;spaceId:string;qualified:boolean};
/** Action-time targeting only. Qualification still belongs to the actual source admission. */
export function selectWildsHandTarget<T extends WildsHandTarget>(actor:{x:number;y:number;z:number;spaceId:string;heading:number},candidates:readonly T[],reach:number):T|null {
 let selected:T|null=null,nearest=Infinity;
 for(const target of candidates){
  if(!target.qualified||target.spaceId!==actor.spaceId||Math.abs(target.y-actor.y)>1.8)continue;
  const dx=target.x-actor.x,dz=target.z-actor.z,distance=Math.hypot(dx,target.y-actor.y,dz);
  if(!Number.isFinite(distance)||distance>reach||distance>=nearest)continue;
  const horizontal=Math.hypot(dx,dz),forward=dx*-Math.sin(actor.heading)+dz*-Math.cos(actor.heading);
  if(horizontal>.35&&forward/horizontal<-.15)continue;
  selected=target;nearest=distance;
 }
 return selected;
}
