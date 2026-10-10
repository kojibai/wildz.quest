"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import type {WildzMarketPurchasePhaseV128,WildzMarketPurchaseReviewV128,WildzMarketResultV128,WildzMarketServiceV128,WildzMarketSnapshotV128} from './wildz-market-service-v128';
import {createWildzMarketUiActionRuntime,parseWildzMarketUsdInput,readWildzMarketListingUiAttempt,retainWildzMarketListingUiAttempt,releaseWildzMarketListingUiAttempt,type WildzMarketUiActionState,type WildzMarketListingUiAttempt} from './wildz-market-presentation';
import {formatWildsPhiExact,formatWildsUsdCents} from '../play/wallet/wilds-wallet-format';
import {shouldRefreshWildzMarket} from './market-refresh-policy';
import styles from './WildzMarketSheet.module.css';

type Tab='browse'|'sell'|'activity';
const empty:WildzMarketSnapshotV128={status:'unavailable',message:'Connect your Receiz ID to browse and trade.',listings:[],purchases:[],sellables:[]};
const phaseLabels:Record<WildzMarketPurchasePhaseV128,string>={
 review:'Review purchase','awaiting-approvals':'Awaiting approval','payment-pending':'Checking payment',
 paid:'Payment confirmed · delivery pending','awaiting-acceptance':'Delivery ready to accept',
 received:'Asset received · refresh pending',completed:'Purchase complete','review-required':'Review updated terms',failed:'Needs attention'
};
const handle=(value:string)=>`@${value.replace(/\.receiz\.id$/,'')}`;
const icon=(kind:string)=>kind==='creature'?'✦':'▣';

function PurchaseCard({purchase,ownerHandle,disabled,onApprove,onResume,onAccept,onCancel,onReview}:{purchase:WildzMarketPurchaseReviewV128;ownerHandle:string;disabled:boolean;onApprove():void;onResume():void;onAccept():void;onCancel():void;onReview():void}){
 const seller=purchase.sellerHandle===ownerHandle,buyer=purchase.buyerHandle===ownerHandle;
 return <article className={styles.purchase} data-purchase-phase={purchase.phase}>
  <div className={styles.cardHeading}><span className={styles.icon} aria-hidden="true">{icon(purchase.kind)}</span><div><small>{seller?'Your sale':'Your purchase'}</small><h3>{purchase.title}</h3></div><span className={styles.badge}>{phaseLabels[purchase.phase]}</span></div>
  <dl className={styles.terms}><div><dt>Buyer</dt><dd>{handle(purchase.buyerHandle)}</dd></div><div><dt>Seller</dt><dd>{handle(purchase.sellerHandle)}</dd></div><div><dt>Listing price</dt><dd>{formatWildsUsdCents(purchase.priceUsdCents)}</dd></div><div><dt>Exact payment</dt><dd>{formatWildsPhiExact(purchase.amountPhiMicro)} Phi</dd></div></dl>
  {purchase.phase==='review'||purchase.phase==='awaiting-approvals'?<p className={styles.note}>Both players approve these exact terms. Payment and delivery complete in separate steps.</p>:null}
  {purchase.message?<p className={styles.note}>{purchase.message}</p>:null}
  <div className={styles.actions}>
   {purchase.canApprove&&(buyer||seller)?<button type="button" className={styles.primary} disabled={disabled} onClick={onApprove}>{seller?`Approve sale to ${handle(purchase.buyerHandle)}`:'Approve purchase'}</button>:null}
   {purchase.canAccept&&buyer?<button type="button" className={styles.primary} disabled={disabled} onClick={onAccept}>Accept delivery</button>:null}
   {purchase.canResume?<button type="button" disabled={disabled} onClick={onResume}>{purchase.assetRecoveryRequired?'Refresh received asset':'Resume purchase'}</button>:null}
   {purchase.phase==='review-required'&&purchase.canCancel&&buyer?<button type="button" className={styles.primary} disabled={disabled} onClick={onReview}>Review current quote</button>:null}
   {purchase.canCancel&&(buyer||seller)?<button type="button" disabled={disabled} onClick={onCancel}>{seller?'Decline purchase':'Cancel purchase'}</button>:null}
  </div>
 </article>;
}

export function WildzMarketSheet({service,connected,initialTab='browse'}:{service:WildzMarketServiceV128|null;connected:boolean;initialTab?:Tab}){
 const [tab,setTab]=useState<Tab>(initialTab);
 const mounted=useRef(true),live=useRef({service,connected});live.current={service,connected};
 const [view,setView]=useState<{service:WildzMarketServiceV128|null;snapshot:WildzMarketSnapshotV128}>(()=>({service,snapshot:service?.snapshot()??empty}));
 const [uiView,setUiView]=useState<{runtime:ReturnType<typeof createWildzMarketUiActionRuntime>;state:WildzMarketUiActionState}|null>(null);
 const runtime=useMemo(()=>createWildzMarketUiActionRuntime({
  isCurrent:()=>mounted.current&&connected&&live.current.service===service&&live.current.connected,
  onChange:state=>setUiView({runtime,state})
 }),[service,connected]);
 const ui=uiView?.runtime===runtime?uiView.state:runtime.snapshot();
 const snapshot=view.service===service?view.snapshot:service?.snapshot()??empty;
 const unavailable=!connected||!service,busy=Boolean(ui.busy);
 const [selection,setSelection]=useState<{service:WildzMarketServiceV128;id:string}|null>(null);
 const [price,setPrice]=useState<{service:WildzMarketServiceV128;value:string}|null>(null);
 const [listingAttempt,setListingAttempt]=useState<(WildzMarketListingUiAttempt&{service:WildzMarketServiceV128})|null>(()=>{const held=service?readWildzMarketListingUiAttempt(service):null;return service&&held?{service,...held}:null;});
 const [review,setReview]=useState<{service:WildzMarketServiceV128;value:WildzMarketPurchaseReviewV128}|null>(null);
 const selected=snapshot.sellables.find(item=>item.id===(selection?.service===service?selection.id:null))??snapshot.sellables.find(item=>!item.disabledReason)??snapshot.sellables[0];
 const priceText=price?.service===service?price.value:'',parsedCents=parseWildzMarketUsdInput(priceText);
 const cents=parsedCents&&BigInt(parsedCents)<=1_000_000_000n?parsedCents:null;
 const savedListing=snapshot.pendingListings?.[0];
 const savedAttempt=savedListing?{request:{asset:savedListing.asset,priceUsdCents:savedListing.priceUsdCents,attemptId:savedListing.attemptId},title:savedListing.title,summary:savedListing.summary}:null;
 const held=service?(listingAttempt?.service===service?listingAttempt:readWildzMarketListingUiAttempt(service)??savedAttempt):null;
 const active=snapshot.listings.filter(item=>item.status==='active');
 const own=snapshot.listings.filter(item=>item.sellerHandle===service?.binding.ownerHandle&&(item.status==='active'||item.status==='reserved'));
 const purchases=[...snapshot.purchases];
 if(review?.service===service&&!purchases.some(item=>item.purchaseId===review.value.purchaseId))purchases.unshift(review.value);
 const attention=purchases.filter(item=>item.phase!=='completed').length;

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if (!shouldRefreshWildzMarket(connected)) return;
  if(!service)return;
  let active=true;
  const unsubscribe=service.subscribe(next=>{if(active&&live.current.service===service)setView({service,snapshot:next});});
  void runtime.run('Read market',()=>service.read()).then(next=>{if(next&&active&&live.current.service===service)setView({service,snapshot:next});});
  return()=>{active=false;unsubscribe();};
 },[service,connected,runtime]);

 const showResult=(result:WildzMarketResultV128|undefined)=>{if(result)runtime.notice(result.message,result.status==='failed');};
 const refresh=()=>{if(service)void runtime.run('Read market',()=>service.read()).then(next=>{if(next&&live.current.service===service)setView({service,snapshot:next});});};
 const preview=(listingId:string)=>{
  if(!service)return;
  void runtime.run('Review purchase',()=>service.previewPurchase(listingId)).then(next=>{if(next&&live.current.service===service){setReview({service,value:next});setTab('activity');}});
 };
 const purchaseAction=(kind:'approvePurchase'|'resume'|'accept',purchaseId:string)=>{
  if(!service)return;
  void runtime.run(kind==='approvePurchase'?'Approve terms':kind==='accept'?'Accept delivery':'Resume purchase',()=>service[kind](purchaseId)).then(showResult);
 };
 const list=()=>{
  if(!service||unavailable||busy)return;
  if(!held&&(!selected||selected.disabledReason||!cents)){runtime.notice('Choose an available asset and a USD price with at most two decimal places.',true);return;}
  let attemptId:string|undefined;
  void runtime.run(held?'Check listing':'List asset',()=>{
   const exact=retainWildzMarketListingUiAttempt(service,held??{request:{asset:structuredClone(selected!.asset),priceUsdCents:cents!,attemptId:`market:list:${crypto.randomUUID()}`},title:selected!.title,summary:selected!.summary});
   attemptId=exact.request.attemptId;
   setListingAttempt({service,...exact});
   return service.list(exact.request);
  }).then(result=>{
   if(live.current.service!==service||!result)return;
   showResult(result);
   if(result.status==='listed'||result.status==='failed'){if(attemptId)releaseWildzMarketListingUiAttempt(service,attemptId);setListingAttempt(null);if(result.status==='listed')setTab('activity');}
  });
 };

 return <div className={`wildz-market-sheet ${styles.sheet}`} aria-label="Player market">
  <header className={styles.header}><div><span>Player market</span><h2>Trade on the trail</h2><p>Creatures, food and gathered resources</p></div><button type="button" disabled={unavailable||busy} onClick={refresh}>{ui.busy==='Read market'?'Loading…':'Refresh'}</button></header>
  <nav className={styles.tabs} aria-label="Market views">{(['browse','sell','activity'] as const).map(item=><button type="button" key={item} aria-current={tab===item?'page':undefined} onClick={()=>setTab(item)}>{item==='browse'?'Browse':item==='sell'?'Sell':`Activity${attention?` · ${attention}`:''}`}</button>)}</nav>
  {unavailable?<p className={styles.empty}>Connect your Receiz ID to browse and trade.</p>:null}
  {ui.message||snapshot.message?<p className={styles.status} role="status" data-error={ui.error||undefined}>{ui.message||snapshot.message}</p>:null}
  {tab==='browse'?<section aria-label="Market listings" className={styles.stack}>
   <div className={styles.sectionHeading}><h3>On the trail</h3><span>{active.length} listed</span></div>
   {active.length?active.map(listing=><article className={styles.listing} key={listing.listingId}>
    <span className={styles.icon} aria-hidden="true">{icon(listing.kind)}</span><div><h3>{listing.title}</h3><small>{handle(listing.sellerHandle)} · {listing.kind==='creature'?'Creature':'Resource package'}</small></div><strong>{formatWildsUsdCents(listing.priceUsdCents)}</strong>
    <button type="button" disabled={unavailable||busy||!listing.canBuy} onClick={()=>preview(listing.listingId)}>{listing.sellerHandle===service?.binding.ownerHandle?'Your listing':'Review purchase'}</button>
   </article>):<p className={styles.empty}>{snapshot.status==='loading'?'Checking listings…':'No active listings yet. List a creature or a resource package from your wallet.'}</p>}
   {attention?<button type="button" className={styles.activityLink} onClick={()=>setTab('activity')}>{attention} purchase{attention===1?'':'s'} to review or resume</button>:null}
   {held?<button type="button" className={styles.activityLink} onClick={()=>setTab('sell')}>Check pending listing · {held.title}</button>:null}
  </section>:null}
  {tab==='sell'?<section aria-label="Sell an asset" className={styles.stack}>
   <div className={styles.sectionHeading}><h3>Choose what to list</h3><span>From your wallet</span></div>
   {snapshot.sellables.length||held?<>
    <label className={styles.field}>Asset<select value={held?held.request.attemptId:selected?.id??''} disabled={unavailable||busy||Boolean(held)} onChange={event=>{if(service)setSelection({service,id:event.target.value});}}>{held?<option value={held.request.attemptId}>{held.title}</option>:snapshot.sellables.map(item=><option key={item.id} value={item.id} disabled={Boolean(item.disabledReason)}>{item.title}{item.disabledReason?` · ${item.disabledReason}`:''}</option>)}</select></label>
    <div className={`wildz-market-consequence ${styles.selection}`}><span aria-hidden="true">{icon(held?.request.asset.kind??selected?.kind??'package')}</span><div><strong>{held?.title??selected?.title}</strong><p>{held?.summary??selected?.summary}</p></div></div>
    <label className={styles.field}>Price in USD<div className={styles.priceInput}><span aria-hidden="true">$</span><input aria-label="Price in USD" inputMode="decimal" autoComplete="off" placeholder="0.00" value={held?formatWildsUsdCents(held.request.priceUsdCents).replace(/[$,]/g,''):priceText} disabled={unavailable||busy||Boolean(held)} onChange={event=>{if(service)setPrice({service,value:event.target.value});}}/></div></label>
    {!held&&parsedCents&&!cents?<p className={styles.note}>Maximum listing price is $10,000,000.00.</p>:null}
    <p className={styles.note}>This selection is listed together. You approve the named buyer and exact payment before the sale proceeds.</p>
    {held?<p className={styles.note}>The listing response is pending. Check this same listing to continue.</p>:null}
    <button type="button" className={styles.primary} disabled={unavailable||busy||!held&&(!cents||!selected||Boolean(selected.disabledReason))} onClick={list}>{busy&&ui.busy!=='Read market'?'Checking…':held?'Check listing':`List${cents?` for ${formatWildsUsdCents(cents)}`:' asset'}`}</button>
   </>:<p className={styles.empty}>Available creatures and resource packages appear here after your wallet is ready.</p>}
  </section>:null}
  {tab==='activity'?<section aria-label="Market activity" className={styles.stack}>
   {purchases.length?<><div className={styles.sectionHeading}><h3>Purchases and requests</h3></div>{purchases.map(item=><PurchaseCard key={item.purchaseId} purchase={item} ownerHandle={service?.binding.ownerHandle??''} disabled={unavailable||busy} onApprove={()=>purchaseAction('approvePurchase',item.purchaseId)} onResume={()=>purchaseAction('resume',item.purchaseId)} onAccept={()=>purchaseAction('accept',item.purchaseId)} onReview={()=>preview(item.listingId)} onCancel={()=>{if(service)void runtime.run('Cancel purchase',()=>service.cancel(item.listingId)).then(showResult);}}/>)}</>:null}
   <div className={styles.sectionHeading}><h3>Your listings</h3><span>{own.length} active or reserved</span></div>
   {own.length?own.map(item=><article className={styles.ownListing} key={item.listingId}><div><strong>{item.title}</strong><small>{item.status==='reserved'?'Reserved for a buyer':'Active listing'} · {formatWildsUsdCents(item.priceUsdCents)}</small></div>{item.canCancel?<button type="button" disabled={unavailable||busy} onClick={()=>{if(service)void runtime.run('Cancel listing',()=>service.cancel(item.listingId)).then(showResult);}}>Cancel listing</button>:<span className={styles.badge}>Reserved</span>}</article>):<p className={styles.empty}>Your active listings appear here. Purchases stay available to resume if a reply is delayed.</p>}
  </section>:null}
  <p className={styles.footer}>Prices are in USD. Checkout uses the exact Phi amount you review.</p>
 </div>;
}
