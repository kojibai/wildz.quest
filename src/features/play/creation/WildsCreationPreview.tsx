'use client';
import { useEffect, useMemo } from 'react';
import type { CreationPoint, CreationPose } from './types';
import type { CreationChunk, CreationDraftGeometry } from './compiler';
import { creationPreviewTransform, type CreationPreview } from './preview';
import { createCreationRenderGeometry } from './render-geometry';
import { createCreationMaterialLibrary } from './material-library';
function Page({chunk,library}:{chunk:CreationChunk;library:ReturnType<typeof createCreationMaterialLibrary>}) {
 const geometry=useMemo(()=>createCreationRenderGeometry(chunk),[chunk]);
 const materials=useMemo(()=>chunk.materials.map(m=>{
   return library.material(m.material);
 }),[chunk,library]);
 useEffect(()=>{chunk.materials.forEach(m=>{void library.load(m.material);});},[chunk,library]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry} material={materials} raycast={()=>{}}/>;
}
export default function WildsCreationPreview({preview,viewer}:{preview:CreationPreview;viewer?:CreationPoint}) {
 return <WildsCreationDraftMesh geometry={preview.plan} pose={preview.pose} viewer={viewer}/>;
}
export function useCreationRenderMaterials() {
 const lease=useMemo(()=>({epoch:0,library:createCreationMaterialLibrary({resolution:256,anisotropy:1})}),[]);
 useEffect(()=>{const epoch=++lease.epoch;return()=>{queueMicrotask(()=>{if(lease.epoch===epoch)lease.library.dispose();});};},[lease]);
 return lease.library;
}
export function WildsCreationRenderPages({chunks,library}:{chunks:readonly CreationChunk[];library:ReturnType<typeof createCreationMaterialLibrary>}) {
 return <>{chunks.map(chunk=><Page key={chunk.id} chunk={chunk} library={library}/>)}</>;
}
export function WildsCreationDraftMesh({geometry,pose,viewer}:{geometry:CreationDraftGeometry;pose:CreationPose;viewer?:CreationPoint}) {
 const library=useCreationRenderMaterials();
 // Ghosts have no collision/use authority. Large world residency is qualified separately.
 const pages=useMemo(()=>{let vertices=0;return geometry.chunks.filter(chunk=>{vertices+=chunk.positions.length/3;return vertices<=48000;}).slice(0,2);},[geometry]);
 const transform=creationPreviewTransform({plan:geometry,pose},viewer);
 return <group position={transform.position} rotation={[0,transform.yaw,0]} name="creation-nonphysical-preview"><WildsCreationRenderPages chunks={pages} library={library}/></group>;
}
