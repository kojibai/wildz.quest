import {canonicalizeReceizV122, type ReceizClient} from '@receiz/sdk';
import {parseWildzPlayerCoordinate} from './wildz-player-coordinate';

export const WILDZ_MARKET_SOURCE_URL_V128 = 'https://wildz.quest/receiz/market-source-v128';
export const WILDS_RESOURCE_SOURCE_URL_V128 = 'https://wildz.quest/receiz/resource-source-v128';
export const WILDZ_MARKET_SOURCE_PUBLISHER_NAMESPACE_V128 = 'wildz.market-source-publishers.v128';
export const WILDS_RESOURCE_SOURCE_PUBLISHER_NAMESPACE_V128 = 'wildz.resource-source-publishers.v128';
export const WILDZ_MARKET_SOURCE_PUBLISHER_PATH_V128 = `/api/public-proof/namespace/${WILDZ_MARKET_SOURCE_PUBLISHER_NAMESPACE_V128}`;
export const WILDS_RESOURCE_SOURCE_PUBLISHER_PATH_V128 = `/api/public-proof/namespace/${WILDS_RESOURCE_SOURCE_PUBLISHER_NAMESPACE_V128}`;
export const isWildzSourceDigestV128 = (value:unknown):value is string => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
export const isWildzMarketSourceOwnerUrlV128 = (url:string) => /^https:\/\/wildz\.quest\/receiz\/market-source-v128\/(?:publishers\/[a-z0-9_]{3,30}|originals\/[a-z0-9_]{3,30}\/[a-f0-9]{64})$/.test(url);
export const isWildsResourceSourceOwnerUrlV128 = (url:string) => /^https:\/\/wildz\.quest\/receiz\/resource-source-v128\/(?:publishers\/[a-z0-9_]{3,30}|originals\/[a-z0-9_]{3,30}\/[a-f0-9]{64})$/.test(url);

const domains = {
 market: {url:WILDZ_MARKET_SOURCE_URL_V128,namespace:WILDZ_MARKET_SOURCE_PUBLISHER_NAMESPACE_V128,schema:'wildz.market-source-publisher.v128'},
 resource: {url:WILDS_RESOURCE_SOURCE_URL_V128,namespace:WILDS_RESOURCE_SOURCE_PUBLISHER_NAMESPACE_V128,schema:'wildz.resource-source-publisher.v128'},
} as const;
type SourceKind = keyof typeof domains;
export type WildzSourceCoordinateV128 = Readonly<{head:string;cursor:number}>;
export type WildzSourcePublisherV128 = WildzSourceCoordinateV128 & Readonly<{
 schema:(typeof domains)[SourceKind]['schema'];artifactSha256:string;
}>;

export function wildzSourceOwnerUrlsV128(kind:SourceKind,owner:string,artifactSha256:string) {
 const actor=parseWildzPlayerCoordinate(owner);
 if(actor?.profileHandle!==owner||!isWildzSourceDigestV128(artifactSha256))throw Error('wildz_source_locator_invalid');
 const {url}=domains[kind];
 return {publisher:`${url}/publishers/${actor.actorId}`,original:`${url}/originals/${actor.actorId}/${artifactSha256}`};
}

export function parseWildzSourcePublisherV128(kind:SourceKind,value:unknown):WildzSourcePublisherV128|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as WildzSourcePublisherV128;
 return Object.keys(row).sort().join(',')==='artifactSha256,cursor,head,schema'
  &&row.schema===domains[kind].schema&&isWildzSourceDigestV128(row.head)
  &&isWildzSourceDigestV128(row.artifactSha256)&&Number.isSafeInteger(row.cursor)&&row.cursor>0?row:null;
}

export type WildzLocatedSourceV128 = Readonly<{owner:string;pointer:WildzSourcePublisherV128}>;
/** Registry entries are hints. A reader opens the named Original, verifies its
 * carried coordinate, and can keep known history through unavailable discovery. */
export async function readWildzOwnedSourceV128<T>(sdk:ReceizClient,kind:SourceKind,
 open:(url:string,located?:WildzLocatedSourceV128)=>Promise<T|null>){
 const {url:legacy,namespace}=domains[kind];
 const directory=await sdk.appState.byNamespace(namespace);
 if(!directory.ok||!Array.isArray(directory.records)||directory.records.length>100)throw Error('wildz_source_locator_directory_invalid');
 const candidates=directory.records.flatMap(row=>{
  const pointer=parseWildzSourcePublisherV128(kind,sdk.appState.extractData(row)?.storeStateRecord);
  const owner=row.externalCreatorId;
  if(!pointer||typeof owner!=='string'||(row.appNamespace??row.namespace)!==namespace)return [];
  try{
   const urls=wildzSourceOwnerUrlsV128(kind,owner,pointer.artifactSha256);
   return row.sourceUrl===urls.publisher?[{owner,pointer,url:urls.original}]:[];
  }catch{return [];}
 }).sort((left,right)=>right.pointer.cursor-left.pointer.cursor);
 let failure:unknown;
 for(const {owner,pointer,url} of candidates)try{
  const proof=await open(url,{owner,pointer});
  if(proof)return proof;
 }catch(cause){failure??=cause;}
 const proof=await open(legacy);
 if(!proof&&failure)throw failure;
 return proof;
}

export async function publishWildzOwnedSourceV128(input:Readonly<{
 sdk:ReceizClient;kind:SourceKind;owner:string;artifactSha256:string;coordinate:WildzSourceCoordinateV128;
 publishOriginal(url:string):Promise<void>;
 publishPointer(url:string,record:WildzSourcePublisherV128,namespace:string):Promise<void>;
}>){
 const {kind,sdk,owner,artifactSha256,coordinate}=input;
 const {schema,namespace}=domains[kind];
 const pointer=parseWildzSourcePublisherV128(kind,{schema,artifactSha256,head:coordinate.head,cursor:coordinate.cursor});
 if(!pointer)throw Error('wildz_source_locator_invalid');
 const urls=wildzSourceOwnerUrlsV128(kind,owner,artifactSha256);
 const restored=await sdk.publicStore.restoreLatest({url:urls.publisher,tenantHost:'wildz.quest'});
 const prior=parseWildzSourcePublisherV128(kind,restored.storeStateRecord);
 if(prior){
  if(restored.record?.sourceUrl!==urls.publisher||restored.record.externalCreatorId!==owner)throw Error('wildz_source_locator_conflict');
  if(prior.cursor>pointer.cursor||canonicalizeReceizV122(prior)===canonicalizeReceizV122(pointer))return;
  if(prior.cursor===pointer.cursor)throw Error('wildz_source_locator_conflict');
 }
 await input.publishOriginal(urls.original);
 await input.publishPointer(urls.publisher,pointer,namespace);
}
