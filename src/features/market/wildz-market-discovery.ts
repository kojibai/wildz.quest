import type {WildzMarketListingViewV128} from './wildz-market-service-v128';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import type {CreatureRarity} from '../play/creature-catalog';
import {sameWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';

export type WildzMarketCategory = 'all' | 'creatures' | 'resources';
export type WildzMarketRarity = 'all' | CreatureRarity;
export type WildzMarketSort = 'featured' | 'price-low' | 'price-high' | 'name' | 'rarity-high' | 'rarity-low';
export type WildzMarketDiscovery = Readonly<{
 query:string;category:WildzMarketCategory;sort:WildzMarketSort;maxPriceUsdCents:string|null;availableOnly:boolean;rarity?:WildzMarketRarity;
}>;
export const initialMarketDiscovery:WildzMarketDiscovery={query:'',category:'all',sort:'featured',maxPriceUsdCents:null,availableOnly:false,rarity:'all'};
const creatureRarities=['trail','uncommon','rare','mythic','eternal'] as const;
export const wildzMarketRarityOptions=['all',...creatureRarities] as const;

const searchable=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();

/** Collection admission verifies embedded cards. Require that same sealed asset,
 * rather than accepting a loose rarity field on the public gallery row. */
export function wildzMarketCardRarity(card:WildzMarketOwnedCard|undefined):CreatureRarity|null{
 const asset=card?.asset;
 if(!asset||asset.id!==card.assetId||asset.manifest?.assetId!==card.assetId||asset.proof?.digest!==card.proofDigest)return null;
 if(!(asset.manifest.schema==='receiz.wilds_card_manifest.v1'&&asset.proof.kind==='receiz.wilds_local_seal.v1')
  &&!(asset.manifest.schema==='receiz.wilds_living_card_manifest.v2'&&asset.proof.kind==='receiz.wilds_living_seal.v2'))return null;
 const rarity=asset.manifest.rarity;
 return creatureRarities.includes(rarity)?rarity:null;
}

export function wildzMarketListingRarity(listing:WildzMarketListingViewV128,collection:readonly WildzMarketOwnedCard[]=[]):CreatureRarity|null{
 if(listing.kind!=='creature'||listing.asset.kind!=='creature')return null;
 const assetId=listing.asset.assetId;
 return wildzMarketCardRarity(collection.find(card=>card.assetId===assetId&&sameWildzPlayerCoordinate(card.ownerHandle,listing.sellerHandle)));
}

/** Unknown creature rarity and resources follow known rarities in both directions. */
export function compareWildzMarketRarity(first:CreatureRarity|null,second:CreatureRarity|null,sort:'rarity-high'|'rarity-low'){
 if(first===null)return second===null?0:1;
 if(second===null)return -1;
 const comparison=wildzMarketRarityOptions.indexOf(first)-wildzMarketRarityOptions.indexOf(second);
 return sort==='rarity-high'?-comparison:comparison;
}

/** Display selection only. Availability and every transaction remain service-owned. */
export function discoverWildzMarketListings(listings:readonly WildzMarketListingViewV128[],selection:WildzMarketDiscovery,collection:readonly WildzMarketOwnedCard[]=[],resolveRarity=wildzMarketCardRarity):readonly WildzMarketListingViewV128[]{
 const words=searchable(selection.query.trim()).split(/\s+/).filter(Boolean);
 const maximum=selection.maxPriceUsdCents&&/^[0-9]+$/.test(selection.maxPriceUsdCents)?BigInt(selection.maxPriceUsdCents):null;
 const selectedRarity=selection.rarity??'all',rarities=new Map<WildzMarketListingViewV128,CreatureRarity|null>();
 const matches=listings.filter(listing=>{
  if(listing.status!=='active')return false;
  if(selection.category==='creatures'&&listing.kind!=='creature'||selection.category==='resources'&&listing.kind==='creature')return false;
  if(selection.availableOnly&&!listing.canBuy)return false;
  if(maximum!==null&&BigInt(listing.priceUsdCents)>maximum)return false;
  const rarity=listing.asset.kind==='creature'?resolveRarity(collection.find(card=>listing.asset.kind==='creature'&&card.assetId===listing.asset.assetId&&sameWildzPlayerCoordinate(card.ownerHandle,listing.sellerHandle))):null;rarities.set(listing,rarity);
  if(selectedRarity!=='all'&&rarity!==selectedRarity)return false;
  const haystack=searchable(`${listing.title} ${listing.sellerHandle} ${listing.kind==='creature'?'creature':'resources package'} ${rarity??''}`);
  return words.every(word=>haystack.includes(word));
 });
 if(selection.sort==='featured')return matches;
 return matches.sort((a,b)=>{
  if(selection.sort==='rarity-high'||selection.sort==='rarity-low')return compareWildzMarketRarity(rarities.get(a)??null,rarities.get(b)??null,selection.sort)
   ||a.title.localeCompare(b.title)||a.listingId.localeCompare(b.listingId);
  if(selection.sort==='name')return a.title.localeCompare(b.title);
  const first=BigInt(a.priceUsdCents),second=BigInt(b.priceUsdCents);
  const comparison=first<second?-1:first>second?1:0;
  return selection.sort==='price-high'?-comparison:comparison;
 });
}

export function discoverWildzOwnedCards(cards:readonly WildzMarketOwnedCard[],listings:readonly WildzMarketListingViewV128[],selection:WildzMarketDiscovery,resolveRarity=wildzMarketCardRarity){
 if(selection.category==='resources'||selection.availableOnly||selection.maxPriceUsdCents)return [];
 const listed=new Set(listings.filter(l=>l.status==='active'||l.status==='reserved').flatMap(l=>l.asset.kind==='creature'?[l.asset.assetId]:[]));
 const words=searchable(selection.query.trim()).split(/\s+/).filter(Boolean);
 const selectedRarity=selection.rarity??'all';
 const result=cards.filter(card=>{
  if(listed.has(card.assetId))return false;
  const rarity=resolveRarity(card);
  return (selectedRarity==='all'||rarity===selectedRarity)&&words.every(word=>searchable(`${card.title} ${card.ownerHandle} creature ${rarity??''}`).includes(word));
 });
 if(selection.sort==='rarity-high'||selection.sort==='rarity-low'){
  const sort=selection.sort;
  return result.sort((a,b)=>compareWildzMarketRarity(resolveRarity(a),resolveRarity(b),sort)
   ||a.title.localeCompare(b.title)||a.assetId.localeCompare(b.assetId)||a.ownerHandle.localeCompare(b.ownerHandle));
 }
 return selection.sort==='name'?result.sort((a,b)=>a.title.localeCompare(b.title)):result;
}
