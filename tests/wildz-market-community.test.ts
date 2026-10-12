import assert from 'node:assert/strict';
import {test} from 'node:test';
import {appendWildsDirectMessage} from '../src/features/play/wilds-messenger-ledger';
import {admitWildzMarketOfferMessage,projectWildzMarketOffers,wildzMarketOfferMessageId,type WildzMarketOffer,type WildzMarketOfferMessage} from '../src/features/market/wildz-market-offers';
import {withWildzMarketCommunity} from '../src/features/market/wildz-market-community-service';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import type {WildzMarketServiceV128,WildzMarketSnapshotV128} from '../src/features/market/wildz-market-service-v128';
import type {WildsConversation} from '../src/features/play/wilds-messenger-core';

const buyer={id:'market-offers-buyer',handle:'offerbuyer.receiz.id'},seller={id:'market-offers-owner',handle:'offerowner.receiz.id'};
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

function runtime(owner=buyer.handle){
 let snap:WildzMarketSnapshotV128={status:'ready',message:'',listings:[],sellables:[],purchases:[]},conversations:readonly WildsConversation[]=[],currentCard=card,stored:readonly WildzMarketOffer[]=[],publicationCalls=0,listCalls=0,failReply=false;
 const binding={ownerHandle:owner,keyId:'f'.repeat(64)},failed=async()=>({status:'failed' as const,message:'No purchase operation in this test.'});
 const base:WildzMarketServiceV128={binding,snapshot:()=>snap,subscribe:()=>()=>{},read:async()=>snap,cancel:failed,list:async input=>{listCalls++;const listingId=`market:listing:${'d'.repeat(64)}`;snap={...snap,listings:[{listingId,asset:input.asset,title:card.title,kind:'creature',sellerHandle:seller.handle,priceUsdCents:input.priceUsdCents,status:'active',canBuy:false,canCancel:true}]};return {status:'listed',listingId,message:'Listed'};},previewPurchase:async()=>{throw Error('No preview authorized.');},approvePurchase:failed,resume:failed,accept:failed,receive:failed};
 const service=withWildzMarketCommunity(base,{currentIdentity:()=>binding,readCollection:async()=>({cards:[currentCard],transfers:[]}),readConversations:async()=>conversations,offerAttempts:{load:()=>stored,write:v=>{stored=structuredClone(v);}},publish:async context=>{publicationCalls++;conversations=[notice(context).conversation];if(failReply){failReply=false;throw Error('Lost acknowledgement.');}}});
 return {service,setCards:(value:WildzMarketOwnedCard)=>{currentCard=value;},setConversations:(value:readonly WildsConversation[])=>{conversations=value;},fail:()=>{failReply=true;},counts:()=>({publicationCalls,listCalls}),stored:()=>stored};
}

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
 assert.equal(r.service.snapshot().purchases.length,0);
 const again=await r.service.respondToOffer!(proposal.offer.offerId,'accepted');assert.equal(again.status,'completed');assert.equal(r.counts().listCalls,1);
});

test('acceptance is unavailable after an exact claim changes and performs no listing write',async()=>{
 const proposal={kind:'market-offer' as const,offer:offer('changed-owner-001')},r=runtime(seller.handle);r.setConversations([notice(proposal).conversation]);r.setCards({...card,claimKaiUPulse:'100000003',claimHead:'later-claim'});
 const result=await r.service.respondToOffer!(proposal.offer.offerId,'accepted');assert.equal(result.status,'pending');assert.equal(r.counts().listCalls,0);
});
