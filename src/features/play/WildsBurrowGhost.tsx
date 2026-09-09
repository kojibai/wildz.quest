"use client";
import {Html} from "@react-three/drei";
import type {WildsBurrowPreview} from "./wilds-burrow";
export function WildsBurrowGhost({preview,player,elevation}:{preview:WildsBurrowPreview;player:{x:number;z:number};elevation:number}){
  const {from,to}=preview;
  const color=preview.blocker?"#f3a386":"#8deac5";
  return <group name="burrow-dig-preview" position={[-player.x,-elevation,-player.z]}>
    {[from,to].map((p,i)=><mesh key={i} position={[p.x,p.y+.12,p.z]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><ringGeometry args={[i?preview.radius-.1:1.35,i?preview.radius:1.5,32]}/><meshBasicMaterial color={color} transparent opacity={.85} depthTest={false}/></mesh>)}
    <mesh position={[(from.x+to.x)/2,(from.y+to.y)/2+1.5,(from.z+to.z)/2]} raycast={()=>null}>
      <boxGeometry args={[Math.abs(to.x-from.x)+preview.radius*2,3,Math.abs(to.z-from.z)+preview.radius*2]}/>
      <meshBasicMaterial color={color} wireframe transparent opacity={.3} depthTest={false}/>
    </mesh>
    <Html position={[to.x,to.y+3,to.z]} center zIndexRange={[20,0]} style={{pointerEvents:"none"}}><span className="wilds-burrow-preview-label">{preview.blocker?"Choose a clear route":"Dig here"} · {to.y.toFixed(1)} m</span></Html>
  </group>;
}
