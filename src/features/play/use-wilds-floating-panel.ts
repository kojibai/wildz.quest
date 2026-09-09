"use client";
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent,type KeyboardEvent} from "react";
export function useWildsFloatingPanel() {
  const ref=useRef<HTMLElement>(null);
  const [position,setPosition]=useState<{x:number;y:number}|null>(null);
  const drag=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null);
  const place=(x:number,y:number)=>{
    const box=ref.current?.getBoundingClientRect();
    setPosition({x:Math.max(8,Math.min(window.innerWidth-(box?.width??300)-8,x)),y:Math.max(8,Math.min(window.innerHeight-(box?.height??80)-8,y))});
  };
  useEffect(()=>{
    const resize=()=>setPosition(current=>{
      if(!current)return current;
      const box=ref.current?.getBoundingClientRect();
      return {x:Math.max(8,Math.min(window.innerWidth-(box?.width??300)-8,current.x)),y:Math.max(8,Math.min(window.innerHeight-(box?.height??80)-8,current.y))};
    });
    window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);
  },[]);
  return {ref,style:position?{position:"fixed",left:position.x,top:position.y,right:"auto",bottom:"auto"} as CSSProperties:undefined,handle:{
    onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{if(event.button!==0)return;const box=ref.current?.getBoundingClientRect();if(!box)return;event.preventDefault();event.stopPropagation();drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top};event.currentTarget.setPointerCapture(event.pointerId);},
    onPointerMove:(event:PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d||d.id!==event.pointerId)return;event.stopPropagation();place(d.left+event.clientX-d.x,d.top+event.clientY-d.y);},
    onPointerUp:(event:PointerEvent<HTMLButtonElement>)=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);},
    onPointerCancel:()=>{drag.current=null;},
    onDoubleClick:()=>setPosition(null),
    onKeyDown:(event:KeyboardEvent<HTMLButtonElement>)=>{const box=ref.current?.getBoundingClientRect();if(event.key==="Home"){setPosition(null);event.preventDefault();return;}if(!box||!event.key.startsWith("Arrow"))return;event.preventDefault();place(box.left+(event.key==="ArrowRight"?20:event.key==="ArrowLeft"?-20:0),box.top+(event.key==="ArrowDown"?20:event.key==="ArrowUp"?-20:0));}
  }};
}
