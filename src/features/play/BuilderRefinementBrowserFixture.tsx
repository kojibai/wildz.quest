"use client";
import {useMemo,useState,useEffect,useRef} from "react";
import {Canvas,useThree} from "@react-three/fiber";
import {PerspectiveCamera,OrbitControls,Html} from "@react-three/drei";
import {WildsWorldService} from "./wilds-world-service";
import {checkpointWildsWorld} from "./wilds-world-state";
import {previewWildsContinuousBuild} from "./wilds-continuous-builder";
import {sampleWildsTerrain} from "./wilds-terrain-authority";
import {sealCollectedCard} from "./portable-card";
import {creatureForms} from "./creature-catalog";
import {composeWildsBurrowPhysical,wildsCreatureCanDig,wildsBurrowSiteKey} from "./wilds-burrow";
import {admitWildsDiscoveryPhysicalNeighborhood,normalizeWildsSiteSpaceState} from "./wilds-discovery-sites";
import {prepareWildsSiteRuntime,enterWildsSiteRuntime,exitWildsSiteRuntime} from "./wilds-site-runtime";
import {useWildsContinuousBuilder} from "./use-wilds-continuous-builder";
import {useWildsBurrowBuilder} from "./use-wilds-burrow-builder";
import {WildsContinuousBuilderPanel} from "./WildsContinuousBuilderPanel";
import {WildsBurrowBuilderPanel} from "./WildsBurrowBuilderPanel";
import {WildsContinuousConstruction} from "./WildsContinuousConstruction";
import {WildsDiscoverySites} from "./WildsDiscoverySites";
import {WildsBurrowGhost} from "./WildsBurrowGhost";
import type {useWildsWorld} from "./use-wilds-world";
const owner="fixture:builder",timestamp="2026-09-08T12:00:00.000Z";
function fixture(){
  const service=new WildsWorldService();
  const authority={actorId:owner,canonical:true,occurredAt:timestamp,pulse:timestamp,uPulse:1};
  service.execute({type:"construction.project.create",name:"Fixture",region:{x:0,z:0},commandId:"fixture:project"},authority);
  const request={pointer:{x:20,y:0,z:20},rotationQuarterTurns:0,heightStep:0,surfaceSnap:true};
  const preview=previewWildsContinuousBuild(service.snapshot(),owner,"foundation",request);
  service.execute({type:"construction.component.place",projectId:preview.project!.projectId,placement:preview.placement,request,actorPosition:request.pointer,commandId:"fixture:place"},authority);
  return service.snapshot();
}
function digger(){
  for(const form of creatureForms.filter(f=>f.stage===1))for(let i=0;i<64;i++){
    const card=sealCollectedCard({capturedAt:timestamp,encounterId:`builder-fixture-${form.id}-${i}`,formId:form.id,ownerReceizId:owner});
    if(wildsCreatureCanDig(card))return card;
  }
  throw new Error("digging fixture unavailable");
}
export function BuilderRefinementBrowserFixture(){
  const [snapshot,setSnapshot]=useState(fixture),[feedback,setFeedback]=useState("Ready"),[mode,setMode]=useState("build");
  const card=useMemo(digger,[]),[player,setPlayer]=useState({x:20,z:20});
  const [space,setSpace]=useState(()=>normalizeWildsSiteSpaceState(undefined,{x:20,y:sampleWildsTerrain(20,20).elevation,z:20}));
  const physical=useMemo(()=>composeWildsBurrowPhysical(admitWildsDiscoveryPhysicalNeighborhood(0,0),snapshot.burrows),[snapshot.burrows]);
  const runtime=useMemo(()=>prepareWildsSiteRuntime(physical),[physical]);
  const world={snapshot,pendingCommand:null as string|null,adjustConstructionComponent:async(componentId,componentHead,placement,request,actorPosition)=>{
    const service=new WildsWorldService({checkpoint:checkpointWildsWorld(snapshot)});
    service.execute({type:"construction.component.adjust",componentId,componentHead,placement,request,actorPosition,commandId:`fixture:adjust:${snapshot.revision}`},{actorId:owner,canonical:true,occurredAt:timestamp,pulse:timestamp,uPulse:snapshot.revision+2});
    setSnapshot(service.snapshot());return service.snapshot();
  },digBurrow:async(request,actorPosition)=>{
    const service=new WildsWorldService({checkpoint:checkpointWildsWorld(snapshot)});
    service.execute({type:"construction.burrow.dig",request,actorPosition,cardProofDigest:card.proof.digest,commandId:`fixture:dig:${snapshot.revision}`},{actorId:owner,canonical:true,occurredAt:timestamp,pulse:timestamp,uPulse:snapshot.revision+2,card});
    setSnapshot(service.snapshot());return service.snapshot();
  }} as ReturnType<typeof useWildsWorld>;
  const builder=useWildsContinuousBuilder({world,owner,player,lots:[],feedback:setFeedback});
  const dig=useWildsBurrowBuilder({world,owner,player,physical,space,card,feedback:setFeedback,onDig:()=>{},onEnter:key=>portal(key,"enter")});
  const piece=Object.values(snapshot.constructionComponents)[0];
  const portal=(key:string,direction:"enter"|"exit")=>{
    const next=direction==="enter"?enterWildsSiteRuntime(runtime,key,{...player,y:space.position.y}):exitWildsSiteRuntime(runtime,space,key);
    if(next){setSpace(next);setPlayer(next.position);}
  };
  return <main style={{height:"100dvh",position:"relative",overflow:"hidden",background:"#17332c",color:"white"}}>
    <nav style={{position:"absolute",top:8,left:8,right:8,zIndex:10,display:"flex",gap:8,flexWrap:"wrap"}}>
      <button onClick={()=>{setMode("build");dig.close();builder.selectComponent(piece.componentId);}}>Adjust foundation</button>
      <button onClick={()=>{setMode("dig");builder.close();dig.begin(0);}}>Dig underground</button>
      <button onClick={()=>{setSnapshot(new WildsWorldService({checkpoint:JSON.parse(JSON.stringify(checkpointWildsWorld(snapshot)))}).snapshot());setFeedback("Restored exact checkpoint");}}>Restore checkpoint</button>
      <button onClick={()=>{const last=Object.values(snapshot.burrows??{}).at(-1);if(last){const root=snapshot.burrows![last.rootId];const entered=enterWildsSiteRuntime(runtime,wildsBurrowSiteKey(root.id),root.from);if(entered){setSpace({...entered,position:last.to});setPlayer(last.to);dig.close();}}}}>Walk to latest tunnel end</button>
      <output style={{width:"100%",fontSize:12}}>X {piece.transform.position.x} · Z {piece.transform.position.z} · Y {piece.transform.position.y} · {piece.transform.rotationQuarterTurns*90}° · Revision {piece.revision} · Dug {Object.keys(snapshot.burrows??{}).length} · {feedback}</output>
    </nav>
    <Canvas><FixtureDiagnostics/><PerspectiveCamera makeDefault position={space.spaceId==="wildz.space.outer.v1"?[10,16,16]:[0,1.4,-1.8]} fov={50}/><OrbitControls makeDefault target={space.spaceId==="wildz.space.outer.v1"?[0,0,0]:[0,1,2]}/><ambientLight intensity={2}/><directionalLight position={[3,10,5]} intensity={2}/>
      {space.spaceId==="wildz.space.outer.v1"&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.1,0]}><planeGeometry args={[80,80]}/><meshStandardMaterial color="#53764c"/></mesh>}
      <WildsContinuousConstruction world={snapshot} player={player} terrainElevation={space.position.y} preview={builder.preview} selectable={mode==="build"&&builder.selectionEnabled} onSelect={builder.selectComponent} onDrag={builder.adjusting ? builder.dragPiece : undefined} activeComponentId={builder.open?builder.selected?.componentId:undefined} spaceId={space.spaceId}/>
      <WildsDiscoverySites runtime={runtime} player={player} space={space} onPortal={portal}/>
      {dig.preview&&<WildsBurrowGhost preview={dig.preview} player={player} elevation={space.position.y}/>}
    </Canvas>
    {builder.open&&<WildsContinuousBuilderPanel builder={builder} materials={{hay:0,timber:0,stone:0}}/>}
    {dig.open&&<WildsBurrowBuilderPanel builder={dig}/>}
  </main>;
}

function FixtureDiagnostics(){
  const {gl}=useThree();const output=useRef<HTMLOutputElement>(null);
  useEffect(()=>{const timer=setInterval(()=>{if(output.current)output.current.dataset.snapshot=JSON.stringify({calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures});},500);return()=>clearInterval(timer);},[gl]);
  return <Html><output ref={output} data-builder-render hidden/></Html>;
}
