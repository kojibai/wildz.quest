import type {WildzMarketServiceV128,WildzMarketSnapshotV128,WildzMarketResultV128} from './wildz-market-service-v128';
import type {WildzMarketOwnedCard,WildzMarketTransfer} from '../../lib/receiz/wildz-market-collection';
import {admitWildzMarketOfferMessage,projectWildzMarketOffers,sameWildzMarketOfferOwner,type WildzMarketOfferMessage} from './wildz-market-offers';
import {mergeWildsConversationHistory,type WildsConversation} from '../play/wilds-messenger-core';
import {canonicalPortableCardJson,verifyAnyWildsCard,type PortableCardAsset} from '../play/portable-card';
import {sameWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';
import type {WildzMarketValuePort,WildzMarketValueRead} from './wildz-market-value';
import {wildzMarketValueChange} from './wildz-market-value';
import {createWildzMarketOfferAttemptStore,type WildzMarketOfferAttemptStore} from './wildz-market-offer-attempts';
import type {WildzMarketOffer} from './wildz-market-offers';

class InvalidOffer extends Error {}

export function withWildzMarketCommunity(base:WildzMarketServiceV128,input:Readonly<{
 currentIdentity():WildzMarketServiceV128['binding'];
 readCollection():Promise<Readonly<{cards:readonly WildzMarketOwnedCard[];transfers:readonly WildzMarketTransfer[]}>>;
 readOwnCards?():readonly PortableCardAsset[];
 readConversations():Promise<readonly WildsConversation[]>;
 subscribeConversations?(listener:(conversations:readonly WildsConversation[])=>void):()=>void;
 publish(message:WildzMarketOfferMessage,peerHandle:string):Promise<void>;
 value?:WildzMarketValuePort;
 offerAttempts?:WildzMarketOfferAttemptStore;
}>):WildzMarketServiceV128{
 const listeners=new Set<(snapshot:WildzMarketSnapshotV128)=>void>();
 let cards:readonly WildzMarketOwnedCard[]=[],conversations:readonly WildsConversation[]=[],collectionMessage='',communityLoaded=false;
 let transfers:readonly WildzMarketTransfer[]=[];
 const attempts=input.offerAttempts??createWildzMarketOfferAttemptStore(base.binding);
 let pendingOffers:readonly WildzMarketOffer[]=[];
 let snapshot=base.snapshot(),busy=false,unsubscribe:(()=>void)|null=null,unsubscribeConversations:(()=>void)|null=null;
 const current=()=>{const binding=input.currentIdentity();if(binding.ownerHandle!==base.binding.ownerHandle||binding.keyId!==base.binding.keyId)throw Error('The Explorer changed. Reopen Market.');};
 const project=(next=base.snapshot())=>{snapshot={...next,collection:cards,transfers,pendingOffers,offers:projectWildzMarketOffers(conversations,base.binding.ownerHandle,cards),collectionMessage};return snapshot;};
 const emit=()=>{current();const next=project();for(const listener of listeners)listener(next);return next;};
 const refreshCommunity=async()=>{
  const results=await Promise.allSettled([input.readCollection(),input.readConversations()]);current();
  if(results[0].status==='fulfilled'){
   const prior=new Map(cards.map(card=>[`${card.assetId}:${card.proofDigest}:${card.ownerHandle}`,card.value]));
   const held=new Map((input.readOwnCards?.()??[]).map(asset=>[`${asset.id}:${asset.proof.digest}`,asset]));
   cards=results[0].value.cards.map(card=>{
    const value=prior.get(`${card.assetId}:${card.proofDigest}:${card.ownerHandle}`),asset=sameWildzPlayerCoordinate(card.ownerHandle,base.binding.ownerHandle)?held.get(`${card.assetId}:${card.proofDigest}`):undefined;
    return {...card,...(asset&&verifyAnyWildsCard(asset).ok?{asset}:{}),...(value?{value}:{})};
   });
   transfers=results[0].value.transfers;communityLoaded=true;collectionMessage='';
  }
  else collectionMessage=cards.length?'Showing saved collection. Refresh to check current owners.':'The owned creature collection could not refresh. Listings remain available.';
  if(results[1].status==='fulfilled')conversations=mergeWildsConversationHistory(conversations,results[1].value);
  return results[0].status==='fulfilled'&&results[1].status==='fulfilled';
 };
 const locked=async(action:()=>Promise<WildzMarketResultV128>)=>{
  if(busy)return {status:'pending' as const,message:'Check the same offer after the current action finishes.'};
  current();busy=true;try{return await action();}catch(cause){return {status:cause instanceof InvalidOffer?'failed' as const:'pending' as const,message:cause instanceof Error?cause.message:'Check the same offer again.'};}finally{busy=false;try{emit();}catch{/* Old identity cannot update the new Explorer. */}}
 };
 const publish=async(message:WildzMarketOfferMessage)=>{
  const peer=base.binding.ownerHandle===message.offer.ownerHandle?message.offer.buyerHandle:message.offer.ownerHandle;
  const admitted=admitWildzMarketOfferMessage(message,base.binding.ownerHandle,peer);await input.publish(admitted,peer);current();
  const next=await input.readConversations();current();conversations=mergeWildsConversationHistory(conversations,next);
 };
 const service:WildzMarketServiceV128={...base,
  snapshot:()=>project(),
  releaseValue:()=>input.value?.release?.(),
  ...(base.readHistory?{async readHistory(){await base.readHistory!();current();return emit();}}:{}),
 async readValue(id){current();let result:WildzMarketValueRead;try{result=input.value?await input.value.read(id):{status:'unavailable',message:'No local valuation is available for this card yet.'};}catch{result={status:'unavailable',message:'Value could not refresh. Open the chart to retry.'};}current();
  if(result.status==='ready'){const projection=result.value;cards=cards.map(card=>card.assetId===id&&card.proofDigest===projection.proofDigest?{...card,valueUnavailable:undefined,value:{proofValuePhiMicro:projection.proofValuePhiMicro,displayUsdCents:projection.displayUsdCents,valuationKaiUPulse:projection.valuationKaiUPulse,algorithm:projection.algorithm,changeBps:wildzMarketValueChange(projection.samples,projection.displayUsdCents===null?'phi':'usd')}}:card);}else{const message=result.message;cards=cards.map(card=>card.assetId===id?{...card,valueUnavailable:message}:card);}emit();return result;},
  subscribe(listener){current();listeners.add(listener);if(!unsubscribe)unsubscribe=base.subscribe(next=>{try{current();project(next);for(const listener of listeners)listener(snapshot);}catch{/* disposed identity */}});
   if(!unsubscribeConversations&&input.subscribeConversations)unsubscribeConversations=input.subscribeConversations(next=>{try{current();conversations=mergeWildsConversationHistory(conversations,next);emit();}catch{/* disposed identity */}});
   return()=>{listeners.delete(listener);if(!listeners.size){unsubscribe?.();unsubscribe=null;unsubscribeConversations?.();unsubscribeConversations=null;}};},
  async read(){const results=await Promise.allSettled([base.read(),refreshCommunity()]);current();
   try{pendingOffers=attempts.load();}catch{collectionMessage='Saved offer terms could not be read. Sending new offers requires working local storage.';}
   emit();if(results[0].status==='rejected'&&!communityLoaded)throw results[0].reason;
   if(results[0].status==='rejected')snapshot={...snapshot,message:results[0].reason instanceof Error?results[0].reason.message:'Purchase source could not refresh.'};return snapshot;},
  makeOffer:request=>locked(async()=>{
   if(!await refreshCommunity())throw Error('Refresh the current owner and Messages before sending this offer.');
   const card=cards.find(card=>card.assetId===request.assetId);if(!card)throw new InvalidOffer('This card is no longer in the public owned collection.');
   pendingOffers=attempts.load();const held=pendingOffers.find(v=>v.offerId===request.attemptId);
   if(held&&(held.assetId!==request.assetId||held.priceUsdCents!==request.priceUsdCents))throw new InvalidOffer('This saved offer has different terms.');
   const candidate={schema:'wildz.market-offer.v1' as const,offerId:request.attemptId,assetId:card.assetId,title:card.title,proofDigest:card.proofDigest,
    buyerHandle:base.binding.ownerHandle,ownerHandle:card.ownerHandle,claimKaiUPulse:card.claimKaiUPulse,claimHead:card.claimHead,priceUsdCents:request.priceUsdCents};
   let offer:WildzMarketOffer;try{offer=admitWildzMarketOfferMessage({kind:'market-offer',offer:held??candidate},base.binding.ownerHandle,(held??candidate).ownerHandle).offer;}catch{throw new InvalidOffer('Choose another player’s creature and a valid USD offer.');}
   const prior=project().offers?.find(item=>item.offer.offerId===offer.offerId);
   if(prior&&canonicalPortableCardJson(prior.offer)!==canonicalPortableCardJson(offer))throw new InvalidOffer('This saved offer has different terms. Start a new offer.');
   if(prior){pendingOffers=pendingOffers.filter(v=>v.offerId!==offer.offerId);attempts.write(pendingOffers);return {status:'completed',message:'This exact offer is already in Messages and Market.'};}
   if(!sameWildzMarketOfferOwner(card,offer)){pendingOffers=pendingOffers.filter(v=>v.offerId!==offer.offerId);attempts.write(pendingOffers);throw new InvalidOffer('The owner changed. Send a new offer to the current owner.');}
   if(!held){if(pendingOffers.length>=32)throw new InvalidOffer('Check your saved offers before sending another.');pendingOffers=[...pendingOffers,offer];attempts.write(pendingOffers);}
   await publish({kind:'market-offer',offer});
   if(!project().offers?.some(v=>v.offer.offerId===offer.offerId&&canonicalPortableCardJson(v.offer)===canonicalPortableCardJson(offer)))return {status:'pending',message:'Check this same offer to confirm that it reached Messages.'};
   pendingOffers=pendingOffers.filter(v=>v.offerId!==offer.offerId);attempts.write(pendingOffers);emit();return {status:'completed',message:'Offer sent. The owner can review it in Messages and Market.'};
  }),
  respondToOffer:(id,outcome)=>locked(async()=>{
   if(!await refreshCommunity())throw Error('Refresh the current owner and Messages before responding.');
   const item=project().offers?.find(item=>item.offer.offerId===id);if(!item)throw Error('The original offer is unavailable.');
   const offer=item.offer,owner=base.binding.ownerHandle;
   const acceptedRetry=item.status==='accepted'&&outcome==='accepted';
   // A buyer's duplicate reply grants no seller source authority. The named
   // seller may explicitly recover the original accepted purchase connection.
   if(item.status===outcome&&(!acceptedRetry||owner!==offer.ownerHandle))return {status:'completed',message:`This offer is already ${outcome}.`,...(item.listingId?{listingId:item.listingId}:{})};
   if(item.status!=='pending'&&!acceptedRetry)throw Error('This offer is no longer available.');
   if(outcome==='withdrawn'?owner!==offer.buyerHandle:owner!==offer.ownerHandle)throw Error('Only the named participant may respond to this offer.');
   if(outcome==='accepted'){
    const card=cards.find(card=>card.assetId===offer.assetId);if(!card)throw Error('The current card could not be checked. Retry this same offer to confirm its owner.');
    if(!sameWildzMarketOfferOwner(card,offer))throw Error('The owner changed. A new offer is required.');
    await base.read();current();
    const exactListing=(listingId:string)=>base.snapshot().listings.find(listing=>listing.listingId===listingId&&listing.asset.kind==='creature'&&listing.asset.assetId===offer.assetId&&listing.sellerHandle===owner&&listing.priceUsdCents===offer.priceUsdCents);
    const enablePurchases=async(listingId:string):Promise<WildzMarketResultV128|undefined>=>{
     const original=exactListing(listingId);
     if(!original||original.status!=='active')return {status:'pending',listingId,message:'Check the original listing. Its exact purchase connection is not available.'};
     if(original.canActivate){
      if(!base.activateListing)return {status:'pending',listingId,message:'Reopen this same offer to finish its purchase connection.'};
      const connected=await base.activateListing(listingId);current();
      if(connected.status!=='listed')return connected;
      if(connected.listingId!==listingId)return {status:'pending',listingId,message:'The original purchase connection could not be confirmed. Retry this same offer.'};
     }
     const ready=exactListing(listingId);
     if(!ready||ready.status!=='active'||ready.canActivate!==false)return {status:'pending',listingId,message:'Purchase connection pending. Retry this same offer to check the original native listing.'};
    };
    if(acceptedRetry){
     if(!item.listingId)throw Error('The original accepted listing is unavailable.');
     const original=exactListing(item.listingId);
     if(original&&original.status!=='active')return {status:'completed',listingId:item.listingId,message:'This offer is already accepted. Keep the original purchase and its current listing state.'};
     const pending=await enablePurchases(item.listingId);if(pending)return pending;
     return {status:'completed',listingId:item.listingId,message:'The original accepted offer is ready for purchase review. Payment and delivery still require the normal purchase approvals.'};
    }
    const active=base.snapshot().listings.find(listing=>listing.asset.kind==='creature'&&listing.asset.assetId===offer.assetId&&listing.sellerHandle===owner&&(listing.status==='active'||listing.status==='reserved'));
    if(active?.status==='reserved')throw Error('Resolve the existing purchase before accepting another offer.');
    let listingId=active?.priceUsdCents===offer.priceUsdCents?active.listingId:undefined;
    if(active&&!listingId){const cancelled=await base.cancel(active.listingId);current();if(cancelled.status!=='cancelled')return cancelled;}
    if(!listingId){const result=await base.list({asset:{kind:'creature',assetId:offer.assetId},priceUsdCents:offer.priceUsdCents,attemptId:`${offer.offerId}:accept`});current();
     if(result.status!=='listed'||!result.listingId)return result;listingId=result.listingId;}
    const pending=await enablePurchases(listingId);if(pending)return pending;
    await publish({kind:'market-offer-response',offer,outcome,listingId});return {status:'listed',listingId,message:'Offer accepted. The buyer can review this exact price; payment and delivery still require the normal purchase approvals.'};
   }
   await publish({kind:'market-offer-response',offer,outcome});return {status:'completed',message:outcome==='declined'?'Offer declined. The buyer has been notified.':'Offer withdrawn. The owner has been notified.'};
  })
 };
 return service;
}

export async function readWildzMarketCollection(fetcher:typeof fetch=fetch):Promise<Readonly<{cards:readonly WildzMarketOwnedCard[];transfers:readonly WildzMarketTransfer[]}>>{
 const response=await fetcher('/api/wilds/market/collection',{credentials:'omit',cache:'no-store'}),value=await response.json();
 if(!response.ok||value?.ok!==true||!Array.isArray(value.cards))throw Error('The owned creature collection is unavailable.');
 // Display transport only. Every offer refreshes, every sale re-admits source custody.
 return {cards:value.cards,transfers:Array.isArray(value.transfers)?value.transfers:[]};
}
