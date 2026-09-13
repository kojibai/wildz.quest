import assert from "node:assert/strict";
import { it } from "node:test";
import { writeWildsCrewFollowSpeed } from "../src/features/play/wilds-crew-follow-motion";
it("measures repeated player snapshots at actual cadence and holds speed between renders",()=>{
 const state={x:0,z:0,changedAt:0,speed:0};
 assert.equal(writeWildsCrewFollowSpeed(state,{x:1.05,z:0},.03,0),35);
 assert.equal(writeWildsCrewFollowSpeed(state,{x:1.05,z:0},.04,0),35);
 assert.equal(writeWildsCrewFollowSpeed(state,{x:1.05,z:0},1,0),5.5);
 assert.equal(writeWildsCrewFollowSpeed(state,{x:999,z:0},1.03,999),72);
});
it("keeps up with legitimate thirty millisecond keyboard steps through bounded swept substeps",async()=>{
 const {writeWildsCrewPathStep,createWildsCrewPathStepState}=await import("../src/features/play/wilds-crew-navigation");
 const state={x:0,z:0,changedAt:0,speed:0},position={x:0,y:0,z:0},target={x:0,y:0,z:0};let maxGap=0;
 for(let i=1;i<=180;i++){
   target.x=i*1.05;
   const speed=writeWildsCrewFollowSpeed(state,target,i*.03,target.x-position.x);
   for(let sub=0;sub<2;sub++)writeWildsCrewPathStep(position,[target],createWildsCrewPathStepState(),{
     mode:"walk",permittedModes:["walk"],speed,accompanyingSpeedLimit:72,deltaSeconds:.015,
     sampleSegment:(from,to,_mode,out)=>{assert.ok(Math.abs(to.x-from.x)<=2.4);out.allowed=true;out.y=0;}
   });
   maxGap=Math.max(maxGap,target.x-position.x);
 }
 assert.ok(maxGap<.1);
 const before=position.x;
 writeWildsCrewPathStep(position,[{x:before+10,y:0,z:0}],createWildsCrewPathStepState(),{mode:"walk",permittedModes:["walk"],speed:72,accompanyingSpeedLimit:72,deltaSeconds:.03,sampleSegment:(_from,_to,_mode,out)=>{out.allowed=false;out.y=0;}});
 assert.equal(position.x,before);
});
it("dense detour waypoints preserve a fast frame's remaining distance across bounded swept writes",async()=>{
 const {writeWildsCrewFollowingStep,createWildsCrewPathStepState}=await import("../src/features/play/wilds-crew-navigation");
 const position={x:0,y:0,z:0},target={x:100,y:0,z:0};
 const route=Array.from({length:166},(_,i)=>({x:(i+1)*.6,y:0,z:0})),step=createWildsCrewPathStepState(),direct=createWildsCrewPathStepState();step.reason="moving";
 const authority={mode:"walk" as const,permittedModes:["walk" as const],sampleSegment:(from:{x:number},to:{x:number},_mode:unknown,out:{allowed:boolean;y:number})=>{out.allowed=Math.abs(to.x-from.x)<=2.4;out.y=0;}};
 for(let frame=0;frame<100;frame++){
  const before=position.x;let remaining=45/60;
  for(let sub=0;sub<2&&remaining>.000001;sub++){
   const prior=position.x;writeWildsCrewFollowingStep(position,target,route,step,direct,[target],{...authority,speed:45,accompanyingSpeedLimit:72,deltaSeconds:remaining/45});remaining-=Math.abs(position.x-prior);
  }
  assert.ok(position.x-before<=.75+.000001);
 }
 assert.ok(position.x>=74.99);
});
it("regroups only authorized accompanying poses at the admitted player landing with at most two checks",async()=>{
 const {writeWildsCrewFollowRegroup}=await import("../src/features/play/wilds-crew-follow-motion");
 const player={x:10,y:0,z:0},formation={x:11,y:0,z:0},scratch={allowed:false,y:NaN},position={x:0,y:0,z:0};let checks=0;
 const authority={mode:"walk" as const,permittedModes:["walk" as const],sampleSegment:(from:{x:number},_to:unknown,_mode:unknown,out:{allowed:boolean;y:number})=>{checks++;assert.equal(from.x,10);out.allowed=true;out.y=2;}};
 assert.equal(writeWildsCrewFollowRegroup(position,player,formation,scratch,authority,false),false);assert.equal(checks,0);assert.equal(position.x,0);
 assert.equal(writeWildsCrewFollowRegroup(position,player,formation,scratch,authority,true),true);assert.deepEqual(position,{x:11,y:2,z:0});assert.equal(checks,2);
 assert.equal(writeWildsCrewFollowRegroup(position,player,formation,scratch,authority,true),false);assert.equal(checks,2);
});
it("rejects forbidden player landings and uses only the admitted anchor when its side is blocked",async()=>{
 const {writeWildsCrewFollowRegroup}=await import("../src/features/play/wilds-crew-follow-motion");
 const player={x:10,y:0,z:0},formation={x:11,y:0,z:0},scratch={allowed:false,y:NaN},position={x:0,y:0,z:0};
 const authority={mode:"walk" as const,permittedModes:["walk" as const],sampleSegment:(_from:unknown,to:{x:number},_mode:unknown,out:{allowed:boolean;y:number})=>{out.allowed=to.x===10;out.y=3;}};
 assert.equal(writeWildsCrewFollowRegroup(position,player,formation,scratch,{...authority,sampleSegment:(_from,_to,_mode,out)=>{out.allowed=false;out.y=0;}},true),false);assert.equal(position.x,0);
 assert.equal(writeWildsCrewFollowRegroup(position,player,formation,scratch,authority,true),true);assert.deepEqual(position,{x:10,y:3,z:0});
});
