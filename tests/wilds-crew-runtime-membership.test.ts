import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsCrewTravelRuntime,wildsCrewResidentExcludedIds,type WildsCrewTravelEntry } from "../src/features/play/wilds-crew-travel-runtime";
import { projectWildsHomeResidents } from "../src/features/play/wilds-home-residents";
it("excludes an actually dispatched nonparty resident until its physical recall completes",()=>{
 let revision=0;const runtime=createWildsCrewTravelRuntime(()=>revision++);
 const candidates=[{id:"party"},{id:"resident"}];
 const residents=()=>projectWildsHomeResidents({candidates,ownedIds:candidates.map(card=>card.id),excludedIds:wildsCrewResidentExcludedIds(["party"],runtime),shelterPosition:{x:0,z:0},player:{x:0,z:0},spaceId:"wildz.space.outer.v1"});
 assert.deepEqual(residents(),[{id:"resident"}]);
 const entry:WildsCrewTravelEntry={proofDigest:"exact",spaceId:"wildz.space.outer.v1",position:{x:0,y:0,z:0},target:{x:12,y:0,z:0},blocked:false,paused:false};
 runtime.set("resident",entry);assert.equal(revision,1);assert.deepEqual(residents(),[]);
 for(let frame=0;frame<100;frame++)entry.position!.x+=.01;
 runtime.set("resident",{...entry,target:{x:0,y:0,z:0}}); // Recall retarget retains the same body.
 assert.equal(revision,1);assert.deepEqual(residents(),[]);
 runtime.delete("resident");assert.equal(revision,2);assert.deepEqual(residents(),[{id:"resident"}]);
 runtime.delete("missing");runtime.clear();assert.equal(revision,2);
});
it("explicit transport excludes selected roamers and dispatches still awaiting a preference update",async()=>{
 const {wildsCrewTransportAccompanyingIds}=await import("../src/features/play/wilds-crew-travel-runtime");
 assert.deepEqual(wildsCrewTransportAccompanyingIds(["selected-roamer","pending","following"],{"selected-roamer":"roam",following:"follow"},new Set(["pending"])),["following"]);
 assert.deepEqual(wildsCrewTransportAccompanyingIds(["returned"],{returned:"follow"},new Set()),["returned"]);
});
