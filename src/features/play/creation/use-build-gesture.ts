'use client';
import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { creationBuildGesture } from './build-gesture';
export function useBuildGesture(open:()=>void,cancelSignal:number) {
 const active=useRef<{id:number;x:number;y:number}|null>(null), suppressClick=useRef(false);
 const cancel=()=>{active.current=null;suppressClick.current=true;};
 useEffect(()=>{active.current=null;suppressClick.current=false;},[cancelSignal]);
 useEffect(()=>{const stop=()=>{active.current=null;suppressClick.current=true;};window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);return ()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};},[]);
 return {
  onPointerDown(event:PointerEvent<HTMLButtonElement>){if(event.button!==0||active.current)return;active.current={id:event.pointerId,x:event.clientX,y:event.clientY};suppressClick.current=false;try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}},
  onPointerUp(event:PointerEvent<HTMLButtonElement>){const start=active.current;if(!start||start.id!==event.pointerId)return;active.current=null;suppressClick.current=true;if(creationBuildGesture(start,{x:event.clientX,y:event.clientY})==='open')open();},
  onPointerCancel:cancel,
  onLostPointerCapture(){if(active.current)cancel();},
  onClick(event:MouseEvent<HTMLButtonElement>){if(event.detail!==0&&suppressClick.current){suppressClick.current=false;event.preventDefault();return;}open();}
 };
}
