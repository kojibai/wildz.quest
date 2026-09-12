"use client";
import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { createOwnerBoundInitialPlayState } from "./game-state";
import { WildsHomeResidents } from "./WildsHomeResidents";
import { WildsHomeLife } from "./WildsHomeLife";
import { projectWildsHomeLife } from "./wilds-home-life";
import { WildsDiscoveryStory } from "./WildsDiscoveryStory";
import { projectWildsDiscoveryStory } from "./wilds-discovery-story";
import { wildsDiscoverySitesForRegion } from "./wilds-discovery-sites";
import { wildsTerrainElevation } from "./wilds-terrain-authority";

export function HomeLifeBrowserFixture() {
  const [lastAction,setLastAction] = useState("No action yet");
  const [reducedMotion,setReducedMotion] = useState(false);
  const cards = useMemo(() => [createOwnerBoundInitialPlayState("home-fixture", "2026-09-01T12:00:00.000Z").inventory[0]!,createOwnerBoundInitialPlayState("home-fixture", "2026-09-02T12:00:00.000Z").inventory[0]!],[]);
  const home = projectWildsHomeLife({structures:[{structureId:"shelter",blueprint:"trail-shelter",position:{x:0,z:0}},{structureId:"bench",blueprint:"steward-workbench",position:{x:2,z:0}},{structureId:"cache",blueprint:"trail-cache",position:{x:1,z:0}}],companions:cards.map(card=>({id:card.id,name:card.manifest.name})),now:0})!;
  const discovery = projectWildsDiscoveryStory(wildsDiscoverySitesForRegion(2,2)[0]!,[],false);
  return <main style={{maxWidth:760,margin:"0 auto",padding:20,color:"#eaf5ed",background:"#101b1d",minHeight:"100vh"}}>
    <h1>Home life visual fixture</h1><p>Development preview · two existing creature models · no saved state or rewards</p>
    <label><input type="checkbox" checked={reducedMotion} onChange={event=>setReducedMotion(event.target.checked)} /> Reduce lookout motion</label>
    <div style={{height:300}} aria-label="Two companions resting beside a shelter">
      <Canvas camera={{position:[6,5,9],fov:42}}>
        <color attach="background" args={["#1d3435"]}/><ambientLight intensity={2}/><directionalLight position={[3,8,5]} intensity={3}/>
        <Suspense fallback={null}><WildsHomeResidents cards={cards} shelterPosition={{x:0,z:0}} player={{x:0,z:0}} terrainElevation={wildsTerrainElevation(0,0)} reducedMotion={reducedMotion}/></Suspense>
        <mesh position={[0,-.7,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[20,20]}/><meshStandardMaterial color="#3c6650"/></mesh>
        <mesh position={[0,.1,0]}><boxGeometry args={[2.5,1.5,1.7]}/><meshStandardMaterial color="#6f7250"/></mesh>
        <mesh position={[0,1.05,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[2.1,1,4]}/><meshStandardMaterial color="#466b50"/></mesh>
      </Canvas>
    </div>
    <p role="status">{lastAction}</p>
    <WildsHomeLife home={home} onAction={action=>setLastAction(`Home action: ${action}`)}/>
    <WildsDiscoveryStory discovery={discovery} onExplore={()=>setLastAction("Discovery route requested")}/>
  </main>;
}
