"use client";

import {marketFixtureCards,marketFixtureStressCards} from './market-fixture-cards';
import type {WildzMarketOffer} from './wildz-market-offers';
import {createWildzMarketValueBrowserPortV129} from './wildz-market-value-browser-v129';
import {wildzMarketValueChange} from './wildz-market-value';
import {useMemo,useState} from 'react';
import {WildzMarketSheet} from './WildzMarketSheet';
import type {WildzMarketPurchaseReviewV128,WildzMarketServiceV128,WildzMarketSnapshotV128} from './wildz-market-service-v128';
import {createWildsWalletTradeAgreement,createWildsWalletTradeDraft} from '../play/wallet/wilds-wallet-trade';

const buyer='forestwanderer.receiz.id',seller='trailkeeper.receiz.id';
const creature={kind:'creature' as const,assetId:marketFixtureCards[0]!.id};
const resources={kind:'inventory' as const,foodItemIds:['fixture:fruit:1','fixture:fruit:2','fixture:vegetable','fixture:meat'],materialLotIds:['fixture:timber'],resourceLotIds:['fixture:honey']};
const agreement=createWildsWalletTradeAgreement(
 {senderHandle:seller,draft:createWildsWalletTradeDraft({attemptId:'fixture:sale',recipient:buyer,selfHandle:seller,phiMicro:'0',requestedPhiMicro:'1234567',requestNote:'Market fixture',selections:[{selection:{id:'ember',label:'Ember Cub',quantity:1,asset:creature},quantity:1}]})},
 {senderHandle:buyer,draft:createWildsWalletTradeDraft({attemptId:'fixture:buy',recipient:seller,selfHandle:buyer,phiMicro:'1234567',requestedPhiMicro:'0',requestNote:'Market fixture',selections:[]})}
);

/** Development-only trade simulation with the actual local SDK calculator. No publication, payment or claim. */
function createFixtureService(ownerHandle:string,onCall:(value:string)=>void,cards=marketFixtureCards):WildzMarketServiceV128{
 const listeners=new Set<(snapshot:WildzMarketSnapshotV128)=>void>();
 let pendingList:Parameters<WildzMarketServiceV128['list']>[0]|null=null;
 let snapshot:WildzMarketSnapshotV128={status:'ready',message:'Simulated UI only · no assets or Phi are sent.',listings:[
  {listingId:`market:listing:${'a'.repeat(64)}`,title:marketFixtureCards[0]!.manifest.name,kind:'creature',asset:creature,sellerHandle:seller,priceUsdCents:'1234',status:'active',canBuy:ownerHandle===buyer,canCancel:ownerHandle===seller},
  {listingId:'fixture:listing:harvest',title:'Wild harvest basket',kind:'inventory',asset:resources,sellerHandle:ownerHandle,priceUsdCents:'500',status:'active',canBuy:false,canCancel:true}
 ],collection:cards.map(asset=>({assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:seller,asset,claimKaiUPulse:'16000000100001',claimHead:'fixture:claim:head',artworkUrl:`/test-fixtures/market/cards/${encodeURIComponent(asset.id)}/image`})),offers:[],history:[],transfers:[{id:'fixture:transfer:1',assetId:marketFixtureCards[0]!.id,fromHandle:'wayfinder.receiz.id',toHandle:seller,kaiUPulse:'15999999991234',headReference:'fixture:verified-claim-reference'}],purchases:[],sellables:[
  {id:'fixture:provisions',title:'Trail provisions',kind:'inventory',asset:resources,summary:'2 fruit · 1 vegetable · 1 meat · 1 timber · 1 Living Honey'},
  {id:'fixture:package',title:'Packed harvest',kind:'package',asset:{kind:'package',packageId:`wildz:package:${'b'.repeat(64)}`},summary:'One complete resource package · 6 items'},
  {id:'fixture:creature',title:marketFixtureCards[0]!.manifest.name,kind:'creature',asset:creature,summary:'One creature · its complete history'}
 ]};
 const publish=()=>{for(const listener of listeners)listener(snapshot);};
 const updatePurchase=(next:WildzMarketPurchaseReviewV128)=>{snapshot={...snapshot,purchases:[next]};publish();};
 const getPurchase=()=>{const current=snapshot.purchases[0];if(!current)throw Error('Review a purchase first.');return current;};
 const review:WildzMarketPurchaseReviewV128={purchaseId:'fixture:purchase:ember',listingId:`market:listing:${'a'.repeat(64)}`,reservationId:'fixture:reservation:ember',title:marketFixtureCards[0]!.manifest.name,kind:'creature',buyerHandle:buyer,sellerHandle:seller,priceUsdCents:'1234',amountPhiMicro:'1234567',usdPerPhiMicrocents:'1000000000',expiresAtKai:999,phase:'review',agreement,canApprove:true,canResume:false,canAccept:false,message:'Review the named players and exact terms.'};
 if(ownerHandle===seller)snapshot={...snapshot,offers:[{offer:{schema:'wildz.market-offer.v1',offerId:'market:offer:fixture-incoming',assetId:marketFixtureCards[1]!.id,title:marketFixtureCards[1]!.manifest.name,proofDigest:marketFixtureCards[1]!.proof.digest,buyerHandle:buyer,ownerHandle:seller,claimKaiUPulse:'16000000100001',claimHead:'fixture:claim:head',priceUsdCents:'1800'},status:'pending',createdAt:'2026-10-11T16:00:00.000Z'}],purchases:[{...review,phase:'awaiting-approvals',message:'The buyer approved. Your seller approval is still required.'}]};
 // An explicit fixture display basis, never used by production payment or quotes.
 const valuePort=createWildzMarketValueBrowserPortV129({card:id=>cards.find(card=>card.id===id)??null});
 return {
  binding:{ownerHandle,keyId:(ownerHandle===buyer?'a':'c').repeat(64)},snapshot:()=>snapshot,
  releaseValue:()=>valuePort.release?.(),
  readValue:async assetId=>{
   onCall(`local-value ${assetId}`);const result=await valuePort.read(assetId);
   if(result.status==='ready'){const value=result.value;snapshot={...snapshot,collection:snapshot.collection!.map(card=>card.assetId===assetId?{...card,value:{proofValuePhiMicro:value.proofValuePhiMicro,displayUsdCents:value.displayUsdCents,valuationKaiUPulse:value.valuationKaiUPulse,algorithm:value.algorithm,changeBps:wildzMarketValueChange(value.samples,value.displayUsdCents===null?'phi':'usd')}}:card)};publish();}
   return result;
  },
  makeOffer:async request=>{onCall(`offer ${request.attemptId}`);const card=snapshot.collection!.find(c=>c.assetId===request.assetId)!;const offer:WildzMarketOffer={schema:'wildz.market-offer.v1',offerId:request.attemptId,assetId:card.assetId,title:card.title,proofDigest:card.proofDigest,buyerHandle:buyer,ownerHandle:seller,claimKaiUPulse:card.claimKaiUPulse,claimHead:card.claimHead,priceUsdCents:request.priceUsdCents};if(!snapshot.offers!.some(v=>v.offer.offerId===offer.offerId))snapshot={...snapshot,offers:[...snapshot.offers!,{offer,status:'pending',createdAt:'2026-10-11T16:00:00.000Z'}]};publish();return {status:'completed',message:'Simulated offer sent.'};},
  respondToOffer:async (id,outcome)=>{onCall(`offer-response ${id} ${outcome}`);snapshot={...snapshot,offers:snapshot.offers!.map(v=>v.offer.offerId===id?{...v,status:outcome,...(outcome==='accepted'?{listingId:`market:listing:${'a'.repeat(64)}`}:{})}:v)};publish();return {status:'completed',message:`Simulated offer ${outcome}.`};},
  subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},read:async()=>{onCall('read');return snapshot;},
  list:async request=>{
   onCall(`list ${request.attemptId} ${request.priceUsdCents} ${JSON.stringify(request.asset)}`);
   if(!pendingList){pendingList=structuredClone(request);snapshot={...snapshot,sellables:[]};publish();return {status:'pending',message:'Simulated lost listing reply. Check this same listing.'};}
   if(JSON.stringify(pendingList)!==JSON.stringify(request))throw Error('Fixture detected a changed listing attempt.');
   snapshot={...snapshot,listings:[...snapshot.listings,{listingId:'fixture:listing:sent',title:'Trail provisions',kind:request.asset.kind,asset:request.asset,sellerHandle:ownerHandle,priceUsdCents:request.priceUsdCents,status:'active',canBuy:false,canCancel:true}]};publish();
   return {status:'listed',listingId:'fixture:listing:sent',message:'Simulated listing confirmed.'};
  },
  cancel:async listingId=>{onCall(`cancel ${listingId}`);snapshot={...snapshot,listings:snapshot.listings.map(item=>item.listingId===listingId?{...item,status:'cancelled',canCancel:false}:item)};publish();return {status:'cancelled',message:'Simulated listing cancelled.'};},
  previewPurchase:async listingId=>{onCall(`review ${listingId}`);updatePurchase(review);return review;},
  approvePurchase:async purchaseId=>{onCall(`approve ${purchaseId}`);updatePurchase({...getPurchase(),phase:'paid',canApprove:false,canResume:true,message:'Simulated payment confirmed. Delivery is pending.'});return {status:'pending',message:'Simulated payment confirmed. Delivery is pending.'};},
  resume:async purchaseId=>{onCall(`resume ${purchaseId}`);updatePurchase({...getPurchase(),phase:'awaiting-acceptance',canApprove:false,canResume:true,canAccept:ownerHandle===buyer,message:'Simulated delivery is ready. Accepting it is a separate step.'});return {status:'awaiting-acceptance',message:'Simulated delivery is ready to accept.'};},
  accept:async purchaseId=>{onCall(`accept ${purchaseId}`);snapshot={...snapshot,history:[{id:'fixture:completed:1',listingId:review.listingId,asset:creature,title:review.title,buyerHandle:buyer,sellerHandle:seller,priceUsdCents:'1234',amountPhiMicro:'1234567',paymentReceiptDigest:'fixture:payment:receipt',assetReceiptDigest:'fixture:delivery:receipt'}]};updatePurchase({...getPurchase(),phase:'completed',canApprove:false,canResume:false,canAccept:false,message:'Simulated source accepted and local inventory refreshed.'});return {status:'completed',message:'Simulated purchase complete.'};},
  receive:async()=>({status:'failed',message:'This display fixture does not receive private offers.'})
 };
}

export function WildzMarketBrowserFixture(){
 const [owner,setOwner]=useState(buyer),[open,setOpen]=useState(true),[calls,setCalls]=useState<readonly string[]>([]);
 const [stress,setStress]=useState(false);
 const service=useMemo(()=>createFixtureService(owner,value=>setCalls(previous=>[...previous.slice(-49),value]),stress?marketFixtureStressCards:marketFixtureCards),[owner,stress]);
 return <main className="wildz-app" style={{minHeight:'100dvh',padding:20,background:'radial-gradient(circle at 20% 20%,#385c37,#0c211b 70%)',color:'#eff1db'}}>
  <h1 style={{fontSize:20}}>Market UI fixture</h1><p>Local SDK values · Simulated trades. No publication, asset transfer or payment.</p>
  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" onClick={()=>setOwner(current=>current===buyer?seller:buyer)}>Switch to {owner===buyer?'seller':'buyer'}</button><button type="button" onClick={()=>setOpen(value=>!value)}>{open?'Close market':'Open market'}</button></div>
  <p data-testid="fixture-account">Viewing {owner}</p><button type="button" onClick={()=>setStress(value=>!value)}>{stress?'Use three-card collection':'Use 72-card stress collection'}</button>
  <details><summary>Simulated service calls ({calls.length})</summary><pre data-testid="fixture-calls" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{calls.join('\n')}</pre></details>
  {open?<section className="wildz-shell-overlay" data-surface="market" role="dialog" aria-label="market panel" aria-modal="true"><WildzMarketSheet service={service} connected onClose={()=>setOpen(false)}/></section>:null}
 </main>;
}
