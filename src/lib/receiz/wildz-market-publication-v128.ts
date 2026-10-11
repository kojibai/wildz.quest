import {createReceizClient,createReceizAppStateFeed,createReceizPublicStoreStateRecord,RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA,
 type JsonObject,type ReceizClient,type ReceizPublicStoreSignedPublish} from '@receiz/sdk';
import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import {initialWildzMarketSourceV128,reduceWildzMarketSourceV128,wildzMarketSourceHeadV128} from './wildz-market-source-journal-v128';
import type {WildzMarketSourceEventV128,WildzMarketSourceRepositoryV128,WildzMarketSourceSnapshotV128,WildzMarketListingV128} from './wildz-market-source-types-v128';
import type {WildzIdentityRepository} from './wildz-identity-repository';
import type {WildzContinuityDatabase} from '../storage/wildz-indexed-db';
import {sameWildzPlayerCoordinate} from './wildz-player-coordinate';
import {WILDZ_PRODUCT} from '../wildz/product';

export const WILDZ_MARKET_PUBLICATION_NAMESPACE_V128='wildz.market-listings.v128';
export type WildzMarketPublicationResultV128=Readonly<{snapshot:WildzMarketSourceSnapshotV128;listing:WildzMarketListingV128;
 publication:Readonly<{schema:'wildz.market-publication-locator.v128';sourceUrl:string;recordDigest:string}>}>;
export type WildzMarketPublicationSourceV128=Readonly<{
 load:WildzMarketSourceRepositoryV128['load'];
 list(request:Parameters<WildzMarketSourceRepositoryV128['list']>[0]):Promise<WildzMarketPublicationResultV128>;
 cancel(request:Parameters<WildzMarketSourceRepositoryV128['cancel']>[0]):Promise<WildzMarketPublicationResultV128>;
 observe(listingId:string):Promise<WildzMarketPublicationResultV128>;
}>;
type ListingCommand=Extract<WildzMarketSourceEventV128,{kind:'list'}>;
type CancellationCommand=Extract<WildzMarketSourceEventV128,{kind:'cancel'}>;
export type WildzMarketPublicationRecordV128=Readonly<{
 schema:'wildz.market-public-listing.v128';listing:ListingCommand;cancellation:CancellationCommand|null;
}>;
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value)).slice(7);
function fail(reason='invalid'):never{throw Error(`wildz_market_publication_${reason}`);}
export function wildzMarketPublicationUrlV128(listingId:string){
 if(!/^market:listing:[a-f0-9]{64}$/.test(listingId))fail();
 return `${WILDZ_PRODUCT.origin}/receiz/market-listings-v128/${listingId.slice('market:listing:'.length)}`;
}
export const isWildzMarketPublicationUrlV128=(url:string)=>/^https:\/\/wildz\.quest\/receiz\/market-listings-v128\/[a-f0-9]{64}$/.test(url);
/** A seller's signed advertisement, like a Profile gallery declaration. It is
 * public application data and never substitutes for a native custody proof. */
export function parseWildzMarketPublicationRecordV128(value:unknown):WildzMarketPublicationRecordV128{
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 const record=value as WildzMarketPublicationRecordV128;
 if(record.schema!=='wildz.market-public-listing.v128'||!same(Object.keys(record).sort(),['cancellation','listing','schema'])
  ||record.listing?.kind!=='list'||new TextEncoder().encode(canonicalPortableCardJson(record)).length>100_000)fail();
 wildzMarketPublicationUrlV128(record.listing.listingId);
 let state=reduceWildzMarketSourceV128(initialWildzMarketSourceV128(),record.listing,record.listing.actorHandle);
 if(record.cancellation!==null){
  if(record.cancellation?.kind!=='cancel'||record.cancellation.actorHandle!==record.listing.actorHandle||record.cancellation.listingId!==record.listing.listingId)fail();
  state=reduceWildzMarketSourceV128(state,record.cancellation,record.listing.actorHandle);
 }
 if(!state.listings[record.listing.listingId])fail();return record;
}
const projectedListing=(record:WildzMarketPublicationRecordV128)=>{
 let state=reduceWildzMarketSourceV128(initialWildzMarketSourceV128(),record.listing,record.listing.actorHandle);
 if(record.cancellation)state=reduceWildzMarketSourceV128(state,record.cancellation,record.listing.actorHandle);
 return state.listings[record.listing.listingId]!;
};
const publicationInput=(record:WildzMarketPublicationRecordV128)=>({tenantHost:WILDZ_PRODUCT.domain,merchantReceizId:record.listing.actorHandle,
 sourceUrl:wildzMarketPublicationUrlV128(record.listing.listingId),namespace:WILDZ_MARKET_PUBLICATION_NAMESPACE_V128,
 title:'Wildz Player Market listing',platform:WILDZ_PRODUCT.name,projectionState:'published',storeStateRecord:record as unknown as JsonObject});
/** Bound relay envelope. Receiz performs the actual Identity Seal signature
 * and registered-owner admission, exactly as it does for signed Profiles. */
export function parseSignedWildzMarketPublicationV128(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 const signed=value as ReceizPublicStoreSignedPublish<JsonObject>,record=parseWildzMarketPublicationRecordV128(signed.storeStateRecord),input=publicationInput(record);
 const expected=createReceizAppStateFeed([createReceizPublicStoreStateRecord({sourceUrl:input.sourceUrl,externalCreatorId:input.merchantReceizId,
  title:input.title,namespace:input.namespace,state:'published',platform:input.platform,record:input.storeStateRecord,
  data:{storeStateRecord:input.storeStateRecord,tenantHost:input.tenantHost,merchantReceizId:input.merchantReceizId}})],
 {schema:RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA,namespace:input.namespace,externalCreatorId:input.merchantReceizId});
 if(signed.schema!=='receiz.public_store.signed_publish.v1'||signed.tenantHost!==input.tenantHost||signed.merchantReceizId!==input.merchantReceizId
  ||!same(signed.feed,expected))fail();return record;
}

export async function readWildzMarketPublicationsV128(sdk:ReceizClient){
 const feed=await sdk.appState.byNamespace(WILDZ_MARKET_PUBLICATION_NAMESPACE_V128);
 if(feed.ok!==true||!Array.isArray(feed.records)||feed.records.length>1024)fail('read_failed');
 const records=new Map<string,WildzMarketPublicationRecordV128>();
 const ambiguous=new Set<string>();
 for(const row of feed.records)try{
  if((row.appNamespace??row.namespace)!==WILDZ_MARKET_PUBLICATION_NAMESPACE_V128)fail();
  const data=sdk.appState.extractData(row),record=parseWildzMarketPublicationRecordV128(data?.storeStateRecord);
  if(row.sourceUrl!==wildzMarketPublicationUrlV128(record.listing.listingId)||row.externalCreatorId!==record.listing.actorHandle)fail();
  if(ambiguous.has(record.listing.listingId))continue;
  if(records.has(record.listing.listingId)){records.delete(record.listing.listingId);ambiguous.add(record.listing.listingId);continue;}
  records.set(record.listing.listingId,record);
 }catch{/* Other public namespace entries cannot disable valid advertisements. */}
 return records;
}

/** Only publication and withdrawal use this port. Purchase reservations and
 * private receipt/custody admission remain on the existing native source port. */
export function createWildzMarketPublicationSourceV128(input:Readonly<{
 sdk:ReceizClient;database:WildzContinuityDatabase;keyId:string;ownerHandle:string;
 currentIdentity():Readonly<{keyId:string;ownerHandle:string}>;
 repository:Pick<WildzIdentityRepository,'active'|'withKeyFile'>;
}>):WildzMarketPublicationSourceV128{
 let records=new Map<string,WildzMarketPublicationRecordV128>();
 const current=()=>{const active=input.currentIdentity();if(active.keyId!==input.keyId||active.ownerHandle!==input.ownerHandle)fail('identity_changed');};
 const snapshot=()=>{
  const listings=Object.fromEntries([...records].map(([id,record])=>[id,projectedListing(record)]));
  const state={...initialWildzMarketSourceV128(),listings};
  return {state,head:records.size?wildzMarketSourceHeadV128(state):null,proof:null};
 };
 async function load(){current();records=await readWildzMarketPublicationsV128(input.sdk);current();return snapshot();}
 async function readExact(listingId:string){
  current();const url=wildzMarketPublicationUrlV128(listingId),restored=await input.sdk.publicStore.restoreLatest({url,tenantHost:WILDZ_PRODUCT.domain});current();
  if(!restored.storeStateRecord)return null;
  const record=parseWildzMarketPublicationRecordV128(restored.storeStateRecord);
  if(record.listing.listingId!==listingId||restored.record?.sourceUrl!==url||restored.record.externalCreatorId!==record.listing.actorHandle)fail();
  records.set(listingId,record);return record;
 }
 const result=(record:WildzMarketPublicationRecordV128):WildzMarketPublicationResultV128=>({snapshot:snapshot(),listing:projectedListing(record),
  publication:{schema:'wildz.market-publication-locator.v128',sourceUrl:wildzMarketPublicationUrlV128(record.listing.listingId),recordDigest:digest(record)}});
 async function publish(record:WildzMarketPublicationRecordV128,attemptId:string){
  current();parseWildzMarketPublicationRecordV128(record);
  const session=await input.repository.active();current();
  if(!session||session.localAuthority!=='verified'||session.keyId!==input.keyId||!sameWildzPlayerCoordinate(session.actorId,input.ownerHandle))fail('identity_required');
  const storageKey=JSON.stringify(['wildz.market-signed-publication.v128',input.ownerHandle,input.keyId,attemptId]);
  let retained=await input.database.read<ReceizPublicStoreSignedPublish<JsonObject>>('meta',storageKey);current();
  if(retained){if(!same(parseSignedWildzMarketPublicationV128(retained),record))fail('attempt_conflict');}
  else{
   const signed=await input.repository.withKeyFile(input.keyId,async keyFile=>{
    current();if(keyFile.keyId!==input.keyId||session.remoteStatus!=='connected'&&!sameWildzPlayerCoordinate(keyFile.owner.username??'',input.ownerHandle))fail('identity_changed');
    return input.sdk.publicStore.signPublish({...publicationInput(record),keyFile});
   });current();parseSignedWildzMarketPublicationV128(signed);
   retained=await input.database.transaction(['meta'],'readwrite',async tx=>{
    current();const previous=await tx.get<ReceizPublicStoreSignedPublish<JsonObject>>('meta',storageKey);
    if(previous){if(!same(parseSignedWildzMarketPublicationV128(previous),record))fail('attempt_conflict');return previous;}
    await tx.put('meta',signed,storageKey);return signed;
   });
  }
  // Recover the exact accepted publication before reissuing an uncertain write.
  const prior=await readExact(record.listing.listingId);
  if(prior&&(same(prior,record)||record.cancellation===null&&same(prior.listing,record.listing)))return result(prior);
  if(prior&&(!same(prior.listing,record.listing)||prior.cancellation))fail('listing_conflict');
  const active=await input.repository.active();current();if(active?.keyId!==input.keyId||active.localAuthority!=='verified'||!sameWildzPlayerCoordinate(active.actorId,input.ownerHandle))fail('identity_changed');
  const accepted=await input.sdk.publicStore.publishSigned(retained,{idempotencyKey:`wildz:market-publication:${digest(record)}`});current();
  if(accepted.ok!==true||!accepted.appendAnchorId||accepted.knownHead?.appendAnchorId!==accepted.appendAnchorId)fail('unconfirmed');
  const confirmed=await readExact(record.listing.listingId);if(!confirmed||!same(confirmed,record))fail('unconfirmed');return result(confirmed);
 }
 return {load,async list(request){return publish({schema:'wildz.market-public-listing.v128',listing:{schema:'wildz.market-source-command.v128',kind:'list',actorHandle:input.ownerHandle,...request},cancellation:null},request.attemptId);},
  async cancel(request){const record=await readExact(request.listingId);if(!record)fail('listing_missing');
   if(record.listing.actorHandle!==input.ownerHandle)fail('seller_required');
   if(record.cancellation)return result(record);
   return publish({...record,cancellation:{schema:'wildz.market-source-command.v128',kind:'cancel',actorHandle:input.ownerHandle,...request}},request.attemptId);
  },async observe(listingId){const record=await readExact(listingId);if(!record)fail('listing_missing');return result(record);}};
}

export function createWildzMarketPublicationSdkV128(fetcher:typeof fetch=fetch){
 return createReceizClient({baseUrl:'https://receiz.com',fetchImpl:async(url,init)=>{
  const path=new URL(String(url));
  if(path.origin!=='https://receiz.com')fail('path_invalid');
  if((init?.method??'GET')==='GET'&&path.pathname===`/api/public-proof/namespace/${encodeURIComponent(WILDZ_MARKET_PUBLICATION_NAMESPACE_V128)}`&&!path.search)
   return fetcher('/api/wilds/market/publications',{credentials:'omit',cache:'no-store',redirect:'error'});
  if((init?.method??'GET')==='GET'&&path.pathname==='/api/public-proof/by-url'&&path.searchParams.size===1&&isWildzMarketPublicationUrlV128(path.searchParams.get('url')??''))
   return fetcher(`/api/wilds/market/publications?url=${encodeURIComponent(path.searchParams.get('url')!)}`,{credentials:'omit',cache:'no-store',redirect:'error'});
  if(init?.method==='POST'&&path.pathname==='/api/public-proof/registry/feed'&&!path.search)
   return fetcher('/api/wilds/market/publications',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'content-type':'application/json'},body:init.body});
  fail('path_invalid');
 }});
}
