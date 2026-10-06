'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { clampPanelPosition, type PanelPoint } from './panel-position';
export function usePanelPosition() {
 const ref=useRef<HTMLElement>(null), [position,setPosition]=useState<PanelPoint|null>(null);
 const drag=useRef<{id:number;start:PanelPoint;origin:PanelPoint}|null>(null);
 const move=useCallback((point:PanelPoint)=>{const rect=ref.current?.getBoundingClientRect();if(rect)setPosition(clampPanelPosition(point,rect,{width:window.innerWidth,height:window.innerHeight}));},[]);
 const stop=useCallback(()=>{drag.current=null;},[]);
 useEffect(()=>{window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);return ()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};},[stop]);
 useEffect(()=>{let width=window.innerWidth;const resize=()=>{const widthChanged=width!==window.innerWidth;width=window.innerWidth;if(position&&(widthChanged||!ref.current?.contains(document.activeElement)))move(position);};window.addEventListener('resize',resize);return ()=>window.removeEventListener('resize',resize);},[position,move]);
 const onPointerDown=(event:PointerEvent<HTMLElement>)=>{if(event.button!==0||drag.current)return;const rect=ref.current?.getBoundingClientRect();if(!rect)return;event.preventDefault();event.stopPropagation();drag.current={id:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:{x:rect.x,y:rect.y}};event.currentTarget.setPointerCapture(event.pointerId);};
 const onPointerMove=(event:PointerEvent<HTMLElement>)=>{const current=drag.current;if(!current||current.id!==event.pointerId)return;move({x:current.origin.x+event.clientX-current.start.x,y:current.origin.y+event.clientY-current.start.y});};
 const onPointerUp=(event:PointerEvent<HTMLElement>)=>{if(drag.current?.id!==event.pointerId)return;stop();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);};
 const onKeyDown=(event:KeyboardEvent<HTMLElement>)=>{const rect=ref.current?.getBoundingClientRect();if(!rect)return;const offsets:Record<string,PanelPoint>={ArrowLeft:{x:-16,y:0},ArrowRight:{x:16,y:0},ArrowUp:{x:0,y:-16},ArrowDown:{x:0,y:16}};if(event.key==='Home'){event.preventDefault();setPosition(null);}else if(offsets[event.key]){event.preventDefault();move({x:rect.x+offsets[event.key].x,y:rect.y+offsets[event.key].y});}};
 const style:CSSProperties|undefined=position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:undefined;
 return {ref,style,handle:{onPointerDown,onPointerMove,onPointerUp,onPointerCancel:stop,onLostPointerCapture:stop,onKeyDown}};
}
