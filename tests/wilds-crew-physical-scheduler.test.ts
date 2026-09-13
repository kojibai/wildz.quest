import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsCrewPhysicalScheduler, writeWildsCrewVisualPosition } from "../src/features/play/wilds-crew-physical-scheduler";
import type { WildsCrewTravelEntry,WildsCrewTravelRuntime } from "../src/features/play/wilds-crew-travel-runtime";
import type { WildsCrewNavigationAuthority } from "../src/features/play/wilds-crew-navigation";
const entry=():WildsCrewTravelEntry=>({proofDigest:"exact",spaceId:"outer",target:{x:8,y:0,z:0},position:{x:0,y:0,z:0},paused:false,blocked:false});
const clear:WildsCrewNavigationAuthority={mode:"walk",permittedModes:["walk"],sampleSegment:(_from,_to,_mode,out)=>{out.allowed=true;out.y=0;}};
it("roundrobins beyond route cache capacity without dropping physical positions or starving entries",()=>{
 const runtime:WildsCrewTravelRuntime=new Map(Array.from({length:20},(_,i)=>[String(i),entry()]));
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>clear});
 for(let i=0;i<20;i++){const result=scheduler.tick(i*100);assert.ok(result.processed<=2);assert.ok(result.plans<=1);assert.ok(result.cachedRoutes<=12);}
 assert.equal(runtime.size,20);
 for(const value of runtime.values()){assert.ok(value.position!.x>0);assert.ok(value.position!.x<=2.2+.000001);}
});
it("hands party movement to exactly one writer and resumes from its last actual position",()=>{
 const value=entry(),runtime=new Map([["creature",value]]);let party=true;
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>party?"party":clear});
 scheduler.tick(0);assert.equal(value.position!.x,0);
 value.position!.x=3;party=false;scheduler.tick(500);assert.ok(value.position!.x>3&&value.position!.x<=3.55);
 party=true;const prior={...value.position!};scheduler.tick(600);assert.deepEqual(value.position,prior);
});
it("pauses unavailable geometry/readiness and explicit halted trips without inventing arrival",()=>{
 const value=entry(),runtime=new Map([["creature",value]]);let loaded=false;
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>loaded?clear:null});
 scheduler.tick(0);assert.equal(value.paused,true);assert.equal(value.position!.x,0);
 loaded=true;value.halted=true;scheduler.tick(500);assert.equal(value.position!.x,0);
 value.halted=false;scheduler.tick(1000);assert.equal(value.paused,false);assert.ok(value.position!.x>0);
});
it("refuses missing dispatch coordinates and unsupported movement modes",()=>{
 const value=entry(),runtime=new Map([["creature",value]]);
 value.position=null;
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>({...clear,permittedModes:[]})});
 scheduler.tick(0);assert.equal(value.position,null);assert.equal(value.paused,true);
 value.position={x:0,y:0,z:0};scheduler.tick(500);assert.equal(value.position.x,0);
});
it("commits a physical obstacle detour with bounded plans and never crosses the blocker",()=>{
 const value=entry();value.target.x=5;
 const runtime=new Map([["creature",value]]);
 const blocked:WildsCrewNavigationAuthority={...clear,sampleSegment:(from,to,_mode,out)=>{
  out.y=0;out.allowed=true;
  for(let i=0;i<=20;i++){const x=from.x+(to.x-from.x)*i/20,z=from.z+(to.z-from.z)*i/20;if(x>1.5&&x<2.5&&Math.abs(z)<.7)out.allowed=false;}
 }};
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>blocked});let detoured=false;
 for(let i=0;i<100;i++){const before={...value.position!};scheduler.tick(i*100);const out={allowed:false,y:NaN};blocked.sampleSegment(before,value.position!,"walk",out);assert.equal(out.allowed,true);detoured ||= Math.abs(value.position!.z)>.7;}
 assert.equal(detoured,true);assert.ok(Math.hypot(value.position!.x-5,value.position!.z)<.001);
});
it("target changes and long scheduling gaps never teleport or overshoot",()=>{
 const value=entry(),runtime=new Map([["creature",value]]);
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>clear});scheduler.tick(0);
 value.target={x:-10,y:0,z:0};const before=value.position!.x;scheduler.tick(100);assert.ok(Math.abs(value.position!.x-before)<=.55+.00001);
 value.target={x:value.position!.x+.01,y:0,z:0};scheduler.tick(200);assert.equal(value.position!.x,value.target.x);
});

it("smooths only an admitted segment while authoritative position and arrivals stay unchanged",()=>{
 const value=entry(),runtime=new Map([["creature",value]]);
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>clear});scheduler.tick(1000);
 const actual={...value.position!},out={x:0,y:0,z:0};
 assert.equal(writeWildsCrewVisualPosition(out,value,1000),5.5);assert.equal(out.x,0);
 assert.equal(writeWildsCrewVisualPosition(out,value,1050),5.5);assert.ok(Math.abs(out.x-.275)<1e-9);
 assert.deepEqual(value.position,actual);
 assert.equal(writeWildsCrewVisualPosition(out,value,1100),0);assert.deepEqual(out,actual);
 writeWildsCrewVisualPosition(out,value,100000);assert.deepEqual(out,actual);
});
it("interpolation follows the current swept segment at corners and discards stale transport poses",()=>{
 const value=entry(),out={x:0,y:0,z:0};
 value.position={x:1,y:0,z:1};value.visualStep={from:{x:1,y:0,z:0},to:{x:1,y:0,z:1},startedAtMs:1000,durationMs:200};
 writeWildsCrewVisualPosition(out,value,1100);assert.deepEqual(out,{x:1,y:0,z:.5});
 value.position={x:5,y:0,z:5};writeWildsCrewVisualPosition(out,value,1100);assert.deepEqual(out,value.position);
});
it("twenty obstructed agents make detour progress despite route eviction without double steps",()=>{
 const runtime:WildsCrewTravelRuntime=new Map(Array.from({length:20},(_,i)=>[String(i),{...entry(),target:{x:5,y:0,z:0}}]));
 const obstacle:WildsCrewNavigationAuthority={...clear,sampleSegment:(from,to,_mode,out)=>{
  out.y=0;out.allowed=true;
  for(let i=0;i<=20;i++){const x=from.x+(to.x-from.x)*i/20,z=from.z+(to.z-from.z)*i/20;if(x>1.5&&x<2.5&&Math.abs(z)<.7)out.allowed=false;}
 }};
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>obstacle});
 for(let tick=0;tick<1400;tick++){
  const before=new Map([...runtime].map(([id,value])=>[id,{...value.position!}]));
  const result=scheduler.tick(tick*100);assert.ok(result.processed<=2&&result.plans<=1&&result.cachedRoutes<=12);
  for(const [id,value] of runtime){const prior=before.get(id)!;assert.ok(Math.hypot(value.position!.x-prior.x,value.position!.z-prior.z)<=.55+.000001);const out={allowed:false,y:NaN};obstacle.sampleSegment(prior,value.position!,"walk",out);assert.equal(out.allowed,true);}
 }
 for(const [id,value] of runtime)assert.ok(Math.hypot(value.position!.x-5,value.position!.z)<.001,id);
});
it("one unreachable agent cannot consume every plan ahead of a reachable detour",()=>{
 const runtime=new Map([["unreachable",entry()],["detour",{...entry(),target:{x:5,y:0,z:0}}]]);
 const obstacle:WildsCrewNavigationAuthority={...clear,sampleSegment:(from,to,_mode,out)=>{
  out.y=0;out.allowed=true;
  for(let i=0;i<=20;i++){const x=from.x+(to.x-from.x)*i/20,z=from.z+(to.z-from.z)*i/20;if(x>1.5&&x<2.5&&Math.abs(z)<.7)out.allowed=false;}
 }};
 const denied:WildsCrewNavigationAuthority={...clear,sampleSegment:(_from,_to,_mode,out)=>{out.y=0;out.allowed=false;}};
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:id=>id==="unreachable"?denied:obstacle});
 for(let tick=0;tick<100;tick++)scheduler.tick(tick*100);
 assert.equal(runtime.get("unreachable")!.position!.x,0);
 const point=runtime.get("detour")!.position!;assert.ok(Math.hypot(point.x-5,point.z)<.001);
});

it("bounded eligibility refresh lets one moving creature keep its cadence among a hundred halted entries",()=>{
 const runtime:WildsCrewTravelRuntime=new Map(Array.from({length:100},(_,i)=>[String(i),{...entry(),halted:true}]));
 const mover=entry();mover.target.x=100;runtime.set("moving",mover);
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>clear});
 for(let tick=0;tick<50;tick++){const result=scheduler.tick(tick*100);assert.ok(result.examined<=18);assert.ok(result.processed<=2);}
 const prior=mover.position!.x;const result=scheduler.tick(5000);
 assert.equal(result.eligibleAgents,1);assert.ok(Math.abs(mover.position!.x-prior-.55)<1e-6);
 assert.equal(mover.visualStep!.durationMs,100);assert.equal(runtime.size,101);
});
it("visual interpolation spans a service interval above one second without inventing movement",()=>{
 const runtime:WildsCrewTravelRuntime=new Map(Array.from({length:44},(_,i)=>[String(i),{...entry(),target:{x:100,y:0,z:0}}]));
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>clear});
 for(let tick=0;tick<80;tick++)scheduler.tick(tick*100);
 const value=[...runtime.values()].find(value=>value.visualStep?.durationMs===2200)!;assert.ok(value);
 const actual={...value.position!},out={x:0,y:0,z:0},step=value.visualStep!;
 assert.ok(writeWildsCrewVisualPosition(out,value,step.startedAtMs+1500)>0);
 assert.ok(out.x>step.from.x&&out.x<step.to.x);assert.deepEqual(value.position,actual);
});
it("finishes the already admitted visual segment when a large roster shrinks",()=>{
 const value=entry(),runtime:WildsCrewTravelRuntime=new Map([["moving",value]]);
 value.position={x:.55,y:0,z:0};value.visualStep={from:{x:0,y:0,z:0},to:{x:.55,y:0,z:0},startedAtMs:0,durationMs:2200};
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>clear});
 scheduler.tick(1000);assert.equal(value.position.x,.55);
 const visual={x:0,y:0,z:0};writeWildsCrewVisualPosition(visual,value,2199);assert.ok(visual.x<.55);
 scheduler.tick(2200);assert.equal(value.visualStep.from.x,.55);assert.ok(value.position.x>.55);assert.equal(value.visualStep.durationMs,100);
});

it("keeps a safe detour while the returning destination moves behind a wide rock",()=>{
 const value={...entry(),target:{x:10,y:0,z:0}},runtime=new Map([["returning",value]]);
 const obstacle:WildsCrewNavigationAuthority={...clear,sampleSegment:(from,to,_mode,out)=>{
   out.y=0;out.allowed=true;
   for(let i=0;i<=30;i++)if(Math.hypot(from.x+(to.x-from.x)*i/30-4,from.z+(to.z-from.z)*i/30)<2)out.allowed=false;
 }};
 const scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:()=>obstacle});
 for(let i=0;i<160;i++){
   value.target={x:10,y:0,z:i%2? .1:0};
   scheduler.tick(i*100);
   assert.ok(Math.hypot(value.position!.x-4,value.position!.z)>=2,"never walks through the rock");
 }
 assert.ok(value.position!.x>9,"returns around the obstacle despite moving owner");
});
