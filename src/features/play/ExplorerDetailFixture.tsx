"use client";
import {Canvas} from "@react-three/fiber";
import {OrbitControls} from "@react-three/drei";
import {Suspense, useMemo, useState} from "react";
import {WildsExplorer} from "./WildsExplorer";
import { WildsCreatureActor } from "./WildsCreatureActor";
import { sealCollectedCard } from "./portable-card";
import { projectCardKaiAppearance } from "./card-kai-appearance";
export function ExplorerDetailFixture(){
  const [creatures,setCreatures]=useState(false);
  const samples=useMemo(()=>["alder","mira","rowan"].map(id=>{
    const card=sealCollectedCard({formId:"mintcub-1",ownerReceizId:"fixture:faces",encounterId:`fixture:face:${id}`,capturedAt:"2026-10-09T12:00:00.000Z"});
    return {card,appearance:projectCardKaiAppearance(card)};
  }),[]);
  return <main style={{height:"100dvh",background:"#202a2d"}}>
    <div style={{position:"absolute",top:16,left:16,zIndex:10,display:"flex",gap:8}}>
      <button type="button" aria-pressed={!creatures} onClick={()=>setCreatures(false)}>Explorer faces</button>
      <button type="button" aria-pressed={creatures} onClick={()=>setCreatures(true)}>Creature faces</button>
    </div>
    <Canvas camera={{position:[0,1.3,-3.8],fov:36}} dpr={[1,1.5]}><ambientLight intensity={1.2}/><directionalLight position={[-3,4,-4]} intensity={2.2}/><directionalLight position={[3,2,1]} intensity={1}/><Suspense fallback={null}>
      {creatures?samples.map(({card,appearance},i)=><group key={card.id} position={[(i-1)*.75,.3,0]} rotation={[0,Math.PI,0]}><WildsCreatureActor familyId={card.manifest.familyId} formId={card.manifest.formId} anatomy={appearance.anatomy} face={appearance.face} identityToken={appearance.fingerprint} morphology={appearance.morphology} cadenceMs={appearance.cadenceMs} primary={appearance.palette.primary} secondary={appearance.palette.secondary} accent={appearance.palette.accent} glow={appearance.palette.glow}/></group>):["alder","mira","rowan"].map((id,i)=><group key={id} position={[(i-1)*.75,0,0]}><WildsExplorer identityKey={id} style={i===1?"female":"male"} worldPosition={{x:0,z:0}}/></group>)}
    </Suspense><OrbitControls target={[0,.85,0]}/></Canvas>
  </main>;
}
