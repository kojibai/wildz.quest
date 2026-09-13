import assert from "node:assert/strict";
import { it } from "node:test";
import { observeWildsCrewTravelPause } from "../src/features/play/wilds-crew-travel-pause";
it("allows route publication to reach Roam before declaring a pause",()=>{
 const initial=observeWildsCrewTravelPause(undefined,true,true,100);
 assert.deepEqual(initial,{since:100,blocked:false});
 assert.equal(observeWildsCrewTravelPause(initial.since,true,true,600).blocked,false);
 assert.deepEqual(observeWildsCrewTravelPause(initial.since,false,true,1100),{since:undefined,blocked:false});
});
it("blocks sustained physical readiness or locomotion pauses without asserting arrival",()=>{
 const first=observeWildsCrewTravelPause(undefined,true,true,500);
 assert.equal(observeWildsCrewTravelPause(first.since,true,true,2499).blocked,false);
 assert.equal(observeWildsCrewTravelPause(first.since,true,true,2500).blocked,true);
 assert.deepEqual(observeWildsCrewTravelPause(first.since,true,false,3000),{since:undefined,blocked:false});
 assert.equal(observeWildsCrewTravelPause(first.since,true,true,100).blocked,false);
});
