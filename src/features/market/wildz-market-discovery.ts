import type {WildzMarketListingViewV128} from './wildz-market-service-v128';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';

export type WildzMarketCategory = 'all' | 'creatures' | 'resources';
export type WildzMarketSort = 'featured' | 'price-low' | 'price-high' | 'name';
export type WildzMarketDiscovery = Readonly<{
 query:string;category:WildzMarketCategory;sort:WildzMarketSort;maxPriceUsdCents:string|null;availableOnly:boolean;
}>;
export const initialMarketDiscovery:WildzMarketDiscovery={query:'',category:'all',sort:'featured',maxPriceUsdCents:null,availableOnly:false};

const searchable=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();

/** Display selection only. Availability and every transaction remain service-owned. */
export function discoverWildzMarketListings(listings:readonly WildzMarketListingViewV128[],selection:WildzMarketDiscovery):readonly WildzMarketListingViewV128[]{
 const words=searchable(selection.query.trim()).split(/\s+/).filter(Boolean);
 const maximum=selection.maxPriceUsdCents&&/^[0-9]+$/.test(selection.maxPriceUsdCents)?BigInt(selection.maxPriceUsdCents):null;
 const matches=listings.filter(listing=>{
  if(listing.status!=='active')return false;
  if(selection.category==='creatures'&&listing.kind!=='creature'||selection.category==='resources'&&listing.kind==='creature')return false;
  if(selection.availableOnly&&!listing.canBuy)return false;
  if(maximum!==null&&BigInt(listing.priceUsdCents)>maximum)return false;
  const haystack=searchable(`${listing.title} ${listing.sellerHandle} ${listing.kind==='creature'?'creature':'resources package'}`);
  return words.every(word=>haystack.includes(word));
 });
 if(selection.sort==='featured')return matches;
 return matches.sort((a,b)=>{
  if(selection.sort==='name')return a.title.localeCompare(b.title);
  const first=BigInt(a.priceUsdCents),second=BigInt(b.priceUsdCents);
  const comparison=first<second?-1:first>second?1:0;
  return selection.sort==='price-high'?-comparison:comparison;
 });
}

export function discoverWildzOwnedCards(cards:readonly WildzMarketOwnedCard[],listings:readonly WildzMarketListingViewV128[],selection:WildzMarketDiscovery){
 if(selection.category==='resources'||selection.availableOnly||selection.maxPriceUsdCents)return [];
 const listed=new Set(listings.filter(l=>l.status==='active'||l.status==='reserved').flatMap(l=>l.asset.kind==='creature'?[l.asset.assetId]:[]));
 const words=searchable(selection.query.trim()).split(/\s+/).filter(Boolean);
 const result=cards.filter(card=>!listed.has(card.assetId)&&words.every(word=>searchable(`${card.title} ${card.ownerHandle} creature`).includes(word)));
 return selection.sort==='name'?result.sort((a,b)=>a.title.localeCompare(b.title)):result;
}
