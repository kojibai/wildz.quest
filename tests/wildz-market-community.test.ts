import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {appendWildsDirectMessage} from '../src/features/play/wilds-messenger-ledger';
import {admitWildzMarketOfferMessage,projectWildzMarketOffers,wildzMarketOfferMessageId,type WildzMarketOffer,type WildzMarketOfferMessage} from '../src/features/market/wildz-market-offers';
import {withWildzMarketCommunity} from '../src/features/market/wildz-market-community-service';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import type {WildzMarketServiceV128,WildzMarketSnapshotV128} from '../src/features/market/wildz-market-service-v128';
import type {WildsConversation} from '../src/features/play/wilds-messenger-core';

const buyer={id:'market-offers-buyer',handle:'offerbuyer.receiz.id'},seller={id:'market-offers-owner',handle:'offerowner.receiz.id'};
beforeEach(()=>{Reflect.deleteProperty(globalThis,Symbol.for('receiz.wilds.messenger-ledger.v1'));});
const card:WildzMarketOwnedCard={assetId:`wilds:${'a'.repeat(24)}`,title:'Companion',proofDigest:`sha256:${'b'.repeat(64)}`,ownerHandle:seller.handle,claimKaiUPulse:'100000001',claimHead:'claim:head'};
const offer=(id:string):WildzMarketOffer=>({schema:'wildz.market-offer.v1',offerId:`market:offer:${id}`,assetId:card.assetId,title:card.title,proofDigest:card.proofDigest,buyerHandle:buyer.handle,ownerHandle:seller.handle,claimKaiUPulse:card.claimKaiUPulse,claimHead:card.claimHead,priceUsdCents:'1234'});
const notice=(message:WildzMarketOfferMessage,at='2026-10-11T12:00:00.000Z')=>appendWildsDirectMessage({sender:message.kind==='market-offer-response'&&message.outcome!=='withdrawn'?seller:buyer,recipient:message.kind==='market-offer-response'&&message.outcome!=='withdrawn'?buyer:seller,body:'Market offer',context:message,clientMessageId:wildzMarketOfferMessageId(message),now:at});

test('offers admit only the named buyer/owner, exact cent amounts and immutable response coordinates',()=>{
 const message={kind:'market-offer' as const,offer:offer('admission-001')};
 assert.equal(admitWildzMarketOfferMessage(message,buyer.handle,seller.handle).offer.priceUsdCents,'1234');
 assert.throws(()=>admitWildzMarketOfferMessage(message,seller.handle,buyer.handle));
 assert.throws(()=>admitWildzMarketOfferMessage({...message,offer:{...message.offer,priceUsdCents:'12.34'}},buyer.handle,seller.handle));
 assert.throws(()=>admitWildzMarketOfferMessage({kind:'market-offer-response',offer:message.offer,outcome:'accepted'},seller.handle,buyer.handle));
 assert.throws(()=>admitWildzMarketOfferMessage({...message,extra:'permission'},buyer.handle,seller.handle));
});

test('Messages admits the exact offer once, rejects changed terms and conflicting terminal replies',()=>{
 const message={kind:'market-offer' as const,offer:offer('idempotent-001')};
 const first=notice(message),retry=notice(message);
 assert.equal(first.message.id,retry.message.id);
 assert.throws(()=>notice({...message,offer:{...message.offer,priceUsdCents:'2000'}}),/wildz_market_offer_attempt_conflict/);
 const reply={kind:'market-offer-response' as const,offer:message.offer,outcome:'accepted' as const,listingId:`market:listing:${'c'.repeat(64)}`};
 const accepted=notice(reply,'2026-10-11T11:59:00.000Z');
 // A clock skew/arrival race must not hide a valid reply preceding its proposal's wall time.
 assert.equal(projectWildzMarketOffers([accepted.conversation],buyer.handle,[card]).find(v=>v.offer.offerId===message.offer.offerId)?.status,'accepted');
 assert.throws(()=>notice({kind:'market-offer-response',offer:message.offer,outcome:'declined'}),/already_resolved/);
});

test('offers stop targeting a prior ownership claim and exclude forged cached participants',()=>{
 const message={kind:'market-offer' as const,offer:offer('stale-claim-001')},record=notice(message).conversation;
 assert.equal(projectWildzMarketOffers([record],buyer.handle,[{...card,claimKaiUPulse:'100000002',claimHead:'new-head'}]).find(v=>v.offer.offerId===message.offer.offerId)?.status,'stale');
 const forged={...record,messages:record.messages.map(m=>m.clientMessageId===wildzMarketOfferMessageId(message)?{...m,senderId:'forged'}:m)};
 assert.equal(projectWildzMarketOffers([forged],buyer.handle,[card]).some(v=>v.offer.offerId===message.offer.offerId),false);
});

test('an absent public collection row does not expire or close an admitted offer',()=>{
 const message={kind:'market-offer' as const,offer:offer('catalogue-gap-001')},record=notice(message).conversation;
 assert.equal(projectWildzMarketOffers([record],seller.handle,[])[0]?.status,'pending');
 assert.equal(projectWildzMarketOffers([record],seller.handle,[{...card,ownerHandle:buyer.handle}])[0]?.status,'stale');
});

test('a partial inbox refresh retains the owner’s original offer and acceptance action',async()=>{
 const proposal={kind:'market-offer' as const,offer:offer('partial-inbox-001')},r=runtime(seller.handle);
 r.setConversations([notice(proposal).conversation]);await r.service.read();
 assert.equal(r.service.snapshot().offers?.[0]?.status,'pending');
 // A cold function or private sync deadline can return a bounded empty window.
 // It is not a deletion of the previously admitted Messages source.
 r.setConversations([]);await r.service.read();
 assert.equal(r.service.snapshot().offers?.[0]?.offer.offerId,proposal.offer.offerId);
 assert.equal((await r.service.respondToOffer!(proposal.offer.offerId,'accepted')).status,'listed');
 assert.equal(r.counts().listCalls,1);
});

function runtime(owner=buyer.handle,liveInbox=false){
 let snap:WildzMarketSnapshotV128={status:'ready',message:'',listings:[],sellables:[],purchases:[]},conversations:readonly WildsConversation[]=[],currentCard=card,stored:readonly WildzMarketOffer[]=[],publicationCalls=0,listCalls=0,failReply=false,activationPending=false,activationUnobserved=false;
 const activations:string[]=[],listingAttempts:string[]=[];let inboxListener:((value:readonly WildsConversation[])=>void)|null=null;
 const binding={ownerHandle:owner,keyId:'f'.repeat(64)},failed=async()=>({status:'failed' as const,message:'No purchase operation in this test.'});
 const base:WildzMarketServiceV128={binding,snapshot:()=>snap,subscribe:()=>()=>{},read:async()=>snap,cancel:failed,list:async input=>{listCalls++;listingAttempts.push(input.attemptId);const listingId=`market:listing:${'d'.repeat(64)}`;snap={...snap,listings:[{listingId,asset:input.asset,title:card.title,kind:'creature',sellerHandle:seller.handle,priceUsdCents:input.priceUsdCents,status:'active',canBuy:false,canCancel:true,canActivate:true}]};return {status:'listed',listingId,message:'Public listing confirmed. Purchase connection pending.'};},activateListing:async listingId=>{activations.push(listingId);if(activationPending)return {status:'pending',listingId,message:'Purchase connection pending: artifact_seal_failed'};if(!activationUnobserved)snap={...snap,listings:snap.listings.map(v=>v.listingId===listingId?{...v,canActivate:false}:v)};return {status:'listed',listingId,message:'Purchases enabled.'};},previewPurchase:async()=>{throw Error('No preview authorized.');},approvePurchase:failed,resume:failed,accept:failed,receive:failed};
 const service=withWildzMarketCommunity(base,{currentIdentity:()=>binding,readCollection:async()=>({cards:[currentCard],transfers:[]}),readConversations:async()=>conversations,...(liveInbox?{subscribeConversations(listener:(value:readonly WildsConversation[])=>void){inboxListener=listener;listener(conversations);return()=>{inboxListener=null;};}}:{}),offerAttempts:{load:()=>stored,write:v=>{stored=structuredClone(v);}},publish:async context=>{publicationCalls++;conversations=[notice(context).conversation];if(failReply){failReply=false;throw Error('Lost acknowledgement.');}}});
 return {service,setCards:(value:WildzMarketOwnedCard)=>{currentCard=value;},setConversations:(value:readonly WildsConversation[])=>{conversations=value;},pushInbox:(value:readonly WildsConversation[])=>{conversations=value;inboxListener?.(value);},setListings:(listings:WildzMarketSnapshotV128['listings'])=>{snap={...snap,listings};},connectionPending:(value=true)=>{activationPending=value;},connectionUnobserved:()=>{activationUnobserved=true;},activations:()=>activations,listingAttempts:()=>listingAttempts,fail:()=>{failReply=true;},counts:()=>({publicationCalls,listCalls}),stored:()=>stored};
}

test('an already warmed Market receives incoming offers from the existing Messages stream',async()=>{
 const r=runtime(seller.handle,true);await r.service.read();let observed:WildzMarketSnapshotV128|undefined;
 const unsubscribe=r.service.subscribe(snapshot=>{observed=snapshot;});
 const proposal={kind:'market-offer' as const,offer:offer('live-inbox-001')};r.pushInbox([notice(proposal).conversation]);
 assert.equal(observed?.offers?.[0]?.offer.offerId,proposal.offer.offerId);
 assert.equal(observed?.offers?.[0]?.status,'pending');
 r.pushInbox([]);assert.equal(r.service.snapshot().offers?.[0]?.status,'pending');
 unsubscribe();observed=undefined;r.pushInbox([]);assert.equal(observed,undefined);
 assert.deepEqual(r.counts(),{publicationCalls:0,listCalls:0});
});

test('canceling an original accepted listing cannot erase a later offer for the same creature',async()=>{
 const original={kind:'market-offer' as const,offer:offer('cancel-original-001')},next={kind:'market-offer' as const,offer:offer('after-cancel-001')},r=runtime(seller.handle);
 notice(original);const originalId=`market:listing:${'e'.repeat(64)}`;
 const oldInbox=notice({kind:'market-offer-response',offer:original.offer,outcome:'accepted',listingId:originalId}).conversation;
 r.setListings([{listingId:originalId,asset:{kind:'creature',assetId:card.assetId},kind:'creature',title:card.title,sellerHandle:seller.handle,priceUsdCents:original.offer.priceUsdCents,status:'cancelled',canBuy:false,canCancel:false,canActivate:false}]);
 r.setConversations([notice(next,'2026-10-12T09:00:00.000Z').conversation]);await r.service.read();
 r.setConversations([oldInbox]);await r.service.read();
 assert.equal(r.service.snapshot().offers?.find(item=>item.offer.offerId===next.offer.offerId)?.status,'pending');
 const result=await r.service.respondToOffer!(next.offer.offerId,'accepted');
 assert.equal(result.status,'listed');assert.notEqual(result.listingId,originalId);
 assert.deepEqual(r.listingAttempts(),[`${next.offer.offerId}:accept`]);assert.equal(r.service.snapshot().purchases.length,0);
});

test('a failed local value read keeps a valid owned card and reports a retryable display state',async()=>{
 const base=runtime().service;
 const service=withWildzMarketCommunity(base,{currentIdentity:()=>base.binding,readCollection:async()=>({cards:[card],transfers:[]}),readConversations:async()=>[],publish:async()=>{throw Error('No write authorized.');},value:{read:async()=>{throw Error('worker failed');}}});
 await service.read();
 const result=await service.readValue!(card.assetId);
 assert.equal(result.status,'unavailable');
 assert.equal(service.snapshot().collection?.[0]?.assetId,card.assetId);
 assert.match(service.snapshot().collection?.[0]?.valueUnavailable??'',/Open the chart to retry/);
 assert.equal(service.snapshot().purchases.length,0);
});

test('a lost offer reply retains exact terms across retry and never starts a payment or listing',async()=>{
 const r=runtime(),request={assetId:card.assetId,priceUsdCents:'1234',attemptId:'market:offer:lost-reply-001'};
 r.fail();assert.equal((await r.service.makeOffer!(request)).status,'pending');assert.equal(r.stored().length,1);
 assert.equal((await r.service.makeOffer!(request)).status,'completed');assert.equal(r.stored().length,0);
 assert.deepEqual(r.counts(),{publicationCalls:1,listCalls:0});
});

test('accepting an offer prepares the exact listing but never approves or pays the buyer’s purchase',async()=>{
 const proposal={kind:'market-offer' as const,offer:offer('accept-exact-001')},record=notice(proposal).conversation,r=runtime(seller.handle);
 r.setConversations([record]);await r.service.read();
 const result=await r.service.respondToOffer!(proposal.offer.offerId,'accepted');
 assert.equal(result.status,'listed');assert.deepEqual(r.counts(),{publicationCalls:1,listCalls:1});
 assert.equal(r.service.snapshot().listings[0]!.priceUsdCents,proposal.offer.priceUsdCents);
 assert.equal(r.service.snapshot().listings[0]!.canActivate,false);
 assert.deepEqual(r.activations(),[result.listingId]);
 assert.equal(r.service.snapshot().purchases.length,0);
 const again=await r.service.respondToOffer!(proposal.offer.offerId,'accepted');assert.equal(again.status,'completed');assert.equal(r.counts().listCalls,1);
});

test('acceptance stays pending until the same exact native listing is available, then retry sends one accepted reply',async()=>{
 const proposal={kind:'market-offer' as const,offer:offer('pending-activation-001')},r=runtime(seller.handle);r.setConversations([notice(proposal).conversation]);r.connectionPending();
 const first=await r.service.respondToOffer!(proposal.offer.offerId,'accepted');
 assert.equal(first.status,'pending');assert.match(first.message,/artifact_seal_failed/);assert.equal(r.service.snapshot().offers?.find(v=>v.offer.offerId===proposal.offer.offerId)?.status,'pending');assert.equal(r.counts().publicationCalls,0);
 r.connectionPending(false);const retry=await r.service.respondToOffer!(proposal.offer.offerId,'accepted');
 assert.equal(retry.status,'listed');assert.equal(retry.listingId,first.listingId);assert.deepEqual(r.counts(),{publicationCalls:1,listCalls:1});assert.deepEqual(r.listingAttempts(),[`${proposal.offer.offerId}:accept`]);assert.deepEqual(r.activations(),[first.listingId,first.listingId]);assert.equal(r.service.snapshot().purchases.length,0);
});

test('an activation acknowledgement without independently projected readiness cannot resolve an offer',async()=>{
 const proposal={kind:'market-offer' as const,offer:offer('unobserved-activation-001')},r=runtime(seller.handle);r.setConversations([notice(proposal).conversation]);r.connectionUnobserved();
 assert.equal((await r.service.respondToOffer!(proposal.offer.offerId,'accepted')).status,'pending');assert.equal(r.counts().publicationCalls,0);assert.equal(r.service.snapshot().offers?.find(v=>v.offer.offerId===proposal.offer.offerId)?.status,'pending');
});

test('acceptance cannot infer native readiness from an omitted connection flag',async()=>{
 const proposal={kind:'market-offer' as const,offer:offer('unknown-readiness-001')},r=runtime(seller.handle);r.setConversations([notice(proposal).conversation]);
 r.setListings([{listingId:`market:listing:${'c'.repeat(64)}`,asset:{kind:'creature',assetId:card.assetId},kind:'creature',title:card.title,sellerHandle:seller.handle,priceUsdCents:proposal.offer.priceUsdCents,status:'active',canBuy:false,canCancel:true}]);
 assert.equal((await r.service.respondToOffer!(proposal.offer.offerId,'accepted')).status,'pending');assert.equal(r.counts().publicationCalls,0);
});

function acceptedRuntime(owner=seller.handle,status:WildzMarketSnapshotV128['listings'][number]['status']='active'){
 const proposed={kind:'market-offer' as const,offer:offer('legacy-pending-001')},listingId=`market:listing:${'e'.repeat(64)}`,r=runtime(owner);
 notice(proposed);r.setConversations([notice({kind:'market-offer-response',offer:proposed.offer,outcome:'accepted',listingId}).conversation]);
 r.setListings([{listingId,asset:{kind:'creature',assetId:card.assetId},kind:'creature',title:card.title,sellerHandle:seller.handle,priceUsdCents:proposed.offer.priceUsdCents,status,canBuy:false,canCancel:status==='active',canActivate:status==='active'}]);
 return {r,proposed,listingId};
}

test('seller retry recovers the original accepted public listing without another listing or message',async()=>{
 const {r,proposed,listingId}=acceptedRuntime();r.connectionPending();
 assert.equal((await r.service.respondToOffer!(proposed.offer.offerId,'accepted')).status,'pending');r.connectionPending(false);
 assert.equal((await r.service.respondToOffer!(proposed.offer.offerId,'accepted')).status,'completed');assert.deepEqual(r.activations(),[listingId,listingId]);assert.deepEqual(r.counts(),{publicationCalls:0,listCalls:0});assert.equal(r.service.snapshot().listings[0]?.canActivate,false);
});

test('buyer retry of an accepted offer never activates the seller source',async()=>{
 const {r,proposed}=acceptedRuntime(buyer.handle);assert.equal((await r.service.respondToOffer!(proposed.offer.offerId,'accepted')).status,'completed');assert.deepEqual(r.activations(),[]);assert.deepEqual(r.counts(),{publicationCalls:0,listCalls:0});
});

test('checking a missing accepted original leaves it pending and never creates or activates a replacement',async()=>{
 const {r,proposed}=acceptedRuntime();r.setListings([]);assert.equal((await r.service.respondToOffer!(proposed.offer.offerId,'accepted')).status,'pending');assert.deepEqual(r.activations(),[]);assert.deepEqual(r.counts(),{publicationCalls:0,listCalls:0});assert.equal(r.service.snapshot().listings.length,0);
});

test('accepted originals that are reserved, sold or cancelled are never activated or replaced',async()=>{
 for(const status of ['reserved','sold','cancelled'] as const){const {r,proposed}=acceptedRuntime(seller.handle,status);await r.service.respondToOffer!(proposed.offer.offerId,'accepted');assert.deepEqual(r.activations(),[]);assert.deepEqual(r.counts(),{publicationCalls:0,listCalls:0});assert.equal(r.service.snapshot().listings[0]?.status,status);}
});

test('legacy accepted recovery checks the original current ownership claim before a native write',async()=>{
 const {r,proposed}=acceptedRuntime();r.setCards({...card,claimHead:'changed-claim'});await r.service.respondToOffer!(proposed.offer.offerId,'accepted');assert.deepEqual(r.activations(),[]);assert.deepEqual(r.counts(),{publicationCalls:0,listCalls:0});assert.equal(r.service.snapshot().listings[0]?.canActivate,true);
});

test('acceptance is unavailable after an exact claim changes and performs no listing write',async()=>{
 const proposal={kind:'market-offer' as const,offer:offer('changed-owner-001')},r=runtime(seller.handle);r.setConversations([notice(proposal).conversation]);r.setCards({...card,claimKaiUPulse:'100000003',claimHead:'later-claim'});
 const result=await r.service.respondToOffer!(proposal.offer.offerId,'accepted');assert.equal(result.status,'pending');assert.equal(r.counts().listCalls,0);
});
