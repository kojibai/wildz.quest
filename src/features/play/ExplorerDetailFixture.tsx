"use client";
import {Canvas} from "@react-three/fiber";
import {OrbitControls} from "@react-three/drei";
import {Suspense} from "react";
import {WildsExplorer} from "./WildsExplorer";
export function ExplorerDetailFixture(){
  return <main style={{height:"100dvh",background:"#202a2d"}}><Canvas camera={{position:[0,1.3,-3.8],fov:36}} dpr={[1,1.5]}><ambientLight intensity={1.2}/><directionalLight position={[-3,4,-4]} intensity={2.2}/><directionalLight position={[3,2,1]} intensity={1}/><Suspense fallback={null}>{["alder","mira","rowan"].map((id,i)=><group key={id} position={[(i-1)*.75,0,0]}><WildsExplorer identityKey={id} style={i===1?"female":"male"} worldPosition={{x:0,z:0}}/></group>)}</Suspense><OrbitControls target={[0,.85,0]}/></Canvas></main>;
}
