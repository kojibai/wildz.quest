import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsCrewPhysicalScheduler } from "../src/features/play/wilds-crew-physical-scheduler";
import { wildsCrewUsesFrameWriter, writeWildsCrewRetainedTravelPosition, type WildsCrewTravelEntry } from "../src/features/play/wilds-crew-travel-runtime";
import type { WildsCrewNavigationAuthority } from "../src/features/play/wilds-crew-navigation";

test("map suspension hands a party return to the bounded timer and resumes from that exact anchor",()=>{
  const entry:WildsCrewTravelEntry={proofDigest:"proof",spaceId:"cave",position:{x:0,y:0,z:0},target:{x:5,y:0,z:0},paused:false,blocked:false};
  const runtime=new Map([["selected",entry]]),visual={...entry.position!};let suspended=false;
  const authority:WildsCrewNavigationAuthority={mode:"walk",permittedModes:["walk"],sampleSegment:(_from,_to,_mode,out)=>{out.allowed=true;out.y=0;}};
  const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>wildsCrewUsesFrameWriter(true,suspended)?"party":authority});
  scheduler.tick(0);assert.equal(entry.position!.x,0,"a live frame owns party movement");
  suspended=true;
  scheduler.tick(500);assert.ok(entry.position!.x>0&&entry.position!.x<=.55);
  for(let tick=6;tick<15;tick++)scheduler.tick(tick*100);
  const returned={...entry.position!};assert.ok(returned.x>4);
  suspended=false;scheduler.tick(1500);assert.deepEqual(entry.position,returned,"no second writer after resume");
  assert.equal(writeWildsCrewRetainedTravelPosition(visual,entry,"proof","cave"),true);
  assert.deepEqual(visual,returned);
  assert.equal(writeWildsCrewRetainedTravelPosition(visual,entry,"proof","cave"),false,"no repeated route reset");
  runtime.delete("selected");
  const staleVisual={x:0,y:0,z:0};
  assert.equal(writeWildsCrewRetainedTravelPosition(staleVisual,entry,"proof","cave"),true,"completion can retain its last physical anchor");
  assert.equal(writeWildsCrewRetainedTravelPosition({x:0,y:0,z:0},entry,"other-proof","cave"),false);
  assert.equal(writeWildsCrewRetainedTravelPosition({x:0,y:0,z:0},entry,"proof","other-space"),false);
});
