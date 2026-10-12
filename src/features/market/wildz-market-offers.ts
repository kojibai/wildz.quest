import {canonicalPortableCardJson,sha256PortableBasis} from '../play/portable-card';
import type {WildsConversation} from '../play/wilds-messenger-core';
import {parseWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';

export type WildzMarketOffer=Readonly<{
 schema:'wildz.market-offer.v1';offerId:string;assetId:string;title:string;proofDigest:string;
 buyerHandle:string;ownerHandle:string;claimKaiUPulse:string|null;claimHead:string|null;priceUsdCents:string;
}>;
export type WildzMarketOfferMessage=Readonly<{kind:'market-offer';offer:WildzMarketOffer}>|Readonly<{
 kind:'market-offer-response';offer:WildzMarketOffer;outcome:'accepted'|'declined'|'withdrawn';listingId?:string;
}>;
export type WildzMarketOfferView=Readonly<{offer:WildzMarketOffer;status:'pending'|'accepted'|'declined'|'withdrawn'|'stale';listingId?:string;createdAt:string}>;
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
const fail=():never=>{throw Error('wildz_market_offer_invalid');};

/** Authenticated private negotiation only. This object grants no payment,
 * asset custody, or pre-approved purchase. */
export function admitWildzMarketOfferMessage(value:unknown,sender:string,recipient:string):WildzMarketOfferMessage{
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 const message=value as WildzMarketOfferMessage,offer=message.offer;
 if(!offer||!same(Object.keys(offer).sort(),['schema','offerId','assetId','title','proofDigest','buyerHandle','ownerHandle','claimKaiUPulse','claimHead','priceUsdCents'].sort())
  ||offer.schema!=='wildz.market-offer.v1'||!/^market:offer:[a-zA-Z0-9-]{8,80}$/.test(offer.offerId)||!/^wilds:[a-f0-9]{24}$/.test(offer.assetId)
  ||typeof offer.title!=='string'||!offer.title.trim()||offer.title.length>80||/[\u0000-\u001f\u007f]/.test(offer.title)
  ||typeof offer.proofDigest!=='string'||!offer.proofDigest||offer.proofDigest.length>160
  ||parseWildzPlayerCoordinate(offer.buyerHandle)?.profileHandle!==offer.buyerHandle||parseWildzPlayerCoordinate(offer.ownerHandle)?.profileHandle!==offer.ownerHandle
  ||offer.buyerHandle===offer.ownerHandle||typeof offer.priceUsdCents!=='string'||!/^[1-9][0-9]{0,9}$/.test(offer.priceUsdCents)||BigInt(offer.priceUsdCents)>1_000_000_000n
  ||offer.claimKaiUPulse!==null&&(typeof offer.claimKaiUPulse!=='string'||!/^(?:0|[1-9][0-9]{0,39})$/.test(offer.claimKaiUPulse))
  ||offer.claimHead!==null&&(typeof offer.claimHead!=='string'||!offer.claimHead||offer.claimHead.length>800)
  )fail();
 const actor=parseWildzPlayerCoordinate(sender)?.profileHandle,peer=parseWildzPlayerCoordinate(recipient)?.profileHandle;
 if(message.kind==='market-offer'){
  if(!same(Object.keys(message).sort(),['kind','offer'])||actor!==offer.buyerHandle||peer!==offer.ownerHandle)fail();
 }else if(message.kind==='market-offer-response'){
  if(!['accepted','declined','withdrawn'].includes(message.outcome)
   ||!same(Object.keys(message).sort(),['kind','offer','outcome',...(message.outcome==='accepted'?['listingId']:[])].sort())
   ||message.outcome==='accepted'&&(typeof message.listingId!=='string'||!/^market:listing:[a-f0-9]{64}$/.test(message.listingId)))fail();
  if(message.outcome==='withdrawn'?(actor!==offer.buyerHandle||peer!==offer.ownerHandle):(actor!==offer.ownerHandle||peer!==offer.buyerHandle))fail();
 }else fail();
 return Object.freeze(structuredClone(message));
}
export function wildzMarketOfferMessageId(message:WildzMarketOfferMessage){
 return `market-message:${sha256PortableBasis(canonicalPortableCardJson({offerId:message.offer.offerId,kind:message.kind})).slice(7)}`;
}
export function sameWildzMarketOfferOwner(card:WildzMarketOwnedCard,offer:WildzMarketOffer){
 return card.assetId===offer.assetId&&card.ownerHandle===offer.ownerHandle&&card.proofDigest===offer.proofDigest&&card.claimKaiUPulse===offer.claimKaiUPulse&&card.claimHead===offer.claimHead;
}

/** Derive inbox and sent offers from the same admitted Messages history.
 * Arrival time cannot decide terms or override a conflicting terminal reply. */
export function projectWildzMarketOffers(conversations:readonly WildsConversation[],owner:string,cards:readonly WildzMarketOwnedCard[]):readonly WildzMarketOfferView[]{
 const handle=parseWildzPlayerCoordinate(owner)?.profileHandle;if(!handle)return [];
 const results=new Map<string,WildzMarketOfferView>();
 const replies:WildzMarketOfferMessage[]=[],conflicts=new Set<string>();
 for(const conversation of conversations){
  const messages=[...conversation.messages].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  for(const message of messages){
   if(message.deletedAt||message.editedAt||!message.context||!['market-offer','market-offer-response'].includes(message.context.kind))continue;
   try{
    const admitted=admitWildzMarketOfferMessage(message.context,message.senderHandle,message.recipientHandle),offer=admitted.offer;
    if(![offer.buyerHandle,offer.ownerHandle].includes(handle)||message.clientMessageId!==wildzMarketOfferMessageId(admitted)
      ||message.conversationId!==conversation.id
      ||!conversation.participants.some(p=>p.id===message.senderId&&p.handle===message.senderHandle)
      ||!conversation.participants.some(p=>p.id===message.recipientId&&p.handle===message.recipientHandle))continue;
    const prior=results.get(offer.offerId);
    if(admitted.kind==='market-offer'){
     if(!prior)results.set(offer.offerId,{offer,status:'pending',createdAt:message.createdAt});
     else if(!same(prior.offer,offer))conflicts.add(offer.offerId);
    }else replies.push(admitted);
   }catch{/* Unauthenticated or altered cached proposals are not actionable offers. */}
  }
 }
 for(const reply of replies){
  if(reply.kind!=='market-offer-response')continue;
  const prior=results.get(reply.offer.offerId);if(!prior||!same(prior.offer,reply.offer))continue;
  if(prior.status!=='pending'&&(prior.status!==reply.outcome||prior.listingId!==reply.listingId))conflicts.add(reply.offer.offerId);
  else results.set(reply.offer.offerId,{...prior,status:reply.outcome,...(reply.outcome==='accepted'?{listingId:reply.listingId}:{})});
 }
 for(const id of conflicts)results.delete(id);
 return [...results.values()].map(item=>{
  const card=cards.find(card=>card.assetId===item.offer.assetId);
  return item.status==='pending'&&(!card||!sameWildzMarketOfferOwner(card,item.offer))?{...item,status:'stale' as const}:item;
 }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.offer.offerId.localeCompare(b.offer.offerId));
}
