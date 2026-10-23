"use client";

import {useState,type ReactNode} from 'react';
import type {PortableCardAsset} from '../play/portable-card';
import {ArrowLeft,ArrowRight,MessageCircle} from 'lucide-react';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import type {WildzMarketOfferView} from './wildz-market-offers';
import type {WildzMarketServiceV128,WildzMarketResultV128,WildzMarketSnapshotV128} from './wildz-market-service-v128';
import {WildzMarketCardPreview} from './WildzMarketCardPreview';
import {CardValue,MarketCardArtwork,marketHandle} from './WildzMarketDiscovery';
import {parseWildzMarketUsdInput} from './wildz-market-presentation';
import {formatWildsUsdCents} from '../play/wallet/wilds-wallet-format';
import {formatWildzMarketKai} from './wildz-market-value';
import styles from './WildzMarketSheet.module.css';

type OfferRequest=Parameters<NonNullable<WildzMarketServiceV128['makeOffer']>>[0];
// Keep the exact attempt through closing/reopening the mounted game's popover.
const attempts=new WeakMap<WildzMarketServiceV128,Map<string,OfferRequest>>();

export function WildzMarketOwnedDetail({card,service,busy,onBack,onOffer,onChart,backLabel='Back to listings',front,readCard}:{card:WildzMarketOwnedCard;service:WildzMarketServiceV128|null;busy:boolean;onBack():void;onChart():void;onOffer(request:OfferRequest):Promise<WildzMarketResultV128|undefined>;backLabel?:string;front?:ReactNode;readCard?(card:WildzMarketOwnedCard,signal?:AbortSignal):Promise<PortableCardAsset>}){
 const [price,setPrice]=useState(''),[version,setVersion]=useState(0);
 const saved=service?.snapshot().pendingOffers?.find(v=>v.assetId===card.assetId);
 const held=service?attempts.get(service)?.get(card.assetId)??(saved?{assetId:saved.assetId,priceUsdCents:saved.priceUsdCents,attemptId:saved.offerId}:undefined):undefined;
 const parsed=parseWildzMarketUsdInput(price),cents=parsed&&BigInt(parsed)<=1_000_000_000n?parsed:null;
 const resolved=Boolean(card.ownerHandle),own=resolved&&service?.binding.ownerHandle===card.ownerHandle;
 const send=async()=>{
  if(!service||(!held&&!cents))return;
  const request=held??{assetId:card.assetId,priceUsdCents:cents!,attemptId:`market:offer:${crypto.randomUUID()}`};
  const values=attempts.get(service)??new Map();values.set(card.assetId,request);attempts.set(service,values);setVersion(version+1);
  const result=await onOffer(request);
  if(result?.status==='completed'||result?.status==='failed'){values.delete(card.assetId);setVersion(v=>v+1);}
 };
 return <section className={styles.detail} aria-label="Creature details"><div className={styles.detailNav}><button className={styles.backLink} type="button" onClick={onBack}><ArrowLeft size={19}/>{backLabel}</button><CardValue card={card} onChart={onChart} compact/></div>
  <div className={styles.detailLayout}><div className={styles.detailMedia}><WildzMarketCardPreview key={`${card.assetId}:${card.proofDigest}`} card={card} full readCard={readCard} front={front??<MarketCardArtwork card={card}/>}/></div><div className={styles.detailBody}>
   <span className={styles.kindLabel}>Owned creature · not listed for sale</span><h2>{card.title}</h2><p className={styles.seller}>{resolved?<>Owned by <a href={`/u/${encodeURIComponent(card.ownerHandle.replace(/\.receiz\.id$/,''))}`}>{marketHandle(card.ownerHandle)}</a></>:'Owner claim unresolved'}</p>
   <div className={styles.purchaseDock}>{!resolved?<><h3>Owner claim unresolved</h3><p>Re-upload the original card to claim it with your verified identity.</p></>:own?<><h3>This companion is yours</h3><p>Incoming offers appear in Activity and Messages. You choose which offers to accept.</p></>:<><h3>Make it your next companion</h3><p>Send the owner a USD offer. Acceptance opens the normal purchase review with the named players and exact payment.</p><label className={styles.field}>Your offer in USD<div className={styles.priceInput}><span>$</span><input aria-label="Your offer in USD" inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={busy||Boolean(held)} value={held?formatWildsUsdCents(held.priceUsdCents).replace(/[$,]/g,''):price} onChange={e=>setPrice(e.target.value)}/></div></label><button className={styles.primary} type="button" disabled={busy||!service?.makeOffer||!held&&!cents} onClick={()=>void send()}>{busy?'Checking offer…':held?'Check this offer':'Send offer'}<ArrowRight size={20}/></button><p className={styles.dockNote}>No payment until you review and approve a purchase.</p></>}</div>
   <details className={styles.provenance}><summary>Creature provenance</summary><dl><div><dt>Creature ID</dt><dd>{card.assetId}</dd></div><div><dt>Card proof</dt><dd>{card.proofDigest}</dd></div>{card.claimKaiUPulse?<div><dt>Latest claim</dt><dd>{formatWildzMarketKai(card.claimKaiUPulse)}</dd></div>:null}{card.claimHead?<div><dt>Claim reference</dt><dd>{card.claimHead}</dd></div>:null}</dl></details>
  </div></div>
 </section>;
}

export function WildzMarketOffers({offers,listings,owner,busy,onRespond,onReview}:{offers:readonly WildzMarketOfferView[];listings:WildzMarketSnapshotV128['listings'];owner:string;busy:boolean;onRespond(id:string,outcome:'accepted'|'declined'|'withdrawn'):void;onReview(id:string):void}){
 return <section aria-label="Creature offers"><div className={styles.sectionHeading}><h3>Offers</h3><span>Messages & Market</span></div>{offers.length?<div className={styles.purchaseGrid}>{offers.map(item=>{
  const incoming=item.offer.ownerHandle===owner;
  const listing=listings.find(value=>value.listingId===item.listingId&&value.sellerHandle===item.offer.ownerHandle&&value.asset.kind==='creature'&&value.asset.assetId===item.offer.assetId&&value.priceUsdCents===item.offer.priceUsdCents);
  const retryConnection=incoming&&item.status==='accepted'&&item.listingId&&(!listing||listing.status==='active'&&listing.canActivate);
  const reviewAvailable=listing?.status==='active'&&listing.canBuy;
  return <article key={item.offer.offerId} data-market-offer-id={item.offer.offerId} tabIndex={-1} aria-label={`Offer for ${item.offer.title}`} className={styles.purchase}><div className={styles.cardHeading}><span className={styles.icon}><MessageCircle size={21}/></span><div><small>{incoming?`Offer from ${marketHandle(item.offer.buyerHandle)}`:`Your offer to ${marketHandle(item.offer.ownerHandle)}`}</small><h3>{item.offer.title}</h3></div><span className={styles.badge}>{item.status==='stale'?'Owner changed':item.status}</span></div><strong className={styles.offerPrice}>{formatWildsUsdCents(item.offer.priceUsdCents)}</strong><div className={styles.actions}>{item.status==='pending'?incoming?<><button className={styles.primary} type="button" disabled={busy} onClick={()=>onRespond(item.offer.offerId,'accepted')}>Accept offer</button><button type="button" disabled={busy} onClick={()=>onRespond(item.offer.offerId,'declined')}>Decline</button></>:<button type="button" disabled={busy} onClick={()=>onRespond(item.offer.offerId,'withdrawn')}>Withdraw offer</button>:null}{retryConnection?<button className={styles.primary} type="button" disabled={busy} onClick={()=>onRespond(item.offer.offerId,'accepted')}>{listing?'Retry accepted offer':'Check purchase connection'}</button>:null}{item.status==='accepted'&&!incoming&&item.listingId?<button className={styles.primary} type="button" disabled={busy||!reviewAvailable} onClick={()=>onReview(item.listingId!)}>Review purchase<ArrowRight size={18}/></button>:null}</div>{item.status==='accepted'?<p className={styles.note}>{retryConnection?'Purchase connection pending. Retry this accepted offer to finish the original listing.':!incoming&&!reviewAvailable&&(!listing||listing.status==='active')?'Purchase connection pending. The seller can retry this accepted offer.':'Offer accepted. Purchase approvals, payment and delivery are still required.'}</p>:null}{item.status==='stale'?<p className={styles.note}>This offer targeted a previous ownership claim. Send a new offer to the current owner.</p>:null}</article>;
 })}</div>:<div className={styles.empty}><MessageCircle size={30}/><h3>A conversation starts a collection</h3><p>Offers on your creatures and offers you send appear here and in Messages.</p></div>}</section>;
}
