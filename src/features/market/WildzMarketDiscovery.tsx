"use client";

import Image from 'next/image';
import {WildzMarketGalleryPage,wildzMarketGalleryLookahead} from './WildzMarketGalleryPage';
import {WILDZ_MARKET_PAGE_SIZE} from './wildz-market-warmup';
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
import {discoverWildzOwnedCards,wildzMarketRarityOptions,wildzMarketCardRarity,compareWildzMarketRarity} from './wildz-market-discovery';
import {sameWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';
import {createWildzMarketCardPreparer,wildzMarketCardImageUrl,wildzMarketCardKey} from './wildz-market-card-preparation';
import {createWildzMarketRarityIndex} from './wildz-market-rarity-index';

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

export function WildzMarketDiscovery({listings,collection=[],selection,onChange:changeSelection,onView,onViewCard,onReadValue,loading,onRefresh,refreshing,refreshDisabled=false,mobileColumns:controlledColumns,onMobileColumnsChange,active=true,cardPreparer}:{
 listings:readonly WildzMarketListingViewV128[];selection:Discovery;onChange(next:Discovery):void;onView(listingId:string,chart?:boolean):void;loading:boolean;onRefresh():void;refreshing:boolean;refreshDisabled?:boolean;
 active?:boolean;cardPreparer?:ReturnType<typeof createWildzMarketCardPreparer>;mobileColumns?:1|2;onMobileColumnsChange?(columns:1|2):void;onReadValue?(assetId:string):void|Promise<unknown>;collection?:readonly WildzMarketOwnedCard[];onViewCard?(assetId:string,chart?:boolean):void;
}){
 const [limit,setLimit]=useState(WILDZ_MARKET_PAGE_SIZE);
 const [localColumns,setLocalColumns]=useState<1|2>(2),[mobile,setMobile]=useState(false);
 const mobileColumns=controlledColumns??localColumns,setMobileColumns=onMobileColumnsChange??setLocalColumns;
 useEffect(()=>{const query=window.matchMedia('(max-width:759px)'),update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 const compact=mobile&&mobileColumns===2;
 const discoveryRoot=useRef<HTMLElement>(null);
 const [preparationRevision,setPreparationRevision]=useState(0);
 const onChange=(next:Discovery)=>{setLimit(WILDZ_MARKET_PAGE_SIZE);changeSelection(next);};
 const [filtersOpen,setFiltersOpen]=useState(false),[priceText,setPriceText]=useState(()=>selection.maxPriceUsdCents?formatWildsUsdCents(selection.maxPriceUsdCents).replace(/[$,]/g,''):'');
 const latestCollection=useRef(collection);latestCollection.current=collection;
 const collectionIdentity=collection.map(wildzMarketCardKey).join('|');
 // An explicit refresh retries failed reads; ordinary live value updates keep
 // the same exact-revision index and must not restart catalogue work.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 const rarityIndex=useMemo(()=>createWildzMarketRarityIndex(),[preparationRevision]);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 const initialMetadata=useMemo(()=>rarityIndex.snapshot(latestCollection.current),[collectionIdentity,rarityIndex]);
 const [indexedMetadata,setIndexedMetadata]=useState(()=>({identity:collectionIdentity,revision:preparationRevision,snapshot:initialMetadata}));
 const rarityMetadata=indexedMetadata.identity===collectionIdentity&&indexedMetadata.revision===preparationRevision?indexedMetadata.snapshot:initialMetadata;
 const resolveRarity=(card:WildzMarketOwnedCard|undefined)=>card?(rarityMetadata.rarities.has(wildzMarketCardKey(card))?rarityMetadata.rarities.get(wildzMarketCardKey(card))??null:wildzMarketCardRarity(card)):null;
 // Unknown legacy revisions must be scanned before a rarity filter, search or
 // ordering can claim a complete result. Artwork never determines admission.
 const indexing=!rarityMetadata.complete&&Boolean(selection.rarity&&selection.rarity!=='all'||selection.sort==='rarity-high'||selection.sort==='rarity-low'||selection.query.trim());
 const results=discoverWildzMarketListings(listings,selection,collection,resolveRarity);
 const priceError=Boolean(priceText.trim()&&!parseWildzMarketUsdInput(priceText));
 const filtered=Boolean(selection.query||selection.category!=='all'||selection.maxPriceUsdCents||selection.availableOnly||selection.rarity&&selection.rarity!=='all');
 const listingCard=(listing:WildzMarketListingViewV128)=>collection.find(card=>listing.asset.kind==='creature'&&card.assetId===listing.asset.assetId&&sameWildzPlayerCoordinate(card.ownerHandle,listing.sellerHandle));
 const admittedResults=results.filter(listing=>listing.kind!=='creature'||Boolean(listingCard(listing)));
 const creatures=admittedResults.filter(item=>item.kind==='creature'),resources=admittedResults.filter(item=>item.kind!=='creature');
 // Preserve the selected ordering when the player sorts rather than featuring creatures.
 const ordered=selection.sort==='featured'?[...creatures,...resources]:admittedResults;
 const unlisted=discoverWildzOwnedCards(collection,listings,selection,resolveRarity);
 const entries:{listing?:WildzMarketListingViewV128;card?:WildzMarketOwnedCard}[]=[...ordered.map(listing=>({listing,card:listingCard(listing)})),...unlisted.map(card=>({card}))];
 if(selection.sort==='rarity-high'||selection.sort==='rarity-low')entries.sort((a,b)=>compareWildzMarketRarity(resolveRarity(a.card),resolveRarity(b.card),selection.sort as 'rarity-high'|'rarity-low')||(a.card?.title??a.listing!.title).localeCompare(b.card?.title??b.listing!.title));
 const pageEntries=indexing?[]:entries.slice(0,limit),visibleListings=pageEntries.flatMap(entry=>entry.listing?[entry.listing]:[]),visibleUnlisted=pageEntries.flatMap(entry=>!entry.listing&&entry.card?[entry.card]:[]);
 const pageCards=[...visibleListings.flatMap(listing=>{const card=listingCard(listing);return card?[card]:[];}),...visibleUnlisted];
 // Only exact card identity changes restart preparation. Value reads update the
 // collection while this effect is pending; those updates must remain visible.
 const pageIdentity=`${preparationRevision}:${pageCards.map(wildzMarketCardKey).join('|')}`,latestPageCards=useRef(pageCards);latestPageCards.current=pageCards;
 const preparer=useMemo(()=>cardPreparer??createWildzMarketCardPreparer({readValue:onReadValue}),[cardPreparer,onReadValue]);
 const attempted=useRef(new Set<string>());
 const [prepared,setPrepared]=useState<{identity:string;preparer:typeof preparer;cards:ReadonlySet<string>}>(()=>({identity:preparer.peek(pageCards).size===pageCards.length?pageIdentity:'',preparer,cards:new Set(preparer.peek(pageCards).keys())}));
 useEffect(()=>{
  if(!active||!latestPageCards.current.length)return;
  const controller=new AbortController();
  const pending=latestPageCards.current.filter(card=>!attempted.current.has(wildzMarketCardKey(card)));
  void preparer.prepare(pending,controller.signal).then(cards=>{if(!controller.signal.aborted){pending.forEach(card=>attempted.current.add(wildzMarketCardKey(card)));setPrepared(previous=>({identity:pageIdentity,preparer,cards:new Set([...previous.cards,...cards.map(card=>card.key)])}));}}).catch(()=>{if(!controller.signal.aborted)setPrepared(previous=>({...previous,identity:pageIdentity,preparer}));});
  return()=>controller.abort();
 },[pageIdentity,preparer,active]);
 useEffect(()=>{
  const keys=new Set(latestCollection.current.map(wildzMarketCardKey));
  for(const key of attempted.current)if(!keys.has(key))attempted.current.delete(key);
  setPrepared(previous=>[...previous.cards].every(key=>keys.has(key))?previous:{...previous,cards:new Set([...previous.cards].filter(key=>keys.has(key)))});
 },[collectionIdentity]);
 const preparing=Boolean(pageCards.length&&(prepared?.identity!==pageIdentity||prepared.preparer!==preparer));
 // First-screen image/value preparation gets the available work budget first.
 // Catalogue hashing starts only after that page is ready, then yields in batches.
 useEffect(()=>{
  if(!active||preparing||rarityMetadata.complete)return;
  const controller=new AbortController();
  void rarityIndex.scan(latestCollection.current,controller.signal).then(snapshot=>{if(!controller.signal.aborted)setIndexedMetadata({identity:collectionIdentity,revision:preparationRevision,snapshot});}).catch(()=>{/* cancellation leaves the catalogue pending until its next active scan */});
  return()=>controller.abort();
 },[active,preparing,collectionIdentity,rarityIndex,preparationRevision,rarityMetadata.complete]);
 const readyCard=(card:WildzMarketOwnedCard|undefined)=>{if(!card)return undefined;return prepared.cards.has(wildzMarketCardKey(card))?card:undefined;};
 // Prepare two full groups ahead without mounting their image/flipper nodes.
 // The visible page publishes independently, so this never delays its six cards.
 const aheadCards=(indexing?[]:wildzMarketGalleryLookahead(entries,limit)).flatMap(entry=>entry.card?[entry.card]:[]);
 const aheadIdentity=`${preparationRevision}:${aheadCards.map(wildzMarketCardKey).join('|')}`,latestAheadCards=useRef(aheadCards);latestAheadCards.current=aheadCards;
 const aheadReady=aheadCards.every(card=>attempted.current.has(wildzMarketCardKey(card))||prepared.cards.has(wildzMarketCardKey(card)));
 useEffect(()=>{
  if(!active||preparing||indexing||!latestAheadCards.current.length)return;
  const controller=new AbortController(),pending=latestAheadCards.current.filter(card=>!attempted.current.has(wildzMarketCardKey(card)));
  if(!pending.length)return;
  void preparer.prepare(pending,controller.signal).then(cards=>{if(!controller.signal.aborted){pending.forEach(card=>attempted.current.add(wildzMarketCardKey(card)));setPrepared(previous=>({...previous,cards:new Set([...previous.cards,...cards.map(card=>card.key)])}));}}).catch(()=>{/* a cancelled lookahead resumes from the exact cache next time */});
  return()=>controller.abort();
 },[active,preparing,indexing,aheadIdentity,preparer]);
 const firstPreparing=preparing&&!prepared.cards.size;
 const shownListings=firstPreparing?[]:visibleListings.filter(listing=>listing.kind!=='creature'||Boolean(readyCard(listingCard(listing))));
 const shownUnlisted=firstPreparing?[]:visibleUnlisted.flatMap(card=>{const ready=readyCard(card);return ready?[ready]:[];});
 const loadSentinel=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!active||preparing||indexing||!aheadReady||!loadSentinel.current||limit>=ordered.length+unlisted.length)return;
  const root=loadSentinel.current.closest('[data-market-scroll]');
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();setLimit(n=>n+WILDZ_MARKET_PAGE_SIZE);}},{root,rootMargin:`${Math.max(2200,2*(root?.clientHeight??0))}px 0px`});
  observer.observe(loadSentinel.current);return()=>observer.disconnect();
 },[active,preparing,indexing,aheadReady,limit,ordered.length,unlisted.length]);
 useEffect(()=>{
  if(!active||!onReadValue)return;
  let reading=false,cancelled=false;
  const timer=window.setInterval(()=>{
   if(cancelled||reading||document.visibilityState!=='visible'||!discoveryRoot.current)return;
   const root=discoveryRoot.current.closest('[data-market-scroll]')?.getBoundingClientRect();if(!root)return;
   const ids=[...new Set(Array.from(discoveryRoot.current.querySelectorAll<HTMLElement>('[data-market-value-asset]')).flatMap(badge=>{const rect=badge.getBoundingClientRect();return rect.bottom>root.top&&rect.top<root.bottom?[badge.dataset.marketValueAsset!]:[];}))];
   reading=true;let next=0;
   void Promise.all(Array.from({length:Math.min(2,ids.length)},async()=>{while(!cancelled&&next<ids.length){try{await onReadValue(ids[next++]!);}catch{/* retain the previous pulse */}}})).finally(()=>{reading=false;});
  },5500);
  return()=>{cancelled=true;window.clearInterval(timer);};
 },[active,onReadValue]);
 const omitted=preparing?0:pageCards.filter(card=>!readyCard(card)).length,total=ordered.length+unlisted.length-omitted;
 const tiles=pageEntries.flatMap((entry,index)=>{
  const card=readyCard(entry.card);
  if(entry.listing){if(entry.listing.kind==='creature'&&!card)return [];return [<ListingCard key={`${entry.listing.listingId}:${card?wildzMarketCardKey(card):'resource'}`} listing={entry.listing} card={card} priority={index===0} featured={entry.listing.kind==='creature'} openOnTap={compact} onView={chart=>onView(entry.listing!.listingId,chart)}/>];}
  return card?[<OwnedCardTile key={wildzMarketCardKey(card)} card={card} openOnTap={compact} onView={onViewCard}/>]:[];
 });
 return <section ref={discoveryRoot} aria-label="Market listings" className={styles.discovery}>
  <div className={styles.searchRow}><label className={styles.search}><Search size={23} aria-hidden="true"/><input type="search" aria-label="Search the market" placeholder="Search the market" value={selection.query} onChange={event=>onChange({...selection,query:event.target.value})}/>{selection.query?<button type="button" aria-label="Clear search" onClick={()=>onChange({...selection,query:''})}><X size={18}/></button>:null}</label><button type="button" className={styles.filterToggle} aria-label="Market filters" aria-expanded={filtersOpen} aria-controls="wildz-market-filters" onClick={()=>setFiltersOpen(value=>!value)}><SlidersHorizontal size={24}/>{selection.maxPriceUsdCents||selection.availableOnly||selection.rarity&&selection.rarity!=='all'?<span className={styles.filterDot}/>:null}</button></div>
  {filtersOpen?<div id="wildz-market-filters" className={styles.filters}><label className={styles.field}>Maximum price in USD<div className={styles.priceInput}><span>$</span><input aria-label="Maximum price in USD" inputMode="decimal" placeholder="Any price" value={priceText} aria-invalid={priceError||undefined} onChange={event=>{setPriceText(event.target.value);onChange({...selection,maxPriceUsdCents:parseWildzMarketUsdInput(event.target.value)});}}/></div></label><label className={styles.field}>Rarity<select aria-label="Filter by rarity" value={selection.rarity??'all'} onChange={event=>onChange({...selection,rarity:event.target.value as typeof selection.rarity})}><option value="all">All rarities</option>{wildzMarketRarityOptions.filter(rarity=>rarity!=='all').map(rarity=><option key={rarity} value={rarity}>{rarity.charAt(0).toUpperCase()+rarity.slice(1)}</option>)}</select></label><label className={styles.checkbox}><input type="checkbox" checked={selection.availableOnly} onChange={event=>onChange({...selection,availableOnly:event.target.checked})}/>Available to purchase</label>{priceError?<p className={styles.note}>Enter a positive USD amount with up to two decimal places.</p>:null}<button type="button" onClick={()=>{setPriceText('');onChange({...selection,maxPriceUsdCents:null,availableOnly:false,rarity:'all'});}}>Reset filters</button></div>:null}
  <div className={styles.browseControls}><nav className={styles.categories} aria-label="Listing categories">{(['all','creatures','resources'] as const).map(category=><button type="button" key={category} aria-pressed={selection.category===category} onClick={()=>onChange({...selection,category})}>{category==='all'?'All':category==='creatures'?'Creatures':'Resources'}</button>)}</nav><div className={styles.layoutChoices} role="group" aria-label="Mobile card view"><button type="button" aria-label="Two-column view" aria-pressed={mobileColumns===2} title="Two-column view" onClick={()=>setMobileColumns(2)}><Grid2X2 size={17}/></button><button type="button" aria-label="Single-column view" aria-pressed={mobileColumns===1} title="Single-column view" onClick={()=>setMobileColumns(1)}><GalleryVertical size={17}/></button></div></div>
  <div className={styles.sectionHeading}><h3>Explore listings</h3><label className={styles.sort}><span className={styles.srOnly}>Sort listings</span><select aria-label="Sort listings" value={selection.sort} onChange={event=>onChange({...selection,sort:event.target.value as WildzMarketSort})}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option><option value="rarity-high">Rarity: rarest first</option><option value="rarity-low">Rarity: trail first</option></select></label></div>
  {shownListings.length||shownUnlisted.length?<div className={styles.galleryPages}>{Array.from({length:Math.ceil(tiles.length/WILDZ_MARKET_PAGE_SIZE)},(_,index)=><WildzMarketGalleryPage key={`${selection.query}:${selection.category}:${selection.sort}:${selection.rarity??'all'}:${mobileColumns}:${index}`} index={index} active={active} columns={mobileColumns}>{tiles.slice(index*WILDZ_MARKET_PAGE_SIZE,(index+1)*WILDZ_MARKET_PAGE_SIZE)}</WildzMarketGalleryPage>)}</div>:preparing||indexing||loading?<div className={styles.gallerySkeleton} aria-label="Loading Market" aria-busy="true"><span/><span/></div>:<div className={styles.empty}><Package size={32} aria-hidden="true"/><h3>{filtered?'No matching cards':'Your next discovery starts here'}</h3><p>{filtered?'Try another search or adjust your filters.':'Publicly shared, owned creatures and resource listings appear here.'}</p>{filtered?<button type="button" onClick={()=>{setPriceText('');onChange({query:'',category:'all',sort:'featured',maxPriceUsdCents:null,availableOnly:false,rarity:'all'});}}>Clear search and filters</button>:null}</div>}
  <div ref={loadSentinel} className={styles.loadSentinel} aria-hidden="true"/>
  <div className={styles.discoveryFooter}><span>{indexing?'Loading catalogue…':<>{total} card{total===1?'':'s'}{filtered?' match your search':''}</>}</span><button type="button" disabled={refreshing||refreshDisabled} onClick={()=>{attempted.current.clear();setPreparationRevision(revision=>revision+1);onRefresh();}}>{refreshing?'Refreshing…':'Refresh listings'}</button></div>
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
