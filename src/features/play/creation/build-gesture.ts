import { COMPANION_DRAWER_PX, COMPANION_TAP_SLOP_PX } from '../companion-command-gesture';
export function creationBuildGesture(origin:{x:number;y:number},point:{x:number;y:number}):'open'|'cancel' {
 const dx=point.x-origin.x,dy=point.y-origin.y;
 return Math.hypot(dx,dy)<=COMPANION_TAP_SLOP_PX||(dy<=-COMPANION_DRAWER_PX&&Math.abs(dy)>Math.abs(dx)*1.2)?'open':'cancel';
}
