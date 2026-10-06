'use client';
import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { createCreationBuildGesture } from './build-gesture';
export function useBuildGesture(open:()=>void,cancelSignal:number,tap:()=>void=open) {
 const controller = useRef<ReturnType<typeof createCreationBuildGesture> | null>(null);
 if (!controller.current) controller.current = createCreationBuildGesture();
 const gesture = controller.current;
 useEffect(()=>gesture.cancel(),[cancelSignal,gesture]);
 useEffect(()=>{const stop=()=>gesture.cancel();window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);return ()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};},[gesture]);
 return {
  onPointerDown(event:PointerEvent<HTMLButtonElement>){if(!gesture.start(event.pointerId,{x:event.clientX,y:event.clientY},event.button))return;try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}},
  onPointerUp(event:PointerEvent<HTMLButtonElement>){const action=gesture.release(event.pointerId,{x:event.clientX,y:event.clientY});if(action==='tap')tap();else if(action==='swipe')open();},
  onPointerCancel:()=>gesture.cancel(),
  onLostPointerCapture:()=>gesture.lostCapture(),
  onClick(event:MouseEvent<HTMLButtonElement>){if(gesture.click(event.detail)==='tap')tap();else event.preventDefault();}
 };
}
