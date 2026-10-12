"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Image from 'next/image';
import {ArrowLeft,ArrowRight,Clock3,Compass,Leaf,Package,Tag,UserRound,ScanLine} from 'lucide-react';
import type {WildzMarketPurchasePhaseV128,WildzMarketPurchaseReviewV128,WildzMarketResultV128,WildzMarketServiceV128,WildzMarketSnapshotV128} from './wildz-market-service-v128';
import {createWildzMarketUiActionRuntime,parseWildzMarketUsdInput,readWildzMarketListingUiAttempt,retainWildzMarketListingUiAttempt,releaseWildzMarketListingUiAttempt,type WildzMarketUiActionState,type WildzMarketListingUiAttempt} from './wildz-market-presentation';
import {formatWildsPhiExact,formatWildsUsdCents} from '../play/wallet/wilds-wallet-format';
import {getWildzMarketWarmup} from './wildz-market-warmup';
import {shouldRefreshWildzMarket} from './market-refresh-policy';
import {validateWildzCardCheckoutUrlV128} from '../../lib/receiz/wildz-card-checkout-url-v128';
import styles from './WildzMarketSheet.module.css';
import {MarketArtwork,WildzMarketDiscovery,WildzMarketListingDetail} from './WildzMarketDiscovery';
import {WildzMarketOwnedDetail,WildzMarketOffers} from './WildzMarketCommunity';
import {WildzMarketAssetInsights,WildzMarketTradeHistory} from './WildzMarketInsights';
import {initialMarketDiscovery} from './wildz-market-discovery';

type Tab='browse'|'sell'|'activity';
const empty:WildzMarketSnapshotV128={status:'unavailable',message:'Connect your Receiz ID to browse and trade.',listings:[],purchases:[],sellables:[]};
const phaseLabels:Record<WildzMarketPurchasePhaseV128,string>={
 review:'Review purchase','awaiting-approvals':'Awaiting approval','payment-pending':'Checking payment',
 paid:'Payment confirmed · delivery pending','awaiting-acceptance':'Delivery ready to accept',
 received:'Asset received · refresh pending',completed:'Purchase complete','review-required':'Review updated terms',failed:'Needs attention'
};
const handle=(value:string)=>`@${value.replace(/\.receiz\.id$/,'')}`;
const AssetIcon=({kind}:{kind:string})=>kind==='creature'?<Leaf size={21}/>:<Package size={21}/>;

function PurchaseCard({purchase,ownerHandle,disabled,onApprove,onResume,onAccept,onCancel,onReview}:{purchase:WildzMarketPurchaseReviewV128;ownerHandle:string;disabled:boolean;onApprove():void;onResume():void;onAccept():void;onCancel():void;onReview():void}){
 const seller=purchase.sellerHandle===ownerHandle,buyer=purchase.buyerHandle===ownerHandle;
 return <article className={styles.purchase} data-purchase-phase={purchase.phase}>
  <div className={styles.cardHeading}><span className={styles.icon} aria-hidden="true"><AssetIcon kind={purchase.kind}/></span><div><small>{seller?'Your sale':'Your purchase'}</small><h3>{purchase.title}</h3></div><span className={styles.badge}>{phaseLabels[purchase.phase]}</span></div>
  <ol className={styles.purchaseSteps} aria-label="Purchase progress">{['Review','Payment','Delivery'].map((label,index)=>{
   const step=purchase.phase==='completed'?3:['received','awaiting-acceptance','paid'].includes(purchase.phase)?2:purchase.phase==='payment-pending'?1:0;
   return <li key={label} data-complete={index<step||undefined} aria-current={index===step?'step':undefined}><span>{index+1}</span>{label}</li>;
  })}</ol>
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

function MarketIdentityControl({username,onImport}:{username:string;onImport(file:File):Promise<unknown>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 return <div className={styles.identityRow}><span>{username?handle(username):'Your local identity'}</span><label className={styles.identityImport} title="Open your Identity Seal" aria-disabled={busy}>
  <ScanLine size={18} aria-hidden="true"/><input type="file" accept=".svg,.png,image/svg+xml,image/png" aria-label="Open Identity Seal" disabled={busy} onChange={event=>{
   const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file||busy)return;
   setBusy(true);setError('');void onImport(file).catch(()=>{if(mounted.current)setError('This file could not be opened as a verified Identity Seal.');}).finally(()=>{if(mounted.current)setBusy(false);});
  }}/></label>{error?<p role="alert">{error}</p>:null}</div>;
}

export function WildzMarketSheet({service,connected,initialTab='browse',initialOfferId,onClose,identityControl}:{service:WildzMarketServiceV128|null;connected:boolean;initialTab?:Tab;initialOfferId?:string;onClose?:()=>void;identityControl?:{username:string;onImport(file:File):Promise<unknown>}}){
 const [tab,setTab]=useState<Tab>(initialOfferId?'activity':initialTab);
 const [discovery,setDiscovery]=useState(initialMarketDiscovery);
 const [mobileColumns,setMobileColumns]=useState<1|2>(2);
 const [detail,setDetail]=useState<{service:WildzMarketServiceV128;listingId?:string;assetId?:string;focusChart?:boolean}|null>(null);
 const [activityScope,setActivityScope]=useState<'all'|'purchases'|'sales'|'listings'|'offers'|'history'>(initialOfferId?'offers':'all');
 const scroll=useRef<HTMLDivElement>(null),exploreScroll=useRef(0);
 const warmup=useMemo(()=>service?getWildzMarketWarmup(service):null,[service]);
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
 const own=snapshot.listings.filter(item=>item.sellerHandle===service?.binding.ownerHandle&&(item.status==='active'||item.status==='reserved'||item.canCancel));
 const purchases=[...snapshot.purchases];
 if(review?.service===service&&!purchases.some(item=>item.purchaseId===review.value.purchaseId))purchases.unshift(review.value);
 const offers=snapshot.offers??[];
 const attention=purchases.filter(item=>item.phase!=='completed').length+offers.filter(item=>item.status==='pending'&&item.offer.ownerHandle===service?.binding.ownerHandle).length;
 const detailed=detail?.service===service?snapshot.listings.find(item=>item.listingId===detail.listingId):undefined;
 const history=snapshot.history??[],transfers=snapshot.transfers??[];
 const detailedCard=detail?.service===service?snapshot.collection?.find(card=>card.assetId===detail.assetId):undefined;
 const detailReady=Boolean(detailed||detailedCard);
 const visiblePurchases=purchases.filter(item=>activityScope==='all'||activityScope==='purchases'&&item.buyerHandle===service?.binding.ownerHandle||activityScope==='sales'&&item.sellerHandle===service?.binding.ownerHandle);
 const readVisibleValue=useCallback((assetId:string)=>service?.readValue?.(assetId),[service]);
 const changeTab=(next:Tab)=>{setTab(next);setDetail(null);scroll.current?.scrollTo({top:0});};
 useEffect(()=>{
  if(!initialOfferId)return;
  setTab('activity');setActivityScope('offers');setDetail(null);
 },[initialOfferId]);
 const focusedOfferVisible=offers.some(item=>item.offer.offerId===initialOfferId);
 useEffect(()=>{
  if(!focusedOfferVisible||tab!=='activity'||activityScope!=='offers')return;
  const node=Array.from(scroll.current?.querySelectorAll<HTMLElement>('[data-market-offer-id]')??[]).find(node=>node.dataset.marketOfferId===initialOfferId);
  node?.scrollIntoView({block:'center'});node?.focus({preventScroll:true});
 },[initialOfferId,focusedOfferVisible,tab,activityScope]);
 const openDetail=(listingId:string,focusChart=false)=>{if(service){exploreScroll.current=scroll.current?.scrollTop??0;setDetail({service,listingId,focusChart});scroll.current?.scrollTo({top:0});}};

 const backToListings=()=>{setDetail(null);window.requestAnimationFrame(()=>scroll.current?.scrollTo({top:exploreScroll.current}));};
 const openCardDetail=(assetId:string,focusChart=false)=>{if(service){exploreScroll.current=scroll.current?.scrollTop??0;setDetail({service,assetId,focusChart});scroll.current?.scrollTo({top:0});}};
 const scrollToChart=()=>{const panel=scroll.current?.querySelector<HTMLElement>('[aria-label="Live proof value"]');if(panel){panel.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}};
 useEffect(()=>{
  if(!detail?.focusChart||!detailReady)return;
  // Finish the card's initial heading focus before honoring the chart shortcut.
  const frame=window.requestAnimationFrame(scrollToChart);
  return()=>window.cancelAnimationFrame(frame);
 },[detail,detailReady]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if (!shouldRefreshWildzMarket(connected)) return;
  if(!service)return;
  let active=true;
  const unsubscribe=service.subscribe(next=>{if(active&&live.current.service===service)setView({service,snapshot:next});});
  void warmup?.ready().then(()=>{if(active&&live.current.service===service)setView({service,snapshot:service.snapshot()});}).catch(()=>{if(active)runtime.notice('Market could not refresh. Retry Refresh listings.',true);});
  return()=>{active=false;unsubscribe();warmup?.cancel();service.releaseValue?.();};
 },[service,connected,runtime,warmup]);

 const showResult=(result:WildzMarketResultV128|undefined)=>{if(result)runtime.notice(result.message,result.status==='failed');};
 const refresh=()=>{if(service)void runtime.run('Read market',()=>service.read()).then(next=>{if(next&&live.current.service===service){warmup?.update();setView({service,snapshot:next});}});};
 const preview=(listingId:string)=>{
  if(!service)return;
  void runtime.run('Review purchase',()=>service.previewPurchase(listingId)).then(next=>{if(next&&live.current.service===service){setReview({service,value:next});setDetail(null);setActivityScope('all');setTab('activity');scroll.current?.scrollTo({top:0});}});
 };
 const purchaseAction=(kind:'approvePurchase'|'resume'|'accept',purchaseId:string)=>{
  if(!service)return;
  void runtime.run(kind==='approvePurchase'?'Approve terms':kind==='accept'?'Accept delivery':'Resume purchase',()=>service[kind](purchaseId)).then(result=>{
   if(live.current.service!==service||!live.current.connected||!mounted.current)return;
   showResult(result);
   if(result?.status==='checkout'&&result.checkoutUrl){
    try{window.location.assign(validateWildzCardCheckoutUrlV128(result.checkoutUrl));}
    catch{runtime.notice('The hosted card checkout URL could not be opened. Resume this same purchase to check it.',true);}
   }
  });
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

 return <div className={`wildz-market-sheet ${styles.sheet}`} aria-label="Player market" onKeyDown={event=>{if(event.key==='Escape'&&(detailed||detailedCard)){event.stopPropagation();setDetail(null);}}}>
  <div className={styles.marketScroll} ref={scroll} data-market-scroll tabIndex={-1}>
   <div className={styles.backdrop} aria-hidden="true"><Image src="/images/market/forest-header.webp" alt="" fill sizes="100vw" priority/></div>
   <div className={styles.content}>
    <header className={styles.header}><button type="button" className={styles.backLink} onClick={()=>{if(onClose)onClose();else changeTab('browse');}}><ArrowLeft size={22}/>Back to world</button><div className={styles.brand}><Image src="/brand/wildz-wordmark.svg" alt="Wildz" width={320} height={64} style={{height:"auto"}}/><span>/</span><span>Market</span></div><button type="button" className={styles.account} aria-label="View your market activity" onClick={()=>changeTab('activity')}><UserRound size={23}/></button></header>
    {!detailed&&!detailedCard?<div className={styles.hero}><h2>{tab==='browse'?<>Find your legend.</>:tab==='sell'?<>Make room for<br/>new adventures.</>:<>Every trade.<br/>All in one place.</>}</h2><p>{tab==='browse'?'Creatures and resources. Yours to explore.':tab==='sell'?'Your creatures and resources. A new player’s next discovery.':'Your purchases, sales, offers and ownership history.'}</p></div>:null}
    {tab!=='browse'&&identityControl?<MarketIdentityControl {...identityControl}/>:null}
    {unavailable?<p className={styles.status} role="status">Connect your Receiz ID to browse and trade.</p>:null}
    {!unavailable&&(ui.message||snapshot.status==='unavailable'&&snapshot.message)?<p className={styles.status} role="status" data-error={ui.error||undefined}>{ui.message||snapshot.message}</p>:null}
    {tab==='browse'?detailed?<WildzMarketListingDetail listing={detailed} card={snapshot.collection?.find(card=>detailed.asset.kind==='creature'&&card.assetId===detailed.asset.assetId&&card.ownerHandle===detailed.sellerHandle)} ownerHandle={service?.binding.ownerHandle??''} busy={busy} unavailable={unavailable} onBack={backToListings} onReview={()=>preview(detailed.listingId)} onManage={()=>changeTab('activity')} onChart={scrollToChart}/>:detailedCard?<WildzMarketOwnedDetail card={detailedCard} service={service} busy={busy||unavailable} onBack={backToListings} onChart={scrollToChart} onOffer={async request=>{if(!service?.makeOffer)return;const result=await runtime.run('Send offer',()=>service.makeOffer!(request));showResult(result);return result;}}/>:null:null}
    <div hidden={tab!=='browse'||detailReady}>
     <WildzMarketDiscovery active={tab==='browse'&&!detailReady} cardPreparer={warmup?.preparer} mobileColumns={mobileColumns} onMobileColumnsChange={setMobileColumns} listings={active} collection={snapshot.collection} onReadValue={readVisibleValue} onViewCard={openCardDetail} selection={discovery} onChange={setDiscovery} onView={openDetail} loading={snapshot.status==='loading'||ui.busy==='Read market'} onRefresh={refresh} refreshing={busy} refreshDisabled={unavailable}/>
     {attention?<button type="button" className={styles.activityLink} onClick={()=>changeTab('activity')}>{attention} trade{attention===1?'':'s'} to review or resume<ArrowRight size={18}/></button>:null}
     {snapshot.collectionMessage?<p className={styles.note} role="status">{snapshot.collectionMessage}</p>:null}
     {held?<button type="button" className={styles.activityLink} onClick={()=>changeTab('sell')}>Check pending listing · {held.title}</button>:null}
    </div>
  {tab==='browse'&&detailedCard?<WildzMarketAssetInsights key={detailedCard.assetId} assetId={detailedCard.assetId} proofDigest={detailedCard.proofDigest} service={service} sales={history} transfers={transfers}/>:null}
  {tab==='browse'&&detailed?.asset.kind==='creature'?<WildzMarketAssetInsights key={detailed.asset.assetId} assetId={detailed.asset.assetId} proofDigest={snapshot.collection?.find(c=>detailed.asset.kind==='creature'&&c.assetId===detailed.asset.assetId)?.proofDigest??''} service={service} sales={history} transfers={transfers}/>:null}
  {tab==='sell'?<section aria-label="Sell an asset" className={styles.stack}>
   <div className={styles.sectionHeading}><h3>Choose what to list</h3><span>From your wallet</span></div>
   {snapshot.sellables.length||held?<div className={styles.sellLayout}><div className={styles.sellForm}>
    <label className={styles.field}>Asset<select value={held?held.request.attemptId:selected?.id??''} disabled={unavailable||busy||Boolean(held)} onChange={event=>{if(service)setSelection({service,id:event.target.value});}}>{held?<option value={held.request.attemptId}>{held.title}</option>:snapshot.sellables.map(item=><option key={item.id} value={item.id} disabled={Boolean(item.disabledReason)}>{item.title}{item.disabledReason?` · ${item.disabledReason}`:''}</option>)}</select></label>
    <div className={`wildz-market-consequence ${styles.selection}`}><span className={styles.icon} aria-hidden="true"><AssetIcon kind={held?.request.asset.kind??selected?.kind??'package'}/></span><div><strong>{held?.title??selected?.title}</strong><p>{held?.summary??selected?.summary}</p></div></div>
    <label className={styles.field}>Price in USD<div className={styles.priceInput}><span aria-hidden="true">$</span><input aria-label="Price in USD" inputMode="decimal" autoComplete="off" placeholder="0.00" value={held?formatWildsUsdCents(held.request.priceUsdCents).replace(/[$,]/g,''):priceText} disabled={unavailable||busy||Boolean(held)} onChange={event=>{if(service)setPrice({service,value:event.target.value});}}/></div></label>
    {!held&&parsedCents&&!cents?<p className={styles.note}>Maximum listing price is $10,000,000.00.</p>:null}
    <p className={styles.note}>This selection is listed together. You approve the named buyer and exact payment before the sale proceeds.</p>
    {held?<p className={styles.note}>The listing response is pending. Check this same listing to continue.</p>:null}
    <button type="button" className={styles.primary} disabled={unavailable||busy||!held&&(!cents||!selected||Boolean(selected.disabledReason))} onClick={list}>{busy&&ui.busy!=='Read market'?'Checking…':held?'Check listing':`List${cents?` for ${formatWildsUsdCents(cents)}`:' asset'}`}</button>
   </div><aside className={styles.sellPreview} aria-label="Listing preview"><MarketArtwork kind={held?.request.asset.kind??selected?.kind??'package'} large/><div><small>Listing preview · collection artwork</small><h3>{held?.title??selected?.title}</h3><p>{handle(service?.binding.ownerHandle??'')}</p><strong>{held?formatWildsUsdCents(held.request.priceUsdCents):cents?formatWildsUsdCents(cents):'Set your price'}</strong></div></aside></div>:<div className={styles.empty}><Package size={32}/><h3>Ready for your next listing</h3><p>Available creatures and resource packages appear here after your wallet is ready.</p></div>}
  </section>:null}
  {tab==='activity'?<section aria-label="Market activity" className={styles.stack}>
   <nav className={styles.activityFilters} aria-label="Activity filters">{(['all','purchases','sales','listings','offers','history'] as const).map(scope=><button type="button" key={scope} aria-pressed={activityScope===scope} onClick={()=>setActivityScope(scope)}>{scope==='all'?'All activity':scope==='purchases'?'Purchases':scope==='sales'?'Sales':scope==='offers'?'Offers':scope==='history'?'History':'Listings'}</button>)}</nav>
   {activityScope==='offers'||activityScope==='all'&&offers.length>0?<WildzMarketOffers offers={offers} listings={snapshot.listings} owner={service?.binding.ownerHandle??''} busy={unavailable||busy} onReview={preview} onRespond={(id,outcome)=>{if(service?.respondToOffer)void runtime.run('Respond to offer',()=>service.respondToOffer!(id,outcome)).then(showResult);}}/>:null}
   {visiblePurchases.length?<><div className={styles.sectionHeading}><h3>Purchases and requests</h3></div><div className={styles.purchaseGrid}>{visiblePurchases.map(item=><PurchaseCard key={item.purchaseId} purchase={item} ownerHandle={service?.binding.ownerHandle??''} disabled={unavailable||busy} onApprove={()=>purchaseAction('approvePurchase',item.purchaseId)} onResume={()=>purchaseAction('resume',item.purchaseId)} onAccept={()=>purchaseAction('accept',item.purchaseId)} onReview={()=>preview(item.listingId)} onCancel={()=>{if(service)void runtime.run('Cancel purchase',()=>service.cancel(item.listingId)).then(showResult);}}/>)}</div></>:activityScope!=='listings'&&activityScope!=='offers'&&activityScope!=='history'?<div className={styles.empty}><Clock3 size={30}/><h3>Your trading story starts here</h3><p>Purchases and sales appear here as they move through review, payment and delivery.</p></div>:null}
   {activityScope==='history'?<>{service?.readHistory?<div className={styles.discoveryFooter}><span>Verified trades & ownership changes</span><button type="button" disabled={unavailable||busy} onClick={()=>{if(service?.readHistory)void runtime.run('Load older trades',()=>service.readHistory!()).then(next=>{if(next&&live.current.service===service)setView({service,snapshot:next});});}}>{ui.busy==='Load older trades'?'Checking receipts…':'Load older trades'}</button></div>:null}<WildzMarketTradeHistory sales={history.filter(s=>[s.buyerHandle,s.sellerHandle].includes(service?.binding.ownerHandle??''))} transfers={transfers.filter(t=>[t.fromHandle,t.toHandle].includes(service?.binding.ownerHandle??''))}/></>:null}
   {activityScope==='all'||activityScope==='listings'?<>
   <div className={styles.sectionHeading}><h3>Your listings</h3><span>{own.length} listing{own.length===1?'':'s'}</span></div>
   {own.length?own.map(item=><article className={styles.ownListing} key={item.listingId}>
    <span className={styles.icon} aria-hidden="true"><AssetIcon kind={item.kind}/></span>
    <div className={styles.ownListingDetails}><strong>{item.title}</strong><small>{item.status==='reserved'?'Reserved for a buyer':item.status==='cancelled'?'Purchase closed · withdrawal pending':item.canActivate?'Published · purchase connection pending':'Active listing'} · {formatWildsUsdCents(item.priceUsdCents)}</small></div>
    <div className={styles.ownListingActions} role="group" aria-label={`Listing actions · ${item.title}`}>
     {item.canActivate&&service?.activateListing?<button type="button" disabled={unavailable||busy} onClick={()=>{if(service?.activateListing)void runtime.run('Enable purchases',()=>service.activateListing!(item.listingId)).then(showResult);}}>Enable purchases</button>:null}
     {item.canCancel?<button type="button" disabled={unavailable||busy} onClick={()=>{if(service)void runtime.run('Cancel listing',()=>service.cancel(item.listingId)).then(showResult);}}>Cancel listing</button>:<span className={styles.badge}>Reserved</span>}
    </div>
   </article>):<p className={styles.empty}>Your active listings appear here. Purchases stay available to resume if a reply is delayed.</p>}
   </>:null}
  </section>:null}
   {tab!=='browse'?<p className={styles.footer}>Prices are in USD. Purchases use the exact Phi amount you review. If your wallet is short, card checkout adds funds to your wallet before purchase approval.</p>:null}
   {snapshot.message&&!unavailable?<details className={styles.marketStatus}><summary>Market status</summary><p>{snapshot.message}</p></details>:null}
   </div>
  </div>
  <nav className={styles.tabs} aria-label="Market views">{(['browse','sell','activity'] as const).map(item=><button type="button" key={item} aria-current={tab===item?'page':undefined} onClick={()=>changeTab(item)}>{item==='browse'?<Compass/>:item==='sell'?<Tag/>:<Clock3/>}<span>{item==='browse'?'Explore':item==='sell'?'Sell':'Activity'}</span>{item==='activity'&&attention?<span className={styles.attention}>{attention}</span>:null}</button>)}</nav>
 </div>;
}
