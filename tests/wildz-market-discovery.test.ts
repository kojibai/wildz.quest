import assert from 'node:assert/strict';
import {test} from 'node:test';
import {discoverWildzMarketListings,discoverWildzOwnedCards,initialMarketDiscovery,type WildzMarketDiscovery} from '../src/features/market/wildz-market-discovery';
import type {WildzMarketListingViewV128} from '../src/features/market/wildz-market-service-v128';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import {sealCollectedCard} from '../src/features/play/portable-card';

function owned(formId:string,title:string,encounterId=title,ownerHandle='seller.receiz.id'):WildzMarketOwnedCard{
 const asset=sealCollectedCard({formId,ownerReceizId:ownerHandle,encounterId:`market-discovery:${encounterId}`,capturedAt:'2026-08-23T22:45:39.818Z'});
 return {assetId:asset.id,title,proofDigest:asset.proof.digest,ownerHandle,claimKaiUPulse:null,claimHead:null,asset};
}
function listing(listingId:string,title:string,card?:WildzMarketOwnedCard,overrides:Partial<WildzMarketListingViewV128>={}):WildzMarketListingViewV128{
 return {listingId,title,kind:card?'creature':'package',sellerHandle:card?.ownerHandle??'seller.receiz.id',
  asset:card?{kind:'creature',assetId:card.assetId}:{kind:'package',packageId:`package:${listingId}`},priceUsdCents:'500',status:'active',canBuy:true,canCancel:false,...overrides};
}
const select=(overrides:Partial<WildzMarketDiscovery>={}):WildzMarketDiscovery=>({...initialMarketDiscovery,...overrides});

test('existing discovery calls retain category, price, availability and query selection without collection assets',()=>{
 const creature=owned('mintcub-1','Café companion');
 const cards=[listing('creature','Café companion',creature),listing('food','Forest provisions'),listing('closed','Closed stock',undefined,{status:'sold'}),listing('pending','Pending stock',undefined,{canBuy:false}),listing('expensive','Large stock',undefined,{priceUsdCents:'900'})];
 assert.deepEqual(discoverWildzMarketListings(cards,select()).map(row=>row.listingId),['creature','food','pending','expensive']);
 assert.deepEqual(discoverWildzMarketListings(cards,select({category:'creatures',query:'cafe seller'})).map(row=>row.listingId),['creature']);
 assert.deepEqual(discoverWildzMarketListings(cards,select({category:'resources',availableOnly:true,maxPriceUsdCents:'600'})).map(row=>row.listingId),['food']);
 const {rarity:omitted,...legacySelection}=initialMarketDiscovery;
 assert.deepEqual(discoverWildzMarketListings(cards,legacySelection).map(row=>row.listingId),['creature','food','pending','expensive']);
 void omitted;
});

test('listed rarity comes only from the exact creature and seller in the public collection',()=>{
 const rare=owned('aerobeak-1','Sky companion'),trail=owned('mintcub-1','Trail companion');
 const cards=[listing('rare','Sky companion',rare),listing('trail','Trail companion',trail),listing('other-owner','Different seller',rare,{sellerHandle:'other.receiz.id'}),listing('unknown','Unknown creature',undefined,{kind:'creature',asset:{kind:'creature',assetId:'wilds:missing'}}),listing('resources','Supplies')];
 assert.deepEqual(discoverWildzMarketListings(cards,select({rarity:'rare'}),[rare,trail]).map(row=>row.listingId),['rare']);
 assert.deepEqual(discoverWildzMarketListings(cards,select({rarity:'rare'})).map(row=>row.listingId),[]);
 assert.deepEqual(discoverWildzMarketListings(cards,select({rarity:'all'}),[rare,trail]).map(row=>row.listingId),['rare','trail','other-owner','unknown','resources']);
 assert.deepEqual(discoverWildzMarketListings(cards,select({category:'resources',rarity:'rare'}),[rare,trail]),[]);
});

test('rarity is searchable on listed and unlisted creatures without inventing rarity for resources',()=>{
 const mythic=owned('ledgerfox-1','Moon companion'),trail=owned('mintcub-1','Field companion');
 const cards=[listing('mythic','Moon companion',mythic),listing('resources','Supplies')];
 assert.deepEqual(discoverWildzMarketListings(cards,select({query:'MYTHIC seller'}),[mythic]).map(row=>row.listingId),['mythic']);
 assert.deepEqual(discoverWildzOwnedCards([mythic,trail],[],select({query:'mythic creature'})).map(row=>row.assetId),[mythic.assetId]);
});

test('owned rarity selection excludes missing seals and arbitrary metadata',()=>{
 const rare=owned('aerobeak-1','Sky companion'),trail=owned('mintcub-1','Trail companion');
 const {asset:removed,...withoutAsset}=rare;
 const metadataOnly={...withoutAsset,assetId:'wilds:metadata',rarity:'rare'} as WildzMarketOwnedCard;
 const mismatchedDigest={...rare,proofDigest:'unverified'};
 const mismatchedAsset={...rare,assetId:'wilds:other'};
 assert.deepEqual(discoverWildzOwnedCards([metadataOnly,mismatchedDigest,mismatchedAsset,trail,rare],[],select({rarity:'rare'})).map(row=>row.assetId),[rare.assetId]);
 assert.equal(discoverWildzOwnedCards([metadataOnly],[],select({rarity:'all'})).length,1);
 void removed;
});

test('the all-filter sentinel is never accepted as a creature manifest rarity',()=>{
 const trail=owned('mintcub-1','Trail'),malformed=structuredClone(owned('aerobeak-1','Unknown creature'));
 (malformed.asset!.manifest as unknown as {rarity:string}).rarity='all';
 assert.deepEqual(discoverWildzOwnedCards([malformed],[],select({query:'all'})),[]);
 assert.deepEqual(discoverWildzOwnedCards([malformed,trail],[],select({sort:'rarity-low'})).map(row=>row.title),['Trail','Unknown creature']);
});

test('rarity sorting uses all five ranks and keeps unknown assets and resources last in either direction',()=>{
 const trail=owned('mintcub-1','Trail'),uncommon=owned('voltray-1','Uncommon'),rare=owned('aerobeak-1','Rare'),mythic=owned('ledgerfox-1','Mythic'),eternal=owned('echobeak-1','Eternal');
 const collection=[trail,uncommon,rare,mythic,eternal];
 const cards=[listing('unknown','Unknown',undefined,{kind:'creature',asset:{kind:'creature',assetId:'wilds:missing'}}),listing('rare','Rare',rare),listing('resources','Supplies'),listing('eternal','Eternal',eternal),listing('trail','Trail',trail),listing('mythic','Mythic',mythic),listing('uncommon','Uncommon',uncommon)];
 assert.deepEqual(discoverWildzMarketListings(cards,select({sort:'rarity-high'}),collection).map(row=>row.listingId),['eternal','mythic','rare','uncommon','trail','resources','unknown']);
 assert.deepEqual(discoverWildzMarketListings(cards,select({sort:'rarity-low'}),collection).map(row=>row.listingId),['trail','uncommon','rare','mythic','eternal','resources','unknown']);
 const {asset:removed,...unknown}=owned('mintcub-1','Unknown');
 assert.deepEqual(discoverWildzOwnedCards([unknown,rare,eternal,trail,mythic,uncommon],[],select({sort:'rarity-high'})).map(row=>row.title),['Eternal','Mythic','Rare','Uncommon','Trail','Unknown']);
 assert.deepEqual(discoverWildzOwnedCards([unknown,rare,eternal,trail,mythic,uncommon],[],select({sort:'rarity-low'})).map(row=>row.title),['Trail','Uncommon','Rare','Mythic','Eternal','Unknown']);
 void removed;
});

test('rarity ties use title and stable identity without mutating source arrays',()=>{
 const zed=owned('aerobeak-1','Zed'),alpha=owned('aerobeak-1','Alpha'),sameA=owned('aerobeak-1','Same','same:a'),sameB=owned('aerobeak-1','Same','same:b');
 const cards=[listing('z','Zed',zed),listing('same:b','Same',sameB),listing('same:a','Same',sameA),listing('a','Alpha',alpha)];
 const selection=select({sort:'rarity-high'}),collection=[zed,sameB,sameA,alpha];
 assert.deepEqual(discoverWildzMarketListings(cards,selection,collection).map(row=>row.listingId),['a','same:a','same:b','z']);
 assert.deepEqual(discoverWildzMarketListings([...cards].reverse(),selection,collection).map(row=>row.listingId),['a','same:a','same:b','z']);
 assert.deepEqual(cards.map(row=>row.listingId),['z','same:b','same:a','a']);
 const expected=[alpha.assetId,...[sameA.assetId,sameB.assetId].sort(),zed.assetId];
 assert.deepEqual(discoverWildzOwnedCards(collection,[],selection).map(row=>row.assetId),expected);
 assert.deepEqual(discoverWildzOwnedCards([...collection].reverse(),[],selection).map(row=>row.assetId),expected);
 assert.deepEqual(collection.map(row=>row.title),['Zed','Same','Same','Alpha']);
});

test('rarity selection keeps listing exclusion and existing owned-only constraints',()=>{
 const listed=owned('aerobeak-1','Listed'),reserved=owned('aerobeak-1','Reserved'),unlisted=owned('aerobeak-1','Unlisted');
 const cards=[listing('active','Listed',listed),listing('reserved','Reserved',reserved,{status:'reserved'})];
 assert.deepEqual(discoverWildzOwnedCards([listed,reserved,unlisted],cards,select({rarity:'rare'})).map(row=>row.assetId),[unlisted.assetId]);
 assert.deepEqual(discoverWildzOwnedCards([unlisted],[],select({rarity:'rare',availableOnly:true})),[]);
 assert.deepEqual(discoverWildzOwnedCards([unlisted],[],select({rarity:'rare',maxPriceUsdCents:'1000'})),[]);
 assert.deepEqual(discoverWildzOwnedCards([unlisted],[],select({rarity:'rare',category:'resources'})),[]);
});
