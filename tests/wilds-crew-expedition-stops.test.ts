import assert from "node:assert/strict";
import { it } from "node:test";
import { canTraverseWildsCrewExpeditionLeg,prepareWildsCrewExpeditionStops } from "../src/features/play/wilds-crew-expedition-stops";
import { admitWildsDiscoveryPhysicalNeighborhood } from "../src/features/play/wilds-discovery-sites";
import { prepareWildsSiteRuntime,wildsSiteRuntimeGroundY } from "../src/features/play/wilds-site-runtime";
import { createWildsCrewPhysicalSampler } from "../src/features/play/wilds-crew-physical-navigation";
import { WILDS_RENDERED_PHYSICAL_OBSTACLES } from "../src/features/play/wilds-terrain-obstacles";
import { projectWildsAerialObstacleNeighborhood } from "../src/features/play/wilds-grounded-movement";
import { wildsTerrainElevation } from "../src/features/play/wilds-terrain-authority";
const origin={x:-2.15,y:7.874786,z:-.85},spaceId="wildz.space.outer.v1";
const runtime=prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-1,-1));
const obstacles=[...WILDS_RENDERED_PHYSICAL_OBSTACLES,...projectWildsAerialObstacleNeighborhood(origin).obstacles];
const sampleSegment=createWildsCrewPhysicalSampler({runtime,spaceId,obstacles,originX:-16,originZ:-16});
const floor=(x:number,z:number)=>({x,y:wildsSiteRuntimeGroundY(runtime,spaceId,x,z,wildsTerrainElevation(x,z)),z});
it("rejects the recorded 33.94m cross-stop leg despite separately reachable spokes",async()=>{
 const a=floor(-2.15,-24.85),b=floor(-26.15,-.85);
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>33.9);
 assert.equal(await canTraverseWildsCrewExpeditionLeg({mode:"walk",permittedModes:["walk"],sampleSegment,start:a,target:b}),false);
});
it("prepares three mutually traversable canonical stops and home legs without depending on ranking",async()=>{
 const stops=await prepareWildsCrewExpeditionStops({origin,spaceId,runtime,obstacles:[],seed:0});
 assert.equal(stops.length,3);
 const points=[origin,...stops.map(stop=>stop.position)];
 for(const start of points)for(const target of points){
  if(start===target)continue;
  assert.ok(Math.hypot(start.x-target.x,start.y-target.y,start.z-target.z)<=24);
  assert.equal(await canTraverseWildsCrewExpeditionLeg({mode:"walk",permittedModes:["walk"],sampleSegment,start,target}),true);
 }
});
it("yields within leg simulation and cancels without returning partial candidates",async()=>{
 let cancelled=false,samples=0;
 const pending=canTraverseWildsCrewExpeditionLeg({mode:"walk",permittedModes:["walk"],start:{x:0,y:0,z:0},target:{x:20,y:0,z:0},sampleSegment:(_from,_to,_mode,out)=>{samples++;out.allowed=true;out.y=0;},cancelled:()=>cancelled});
 setTimeout(()=>{cancelled=true;},0);
 assert.equal(await pending,false);assert.ok(samples<=8);
 assert.deepEqual(await prepareWildsCrewExpeditionStops({origin,spaceId,runtime,obstacles:[],seed:0,cancelled:()=>true}),[]);
});
