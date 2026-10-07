import assert from "node:assert/strict";
import { test } from "node:test";
import { requireWildsResourceCustodyRail, resolveWildsWorldConditionalAppendRail, wildsResourceCustodyCapability, assertWildsFoodGatherAdmission } from "../src/lib/receiz/wilds-resource-custody-capability";
import { createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
test("a publish/readback public projection cannot authorize scarce resource or payable custody",()=>{
  const projection={publishPublicStore:async()=>({ok:true}),restoreLatestPublicStore:async()=>({state:{}})};
  assert.equal(resolveWildsWorldConditionalAppendRail(projection),null);
  assert.deepEqual(wildsResourceCustodyCapability(projection),{sourceLock:"unavailable",foodSource:"unavailable",resourceTransfer:"unavailable",resourceMarket:"unavailable",reasonCode:"receiz_conditional_resource_custody_unavailable"});
  assert.throws(()=>requireWildsResourceCustodyRail(projection),/conditional_resource_custody_unavailable/);
});
test("finite local food history cannot become native title without an actual admitted gather",async()=>{
  const owner="sender.receiz.id",plant=wildsNourishmentPlantsForTile(3,3)[0]!;
  const gathered=gatherWildsNourishment({state:createWildsNourishmentState(owner),ownerReceizId:owner,sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,100).head,kaiUPulse:100,player:plant.position,spaceId:"wildz.space.outer.v1"});
  if(!gathered.ok)throw Error("fixture");
  const member={kind:"food" as const,id:gathered.item.itemId,foodItem:gathered.item,nourishment:gathered.state};
  let sourceReads=0;
  const port={readLatest:async()=>({}),compareAndAppend:async()=>({}),verifyAdmissionProof:async()=>true};
  await assert.rejects(()=>assertWildsFoodGatherAdmission({wildzWorld:port},member,"native:sender",101),/admitted_food_source_unavailable/);
  const verifiedPort={...port,verifyFoodGatherAdmission:async()=>{sourceReads++;return true;}};
  await assert.rejects(()=>assertWildsFoodGatherAdmission({wildzWorld:verifiedPort},member,"native:sender",99),/future_source_invalid/);
  assert.equal(sourceReads,0);
  await assertWildsFoodGatherAdmission({wildzWorld:verifiedPort},member,"native:sender",101);
  assert.equal(sourceReads,1);
  await assert.rejects(()=>assertWildsFoodGatherAdmission({wildzWorld:{...verifiedPort,verifyFoodGatherAdmission:async()=>false}},member,"native:sender",101),/source_unadmitted/);
});
test("resource custody requires an explicit conditional source rail and proof verification",()=>{
  assert.equal(resolveWildsWorldConditionalAppendRail({client:{wildzWorld:{readLatest(){},compareAndAppend(){}}}}),null);
  const rail={readLatest:async()=>({}),compareAndAppend:async()=>({}),verifyAdmissionProof:async()=>true};
  assert.ok(requireWildsResourceCustodyRail({client:{wildzWorld:rail}}));
  assert.equal(wildsResourceCustodyCapability({wildzWorld:rail}).sourceLock,"available");
  assert.equal(wildsResourceCustodyCapability({wildzWorld:rail}).resourceMarket,"unavailable");
  assert.equal(wildsResourceCustodyCapability({wildzWorld:rail,wildzResourcePackageMarket:rail}).resourceMarket,"available");
});
