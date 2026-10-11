'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { WildsCreatureActor, type WildsCreatureLocomotion, type WildsCreaturePose } from './WildsCreatureActor';
import { createWildsCreatureFace, fallbackWildsCreatureFace } from './wilds-creature-face';
import { createWildsFaceMaterial } from './wilds-face-geometry';
import { WildsReadabilityProvider } from './WildsReadabilityContext';
import type { CreatureVisualFace } from './creature-visual-identity';

type Probe = { frames:number; calls:number; triangles:number; programs:number; geometries:number; faceIds:number[]; frameMs:number[] };
declare global { interface Window { creatureFaceProbe?: Probe; creatureMouthPixels?: () => { pixels:number; maxDifference:number } } }
function Metrics() {
  const {gl,scene,camera}=useThree();
  const probe=useRef<Probe>({frames:0,calls:0,triangles:0,programs:0,geometries:0,faceIds:[],frameMs:[]});
  useEffect(()=>{
    window.creatureFaceProbe=probe.current;
    window.creatureMouthPixels=()=>{
      const mesh=scene.getObjectByName('genome-bound-face') as THREE.Mesh;
      const original=mesh.geometry,geometry=original.clone(),ix=geometry.index!,p=geometry.getAttribute('position');
      const parent=Array.from({length:p.count},(_,i)=>i),root=(i:number):number=>parent[i]===i?i:(parent[i]=root(parent[i]));
      let mouthVertex=-1;const pigment=geometry.getAttribute('faceUntextured'),ocular=geometry.getAttribute('faceOcular');
      for(let i=0;i<p.count;i++)if(pigment.getX(i)&&!ocular.getX(i))mouthVertex=i;
      for(let i=0;i<ix.count;i+=3){const a=ix.getX(i);for(let k=1;k<3;k++)parent[root(ix.getX(i+k))]=root(a);}
      const mouthRoot=root(mouthVertex),kept:number[]=[];
      for(let i=0;i<ix.count;i+=3)if(root(ix.getX(i))!==mouthRoot)kept.push(ix.getX(i),ix.getX(i+1),ix.getX(i+2));
      const context=gl.getContext(),size=gl.getDrawingBufferSize(new THREE.Vector2()),before=new Uint8Array(size.x*size.y*4),after=new Uint8Array(before.length);
      gl.render(scene,camera);context.readPixels(0,0,size.x,size.y,context.RGBA,context.UNSIGNED_BYTE,before);
      geometry.setIndex(kept);mesh.geometry=geometry;gl.render(scene,camera);context.readPixels(0,0,size.x,size.y,context.RGBA,context.UNSIGNED_BYTE,after);
      mesh.geometry=original;geometry.dispose();gl.render(scene,camera);
      let pixels=0,maxDifference=0;for(let i=0;i<before.length;i+=4){const difference=Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]));if(difference>=8)pixels++;maxDifference=Math.max(maxDifference,difference);}return {pixels,maxDifference};
    };
    return()=>{delete window.creatureFaceProbe;delete window.creatureMouthPixels;};
  },[gl,scene,camera]);
  useFrame((_,delta)=>{
    const p=probe.current;p.frames++;p.calls=gl.info.render.calls;p.triangles=gl.info.render.triangles;
    p.programs=gl.info.programs?.length??0;p.geometries=gl.info.memory.geometries;
    if(p.frameMs.length<600)p.frameMs.push(delta*1000);
    if(p.frames%30===0){p.faceIds=[];scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry.hasAttribute('faceClosed'))p.faceIds.push(o.geometry.id);});}
  });return null;
}
function Camera({view}:{view:string}) {
  const {camera}=useThree();useEffect(()=>{
    if(view==='default')camera.position.set(4.2,3.7,6.6);
    else if(view==='front')camera.position.set(0,.75,1.9);
    else if(view==='oblique')camera.position.set(1.35,.8,1.5);
    else camera.position.set(1.9,.8,.3);
    camera.lookAt(0,.6,.2);camera.updateProjectionMatrix();
  },[camera,view]);return null;
}
function IsolatedFace({face,blink,dark}:{face:CreatureVisualFace;blink:number;dark:boolean}) {
  const geometry=useMemo(()=>createWildsCreatureFace(face,dark?'#283047':'#88bb77','#cfaa55','#337766','fit-browser'),[face,dark]);
  const surface=useMemo(()=>{const tex=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);tex.needsUpdate=true;return {...createWildsFaceMaterial(tex),tex};},[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>()=>{surface.material.dispose();surface.tex.dispose();},[surface]);
  useEffect(()=>{surface.blink.value=blink;},[surface,blink]);
  return <mesh position={[0,.65,.2]} geometry={geometry} material={surface.material}/>;
}
export default function CreatureFaceFitBrowserFixture() {
  const [view,setView]=useState('default'),[mouth,setMouth]=useState<CreatureVisualFace['mouth']>('smile'),[extreme,setExtreme]=useState('normal');
  const [scale,setScale]=useState(.54),[dark,setDark]=useState(false),[mode,setMode]=useState('actor'),[blink,setBlink]=useState(0);
  const [form,setForm]=useState('mintcub-1'),[pose,setPose]=useState<WildsCreaturePose>('idle'),[locomotion,setLocomotion]=useState<WildsCreatureLocomotion>('ground');
  const [revision,setRevision]=useState(0),[dpr,setDpr]=useState(1),[height,setHeight]=useState(400);
  const face=useMemo(()=>{
    const f=fallbackWildsCreatureFace('fit-browser','mintcub');
    return {...f,mouth,geometry:{...f.geometry,...(extreme==='narrow'?{head:'heart' as const,cheek:.82,jaw:.82,forehead:.84,muzzle:.72,eyeSize:1.18,eyeSpacing:1.16,eyeHeight:1.1,eyeTilt:8}:extreme==='broad'?{head:'broad' as const,cheek:1.24,jaw:1.18,forehead:1.22,muzzle:1.18,eyeSize:1.18,eyeSpacing:1.16,eyeHeight:1.1,eyeTilt:-8}:{})}};
  },[mouth,extreme]);
  return <main style={{padding:12,background:'#18212c',color:'white'}}><h1>Creature face fit probe</h1>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
      <select aria-label="View" value={view} onChange={e=>setView(e.target.value)}>{['default','front','oblique','profile'].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Mouth" value={mouth} onChange={e=>setMouth(e.target.value as typeof mouth)}>{['smile','muzzle','fang','beak'].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Fit" value={extreme} onChange={e=>setExtreme(e.target.value)}>{['normal','narrow','broad'].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Scale" value={scale} onChange={e=>setScale(Number(e.target.value))}>{[.54,.62,.82].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Mode" value={mode} onChange={e=>setMode(e.target.value)}>{['actor','face'].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Blink" value={blink} onChange={e=>setBlink(Number(e.target.value))}>{[0,.25,.5,.75,1].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Form" value={form} onChange={e=>setForm(e.target.value)}>{['mintcub-1','ledgerfox-1','voltray-1','titanseal-1','cinderbeak-1'].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Pose" value={pose} onChange={e=>setPose(e.target.value as typeof pose)}>{['idle','curious','work','attack','weakened'].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Locomotion" value={locomotion} onChange={e=>setLocomotion(e.target.value as typeof locomotion)}>{['ground','air','swim'].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="DPR" value={dpr} onChange={e=>setDpr(Number(e.target.value))}>{[1,1.5,2].map(v=><option key={v}>{v}</option>)}</select>
      <select aria-label="Height" value={height} onChange={e=>setHeight(Number(e.target.value))}>{[400,740].map(v=><option key={v}>{v}</option>)}</select>
      <label><input aria-label="Dark" type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)}/>Dark</label>
      <button onClick={()=>setRevision(v=>v+1)}>Copy snapshot {revision}</button>
    </div>
    <div data-testid="render" style={{width:720,maxWidth:'100%',height}}><Canvas dpr={dpr} camera={{fov:40}} gl={{preserveDrawingBuffer:true,antialias:true}}>
      <color attach="background" args={[dark?'#111923':'#9baab3']}/><ambientLight intensity={dark?.65:1.3}/><directionalLight position={[3,5,4]} intensity={dark?1:2}/>
      <WildsReadabilityProvider value={{darkness:dark?1:0,actorEmissive:dark?.18:0,pathEmissive:0,threatEmissive:0,motionScale:0}}>
        {mode==='face'?<IsolatedFace face={face} blink={blink} dark={dark}/>:<group scale={scale}><WildsCreatureActor formId={form} familyId={form.split('-')[0]} primary={dark?'#283047':'#88bb77'} secondary="#66778f" accent="#cfaa55" glow="#337766" identityToken="fit-browser" face={{...face,geometry:{...face.geometry}}} pose={pose} locomotion={locomotion}/></group>}
      </WildsReadabilityProvider><Camera view={view}/><Metrics/>
    </Canvas></div>
  </main>;
}
