import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletStagedTradeController } from "../src/features/play/wallet/wilds-wallet-staged-trade-controller";
import { createWildsWalletStagedTradePlan } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
import { admitWildsWalletStagedTradeRecovery } from "../src/features/play/wallet/wilds-wallet-staged-trade-recovery";
import { createWildsWalletConnectPhiPort } from "../src/features/play/wallet/wilds-wallet-connect-phi-port";
import { initialWildzMarketSourceV128, reduceWildzMarketSourceV128 } from "../src/lib/receiz/wildz-market-source-journal-v128";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import { deriveWildzMarketConnectQuoteV128 } from "../src/lib/receiz/wildz-market-quote-v128";
import {createMemoryWildzContinuityDatabase} from "./support/memory-wildz-continuity-database";
import {createWildzMarketArchiveStoreV128} from "../src/features/market/wildz-market-archive-v128";
const path="../src/features/market/wildz-market-controller-v128.js";
test("market construction and cached subscriptions do not enroll sources or touch the wallet",async()=>{
 const marketModule=await import(path).catch(()=>({}));assert.equal(typeof marketModule.createWildzMarketControllerV128,"function");
 let calls=0;const unavailable=async()=>{calls++;throw Error("explicit action required");};
 const service=marketModule.createWildzMarketControllerV128({keyId:"a".repeat(64),ownerHandle:"alice.receiz.id",currentIdentity:()=>({keyId:"a".repeat(64),ownerHandle:"alice.receiz.id"}),openSource:unavailable,qualifySelection:unavailable,readSelections:()=>[],staged:{sendWalletAsset:unavailable,assetPort:{prepareSource:unavailable,sendSource:unavailable,observeSource:unavailable,verifyAccepted:unavailable},readConversations:unavailable,publish:unavailable}});
 assert.equal(service.snapshot().listings.length,0);const stop=service.subscribe(()=>{});stop();assert.equal(calls,0);
});

const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value)).slice(7);
const clone=<T>(value:T):T=>structuredClone(value);
function memory(){let value:unknown=null;return {load:()=>clone(value),write:(_key:string,next:unknown)=>{value=clone(next);},withLock:async<T>(_key:string,action:()=>Promise<T>)=>action()};}
async function fixture(){
 const marketModule=await import(path);
 const asset={kind:"creature" as const,assetId:"card:one"};
 const selection={asset,semanticIds:[`creature:profile:bob:${"b".repeat(64)}`],sourceDigest:"d".repeat(64),summary:"Bob's creature",resourceUnits:0,creatureCount:1};
 let reserveLost=false,reserveUnobserved=false;let sourceState=reduceWildzMarketSourceV128(initialWildzMarketSourceV128(),{schema:"wildz.market-source-command.v128",kind:"list",attemptId:"listing:one",actorHandle:"bob.receiz.id",listingId:"market:listing:one",selection,priceUsdCents:125},"bob.receiz.id");
 const messages:Record<string,unknown>[]=[];const nativeReceipts=new Set<string>();let delivered=false,accepted=false,projectionPending=false,executeCount=0,quoteRate=250000000n,lost=false,observationsAvailable=true,insufficient=false,currentKai=100,qualifierUnavailable=false;
 const events:string[]=[];const actors=new Map<string,{market:ReturnType<typeof memory>;staged:ReturnType<typeof memory>;phi:ReturnType<typeof memory>;database:ReturnType<typeof createMemoryWildzContinuityDatabase>;tradeArchive:Map<string,any>}>();
 const historicalListings=new Map<string,any>();
 const sourceSnapshot=()=>({state:clone(sourceState),head:digest(sourceState),proof:null});
 const result=(listingId:string)=>({snapshot:sourceSnapshot(),listing:clone(sourceState.listings[listingId]??historicalListings.get(listingId)),receiptLocator:{schema:"wildz.market-source-locator.v128",domainId:"world:wildz:market:v128",head:digest(sourceState),sourceArtifactSha256:"f".repeat(64),appendId:"market:append:fixture"}});
 const make=async(owner:string)=>{
  const handle=`${owner}.receiz.id`,keyId=(owner==="alice"?"a":"b").repeat(64),stores=actors.get(owner)??{market:memory(),staged:memory(),phi:memory(),database:createMemoryWildzContinuityDatabase(),tradeArchive:new Map<string,any>()};actors.set(owner,stores);
  const binding={ownerHandle:handle,keyId,identityArtifactDigest:(owner==="alice"?"c":"d").repeat(64)};
  const tradeArchive={read:async(_binding:any,id:string)=>clone(stores.tradeArchive.get(id)??null),retain:async(_binding:any,entry:any)=>{stores.tradeArchive.set(entry.plan.tradeId,clone(entry));}};
  let actualOwner=handle;
  const fetcher=async(url:string|URL|Request,init?:RequestInit)=>{
   const u=String(url),body=init?.body?JSON.parse(String(init.body)):{};
   if(u==="/api/market/purchases/quote")return Response.json({quote:deriveWildzMarketConnectQuoteV128({ok:true,wallet:{userId:owner,balancePhiMicro:"0",balanceUsd:"0.00",quote:{usdPerPhiMicrocents:quoteRate.toString()}}},{ownerUserId:owner,ownerHandle:handle,priceUsdCents:body.priceUsdCents,currentKai:100})});
   if(u.endsWith("/preview"))return Response.json({status:"staged",rail:"settlement",amountPhiMicro:body.amountPhiMicro,attempt:`v3.${digest(body)}`,expiresAtKai:200});
   if(u.endsWith("/execute")){executeCount++;events.push("debit");assert.equal(Object.values(sourceState.listings)[0]!.reservation?.phase,"payment-pending","global source lock precedes financial dispatch");if(insufficient)return Response.json({status:"zero-write",rail:"settlement",code:"INSUFFICIENT_VALUE",noWriteWitness:`nw1.${digest(body.attempt)}`});nativeReceipts.add(body.attempt);if(lost)throw Error("reply lost");return Response.json({status:"committed",rail:"settlement",amountPhiMicro:"500000",recipientUsername:"bob"});}
   if(u.endsWith("/no-write")){if(!insufficient||!body.noWriteWitness.startsWith("nw1."))return Response.json({error:"witness_invalid"},{status:400});return Response.json({status:"zero-write",rail:"settlement",code:"INSUFFICIENT_VALUE",terminal:currentKai>=200,retryAfterKai:200});}
   if(u.includes("/observe?")){const attempt=new URL(u,"https://wildz.test").searchParams.get("attempt");return Response.json(observationsAvailable&&nativeReceipts.has(attempt??"")?{status:"committed",rail:"settlement",amountPhiMicro:"500000",recipientUsername:"bob"}:{status:"pending"});}
   throw Error(`Unexpected native fixture path ${u}`);
  };
  const verifyApproval=async(approval:Record<string,unknown>)=>{if(approval.evidence!==`fixture-native-consent:${approval.approvalId}`)throw Error("native signature admission denied");return {...approval,approvalKai:"99"};};
  const descriptor=(leg:{legId:string})=>({legId:leg.legId,sourceArtifactSha256:"1".repeat(64),sourcePayloadSha256:"2".repeat(64),artifactId:"b".repeat(64),namespace:"profile:bob",headReference:"native:head:one",historyDigestSha256:"3".repeat(64),appendCount:0,ownerHandle:"bob.receiz.id",projectionArtifactSha256:"4".repeat(64),projectionPayloadSha256:"5".repeat(64),projectionCardDigest:"6".repeat(64)});
  const assetPort={prepareSource:async(leg:{legId:string})=>descriptor(leg),sendSource:async()=>{delivered=true;events.push("asset-offer");return {status:"sent",message:"private exact source delivered"};},observeSource:async()=>accepted?{status:"accepted",receipt:{nativeSuccessor:"fixture-accepted-exact-source"},...(projectionPending?{projectionPending:true}:{})}:delivered?{status:"offered"}:{status:"none"},verifyAccepted:async(_leg:unknown,_descriptor:unknown,outcome:{receipt?:unknown})=>{if(!accepted||!sameReceipt(outcome.receipt))throw Error("actual native acceptance denied");},acceptSource:async()=>{accepted=true;events.push("asset-accept");return {status:"accepted",receipt:{nativeSuccessor:"fixture-accepted-exact-source"},...(projectionPending?{projectionPending:true}:{})};}};
  function sameReceipt(value:unknown){return canonicalPortableCardJson(value)===canonicalPortableCardJson({nativeSuccessor:"fixture-accepted-exact-source"});}
  // The choreography uses the real durable staged controller. Only the native
  // signature/root-source boundary is substituted; JSON progress cannot pass
  // its independent receipt verification.
  const createAdapter=(input:Record<string,any>)=>{
   const controller=createWildsWalletStagedTradeController({recoveryStore:stores.staged,archiveStore:tradeArchive});
   const entry=(plan:any)=>admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.tradeId===plan.tradeId)!;
   const ports:any={currentBinding:()=>binding,readApprovalSources:async(plan:any)=>{await input.marketExecution.assert(plan,"approve");return plan.legs.filter((leg:any)=>leg.kind==="asset"&&leg.senderHandle===handle).map(descriptor);},signApproval:async({plan,challenge,sourceHeads}:any)=>({schema:"wildz.wallet.staged-trade-approval.v1",tradeId:plan.tradeId,approvalId:challenge.approvalId,...binding,sourceHeads:JSON.parse(challenge.exactChallenge).sourceHeads??sourceHeads,evidence:`fixture-native-consent:${challenge.approvalId}`}),verifyApproval:async(approval:any)=>verifyApproval(approval),
    sendPhi:async(leg:any)=>{const plan=admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.legs.some(candidate=>candidate.legId===leg.legId))!.plan;await input.marketExecution.assert(plan,"send-phi");return input.phi.sendPhi(leg);},
    sendAsset:async(leg:any)=>{const plan=admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.legs.some(candidate=>candidate.legId===leg.legId))!.plan;await input.marketExecution.assert(plan,"send-asset");return assetPort.sendSource();},
    acceptAsset:async(leg:any)=>{const plan=admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.legs.some(candidate=>candidate.legId===leg.legId))!.plan;await input.marketExecution.assert(plan,"accept-asset");return assetPort.acceptSource();},
    observeLeg:async(leg:any)=>{if(leg.kind==="asset")return assetPort.observeSource();const saved=admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.legs.some(candidate=>candidate.legId===leg.legId));let locator=saved?.legs.find(item=>item.legId===leg.legId)?.receipt;for(const message of messages)if(message.context&&typeof message.context==="object"&&(message.context as any).legId===leg.legId&&(message.context as any).outcome?.receipt)locator=(message.context as any).outcome.receipt;return input.phi.observePhi(leg,locator);},
    verifyLegFailure:async(leg:any,outcome:any)=>input.phi.verifyPhiRejection(leg,outcome.receipt),verifyLegReceipt:async(leg:any,outcome:any)=>leg.kind==="phi"?input.phi.verifyPhiReceipt(leg,outcome):assetPort.verifyAccepted(leg,descriptor(leg),outcome),
    publish:async(context:any)=>{messages.push({id:digest(context),senderHandle:handle,recipientHandle:owner==="alice"?"bob.receiz.id":"alice.receiz.id",context});}};
   const ingest=async(plan:any)=>{for(const message of messages){const context=message.context as any;if(message.recipientHandle===handle&&context.kind==="trade-staged-approval"&&context.plan.tradeId===plan.tradeId)await controller.receiveApproval(plan,context.approval,ports);}};
   return {approve:async(agreement:any)=>{const plan=createWildsWalletStagedTradePlan(agreement);await input.marketExecution.assert(plan,"approve");await ingest(plan);const approved=await controller.approve(agreement,ports);return approved.status==="awaiting-peer"?controller.advance(plan.tradeId,ports):approved;},resume:async(agreement:any)=>{const plan=createWildsWalletStagedTradePlan(agreement);await ingest(plan);return controller.advance(plan.tradeId,ports);},acceptIncomingAsset:async(legId:string)=>{const plan=admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.legs.some(leg=>leg.legId===legId))!.plan;return controller.acceptIncomingAsset(plan.tradeId,legId,ports);},receive:async(context:any)=>{const plan=context.plan??admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.tradeId===context.tradeId)!.plan;if(context.kind==="trade-staged-approval")await controller.receiveApproval(plan,context.approval,ports);return controller.advance(plan.tradeId,ports);},incomingAssets:async()=>[]};
  };
  const service=marketModule.createWildzMarketControllerV128({keyId,ownerHandle:handle,currentIdentity:()=>({keyId,ownerHandle:actualOwner}),store:stores.market,archiveStore:createWildzMarketArchiveStoreV128(stores.database),currentKai:()=>currentKai,qualifySelection:async()=>{if(qualifierUnavailable)throw Error("The listed source legitimately changed.");return clone(selection);},readSelections:()=>[{id:"card:one",label:"Creature",quantity:1,asset}],fetcher,
   openSource:async({verifyTransition}:any)=>({load:async()=>sourceSnapshot(),observe:async({listingId}:any)=>result(listingId),verifyReservation:async(request:any)=>{const actual=result(request.listingId),r=actual.listing.reservation;if(!r||r.reservationId!==request.reservationId||r.buyerHandle!==request.buyerHandle||r.sellerHandle!==request.sellerHandle||r.listingHead!==request.listingHead)throw Error("native reservation admission denied");return actual;},list:async(request:any)=>{const event={schema:"wildz.market-source-command.v128",kind:"list",actorHandle:handle,...request};sourceState=reduceWildzMarketSourceV128(sourceState,event as any,handle);return result(request.listingId);},reserve:async(request:any)=>{if(reserveUnobserved){reserveUnobserved=false;throw Error("original source reservation is unobserved");}const event={schema:"wildz.market-source-command.v128",kind:"reserve",actorHandle:handle,...request};sourceState=reduceWildzMarketSourceV128(sourceState,event as any,handle);if(reserveLost){reserveLost=false;throw Error("native reserve committed reply lost");}return result(request.listingId);},cancel:async(request:any)=>{sourceState=reduceWildzMarketSourceV128(sourceState,{schema:"wildz.market-source-command.v128",kind:"cancel",actorHandle:handle,...request},handle);return result(request.listingId);},transition:async(event:any)=>{if(["approved","progress","terminal-consent"].includes(event.kind))await verifyTransition(event,sourceState.listings[event.listingId]);sourceState=reduceWildzMarketSourceV128(sourceState,event,handle);events.push(event.kind==="progress"?event.phase:event.kind);return result(event.listingId);}}),
   staged:{recoveryStore:stores.staged,archiveStore:tradeArchive,sendWalletAsset:async()=>({status:"failed",message:"baseline send is not the market rail"}),assetPort:assetPort as any,readConversations:async()=>[{messages:clone(messages)}] as any,publish:async()=>{},ensureReady:async()=>true}},
   {verifyApproval:verifyApproval as any,createAdapter:createAdapter as any,createPhi:(parameters:Parameters<typeof createWildsWalletConnectPhiPort>[0])=>createWildsWalletConnectPhiPort({...parameters,store:stores.phi,authorization:{authorize:async()=>({artifact:{},challenge:{}})},fetcher})});
  return {service,stores,changeOwner:()=>{actualOwner="mallory.receiz.id";},entry:(id:string)=>entryFor(id)};
  function entryFor(id:string){return admitWildsWalletStagedTradeRecovery(stores.staged.load(),binding).trades.find(item=>item.plan.agreement.market?.purchaseId===id);}
 };
 return {make,sourceState:()=>sourceState,events,messages,executeCount:()=>executeCount,rate:(value:bigint)=>{quoteRate=value;},loseResponse:()=>{lost=true;observationsAvailable=false;},restoreObservation:()=>{observationsAvailable=true;},projection:(value:boolean)=>{projectionPending=value;},insufficient:()=>{insufficient=true;},commitInflight:()=>{insufficient=false;const message=messages.find(message=>(message.context as any)?.kind==="trade-staged-progress"&&(message.context as any)?.outcome?.receipt?.schema==="wildz.wallet.connect-zero-write-receipt.v1");assert.ok(message);nativeReceipts.add((message.context as any).outcome.receipt.attempt);},kai:(value:number)=>{currentKai=value;},sourceUnavailable:()=>{qualifierUnavailable=true;},addListing:(id:string)=>{sourceState=reduceWildzMarketSourceV128(sourceState,{schema:"wildz.market-source-command.v128",kind:"list",attemptId:`${id}:list`,actorHandle:"bob.receiz.id",listingId:id,selection,priceUsdCents:125},"bob.receiz.id");},cancelledHistory:()=>{
  const rows:any[]=[];
  for(let index=0;index<128;index++){
   const listingId=`market:listing:${digest(index)}`,attemptId=`history:listing:${index}`;
   sourceState=reduceWildzMarketSourceV128(sourceState,{schema:"wildz.market-source-command.v128",kind:"list",attemptId,actorHandle:"bob.receiz.id",listingId,selection,priceUsdCents:125},"bob.receiz.id");
   sourceState=reduceWildzMarketSourceV128(sourceState,{schema:"wildz.market-source-command.v128",kind:"cancel",attemptId:`${attemptId}:cancel`,actorHandle:"bob.receiz.id",listingId,expectedListingHead:sourceState.listings[listingId]!.listingHead},"bob.receiz.id");historicalListings.set(listingId,clone(sourceState.listings[listingId]));
   if(index<64)rows.push({attemptId,listingId,asset,priceUsdCents:"125",selection,published:true});
  }return rows;
 },loseReservation:()=>{reserveLost=true;},deferReservation:()=>{reserveUnobserved=true;}};
}
async function reviewedPair(f:Awaited<ReturnType<typeof fixture>>){
 const buyer=await f.make("alice"),seller=await f.make("bob");const review=await buyer.service.previewPurchase("market:listing:one");
 assert.equal((await buyer.service.approvePurchase(review.purchaseId)).status,"awaiting-peer");await seller.service.read();assert.equal(seller.service.snapshot().purchases.length,1);
 assert.equal((await seller.service.approvePurchase(review.purchaseId)).status,"awaiting-peer");return {buyer,seller,review};
}
test("market payment precedes source delivery; both exact named approvals and independent native accept are required",async()=>{
 const f=await fixture(),{buyer,seller,review}=await reviewedPair(f);
 const peer=f.messages.find(message=>message.senderHandle==="bob.receiz.id"&&(message.context as any).kind==="trade-staged-approval")!;
 await buyer.service.receive(peer.context,"bob.receiz.id");assert.equal(f.executeCount(),1);assert.equal(f.sourceState().listings["market:listing:one"]!.reservation?.phase,"paid");
 assert.equal((await seller.service.resume(review.purchaseId)).status,"awaiting-acceptance");assert.equal(f.executeCount(),1);
 assert.equal((await buyer.service.accept(review.purchaseId)).status,"pending");assert.equal(f.sourceState().listings["market:listing:one"]!.status,"reserved","one closing consent cannot release the source lock");
 assert.equal((await seller.service.resume(review.purchaseId)).status,"completed");assert.equal(f.sourceState().listings["market:listing:one"]!.status,"sold");assert.equal(f.executeCount(),1);
 assert.ok(f.events.indexOf("payment-pending")<f.events.indexOf("debit"));assert.ok(f.events.indexOf("debit")<f.events.indexOf("asset-offer"));assert.ok(f.events.indexOf("asset-offer")<f.events.indexOf("asset-accept"));
});
test("quote changes after both approvals fail before debit and never silently change the signed amount",async()=>{
 const f=await fixture(),{buyer,review}=await reviewedPair(f);f.rate(500000000n);
 const peer=f.messages.find(message=>message.senderHandle==="bob.receiz.id"&&(message.context as any).kind==="trade-staged-approval")!;
 assert.equal((await buyer.service.receive(peer.context,"bob.receiz.id")).status,"review-required");assert.equal(f.executeCount(),0);
 assert.equal(buyer.service.snapshot().purchases[0]!.amountPhiMicro,"500000");assert.equal(buyer.service.snapshot().purchases[0]!.phase,"review-required");
 assert.equal((await buyer.service.resume(review.purchaseId)).status,"review-required");assert.equal(f.executeCount(),0);
});
test("lost payment response across reconstruction observes the same attempt and frozen quote without a second debit",async()=>{
 const f=await fixture(),{buyer,review}=await reviewedPair(f);f.loseResponse();const peer=f.messages.find(message=>message.senderHandle==="bob.receiz.id"&&(message.context as any).kind==="trade-staged-approval")!;
 assert.equal((await buyer.service.receive(peer.context,"bob.receiz.id")).status,"pending");assert.equal(f.executeCount(),1);f.rate(500000000n);f.restoreObservation();
 const reconstructed=await f.make("alice");const outcome=await reconstructed.service.resume(review.purchaseId);assert.notEqual(outcome.status,"failed");assert.notEqual(outcome.status,"review-required");assert.equal(f.executeCount(),1);assert.equal(reconstructed.service.snapshot().purchases[0]!.amountPhiMicro,"500000");
});
test("unapproved peer JSON and changed current account cannot authorize market payment",async()=>{
 const f=await fixture(),buyer=await f.make("alice"),review=await buyer.service.previewPurchase("market:listing:one");
 const plan=createWildsWalletStagedTradePlan(review.agreement);assert.equal((await buyer.service.receive({kind:"trade-staged-progress",tradeId:plan.tradeId,legId:plan.legs[0]!.legId,outcome:{status:"committed",receipt:{pretend:true}}},"bob.receiz.id")).status,"awaiting-peer");assert.equal(f.executeCount(),0);
 buyer.changeOwner();await assert.rejects(buyer.service.previewPurchase("market:listing:one"),/Explorer changed/);assert.equal(f.executeCount(),0);
});
test("accepted native delivery preserves a failed local adoption and repairs the same receipt without another payment",async()=>{
 const f=await fixture(),{buyer,seller,review}=await reviewedPair(f);const peer=f.messages.find(message=>message.senderHandle==="bob.receiz.id"&&(message.context as any).kind==="trade-staged-approval")!;
 await buyer.service.receive(peer.context,"bob.receiz.id");await seller.service.resume(review.purchaseId);f.projection(true);
 const accepted=await buyer.service.accept(review.purchaseId);assert.equal(accepted.status,"pending");assert.equal(accepted.assetRecoveryRequired,true);assert.equal(buyer.service.snapshot().purchases[0]!.canAccept,true);assert.equal(buyer.service.snapshot().purchases[0]!.phase,"received");assert.equal(f.executeCount(),1);
 await seller.service.resume(review.purchaseId);f.projection(false);const recovered=await f.make("alice");const repaired=await recovered.service.accept(review.purchaseId);assert.equal(repaired.status,"completed");assert.equal(repaired.assetRecoveryRequired,undefined);assert.equal(recovered.service.snapshot().purchases[0]!.phase,"completed");assert.equal(f.executeCount(),1);assert.equal(f.events.filter(item=>item==="asset-accept").length,1);
});
test("cold recovery exposes the exact uncertain listing request and a quota failure prevents source dispatch",async()=>{
 const f=await fixture(),seller=await f.make("bob");
 const request={asset:{kind:"creature" as const,assetId:"card:one"},priceUsdCents:"125",attemptId:"new-listing:same-try"};
 assert.equal((await seller.service.list(request)).status,"pending");const reconstructed=await f.make("bob");await reconstructed.service.read();const saved=reconstructed.service.snapshot().pendingListings![0]!;
 assert.deepEqual({asset:saved.asset,priceUsdCents:saved.priceUsdCents,attemptId:saved.attemptId},request);assert.ok(reconstructed.service.snapshot().sellables[0]!.disabledReason);assert.equal(f.executeCount(),0);
 const before=f.sourceState();reconstructed.stores.market.write=()=>{throw Error("quota exceeded");};assert.equal((await reconstructed.service.list({...request,attemptId:"new-listing:quota"})).status,"failed");assert.deepEqual(f.sourceState(),before);
});
test("a source advertisement can be withdrawn after source drift and a named pre-payment buyer can release its reservation",async()=>{
 const f=await fixture(),buyer=await f.make("alice"),seller=await f.make("bob"),review=await buyer.service.previewPurchase("market:listing:one");
 assert.equal((await buyer.service.cancel(review.listingId)).status,"cancelled");assert.equal(f.sourceState().listings[review.listingId]!.status,"active");assert.equal(buyer.service.snapshot().purchases[0]!.canApprove,false);assert.equal(f.executeCount(),0);
 f.sourceUnavailable();
 // Cancellation uses the root source seller/head only; it does not need a
 // now-unavailable current asset and grants no custody to either Explorer.
 assert.equal((await seller.service.cancel(review.listingId)).status,"cancelled");assert.equal(f.sourceState().listings[review.listingId]!.status,"cancelled");assert.equal(f.executeCount(),0);
});

test("known insufficient payment stays locked through cold reload until both named actors consent after the original authorization expires",async()=>{
 const f=await fixture(),{buyer,seller,review}=await reviewedPair(f);f.insufficient();
 const peer=f.messages.find(message=>message.senderHandle==="bob.receiz.id"&&(message.context as any).kind==="trade-staged-approval")!;
 assert.equal((await buyer.service.receive(peer.context,"bob.receiz.id")).status,"failed");assert.equal(f.executeCount(),1);assert.equal(f.sourceState().listings[review.listingId]!.reservation?.phase,"payment-pending");
 const cold=await f.make("alice");assert.equal((await cold.service.cancel(review.listingId)).status,"failed");assert.equal(f.sourceState().listings[review.listingId]!.status,"reserved");
 assert.equal((await cold.service.resume(review.purchaseId)).status,"failed");assert.equal(f.executeCount(),1);f.kai(201);
 assert.equal((await cold.service.cancel(review.listingId)).status,"pending");assert.equal(f.sourceState().listings[review.listingId]!.status,"reserved","unilateral witness cannot release source custody");
 assert.equal((await seller.service.cancel(review.listingId)).status,"cancelled");assert.equal(f.sourceState().listings[review.listingId]!.status,"cancelled");assert.equal(f.executeCount(),1);
});
test("a full protected market queue and storage quota fail before a native reservation is submitted",async()=>{
 const f=await fixture(),buyer=await f.make("alice"),review=await buyer.service.previewPurchase("market:listing:one");await buyer.service.cancel(review.listingId);
 const base=buyer.stores.market.load() as any; // Each retained review must remain a valid closed plan. Derive its actual
 // purchase ID/full packages from the canonical terms rather than editing IDs.
 const {createWildzMarketPurchaseAgreementV128}=await import("../src/features/market/wildz-market-purchase-terms-v128.js");
 base.purchases=Array.from({length:32},(_,index:number)=>({message:"Protected pre-payment original",agreement:createWildzMarketPurchaseAgreementV128({...review.agreement.market!,reservationId:`old:reservation:${index}`})}));base.pendingReservations=[];buyer.stores.market.write("",base);
 const before=clone(f.sourceState());await assert.rejects(buyer.service.previewPurchase(review.listingId),/queue is full/);assert.deepEqual(f.sourceState(),before);assert.equal(f.executeCount(),0);
 const fresh=await fixture(),other=await fresh.make("alice");const snapshot=clone(fresh.sourceState());other.stores.market.write=()=>{throw Error("quota");};await assert.rejects(other.service.previewPurchase("market:listing:one"),/quota/);assert.deepEqual(fresh.sourceState(),snapshot);assert.equal(fresh.executeCount(),0);
});
test("market source law price bounds reject before any checkpoint or source qualification",async()=>{
 const f=await fixture(),seller=await f.make("bob"),before=clone(f.sourceState());
 assert.equal((await seller.service.list({asset:{kind:"creature",assetId:"card:one"},priceUsdCents:"1000000001",attemptId:"invalid-price"})).status,"failed");assert.equal(seller.stores.market.load(),null);assert.deepEqual(f.sourceState(),before);
});

test("lost native reservation reply reconstructs its durably frozen quote and exact reservation instead of issuing another",async()=>{
 const f=await fixture(),buyer=await f.make("alice");f.loseReservation();await assert.rejects(buyer.service.previewPurchase("market:listing:one"),/reply lost/);
 const saved=buyer.stores.market.load() as any;assert.equal(saved.pendingReservations.length,1);assert.equal(saved.purchases.length,0);const reservation=f.sourceState().listings["market:listing:one"]!.reservation!;
 f.rate(500000000n);const cold=await f.make("alice"),review=await cold.service.previewPurchase("market:listing:one");assert.equal(review.reservationId,reservation.reservationId);assert.equal(review.amountPhiMicro,"500000");assert.equal((cold.stores.market.load() as any).pendingReservations.length,0);assert.equal(f.executeCount(),0);
});

test("market capacity re-admits completed full native history from the shared staged archive before active eviction",async()=>{
 const f=await fixture(),{buyer,seller,review}=await reviewedPair(f),peer=f.messages.find(message=>message.senderHandle==="bob.receiz.id"&&(message.context as any).kind==="trade-staged-approval")!;
 await buyer.service.receive(peer.context,"bob.receiz.id");await seller.service.resume(review.purchaseId);await buyer.service.accept(review.purchaseId);await seller.service.resume(review.purchaseId);await buyer.service.resume(review.purchaseId);
 const market=buyer.stores.market.load() as any,staged=buyer.stores.staged.load() as any,completed=staged.trades[0];buyer.stores.tradeArchive.set(completed.plan.tradeId,clone(completed));buyer.stores.staged.write("",{...staged,trades:[]});
 const {createWildzMarketPurchaseAgreementV128}=await import("../src/features/market/wildz-market-purchase-terms-v128.js");
 market.purchases.push(...Array.from({length:31},(_,index)=>({message:"Protected unresolved exact review",agreement:createWildzMarketPurchaseAgreementV128({...review.agreement.market!,reservationId:`protected:reservation:${index}`})})));buyer.stores.market.write("",market);
 f.addListing("market:listing:next");const next=await buyer.service.previewPurchase("market:listing:next");assert.notEqual(next.purchaseId,review.purchaseId);assert.equal((buyer.stores.market.load() as any).purchases.length,32);assert.equal((buyer.stores.market.load() as any).purchases.some((item:any)=>item.agreement.market.purchaseId===review.purchaseId),false);
 const archive=createWildzMarketArchiveStoreV128(buyer.stores.database),retained=await archive.readPurchase({ownerHandle:"alice.receiz.id",keyId:"a".repeat(64)},review.purchaseId);assert.deepEqual(retained?.entry,completed);
 const before=f.executeCount();assert.equal((await buyer.service.resume(review.purchaseId)).status,"completed");assert.equal(f.executeCount(),before,"historical check cannot issue another financial send");
});
test("listing capacity checks exact terminal history after native recent projection pruning",async()=>{
 const f=await fixture(),seller=await f.make("bob");await seller.service.cancel("market:listing:one");const rows=f.cancelledHistory();seller.stores.market.write("",{schema:"wildz.market-recovery.v128",ownerHandle:"bob.receiz.id",keyId:"b".repeat(64),lists:rows,purchases:[],pendingReservations:[]});
 assert.equal(f.sourceState().listings[rows[0].listingId],undefined,"native recent display projection no longer contains the terminal listing");
 assert.equal((await seller.service.list({asset:{kind:"creature",assetId:"card:one"},priceUsdCents:"125",attemptId:"after-historical-capacity"})).status,"listed");assert.equal((seller.stores.market.load() as any).lists.length,64);assert.equal(seller.stores.database.dump().meta.length,1,"exact historical terminal bytes were retained before eviction");assert.equal(f.executeCount(),0);
});

test("cold market read recovers only the original frozen reservation and retires a peer-proved pre-payment withdrawal",async()=>{
 const f=await fixture(),buyer=await f.make("alice"),seller=await f.make("bob");f.loseReservation();await assert.rejects(buyer.service.previewPurchase("market:listing:one"),/reply lost/);assert.equal((buyer.stores.market.load() as any).pendingReservations.length,1);
 assert.equal((await seller.service.cancel("market:listing:one")).status,"cancelled");const cold=await f.make("alice");await cold.service.read();assert.equal((cold.stores.market.load() as any).pendingReservations.length,0);assert.equal(cold.service.snapshot().purchases.length,0);assert.equal(f.executeCount(),0);
 const active=await fixture(),other=await active.make("alice");active.loseReservation();await assert.rejects(other.service.previewPurchase("market:listing:one"));const reloaded=await active.make("alice");await reloaded.service.read();assert.equal(reloaded.service.snapshot().purchases[0]!.amountPhiMicro,"500000");assert.equal(reloaded.service.snapshot().purchases[0]!.canApprove,true);assert.equal((reloaded.stores.market.load() as any).pendingReservations.length,0);assert.equal(active.executeCount(),0);
});

test("an unchanged original active source is not evidence that an unobserved reservation was released",async()=>{
 const f=await fixture(),buyer=await f.make("alice");f.deferReservation();await assert.rejects(buyer.service.previewPurchase("market:listing:one"),/unobserved/);const saved=clone(buyer.stores.market.load());
 const cold=await f.make("alice");await cold.service.read();assert.deepEqual(cold.stores.market.load(),saved);assert.equal(cold.service.snapshot().purchases.length,0);f.rate(500000000n);
 const review=await cold.service.previewPurchase("market:listing:one");assert.equal(review.amountPhiMicro,"500000","explicit retry retains the old exact frozen quote");assert.equal(f.executeCount(),0);
});

test("actual committed payment supersedes an earlier voluntary zero-write closing intent without releasing the source",async()=>{
 const f=await fixture(),{buyer,seller,review}=await reviewedPair(f);f.insufficient();const peer=f.messages.find(message=>message.senderHandle==="bob.receiz.id"&&(message.context as any).kind==="trade-staged-approval")!;
 await buyer.service.receive(peer.context,"bob.receiz.id");f.kai(201);assert.equal((await buyer.service.cancel(review.listingId)).status,"pending");assert.equal(f.sourceState().listings[review.listingId]!.reservation?.terminalConsent?.outcome,"zero-write");
 f.commitInflight();assert.equal((await seller.service.cancel(review.listingId)).status,"failed");await buyer.service.resume(review.purchaseId);
 const actual=f.sourceState().listings[review.listingId]!;assert.equal(actual.reservation?.phase,"paid");assert.equal(actual.reservation?.terminalConsent,undefined);assert.equal(actual.status,"reserved");assert.equal(f.executeCount(),1,"only the original request was dispatched by this app");
});
