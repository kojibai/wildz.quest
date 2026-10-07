import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt, creditWildsImportedPackageFood, availableWildsFood, restoreWildsNourishmentState, consumeWildsNourishment, retainWildsAnimalFoodSources, reconcileWildsNourishmentCustody, recoverWildsUnpackedPackageFood, mergeWildsImportedNourishment } from "../src/features/play/wilds-nourishment";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { createWildsResourcePackage } from "../src/features/play/wilds-resource-package";
function food() {
  const owner="sender.receiz.id",plant=wildsNourishmentPlantsForTile(3,3)[0]!;
  const result=gatherWildsNourishment({state:createWildsNourishmentState(owner),ownerReceizId:owner,sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,100).head,kaiUPulse:100,player:plant.position,spaceId:"wildz.space.outer.v1"});
  if(!result.ok)throw Error("fixture");return {kind:"food" as const,id:result.item.itemId,foodItem:result.item,nourishment:result.state};
}
test("imported food preserves its gatherer's source while recipient can consume once",()=>{
  const member=food(),receiver=createWildsNourishmentState("receiver.receiz.id");
  const credited=creditWildsImportedPackageFood(receiver,[member],{packageId:"wildz:package:one",receiptId:"receipt:one"},101);
  assert.equal(credited.items[member.id]!.ownerReceizId,"sender.receiz.id");
  assert.equal(availableWildsFood(credited).length,1);
  assert.equal(availableWildsFood(creditWildsImportedPackageFood(credited,[member],{packageId:"wildz:package:one",receiptId:"receipt:one"},102)).length,1);
  const restored=restoreWildsNourishmentState(credited,"receiver.receiz.id")!;assert.ok(restored);
  assert.equal(availableWildsFood(retainWildsAnimalFoodSources(restored,undefined)).length,1);
  const eaten=consumeWildsNourishment({state:restored,ownerReceizId:"receiver.receiz.id",itemId:member.id,kaiUPulse:103,reserveMicroBreaths:0});
  assert.equal(eaten.ok,true);if(!eaten.ok)throw Error("eat rejected");
  assert.equal(availableWildsFood(eaten.state).length,0);
  assert.equal(consumeWildsNourishment({state:eaten.state,ownerReceizId:"receiver.receiz.id",itemId:member.id,kaiUPulse:104,reserveMicroBreaths:0}).ok,false);
});
test("custody exclusion frees carried capacity without deleting finite gather or meal history",()=>{
  const owner="sender.receiz.id",plants=Array.from({length:12},(_,x)=>Array.from({length:12},(_,z)=>wildsNourishmentPlantsForTile(x,z))).flat(2);
  let state=createWildsNourishmentState(owner);
  for(const plant of plants.slice(0,128)){
    const result=gatherWildsNourishment({state,ownerReceizId:owner,sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,state.sources[plant.sourceId],100).head,kaiUPulse:100,player:plant.position,spaceId:"wildz.space.outer.v1"});
    if(!result.ok)throw Error(result.reason);state=result.state;
  }
  assert.equal(availableWildsFood(state).length,128);
  const blocked=Object.keys(state.items)[0]!,world={...initialWildsWorldProjection(),reservedFoodItems:{[blocked]:"package:locked"}};
  const reconciled=reconcileWildsNourishmentCustody(state,world,owner)!;
  assert.equal(availableWildsFood(reconciled).length,127);
  assert.deepEqual(reconciled.items[blocked],state.items[blocked]);
  assert.equal(consumeWildsNourishment({state:reconciled,ownerReceizId:owner,itemId:blocked,kaiUPulse:101,reserveMicroBreaths:0}).ok,false);
  const next=plants[128]!;
  const gather=gatherWildsNourishment({state:reconciled,ownerReceizId:owner,sourceId:next.sourceId,expectedSourceHead:wildsNourishmentSourceAt(next,undefined,101).head,kaiUPulse:101,player:next.position,spaceId:"wildz.space.outer.v1"});
  assert.equal(gather.ok,true);
  assert.equal(restoreWildsNourishmentState(reconciled,owner)!.unavailableItemIds?.includes(blocked),true);
});
test("an admitted unpack survives a lost credit response and stale competing owner save",()=>{
  const member=food(),owner="receiver.receiz.id",packageProof=createWildsResourcePackage({ownerReceizId:member.foodItem.ownerReceizId,createdKaiUPulse:100,commandId:"package:recover",members:[member]});
  const world={...initialWildsWorldProjection(),resourcePackages:{[packageProof.packageId]:{package:packageProof,ownerReceizId:owner,revision:3,sourceRevision:4,custodyOwners:[member.foodItem.ownerReceizId,owner],updatedKaiUPulse:103,status:"unpacked" as const,receiptId:"receipt:one",subjectId:"subject:one",subjectHead:"a".repeat(64),transferId:"transfer:one"}},foodItems:{[member.id]:member},foodCustody:{[member.id]:{ownerReceizId:owner,packageId:packageProof.packageId,receiptId:"receipt:one"}}};
  const original=createWildsNourishmentState(owner),recovered=recoverWildsUnpackedPackageFood(original,world,104);
  assert.equal(availableWildsFood(recovered).length,1);
  assert.equal(recoverWildsUnpackedPackageFood(recovered,world,105),recovered);
  const eaten=consumeWildsNourishment({state:recovered,ownerReceizId:owner,itemId:member.id,kaiUPulse:106,reserveMicroBreaths:0});
  if(!eaten.ok)throw Error(eaten.reason);
  const merged=mergeWildsImportedNourishment(recovered,eaten.state)!;
  assert.equal(availableWildsFood(restoreWildsNourishmentState(merged,owner)).length,0);
  assert.equal(merged.importedItems![member.id]!.foodItem.ownerReceizId,"sender.receiz.id");
});
