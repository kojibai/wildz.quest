import assert from "node:assert/strict";
import { it } from "node:test";
import { writeWildsCrewFollowSpeed, writeWildsCrewFollowPresentation } from "../src/features/play/wilds-crew-follow-motion";
it("smooths snapshot jumps and gait pulses while settling exactly after walking", () => {
  const state = { x: 0, y: 0, z: 0, distance: 0, speed: 0, travelled: 0 };
  let previous = 0;
  for (let frame = 1; frame <= 240; frame++) {
    // A caught-up companion alternates between a snapshot correction and catch-up.
    const x = frame % 2 ? -.5 : 0;
    writeWildsCrewFollowPresentation(state, { x, y: 0, z: 0 }, frame % 2 ? .5 : 0, 1 / 60);
    if (frame > 60) {
      assert.ok(Math.abs(state.x - previous) < .1, "no half-unit frame jumps beside the player");
      assert.ok(state.speed > 10 && state.speed < 20, "no walking/idle gait oscillation");
    }
    previous = state.x;
  }
  for (let frame = 0; frame < 120; frame++) writeWildsCrewFollowPresentation(state, { x: 0, y: 0, z: 0 }, 0, 1 / 60);
  assert.ok(Math.abs(state.x) < .000001);
  assert.ok(state.speed < .025);
  assert.ok(Math.abs(state.distance - 60) < .000001, "smoothing preserves total stride distance");
  writeWildsCrewFollowPresentation(state, { x: 10, y: 0, z: 20 }, 100, 1 / 60, true);
  assert.deepEqual(state, { x: 10, y: 0, z: 20, distance: 0, speed: 0, travelled: 0 });
});
it("measures repeated player snapshots at actual cadence and holds speed between renders",()=>{
 const state={x:0,z:0,changedAt:0,speed:0};
 assert.equal(writeWildsCrewFollowSpeed(state,{x:1.05,z:0},.03,0),35);
 assert.equal(writeWildsCrewFollowSpeed(state,{x:1.05,z:0},.04,0),35);
 assert.equal(writeWildsCrewFollowSpeed(state,{x:1.05,z:0},1,0),5.5);
 assert.equal(writeWildsCrewFollowSpeed(state,{x:999,z:0},1.03,999),72);
});
it("keeps snapshot-driven walking visually continuous at 30, 60 and 120 fps", async () => {
  const { writeWildsCrewPathStep, createWildsCrewPathStepState } = await import("../src/features/play/wilds-crew-navigation");
  for (const hz of [30, 60, 120]) {
    const position = { x: 0, y: 0, z: 0 }, player = { ...position };
    const motion = { x: 0, z: 0, changedAt: 0, speed: 0 };
    const presentation = { x: 0, y: 0, z: 0, distance: 0, speed: 0, travelled: 0 };
    const step = createWildsCrewPathStepState();
    for (let frame = 1; frame <= hz * 8; frame++) {
      const now = frame / hz;
      player.x = Math.floor(now / .03) * 1.05;
      const before = position.x, displayed = presentation.x;
      step.waypointIndex = 0;
      writeWildsCrewPathStep(position, [player], step, {
        mode: "walk", permittedModes: ["walk"], accompanyingSpeedLimit: 72, deltaSeconds: 1 / hz,
        speed: writeWildsCrewFollowSpeed(motion, player, now, player.x - position.x),
        sampleSegment: (_from, _to, _mode, out) => { out.allowed = true; out.y = 0; }
      });
      writeWildsCrewFollowPresentation(presentation, { x: position.x - player.x, y: 0, z: 0 }, position.x - before, 1 / hz);
      if (frame <= hz * 2) continue;
      assert.ok(Math.abs(presentation.x - displayed) < .1, `${hz} fps: no snapshot kick`);
      assert.ok(presentation.speed > 25 && presentation.speed < 48, `${hz} fps: steady walking gait`);
    }
  }
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

it("terrain snapshot changes ease vertically with the same bounded response as horizontal changes",()=>{
 for(const hz of [30,60,120]) {
  const state={x:0,y:0,z:0,distance:0,speed:0,travelled:0};
  const target={x:.6,y:.6,z:.6};
  writeWildsCrewFollowPresentation(state,target,0,1/hz);
  assert.ok(state.y>0&&state.y<.6);
  assert.equal(state.x,state.y);
  for(let frame=1;frame<hz;frame++)writeWildsCrewFollowPresentation(state,target,0,1/hz);
  assert.ok(Math.abs(state.y-.6)<1e-6);
  writeWildsCrewFollowPresentation(state,{x:20,y:5,z:30},0,1/hz,true);
  assert.equal(state.y,5,'explicit relocation lands immediately');
 }
});
