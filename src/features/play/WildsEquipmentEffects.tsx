'use client';
import {useEffect,useMemo,type MutableRefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferAttribute,BufferGeometry,Line,LineBasicMaterial,ArrowHelper,Vector3} from 'three';
import type {WildsEquipmentControlState} from './wilds-equipment-controls';

/** One reusable trail in the existing frame loop; no projectile authority or physics allocation. */
export function WildsEquipmentEffects({controls,player,floorY}:{controls:MutableRefObject<WildsEquipmentControlState>;player:{x:number;z:number};floorY:number}){
 const effect=useMemo(()=>{
  const positions=new Float32Array(6),geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));
  const material=new LineBasicMaterial({color:'#efdaa2',transparent:true,opacity:0,depthWrite:false});
  const line=new Line(geometry,material);line.name='equipment-shot-trail';line.frustumCulled=false;const direction=new Vector3(0,0,-1),arrow=new ArrowHelper(direction,new Vector3(),.55,'#e8c38a',.12,.07);arrow.name='equipment-arrow';arrow.visible=false;return {line,geometry,material,positions,direction,arrow};
 },[]);
 useEffect(()=>()=>{effect.geometry.dispose();effect.material.dispose();effect.arrow.dispose();},[effect]);
 useFrame(()=>{
  const state=controls.current,age=performance.now()-state.shotAt,duration=state.shotKind==='bow'?320:130;
  effect.line.visible=age>=0&&age<duration;effect.arrow.visible=effect.line.visible&&state.shotKind==='bow';if(!effect.line.visible)return;
  const range=state.shotKind==='bow'?Math.min(state.shotRange,age/320*state.shotRange):state.shotRange;
  const x=state.shotOrigin.x-player.x,y=state.shotOrigin.y-floorY,z=state.shotOrigin.z-player.z;
  effect.positions[0]=x;effect.positions[1]=y;effect.positions[2]=z;
  effect.positions[3]=x+state.shotDirection.x*range;effect.positions[4]=y+state.shotDirection.y*range;effect.positions[5]=z+state.shotDirection.z*range;
  if(effect.arrow.visible){effect.direction.set(state.shotDirection.x,state.shotDirection.y,state.shotDirection.z);effect.arrow.setDirection(effect.direction);effect.arrow.position.set(effect.positions[3]-effect.direction.x*.55,effect.positions[4]-effect.direction.y*.55,effect.positions[5]-effect.direction.z*.55);}
  effect.geometry.attributes.position.needsUpdate=true;effect.material.opacity=(1-age/duration)*.85;
 });
 return <group><primitive object={effect.line}/><primitive object={effect.arrow}/></group>;
}
