"use client";
import {useRef,type PointerEvent} from "react";
import {Html} from "@react-three/drei";
import {MoveVertical,RotateCw} from "lucide-react";
import type {WildsConstructionComponentV1} from "./wilds-construction-component";
import type {WildsConstructionDragHandler} from "./WildsContinuousConstruction";

export function WildsConstructionGestureHandles({component,onDrag}:{component:WildsConstructionComponentV1;onDrag:WildsConstructionDragHandler}) {
  const root=useRef<HTMLDivElement>(null);
  const gesture=useRef<{id:number;mode:"rotate"|"height";startY:number;angle:number;total:number;rotation:number;height:number;cx:number;cy:number;moved:boolean}|null>(null);
  const point={...component.evidence.pointer,surfaceWorldY:component.evidence.pointer.y};
  const begin=(mode:"rotate"|"height",event:PointerEvent<HTMLButtonElement>)=>{
    if(gesture.current)return;event.stopPropagation();event.preventDefault();const box=root.current!.getBoundingClientRect();
    const cx=box.left+box.width/2,cy=box.top+box.height/2;
    gesture.current={id:event.pointerId,mode,startY:event.clientY,angle:Math.atan2(event.clientY-cy,event.clientX-cx),total:0,rotation:component.transform.rotationQuarterTurns,height:component.evidence.heightStep,cx,cy,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move=(event:PointerEvent<HTMLButtonElement>)=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;event.stopPropagation();
    const previousRotation=g.rotation,previousHeight=g.height;
    if(g.mode==="rotate"){
      const angle=Math.atan2(event.clientY-g.cy,event.clientX-g.cx);
      let delta=angle-g.angle;if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;
      g.total+=delta;g.angle=angle;
      g.rotation=((component.transform.rotationQuarterTurns+Math.round(g.total/(Math.PI/2)))%4+4)%4;
    }else g.height=Math.max(-32,Math.min(32,component.evidence.heightStep+Math.round((g.startY-event.clientY)/28)));
    if(previousRotation===g.rotation&&previousHeight===g.height)return;
    g.moved=true;onDrag(component.componentId,point,"move",{rotation:g.rotation,height:g.height});
  };
  const finish=(event:PointerEvent<HTMLButtonElement>,cancel=false)=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;event.stopPropagation();gesture.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(g.moved)onDrag(component.componentId,point,cancel?"cancel":"drop",{rotation:g.rotation,height:g.height});
  };
  return <Html center zIndexRange={[24,21]} position={[component.transform.position.x,component.transform.position.y+.8,component.transform.position.z]}>
    <div ref={root} className="wilds-build-gesture-ring" aria-label="Touch controls for selected build">
      <span className="wilds-build-gesture-hint">Drag piece to move</span>
      {(["rotate","height"] as const).map(mode=><button key={mode} type="button" className={`wilds-build-gesture-${mode}`} aria-label={mode==="rotate"?"Drag around piece to rotate":"Drag up or down to change piece height"} onPointerDown={e=>begin(mode,e)} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onClick={e=>e.stopPropagation()} onKeyDown={e=>{
        if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();
        const delta=e.key==="ArrowUp"||e.key==="ArrowRight"?1:-1;
        onDrag(component.componentId,point,"drop",{rotation:mode==="rotate"?(component.transform.rotationQuarterTurns+delta+4)%4:component.transform.rotationQuarterTurns,height:mode==="height"?Math.max(-32,Math.min(32,component.evidence.heightStep+delta)):component.evidence.heightStep});
      }}>{mode==="rotate"?<RotateCw size={19}/>:<MoveVertical size={19}/>}</button>)}
    </div>
  </Html>;
}
