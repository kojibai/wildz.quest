"use client";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { WildsConstructionGestureHandles } from "./WildsConstructionGestureHandles";
import * as THREE from "three";
import type { WildsInteractionSurfacePoint } from "./wilds-surface-interaction";
export type WildsConstructionDragHandler=(id:string,point:WildsInteractionSurfacePoint,phase:"move"|"drop"|"cancel",transform?:{rotation:number;height:number})=>void;
import { createWildsConstructionMaterials } from "./wilds-construction-materials";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsBlueprintPlacement } from "./wilds-world-construction";
import { projectWildsConstructionStageGeometry } from "./wilds-construction-geometry";

export function WildsContinuousConstruction({ world, player, terrainElevation, preview, selectable, onSelect, onDrag, activeComponentId, spaceId="wildz.space.outer.v1" }: {
  spaceId?:string;
  onDrag?:WildsConstructionDragHandler;
  activeComponentId?:string;
  world?: WildsWorldProjection | null; player: { x: number; z: number }; terrainElevation: number;
  preview?: WildsBlueprintPlacement | null; selectable?: boolean; onSelect?: (id: string) => void;
}) {
  const controls=useThree(state=>state.controls) as {enabled:boolean}|null;
  const gl=useThree(state=>state.gl);
  const dragCallback=useRef(onDrag);
  useLayoutEffect(()=>{dragCallback.current=onDrag;},[onDrag]);
  const controlsEnabled=useRef(true);
  const releaseControls=()=>{if(controls)controls.enabled=controlsEnabled.current;};
  const drag=useRef<{id:string;pointerId:number;clientX:number;clientY:number;start:THREE.Vector3;origin:WildsInteractionSurfacePoint;last:WildsInteractionSurfacePoint;plane:THREE.Plane;moved:boolean}|null>(null);
  const suppressClick=useRef(false);
  useEffect(()=>{
    const cancel=(event?:PointerEvent)=>{
      const d=drag.current;if(!d||(event&&event.pointerId!==d.pointerId))return;
      drag.current=null;suppressClick.current=false;
      if(controls)controls.enabled=controlsEnabled.current;
      if(d.moved)dragCallback.current?.(d.id,d.last,"cancel");
    };
    const canvas=gl.domElement;
    canvas.addEventListener("pointercancel",cancel);
    canvas.addEventListener("lostpointercapture",cancel);
    return()=>{canvas.removeEventListener("pointercancel",cancel);canvas.removeEventListener("lostpointercapture",cancel);cancel();};
  },[controls,gl]);
  const surfaces = useMemo(createWildsConstructionMaterials, []);
  useEffect(() => () => surfaces.dispose(), [surfaces]);
  // Proof and stage projections run only when the snapshot changes, never in useFrame.
  const pieces = useMemo(() => !world ? [] : Object.values(world.constructionComponents ?? {}).map(component => ({ component,
    geometry: projectWildsConstructionStageGeometry(component, Object.values(world.constructionMaterialContributions), Object.values(world.constructionWorkContributions))
  })), [world]);
  return <group name="continuous-construction" position={[-player.x, -terrainElevation, -player.z]}>
    {pieces.filter(({ component }) => (component.evidence.spaceId??"wildz.space.outer.v1")===spaceId && Math.hypot(component.transform.position.x - player.x, component.transform.position.z - player.z) <= 64).map(({ component, geometry }) => {
      const box = component.placement.geometry;
      const planned = geometry.stage === "planned";
      const select = (event: ThreeEvent<MouseEvent>) => { if(suppressClick.current){event.stopPropagation();suppressClick.current=false;return;} if (selectable) { event.stopPropagation(); onSelect?.(component.componentId); } };
      return <group key={component.componentId} name={`construction-stage-${geometry.stage}`} visible={!(preview&&activeComponentId===component.componentId)} onClick={select}
        onPointerDown={event=>{if(!onDrag||activeComponentId!==component.componentId||event.button!==0||drag.current)return;suppressClick.current=false;event.stopPropagation();if(controls){controlsEnabled.current=controls.enabled;controls.enabled=false;}const origin={x:component.evidence.pointer.x,z:component.evidence.pointer.z,surfaceWorldY:component.evidence.pointer.y};drag.current={id:component.componentId,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,start:event.point.clone(),origin,last:origin,plane:new THREE.Plane(new THREE.Vector3(0,1,0),-event.point.y),moved:false};(event.target as Element).setPointerCapture(event.pointerId);}}
        onPointerMove={event=>{const d=drag.current;if(!d||d.pointerId!==event.pointerId||d.id!==component.componentId)return;event.stopPropagation();if(!d.moved&&Math.hypot(event.clientX-d.clientX,event.clientY-d.clientY)<6)return;const hit=event.ray.intersectPlane(d.plane,new THREE.Vector3());if(!hit)return;d.moved=true;suppressClick.current=true;const next={...d.origin,x:Math.round((d.origin.x+hit.x-d.start.x)*2)/2,z:Math.round((d.origin.z+hit.z-d.start.z)*2)/2};if(next.x===d.last.x&&next.z===d.last.z)return;d.last=next;onDrag?.(d.id,d.last,"move");}}
        onPointerUp={event=>{const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;event.stopPropagation();drag.current=null;releaseControls();(event.target as Element).releasePointerCapture(event.pointerId);if(d.moved)onDrag?.(d.id,d.last,"drop");}}
        onPointerCancel={event=>{const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;drag.current=null;releaseControls();if(d.moved)onDrag?.(d.id,d.last,"cancel");}}
      >
        {planned ? <group name="construction-plan-stakes">
          {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}:${z}`} position={[box.center.x + x * box.halfExtents.x, box.center.y - box.halfExtents.y + .3, box.center.z + z * box.halfExtents.z]}><boxGeometry args={[.09, .6, .09]} /><meshStandardMaterial color="#9dddbf" /></mesh>))}
          <mesh position={[box.center.x, box.center.y - box.halfExtents.y + .025, box.center.z]}><boxGeometry args={[box.halfExtents.x * 2, .05, box.halfExtents.z * 2]} /><meshStandardMaterial color="#72d9b7" transparent opacity={.32} depthWrite={false} /></mesh>
        </group> : geometry.solids.map(solid => <mesh castShadow receiveShadow key={solid.id} position={[solid.center.x, solid.center.y, solid.center.z]} geometry={surfaces.geometry(solid.halfExtents)} material={surfaces.material(component.kind, geometry.stage)} dispose={null}>
        </mesh>)}
        {!planned && component.kind === "water" && <mesh position={[box.center.x, box.center.y, box.center.z]}><boxGeometry args={[box.halfExtents.x * 2, .08, box.halfExtents.z * 2]} /><meshStandardMaterial color="#70cddd" transparent opacity={.7} /></mesh>}
        {(geometry.stage === "functional" || geometry.stage === "finished") && (component.kind === "light" || component.kind === "hearth") && <mesh position={[box.center.x, box.center.y + box.halfExtents.y, box.center.z]}><sphereGeometry args={[.16, 8, 6]} /><meshStandardMaterial color="#ffe7a4" emissive="#ffbf60" emissiveIntensity={2} /></mesh>}
      </group>;
    })}
    {activeComponentId&&onDrag&&world?.constructionComponents[activeComponentId]&&<WildsConstructionGestureHandles component={world.constructionComponents[activeComponentId]} onDrag={onDrag}/>}
    {preview && <group name="construction-placement-ghost">
      {preview.collisionSolids.map(solid => <mesh key={solid.id} position={[solid.center.x, solid.center.y, solid.center.z]} raycast={() => {}}><boxGeometry args={[solid.halfExtents.x * 2, solid.halfExtents.y * 2, solid.halfExtents.z * 2]} /><meshBasicMaterial color={preview.valid ? "#78efbc" : "#ff8a82"} transparent opacity={.38} depthWrite={false} /></mesh>)}
      {preview.collisionSolids.length === 0 && <mesh position={[preview.geometry.center.x, preview.geometry.center.y, preview.geometry.center.z]} raycast={() => {}}><boxGeometry args={[preview.geometry.halfExtents.x * 2, .1, preview.geometry.halfExtents.z * 2]} /><meshBasicMaterial color={preview.valid ? "#78efbc" : "#ff8a82"} transparent opacity={.38} depthWrite={false} /></mesh>}
    </group>}
  </group>;
}
