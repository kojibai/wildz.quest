"use client";
import {useEffect,useMemo} from 'react';
import {BufferAttribute,BufferGeometry} from 'three';
import {deriveCreationGeometry} from './creation/geometry';
import type {CreationDefinition} from './creation/types';
import type {CreationInstance} from './creation/instance';
import type {WildsPlayerHand} from './WildsPlayerActionPad';
import {useWildsNaturalTexture} from './wilds-natural-material';
import {creationMetricUVs} from './creation/render-geometry';

export type WildsHeldCreationEquipment=Readonly<{instance:CreationInstance;definition:CreationDefinition;nodeId:string;hand:WildsPlayerHand}>;
/** Visual only. The caller supplies equipment from the authenticated physical store. */
export function WildsHeldCreationEquipmentMesh({equipment}:{equipment:WildsHeldCreationEquipment}){
 const node=equipment.definition.nodes.find(node=>node.id===equipment.nodeId)!;
 const texture=useWildsNaturalTexture('bark');
 const geometry=useMemo(()=>{
  const derived=deriveCreationGeometry(node,{position:{x:0,y:0,z:0},yaw:0});
  const positions=new Float32Array(derived.positions),normals=new Float32Array(derived.normals);
  const buffer=new BufferGeometry();buffer.setAttribute('position',new BufferAttribute(positions,3));buffer.setAttribute('normal',new BufferAttribute(normals,3));buffer.setAttribute('uv',new BufferAttribute(creationMetricUVs(positions,normals),2));buffer.computeBoundingBox();
  // Grip the near end of the actual authored shape; retain its metre dimensions.
  const bound=buffer.boundingBox!;buffer.translate(-(bound.min.x+bound.max.x)/2,-(bound.min.y+bound.max.y)/2,.03-bound.min.z);buffer.rotateX(Math.PI/2);
  buffer.computeBoundingSphere();return buffer;
 },[node]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh name="held-admitted-equipment" geometry={geometry} castShadow>
  <meshStandardMaterial map={node.material==='stone'?undefined:texture} color={node.material==='stone'?'#838c87':'#956b43'} roughness={.8}/>
 </mesh>;
}
