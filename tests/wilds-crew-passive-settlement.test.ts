import assert from "node:assert/strict";
import { it } from "node:test";
import { applyWildsInput, initialPlayState, type PlayState } from "../src/features/play/game-state";
import { admitLegacyCard, currentRevision } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { isWildsCrewPhysicallyActive, settleWildsCrewPendingGrowth } from "../src/features/play/wilds-crew-passive-settlement";
function queuedTravel():PlayState {
 const at="2026-07-13T11:00:00.000Z";
 const card=admitLegacyCard(sealCollectedCard({formId:"mintcub-1",ownerReceizId:"travel_player",encounterId:"crew-physical-trip",capturedAt:at}),at);
 return applyWildsInput({...structuredClone(initialPlayState),inventory:[card],selectedAssetId:card.id,selectedCardId:card.manifest.familyId,livingProgress:{[card.id]:currentRevision(card).growth},player:{x:7.9,z:0}},{type:"move",direction:"east"});
}
it("retains exact trip proof and queued growth until physical trip finishes",()=>{
 const state=queuedTravel(),card=state.inventory[0]!;
 assert.equal(state.pendingTravelGrowthEvents.length,1);
 const trips=new Map([[card.id,{owner:"travel_player",proofDigest:card.proof.digest}]]);
 const during=settleWildsCrewPendingGrowth(state,"travel_player",trips);
 assert.equal(during,state);
 assert.equal(during.adventureConditions,state.adventureConditions);
 trips.clear();
 const after=settleWildsCrewPendingGrowth(during,"travel_player",trips);
 assert.equal(after.pendingTravelGrowthEvents.length,0);
 assert.notEqual(after.inventory[0]!.proof.digest,card.proof.digest);
 assert.equal(after.livingProgress[card.id]!.paths.bond,state.livingProgress[card.id]!.paths.bond+1);
});
it("does not let stale owner or proof suppress passive work",()=>{
 const state=queuedTravel(),card=state.inventory[0]!;
 const trips=new Map([[card.id,{owner:"travel_player",proofDigest:card.proof.digest}]]);
 assert.equal(isWildsCrewPhysicallyActive(card,"other_player",trips),false);
 trips.set(card.id,{owner:"travel_player",proofDigest:"old-proof"});
 assert.equal(isWildsCrewPhysicallyActive(card,"travel_player",trips),false);
 assert.equal(settleWildsCrewPendingGrowth(state,"travel_player",trips).pendingTravelGrowthEvents.length,0);
});
it("bounded settlement skips protected events without discarding or reordering them",()=>{
 const state=queuedTravel(),card=state.inventory[0]!,pending=state.pendingTravelGrowthEvents[0]!;
 const other={...pending,assetId:"removed-card"};
 const queued={...state,pendingTravelGrowthEvents:[pending,other,pending,other]};
 const trips=new Map([[card.id,{owner:"travel_player",proofDigest:card.proof.digest}]]);
 const result=settleWildsCrewPendingGrowth(queued,"travel_player",trips,1);
 assert.deepEqual(result.pendingTravelGrowthEvents,[pending,pending,other]);
 assert.equal(result.inventory,state.inventory);
});
