"use client";

import {useState} from 'react';
import {ArrowLeft,ArrowRight,MessageCircle} from 'lucide-react';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import type {WildzMarketOfferView} from './wildz-market-offers';
import type {WildzMarketServiceV128,WildzMarketResultV128} from './wildz-market-service-v128';
import {WildzMarketCardPreview} from './WildzMarketCardPreview';
import {CardValue,MarketCardArtwork,marketHandle} from './WildzMarketDiscovery';
import {parseWildzMarketUsdInput} from './wildz-market-presentation';
import {formatWildsUsdCents} from '../play/wallet/wilds-wallet-format';
import {formatWildzMarketKai} from './wildz-market-value';
import styles from './WildzMarketSheet.module.css';

type OfferRequest=Parameters<NonNullable<WildzMarketServiceV128['makeOffer']>>[0];
// Keep the exact attempt through closing/reopening the mounted game's popover.
const attempts=new WeakMap<WildzMarketServiceV128,Map<string,OfferRequest>>();

export function WildzMarketOwnedDetail({card,service,busy,onBack,onOffer,onChart}:{card:WildzMarketOwnedCard;service:WildzMarketServiceV128|null;busy:boolean;onBack():void;onChart():void;onOffer(request:OfferRequest):Promise<WildzMarketResultV128|undefined>}){
 const [price,setPrice]=useState(''),[version,setVersion]=useState(0);
 const saved=service?.snapshot().pendingOffers?.find(v=>v.assetId===card.assetId);
 const held=service?attempts.get(service)?.get(card.assetId)??(saved?{assetId:saved.assetId,priceUsdCents:saved.priceUsdCents,attemptId:saved.offerId}:undefined):undefined;
 const parsed=parseWildzMarketUsdInput(price),cents=parsed&&BigInt(parsed)<=1_000_000_000n?parsed:null;
 const own=service?.binding.ownerHandle===card.ownerHandle;
 const send=async()=>{
  if(!service||(!held&&!cents))return;
  const request=held??{assetId:card.assetId,priceUsdCents:cents!,attemptId:`market:offer:${crypto.randomUUID()}`};
  const values=attempts.get(service)??new Map();values.set(card.assetId,request);attempts.set(service,values);setVersion(version+1);
  const result=await onOffer(request);
  if(result?.status==='completed'||result?.status==='failed'){values.delete(card.assetId);setVersion(v=>v+1);}
 };
 return <section className={styles.detail} aria-label="Creature details"><div className={styles.detailNav}><button className={styles.backLink} type="button" onClick={onBack}><ArrowLeft size={19}/>Back to listings</button><CardValue card={card} onChart={onChart} compact/></div>
  <div className={styles.detailLayout}><div className={styles.detailMedia}><WildzMarketCardPreview key={`${card.assetId}:${card.proofDigest}`} card={card} full front={<MarketCardArtwork card={card}/>}/></div><div className={styles.detailBody}>
   <span className={styles.kindLabel}>Owned creature · not listed for sale</span><h2>{card.title}</h2><p className={styles.seller}>Owned by <a href={`/u/${encodeURIComponent(card.ownerHandle.replace(/\.receiz\.id$/,''))}`}>{marketHandle(card.ownerHandle)}</a></p>
   <div className={styles.purchaseDock}>{own?<><h3>This companion is yours</h3><p>Incoming offers appear in Activity and Messages. You choose which offers to accept.</p></>:<><h3>Make it your next companion</h3><p>Send the owner a USD offer. Acceptance opens the normal purchase review with the named players and exact payment.</p><label className={styles.field}>Your offer in USD<div className={styles.priceInput}><span>$</span><input aria-label="Your offer in USD" inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={busy||Boolean(held)} value={held?formatWildsUsdCents(held.priceUsdCents).replace(/[$,]/g,''):price} onChange={e=>setPrice(e.target.value)}/></div></label><button className={styles.primary} type="button" disabled={busy||!service?.makeOffer||!held&&!cents} onClick={()=>void send()}>{busy?'Checking offer…':held?'Check this offer':'Send offer'}<ArrowRight size={20}/></button><p className={styles.dockNote}>No payment until you review and approve a purchase.</p></>}</div>
   <details className={styles.provenance}><summary>Creature provenance</summary><dl><div><dt>Creature ID</dt><dd>{card.assetId}</dd></div><div><dt>Card proof</dt><dd>{card.proofDigest}</dd></div>{card.claimKaiUPulse?<div><dt>Latest claim</dt><dd>{formatWildzMarketKai(card.claimKaiUPulse)}</dd></div>:null}{card.claimHead?<div><dt>Claim reference</dt><dd>{card.claimHead}</dd></div>:null}</dl></details>
  </div></div>
 </section>;
}

export function WildzMarketOffers({offers,owner,busy,onRespond,onReview}:{offers:readonly WildzMarketOfferView[];owner:string;busy:boolean;onRespond(id:string,outcome:'accepted'|'declined'|'withdrawn'):void;onReview(id:string):void}){
 return <section aria-label="Creature offers"><div className={styles.sectionHeading}><h3>Offers</h3><span>Messages & Market</span></div>{offers.length?<div className={styles.purchaseGrid}>{offers.map(item=>{
  const incoming=item.offer.ownerHandle===owner;
  return <article key={item.offer.offerId} className={styles.purchase}><div className={styles.cardHeading}><span className={styles.icon}><MessageCircle size={21}/></span><div><small>{incoming?`Offer from ${marketHandle(item.offer.buyerHandle)}`:`Your offer to ${marketHandle(item.offer.ownerHandle)}`}</small><h3>{item.offer.title}</h3></div><span className={styles.badge}>{item.status==='stale'?'Owner changed':item.status}</span></div><strong className={styles.offerPrice}>{formatWildsUsdCents(item.offer.priceUsdCents)}</strong><div className={styles.actions}>{item.status==='pending'?incoming?<><button className={styles.primary} type="button" disabled={busy} onClick={()=>onRespond(item.offer.offerId,'accepted')}>Accept offer</button><button type="button" disabled={busy} onClick={()=>onRespond(item.offer.offerId,'declined')}>Decline</button></>:<button type="button" disabled={busy} onClick={()=>onRespond(item.offer.offerId,'withdrawn')}>Withdraw offer</button>:null}{item.status==='accepted'&&!incoming&&item.listingId?<button className={styles.primary} type="button" disabled={busy} onClick={()=>onReview(item.listingId!)}>Review purchase<ArrowRight size={18}/></button>:null}</div>{item.status==='accepted'?<p className={styles.note}>Offer accepted. Purchase approvals, payment and delivery are still required.</p>:null}{item.status==='stale'?<p className={styles.note}>This offer targeted a previous ownership claim. Send a new offer to the current owner.</p>:null}</article>;
 })}</div>:<div className={styles.empty}><MessageCircle size={30}/><h3>A conversation starts a collection</h3><p>Offers on your creatures and offers you send appear here and in Messages.</p></div>}</section>;
}
