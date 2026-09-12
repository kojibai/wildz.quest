import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsCrewExpeditions, chooseWildsCrewExpeditionStops, WILDS_CREW_EXPEDITION_OBSERVE_UPULSES } from "../src/features/play/wilds-crew-expedition";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
const origin={x:0,y:0,z:0};
const disposition={assetId:"asset",proofDigest:"a".repeat(64),identityAnchor:"genome",temperament:"curious",workFamilies:[],riskTolerance:22,restAtFatigue:60,preferenceSeed:123};
const candidates=Array.from({length:8},(_,i)=>({pointId:`known-point-${i}`,spaceId:"outer",position:{x:5+i*3,y:0,z:0},risk:0,reachable:true}));
const start={ownerReceizId:"owner",assetId:"asset",proofDigest:disposition.proofDigest,disposition,origin,spaceId:"outer",candidates,kaiUPulse:100,requestId:"start"};
it("chooses at most three deterministic known stops within32m from exact current disposition",()=>{
 const stops=chooseWildsCrewExpeditionStops(start);
 assert.ok(stops.length>0&&stops.length<=3);assert.deepEqual(chooseWildsCrewExpeditionStops(start),stops);
 assert.ok(stops.every(stop=>candidates.some(candidate=>candidate.pointId===stop.pointId)&&Math.hypot(stop.position.x,stop.position.y,stop.position.z)<=32));
 assert.deepEqual(chooseWildsCrewExpeditionStops({...start,candidates:[{...candidates[0],position:{x:33,y:0,z:0}},{...candidates[1],reachable:false},{...candidates[2],risk:99}]}),[]);
 assert.throws(()=>chooseWildsCrewExpeditionStops({...start,proofDigest:"changed"}),/proof/);
});
it("persists real arrival observations, requires physical distance, and returns to exact origin",async()=>{
 const db=createMemoryWildzContinuityDatabase();let store=createWildsCrewExpeditions(db);let trip=await store.start(start);
 const base=()=>({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:99});
 await assert.rejects(store.arrive({...base(),spaceId:"outer",actualPosition:origin}),/not_arrived/);
 trip=await store.arrive({...base(),spaceId:"outer",actualPosition:trip.stops[0].position});
 assert.equal(trip.phase,"observing");assert.equal(trip.observedKaiUPulse,99);assert.equal(trip.causalKaiUPulse,100);assert.equal(trip.visitedPointIds.length,1);
 store=createWildsCrewExpeditions(db);assert.deepEqual(await store.read("owner","asset"),trip);
 trip=await store.recall(base());assert.equal(trip.phase,"returning");
 await assert.rejects(store.arrive({...base(),spaceId:"outer",actualPosition:trip.stops[0].position}),/not_arrived/);
 trip=await store.arrive({...base(),spaceId:"outer",actualPosition:origin});assert.equal(trip.phase,"completed");
 const history=await store.history("owner","asset",undefined,2);assert.equal(history.observations[0].kind,"returned");assert.ok(history.nextCursor);
 assert.equal((await store.history("owner","asset",history.nextCursor!,128)).observations.filter(row=>row.kind==="visited").length,1);
});
it("CAS arbitrates tabs, exact retries are idempotent, and owner histories stay isolated",async()=>{
 const db=createMemoryWildzContinuityDatabase(),a=createWildsCrewExpeditions(db),b=createWildsCrewExpeditions(db);
 const results=await Promise.allSettled([a.start(start),b.start({...start,requestId:"other"})]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 const trip=(results.find(r=>r.status==="fulfilled")!).value;
 const request={ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:101};
 const recalled=await a.recall(request);assert.deepEqual(await b.recall(request),recalled);
 await assert.rejects(b.block({...request,reason:"wall"}),/head_conflict/);
 assert.equal(await b.read("another-owner","asset"),null);
});
it("rolls back observation and head together; missing candidates cannot become fictional travel",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewExpeditions(db);
 db.failNextTransactionAfterPuts(1);await assert.rejects(store.start(start));assert.equal(await store.read("owner","asset"),null);
 const trip=await store.start({...start,candidates:[]});assert.equal(trip.phase,"blocked");assert.equal(trip.stops.length,0);
 await assert.rejects(store.arrive({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,spaceId:"outer",actualPosition:origin,kaiUPulse:101}),/phase/);
});
it("waits a full Kai observation interval, visits each stop once, and preserves earlier trips",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewExpeditions(db);let trip=await store.start(start);let kai=100;
 const base=()=>({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:kai});
 for(let i=0;i<trip.stops.length;i++){
   const destination=trip.currentStop!.position;
   trip=await store.arrive({...base(),spaceId:"outer",actualPosition:destination});
   await assert.rejects(store.continue(base()),/observation_incomplete/);
   await assert.rejects(store.arrive({...base(),spaceId:"outer",actualPosition:destination}),/phase/);
   kai+=WILDS_CREW_EXPEDITION_OBSERVE_UPULSES;trip=await store.continue(base());
 }
 assert.equal(trip.phase,"returning");assert.equal(trip.visitedPointIds.length,trip.stops.length);
 trip=await store.arrive({...base(),spaceId:"outer",actualPosition:origin});assert.equal(trip.phase,"completed");
 const earlierHead=trip.head;
 trip=await store.start({...start,requestId:"next",kaiUPulse:kai});assert.equal(trip.previousHead,earlierHead);
 const history=await store.history("owner","asset",undefined,128);assert.equal(history.observations.filter(row=>row.kind==="returned").length,1);
 assert.equal(history.observations.filter(row=>row.kind==="visited").length,trip.stops.length);
});
it("never changes an active proof or accepts another physical space, and bounds candidate/history work",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewExpeditions(db);const trip=await store.start(start);
 await assert.rejects(store.start({...start,requestId:"changed",proofDigest:"b".repeat(64),disposition:{...disposition,proofDigest:"b".repeat(64)}}),/already_active/);
 await assert.rejects(store.arrive({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:100,spaceId:"elsewhere",actualPosition:trip.goal!}),/position_invalid/);
 assert.equal((await store.read("owner","asset"))?.proofDigest,disposition.proofDigest);
 assert.throws(()=>chooseWildsCrewExpeditionStops({...start,candidates:Array.from({length:129},()=>candidates[0])}),/input_invalid/);
 await assert.rejects(store.history("owner","asset",undefined,129),/window_invalid/);
 assert.deepEqual(chooseWildsCrewExpeditionStops({...start,candidates:[{...candidates[0],position:{x:7.9,y:0,z:0}}]}),[]);
});
it("recall and return retargeting use the current player position without inventing visits",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewExpeditions(db);let trip=await store.start(start);
 const base=()=>({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:100});
 const player={x:2,y:0,z:3};trip=await store.recall({...base(),returnPosition:player,spaceId:"outer"});assert.deepEqual(trip.home,player);
 const moved={x:3,y:0,z:4};trip=await store.retargetReturn({...base(),returnPosition:moved,spaceId:"outer"});assert.deepEqual(trip.goal,moved);
 await assert.rejects(store.retargetReturn({...base(),returnPosition:moved,spaceId:"cave"}),/position_invalid/);
 trip=await store.arrive({...base(),actualPosition:moved,spaceId:"outer"});assert.equal(trip.phase,"completed");assert.equal(trip.visitedPointIds.length,0);
});
it("explicit party transport retains visits and records the actual new space without a false return",async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsCrewExpeditions(db);let trip=await store.start(start);
 const base=()=>({ownerReceizId:"owner",assetId:"asset",expectedHead:trip.head,kaiUPulse:100});
 trip=await store.arrive({...base(),actualPosition:trip.goal!,spaceId:"outer"});const visited=[...trip.visitedPointIds];
 trip=await store.transport({...base(),actualPosition:{x:100,y:-5,z:50},spaceId:"cave"});
 assert.equal(trip.phase,"completed");assert.equal(trip.kind,"transported");assert.equal(trip.actualSpaceId,"cave");assert.equal(trip.spaceId,"outer");assert.deepEqual(trip.visitedPointIds,visited);
 const history=await store.history("owner","asset");assert.equal(history.observations.filter(row=>row.kind==="returned").length,0);
 await store.start({...start,requestId:"after-transport",spaceId:"cave",origin:{x:100,y:-5,z:50},candidates:[]});
});
