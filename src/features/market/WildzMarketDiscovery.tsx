"use client";

import Image from 'next/image';
import {WildzMarketCardPreview} from './WildzMarketCardPreview';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowDownRight,ArrowUpRight,ChevronRight,GalleryVertical,Grid2X2,Package,Search,SlidersHorizontal,X} from 'lucide-react';
import {formatWildzMarketValueChange} from './wildz-market-value';
import type {WildzMarketListingViewV128} from './wildz-market-service-v128';
import {discoverWildzMarketListings,type WildzMarketDiscovery as Discovery,type WildzMarketSort} from './wildz-market-discovery';
import {parseWildzMarketUsdInput} from './wildz-market-presentation';
import {formatWildsPhiExact,formatWildsUsdCents} from '../play/wallet/wilds-wallet-format';
import styles from './WildzMarketSheet.module.css';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import {discoverWildzOwnedCards} from './wildz-market-discovery';
import {sameWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';
import {createWildzMarketCardPreparer,wildzMarketCardImageUrl,wildzMarketCardKey,type PreparedWildzMarketCard} from './wildz-market-card-preparation';

export const marketHandle=(value:string)=>`@${value.replace(/\.receiz\.id$/,'')}`;
export const marketKind=(kind:string)=>kind==='creature'?'Creature':'Resource package';

export function CardValue({card,onChart,onVisible,compact=false}:{card:WildzMarketOwnedCard;onChart?():void;onVisible?(assetId:string):void;compact?:boolean}){
 const badge=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!onVisible||!badge.current)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();onVisible(card.assetId);}},{rootMargin:'80px'});
  observer.observe(badge.current);return()=>observer.disconnect();
 },[card.assetId,card.proofDigest,onVisible]);
 const bps=card.value?.changeBps,change=bps&&/^-?(?:0|[1-9][0-9]*)$/.test(bps)?BigInt(bps):null;
 return <button ref={badge} type="button" className={styles.tileValue} data-market-value-asset={card.assetId} title={card.valueUnavailable} aria-label={`View value chart · ${card.title}`} onClick={onChart}>{!compact?<span>Proof value</span>:null}<div><strong>{card.value?(card.value.displayUsdCents===null?`${formatWildsPhiExact(card.value.proofValuePhiMicro)} Φ`:formatWildsUsdCents(card.value.displayUsdCents)):(card.valueUnavailable?'Value unavailable':'—')}</strong>{change!==null?<small data-direction={change>0n?'up':change<0n?'down':'flat'} title="Change across the verified value chart window">{change>0n?<ArrowUpRight size={13}/>:change<0n?<ArrowDownRight size={13}/>:null}{formatWildzMarketValueChange(bps!)}</small>:null}</div></button>;
}

export function MarketArtwork({kind,large=false,priority=false}:{kind:string;large?:boolean;priority?:boolean}){
 if(kind==='creature')return null;
 return <Image src="/images/market/resource-collection.webp" alt="Wildz resource collection artwork" width={1024} height={1024} sizes={large?'(min-width: 1100px) 650px, (min-width: 760px) 60vw, 100vw':'(min-width: 760px) 240px, 100px'} priority={priority} className={styles.artwork}/>;
}

export function MarketCardArtwork({card,priority=false,onUnavailable}:{card:WildzMarketOwnedCard;priority?:boolean;onUnavailable?():void}){
 const [failed,setFailed]=useState(false);
 if(failed)return null;
 return <Image unoptimized loading="eager" src={wildzMarketCardImageUrl(card)} alt={`${card.title} · complete creature card`} width={750} height={1050} sizes="(min-width: 760px) 360px, 100vw" priority={priority} className={styles.cardArtwork} onError={()=>{setFailed(true);onUnavailable?.();}}/>;
}

function ListingCard({listing,featured,card,priority,onView,openOnTap=false}:{listing:WildzMarketListingViewV128;featured:boolean;card?:WildzMarketOwnedCard;priority:boolean;onView(chart?:boolean):void;openOnTap?:boolean}){
 const [unavailable,setUnavailable]=useState(false);
 if(unavailable||listing.kind==='creature'&&!card)return null;
 return <article className={featured?styles.featuredListing:styles.resourceListing} data-listing-id={listing.listingId}>
  {card?<CardValue card={card} onChart={()=>onView(true)}/>:null}
  <div className={`${styles.listingMedia}${card?` ${styles.completeCardMedia}`:''}`}>{card?<WildzMarketCardPreview key={wildzMarketCardKey(card)} card={card} onUnavailable={()=>setUnavailable(true)} openOnTap={openOnTap} onOpen={()=>onView()} front={<MarketCardArtwork card={card} priority={priority} onUnavailable={()=>setUnavailable(true)}/>}/>:<MarketArtwork kind={listing.kind} large={featured} priority={priority}/>}</div>
  <div className={styles.listingInfo}><div><h3>{listing.title}</h3><p>{marketHandle(listing.sellerHandle)}</p></div><strong>{formatWildsUsdCents(listing.priceUsdCents)}</strong></div>
  <button type="button" className={featured?styles.primary:styles.rowAction} aria-label={`View listing · ${listing.title}`} onClick={()=>onView()}>{featured?<><span>View listing</span><ChevronRight size={20}/></>:<ChevronRight size={22}/>}</button>
 </article>;
}

function OwnedCardTile({card,onView,openOnTap=false}:{card:WildzMarketOwnedCard;onView?(assetId:string,chart?:boolean):void;openOnTap?:boolean}){
 const [unavailable,setUnavailable]=useState(false);if(unavailable)return null;
 return <article className={styles.featuredListing}><CardValue card={card} onChart={()=>onView?.(card.assetId,true)}/><div className={`${styles.listingMedia} ${styles.completeCardMedia}`}><WildzMarketCardPreview key={wildzMarketCardKey(card)} card={card} onUnavailable={()=>setUnavailable(true)} openOnTap={openOnTap} onOpen={()=>onView?.(card.assetId)} front={<MarketCardArtwork card={card} onUnavailable={()=>setUnavailable(true)}/>}/></div><div className={styles.listingInfo}><div><h3>{card.title}</h3><p>{marketHandle(card.ownerHandle)}</p></div><span className={styles.badge}>Not listed</span></div><button type="button" className={styles.primary} onClick={()=>onView?.(card.assetId)} aria-label={`View creature · ${card.title}`}>View creature<ChevronRight size={20}/></button></article>;
}

export function WildzMarketDiscovery({listings,collection=[],selection,onChange:changeSelection,onView,onViewCard,onReadValue,loading,onRefresh,refreshing,refreshDisabled=false,mobileColumns:controlledColumns,onMobileColumnsChange}:{
 listings:readonly WildzMarketListingViewV128[];selection:Discovery;onChange(next:Discovery):void;onView(listingId:string,chart?:boolean):void;loading:boolean;onRefresh():void;refreshing:boolean;refreshDisabled?:boolean;
 mobileColumns?:1|2;onMobileColumnsChange?(columns:1|2):void;onReadValue?(assetId:string):void|Promise<unknown>;collection?:readonly WildzMarketOwnedCard[];onViewCard?(assetId:string,chart?:boolean):void;
}){
 const [limit,setLimit]=useState(24);
 const [localColumns,setLocalColumns]=useState<1|2>(2),[mobile,setMobile]=useState(false);
 const mobileColumns=controlledColumns??localColumns,setMobileColumns=onMobileColumnsChange??setLocalColumns;
 useEffect(()=>{const query=window.matchMedia('(max-width:759px)'),update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 const compact=mobile&&mobileColumns===2;
 const discoveryRoot=useRef<HTMLElement>(null),visibleValueAssets=useRef(new Set<string>());
 const [preparationRevision,setPreparationRevision]=useState(0);
 const onChange=(next:Discovery)=>{setLimit(24);changeSelection(next);};
 const [filtersOpen,setFiltersOpen]=useState(false),[priceText,setPriceText]=useState(()=>selection.maxPriceUsdCents?formatWildsUsdCents(selection.maxPriceUsdCents).replace(/[$,]/g,''):'');
 const results=discoverWildzMarketListings(listings,selection);
 const priceError=Boolean(priceText.trim()&&!parseWildzMarketUsdInput(priceText));
 const filtered=Boolean(selection.query||selection.category!=='all'||selection.maxPriceUsdCents||selection.availableOnly);
 const listingCard=(listing:WildzMarketListingViewV128)=>collection.find(card=>listing.asset.kind==='creature'&&card.assetId===listing.asset.assetId&&sameWildzPlayerCoordinate(card.ownerHandle,listing.sellerHandle));
 const admittedResults=results.filter(listing=>listing.kind!=='creature'||Boolean(listingCard(listing)));
 const creatures=admittedResults.filter(item=>item.kind==='creature'),resources=admittedResults.filter(item=>item.kind!=='creature');
 // Preserve the selected ordering when the player sorts rather than featuring creatures.
 const ordered=selection.sort==='featured'?[...creatures,...resources]:admittedResults;
 const unlisted=discoverWildzOwnedCards(collection,listings,selection);
 const visibleListings=ordered.slice(0,limit),visibleUnlisted=unlisted.slice(0,Math.max(0,limit-visibleListings.length));
 const pageCards=[...visibleListings.flatMap(listing=>{const card=listingCard(listing);return card?[card]:[];}),...visibleUnlisted];
 // Only exact card identity changes restart preparation. Value reads update the
 // collection while this effect is pending; those updates must remain visible.
 const pageIdentity=`${preparationRevision}:${pageCards.map(wildzMarketCardKey).join('|')}`,latestPageCards=useRef(pageCards);latestPageCards.current=pageCards;
 const preparer=useMemo(()=>createWildzMarketCardPreparer({readValue:onReadValue}),[onReadValue]);
 const [prepared,setPrepared]=useState<{identity:string;preparer:typeof preparer;cards:ReadonlyMap<string,PreparedWildzMarketCard>}|null>(null);
 useEffect(()=>{
  if(!latestPageCards.current.length)return;
  const controller=new AbortController();
  void preparer.prepare(latestPageCards.current,controller.signal).then(cards=>{if(!controller.signal.aborted)setPrepared({identity:pageIdentity,preparer,cards:new Map(cards.map(card=>[card.key,card]))});}).catch(()=>{if(!controller.signal.aborted)setPrepared({identity:pageIdentity,preparer,cards:new Map()});});
  return()=>controller.abort();
 },[pageIdentity,preparer]);
 const preparing=Boolean(pageCards.length&&(prepared?.identity!==pageIdentity||prepared.preparer!==preparer));
 const readyCard=(card:WildzMarketOwnedCard|undefined)=>{if(!card)return undefined;const held=prepared?.cards.get(wildzMarketCardKey(card));return held?{...card,asset:held.card.asset}:undefined;};
 const shownListings=preparing?[]:visibleListings.filter(listing=>listing.kind!=='creature'||Boolean(readyCard(listingCard(listing))));
 const shownUnlisted=preparing?[]:visibleUnlisted.flatMap(card=>{const ready=readyCard(card);return ready?[ready]:[];});
 const readyAssetIds=useRef<string[]>([]);readyAssetIds.current=pageCards.filter(card=>!preparing&&readyCard(card)).map(card=>card.assetId);
 useEffect(()=>{
  visibleValueAssets.current.clear();if(preparing||!discoveryRoot.current)return;
  const intersections=new Map<Element,{assetId:string;visible:boolean}>();
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){const assetId=(entry.target as HTMLElement).dataset.marketValueAsset;if(assetId)intersections.set(entry.target,{assetId,visible:entry.isIntersecting});}
   visibleValueAssets.current=new Set([...intersections.values()].flatMap(entry=>entry.visible?[entry.assetId]:[]));
  });
  discoveryRoot.current.querySelectorAll('[data-market-value-asset]').forEach(badge=>observer.observe(badge));
  return()=>{observer.disconnect();visibleValueAssets.current.clear();};
 },[pageIdentity,preparing]);
 useEffect(()=>{
  if(preparing||!onReadValue)return;
  let active=true,reading=false;
  const timer=window.setInterval(()=>{
   if(!active||reading||document.visibilityState!=='visible')return;
   reading=true;const ids=[...new Set(readyAssetIds.current)].filter(id=>visibleValueAssets.current.has(id));let next=0;
   void Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{
    while(active&&next<ids.length){const assetId=ids[next++]!;try{await onReadValue(assetId);}catch{/* Keep the previous local value until a later pulse. */}}
   })).finally(()=>{reading=false;});
  },5500);
  return()=>{active=false;window.clearInterval(timer);};
 },[onReadValue,pageIdentity,preparing]);
 const omitted=preparing?0:pageCards.filter(card=>!readyCard(card)).length,total=ordered.length+unlisted.length-omitted;
 return <section ref={discoveryRoot} aria-label="Market listings" className={styles.discovery}>
  <div className={styles.searchRow}><label className={styles.search}><Search size={23} aria-hidden="true"/><input type="search" aria-label="Search the market" placeholder="Search the market" value={selection.query} onChange={event=>onChange({...selection,query:event.target.value})}/>{selection.query?<button type="button" aria-label="Clear search" onClick={()=>onChange({...selection,query:''})}><X size={18}/></button>:null}</label><button type="button" className={styles.filterToggle} aria-label="Market filters" aria-expanded={filtersOpen} aria-controls="wildz-market-filters" onClick={()=>setFiltersOpen(value=>!value)}><SlidersHorizontal size={24}/>{selection.maxPriceUsdCents||selection.availableOnly?<span className={styles.filterDot}/>:null}</button></div>
  {filtersOpen?<div id="wildz-market-filters" className={styles.filters}><label className={styles.field}>Maximum price in USD<div className={styles.priceInput}><span>$</span><input aria-label="Maximum price in USD" inputMode="decimal" placeholder="Any price" value={priceText} aria-invalid={priceError||undefined} onChange={event=>{setPriceText(event.target.value);onChange({...selection,maxPriceUsdCents:parseWildzMarketUsdInput(event.target.value)});}}/></div></label><label className={styles.checkbox}><input type="checkbox" checked={selection.availableOnly} onChange={event=>onChange({...selection,availableOnly:event.target.checked})}/>Available to purchase</label>{priceError?<p className={styles.note}>Enter a positive USD amount with up to two decimal places.</p>:null}<button type="button" onClick={()=>{setPriceText('');onChange({...selection,maxPriceUsdCents:null,availableOnly:false});}}>Reset filters</button></div>:null}
  <div className={styles.browseControls}><nav className={styles.categories} aria-label="Listing categories">{(['all','creatures','resources'] as const).map(category=><button type="button" key={category} aria-pressed={selection.category===category} onClick={()=>onChange({...selection,category})}>{category==='all'?'All':category==='creatures'?'Creatures':'Resources'}</button>)}</nav><div className={styles.layoutChoices} role="group" aria-label="Mobile card view"><button type="button" aria-label="Two-column view" aria-pressed={mobileColumns===2} title="Two-column view" onClick={()=>setMobileColumns(2)}><Grid2X2 size={17}/></button><button type="button" aria-label="Single-column view" aria-pressed={mobileColumns===1} title="Single-column view" onClick={()=>setMobileColumns(1)}><GalleryVertical size={17}/></button></div></div>
  <div className={styles.sectionHeading}><h3>Explore listings</h3><label className={styles.sort}><span className={styles.srOnly}>Sort listings</span><select aria-label="Sort listings" value={selection.sort} onChange={event=>onChange({...selection,sort:event.target.value as WildzMarketSort})}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></label></div>
  {preparing?<div className={styles.empty} role="status" aria-live="polite"><h3>Preparing cards…</h3></div>:shownListings.length||shownUnlisted.length?<div className={styles.listingGrid} data-mobile-columns={mobileColumns}>{shownListings.map((listing,index)=>{const card=readyCard(listingCard(listing));return <ListingCard key={`${listing.listingId}:${card?wildzMarketCardKey(card):'resource'}`} listing={listing} card={card} priority={index===0} featured={listing.kind==='creature'} openOnTap={compact} onView={chart=>onView(listing.listingId,chart)}/>;})}{shownUnlisted.map(card=><OwnedCardTile key={wildzMarketCardKey(card)} card={card} openOnTap={compact} onView={onViewCard}/>)}</div>:<div className={styles.empty}><Package size={32} aria-hidden="true"/><h3>{loading?'Checking listings…':filtered?'No matching cards':'Your next discovery starts here'}</h3><p>{filtered?'Try another search or adjust your filters.':'Publicly shared, owned creatures and resource listings appear here.'}</p>{filtered?<button type="button" onClick={()=>{setPriceText('');onChange({query:'',category:'all',sort:'featured',maxPriceUsdCents:null,availableOnly:false});}}>Clear search and filters</button>:null}</div>}
  {ordered.length+unlisted.length>limit?<button type="button" className={styles.loadMore} onClick={()=>setLimit(n=>n+24)}>Explore more cards</button>:null}
  <div className={styles.discoveryFooter}><span>{total} card{total===1?'':'s'}{filtered?' match your search':''}</span><button type="button" disabled={refreshing||refreshDisabled} onClick={()=>{setPreparationRevision(revision=>revision+1);onRefresh();}}>{refreshing?'Refreshing…':'Refresh listings'}</button></div>
 </section>;
}

export function WildzMarketListingDetail({listing,card,ownerHandle,busy,unavailable,onBack,onReview,onManage,onChart}:{listing:WildzMarketListingViewV128;card?:WildzMarketOwnedCard;ownerHandle:string;busy:boolean;unavailable:boolean;onBack():void;onReview():void;onManage():void;onChart():void}){
 const heading=useRef<HTMLHeadingElement>(null);
 const own=listing.sellerHandle===ownerHandle;
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[listing.listingId]);
 const asset=listing.asset;
 return <section className={styles.detail} aria-label="Listing details">
  <div className={styles.detailNav}><button type="button" className={styles.backLink} onClick={onBack}><ArrowLeft size={19}/>Back to listings</button>{card?<CardValue card={card} onChart={onChart} compact/>:null}</div>
  <div className={styles.detailLayout}><div className={styles.detailMedia}>{card?<WildzMarketCardPreview key={wildzMarketCardKey(card)} card={card} full front={<MarketCardArtwork card={card}/>}/>:<MarketArtwork kind={listing.kind} large/>}{!card&&listing.kind!=='creature'?<p className={styles.artCaption}>Collection artwork</p>:null}</div><div className={styles.detailBody}>
   <span className={styles.kindLabel}>{marketKind(listing.kind)}</span><h2 tabIndex={-1} ref={heading}>{listing.title}</h2><p className={styles.seller}>Listed by <strong>{marketHandle(listing.sellerHandle)}</strong></p>
   <dl className={styles.detailFacts}><div><dt>Asset type</dt><dd>{marketKind(listing.kind)}</dd></div><div><dt>Listing status</dt><dd>{listing.status==='active'?'Active':listing.status==='reserved'?'Reserved':listing.status==='sold'?'Sold':'Closed'}</dd></div>{asset.kind==='inventory'?<><div><dt>Food items</dt><dd>{asset.foodItemIds.length}</dd></div><div><dt>Material lots</dt><dd>{asset.materialLotIds.length}</dd></div><div><dt>Resource lots</dt><dd>{asset.resourceLotIds.length}</dd></div></>:<div><dt>Quantity</dt><dd>{asset.kind==='creature'?'One creature':'One complete package'}</dd></div>}</dl>
   <details className={styles.provenance}><summary>Asset & listing references</summary><dl><div><dt>Listing ID</dt><dd>{listing.listingId}</dd></div>{asset.kind==='creature'||asset.kind==='package'?<div><dt>{asset.kind==='creature'?'Creature ID':'Package ID'}</dt><dd>{asset.kind==='creature'?asset.assetId:asset.packageId}</dd></div>:null}</dl><p>Collection artwork represents the asset category. The references above identify this exact listing.</p></details>
   <div className={styles.purchaseDock}><span>Listed price</span><strong>{formatWildsUsdCents(listing.priceUsdCents)} <small>USD</small></strong><p>Exact Phi shown before approval</p>{own?<button type="button" className={styles.primary} onClick={onManage}>Manage your listing<ArrowRight size={20}/></button>:<button type="button" className={styles.primary} disabled={busy||unavailable||!listing.canBuy||listing.status!=='active'} onClick={onReview}>{busy?'Preparing review…':'Review purchase'}<ArrowRight size={20}/></button>}{!own&&!listing.canBuy?<p className={styles.connectionNote}>Purchase connection pending. The seller needs to enable purchases for this listing.</p>:null}<p className={styles.dockNote}>Wallet payment · Card funding available</p></div>
   <details className={styles.provenance}><summary>Purchase & delivery</summary><p>Review the named buyer, seller and exact Phi amount before approving. Both players approve the terms. Payment and delivery complete in separate steps.</p><p>If your wallet is short, card checkout adds funds before purchase approval. Your activity keeps the same purchase available to resume.</p></details>
  </div></div>
 </section>;
}
