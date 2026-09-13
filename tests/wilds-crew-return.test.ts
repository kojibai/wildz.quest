import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsCrewExpeditions, wildsCrewReturnNeedsRetarget } from "../src/features/play/wilds-crew-expedition";
import { createWildsCrewTravelAuthority } from "../src/features/play/wilds-crew-travel-authority";
import { admitWildsDiscoveryPhysicalNeighborhood } from "../src/features/play/wilds-discovery-sites";
import { prepareWildsSiteRuntime } from "../src/features/play/wilds-site-runtime";
import { wildsTerrainElevation } from "../src/features/play/wilds-terrain-authority";
import { createWildsCrewPhysicalScheduler } from "../src/features/play/wilds-crew-physical-scheduler";
import type { WildsCrewTravelEntry } from "../src/features/play/wilds-crew-travel-runtime";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

test("recall from forty metres detours across sampler cells and completes only on observed arrival",async()=>{
  const home={x:0,y:0,z:0},proofDigest="a".repeat(64),spaceId="cave";
  const store=createWildsCrewExpeditions(createMemoryWildzContinuityDatabase());
  let trip=await store.start({ownerReceizId:"owner",assetId:"asset",proofDigest,
    disposition:{assetId:"asset",proofDigest,identityAnchor:"genome",temperament:"curious",workFamilies:[],riskTolerance:22,restAtFatigue:60,preferenceSeed:123},
    origin:home,spaceId,candidates:[{pointId:"known",spaceId,position:{x:12,y:0,z:0},risk:0,reachable:true}],kaiUPulse:100,requestId:"trip"});
  trip=await store.recall({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:101,returnPosition:home,spaceId});
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0);
  const siteRuntime=prepareWildsSiteRuntime({...physical,solids:[{id:"wall",siteKey:"cave",spaceId,center:{x:37,y:.75,z:0},halfExtents:{x:.1,y:.75,z:.7}}],surfaces:[{id:"floor",siteKey:"cave",spaceId,kind:"interior-floor",center:{x:20,y:0,z:0},halfExtents:{x:50,y:.1,z:10},flooded:false}]});
  const authority=createWildsCrewTravelAuthority({runtime:siteRuntime,spaceId,obstacles:[]});
  const entry:WildsCrewTravelEntry={proofDigest,spaceId,position:{x:40,y:0,z:0},target:{...trip.goal!},paused:false,blocked:false};
  const runtime=new Map([["asset",entry]]),scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:(_id,value)=>authority(value.position!)});
  await assert.rejects(store.arrive({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:102,actualPosition:entry.position!,spaceId}),/not_arrived/);
  let detoured=false;
  for(let tick=0;tick<180;tick++){
    const before=entry.position!.x;scheduler.tick(tick*100);
    detoured ||= Math.abs(entry.position!.z)>.7;
    assert.ok(Math.abs(entry.position!.x-before)<=.55+.00001,"no teleport or lost-time catch-up");
  }
  assert.equal(detoured,true);
  trip=await store.arrive({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:103,actualPosition:entry.position!,spaceId});
  assert.equal(trip.phase,"completed");assert.equal(trip.kind,"returned");assert.deepEqual(trip.visitedPointIds,[]);
});

test("a distant recalled creature gets its own canonical collision coverage and walks home",()=>{
  const authority=createWildsCrewTravelAuthority({runtime:prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(4,4)),spaceId:"wildz.space.outer.v1",obstacles:[]});
  const entry:WildsCrewTravelEntry={proofDigest:"proof",spaceId:"wildz.space.outer.v1",position:{x:0,y:wildsTerrainElevation(0,0),z:0},target:{x:1.6,y:wildsTerrainElevation(1.6,0),z:0},paused:true,blocked:false};
  const runtime=new Map([["returning",entry]]),scheduler=createWildsCrewPhysicalScheduler({runtime:()=>runtime,admit:(_id,value)=>authority(value.position!)});
  for(let tick=0;tick<10;tick++)scheduler.tick(tick*100);
  assert.equal(entry.paused,false);
  assert.ok(Math.hypot(entry.position!.x-entry.target.x,entry.position!.z-entry.target.z)<.8);
});

test("remote collision coverage retains a current construction wall",()=>{
  const from={x:0,y:wildsTerrainElevation(0,0),z:0},to={x:1.6,y:wildsTerrainElevation(1.6,0),z:0};
  const authority=createWildsCrewTravelAuthority({runtime:prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(4,4)),spaceId:"wildz.space.outer.v1",obstacles:[{id:"wall",kind:"structure",material:"solid",position:{x:.8,y:from.y+.75,z:0},radius:1.1,shape:{kind:"box",halfX:.005,halfY:.75,halfZ:1},visualScale:1}]})(from);
  assert.ok(authority);
  const out={allowed:false,y:NaN};authority.sampleSegment(from,to,"walk",out);
  assert.equal(out.allowed,false);
});

test("return follows a changed floor even when horizontal player movement stays below two metres",()=>{
  const row={phase:"returning" as const,spaceId:"outer",home:{x:0,y:0,z:0}};
  assert.equal(wildsCrewReturnNeedsRetarget(row,{x:1,y:1,z:0},"outer"),true);
  assert.equal(wildsCrewReturnNeedsRetarget(row,{x:0,y:2,z:0},"outer"),true);
  assert.equal(wildsCrewReturnNeedsRetarget(row,{x:1,y:.1,z:0},"outer"),false);
  assert.equal(wildsCrewReturnNeedsRetarget(row,{x:3,y:0,z:0},"outer"),true);
  assert.equal(wildsCrewReturnNeedsRetarget(row,{x:3,y:2,z:0},"cave"),false);
  assert.equal(wildsCrewReturnNeedsRetarget({...row,phase:"outbound"},{x:3,y:2,z:0},"outer"),false);
});
