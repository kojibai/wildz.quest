import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { createWildsResourcePackage } from "../src/features/play/wilds-resource-package";
import { createWildsResourcePackagePortableClaim, decodeWildsPortableClaim, encodeWildsPortableClaim } from "../src/features/play/wilds-portable-claim";
import { projectWildsResourcePackageSubjectAdmissionV122, issueWildsResourcePackageTransfer, recoverWildsResourcePackageTransfer,cancelWildsResourcePackageTransferPlan,claimWildsResourcePackageTransfer,validateWildsResourcePackageTransferOffer } from "../src/lib/receiz/wilds-resource-package";
import {receizBase64UrlEncode,digestReceizCompositeCanonical} from "@receiz/sdk";
import {executeOfferedResourcePackageCancellation} from "../src/lib/receiz/wilds-resource-package-cancellation";
import {assertWildsResourcePackagePayingTrade,assertWildsResourcePackageCancelledListing,assertWildsResourcePackageReleasedTrade} from "../src/lib/receiz/wilds-resource-package-market-authority";
import {initialWildsWorldProjection} from "../src/features/play/wilds-world-state";
import {applyWildsResourcePackageCommand,type WildsResourcePackageRecord} from "../src/features/play/wilds-resource-package-world";
import {preserveWildsResourcePackageHistory} from "../src/features/play/wilds-resource-package-continuity";
import {emptyResourcePackageMarketState,advanceResourcePackageMarketState,type ResourcePackageMarketListing,type ResourcePackageMarketTrade} from "../src/features/market/resource-package-market";
const digest=(s:string)=>s.repeat(64);
const sender={accessToken:"sender",ownerReceizId:"receiz:sender",actorId:"sender",profileHandle:"sender.receiz.id"};
const receiver={accessToken:"receiver",ownerReceizId:"receiz:receiver",actorId:"receiver",profileHandle:"receiver.receiz.id"};
async function fixture(){
  const source=[-2,-1,0,1,2].flatMap(x=>[-2,-1,0,1,2].flatMap(z=>projectWildsResourceRegion(x,z))).find(s=>s.kind==="timber")!;
  const materialLot=createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:sender.profileHandle,actorPosition:source.position,kaiUPulse:100}).lot;
  const packageProof=createWildsResourcePackage({ownerReceizId:sender.profileHandle,createdKaiUPulse:100,commandId:"package:test",members:[{kind:"material",id:materialLot.lotId,materialLot}]});
  const projected=await projectWildsResourcePackageSubjectAdmissionV122(packageProof,sender.ownerReceizId);
  let owner=sender.ownerReceizId,head=digest("d"),instrument:any,receipt:any,claims=0,issues=0,previews=0,transferStatus="pending-acceptance";
  const state=()=>({schema:"receiz.subject.state.v122",subjectId:projected.subjectId,admittedProofDigest:projected.admittedProofDigest,ownerReceizId:owner,head,ownershipHead:digest("e")});
  const rail={subjectStateV122:async()=>state(),admitSubjectV122:async()=>{throw Error("existing");},
    previewBearerTransfer:async({subjectId,policy}:any)=>{previews++;return {schema:"receiz.bearer.transfer_plan.v1",subjectId,subjectDigest:projected.admittedProofDigest,expectedSubjectHead:head,expectedOwnershipHead:digest("e"),currentOwnerReceizId:owner,transferId:digest("1"),transferDigest:digest("1"),policy,policyDigest:digest("2"),registryDigest:digest("3"),reducerDigest:digest("4")};},
    issueBearerTransferInstrument:async({plan}:any)=>{issues++;const basis={schema:"receiz.bearer.instrument.v1",plan,oneTimeClaimDigest:digest("5"),issuedAtKai:"100"};head=digestReceizCompositeCanonical({kind:"receiz.subject.transfer.pending.v1",priorHead:plan.expectedSubjectHead,transferId:plan.transferId,policyDigest:plan.policyDigest});return instrument={...basis,exactBytesB64u:receizBase64UrlEncode(new TextEncoder().encode(JSON.stringify(basis))),artifactDigest:digest("6"),status:"pending-acceptance"};},
    inspectBearerTransferInstrument:async()=>({valid:true,offlineVerified:true,instrument}),cancelBearerTransfer:async()=>{if(!instrument)return {ok:false};transferStatus="cancelled";return {ok:true};},
    bearerTransferStatus:async(id:string)=>{if(!instrument)throw Error("RECEIZ_BEARER_TRANSFER_NOT_FOUND");return {transferId:id,status:transferStatus,subjectId:projected.subjectId,instrumentDigest:instrument.artifactDigest,receiptId:receipt?.receiptId??null};},
    subjectBrainSearch:async()=>[{subjectId:projected.subjectId,proofObjectId:`transfer-instrument:${instrument.artifactDigest}`,objectDigest:digest("7")}],
    subjectBrainResolve:async()=>({primaryObjects:[{subjectId:projected.subjectId,proofObjectId:`transfer-instrument:${instrument.artifactDigest}`,objectDigest:digest("7"),exactBytesB64u:instrument.exactBytesB64u}]}),
    claimBearerTransferInstrument:async(_i:any,capability:any)=>{if(receipt){if(capability.receizId!==receipt.nextOwnerReceizId)return {ok:false,code:"REPLAY",writes:0};return {ok:true,receipt,idempotent:true};}
      const priorHead=head;claims++;owner=capability.receizId;head=digest("9");receipt={schema:"receiz.bearer.transfer_receipt.v1",receiptId:"receipt:one",transferId:instrument.plan.transferId,instrumentDigest:instrument.artifactDigest,subjectId:projected.subjectId,priorOwnerReceizId:sender.ownerReceizId,nextOwnerReceizId:owner,priorSubjectHead:priorHead,nextSubjectHead:head};return {ok:true,receipt,idempotent:false};}};
  return {packageProof,materialLot,rail,metrics:()=>({owner,claims,issues,previews})};
}
async function sourceFixture(){
  const f=await fixture(),offer=await issueWildsResourcePackageTransfer({authority:sender,package:f.packageProof,rail:f.rail as never,currentKai:100});
  const source={...initialWildsWorldProjection(),materialLots:{[f.materialLot.lotId]:f.materialLot}};
  const world={...source,...applyWildsResourcePackageCommand(source,{type:"resource.package.create",package:f.packageProof,commandId:f.packageProof.commandId},sender.profileHandle,100)};
  const record:WildsResourcePackageRecord={...world.resourcePackages![f.packageProof.packageId]!,status:"offered",subjectId:offer.subjectId,transferPlan:offer.instrument.plan,
    offer:{transferId:offer.instrument.plan.transferId,artifactDigest:offer.instrument.artifactDigest,targetHandle:offer.targetHandle}};
  return {...f,offer,world:{...world,resourcePackages:{[f.packageProof.packageId]:record}},record};
}
test("open proof carrier gives one authenticated holder exact aggregate custody, reimport credits no second transfer",async()=>{
  const f=await fixture(),offer=await issueWildsResourcePackageTransfer({authority:sender,package:f.packageProof,rail:f.rail as never,currentKai:100});
  assert.equal(offer.targetHandle,null);const claim=createWildsResourcePackagePortableClaim(offer);
  assert.deepEqual(decodeWildsPortableClaim(encodeWildsPortableClaim(claim)),claim);
  assert.equal(f.metrics().owner,sender.ownerReceizId);
  assert.equal((await claimWildsResourcePackageTransfer({authority:receiver,offer,rail:f.rail as never})).idempotent,false);
  assert.equal((await claimWildsResourcePackageTransfer({authority:receiver,offer,rail:f.rail as never})).idempotent,true);
  assert.equal(f.metrics().claims,1);
  await assert.rejects(claimWildsResourcePackageTransfer({authority:{...receiver,ownerReceizId:"receiz:other"},offer,rail:f.rail as never}),/replay/);
});
test("targeted package and unrelated native subject cannot credit custody",async()=>{
  const f=await fixture(),offer=await issueWildsResourcePackageTransfer({authority:sender,package:f.packageProof,targetHandle:"receiver",recipientReceizId:receiver.ownerReceizId,rail:f.rail as never,currentKai:100});
  assert.equal(offer.instrument.plan.policy.openBearer,false);
  assert.equal(offer.instrument.plan.policy.recipientReceizId,receiver.ownerReceizId);
  assert.throws(()=>validateWildsResourcePackageTransferOffer({...offer,targetHandle:null}),/offer_invalid/);
  await assert.rejects(claimWildsResourcePackageTransfer({authority:{...receiver,ownerReceizId:"receiz:intruder"},offer,rail:f.rail as never}),/recipient_invalid/);
  await assert.rejects(claimWildsResourcePackageTransfer({authority:{...receiver,profileHandle:"intruder.receiz.id"},offer,rail:f.rail as never}),/recipient_invalid/);
  const forged={...offer,subjectId:"unrelated",instrument:{...offer.instrument,plan:{...offer.instrument.plan,subjectId:"unrelated"}}};
  await assert.rejects(claimWildsResourcePackageTransfer({authority:receiver,offer:forged,rail:f.rail as never}),/subject_invalid/);
  assert.equal(f.metrics().claims,0);
});
test("named recipient binding is required before native subject admission or issuance",async()=>{
  const f=await fixture();
  await assert.rejects(issueWildsResourcePackageTransfer({authority:sender,package:f.packageProof,targetHandle:"receiver",rail:f.rail as never,currentKai:100}),/recipient_binding_unavailable/);
  assert.equal(f.metrics().claims,0);
});
test("lost issuance response recovers the original native bytes without previewing or issuing again",async()=>{
  const f=await fixture(),offer=await issueWildsResourcePackageTransfer({authority:sender,package:f.packageProof,rail:f.rail as never,currentKai:100});
  const recovered=await recoverWildsResourcePackageTransfer({authority:sender,package:f.packageProof,targetHandle:null,plan:offer.instrument.plan,rail:f.rail as never});
  assert.deepEqual(recovered,offer);assert.equal(f.metrics().issues,1);assert.equal(f.metrics().previews,1);
  await assert.rejects(recoverWildsResourcePackageTransfer({authority:sender,package:f.packageProof,targetHandle:null,plan:offer.instrument.plan,rail:{...f.rail,subjectBrainSearch:async()=>[]} as never}),/recovery_pending/);
  assert.equal(f.metrics().issues,1);
  await cancelWildsResourcePackageTransferPlan({authority:sender,plan:offer.instrument.plan,rail:f.rail as never});
});
test("a saved unissued plan resumes exactly once and unavailable cancellation does not release it",async()=>{
  const f=await fixture();let plan:any;
  await assert.rejects(issueWildsResourcePackageTransfer({authority:sender,package:f.packageProof,rail:f.rail as never,currentKai:100,beforeIssue:async(p)=>{plan=p;throw Error("source_response_lost");}}),/source_response_lost/);
  assert.equal(f.metrics().issues,0);
  await assert.rejects(cancelWildsResourcePackageTransferPlan({authority:sender,plan,rail:f.rail as never}),/cancellation_pending/);
  const recovered=await recoverWildsResourcePackageTransfer({authority:sender,package:f.packageProof,targetHandle:null,plan,rail:f.rail as never});
  assert.deepEqual(recovered.instrument.plan,plan);assert.equal(f.metrics().previews,1);assert.equal(f.metrics().issues,1);
});

test("offered cancellation rejects market custody and every exact source mismatch before any native call",async()=>{
  const f=await sourceFixture();let writes=0;
  const records:WildsResourcePackageRecord[]=[...(["listed","reserved","settling"] as const).map(status=>({...f.record,status})),
    {...f.record,ownerReceizId:receiver.profileHandle},{...f.record,subjectId:"wrong-subject"},
    {...f.record,offer:{...f.record.offer!,transferId: "wrong-transfer"}},{...f.record,offer:{...f.record.offer!,artifactDigest:"wrong-digest"}},
    {...f.record,offer:{...f.record.offer!,targetHandle:receiver.profileHandle}}];
  for(const record of records)await assert.rejects(executeOfferedResourcePackageCancellation({ownerHandle:sender.profileHandle,offer:f.offer,
    readVerifiedSource:async()=>({...f.world,resourcePackages:{[f.packageProof.packageId]:record}}),
    reserveCancellation:async()=>{writes++;},cancelNative:async()=>{writes++;},commitCancellation:async()=>{writes++;}}),/cancellation_unavailable/);
  assert.equal(writes,0);
});

test("cancellation commits its source fence before native calls and a source CAS conflict makes zero native calls",async()=>{
  const f=await sourceFixture();const calls:string[]=[];
  await assert.rejects(executeOfferedResourcePackageCancellation({ownerHandle:sender.profileHandle,offer:f.offer,readVerifiedSource:async()=>f.world,
    reserveCancellation:async()=>{calls.push("source-conflict");throw Error("source_conflict");},cancelNative:async()=>{calls.push("native");},commitCancellation:async()=>{calls.push("complete");}}),/source_conflict/);
  assert.deepEqual(calls,["source-conflict"]);calls.length=0;
  const result=await executeOfferedResourcePackageCancellation({ownerHandle:sender.profileHandle,offer:f.offer,readVerifiedSource:async()=>f.world,
    reserveCancellation:async()=>{calls.push("source-fence");},cancelNative:async()=>{calls.push("native");},commitCancellation:async()=>{calls.push("complete");return "done";}});
  assert.equal(result,"done");assert.deepEqual(calls,["source-fence","native","complete"]);
});

test("cancelling source survives a stale checkpoint, retries, fences sale and admits a winning exact native claim",async()=>{
  const f=await sourceFixture(),command={type:"resource.package.cancel.begin" as const,packageId:f.packageProof.packageId,transferId:f.offer.instrument.plan.transferId,commandId:"cancel:fence"};
  const cancelling={...f.world,...applyWildsResourcePackageCommand(f.world,command,sender.profileHandle,101)};
  assert.equal(cancelling.resourcePackages![command.packageId]!.status,"cancelling");
  assert.equal(preserveWildsResourcePackageHistory(cancelling,f.world).resourcePackages![command.packageId]!.status,"cancelling");
  assert.deepEqual(applyWildsResourcePackageCommand(cancelling,command,sender.profileHandle,102),{});
  assert.throws(()=>applyWildsResourcePackageCommand(cancelling,{type:"resource.package.market.list",packageId:command.packageId,listingId:"sale",commandId:"list"},sender.profileHandle,102),/unavailable/);
  const cancelled={...cancelling,...applyWildsResourcePackageCommand(cancelling,{type:"resource.package.cancel-transfer",packageId:command.packageId,transferId:command.transferId,commandId:"cancel:complete"},sender.profileHandle,102)};
  assert.equal(cancelled.resourcePackages![command.packageId]!.status,"packed");
  assert.equal(cancelled.reservedMaterialLots[f.materialLot.lotId],command.packageId);
  const admission=await claimWildsResourcePackageTransfer({authority:receiver,offer:f.offer,rail:f.rail as never});
  const claimed={...cancelling,...applyWildsResourcePackageCommand(cancelling,{type:"resource.package.transfer.admit",packageId:command.packageId,subjectId:admission.subjectId,
    subjectHead:admission.receipt.nextSubjectHead,receiptId:admission.receipt.receiptId,transferId:admission.receipt.transferId,commandId:"claim:win"},receiver.profileHandle,103)};
  assert.equal(claimed.resourcePackages![command.packageId]!.ownerReceizId,receiver.profileHandle);
  assert.equal(claimed.reservedMaterialLots[f.materialLot.lotId],command.packageId);
  assert.throws(()=>applyWildsResourcePackageCommand(claimed,{type:"resource.package.cancel-transfer",packageId:command.packageId,transferId:command.transferId,commandId:"cancel:finish"},sender.profileHandle,104),/owner_invalid/);
  let nativeCalls=0;
  await executeOfferedResourcePackageCancellation({ownerHandle:sender.profileHandle,offer:f.offer,readVerifiedSource:async()=>cancelling,
    reserveCancellation:async()=>{},cancelNative:async()=>{nativeCalls++;},commitCancellation:async()=>{}});
  assert.equal(nativeCalls,1);
});

async function payingFixture(){
  const f=await sourceFixture(),createdAt="2026-10-07T12:00:00.000Z";
  const listing:ResourcePackageMarketListing={schema:"wildz.resource-package-listing.v1",id:"listing:one",package:f.packageProof,packageId:f.packageProof.packageId,packageHead:f.packageProof.head,subjectId:f.offer.subjectId,
    sellerActorId:sender.actorId,sellerHandle:sender.profileHandle,sellerReceizUserId:sender.ownerReceizId,priceCents:100,currency:"USD",status:"active",sealedOffer:"v1.cipher",idempotencyKey:"sell:one",createdAt};
  const trade:ResourcePackageMarketTrade={schema:"wildz.resource-package-trade.v1",id:"trade:a",listingId:listing.id,packageId:listing.packageId,buyerActorId:receiver.actorId,buyerHandle:receiver.profileHandle,buyerReceizUserId:receiver.ownerReceizId,status:"reserved",idempotencyKey:"buy:a",createdAt,expiresAt:"2026-10-07T12:05:00.000Z"};
  let state=advanceResourcePackageMarketState(emptyResourcePackageMarketState(),{type:"listed",listing},createdAt);
  state=advanceResourcePackageMarketState(state,{type:"reserved",trade},createdAt);
  state=advanceResourcePackageMarketState(state,{type:"payment-started",tradeId:trade.id,actorId:trade.buyerActorId},"2026-10-07T12:04:59.000Z");
  const record:WildsResourcePackageRecord={...f.record,status:"reserved",listingId:listing.id,tradeId:"trade:b",buyerReceizId:"other.receiz.id",reservationExpiresKaiUPulse:200};
  return {...f,state,listing,trade,record,world:{...f.world,resourcePackages:{[listing.packageId]:record}},binding:{record,packageId:listing.packageId,listingId:listing.id,subjectId:listing.subjectId,tradeId:trade.id,buyerReceizId:receiver.ownerReceizId,buyerHandle:receiver.profileHandle}};
}

test("verified irrevocable paying A reconciles same-listing orphan source reservation B without releasing members",async()=>{
  const f=await payingFixture();assertWildsResourcePackagePayingTrade(f.state,f.binding);
  const command={type:"resource.package.market.pay" as const,packageId:f.listing.packageId,listingId:f.listing.id,tradeId:f.trade.id,commandId:"pay:a"};
  const settled={...f.world,...applyWildsResourcePackageCommand(f.world,command,receiver.profileHandle,201)};
  assert.equal(settled.resourcePackages![f.listing.packageId]!.status,"settling");
  assert.equal(settled.resourcePackages![f.listing.packageId]!.tradeId,f.trade.id);
  assert.equal(settled.resourcePackages![f.listing.packageId]!.buyerReceizId,receiver.profileHandle);
  assert.deepEqual(settled.reservedMaterialLots,f.world.reservedMaterialLots);
  assert.deepEqual(applyWildsResourcePackageCommand(settled,command,receiver.profileHandle,202),{});
});

test("orphan reconciliation rejects uncommitted trade, wrong buyer and every listing/package/native subject binding",async()=>{
  const f=await payingFixture();
  for(const binding of [{...f.binding,tradeId:"trade:b"},{...f.binding,buyerReceizId:"receiz:other"},{...f.binding,buyerHandle:"other.receiz.id"},
    {...f.binding,subjectId:"wrong-subject"},{...f.binding,packageId:"wrong-package"},{...f.binding,listingId:"wrong-listing"},
    {...f.binding,record:{...f.record,package:{...f.packageProof,head: "sha256:wrong"}}},{...f.binding,record:{...f.record,status:"settling" as const}}]){
    assert.throws(()=>assertWildsResourcePackagePayingTrade(f.state,binding),/payment_required/);
  }
  const uncommitted={...f.state,trades:{[f.trade.id]:{...f.trade,status:"reserved" as const}}};
  assert.throws(()=>assertWildsResourcePackagePayingTrade(uncommitted,f.binding),/payment_required/);
  const sellerMismatch={...f.state,listings:{[f.listing.id]:{...f.state.listings[f.listing.id]!,sellerReceizUserId:"receiz:other"}}};
  assert.throws(()=>assertWildsResourcePackagePayingTrade(sellerMismatch,f.binding),/payment_required/);
  assert.equal(f.world.resourcePackages![f.listing.packageId]!.tradeId,"trade:b");
  assert.equal(f.world.reservedMaterialLots[f.materialLot.lotId],f.listing.packageId);
  assert.throws(()=>assertWildsResourcePackageCancelledListing(f.state,{...f.binding,sellerHandle:sender.profileHandle,sellerReceizId:sender.ownerReceizId}),/cancellation_unavailable/);
});

test("source unreserve requires exact verified released trade and cannot clear a replacement reservation or payment",async()=>{
  const f=await payingFixture(),record={...f.record,tradeId:f.trade.id,buyerReceizId:receiver.profileHandle},binding={...f.binding,record};
  assert.throws(()=>assertWildsResourcePackageReleasedTrade(f.state,binding),/release_unconfirmed/);
  const reserved={...f.state,trades:{[f.trade.id]:f.trade}};
  assert.throws(()=>assertWildsResourcePackageReleasedTrade(reserved,binding),/release_unconfirmed/);
  const released=advanceResourcePackageMarketState(reserved,{type:"released",tradeId:f.trade.id,actorId:f.trade.buyerActorId},"2026-10-07T12:00:01.000Z");
  assertWildsResourcePackageReleasedTrade(released,binding);
  for(const bad of [{...binding,buyerReceizId:"receiz:wrong"},{...binding,buyerHandle:"wrong.receiz.id"},{...binding,subjectId:"wrong"},
    {...binding,tradeId:"wrong"},{...binding,packageId:"wrong"},{...binding,listingId:"wrong"}])assert.throws(()=>assertWildsResourcePackageReleasedTrade(released,bad),/release_unconfirmed|payment_required/);
  const command={type:"resource.package.market.unreserve" as const,packageId:f.listing.packageId,listingId:f.listing.id,tradeId:f.trade.id,commandId:"release:a"};
  const world={...f.world,resourcePackages:{[f.listing.packageId]:record}};
  const cleared={...world,...applyWildsResourcePackageCommand(world,command,receiver.profileHandle,201)};
  assert.equal(cleared.resourcePackages![f.listing.packageId]!.status,"listed");
  assert.deepEqual(cleared.reservedMaterialLots,world.reservedMaterialLots);
  assertWildsResourcePackageReleasedTrade(released,{...binding,record:cleared.resourcePackages![f.listing.packageId]!});
  assert.deepEqual(applyWildsResourcePackageCommand(cleared,command,receiver.profileHandle,202),{});
  for(const status of ["reserved","settling"] as const){
    const replacement={...f.record,status,tradeId:"trade:c",buyerReceizId:"next.receiz.id"};
    assertWildsResourcePackageReleasedTrade(released,{...binding,record:replacement});
    assert.deepEqual(applyWildsResourcePackageCommand({...world,resourcePackages:{[f.listing.packageId]:replacement}},command,receiver.profileHandle,203),{});
  }
});
