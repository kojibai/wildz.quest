import { COMPANION_DRAWER_PX, COMPANION_TAP_SLOP_PX } from '../companion-command-gesture';
export function creationBuildGesture(origin:{x:number;y:number},point:{x:number;y:number}):'open'|'cancel' {
 const dx=point.x-origin.x,dy=point.y-origin.y;
 return Math.hypot(dx,dy)<=COMPANION_TAP_SLOP_PX||(dy<=-COMPANION_DRAWER_PX&&Math.abs(dy)>Math.abs(dx)*1.2)?'open':'cancel';
}

/** Pointer release and its native click are one action; application cancellation fences both. */
export function createCreationBuildGesture() {
 let active: { id: number; x: number; y: number } | null = null;
 const cancel = () => { active = null; };
 return {
  start(id: number, point: { x: number; y: number }, button: number) {
   if (button !== 0 || active) return false;
   active = { id, ...point };
   return true;
  },
  release(id: number, point: { x: number; y: number }): 'tap' | 'swipe' | null {
   const origin = active;
   if (!origin || origin.id !== id) return null;
   active = null;
   if (creationBuildGesture(origin, point) !== 'open') return null;
   return Math.hypot(point.x - origin.x, point.y - origin.y) <= COMPANION_TAP_SLOP_PX ? 'tap' : 'swipe';
  },
  click(detail: number): 'tap' | null { return detail === 0 ? 'tap' : null; },
  cancel,
  lostCapture() { if (active) cancel(); }
 };
}
