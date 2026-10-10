"use client";
import {useEffect,useMemo} from 'react';
import {BufferAttribute,BufferGeometry} from 'three';
import {deriveCreationGeometry} from './creation/geometry';
import {creationNodePoses} from './creation/projection';
import {creationEquipmentProfile} from './creation/equipment-profiles';
import type {CreationDefinition} from './creation/types';
import type {CreationInstance} from './creation/instance';
import type {WildsPlayerHand} from './WildsPlayerActionPad';
import {useWildsNaturalTexture} from './wilds-natural-material';
import {creationMetricUVs} from './creation/render-geometry';

export type WildsHeldCreationEquipment=Readonly<{instance:CreationInstance;definition:CreationDefinition;nodeId:string;hand:WildsPlayerHand}>;
/** Render the admitted assembly; equipment condition remains in the physical source. */
export function WildsHeldCreationEquipmentMesh({equipment}:{equipment:WildsHeldCreationEquipment}){
 const node=equipment.definition.nodes.find(node=>node.id===equipment.nodeId)!;
 const state=equipment.instance.nodeStates[equipment.nodeId];
 const profile=state?.kind==='equipment'?creationEquipmentProfile(state.actionProfileId):undefined;
 const mode=profile?.mode;
 const texture=useWildsNaturalTexture('bark');
 const geometry=useMemo(()=>{
  const nodes=mode?equipment.definition.nodes:[node],poses=creationNodePoses(equipment.definition,{position:{x:0,y:0,z:0},yaw:0});
  const parts=nodes.map(part=>deriveCreationGeometry(part,mode?poses.get(part.id)!:{position:{x:0,y:0,z:0},yaw:0}));
  const positions=new Float32Array(parts.flatMap(part=>part.positions)),normals=new Float32Array(parts.flatMap(part=>part.normals));
  const buffer=new BufferGeometry();buffer.setAttribute('position',new BufferAttribute(positions,3));buffer.setAttribute('normal',new BufferAttribute(normals,3));buffer.setAttribute('uv',new BufferAttribute(creationMetricUVs(positions,normals),2));
  let offset=0;parts.forEach((part,index)=>{buffer.addGroup(offset,part.positions.length/3,index);offset+=part.positions.length/3;});
  buffer.computeBoundingBox();
  if(mode){
   const gripY=mode==='bow'?.575:mode==='rifle'?.15:.2;
   buffer.translate(0,-gripY,mode==='rifle'?-.1:0);
   if(mode==='bow'||mode==='rifle')buffer.rotateX(-Math.PI/2);
  }else{
   const bound=buffer.boundingBox!;buffer.translate(-(bound.min.x+bound.max.x)/2,-(bound.min.y+bound.max.y)/2,.03-bound.min.z);buffer.rotateX(Math.PI/2);
  }
  buffer.computeBoundingSphere();return buffer;
 },[node,mode,equipment.definition]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const nodes=mode?equipment.definition.nodes:[node];
 return <mesh name="held-admitted-equipment" geometry={geometry} castShadow>
  {nodes.map((part,index)=><meshStandardMaterial key={part.id} attach={`material-${index}`} map={part.material==='stone'?undefined:texture} color={part.material==='stone'?'#626d6b':'#956b43'} roughness={.8}/>)}
 </mesh>;
}
