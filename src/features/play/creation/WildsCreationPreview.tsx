'use client';
import { useEffect,useMemo } from 'react';
import { BufferAttribute,BufferGeometry,MeshStandardMaterial } from 'three';
import type { CreationChunk } from './compiler';
import { creationPreviewTransform, type CreationPreview } from './preview';
function Page({chunk}:{chunk:CreationChunk}) {
 const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(chunk.positions,3));g.setAttribute('normal',new BufferAttribute(chunk.normals,3));chunk.materials.forEach((m,i)=>g.addGroup(m.start,m.count,i));return g;},[chunk]);
 const materials=useMemo(()=>chunk.materials.map(m=>new MeshStandardMaterial({color:m.material==='stone'?'#bdc8c5':m.material==='hay'?'#cfb977':'#a3c1a3',transparent:true,opacity:.38,depthWrite:false,roughness:.8})),[chunk]);
 useEffect(()=>()=>{geometry.dispose();materials.forEach(material=>material.dispose());},[geometry,materials]);
 return <mesh geometry={geometry} material={materials} raycast={()=>{}}/>;
}
export default function WildsCreationPreview({preview}:{preview:CreationPreview}) {
 // Ghosts have no collision/use authority. Large world residency is qualified separately.
 const pages=useMemo(()=>{let vertices=0;return preview.plan.chunks.filter(chunk=>{vertices+=chunk.positions.length/3;return vertices<=48000;}).slice(0,2);},[preview.plan]);
 const transform=creationPreviewTransform(preview);
 return <group position={transform.position} rotation={[0,transform.yaw,0]} name="creation-nonphysical-preview">{pages.map(chunk=><Page key={chunk.id} chunk={chunk}/>)}</group>;
}
