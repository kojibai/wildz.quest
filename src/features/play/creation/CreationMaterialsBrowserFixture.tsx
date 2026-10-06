'use client';
import { useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createCreationDefinition } from './definition';
import { compileCreation } from './compiler';
import { initializeCreationComponents } from './components';
import { createCreationRenderGeometry } from './render-geometry';
import { createCreationMaterialLibrary } from './material-library';
import type { CreationNode } from './types';
const node=(id:string,shape:CreationNode['shape'],x:number,y:number,z:number,material='timber',behavior?:string):CreationNode=>({id,parentId:null,pose:{position:{x,y,z},yaw:0},shape,material,attachments:[],supports:[],behaviors:behavior?[{id:behavior,version:1,parameters:{}}]:[]});
const box=(width:number,height:number,depth:number):CreationNode['shape']=>({kind:'box',width,height,depth});
function definitions(){
 const home=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:'material-fixture:home',creatorId:'fixture',assets:[],nodes:[
   node('foundation',box(7.4,.16,6.4),0,0,0,'stone'),
   node('home',{kind:'shell',width:7,height:3,depth:6,thickness:.16,doorway:{width:1.3,height:2.3}},0,.16,0,'timber','habitat'),
   node('roof',{kind:'catalog',piece:'pitched-roof',width:7.6,height:1.4,depth:6.6},0,3.15,0),
   node('door-left',box(.09,2.35,.2),-.69,.32,-3.04),
   node('door-right',box(.09,2.35,.2),.69,.32,-3.04),
   node('door-lintel',box(1.48,.12,.2),0,2.63,-3.04),
   node('frame',box(1.15,.16,2.25),-2,.49,1.1),
   node('bed',box(1.05,.24,2.1),-2,.65,1.1,'hay','bed'),
   node('pillow',{kind:'ellipsoid',width:.8,height:.16,depth:.43},-2,.9,1.83,'hay'),
   node('headboard',box(1.15,.78,.1),-2,.4,2.24),
   ...[-1,1].flatMap(x=>[-1,1].map(z=>node('leg:'+x+':'+z,{kind:'cylinder',width:.1,height:.24,depth:.1},-2+x*.5,.32,1.1+z*1))),
 ]});
 const tool=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:'material-fixture:hammer',creatorId:'fixture',assets:[],nodes:[
   node('handle',{kind:'cylinder',width:.14,height:1.1,depth:.14},5,.2,-1.8),
   node('head',{kind:'ellipsoid',width:.72,height:.36,depth:.38},5,1.12,-1.8,'stone','tool'),
   node('collar',{kind:'cylinder',width:.21,height:.12,depth:.21},5,1.09,-1.8),
 ]});
 return [home,tool];
}
function Scene({resolution,interior,onMetrics}:{resolution:256|512;interior:boolean;onMetrics:(text:string)=>void}){
 const gl=useThree(s=>s.gl),camera=useThree(s=>s.camera);
 const lease=useMemo(()=>({epoch:0,library:createCreationMaterialLibrary({resolution,anisotropy:Math.min(4,gl.capabilities.getMaxAnisotropy())})}),[resolution,gl]);
 const chunks=useMemo(()=>definitions().flatMap(d=>{
   initializeCreationComponents(d,1);
   const result=compileCreation(d,{worldId:'fixture',spaceId:'surface',sourceHead:'sha256:'+'a'.repeat(64),pose:{position:{x:0,y:0,z:0},yaw:0},budget:{timber:100,stone:100,hay:100},techniques:['assembly','masonry','forging'],physical:[],quality:'low'});
   if(result.status!=='ready')throw Error(JSON.stringify(result.blockers));return result.plan.chunks;
 }),[]);
 const meshes=useMemo(()=>chunks.map(chunk=>({id:chunk.id,geometry:createCreationRenderGeometry(chunk),materials:chunk.materials.map(m=>lease.library.material(m.material))})),[chunks,lease]);
 useEffect(()=>{chunks.forEach(c=>c.materials.forEach(m=>{void lease.library.load(m.material);}));},[chunks,lease]);
 useEffect(()=>{camera.position.set(...(interior?[-.2,1.8,-2.3]:[10,7,-11]) as [number,number,number]);},[interior,camera]);
 useEffect(()=>{const epoch=++lease.epoch;return()=>queueMicrotask(()=>{if(lease.epoch===epoch)lease.library.dispose();});},[lease]);
 useEffect(()=>()=>meshes.forEach(m=>m.geometry.dispose()),[meshes]);
 let nextReport=0;
 useFrame(({clock})=>{if(clock.elapsedTime>=nextReport){nextReport=clock.elapsedTime+1;onMetrics('Calls '+gl.info.render.calls+' · triangles '+gl.info.render.triangles+' · textures '+gl.info.memory.textures+' · shared surface memory '+(lease.library.textureBytes()/1048576).toFixed(2)+' MiB · '+resolution+'px maps');}});
 return <><hemisphereLight args={['#f0eadb','#626e4d',2.2]}/><directionalLight position={[5,9,-5]} intensity={3} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.025}/>
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.005,0]} receiveShadow><planeGeometry args={[80,80]}/><meshStandardMaterial color="#718366" roughness={1}/></mesh>
 {meshes.map(m=><mesh key={m.id} geometry={m.geometry} material={m.materials} castShadow receiveShadow/>)}
 <OrbitControls target={interior?[-2,.95,1.1]:[.6,1.5,0]}/></>;
}
export default function CreationMaterialsBrowserFixture(){
 const [resolution,setResolution]=useState<256|512>(512),[interior,setInterior]=useState(false),[metrics,setMetrics]=useState('');
 return <main style={{position:'fixed',inset:0,background:'#a3b6b5',color:'#17251c'}}>
 <Canvas shadows dpr={1} camera={{position:[10,7,-11],fov:45}}><Scene resolution={resolution} interior={interior} onMetrics={setMetrics}/></Canvas>
 <aside style={{position:'absolute',left:16,top:16,maxWidth:320,fontSize:12,background:'#f0f0dfdd',padding:12,borderRadius:12}}>
 <p>Creation material qualification · real compiler · synthetic resources · isolated rendering, no world admission</p>
 <button onClick={()=>setInterior(v=>!v)}>{interior?'View exterior':'View bed interior'}</button>{' '}
 <button onClick={()=>setResolution(v=>v===512?256:512)}>Use {resolution===512?'256':'512'}px maps</button>
 <p><output data-testid="creation-material-metrics">{metrics}</output></p>
 </aside></main>;
}
